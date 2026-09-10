-- ─────────────────────────────────────────────────────────────────────
-- BEEBLACK DE DOS TELAS: la 2.ª tela deja de pagar la ESTRUCTURA
-- 2026-09-10
--
-- Las recetas `|2T` están GUARDADAS en `configuracion.reglas_precios`, y lo
-- guardado pisa a lo de fábrica (`normalizarReglasPrecios` mezcla clave por
-- clave sobre `RECETAS_DEFAULT`). Por eso el cambio de código no se ve en la
-- app hasta correr esto.
--
-- Qué cambia: las tres recetas de segunda tela (`BEE_BK|2T`, `BEE_MOSQ|2T`,
-- `BEE_TRAS|2T`) dejan de cobrar las AGARRADERAS (`SML10/11/12`) y la CINTA
-- DOBLE CONTACTO (`CIN0002`), además del riel (`SLM01/02/03`) que ya no
-- cobraban. Es exactamente lo que el Excel manual deja en blanco en el panel
-- de la 2.ª tela (OT COTLG-05994-2 ANDREA, `Cotizador!CT`): las dos telas
-- corren por el mismo carril y la estructura se pega a la ventana una vez.
--
-- Aclaración del dueño (2026-09-10): «al decir que todo normal, me refiero a
-- que los cálculos y parámetros fueran como el del excel manual».
--
-- Después de correrlo, la traslúcida de esa OT sale al peso de la planilla:
-- 250.457,45 · 428.347,62 · 608.844,10 (materiales 409.157,17 = `DD137`).
--
-- Las recetas de la PRIMERA tela no se tocan: siguen con sus 12 líneas.
--
-- SEGUNDO CAMBIO, del mismo día: la CINTA DOBLE CONTACTO (`CIN0002`) sube de
-- 15.470 a 19.999,2 = 13.000 × 1,5384, la fórmula de la columna VALOR MAXIMO.
-- Las copias TRINA y «D SOLO BK» traen 15.470 TECLEADO en esa celda con el
-- mismo costo de 13.000; la de ANDREA la trae recalculada. Esto mueve TODO el
-- beeblack (~7.549 más por cortina repartidos en sus m²), no solo la 2.ª tela
-- —que ya no la paga—. Las cotizaciones viejas no cambian: cada golden se
-- corre con los precios de su época (`REGLAS_CIN_VIEJA` en los tests).
--
-- Idempotente: correrlo dos veces no hace nada la segunda.
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
                     WHERE coalesce(l.linea ->> 'insumo', '') NOT IN
                           ('SLM01', 'SLM02', 'SLM03', 'SML10', 'SML11', 'SML12', 'CIN0002')
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

-- ── La cinta doble contacto, al valor de la fórmula ─────────────────
UPDATE configuracion c
SET valor = jsonb_set(
      c.valor::jsonb,
      '{sistemas,beeblack,insumos,CIN0002,valorMaximo}',
      to_jsonb(19999.2::numeric)
    )::text
WHERE c.clave = 'reglas_precios'
  AND (c.valor::jsonb) #> '{sistemas,beeblack,insumos,CIN0002}' IS NOT NULL;

-- ── Verificación: aborta si quedó a medias ──────────────────────────
DO $$
DECLARE
  malas int;
BEGIN
  -- 1) Ninguna línea de estructura puede sobrevivir en una receta |2T.
  SELECT count(*) INTO malas
  FROM configuracion c,
       LATERAL jsonb_each((c.valor::jsonb) -> 'recetas') AS k(key, value),
       LATERAL jsonb_array_elements(k.value) AS l(linea)
  WHERE c.clave = 'reglas_precios'
    AND k.key IN ('BEE_BK|2T', 'BEE_MOSQ|2T', 'BEE_TRAS|2T')
    AND coalesce(l.linea ->> 'insumo', '') IN
        ('SLM01', 'SLM02', 'SLM03', 'SML10', 'SML11', 'SML12', 'CIN0002');
  IF malas > 0 THEN
    RAISE EXCEPTION 'Quedaron % lineas de estructura en las recetas |2T', malas;
  END IF;

  -- 2) Y tienen que quedar las 8 que sí se cobran por tela: SML34, SML13,
  --    SML35, SML38, SML13, PUB 01, MAT00001, CAJA0001.
  SELECT count(*) INTO malas
  FROM configuracion c,
       LATERAL jsonb_each((c.valor::jsonb) -> 'recetas') AS k(key, value)
  WHERE c.clave = 'reglas_precios'
    AND k.key IN ('BEE_BK|2T', 'BEE_MOSQ|2T', 'BEE_TRAS|2T')
    AND jsonb_array_length(k.value) <> 8;
  IF malas > 0 THEN
    RAISE EXCEPTION '% recetas |2T no quedaron con 8 lineas', malas;
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

  -- 4) La cinta quedó al valor de la fórmula.
  SELECT count(*) INTO malas
  FROM configuracion c
  WHERE c.clave = 'reglas_precios'
    AND (c.valor::jsonb) #> '{sistemas,beeblack,insumos,CIN0002}' IS NOT NULL
    AND ((c.valor::jsonb) #>> '{sistemas,beeblack,insumos,CIN0002,valorMaximo}')::numeric
        <> 19999.2;
  IF malas > 0 THEN
    RAISE EXCEPTION 'La cinta CIN0002 no quedo en 19999.2 en % filas', malas;
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
