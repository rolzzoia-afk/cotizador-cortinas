-- ─────────────────────────────────────────────────────────────────────
-- BK 83 (BEIGE TEXTURE - GAMA B / CALAFQUEN #3) es ROLLER BLACKOUT DELUX
--
-- En el catálogo de la app la tela quedó cargada como BLACKOUT_P (premium).
-- En la planilla de la categoría B con que se vendió (COTJS-10452-1, CARLOS,
-- 2026-08-21) figura como BLACKOUT_D y se cotizó con el panel DELUX (tela de
-- referencia 29.231). Con la familia equivocada, la app la cotiza con el panel
-- PREMIUM de la categoría B (tela 22.500) y la cotización sale ~8 % más barata
-- que la real.
--
-- Solo se corrige la FAMILIA (cod + nombre del producto). El precio propio de
-- la tela (0 en la app, 21.786 en la copia) no participa: la categoría B cobra
-- la tela de referencia tecleada por familia, y la A la de BK-D. El descuento
-- (20 %) tampoco se toca: al crear la fila, la categoría B propone su 30 %.
--
-- La vertical BK 83-V se deja como está (BLACKOUT_V_P): la copia de Carlos no
-- la trae y no hay con qué contrastarla.
--
-- `valor` es TEXT con JSON adentro: se edita como jsonb y se vuelve a guardar
-- como texto. Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS configuracion_backup_20260821_bk83 AS
  SELECT * FROM configuracion
   WHERE clave = 'catalogo_productos_data'
     AND empresa_id::text = '67c635a5-152c-4780-a066-23f5081175a9';

UPDATE configuracion
   SET valor = jsonb_set(
                 jsonb_set(valor::jsonb, '{BK 83,cod}', '"BLACKOUT_D"'),
                 '{BK 83,producto}', '"ROLLER BLACKOUT DELUX"'
               )::text
 WHERE clave = 'catalogo_productos_data'
   AND empresa_id::text = '67c635a5-152c-4780-a066-23f5081175a9'
   AND (valor::jsonb) ? 'BK 83';

DO $$
DECLARE
  cod_nuevo text;
BEGIN
  SELECT (valor::jsonb)->'BK 83'->>'cod' INTO cod_nuevo
    FROM configuracion
   WHERE clave = 'catalogo_productos_data'
     AND empresa_id::text = '67c635a5-152c-4780-a066-23f5081175a9';

  IF cod_nuevo IS DISTINCT FROM 'BLACKOUT_D' THEN
    RAISE EXCEPTION 'BK 83 quedó con cod=% (se esperaba BLACKOUT_D)', coalesce(cod_nuevo, 'NULL');
  END IF;

  RAISE NOTICE 'BK 83 → BLACKOUT_D (ROLLER BLACKOUT DELUX). Respaldo: configuracion_backup_20260821_bk83.';
END $$;

COMMIT;

-- Para revertir: configuracion_backup_20260821_bk83 tiene el catálogo completo previo.
