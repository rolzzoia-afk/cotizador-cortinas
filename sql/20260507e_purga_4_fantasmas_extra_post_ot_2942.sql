-- ============================================================================
-- Purga: 4 fantasmas extra — sobrantes ficticios de OT 2942 (06/05 21:10)
-- Fecha: 2026-05-07
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   En la prueba de validación post-rollback (PR #68), postventa preparó
--   plan de OT 2944 y reportó "no encuentro el tubo A34 E02 390.5".
--   Investigación reveló que ese UUID (703bdad3) tenía como único evento un
--   sobrante de OT 2942 del 06/05 21:10 — el incidente con consolidación
--   destructiva pre-v5.3 que generó sobrantes ficticios además de perder
--   197 tubos.
--
--   La heurística de la purga PR #67 dejó pasar estos casos porque su
--   origen era post-2026-05-05 15:43 (carga inicial). Pero el incidente
--   OT 2942 generó tubos "fantasma con origen reciente".
--
--   Auditoría con HAVING COUNT(*) = 1 AND ot = '2942' AND evento sobrante
--   identificó 5 candidatos más. Postventa validó físicamente:
--     - A31 E66 227.00 (0308b476): SÍ EXISTE → conservar
--     - A27 E64 131.70 (253a830e): NO existe → purgar
--     - A29 E16 154.90 (53cf3452): NO existe → purgar
--     - A34 E02 146.00 (f79be2e6): NO existe → purgar
--     - A34 E02 248.50 (81fe398f): NO existe → purgar
--
--   Plus el primer fantasma del día (703bdad3, A34 E02 390.5) ya purgado
--   inline antes de este script.
--
-- Acción:
--   Logear evento 'eliminado' con fuente='purga_fantasmas_post_ot_2942'.
--   Trigger trg_auto_remove_consumed_tube borra de colmena_tubos.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Purga 4 fantasmas extra OT 2942 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Insertar 'eliminado' para los 4 UUIDs validados como inexistentes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_eliminados integer;
BEGIN
  INSERT INTO tubos_historial (
    empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, evento,
    registrado_por, notas, fuente
  )
  SELECT
    ct.empresa_id::text, ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm,
    'eliminado', 'sistema',
    'Sobrante ficticio de OT 2942 — postventa confirmó que no existe físicamente',
    'purga_fantasmas_post_ot_2942'
  FROM colmena_tubos ct
  WHERE ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND ct.tubo_raiz_id IN (
      '253a830e-efdf-4301-a67b-af88b5372250'::uuid,  -- A27 E64 131.70
      '53cf3452-94c7-4042-aaf9-c6b086d4c9cd'::uuid,  -- A29 E16 154.90
      'f79be2e6-3b6c-49c6-a6ab-41bf05fc30d1'::uuid,  -- A34 E02 146.00
      '81fe398f-4475-4f89-a388-44da273de2a0'::uuid   -- A34 E02 248.50
    );

  GET DIAGNOSTICS v_eliminados = ROW_COUNT;
  IF v_eliminados <> 4 THEN
    RAISE EXCEPTION 'Esperaba eliminar 4 fantasmas pero eliminé %', v_eliminados;
  END IF;
  RAISE NOTICE 'Step 1: % fantasmas eliminados', v_eliminados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Verificación: los 4 UUIDs ya no están en colmena_tubos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_quedan integer;
BEGIN
  SELECT COUNT(*) INTO v_quedan FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND tubo_raiz_id IN (
       '253a830e-efdf-4301-a67b-af88b5372250'::uuid,
       '53cf3452-94c7-4042-aaf9-c6b086d4c9cd'::uuid,
       'f79be2e6-3b6c-49c6-a6ab-41bf05fc30d1'::uuid,
       '81fe398f-4475-4f89-a388-44da273de2a0'::uuid
     );
  IF v_quedan <> 0 THEN
    RAISE EXCEPTION 'Quedaron % fantasmas sin purgar (trigger falló?)', v_quedan;
  END IF;
  RAISE NOTICE 'Step 2: 0 fantasmas restantes (trigger trg_auto_remove_consumed_tube OK)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) UPDATE colmena_sync_state para invalidar caches
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE colmena_sync_state
SET last_sync_at = NOW(),
    last_sync_by = 'purga_fantasmas_post_ot_2942_2026_05_07'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$ BEGIN RAISE NOTICE '=== Purga 4 fantasmas extra OT 2942 — COMPLETADO ==='; END $$;

COMMIT;

-- Smoke tests post-COMMIT (correr aparte):
-- SELECT COUNT(*) FROM colmena_tubos WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
-- Esperado: 186 (190 pre - 4 purgados)
