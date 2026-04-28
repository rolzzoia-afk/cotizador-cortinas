-- ============================================================================
-- Migración: sync_colmena_tubos atómica (cierra el bug de huérfanos por lock conflict)
-- Fecha: 2026-04-28
-- ============================================================================
--
-- Contexto del problema:
--   Hasta ahora el optimizador hacía 2 escrituras separadas al guardar una
--   sesión de corte:
--     1. RPC sync_colmena_tubos (con lock optimista, transaccional internamente)
--     2. INSERT directo a tubos_historial (eventos corte/sobrante/merma/ingreso)
--
--   Si la fase 1 fallaba por conflicto de lock (otra sesión modificó la colmena),
--   el código JS igual avanzaba a la fase 2 — los eventos quedaban commiteados
--   en historial sin contraparte en colmena_tubos. Esto generaba "perdidos"
--   (sobrantes en historial sin tubo abierto) cada vez que un operario chocaba
--   con el lock.
--
-- Solución:
--   Extender sync_colmena_tubos con un 4to parámetro p_eventos jsonb. La RPC
--   inserta los eventos al historial DENTRO de la misma transacción que el
--   sync de colmena_tubos. Si falla cualquier paso (lock, validación, insert),
--   todo el batch se rollbackea automáticamente.
--
-- Compatibilidad:
--   p_eventos tiene default '[]'::jsonb, así que llamadas viejas con 3 args
--   siguen funcionando sin escribir nada al historial. La nueva fuente de
--   eventos es exclusivamente el optimizador via 4to argumento.
--
-- Seguridad:
--   El empresa_id de cada evento se setea desde p_empresa_id (validado contra
--   auth.uid()), no desde el payload del cliente. Previene cualquier intento
--   de escribir al historial de otro tenant.
--
-- Filtro de eventos:
--   Solo se aceptan eventos con tipo en ('ingreso','corte','sobrante','merma',
--   'eliminado'). Cualquier otro valor de evento se descarta silenciosamente.
-- ============================================================================

-- 1) DROP de la versión vieja (necesario porque cambia la firma)
DROP FUNCTION IF EXISTS public.sync_colmena_tubos(uuid, jsonb, timestamptz);
DROP FUNCTION IF EXISTS public.sync_colmena_tubos(uuid, jsonb);

