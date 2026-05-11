-- ============================================================================
-- Fix optimizador: ingreso retroactivo auto + desbloqueo tubo dc096b8a
-- Fecha: 2026-05-11
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Postventa intentó guardar plan de OT 2940 (10 cortes) y la Capa 4
--   anti-fantasma del optimizador abortó el guardado porque el trigger
--   bloquear_corte_sin_origen rechazó el corte del tubo:
--     raiz_id=dc096b8a-99f3-44ea-8797-3a0df4d404c2 (A28 E63 319.6cm)
--
--   El tubo está físicamente en colmena_tubos (creado hoy 16:49:36,
--   agregado_por_admin=false) pero sin ningún evento en tubos_historial.
--   No aparece tampoco como sobrante en ningún plan_corte de hoy.
--   Hipótesis: la consolidación de pesos (optimizador.html línea 1561)
--   preserva UUIDs preexistentes sin generar evento ingreso. Si el UUID
--   venía de un tubo que ya estaba huérfano por otro bug, queda huérfano.
--
-- Acción:
--   1. INSERT ingreso retroactivo para dc096b8a (desbloquea operación
--      inmediata — postventa puede reintentar guardar el plan).
--   2. Bump opt_version_minima a 5.6 — fuerza recarga del taller con el
--      nuevo guard JS que genera ingreso retroactivo auto cuando detecta
--      tubo en BD sin historial (commit asociado).
--
-- Reversibilidad:
--   DELETE FROM tubos_historial
--   WHERE tubo_raiz_id = 'dc096b8a-99f3-44ea-8797-3a0df4d404c2'::uuid
--     AND fuente = 'ingreso_retroactivo_postventa_2026_05_11';
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Fix optimizador ingreso retroactivo — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Ingreso retroactivo del tubo huérfano dc096b8a
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_existe boolean;
  v_ya_logueado integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM colmena_tubos
    WHERE tubo_raiz_id = 'dc096b8a-99f3-44ea-8797-3a0df4d404c2'::uuid
      AND empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  ) INTO v_existe;

  IF NOT v_existe THEN
    RAISE EXCEPTION 'Tubo dc096b8a-... no está en colmena_tubos. Abortando — verificar manualmente.';
  END IF;

  -- Idempotente: si ya se insertó antes (re-corrida), no duplicar
  SELECT COUNT(*) INTO v_ya_logueado
  FROM tubos_historial
  WHERE tubo_raiz_id = 'dc096b8a-99f3-44ea-8797-3a0df4d404c2'::uuid
    AND evento = 'ingreso'
    AND fuente = 'ingreso_retroactivo_postventa_2026_05_11';

  IF v_ya_logueado > 0 THEN
    RAISE NOTICE 'Step 1: ingreso retroactivo ya existe (idempotente, no se duplica)';
  ELSE
    INSERT INTO tubos_historial (
      empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
      evento, registrado_por, notas, fuente
    ) VALUES (
      '67c635a5-152c-4780-a066-23f5081175a9'::text,
      'dc096b8a-99f3-44ea-8797-3a0df4d404c2'::uuid,
      'A28',
      'E63',
      319.60,
      'ingreso',
      'sistema',
      'Tubo apareció en colmena hoy 16:49 sin evento en historial (postventa confirma existencia física para corte en plan OT 2940). Bug raíz probable: consolidación de pesos preserva UUID sin generar evento ingreso. Fix JS asociado: v5.6.',
      'ingreso_retroactivo_postventa_2026_05_11'
    );
    RAISE NOTICE 'Step 1: ingreso retroactivo creado para dc096b8a';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Bump versión mínima a 5.6 — fuerza recarga del taller con el guard JS
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE configuracion
SET valor = '5.6'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave = 'opt_version_minima';

DO $$
DECLARE v_ver text;
BEGIN
  SELECT valor INTO v_ver FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'opt_version_minima';
  IF v_ver <> '5.6' THEN
    RAISE EXCEPTION 'Step 2 falló: opt_version_minima quedó en %', v_ver;
  END IF;
  RAISE NOTICE 'Step 2: opt_version_minima = 5.6 (taller forzará recarga)';
END $$;

DO $$ BEGIN RAISE NOTICE '=== Fix optimizador ingreso retroactivo — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT (correr aparte):
--
-- 1) Verificar ingreso del tubo desbloqueado
--    SELECT created_at::timestamp(0), evento, fuente, notas FROM tubos_historial
--    WHERE tubo_raiz_id = 'dc096b8a-99f3-44ea-8797-3a0df4d404c2'::uuid;
--
-- 2) Postventa reintenta guardar el plan de OT 2940 → debe funcionar.
--
-- 3) Auditoría futura: contar cuántos ingresos retroactivos se generan
--    automáticamente desde el JS (indica si el bug río arriba sigue)
--    SELECT count(*) FROM tubos_historial
--    WHERE fuente = 'ingreso_retroactivo_auto'
--    AND created_at::date = CURRENT_DATE;
-- ============================================================================
