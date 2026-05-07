-- ============================================================================
-- Purga: 98 tubos fantasma resucitados por recoveries pre-carga inicial 05/05
-- Fecha: 2026-05-07
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   El 05/05 (PR #36, sql/20260504d_carga_inicial_taller.sql) se hizo wipe
--   completo de colmena_tubos y reload con 165 tubos físicos contados por
--   el taller. Audit trail con fuente='carga_inicial_taller'.
--
--   Después hubo dos incidentes con sync destructivo:
--     - 06/05 (OT 2942): 197 tubos perdidos, recovery PR #63
--     - 07/05 (cache stale): 42 tubos perdidos, recovery PR #65
--
--   Las plantillas de recovery restauran tubos basándose en `tubos_historial`
--   sin filtrar por la fecha de la última carga inicial. Resultado:
--   resucitan UUIDs de eventos pre-05/05 (sobrantes del 30/abr y antes)
--   que la carga del 05/05 había invalidado físicamente.
--
--   Hoy postventa reportó "no encuentro el tubo E02 162.5" (UUID 3ec188b0,
--   sobrante de OT 2932 del 30/abr). Investigación reveló 98 tubos fantasma
--   en colmena_tubos (33% del inventario actual de 291).
--
-- Heurística:
--   Tubo fantasma = sin evento de origen post 2026-05-05 15:43 UTC.
--   - Origen = ingreso, sobrante, restauracion, ajuste, sobrante_error
--   - Cutoff 15:43 cubre el inicio del test de inventario revertido y es
--     anterior al commit de la carga inicial (16:17 UTC).
--
-- Distribución de fantasmas (98 total):
--   A28: 40 | A27: 19 | A29: 11 (peso → 70)
--   L03:  9 | A30:  5 | A32:  5 | L02: 4
--   A20:  1 | B2:   1 | B1:  1  | NaN: 1 | A14: 1
--
-- Acción:
--   Logear evento 'eliminado' con fuente='purga_fantasmas_post_carga_inicial'
--   para los 98 UUIDs. Trigger trg_auto_remove_consumed_tube los borra
--   automáticamente de colmena_tubos en la misma transacción.
--
--   Tubos sin tubo_raiz_id (no deberían quedar — solo el "NaN" si tampoco
--   tiene UUID) se borran directamente al final.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Purga 98 fantasmas pre-carga inicial — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Backup defensivo
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS colmena_tubos_backup_pre_purga_98_fantasmas_20260507;

CREATE TABLE colmena_tubos_backup_pre_purga_98_fantasmas_20260507 AS
SELECT * FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$
DECLARE v_pre integer;
BEGIN
  SELECT COUNT(*) INTO v_pre FROM colmena_tubos_backup_pre_purga_98_fantasmas_20260507;
  RAISE NOTICE 'Step 1: backup creado con % tubos', v_pre;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Logear 'eliminado' para cada fantasma con tubo_raiz_id.
--    Trigger trg_auto_remove_consumed_tube auto-borra de colmena_tubos.
-- ─────────────────────────────────────────────────────────────────────────────
WITH legitimos AS (
  SELECT DISTINCT tubo_raiz_id FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND evento IN ('ingreso', 'sobrante', 'restauracion', 'ajuste', 'sobrante_error')
    AND created_at >= '2026-05-05 15:43:00+00'
    AND tubo_raiz_id IS NOT NULL
),
fantasmas AS (
  SELECT ct.empresa_id, ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm
  FROM colmena_tubos ct
  WHERE ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND ct.tubo_raiz_id IS NOT NULL
    AND ct.tubo_raiz_id NOT IN (SELECT tubo_raiz_id FROM legitimos)
)
INSERT INTO tubos_historial (
    empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, evento,
    registrado_por, notas, fuente
)
SELECT
    empresa_id::text, tubo_raiz_id, n_colmena, cod, medida_cm, 'eliminado',
    'sistema',
    'Purga fantasma post-carga inicial 2026-05-05. Recoveries PR #63/#65 resucitaron este UUID sin verificar cutoff de carga.',
    'purga_fantasmas_post_carga_inicial'
FROM fantasmas;

DO $$
DECLARE v_eliminados integer;
BEGIN
  SELECT COUNT(*) INTO v_eliminados FROM tubos_historial
   WHERE fuente='purga_fantasmas_post_carga_inicial' AND evento='eliminado';
  RAISE NOTICE 'Step 2: % eventos eliminado logeados (trigger borra de colmena_tubos)', v_eliminados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Limpiar fantasmas sin tubo_raiz_id (ej. el "NaN" si no tiene UUID).
--    Igual heurística: si no aparece en eventos legítimos post-cutoff, fuera.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM colmena_tubos ct
WHERE ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND ct.tubo_raiz_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tubos_historial th
    WHERE th.empresa_id = ct.empresa_id::text
      AND th.n_colmena = ct.n_colmena
      AND th.cod = ct.cod
      AND th.medida_cm = ct.medida_cm
      AND th.evento IN ('ingreso', 'sobrante', 'restauracion', 'ajuste', 'sobrante_error')
      AND th.created_at >= '2026-05-05 15:43:00+00'
  );

DO $$
DECLARE v_deleted integer;
BEGIN
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Step 3: % tubos sin tubo_raiz_id borrados directamente', v_deleted;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Verificación final
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_total integer;
        v_legitimos integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

  WITH legitimos AS (
    SELECT DISTINCT tubo_raiz_id FROM tubos_historial
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
      AND evento IN ('ingreso', 'sobrante', 'restauracion', 'ajuste', 'sobrante_error')
      AND created_at >= '2026-05-05 15:43:00+00'
      AND tubo_raiz_id IS NOT NULL
  )
  SELECT COUNT(*) INTO v_legitimos
    FROM colmena_tubos ct
   WHERE ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND ct.tubo_raiz_id IN (SELECT tubo_raiz_id FROM legitimos);

  RAISE NOTICE 'Verificación: total=% legitimos=% (deberían matchear si purga fue correcta)', v_total, v_legitimos;

  IF v_total <> v_legitimos THEN
    RAISE EXCEPTION 'Mismatch post-purga: total=% pero legitimos=%. Revisar antes de COMMIT.', v_total, v_legitimos;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Marcar última sync para invalidar caches de optimizador
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE colmena_sync_state
SET last_sync_at = NOW(),
    last_sync_by = 'purga_98_fantasmas_pre_carga_inicial_2026_05_07'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$ BEGIN RAISE NOTICE '=== Purga 98 fantasmas pre-carga inicial — COMPLETADO ==='; END $$;

COMMIT;

-- Smoke test post-COMMIT (correr aparte):
-- SELECT COUNT(*) FROM colmena_tubos WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
-- Esperado: 193 (o cercano si hubo más cortes mientras tanto).
