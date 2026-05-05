-- ============================================================================
-- Recovery: OT 2939 cortada físicamente sin sync exitoso
-- Fecha: 2026-05-05
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   El optimizador del taller tenía cargado en cache el inventario PRE-wipe
--   (de las 16:19 cuando se hizo la carga inicial del taller). Cuando los
--   operarios intentaron guardar planes a las 16:28, 16:46 y 17:54, la
--   inserción a planes_corte funcionó (no pasa por sync), pero la llamada
--   a sync_colmena_tubos falló por:
--     - colmena_sync_state.last_sync_at era distinto al expected_sync_at
--       cacheado en el HTML
--     - El guard de borrado masivo (>10 tubos y >10% del inventario)
--       rechazó el sync porque la diferencia era enorme entre el cache
--       (~202 tubos) y el nuevo estado pretendido
--
--   Resultado: planes guardados en planes_corte sin eventos en
--   tubos_historial y sin descuento en colmena_tubos.
--
-- Confirmaciones del taller:
--   - OT 2939: cortada físicamente. Tubos sacados de las colmenas como
--     decía el plan.
--   - OT 2941: NO cortada (los operarios vieron errores y abandonaron).
--
-- Acción de recovery:
--   1. Para OT 2939, aplicar 21 eventos 'corte' (uno por cada CORTAR del
--      plan que vino de una colmena que tenemos en inventario). El trigger
--      trg_auto_remove_consumed_tube auto-borra los tubos.
--   2. Insertar 13 sobrantes que el plan envió a colmenas (acción
--      GUARDAR SOBRANTE en el plan).
--   3. Borrar los planes_corte huérfanos de OT 2939 y 2941.
--   4. Actualizar colmena_sync_state para destrabar el optimizador.
--
-- Cortes que NO afectan colmena_tubos (tubos vírgenes de 5.78m de bodega):
--   - L01 E62 578.0
--   - L03 E62 578.0 (lote 1, paquete 59, serial 1)
--   - L02 E62 578.0 (lote 1, serial 5)
--   - A27/A28/A29 con 578.0 E13/E18 (no estaban en la planilla del taller
--     que se cargó como baseline; eran tubos vírgenes que el optimizador
--     trató como si vinieran de esas colmenas)
--   Estos NO se descuentan porque no estaban en colmena_tubos.
--   Los sobrantes que generaron SÍ se agregan a colmena_tubos.
--
-- Estado esperado post-recovery:
--   colmena_tubos: 165 - 21 + 13 = 157 tubos
--   tubos_historial: +21 eventos 'corte' + +13 eventos 'sobrante'
--                    + +21 'eliminado' auto-logeados por el trigger del DELETE
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2939 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Aplicar 'corte' para los 21 tubos consumidos del colmena.
--    El trigger trg_auto_remove_consumed_tube auto-borra de colmena_tubos.
-- ─────────────────────────────────────────────────────────────────────────────
WITH consumos(n_colmena, cod, medida_cm) AS (
  VALUES
    -- LIVING A DER-G1
    ('L02', 'E02', 344.1::numeric),
    ('A20', 'E13', 209.0::numeric),
    ('B3',  'E62', 212.7::numeric),
    -- LIVING A IZQ-G1
    ('A34', 'E02', 202.4::numeric),
    ('A20', 'E13', 198.2::numeric),
    -- LIVING A CENT-G1
    ('L02', 'E02', 473.4::numeric),
    -- LIVING B-G1
    ('A35', 'E02', 102.5::numeric),
    ('A14', 'E18', 99.5::numeric),
    ('A20', 'E13', 101.2::numeric),
    ('B3',  'E62', 102.6::numeric),
    -- OFI DER-G3
    ('A31', 'E66', 166.1::numeric),
    -- SALA-G2
    ('A34', 'E02', 187.2::numeric),
    ('A14', 'E18', 185.5::numeric),
    ('A20', 'E13', 186.2::numeric),
    -- PPAL A-G4
    ('L02', 'E66', 319.7::numeric),
    -- PPAL DER-G4
    ('A35', 'E02', 177.5::numeric),
    ('A20', 'E13', 181.0::numeric),
    ('B3',  'E62', 183.0::numeric),
    -- PPAL IZQ-G4
    ('A35', 'E02', 224.6::numeric),
    ('A20', 'E13', 244.2::numeric),
    ('B3',  'E62', 226.9::numeric)
),
to_consume AS (
  SELECT
    c.n_colmena, c.cod, c.medida_cm,
    (SELECT tubo_raiz_id
       FROM colmena_tubos
      WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
        AND n_colmena = c.n_colmena
        AND cod       = c.cod
        AND medida_cm = c.medida_cm
      ORDER BY created_at LIMIT 1
    ) AS tubo_raiz_id_matched
  FROM consumos c
)
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, ot, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  tubo_raiz_id_matched, n_colmena, cod, medida_cm,
  'corte', '2939', 'sistema',
  'Recovery 2026-05-05: corte de OT 2939 (sync original falló por cache stale)',
  'recovery_ot_2939'
