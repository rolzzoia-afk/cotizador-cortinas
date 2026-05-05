-- ============================================================================
-- Carga inicial de tubos desde planilla del taller
-- Fecha: 2026-05-04
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Wipe completo de colmena_tubos y reload con los 165 tubos físicos contados
-- por el taller. Tubos pendientes (no incluidos en esta planilla) se agregan
-- después uno a uno desde el panel admin.
--
-- Distribución esperada (165 tubos):
--   A14: 10 (E18)        A29: 16 (E16)        A34:  2 (E02)
--   A20: 18 (E13)        A31:  7 (E66)        A35: 10 (E02)
--   A27: 18 (E63)        A32:  5 (E66)        B3:  27 (E62)
--   A28: 45 (E64)        L02:  7 (5 E66 + 2 E02)
--
-- Audit trail:
--   - Backup completo en `colmena_tubos_backup_pre_carga_taller_20260504`
--   - Eventos 'eliminado' (fuente=carga_inicial_taller) para todos los tubos
--     previos. El trigger trg_auto_remove_consumed_tube los borra de
--     colmena_tubos en la misma transacción.
--   - Eventos 'ingreso' (fuente=carga_inicial_taller) para los 165 nuevos.
--
-- IMPORTANTE: antes de ejecutar, verifica que NO haya un inventario activo:
--   SELECT * FROM inventarios WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND estado='activo';
--   Si hay alguno, ciérralo o cancélalo desde la UI antes de continuar.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Carga inicial taller 2026-05-04 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Backup defensivo (CREATE TABLE AS, drop si ya existe de un intento previo)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS colmena_tubos_backup_pre_carga_taller_20260504;

CREATE TABLE colmena_tubos_backup_pre_carga_taller_20260504 AS
SELECT * FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$
DECLARE v_pre integer; v_backup integer;
BEGIN
  SELECT COUNT(*) INTO v_pre    FROM colmena_tubos WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  SELECT COUNT(*) INTO v_backup FROM colmena_tubos_backup_pre_carga_taller_20260504;
  IF v_pre <> v_backup THEN
    RAISE EXCEPTION 'Backup mismatch: pre=% backup=%', v_pre, v_backup;
  END IF;
  RAISE NOTICE 'Step 1: backup creado con % tubos', v_backup;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Log 'eliminado' para todos los tubos actuales con tubo_raiz_id.
--    El trigger trg_auto_remove_consumed_tube auto-borra de colmena_tubos
--    en la misma transacción.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tubos_historial (
    empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, evento,
    registrado_por, notas, fuente
)
SELECT
    empresa_id::text, tubo_raiz_id, n_colmena, cod, medida_cm, 'eliminado',
    'sistema', 'Wipe pre-carga inicial taller 2026-05-04', 'carga_inicial_taller'
FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND tubo_raiz_id IS NOT NULL;

DO $$
DECLARE v_eliminados integer;
BEGIN
  SELECT COUNT(*) INTO v_eliminados FROM tubos_historial
   WHERE fuente='carga_inicial_taller' AND evento='eliminado';
  RAISE NOTICE 'Step 2: % eventos eliminado logeados (trigger borró los tubos)', v_eliminados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Limpiar tubos sin tubo_raiz_id que el trigger no captura
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Quedaron % tubos después del wipe', v_count;
  END IF;
  RAISE NOTICE 'Step 3: colmena_tubos vacía para esta empresa';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Cargar los 165 tubos del taller atómicamente:
