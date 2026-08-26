-- ─────────────────────────────────────────────────────────────────────
-- ANCHO DE ROLLO de BK 86 y BK 86-V (BLACKOUT - NEGRO AZABACHE 4 35)
--
-- Las dos se crearon en el catálogo SIN «Ancho de rollo». En el cotizador
-- ese dato decide cuántos paños de tela se COBRAN, y sin él el motor cae al
-- ancho de la tela base de la familia — para BLACKOUT_V_D es BK-V-D, 2,45 m.
--
-- Se detectó el 2026-08-26 comparando la cotización PAULA COTLG-05919-1
-- contra su Excel manual: 8 de las 12 verticales usan BK 86-V y la app salía
-- $138.003 más cara (neto). Poniendo SOLO el ancho en 2,98 las 12 líneas
-- calzan EXACTO con la planilla (805.617 / 529.205 / 359.356 / 267.400 /
-- 332.745 / 706.435 / 404.537 / 408.124 / 459.666 / 404.012 / 749.382 /
-- 419.752). El precio 0 de BK 86-V no influye: la familia cobra la tela al
-- máximo de la familia ($41.868 de BK-V-D).
--
-- Confirmado con el usuario el 2026-08-26: el rollo mide 2,98 m.
--
-- BK 86 (roller) se registra junto con BK 86-V (vertical) porque son la MISMA
-- tela: comparten la descripción «BLACKOUT - NEGRO AZABACHE 4 35» y por lo
-- tanto el mismo rollo. En el catálogo, 78 de los 80 pares «BK nn / BK nn-V»
-- comparten ancho (las excepciones son BK 76 y BK 81). Si BK 86 resultara ser
-- otro rollo, borrar sus dos líneas antes de correr esto.
--
-- La app guarda el ancho en DOS lugares (catalogoEdicion.ts hace lo mismo):
--   1. configuracion.ancho_rollo_data            → mapa { codInt: metros }
--   2. configuracion.catalogo_productos_data     → campo anchoRollo del producto
-- Este script escribe ambos y aborta si alguno queda distinto de 2,98.
--
-- Ninguna OT guardada usa estas telas (revisado el 2026-08-26), así que no se
-- recalcula ninguna cotización histórica: solo cambia de aquí en adelante.
--
-- Pendiente aparte (NO se toca acá): siguen sin ancho de rollo BK 41, BK 41-V,
-- BK 85, BK 85-V, BK 87, BK 87-V, BK 90 y BK 90-V. Registrar el ancho real
-- cuando se conozca, editando la tela en Admin → Catálogo.
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

-- 1. El mapa global de anchos de rollo.
UPDATE configuracion
SET valor = jsonb_set(
              jsonb_set(valor::jsonb, ARRAY['BK 86'], '2.98'::jsonb),
              ARRAY['BK 86-V'], '2.98'::jsonb
            )::text
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND clave = 'ancho_rollo_data';

-- 2. El campo anchoRollo dentro del catálogo de productos.
UPDATE configuracion
SET valor = jsonb_set(
              jsonb_set(valor::jsonb, ARRAY['BK 86','anchoRollo'], '2.98'::jsonb),
              ARRAY['BK 86-V','anchoRollo'], '2.98'::jsonb
            )::text
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND clave = 'catalogo_productos_data';

-- 3. Verificación: los dos almacenes tienen que leer 2,98 para ambas telas.
DO $$
DECLARE
  mapa jsonb;
  cat jsonb;
BEGIN
  SELECT valor::jsonb INTO mapa FROM configuracion
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND clave = 'ancho_rollo_data';
  SELECT valor::jsonb INTO cat FROM configuracion
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND clave = 'catalogo_productos_data';

  IF (mapa->>'BK 86') IS DISTINCT FROM '2.98' OR (mapa->>'BK 86-V') IS DISTINCT FROM '2.98' THEN
    RAISE EXCEPTION 'ancho_rollo_data no quedó en 2,98 (BK 86 = %, BK 86-V = %)',
      mapa->>'BK 86', mapa->>'BK 86-V';
  END IF;
  IF (cat#>>'{BK 86,anchoRollo}') IS DISTINCT FROM '2.98'
     OR (cat#>>'{BK 86-V,anchoRollo}') IS DISTINCT FROM '2.98' THEN
    RAISE EXCEPTION 'catalogo_productos_data no quedó en 2,98 (BK 86 = %, BK 86-V = %)',
      cat#>>'{BK 86,anchoRollo}', cat#>>'{BK 86-V,anchoRollo}';
  END IF;

  RAISE NOTICE 'Listo: BK 86 y BK 86-V con rollo 2,98 en el mapa y en el catálogo.';
END $$;
