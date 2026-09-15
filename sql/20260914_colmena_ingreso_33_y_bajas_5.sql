-- ─────────────────────────────────────────────────────────────────────
-- Colmena de tubos — 2026-09-14: ingresan 33 piezas y salen 5
--
-- Los pasó el dueño en dos tablas, «Ingresar» (COD · MEDIDA · UBICACIÓN)
-- y «Eliminar» (COD · MEDIDA):
--
--   INGRESAR (33)
--     A25 · E63 ×12 : 77,8 · 110,4 · 133 · 134,2 · 134,8 · 134,8 · 135,6 ·
--                     144,4 · 146,8 · 150,7 · 196 · 205
--     A27 · E64 ×3  : 137,1 · 182,5 · 225,8
--     A28 · E16 ×1  : 162,5
--     B2  · E61 ×4  : 107 · 116,1 · 218,5 · 239
--     L03 · E63 ×7  : 276,8 · 314,2 · 324,1 · 327,1 · 339,5 · 425,4 · 557
--     L03 · E64 ×5  : 303 · 335 · 394 · 434 · 466
--     L03 · E61 ×1  : 428
--
--   ELIMINAR (5)
--     E16 163,6 (A29) · E61 279,7 (L03) · E63 137,6 (L02) ·
--     E63 145,4 (L03) · E64 154,7 (A27)
--
-- YA CORRIDO el 2026-09-14 (~17:36 UTC). Resultado real: entraron las 33 con
-- sus 33 eventos `ingreso`, y de las 5 bajas salieron 4. La colmena quedó en
-- 616 tubos.
--
-- ⚠️ LA QUINTA NO SE ELIMINÓ PORQUE YA NO ESTABA: el E61 de 279,7 lo cortó el
--    optimizador a las 17:35:59 UTC —90 segundos antes de esta carga— para la
--    OT #3244 (corte de 108,5 cm, sobrante de 170,9 cm que hoy está en L03).
--    O sea, la planilla se escribió ANTES de ese corte. Vale la pena
--    confirmarlo en el galpón: si en la planilla iba a «Eliminar» porque el
--    tubo físicamente no está, entonces la OT #3244 se planificó sobre un
--    tubo inexistente y al taller le va a faltar ese E61.
--
-- El ingreso es ADITIVO: no toca ninguna de las piezas que ya están en esos
-- estantes. Verificado antes de escribir esto que ninguna de las 33
-- combinaciones cód+medida+ubicación existe hoy en `colmena_tubos`, y que
-- A25, A27, A28, B2 y L03 son ubicaciones vigentes.
--
-- Las medidas repetidas NO son un error de tipeo ni se deduplican: los dos
-- E63 de 134,8 en A25 son dos tubos distintos que están los dos en el
-- estante.
--
-- ⚠️ E16 · 162,5 · A28 — la planilla dice A28, y así se carga. Vale la pena
--    mirarlo en el galpón: hoy TODOS los E16 viven en A29 (12 piezas, entre
--    ellas la de 163,6 que se elimina en este mismo script) y en L03; en A28
--    solo hay E13 y E64. Si fue un desliz por A29, se corrige con:
--      UPDATE colmena_tubos SET n_colmena = 'A29'
--       WHERE tubo_raiz_id IN (SELECT tubo_raiz_id FROM tubos_historial
--                               WHERE fuente = 'ingreso_manual_20260914')
--         AND cod = 'E16';
--    (los estantes mezclan códigos a propósito, así que A28 no es imposible)
--
-- POR QUÉ ADEMÁS SE ESCRIBE EL EVENTO `ingreso`: el trigger
-- `trigger_historial_colmena` solo registra los DELETE, no los INSERT, así
-- que un tubo cargado a mano queda sin historia. Sin `ingreso` es un
-- fantasma para la reconciliación, no tiene antigüedad en la vista de la
-- colmena, y si algún día le entra un `eliminado` el guard de zombies
-- (`check_tubo_no_zombie`) no lo deja volver nunca más. Regla de la casa:
-- toda carga masiva a colmena escribe su `ingreso`.
--
-- EL UUID NO SE CAMBIA NUNCA después de esto: el tubo y su evento comparten
-- `tubo_raiz_id`, y el sync del optimizador revierte cualquier intento de
-- reasignarlo. Tampoco se usa `datos_extra` para la trazabilidad, porque el
-- sync completo la borra; por eso va en `tubos_historial`.
--
-- LAS BAJAS no necesitan escribir su evento: el trigger de BD deja el
-- `eliminado` solo (paso 3 apenas le pone la `fuente` para poder rastrearlo).
-- Ese `eliminado` es además lo que impide que el próximo sync del optimizador
-- las resucite si alguien tenía la lista vieja en memoria.
--
-- ⚠️ DESPUÉS DE CORRERLO: el sync del optimizador es DELETE + INSERT de TODA
-- la colmena desde la lista que el navegador tiene en memoria. Si alguien
-- dejó el optimizador abierto de antes, su lista no incluye estas 33 piezas
-- y el próximo guardado se las lleva EN SILENCIO (durante el sync el trigger
-- no registra las eliminaciones). Que recargue el optimizador antes de
-- planificar el siguiente corte. Hoy hubo sync a las 15:51 UTC.
--
-- REVERSA:
--   -- deshacer el ingreso de las 33:
--   DELETE FROM colmena_tubos
--    WHERE tubo_raiz_id IN (SELECT tubo_raiz_id FROM tubos_historial
--                            WHERE fuente = 'ingreso_manual_20260914');
--   -- deshacer las 5 bajas (hay que revivirlas con un `ingreso` posterior,
--   -- si no el guard de zombies bloquea el INSERT):
--   INSERT INTO tubos_historial (empresa_id, tubo_raiz_id, n_colmena, cod,
--          medida_cm, evento, registrado_por, notas, fuente)
--   SELECT empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, 'ingreso',
--          'admin', 'Reversa de la baja del 2026-09-14', 'reversa_baja_20260914'
--     FROM tubos_historial WHERE fuente = 'baja_manual_20260914';
--   -- y recién ahí reinsertarlas en colmena_tubos con esos mismos tubo_raiz_id.
-- ─────────────────────────────────────────────────────────────────────

