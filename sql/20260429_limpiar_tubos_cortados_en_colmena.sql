-- ============================================================================
-- Limpieza residual del incidente sync stale 2026-04-29:
-- Eliminar de colmena_tubos los tubos cuyo último evento histórico es
-- 'corte', 'eliminado' o 'merma' (es decir, tubos que físicamente NO están
-- pero el sync stale reinsertó por error a colmena_tubos junto con el INSERT
-- atómico de eventos del PR #21).
--
-- Confirmado por postventa: todos esos tubos ya fueron cortados, no quedan
-- piezas físicas (las piezas son las cortinas armadas; los sobrantes ya
-- fueron reintegrados aparte).
--
-- NO genera evento 'eliminado': ya tienen su evento de cierre real (el corte).
-- Generar otro sería ruido de auditoría.
--
-- Bloque DO atómico, idempotente, con verificación post-DELETE.
-- ============================================================================

DO $$
DECLARE
    v_empresa_id   uuid := '67c635a5-152c-4780-a066-23f5081175a9';
    v_a_eliminar   integer;
    v_eliminados   integer;
    v_residual     integer;
BEGIN
    PERFORM set_config('app.sync_active', 'true', true);

    -- Set a eliminar
    DROP TABLE IF EXISTS _tubos_consumidos_en_colmena;
    CREATE TEMP TABLE _tubos_consumidos_en_colmena ON COMMIT DROP AS
    WITH ultimo AS (
        SELECT DISTINCT ON (tubo_raiz_id)
            tubo_raiz_id, evento, created_at
        FROM tubos_historial
        WHERE empresa_id = v_empresa_id::text
          AND tubo_raiz_id IS NOT NULL
        ORDER BY tubo_raiz_id, created_at DESC
    )
    SELECT ct.id, ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm, u.evento
    FROM colmena_tubos ct
    JOIN ultimo u ON u.tubo_raiz_id = ct.tubo_raiz_id
    WHERE ct.empresa_id = v_empresa_id
      AND u.evento IN ('corte', 'eliminado', 'merma');

    SELECT COUNT(*) INTO v_a_eliminar FROM _tubos_consumidos_en_colmena;
    RAISE NOTICE 'Tubos a eliminar (consumidos pero presentes en colmena): %', v_a_eliminar;

    IF v_a_eliminar = 0 THEN
        RAISE NOTICE 'Nada para limpiar.';
        RETURN;
    END IF;

    -- Sanity: no eliminar más de 30 (el dashboard contaba ~12, margen amplio)
    IF v_a_eliminar > 30 THEN
        RAISE EXCEPTION 'Eliminaría % tubos, fuera del rango esperado (1-30). Abortando para revisión manual.', v_a_eliminar;
    END IF;

    -- Eliminar
    DELETE FROM colmena_tubos ct
    USING _tubos_consumidos_en_colmena t
    WHERE ct.id = t.id;
    GET DIAGNOSTICS v_eliminados = ROW_COUNT;
    RAISE NOTICE 'Eliminados de colmena_tubos: %', v_eliminados;

    IF v_eliminados <> v_a_eliminar THEN
        RAISE EXCEPTION 'Mismatch: a_eliminar=%, eliminados=%. Rollback.', v_a_eliminar, v_eliminados;
    END IF;

    -- Verificación final: no debe quedar ningún tubo en colmena con último evento consumido
    WITH ultimo AS (
        SELECT DISTINCT ON (tubo_raiz_id) tubo_raiz_id, evento
        FROM tubos_historial
        WHERE empresa_id = v_empresa_id::text
          AND tubo_raiz_id IS NOT NULL
        ORDER BY tubo_raiz_id, created_at DESC
    )
    SELECT COUNT(*) INTO v_residual
    FROM colmena_tubos ct
    JOIN ultimo u ON u.tubo_raiz_id = ct.tubo_raiz_id
    WHERE ct.empresa_id = v_empresa_id
      AND u.evento IN ('corte', 'eliminado', 'merma');

    RAISE NOTICE 'Residuales tras limpieza: %', v_residual;

    IF v_residual > 0 THEN
        RAISE EXCEPTION 'Quedan % tubos consumidos en colmena tras limpieza. Rollback.', v_residual;
    END IF;

    RAISE NOTICE '✓ Limpieza exitosa: % tubos eliminados.', v_eliminados;
END $$;
