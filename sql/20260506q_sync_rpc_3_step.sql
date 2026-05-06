-- ============================================================================
-- Fix: sync_colmena_tubos — separar INSERT en 3 pasos (ingresos / sobrantes / cortes)
-- Fecha: 2026-05-06
-- ============================================================================
--
-- Bug detectado al final del incidente OT 2942 (con debug logs):
--   El optimizador genera sobrantes con UUID random durante la planificación.
--   Esos sobrantes pueden ser consumidos por cortes posteriores en el mismo
--   plan. El array p_eventos contiene entonces:
--     [corte_parent, sobrante_sobrante, corte_sobrante]
--
--   En PR #54 dividimos el INSERT en PASO A (ingresos) y PASO B (resto).
--   Pero el PASO B junta sobrantes y cortes en un solo INSERT statement.
--   El trigger BEFORE INSERT bloquear_corte_sin_origen del corte_sobrante
--   no puede ver el sobrante_sobrante pendiente en el mismo statement —
--   lo rechaza con corte_sin_origen.
--
--   Esto NO ocurría antes de PR #54 porque el INSERT único agrupaba todo,
--   incluyendo el ingreso del tubo nuevo. PERO en escenarios mixtos (tubos
--   existentes + sobrantes derivados que se re-consumen) siempre fallaba.
--
-- Fix:
--   Tres INSERTs separados (misma transacción):
--     PASO A: ingresos (no necesitan origen)
--     PASO B: sobrantes/sobrante_error/restauracion/ajuste (origen para cortes)
--     PASO C: cortes/mermas/eliminados (el trigger ve A + B)
--
--   Mermas no requieren origen (trigger solo chequea cortes), pero las
--   ponemos en PASO C para mantener orden temporal consistente.
--
-- Atomicidad: los 3 INSERTs están dentro de la misma función SECURITY DEFINER,
-- por lo tanto en la misma transacción. Cualquier fallo rollbackea todo.
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

    -- Lock optimista (PR #14)
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
    -- 3 INSERTs separados para que el trigger BEFORE INSERT
    -- bloquear_corte_sin_origen vea los origenes (ingresos + sobrantes) ANTES
    -- de procesar los cortes.
    -- ─────────────────────────────────────────────────────────────────────────
    IF p_eventos IS NOT NULL AND jsonb_array_length(p_eventos) > 0 THEN
        -- PASO A: ingresos (no necesitan origen)
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

        -- PASO B: sobrantes y otros origenes (sobrante_error, restauracion, ajuste)
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
        WHERE e->>'evento' IN ('sobrante', 'sobrante_error', 'restauracion', 'ajuste');

        -- PASO C: cortes/mermas/eliminados (el trigger ya ve A + B)
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
        WHERE e->>'evento' IN ('corte', 'merma', 'eliminado');
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
'inserta los eventos en tubos_historial. INSERTs en 3 pasos: ingresos → sobrantes/origenes → cortes/mermas. '
'Esto permite que el trigger BEFORE INSERT bloquear_corte_sin_origen vea los origenes ANTES '
'de procesar los cortes. Necesario cuando el optimizador genera sobrantes consumidos por cortes posteriores '
'en el mismo plan (caso típico OT con peso/PESC).';
