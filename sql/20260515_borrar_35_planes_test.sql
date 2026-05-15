-- ============================================================================
-- LIMPIEZA: borrar 35 planes_corte de prueba (11 a 15 de mayo 2026)
-- Fecha: 2026-05-15
-- Empresa: 67c635a5-152c-4780-a066-23f5081175a9 (rolzzoia-produccion)
-- ============================================================================
--
-- Contexto:
--   Entre el 11 y el 15 de mayo se hicieron pruebas del optimizador. Por el bug
--   ya corregido en optimizador.html, cada prueba dejaba un plan_corte en la BD
--   aunque "fallara" y no descargara el Excel. El usuario (gerencia) confirmó
--   que los 35 planes de ese rango fueron TODOS pruebas — ninguno se cortó
--   físicamente.
--
-- Qué hace este script:
--   1. Respalda los 35 planes a la tabla `planes_corte_backup_20260515_test`.
--   2. Desvincula (plan_id = NULL) cualquier evento de tubos_historial que
--      apunte a estos planes (defensivo; normalmente ya vienen en null).
--   3. Borra los 35 planes_corte por ID explícito.
--   4. Verifica que se borraron exactamente los 35.
--   Todo dentro de UNA transacción: si cualquier paso no cuadra, hace ROLLBACK
--   automático y no se borra nada.
--
-- Qué NO toca:
--   · colmena_tubos (el inventario) — no se modifica.
--   · tubos_historial — los eventos se conservan; solo se desvincula el plan_id.
--
-- DESPUÉS de correr esto:
--   Volvé a cargar tu inventario limpio de 217 tubos en el optimizador. La BD
--   hoy tiene 218 (residuo de las pruebas), así que ese recargado es lo que
--   deja todo en su estado correcto.
--
-- Cómo deshacerlo (si hiciera falta):
--   INSERT INTO planes_corte
--   SELECT * FROM planes_corte_backup_20260515_test;
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 0 (opcional pero recomendado): PREVISUALIZAR antes de borrar.
-- Quitá el /* y */ de abajo, corré SOLO este SELECT. Debe devolver 35 filas,
-- todas que reconozcas como pruebas. Si ves 35 y todas son tuyas de prueba,
-- volvé a poner el /* */ y corré el bloque de LIMPIEZA de más abajo.
-- ════════════════════════════════════════════════════════════════════════════
/*
SELECT id, fecha, tipo, optimizer_email,
       jsonb_array_length(COALESCE(resultados, '[]'::jsonb)) AS n_resultados
FROM planes_corte
WHERE id IN (
    '42602183-cace-41bf-b632-a4cf3bb45da1','463e5b51-27ba-4c43-abf5-cc0ba28e23b0',
    'f2e50eb4-ad3b-4288-9e85-68519f4478d9','751ccb89-6402-4672-9cb3-d2c6023f4e96',
    'cdd35cc6-c0de-4374-854b-f9febe3728ff','254fb156-b6e6-48af-8b4f-00ceb148390d',
    '7878980f-1ab9-46ec-9ff2-806ec3b35e15','6f42312e-ead5-4e01-8654-ecdc4b24c4a9',
    'b8c42786-9220-425c-9d4f-9aa7f3a67c31','c0fbe872-e4d2-4b36-be12-26f391383ea1',
    '2486efe0-04cd-4a50-aea6-4fda0caace40','55671890-55a1-4f44-a25a-e2e98b628f04',
    '81731c69-ddbd-4b35-8c5c-981c0e13e9dc','4853b4b9-4f83-4b60-8410-59d7e40ceaa2',
    'f26e3f67-5a32-4e98-8a3a-c60e545964f4','3bdd3c06-3ec2-4383-a12d-775d0c21e884',
    'b9cf632e-ca1b-4e09-b6d1-52b3804f2a53','b58a723c-2444-46e4-9a99-9da1e4ccc2a0',
    'a2b74631-60a4-41df-9fbd-e594a076827b','34593958-f96e-4709-8415-001d34169a9e',
    '637118d0-d452-4d77-be67-8097e1d77cd6','96fb3882-592d-487d-b318-55b296b375ca',
    '26ad94b2-db67-457d-852e-7c2b72e7b7b1','4c73f320-b501-4a1a-bbdc-985d3e353dbc',
    '5f32f139-fdba-40d4-8767-3f910ff8a69b','5beeee6d-65ed-416b-8464-6b60b3fd3cce',
    'dbbac97f-57d0-4898-ae37-004970a4d65a','d22b58b1-e2f0-4c05-b3bb-a01a8d5f2c0a',
    'f387240b-dfb3-4de4-9f3b-99b72b4dbd76','2505dd9a-fb4a-4f50-b263-65688a532d8c',
    'afe50ae1-c12c-4f65-b558-49773d1fcb98','069392d7-fe65-4e95-87a4-3a00305ccd31',
    '4d8459fe-30ee-44ba-ac6a-ab0e0706cde4','1cb32723-447d-4df5-9afa-6f99f8d61601',
    'ea4cff93-711c-4fd4-a08e-66e85e03b558'
)
ORDER BY fecha DESC;
*/


