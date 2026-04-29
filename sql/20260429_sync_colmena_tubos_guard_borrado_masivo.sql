-- ============================================================================
-- Migración: guard de borrado masivo en sync_colmena_tubos
-- Fecha: 2026-04-29
-- ============================================================================
--
-- Contexto del problema:
--   El 29/4 detectamos pérdida de 81 tubos del baseline subido el 28/4. Causa
--   raíz: un operario tenía cacheado el optimizador desde antes del baseline.
--   Su `_colmenaSyncStateAtLoad` era NULL (no había snapshot de sync_state al
--   momento que cargó el HTML). Cuando guardó hoy, llamó a sync_colmena_tubos
--   con `p_expected_sync_at = NULL` → la RPC saltó el lock optimista (porque
--   ese chequeo es opcional por diseño, ver PR #14) y procedió al
--   DELETE+INSERT con un snapshot stale, borrando 81 tubos sin generar
--   eventos `eliminado` (porque app.sync_active=true desactiva el trigger).
--
-- Decisión:
--   Mantener `p_expected_sync_at` como opcional (no podemos hacerlo NOT NULL
--   sin romper la carga manual desde Excel del optimizador). En su lugar,
--   agregar un guard quirúrgico: si el sync va a borrar más de un umbral
--   razonable (10 tubos absolutos AND >10% del inventario actual) y NO trae
--   lock optimista, abortar con error claro pidiendo recargar la página.
--
--   Operaciones legítimas que siguen funcionando:
--     - Sync normal del optimizador con lock (path principal)
--     - Carga manual desde Excel del optimizador con cambios pequeños
--     - cargar_inventario_baseline (no pasa por esta RPC)
--
--   Operación bloqueada:
--     - Cliente cache-stale que intenta reemplazar inventario completo
-- ============================================================================

-- La firma NO cambia respecto a 20260428_sync_colmena_tubos_atomico.sql, así
-- que CREATE OR REPLACE basta — sin DROP previo, evitamos ventana donde la
-- función no existe (clientes activos verían 404).
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
    v_total_actual    integer;
    v_total_nuevo     integer;
    v_a_eliminar      integer;
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

    -- Guard de borrado masivo (2026-04-29): si NO hay lock optimista y el sync
    -- intenta borrar muchos tubos, abortar. Cubre el caso de cliente cacheado
    -- pre-baseline cuyo `_colmenaSyncStateAtLoad` quedó en NULL y aplastaría
    -- el inventario actual con un snapshot viejo.
    IF p_expected_sync_at IS NULL THEN
        SELECT COUNT(*) INTO v_total_actual
        FROM colmena_tubos
        WHERE empresa_id = p_empresa_id;

        v_total_nuevo := COALESCE(jsonb_array_length(p_tubos), 0);
        v_a_eliminar  := GREATEST(0, v_total_actual - v_total_nuevo);

        -- Umbral combinado: > 10 tubos absolutos Y > 10% del inventario actual.
        -- Carga manual chica pasa; reemplazo masivo sin lock se rechaza.
        IF v_a_eliminar > 10 AND v_a_eliminar * 10 > v_total_actual THEN
            RAISE EXCEPTION 'sync_sin_lock_borraria_masivo: el sync intentaría eliminar % tubos (de % actuales) sin pasar lock optimista. Recargá la página completa (Ctrl+Shift+R) y reintentá. Si la operación es legítima, usá la carga de baseline desde Admin.',
                v_a_eliminar, v_total_actual
                USING ERRCODE = '40001';
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

GRANT EXECUTE ON FUNCTION public.sync_colmena_tubos(uuid, jsonb, timestamptz, jsonb) TO authenticated;

COMMENT ON FUNCTION public.sync_colmena_tubos(uuid, jsonb, timestamptz, jsonb) IS
'Sincroniza colmena_tubos con el estado final del optimizador y, atómicamente, '
'inserta los eventos del corte en tubos_historial. Si cualquier paso falla, '
'rollback automático. Lock optimista via colmena_sync_state. '
'Guard 2026-04-29: rechaza borrados masivos (>10 tubos AND >10%) sin lock.';
