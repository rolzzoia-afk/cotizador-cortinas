-- ============================================================================
-- Limpieza: borrar 2 planes huérfanos de OT 2934 (no cortados)
-- Fecha: 2026-05-06
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Postventa generó OT 2934 a las 17:11 UTC (13:11 local) del 2026-05-06.
--   Mismo patrón: 2 planes guardados (snapshot + activo), ambos huérfanos.
--   El taller confirmó que la OT NO se cortó.
--
--   Causa probable: el browser de postventa tiene una versión cacheada
--   del HTML del optimizador anterior a PR #28 (2026-04-28), cuando se
--   introdujo el 4to argumento p_eventos en sync_colmena_tubos. Sin ese
--   argumento, la RPC sincroniza colmena pero NO inserta events en
--   tubos_historial. El plan se inserta como huérfano.
-- ============================================================================

BEGIN;

DO $$
DECLARE v_borrados integer;
BEGIN
  DELETE FROM planes_corte
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND id IN (
      '165faf06-d9bc-49db-aecc-dd8e66e674df'::uuid,  -- OT 2934 plan activo (17:12)
      '24ba044d-7001-44ce-9f0d-ad03de59d060'::uuid   -- OT 2934 snapshot   (17:11)
    );
  GET DIAGNOSTICS v_borrados = ROW_COUNT;
  IF v_borrados <> 2 THEN
    RAISE EXCEPTION 'Esperaba borrar 2 planes huérfanos, borré % — ABORTAR', v_borrados;
  END IF;
  RAISE NOTICE 'Borrados % planes huérfanos OT 2934 (no cortados)', v_borrados;
END $$;

DO $$
DECLARE v_huerfanos integer;
BEGIN
  SELECT COUNT(*) INTO v_huerfanos
    FROM detectar_planes_huerfanos('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 7);
  RAISE NOTICE 'Planes huérfanos restantes en ventana 7 días: %', v_huerfanos;
END $$;

COMMIT;
