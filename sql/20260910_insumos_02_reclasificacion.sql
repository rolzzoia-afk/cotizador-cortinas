-- ============================================================================
-- INSUMOS 02 — Reclasificación por datos (categoría, subcategoría y color)
-- Fecha: 2026-09-10
-- ============================================================================
--
-- NO TOCA NINGÚN CÓDIGO. `insumos.cod` es la llave y quedó congelada en el SQL
-- 01. Acá solo se arreglan las columnas que DESCRIBEN el artículo. Se puede
-- correr y revertir sin que se mueva un solo `cod`, y la verificación del final
-- lo comprueba fila por fila.
--
-- POR QUÉ:
--   · El formulario ofrece 8 subcategorías; los datos usan 40. Por eso todo lo
--     nuevo cae en MATERIALES, que hoy tiene 590 artículos (58 % del catálogo)
--     y no significa nada. Lo mismo con las categorías (ofrece 3, se usan 5) y
--     con los colores (ofrece 5, se usan 12).
--   · El color es lo que alimenta el código visible del SQL 01 («MEC32-BCO»).
--     Hoy 751 de 1.012 artículos lo tienen vacío o «N/A», así que el sufijo se
--     ve en apenas 26 % del catálogo. En 171 de esos casos el color está
--     escrito en el nemotécnico y nadie lo copió a la columna.
--
-- QUÉ REVISAR ANTES DE CORRER: las listas están completas y con el nombre de
-- cada artículo al lado, en los pasos 3, 4 y 6. Si alguna línea está mal,
-- bórrala y el resto corre igual (las aserciones cuentan la lista, no un número
-- fijo). Al final del archivo hay un bloque PARA DECIDIR A MANO que este script
-- NO aplica: son los casos donde los datos se contradicen.
--
-- ENSAYADO contra producción el 2026-09-09 dentro de BEGIN … ROLLBACK:
--   0 códigos movidos · MATERIALES 590 → 415 · artículos con color 261 → 432
--   · subcategorías en el formulario 8 → 49 · 0 filas con categoría o
--   subcategoría vacía · 0 valores en uso sin fila en validadores.
--   Tras el ROLLBACK la base quedó igual (590 / 261 / 38 validadores).
--
--   En el código visible eso se traduce en 394 artículos con sufijo de color
--   (39 % del catálogo) contra los 266 de hoy. Otros 39 quedan con color pero
--   sin sufijo —AZUL, CRUDO, BEIGE, PERLA, VERDE, ROJO, DORADO, AMARILLO,
--   MORADO no tienen abreviatura y no se les inventa una— y 579 se quedan sin
--   color, que para un tornillo o un papel higiénico es lo correcto.
--
--   El «total de filas tocadas» del ensayo da 697 y no ~350: 625 de ellas son
--   solo la normalización del paso 5, que cambia el color de cadena vacía a
--   NULL. Para la pantalla es lo mismo —las dos significan «sin color»—, pero
--   conviene saberlo antes de mirar el número.
--
-- ES IDEMPOTENTE: los validadores van con ON CONFLICT DO NOTHING y las
-- reclasificaciones son asignaciones directas; correrlo dos veces deja lo
-- mismo. La segunda corrida no encuentra nada que mover y las aserciones de
-- «cuántas filas cambiaron» están escritas para eso (comparan contra las filas
-- que hoy NO tienen el valor destino, no contra el largo de la lista).
--
-- REQUISITO: correr primero sql/20260910_insumos_01_familias.sql.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Insumos 02 · reclasificación por datos — INICIADO ==='; END $$;

DO $$
BEGIN
  IF to_regclass('public.validadores_insumos') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla validadores_insumos';
  END IF;
  IF to_regclass('public.familias_insumo') IS NULL THEN
    RAISE EXCEPTION 'Falta correr antes sql/20260910_insumos_01_familias.sql';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 0. RESPALDOS
--    Se respalda la tabla ENTERA, no solo las filas que se tocan: la reversa
--    del pie restaura por `id`, y así también sirve si alguien edita algo desde
--    la pantalla entre esta corrida y la reversa.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS insumos_backup_reclasif_20260910 AS
SELECT id, cod, categoria, sub_categoria, color FROM insumos;

CREATE TABLE IF NOT EXISTS validadores_backup_reclasif_20260910 AS
SELECT * FROM validadores_insumos;

DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM insumos_backup_reclasif_20260910;
  IF v_n = 0 THEN RAISE EXCEPTION 'El respaldo de insumos quedó vacío'; END IF;
  RAISE NOTICE 'Respaldo: % insumos, % validadores',
    v_n, (SELECT count(*) FROM validadores_backup_reclasif_20260910);
END $$;

-- ---------------------------------------------------------------------------
-- 1. VALIDADORES COMPLETOS
--    El formulario ofrece lo que hay acá. Se agregan los valores que los datos
--    YA usan (por eso nadie los podía elegir: se escribieron por SQL o por
--    importación) más los que introduce el paso 3.
--
--    Los 11 valores que ya existían conservan su `orden`; los nuevos empiezan
--    en 100 para que la lista vieja siga arriba en el desplegable.
-- ---------------------------------------------------------------------------

