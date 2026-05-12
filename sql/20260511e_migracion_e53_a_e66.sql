-- ============================================================================
-- Migración: código E53 → E66 (mismo tubo físico, código incorrecto en sistema)
-- Fecha: 2026-05-11
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Gerencia identificó que las órdenes que vienen del Excel con código
--   "E53" en realidad corresponden al mismo tubo físico que ya está
--   catalogado como "E66". Era un error de catálogo del lado del cliente
--   que se arrastró al sistema. Hoy hay E53 en colmena, en historial y
--   en errores_corte; el optimizador parsea órdenes con E53 y compra/usa
--   tubos como si fuera código distinto a E66.
--
-- Alcance auditado (snapshot 2026-05-11):
--   3 tubos E53 en colmena_tubos (todos en A2: 170.20, 154.80, 172.60 cm)
--   181 eventos E53 en tubos_historial
--   1 registro E53 en errores_corte
--   118 planes_corte con E53 en su JSON (NO se tocan — son histórico)
--   1 snapshot en configuracion (opt_colmena_final_gerencia@cortinasrolzzo.cl)
--
--   0 conflictos con E66 preexistentes (n_colmena, medida_cm) verificado.
--
-- Acción:
--   1. Backup defensivo de las 3 tablas afectadas
--   2. UPDATE colmena_tubos: cod E53 → E66 (3 rows)
--   3. UPDATE tubos_historial: cod E53 → E66 (181 rows)
--   4. UPDATE errores_corte: cod_original/reemplazo_cod E53 → E66 (1 row)
--   5. UPDATE configuracion: reemplazar "E53" → "E66" en el snapshot JSON
--      de gerencia@cortinasrolzzo.cl
--   6. Bump opt_version_minima a 5.7
--
-- Lo que NO se toca:
--   - planes_corte (resultados, ordenes) — son histórico. Si se necesita
--     ver "E66" en HistorialCorte para planes viejos, hacer normalización
--     al render (no en BD).
--
-- Reversibilidad:
--   Tablas _backup_e53_migration_20260511 retienen el estado pre-migración
--   de cada fila tocada.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Migración E53 → E66 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Pre-flight: validar que no haya conflictos con E66 preexistentes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_conflictos integer;
BEGIN
  SELECT COUNT(*) INTO v_conflictos
  FROM colmena_tubos e53
  JOIN colmena_tubos e66
    ON e66.empresa_id = e53.empresa_id
   AND e66.n_colmena = e53.n_colmena
   AND e66.medida_cm = e53.medida_cm
   AND e66.cod = 'E66'
  WHERE e53.cod = 'E53'
    AND e53.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

  IF v_conflictos > 0 THEN
    RAISE EXCEPTION 'Step 0 falló: % conflicto(s) con E66 preexistentes — abortar y unificar manualmente', v_conflictos;
  END IF;
  RAISE NOTICE 'Step 0: 0 conflictos verificados';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Backups defensivos
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS colmena_tubos_backup_e53_migration_20260511;
CREATE TABLE colmena_tubos_backup_e53_migration_20260511 AS
SELECT * FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND cod = 'E53';

DROP TABLE IF EXISTS tubos_historial_backup_e53_migration_20260511;
CREATE TABLE tubos_historial_backup_e53_migration_20260511 AS
SELECT * FROM tubos_historial
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
  AND cod = 'E53';

DROP TABLE IF EXISTS errores_corte_backup_e53_migration_20260511;
CREATE TABLE errores_corte_backup_e53_migration_20260511 AS
SELECT * FROM errores_corte
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND (cod_original = 'E53' OR reemplazo_cod = 'E53');

DROP TABLE IF EXISTS configuracion_backup_e53_migration_20260511;
CREATE TABLE configuracion_backup_e53_migration_20260511 AS
SELECT * FROM configuracion
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND valor::text ILIKE '%E53%';

DO $$
DECLARE
  v_b_colmena   integer;
  v_b_historial integer;
  v_b_errores   integer;
  v_b_config    integer;
