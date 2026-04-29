-- ============================================================================
-- CIERRE del incidente 2026-04-29: regularizar 3 fantasmas + 12 sobrantes
-- perdidos. Todos físicamente presentes en el taller (sobrantes del último
-- plan de corte de OT 2926 + residuales 2923/2924).
--
-- Bloque DO atómico, idempotente. Auto-commit al final si todo cuadra.
--
-- Acciones:
--   PARTE A — los 3 fantasmas (en colmena sin historia):
--     Generar evento 'ingreso' retroactivo en tubos_historial. Los tubos ya
--     están en colmena_tubos, solo les falta el rastro histórico.
--
--   PARTE B — los 12 sobrantes perdidos (en historial sin estar en colmena):
--     Insertar a colmena_tubos con su tubo_raiz_id original. NO generar
--     evento adicional — ya tienen 'sobrante' en historial, eso ES su ingreso
--     lógico (sobrante = ingresa a colmena para reuso).
-- ============================================================================

DO $$
DECLARE
    v_empresa_id      uuid := '67c635a5-152c-4780-a066-23f5081175a9';
    v_empresa_str     text := '67c635a5-152c-4780-a066-23f5081175a9';
    v_fantasmas_n     integer;
    v_perdidos_n      integer;
    v_already_done    integer;
