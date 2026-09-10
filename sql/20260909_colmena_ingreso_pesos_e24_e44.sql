-- ─────────────────────────────────────────────────────────────────────
-- Ingreso manual de PESOS a la colmena — 2026-09-09
--
--   A17 · E24 (peso blanco) ×28
--   A19 · E44 (peso negro)  ×10
--   Total: 38 piezas
--
-- Es una carga ADITIVA: no toca ni una pieza de las que ya están. Se suma a
-- lo que haya hoy en A17 y A19; NO reemplaza el contenido de esos estantes.
-- ANTES DE CORRERLO conviene mirar qué hay (la consulta está al pie, en
-- «Qué hay hoy»): si esas piezas ya estaban cargadas, esto las duplicaría, y
-- un peso duplicado en el sistema es un peso que el optimizador va a
-- prometer y que en el galpón no existe.
--
-- POR QUÉ ADEMÁS SE ESCRIBE EL EVENTO `ingreso`: el trigger
-- `trigger_historial_colmena` solo registra los DELETE, no los INSERT, así
-- que una pieza cargada a mano queda sin historia. Sin `ingreso` es un
-- fantasma para la reconciliación, no tiene antigüedad en la vista de la
-- colmena, y si algún día le entra un `eliminado` el guard de zombies
-- (`check_tubo_no_zombie`) no la deja volver nunca más. Regla de la casa:
-- toda carga masiva a colmena escribe su `ingreso`.
--
-- EL UUID NO SE CAMBIA NUNCA después de esto: la pieza y su evento comparten
-- `tubo_raiz_id`, y el sync del optimizador revierte cualquier intento de
-- reasignarlo. Tampoco se usa `datos_extra` para la trazabilidad, porque el
-- sync completo la borra; por eso va en `tubos_historial`.
--
-- DESPUÉS DE CORRERLO: si alguien tiene el optimizador abierto de antes, su
-- lista en memoria no incluye estas 38 piezas y el próximo sync las borra
-- (el sync es DELETE + INSERT de toda la colmena). Que recargue el
-- optimizador antes de planificar el siguiente corte.
--
-- REVERSA:
--   DELETE FROM colmena_tubos
--    WHERE tubo_raiz_id IN (SELECT tubo_raiz_id FROM tubos_historial
--                            WHERE fuente = 'ingreso_manual_20260909');
--   (el DELETE dispara el trigger que deja su propio `eliminado`; después
--    borrar también los 38 `ingreso` de esa fuente si se quiere limpiar)
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Guard de idempotencia: si ya se corrió, abortar en vez de duplicar.
--    Estas son piezas físicas y no tienen llave natural: correr el script dos
--    veces crearía 38 pesos que no existen en el galpón.
DO $$
DECLARE
  v_ya integer;
BEGIN
  SELECT count(*) INTO v_ya
  FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND fuente = 'ingreso_manual_20260909';

  IF v_ya > 0 THEN
    RAISE EXCEPTION 'ABORTADO: esta carga ya se ejecutó (% eventos con fuente ingreso_manual_20260909). Correrla de nuevo duplicaría las 38 piezas.', v_ya;
  END IF;
END $$;