-- ════════════════════════════════════════════════════════════════════════════
-- LIMPIEZA (transacción única — segura: si algo falla, ROLLBACK automático)
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Limpieza 35 planes de prueba — INICIADO ==='; END $$;

-- ─── PASO 1: Respaldo de los 35 planes ──────────────────────────────────────
DROP TABLE IF EXISTS planes_corte_backup_20260515_test;
CREATE TABLE planes_corte_backup_20260515_test AS
SELECT * FROM planes_corte
WHERE id IN (
    -- OT 2944 — pruebas del 15/05 (8 planes)
    '42602183-cace-41bf-b632-a4cf3bb45da1',  -- 15/05 13:54
    '463e5b51-27ba-4c43-abf5-cc0ba28e23b0',  -- 15/05 13:43
    'f2e50eb4-ad3b-4288-9e85-68519f4478d9',  -- 15/05 13:35
    '751ccb89-6402-4672-9cb3-d2c6023f4e96',  -- 15/05 13:06
    'cdd35cc6-c0de-4374-854b-f9febe3728ff',  -- 15/05 13:06 (respaldo)
    '254fb156-b6e6-48af-8b4f-00ceb148390d',  -- 15/05 12:58
    '7878980f-1ab9-46ec-9ff2-806ec3b35e15',  -- 15/05 12:45
    '6f42312e-ead5-4e01-8654-ecdc4b24c4a9',  -- 15/05 12:28
    -- OT 2952 — pruebas del 15/05 (4 planes)
    'b8c42786-9220-425c-9d4f-9aa7f3a67c31',  -- 15/05 12:25
    'c0fbe872-e4d2-4b36-be12-26f391383ea1',  -- 15/05 12:25 (respaldo)
    '2486efe0-04cd-4a50-aea6-4fda0caace40',  -- 15/05 12:22
    '55671890-55a1-4f44-a25a-e2e98b628f04',  -- 15/05 12:22 (respaldo)
    -- OT 2952 — pruebas del 14/05 (12 planes)
    '81731c69-ddbd-4b35-8c5c-981c0e13e9dc',  -- 14/05 21:35
    '4853b4b9-4f83-4b60-8410-59d7e40ceaa2',  -- 14/05 21:35 (respaldo)
    'f26e3f67-5a32-4e98-8a3a-c60e545964f4',  -- 14/05 21:30
    '3bdd3c06-3ec2-4383-a12d-775d0c21e884',  -- 14/05 21:30 (respaldo)
    'b9cf632e-ca1b-4e09-b6d1-52b3804f2a53',  -- 14/05 21:24
    'b58a723c-2444-46e4-9a99-9da1e4ccc2a0',  -- 14/05 21:14
    'a2b74631-60a4-41df-9fbd-e594a076827b',  -- 14/05 21:14 (respaldo)
    '34593958-f96e-4709-8415-001d34169a9e',  -- 14/05 21:13
    '637118d0-d452-4d77-be67-8097e1d77cd6',  -- 14/05 21:13 (respaldo)
    '96fb3882-592d-487d-b318-55b296b375ca',  -- 14/05 21:11 (respaldo)
    '26ad94b2-db67-457d-852e-7c2b72e7b7b1',  -- 14/05 20:59
    '4c73f320-b501-4a1a-bbdc-985d3e353dbc',  -- 14/05 20:59 (respaldo)
    -- OT 2954 — pruebas del 13/05 (3 planes)
    '5f32f139-fdba-40d4-8767-3f910ff8a69b',  -- 13/05 15:16 (respaldo)
    '5beeee6d-65ed-416b-8464-6b60b3fd3cce',  -- 13/05 15:10
    'dbbac97f-57d0-4898-ae37-004970a4d65a',  -- 13/05 15:10 (respaldo)
    -- OT 2956 / 2955 — pruebas del 12/05 (4 planes)
    'd22b58b1-e2f0-4c05-b3bb-a01a8d5f2c0a',  -- 12/05 17:55 (OT 2956)
    'f387240b-dfb3-4de4-9f3b-99b72b4dbd76',  -- 12/05 17:55 (OT 2956, respaldo)
    '2505dd9a-fb4a-4f50-b263-65688a532d8c',  -- 12/05 13:04 (OT 2955)
    'afe50ae1-c12c-4f65-b558-49773d1fcb98',  -- 12/05 13:04 (OT 2955, respaldo)
    -- OT 2952 / 2951 — pruebas del 11/05 (4 planes)
    '069392d7-fe65-4e95-87a4-3a00305ccd31',  -- 11/05 19:19 (OT 2952)
    '4d8459fe-30ee-44ba-ac6a-ab0e0706cde4',  -- 11/05 19:19 (OT 2952, respaldo)
    '1cb32723-447d-4df5-9afa-6f99f8d61601',  -- 11/05 16:49 (OT 2951)
    'ea4cff93-711c-4fd4-a08e-66e85e03b558'   -- 11/05 16:49 (OT 2951, respaldo)
);

