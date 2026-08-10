-- ═══════════════════════════════════════════════════════════════════════
-- CADENAS — lineup vigente (2026-08-10)
--
-- Correr COMPLETO en el SQL Editor de Supabase. Es idempotente.
--
-- Bodega reordenó las cadenas de mando. El lineup que la app tiene que ver:
--   1,2 metros (60 cm de caída) → CAD07 blanco · CAD08 negro · CAD17 gris
--   1,6 metros (80 cm de caída) → CAD11 blanco · CAD12 negro · CAD21 gris
--   2,4 metros                  → CAD16 blanco · CAD14 negro · CAD20 gris
--   3 metros                    → CAD06 blanco · CAD04 negro · CAD01 gris
--   4 metros                    → CAD05 blanco · CAD03 negro · CAD02 gris
--
-- (El largo del lazo es el doble de la caída: la propia ficha de CAD11 lo dice,
-- «80CM (160CM REAL)». Por eso la de 80 cm y la de 1,6 m son la misma cadena.)
--
-- Lo que cambia respecto de lo que hay hoy en `insumos`:
--   · CAD11/CAD12 se llamaban "CADENA BLANCA/NEGRO 80 CM SIN FIN" y figuran
--     AGOTADAS. Son las de 1,6 m: se les pone el nombre nuevo.
--   · CAD17 era la BLANCA de 1,40 m (70 cm) y pasa a ser la GRIS de 1,2 m.
--   · CAD18/CAD19 (1,40 m negro y gris) salen de circulación → AGOTADO. Las OTs
--     viejas que las tengan las siguen resolviendo por su nombre; solo dejan de
--     ofrecerse y de auto-seleccionarse.
--   · CAD21 (gris de 1,6 m) no existe: se da de alta.
--
-- La app acompaña este cambio: el peldaño bajo del roller (0,5–0,8 m) pide la
-- de 1,2 m en vez de la de 1,40, y el dúo estrena escalera propia
-- (≥2,1 → 4 m · ≥1,6 → 3 m · ≥1,4 → 2,4 m · ≥0,9 → 1,6 m · ≥0,6 → 1,2 m).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1,2 metros (60 cm) ────────────────────────────────────────────────
UPDATE insumos SET nemotecnico = 'CADENA INFINITA 1,2 METROS - 60 CM [BLANCO]'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND cod = 'CAD07';

UPDATE insumos SET nemotecnico = 'CADENA INFINITA 1,2 METROS - 60 CM [NEGRO]'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND cod = 'CAD08';

-- CAD17 deja de ser la blanca de 1,40 m: ahora es la GRIS de 1,2 m.
UPDATE insumos
SET nemotecnico = 'CADENA INFINITA 1,2 METROS - 60 CM [GRIS]',
    color = 'GRIS',
    status = 'OK'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND cod = 'CAD17';

-- ── 1,6 metros (80 cm) ────────────────────────────────────────────────
-- Ojo con `status`: si CAD11/CAD12/CAD21 no tienen stock físico, dejalas en
-- AGOTADO (comentá las líneas de status). Una cadena agotada no se elige sola,
-- y la escalera del dúo la necesita para los altos de 0,9 a 1,4 m.
UPDATE insumos
SET nemotecnico = 'CADENA INFINITA 1,6 METROS - 80 CM [BLANCO]',
    status = 'OK'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND cod = 'CAD11';

UPDATE insumos
SET nemotecnico = 'CADENA INFINITA 1,6 METROS - 80 CM [NEGRO]',
    status = 'OK'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND cod = 'CAD12';

-- CAD21 gris de 1,6 m: nueva, con la misma forma que las otras cadenas dadas
-- de alta a mano (CAD17/CAD20) y el mismo molde que el alta del tubo E78.
-- `stock_total` NO se escribe: es una columna GENERADA (stock_mp + liberado).
INSERT INTO insumos (empresa_id, cod, categoria, sub_categoria, producto,
                     nemotecnico, color, status, minimo,
                     stock_mp, stock_liberado, can_x_paquete, estado_inventario)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'CAD21', 'INSUMO', 'CADENA',
        'ROLLER/DUO', 'CADENA INFINITA 1,6 METROS - 80 CM [GRIS]', 'GRIS',
        'OK', 0, 0, 0, 1, 'ACTIVO')
ON CONFLICT (empresa_id, cod) DO NOTHING;

-- ── 1,40 metros (70 cm): fuera de circulación ─────────────────────────
UPDATE insumos SET status = 'AGOTADO'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND cod IN ('CAD18', 'CAD19')
  AND status <> 'AGOTADO';

COMMIT;

-- ── Verificación ───────────────────────────────────────────────────────
-- Tienen que salir 5 largos × 3 colores en OK, y CAD18/CAD19 en AGOTADO.
--
--    SELECT cod, nemotecnico, color, status
--    FROM insumos
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND cod LIKE 'CAD%'
--    ORDER BY cod;

-- ── Pendientes operativos (NO son SQL) ─────────────────────────────────
-- · OTs vivas que hoy tienen una de las cadenas tocadas (revisado 2026-08-10,
--   sobre las 90 OTs de la base): TRES paños, y dos son de la OT de prueba 999.
--     · OT 3169 «VISITA» — dúo de 1,93 m con CAD17 blanco (1,40 m).
--     · OT 999 «PIEZA 2» — dúo de 2,30 m con CAD19 gris (1,40 m).
--     · OT 999 «LIVING»  — dúo motor: no lleva cadena, no se toca.
--   Al abrir Fase 2, la de CAD17 se recalcula sola por la escalera nueva (dúo
--   1,93 m → 3 m, CAD06 blanco), porque el largo de 1,40 m ya no existe en
--   ningún color. La de CAD19 conserva su cadena hasta que se le toque el alto
--   o el color: CAD19 no cambia de color, solo deja de ofrecerse.
-- · Si CAD11/CAD12/CAD21 quedan sin stock, la escalera del dúo no encuentra la
--   de 1,6 m para los altos de 0,9 a 1,4 m y esa cortina sale sin cadena
--   automática (la elige la vendedora en Fase 2).
