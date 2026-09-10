-- ============================================================================
-- INSUMOS 01 — Familias de código, forma del código y alta automática
-- Fecha: 2026-09-10
-- ============================================================================
--
-- POR QUÉ:
--   Hoy el código de un insumo nace a mano, en un campo de texto libre, sin
--   forma ni correlativo: el formulario propone «INS-1234», un formato que no
--   existe en la tabla, y las altas por SQL eligen el número a ojo. Así se
--   llegó a 38 prefijos, un código con espacio («DOM 18»), un código que es
--   «0», y numeración con huecos y padding disparejo (INS99 y luego INS100).
--
-- QUÉ HACE (y qué NO hace):
--   · NO renombra el catálogo. `insumos.cod` es la LLAVE: está escrita en 14
--     columnas de texto de esta base, en 7 claves JSON de `configuracion`, en
--     el optimizador legacy, en los QR pegados en el galpón y en los Excel de
--     las vendedoras. Se congela. El color y el orden se resuelven en lo que
--     se VE (código visible «MEC32-BCO»), no en la llave.
--   · Corrige los códigos que no tienen forma sana, con el método del renombre
--     E78→E39: respaldo, `\y` y aserción. Hoy es UNO SOLO, «DOM 18»; el viejo
--     código «0» ya no está en la tabla, y el paso lo contempla por si vuelve.
--   · Crea `familias_insumo`, que es la tabla de rangos de numeración: cada
--     prefijo con su próximo correlativo y sus dígitos.
--   · Deja el alta en manos de la base (`insumo_crear`), para que dos personas
--     dando de alta a la vez no puedan quedarse con el mismo número.
--
-- ENSAYADO contra producción el 2026-09-09 dentro de BEGIN … ROLLBACK:
--   1.012 insumos · 37 familias sembradas · 1 código corregido (DOM 18 → DOM18)
--   · 0 OTs y 0 claves de configuración lo nombraban · 3 dígitos para HER, INM,
--   INS y TOR · MEC sigue en 46, INS en 265, E en 80, CAD en 22, DOM en 54.
--   Con una sesión de admin real: dos altas seguidas dieron MEC46 y MEC47 y
--   dejaron el correlativo en 48; INS dio INS265 (tres dígitos); «zzz 07» a
--   mano quedó como ZZZ07; y los rechazos salieron con su código —IN011
--   familia desconocida, IN012 forma inválida, IN013 repetido, IN015 unidad
--   inventada—. Tras el ROLLBACK la base quedó igual: sin tabla, sin CHECK y
--   sin funciones.
--
-- ES IDEMPOTENTE salvo por el correlativo: correrlo dos veces no duplica nada
-- (las tablas y funciones son `IF NOT EXISTS` / `OR REPLACE`, la semilla es
-- `ON CONFLICT DO NOTHING` y la corrección de códigos ya no encuentra nada
-- que corregir).
--
-- OJO con `\y`: en Postgres `\b` es el carácter BACKSPACE, NO el límite de
-- palabra. El límite es `\y`. Un patrón con `\b` no calza nunca y el UPDATE
-- «tiene éxito» sin tocar una sola fila.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Insumos 01 · familias y forma del código — INICIADO ==='; END $$;

DO $$
BEGIN
  IF to_regclass('public.insumos') IS NULL THEN
    RAISE EXCEPTION 'No existe la tabla insumos';
  END IF;
  IF to_regclass('public.unidades') IS NULL THEN
    RAISE EXCEPTION 'Falta correr antes sql/20260908_inventario_01_catalogos.sql';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Respaldos
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS insumos_backup_codigos_20260910;
CREATE TABLE insumos_backup_codigos_20260910 AS SELECT * FROM insumos;

DROP TABLE IF EXISTS configuracion_backup_codigos_20260910;
CREATE TABLE configuracion_backup_codigos_20260910 AS
SELECT * FROM configuracion
WHERE clave LIKE 'opt\_%'
   OR clave IN ('catalogo_reemplazos_data', 'reglas_seleccion', 'reglas_seleccion_respaldos');

DROP TABLE IF EXISTS ots_backup_codigos_20260910;
CREATE TABLE ots_backup_codigos_20260910 AS
SELECT * FROM ots WHERE items::text ~ '\yDOM 18\y';

DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM insumos_backup_codigos_20260910;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'El respaldo de insumos quedó vacío: se aborta antes de tocar nada';
  END IF;
  RAISE NOTICE 'Respaldo: % insumos, % filas de configuracion, % OTs con «DOM 18»',
    v_n,
    (SELECT count(*) FROM configuracion_backup_codigos_20260910),
    (SELECT count(*) FROM ots_backup_codigos_20260910);
END $$;

-- Qué claves de configuración nombran «DOM 18», para que quede en el registro
-- de la corrida antes de tocarlas.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT clave, count(*) AS n FROM configuracion WHERE valor ~ '\yDOM 18\y' GROUP BY clave
  LOOP
    RAISE NOTICE 'configuracion con «DOM 18» → clave=% filas=%', r.clave, r.n;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Los dos códigos malformados
-- ─────────────────────────────────────────────────────────────────────────────
--
-- «DOM 18» (motor cableado Bofu) es el ÚNICO código de insumo con espacio. Ojo
-- con la confusión: en el catálogo de PRODUCTOS el espacio sí es la norma
-- («DOM 47» es un `codInt` legítimo, y vive en `catalogo_productos_data`). Por
-- eso esa clave se excluye a propósito de todos los reemplazos de abajo.
--
-- «0» es el papel toalla que entró con el código del proveedor en blanco.

DO $$
DECLARE
  v_cod_nuevo text;
  v_n         integer;