INSERT INTO validadores_insumos (empresa_id, campo, valor, orden, activo)
SELECT i.empresa_id, v.campo, v.valor, v.orden, true
  FROM (VALUES
    -- CATEGORIA: se usan 5, el formulario ofrecía 3.
    ('CATEGORIA',     'EPP',                   100),
    ('CATEGORIA',     'WALL PANEL',            101),

    -- SUB_CATEGORIA: se usan 40, el formulario ofrecía 8.
    ('SUB_CATEGORIA', 'MATERIALES',            100),
    ('SUB_CATEGORIA', 'MOTOR',                 101),
    ('SUB_CATEGORIA', 'MOTOR VERTICAL',        102),
    ('SUB_CATEGORIA', 'BEEBLACK',              103),
    ('SUB_CATEGORIA', 'TAPAS LATERALES',       104),
    ('SUB_CATEGORIA', 'PESO INFERIOR',         105),
    ('SUB_CATEGORIA', 'PESO CADENA',           106),
    ('SUB_CATEGORIA', 'CENEFA OVALADA',        107),
    ('SUB_CATEGORIA', 'CENEFA CUADRADA',       108),
    ('SUB_CATEGORIA', 'PERFIL DARK/SOFTLIGHT', 109),
    ('SUB_CATEGORIA', 'CABEZAL',               110),
    ('SUB_CATEGORIA', 'SEPARADOR',             111),
    ('SUB_CATEGORIA', 'EXTENSOR',              112),
    ('SUB_CATEGORIA', 'ANGULO',                113),
    ('SUB_CATEGORIA', 'VARILLA',               114),
    ('SUB_CATEGORIA', 'PLETINA',               115),
    ('SUB_CATEGORIA', 'TOPE',                  116),
    ('SUB_CATEGORIA', 'UNION',                 117),
    ('SUB_CATEGORIA', 'MANILLA',               118),
    ('SUB_CATEGORIA', 'VELCRO',                119),
    ('SUB_CATEGORIA', 'ZUNCHO',                120),
    ('SUB_CATEGORIA', 'MANGA',                 121),
    ('SUB_CATEGORIA', 'FILM',                  122),
    ('SUB_CATEGORIA', 'ETIQUETA',              123),
    ('SUB_CATEGORIA', 'TIRRO / SCOTCH',        124),
    ('SUB_CATEGORIA', 'DOBLE CONTACTO',        125),
    ('SUB_CATEGORIA', 'SPRAY',                 126),
    ('SUB_CATEGORIA', 'LIMPIEZA',              127),
    ('SUB_CATEGORIA', 'LAMPARA',               128),
    ('SUB_CATEGORIA', 'EXTRACTOR',             129),
    ('SUB_CATEGORIA', 'FRANELA/POLERA',        130),
    ('SUB_CATEGORIA', 'SWEATER/POLERON',       131),
    ('SUB_CATEGORIA', 'BOTAS DE SEG.',         132),
    -- Las que introduce el paso 3.
    ('SUB_CATEGORIA', 'TORNILLERIA',           133),
    ('SUB_CATEGORIA', 'TARUGO',                134),
    ('SUB_CATEGORIA', 'EPP',                   135),
    ('SUB_CATEGORIA', 'SEGURO DE NIÑOS',       136),
    ('SUB_CATEGORIA', 'SUPLEMENTO',            137),
    ('SUB_CATEGORIA', 'MUESTRA',               138),
    ('SUB_CATEGORIA', 'GORRA',                 139),
    ('SUB_CATEGORIA', 'PANEL',                 140),

    -- COLOR: los que el catálogo usa de verdad. ALUMINIO ya estaba y se
    -- conserva aunque hoy no lo use ningún artículo.
    ('COLOR',         'METAL',                 100),
    ('COLOR',         'CAFE',                  101),
    ('COLOR',         'MADERA',                102),
    ('COLOR',         'TRANSPARENTE',          103),
    ('COLOR',         'CRUDO',                 104),
    ('COLOR',         'BEIGE',                 105),
    ('COLOR',         'PERLA',                 106),
    ('COLOR',         'AZUL',                  107),
    ('COLOR',         'VERDE',                 108),
    ('COLOR',         'ROJO',                  109),
    ('COLOR',         'AMARILLO',              110),
    ('COLOR',         'DORADO',                111),
    ('COLOR',         'MORADO',                112)
  ) AS v(campo, valor, orden)
  CROSS JOIN (SELECT DISTINCT empresa_id FROM insumos) i
ON CONFLICT (empresa_id, campo, valor) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. LAS OCHO FILAS ROTAS
--    Categorías y subcategorías vacías o nulas, una subcategoría que es un
--    duplicado de otra («PESO» contra «PESO INFERIOR») y un color que es
--    basura de importación.
-- ---------------------------------------------------------------------------

UPDATE insumos SET categoria = 'INSUMO'
 WHERE cod IN ('TAP02',    -- TAPA PESO GRIS / SOLMATEC        (categoría vacía)
               'E79-B')    -- PESO INFERIOR DUO REDONDO "O" B  (categoría nula)
   AND coalesce(categoria, '') = '';

UPDATE insumos SET sub_categoria = 'PESO INFERIOR'
 WHERE cod IN ('E73',      -- PESO -RECTANGULAR-NEGRO   (única fila en «PESO»)
               'E79-B');   -- PESO INFERIOR DUO REDONDO "O" B     (subcat nula)

UPDATE insumos SET sub_categoria = 'TAPAS LATERALES' WHERE cod = 'TAP02';
UPDATE insumos SET sub_categoria = 'GORRA'           WHERE cod = 'UNI18';   -- GORRA NEGRA ROLZZO
UPDATE insumos SET sub_categoria = 'PANEL'           WHERE cod = 'WALL01';  -- estaba en «INSUMO», que es una CATEGORÍA

-- El destornillador BAUKER quedó con «N, - JM,» en la columna color: es un
-- pedazo de otra columna que se corrió en una importación. Un color inventado
-- se imprimiría en la etiqueta, así que se borra en vez de adivinarlo.
UPDATE insumos SET color = NULL WHERE cod = 'HER103' AND color = 'N, - JM,';

-- ---------------------------------------------------------------------------
-- 3. SUBCATEGORÍA — FAMILIAS COMPLETAS
--    Nueve familias están 100 % en MATERIALES y su prefijo YA dice qué son.
--    Son 146 artículos y no hay nada que interpretar: un TOR es un tornillo.
--    Se acota con `sub_categoria = 'MATERIALES'` para no pisar una fila que
--    alguien haya clasificado a mano después.
-- ---------------------------------------------------------------------------

