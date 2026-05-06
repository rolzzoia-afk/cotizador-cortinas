-- ============================================================================
-- Recovery: OT 2941 cortada físicamente sin sync exitoso
--           + borrado de planes huérfanos OT 2935 y OT 2947 (no cortadas)
-- Fecha: 2026-05-06
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto (ver memoria project_incidente_recovery_2026_05_05.md):
--   El 2026-05-05, post-wipe + carga inicial del taller, el optimizador con
--   cache stale guardó 3 planes huérfanos (OT 2935, 2941, 2947) sin lograr
--   el sync con tubos_historial. El recovery de OT 2939 (PR #37) limpió
--   parte del incidente, pero estos 3 planes quedaron como huérfanos.
--
-- Confirmaciones del taller (2026-05-06):
--   - OT 2941: cortada físicamente. Plan completo (40 cortes) ejecutado.
--   - OT 2935: NO cortada.
--   - OT 2947: NO cortada.
--
-- Acción de recovery:
--   1. Para OT 2941, parsear el JSON de `resultados` y aplicar:
--      a. 14 eventos `corte` para los tubo_raiz_id que aún están en
--         colmena_tubos (el trigger trg_auto_remove_consumed_tube los borra).
--      b. 14 eventos `sobrante` + INSERT a colmena_tubos para los sobrantes
--         que el plan dirigía a colmenas reales (no MESA, no desecho, no
--         intermedio). Incluye 3 a una colmena nueva A1.
--   2. Borrar los 3 planes huérfanos (OT 2935, 2941, 2947).
--   3. Update colmena_sync_state para destrabar el optimizador.
--
-- Cortes que NO afectan colmena_tubos (descartados de oficio):
--   - Cortes de fuente reemplazo/tubo_nuevo desde tubos vírgenes 5.79m
--     (no estaban en colmena_tubos, no hay nada que descontar).
--   - Cortes desde "MESA" (sobrantes intermedios en mesa de trabajo).
--
-- Estado esperado post-recovery:
--   colmena_tubos: 157 (mismo que antes — 14 cortes - 14 sobrantes = 0 neto)
--   tubos_historial: +14 cortes + 14 sobrantes con fuente='recovery_ot_2941'
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2941 + borrado 2935/2947 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Aplicar 'corte' para los tubos del plan OT 2941 que aún están en
--    colmena_tubos. El trigger trg_auto_remove_consumed_tube auto-borra.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, ot, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm,
  'corte', '2941', 'sistema',
  'Recovery 2026-05-06: corte de OT 2941 (sync original falló por cache stale)',
  'recovery_ot_2941'
FROM planes_corte pc,
     jsonb_array_elements(pc.resultados) r,
     colmena_tubos ct
WHERE pc.id = 'a7012411-a2f7-4289-bccd-5568504c3ac9'::uuid
  AND ct.tubo_raiz_id::text = r->'resultado'->>'tubo_raiz_id'
  AND ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$
DECLARE v_cortes integer;
BEGIN
  SELECT COUNT(*) INTO v_cortes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2941' AND evento = 'corte';
  IF v_cortes <> 14 THEN
    RAISE EXCEPTION 'Esperaba 14 cortes, registré % — ABORTAR', v_cortes;
  END IF;
  RAISE NOTICE 'Step 1: % cortes registrados (trigger auto-borró los tubos)', v_cortes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Insertar sobrantes a colmena_tubos + eventos de historial.
--    Filtro: solo los sobrantes que van a una colmena REAL (no MESA),
--    no son desecho, no son intermedio.
-- ─────────────────────────────────────────────────────────────────────────────
WITH sobrantes_a_crear AS (
  SELECT
    r->'resultado'->>'colmena_sobrante' AS n_colmena,
    COALESCE(
      r->'resultado'->>'codigo_reemplazo',
      r->'resultado'->>'codigo'
    ) AS cod,
    (r->'resultado'->>'sobrante_cm')::numeric AS medida_cm,
    gen_random_uuid() AS raiz_id
  FROM planes_corte pc, jsonb_array_elements(pc.resultados) r
  WHERE pc.id = 'a7012411-a2f7-4289-bccd-5568504c3ac9'::uuid
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
  'sobrante', '2941', 'sistema',
  'Recovery 2026-05-06: sobrante de OT 2941',
  'recovery_ot_2941'
FROM sobrantes_a_crear s;

DO $$
DECLARE v_sobrantes integer;
BEGIN
  SELECT COUNT(*) INTO v_sobrantes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2941' AND evento = 'sobrante';
  -- Esperamos 14 según el query previo, pero permitimos rango por si la
  -- imagen del CSV cortó un row. Si está fuera de [12,16], algo raro.
  IF v_sobrantes < 12 OR v_sobrantes > 16 THEN
    RAISE EXCEPTION 'Sobrantes fuera de rango esperado [12,16]: % — ABORTAR', v_sobrantes;
  END IF;
  RAISE NOTICE 'Step 2: % sobrantes agregados a colmena_tubos', v_sobrantes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Borrar los planes huérfanos (OT 2935, 2941, 2947).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_borrados integer;
BEGIN
  DELETE FROM planes_corte
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND id IN (
      'a7012411-a2f7-4289-bccd-5568504c3ac9'::uuid,  -- OT 2941
      '60978dd0-7dc3-41dd-a30d-200f5adb10c8'::uuid,  -- OT 2935
      '99dd4b4e-238d-49d2-9165-5f0a7303e53a'::uuid   -- OT 2947
    );
  GET DIAGNOSTICS v_borrados = ROW_COUNT;
  IF v_borrados <> 3 THEN
    RAISE EXCEPTION 'Esperaba borrar 3 planes huérfanos, borré % — ABORTAR', v_borrados;
  END IF;
  RAISE NOTICE 'Step 3: % planes huérfanos borrados', v_borrados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Actualizar colmena_sync_state para destrabar el optimizador.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, NOW(), 'recovery_ot_2941')
ON CONFLICT (empresa_id) DO UPDATE SET
  last_sync_at = NOW(),
  last_sync_by = 'recovery_ot_2941';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Verificación final del inventario.
--    Esperado: 157 tubos (mismo que antes, porque 14 cortes - 14 sobrantes = 0 neto)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_total integer;
        v_huerfanos integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  SELECT COUNT(*) INTO v_huerfanos
    FROM detectar_planes_huerfanos('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 7);
  RAISE NOTICE 'Step 5: ÉXITO — inventario final % tubos · planes huérfanos restantes: %',
    v_total, v_huerfanos;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2941 — COMPLETADO ==='; END $$;

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
--     WHERE fuente = 'recovery_ot_2941' GROUP BY evento;
--    -- Esperado: corte=14, sobrante=14 (o el número que dio Step 2)
--
-- 3. Banner de huérfanos en /admin debería estar VACÍO (0 huérfanos).
--    Si quedan huérfanos en el banner del 2026-04-29 (OT 2929, 2926), son
--    históricos de otro incidente y se manejan por separado.
--
-- 4. Distribución por colmena (esperado A28: 40, A31: 12, A34: 0, A35: 7,
--    L02: 3, A1: 3, otras sin cambio):
--    SELECT n_colmena, COUNT(*) FROM colmena_tubos
--     WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--    GROUP BY n_colmena ORDER BY n_colmena;
-- ============================================================================
