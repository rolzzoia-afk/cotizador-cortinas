-- ============================================================================
-- colmena_tubos.tubo_raiz_id: NOT NULL (cerrar bug raíz fantasmas legacy)
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   Incidente OT 2954 (2026-05-13 11:10): el optimizador eligió un tubo en
--   `colmena_tubos` que tenía `tubo_raiz_id=NULL` (fantasma legacy sin
--   trazabilidad). La consolidación de pesos generó un UUID fresco y eventos
--   "preservando trazabilidad" — escondiendo el origen. El plan se guardó
--   referenciando ese tubo. El operario fue a cortar y el tubo no existía.
--
--   El optimizer asume que todo tubo en `colmena_tubos` tiene `tubo_raiz_id`.
--   La columna fue agregada históricamente y nunca se forzó NOT NULL, lo que
--   dejó la puerta abierta a inserts legacy sin uuid (fantasmas silenciosos).
--
-- Pre-flight:
--   Si hay tubos con `tubo_raiz_id IS NULL`, abortar con detalle (la última
--   purga vino con sin_uuid=0, pero validamos de nuevo por seguridad).
--
-- Reversibilidad:
--   ALTER TABLE colmena_tubos ALTER COLUMN tubo_raiz_id DROP NOT NULL;
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== colmena_tubos.tubo_raiz_id NOT NULL — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Pre-flight: detectar tubos sin uuid
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count_nulo integer;
  v_muestra    text;
BEGIN
  SELECT COUNT(*) INTO v_count_nulo
  FROM colmena_tubos
  WHERE tubo_raiz_id IS NULL;

  RAISE NOTICE '  Tubos sin tubo_raiz_id: %', v_count_nulo;

  IF v_count_nulo > 0 THEN
    SELECT string_agg(
      format('  empresa=%s n_colmena=%s cod=%s medida_cm=%s id=%s',
        empresa_id, COALESCE(n_colmena, '-'), COALESCE(cod, '-'), medida_cm, id
      ),
      E'\n'
    )
    INTO v_muestra
    FROM (
      SELECT * FROM colmena_tubos WHERE tubo_raiz_id IS NULL
      ORDER BY created_at LIMIT 20
    ) sub;

    RAISE EXCEPTION E'Hay tubos sin tubo_raiz_id. Asignar UUIDs antes de aplicar el constraint.\nMuestra:\n%', v_muestra;
  END IF;

  RAISE NOTICE '  Pre-flight OK';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Aplicar NOT NULL
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE colmena_tubos ALTER COLUMN tubo_raiz_id SET NOT NULL;

DO $$ BEGIN RAISE NOTICE '  NOT NULL aplicado en colmena_tubos.tubo_raiz_id'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Test: insertar con NULL debe fallar
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO colmena_tubos (empresa_id, n_colmena, cod, medida_cm, medida_mm, tubo_raiz_id)
    VALUES ('00000000-0000-0000-0000-000000000000', 'TEST', 'TEST', 100, 1000, NULL);
    RAISE EXCEPTION 'Test FALLÓ: insert con tubo_raiz_id=NULL fue aceptado';
  EXCEPTION
    WHEN not_null_violation THEN
      RAISE NOTICE '  Test OK: tubo_raiz_id NULL rechazado';
    WHEN foreign_key_violation THEN
      RAISE NOTICE '  Test SKIP (FK empresa_id falló antes del NOT NULL)';
  END;
END $$;

DO $$ BEGIN RAISE NOTICE '=== colmena_tubos.tubo_raiz_id NOT NULL — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke test post-COMMIT:
--   SELECT is_nullable FROM information_schema.columns
--   WHERE table_name = 'colmena_tubos' AND column_name = 'tubo_raiz_id';
--   → 'NO'
-- ============================================================================
