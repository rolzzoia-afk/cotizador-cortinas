-- ============================================================================
-- Recovery: OT 2934 cortada físicamente — plan activo 14:28 local 2026-05-06
-- Fecha: 2026-05-06
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Después del recovery + cleanup de los huérfanos previos de OT 2934
--   (PR #51, planes 165faf06 + 24ba044d a las 13:11/13:12 local), postventa
--   guardó OTRO plan de la misma OT a las 14:28 local. Mismo patrón:
--     - Plan activo:    1ed02547-5a30-4eff-a52c-53e83dc329ca (tipo NULL)
--     - Plan snapshot:  3ca09208-d1a5-4a35-9725-a9bbaa7d3048 (tipo='respaldo')
--     - 20 cortes / 20 órdenes
--   Sin events en tubos_historial → banner Capa 3 lo detectó.
--
--   Capa 4 (PR #52) no agarró este plan probablemente porque postventa estaba
--   con cache stale del HTML pre-4.4 al momento del guardado.
--
-- Confirmación del taller (2026-05-06):
--   - OT 2934: cortada físicamente. No re-cortar.
--
-- Acción de recovery (mismo patrón que OT 2947, PR #48):
--   1. Insertar cortes para los tubos del plan activo que están en colmena_tubos.
--      El trigger trg_auto_remove_consumed_tube auto-borra los tubos.
--   2. Insertar mermas (items con es_desecho=true y sobrante_cm>0).
--   3. Insertar sobrantes a colmena_tubos + evento (items con colmena_sobrante).
--   4. Update colmena_sync_state.
--   5. NO borrar planes_corte — quedan como registro y para que postventa vea
--      que ya hay plan activo de esa OT (no debería re-optimizar).
--
-- Estado esperado post-recovery:
--   tubos_historial: +N cortes + N mermas + N sobrantes con fuente='recovery_ot_2934_plan_14_28'
--   Banner: vacío (la OT 2934 ya tendrá events, sale del filtro de huérfanos)
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2934 plan 14:28 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Cortes — tubos del plan activo que están en colmena_tubos.
--    El trigger trg_auto_remove_consumed_tube auto-borra los tubos.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, ot, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm,
  'corte', '2934', 'sistema',
  'Recovery 2026-05-06: corte de OT 2934 (sync original falló por cache stale del optimizador, plan 14:28)',
  'recovery_ot_2934_plan_14_28'
FROM planes_corte pc,
     jsonb_array_elements(pc.resultados) r,
     colmena_tubos ct
WHERE pc.id = '1ed02547-5a30-4eff-a52c-53e83dc329ca'::uuid
  AND ct.tubo_raiz_id::text = r->'resultado'->>'tubo_raiz_id'
  AND ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$
DECLARE v_cortes integer;
BEGIN
  SELECT COUNT(*) INTO v_cortes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2934_plan_14_28' AND evento = 'corte';
  RAISE NOTICE 'Step 1: % cortes registrados', v_cortes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Mermas — items con es_desecho=true y sobrante_cm > 0 (descarte registrado).
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
  'merma', '2934', 'sistema',
  'Recovery 2026-05-06: merma de OT 2934 (sobrante < mínimo, descartado)',
  'recovery_ot_2934_plan_14_28'
FROM planes_corte pc, jsonb_array_elements(pc.resultados) r
WHERE pc.id = '1ed02547-5a30-4eff-a52c-53e83dc329ca'::uuid
  AND COALESCE((r->'resultado'->>'es_desecho')::boolean, false) = true
  AND (r->'resultado'->>'sobrante_cm')::numeric > 0;

DO $$
DECLARE v_mermas integer;
BEGIN
  SELECT COUNT(*) INTO v_mermas FROM tubos_historial
   WHERE fuente = 'recovery_ot_2934_plan_14_28' AND evento = 'merma';
  RAISE NOTICE 'Step 2: % mermas registradas', v_mermas;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Sobrantes — items con colmena_sobrante (no MESA, no desecho, no intermedio).
--    INSERT a colmena_tubos con nuevo UUID + INSERT evento sobrante.
-- ─────────────────────────────────────────────────────────────────────────────
WITH sobrantes_a_crear AS (
  SELECT
    r->'resultado'->>'colmena_sobrante' AS n_colmena,
    COALESCE(r->'resultado'->>'codigo_reemplazo', r->'resultado'->>'codigo') AS cod,
    (r->'resultado'->>'sobrante_cm')::numeric AS medida_cm,
    gen_random_uuid() AS raiz_id
  FROM planes_corte pc, jsonb_array_elements(pc.resultados) r
  WHERE pc.id = '1ed02547-5a30-4eff-a52c-53e83dc329ca'::uuid
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
  'sobrante', '2934', 'sistema',
  'Recovery 2026-05-06: sobrante de OT 2934',
  'recovery_ot_2934_plan_14_28'
FROM sobrantes_a_crear s;

DO $$
DECLARE v_sobrantes integer;
BEGIN
  SELECT COUNT(*) INTO v_sobrantes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2934_plan_14_28' AND evento = 'sobrante';
  RAISE NOTICE 'Step 3: % sobrantes agregados a colmena_tubos', v_sobrantes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Update colmena_sync_state.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, NOW(), 'recovery_ot_2934_plan_14_28')
ON CONFLICT (empresa_id) DO UPDATE SET
  last_sync_at = NOW(),
  last_sync_by = 'recovery_ot_2934_plan_14_28';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Verificación final.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_total integer;
        v_huerfanos integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  SELECT COUNT(*) INTO v_huerfanos
    FROM detectar_planes_huerfanos('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 7);
  RAISE NOTICE 'Step 5: inventario % tubos · huérfanos restantes en ventana 7d: %',
    v_total, v_huerfanos;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2934 plan 14:28 — COMPLETADO ==='; END $$;

COMMIT;
