-- ============================================================================
-- Rollback: planes del 07/05 que no se cortaron físicamente (excepto 1 corte)
-- Fecha: 2026-05-07
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Postventa guardó 4 planes_corte hoy (2 saves del optimizador, cada uno
--   genera plan respaldo + plan activo):
--     - 13:20:35 (respaldo) + 13:20:42 (NULL) — plan 09:20 a.m. local, 4 cortes
--     - 14:45:57 (respaldo) + 14:46:04 (NULL) — plan 10:45 a.m. local, OT 2948, 8 cortes
--
--   Esos planes se hicieron contra inventario sucio (98 fantasmas pre-purga).
--   Postventa sólo cortó FÍSICAMENTE un tubo: A14 E18 159.4 (uuid 495d3a34)
--   con su merma E18 2.7. El resto NO se cortó.
--
--   Ahora hay que revertir los planes y los eventos asociados para que
--   postventa pueda re-planificar contra inventario limpio (193 tubos
--   post-purga). El único corte físico (495d3a34) se preserva.
--
-- Lógica:
--   1. Backup planes_corte y colmena_tubos.
--   2. Para cada UUID con corte/merma del 13:20:37 o 14:45:58 (excepto
--      495d3a34 que se preserva):
--      a. Si era legítimo (origen post-05/05/15:43 y pre-07/05/13:00):
--         insertar 'restauracion' en historial → destraba trigger
--         bloquear_insert_tubo_consumido → INSERT a colmena_tubos.
--      b. Si era fantasma: no hacer nada (el tubo no existe físicamente).
--   3. Para cada UUID con sobrante/sobrante_error del 13:20:37 o 14:45:58:
--      insertar 'eliminado' → trigger trg_auto_remove_consumed_tube borra
--      de colmena_tubos.
--   4. DELETE de los 4 planes_corte.
--   5. UPDATE colmena_sync_state.last_sync_at + last_sync_by.
--   6. Verificación intra-transacción.
--
-- Trigger bloquear_insert_tubo_consumido:
--   Lee último evento del UUID en tubos_historial. Si es corte/eliminado/merma,
--   bloquea INSERT. Solución: insertar 'restauracion' ANTES del INSERT a
--   colmena_tubos en la misma transacción (statements posteriores ven los
--   nuevos rows).
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Rollback planes 2026-05-07 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Backups defensivos
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS colmena_tubos_backup_pre_rollback_20260507;
CREATE TABLE colmena_tubos_backup_pre_rollback_20260507 AS
SELECT * FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DROP TABLE IF EXISTS planes_corte_backup_pre_rollback_20260507;
CREATE TABLE planes_corte_backup_pre_rollback_20260507 AS
SELECT * FROM planes_corte
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND fecha >= '2026-05-07'::date;

DO $$
DECLARE v_pre_tubos integer; v_pre_planes integer;
BEGIN
  SELECT COUNT(*) INTO v_pre_tubos FROM colmena_tubos_backup_pre_rollback_20260507;
  SELECT COUNT(*) INTO v_pre_planes FROM planes_corte_backup_pre_rollback_20260507;
  RAISE NOTICE 'Step 1: backup tubos=% planes=%', v_pre_tubos, v_pre_planes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2a) Insertar evento 'restauracion' para tubos legítimos a revertir.
--     Esto destraba el trigger bloquear_insert_tubo_consumido para el INSERT
--     a colmena_tubos en el step 2b.
-- ─────────────────────────────────────────────────────────────────────────────
WITH tubos_a_revertir AS (
  SELECT DISTINCT tubo_raiz_id FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND created_at IN (
      '2026-05-07 13:20:37.381467+00'::timestamptz,
      '2026-05-07 14:45:58.610622+00'::timestamptz
    )
    AND evento IN ('corte', 'merma')
    AND tubo_raiz_id IS NOT NULL
    AND tubo_raiz_id <> '495d3a34-96ae-485d-a2ff-ca710190054a'::uuid -- preservar corte físico
),
legitimos AS (
  -- Origen post carga 05/05 y pre primer save del 07/05 (excluye sobrantes de hoy)
  SELECT DISTINCT tubo_raiz_id FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND evento IN ('ingreso', 'sobrante', 'restauracion', 'ajuste', 'sobrante_error')
    AND created_at >= '2026-05-05 15:43:00+00'
    AND created_at < '2026-05-07 13:00:00+00'
    AND tubo_raiz_id IS NOT NULL
),
origen_a_restaurar AS (
  SELECT DISTINCT ON (th.tubo_raiz_id)
    th.tubo_raiz_id, th.n_colmena, th.cod, th.medida_cm
  FROM tubos_historial th
  WHERE th.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND th.tubo_raiz_id IN (SELECT tubo_raiz_id FROM tubos_a_revertir)
    AND th.tubo_raiz_id IN (SELECT tubo_raiz_id FROM legitimos)
    AND th.evento IN ('ingreso', 'sobrante', 'restauracion', 'ajuste', 'sobrante_error')
    AND th.created_at < '2026-05-07 13:00:00+00'
  ORDER BY th.tubo_raiz_id, th.created_at DESC
)
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, evento,
  registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  tubo_raiz_id, n_colmena, cod, medida_cm,
  'restauracion', 'sistema',
  'Rollback planes 2026-05-07: corte/merma revertido — plan no ejecutado físicamente',
  'rollback_planes_2026_05_07'
