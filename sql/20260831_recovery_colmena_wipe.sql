-- ─────────────────────────────────────────────────────────────────────
-- Recovery 2026-08-31 — la colmena de tubos quedó VACÍA (537 → 0)
--
-- QUÉ PASÓ: el 2026-08-28 a las 20:22:50 se guardó un plan de corte normal
-- (8 cortes, eventos registrados). 11 segundos después se confirmó OTRA VEZ:
-- la limpieza post-guardado del optimizador ya había vaciado el estado en
-- memoria (resultados y colmena en []), pero el botón «Confirmar» seguía
-- vivo y el panel visible mientras corrían las verificaciones de red. Esa
-- segunda confirmación llamó a `guardar_plan_atomico` con la lista de tubos
-- VACÍA, y esa RPC hace DELETE + INSERT **sin guard de borrado masivo** (el
-- guard del 2026-04-29 vive solo en `sync_colmena_tubos`, y además solo
-- aplica sin lock optimista — acá el lock venía válido de la misma sesión).
-- Resultado: los 537 tubos borrados, cero eventos, y todas las capas de
-- verificación en verde porque todas preguntan «si hay eventos…».
--
-- El 2026-08-31 a las 12:42 se repitió el patrón sobre la colmena ya vacía
-- (plan con 6 órdenes y 0 resultados): de ahí los Excel en blanco con
-- CORRELATIVO. Desde el 28/8 20:22:52 no hay NINGÚN evento en
-- tubos_historial: nadie cortó nada en el medio (fin de semana).
--
-- LA COPIA BUENA: el plan vacío del 28/8 (583450f2) guardó en su
-- `snapshot_inventario` la colmena TAL CUAL estaba a las 20:23:00, justo
-- antes del borrado: 537 tubos, todos con UUID y medida. Verificado que es
-- el estado POSTERIOR al plan bueno: sus 8 tubos cortados no están y sus
-- sobrantes sí. Es exactamente lo que hay que reponer.
--
-- QUÉ HACE:
--   1. Aborta si la colmena NO está vacía (por si ya se recuperó por otro lado).
--   2. Respaldo de los 4 planes vacíos en planes_corte_backup_20260831_wipe.
--   3. Reinsertar los 537 tubos desde el snapshot, con sus UUID originales.
--   4. Evento `ingreso` por cada tubo (fuente recovery_wipe_20260831): la
--      regla de la casa es que toda carga masiva escribe su ingreso, y de
--      paso cura cualquier tombstone viejo (ingreso posterior al eliminado).
--   5. Bumpear colmena_sync_state para que una pestaña abierta con estado
--      viejo no pueda pisar la recuperación (el lock optimista la rechaza).
--   6. Borrar los 4 planes vacíos (2 pares respaldo+plan) para que el
--      Historial de Corte y la re-descarga del «último plan» no ofrezcan
--      más Excel en blanco. Quedan en la tabla de respaldo.
--   7. Aserción final: exactamente 537 tubos, o rollback de todo.
--
-- DESPUÉS DE CORRER ESTO: en el optimizador, recargar la página completa
-- (Ctrl+Shift+R) y «Cargar desde Supabase» antes de calcular nada. Las OTs
-- del plan en blanco de hoy (#3212…) NUNCA se cortaron: hay que correrlas
-- de nuevo; si la pestaña avisa «ya fueron procesadas hoy», continuar.
--
-- REVERSA: los tubos insertados llevan eventos con
-- fuente='recovery_wipe_20260831'; los planes borrados están en
-- planes_corte_backup_20260831_wipe.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Precondiciones: colmena vacía y snapshot con los 537 esperados.
DO $$
DECLARE
  v_tubos    integer;
  v_snapshot integer;
BEGIN
  SELECT count(*) INTO v_tubos
  FROM colmena_tubos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9';

  IF v_tubos <> 0 THEN
    RAISE EXCEPTION 'ABORTADO: la colmena tiene % tubos, se esperaba 0. ¿Ya se recuperó? Revisar antes de correr esto.', v_tubos;
  END IF;

  SELECT jsonb_array_length(snapshot_inventario) INTO v_snapshot
  FROM planes_corte
  WHERE id = '583450f2-2eb6-455a-8938-b7affff7dfc9';

  IF v_snapshot IS DISTINCT FROM 537 THEN
    RAISE EXCEPTION 'ABORTADO: el snapshot del plan 583450f2 tiene % tubos, se esperaban 537.', v_snapshot;
  END IF;
END $$;

-- 2. Respaldo de los 4 planes vacíos (los dos pares respaldo+plan).
CREATE TABLE IF NOT EXISTS planes_corte_backup_20260831_wipe AS
SELECT *
FROM planes_corte
WHERE id IN (
  '28907d45-a209-4d5d-8085-8f0b7178b1a3',  -- respaldo 28/8 20:23:00
  '583450f2-2eb6-455a-8938-b7affff7dfc9',  -- plan     28/8 20:23:01 (0 res) ← trae el snapshot bueno
  '98cbe2c7-921d-4762-8681-e77dc335cfcb',  -- respaldo 31/8 12:42:21
  '03cf5063-c645-46f2-a120-378ae9c85dd1'   -- plan     31/8 12:42:22 (0 res)
);

-- 3. Reponer los 537 tubos desde el snapshot, con sus UUID originales.
INSERT INTO colmena_tubos (
  empresa_id, n_colmena, cod, medida_cm, medida_mm,
  serial, tubo_raiz_id, agregado_por_admin
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9',
  COALESCE(t->>'n_colmena', '-'),
  COALESCE(UPPER(TRIM(t->>'cod')), ''),
  COALESCE((t->>'medida_cm')::numeric, 0),
  COALESCE((t->>'medida_mm')::integer, 0),
  NULLIF(t->>'serial', ''),
  (t->>'tubo_raiz_id')::uuid,
  false
FROM planes_corte,
     jsonb_array_elements(snapshot_inventario) AS t
WHERE id = '583450f2-2eb6-455a-8938-b7affff7dfc9';

-- 4. El ingreso de cada tubo repuesto (y cura de tombstones de paso).
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9',
  (t->>'tubo_raiz_id')::uuid,
  COALESCE(t->>'n_colmena', '-'),
  COALESCE(UPPER(TRIM(t->>'cod')), ''),
  COALESCE((t->>'medida_cm')::numeric, 0),
  'ingreso',
  'recovery',
  'Recovery 2026-08-31: colmena borrada por confirmación vacía del optimizador el 2026-08-28 20:23; repuesta desde el snapshot del plan 583450f2.',
  'recovery_wipe_20260831'
FROM planes_corte,
     jsonb_array_elements(snapshot_inventario) AS t
WHERE id = '583450f2-2eb6-455a-8938-b7affff7dfc9';

-- 5. Bump del lock: una pestaña con estado del 28/8 (o de hoy en la mañana)
--    no puede sincronizar sobre la colmena recuperada.
UPDATE colmena_sync_state
SET last_sync_at = now(),
    last_sync_by = 'recovery_wipe_20260831'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9';

-- 6. Fuera los 4 planes vacíos (ya respaldados en el paso 2).
DELETE FROM planes_corte
WHERE id IN (
  '28907d45-a209-4d5d-8085-8f0b7178b1a3',
  '583450f2-2eb6-455a-8938-b7affff7dfc9',
  '98cbe2c7-921d-4762-8681-e77dc335cfcb',
  '03cf5063-c645-46f2-a120-378ae9c85dd1'
);

-- 7. Aserción final: o quedaron los 537, o no quedó nada de esto.
DO $$
DECLARE
  v_tubos integer;
BEGIN
  SELECT count(*) INTO v_tubos
  FROM colmena_tubos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9';

  IF v_tubos <> 537 THEN
    RAISE EXCEPTION 'ABORTADO: quedaron % tubos en vez de 537 — rollback completo.', v_tubos;
  END IF;
END $$;

COMMIT;

-- ── Verificación (correr después) ──
-- SELECT count(*) AS tubos,
--        count(DISTINCT cod) AS codigos,
--        count(*) FILTER (WHERE tubo_raiz_id IS NULL) AS sin_uuid
-- FROM colmena_tubos
-- WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9';
-- Esperado: 537 tubos, 38 códigos, 0 sin_uuid.
