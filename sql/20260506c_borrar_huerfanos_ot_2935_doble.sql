-- ============================================================================
-- Limpieza: borrar 2 planes huérfanos de OT 2935 generados doble el 2026-05-06
-- Fecha: 2026-05-06
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Postventa regeneró el plan de OT 2935 a las 14:20 del 2026-05-06. Dos
--   inserts en `planes_corte` separados por ~5 segundos (probable doble click
--   o re-intento), ambos quedaron huérfanos (sin events en tubos_historial).
--
-- Diagnóstico (post-mortem):
--   Capa 1 (PR #38) solo cubría la rama `else` de confirmarYGuardarStaging.
--   La rama `if (_colmenaPreSyncOK)` que se activa cuando el operario hace
--   "Calcular" antes de "Confirmar" no abortaba si insertarEventosHistorialDirecto
--   fallaba — solo loggeaba un warn y seguía hasta el INSERT a planes_corte.
--   Resultado: plan huérfano. Capa 1.5 (PR #44) cierra ese agujero.
--
-- Acción:
--   - Borrar los 2 planes huérfanos (sin descontar inventario; los tubos
--     no estaban descontados según colmena_tubos = 157).
--   - El postventa debe recargar (Ctrl+Shift+R) y regenerar OT 2935 con
--     el optimizador parcheado.
-- ============================================================================

BEGIN;

DO $$
DECLARE v_borrados integer;
BEGIN
  DELETE FROM planes_corte
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND id IN (
      '7324df65-5a0b-414f-a012-1f4658a9d8a4'::uuid,  -- OT 2935 (14:20:55)
      '37c91725-d746-4b39-8665-e4d1c44d9112'::uuid   -- OT 2935 (14:20:50)
    );
  GET DIAGNOSTICS v_borrados = ROW_COUNT;
  IF v_borrados <> 2 THEN
    RAISE EXCEPTION 'Esperaba borrar 2 planes huérfanos, borré % — ABORTAR', v_borrados;
  END IF;
  RAISE NOTICE 'Borrados % planes huérfanos doble OT 2935', v_borrados;
END $$;

DO $$
DECLARE v_huerfanos integer;
        v_total integer;
BEGIN
  SELECT COUNT(*) INTO v_huerfanos
    FROM detectar_planes_huerfanos('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 7);
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  RAISE NOTICE 'Estado final: % tubos · % huérfanos en ventana 7 días', v_total, v_huerfanos;
END $$;

COMMIT;
