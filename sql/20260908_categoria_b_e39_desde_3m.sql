-- ═══════════════════════════════════════════════════════════════════════
-- CATEGORÍA B — el tubo E39 entra recién a los 3,0 m
--
-- Correr COMPLETO en el SQL Editor de Supabase, ANTES de mergear el PR
-- `feat/categoria-b-e39-desde-3m`. Es idempotente: correrlo dos veces deja el
-- mismo resultado.
--
-- Decisión del dueño (2026-09-08): «a las gama B, a partir de 3 metros de ancho
-- activar la tubería E39; de resto, que solo trabaje con E01». El corte de la
-- banda pasa de 2,5 a 3,0 m en el CÓDIGO (`reglas-tuberia.ts`, `anchoDesdeM`) y
-- acá lo acompañan los anchos máximos de las filas del catálogo.
--
-- POR QUÉ HAY QUE TOCAR LOS ANCHOS MÁXIMOS: el corte del tubo es inclusive
-- (`anchoM < anchoDesdeM` → E01) y el del modelo también (`anchoM <=
-- ancho_max_m` en `validarAnchoModelo`). Con la banda en 3,0 y el tope de las
-- filas ROL_SIMPLE también en 3,0, el E39 solo existiría en una cortina de
-- 3,00 m EXACTOS: a 3,01 la cortina ya no sería fabricable. Por eso:
--   · roller simple B  → tope 3,5 m (es el que tiene el E39)
--   · ovalada y dúo B  → tope 3,0 m (siguen SOLO con E01; no tienen tubo Ø45)
--
-- Estado ANTES (verificado en producción el 2026-09-08):
--   3 filas ROLLER_SIMPLE  · ancho_max_m 3.0 · codigos_tubo 'E01; E39'
--   4 filas ovalada / dúo  · ancho_max_m 2.5 · codigos_tubo 'E01'
--
-- Estado DESPUÉS:
--   3 filas ROLLER_SIMPLE  · ancho_max_m 3.5 · codigos_tubo 'E01; E39'
--   4 filas ovalada / dúo  · ancho_max_m 3.0 · codigos_tubo 'E01'
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 0. Respaldos ───────────────────────────────────────────────────────
-- (a) Las 7 filas de categoría B, completas, para revertir.
DROP TABLE IF EXISTS descuentos_modelo_backup_20260908_b_e39;
CREATE TABLE descuentos_modelo_backup_20260908_b_e39 AS
SELECT *
FROM descuentos_modelo
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND notas LIKE '%LINEA B%';

-- (b) Foto de TODA la tabla en los tres campos que este script toca, para
--     comprobar al final que ninguna fila ajena a la categoría B se movió.
DROP TABLE IF EXISTS descuentos_modelo_foto_20260908_b_e39;
CREATE TABLE descuentos_modelo_foto_20260908_b_e39 AS
SELECT id, ancho_max_m, codigos_tubo, notas
FROM descuentos_modelo
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9';

-- ── 1. Pre-flight: que el punto de partida sea el esperado ─────────────
-- Si alguien re-importó el Excel «DESCUENTOS ROLLER CATALOGO» y cambió estas
-- filas, este bloque aborta antes de tocar nada. La segunda corrida del script
-- también pasa (acepta los valores ya aplicados).
DO $$
DECLARE
  n_total int;
  n_rol   int;
  n_oval  int;
BEGIN
  SELECT count(*) INTO n_total
  FROM descuentos_modelo
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND notas LIKE '%LINEA B%';

  IF n_total <> 7 THEN
    RAISE EXCEPTION 'Se esperaban 7 filas de categoría B y hay %. Revisar antes de seguir.', n_total;
  END IF;

  SELECT count(*) INTO n_rol
  FROM descuentos_modelo
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND notas LIKE '%LINEA B%'
    AND sistema = 'ROLLER_SIMPLE'
    AND codigos_tubo = 'E01; E39'
    AND ancho_max_m IN (3.0, 3.5);

  IF n_rol <> 3 THEN
    RAISE EXCEPTION 'Se esperaban 3 filas ROLLER_SIMPLE B con «E01; E39» y tope 3,0 o 3,5; hay %.', n_rol;
  END IF;

  SELECT count(*) INTO n_oval
  FROM descuentos_modelo
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND notas LIKE '%LINEA B%'
    AND sistema IN ('CENEFA_OVALADA', 'CENEFA_OVALADA_DUO')
    AND codigos_tubo = 'E01'
    AND ancho_max_m IN (2.5, 3.0);

  IF n_oval <> 4 THEN
    RAISE EXCEPTION 'Se esperaban 4 filas de ovalada/dúo B con solo «E01» y tope 2,5 o 3,0; hay %.', n_oval;
  END IF;
END $$;

-- ── 2. Roller simple B: llega a 3,5 m con el E39 ───────────────────────
UPDATE descuentos_modelo
SET ancho_max_m = 3.5,
    notas = 'LINEA B — roller simple: tubo E01 bajo 3,0 m / E39 desde 3,0 m; ancho máximo 3,5 m'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND notas LIKE '%LINEA B%'
  AND sistema = 'ROLLER_SIMPLE'
  AND (ancho_max_m IS DISTINCT FROM 3.5 OR notas NOT LIKE '%bajo 3,0 m%');

