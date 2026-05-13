-- ============================================================================
-- movimientos_insumos.area: agregar 'armado'
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   Sigue a sql/20260513f_movimientos_area_panos_pruebas.sql.
--   El usuario pidió agregar una séptima área: "Armado" (slug: armado).
--
--   Posición en la UI: entre Dimensionado y Oficina (flujo de producción).
--
-- Reversibilidad:
--   ALTER TABLE movimientos_insumos DROP CONSTRAINT movimientos_insumos_area_check;
--   ALTER TABLE movimientos_insumos ADD CONSTRAINT movimientos_insumos_area_check
--     CHECK (area IS NULL OR area IN ('estructura','dimensionado','oficina','panos','pruebas','general'));
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== movimientos_insumos.area armado — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reemplazar CHECK con la lista nueva (7 áreas)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE movimientos_insumos
  DROP CONSTRAINT IF EXISTS movimientos_insumos_area_check;

ALTER TABLE movimientos_insumos
  ADD CONSTRAINT movimientos_insumos_area_check
  CHECK (
    area IS NULL OR area IN ('estructura','dimensionado','armado','oficina','panos','pruebas','general')
  );

DO $$ BEGIN RAISE NOTICE '  CHECK aplicado: estructura/dimensionado/armado/oficina/panos/pruebas/general (o NULL)'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Test post-aplicación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO movimientos_insumos (empresa_id, codigo, tipo, cantidad, area)
    VALUES ('00000000-0000-0000-0000-000000000000', 'TEST_AREA', 'SALIDA PRODUCCION', 1, 'armado');
    RAISE NOTICE '  Test INESPERADO: insert aceptado (FK empresa_id placeholder no falló)';
  EXCEPTION
    WHEN check_violation THEN
      RAISE EXCEPTION 'Test FALLÓ: area="armado" debería ser válida';
    WHEN foreign_key_violation THEN
      RAISE NOTICE '  Test OK: "armado" pasa el CHECK (FK falla después, esperado)';
  END;
END $$;

DO $$ BEGIN RAISE NOTICE '=== movimientos_insumos.area armado — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke test post-COMMIT:
--   SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname = 'movimientos_insumos_area_check';
-- ============================================================================
