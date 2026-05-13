-- ============================================================================
-- Bump opt_version_minima a 5.9 — Phase 2 anti-huérfanos (RPC guardar_plan_atomico)
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   v5.9 reemplaza el flujo de 2 calls (sync_colmena_tubos + INSERT planes_corte
--   via REST) por una sola RPC atómica `guardar_plan_atomico` que hace TODO en
--   una transacción única. Cierra el último gap arquitectónico de huérfanos:
--   la ventana de ~100ms entre sync exitoso e INSERT plan donde un browser-crash
--   podía dejar inventario modificado sin plan_corte registrado.
--
-- Pre-requisito:
--   Correr ANTES: sql/20260513b_rpc_guardar_plan_atomico.sql (crea la RPC).
--   Sin la RPC en BD, el optimizador v5.9 fallará al confirmar.
--
-- Reversibilidad:
--   UPDATE configuracion SET valor = '5.8' WHERE clave = 'opt_version_minima';
--   (El JS de v5.9 sigue funcional con la RPC nueva; bajar version solo si hay
--   bug en producción y querés que los taller carguen v5.8 hasta el fix.)
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== bump opt_version_minima a 5.9 — INICIADO ==='; END $$;

-- Verificar que la RPC esté en BD antes de bumpear
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'guardar_plan_atomico'
  ) THEN
    RAISE EXCEPTION 'RPC guardar_plan_atomico no existe en BD. Correr primero sql/20260513b_rpc_guardar_plan_atomico.sql';
  END IF;
END $$;

UPDATE configuracion
SET valor = '5.9'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave = 'opt_version_minima';

DO $$
DECLARE v_ver text;
BEGIN
  SELECT valor INTO v_ver FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'opt_version_minima';
  IF v_ver <> '5.9' THEN
    RAISE EXCEPTION 'Bump falló: opt_version_minima quedó en %', v_ver;
  END IF;
  RAISE NOTICE '  opt_version_minima = 5.9 (taller forzará recarga)';
END $$;

DO $$ BEGIN RAISE NOTICE '=== bump opt_version_minima a 5.9 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Verificar el bump:
--    SELECT valor FROM configuracion
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND clave = 'opt_version_minima';
--    → 5.9
--
-- 2) Verificar que la RPC está y accesible:
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc
--    WHERE proname = 'guardar_plan_atomico';
--
-- 3) Postventa cierra browser completamente y reabre.
--    Console del optimizador debe mostrar VERSION_ACTUAL = 5.9.
--    Próximo guardado de plan loguea: "☁️ Plan guardado atómicamente (plan_id=...)"
--    en lugar de "sync_colmena_tubos OK".
--
-- 4) Monitoreo post-deploy (semanal):
--    SELECT count(*) FROM planes_corte
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND created_at > now() - interval '7 days'
--      AND tipo IS NULL;
--    Comparar con count de OTs entregadas en el mismo periodo: deberían
--    cuadrar 1:1 (ojo: hay planes "respaldo" que NO entran en este conteo).
-- ============================================================================
