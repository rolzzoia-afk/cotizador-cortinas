-- ============================================================================
-- Bump opt_version_minima a 5.8 — fix raíz consolidación de pesos huérfanos
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   El PR #82 (2026-05-11, v5.6) introdujo `ingreso_retroactivo_auto` como
--   safety net: cuando `construirEventosTubos` detectaba un UUID en BD sin
--   historial, generaba ingreso retroactivo para no abortar el plan.
--   Esto cerraba el síntoma pero no la causa.
--
--   v5.8 ataca la causa: la consolidación de pesos preservaba UUIDs
--   preexistentes sin verificar si tenían evento de origen. Si el UUID
--   venía huérfano (de un sync/consolidación previa con bug), quedaba
--   huérfano para siempre y se descubría tarde.
--
--   Nuevo flujo:
--     1. Antes de re-agregar tubos a A27/A28/A29, pre-fetch a
--        tubos_historial para los UUIDs preservados.
--     2. Si un UUID preservado NO tiene historial, generar evento
--        `ingreso` con `fuente='consolidacion_peso_retroactivo'` en el
--        mismo sync atómico. Audit trail diferenciado del fresco
--        (`fuente='consolidacion_peso'`).
--
-- Reversibilidad:
--   UPDATE configuracion SET valor = '5.7' WHERE clave = 'opt_version_minima';
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== bump opt_version_minima a 5.8 — INICIADO ==='; END $$;

UPDATE configuracion
SET valor = '5.8'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave = 'opt_version_minima';

DO $$
DECLARE v_ver text;
BEGIN
  SELECT valor INTO v_ver FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'opt_version_minima';
  IF v_ver <> '5.8' THEN
    RAISE EXCEPTION 'Bump falló: opt_version_minima quedó en %', v_ver;
  END IF;
  RAISE NOTICE '  opt_version_minima = 5.8 (taller forzará recarga)';
END $$;

DO $$ BEGIN RAISE NOTICE '=== bump opt_version_minima a 5.8 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Verificar el bump:
--    SELECT valor FROM configuracion
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND clave = 'opt_version_minima';
--    → 5.8
--
-- 2) Después de que postventa haga su próximo Calcular en el taller:
--    SELECT date_trunc('day', created_at) AS dia, fuente, count(*)
--    FROM tubos_historial
--    WHERE fuente IN ('consolidacion_peso','consolidacion_peso_retroactivo','ingreso_retroactivo_auto')
--      AND created_at > now() - interval '7 days'
--    GROUP BY 1, 2 ORDER BY 1 DESC, 2;
--
--    Hipótesis: `consolidacion_peso_retroactivo` aparecen los primeros días
--    cuando se procesan tubos viejos huérfanos. Conforme se "drenan",
--    deberían bajar. Si `ingreso_retroactivo_auto` sigue apareciendo
--    después de varios días con v5.8, hay OTRO bug río arriba (otra ruta
--    que no es consolidación de pesos).
-- ============================================================================
