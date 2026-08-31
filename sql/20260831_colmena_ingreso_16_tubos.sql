-- ─────────────────────────────────────────────────────────────────────
-- Ingreso manual de 16 tubos a la colmena — 2026-08-31
--
-- YA CORRIDO el 2026-08-31. Verificado: entraron los 16 con sus 16 eventos
-- `ingreso`; ese mismo día el optimizador ya consumió 8 (cortes de las 18:15
-- y 19:15, con sus eventos `corte`/`merma`) y los otros 8 siguen disponibles.
-- Queda acá como registro. El guard de idempotencia aborta si se vuelve a
-- correr, así que es seguro tenerlo en el repo.
--
-- Los pasó el dueño en una tabla «Ingresar» (COD · MEDIDA · UBICACIÓN):
--
--   A35 · E02 ×10 : 78,2 · 123,2 · 130 · 133,2 · 133,5 · 145 · 229,7 ·
--                   240,2 · 242 · 249,5
--   A35 · E03 ×3  : 82 · 202,7 · 205,6
--   A35 · E66 ×1  : 131,2
--   L02 · E66 ×1  : 340,1
--   L02 · E02 ×1  : 466,6
--
-- Es una carga ADITIVA: no toca ni un tubo de los que ya están. Verificado
-- antes de escribir esto que ninguna de las 16 combinaciones cód+medida+ubic
-- existe hoy en colmena_tubos, y que A35 y L02 son ubicaciones vigentes.
--
-- POR QUÉ ADEMÁS SE ESCRIBE EL EVENTO `ingreso`: el trigger
-- `trigger_historial_colmena` solo registra los DELETE, no los INSERT, así
-- que un tubo cargado a mano queda sin historia. Un tubo sin `ingreso` es un
-- fantasma para la reconciliación, y si algún día le entra un `eliminado` el
-- guard de zombies (`check_tubo_no_zombie`) no lo deja volver nunca más.
-- Regla de la casa: toda carga masiva a colmena escribe su `ingreso`.
--
-- EL UUID NO SE CAMBIA NUNCA después de esto: el tubo de colmena y su evento
-- comparten `tubo_raiz_id`, y el sync del optimizador revierte cualquier
-- intento de reasignarlo. Tampoco se usa `datos_extra` para la trazabilidad
-- porque el sync completo la borra; por eso va en `tubos_historial`.
--
-- REVERSA:
--   DELETE FROM colmena_tubos
--    WHERE tubo_raiz_id IN (SELECT tubo_raiz_id FROM tubos_historial
--                            WHERE fuente = 'ingreso_manual_20260831');
--   (el DELETE dispara el trigger que deja su propio `eliminado`; después
--    borrar también los 16 `ingreso` de esa fuente si se quiere limpiar)
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Guard de idempotencia: si ya se corrió, abortar en vez de duplicar.
--    Estos tubos son piezas físicas y no tienen llave natural: correr el
--    script dos veces crearía 16 tubos que no existen en el galpón.
DO $$
DECLARE
  v_ya integer;
BEGIN
  SELECT count(*) INTO v_ya
  FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND fuente = 'ingreso_manual_20260831';

  IF v_ya > 0 THEN
    RAISE EXCEPTION 'ABORTADO: esta carga ya se ejecutó (% eventos con fuente ingreso_manual_20260831). Correrla de nuevo duplicaría los 16 tubos.', v_ya;
  END IF;
END $$;

-- 2. Los 16 tubos, con UUID propio cada uno, y su evento `ingreso` en la
--    MISMA transacción y con el MISMO tubo_raiz_id.
WITH nuevos(cod, medida_cm, ubic) AS (VALUES
  ('E02',  78.2, 'A35'),
  ('E02', 123.2, 'A35'),
  ('E02', 130.0, 'A35'),
  ('E02', 133.2, 'A35'),
  ('E02', 133.5, 'A35'),
  ('E02', 145.0, 'A35'),
  ('E02', 249.5, 'A35'),
  ('E02', 242.0, 'A35'),
  ('E02', 240.2, 'A35'),
  ('E02', 229.7, 'A35'),
  ('E03',  82.0, 'A35'),
  ('E66', 131.2, 'A35'),
  ('E03', 202.7, 'A35'),
  ('E03', 205.6, 'A35'),
  ('E66', 340.1, 'L02'),
  ('E02', 466.6, 'L02')
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
  'Ingreso manual a la colmena del 2026-08-31 (planilla del dueño): 14 tubos a A35 y 2 a L02.',
  'ingreso_manual_20260831'
FROM insertados i;

-- 3. Aserción: o entraron los 16 con sus 16 eventos, o no entra nada.
DO $$
DECLARE
  v_ev integer;
  v_tb integer;
BEGIN
  SELECT count(*) INTO v_ev
  FROM tubos_historial
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND fuente = 'ingreso_manual_20260831';

  SELECT count(*) INTO v_tb
  FROM colmena_tubos c
  WHERE c.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND EXISTS (
      SELECT 1 FROM tubos_historial t
      WHERE t.tubo_raiz_id = c.tubo_raiz_id
        AND t.fuente = 'ingreso_manual_20260831'
    );

  IF v_ev <> 16 OR v_tb <> 16 THEN
    RAISE EXCEPTION 'ABORTADO: quedaron % tubos y % eventos, se esperaban 16 y 16 — rollback completo.', v_tb, v_ev;
  END IF;
END $$;

COMMIT;

-- ── Verificación (correr después) ──
-- SELECT c.n_colmena, c.cod, c.medida_cm, c.medida_mm, c.disponible
-- FROM colmena_tubos c
-- JOIN tubos_historial t ON t.tubo_raiz_id = c.tubo_raiz_id
--                       AND t.fuente = 'ingreso_manual_20260831'
-- WHERE c.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
-- ORDER BY c.n_colmena, c.cod, c.medida_cm;
--
-- Esperado: 16 filas — 14 en A35 (10 E02, 3 E03, 1 E66) y 2 en L02
-- (1 E66 de 340,1 y 1 E02 de 466,6). El total de la colmena pasa de 537 a 553.
