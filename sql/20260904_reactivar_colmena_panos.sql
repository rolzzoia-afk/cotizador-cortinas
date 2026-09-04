-- ============================================================================
-- Reactivar la COLMENA DE PAÑOS: devolver a disponible lo que vació el 06/08
-- Fecha: 2026-09-04
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Objetivo:
--   Deshacer `sql/20260806_vaciar_colmena_panos.sql` para que el optimizador de
--   tela vuelva a cortar de los paños que ya existen en el rack antes de bajar
--   rollo nuevo.
--
-- ⚠ CUÁNDO CORRERLO
--   SOLO con el código de la reactivación YA DESPLEGADO en producción. El
--   interruptor «Usar colmena de paños» está en `true` desde siempre: la
--   colmena no se usa porque está VACÍA. El día que estas 2.033 filas vuelvan
--   a `disponible`, el código que esté arriba empieza a usarlas de inmediato.
--   Con el código anterior eso sería malo: los cargadores se cortaban en 1.000
--   filas, el motor ponía las cortinas en una sola fila por paño y el cierre
--   del corte del taller NO descontaba nada (el paño quedaba disponible para
--   siempre). Correr esto antes deja el rack mintiendo.
--
-- Qué hace:
--   · Devuelve a `disponible = true` los paños dados de baja con el motivo
--     'vaciado_colmena_20260806' (esperado: 2.033).
--   · Deja en baja, con motivo propio, las 5 filas de 138×1222 creadas el
--     2026-07-10 por `CORTE OT 267-13` (fuente `corte_rollo`): una tela de
--     12,22 m de alto no existe, es un registro falso. Si volvieran, el motor
--     las elegiría siempre —caben todas las cortinas— y el taller saldría a
--     buscar un paño que no está.
--
-- Qué NO toca:
--   · Los paños con `disponible = false` SIN baja: son los ya usados o
--     reservados a una OT (266-14, 267-7, 3096…3127). Quedan como están.
--   · Ninguna otra baja anterior al vaciado.
--
-- Nota: la foto es de julio de 2026. Las alertas de +90 días se van a encender
--   en la vista Colmena; es correcto y a propósito — dicen qué revisar primero.
--
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run. Los RAISE NOTICE
--   salen en la pestaña de mensajes. Si algo no cuadra, la verificación final
--   lanza EXCEPTION y la transacción se revierte entera.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Reactivar colmena de paños — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Backup defensivo (la tabla ENTERA, antes de tocar nada)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS colmena_panos_backup_reactivar_20260904;

CREATE TABLE colmena_panos_backup_reactivar_20260904 AS
SELECT * FROM colmena_panos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$
DECLARE v_bk integer;
BEGIN
  SELECT COUNT(*) INTO v_bk FROM colmena_panos_backup_reactivar_20260904;
  RAISE NOTICE 'Paso 1: backup creado con % paños', v_bk;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Pre-flight: qué hay antes de tocar nada
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total integer;
  v_disp integer;
  v_vaciados integer;
  v_usados integer;
  v_raros integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

  SELECT COUNT(*) INTO v_disp FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND disponible = true;

  SELECT COUNT(*) INTO v_vaciados FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND datos_extra->>'motivo_baja' = 'vaciado_colmena_20260806';

  SELECT COUNT(*) INTO v_usados FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND disponible = false
     AND COALESCE((datos_extra->>'baja')::boolean, false) = false;

  -- Medidas fuera de rango: se listan para mirarlas a ojo, no se tocan. Ojo:
  -- los DÚO cortan 2×alto+30, así que un paño dúo de 7,15 m o de 10,40 m es
  -- LEGÍTIMO (hoy hay dos, en LIBERADO RACK 1). El único registro falso son
  -- los 138×1222 del paso 3.
  SELECT COUNT(*) INTO v_raros FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND datos_extra->>'motivo_baja' = 'vaciado_colmena_20260806'
     AND (medida_ancho > 320 OR medida_alto > 700
          OR medida_ancho < 10 OR medida_alto < 10
          OR codigo IS NULL);

  RAISE NOTICE 'Paso 2 — ANTES: % paños en total, % disponibles', v_total, v_disp;
  RAISE NOTICE 'Paso 2 — del vaciado del 06/08: %', v_vaciados;
  RAISE NOTICE 'Paso 2 — usados/reservados (no se tocan): %', v_usados;
  RAISE NOTICE 'Paso 2 — con medida o código sospechoso: %', v_raros;
END $$;

