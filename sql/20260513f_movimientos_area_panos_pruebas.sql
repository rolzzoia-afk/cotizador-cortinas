-- ============================================================================
-- movimientos_insumos.area: agregar 'pruebas' + renombrar 'telas' → 'panos'
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   Sigue a sql/20260513e_movimientos_insumos_area.sql. El usuario pidió:
--     1) Agregar área "Pruebas" (slug: pruebas)
--     2) Renombrar "Telas" → "Paños" (slug: telas → panos)
--
--   Slugs sin tilde / sin ñ por consistencia con los existentes
--   (estructura, dimensionado, oficina, general).
--
-- Estrategia:
--   1) UPDATE existing rows con area='telas' → 'panos' (probablemente 0
--      filas porque la columna se desplegó hoy, pero por las dudas).
--   2) DROP + ADD constraint con la lista nueva.
--
-- Reversibilidad:
--   UPDATE movimientos_insumos SET area = 'telas' WHERE area = 'panos';
--   ALTER TABLE movimientos_insumos DROP CONSTRAINT movimientos_insumos_area_check;
--   ALTER TABLE movimientos_insumos ADD CONSTRAINT movimientos_insumos_area_check
--     CHECK (area IS NULL OR area IN ('estructura','dimensionado','oficina','telas','general'));
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== movimientos_insumos.area panos/pruebas — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Renombrar filas existentes telas → panos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE movimientos_insumos SET area = 'panos' WHERE area = 'telas';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '  Filas actualizadas telas → panos: %', v_updated;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Reemplazar CHECK con la lista nueva (6 áreas)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE movimientos_insumos
  DROP CONSTRAINT IF EXISTS movimientos_insumos_area_check;

ALTER TABLE movimientos_insumos
  ADD CONSTRAINT movimientos_insumos_area_check
  CHECK (
    area IS NULL OR area IN ('estructura','dimensionado','oficina','panos','pruebas','general')
  );

DO $$ BEGIN RAISE NOTICE '  CHECK aplicado: estructura/dimensionado/oficina/panos/pruebas/general (o NULL)'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Test post-aplicación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Test 1: rechazar el slug viejo 'telas'
  BEGIN
    INSERT INTO movimientos_insumos (empresa_id, codigo, tipo, cantidad, area)
    VALUES ('00000000-0000-0000-0000-000000000000', 'TEST_AREA', 'SALIDA PRODUCCION', 1, 'telas');
    RAISE EXCEPTION 'Test 1 FALLÓ: area="telas" fue aceptada (debería rechazar tras rename)';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '  Test 1 OK: area "telas" ahora rechazada';
    WHEN foreign_key_violation THEN
      RAISE NOTICE '  Test 1 SKIP (FK empresa_id falló antes del CHECK)';
  END;

  -- Test 2: aceptar 'panos' y 'pruebas'
  BEGIN
    INSERT INTO movimientos_insumos (empresa_id, codigo, tipo, cantidad, area)
    VALUES ('00000000-0000-0000-0000-000000000000', 'TEST_AREA', 'SALIDA PRODUCCION', 1, 'pruebas');
    RAISE NOTICE '  Test 2 INESPERADO: insert aceptado (FK empresa_id placeholder no falló)';
  EXCEPTION
    WHEN check_violation THEN
      RAISE EXCEPTION 'Test 2 FALLÓ: area="pruebas" debería ser válida';
    WHEN foreign_key_violation THEN
      RAISE NOTICE '  Test 2 OK: "pruebas" pasa el CHECK (FK falla después, esperado)';
  END;
END $$;

DO $$ BEGIN RAISE NOTICE '=== movimientos_insumos.area panos/pruebas — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke test post-COMMIT:
--   SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname = 'movimientos_insumos_area_check';
--
--   Debe devolver:
--   CHECK ((area IS NULL OR (area = ANY (ARRAY['estructura'::text,
--          'dimensionado'::text, 'oficina'::text, 'panos'::text,
--          'pruebas'::text, 'general'::text]))))
-- ============================================================================
