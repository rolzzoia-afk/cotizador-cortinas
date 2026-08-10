-- ═══════════════════════════════════════════════════════════════════════
-- CENEFAS CONTAGIADAS POR UBICACIÓN COMPARTIDA
--
-- Correr COMPLETO en el SQL Editor de Supabase. Es idempotente.
--
-- El problema (OT 3169): la cenefa ovalada se vinculaba a la cortina por el
-- TEXTO de la UBIC., y la ubicación NO identifica una cortina — el sufijo
-- -G1/-G2 solo separa los paños DENTRO de una misma ventana. Con tres cortinas
-- escritas «PPAL» (un soft light de 2,81 m y dos roller), la única cenefa
-- comprada quedó marcada en las TRES: el taller cortaba tres y se cobraba una.
--
-- El código ya no lo hace (ahora decide por CATEGORÍA: la cortina que lleva
-- cenefa por diseño se la queda), pero el dato viejo sigue guardado en la OT y
-- hay que borrarlo a mano: el enriquecimiento solo RELLENA campos vacíos, nunca
-- los limpia.
--
-- Paños a limpiar (relevados el 2026-08-10 sobre las 90 OTs de la base). En las
-- tres OTs el contagiado es siempre un roller SIMPLE que comparte ubicación con
-- una cortina que sí lleva cenefa por diseño:
--   · OT 3169  «PPAL» — 2 roller ROL (1,357 y 1,455) junto a un SOFT_LIGHT_45mm
--     de 2,81. La OT está EN PRODUCCIÓN.
--   · OT 268-4 «PPAL» — el mismo caso (es una copia de la 3169).
--   · OT 267-17 «ROLZZO.1» y «ROLZZO.2» — 1 roller ROL de 2,5 en cada una, junto
--     a un ROL_MANUAL_CENEFA_OVALADA_45mm del mismo ancho.
--
-- El criterio del UPDATE es el mismo del relevamiento: categoría ROL (roller
-- simple, que NO lleva cenefa por diseño) + cenefa 'Ovalada' guardada, dentro de
-- las tres OTs nombradas. No toca ninguna otra cortina.
--
-- CORRERLO ANTES de volver a abrir esas OTs en el cotizador: con el dato viejo,
-- la corrección del cobro (una cenefa manual tapa UNA cortina, no todas las de
-- la ubicación) haría aparecer una línea de cenefa de más en la cotización.
--
-- Alternativa sin SQL: en las OTs que están en COTIZACIÓN (268-4 y 267-17)
-- alcanza con poner la cenefa en «No» desde Fase 2, que es más seguro. Este
-- script existe sobre todo por la 3169, que está en producción y no se edita
-- desde la pantalla.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 0) Respaldo ────────────────────────────────────────────────────────
-- Copia completa de las 3 OTs antes de tocarlas. Para revertir:
--   UPDATE ots o SET items = b.items
--   FROM ots_backup_20260810_cenefas b WHERE o.id = b.id;
DROP TABLE IF EXISTS ots_backup_20260810_cenefas;
CREATE TABLE ots_backup_20260810_cenefas AS
SELECT * FROM ots
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND numero_ot IN ('3169', '268-4', '267-17');

-- ── 1) Antes: qué se va a limpiar (deben salir 6 filas) ────────────────
SELECT o.numero_ot,
       v->>'ubicacion'  AS ubic,
       v->>'categoria'  AS categoria,
       p->>'ancho'      AS ancho,
       p->>'cenefa'     AS cenefa
FROM ots o
     CROSS JOIN LATERAL jsonb_array_elements(o.items) AS v
     CROSS JOIN LATERAL jsonb_array_elements(v->'panos') AS p
WHERE o.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND o.numero_ot IN ('3169', '268-4', '267-17')
  AND v->>'categoria' = 'ROL'
  AND p->>'cenefa' = 'Ovalada'
ORDER BY o.numero_ot, ubic, ancho;

