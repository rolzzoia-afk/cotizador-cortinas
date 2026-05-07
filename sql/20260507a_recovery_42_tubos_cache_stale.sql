-- ============================================================================
-- Recovery: 42 tubos perdidos por save con cache stale (pre-v5.3)
-- Fecha: 2026-05-07
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   PR #64 (2026-05-06) deployó v5.3 con fix de consolidación de pesos NO
--   destructiva. Postventa hoy a las 13:20 UTC guardó un plan (4 cortes,
--   2 mermas, 2 sobrantes) PERO con cache stale del browser — su HTML
--   cargado era pre-v5.3, todavía con el strip blanket.
--
--   Resultado: 42 tubos perdidos (35 en peso slots A27/A28/A29, 7 en otros),
--   sin event de eliminado en tubos_historial (DELETE+INSERT con
--   app.sync_active=true no logea).
--
--   Postventa ya cleared cache del browser (verificado por usuario).
--   Próximos saves serán con v5.3 efectiva.
--
-- Verificado por queries:
--   - Inventario actual: 292 (era 334 al cierre de ayer)
--   - 332 deberían estar (con origen y sin terminal), 292 están: diff 40
--     (la diferencia exacta varía 40-44 por tubos creados/consumidos hoy)
--
-- Acción de recovery:
--   Mismo patrón que PR #63: por cada tubo con último evento de origen
--   sin terminal y NO en colmena_tubos, re-INSERTAR usando datos del
--   último evento de origen.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Recovery 42 tubos cache stale — INICIADO ==='; END $$;

WITH origin_latest AS (
  SELECT DISTINCT ON (tubo_raiz_id)
    tubo_raiz_id, n_colmena, cod, medida_cm, evento, created_at
  FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND evento IN ('ingreso', 'sobrante', 'restauracion', 'ajuste', 'sobrante_error')
    AND tubo_raiz_id IS NOT NULL
  ORDER BY tubo_raiz_id, created_at DESC
),
consumed AS (
  SELECT tubo_raiz_id, MAX(created_at) AS last_consumed_at
  FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND evento IN ('corte', 'eliminado')
    AND tubo_raiz_id IS NOT NULL
  GROUP BY tubo_raiz_id
),
to_restore AS (
  SELECT o.tubo_raiz_id, o.n_colmena, o.cod, o.medida_cm
  FROM origin_latest o
  LEFT JOIN consumed c ON c.tubo_raiz_id = o.tubo_raiz_id
  WHERE (c.tubo_raiz_id IS NULL OR o.created_at > c.last_consumed_at)
    AND o.tubo_raiz_id NOT IN (
      SELECT tubo_raiz_id FROM colmena_tubos
      WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
        AND tubo_raiz_id IS NOT NULL
    )
)
INSERT INTO colmena_tubos (
  empresa_id, n_colmena, cod, medida_cm, medida_mm,
  tubo_raiz_id, agregado_por_admin
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::uuid,
  COALESCE(NULLIF(n_colmena, ''), '-'),
  UPPER(TRIM(COALESCE(cod, ''))),
  COALESCE(medida_cm, 0)::numeric,
  ROUND(COALESCE(medida_cm, 0) * 10)::integer,
  tubo_raiz_id,
  false
FROM to_restore
WHERE COALESCE(medida_cm, 0) > 0
  AND COALESCE(cod, '') <> '';

DO $$
DECLARE v_restored integer;
        v_total integer;
BEGIN
  GET DIAGNOSTICS v_restored = ROW_COUNT;
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  RAISE NOTICE 'Step: % tubos re-insertados, total inventario ahora: %', v_restored, v_total;
END $$;

UPDATE colmena_sync_state
SET last_sync_at = NOW(),
    last_sync_by = 'recovery_42_tubos_cache_stale_2026_05_07'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$ BEGIN RAISE NOTICE '=== Recovery 42 tubos cache stale — COMPLETADO ==='; END $$;

COMMIT;