-- ── 3. Ovalada y dúo B: hasta 3,0 m, siempre con E01 ───────────────────
-- No tienen kit para un tubo de Ø45, así que no participan de la banda: lo que
-- las corta es este ancho máximo.
UPDATE descuentos_modelo
SET ancho_max_m = 3.0,
    codigos_tubo = 'E01'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND notas LIKE '%LINEA B%'
  AND sistema IN ('CENEFA_OVALADA', 'CENEFA_OVALADA_DUO')
  AND (ancho_max_m IS DISTINCT FROM 3.0 OR codigos_tubo IS DISTINCT FROM 'E01');

-- ── 4. Verificación: aborta si algo no quedó como se pidió ─────────────
DO $$
DECLARE
  n_rol       int;
  n_oval      int;
  n_otras     int;
BEGIN
  SELECT count(*) INTO n_rol
  FROM descuentos_modelo
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND notas LIKE '%LINEA B%'
    AND sistema = 'ROLLER_SIMPLE'
    AND ancho_max_m = 3.5
    AND codigos_tubo = 'E01; E39';

  IF n_rol <> 3 THEN
    RAISE EXCEPTION 'Quedaron % filas ROLLER_SIMPLE B con tope 3,5 y «E01; E39» (esperadas 3).', n_rol;
  END IF;

  SELECT count(*) INTO n_oval
  FROM descuentos_modelo
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND notas LIKE '%LINEA B%'
    AND sistema IN ('CENEFA_OVALADA', 'CENEFA_OVALADA_DUO')
    AND ancho_max_m = 3.0
    AND codigos_tubo = 'E01';

  IF n_oval <> 4 THEN
    RAISE EXCEPTION 'Quedaron % filas de ovalada/dúo B con tope 3,0 y solo «E01» (esperadas 4).', n_oval;
  END IF;

  -- Ninguna fila ajena a la categoría B pudo cambiar: los dos UPDATE filtran por
  -- `notas LIKE '%LINEA B%'`. Se comprueba de verdad contra la foto previa.
  SELECT count(*) INTO n_otras
  FROM descuentos_modelo d
  JOIN descuentos_modelo_foto_20260908_b_e39 f ON f.id = d.id
  WHERE f.notas IS DISTINCT FROM d.notas
     OR f.ancho_max_m IS DISTINCT FROM d.ancho_max_m
     OR f.codigos_tubo IS DISTINCT FROM d.codigos_tubo;

  -- Cambian exactamente las 7 de categoría B (3 por el tope y la nota, 4 por el
  -- tope). Una segunda corrida no cambia ninguna: por eso el rango 0–7.
  IF n_otras > 7 THEN
    RAISE EXCEPTION 'Cambiaron % filas y solo debían cambiar las 7 de categoría B. Revertir con el respaldo.', n_otras;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM descuentos_modelo d
    JOIN descuentos_modelo_foto_20260908_b_e39 f ON f.id = d.id
    WHERE f.notas NOT LIKE '%LINEA B%'
      AND (f.notas IS DISTINCT FROM d.notas
        OR f.ancho_max_m IS DISTINCT FROM d.ancho_max_m
        OR f.codigos_tubo IS DISTINCT FROM d.codigos_tubo)
  ) THEN
    RAISE EXCEPTION 'Se tocó una fila que NO es de categoría B. Revertir con el respaldo.';
  END IF;
END $$;

COMMIT;

-- ── Comprobación a ojo ─────────────────────────────────────────────────
--    SELECT sistema, mecanismo, codigos_tubo, ancho_max_m, notas
--    FROM descuentos_modelo
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND notas LIKE '%LINEA B%'
--    ORDER BY sistema, mecanismo;
--
-- Esperado: 3 filas ROLLER_SIMPLE con 3.5 y 'E01; E39'
--           4 filas de ovalada/dúo con 3.0 y 'E01'

-- ── Reversa ────────────────────────────────────────────────────────────
--    BEGIN;
--    UPDATE descuentos_modelo d
--    SET ancho_max_m = b.ancho_max_m,
--        codigos_tubo = b.codigos_tubo,
--        notas = b.notas
--    FROM descuentos_modelo_backup_20260908_b_e39 b
--    WHERE d.id = b.id;
--    COMMIT;
-- (y volver `reglaLineaB.anchoDesdeM` a 2.5 en el código, o dejarlo: con los
--  topes viejos el E39 simplemente no se alcanza.)

-- ── Pendientes operativos (NO son SQL) ─────────────────────────────────
-- · El Excel maestro «DESCUENTOS ROLLER CATALOGO» (Admin → Descuentos del
--   catálogo) REEMPLAZA todas estas filas al re-importarse. Hay que actualizarlo
--   con los topes nuevos (3,5 y 3,0) o una re-importación revierte este script.
-- · Las OTs de categoría B ya guardadas conservan su chip de tubo. Al
--   re-guardarlas desde Fase 1, un roller B de entre 2,5 y 3,0 m pasa de E39 a
--   E01 (es el cambio pedido). Hoy hay UN paño así, de 2,55 m, en la OT de
--   prueba «GAMA B / PREFABRICADO».
-- · Si para una cortina puntual se quiere el otro tubo, en Fase 2 ahora se puede
--   elegir a mano entre E01 y E39, y esa elección ya no se revierte.