-- ── 2) Limpieza ────────────────────────────────────────────────────────
-- Reconstruye `items` sacando cenefa/cenefaTira/colorTapa SOLO de los paños
-- que cumplen el criterio. `coalesce(..., '[]'::jsonb)` protege a las ventanas
-- sin paños: jsonb_agg sobre un conjunto vacío devuelve NULL y dejaría la
-- ventana rota.
BEGIN;

UPDATE ots o
SET items = (
  SELECT coalesce(jsonb_agg(
           CASE
             WHEN v->>'categoria' = 'ROL' AND jsonb_typeof(v->'panos') = 'array'
             THEN jsonb_set(v, '{panos}', (
                    SELECT coalesce(jsonb_agg(
                             CASE WHEN p->>'cenefa' = 'Ovalada'
                                  THEN p - 'cenefa' - 'cenefaTira'
                                  ELSE p END
                             ORDER BY pi),
                           '[]'::jsonb)
                    FROM jsonb_array_elements(v->'panos') WITH ORDINALITY AS tp(p, pi)
                  ))
             ELSE v
           END
           ORDER BY vi),
         '[]'::jsonb)
  FROM jsonb_array_elements(o.items) WITH ORDINALITY AS tv(v, vi)
)
WHERE o.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND o.numero_ot IN ('3169', '268-4', '267-17')
  AND jsonb_typeof(o.items) = 'array';

-- Aserción: si quedó alguna, se aborta y no se guarda nada.
DO $$
DECLARE v_quedan integer;
BEGIN
  SELECT count(*) INTO v_quedan
  FROM ots o
       CROSS JOIN LATERAL jsonb_array_elements(o.items) AS v
       CROSS JOIN LATERAL jsonb_array_elements(v->'panos') AS p
  WHERE o.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND o.numero_ot IN ('3169', '268-4', '267-17')
    AND v->>'categoria' = 'ROL'
    AND p->>'cenefa' = 'Ovalada';
  IF v_quedan <> 0 THEN
    RAISE EXCEPTION 'Quedaron % paños ROL con cenefa Ovalada: no se limpió nada', v_quedan;
  END IF;
  RAISE NOTICE 'Limpieza OK: ningún roller conserva la cenefa contagiada';
END $$;

COMMIT;

-- ── 3) Después: el soft light y el dúo CONSERVAN su cenefa ─────────────
-- Tienen que seguir apareciendo las cortinas que sí la llevan (SOFT_LIGHT_45mm
-- en la 3169/268-4, y el dúo de VISITA).
--
--    SELECT o.numero_ot, v->>'ubicacion' AS ubic, v->>'categoria' AS categoria,
--           p->>'ancho' AS ancho, p->>'cenefa' AS cenefa
--    FROM ots o
--         CROSS JOIN LATERAL jsonb_array_elements(o.items) AS v
--         CROSS JOIN LATERAL jsonb_array_elements(v->'panos') AS p
--    WHERE o.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND o.numero_ot IN ('3169', '268-4', '267-17')
--      AND p->>'cenefa' IS NOT NULL
--    ORDER BY o.numero_ot, ubic;

-- ── Pendientes operativos (NO son SQL) ─────────────────────────────────
-- · La OT 3169 YA SALIÓ AL TALLER con las tres cenefas en el Excel de órdenes.
--   Antes de reemitir los documentos hay que preguntar en producción si las
--   cortaron: si ya están cortadas, son merma y hay que darlas de baja; si no,
--   el Excel nuevo saldrá con una sola.
-- · La cotización de esas OTs cobraba UNA cenefa por ubicación y así queda: el
--   precio no cambia, porque las cortinas que pierden la cenefa son las que no
--   se estaban cobrando.
-- · En la 267-17 las dos líneas CENF O manuales tienen cantidad 1 (el default
--   del formulario) en vez del ancho real de 2,5 m: se está cobrando 1 metro de
--   cenefa en lugar de 2,5. Eso es aparte de este arreglo — hay que corregirlo
--   a mano en Fase 1 si la cotización sigue viva.
