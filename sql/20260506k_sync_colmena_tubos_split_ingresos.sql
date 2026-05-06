-- ============================================================================
-- Fix: sync_colmena_tubos — separar INSERT de ingresos vs cortes/mermas/sobrantes
-- Fecha: 2026-05-06
-- ============================================================================
--
-- Bug detectado el 2026-05-06 (incidente OT 2942):
--   Cuando el optimizador propone un TUBO NUEVO (tubo virgen 5.78m de bodega),
--   genera client-side un UUID nuevo y construye DOS eventos para el mismo
--   tubo_raiz_id: un 'ingreso' y un 'corte'.
--
--   Ambos eventos se enviaban en el mismo array p_eventos al RPC, que los
--   insertaba en un único statement INSERT INTO tubos_historial ... SELECT
--   FROM jsonb_array_elements(p_eventos). El trigger BEFORE INSERT
--   `bloquear_corte_sin_origen` (Defensa D) verifica cada fila individualmente
--   y NO puede ver filas pendientes del mismo statement, por lo que al
--   procesar el 'corte' no encuentra el 'ingreso' previo (que está pendiente
--   en el mismo statement, sin commit todavía) y rechaza con
--   `corte_sin_origen`. Toda la transacción se rollbackea.
--
--   El path legacy `insertarEventosHistorialDirecto` (optimizador.html L5355)
--   ya manejaba esto separando ingresos en un INSERT propio y commiteándolos
--   antes de insertar cortes/mermas/sobrantes. El comentario del JS lo
--   describe explícitamente (L5347-5354). Pero cuando se migró al path
--   atómico via RPC (PR #28), la separación no se replicó en el SQL.
--
-- Síntoma:
--   - Capa 4 alert "PLAN NO GUARDADO — sincronización falló silenciosamente"
--     cada vez que el optimizador propone TUBO NUEVO.
--   - Console: `[colmena_tubos] Intento N falló: corte_sin_origen:
--     tubo_raiz_id=<UUID> no tiene evento ingreso/sobrante/...`
--   - El UUID no existe en colmena_tubos ni en tubos_historial (porque el
--     rollback eliminó el ingreso pendiente).
--
-- Fix:
--   Hacer DOS INSERTs separados dentro del mismo SECURITY DEFINER:
--     1. INSERT solo ingresos (filtrado por evento='ingreso')
--     2. INSERT resto (corte/sobrante/merma/eliminado)
--   Ambos están en la misma transacción, así que el rollback atómico se
--   conserva. La diferencia es que el segundo INSERT puede ver los rows del
--   primero (ya commiteados al statement anterior) — el trigger encuentra
--   el ingreso y deja pasar el corte.
--
-- Compatibilidad:
--   Mantiene la firma `(uuid, jsonb, timestamptz, jsonb)`. Llamadas con
--   p_eventos vacío o sin ingresos se comportan idénticamente.
-- ============================================================================

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

    -- ─────────────────────────────────────────────────────────────────────────
    -- Insertar eventos al historial dentro de la misma transacción.
    -- DOS statements separados para que el trigger Defensa D
    -- (`bloquear_corte_sin_origen`) pueda ver los ingresos al procesar los
    -- cortes:
    --   PASO A: solo ingresos (sin trigger porque ingreso no necesita origen)
    --   PASO B: resto (corte/sobrante/merma/eliminado) — el trigger ahora
    --           ve los ingresos del PASO A
    -- Si cualquier INSERT falla, todo se rollbackea (siguen estando en la
    -- misma transacción de la función).
    -- ─────────────────────────────────────────────────────────────────────────
    IF p_eventos IS NOT NULL AND jsonb_array_length(p_eventos) > 0 THEN
        -- PASO A: solo ingresos
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
        WHERE e->>'evento' = 'ingreso';

        -- PASO B: resto de eventos (corte/sobrante/merma/eliminado)
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
        WHERE e->>'evento' IN ('corte', 'sobrante', 'merma', 'eliminado');
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

GRANT EXECUTE ON FUNCTION public.sync_colmena_tubos(uuid, jsonb, timestamptz, jsonb) TO authenticated;

COMMENT ON FUNCTION public.sync_colmena_tubos(uuid, jsonb, timestamptz, jsonb) IS
'Sincroniza colmena_tubos con el estado final del optimizador y, atómicamente, '
'inserta los eventos del corte en tubos_historial. Ingresos y cortes/sobrantes/mermas '
'van en INSERTs separados (mismo TX) para que el trigger BEFORE INSERT bloquear_corte_sin_origen '
'pueda ver los ingresos al procesar cortes del MISMO tubo_raiz_id (caso TUBO NUEVO).';

-- ============================================================================
-- Smoke test (post-deploy):
-- ============================================================================
-- Test 1: llamada vieja con 3 args (sin eventos) sigue funcionando
-- SELECT sync_colmena_tubos(
--   '67c635a5-152c-4780-a066-23f5081175a9'::uuid,
--   '[]'::jsonb,
--   NULL
-- );
--
-- Test 2: el guardado real lo ejerce el optimizador. Verificar que un plan
-- con TUBO NUEVO se guarde sin disparar Capa 4.
-- ============================================================================
