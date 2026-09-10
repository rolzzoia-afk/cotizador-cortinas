-- ─────────────────────────────────────────────────────────────────────────────
-- Compras, etapa 1 — la solicitud de bodega y la copia de las órdenes
-- 2026-09-11
--
-- El circuito, como lo pidió el dueño:
--
--   Inventario ve los faltantes  →  levanta una SOLICITUD  →  Gerencia la
--   recibe en Rolzzo-Finanzas  →  Gerencia emite y aprueba la ORDEN DE COMPRA
--   →  la bodega la ve EN ESPERA DE LLEGADA  →  llega la mercadería  →  la
--   bodega la recibe pieza por pieza  →  entra al stock por el kardex
--
-- Las órdenes NACEN EN OTRO SISTEMA (el proyecto Supabase de la organización
-- Rolzzo-Finanzas). Acá se guarda una COPIA DE TRABAJO: es lo que la bodega
-- mira y contra lo que recibe. La copia se refresca por «pull» desde una
-- función Edge nuestra; si Finanzas está caído, la bodega sigue trabajando.
--
-- SIN PRECIOS, A PROPÓSITO. Ninguna tabla de este script tiene una columna de
-- plata, y la función que copia usa lista blanca de campos. Así la regla «los
-- montos solo los ve admin» se cumple por construcción: no hay monto que
-- esconder.
--
-- ESTE SCRIPT NO MUEVE STOCK. Las recepciones —que sí lo mueven, y lo hacen
-- por `inventario_registrar`, la única puerta— van en el script 02.
--
-- ORDEN DE EJECUCIÓN:
--   1. `sql/finanzas/20260911_bodega_contrato.sql`, en el proyecto de FINANZAS
--   2. este script, en producción
--   3. `npm run types:gen`
--
-- IDEMPOTENTE: se puede correr dos veces. Todo es CREATE TABLE IF NOT EXISTS /
-- CREATE OR REPLACE, y no inserta datos de negocio.
--
-- REVERSA (al pie del archivo).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Precondiciones
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.insumos') IS NULL
     OR to_regclass('public.telas_catalogo') IS NULL
     OR to_regclass('public.perfiles') IS NULL THEN
    RAISE EXCEPTION 'CO-SETUP: faltan tablas base (insumos / telas_catalogo / perfiles)';
  END IF;
  IF to_regprocedure('public.get_my_empresa_id()') IS NULL THEN
    RAISE EXCEPTION 'CO-SETUP: falta get_my_empresa_id()';
  END IF;
  IF to_regprocedure('public.inventario_flag(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'CO-SETUP: falta inventario_flag(); corré antes el SQL del kardex';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Proveedores
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Hoy el proveedor es un texto suelto en cada artículo, escrito de varias
-- maneras («SINFLEX» acá, «SYNFLEX» en Finanzas, «IMPORTADORA NAYEM LTDA» en la
-- factura). Esta tabla la llena la sincronización con lo que dice Finanzas, que
-- es quien tiene el RUT.
--
-- Lo ÚNICO que se edita a mano es `alias`: «en nuestros artículos este
-- proveedor se llama SINFLEX». Sirve para acotar la búsqueda del artículo al
-- recibir y para contar cuántos artículos son suyos. No se renombra el texto
-- de los artículos: renombrar en masa el proveedor de alguien hace dudar de si
-- es el mismo, y no hay forma de volver atrás.
CREATE TABLE IF NOT EXISTS proveedores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL,
  rut            text NOT NULL,
  razon_social   text NOT NULL,
  nombre         text,
  alias          text[] NOT NULL DEFAULT '{}',
  activo         boolean NOT NULL DEFAULT true,
  finanzas_id    text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proveedores_rut_no_vacio CHECK (btrim(rut) <> '')
);

-- El RUT es la llave real del proveedor; el nombre cambia según quién lo
-- escriba. Se guarda normalizado (solo dígitos y K) para que «76.014.543-2» y
-- «76014543-2» sean el mismo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_proveedores_empresa_rut
  ON proveedores(empresa_id, upper(regexp_replace(rut, '[^0-9kK]', '', 'g')));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Solicitudes de reposición — lo que BODEGA le pide a GERENCIA
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Hasta hoy «pedir reposición» escribía una fila `PEDIDO REPOSICION` en el
-- registro viejo de movimientos: una anotación que no movía stock, sin estado,
-- que nadie contestaba. Y «crear solicitud» bajaba un CSV.
--
-- Estados:
--   borrador   se está armando en bodega; se le suman y quitan líneas
--   enviada    Gerencia la tiene en Finanzas
--   en_orden   al menos una orden de compra la recogió
--   recibida   todas sus líneas llegaron
--   rechazada  Gerencia dijo que no, con motivo
--   cancelada  bodega se arrepintió (solo desde borrador o enviada)
--
-- UNA SOLA ABIERTA A LA VEZ por empresa: «pedir reposición» desde Alertas, el
-- catálogo o la ficha le suma una línea a la que está en borrador. Si hubiera
-- varias, cada pantalla escribiría en una distinta y Gerencia recibiría el
-- pedido partido en pedazos.
CREATE TABLE IF NOT EXISTS solicitudes_reposicion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL,
  numero         text NOT NULL,
  estado         text NOT NULL DEFAULT 'borrador'
                   CHECK (estado IN ('borrador','enviada','en_orden','recibida','rechazada','cancelada')),
  notas          text,
  motivo_rechazo text,

  creada_por     text,
  creada_por_id  uuid,
  enviada_por    text,
  enviada_en     timestamptz,

  -- Lo que Finanzas devolvió al recibirla. Sin esto no hay forma de saber si
  -- llegó: se marcaría «enviada» por haber intentado.
  finanzas_id    text,
  error_envio    text,

  creada_en      timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_empresa_numero
  ON solicitudes_reposicion(empresa_id, numero);