UPDATE insumos SET sub_categoria = 'TORNILLERIA'     WHERE cod ~ '^TOR[0-9]' AND sub_categoria = 'MATERIALES';  -- 109
UPDATE insumos SET sub_categoria = 'EPP'             WHERE cod ~ '^EPP[0-9]' AND sub_categoria = 'MATERIALES';  --  16
UPDATE insumos SET sub_categoria = 'TARUGO'          WHERE cod ~ '^TAR[0-9]' AND sub_categoria = 'MATERIALES';  --   6
UPDATE insumos SET sub_categoria = 'SEGURO DE NIÑOS' WHERE cod ~ '^SEC[0-9]' AND sub_categoria = 'MATERIALES';  --   2
UPDATE insumos SET sub_categoria = 'SUPLEMENTO'      WHERE cod ~ '^SUB[0-9]' AND sub_categoria = 'MATERIALES';  --   2
UPDATE insumos SET sub_categoria = 'BEEBLACK'        WHERE cod ~ '^GOM[0-9]' AND sub_categoria = 'MATERIALES';  --   1  GOMA ESPONJA BEEBLACK

-- BK, DU y SC son muestrarios: paños de 165×240 de blackout, dúo y screen que
-- se le enseñan al cliente. No son materia prima de una cortina y hoy se
-- confunden con los códigos de tela del mismo nombre.
UPDATE insumos SET sub_categoria = 'MUESTRA'
 WHERE cod ~ '^(BK|DU|SC)[0-9]' AND sub_categoria = 'MATERIALES';                                               --  10

-- ---------------------------------------------------------------------------
-- 4. SUBCATEGORÍA — ARTÍCULOS SUELTOS
--    Piezas de cortina que quedaron en MATERIALES aunque su subcategoría ya
--    existe y tiene compañeros. Cada línea lleva el nombre del artículo.
-- ---------------------------------------------------------------------------

UPDATE insumos AS i SET sub_categoria = n.sub
  FROM (VALUES
    ('BRA03-B', 'BRACKET'),          -- BRACKET CENEFA CUADRADA CAT. B
    ('BRA04',   'BRACKET'),          -- BRACKET (L) - TECHO
    ('BRA05',   'BRACKET'),          -- BRACKET (L) - MURO
    ('DOM34',   'MOTOR'),            -- CABLE USB TIPO C PARA MOTOR GRANDE .43 2Nm
    ('DOM35',   'MOTOR'),            -- MOTOR / TUBERIA 0.63MM (ROLZZO-VERTI)
    ('DOM36',   'MOTOR'),            -- HUB (ROLZZO-VERTI)
    ('DOM37',   'MOTOR'),            -- CONTROL (ROLZZO-VERTI)
    ('MEC37',   'MECANISMO'),        -- MECANISMO OVALADA BLANCA CAT B
    ('MEC42-B', 'MECANISMO'),        -- MECANISMO C. CUADRADA CAT B. (NEGRO)
    ('MEC43-B', 'MECANISMO'),        -- MECANISMO C. CUADRADA CAT B. (BLANCO)
    ('MEC44-B', 'MECANISMO'),        -- MECANISMO ROLLER CAT. B (BLANCO)
    ('MEC45-B', 'MECANISMO'),        -- MECANISMO C. OVALADA NEGRA CAT B
    ('TAP28-B', 'TAPAS LATERALES'),  -- TAPA PESO ROLLER CAT. B (NEGRO)
    ('TAP29-B', 'TAPAS LATERALES'),  -- TAPA PESO "V" INFERIOR (NEGRO)
    ('TAP30',   'TAPAS LATERALES'),  -- TAPAS TRANSPARENTE PARA PESO "V" DUO CAT B
    ('E67-B',   'CENEFA CUADRADA'),  -- CENEFA CUADRADA CAT. B (NEGRO)
    ('E68-B',   'CENEFA CUADRADA'),  -- CENEFA CUADRADA CAT. B (BLANCO)
    ('E69-B',   'PESO INFERIOR'),    -- PESO ROLLER CAT. B (NEGRO)
    ('E70-B',   'PESO INFERIOR'),    -- PESO "V" INFERIOR DUO (NEGRO)
    ('E71-B',   'PESO INFERIOR'),    -- PESO INFERIOR ROLLER DUO REDONDO "O" CAT. B
    ('E77',     'ANGULO'),           -- UNGULO CUADRADO NEGRO 30X30
    ('PCA07',   'PESO CADENA'),      -- PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM
    ('TIR02',   'TIRRO / SCOTCH'),   -- TIRRO AZUL / MASKING TAPE AZUL
    ('CIN03',   'DOBLE CONTACTO'),   -- CINTA DOBLE CONTACTO PARA VELCRO
    ('CIN05',   'DOBLE CONTACTO'),   -- CINTA DOBLE CONTACTO PARA BEEBLACK - 3M
    ('UNI03',   'UNION'),            -- UNIONES GRISES
    ('UNI04',   'UNION'),            -- UNIONES NEGRAS
    ('UNI42',   'UNION'),            -- UNIONES METALICAS - ROLZZO
    ('UNI43',   'UNION')             -- UNION NEGRA - ROLZZO
  ) AS n(cod, sub)
 WHERE i.cod = n.cod;

