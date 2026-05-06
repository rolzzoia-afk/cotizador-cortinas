-- ============================================================================
-- Limpieza: borrar planes huérfanos pre-wipe (OT 2929 y OT 2926)
-- Fecha: 2026-05-06
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   El banner de Capa 3 (PR #40) detecta 2 planes huérfanos del 2026-04-29
--   que sobrevivieron al recovery del incidente sync stale (PR #23). Son
--   pre-wipe del 2026-05-04, no se pueden recuperar como OT 2941 porque
--   los tubo_raiz_id que referencian ya no existen (la colmena se vació
--   y se recargó desde cero el 2026-05-04).
--
-- Confirmación del taller (2026-05-06):
--   - OT 2929: cortada físicamente, ya entregada
--   - OT 2926: cortada físicamente, ya entregada
--
-- Acción:
--   Borrar los 2 planes huérfanos. Sin tocar inventario (los tubos
--   referenciados ya no existen, no hay nada que descontar).
--
-- Estado esperado post-cleanup:
--   - colmena_tubos: sin cambios (157 tubos)
--   - tubos_historial: sin cambios
--   - banner de Capa 3 en /admin: VACÍO (0 planes huérfanos detectados)
-- ============================================================================

BEGIN;

DO $$
DECLARE v_borrados integer;
BEGIN
  DELETE FROM planes_corte
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND id IN (
      'c79b338b-665a-49a3-af50-08fe348129fb'::uuid,  -- OT 2929
      '349caa93-6f31-443b-b01a-4035bbc142cc'::uuid   -- OT 2926
    );
  GET DIAGNOSTICS v_borrados = ROW_COUNT;
  IF v_borrados <> 2 THEN
    RAISE EXCEPTION 'Esperaba borrar 2 planes huérfanos pre-wipe, borré % — ABORTAR', v_borrados;
  END IF;
  RAISE NOTICE 'Borrados % planes huérfanos pre-wipe (OT 2929, 2926)', v_borrados;
END $$;

-- Verificación final: el banner de Capa 3 debería estar vacío.
DO $$
DECLARE v_huerfanos integer;
BEGIN
  SELECT COUNT(*) INTO v_huerfanos
    FROM detectar_planes_huerfanos('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 7);
  RAISE NOTICE 'Planes huérfanos restantes en ventana de 7 días: %', v_huerfanos;
END $$;

COMMIT;
