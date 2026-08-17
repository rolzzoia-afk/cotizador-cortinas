-- ─────────────────────────────────────────────────────────────────────
-- INSTALACIÓN BEEBLACK (INST-BB): 17.500 → 35.000
--
-- La instalación del beeblack cuesta el doble que la de una roller. En el
-- Excel eso está en dos lugares distintos, con dos valores distintos:
--   · `Insumos!INST` = 41.650 → va DENTRO del valor unitario de cada cortina.
--   · `Productos!INST` = 35.000 → es la fila de instalación que se cobra
--     cuando la cotización no llega al mínimo de 4 cortinas.
-- Los dos quedaron como parámetros del sistema beeblack en Admin → Precios
-- (`reglas_precios.sistemas.beeblack`), así que la app ya cobra bien SIN este
-- script: la fila la arma el motor, no el catálogo.
--
-- Esto es solo para el catálogo de productos, que todavía dice 17.500. Importa
-- porque el código INST-BB se puede agregar A MANO como adicional (aparece en
-- el buscador de productos de Fase 1), y ahí se cobraría la mitad de lo que
-- corresponde.
--
-- Estado ANTES (medido 2026-08-17): INST-BB precio 17.500 · INST (roller)
-- 17.500, que sí es correcto y NO se toca.
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS configuracion_backup_20260817_inst_bb AS
  SELECT * FROM configuracion WHERE clave = 'catalogo_productos_data';

-- El catálogo es un JSON guardado como TEXTO: se castea, se toca una sola
-- llave y se vuelve a guardar como texto.
UPDATE configuracion
   SET valor = jsonb_set(valor::jsonb, '{INST-BB,precio}', '35000'::jsonb, false)::text
 WHERE clave = 'catalogo_productos_data'
   AND valor::jsonb ? 'INST-BB';

DO $$
DECLARE
  n_bb int;
  n_rol int;
BEGIN
  SELECT (valor::jsonb->'INST-BB'->>'precio')::numeric,
         (valor::jsonb->'INST'->>'precio')::numeric
    INTO n_bb, n_rol
    FROM configuracion WHERE clave = 'catalogo_productos_data';
  IF n_bb <> 35000 THEN
    RAISE EXCEPTION 'INST-BB quedó en % en vez de 35.000', n_bb;
  END IF;
  -- La instalación roller no se toca: si cambió, algo salió mal.
  IF n_rol <> 17500 THEN
    RAISE EXCEPTION 'Se movió la instalación roller (quedó en %)', n_rol;
  END IF;
  RAISE NOTICE 'INST-BB = 35.000, INST = 17.500 sin tocar.';
END $$;

COMMIT;

-- Para revertir: configuracion_backup_20260817_inst_bb tiene el catálogo previo.