BEGIN
  -- ── DOM 18 → DOM18 ──
  IF EXISTS (SELECT 1 FROM insumos WHERE cod = 'DOM 18') THEN
    IF EXISTS (SELECT 1 FROM insumos WHERE cod = 'DOM18') THEN
      RAISE EXCEPTION 'Ya existe un DOM18: hay que fusionarlos a mano, no renombrar encima';
    END IF;

    UPDATE insumos
       SET cod = 'DOM18',
           comentarios = COALESCE(NULLIF(btrim(comentarios), '') || ' · ', '')
                         || 'Código «DOM 18» corregido a DOM18 el 2026-09-10 (tenía un espacio)',
           updated_at = now()
     WHERE cod = 'DOM 18';

    UPDATE movimientos_insumos   SET codigo        = regexp_replace(codigo,        '\yDOM 18\y', 'DOM18', 'g') WHERE codigo        ~ '\yDOM 18\y';
    UPDATE inventario_movimientos SET item_cod     = regexp_replace(item_cod,      '\yDOM 18\y', 'DOM18', 'g') WHERE item_cod      ~ '\yDOM 18\y';
    UPDATE ubicaciones_rack      SET codigo_insumo = regexp_replace(codigo_insumo, '\yDOM 18\y', 'DOM18', 'g') WHERE codigo_insumo ~ '\yDOM 18\y';
    UPDATE alertas_stock         SET codigo        = regexp_replace(codigo,        '\yDOM 18\y', 'DOM18', 'g') WHERE codigo        ~ '\yDOM 18\y';

    IF to_regclass('public.conteo_lineas') IS NOT NULL THEN
      UPDATE conteo_lineas SET item_cod = regexp_replace(item_cod, '\yDOM 18\y', 'DOM18', 'g')
       WHERE item_cod ~ '\yDOM 18\y';
    END IF;

    -- Las OTs guardan el modelo de motor dentro del JSON de cada paño.
    UPDATE ots SET items = regexp_replace(items::text, '\yDOM 18\y', 'DOM18', 'g')::jsonb
     WHERE items::text ~ '\yDOM 18\y';

    -- Reglas, catálogo de reemplazos y las cachés del optimizador. NUNCA
    -- `catalogo_productos_data`: ahí el espacio es la grafía del producto.
    UPDATE configuracion SET valor = regexp_replace(valor, '\yDOM 18\y', 'DOM18', 'g')
     WHERE valor ~ '\yDOM 18\y'
       AND (clave LIKE 'opt\_%'
            OR clave IN ('catalogo_reemplazos_data', 'reglas_seleccion', 'reglas_seleccion_respaldos'));

    RAISE NOTICE 'DOM 18 → DOM18 (y sus referencias)';
  ELSE
    RAISE NOTICE 'No hay ningún «DOM 18»: nada que corregir';
  END IF;

  -- ── 0 → el siguiente INS libre ──
  --
  -- Acá NO se usa regex: `\y0\y` calzaría con cualquier cero suelto de
  -- cualquier texto. Solo igualdad exacta, y solo en columnas de código.
  IF EXISTS (SELECT 1 FROM insumos WHERE cod = '0') THEN
    SELECT 'INS' || lpad((COALESCE(max(substring(cod from '^INS([0-9]+)')::int), 0) + 1)::text, 3, '0')
      INTO v_cod_nuevo
      FROM insumos WHERE cod ~ '^INS[0-9]+$';

    UPDATE insumos
       SET cod = v_cod_nuevo,
           comentarios = COALESCE(NULLIF(btrim(comentarios), '') || ' · ', '')
                         || 'Código «0» renombrado a ' || v_cod_nuevo || ' el 2026-09-10 (no tenía código)',
           updated_at = now()
     WHERE cod = '0';

    UPDATE movimientos_insumos    SET codigo        = v_cod_nuevo WHERE codigo = '0';
    UPDATE inventario_movimientos SET item_cod      = v_cod_nuevo WHERE item_cod = '0';
    UPDATE ubicaciones_rack       SET codigo_insumo = v_cod_nuevo WHERE codigo_insumo = '0';
    UPDATE alertas_stock          SET codigo        = v_cod_nuevo WHERE codigo = '0';
    IF to_regclass('public.conteo_lineas') IS NOT NULL THEN
      UPDATE conteo_lineas SET item_cod = v_cod_nuevo WHERE item_cod = '0';
    END IF;

    RAISE NOTICE '0 → % (y sus referencias)', v_cod_nuevo;
  ELSE
    RAISE NOTICE 'No hay ningún código «0»: nada que corregir';
  END IF;

  -- Si queda algún otro código sin forma sana, se aborta ANTES de crear el
  -- constraint: el mensaje de la lista es más útil que un error de CHECK.
  SELECT count(*) INTO v_n FROM insumos
   WHERE cod !~ '^[A-Z]{1,4}[0-9]{2,3}(-[A-Z0-9]{1,2})?$';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Quedan % códigos con forma inválida: %', v_n,
      (SELECT string_agg(cod, ', ') FROM insumos
        WHERE cod !~ '^[A-Z]{1,4}[0-9]{2,3}(-[A-Z0-9]{1,2})?$');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) familias_insumo — los rangos de numeración
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Una fila por prefijo. `siguiente` es el próximo correlativo y lo mueve la
-- función de alta, no la pantalla. `digitos` es el relleno de los códigos
-- NUEVOS de esa familia (3 en las que ya pasaron de 99, para que INS270 no
-- ordene antes que INS99).
CREATE TABLE IF NOT EXISTS familias_insumo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL,
  prefijo        text NOT NULL CHECK (prefijo ~ '^[A-Z]{1,4}$'),
  nombre         text NOT NULL,
  categoria      text,
  sub_categoria  text,
  digitos        integer NOT NULL DEFAULT 2 CHECK (digitos IN (2, 3)),
  siguiente      integer NOT NULL DEFAULT 1 CHECK (siguiente >= 1),
  activo         boolean NOT NULL DEFAULT true,
  descripcion    text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'familias_insumo'::regclass AND conname = 'familias_insumo_unica'
  ) THEN
    ALTER TABLE familias_insumo ADD CONSTRAINT familias_insumo_unica UNIQUE (empresa_id, prefijo);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_familias_insumo_empresa ON familias_insumo (empresa_id, activo);

ALTER TABLE familias_insumo ENABLE ROW LEVEL SECURITY;

-- La lista la lee cualquiera que da de alta; editarla es del admin.
DROP POLICY IF EXISTS familias_select_empresa ON familias_insumo;
CREATE POLICY familias_select_empresa ON familias_insumo FOR SELECT
  USING (empresa_id = (SELECT get_my_empresa_id()));