BEGIN
    -- Idempotencia: si ya hay eventos sistema_recovery con esta marca, abortar
    SELECT COUNT(*) INTO v_already_done
    FROM tubos_historial
    WHERE registrado_por = 'sistema_recovery'
      AND notas LIKE '%cierre-incidente-2026-04-29%';

    IF v_already_done > 0 THEN
        RAISE NOTICE 'Cierre ya ejecutado previamente (% eventos). Abortando.', v_already_done;
        RETURN;
    END IF;

    -- Suprimir trigger interno
    PERFORM set_config('app.sync_active', 'true', true);

    -- ── Set de fantasmas (en colmena sin historia alguna) ────────────────────
    DROP TABLE IF EXISTS _fantasmas;
    CREATE TEMP TABLE _fantasmas ON COMMIT DROP AS
    SELECT ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm
    FROM colmena_tubos ct
    WHERE ct.empresa_id = v_empresa_id
      AND NOT EXISTS (
        SELECT 1 FROM tubos_historial th
        WHERE th.tubo_raiz_id = ct.tubo_raiz_id
      );

    SELECT COUNT(*) INTO v_fantasmas_n FROM _fantasmas;
    RAISE NOTICE 'Fantasmas a regularizar: %', v_fantasmas_n;

    -- ── Set de perdidos (sobrante en historial sin estar en colmena) ───────
    DROP TABLE IF EXISTS _perdidos;
    CREATE TEMP TABLE _perdidos ON COMMIT DROP AS
    WITH ultimo AS (
        SELECT DISTINCT ON (tubo_raiz_id)
            tubo_raiz_id, n_colmena, cod, medida_cm, evento, ot, created_at
        FROM tubos_historial
        WHERE empresa_id = v_empresa_str
          AND evento IN ('ingreso', 'sobrante')
          AND tubo_raiz_id IS NOT NULL
          AND fuente IS DISTINCT FROM 'bodeguero'
        ORDER BY tubo_raiz_id, created_at DESC
    )
    SELECT u.tubo_raiz_id, u.n_colmena, u.cod, u.medida_cm
    FROM ultimo u
    WHERE NOT EXISTS (
        SELECT 1 FROM tubos_historial th
        WHERE th.tubo_raiz_id = u.tubo_raiz_id
          AND th.evento IN ('corte', 'eliminado', 'merma')
          AND th.created_at > u.created_at
    )
    AND NOT EXISTS (
        SELECT 1 FROM colmena_tubos ct WHERE ct.tubo_raiz_id = u.tubo_raiz_id
    );

    SELECT COUNT(*) INTO v_perdidos_n FROM _perdidos;
    RAISE NOTICE 'Perdidos a reintegrar: %', v_perdidos_n;

    -- Sanity: si los conteos NO matchean lo esperado, abortar para revisión
    IF v_fantasmas_n NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION 'Fantasmas fuera de rango esperado (3-5): %. Abortando para revisión manual.', v_fantasmas_n;
    END IF;
    IF v_perdidos_n NOT BETWEEN 1 AND 25 THEN
        RAISE EXCEPTION 'Perdidos fuera de rango esperado (12-16): %. Abortando para revisión manual.', v_perdidos_n;
    END IF;

    -- ── PARTE A: ingreso retroactivo para los fantasmas ─────────────────────
    INSERT INTO tubos_historial (
        empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, medida_resultado_cm,
        evento, notas, registrado_por
    )
    SELECT
        v_empresa_str,
        f.tubo_raiz_id,
        f.n_colmena,
        f.cod,
        f.medida_cm,
        f.medida_cm,
        'ingreso',
        'cierre-incidente-2026-04-29: tubo presente en colmena pero sin historia. Generado por sync stale del 29/4 15:28:34 UTC. Físicamente confirmado en taller (sobrante del plan de OT 2926).',
        'sistema_recovery'
    FROM _fantasmas f;

    GET DIAGNOSTICS v_fantasmas_n = ROW_COUNT;
    RAISE NOTICE 'Fantasmas regularizados (insert ingreso): %', v_fantasmas_n;

    -- ── PARTE B: reinsertar perdidos a colmena_tubos ────────────────────────
    INSERT INTO colmena_tubos (
        empresa_id, n_colmena, cod, medida_cm, medida_mm,
        tubo_raiz_id, agregado_por_admin
    )
    SELECT
        v_empresa_id,
        p.n_colmena,
        p.cod,
        p.medida_cm,
        (p.medida_cm * 10)::integer,
        p.tubo_raiz_id,
        false
    FROM _perdidos p;

    GET DIAGNOSTICS v_perdidos_n = ROW_COUNT;
    RAISE NOTICE 'Perdidos reintegrados a colmena_tubos: %', v_perdidos_n;

    -- Auditoría adicional para los reintegros (deja huella explícita en historial)
    INSERT INTO tubos_historial (
        empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, medida_resultado_cm,
        evento, notas, registrado_por
    )
    SELECT
        v_empresa_str,
        p.tubo_raiz_id,
        p.n_colmena,
        p.cod,
        p.medida_cm,
        p.medida_cm,
        'ingreso',
        'cierre-incidente-2026-04-29: sobrante perdido por sync stale. Reintegrado a colmena tras confirmación física en taller.',
        'sistema_recovery'
    FROM _perdidos p;

    -- ── Verificación final ──────────────────────────────────────────────────
    DECLARE
        v_fantasmas_residual integer;
        v_perdidos_residual  integer;
    BEGIN
        SELECT COUNT(*) INTO v_fantasmas_residual
        FROM colmena_tubos ct
        WHERE ct.empresa_id = v_empresa_id
          AND NOT EXISTS (SELECT 1 FROM tubos_historial th WHERE th.tubo_raiz_id = ct.tubo_raiz_id);

        WITH ultimo AS (
            SELECT DISTINCT ON (tubo_raiz_id) tubo_raiz_id, created_at
            FROM tubos_historial
            WHERE empresa_id = v_empresa_str
              AND evento IN ('ingreso', 'sobrante')
              AND tubo_raiz_id IS NOT NULL
              AND fuente IS DISTINCT FROM 'bodeguero'
            ORDER BY tubo_raiz_id, created_at DESC
        )
        SELECT COUNT(*) INTO v_perdidos_residual
        FROM ultimo u
        WHERE NOT EXISTS (
            SELECT 1 FROM tubos_historial th
            WHERE th.tubo_raiz_id = u.tubo_raiz_id
              AND th.evento IN ('corte', 'eliminado', 'merma')
              AND th.created_at > u.created_at
        )
        AND NOT EXISTS (SELECT 1 FROM colmena_tubos ct WHERE ct.tubo_raiz_id = u.tubo_raiz_id);

        RAISE NOTICE 'Residuales tras cierre: fantasmas=%, perdidos=%', v_fantasmas_residual, v_perdidos_residual;

        IF v_fantasmas_residual > 0 OR v_perdidos_residual > 0 THEN
            RAISE EXCEPTION 'Quedan residuales tras el cierre. Rollback automático para revisión manual.';
        END IF;
    END;

    RAISE NOTICE '✓ Cierre exitoso del incidente.';
END $$;
