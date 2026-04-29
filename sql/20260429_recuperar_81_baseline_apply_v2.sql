-- ============================================================================
-- APPLY v2: recuperar los 81 tubos del baseline 3673315c borrados por sync stale.
--
-- Reescrito como bloque DO atómico para garantizar commit automático al final.
-- (El v1 con BEGIN/COMMIT manual se rolleó cuando el SQL Editor cerró la sesión
-- sin COMMIT explícito.)
--
-- Es IDEMPOTENTE: si ya fueron recuperados (eventos 'ingreso' con
-- registrado_por='sistema_recovery' del 2026-04-29), no duplica.
-- ============================================================================

DO $$
DECLARE
    v_a_recuperar       integer;
    v_ya_recuperados    integer;
    v_insertados_colmena integer;
    v_insertados_hist   integer;
    v_final_check       integer;
BEGIN
    -- Idempotencia: ¿ya hay un recovery de hoy?
    SELECT COUNT(*) INTO v_ya_recuperados
    FROM tubos_historial
    WHERE registrado_por = 'sistema_recovery'
      AND created_at >= '2026-04-29 00:00:00+00'
      AND notas LIKE '%3673315c%';

    IF v_ya_recuperados > 0 THEN
        RAISE NOTICE 'Recovery ya ejecutado previamente: % eventos sistema_recovery encontrados. Abortando para evitar duplicados.', v_ya_recuperados;
        RETURN;
    END IF;

    -- Suprimir trigger interno mientras hacemos el batch
    PERFORM set_config('app.sync_active', 'true', true);

    -- Set a recuperar (computado en una temp para no recomputarlo)
    DROP TABLE IF EXISTS _recuperar_81;
    CREATE TEMP TABLE _recuperar_81 ON COMMIT DROP AS
    WITH baseline_ingreso AS (
        SELECT empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, created_at AS baseline_at
        FROM tubos_historial
        WHERE evento = 'ingreso'
          AND notas LIKE '%3673315c-0c40-4f16-94ed-3aff26a710f2%'
    ),
    con_evento_posterior AS (
        SELECT DISTINCT bi.tubo_raiz_id
        FROM baseline_ingreso bi
        JOIN tubos_historial th
          ON th.tubo_raiz_id = bi.tubo_raiz_id
         AND th.empresa_id   = bi.empresa_id
         AND th.created_at   > bi.baseline_at
         AND th.evento IN ('corte', 'eliminado', 'merma', 'ingreso')
    )
    SELECT
        bi.empresa_id,
        bi.tubo_raiz_id,
        bi.n_colmena,
        bi.cod,
        bi.medida_cm
    FROM baseline_ingreso bi
    LEFT JOIN colmena_tubos ct
           ON ct.tubo_raiz_id = bi.tubo_raiz_id
          AND ct.empresa_id::text = bi.empresa_id
    LEFT JOIN con_evento_posterior cep
           ON cep.tubo_raiz_id = bi.tubo_raiz_id
    WHERE ct.id IS NULL
      AND cep.tubo_raiz_id IS NULL;

    SELECT COUNT(*) INTO v_a_recuperar FROM _recuperar_81;
    RAISE NOTICE 'Tubos a recuperar: %', v_a_recuperar;

    IF v_a_recuperar = 0 THEN
        RAISE NOTICE 'Nada para recuperar. Abortando.';
        RETURN;
    END IF;

    -- 1) Reinsertar a colmena_tubos preservando tubo_raiz_id
    INSERT INTO colmena_tubos (
        empresa_id, n_colmena, cod, medida_cm, medida_mm,
        tubo_raiz_id, agregado_por_admin
    )
    SELECT
        r.empresa_id::uuid,
        r.n_colmena,
        r.cod,
        r.medida_cm,
        (r.medida_cm * 10)::integer,
        r.tubo_raiz_id,
        false
    FROM _recuperar_81 r;
    GET DIAGNOSTICS v_insertados_colmena = ROW_COUNT;
    RAISE NOTICE 'Insertados a colmena_tubos: %', v_insertados_colmena;

    -- 2) Auditoría: evento 'ingreso' de recuperación
    INSERT INTO tubos_historial (
        empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, medida_resultado_cm,
        evento, notas, registrado_por
    )
    SELECT
        r.empresa_id,
        r.tubo_raiz_id,
        r.n_colmena,
        r.cod,
        r.medida_cm,
        r.medida_cm,
        'ingreso',
        'Recuperación 2026-04-29: tubo del baseline 3673315c borrado silenciosamente por sync stale del optimizador (incidente postventa@cortinasrolzzo.cl 29/4 15:28 UTC). Reinsertado tras validación.',
        'sistema_recovery'
    FROM _recuperar_81 r;
    GET DIAGNOSTICS v_insertados_hist = ROW_COUNT;
    RAISE NOTICE 'Insertados a tubos_historial: %', v_insertados_hist;

    -- 3) Verificación final dentro de la misma transacción
    SELECT COUNT(*) INTO v_final_check
    FROM colmena_tubos ct
    JOIN _recuperar_81 r ON r.tubo_raiz_id = ct.tubo_raiz_id;

    RAISE NOTICE 'Verificación: % tubos del set ahora en colmena_tubos', v_final_check;

    -- Si los conteos no cuadran, abortar (rollback automático del DO block)
    IF v_final_check <> v_a_recuperar THEN
        RAISE EXCEPTION 'Conteos NO cuadran: esperados=%, encontrados=%. Rollback automático.',
            v_a_recuperar, v_final_check;
    END IF;

    IF v_insertados_colmena <> v_a_recuperar OR v_insertados_hist <> v_a_recuperar THEN
        RAISE EXCEPTION 'Conteos de INSERT NO cuadran: a_recuperar=%, colmena=%, hist=%. Rollback automático.',
            v_a_recuperar, v_insertados_colmena, v_insertados_hist;
    END IF;

    RAISE NOTICE '✓ Recovery exitoso: % tubos recuperados.', v_a_recuperar;
END $$;