-- El guard de «una sola abierta»: en la base, no solo en la pantalla.
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_borrador_unico
  ON solicitudes_reposicion(empresa_id)
  WHERE estado = 'borrador';

CREATE INDEX IF NOT EXISTS idx_solicitudes_empresa_estado
  ON solicitudes_reposicion(empresa_id, estado, creada_en DESC);

-- Una línea = un artículo pedido. `cantidad` va en la unidad del artículo
-- (unidades en insumos, metros en telas), que es como la ve quien la pide.
--
-- `stock_al_pedir` y `minimo_al_pedir` son una FOTO del momento: sirven para
-- que Gerencia entienda por qué se pidió, incluso semanas después, cuando el
-- saldo ya cambió. Sin la foto, una solicitud vieja no se puede juzgar.
CREATE TABLE IF NOT EXISTS solicitudes_reposicion_lineas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id       uuid NOT NULL REFERENCES solicitudes_reposicion(id) ON DELETE CASCADE,
  empresa_id         uuid NOT NULL,
  orden              integer NOT NULL DEFAULT 0,

  dominio            text NOT NULL CHECK (dominio IN ('insumo','tela')),
  item_cod           text NOT NULL,
  nombre             text,
  unidad             text,
  cantidad           numeric(12,3) NOT NULL CHECK (cantidad > 0),

  stock_al_pedir     numeric(12,3),
  minimo_al_pedir    numeric(12,3),
  proveedor_sugerido text,
  motivo             text NOT NULL DEFAULT 'manual'
                       CHECK (motivo IN ('bajo_minimo','manual')),
  nota               text,

  -- Qué hizo Gerencia con esta línea. `oc_numero` lo escribe la sincronización
  -- cuando una orden de Finanzas dice venir de esta solicitud.
  estado_linea       text NOT NULL DEFAULT 'pendiente'
                       CHECK (estado_linea IN ('pendiente','en_orden','recibida','rechazada')),
  oc_numero          text,

  creada_en          timestamptz NOT NULL DEFAULT now()
);

-- El mismo artículo no se pide dos veces en la misma solicitud: se suma a la
-- línea que ya está. Dos líneas del mismo código son dos pedidos que Gerencia
-- tendría que sumar a mano.
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_linea_item
  ON solicitudes_reposicion_lineas(solicitud_id, dominio, upper(btrim(item_cod)));