-- ── Qué hay hoy (CORRER ANTES, para no duplicar) ──
-- SELECT n_colmena, cod, count(*) AS piezas,
--        string_agg(medida_cm::text, ' · ' ORDER BY medida_cm) AS medidas
-- FROM colmena_tubos
-- WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--   AND cod IN ('E16','E61','E63','E64')
-- GROUP BY n_colmena, cod ORDER BY cod, n_colmena;
--
-- Si alguno de esos estantes ya muestra estas mismas medidas, la planilla es
-- un recuento de lo que ya está cargado y NO hay que correr el paso 1: habría
-- que contar el estante y corregir, no sumar.


-- ═══ 1. Las 33 que entran ═══════════════════════════════════════════
-- Una sola sentencia: los tubos y sus 33 eventos `ingreso` viajan en la
-- misma transacción y con el mismo `tubo_raiz_id`. El CROSS JOIN con `guard`
-- la hace idempotente: si ya se corrió, inserta 0 en vez de duplicar 33
-- tubos que en el galpón no existen.
WITH nuevos(orden, cod, medida_cm, ubic) AS (VALUES
  ( 1, 'E63',  77.8, 'A25'),
  ( 2, 'E63', 110.4, 'A25'),
  ( 3, 'E63', 133.0, 'A25'),
  ( 4, 'E63', 134.2, 'A25'),
  ( 5, 'E63', 134.8, 'A25'),
  ( 6, 'E63', 134.8, 'A25'),
  ( 7, 'E63', 135.6, 'A25'),
  ( 8, 'E64', 137.1, 'A27'),
  ( 9, 'E63', 144.4, 'A25'),
  (10, 'E63', 146.8, 'A25'),
  (11, 'E63', 150.7, 'A25'),
  (12, 'E16', 162.5, 'A28'),
  (13, 'E64', 182.5, 'A27'),
  (14, 'E63', 196.0, 'A25'),
  (15, 'E63', 205.0, 'A25'),
  (16, 'E64', 225.8, 'A27'),
  (17, 'E63', 276.8, 'L03'),
  (18, 'E63', 314.2, 'L03'),
  (19, 'E63', 324.1, 'L03'),
  (20, 'E63', 327.1, 'L03'),
  (21, 'E63', 339.5, 'L03'),
  (22, 'E63', 425.4, 'L03'),
  (23, 'E63', 557.0, 'L03'),
  (24, 'E64', 303.0, 'L03'),
  (25, 'E64', 335.0, 'L03'),
  (26, 'E64', 394.0, 'L03'),
  (27, 'E64', 434.0, 'L03'),
  (28, 'E64', 466.0, 'L03'),
  (29, 'E61', 107.0, 'B2'),
  (30, 'E61', 116.1, 'B2'),
  (31, 'E61', 218.5, 'B2'),
  (32, 'E61', 239.0, 'B2'),
  (33, 'E61', 428.0, 'L03')
),
guard AS (
  SELECT count(*) AS ya
  FROM tubos_historial
  WHERE empresa_id::text = '67c635a5-152c-4780-a066-23f5081175a9'
    AND fuente = 'ingreso_manual_20260914'
),
insertados AS (
  INSERT INTO colmena_tubos (
    empresa_id, n_colmena, cod, medida_cm, medida_mm,
    serial, tubo_raiz_id, disponible, agregado_por_admin
  )
  SELECT
    '67c635a5-152c-4780-a066-23f5081175a9',
    n.ubic,
    n.cod,
    n.medida_cm,
    n.medida_cm * 10,          -- misma convención que el resto de la tabla
    NULL,
    gen_random_uuid(),
    true,
    false                      -- el sync lo pone en false igual; se deja igual
  FROM nuevos n
  CROSS JOIN guard g
  WHERE g.ya = 0
  RETURNING tubo_raiz_id, n_colmena, cod, medida_cm
)
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9',
  i.tubo_raiz_id,
  i.n_colmena,
  i.cod,
  i.medida_cm,
  'ingreso',
  'admin',
  'Ingreso manual a la colmena del 2026-09-14 (planilla del dueño): 12 E63 a A25, 3 E64 a A27, 1 E16 a A28, 4 E61 a B2 y 13 a L03 (7 E63, 5 E64, 1 E61).',
  'ingreso_manual_20260914'