--    - INSERT a colmena_tubos con UUID fresco para cada tubo
--    - Mismo CTE alimenta INSERT a tubos_historial (evento ingreso)
-- ─────────────────────────────────────────────────────────────────────────────
WITH nuevos(empresa_id, n_colmena, cod, medida_cm, raiz_id) AS (
  VALUES
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 155.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 135.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 153.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 149.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 139.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 136.3::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 102.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 102.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 224.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'L02', 'E02', 344.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A31', 'E66', 211.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A31', 'E66', 191.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A31', 'E66', 166.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A31', 'E66', 142.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A31', 'E66', 152.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A32', 'E66', 134.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A32', 'E66', 147.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A32', 'E66', 145.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A31', 'E66', 132.3::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A32', 'E66', 132.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A32', 'E66', 132.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A35', 'E02', 177.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A34', 'E02', 187.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A31', 'E66', 223.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A34', 'E02', 202.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'L02', 'E66', 284.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'L02', 'E66', 344.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'L02', 'E66', 284.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'L02', 'E66', 319.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'L02', 'E66', 329.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'L02', 'E02', 473.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 200.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 216.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 236.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 184.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 181.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 164.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 174.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 157.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 155.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 155.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 186.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 194.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 176.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 194.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 150.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 143.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 140.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 132.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 137.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 135.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 132.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 133.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 130.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 130.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 116.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 97.9::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 97.4::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 97.1::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 234.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 329.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 270.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 177.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 234.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 134.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 134.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 132.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 133.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 134.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 131.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 159.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 202.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 197.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 155.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 194.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 178.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 150.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 176.3::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 177.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 148.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 155.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 150.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 134.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 140.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 200.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 216.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 178.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 170.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 165.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 155.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 155.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A27', 'E63', 133.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 94.6::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A28', 'E64', 166.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 165.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 192.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 164.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 211.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 194.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 162.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 203.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 160.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 189.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 153.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 146.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 147.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 137.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 133.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 114.3::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A29', 'E16', 135.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 137.3::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 186.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 99.5::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 99.5::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 143.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 114.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 189.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 184.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 159.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A14', 'E18', 185.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 30.5::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 41.7::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 45.0::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 47.8::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 58.0::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 85.0::numeric,  gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 102.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 103.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 102.8::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 104.4::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 116.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 117.3::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 118.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 118.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 118.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 121.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 120.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 122.6::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 128.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 143.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 141.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 144.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 146.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 144.3::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 183.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 212.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'B3',  'E62', 226.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 202.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 186.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 181.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 244.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 217.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 198.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 152.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 181.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 209.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 186.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 148.7::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 186.2::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 147.1::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 147.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 138.9::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 130.0::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 101.5::numeric, gen_random_uuid()),
    ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'A20', 'E13', 101.2::numeric, gen_random_uuid())
),
ins_ct AS (
  INSERT INTO colmena_tubos (
      empresa_id, n_colmena, cod, medida_cm, medida_mm,
      tubo_raiz_id, agregado_por_admin
  )
  SELECT
      empresa_id, n_colmena, cod, medida_cm, (medida_cm * 10)::integer,
      raiz_id, true
  FROM nuevos
  RETURNING id
)
INSERT INTO tubos_historial (
    empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, evento,
    registrado_por, notas, fuente
)
SELECT
    empresa_id::text, raiz_id, n_colmena, cod, medida_cm, 'ingreso',
    'sistema', 'Carga inicial desde planilla del taller 2026-05-04',
    'carga_inicial_taller'
FROM nuevos;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Verificación: 165 tubos cargados, 165 eventos ingreso
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count integer; v_ingreso integer; v_eliminado integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

  SELECT COUNT(*) INTO v_ingreso FROM tubos_historial
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
     AND fuente = 'carga_inicial_taller' AND evento = 'ingreso';

  SELECT COUNT(*) INTO v_eliminado FROM tubos_historial
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
     AND fuente = 'carga_inicial_taller' AND evento = 'eliminado';

  IF v_count <> 165 THEN
    RAISE EXCEPTION 'Esperaba 165 tubos cargados, hay %', v_count;
  END IF;
  IF v_ingreso <> 165 THEN
    RAISE EXCEPTION 'Esperaba 165 eventos ingreso, hay %', v_ingreso;
  END IF;

  RAISE NOTICE 'Step 5: ÉXITO — % tubos cargados, % eventos ingreso, % eventos eliminado del wipe',
    v_count, v_ingreso, v_eliminado;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Actualizar colmena_sync_state para que el optimizador no choque con
--    cache stale post-carga.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, NOW(), 'carga_inicial_taller')
ON CONFLICT (empresa_id) DO UPDATE SET
  last_sync_at = NOW(),
  last_sync_by = 'carga_inicial_taller';

DO $$ BEGIN RAISE NOTICE '=== Carga inicial taller 2026-05-04 — COMPLETADA ==='; END $$;

COMMIT;

-- ============================================================================
-- Verificaciones manuales post-COMMIT
-- ============================================================================
--
-- 1. Conteo total y por colmena:
--    SELECT n_colmena, cod, COUNT(*)
--      FROM colmena_tubos
--     WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--    GROUP BY n_colmena, cod
--    ORDER BY n_colmena, cod;
--
--    Debe coincidir con la distribución del header del archivo:
--    A14:10  A20:18  A27:18  A28:45  A29:16  A31:7  A32:5  A34:2  A35:10  B3:27  L02:7
--
-- 2. Cuando confirmes que los datos están correctos, elimina el backup:
--    DROP TABLE colmena_tubos_backup_pre_carga_taller_20260504;
--
-- 3. Si necesitas revertir antes de borrar el backup:
--    BEGIN;
--    DELETE FROM colmena_tubos WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
--    INSERT INTO colmena_tubos
--      SELECT * FROM colmena_tubos_backup_pre_carga_taller_20260504;
--    COMMIT;
--    (Y opcional: limpiar los eventos de fuente='carga_inicial_taller')
-- ============================================================================
