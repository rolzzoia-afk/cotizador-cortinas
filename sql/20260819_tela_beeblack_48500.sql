-- ─────────────────────────────────────────────────────────────────────
-- TELA BEEBLACK BLACKOUT: el catálogo pasa a los $48.500 del panel
--
-- El beeblack cobra su tela al MÁXIMO de la familia, y en la familia BEE_BK
-- ese máximo es la tela de referencia `BEE-BK`. El catálogo la tenía en
-- $48.415 (el MAXIFS calculado); el panel del Excel canónico —la copia que
-- cotizó COTAP-8003, la buena según decisión del dueño 2026-08-19— tiene el
-- PRECIO REAL tecleado a mano en $48.500, y ese es el que efectivamente se
-- cobra. La diferencia era el último peso que separaba a la app del Excel:
-- −$534 en el total transferencia de COTAP-8003 (−0,02 %).
--
-- Con este cambio (y la receta del riel corregida en el código), la app
-- reproduce COTAP-8003 EXACTA: VAL.UNIT 1.071.685 / 827.181 / 521.361 /
-- 638.311 · subtotal 1.835.123 · total transferencia 2.183.796.
--
-- NO se tocan BEE-SC (mosquitero, hoy $48.415) ni BEE-TRAS ($78.848): del
-- panel de esas familias no hay evidencia de un valor tecleado distinto.
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS configuracion_backup_20260819_tela_bb AS
  SELECT * FROM configuracion WHERE clave = 'catalogo_productos_data';

-- El catálogo es un JSON guardado como TEXTO: se castea, se toca la llave y
-- se vuelve a guardar como texto (misma técnica que 20260818_sc_v_familias).
UPDATE configuracion
   SET valor = jsonb_set(valor::jsonb, '{BEE-BK,precio}', '48500'::jsonb, false)::text
 WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
   AND clave = 'catalogo_productos_data'
   AND valor::jsonb ? 'BEE-BK';

DO $$
DECLARE
  bk    numeric;
  sc    numeric;
  tras  numeric;
BEGIN
  SELECT (valor::jsonb->'BEE-BK'->>'precio')::numeric,
         (valor::jsonb->'BEE-SC'->>'precio')::numeric,
         (valor::jsonb->'BEE-TRAS'->>'precio')::numeric
    INTO bk, sc, tras
    FROM configuracion
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND clave = 'catalogo_productos_data';

  IF bk IS DISTINCT FROM 48500 THEN
    RAISE EXCEPTION 'BEE-BK quedó en % en vez de 48500', bk;
  END IF;
  -- Las otras dos telas de referencia beeblack NO había que tocarlas.
  IF sc IS DISTINCT FROM 48415 OR tras IS DISTINCT FROM 78848 THEN
    RAISE EXCEPTION 'Se movió BEE-SC (%) o BEE-TRAS (%), que no había que tocar.', sc, tras;
  END IF;

  RAISE NOTICE 'BEE-BK en 48.500; BEE-SC y BEE-TRAS sin tocar.';
END $$;

COMMIT;

-- Para revertir: configuracion_backup_20260819_tela_bb tiene el catálogo previo.