FROM origen_a_restaurar;

DO $$
DECLARE v_restauraciones integer;
BEGIN
  SELECT COUNT(*) INTO v_restauraciones FROM tubos_historial
   WHERE fuente = 'rollback_planes_2026_05_07' AND evento = 'restauracion';
  RAISE NOTICE 'Step 2a: % eventos restauracion logeados', v_restauraciones;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b) INSERT a colmena_tubos. El trigger ve restauracion como último evento.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_restored integer;
BEGIN
  INSERT INTO colmena_tubos (
    empresa_id, n_colmena, cod, medida_cm, medida_mm,
    tubo_raiz_id, agregado_por_admin
  )
  SELECT
    '67c635a5-152c-4780-a066-23f5081175a9'::uuid,
    th.n_colmena,
    th.cod,
    th.medida_cm,
    ROUND(th.medida_cm * 10)::integer,
    th.tubo_raiz_id,
    false
  FROM tubos_historial th
  WHERE th.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND th.fuente = 'rollback_planes_2026_05_07'
    AND th.evento = 'restauracion';

  GET DIAGNOSTICS v_restored = ROW_COUNT;
  RAISE NOTICE 'Step 2b: % tubos restaurados a colmena_tubos', v_restored;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Eliminar sobrantes generados hoy (no se cortó físicamente, no existen).
--    Trigger trg_auto_remove_consumed_tube borra automáticamente.
-- ─────────────────────────────────────────────────────────────────────────────
WITH sobrantes_a_eliminar AS (
  SELECT DISTINCT tubo_raiz_id FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND created_at IN (
      '2026-05-07 13:20:37.381467+00'::timestamptz,
      '2026-05-07 14:45:58.610622+00'::timestamptz
    )
    AND evento IN ('sobrante', 'sobrante_error')
    AND tubo_raiz_id IS NOT NULL
)
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, evento,
  registrado_por, notas, fuente
)
SELECT
  ct.empresa_id::text, ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm,
  'eliminado', 'sistema',
  'Rollback planes 2026-05-07: sobrante generado por plan no ejecutado físicamente',
  'rollback_planes_2026_05_07'
FROM colmena_tubos ct
WHERE ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND ct.tubo_raiz_id IN (SELECT tubo_raiz_id FROM sobrantes_a_eliminar);

DO $$
DECLARE v_eliminados integer;
BEGIN
  SELECT COUNT(*) INTO v_eliminados FROM tubos_historial
   WHERE fuente = 'rollback_planes_2026_05_07' AND evento = 'eliminado';
  RAISE NOTICE 'Step 3: % sobrantes eliminados', v_eliminados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Borrar los 4 planes_corte (DELETE dentro del DO block para que
--    GET DIAGNOSTICS ROW_COUNT capture el conteo)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM planes_corte
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND id IN (
      '3efd42d1-b109-4698-92bc-0f5ac55aa8f6'::uuid,
      '6de370f0-79a7-4d92-a60d-a4dd702bbd01'::uuid,
      'ec4a0513-cbf3-458a-a0df-de4cc079dffc'::uuid,
      '39c0aba1-d98e-4e4c-ae66-48c24fd45b45'::uuid
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> 4 THEN
    RAISE EXCEPTION 'Esperaba borrar 4 planes_corte pero borré %', v_deleted;
  END IF;
  RAISE NOTICE 'Step 4: % planes_corte borrados', v_deleted;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) UPDATE colmena_sync_state para invalidar caches del optimizador
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE colmena_sync_state
SET last_sync_at = NOW(),
    last_sync_by = 'rollback_planes_2026_05_07'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Verificación intra-transacción
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total integer;
  v_corte_preservado integer;
  v_planes_hoy integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

  SELECT COUNT(*) INTO v_corte_preservado FROM tubos_historial
   WHERE tubo_raiz_id = '495d3a34-96ae-485d-a2ff-ca710190054a'::uuid
     AND evento = 'corte';

  SELECT COUNT(*) INTO v_planes_hoy FROM planes_corte
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND fecha >= '2026-05-07'::date;

  RAISE NOTICE 'Verificación: total colmena_tubos=%, corte 495d3a34 preservado=%, planes hoy=%',
    v_total, v_corte_preservado, v_planes_hoy;

  IF v_corte_preservado < 1 THEN
    RAISE EXCEPTION 'Se perdió el corte preservado de 495d3a34!';
  END IF;

  IF v_planes_hoy <> 0 THEN
    RAISE EXCEPTION 'Quedaron % planes_corte del 07/05 sin borrar', v_planes_hoy;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Rollback planes 2026-05-07 — COMPLETADO ==='; END $$;

COMMIT;

-- Smoke tests post-COMMIT (correr aparte):
-- SELECT COUNT(*) FROM colmena_tubos WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
-- SELECT COUNT(*) FROM tubos_historial WHERE fuente='rollback_planes_2026_05_07' GROUP BY evento;
-- SELECT id, fecha, tipo FROM planes_corte WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid AND fecha>='2026-05-07'::date;
-- (último: 0 filas)
