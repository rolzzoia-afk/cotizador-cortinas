-- ============================================================================
-- Bump opt_version_minima a 5.10 — guard anti-fantasma legacy
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   v5.10 agrega guard en `cargarColmenasDesdeTabla` que aborta si algún
--   tubo viene con `tubo_raiz_id=NULL`. Complementa el NOT NULL constraint
--   aplicado por sql/20260513j_colmena_tubos_uuid_not_null.sql.
--
--   Cierra el bug del incidente OT 2954 (2026-05-13): el optimizer eligió
--   un tubo fantasma sin uuid, la consolidación de pesos generó uuid fresco
--   "preservando trazabilidad" y el operario fue a cortar un tubo que no
--   existía físicamente.
--
-- Pre-requisito:
--   Correr ANTES: sql/20260513j_colmena_tubos_uuid_not_null.sql (NOT NULL
--   constraint). El JS de v5.10 sigue funcional sin el constraint en BD,
--   pero el constraint es la defensa de última línea.
--
-- Reversibilidad:
--   UPDATE configuracion SET valor = '5.9' WHERE clave = 'opt_version_minima';
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== bump opt_version_minima a 5.10 — INICIADO ==='; END $$;

-- Verificar que el NOT NULL constraint esté en BD antes de bumpear
DO $$
DECLARE v_nullable text;
BEGIN
  SELECT is_nullable INTO v_nullable
  FROM information_schema.columns
  WHERE table_name = 'colmena_tubos' AND column_name = 'tubo_raiz_id';

  IF v_nullable IS NULL THEN
    RAISE EXCEPTION 'Columna colmena_tubos.tubo_raiz_id no encontrada';
  END IF;
  IF v_nullable <> 'NO' THEN
    RAISE EXCEPTION 'colmena_tubos.tubo_raiz_id permite NULL (is_nullable=%). Correr primero sql/20260513j_colmena_tubos_uuid_not_null.sql', v_nullable;
  END IF;
END $$;

UPDATE configuracion
SET valor = '5.10'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave = 'opt_version_minima';

DO $$
DECLARE v_ver text;
BEGIN
  SELECT valor INTO v_ver FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'opt_version_minima';
  IF v_ver <> '5.10' THEN
    RAISE EXCEPTION 'Bump falló: opt_version_minima quedó en %', v_ver;
  END IF;
  RAISE NOTICE '  opt_version_minima = 5.10 (taller forzará recarga)';
END $$;

DO $$ BEGIN RAISE NOTICE '=== bump opt_version_minima a 5.10 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Bump aplicado:
--    SELECT valor FROM configuracion
--    WHERE clave = 'opt_version_minima'
--      AND empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
--    → '5.10'
--
-- 2) Constraint activo:
--    SELECT is_nullable FROM information_schema.columns
--    WHERE table_name = 'colmena_tubos' AND column_name = 'tubo_raiz_id';
--    → 'NO'
--
-- 3) Postventa cierra browser completamente y reabre el optimizador.
--    Console debe mostrar VERSION_ACTUAL = 5.10.
--
-- 4) Próxima carga de colmenas desde Supabase: si alguna fila viniera
--    con tubo_raiz_id NULL (no debería tras el constraint), aparece
--    alert() bloqueando el flujo. Esto es el comportamiento esperado.
-- ============================================================================