DROP POLICY IF EXISTS familias_escribe_admin ON familias_insumo;
CREATE POLICY familias_escribe_admin ON familias_insumo FOR ALL
  USING (empresa_id = (SELECT get_my_empresa_id())
         AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','superadmin')))
  WITH CHECK (empresa_id = (SELECT get_my_empresa_id())
         AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','superadmin')));

-- Semilla desde lo que YA existe: el prefijo es lo que va antes del primer
-- número, `siguiente` es el mayor + 1, y la categoría es la que más se repite
-- en esa familia (no la única: INS mezcla, y eso se arregla por datos, no acá).
INSERT INTO familias_insumo (empresa_id, prefijo, nombre, categoria, sub_categoria, digitos, siguiente, descripcion)
SELECT p.empresa_id,
       p.prefijo,
       p.prefijo,
       mode() WITHIN GROUP (ORDER BY p.categoria),
       mode() WITHIN GROUP (ORDER BY p.sub_categoria),
       CASE WHEN max(p.numero) > 99 THEN 3 ELSE 2 END,
       max(p.numero) + 1,
       CASE p.prefijo
         WHEN 'SLM' THEN 'Grafía invertida de SML. No dar de alta acá: los bee-black van en SML.'
       END
  FROM (
    SELECT empresa_id,
           substring(cod from '^([A-Z]{1,4})')            AS prefijo,
           substring(cod from '^[A-Z]{1,4}([0-9]+)')::int AS numero,
           categoria, sub_categoria
      FROM insumos
     WHERE cod ~ '^[A-Z]{1,4}[0-9]{2,3}(-[A-Z0-9]{1,2})?$'
  ) p
 GROUP BY p.empresa_id, p.prefijo
ON CONFLICT (empresa_id, prefijo) DO NOTHING;

UPDATE familias_insumo SET activo = false WHERE prefijo = 'SLM' AND activo;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) La forma del código, escrita en la base
-- ─────────────────────────────────────────────────────────────────────────────
--
--   1 a 4 letras · 2 o 3 dígitos · opcionalmente «-B» (categoría B) o «-1».
--
-- Admite MEC44-B, E69-B, INS20-1, LAMP01, WALL01, INS100, INM179.
-- Rechaza «CAD 13», «INS-1234», «E1», «0», «DOM 18».
--
-- Se agrega NOT VALID y se valida enseguida: si algo quedó fuera de forma, el
-- VALIDATE aborta la transacción entera y no se guarda nada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'insumos'::regclass AND conname = 'insumos_cod_forma'
  ) THEN
    ALTER TABLE insumos ADD CONSTRAINT insumos_cod_forma
      CHECK (cod ~ '^[A-Z]{1,4}[0-9]{2,3}(-[A-Z0-9]{1,2})?$') NOT VALID;
  END IF;
END $$;