-- Las medidas sospechosas, una por una (quedan en el log de la corrida).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, codigo, medida_ancho, medida_alto, ubicacion,
           datos_extra->>'ot_origen' AS ot_origen
      FROM colmena_panos
     WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
       AND datos_extra->>'motivo_baja' = 'vaciado_colmena_20260806'
       AND (medida_ancho > 320 OR medida_alto > 700
            OR medida_ancho < 10 OR medida_alto < 10
            OR codigo IS NULL)
     ORDER BY medida_alto DESC
  LOOP
    RAISE NOTICE '  sospechoso: % % (%x%) ubic=% ot=%',
      r.id, COALESCE(r.codigo, '(sin código)'), r.medida_ancho, r.medida_alto,
      COALESCE(r.ubicacion, '—'), COALESCE(r.ot_origen, '—');
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Los fantasmas de 138×1222 se quedan en baja, con motivo propio
-- ─────────────────────────────────────────────────────────────────────────────
-- Se les cambia el motivo ANTES de la reactivación: el UPDATE del paso 4
-- filtra por 'vaciado_colmena_20260806', así que con el motivo nuevo quedan
-- fuera solos. Y el reverso comentado del final tampoco los resucita.
UPDATE colmena_panos
   SET datos_extra = datos_extra
                   || jsonb_build_object(
                        'motivo_baja', 'medida_invalida_20260904',
                        'nota_baja', 'registro falso de CORTE OT 267-13 (alto 12,22 m)')
 WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
   AND datos_extra->>'motivo_baja' = 'vaciado_colmena_20260806'
   AND medida_ancho = 138
   AND medida_alto = 1222;

DO $$
DECLARE v_n integer;
BEGIN
  SELECT COUNT(*) INTO v_n FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND datos_extra->>'motivo_baja' = 'medida_invalida_20260904';
  RAISE NOTICE 'Paso 3: % fantasma(s) de 138x1222 quedan en baja', v_n;
  IF v_n <> 5 THEN
    RAISE WARNING 'Se esperaban 5 fantasmas y hay %. Revisar antes de seguir.', v_n;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Reactivar: vuelven a estar disponibles en el rack
-- ─────────────────────────────────────────────────────────────────────────────
-- Se limpian las tres marcas de la baja (así la vista Colmena deja de pintarlos
-- como baja) y se deja constancia de cuándo volvieron.
DO $$
DECLARE v_n integer;
BEGIN
  UPDATE colmena_panos
     SET disponible = true,
         datos_extra = (datos_extra - 'baja' - 'motivo_baja' - 'baja_en' - 'fecha_baja')
                     || jsonb_build_object(
                          'reactivado_en', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
                          'reactivacion', 'colmena_20260904')
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND datos_extra->>'motivo_baja' = 'vaciado_colmena_20260806';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Paso 4: % paños reactivados', v_n;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Verificación: si algo no cuadra, se revierte TODO
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_disp integer;
  v_disp_con_baja integer;
  v_quedan integer;
  v_usados integer;
BEGIN
  SELECT COUNT(*) INTO v_disp FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND disponible = true;

  -- Ningún disponible puede seguir marcado como baja: la vista lo pintaría
  -- como baja y el motor lo usaría igual. Es la contradicción a evitar.
  SELECT COUNT(*) INTO v_disp_con_baja FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND disponible = true
     AND COALESCE((datos_extra->>'baja')::boolean, false) = true;

  SELECT COUNT(*) INTO v_quedan FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND datos_extra->>'motivo_baja' = 'vaciado_colmena_20260806';

  SELECT COUNT(*) INTO v_usados FROM colmena_panos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND disponible = false
     AND COALESCE((datos_extra->>'baja')::boolean, false) = false;

  RAISE NOTICE 'Paso 5 — DESPUÉS: % disponibles, % con motivo del vaciado, % usados/reservados',
    v_disp, v_quedan, v_usados;

  IF v_disp_con_baja > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % paños quedaron disponibles Y marcados como baja', v_disp_con_baja;
  END IF;
  IF v_quedan > 0 THEN
    RAISE EXCEPTION 'ABORTADO: quedaron % paños con el motivo del vaciado sin reactivar', v_quedan;
  END IF;
  IF v_disp < 1900 OR v_disp > 2100 THEN
    RAISE EXCEPTION 'ABORTADO: % disponibles está fuera del rango esperado (~2.033)', v_disp;
  END IF;

  RAISE NOTICE '=== Reactivar colmena de paños — OK ===';
END $$;

COMMIT;

-- ============================================================================
-- REVERSO (volver a vaciar la colmena). Copiar, descomentar y correr:
--
-- BEGIN;
-- UPDATE colmena_panos
--    SET disponible = false,
--        datos_extra = (datos_extra - 'reactivado_en' - 'reactivacion')
--                    || jsonb_build_object(
--                         'baja', true,
--                         'motivo_baja', 'vaciado_colmena_20260806',
--                         'baja_en', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'))
--  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--    AND datos_extra->>'reactivacion' = 'colmena_20260904';
-- COMMIT;
--
-- Los 5 fantasmas de 138x1222 NO vuelven con el reverso (ya no llevan el motivo
-- del vaciado): siguen en baja con 'medida_invalida_20260904', que es lo
-- correcto. El backup completo está en colmena_panos_backup_reactivar_20260904.
-- ============================================================================
