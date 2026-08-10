-- ═══════════════════════════════════════════════════════════════════════
-- CENEFA OVALADA GUARDADA COMO «SIN TIRA» POR UN DEFAULT EQUIVOCADO
--
-- Correr COMPLETO en el SQL Editor de Supabase. Es idempotente.
--
-- El problema: la cenefa ovalada va CON TIRA por default desde el 2026-07-20, y
-- así la leen la pantalla, la etiqueta, el Excel de órdenes y el cálculo general.
-- Pero el enriquecimiento de Fase 0 → Fase 2 traducía «el adicional no dice
-- nada» como SIN TIRA y lo ESCRIBÍA en el paño, ganándole al default. La cenefa
-- cargada a mano en Fase 1 nunca dice nada, porque esa pantalla no tiene el
-- interruptor de la tira. Resultado: la cortina salía sin tira sin que nadie lo
-- eligiera (OT 268-5).
--
-- El código ya no lo hace, pero el dato viejo sigue guardado: el enriquecimiento
-- solo rellena campos vacíos, nunca los corrige.
--
-- Alcance (relevado el 2026-08-10 sobre las 90 OTs): 24 paños ovalados dicen SIN
-- TIRA. De esos, 8 son del SIMULADOR - DANIEL y traen la tira apagada A PROPÓSITO
-- (su adicional lleva el dato explícito) — esos NO se tocan. Los 16 restantes
-- están en estas 6 OTs y vienen del default equivocado:
--   · 266-9  (cotización) — 6 paños · ROL_MANUAL_CENEFA_OVALADA_38mm
--   · 9999   (cotización) — 5 paños · OT de prueba
--   · 267-17 (cotización) — 2 paños · ROL_MANUAL_CENEFA_OVALADA_45mm
--   · 268-4  (cotización) — 1 paño  · SOFT_LIGHT_45mm
--   · 268-5  (cotización) — 1 paño  · SOFT_LIGHT_45mm
--   · 3169   (PRODUCCIÓN) — 1 paño  · SOFT_LIGHT_45mm
--
-- DOS ADVERTENCIAS antes de correrlo:
--
-- 1) La OT 3169 YA SALIÓ AL TALLER con la etiqueta que dice SIN TIRA. Si esa
--    cortina ya se armó, corregir el dato hace que los documentos dejen de
--    coincidir con lo fabricado. Preguntar en producción antes.
--
-- 2) El dato no distingue una tira apagada a mano de una escrita por el default:
--    en estas 6 OTs el adicional no trae el campo, así que el criterio es «venía
--    del default». Si alguna de esas cortinas de verdad iba sin tira, hay que
--    volver a apagarla desde Fase 2.
--
-- Para las OTs en cotización alcanza con tocar CON TIRA en Fase 2, que es más
-- seguro. Este script existe sobre todo por la 3169, que no se edita desde la
-- pantalla.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 0) Respaldo ────────────────────────────────────────────────────────
-- Para revertir:
--   UPDATE ots o SET items = b.items
--   FROM ots_backup_20260810_tira b WHERE o.id = b.id;
DROP TABLE IF EXISTS ots_backup_20260810_tira;
CREATE TABLE ots_backup_20260810_tira AS
SELECT * FROM ots
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND numero_ot IN ('266-9', '9999', '267-17', '268-4', '268-5', '3169');

-- ── 1) Antes: qué se va a corregir (deben salir 16 filas) ──────────────
SELECT o.numero_ot,
       o.estado,
       v->>'ubicacion' AS ubic,
       v->>'categoria' AS categoria,
       p->>'ancho'     AS ancho,
       p->>'cenefaTira' AS tira
FROM ots o
     CROSS JOIN LATERAL jsonb_array_elements(o.items) AS v
     CROSS JOIN LATERAL jsonb_array_elements(v->'panos') AS p
WHERE o.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND o.numero_ot IN ('266-9', '9999', '267-17', '268-4', '268-5', '3169')
  AND p->>'cenefa' = 'Ovalada'
  AND upper(p->>'cenefaTira') = 'SIN TIRA'
ORDER BY o.numero_ot, ubic, ancho;

-- ── 2) Corrección ──────────────────────────────────────────────────────
-- Reconstruye `items` poniendo CON TIRA solo en los paños ovalados que dicen
-- SIN TIRA. `coalesce(..., '[]'::jsonb)` protege a las ventanas sin paños:
-- jsonb_agg sobre un conjunto vacío devuelve NULL y dejaría la ventana rota.
BEGIN;

UPDATE ots o
SET items = (
  SELECT coalesce(jsonb_agg(
           CASE
             WHEN jsonb_typeof(v->'panos') = 'array'
             THEN jsonb_set(v, '{panos}', (
                    SELECT coalesce(jsonb_agg(
                             CASE WHEN p->>'cenefa' = 'Ovalada'
                                   AND upper(p->>'cenefaTira') = 'SIN TIRA'
                                  THEN jsonb_set(p, '{cenefaTira}', '"CON TIRA"'::jsonb)
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
  AND o.numero_ot IN ('266-9', '9999', '267-17', '268-4', '268-5', '3169')
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
    AND o.numero_ot IN ('266-9', '9999', '267-17', '268-4', '268-5', '3169')
    AND p->>'cenefa' = 'Ovalada'
    AND upper(p->>'cenefaTira') = 'SIN TIRA';
  IF v_quedan <> 0 THEN
    RAISE EXCEPTION 'Quedaron % cenefas ovaladas SIN TIRA: no se corrigió nada', v_quedan;
  END IF;
  RAISE NOTICE 'Corrección OK: todas las cenefas ovaladas de esas OTs quedaron CON TIRA';
END $$;

COMMIT;

-- ── 3) Después: control ────────────────────────────────────────────────
-- Las 16 filas de arriba tienen que aparecer ahora como CON TIRA, y el SIMULADOR
-- tiene que conservar sus 8 SIN TIRA (no está en la lista, así que no se tocó).
--
--    SELECT o.numero_ot, v->>'ubicacion' AS ubic, p->>'cenefaTira' AS tira, count(*)
--    FROM ots o
--         CROSS JOIN LATERAL jsonb_array_elements(o.items) AS v
--         CROSS JOIN LATERAL jsonb_array_elements(v->'panos') AS p
--    WHERE o.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND p->>'cenefa' = 'Ovalada'
--    GROUP BY 1, 2, 3
--    ORDER BY 1, 2;