FROM insertados i;


-- ═══ 2. Las 5 que salen ═════════════════════════════════════════════
-- Cada par cód+medida apunta hoy a UNA sola pieza (verificado); por eso
-- alcanza con la medida, sin la ubicación. El trigger `trg_historial_colmena`
-- escribe el `eliminado` de cada una por su cuenta.
DELETE FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND (cod, medida_cm) IN (
    ('E16', 163.6),   -- A29
    ('E61', 279.7),   -- L03
    ('E63', 137.6),   -- L02
    ('E63', 145.4),   -- L03
    ('E64', 154.7)    -- A27
  );


-- ═══ 3. Firmar las bajas ════════════════════════════════════════════
-- El trigger deja el `eliminado` sin `fuente` (registrado_por='sistema').
-- Se la ponemos para poder rastrear y revertir el lote.
UPDATE tubos_historial
SET fuente = 'baja_manual_20260914',
    notas  = 'Baja manual de la colmena del 2026-09-14 (planilla del dueño, tabla «Eliminar»).'
WHERE empresa_id::text = '67c635a5-152c-4780-a066-23f5081175a9'
  AND evento = 'eliminado'
  AND fuente IS NULL
  AND created_at > now() - interval '10 minutes'
  AND (cod, medida_cm) IN (
    ('E16', 163.6), ('E61', 279.7), ('E63', 137.6), ('E63', 145.4), ('E64', 154.7)
  );


-- ── Verificación (correr después) ──
-- SELECT c.n_colmena, c.cod, c.medida_cm, c.medida_mm, c.disponible
-- FROM colmena_tubos c
-- JOIN tubos_historial t ON t.tubo_raiz_id = c.tubo_raiz_id
--                       AND t.fuente = 'ingreso_manual_20260914'
-- WHERE c.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
-- ORDER BY c.n_colmena, c.cod, c.medida_cm;
--
-- Esperado: 33 filas. El total de la colmena quedó en 616 (no 615: la quinta
-- baja ya se la había llevado el corte de la OT #3244).