CREATE INDEX IF NOT EXISTS idx_solicitud_lineas_solicitud
  ON solicitudes_reposicion_lineas(solicitud_id, orden);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Órdenes de compra — la COPIA de lo que aprobó Gerencia
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Dos grupos de columnas que NO se mezclan:
--
--   · Las que vienen de Finanzas (numero, estado_finanzas, fechas, guía,
--     proveedor…): las pisa la sincronización en cada pasada.
--   · Las NUESTRAS (estado, conflicto): las escribe la bodega al recibir. La
--     sincronización no las toca nunca.
--
-- Si se mezclaran, una pasada de sincronización borraría lo recibido.
--
-- `estado` es el nuestro, y es distinto del texto de Finanzas:
--   en_espera         aprobada, todavía no llega nada
--   recibida_parcial  llegó parte
--   recibida          llegó todo
--   cerrada           admin aceptó los faltantes y la dio por terminada
--   anulada           Finanzas la anuló
CREATE TABLE IF NOT EXISTS ordenes_compra (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL,

  -- ── De Finanzas ──
  finanzas_id       text NOT NULL,
  numero            text NOT NULL,
  estado_finanzas   text,
  anulada           boolean NOT NULL DEFAULT false,
  aprobada_en       timestamptz,
  aprobada_por      text,
  fecha_emision     date,
  fecha_esperada    date,
  proveedor_rut     text,
  proveedor_nombre  text,
  solicitado_por    text,
  solicitud_ref     text,
  guia              text,
  -- Si Finanzas ya cargó la factura de esta orden, su folio es otra forma de
  -- encontrarla con el papel en la mano. Solo el folio y el tipo: el documento
  -- de Finanzas tiene montos que no salen de allá.
  factura_folio     text,
  factura_tipo      text,
  comentarios       text,

  -- ── Nuestras ──
  proveedor_id      uuid REFERENCES proveedores(id),
  solicitud_id      uuid REFERENCES solicitudes_reposicion(id),
  estado            text NOT NULL DEFAULT 'en_espera'
                      CHECK (estado IN ('en_espera','recibida_parcial','recibida','cerrada','anulada')),
  -- Una orden anulada en Finanzas de la que YA se recibió algo no se puede
  -- borrar ni dejar como si nada: queda marcada y la decide un administrador.
  conflicto         text,
  cerrada_motivo    text,
  cerrada_por       text,
  cerrada_en        timestamptz,

  sincronizada_en   timestamptz NOT NULL DEFAULT now(),
  creada_en         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ordenes_compra_finanzas
  ON ordenes_compra(empresa_id, finanzas_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ordenes_compra_numero
  ON ordenes_compra(empresa_id, upper(btrim(numero)));
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado
  ON ordenes_compra(empresa_id, estado, aprobada_en DESC);
-- Encontrar la orden por el número de guía del papel que llegó.
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_guia
  ON ordenes_compra(empresa_id, upper(btrim(guia)))
  WHERE guia IS NOT NULL;
-- Y por el folio de la factura, cuando Finanzas alcanzó a cargarla.
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_factura
  ON ordenes_compra(empresa_id, upper(btrim(factura_folio)))
  WHERE factura_folio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor
  ON ordenes_compra(empresa_id, proveedor_rut);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_solicitud
  ON ordenes_compra(solicitud_id) WHERE solicitud_id IS NOT NULL;

-- Una línea de la orden. El PDF de Finanzas trae por línea CÓD. PROVEEDOR,
-- CÓD. INTERNO, NEMOTÉCNICO y CANTIDAD — el interno es NUESTRO código, que es
-- lo que permite vincular sola casi toda línea.
--
--   cantidad_pedida    en la unidad de la ORDEN (cajas, rollos, unidades)
--   factor             cuántas unidades NUESTRAS trae una de la orden
--   cantidad_recibida  también en la unidad de la orden, para que resten
--
-- Al kardex va `cantidad × factor`. Guardar todo en unidades nuestras haría
-- que «llegaron 3 de 5 cajas» se leyera como «llegaron 150 de 250», que no es
-- lo que dice el papel que el bodeguero tiene en la mano.
CREATE TABLE IF NOT EXISTS ordenes_compra_lineas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id           uuid NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  empresa_id         uuid NOT NULL,

  -- ── De Finanzas ──
  finanzas_linea_id  text NOT NULL,
  posicion           integer NOT NULL DEFAULT 0,
  codigo_interno     text,
  codigo_proveedor   text,
  descripcion        text,
  cantidad_pedida    numeric(12,3) NOT NULL DEFAULT 0 CHECK (cantidad_pedida >= 0),
  unidad             text,

  -- ── Nuestras ──
  dominio            text CHECK (dominio IN ('insumo','tela')),
  item_cod           text,
  factor             numeric(12,3) NOT NULL DEFAULT 1 CHECK (factor > 0),
  vinculo            text CHECK (vinculo IN ('interno','aprendida','codigo','descripcion','manual')),
  cantidad_recibida  numeric(12,3) NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
  estado_linea       text NOT NULL DEFAULT 'pendiente'
                       CHECK (estado_linea IN ('pendiente','parcial','completa','faltante_aceptado','cancelada')),
  conflicto          text,
  nota               text,

  creada_en          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_oc_lineas_finanzas
  ON ordenes_compra_lineas(orden_id, finanzas_linea_id);
CREATE INDEX IF NOT EXISTS idx_oc_lineas_orden
  ON ordenes_compra_lineas(orden_id, posicion);
-- Para «¿qué viene en camino de este artículo?» en la ficha y en Alertas.
CREATE INDEX IF NOT EXISTS idx_oc_lineas_item
  ON ordenes_compra_lineas(empresa_id, dominio, upper(btrim(item_cod)))
  WHERE item_cod IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Bitácora de la sincronización
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Cuándo se habló con Finanzas por última vez y cómo salió. La pantalla lo usa
-- para decir «actualizado hace 12 min» y para no volver a pedir en cada
-- apertura. Un error queda escrito: si Finanzas está caído hace dos días,
-- alguien tiene que poder verlo sin abrir la consola.
CREATE TABLE IF NOT EXISTS ordenes_compra_sync (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  inicio       timestamptz NOT NULL DEFAULT now(),
  fin          timestamptz,
  ok           boolean,
  nuevas       integer NOT NULL DEFAULT 0,
  actualizadas integer NOT NULL DEFAULT 0,
  lineas       integer NOT NULL DEFAULT 0,
  vinculadas   integer NOT NULL DEFAULT 0,
  error        text,
  ejecutada_por text
);

CREATE INDEX IF NOT EXISTS idx_oc_sync_empresa
  ON ordenes_compra_sync(empresa_id, inicio DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Lo aprendido: código del proveedor → artículo nuestro
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Tabla propia y no una columna en `insumos` porque un artículo puede tener
-- varios códigos de varios proveedores (el mismo tornillo se compra en dos
-- lados). La llave incluye el proveedor: el código «1020» de uno no es el
-- «1020» de otro.
CREATE TABLE IF NOT EXISTS insumo_codigos_proveedor (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL,
  proveedor_rut  text NOT NULL,
  clave_tipo     text NOT NULL CHECK (clave_tipo IN ('codigo','descripcion')),
  clave          text NOT NULL,
  dominio        text NOT NULL CHECK (dominio IN ('insumo','tela')),
  item_cod       text NOT NULL,
  descriptor_visto text,
  factor         numeric(12,3),
  origen         text NOT NULL DEFAULT 'recepcion',
  veces_visto    integer NOT NULL DEFAULT 1,
  creada_en      timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_codigos_proveedor
  ON insumo_codigos_proveedor(
    empresa_id,
    upper(regexp_replace(proveedor_rut, '[^0-9kK]', '', 'g')),
    clave_tipo,
    upper(btrim(clave))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) RLS — se LEE por empresa; se ESCRIBE solo por las funciones
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Mismo criterio que el kardex: sin policy de escritura, la única forma de
-- tocar estas tablas es una función que corre como dueña de la base y valida
-- rol, empresa e interruptor. La excepción es `proveedores.alias`, que es una
-- anotación nuestra y la edita un administrador desde la pantalla.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'proveedores','solicitudes_reposicion','solicitudes_reposicion_lineas',
    'ordenes_compra','ordenes_compra_lineas','ordenes_compra_sync',
    'insumo_codigos_proveedor'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_empresa', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (empresa_id = (SELECT get_my_empresa_id()))',
      t || '_select_empresa', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS proveedores_update_admin ON proveedores;
CREATE POLICY proveedores_update_admin ON proveedores FOR UPDATE
  USING (
    empresa_id = (SELECT get_my_empresa_id())
    AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','superadmin'))
  )
  WITH CHECK (empresa_id = (SELECT get_my_empresa_id()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Ayudantes
-- ─────────────────────────────────────────────────────────────────────────────

-- El RUT sin puntos ni guion, en mayúscula. Es la llave con la que se cruzan
-- Finanzas y nosotros: «76.014.543-2», «76014543-2» y «760145432» son el mismo.
CREATE OR REPLACE FUNCTION compras_rut_norm(p_rut text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT upper(regexp_replace(coalesce(p_rut, ''), '[^0-9kK]', '', 'g'));
$fn$;

-- El código de un artículo como lo escribimos nosotros: mayúsculas y SIN
-- ESPACIOS. Finanzas escribe «DU 30» y en el catálogo es «DU30»; sin esto, la
-- línea llegaría sin vincular y alguien tendría que hacerlo a mano cada vez.
-- Es el espejo de `normalizarCodigoInsumo` del lado del navegador.
CREATE OR REPLACE FUNCTION compras_cod_norm(p_cod text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT upper(regexp_replace(coalesce(p_cod, ''), '\s+', '', 'g'));
$fn$;

-- Sesión + empresa + rol + interruptor, que es lo que TODAS las funciones de
-- acá tienen que comprobar antes de escribir. Devuelve la empresa y el rol.
--
-- CO000 el módulo está apagado   CO001 no hay sesión / sin empresa
-- CO002 tu rol no puede          CO003 la orden no admite esto
-- CO004 documento repetido       CO005 la línea no es de esta orden
-- CO006 cantidad inválida        CO007 falta la firma
-- CO008 no existe el artículo
CREATE OR REPLACE FUNCTION compras_sesion(p_roles text[])
RETURNS TABLE (empresa_id uuid, rol text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa uuid;
  v_rol     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = 'CO001';
  END IF;
  SELECT p.empresa_id, p.rol INTO v_empresa, v_rol FROM perfiles p WHERE p.id = auth.uid();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Tu usuario no tiene empresa asignada' USING ERRCODE = 'CO001';
  END IF;
  IF NOT inventario_flag(v_empresa, 'compras') THEN
    RAISE EXCEPTION 'El módulo de Compras está apagado'
      USING ERRCODE = 'CO000',
            HINT = 'Se enciende en Inventario → Configuración → Interruptores';
  END IF;
  IF p_roles IS NOT NULL AND NOT (v_rol = ANY (p_roles)) THEN
    RAISE EXCEPTION 'Tu rol (%) no puede hacer esto', v_rol
      USING ERRCODE = 'CO002';
  END IF;
  RETURN QUERY SELECT v_empresa, v_rol, (auth.jwt() ->> 'email');
END $fn$;

-- El correlativo de la empresa: SOL-0001, REC-0001. Toma el máximo que ya
-- existe y suma uno, con la fila bloqueada, para que dos personas pidiendo a la
-- vez no saquen el mismo número.
CREATE OR REPLACE FUNCTION compras_siguiente_numero(
  p_empresa uuid, p_tabla text, p_prefijo text
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_max integer;
BEGIN
  EXECUTE format(
    'SELECT coalesce(max(nullif(regexp_replace(numero, ''^%s-'', ''''), '''')::int), 0)
       FROM %I WHERE empresa_id = $1',
    p_prefijo, p_tabla
  ) INTO v_max USING p_empresa;
  RETURN p_prefijo || '-' || lpad((v_max + 1)::text, 4, '0');
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) solicitud_abrir_o_sumar — «pedir reposición», desde donde sea
-- ─────────────────────────────────────────────────────────────────────────────
--
-- p_lineas: [{ dominio, item_cod, cantidad, nombre?, unidad?, stock_al_pedir?,
--              minimo_al_pedir?, proveedor_sugerido?, motivo?, nota? }]
--
-- Devuelve { solicitud_id, numero, creada, lineas_nuevas, lineas_sumadas }
--
-- Si ya hay una solicitud en borrador, le suma; si no, la crea. Un artículo que
-- ya está en la solicitud NO se duplica: se le REEMPLAZA la cantidad por la
-- nueva. Sumarlas convertiría dos clics distraídos en el doble del pedido.
CREATE OR REPLACE FUNCTION solicitud_abrir_o_sumar(p_lineas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa   uuid;
  v_rol       text;
  v_email     text;
  v_sol       uuid;
  v_numero    text;
  v_creada    boolean := false;
  v_linea     jsonb;
  v_dominio   text;
  v_cod       text;
  v_cant      numeric(12,3);
  v_orden     integer;
  v_nuevas    integer := 0;
  v_sumadas   integer := 0;
  v_existe    boolean;
  v_es_nueva  boolean;
BEGIN
  SELECT s.empresa_id, s.rol, s.email INTO v_empresa, v_rol, v_email
    FROM compras_sesion(ARRAY['admin','superadmin','operario','bodeguero']) s;

  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'No hay ninguna línea que pedir' USING ERRCODE = 'CO006';
  END IF;

  -- La solicitud abierta, bloqueada: dos personas pidiendo a la vez escriben
  -- en la misma, no en dos.
  SELECT id, numero INTO v_sol, v_numero
    FROM solicitudes_reposicion
   WHERE empresa_id = v_empresa AND estado = 'borrador'
   FOR UPDATE;

  IF v_sol IS NULL THEN
    v_numero := compras_siguiente_numero(v_empresa, 'solicitudes_reposicion', 'SOL');
    INSERT INTO solicitudes_reposicion (empresa_id, numero, creada_por, creada_por_id)
    VALUES (v_empresa, v_numero, v_email, auth.uid())
    RETURNING id INTO v_sol;
    v_creada := true;
  END IF;

  SELECT coalesce(max(orden), 0) INTO v_orden
    FROM solicitudes_reposicion_lineas WHERE solicitud_id = v_sol;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_dominio := lower(coalesce(v_linea ->> 'dominio', 'insumo'));
    v_cod     := btrim(coalesce(v_linea ->> 'item_cod', ''));
    v_cant    := coalesce((v_linea ->> 'cantidad')::numeric, 0);

    IF v_dominio NOT IN ('insumo','tela') THEN
      RAISE EXCEPTION 'Dominio desconocido: %', v_dominio USING ERRCODE = 'CO006';
    END IF;
    IF v_cant <= 0 THEN
      RAISE EXCEPTION 'La cantidad de % tiene que ser mayor que 0', v_cod USING ERRCODE = 'CO006';
    END IF;

    -- El artículo tiene que existir: una solicitud con un código inventado
    -- llega a Gerencia y se convierte en una orden de algo que no está en el
    -- catálogo.
    IF v_dominio = 'insumo' THEN
      SELECT EXISTS (SELECT 1 FROM insumos
                      WHERE empresa_id = v_empresa AND upper(btrim(cod)) = upper(v_cod))
        INTO v_existe;
    ELSE
      SELECT EXISTS (SELECT 1 FROM telas_catalogo
                      WHERE empresa_id = v_empresa AND upper(btrim(codigo)) = upper(v_cod))
        INTO v_existe;
    END IF;
    IF NOT v_existe THEN
      RAISE EXCEPTION 'No existe el artículo % (%)', v_cod, v_dominio
        USING ERRCODE = 'CO008';
    END IF;

    v_orden := v_orden + 1;
    INSERT INTO solicitudes_reposicion_lineas (
      solicitud_id, empresa_id, orden, dominio, item_cod, nombre, unidad, cantidad,
      stock_al_pedir, minimo_al_pedir, proveedor_sugerido, motivo, nota
    ) VALUES (
      v_sol, v_empresa, v_orden, v_dominio, upper(v_cod),
      v_linea ->> 'nombre', v_linea ->> 'unidad', v_cant,
      (v_linea ->> 'stock_al_pedir')::numeric,
      (v_linea ->> 'minimo_al_pedir')::numeric,
      v_linea ->> 'proveedor_sugerido',
      coalesce(v_linea ->> 'motivo', 'manual'),
      v_linea ->> 'nota'
    )
    ON CONFLICT (solicitud_id, dominio, upper(btrim(item_cod))) DO UPDATE
      SET cantidad           = EXCLUDED.cantidad,
          stock_al_pedir     = EXCLUDED.stock_al_pedir,
          minimo_al_pedir    = EXCLUDED.minimo_al_pedir,
          proveedor_sugerido = coalesce(EXCLUDED.proveedor_sugerido, solicitudes_reposicion_lineas.proveedor_sugerido),
          nota               = coalesce(EXCLUDED.nota, solicitudes_reposicion_lineas.nota)
    -- `xmax = 0` es la forma de distinguir el INSERT del UPDATE en un upsert:
    -- en la fila recién insertada no hay transacción que la haya actualizado.
    RETURNING (xmax = 0) INTO v_es_nueva;

    IF v_es_nueva THEN
      v_nuevas := v_nuevas + 1;
    ELSE
      v_sumadas := v_sumadas + 1;
      v_orden := v_orden - 1;   -- no consumió posición: se actualizó una que ya estaba
    END IF;
  END LOOP;

  UPDATE solicitudes_reposicion SET actualizada_en = now() WHERE id = v_sol;

  RETURN jsonb_build_object(
    'solicitud_id', v_sol, 'numero', v_numero, 'creada', v_creada,
    'lineas_nuevas', v_nuevas, 'lineas_sumadas', v_sumadas
  );
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) solicitud_quitar_linea / solicitud_cancelar
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Solo en borrador: una vez que Gerencia la tiene, sacarle una línea acá la
-- dejaría distinta de la que ellos están mirando.
CREATE OR REPLACE FUNCTION solicitud_quitar_linea(p_linea_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa uuid;
  v_sol     uuid;
  v_estado  text;
  v_quedan  integer;
BEGIN
  SELECT s.empresa_id INTO v_empresa
    FROM compras_sesion(ARRAY['admin','superadmin','operario','bodeguero']) s;

  SELECT l.solicitud_id, r.estado INTO v_sol, v_estado
    FROM solicitudes_reposicion_lineas l
    JOIN solicitudes_reposicion r ON r.id = l.solicitud_id
   WHERE l.id = p_linea_id AND l.empresa_id = v_empresa
   FOR UPDATE OF r;

  IF v_sol IS NULL THEN
    RAISE EXCEPTION 'Esa línea no existe' USING ERRCODE = 'CO005';
  END IF;
  IF v_estado <> 'borrador' THEN
    RAISE EXCEPTION 'La solicitud ya está %: no se le pueden sacar líneas', v_estado
      USING ERRCODE = 'CO003';
  END IF;

  DELETE FROM solicitudes_reposicion_lineas WHERE id = p_linea_id;
  SELECT count(*) INTO v_quedan FROM solicitudes_reposicion_lineas WHERE solicitud_id = v_sol;

  -- Una solicitud sin líneas no es una solicitud vacía: es una que nadie hizo.
  IF v_quedan = 0 THEN
    DELETE FROM solicitudes_reposicion WHERE id = v_sol;
    RETURN jsonb_build_object('quedan', 0, 'solicitud_borrada', true);
  END IF;

  UPDATE solicitudes_reposicion SET actualizada_en = now() WHERE id = v_sol;
  RETURN jsonb_build_object('quedan', v_quedan, 'solicitud_borrada', false);
END $fn$;

CREATE OR REPLACE FUNCTION solicitud_cancelar(p_solicitud_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa uuid;
  v_estado  text;
BEGIN
  SELECT s.empresa_id INTO v_empresa
    FROM compras_sesion(ARRAY['admin','superadmin','operario','bodeguero']) s;

  SELECT estado INTO v_estado FROM solicitudes_reposicion
   WHERE id = p_solicitud_id AND empresa_id = v_empresa FOR UPDATE;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Esa solicitud no existe' USING ERRCODE = 'CO003';
  END IF;
  IF v_estado NOT IN ('borrador','enviada') THEN
    RAISE EXCEPTION 'Una solicitud % ya no se puede cancelar', v_estado USING ERRCODE = 'CO003';
  END IF;

  UPDATE solicitudes_reposicion
     SET estado = 'cancelada', motivo_rechazo = p_motivo, actualizada_en = now()
   WHERE id = p_solicitud_id;
  UPDATE solicitudes_reposicion_lineas
     SET estado_linea = 'rechazada' WHERE solicitud_id = p_solicitud_id AND estado_linea = 'pendiente';

  RETURN jsonb_build_object('estado', 'cancelada');
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10) solicitud_marcar_enviada — la llama la función Edge, con la respuesta
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Se marca enviada SOLO con el id que devolvió Finanzas. Si Finanzas no
-- contesta, la solicitud se queda en borrador con el error a la vista y un
-- botón para reintentar: marcarla enviada por haber intentado dejaría a bodega
-- esperando una orden que nadie recibió.
CREATE OR REPLACE FUNCTION solicitud_marcar_enviada(
  p_solicitud_id uuid, p_finanzas_id text, p_error text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa uuid;
  v_email   text;
  v_estado  text;
BEGIN
  SELECT s.empresa_id, s.email INTO v_empresa, v_email
    FROM compras_sesion(ARRAY['admin','superadmin','operario','bodeguero']) s;

  SELECT estado INTO v_estado FROM solicitudes_reposicion
   WHERE id = p_solicitud_id AND empresa_id = v_empresa FOR UPDATE;
  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Esa solicitud no existe' USING ERRCODE = 'CO003';
  END IF;

  IF p_error IS NOT NULL OR coalesce(btrim(p_finanzas_id), '') = '' THEN
    UPDATE solicitudes_reposicion
       SET error_envio = coalesce(p_error, 'Finanzas no devolvió un identificador'),
           actualizada_en = now()
     WHERE id = p_solicitud_id;
    RETURN jsonb_build_object('estado', v_estado, 'error', true);
  END IF;

  UPDATE solicitudes_reposicion
     SET estado = 'enviada', finanzas_id = p_finanzas_id, error_envio = NULL,
         enviada_por = v_email, enviada_en = now(), actualizada_en = now()
   WHERE id = p_solicitud_id;

  RETURN jsonb_build_object('estado', 'enviada', 'error', false);
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11) oc_autovincular — el código interno hace casi todo el trabajo
-- ─────────────────────────────────────────────────────────────────────────────
--
-- La orden de Finanzas trae NUESTRO código en la columna «CÓD. INTERNO», solo
-- que escrito como en su catálogo («DU 30»). Normalizando espacios calza con
-- `insumos.cod` («DU30»).
--
-- Lo que NO calce queda sin vincular y lo resuelve una persona una vez: puede
-- ser un código mal escrito allá, o un artículo que todavía no existe acá.
-- Inventar la vinculación sumaría stock al artículo equivocado.
CREATE OR REPLACE FUNCTION oc_autovincular(p_empresa uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa uuid := p_empresa;
  v_n       integer := 0;
  v_paso    integer;
BEGIN
  IF v_empresa IS NULL THEN
    SELECT s.empresa_id INTO v_empresa FROM compras_sesion(NULL) s;
  END IF;

  -- 1. Por el código interno, contra insumos.
  WITH cand AS (
    SELECT l.id, i.cod
      FROM ordenes_compra_lineas l
      JOIN insumos i
        ON i.empresa_id = l.empresa_id
       AND compras_cod_norm(i.cod) = compras_cod_norm(l.codigo_interno)
     WHERE l.empresa_id = v_empresa
       AND l.item_cod IS NULL
       AND coalesce(btrim(l.codigo_interno), '') <> ''
  )
  UPDATE ordenes_compra_lineas l
     SET dominio = 'insumo', item_cod = c.cod, vinculo = 'interno'
    FROM cand c WHERE l.id = c.id;
  GET DIAGNOSTICS v_paso = ROW_COUNT;
  v_n := v_n + v_paso;

  -- 2. Lo mismo contra el catálogo de telas.
  WITH cand AS (
    SELECT l.id, t.codigo
      FROM ordenes_compra_lineas l
      JOIN telas_catalogo t
        ON t.empresa_id = l.empresa_id
       AND compras_cod_norm(t.codigo) = compras_cod_norm(l.codigo_interno)
     WHERE l.empresa_id = v_empresa
       AND l.item_cod IS NULL
       AND coalesce(btrim(l.codigo_interno), '') <> ''
  )
  UPDATE ordenes_compra_lineas l
     SET dominio = 'tela', item_cod = c.codigo, vinculo = 'interno'
    FROM cand c WHERE l.id = c.id;
  GET DIAGNOSTICS v_paso = ROW_COUNT;
  v_n := v_n + v_paso;

  -- 3. Lo aprendido en recepciones anteriores, por código del proveedor.
  WITH cand AS (
    SELECT l.id, e.dominio, e.item_cod, e.factor
      FROM ordenes_compra_lineas l
      JOIN ordenes_compra o ON o.id = l.orden_id
      JOIN insumo_codigos_proveedor e
        ON e.empresa_id = l.empresa_id
       AND e.clave_tipo = 'codigo'
       AND compras_rut_norm(e.proveedor_rut) = compras_rut_norm(o.proveedor_rut)
       AND upper(btrim(e.clave)) = upper(btrim(l.codigo_proveedor))
     WHERE l.empresa_id = v_empresa
       AND l.item_cod IS NULL
       AND coalesce(btrim(l.codigo_proveedor), '') <> ''
  )
  UPDATE ordenes_compra_lineas l
     SET dominio = c.dominio, item_cod = c.item_cod, vinculo = 'aprendida',
         factor = coalesce(c.factor, l.factor)
    FROM cand c WHERE l.id = c.id;
  GET DIAGNOSTICS v_paso = ROW_COUNT;
  v_n := v_n + v_paso;

  RETURN v_n;
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12) oc_vincular_linea — la resuelve una persona, y queda aprendida
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION oc_vincular_linea(
  p_linea_id uuid,
  p_dominio  text,
  p_item_cod text,
  p_factor   numeric DEFAULT 1,
  p_aprender boolean DEFAULT true
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa uuid;
  v_dominio text := lower(coalesce(p_dominio, 'insumo'));
  v_cod     text := btrim(coalesce(p_item_cod, ''));
  v_factor  numeric(12,3) := coalesce(p_factor, 1);
  v_rut     text;
  v_codprov text;
  v_desc    text;
  v_existe  boolean;
BEGIN
  SELECT s.empresa_id INTO v_empresa
    FROM compras_sesion(ARRAY['admin','superadmin','operario','bodeguero']) s;

  IF v_dominio NOT IN ('insumo','tela') THEN
    RAISE EXCEPTION 'Dominio desconocido: %', v_dominio USING ERRCODE = 'CO006';
  END IF;
  IF v_factor <= 0 THEN
    RAISE EXCEPTION 'El factor tiene que ser mayor que 0' USING ERRCODE = 'CO006';
  END IF;

  IF v_dominio = 'insumo' THEN
    SELECT EXISTS (SELECT 1 FROM insumos
                    WHERE empresa_id = v_empresa AND upper(btrim(cod)) = upper(v_cod))
      INTO v_existe;
  ELSE
    SELECT EXISTS (SELECT 1 FROM telas_catalogo
                    WHERE empresa_id = v_empresa AND upper(btrim(codigo)) = upper(v_cod))
      INTO v_existe;
  END IF;
  IF NOT v_existe THEN
    RAISE EXCEPTION 'No existe el artículo % (%)', v_cod, v_dominio
      USING ERRCODE = 'CO008',
            HINT = 'Si es un artículo nuevo, hay que darlo de alta en el catálogo primero';
  END IF;

  UPDATE ordenes_compra_lineas
     SET dominio = v_dominio, item_cod = upper(v_cod), factor = v_factor, vinculo = 'manual'
   WHERE id = p_linea_id AND empresa_id = v_empresa
  RETURNING codigo_proveedor, descripcion INTO v_codprov, v_desc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa línea no existe' USING ERRCODE = 'CO005';
  END IF;

  IF p_aprender AND coalesce(btrim(v_codprov), '') <> '' THEN
    SELECT o.proveedor_rut INTO v_rut
      FROM ordenes_compra o
      JOIN ordenes_compra_lineas l ON l.orden_id = o.id
     WHERE l.id = p_linea_id;

    IF coalesce(btrim(v_rut), '') <> '' THEN
      INSERT INTO insumo_codigos_proveedor (
        empresa_id, proveedor_rut, clave_tipo, clave, dominio, item_cod,
        descriptor_visto, factor, origen
      ) VALUES (
        v_empresa, v_rut, 'codigo', v_codprov, v_dominio, upper(v_cod),
        v_desc, v_factor, 'orden_compra'
      )
      ON CONFLICT (empresa_id, upper(regexp_replace(proveedor_rut, '[^0-9kK]', '', 'g')),
                   clave_tipo, upper(btrim(clave)))
      DO UPDATE SET dominio = EXCLUDED.dominio,
                    item_cod = EXCLUDED.item_cod,
                    factor = EXCLUDED.factor,
                    descriptor_visto = coalesce(EXCLUDED.descriptor_visto, insumo_codigos_proveedor.descriptor_visto),
                    veces_visto = insumo_codigos_proveedor.veces_visto + 1,
                    actualizada_en = now();
    END IF;
  END IF;

  RETURN jsonb_build_object('item_cod', upper(v_cod), 'dominio', v_dominio, 'factor', v_factor);
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13) oc_cerrar — dar por terminada una orden con faltantes
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Solo un administrador, y con motivo escrito. Es la decisión de «esto ya no
-- va a llegar»: sin motivo, dentro de tres meses nadie sabe si se perdió, se
-- anuló o se recibió por otro lado.
CREATE OR REPLACE FUNCTION oc_cerrar(p_orden_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa uuid;
  v_email   text;
  v_estado  text;
  v_lineas  integer;
BEGIN
  SELECT s.empresa_id, s.email INTO v_empresa, v_email
    FROM compras_sesion(ARRAY['admin','superadmin']) s;

  IF coalesce(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Hay que decir por qué se cierra con faltantes' USING ERRCODE = 'CO006';
  END IF;

  SELECT estado INTO v_estado FROM ordenes_compra
   WHERE id = p_orden_id AND empresa_id = v_empresa FOR UPDATE;
  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Esa orden no existe' USING ERRCODE = 'CO003';
  END IF;
  IF v_estado IN ('cerrada','anulada') THEN
    RAISE EXCEPTION 'La orden ya está %', v_estado USING ERRCODE = 'CO003';
  END IF;

  UPDATE ordenes_compra_lineas
     SET estado_linea = 'faltante_aceptado'
   WHERE orden_id = p_orden_id AND estado_linea IN ('pendiente','parcial');
  GET DIAGNOSTICS v_lineas = ROW_COUNT;

  UPDATE ordenes_compra
     SET estado = 'cerrada', cerrada_motivo = p_motivo, cerrada_por = v_email,
         cerrada_en = now()
   WHERE id = p_orden_id;

  RETURN jsonb_build_object('estado', 'cerrada', 'lineas_aceptadas', v_lineas);
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14) Permisos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'compras_rut_norm(text)',
    'compras_cod_norm(text)',
    'compras_sesion(text[])',
    'compras_siguiente_numero(uuid,text,text)',
    'solicitud_abrir_o_sumar(jsonb)',
    'solicitud_quitar_linea(uuid)',
    'solicitud_cancelar(uuid,text)',
    'solicitud_marcar_enviada(uuid,text,text)',
    'oc_autovincular(uuid)',
    'oc_vincular_linea(uuid,text,text,numeric,boolean)',
    'oc_cerrar(uuid,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15) Verificación — o queda todo, o no queda nada
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_faltan text[] := '{}';
  t text;
  f text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'proveedores','solicitudes_reposicion','solicitudes_reposicion_lineas',
    'ordenes_compra','ordenes_compra_lineas','ordenes_compra_sync',
    'insumo_codigos_proveedor'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN v_faltan := v_faltan || t; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = t AND rowsecurity) THEN
      v_faltan := v_faltan || (t || ' (sin RLS)');
    END IF;
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'solicitud_abrir_o_sumar(jsonb)','solicitud_quitar_linea(uuid)',
    'solicitud_cancelar(uuid,text)','solicitud_marcar_enviada(uuid,text,text)',
    'oc_autovincular(uuid)','oc_vincular_linea(uuid,text,text,numeric,boolean)',
    'oc_cerrar(uuid,text)'
  ] LOOP
    IF to_regprocedure('public.' || f) IS NULL THEN v_faltan := v_faltan || f; END IF;
  END LOOP;

  -- Ninguna tabla de Compras puede tener una columna de plata: si aparece una,
  -- el módulo dejó de ser seguro de mostrarle a todo el taller.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('proveedores','solicitudes_reposicion','solicitudes_reposicion_lineas',
                          'ordenes_compra','ordenes_compra_lineas')
       AND column_name ~* '(precio|monto|total|neto|iva|costo|valor)'
  ) THEN
    v_faltan := v_faltan || 'HAY UNA COLUMNA DE PLATA';
  END IF;

  IF array_length(v_faltan, 1) > 0 THEN
    RAISE EXCEPTION 'ABORTADO, falta: %', array_to_string(v_faltan, ', ');
  END IF;

  RAISE NOTICE 'Compras 01: 7 tablas, 11 funciones y RLS en su lugar.';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Qué hay ahora (correr después)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT 'proveedores' AS tabla, count(*) FROM proveedores
-- UNION ALL SELECT 'solicitudes', count(*) FROM solicitudes_reposicion
-- UNION ALL SELECT 'ordenes', count(*) FROM ordenes_compra
-- UNION ALL SELECT 'lineas de orden', count(*) FROM ordenes_compra_lineas;
--
-- Esperado: 0 en todas. Las órdenes las trae la sincronización con Finanzas;
-- las solicitudes las levanta la bodega desde Alertas.

-- ─────────────────────────────────────────────────────────────────────────────
-- REVERSA
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS oc_cerrar(uuid,text);
-- DROP FUNCTION IF EXISTS oc_vincular_linea(uuid,text,text,numeric,boolean);
-- DROP FUNCTION IF EXISTS oc_autovincular(uuid);
-- DROP FUNCTION IF EXISTS solicitud_marcar_enviada(uuid,text,text);
-- DROP FUNCTION IF EXISTS solicitud_cancelar(uuid,text);
-- DROP FUNCTION IF EXISTS solicitud_quitar_linea(uuid);
-- DROP FUNCTION IF EXISTS solicitud_abrir_o_sumar(jsonb);
-- DROP FUNCTION IF EXISTS compras_siguiente_numero(uuid,text,text);
-- DROP FUNCTION IF EXISTS compras_sesion(text[]);
-- DROP FUNCTION IF EXISTS compras_cod_norm(text);
-- DROP FUNCTION IF EXISTS compras_rut_norm(text);
-- DROP TABLE IF EXISTS insumo_codigos_proveedor;
-- DROP TABLE IF EXISTS ordenes_compra_sync;
-- DROP TABLE IF EXISTS ordenes_compra_lineas;
-- DROP TABLE IF EXISTS ordenes_compra;
-- DROP TABLE IF EXISTS solicitudes_reposicion_lineas;
-- DROP TABLE IF EXISTS solicitudes_reposicion;
-- DROP TABLE IF EXISTS proveedores;
