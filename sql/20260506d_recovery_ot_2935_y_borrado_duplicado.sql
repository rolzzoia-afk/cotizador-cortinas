-- ============================================================================
-- Recovery: OT 2935 cortada físicamente sin sync exitoso (2do incidente)
--           + borrado del duplicado huérfano stale-cache
-- Fecha: 2026-05-06
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Postventa regeneró OT 2935 a las 14:20 del 2026-05-06. Se generaron 2
--   planes huérfanos:
--     - 37c91725-d746-4b39-8665-e4d1c44d9112 (14:20:50): cache stale,
--       0 tubos referenciados existen en colmena_tubos. NO aplicar — borrar.
--     - 7324df65-5a0b-414f-a012-1f4658a9d8a4 (14:20:55): cache fresh,
--       8 tubos referenciados existen. ESTE es el que el taller cortó.
--
--   Causa raíz: bug "_colmenaPreSyncOK = true" en el optimizador legacy.
--   Cuando postventa hizo Calcular antes de Confirmar, la rama del if no
--   abortaba si insertarEventosHistorialDirecto fallaba — solo loggeaba
--   warn. Capa 1.5 (PR #44) cierra ese agujero.
--
-- Acción de recovery:
--   1. Aplicar el plan 7324df65: 8 eventos `corte` para los tubos en
--      colmena_tubos (trigger trg_auto_remove_consumed_tube los borra)
--      + sobrantes a colmenas reales (excluye MESA, desechos, intermedios).
--   2. Borrar AMBOS planes huérfanos.
--   3. Update colmena_sync_state.
--
-- Estado esperado post-recovery:
--   colmena_tubos: 157 - 8 + N_sobrantes (N depende del JSON del plan)
--   tubos_historial: +8 cortes + N sobrantes con fuente='recovery_ot_2935'
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2935 (plan 7324df65) — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Aplicar 8 cortes para los tubos del plan que están en colmena_tubos.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, ot, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm,
  'corte', '2935', 'sistema',
  'Recovery 2026-05-06: corte de OT 2935 (sync original falló por bug _colmenaPreSyncOK)',
  'recovery_ot_2935'
FROM planes_corte pc,
     jsonb_array_elements(pc.resultados) r,
     colmena_tubos ct
WHERE pc.id = '7324df65-5a0b-414f-a012-1f4658a9d8a4'::uuid
  AND ct.tubo_raiz_id::text = r->'resultado'->>'tubo_raiz_id'
  AND ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$
DECLARE v_cortes integer;
BEGIN
  SELECT COUNT(*) INTO v_cortes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2935' AND evento = 'corte';
  IF v_cortes <> 8 THEN
    RAISE EXCEPTION 'Esperaba 8 cortes, registré % — ABORTAR', v_cortes;
  END IF;
  RAISE NOTICE 'Step 1: % cortes registrados (trigger auto-borró los tubos)', v_cortes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Insertar sobrantes a colmena_tubos + eventos de historial.
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
  WHERE pc.id = '7324df65-5a0b-414f-a012-1f4658a9d8a4'::uuid
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
  'sobrante', '2935', 'sistema',
  'Recovery 2026-05-06: sobrante de OT 2935',
  'recovery_ot_2935'
FROM sobrantes_a_crear s;

DO $$
DECLARE v_sobrantes integer;
BEGIN
  SELECT COUNT(*) INTO v_sobrantes FROM tubos_historial
   WHERE fuente = 'recovery_ot_2935' AND evento = 'sobrante';
  IF v_sobrantes < 0 OR v_sobrantes > 15 THEN
    RAISE EXCEPTION 'Sobrantes fuera de rango razonable [0,15]: % — ABORTAR', v_sobrantes;
  END IF;
  RAISE NOTICE 'Step 2: % sobrantes agregados a colmena_tubos', v_sobrantes;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Borrar AMBOS planes huérfanos (el aplicado + el stale-cache).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_borrados integer;
BEGIN
  DELETE FROM planes_corte
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND id IN (
      '7324df65-5a0b-414f-a012-1f4658a9d8a4'::uuid,  -- aplicado en este recovery
      '37c91725-d746-4b39-8665-e4d1c44d9112'::uuid   -- stale-cache, no aplicado
    );
  GET DIAGNOSTICS v_borrados = ROW_COUNT;
  IF v_borrados <> 2 THEN
    RAISE EXCEPTION 'Esperaba borrar 2 planes huérfanos, borré % — ABORTAR', v_borrados;
  END IF;
  RAISE NOTICE 'Step 3: % planes huérfanos borrados', v_borrados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Update colmena_sync_state.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, NOW(), 'recovery_ot_2935')
ON CONFLICT (empresa_id) DO UPDATE SET
  last_sync_at = NOW(),
  last_sync_by = 'recovery_ot_2935';

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
  RAISE NOTICE 'Step 5: ÉXITO — inventario % tubos · huérfanos restantes en ventana 7d: %',
    v_total, v_huerfanos;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Recovery OT 2935 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Verificaciones manuales post-COMMIT
-- ============================================================================
-- 1. Eventos del recovery:
--    SELECT evento, COUNT(*) FROM tubos_historial
--     WHERE fuente = 'recovery_ot_2935' GROUP BY evento;
--    -- Esperado: corte=8, sobrante=N (lo que mostró Step 2)
--
-- 2. Banner de Capa 3 en /admin: VACÍO (0 huérfanos esperados, OT 2947
--    fue borrada el lunes y postventa la regenera con el optimizador
--    parcheado).
-- ============================================================================
