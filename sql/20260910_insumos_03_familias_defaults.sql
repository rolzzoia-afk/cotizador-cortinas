-- ============================================================================
-- INSUMOS 03 — Realinear lo que cada familia propone al dar de alta
-- Fecha: 2026-09-10
-- ============================================================================
--
-- POR QUÉ:
--   La tabla `familias_insumo` se sembró en el SQL 01 tomando la categoría y
--   la subcategoría MÁS FRECUENTE de cada prefijo. Eso fue antes de que el SQL
--   02 reclasificara 175 artículos, así que 13 familias quedaron proponiendo el
--   valor viejo: TOR sigue diciendo MATERIALES aunque sus 109 tornillos ya
--   están en TORNILLERIA, y WALL propone «INSUMO», que es una CATEGORÍA y no
--   una subcategoría válida.
--
--   Si no se corrige, el formulario deshace el SQL 02 de a un artículo por vez:
--   cada tornillo nuevo vuelve a nacer en MATERIALES.
--
-- QUÉ HACE: recalcula el valor por defecto de cada familia desde lo que sus
--   artículos dicen HOY. No toca códigos, ni correlativos, ni dígitos, ni el
--   estado activo/inactivo de ninguna familia.
--
-- ES IDEMPOTENTE: es un recálculo. Correrlo dos veces da lo mismo, y correrlo
--   otra vez después de reclasificar más artículos vuelve a alinear las
--   familias solo. También se puede hacer a mano desde
--   Inventario → Configuración → Familias de código.
--
-- ENSAYADO contra producción el 2026-09-09 dentro de BEGIN … ROLLBACK:
--   13 familias corregidas (BK, BRA, CIN, DU, EPP, GOM, SC, SEC, SUB, TAR,
--   TIR, TOR y WALL) · 0 desalineadas después · 0 proponiendo un valor que el
--   formulario no ofrezca. Quedan 8 en MATERIALES a propósito: INS, HER y VER
--   —los 398 artículos que faltan clasificar— y CAR, ESTU, GEN, UTEN y VAS,
--   que no son material de cortina.
--
-- REQUISITO: correr antes los SQL 01 y 02 de esta misma fecha.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Insumos 03 · defaults de familia — INICIADO ==='; END $$;

DO $$
BEGIN
  IF to_regclass('public.familias_insumo') IS NULL THEN
    RAISE EXCEPTION 'Falta correr antes sql/20260910_insumos_01_familias.sql';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS familias_backup_defaults_20260910 AS
SELECT id, prefijo, categoria, sub_categoria FROM familias_insumo;

-- La moda de cada prefijo, ignorando los vacíos: si TODOS los artículos de una
-- familia tienen la columna en blanco, la familia se queda sin propuesta en
-- vez de heredar una cadena vacía.
WITH moda AS (
  SELECT substring(cod from '^([A-Z]{1,4})') AS prefijo,
         mode() WITHIN GROUP (ORDER BY categoria)
           FILTER (WHERE coalesce(categoria, '') <> '') AS cat,
         mode() WITHIN GROUP (ORDER BY sub_categoria)
           FILTER (WHERE coalesce(sub_categoria, '') <> '') AS sub
    FROM insumos
   GROUP BY 1
)
UPDATE familias_insumo AS f
   SET categoria     = m.cat,
       sub_categoria = m.sub
  FROM moda m
 WHERE m.prefijo = f.prefijo
   AND (f.categoria IS DISTINCT FROM m.cat OR f.sub_categoria IS DISTINCT FROM m.sub);

-- ---------------------------------------------------------------------------
-- VERIFICACIÓN
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_desalineadas int;
  v_invalidas    text;
  v_en_materiales int;
BEGIN
  -- Ninguna familia puede quedar proponiendo algo distinto de lo que sus
  -- propios artículos dicen.
  SELECT count(*) INTO v_desalineadas
    FROM familias_insumo f
    JOIN (SELECT substring(cod from '^([A-Z]{1,4})') AS prefijo,
                 mode() WITHIN GROUP (ORDER BY categoria)
                   FILTER (WHERE coalesce(categoria,'') <> '') AS cat,
                 mode() WITHIN GROUP (ORDER BY sub_categoria)
                   FILTER (WHERE coalesce(sub_categoria,'') <> '') AS sub
            FROM insumos GROUP BY 1) m ON m.prefijo = f.prefijo
   WHERE f.categoria IS DISTINCT FROM m.cat OR f.sub_categoria IS DISTINCT FROM m.sub;
  IF v_desalineadas <> 0 THEN
    RAISE EXCEPTION 'Quedaron % familias desalineadas', v_desalineadas;
  END IF;

  -- Y lo que propone tiene que existir en los desplegables, o el formulario
  -- mostraría un valor que no puede elegir.
  SELECT string_agg(prefijo || '→' || valor, ', ') INTO v_invalidas
    FROM (
      SELECT prefijo, 'CATEGORIA' AS campo, categoria AS valor FROM familias_insumo
       WHERE coalesce(categoria,'') <> ''
      UNION ALL
      SELECT prefijo, 'SUB_CATEGORIA', sub_categoria FROM familias_insumo
       WHERE coalesce(sub_categoria,'') <> ''
    ) u
   WHERE NOT EXISTS (
     SELECT 1 FROM validadores_insumos v WHERE v.campo = u.campo AND v.valor = u.valor);
  IF v_invalidas IS NOT NULL THEN
    RAISE EXCEPTION 'Familias que proponen un valor que el formulario no ofrece: %', v_invalidas;
  END IF;

  SELECT count(*) INTO v_en_materiales
    FROM familias_insumo WHERE sub_categoria = 'MATERIALES';

  RAISE NOTICE '--------------------------------------------------------------';
  RAISE NOTICE 'Las % familias proponen lo mismo que dicen sus artículos.',
    (SELECT count(*) FROM familias_insumo);
  RAISE NOTICE 'Siguen proponiendo MATERIALES: %. Son las que todavía no se', v_en_materiales;
  RAISE NOTICE '  reclasifican —INS, HER y VER suman 398 artículos que piden';
  RAISE NOTICE '  criterio— más las que no son material de cortina.';
  RAISE NOTICE '--------------------------------------------------------------';
END $$;

DO $$ BEGIN RAISE NOTICE '=== Insumos 03 · defaults de familia — LISTO ==='; END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- REVERSA
-- ============================================================================
-- BEGIN;
-- UPDATE familias_insumo AS f
--    SET categoria = b.categoria, sub_categoria = b.sub_categoria
--   FROM familias_backup_defaults_20260910 b
--  WHERE b.id = f.id;
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
-- DROP TABLE IF EXISTS familias_backup_defaults_20260910;
-- ============================================================================