DO $$
DECLARE v_backup integer;
BEGIN
  SELECT COUNT(*) INTO v_backup FROM planes_corte_backup_20260515_test;
  RAISE NOTICE 'Paso 1: % planes respaldados en planes_corte_backup_20260515_test', v_backup;
  IF v_backup <> 35 THEN
    RAISE EXCEPTION 'Esperaba respaldar 35 planes pero encontré %. Abortando (ROLLBACK) — alguno ya no existe o la lista cambió.', v_backup;
  END IF;
END $$;

-- ─── PASO 2: Desvincular eventos de historial (defensivo) ───────────────────
-- Si algún evento de tubos_historial apuntara a estos planes, lo desvinculamos
-- (plan_id = NULL) para que el DELETE no falle ni arrastre eventos por cascada.
-- Lo normal es que esto sea 0 (los eventos se crean antes que el plan).
DO $$
DECLARE v_unlinked integer;
BEGIN
  UPDATE tubos_historial
  SET plan_id = NULL
  WHERE plan_id IN (SELECT id FROM planes_corte_backup_20260515_test);
  GET DIAGNOSTICS v_unlinked = ROW_COUNT;
  RAISE NOTICE 'Paso 2: % evento(s) de historial desvinculados (lo normal es 0)', v_unlinked;
END $$;

-- ─── PASO 3: Borrar los 35 planes ───────────────────────────────────────────
DO $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM planes_corte
  WHERE id IN (SELECT id FROM planes_corte_backup_20260515_test);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Paso 3: % planes_corte borrados', v_deleted;
  IF v_deleted <> 35 THEN
    RAISE EXCEPTION 'Esperaba borrar 35 planes pero borré %. Abortando (ROLLBACK).', v_deleted;
  END IF;
END $$;

-- ─── PASO 4: Verificación ───────────────────────────────────────────────────
DO $$
DECLARE
  v_restantes_de_los_35 integer;
  v_total_empresa       integer;
BEGIN
  SELECT COUNT(*) INTO v_restantes_de_los_35 FROM planes_corte
  WHERE id IN (SELECT id FROM planes_corte_backup_20260515_test);

  IF v_restantes_de_los_35 <> 0 THEN
    RAISE EXCEPTION 'Quedaron % de los 35 planes sin borrar. Abortando (ROLLBACK).', v_restantes_de_los_35;
  END IF;

  SELECT COUNT(*) INTO v_total_empresa FROM planes_corte
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

  RAISE NOTICE 'Verificación OK: los 35 planes de prueba fueron borrados.';
  RAISE NOTICE 'Info: planes_corte que quedan en total para la empresa: %', v_total_empresa;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Limpieza 35 planes de prueba — COMPLETADO ==='; END $$;

COMMIT;


-- ─── Smoke test (correr aparte, después del COMMIT) ─────────────────────────
-- Debe devolver 0 filas:
-- SELECT id, fecha, tipo FROM planes_corte
-- WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--   AND fecha >= '2026-05-11'::date;
