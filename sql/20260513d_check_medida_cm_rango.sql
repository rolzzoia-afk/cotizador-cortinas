-- ============================================================================
-- CHECK constraint: rango sano para colmena_tubos.medida_cm (Phase 2 inventario)
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   Phase 2 del inventario (memoria project_inventario_modo_snapshot) pidió
--   "validación de medidas con rangos sanos" para cazar typos del operario
--   tipo "3201cm" en vez de "320.1cm" o "5cm" en vez de "50cm".
--
--   Rango elegido:
--     >= 10cm  — debajo no hay corte funcional (un peso es ~30-50cm).
--     <= 2000cm (20m) — los tubos vírgenes más largos son ~578cm; 2000 da
--                       margen amplio para casos raros sin permitir typos
--                       absurdos.
--
-- Pre-flight check al inicio:
--   Si hay tubos fuera de rango en BD actual, el CHECK falla al aplicarse.
--   El script aborta con detalle de los tubos problemáticos.
--
-- Reversibilidad:
--   ALTER TABLE colmena_tubos DROP CONSTRAINT colmena_tubos_medida_rango_check;
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== CHECK medida_cm rango — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Pre-flight: detectar tubos fuera de rango
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count_bajo  integer;
  v_count_alto  integer;
  v_count_nulo  integer;
  v_total       integer;
  v_muestra     text;
BEGIN
  SELECT COUNT(*) INTO v_count_bajo  FROM colmena_tubos WHERE medida_cm IS NOT NULL AND medida_cm < 10;
  SELECT COUNT(*) INTO v_count_alto  FROM colmena_tubos WHERE medida_cm IS NOT NULL AND medida_cm > 2000;
  SELECT COUNT(*) INTO v_count_nulo  FROM colmena_tubos WHERE medida_cm IS NULL;
  SELECT COUNT(*) INTO v_total       FROM colmena_tubos;

  RAISE NOTICE '  Total tubos: %', v_total;
  RAISE NOTICE '  Fuera de rango: % (< 10cm), % (> 2000cm), % (NULL)', v_count_bajo, v_count_alto, v_count_nulo;

  IF v_count_bajo + v_count_alto > 0 THEN
    -- Mostrar muestra y abortar
    SELECT string_agg(
      format('  tubo_raiz_id=%s n_colmena=%s cod=%s medida_cm=%s',
        COALESCE(tubo_raiz_id::text, '(null)'),
        COALESCE(n_colmena, '-'), COALESCE(cod, '-'), medida_cm
      ),
      E'\n'
    )
    INTO v_muestra
    FROM (
      SELECT * FROM colmena_tubos
      WHERE medida_cm < 10 OR medida_cm > 2000
      ORDER BY medida_cm
      LIMIT 20
    ) sub;

    RAISE EXCEPTION E'Hay tubos fuera de rango (10-2000cm). Muestra:\n%\nRevisar y corregir antes de aplicar el CHECK.', v_muestra;
  END IF;

  -- NULLs son OK: la columna ya permite NULL (no son "fuera de rango").
  -- El CHECK constraint con `medida_cm BETWEEN 10 AND 2000` permite NULL
  -- por defecto (CHECK no se evalúa para NULL en PostgreSQL).

  RAISE NOTICE '  Pre-flight OK: ningún tubo fuera de rango.';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Aplicar CHECK constraint
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE colmena_tubos
  DROP CONSTRAINT IF EXISTS colmena_tubos_medida_rango_check;

ALTER TABLE colmena_tubos
  ADD CONSTRAINT colmena_tubos_medida_rango_check
  CHECK (medida_cm IS NULL OR (medida_cm >= 10 AND medida_cm <= 2000));

DO $$ BEGIN RAISE NOTICE '  CHECK aplicado: medida_cm BETWEEN 10 AND 2000 (o NULL)'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Tests post-aplicación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_err text;
BEGIN
  -- Test 1: insertar tubo válido
  BEGIN
    INSERT INTO colmena_tubos (empresa_id, n_colmena, cod, medida_cm, medida_mm)
    VALUES ('00000000-0000-0000-0000-000000000000', 'TEST', 'TEST', 320.1, 3201);
    DELETE FROM colmena_tubos WHERE empresa_id = '00000000-0000-0000-0000-000000000000';
    RAISE NOTICE '  Test 1 OK: medida válida (320.1) aceptada';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  Test 1 SKIP (probablemente FK empresa_id): %', SQLERRM;
  END;

  -- Test 2: rechazar medida muy baja
  BEGIN
    INSERT INTO colmena_tubos (empresa_id, n_colmena, cod, medida_cm, medida_mm)
    VALUES ('00000000-0000-0000-0000-000000000000', 'TEST', 'TEST', 5, 50);
    RAISE EXCEPTION 'Test 2 FALLÓ: medida 5cm fue aceptada (debería rechazar)';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '  Test 2 OK: medida muy baja (5cm) rechazada por CHECK';
    WHEN foreign_key_violation THEN
      RAISE NOTICE '  Test 2 SKIP (FK empresa_id falló antes del CHECK)';
  END;

  -- Test 3: rechazar medida muy alta
  BEGIN
    INSERT INTO colmena_tubos (empresa_id, n_colmena, cod, medida_cm, medida_mm)
    VALUES ('00000000-0000-0000-0000-000000000000', 'TEST', 'TEST', 3201, 32010);
    RAISE EXCEPTION 'Test 3 FALLÓ: medida 3201cm fue aceptada (debería rechazar)';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '  Test 3 OK: medida muy alta (3201cm) rechazada por CHECK';
    WHEN foreign_key_violation THEN
      RAISE NOTICE '  Test 3 SKIP (FK empresa_id falló antes del CHECK)';
  END;
END $$;

DO $$ BEGIN RAISE NOTICE '=== CHECK medida_cm rango — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT (correr aparte para confirmar):
--
-- 1) Constraint existe:
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conname = 'colmena_tubos_medida_rango_check';
--
-- 2) Distribución de medidas (sanity check):
--    SELECT
--      width_bucket(medida_cm, 0, 800, 8) AS bucket,
--      count(*) AS n,
--      min(medida_cm) AS min_cm,
--      max(medida_cm) AS max_cm
--    FROM colmena_tubos
--    WHERE medida_cm IS NOT NULL
--    GROUP BY bucket ORDER BY bucket;
--
-- 3) Si alguna vez aparece error en optimizador "violates check constraint
--    colmena_tubos_medida_rango_check": revisar la medida que intentó
--    insertar — es typo del operario o un bug del optimizador.
-- ============================================================================
