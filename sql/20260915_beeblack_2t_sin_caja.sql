-- ─────────────────────────────────────────────────────────────────────
-- BEEBLACK DE DOS TELAS: la 2.ª tela deja de pagar la CAJA DE EMBALAJE
-- 2026-09-15
--
-- Continúa `20260910_beeblack_2t_estructura.sql`, que sacó el riel, las
-- agarraderas y la cinta. Ahora sale también `CAJA0001`: las dos telas son UNA
-- cortina, van en el mismo marco y en la misma caja.
--
-- POR QUÉ VA CON SQL: las recetas `|2T` están GUARDADAS en
-- `configuracion.reglas_precios`, y lo guardado pisa a lo de fábrica
-- (`normalizarReglasPrecios` mezcla clave por clave sobre `RECETAS_DEFAULT`).
-- El cambio de código no se ve en la app hasta correr esto.
--
-- DE DÓNDE SALE. El dueño revisó el 2026-09-15 un beeblack doble de
-- 3,45 × 1,65 contra su planilla y la app le cobraba 17.948 de más en la
-- segunda tela. En el panel del mosquitero de esa copia (`Cotizador!CH`, la
-- que subió como `docs/referencias/bebebebebebbe.xlsm`) las celdas de cantidad
-- de `SLM01`, `SML10`, `CIN0002` y `CAJA0001` están todas en blanco. Pedido:
-- «como en el excel manual».
--
-- ⚠ LAS DOS COPIAS DEL EXCEL NO COINCIDEN. La de ANDREA (COTLG-05994-2), con
-- la que se calibró la receta `|2T` el 2026-09-10, SÍ le cobra la caja a la
-- segunda tela — sus materiales dan 409.157,17 con las tres cajas adentro.
-- Manda la copia nueva. Las cotizaciones ya vendidas no cambian: el golden de
-- ANDREA se corre con la receta de su época
-- (`RECETA_BEEBLACK_2A_TELA_CON_CAJA`), el mismo idioma que los tubos de julio.
--
-- Las recetas de la PRIMERA tela no se tocan: siguen con sus 12 líneas, caja
-- incluida.
--
-- Idempotente: correrlo dos veces no hace nada la segunda.
--
-- REVERSA: volver a agregar la línea `{"insumo":"CAJA0001","porCortina":1}` a
-- las tres recetas `|2T` — o, más simple, restaurar el respaldo de
-- `reglas_precios` que deja Admin → Precios antes de cada guardado.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE configuracion c
SET valor = jsonb_set(
      c.valor::jsonb,
      '{recetas}',
      ((c.valor::jsonb) -> 'recetas') || coalesce(
        (
          SELECT jsonb_object_agg(
                   k.key,
                   (
                     SELECT coalesce(jsonb_agg(l.linea ORDER BY l.ord), '[]'::jsonb)
                     FROM jsonb_array_elements(k.value) WITH ORDINALITY AS l(linea, ord)
                     WHERE coalesce(l.linea ->> 'insumo', '') <> 'CAJA0001'
                   )
                 )
          FROM jsonb_each((c.valor::jsonb) -> 'recetas') AS k(key, value)
          WHERE k.key IN ('BEE_BK|2T', 'BEE_MOSQ|2T', 'BEE_TRAS|2T')
        ),
        '{}'::jsonb
      )
    )::text
WHERE c.clave = 'reglas_precios'
  AND (c.valor::jsonb) -> 'recetas' IS NOT NULL;

-- ── Verificación: aborta si quedó a medias ──────────────────────────
DO $$
DECLARE
  malas int;
BEGIN
  -- 1) Ninguna receta |2T puede seguir con la caja.
  SELECT count(*) INTO malas
  FROM configuracion c,
       LATERAL jsonb_each((c.valor::jsonb) -> 'recetas') AS k(key, value),
       LATERAL jsonb_array_elements(k.value) AS l(linea)
  WHERE c.clave = 'reglas_precios'
    AND k.key IN ('BEE_BK|2T', 'BEE_MOSQ|2T', 'BEE_TRAS|2T')
    AND coalesce(l.linea ->> 'insumo', '') = 'CAJA0001';
  IF malas > 0 THEN
    RAISE EXCEPTION 'Quedaron % lineas CAJA0001 en las recetas |2T', malas;
  END IF;

  -- 2) Y tienen que quedar las 7 que sí se cobran por tela: SML34, SML13,
  --    SML35, SML38, SML13, PUB 01, MAT00001.
  SELECT count(*) INTO malas
  FROM configuracion c,
       LATERAL jsonb_each((c.valor::jsonb) -> 'recetas') AS k(key, value)
  WHERE c.clave = 'reglas_precios'
    AND k.key IN ('BEE_BK|2T', 'BEE_MOSQ|2T', 'BEE_TRAS|2T')
    AND jsonb_array_length(k.value) <> 7;
  IF malas > 0 THEN
    RAISE EXCEPTION '% recetas |2T no quedaron con 7 lineas', malas;
  END IF;

  -- 3) La receta de la PRIMERA tela no se tocó: sus 12 líneas intactas.
  SELECT count(*) INTO malas
  FROM configuracion c,
       LATERAL jsonb_each((c.valor::jsonb) -> 'recetas') AS k(key, value)
  WHERE c.clave = 'reglas_precios'
    AND k.key IN ('BEE_BK', 'BEE_MOSQ', 'BEE_TRAS')
    AND jsonb_array_length(k.value) <> 12;
  IF malas > 0 THEN
    RAISE EXCEPTION 'Se tocaron % recetas de la 1.a tela', malas;
  END IF;
END $$;

COMMIT;

-- Para mirar cómo quedaron:
-- SELECT k.key,
--        (SELECT string_agg(l ->> 'insumo', ' · ' ORDER BY ord)
--           FROM jsonb_array_elements(k.value) WITH ORDINALITY t(l, ord)) AS insumos
-- FROM configuracion c, LATERAL jsonb_each((c.valor::jsonb) -> 'recetas') AS k(key, value)
-- WHERE c.clave = 'reglas_precios' AND k.key LIKE 'BEE%'
-- ORDER BY k.key;