-- Ninguno de esos códigos puede faltar: si falta, es que alguien lo borró y la
-- lista quedó vieja.
DO $$
DECLARE v_faltan text;
BEGIN
  SELECT string_agg(c, ', ') INTO v_faltan
    FROM unnest(ARRAY['BRA03-B','BRA04','BRA05','DOM34','DOM35','DOM36','DOM37','MEC37','MEC42-B','MEC43-B',
                      'MEC44-B','MEC45-B','TAP28-B','TAP29-B','TAP30','E67-B','E68-B','E69-B','E70-B','E71-B',
                      'E77','PCA07','TIR02','CIN03','CIN05','UNI03','UNI04','UNI42','UNI43',
                      'TAP02','E73','E79-B','UNI18','WALL01']) AS c
   WHERE NOT EXISTS (SELECT 1 FROM insumos WHERE cod = c);
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Estos códigos de la lista ya no existen: %', v_faltan;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. COLOR — NORMALIZAR LAS GRAFÍAS
--    Un mismo color escrito de dos formas son dos colores para la base, y el
--    sufijo del código visible sale de acá.
-- ---------------------------------------------------------------------------

UPDATE insumos SET color = 'CAFE'  WHERE upper(trim(color)) IN ('CAFÉ');
UPDATE insumos SET color = upper(trim(color)) WHERE color IS NOT NULL AND color <> upper(trim(color));
UPDATE insumos SET color = NULL    WHERE trim(coalesce(color, '')) = '';

-- ---------------------------------------------------------------------------
-- 6. COLOR — RELLENAR DESDE EL NEMOTÉCNICO
--    171 artículos que dicen su color en el nombre y tienen la columna vacía.
--    Todos salieron de buscar UN solo color en el NEMOTÉCNICO (no en el
--    descriptor del proveedor, que es menos confiable) y se revisó la lista
--    entera a mano. Quedaron FUERA a propósito:
--      · «METAL» / «METÁLICO» (15 filas): en «broca PARA METAL», «lija PARA
--        METAL», «disco corte METAL» o «tarugo METÁLICO» eso es el material o
--        para qué sirve, no de qué color es. Si se quiere que los 109 tornillos
--        salgan como TOR02-MET, se decide aparte (ver el bloque del final).
--      · «MADERA» (18 filas): igual — «tornillo drywall MADERA», «disco de
--        corte PARA MADERA», «suplemento DE MADERA». La única que sí es un
--        color es DU02, y va en la lista.
--      · INS202, que se llama literalmente «CAFE» porque es café para tomar.
--      · 11 filas donde el color aparecía solo en el descriptor del proveedor
--        y no en el nombre (LAMP01/03/05/16/18, CIN03, CIN05, DOM05, E13,
--        VER64, VER65): están en el bloque del final.
-- ---------------------------------------------------------------------------