FROM to_consume
WHERE tubo_raiz_id_matched IS NOT NULL;

DO $$
DECLARE v_cortes integer; v_no_match integer;
BEGIN
  SELECT COUNT(*) INTO v_cortes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2939' AND evento = 'corte';
  v_no_match := 21 - v_cortes;
  IF v_no_match > 0 THEN
    RAISE EXCEPTION 'Faltó match para % consumos (esperaba 21, registré %)', v_no_match, v_cortes;
  END IF;
  RAISE NOTICE 'Step 1: % cortes registrados (trigger auto-borró los tubos)', v_cortes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Insertar los 13 sobrantes a colmena_tubos
-- ─────────────────────────────────────────────────────────────────────────────
WITH sobrantes(n_colmena, cod, medida_cm, raiz_id) AS (
  VALUES
    ('A34', 'E02', 141.4::numeric, gen_random_uuid()),
    ('A31', 'E66', 148.4::numeric, gen_random_uuid()),
    ('A35', 'E02', 197.5::numeric, gen_random_uuid()),
    ('A14', 'E18', 131.7::numeric, gen_random_uuid()),
    ('A20', 'E13', 132.3::numeric, gen_random_uuid()),
    ('B3',  'E62', 130.9::numeric, gen_random_uuid()),
    ('B3',  'E62', 186.0::numeric, gen_random_uuid()),
    ('A20', 'E13', 418.5::numeric, gen_random_uuid()),
    ('B3',  'E62', 416.2::numeric, gen_random_uuid()),
    ('A35', 'E02', 134.1::numeric, gen_random_uuid()),
    ('A14', 'E18', 328.1::numeric, gen_random_uuid()),
    ('A20', 'E13', 154.2::numeric, gen_random_uuid()),
    ('B3',  'E62', 134.6::numeric, gen_random_uuid())
),
ins_ct AS (
  INSERT INTO colmena_tubos (
    empresa_id, n_colmena, cod, medida_cm, medida_mm,
    tubo_raiz_id, agregado_por_admin
  )
  SELECT
    '67c635a5-152c-4780-a066-23f5081175a9'::uuid,
    n_colmena, cod, medida_cm, (medida_cm * 10)::integer,
    raiz_id, false
  FROM sobrantes
  RETURNING tubo_raiz_id
)
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, ot, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  s.raiz_id, s.n_colmena, s.cod, s.medida_cm,
  'sobrante', '2939', 'sistema',
  'Recovery 2026-05-05: sobrante de OT 2939',
  'recovery_ot_2939'
FROM sobrantes s;

DO $$
DECLARE v_sobrantes integer;
BEGIN
  SELECT COUNT(*) INTO v_sobrantes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2939' AND evento = 'sobrante';
  IF v_sobrantes <> 13 THEN
    RAISE EXCEPTION 'Esperaba 13 sobrantes, hay %', v_sobrantes;
  END IF;
  RAISE NOTICE 'Step 2: % sobrantes agregados a colmena_tubos', v_sobrantes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Borrar los planes_corte huérfanos de OT 2939 y OT 2941
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM planes_corte
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND fecha > NOW() - INTERVAL '6 hours'
  AND ordenes->0->>'ot' IN ('2939', '2941');

DO $$
DECLARE v_borrados integer;
BEGIN
  GET DIAGNOSTICS v_borrados = ROW_COUNT;
  RAISE NOTICE 'Step 3: % planes huérfanos borrados', v_borrados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Actualizar colmena_sync_state para destrabar el optimizador
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, NOW(), 'recovery_ot_2939')
ON CONFLICT (empresa_id) DO UPDATE SET
  last_sync_at = NOW(),
  last_sync_by = 'recovery_ot_2939';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Verificación final: 157 tubos = 165 inicial - 21 consumos + 13 sobrantes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_total integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  IF v_total <> 157 THEN
    RAISE EXCEPTION 'Esperaba 157 tubos finales (165 - 21 + 13), hay %', v_total;
  END IF;
  RAISE NOTICE 'Step 5: ÉXITO — % tubos en inventario (165 - 21 cortes + 13 sobrantes)', v_total;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2939 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Verificaciones manuales post-COMMIT
-- ============================================================================
-- 1. Total de tubos:
--    SELECT COUNT(*) FROM colmena_tubos
--     WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
--    -- Esperado: 157
--
-- 2. Eventos del recovery:
--    SELECT evento, COUNT(*) FROM tubos_historial
--     WHERE fuente = 'recovery_ot_2939' GROUP BY evento;
--    -- Esperado: corte=21, sobrante=13
--
-- 3. Distribución por colmena:
--    SELECT n_colmena, cod, COUNT(*)
--      FROM colmena_tubos
--     WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--    GROUP BY n_colmena, cod ORDER BY n_colmena, cod;
--
-- 4. Avisar a operarios que pueden volver a usar el optimizador (recargando
--    la página primero, no usando una pestaña con cache stale).
-- ============================================================================