BEGIN
  SELECT COUNT(*) INTO v_b_colmena FROM colmena_tubos_backup_e53_migration_20260511;
  SELECT COUNT(*) INTO v_b_historial FROM tubos_historial_backup_e53_migration_20260511;
  SELECT COUNT(*) INTO v_b_errores FROM errores_corte_backup_e53_migration_20260511;
  SELECT COUNT(*) INTO v_b_config FROM configuracion_backup_e53_migration_20260511;
  RAISE NOTICE 'Step 1 — backups: colmena=%, historial=%, errores=%, config=%',
    v_b_colmena, v_b_historial, v_b_errores, v_b_config;
  IF v_b_colmena <> 3 THEN
    RAISE EXCEPTION 'Backup colmena_tubos esperaba 3 filas pero capturó %', v_b_colmena;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) UPDATE colmena_tubos: cod E53 → E66
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_actualizados integer;
BEGIN
  UPDATE colmena_tubos
  SET cod = 'E66'
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND cod = 'E53';
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  IF v_actualizados <> 3 THEN
    RAISE EXCEPTION 'Esperaba actualizar 3 tubos pero actualicé %', v_actualizados;
  END IF;
  RAISE NOTICE 'Step 2: % tubos en colmena migrados E53 → E66', v_actualizados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) UPDATE tubos_historial: cod E53 → E66
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_actualizados integer;
BEGIN
  UPDATE tubos_historial
  SET cod = 'E66'
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND cod = 'E53';
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  RAISE NOTICE 'Step 3: % eventos en historial migrados E53 → E66', v_actualizados;
  IF v_actualizados <> 181 THEN
    RAISE WARNING 'Esperaba actualizar 181 eventos pero actualicé % (puede haber concurrentes — revisar)', v_actualizados;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) UPDATE errores_corte: cod_original/reemplazo_cod E53 → E66
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE errores_corte
SET cod_original = CASE WHEN cod_original = 'E53' THEN 'E66' ELSE cod_original END,
    reemplazo_cod = CASE WHEN reemplazo_cod = 'E53' THEN 'E66' ELSE reemplazo_cod END
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND (cod_original = 'E53' OR reemplazo_cod = 'E53');

DO $$
DECLARE v_quedan integer;
BEGIN
  SELECT COUNT(*) INTO v_quedan
  FROM errores_corte
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND (cod_original = 'E53' OR reemplazo_cod = 'E53');
  IF v_quedan > 0 THEN
    RAISE EXCEPTION 'Step 4 falló: % errores_corte siguen con E53', v_quedan;
  END IF;
  RAISE NOTICE 'Step 4: errores_corte migrados (0 residuales)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) UPDATE configuracion: snapshot opt_colmena_final_* — reemplazar E53 → E66
-- ─────────────────────────────────────────────────────────────────────────────
-- El snapshot es un array JSON de objetos { cod: 'E53', ... }. Reemplazo
-- por regex sobre el texto (más simple que jsonb_array iteración).
UPDATE configuracion
SET valor = regexp_replace(valor::text, '"cod"\s*:\s*"E53"', '"cod":"E66"', 'g')
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave LIKE 'opt_colmena_final_%'
  AND valor::text ILIKE '%"cod":"E53"%';

DO $$
DECLARE v_quedan integer;
BEGIN
  SELECT COUNT(*) INTO v_quedan
  FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave LIKE 'opt_colmena_final_%'
    AND valor::text ILIKE '%"cod":"E53"%';
  IF v_quedan > 0 THEN
    RAISE WARNING 'Step 5: % snapshots todavía con "cod":"E53" — revisar formato', v_quedan;
  END IF;
  RAISE NOTICE 'Step 5: snapshots opt_colmena_final_* migrados';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Bump opt_version_minima a 5.7 — fuerza recarga del taller con el guard JS
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE configuracion
SET valor = '5.7'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave = 'opt_version_minima';

DO $$
DECLARE v_ver text;
BEGIN
  SELECT valor INTO v_ver FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'opt_version_minima';
  IF v_ver <> '5.7' THEN
    RAISE EXCEPTION 'Step 6 falló: opt_version_minima quedó en %', v_ver;
  END IF;
  RAISE NOTICE 'Step 6: opt_version_minima = 5.7 (taller forzará recarga)';
END $$;

DO $$ BEGIN RAISE NOTICE '=== Migración E53 → E66 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT (correr aparte):
--
-- 1) 0 E53 en las 3 tablas
--    SELECT
--      (SELECT count(*) FROM colmena_tubos
--       WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid AND cod='E53') AS e53_colmena,
--      (SELECT count(*) FROM tubos_historial
--       WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::text AND cod='E53') AS e53_historial,
--      (SELECT count(*) FROM errores_corte
--       WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid
--         AND (cod_original='E53' OR reemplazo_cod='E53')) AS e53_errores;
--    -- Esperado: todos 0
--
-- 2) Los 3 UUIDs ahora son E66
--    SELECT n_colmena, cod, medida_cm FROM colmena_tubos
--    WHERE tubo_raiz_id IN (
--      'f645f986-7f79-46f8-90a3-c50e5d6fb37f'::uuid,
--      'ae6e6b73-292a-48d8-b3a6-519933e17f23'::uuid,
--      'beab6f34-5525-4469-88bb-a7e640e060cc'::uuid
--    );
--    -- Esperado: 3 filas, todas A2 / E66 / 170.20|154.80|172.60
--
-- 3) Reversibilidad si fuera necesario:
--    UPDATE colmena_tubos SET cod = 'E53'
--    WHERE tubo_raiz_id IN (SELECT tubo_raiz_id FROM colmena_tubos_backup_e53_migration_20260511);
-- ============================================================================
