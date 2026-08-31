-- ─────────────────────────────────────────────────────────────────────
-- Guard de borrado masivo en guardar_plan_atomico — 2026-08-31
--
-- CONTEXTO: `guardar_plan_atomico` (2026-05-13) hace DELETE + INSERT de
-- colmena_tubos igual que `sync_colmena_tubos`, pero NUNCA recibió el guard
-- de borrado masivo del 2026-04-29 — y ese guard, además, solo corre cuando
-- NO hay lock optimista. El 2026-08-28 una segunda confirmación del
-- optimizador (estado ya limpiado en memoria, lock válido de la misma
-- sesión) mandó la lista de tubos VACÍA y borró los 537 tubos de la colmena
-- sin dejar un solo evento. Ver sql/20260831_recovery_colmena_wipe.sql.
--
-- EL GUARD CORRECTO PARA UN PLAN: acá no sirve el «sin lock» del guard
-- viejo, porque el borrado vino CON lock. Lo que sí sabemos de un plan
-- legítimo es que cada tubo que desaparece de la colmena tiene su evento
-- corte/merma/eliminado en el MISMO payload. Entonces: el achique que los
-- eventos no explican no puede pasar de GREATEST(10, 10 % del inventario).
-- Un plan grande de verdad (50 cortes con sus 50 eventos) pasa igual; una
-- lista vacía o un snapshot stale, no.
--
-- Solo se agrega el bloque «Guard de borrado masivo» entre los pasos 2 y 3;
-- el resto de la función es idéntico a sql/20260513b_rpc_guardar_plan_atomico.sql.
-- La firma no cambia: CREATE OR REPLACE sin DROP, sin ventana de 404.
--
-- REVERSA: volver a correr sql/20260513b_rpc_guardar_plan_atomico.sql.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guardar_plan_atomico(
    p_empresa_id        uuid,
    p_tubos             jsonb,
    p_expected_sync_at  timestamptz DEFAULT NULL,
    p_eventos           jsonb       DEFAULT '[]'::jsonb,
    p_plan_payload      jsonb       DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_empresa   uuid;
    v_current_sync_at  timestamptz;
    v_new_sync_at      timestamptz;
    v_plan_id          uuid;
    v_total_actual     integer;
    v_total_nuevo      integer;
    v_consumidos       integer;
    v_sin_explicar     integer;
BEGIN
    -- ─── 1) Validación auth + multi-tenancy ─────────────────────────────────
    SELECT empresa_id INTO v_caller_empresa FROM perfiles WHERE id = auth.uid();
    IF v_caller_empresa IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;
    IF p_empresa_id IS DISTINCT FROM v_caller_empresa THEN
        RAISE EXCEPTION 'No autorizado: caller=%, pedido=%', v_caller_empresa, p_empresa_id
            USING ERRCODE = '42501';
    END IF;

    -- ─── 2) Lock optimista ───────────────────────────────────────────────────
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

    -- ─── 2b) Guard de borrado masivo (2026-08-31, incidente colmena vacía) ──
    -- A diferencia del guard de sync_colmena_tubos, este corre SIEMPRE (el
    -- borrado del 28/8 vino con lock optimista válido). Un plan legítimo
    -- explica cada tubo que desaparece con su evento corte/merma/eliminado;
    -- el achique sin explicar se topa en GREATEST(10, 10% del inventario).
    SELECT COUNT(*) INTO v_total_actual
    FROM colmena_tubos
    WHERE empresa_id = p_empresa_id;

    v_total_nuevo := COALESCE(jsonb_array_length(p_tubos), 0);

    SELECT COUNT(DISTINCT e->>'tubo_raiz_id') INTO v_consumidos
    FROM jsonb_array_elements(COALESCE(p_eventos, '[]'::jsonb)) AS e
    WHERE e->>'evento' IN ('corte', 'merma', 'eliminado')
      AND COALESCE(e->>'tubo_raiz_id', '') <> '';

    v_sin_explicar := GREATEST(0, v_total_actual - v_total_nuevo - v_consumidos);

    IF v_sin_explicar > GREATEST(10, v_total_actual / 10) THEN
        RAISE EXCEPTION 'plan_borraria_masivo: el plan eliminaría % tubos (de % actuales) que los eventos no explican (% consumidos con evento, % enviados). Recargá la página completa (Ctrl+Shift+R), volvé a cargar la colmena y calculá de nuevo.',
            v_sin_explicar, v_total_actual, v_consumidos, v_total_nuevo
            USING ERRCODE = '40001';
    END IF;

    PERFORM set_config('app.sync_active', 'true', true);

    -- ─── 3) Sincronizar colmena_tubos: DELETE + INSERT con tombstone V2 ─────
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

    -- ─── 4) INSERTs de eventos en 3 pasos (trigger anti-huérfanos) ──────────
    IF p_eventos IS NOT NULL AND jsonb_array_length(p_eventos) > 0 THEN
        -- PASO A: ingresos
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

        -- PASO B: sobrantes y otros origenes
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

        -- PASO C: cortes/mermas/eliminados
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

    -- ─── 5) INSERT en planes_corte (si viene payload) ───────────────────────
    IF p_plan_payload IS NOT NULL THEN
        INSERT INTO planes_corte (
            empresa_id,
            optimizer_email,
            resultados,
            ordenes,
            fecha,
            fecha_correccion,
            tipo,
            snapshot_inventario,
            snapshot_seriales
        )
        VALUES (
            p_empresa_id,
            p_plan_payload->>'optimizer_email',
            COALESCE(p_plan_payload->'resultados', '[]'::jsonb),
            COALESCE(p_plan_payload->'ordenes', '[]'::jsonb),
            COALESCE((p_plan_payload->>'fecha')::timestamptz, NOW()),
            NULLIF(p_plan_payload->>'fecha_correccion', '')::timestamptz,
            NULLIF(p_plan_payload->>'tipo', ''),
            COALESCE(p_plan_payload->'snapshot_inventario', '[]'::jsonb),
            COALESCE(p_plan_payload->'snapshot_seriales', '[]'::jsonb)
        )
        RETURNING id INTO v_plan_id;
    END IF;

    -- ─── 6) Actualizar last_sync_at (post-todo exitoso) ─────────────────────
    UPDATE colmena_sync_state
    SET last_sync_at = NOW(),
        last_sync_by = COALESCE(auth.uid()::text, 'rpc')
    WHERE empresa_id = p_empresa_id
    RETURNING last_sync_at INTO v_new_sync_at;

    IF NOT FOUND THEN
        INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
        VALUES (p_empresa_id, NOW(), COALESCE(auth.uid()::text, 'rpc'))
        ON CONFLICT (empresa_id) DO UPDATE SET
            last_sync_at = NOW(),
            last_sync_by = COALESCE(auth.uid()::text, 'rpc')
        RETURNING last_sync_at INTO v_new_sync_at;
    END IF;

    -- ─── 7) Devolver plan_id + last_sync_at ─────────────────────────────────
    RETURN jsonb_build_object(
        'plan_id', v_plan_id,
        'last_sync_at', v_new_sync_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardar_plan_atomico(uuid, jsonb, timestamptz, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.guardar_plan_atomico(uuid, jsonb, timestamptz, jsonb, jsonb) IS
'Phase 2 anti-huérfanos: hace en una sola transacción el sync de colmena_tubos, '
'la inserción de eventos en tubos_historial (3 pasos para satisfacer el trigger '
'bloquear_corte_sin_origen) y el INSERT en planes_corte. Si cualquier paso falla, '
'rollback completo. Guard 2026-08-31: rechaza el achique de colmena que los '
'eventos corte/merma/eliminado del propio plan no expliquen '
'(umbral GREATEST(10, 10%)), con o sin lock optimista — incidente colmena vacía 28/8.';