-- 2. Las 38 piezas, en el MISMO ORDEN de la planilla, con UUID propio cada
--    una y su evento `ingreso` en la misma transacción.
--
--    Las medidas repetidas NO son un error de tipeo ni se deduplican: dos
--    pesos de 139 cm en A17 son dos piezas distintas que están las dos en el
--    estante. Lo mismo los dos de 218,5.
WITH nuevos(orden, cod, medida_cm, ubic) AS (VALUES
  ( 1, 'E24', 253.4, 'A17'),
  ( 2, 'E24', 218.5, 'A17'),
  ( 3, 'E24', 139.0, 'A17'),
  ( 4, 'E24', 139.0, 'A17'),
  ( 5, 'E24', 137.3, 'A17'),
  ( 6, 'E24', 132.8, 'A17'),
  ( 7, 'E24', 132.0, 'A17'),
  ( 8, 'E24', 131.7, 'A17'),
  ( 9, 'E24', 127.8, 'A17'),
  (10, 'E24', 125.5, 'A17'),
  (11, 'E24', 109.0, 'A17'),
  (12, 'E24', 100.5, 'A17'),
  (13, 'E24', 136.0, 'A17'),
  (14, 'E24', 134.2, 'A17'),
  (15, 'E24', 134.5, 'A17'),
  (16, 'E24', 140.5, 'A17'),
  (17, 'E24', 148.0, 'A17'),
  (18, 'E24', 153.7, 'A17'),
  (19, 'E24', 169.9, 'A17'),
  (20, 'E24', 130.0, 'A17'),
  (21, 'E24', 153.0, 'A17'),
  (22, 'E24', 158.0, 'A17'),
  (23, 'E24', 150.0, 'A17'),
  (24, 'E24', 119.5, 'A17'),
  (25, 'E24', 125.0, 'A17'),
  (26, 'E24', 205.0, 'A17'),
  (27, 'E24', 288.6, 'A17'),
  (28, 'E24', 218.5, 'A17'),
  (29, 'E44', 104.6, 'A19'),
  (30, 'E44', 119.5, 'A19'),
  (31, 'E44', 137.0, 'A19'),
  (32, 'E44', 151.6, 'A19'),
  (33, 'E44', 154.0, 'A19'),
  (34, 'E44', 154.5, 'A19'),
  (35, 'E44', 162.5, 'A19'),
  (36, 'E44', 170.0, 'A19'),
  (37, 'E44', 221.0, 'A19'),
  (38, 'E44', 249.5, 'A19')
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
  'Ingreso manual a la colmena del 2026-09-09 (planilla del dueño): 28 pesos E24 a A17 y 10 pesos E44 a A19.',
  'ingreso_manual_20260909'
FROM insertados i;

-- 3. Aserción: o entran las 38 con sus 38 eventos, o no entra nada.
DO $$
DECLARE
  v_ev integer;
  v_tb integer;
BEGIN
  SELECT count(*) INTO v_ev
  FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND fuente = 'ingreso_manual_20260909';

  SELECT count(*) INTO v_tb
  FROM colmena_tubos c
  WHERE c.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND EXISTS (
      SELECT 1 FROM tubos_historial t
      WHERE t.tubo_raiz_id = c.tubo_raiz_id
        AND t.fuente = 'ingreso_manual_20260909'
    );

  IF v_ev <> 38 OR v_tb <> 38 THEN
    RAISE EXCEPTION 'ABORTADO: quedaron % piezas y % eventos, se esperaban 38 y 38 — rollback completo.', v_tb, v_ev;
  END IF;
END $$;

COMMIT;

-- ── Qué hay hoy (CORRER ANTES, para no duplicar) ──
-- SELECT n_colmena, cod, count(*) AS piezas,
--        string_agg(medida_cm::text, ' · ' ORDER BY medida_cm) AS medidas
-- FROM colmena_tubos
-- WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--   AND (n_colmena IN ('A17','A19') OR cod IN ('E24','E44'))
-- GROUP BY n_colmena, cod
-- ORDER BY n_colmena, cod;
--
-- Si A17 ya muestra pesos E24 con estas mismas medidas, la planilla es un
-- recuento de lo que ya está cargado y NO hay que correr este script: habría
-- que contar el estante y corregir, no sumar.

-- ── Verificación (correr después) ──
-- SELECT c.n_colmena, c.cod, c.medida_cm, c.medida_mm, c.disponible
-- FROM colmena_tubos c
-- JOIN tubos_historial t ON t.tubo_raiz_id = c.tubo_raiz_id
--                       AND t.fuente = 'ingreso_manual_20260909'
-- WHERE c.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
-- ORDER BY c.n_colmena, c.cod, c.medida_cm;
--
-- Esperado: 38 filas — 28 en A17 (todas E24) y 10 en A19 (todas E44).