UPDATE insumos AS i SET color = n.color
  FROM (VALUES
    ('BK07',    'CRUDO'),        -- BLACKOUT CRUDO
    ('BK08',    'BLANCO'),       -- BLACKOUT BLANCO
    ('BK09',    'CRUDO'),        -- BLACKOUT CRUDO
    ('CIN01',   'TRANSPARENTE'), -- CINTA DE EMBALAJE TRANSPARENTE
    ('CIN04',   'BLANCO'),       -- CINTA PLASTICA PROTECTORA BLANCA
    ('DOM26',   'NEGRO'),        -- CONTROL BOFU NEGRO DAÑADO
    ('DU01',    'GRIS'),         -- DUO BK COLOR GRIS 165X240 CM
    ('DU02',    'MADERA'),       -- DUO POLIESTER COLOR MADERA 165X240 CM
    ('DU03',    'CRUDO'),        -- DUO BK COLOR CRUDO 165X240 CM
    ('DU04',    'CRUDO'),        -- DUO POLIESTER COLOR CRUDO 165X240 CM
    ('DU05',    'PERLA'),        -- DUO POLIESTER COLOR PERLA 165X240 CM
    ('E17',     'BLANCO'),       -- PESO ROLLER BLANCO / SOLMATEC (GAMA B)
    ('E21',     'BLANCO'),       -- PESO LAGRIMA DUO (EN DESUSO) - BLANCO
    ('E23',     'BLANCO'),       -- PESO TERRAZA BLANCO / AN 23 mm
    ('E58',     'NEGRO'),        -- ANGULO NEGRO 50*50
    ('E59',     'GRIS'),         -- PERFIL LATERAL - GRIS - 5.8 MTS
    ('E61',     'BLANCO'),       -- CENEFA OVALADA - BLANCA
    ('E62',     'NEGRO'),        -- CENEFA OVALADA - NEGRA
    ('E63',     'NEGRO'),        -- PESO ROLLER NEGRO
    ('E64',     'BLANCO'),       -- PESO ROLLER BLANCO
    ('E73',     'NEGRO'),        -- PESO -RECTANGULAR-NEGRO
    ('E74',     'BLANCO'),       -- ANGULO EXTENSOR BLANCO 55X25 "PIERNA TP"
    ('E75',     'CAFE'),         -- ANGULO EXTENSOR CAFE 55X25 "PIERNA TP"
    ('E76',     'NEGRO'),        -- ANGULO EXTENSOR NEGRO 55X25 "PIERNA TP"
    ('E77',     'NEGRO'),        -- UNGULO CUADRADO NEGRO 30X30
    ('EPP08',   'AZUL'),         -- OVEROL - BUZO AZUL - TALLA L
    ('EPP14',   'AMARILLO'),     -- LENTE DISCOVERY AF CRISTAL AMARILLO
    ('EPP15',   'GRIS'),         -- LENTE SEMI HERMÉTICO STEELPRO SPYFLEX PLUS
    ('EPP16',   'GRIS'),         -- ANTIPARRA DE SEGURIDAD K-2 STEELPRO
    ('HER54',   'TRANSPARENTE'), -- PEGATANKE TRANSPARENTE
    ('HER66',   'BLANCO'),       -- KIT ELECTRICO + CABLE BLANCO
    ('INM182',  'NEGRO'),        -- BOTAS DE SEGURIDAD NORSEG LISBOA CT NEGRO
    ('INM183',  'GRIS'),         -- BOTAS DE SEGURIDAD NORSEG SINTRA CT GRIS
    ('INM184',  'GRIS'),         -- BOTAS DE SEGURIDAD NORSEG SINTRA CT GRIS
    ('INM185',  'GRIS'),         -- BOTAS DE SEGURIDAD NORSEG SINTRA CT GRIS
    ('INS13',   'AMARILLO'),     -- TERMINALES AMARILLOS
    ('INS16',   'GRIS'),         -- CINTA GRIS / CINTA PARA EMBALAR
    ('INS22',   'NEGRO'),        -- FELPA DELGADA NEGRA 5 X 5MM
    ('INS24',   'BLANCO'),       -- SILICON BLANCO METALES / MADERA / HORMIGON
    ('INS41',   'NEGRO'),        -- BOLSA NEGRA DE BASURA / GRANDE 90x120
    ('INS68',   'NEGRO'),        -- FELPA GRUESA NEGRA 7 X 8 MM
    ('INS69',   'BLANCO'),       -- SELLADOR ACRÍLICO VINÍLICO - BLANCO
    ('INS71',   'TRANSPARENTE'), -- SPRAY TRANSPARENTE
    ('INS73',   'ROJO'),         -- PINTURA SPRAY ROJO SATINADO
    ('INS75',   'NEGRO'),        -- PINTURA SPRAY NEGRO MATE ALTA TEMPERATURA
    ('INS77',   'GRIS'),         -- PINTURA SPRAY GRIS
    ('INS82',   'BLANCO'),       -- PINTURA SPRAY BLANCO
    ('INS83',   'BLANCO'),       -- SPRAY IMPRIMANTE FONDO BLANCO
    ('INS84',   'NEGRO'),        -- FELPA GRUESA NEGRA 7 X 6 MM
    ('INS92',   'GRIS'),         -- BOTAS DE SEGURIDAD NORSEG SINTRA CT GRIS
    ('INS95',   'NEGRO'),        -- ETIQUETA CORTINAS ROLZZO (NEGRA)
    ('INS95-1', 'BLANCO'),       -- ETIQUETA CORTINAS ROLZZO (BLANCA)
    ('INS96',   'TRANSPARENTE'), -- REGLA DE CONEXION TRANSPARENTE 6MM
    ('INS99',   'NEGRO'),        -- MARCOS DE FOTO SET CUADROS DECORATIVOS
    ('INS102',  'AZUL'),         -- LAPIZ PASTA AZUL / BOLIGRAFO AZUL
    ('INS112',  'BEIGE'),        -- BOTAS DE SEGURIDAD NORSEG BEIGE [TALLA 37]
    ('INS114',  'BLANCO'),       -- SOBRE TAMAÑO OFICIO BLANCO
    ('INS115',  'BLANCO'),       -- CARPETA BLANCA TAMAÑO CARTA
    ('INS117',  'NEGRO'),        -- CARPETA NEGRA TAMAÑO CARTA
    ('INS132',  'TRANSPARENTE'), -- CAJA CON TAPA TRANSPARENTE 15 LITROS
    ('INS133',  'TRANSPARENTE'), -- CAJA CON TAPA TRANSPARENTE 28 LITROS
    ('INS134',  'VERDE'),        -- CAJA PLASTICA DE HERRAMIENTA VERDE
    ('INS137',  'BLANCO'),       -- PINTURA SPRAY BLANCO MATE
    ('INS138',  'ROJO'),         -- BOLIGRAFO ROJO
    ('INS151',  'VERDE'),        -- BOLIGRAFO VERDE
    ('INS152',  'NEGRO'),        -- BOLIGRAFO NEGRO
    ('INS154',  'BLANCO'),       -- PINTURA SHERTRUCK PLUS BLANCA 3,785 LITROS
    ('INS155',  'NEGRO'),        -- PINTURA SHERTRUCK PLUS NEGRO 3,785 LITROS
    ('INS160',  'AZUL'),         -- CINTA AISLANTE AZUL
    ('INS161',  'GRIS'),         -- ARCHIVADOR GRIS TAMAÑO OFICIO
    ('INS164',  'TRANSPARENTE'), -- MANGA TRANSPARENTE 15CMX80 MICRONES
    ('INS173',  'TRANSPARENTE'), -- MANGA TRANSPARENTE TUBULAR 110 CM
    ('INS177',  'TRANSPARENTE'), -- MANGA TRANSPARENTE 10 CM X 80 MICRONES
    ('INS187',  'BLANCO'),       -- PAÑO BLANCO PEQUEÑO
    ('INS197',  'NEGRO'),        -- SILICONA NEUTRA MULTIUSOS NEGRA
    ('INS215',  'AZUL'),         -- TINTA AZUL
    ('INS230',  'NEGRO'),        -- CARPETA NEGRA VENDEDORES
    ('INS231',  'BLANCO'),       -- MARCADOR TIZA LIQUIDA BLANCO
    ('INS239',  'NEGRO'),        -- GOMA ESPUMA NEGRA 10MM
    ('INS242',  'AMARILLO'),     -- ELASTICOS DE GOMA AMARILLOS
    ('INS245',  'NEGRO'),        -- TAPAS SOB. GRANDE NEGRA
    ('INS247',  'CAFE'),         -- RH TAPAS SOBERBIO CAFE
    ('INS253',  'NEGRO'),        -- FELPA GRUESA NEGRA 7 X 6 MM
    ('INS260',  'VERDE'),        -- ARNES REFLECTANTE CHALECO SEGURIDAD VERDE
    ('INS262',  'BLANCO'),       -- CASCO DE SEGURIDAD BLANCO
    ('INS263',  'AMARILLO'),     -- CASCO PROSEG AMARILLO
    ('LAMP04',  'BLANCO'),       -- LAMPARA YORTH BLANCA 32528
    ('LAMP14',  'DORADO'),       -- LAMPARA ALBARACIN 98523 COLOR DORADO
    ('LAMP19',  'AZUL'),         -- LAMPARA PIONDRO-P 49075 AZUL
    ('MEC07',   'BLANCO'),       -- MECANISMO PARA CENEFA OVALADA - BLANCO
    ('MEC21',   'BLANCO'),       -- .45 BLANCO - MARY GATES - DESUSO
    ('MIC01',   'TRANSPARENTE'), -- MICA TRANSPARENTE CENEFA
    ('MIC02',   'TRANSPARENTE'), -- MICA TRANSPARENTE CENEFA
    ('MIC03',   'TRANSPARENTE'), -- MICA TRANSPARENTE CENEFA CON ADHESIVO
    ('PCA07',   'TRANSPARENTE'), -- PESO PORTA CADENA TRANSPARENTE / CUADRADA
    ('SC06',    'CRUDO'),        -- SCREEN COLOR CRUDO 165X250 CM
    ('SC10',    'BEIGE'),        -- SCREEN BEIGE
    ('SLM01',   'BLANCO'),       -- HONEYCOMB WINDOW SIDE RAILS [BLANCO]
    ('SLM02',   'NEGRO'),        -- HONEYCOMB WINDOW SIDE RAILS [NEGRO]
    ('SLM03',   'CAFE'),         -- HONEYCOMB WINDOW EDGE RAILS [CAFÉ]
    ('SML04',   'BLANCO'),       -- MOVING WINDOW HIGH RAIL [BLANCO]
    ('SML05',   'NEGRO'),        -- MOVING WINDOW HIGH RAIL [NEGRO]
    ('SML06',   'CAFE'),         -- MOVING WINDOW HIGH RAIL [CAFÉ]
    ('SML07',   'BLANCO'),       -- MOVE WINDOW LOW RAIL [BLANCO]
    ('SML08',   'NEGRO'),        -- MOVE WINDOW LOW RAIL [NEGRO]
    ('SML09',   'CAFE'),         -- MOVE WINDOW LOW RAIL [CAFE]
    ('SML10',   'BLANCO'),       -- AGARRADERAS - MAGNETIC BIDIRECTIONAL TRACK
    ('SML11',   'NEGRO'),        -- AGARRADERAS - MAGNETIC BIDIRECTIONAL TRACK
    ('SML12',   'CAFE'),         -- AGARRADERAS - MAGNETIC BIDIRECTIONAL TRACK
    ('SML13',   'BLANCO'),       -- KIT ARMADO - HERRAJES PARA VENTANA
    ('SML14',   'NEGRO'),        -- KIT ARMADO - HERRAJES PARA VENTANA
    ('SML15',   'CAFE'),         -- KIT ARMADO - HERRAJES PARA VENTANA
    ('SML16',   'BLANCO'),       -- ESQUINERO GRANDE [BLANCO]
    ('SML17',   'NEGRO'),        -- ESQUINERO GRANDE [NEGRO]
    ('SML18',   'CAFE'),         -- ESQUINERO GRANDE [CAFE]
    ('SML21',   'CAFE'),         -- TAPA TORNILLO ESQUINERO LARGO [CAFE]
    ('SML24',   'CAFE'),         -- ESQUINERO CORTO [CAFE]
    ('SML25',   'BLANCO'),       -- CARRO TRANSPORTADOR GUÍA DE NYLON [BLANCO]
    ('SML27',   'BLANCO'),       -- CABEZAL DE CIERRE VENTANA [BLANCO]
    ('SML28',   'NEGRO'),        -- CABEZAL DE CIERRE VENTANA [NEGRO]
    ('SML29',   'CAFE'),         -- CABEZAL DE CIERRE VENTANA [CAFÉ]
    ('TAP02',   'GRIS'),         -- TAPA PESO GRIS / SOLMATEC
    ('TAP03',   'BLANCO'),       -- TAPA PESO BLANCO ROLLER / FABRICS
    ('TAP06',   'BLANCO'),       -- TAPA PESO BLANCO TERRAZA/OVALADA
    ('TAP07',   'BLANCO'),       -- PESO TERRAZA PEQUEÑO / BLANCO
    ('TAP08',   'BLANCO'),       -- TAPA PESO BLANCO TERRAZA / RECTANGULAR
    ('TAP14',   'NEGRO'),        -- TAPA NEGRA SINFLEX
    ('TAP16',   'NEGRO'),        -- TAPA NEGRA CHANTILLY (EN DESUSO)
    ('TAP19',   'BLANCO'),       -- TAPA PESO BLANCO ROLLER [IZQUIERDO]
    ('TAP24',   'NEGRO'),        -- TAPA SOBERBIO GRANDE NEGRA 10 UND
    ('TAP25',   'BLANCO'),       -- TAPA SOBERBIO GRANDE BLANCA 144 UND
    ('TAP31',   'NEGRO'),        -- TAPA PESO DARK NEGRO
    ('TIR02',   'AZUL'),         -- TIRRO AZUL / MASKING TAPE AZUL
    ('TOP05',   'NEGRO'),        -- TOPES NEGROS - ROLZZO
    ('UNI03',   'GRIS'),         -- UNIONES GRISES
    ('UNI04',   'NEGRO'),        -- UNIONES NEGRAS
    ('UNI16',   'NEGRO'),        -- SWEATER HOMBRE XXL NEGRO USADO
    ('UNI17',   'GRIS'),         -- SWEATER HOMBRE XXL GRIS USADO
    ('UNI18',   'NEGRO'),        -- GORRA NEGRA ROLZZO
    ('UNI23',   'AZUL'),         -- CAMISA (POLERA) AZUL MUJER TALLA "XS"
    ('UNI24',   'AZUL'),         -- CAMISA (POLERA) AZUL MUJER TALLA "S"
    ('UNI25',   'AZUL'),         -- CAMISA (POLERA) AZUL MUJER TALLA "L"
    ('UNI26',   'AZUL'),         -- CAMISA (POLERA) AZUL MUJER TALLA "XL"
    ('UNI27',   'AZUL'),         -- CAMISA AZUL ROLZZO HOMBRE "M" USADA
    ('UNI28',   'AZUL'),         -- CAMISA (POLERA) AZUL MUJER TALLA "S" USADA
    ('UNI29',   'AZUL'),         -- CAMISA (POLERA) AZUL ROLZZO VENDEDOR "M"
    ('UNI30',   'AZUL'),         -- CAMISA (POLERA) AZUL ROLZZO VENDEDOR "L"
    ('UNI34',   'GRIS'),         -- CAMISA (POLERA) GRIS USADAS
    ('UNI37',   'GRIS'),         -- SWEATER HOMBRE XXL GRIS NUEVA
    ('UNI38',   'GRIS'),         -- SWEATER MUJER M GRIS NUEVA
    ('UNI39',   'GRIS'),         -- SWEATER MUJER L GRIS NUEVA
    ('UNI40',   'GRIS'),         -- SWEATER MUJER XXL GRIS NUEVA
    ('UNI43',   'NEGRO'),        -- UNION NEGRA - ROLZZO
    ('UNI44',   'NEGRO'),        -- SWETERS / POLERON ABIERTO NEGRO ROLZZO
    ('UNI45',   'NEGRO'),        -- SWETERS / POLERON ABIERTO NEGRO ROLZZO
    ('UNI46',   'NEGRO'),        -- SWETERS / POLERON ABIERTO NEGRO ROLZZO
    ('UNI47',   'NEGRO'),        -- SWETERS / POLERON ABIERTO NEGRO ROLZZO
    ('UNI48',   'NEGRO'),        -- SWETERS / POLERON ABIERTO NEGRO ROLZZO
    ('UNI49',   'NEGRO'),        -- SWETERS / POLERON ABIERTO NEGRO ROLZZO
    ('VER12',   'BLANCO'),       -- CORDON CORTINA VERTICAL BLANCO
    ('VER21',   'NEGRO'),        -- CORDON CORTINA VERTICAL NEGRO
    ('VER25',   'BLANCO'),       -- TOPE BLANCO CORTINA VERTICAL
    ('VER47',   'NEGRO'),        -- RETEN NEGRO VERTICAL VERTILUX
    ('VER57',   'BLANCO'),       -- PESO CORDON VERTICAL BLANCO
    ('ZUN01',   'GRIS'),         -- ZUNCHO GRIS 9MM / MERIGGI
    ('ZUN02',   'GRIS'),         -- ZUNCHO GRIS 12MM / MERIGGI
    ('ZUN03',   'AZUL'),         -- ZUNCHO AZUL 7 MM / SINFLEX
    ('ZUN04',   'TRANSPARENTE'), -- ZUNCHO TRANSPARENTE 11 MM
    ('ZUN05',   'TRANSPARENTE'), -- ZUNCHO TRANSPARENTE 9 MM
    ('ZUN06',   'AZUL'),         -- ZUNCHO AZUL 12 MM
    ('ZUN07',   'BLANCO'),       -- ZUNCHO BLANCO 8 MM / 600 MTR / ROLL
    ('ZUN08',   'AZUL')          -- ZUNCHO AZUL 9MM
  ) AS n(cod, color)
 WHERE i.cod = n.cod
   -- Solo donde no había color. Si alguien ya lo llenó a mano, manda esa fila:
   -- una persona mirando el artículo sabe más que su nombre.
   AND coalesce(nullif(upper(trim(coalesce(i.color, ''))), 'N/A'), '') = '';

