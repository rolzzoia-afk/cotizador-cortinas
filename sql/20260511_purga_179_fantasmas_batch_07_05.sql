-- ============================================================================
-- Purga: 179 fantasmas — batch ficticio del sync atómico del 07/05 20:46:59
-- Fecha: 2026-05-11
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Postventa reportó que el sobrante A31 E66 161.9 cm (de plan OT 2938 del
--   07/05 19:33, plan_id 04ca5837-d1d9-491d-8af4-a813066dabff) no estaba
--   físicamente. Lo marcó como ERROR + merma manualmente.
--
--   Investigación reveló: ese tubo (1802ca42) era parte de un batch de
--   179 tubos insertados en un único commit a las 2026-05-07 20:46:59.275335
--   (mismísimo microsegundo → sync_colmena_tubos atómico procesando varios
--   planes juntos). Cobertura: 23 OTs distintas (2876, 2881, 2890, 2892,
--   2914, 2921, 2923, 2924, 2926, 2933, 2934, 2936, 2937, 2938, 2939, 2940,
--   2941, 2942, 2944, 2945, 2947, 2948, 2449).
--
--   Evidencia de que el batch entero es ficticio:
--     - 179 tubos con total_eventos=0 en tubos_historial (sin ingreso ni nada)
--     - 0 con agregado_por_admin (no son baseline manual)
--     - 0 usados como ORIGEN en planes_corte posteriores al 07/05 20:46:59
--       (en 4 días nadie intentó cortar ninguno → físicamente no existen)
--     - 1 validado físicamente por postventa (1802ca42, A31 E66 161.9)
--
--   Hipótesis del origen: race condition o bug en el sync atómico al
--   procesar múltiples planes en la misma transacción — generó sobrantes
--   "espejo" en colmena_tubos sin el evento 'ingreso' correspondiente en
--   tubos_historial. NO hay impacto en planes ejecutados (todos esos
--   sobrantes son ficticios; las OTs de origen siguen entregables).
--
-- Acción:
--   1. Backup de los 179 tubos
--   2. INSERT 'eliminado' en tubos_historial con fuente='purga_179_fantasmas_batch_07_05'
--      (trigger trg_auto_remove_consumed_tube borra de colmena_tubos)
--   3. Verificación: 0 tubos restantes del batch
--   4. UPDATE colmena_sync_state para invalidar caches del taller
--
-- Reversibilidad:
--   El backup colmena_tubos_backup_179_fantasmas_20260511 contiene los 179
--   tubos pre-purga. Para revertir: INSERT INTO colmena_tubos SELECT * FROM
--   colmena_tubos_backup_179_fantasmas_20260511 + borrar los eventos
--   'eliminado' con fuente='purga_179_fantasmas_batch_07_05'.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Purga 179 fantasmas batch 07/05 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Backup defensivo: snapshot pre-purga de los 179 tubos
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS colmena_tubos_backup_179_fantasmas_20260511;

CREATE TABLE colmena_tubos_backup_179_fantasmas_20260511 AS
SELECT *
FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND created_at = '2026-05-07 20:46:59.275335+00';

DO $$
DECLARE v_pre integer;
BEGIN
  SELECT COUNT(*) INTO v_pre FROM colmena_tubos_backup_179_fantasmas_20260511;
  IF v_pre <> 179 THEN
    RAISE EXCEPTION 'Backup esperaba 179 tubos pero capturó %. Abortando.', v_pre;
  END IF;
  RAISE NOTICE 'Step 0: backup creado con % tubos', v_pre;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) INSERT 'eliminado' en tubos_historial para los 179 UUIDs del batch.
--    Trigger trg_auto_remove_consumed_tube borra automáticamente de
--    colmena_tubos al insertar el evento 'eliminado'.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_eliminados integer;
BEGIN
  INSERT INTO tubos_historial (
    empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, evento,
    registrado_por, notas, fuente
  )
  SELECT
    ct.empresa_id::text,
    ct.tubo_raiz_id,
    ct.n_colmena,
    ct.cod,
    ct.medida_cm,
    'eliminado',
    'sistema',
    'Sobrante ficticio del batch atómico del 07/05 20:46:59 — sin ingreso, sin consumo posterior, validado por postventa',
    'purga_179_fantasmas_batch_07_05'
  FROM colmena_tubos ct
  WHERE ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND ct.created_at = '2026-05-07 20:46:59.275335+00';

  GET DIAGNOSTICS v_eliminados = ROW_COUNT;
  IF v_eliminados <> 179 THEN
    RAISE EXCEPTION 'Esperaba eliminar 179 fantasmas pero eliminé %. Abortando.', v_eliminados;
  END IF;
  RAISE NOTICE 'Step 1: % fantasmas marcados como eliminado en tubos_historial', v_eliminados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Verificación: el trigger borró los 179 tubos de colmena_tubos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_quedan integer;
BEGIN
  SELECT COUNT(*) INTO v_quedan
  FROM colmena_tubos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND created_at = '2026-05-07 20:46:59.275335+00';

  IF v_quedan <> 0 THEN
    RAISE EXCEPTION 'Quedaron % fantasmas sin purgar (trigger trg_auto_remove_consumed_tube falló?)', v_quedan;
  END IF;
  RAISE NOTICE 'Step 2: 0 fantasmas restantes en colmena_tubos del batch';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Verificar que los 179 eventos 'eliminado' quedaron logueados
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_eventos integer;
BEGIN
  SELECT COUNT(*) INTO v_eventos
  FROM tubos_historial
  WHERE fuente = 'purga_179_fantasmas_batch_07_05'
    AND evento = 'eliminado';

  IF v_eventos <> 179 THEN
    RAISE EXCEPTION 'Esperaba 179 eventos logueados pero hay %. Abortando.', v_eventos;
  END IF;
  RAISE NOTICE 'Step 3: % eventos eliminado logueados con fuente=purga_179_fantasmas_batch_07_05', v_eventos;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) UPDATE colmena_sync_state para invalidar caches del taller
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE colmena_sync_state
SET last_sync_at = NOW(),
    last_sync_by = 'purga_179_fantasmas_batch_2026_05_11'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$ BEGIN RAISE NOTICE '=== Purga 179 fantasmas batch 07/05 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT (correr aparte):
--
-- 1) Total de tubos en colmena debería bajar exactamente 179
--    SELECT COUNT(*) FROM colmena_tubos
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
--
-- 2) Dashboard de Reconciliación debería volver a ~0 fantasmas
--    (refrescar la pestaña Ojo de Dios → Reconciliación)
--
-- 3) Verificar que el backup quedó disponible para revertir si necesario
--    SELECT COUNT(*) FROM colmena_tubos_backup_179_fantasmas_20260511;
--    -- Esperado: 179
-- ============================================================================