ALTER TABLE insumos VALIDATE CONSTRAINT insumos_cod_forma;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) insumo_siguiente_codigo — previsualizar, sin avanzar nada
-- ─────────────────────────────────────────────────────────────────────────────
--
-- La pantalla lo muestra mientras se llena el formulario. NO reserva: reservar
-- quemaría un correlativo cada vez que alguien cancela el diálogo, y en este
-- catálogo un hueco SIGNIFICA «código dado de baja con etiquetas e historial
-- todavía vivos». El número definitivo lo asigna `insumo_crear`.
CREATE OR REPLACE FUNCTION insumo_siguiente_codigo(p_prefijo text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa uuid;
  v_pref    text := upper(btrim(COALESCE(p_prefijo, '')));
  v_n       integer;
  v_dig     integer;
BEGIN
  SELECT empresa_id INTO v_empresa FROM perfiles WHERE id = auth.uid();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = 'IN010';
  END IF;

  SELECT siguiente, digitos INTO v_n, v_dig
    FROM familias_insumo
   WHERE empresa_id = v_empresa AND prefijo = v_pref AND activo;
  IF v_n IS NULL THEN
    RAISE EXCEPTION 'No conozco la familia %', v_pref
      USING ERRCODE = 'IN011',
            HINT = 'Créala en Inventario → Configuración → Familias de código.';
  END IF;

  -- Salta lo que ya exista: los huecos de la numeración no se reutilizan.
  WHILE EXISTS (
    SELECT 1 FROM insumos
     WHERE empresa_id = v_empresa AND cod = v_pref || lpad(v_n::text, v_dig, '0')
  ) LOOP
    v_n := v_n + 1;
  END LOOP;

  RETURN v_pref || lpad(v_n::text, v_dig, '0');
END;
$fn$;

REVOKE ALL ON FUNCTION insumo_siguiente_codigo(text) FROM public;
GRANT EXECUTE ON FUNCTION insumo_siguiente_codigo(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) insumo_crear — asigna el código e inserta, en la misma transacción
-- ─────────────────────────────────────────────────────────────────────────────
--
-- El código lo elige la base y no el navegador: con dos personas dando de alta
-- a la vez, el `FOR UPDATE` de la fila de familia hace que la segunda espere y
-- se lleve el siguiente número. Si igual chocaran, el UNIQUE de la tabla es la
-- última red y la pantalla dice «vuelve a intentar».
--
-- `p_cod_manual` existe para lo que viene con código de fábrica o de una serie
-- externa; es de admin, se normaliza y se valida con la misma forma.
--
-- NO mueve stock: el stock inicial entra después por el kardex, que es la
-- única puerta al saldo.
CREATE OR REPLACE FUNCTION insumo_crear(
  p_prefijo    text,
  p_datos      jsonb DEFAULT '{}'::jsonb,
  p_cod_manual text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa uuid;
  v_rol     text;
  v_pref    text := upper(btrim(COALESCE(p_prefijo, '')));
  v_manual  text := upper(regexp_replace(btrim(COALESCE(p_cod_manual, '')), '\s+', '', 'g'));
  v_fam_id  uuid;
  v_n       integer;
  v_dig     integer;
  v_cat     text;
  v_sub     text;
  v_cod     text;
  v_costo   numeric;
  v_unidad  text;
  v_fila    jsonb;
BEGIN
  SELECT empresa_id, rol INTO v_empresa, v_rol FROM perfiles WHERE id = auth.uid();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = 'IN010';
  END IF;

  IF v_manual <> '' THEN
    IF v_rol NOT IN ('admin', 'superadmin') THEN
      RAISE EXCEPTION 'Solo un administrador puede elegir el código a mano'
        USING ERRCODE = 'IN014',
              HINT = 'Elige una familia y deja que el sistema proponga el código.';
    END IF;
    IF v_manual !~ '^[A-Z]{1,4}[0-9]{2,3}(-[A-Z0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'El código % no tiene la forma esperada', v_manual
        USING ERRCODE = 'IN012',
              HINT = 'De 1 a 4 letras, 2 o 3 números y, si corresponde, «-B». Por ejemplo MEC46 o MEC44-B.';
    END IF;
    v_cod := v_manual;

    -- El correlativo de la familia NO se mueve. Si alguien da de alta un
    -- MEC90 a mano, la próxima alta automática sigue en MEC48: el bucle de
    -- abajo salta los códigos ocupados, así que no hay choque, y adelantar el
    -- correlativo quemaría los 42 números del medio para nada.
    SELECT categoria, sub_categoria INTO v_cat, v_sub
      FROM familias_insumo
     WHERE empresa_id = v_empresa AND prefijo = substring(v_cod from '^([A-Z]{1,4})');
  ELSE
    -- `FOR UPDATE` serializa las altas de ESTA familia (no de las demás).
    SELECT id, siguiente, digitos, categoria, sub_categoria
      INTO v_fam_id, v_n, v_dig, v_cat, v_sub
      FROM familias_insumo
     WHERE empresa_id = v_empresa AND prefijo = v_pref AND activo
     FOR UPDATE;
    IF v_fam_id IS NULL THEN
      RAISE EXCEPTION 'No conozco la familia %', v_pref
        USING ERRCODE = 'IN011',
              HINT = 'Créala en Inventario → Configuración → Familias de código.';
    END IF;

    WHILE EXISTS (
      SELECT 1 FROM insumos
       WHERE empresa_id = v_empresa AND cod = v_pref || lpad(v_n::text, v_dig, '0')
    ) LOOP
      v_n := v_n + 1;
    END LOOP;

    v_cod := v_pref || lpad(v_n::text, v_dig, '0');
    UPDATE familias_insumo SET siguiente = v_n + 1, actualizado_en = now() WHERE id = v_fam_id;
  END IF;

  v_unidad := COALESCE(NULLIF(btrim(p_datos ->> 'unidad'), ''), 'un');
  IF NOT EXISTS (SELECT 1 FROM unidades WHERE codigo = v_unidad) THEN
    RAISE EXCEPTION 'No existe la unidad %', v_unidad
      USING ERRCODE = 'IN015', HINT = 'Las unidades se administran en Inventario → Configuración.';
  END IF;

  v_costo := COALESCE(NULLIF(btrim(p_datos ->> 'costo'), '')::numeric, 0);

  INSERT INTO insumos (
    empresa_id, cod, nemotecnico, categoria, sub_categoria, producto, proveedor,
    compra, color, minimo, can_x_paquete, costo, costo_iva, ubicacion,
    cod_proveedor, estado_inventario, descriptor_proveedor, comentarios,
    foto_url, unidad
  ) VALUES (
    v_empresa,
    v_cod,
    NULLIF(btrim(p_datos ->> 'nemotecnico'), ''),
    COALESCE(NULLIF(btrim(p_datos ->> 'categoria'), ''), v_cat),
    COALESCE(NULLIF(btrim(p_datos ->> 'sub_categoria'), ''), v_sub),
    NULLIF(btrim(p_datos ->> 'producto'), ''),
    NULLIF(btrim(p_datos ->> 'proveedor'), ''),
    NULLIF(btrim(p_datos ->> 'compra'), ''),
    NULLIF(btrim(p_datos ->> 'color'), ''),
    COALESCE(NULLIF(btrim(p_datos ->> 'minimo'), '')::numeric, 0)::int,
    COALESCE(NULLIF(btrim(p_datos ->> 'can_x_paquete'), '')::numeric, 1)::int,
    v_costo,
    round(v_costo * 1.19, 2),
    NULLIF(btrim(p_datos ->> 'ubicacion'), ''),
    NULLIF(btrim(p_datos ->> 'cod_proveedor'), ''),
    COALESCE(NULLIF(btrim(p_datos ->> 'estado_inventario'), ''), 'ACTIVO'),
    NULLIF(btrim(p_datos ->> 'descriptor_proveedor'), ''),
    NULLIF(btrim(p_datos ->> 'comentarios'), ''),
    NULLIF(btrim(p_datos ->> 'foto_url'), ''),
    v_unidad
  )
  RETURNING to_jsonb(insumos.*) INTO v_fila;

  RETURN v_fila;

EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'El código % ya existe', v_cod
    USING ERRCODE = 'IN013',
          HINT = 'Si lo escribiste a mano, elige otro; si lo propuso el sistema, vuelve a intentar.';
END;
$fn$;

REVOKE ALL ON FUNCTION insumo_crear(text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION insumo_crear(text, jsonb, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_malos    integer;
  v_fams     integer;
  v_desfase  integer;
  v_cambios  integer;
  v_total    integer;
  v_backup   integer;
  v_dom18    integer;
  v_faltan   text[];
BEGIN
  SELECT count(*) INTO v_malos FROM insumos
   WHERE cod !~ '^[A-Z]{1,4}[0-9]{2,3}(-[A-Z0-9]{1,2})?$';
  IF v_malos > 0 THEN
    RAISE EXCEPTION 'Quedaron % códigos con forma inválida', v_malos;
  END IF;

  SELECT count(*) INTO v_fams FROM familias_insumo;
  IF v_fams = 0 THEN
    RAISE EXCEPTION 'No se sembró ninguna familia';
  END IF;

  -- Cada familia tiene que apuntar más allá de su mayor número.
  SELECT count(*) INTO v_desfase
    FROM familias_insumo f
    JOIN (
      SELECT empresa_id,
             substring(cod from '^([A-Z]{1,4})')            AS prefijo,
             max(substring(cod from '^[A-Z]{1,4}([0-9]+)')::int) AS maximo
        FROM insumos
       WHERE cod ~ '^[A-Z]{1,4}[0-9]{2,3}(-[A-Z0-9]{1,2})?$'
       GROUP BY 1, 2
    ) m ON m.empresa_id = f.empresa_id AND m.prefijo = f.prefijo
   WHERE f.siguiente <= m.maximo;
  IF v_desfase > 0 THEN
    RAISE EXCEPTION '% familias tienen el correlativo por detrás de su mayor código', v_desfase;
  END IF;

  -- Ni un código cambió salvo los dos malformados.
  SELECT count(*) INTO v_cambios
    FROM insumos i JOIN insumos_backup_codigos_20260910 b USING (id)
   WHERE i.cod IS DISTINCT FROM b.cod;
  IF v_cambios > 2 THEN
    RAISE EXCEPTION 'Cambiaron % códigos: se esperaban 2 como máximo', v_cambios;
  END IF;

  SELECT count(*) INTO v_total  FROM insumos;
  SELECT count(*) INTO v_backup FROM insumos_backup_codigos_20260910;
  IF v_total <> v_backup THEN
    RAISE EXCEPTION 'La tabla pasó de % a % filas: no se creó ni borró nada acá', v_backup, v_total;
  END IF;

  SELECT count(*) INTO v_dom18 FROM insumos WHERE cod = 'DOM 18';
  IF v_dom18 > 0 THEN
    RAISE EXCEPTION 'Sigue habiendo un «DOM 18»';
  END IF;

  SELECT array_agg(f) INTO v_faltan
    FROM unnest(ARRAY['insumo_siguiente_codigo', 'insumo_crear']) f
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f);
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'No se crearon las funciones: %', array_to_string(v_faltan, ', ');
  END IF;

  RAISE NOTICE 'OK · % insumos, % familias, % código(s) corregido(s)', v_total, v_fams, v_cambios;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Insumos 01 · familias y forma del código — COMPLETADO ==='; END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Qué quedó (correr después)
--
--   SELECT prefijo, nombre, categoria, sub_categoria, digitos, siguiente, activo
--     FROM familias_insumo ORDER BY prefijo;
--
--   -- Los dos códigos corregidos:
--   SELECT i.cod AS ahora, b.cod AS antes, i.comentarios
--     FROM insumos i JOIN insumos_backup_codigos_20260910 b USING (id)
--    WHERE i.cod IS DISTINCT FROM b.cod;
--
--   -- Nadie debería nombrar «DOM 18» salvo el catálogo de productos:
--   SELECT clave FROM configuracion WHERE valor ~ '\yDOM 18\y';
--
-- Smoke tests (con sesión de admin DESDE LA APP: las funciones usan auth.uid())
--
--   SELECT insumo_siguiente_codigo('MEC');          -- el siguiente MEC libre
--   SELECT insumo_crear('ZZZ', '{}');               -- IN011, familia desconocida
--   SELECT insumo_crear('', '{}', 'INS-1234');      -- IN012, forma inválida
--   SELECT insumo_crear('', '{}', 'MEC01');         -- IN013, ya existe
--   SELECT insumo_crear('MEC', '{"unidad":"barril"}'); -- IN015, unidad inventada
-- ============================================================================
-- REVERSA
--
--   Las familias y las funciones se pueden quitar sin tocar un solo insumo:
--
--     DROP FUNCTION IF EXISTS insumo_crear(text, jsonb, text);
--     DROP FUNCTION IF EXISTS insumo_siguiente_codigo(text);
--     ALTER TABLE insumos DROP CONSTRAINT IF EXISTS insumos_cod_forma;
--     DROP TABLE IF EXISTS familias_insumo;
--
--   Y para deshacer los dos renombres (solo si de verdad hace falta: las
--   etiquetas nuevas ya dirían DOM18):
--
--     UPDATE insumos i SET cod = b.cod
--       FROM insumos_backup_codigos_20260910 b
--      WHERE b.id = i.id AND i.cod IS DISTINCT FROM b.cod;
--     UPDATE movimientos_insumos SET codigo = 'DOM 18' WHERE codigo = 'DOM18';
--     UPDATE ots o SET items = b.items FROM ots_backup_codigos_20260910 b WHERE b.id = o.id;
--     UPDATE configuracion c SET valor = b.valor
--       FROM configuracion_backup_codigos_20260910 b WHERE b.id = c.id;
-- ============================================================================