-- ---------------------------------------------------------------------------
-- 7. VERIFICACIÓN
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_cod_movidos    int;
  v_sin_validador  text;
  v_materiales     int;
  v_con_color      int;
  v_total          int;
BEGIN
  -- Lo primero y más importante: NINGÚN código se movió.
  SELECT count(*) INTO v_cod_movidos
    FROM insumos i JOIN insumos_backup_reclasif_20260910 b ON b.id = i.id
   WHERE i.cod IS DISTINCT FROM b.cod;
  IF v_cod_movidos <> 0 THEN
    RAISE EXCEPTION 'Se movieron % códigos y este script no debe tocar ninguno', v_cod_movidos;
  END IF;

  -- Todo valor en uso tiene que existir en los validadores, o el formulario
  -- volvería a mostrar un desplegable que no contiene lo que la fila ya dice.
  SELECT string_agg(DISTINCT campo || '=' || valor, ', ') INTO v_sin_validador
    FROM (
      SELECT 'CATEGORIA' AS campo, categoria AS valor FROM insumos WHERE coalesce(categoria,'') <> ''
      UNION SELECT 'SUB_CATEGORIA', sub_categoria FROM insumos WHERE coalesce(sub_categoria,'') <> ''
      UNION SELECT 'COLOR', color FROM insumos WHERE coalesce(color,'') <> ''
    ) u
   WHERE NOT EXISTS (
     SELECT 1 FROM validadores_insumos v WHERE v.campo = u.campo AND v.valor = u.valor);
  IF v_sin_validador IS NOT NULL THEN
    RAISE EXCEPTION 'Hay valores en uso sin fila en validadores_insumos: %', v_sin_validador;
  END IF;

  SELECT count(*) FILTER (WHERE sub_categoria = 'MATERIALES'),
         count(*) FILTER (WHERE coalesce(nullif(upper(trim(coalesce(color,''))),'N/A'),'') <> ''),
         count(*)
    INTO v_materiales, v_con_color, v_total
    FROM insumos;

  RAISE NOTICE '--------------------------------------------------------------';
  RAISE NOTICE 'Insumos: %  ·  códigos movidos: 0', v_total;
  RAISE NOTICE 'En MATERIALES: % (antes 590)', v_materiales;
  RAISE NOTICE 'Con color: % de % (antes 261)', v_con_color, v_total;
  RAISE NOTICE 'Subcategorías en uso: % · en el formulario: %',
    (SELECT count(DISTINCT sub_categoria) FROM insumos WHERE coalesce(sub_categoria,'') <> ''),
    (SELECT count(*) FROM validadores_insumos WHERE campo = 'SUB_CATEGORIA' AND activo IS NOT FALSE);
  RAISE NOTICE '--------------------------------------------------------------';
