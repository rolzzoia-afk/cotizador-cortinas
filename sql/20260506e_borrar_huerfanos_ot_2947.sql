-- ============================================================================
-- Limpieza: borrar 2 planes huérfanos de OT 2947 (no cortados)
-- Fecha: 2026-05-06
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Postventa intentó guardar OT 2947 a las 14:27. Mismo patrón que el
--   incidente OT 2935 de unas horas antes: 2 saves separados por ~5
--   segundos, ambos huérfanos. La causa es que el browser de postventa
--   sigue usando la versión vieja del optimizador (sin Capa 1.5).
--
-- Confirmación del taller (2026-05-06):
--   - OT 2947: NO cortada (taller aún no la procesó).
--
-- Acción:
--   - Borrar los 2 planes huérfanos (sin recovery; no hay nada físico que
--     reflejar en BD).
--   - El usuario debe ejecutar "Forzar actualización en taller" en /admin
--     para que postventa reciba el HTML parcheado antes de regenerar.
-- ============================================================================

BEGIN;

DO $$
DECLARE v_borrados integer;
BEGIN
  DELETE FROM planes_corte
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND id IN (
      'f861cfe7-8284-4615-afaa-c112d32b7c1a'::uuid,  -- OT 2947 (14:27:15)
      '4e20c86a-af11-4b09-a1ec-1d65f7e4b2ba'::uuid   -- OT 2947 (14:27:20)
    );
  GET DIAGNOSTICS v_borrados = ROW_COUNT;
  IF v_borrados <> 2 THEN
    RAISE EXCEPTION 'Esperaba borrar 2 planes huérfanos, borré % — ABORTAR', v_borrados;
  END IF;
  RAISE NOTICE 'Borrados % planes huérfanos doble OT 2947 (no cortados)', v_borrados;
END $$;

DO $$
DECLARE v_huerfanos integer;
BEGIN
  SELECT COUNT(*) INTO v_huerfanos
    FROM detectar_planes_huerfanos('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 7);
  RAISE NOTICE 'Planes huérfanos restantes en ventana de 7 días: %', v_huerfanos;
END $$;

COMMIT;