-- 2) CREATE de la versión nueva con 4to parámetro p_eventos
CREATE OR REPLACE FUNCTION public.sync_colmena_tubos(
    p_empresa_id       uuid,
    p_tubos            jsonb,
    p_expected_sync_at timestamptz DEFAULT NULL,
    p_eventos          jsonb       DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_empresa  uuid;
    v_current_sync_at timestamptz;
BEGIN
    -- Validar autenticación y multi-tenancy
    SELECT empresa_id INTO v_caller_empresa FROM perfiles WHERE id = auth.uid();
    IF v_caller_empresa IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;
    IF p_empresa_id IS DISTINCT FROM v_caller_empresa THEN
        RAISE EXCEPTION 'No autorizado: no puedes sincronizar la colmena de otro tenant (caller=%, pedido=%)',
            v_caller_empresa, p_empresa_id USING ERRCODE = '42501';
    END IF;

    -- Lock optimista (PR #14): si el cliente pasa expected_sync_at, debe matchear el last_sync_at de la BD.
    IF p_expected_sync_at IS NOT NULL THEN
        SELECT last_sync_at INTO v_current_sync_at
        FROM colmena_sync_state
        WHERE empresa_id = p_empresa_id
        FOR UPDATE;

        IF v_current_sync_at IS NULL THEN
            INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
            VALUES (p_empresa_id, NOW(), COALESCE(auth.uid()::text, 'rpc'));
        ELSIF v_current_sync_at IS DISTINCT FROM p_expected_sync_at THEN
            RAISE EXCEPTION 'colmena_sync_conflict: la colmena fue modificada por otra sesión (BD=%, esperado=%)',
                v_current_sync_at, p_expected_sync_at USING ERRCODE = '40001';
        END IF;
    END IF;

    PERFORM set_config('app.sync_active', 'true', true);

    -- Sincronizar colmena_tubos: DELETE + INSERT con tombstone V2.
    DELETE FROM colmena_tubos WHERE empresa_id = p_empresa_id;

    INSERT INTO colmena_tubos (
        empresa_id, n_colmena, cod, medida_cm, medida_mm,
        serial, tubo_raiz_id, agregado_por_admin
    )
    SELECT
        p_empresa_id,
        COALESCE(t->>'n_colmena', '-'),
        COALESCE(UPPER(TRIM(t->>'cod')), ''),
        COALESCE((t->>'medida_cm')::numeric, 0),
        COALESCE((t->>'medida_mm')::integer, 0),
        NULLIF(t->>'serial', ''),
        COALESCE((t->>'tubo_raiz_id')::uuid, gen_random_uuid()),
        COALESCE((t->>'agregado_por_admin')::boolean, false)
    FROM jsonb_array_elements(p_tubos) AS t
    WHERE (t->>'tubo_raiz_id') IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM tubos_historial th_elim
           WHERE th_elim.empresa_id   = p_empresa_id::text
             AND th_elim.tubo_raiz_id = (t->>'tubo_raiz_id')::uuid
             AND th_elim.evento       = 'eliminado'
             AND NOT EXISTS (
                 SELECT 1 FROM tubos_historial th_ing
                 WHERE th_ing.empresa_id   = p_empresa_id::text
                   AND th_ing.tubo_raiz_id = th_elim.tubo_raiz_id
                   AND th_ing.evento       = 'ingreso'
                   AND th_ing.created_at   > th_elim.created_at
             )
       );

    -- Insertar eventos al historial dentro de la misma transacción.
    -- Si esto falla, todo lo de arriba se rollbackea (nada queda commiteado).
    -- empresa_id se setea desde el parámetro validado, NO desde el payload.
    IF p_eventos IS NOT NULL AND jsonb_array_length(p_eventos) > 0 THEN
        INSERT INTO tubos_historial (
            empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, medida_resultado_cm,
            evento, plan_id, ot, linea_idx, registrado_por, notas, fuente
        )
        SELECT
            p_empresa_id::text,
            NULLIF(e->>'tubo_raiz_id', '')::uuid,
            e->>'n_colmena',
            UPPER(TRIM(e->>'cod')),
            NULLIF(e->>'medida_cm', '')::numeric,
            NULLIF(e->>'medida_resultado_cm', '')::numeric,
            e->>'evento',
            NULLIF(e->>'plan_id', '')::uuid,
            e->>'ot',
            NULLIF(e->>'linea_idx', '')::integer,
            COALESCE(e->>'registrado_por', auth.uid()::text),
            e->>'notas',
            COALESCE(e->>'fuente', 'optimizador')
        FROM jsonb_array_elements(p_eventos) AS e
        WHERE e->>'evento' IN ('ingreso', 'corte', 'sobrante', 'merma', 'eliminado');
    END IF;

    -- Actualizar last_sync_at (post-sync exitoso)
    UPDATE colmena_sync_state
    SET last_sync_at = NOW(),
        last_sync_by = COALESCE(auth.uid()::text, 'rpc')
    WHERE empresa_id = p_empresa_id;

    IF NOT FOUND THEN
        INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
        VALUES (p_empresa_id, NOW(), COALESCE(auth.uid()::text, 'rpc'))
        ON CONFLICT (empresa_id) DO UPDATE SET
            last_sync_at = NOW(),
            last_sync_by = COALESCE(auth.uid()::text, 'rpc');
    END IF;
END;
$$;

-- 3) Re-grant para que authenticated pueda llamarla (se pierde con DROP)
GRANT EXECUTE ON FUNCTION public.sync_colmena_tubos(uuid, jsonb, timestamptz, jsonb) TO authenticated;

-- 4) Comentario de documentación
COMMENT ON FUNCTION public.sync_colmena_tubos(uuid, jsonb, timestamptz, jsonb) IS
'Sincroniza colmena_tubos con el estado final del optimizador y, atómicamente, '
'inserta los eventos del corte en tubos_historial. Si cualquier paso falla, '
'rollback automático. Lock optimista via colmena_sync_state.';