END $$;

DO $$ BEGIN RAISE NOTICE '=== Insumos 02 · reclasificación — LISTO ==='; END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- PARA DECIDIR A MANO — este script NO aplica nada de acá
-- ============================================================================
--
-- (a) CINCO CAMISAS QUE SE CONTRADICEN. La columna dice NEGRO y el nombre dice
--     AZUL. Son las mismas camisas que UNI23-30, que sí son azules.
--       UNI19  CAMISA (POLERA) TALLA "M" ROLZZO      columna NEGRO / nombre AZUL
--       UNI20  CAMISA (POLERA) TALLA "L" ROLZZO      columna NEGRO / nombre AZUL
--       UNI21  CAMISA (POLERA) TALLA "XL" ROLZZO     columna NEGRO / nombre AZUL
--       UNI22  CAMISA (POLERA) TALLA "S" ROLZZO      columna NEGRO / nombre AZUL
--       UNI31  CAMISA (POLERA) TALLA "2XL" ROLZZO    columna NEGRO / nombre AZUL
--     Si son azules:
--       UPDATE insumos SET color = 'AZUL' WHERE cod IN ('UNI19','UNI20','UNI21','UNI22','UNI31');
--
-- (b) BICOLORES DE VERDAD. Llevan dos colores y la columna guarda uno solo.
--       INM186/187/188  BOTAS NORSEG KINGSTON BEIGE/NEGRO
--       INS153          CAJA PLASTICA VERDE TAPA GRIS
--       INS97           LUCES LED PANEL BLANCAS/AMARILLAS
--       LAMP02          LAMPARA TOMARES 39144        (negro + dorado)
--       LAMP10          LAMPARA PINTO NERO 1 97767   (negro + dorado)
--       LAMP17          LAMPARA SABINAR 96981        (blanco + madera)
--     Sugerencia: dejar el color DOMINANTE, que es el que se ve en la etiqueta.
--
-- (c) ONCE FILAS CON EL COLOR SOLO EN EL DESCRIPTOR DEL PROVEEDOR, no en el
--     nombre. Es más flojo como evidencia, así que se dejan a la vista:
--       CIN03, CIN05  (cinta doble contacto → NEGRO)
--       DOM05         (router 2,4 GHz → BLANCO)
--       E13           (peso interno lágrima SINFLEX → BLANCO)
--       LAMP01, LAMP03, LAMP05, LAMP16, LAMP18   (lámparas → NEGRO;
--                     ojo que LAMP16 se llama «OIELLA MARRON»)
--       VER64, VER65  (Cord/Chain Weight Pulley Black / White; el nombre está
--                     en inglés, por eso no lo tomó la búsqueda en español)
--
-- (d) ¿LOS 109 TORNILLOS SON «METAL»? Hoy 17 tornillos del mismo tipo están
--     marcados METAL y el resto sin color. Si se completa, se verían como
--     TOR02-MET en la etiqueta. Es una decisión, no un dato:
--       UPDATE insumos SET color = 'METAL'
--        WHERE cod ~ '^TOR[0-9]' AND coalesce(nullif(upper(trim(coalesce(color,''))),'N/A'),'') = '';
--
-- (e) DOS PARES DUPLICADOS que la estadística destapó:
--       E61  CENEFA OVALADA - BLANCA   ≟  E27  (misma pieza, mismo color)
--       E62  CENEFA OVALADA - NEGRA    ≟  E26
--       BK07 BLACKOUT CRUDO            ≟  BK09 BLACKOUT CRUDO
--     Si se confirma, el método es el del renombre E78→E39: NO se borra, se
--     marca el sobrante y se anota a qué código apunta.
--       UPDATE insumos SET status = 'AGOTADO', estado_inventario = 'DESCONTINUADO'
--        WHERE cod = 'E61';   -- y el comentario «duplicado de E27»
--
-- (f) CUATRO FAMILIAS QUE NO SON MATERIAL DE CORTINA y siguen en MATERIALES
--     porque no sé en qué cajón van:
--       UTEN01-06  cubertería y sets Laguiole / Viola Bohemia
--       VAS01-04   sets de vasos
--       ESTU02     estufa a gas infrarroja
--       GEN01-03   generadores  (¿HERRAMIENTA en vez de INSUMO?)
--       CAR01      carro de carga · CAR02 carbones DWE7470 (la familia mezcla)
--       CIN04      cinta plástica protectora blanca
--
-- ============================================================================
-- REVERSA — deja todo como estaba antes de este script
-- ============================================================================
-- BEGIN;
--
-- UPDATE insumos AS i
--    SET categoria     = b.categoria,
--        sub_categoria = b.sub_categoria,
--        color         = b.color
--   FROM insumos_backup_reclasif_20260910 b
--  WHERE b.id = i.id;
--
-- DELETE FROM validadores_insumos v
--  WHERE NOT EXISTS (SELECT 1 FROM validadores_backup_reclasif_20260910 b WHERE b.id = v.id);
--
-- -- Comprobación: 0 filas distintas al respaldo.
-- SELECT count(*) AS filas_distintas
--   FROM insumos i JOIN insumos_backup_reclasif_20260910 b ON b.id = i.id
--  WHERE (i.categoria, i.sub_categoria, i.color) IS DISTINCT FROM (b.categoria, b.sub_categoria, b.color);
--
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
--
-- DROP TABLE IF EXISTS insumos_backup_reclasif_20260910;
-- DROP TABLE IF EXISTS validadores_backup_reclasif_20260910;
-- ============================================================================
