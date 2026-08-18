-- ─────────────────────────────────────────────────────────────────────
-- ANCHO DE ROLLO de BK 84 y SC 96 (telas gama B creadas el 2026-08-17)
--
-- Las dos telas se crearon en el catálogo SIN llenar «Ancho de rollo», así
-- que la hoja de corte les asumía el default de 2,98 m. Con ese ancho las
-- 16 cortinas angostas de la OT #3187-B cabían de pasajeras en el sobrante
-- de los paños de 2,00 m y el TOTAL PAÑOS bajaba de 80 a 72 — cortes de
-- 2,90 m planificados sobre un rollo que en realidad mide 2,50.
--
-- Confirmado con el usuario el 2026-08-18: ambas vienen en rollo de 2,50 m
-- físico → se registra 2,45 m utilizable, igual que el resto de la gama B
-- (BK-B / BK-S / BK-P / SC-S / SC-P / SC-D = 2,45).
--
-- La app guarda el ancho en DOS lugares (catalogoEdicion.ts hace lo mismo):
--   1. configuracion.ancho_rollo_data            → mapa { codInt: metros }
--   2. configuracion.catalogo_productos_data     → campo anchoRollo del producto
-- Este script escribe ambos y aborta si alguno queda distinto de 2,45.
--
-- Tras correrlo, la hoja de corte de la OT #3187-B vuelve a dar 80 paños.
-- (El precio de esa OT no cambia: ninguna pieza supera el rollo.)
--
-- Pendiente aparte (NO se toca acá): BK 41, BK 41-V, BK 90 y BK 90-V también
-- están sin ancho de rollo, pero no aparecen en ninguna OT activa. Registrar
-- su ancho real cuando se conozca, editando la tela en la app.
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

-- 1. El mapa global de anchos de rollo.
UPDATE configuracion
SET valor = jsonb_set(
              jsonb_set(valor::jsonb, ARRAY['BK 84'], '2.45'::jsonb),
              ARRAY['SC 96'], '2.45'::jsonb
            )::text
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND clave = 'ancho_rollo_data';

-- 2. El campo anchoRollo dentro del catálogo de productos.
UPDATE configuracion
SET valor = jsonb_set(
              jsonb_set(valor::jsonb, ARRAY['BK 84','anchoRollo'], '2.45'::jsonb),
              ARRAY['SC 96','anchoRollo'], '2.45'::jsonb
            )::text
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND clave = 'catalogo_productos_data';

-- 3. La descripción de la SC 96 decía «- 3 MTS» y el rollo real es de 2,50:
--    se corrige para que no vuelva a confundir.
UPDATE configuracion
SET valor = jsonb_set(
              valor::jsonb,
              ARRAY['SC 96','descripcion'],
              to_jsonb(replace(valor::jsonb#>>'{SC 96,descripcion}', ' - 3 MTS', ''))
            )::text
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND clave = 'catalogo_productos_data'
  AND valor::jsonb#>>'{SC 96,descripcion}' LIKE '%3 MTS%';

-- 4. Verificación: los dos almacenes tienen que leer 2,45 para ambas telas.
DO $$
DECLARE
  mapa jsonb;
  cat jsonb;
BEGIN
  SELECT valor::jsonb INTO mapa FROM configuracion
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND clave = 'ancho_rollo_data';
  SELECT valor::jsonb INTO cat FROM configuracion
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND clave = 'catalogo_productos_data';

  IF (mapa->>'BK 84') IS DISTINCT FROM '2.45' OR (mapa->>'SC 96') IS DISTINCT FROM '2.45' THEN
    RAISE EXCEPTION 'ancho_rollo_data no quedó en 2,45 (BK 84 = %, SC 96 = %)',
      mapa->>'BK 84', mapa->>'SC 96';
  END IF;
  IF (cat#>>'{BK 84,anchoRollo}') IS DISTINCT FROM '2.45'
     OR (cat#>>'{SC 96,anchoRollo}') IS DISTINCT FROM '2.45' THEN
    RAISE EXCEPTION 'catalogo_productos_data no quedó en 2,45 (BK 84 = %, SC 96 = %)',
      cat#>>'{BK 84,anchoRollo}', cat#>>'{SC 96,anchoRollo}';
  END IF;

  RAISE NOTICE 'Listo: BK 84 y SC 96 con rollo 2,45 en el mapa y en el catálogo. SC 96 sin el «3 MTS».';
END $$;
