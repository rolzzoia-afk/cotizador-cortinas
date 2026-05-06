-- ============================================================================
-- Recovery: 197 tubos perdidos por syncs destructivos durante OT 2942
-- Fecha: 2026-05-06
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Durante los múltiples intentos de guardar OT 2942 hoy (incidente con
--   muchas iteraciones de bug-fix), syncs destructivos via sync_colmena_tubos
--   (DELETE + INSERT) borraron tubos sin dejar event de corte/eliminado en
--   tubos_historial. Causa probable: la consolidación de pesos en
--   guardarColmenaFinalEnSupabase línea 1510-1535 elimina TODOS los tubos
--   de A27/A28/A29 de colmenaFinal y solo re-agrega los pesos consolidados,
--   perdiendo los originales.
--
-- Estado verificado (queries de diagnóstico):
--   - Tubos con origen (ingreso/sobrante/etc) sin terminal (corte/eliminado)
--     y NO en colmena_tubos: 197 tubos perdidos
--   - colmena_tubos actual: 137 tubos
--   - Esperado: 334 tubos (137 actuales + 197 perdidos)
--
-- Acción de recovery:
--   Para cada tubo con último evento de origen (ingreso/sobrante/restauracion/
--   ajuste/sobrante_error) en tubos_historial que no esté en colmena_tubos
--   y no tenga corte/eliminado posterior, re-INSERTAR usando los datos
--   (n_colmena, cod, medida_cm) del último evento de origen.
--
--   El trigger `tubo_consumido_no_puede_reentrar_a_colmena` no debe bloquear
--   porque estos tubos NO tienen evento corte. El trigger
--   `trg_auto_remove_consumed_tube` solo afecta DELETE, no INSERT.
--
-- Estado esperado post-recovery:
--   colmena_tubos: 137 + 197 = 334 tubos (deberian_estar coincide)
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Recovery 197 tubos perdidos — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Construir lista de tubos a recuperar:
--    Por cada tubo_raiz_id con evento de origen pero sin terminal posterior
--    y NO en colmena_tubos, tomar el último evento de origen.
-- ─────────────────────────────────────────────────────────────────────────────
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
BEGIN
  GET DIAGNOSTICS v_restored = ROW_COUNT;
  RAISE NOTICE 'Step 1: % tubos re-insertados', v_restored;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Verificación final
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_total integer;
        v_huerfanos integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  SELECT COUNT(*) INTO v_huerfanos
    FROM detectar_planes_huerfanos('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 7);
  RAISE NOTICE 'Step 2: inventario % tubos · huerfanos restantes en ventana 7d: %',
    v_total, v_huerfanos;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Update colmena_sync_state para que postventa al recargar tenga
--    timestamp fresh y no choque con su cache.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE colmena_sync_state
SET last_sync_at = NOW(),
    last_sync_by = 'recovery_197_tubos_2026_05_06'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$ BEGIN RAISE NOTICE '=== Recovery 197 tubos — COMPLETADO ==='; END $$;

COMMIT;
