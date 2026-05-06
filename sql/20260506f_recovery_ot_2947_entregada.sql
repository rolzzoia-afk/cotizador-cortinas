-- ============================================================================
-- Recovery: OT 2947 cortada y entregada — agregar events del plan activo
-- Fecha: 2026-05-06
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Postventa generó OT 2947 a las 15:13 UTC del 2026-05-06. Se crearon 2
--   filas en planes_corte (por diseño: una con tipo='respaldo' como snapshot
--   pre-plan, otra con tipo=NULL como plan activo). El plan activo no
--   sincronizó events a tubos_historial — el bug Capa 1.5 NO lo agarró
--   porque postventa estaba usando una versión cacheada del HTML del
--   optimizador sin Capa 1.5.
--
-- Confirmación del taller (2026-05-06):
--   - OT 2947: cortada y ENTREGADA al cliente. No se puede borrar el plan.
--
-- Acción de recovery:
--   1. Insertar 4 events para el plan activo (6e7f6a94):
--      - 1 corte (item 1: A31 E66 220.7cm)
--      - 1 merma (item 1: 2.7cm desechada porque sobrante < MERMA_MIN)
--      - 1 corte (item 2: A28 E64 220.3cm)
--      - 1 sobrante (item 2: A28 E64 196.3cm a colmena)
--      El trigger trg_auto_remove_consumed_tube auto-borra los tubos cortados.
--   2. INSERT 1 sobrante a colmena_tubos (A28 E64 196.3cm) con nuevo UUID.
--   3. NO borrar planes_corte (la OT está entregada, queda como registro).
--   4. Update colmena_sync_state.
--
-- Estado esperado post-recovery:
--   colmena_tubos: 153 - 2 + 1 = 152 tubos
--   tubos_historial: +2 cortes + 1 merma + 1 sobrante con fuente='recovery_ot_2947'
--   Banner: vacío (la OT 2947 ya tendrá events, sale del filtro de huérfanos)
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2947 (entregada) — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Cortes — 2 tubos del plan activo que están en colmena_tubos.
--    El trigger trg_auto_remove_consumed_tube auto-borra los tubos.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, ot, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm,
  'corte', '2947', 'sistema',
  'Recovery 2026-05-06: corte de OT 2947 (sync original falló por cache stale del optimizador)',
  'recovery_ot_2947'
FROM planes_corte pc,
     jsonb_array_elements(pc.resultados) r,
     colmena_tubos ct
WHERE pc.id = '6e7f6a94-045c-472f-b722-87862d3b7bca'::uuid
  AND ct.tubo_raiz_id::text = r->'resultado'->>'tubo_raiz_id'
  AND ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$
DECLARE v_cortes integer;
BEGIN
  SELECT COUNT(*) INTO v_cortes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2947' AND evento = 'corte';
  IF v_cortes <> 2 THEN
    RAISE EXCEPTION 'Esperaba 2 cortes, registré % — ABORTAR', v_cortes;
  END IF;
  RAISE NOTICE 'Step 1: % cortes registrados', v_cortes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Merma — el item 1 tiene es_desecho=true con sobrante 2.7cm (descartada).
--    Solo registramos el evento (no afecta inventario; el tubo ya fue cortado).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, ot, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  (r->'resultado'->>'tubo_raiz_id')::uuid,
  r->'resultado'->>'colmena',
  COALESCE(r->'resultado'->>'codigo_reemplazo', r->'resultado'->>'codigo'),
  (r->'resultado'->>'sobrante_cm')::numeric,
  'merma', '2947', 'sistema',
  'Recovery 2026-05-06: merma de OT 2947 (sobrante < mínimo, descartado)',
  'recovery_ot_2947'
FROM planes_corte pc, jsonb_array_elements(pc.resultados) r
WHERE pc.id = '6e7f6a94-045c-472f-b722-87862d3b7bca'::uuid
  AND COALESCE((r->'resultado'->>'es_desecho')::boolean, false) = true
  AND (r->'resultado'->>'sobrante_cm')::numeric > 0;

DO $$
DECLARE v_mermas integer;
BEGIN
  SELECT COUNT(*) INTO v_mermas FROM tubos_historial
   WHERE fuente = 'recovery_ot_2947' AND evento = 'merma';
  RAISE NOTICE 'Step 2: % mermas registradas', v_mermas;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Sobrante — item 2 tiene sobrante 196.3cm que va a colmena A28.
--    INSERT a colmena_tubos + INSERT evento sobrante.
-- ─────────────────────────────────────────────────────────────────────────────
WITH sobrantes_a_crear AS (
  SELECT
    r->'resultado'->>'colmena_sobrante' AS n_colmena,
    COALESCE(r->'resultado'->>'codigo_reemplazo', r->'resultado'->>'codigo') AS cod,
    (r->'resultado'->>'sobrante_cm')::numeric AS medida_cm,
    gen_random_uuid() AS raiz_id
  FROM planes_corte pc, jsonb_array_elements(pc.resultados) r
  WHERE pc.id = '6e7f6a94-045c-472f-b722-87862d3b7bca'::uuid
    AND r->'resultado'->>'colmena_sobrante' IS NOT NULL
    AND r->'resultado'->>'colmena_sobrante' <> 'MESA'
    AND COALESCE((r->'resultado'->>'es_desecho')::boolean, false) = false
    AND COALESCE((r->'resultado'->>'es_intermedio')::boolean, false) = false
    AND (r->'resultado'->>'sobrante_cm')::numeric > 0
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
  FROM sobrantes_a_crear
  RETURNING tubo_raiz_id
)
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, ot, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  s.raiz_id, s.n_colmena, s.cod, s.medida_cm,
  'sobrante', '2947', 'sistema',
  'Recovery 2026-05-06: sobrante de OT 2947',
  'recovery_ot_2947'
FROM sobrantes_a_crear s;

DO $$
DECLARE v_sobrantes integer;
BEGIN
  SELECT COUNT(*) INTO v_sobrantes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2947' AND evento = 'sobrante';
  RAISE NOTICE 'Step 3: % sobrantes agregados a colmena_tubos', v_sobrantes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Update colmena_sync_state.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, NOW(), 'recovery_ot_2947')
ON CONFLICT (empresa_id) DO UPDATE SET
  last_sync_at = NOW(),
  last_sync_by = 'recovery_ot_2947';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Subir opt_version_minima a 4.3 (para forzar reload del HTML nuevo).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO configuracion (empresa_id, clave, valor)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'opt_version_minima', '4.3')
ON CONFLICT (empresa_id, clave) DO UPDATE SET valor = EXCLUDED.valor;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Verificación final.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_total integer;
        v_huerfanos integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  SELECT COUNT(*) INTO v_huerfanos
    FROM detectar_planes_huerfanos('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 7);
  RAISE NOTICE 'Step 6: ÉXITO — inventario % tubos · huérfanos restantes en ventana 7d: %',
    v_total, v_huerfanos;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2947 — COMPLETADO ==='; END $$;

COMMIT;
