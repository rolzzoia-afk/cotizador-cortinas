-- ============================================================================
-- Movimientos insumos: columna `area` (quien pide el material)
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   En las pantallas de Salida rápida / Entrada rápida / Devolución desde OT
--   se agregó un selector "Área que pide el material" con 5 valores fijos:
--     estructura, dimensionado, oficina, telas, general
--   Esta migración crea la columna y el CHECK para que solo se acepten esos
--   valores (o NULL para movimientos históricos que no la tienen).
--
--   El campo "persona a cargo que recibe" se almacena en la columna existente
--   `recepcion` (ya estaba en uso en Inventario.tsx) — no requiere migración.
--
-- Reversibilidad:
--   ALTER TABLE movimientos_insumos DROP CONSTRAINT movimientos_insumos_area_check;
--   ALTER TABLE movimientos_insumos DROP COLUMN area;
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== movimientos_insumos.area — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Agregar columna (idempotente)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE movimientos_insumos
  ADD COLUMN IF NOT EXISTS area text;

DO $$ BEGIN RAISE NOTICE '  Columna area: OK (existe o creada)'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) CHECK constraint con las 5 áreas válidas (o NULL)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE movimientos_insumos
  DROP CONSTRAINT IF EXISTS movimientos_insumos_area_check;

ALTER TABLE movimientos_insumos
  ADD CONSTRAINT movimientos_insumos_area_check
  CHECK (
    area IS NULL OR area IN ('estructura','dimensionado','oficina','telas','general')
  );

DO $$ BEGIN RAISE NOTICE '  CHECK aplicado: estructura/dimensionado/oficina/telas/general (o NULL)'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Test post-aplicación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Test 1: rechazar valor inválido
  BEGIN
    INSERT INTO movimientos_insumos (empresa_id, codigo, tipo, cantidad, area)
    VALUES ('00000000-0000-0000-0000-000000000000', 'TEST_AREA', 'SALIDA PRODUCCION', 1, 'invalido');
    RAISE EXCEPTION 'Test 1 FALLÓ: area="invalido" fue aceptada';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '  Test 1 OK: area inválida rechazada por CHECK';
    WHEN foreign_key_violation THEN
      RAISE NOTICE '  Test 1 SKIP (FK empresa_id falló antes del CHECK)';
  END;
END $$;

DO $$ BEGIN RAISE NOTICE '=== movimientos_insumos.area — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Columna existe:
--    SELECT column_name, data_type
--    FROM information_schema.columns
--    WHERE table_name = 'movimientos_insumos' AND column_name = 'area';
--
-- 2) Constraint existe:
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conname = 'movimientos_insumos_area_check';
-- ============================================================================
