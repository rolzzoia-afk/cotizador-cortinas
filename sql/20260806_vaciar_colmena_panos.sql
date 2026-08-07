-- ============================================================================
-- Vaciar la COLMENA DE PAÑOS: dar de baja todo lo disponible
-- Fecha: 2026-08-06
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Objetivo:
--   Dejar la colmena de paños sin nada disponible para que el optimizador de
--   paños corte SOLO tela nueva del rollo.
--
-- Va de la mano con el interruptor "Usar colmena de paños en el optimizador"
--   (Optimizador de Tela → Parámetros de corte). Son dos capas distintas y
--   conviene tener las dos:
--     · El interruptor hace que el motor IGNORE la colmena aunque tenga paños
--       (y sobrevive a que alguien reimporte el Excel del galpón).
--     · Este script deja además el inventario en cero, para que la vista
--       Colmena refleje la realidad y nadie salga a buscar un paño que ya no
--       se va a usar.
--
-- Por qué BAJA y no DELETE:
--   · Reversible con un UPDATE (el reverso exacto está al final, comentado).
--   · No rompe el histórico: `telas_mermas.colmena_origen_id` apunta a filas de
--     esta tabla, y las OTs que ya consumieron un paño conservan su origen.
--   · `datos_extra.baja = true` es el estado que la vista Colmena ya sabe
--     pintar como "baja" (src/modules/telas/colmenaViva.ts).
--
-- Qué NO toca:
--   Los paños con disponible = false, que son los ya usados o RESERVADOS a una
--   OT (disponible=false + ot_asignada, p. ej. el SC 65 de VR-11 reservado a la
--   OT 267-7). Quedan exactamente como están.
--
-- Ojo: `colmena_panos` NO tiene tabla de auditoría propia (a diferencia de
--   colmena_tubos, que tiene colmena_tubos_audit). El backup del paso 1 es la
--   única red de seguridad: no lo borres.
--
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run. Los RAISE NOTICE
--   salen en la pestaña de mensajes.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Vaciar colmena de paños — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Backup defensivo (la tabla ENTERA, no solo lo disponible)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS colmena_panos_backup_vaciado_20260806;

CREATE TABLE colmena_panos_backup_vaciado_20260806 AS
SELECT * FROM colmena_panos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$
DECLARE v_bk integer;
BEGIN
  SELECT COUNT(*) INTO v_bk FROM colmena_panos_backup_vaciado_20260806;
  RAISE NOTICE 'Paso 1: backup creado con % paños', v_bk;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Pre-flight: qué hay antes de tocar nada
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total integer;
  v_disp integer;
  v_baja integer;
  v_reservados integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_panos
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  SELECT COUNT(*) INTO v_disp FROM colmena_panos
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
      AND disponible = true;
  SELECT COUNT(*) INTO v_baja FROM colmena_panos
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
      AND COALESCE(datos_extra->>'baja', 'false') = 'true';
  SELECT COUNT(*) INTO v_reservados FROM colmena_panos
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
      AND disponible = false
      AND COALESCE(ot_asignada, '') <> '';
  RAISE NOTICE 'Paso 2: total=% · disponibles=% (se dan de baja) · ya de baja=% · usados/reservados a OT=% (NO se tocan)',
    v_total, v_disp, v_baja, v_reservados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) La baja
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE colmena_panos
SET disponible = false,
    datos_extra = COALESCE(datos_extra, '{}'::jsonb)
      || jsonb_build_object(
           'baja', true,
           'motivo_baja', 'vaciado_colmena_20260806',
           'baja_en', now()
         )
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND disponible = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Verificación: no puede quedar nada disponible
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_disp integer;
  v_dados integer;
BEGIN
  SELECT COUNT(*) INTO v_disp FROM colmena_panos
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
      AND disponible = true;
  SELECT COUNT(*) INTO v_dados FROM colmena_panos
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
      AND datos_extra->>'motivo_baja' = 'vaciado_colmena_20260806';

  RAISE NOTICE 'Paso 4: dados de baja en esta corrida=% · disponibles restantes=%', v_dados, v_disp;

  IF v_disp <> 0 THEN
    RAISE EXCEPTION 'Quedaron % paños disponibles: se aborta y se revierte todo', v_disp;
  END IF;
  RAISE NOTICE '=== Colmena de paños vacía — OK ===';
END $$;

COMMIT;

-- ============================================================================
-- REVERSO (si hay que volver atrás). Devuelve a disponible SOLO los paños que
-- dio de baja esta corrida; los que ya estaban usados o reservados no se tocan
-- porque nunca llevaron este motivo.
-- ============================================================================
-- BEGIN;
-- UPDATE colmena_panos
-- SET disponible = true,
--     datos_extra = (datos_extra - 'baja' - 'motivo_baja' - 'baja_en')
-- WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--   AND datos_extra->>'motivo_baja' = 'vaciado_colmena_20260806';
-- COMMIT;
--
-- Plan B (restaurar desde el backup completo):
--   SELECT * FROM colmena_panos_backup_vaciado_20260806;
-- ============================================================================
