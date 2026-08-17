-- ─────────────────────────────────────────────────────────────────────
-- SCREEN VERTICAL: las tres telas de referencia tienen la FAMILIA cruzada
--
-- En el catálogo, cada gama tiene una tela "de referencia" (`SC-V-P`, `SC-V-D`,
-- `SC-V-S`) que es la que fija el precio por metro de toda su familia. En las
-- screen verticales las tres están rotadas: el campo `tipo` dice bien la gama,
-- pero el campo `cod` (la familia) apunta a otra.
--
--   COD_INT   tipo       familia HOY      debería ser
--   SC-V-P    PREMIUM    SCREEN_V_S   →   SCREEN_V_P
--   SC-V-D    DELUX      SCREEN_V_P   →   SCREEN_V_D
--   SC-V-S    STANDARD   SCREEN_V_D   →   SCREEN_V_S
--
-- Las blackout verticales (BK-V-P/D/S) están bien; solo se tocan las screen.
--
-- HOY NO CAMBIA NINGÚN PRECIO. Las verticales se cobran con la tela del ROLLER
-- equivalente (`baseVertical`: SCREEN_V_P → SC-P, etc.), así que estos tres
-- códigos están dormidos. Se despiertan al activar «cobrar la tela de las
-- verticales por lamas» en Admin → Precios, que cambia la referencia a la tela
-- vertical propia. Con el cruce puesto, ese día la screen PREMIUM pasaría a
-- cobrar $43.503/m (el precio de la delux) en vez de $31.582.
--
-- Estado ANTES (medido en producción 2026-08-18):
--   SC-V-P  PREMIUM   SCREEN_V_S  $31.582
--   SC-V-D  DELUX     SCREEN_V_P  $43.503
--   SC-V-S  STANDARD  SCREEN_V_D  $43.503
-- Familias afectadas: SCREEN_V_P (82 telas), SCREEN_V_D (13), SCREEN_V_S (2).
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS configuracion_backup_20260818_sc_v AS
  SELECT * FROM configuracion WHERE clave = 'catalogo_productos_data';

-- El catálogo es un JSON guardado como TEXTO: se castea, se tocan tres llaves
-- y se vuelve a guardar como texto. Los tres `jsonb_set` se encadenan para que
-- sea un solo UPDATE (si fueran tres, el segundo leería el resultado del
-- primero y daría igual, pero así queda explícito que es atómico).
UPDATE configuracion
   SET valor = jsonb_set(
                 jsonb_set(
                   jsonb_set(valor::jsonb, '{SC-V-P,cod}', '"SCREEN_V_P"'::jsonb, false),
                   '{SC-V-D,cod}', '"SCREEN_V_D"'::jsonb, false),
                 '{SC-V-S,cod}', '"SCREEN_V_S"'::jsonb, false)::text
 WHERE clave = 'catalogo_productos_data'
   AND valor::jsonb ? 'SC-V-P'
   AND valor::jsonb ? 'SC-V-D'
   AND valor::jsonb ? 'SC-V-S';

-- ── OPCIONAL: el precio de la screen vertical STANDARD ────────────────
-- `SC-V-S` vale $43.503, que es el precio de la DELUX; la standard del roller
-- (`SC-S`) vale $31.582, igual que la premium. O sea: la standard vertical
-- quedaría más cara que la premium vertical, que no tiene sentido comercial.
--
-- No se corrige acá porque cambiar un precio es una decisión de negocio, no un
-- arreglo de datos. Con el cruce ya enderezado, `SC-V-S` es la única tela con
-- precio de la familia SCREEN_V_S (la otra, SC 96, está en $0), así que sería
-- la que manda el día que se active el cobro por lamas.
--
-- Para aplicarlo, descomentar estas dos líneas ANTES de correr el script:
--
-- UPDATE configuracion
--    SET valor = jsonb_set(valor::jsonb, '{SC-V-S,precio}', '31582'::jsonb, false)::text
--  WHERE clave = 'catalogo_productos_data' AND valor::jsonb ? 'SC-V-S';

DO $$
DECLARE
  r record;
  esperado text;
BEGIN
  FOR r IN
    SELECT k AS cod_int,
           valor::jsonb->k->>'cod'  AS familia,
           valor::jsonb->k->>'tipo' AS tipo
      FROM configuracion,
           LATERAL unnest(ARRAY['SC-V-P','SC-V-D','SC-V-S']) AS k
     WHERE clave = 'catalogo_productos_data'
  LOOP
    esperado := CASE r.cod_int
                  WHEN 'SC-V-P' THEN 'SCREEN_V_P'
                  WHEN 'SC-V-D' THEN 'SCREEN_V_D'
                  ELSE 'SCREEN_V_S' END;
    IF r.familia IS DISTINCT FROM esperado THEN
      RAISE EXCEPTION '% quedó en la familia % en vez de %', r.cod_int, r.familia, esperado;
    END IF;
  END LOOP;

  -- Las blackout verticales NO se tocan: si se movieron, algo salió mal.
  IF EXISTS (
    SELECT 1 FROM configuracion
     WHERE clave = 'catalogo_productos_data'
       AND (valor::jsonb->'BK-V-P'->>'cod' <> 'BLACKOUT_V_P'
         OR valor::jsonb->'BK-V-D'->>'cod' <> 'BLACKOUT_V_D'
         OR valor::jsonb->'BK-V-S'->>'cod' <> 'BLACKOUT_V_S')
  ) THEN
    RAISE EXCEPTION 'Se movió alguna blackout vertical, que no había que tocar.';
  END IF;

  RAISE NOTICE 'SC-V-P/D/S enderezadas; las BK-V-* sin tocar.';
END $$;

COMMIT;

-- Para revertir: configuracion_backup_20260818_sc_v tiene el catálogo previo.
