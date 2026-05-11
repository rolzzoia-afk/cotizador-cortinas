-- ============================================================================
-- Fix: catálogo de reemplazos permitía E19 → E20 (peso blanco → peso gris)
-- Fecha: 2026-05-11
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Plan OT 2940 del 07/05 16:46 (id 6e8e6473-734c-4a4b-adee-1c8e75a4b21e)
--   contenía orden con codigo='E19' (peso inferior dúo lágrima BLANCO).
--   El optimizador no encontró tubo E19 en colmena y, al consultar el
--   catálogo de reemplazos (clave 'catalogo_reemplazos_data'), encontró
--   que E19 tenía como reemplazo a E20 (peso GRIS). Resultado: la cortina
--   blanca quedó con peso gris.
--
--   Los pesos color-específicos (E18=negro, E19=blanco, E20=gris) NO son
--   intercambiables entre colores. Es error de configuración del catálogo,
--   probablemente arrastrado del Excel de catálogo que el operario subió
--   en algún momento.
--
-- Diagnóstico actual:
--   E18 → NULL (correcto)
--   E19 → "E20" (BUG)
--   E20 → NULL (correcto)
--   Otros que referencian pesos: solo E19 (un único cruce)
--
-- Acción:
--   Eliminar la entrada 'E19' del objeto catalogoReemplazos. Sin reemplazos
--   asignados, el optimizador tomará el camino "tubo nuevo" si no hay E19
--   en colmena — comportamiento correcto.
--
-- El guard en optimizador.html (commit posterior) es defensivo:
--   bloquea cross-color en E18/E19/E20 incluso si el catálogo
--   vuelve a quedar mal configurado en el futuro.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Fix catalogo reemplazos E19 → E20 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Backup defensivo del valor actual del catálogo
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS configuracion_backup_catalogo_pre_fix_pesos_20260511;
CREATE TABLE configuracion_backup_catalogo_pre_fix_pesos_20260511 AS
SELECT *
FROM configuracion
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave = 'catalogo_reemplazos_data';

DO $$
DECLARE v_pre integer;
BEGIN
  SELECT COUNT(*) INTO v_pre FROM configuracion_backup_catalogo_pre_fix_pesos_20260511;
  IF v_pre <> 1 THEN
    RAISE EXCEPTION 'Backup esperaba 1 fila pero capturó %. Abortando.', v_pre;
  END IF;
  RAISE NOTICE 'Step 0: backup creado (1 fila)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Eliminar la clave 'E19' del objeto catalogoReemplazos.
--    jsonb_set + jsonb #- '{catalogoReemplazos,E19}' borra la entrada anidada.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_antes  text;
  v_despues text;
BEGIN
  SELECT valor::jsonb #> '{catalogoReemplazos,E19}'
    INTO v_antes
  FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'catalogo_reemplazos_data';

  RAISE NOTICE 'Step 1 — E19 antes: %', COALESCE(v_antes, '(null)');

  UPDATE configuracion
  SET valor = (valor::jsonb #- '{catalogoReemplazos,E19}')::text
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'catalogo_reemplazos_data';

  SELECT valor::jsonb #> '{catalogoReemplazos,E19}'
    INTO v_despues
  FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'catalogo_reemplazos_data';

  IF v_despues IS NOT NULL THEN
    RAISE EXCEPTION 'Step 1 falló: E19 sigue presente (%)', v_despues;
  END IF;

  RAISE NOTICE 'Step 1 — E19 después: (eliminado)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Verificación: ningún peso (E18/E19/E20) tiene reemplazo asignado
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_e18 text;
  v_e19 text;
  v_e20 text;
BEGIN
  SELECT valor::jsonb #> '{catalogoReemplazos,E18}',
         valor::jsonb #> '{catalogoReemplazos,E19}',
         valor::jsonb #> '{catalogoReemplazos,E20}'
    INTO v_e18, v_e19, v_e20
  FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'catalogo_reemplazos_data';

  IF v_e18 IS NOT NULL OR v_e19 IS NOT NULL OR v_e20 IS NOT NULL THEN
    RAISE EXCEPTION 'Step 2 falló: pesos siguen con reemplazos. E18=% E19=% E20=%',
      COALESCE(v_e18,'-'), COALESCE(v_e19,'-'), COALESCE(v_e20,'-');
  END IF;

  RAISE NOTICE 'Step 2: E18/E19/E20 sin reemplazos (correcto)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Bump de versión mínima a 5.5 — fuerza recarga del taller con el guard JS
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE configuracion
SET valor = '5.5'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave = 'opt_version_minima';

DO $$
DECLARE v_ver text;
BEGIN
  SELECT valor INTO v_ver FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'opt_version_minima';
  IF v_ver <> '5.5' THEN
    RAISE EXCEPTION 'Step 3 falló: opt_version_minima quedó en %', v_ver;
  END IF;
  RAISE NOTICE 'Step 3: opt_version_minima = 5.5 (taller forzará recarga)';
END $$;

DO $$ BEGIN RAISE NOTICE '=== Fix catalogo reemplazos E19 → E20 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT (correr aparte):
--
-- 1) Verificar que el cruce se eliminó
--    SELECT valor::jsonb #> '{catalogoReemplazos,E19}' FROM configuracion
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND clave = 'catalogo_reemplazos_data';
--    -- Esperado: NULL
--
-- 2) Verificar que no quedan referencias inversas a pesos
--    SELECT key, value FROM configuracion,
--         jsonb_each_text(valor::jsonb -> 'catalogoReemplazos')
--    WHERE clave = 'catalogo_reemplazos_data'
--      AND (value ILIKE '%E18%' OR value ILIKE '%E19%' OR value ILIKE '%E20%');
--    -- Esperado: 0 filas
--
-- 3) Reversibilidad (si fuera necesario):
--    UPDATE configuracion SET valor = (
--      SELECT valor FROM configuracion_backup_catalogo_pre_fix_pesos_20260511
--    )
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND clave = 'catalogo_reemplazos_data';
-- ============================================================================
