-- ─────────────────────────────────────────────────────────────────────────────
-- Compras, etapa 2 — recibir una factura: se escanea, se cuenta a mano y se
-- firma con ubicación
-- 2026-09-11
--
-- El tramo que faltaba del circuito:
--
--   … Gerencia emite la ORDEN  →  llega el camión con la FACTURA (o la guía)
--   →  se ESCANEA: la app lee el papel y lo empareja con la orden
--   →  queda POR CONTAR (nada entra al stock todavía)
--   →  alguien CUENTA a mano lo que llegó, bueno y dañado, y FIRMA con nombre,
--      fecha y ubicación del teléfono
--   →  lo bueno ENTRA AL STOCK por el kardex, y la recepción queda CONTADA con
--      su resultado: ok, con diferencias o sin orden
--   →  (etapa 3) se le manda a Gerencia, esté bien o con errores
--
-- Por qué en dos pasos y no en uno: lo que dice el papel y lo que llegó en el
-- camión se comparan, y la comparación es lo que se le reporta a Gerencia. Si
-- el mismo gesto leyera el papel y diera todo por recibido, un error de la
-- factura entraría al stock sin que nadie lo viera.
--
-- Cada línea tiene TRES números, en la unidad de la ORDEN:
--   pedido      lo que faltaba de la línea de la orden
--   facturado   lo que dice el papel (leído por la app y corregible)
--   contado     lo que se contó: bueno + dañado
-- Lo BUENO entra al stock. Lo DAÑADO queda escrito, NO entra y NO descuenta lo
-- que falta de la orden: el proveedor lo repone. Lo que llegó DE MÁS entra
-- igual y se reporta (decisión del dueño, 2026-09-11).
--
-- Toda recepción va contra una orden de compra. Sin orden: SOLO un
-- administrador, y queda marcada «sin orden» para Gerencia.
--
-- SIN MONTOS: las tablas no tienen ninguna columna de plata. La factura sí los
-- trae, pero se queda como archivo en el bucket privado.
--
-- ORDEN DE EJECUCIÓN: después de `20260911_compras_01_solicitudes_ordenes.sql`
-- y de `20260911_fix_stock_bloqueado.sql` (sin ese arreglo el kardex no mueve
-- ningún saldo y el script aborta al principio). Después, `npm run types:gen`.
--
-- REEMPLAZA a la versión anterior de este mismo archivo (la de `oc_recibir`,
-- que recibía de una vez sin conteo). Si esa versión ya se corrió, este script
-- borra sus dos tablas SOLO si están vacías; si tuvieran recepciones, aborta
-- sin tocar nada.
--
-- IDEMPOTENTE: se puede correr dos veces. No inserta datos de negocio.
--
-- REVERSA (al pie del archivo).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Precondiciones, y la versión anterior de este archivo
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.ordenes_compra') IS NULL
     OR to_regclass('public.ordenes_compra_lineas') IS NULL
     OR to_regclass('public.insumo_codigos_proveedor') IS NULL
     OR to_regprocedure('public.compras_sesion(text[])') IS NULL THEN
    RAISE EXCEPTION 'CO-SETUP: falta correr antes sql/20260911_compras_01_solicitudes_ordenes.sql';
  END IF;
  IF to_regprocedure('public.inventario_registrar(jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'CO-SETUP: falta el kardex (sql/20260908_inventario_02_kardex.sql)';
  END IF;
  IF to_regprocedure('public.get_user_empresa_id()') IS NULL THEN
    RAISE EXCEPTION 'CO-SETUP: falta get_user_empresa_id(), que usan las políticas de los buckets';
  END IF;
  -- Sin el arreglo del 2026-09-11, el kardex no puede mover NINGÚN saldo y
  -- toda recepción fallaría al hacer entrar lo contado.
  IF (to_regprocedure('public.conteo_congela_articulo()') IS NOT NULL
      AND (SELECT prosrc FROM pg_proc
            WHERE oid = 'public.conteo_congela_articulo()'::regprocedure) NOT LIKE '%to_jsonb(NEW)%')
     OR (SELECT prosrc FROM pg_proc
          WHERE oid = 'public.inventario_registrar(jsonb,jsonb)'::regprocedure) NOT LIKE '%''MATERIAS PRIMAS''%' THEN
    RAISE EXCEPTION 'CO-SETUP: falta correr antes sql/20260911_fix_stock_bloqueado.sql';
  END IF;

  -- La versión anterior de este archivo creó `recepciones` sin `estado`. Si
  -- está vacía se reemplaza; si ya tiene recepciones, eso es stock que entró y
  -- no se borra por un script: se aborta y se decide a mano.
  IF to_regclass('public.recepciones') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'recepciones' AND column_name = 'estado'
     ) THEN
    IF EXISTS (SELECT 1 FROM recepciones) THEN
      RAISE EXCEPTION 'CO-SETUP: la tabla recepciones de la versión anterior ya tiene datos; no se reemplaza sola';
    END IF;
    DROP TABLE IF EXISTS recepciones_lineas;
    DROP TABLE recepciones;
    RAISE NOTICE 'Se reemplazaron las tablas vacías de la versión anterior (oc_recibir).';
  END IF;
END $$;

DROP FUNCTION IF EXISTS oc_recibir(uuid, jsonb, jsonb);

-- El número de un papel en su forma canónica: «261.881», «0261881» y
-- «261881» son la misma factura; «prueba 1» y «PRUEBA-1», el mismo papel.
-- Sin esto, el mismo folio tecleado de otra forma entraría dos veces al stock.
-- Espejo de `normalizarNumeroDocumento` en `recepcion.ts`.
CREATE OR REPLACE FUNCTION compras_doc_norm(p_num text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT coalesce(nullif(ltrim(upper(regexp_replace(coalesce(p_num, ''), '[^0-9A-Za-z]', '', 'g')), '0'), ''),
                  CASE WHEN coalesce(p_num, '') ~ '0' THEN '0' ELSE '' END);
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) recepciones — un papel que llegó
-- ─────────────────────────────────────────────────────────────────────────────
--
--   estado     por_contar  escaneada y revisada; NADA entró al stock
--              contada     contada, firmada y entrada al stock
--              cancelada   descartada antes de contar (con motivo)
--   resultado  ok | con_diferencias | sin_orden — lo decide la base al contar,
--              mirando los números, no lo que diga la pantalla
--
-- `extraccion` guarda la lectura CRUDA de la app (sin precios: el esquema de la
-- lectura no tiene dónde ponerlos). Sirve para auditar después si el error fue
-- de la lectura o de quien revisó.
--
-- `envio_finanzas` es la bandeja de salida hacia Gerencia (etapa 3): nace en
-- «pendiente» al contar, y solo la función que habla con Finanzas la pasa a
-- «enviada», con el acuse en la mano.
CREATE TABLE IF NOT EXISTS recepciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL,
  numero              text NOT NULL,
  orden_id            uuid REFERENCES ordenes_compra(id),

  estado              text NOT NULL DEFAULT 'por_contar'
                        CHECK (estado IN ('por_contar','contada','cancelada')),
  resultado           text CHECK (resultado IN ('ok','con_diferencias','sin_orden')),

  -- ── El papel ──
  doc_tipo            text NOT NULL CHECK (doc_tipo IN ('guia','factura','otro')),
  doc_numero          text NOT NULL CHECK (btrim(doc_numero) <> ''),
  doc_fecha           date,
  -- `{empresa_id}/…` en el bucket privado `docs-recepciones`. Siempre hay
  -- archivo: es el respaldo de lo que se contó.
  doc_path            text NOT NULL CHECK (btrim(doc_path) <> ''),
  doc_mime            text,
  proveedor_rut       text,
  proveedor_nombre    text,
  extraccion          jsonb,
  modelo              text,
  escaneo_error       text,

  -- ── El conteo y la firma ──
  recibe_nombre       text,
  -- PNG en base64, como en Despacho. Una firma de verdad pesa varios KB.
  firma_png           text,
  -- { lat, lng, precisionM?, capturadaEl } — la misma forma que la firma de la
  -- visita. Si el GPS no respondió, se firma igual y queda el motivo.
  firma_geo           jsonb,
  firma_geo_motivo    text,
  -- La lista de diferencias que vio quien firmó, lista para Gerencia:
  -- [{ tipo, gravedad, linea_id?, posicion?, articulo?, esperado?, facturado?,
  --    contado?, nota?, fotos?, texto }]
  diferencias         jsonb NOT NULL DEFAULT '[]'::jsonb,
  notas               text,

  -- ── Lo que entró ──
  lote_id             uuid,
  unidades_ingresadas numeric(12,3) NOT NULL DEFAULT 0,
  lineas_danadas      integer NOT NULL DEFAULT 0,

  -- ── Hacia Gerencia ──
  envio_finanzas          text CHECK (envio_finanzas IN ('pendiente','enviada','error')),
  envio_finanzas_detalle  text,
  envio_finanzas_en       timestamptz,
  envio_finanzas_intentos integer NOT NULL DEFAULT 0,

  -- ── Quién y cuándo ──
  escaneada_por       text,
  escaneada_por_id    uuid,
  creada_en           timestamptz NOT NULL DEFAULT now(),
  contada_por         text,
  contada_por_id      uuid,
  contada_en          timestamptz,
  cancelada_por       text,
  cancelada_en        timestamptz,
  cancelada_motivo    text,

  -- Una recepción contada tiene firma, nombre, resultado y fecha. Un lienzo
  -- vacío también da un PNG, pero de menos de 500 caracteres.
  CONSTRAINT recepciones_contada_firmada CHECK (
    estado <> 'contada' OR (
      coalesce(btrim(recibe_nombre), '') <> ''
      AND length(coalesce(firma_png, '')) >= 500
      AND resultado IS NOT NULL
      AND contada_en IS NOT NULL
    )
  ),
  CONSTRAINT recepciones_resultado_sin_orden CHECK (
    orden_id IS NOT NULL OR resultado IS NULL OR resultado = 'sin_orden'
  ),
  CONSTRAINT recepciones_cancelada_motivo CHECK (
    estado <> 'cancelada' OR (coalesce(btrim(cancelada_motivo), '') <> '' AND cancelada_en IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recepciones_empresa_numero
  ON recepciones(empresa_id, numero);

-- EL MISMO PAPEL NO SE RECIBE DOS VECES. Es el doble clic, o el bodeguero que
-- no sabe que su compañero ya lo escaneó en la mañana: sin esto, el stock
-- entra dos veces. La llave es por ORDEN porque un proveedor puede mandar UNA
-- factura para dos órdenes; sin orden, por el RUT del proveedor. Una
-- recepción CANCELADA no cuenta: se puede volver a escanear el mismo papel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_recepciones_documento
  ON recepciones(
    empresa_id,
    coalesce(orden_id::text, 'RUT:' || compras_rut_norm(proveedor_rut)),
    doc_tipo,
    compras_doc_norm(doc_numero)
  )
  WHERE estado <> 'cancelada';

CREATE INDEX IF NOT EXISTS idx_recepciones_orden
  ON recepciones(orden_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_recepciones_estado
  ON recepciones(empresa_id, estado, creada_en DESC);
-- La bandeja de salida: lo que falta mandarle a Gerencia.
CREATE INDEX IF NOT EXISTS idx_recepciones_envio
  ON recepciones(empresa_id)
  WHERE envio_finanzas IS NOT NULL AND envio_finanzas <> 'enviada';
-- Encontrar la recepción desde el papel, sin saber a qué orden fue.
CREATE INDEX IF NOT EXISTS idx_recepciones_documento
  ON recepciones(empresa_id, compras_doc_norm(doc_numero));

-- Una línea DEL PAPEL (origen «factura») o una que llegó sin facturar y se
-- agregó al contar (origen «manual»). Las cantidades van en la unidad de la
-- ORDEN; `unidades_ingresadas` es lo que entró al kardex, en la del catálogo.
--
-- Sin CHECK de «bueno + dañado > 0»: contar 0 de algo facturado es un faltante
-- legítimo, y es justamente lo que hay que reportar. Y sin único por
-- `orden_linea_id`: el proveedor puede partir una línea de la orden en dos
-- renglones de la factura.
CREATE TABLE IF NOT EXISTS recepciones_lineas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id        uuid NOT NULL REFERENCES recepciones(id) ON DELETE CASCADE,
  empresa_id          uuid NOT NULL,
  posicion            integer NOT NULL DEFAULT 0,
  origen              text NOT NULL DEFAULT 'factura' CHECK (origen IN ('factura','manual')),

  -- ── Lo que dice el papel ──
  fact_codigo         text,
  fact_descripcion    text,
  fact_cantidad       numeric(12,3) CHECK (fact_cantidad IS NULL OR fact_cantidad >= 0),
  fact_unidad         text,
  fact_paquete        numeric(12,3),

  -- ── A qué corresponde ──
  orden_linea_id      uuid REFERENCES ordenes_compra_lineas(id),
  dominio             text CHECK (dominio IN ('insumo','tela')),
  item_cod            text,
  factor              numeric(12,3) NOT NULL DEFAULT 1 CHECK (factor > 0),
  vinculo             text CHECK (vinculo IN ('interno','codigo','aprendida','descripcion','manual')),
  accion              text NOT NULL DEFAULT 'recibir' CHECK (accion IN ('recibir','excluir')),
  motivo_exclusion    text CHECK (motivo_exclusion IN ('no_inventario','no_identificado','otro')),

  -- ── Lo que se contó ──
  cantidad_buena      numeric(12,3) NOT NULL DEFAULT 0 CHECK (cantidad_buena >= 0),
  cantidad_danada     numeric(12,3) NOT NULL DEFAULT 0 CHECK (cantidad_danada >= 0),
  unidades_ingresadas numeric(12,3) NOT NULL DEFAULT 0,
  -- El renglón del kardex que la hizo entrar. Vacío si no entró nada bueno.
  movimiento_id       uuid,
  -- Fotos del problema (una caja rota, una etiqueta distinta), en el mismo
  -- bucket privado.
  fotos_paths         text[] NOT NULL DEFAULT '{}',
  nota                text,
  creada_en           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT recepciones_lineas_excluida_motivo CHECK (accion <> 'excluir' OR motivo_exclusion IS NOT NULL),
  CONSTRAINT recepciones_lineas_recibir_articulo CHECK (
    accion <> 'recibir' OR (dominio IS NOT NULL AND item_cod IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_recepciones_lineas_recepcion
  ON recepciones_lineas(recepcion_id, posicion);
CREATE INDEX IF NOT EXISTS idx_recepciones_lineas_orden_linea
  ON recepciones_lineas(orden_linea_id) WHERE orden_linea_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) RLS — se LEE por empresa; se ESCRIBE solo por las funciones
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recepciones','recepciones_lineas'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_empresa', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (empresa_id = (SELECT get_my_empresa_id()))',
      t || '_select_empresa', t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) El bucket de los papeles y las fotos
-- ─────────────────────────────────────────────────────────────────────────────
--
-- PRIVADO: una factura trae montos, y los montos no se le muestran al taller.
-- La app pide URL firmadas de una hora.
--
-- Se puede SUBIR y LEER, pero NO borrar ni reemplazar desde el navegador: el
-- archivo es el respaldo de lo que entró al stock. La primera carpeta del path
-- es el empresa_id del usuario, como en los demás buckets.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('docs-recepciones', 'docs-recepciones', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 10485760,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS docs_recepciones_select ON storage.objects;
CREATE POLICY docs_recepciones_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'docs-recepciones'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  );

DROP POLICY IF EXISTS docs_recepciones_insert ON storage.objects;
CREATE POLICY docs_recepciones_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'docs-recepciones'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Un código que no identifica nada
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Las facturas traen «N/A», «-», «S/C» o un código que Excel convirtió en
-- «1,10E+11». Aprender eso como código del proveedor haría que la próxima
-- línea sin código se vinculara sola al artículo equivocado.
-- Espejo de `codigoNeutro` en `recepcionFactura.ts`.
CREATE OR REPLACE FUNCTION compras_codigo_neutro(p_cod text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
  SELECT coalesce(btrim(p_cod), '') = ''
      OR upper(btrim(p_cod)) ~ '^(N/?A|-+|S/?C|0+|SIN CODIGO|SIN CÓDIGO)$'
      OR btrim(p_cod) ~* '^[0-9]+([.,][0-9]+)?E\+[0-9]+$';
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) recepcion_abrir — el papel escaneado y revisado, POR CONTAR
-- ─────────────────────────────────────────────────────────────────────────────
--
-- p_orden_id   la orden; NULL = sin orden (solo admin/superadmin)
-- p_documento  { tipo, numero, fecha?, path, mime?, proveedor_rut?,
--                proveedor_nombre?, escaneo_error?, notas? }
-- p_lineas     [{ posicion?, codigo?, descripcion?, cantidad?, unidad?,
--                 paquete?, accion: 'recibir'|'excluir', motivo_exclusion?,
--                 orden_linea_id?, dominio?, item_cod?, factor?, vinculo?,
--                 nota? }]
-- p_extraccion la lectura cruda de la app (auditoría)
-- p_modelo     qué modelo leyó el papel
--
-- Devuelve { recepcion_id, numero, avisos[] }. NO toca el stock.
--
-- Errores: CO002 sin orden y no es admin · CO003 la orden no admite · CO004
-- ese papel ya está · CO005 la línea no es de esta orden · CO006 un dato no
-- sirve · CO008 no existe el artículo.
CREATE OR REPLACE FUNCTION recepcion_abrir(
  p_orden_id   uuid,
  p_documento  jsonb,
  p_lineas     jsonb,
  p_extraccion jsonb DEFAULT NULL,
  p_modelo     text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa    uuid;
  v_rol        text;
  v_email      text;
  -- La orden en variables sueltas y no en un `record`: sin orden, leer un
  -- campo de un record vacío revienta aunque la condición que lo rodea sea
  -- falsa.
  v_oc_numero  text;
  v_oc_estado  text;
  v_oc_rut     text;
  v_oc_prov    text;
  v_ol         record;

  v_doc_tipo   text := lower(btrim(coalesce(p_documento ->> 'tipo', '')));
  v_doc_num    text := btrim(coalesce(p_documento ->> 'numero', ''));
  v_doc_fecha  date;
  v_path       text := btrim(coalesce(p_documento ->> 'path', ''));
  v_rut        text := nullif(btrim(coalesce(p_documento ->> 'proveedor_rut', '')), '');
  v_prov       text := nullif(btrim(coalesce(p_documento ->> 'proveedor_nombre', '')), '');

  v_rec_id     uuid;
  v_numero     text;
  v_previa     text;
  v_avisos     jsonb := '[]'::jsonb;

  v_linea      jsonb;
  v_pos        integer := 0;
  v_accion     text;
  v_motivo     text;
  v_ol_id      uuid;
  v_dominio    text;
  v_cod        text;
  v_factor     numeric(12,3);
  v_vinculo    text;
  v_cant       numeric(12,3);
  v_existe     boolean;
BEGIN
  SELECT s.empresa_id, s.rol, s.email INTO v_empresa, v_rol, v_email
    FROM compras_sesion(ARRAY['admin','superadmin','operario','bodeguero']) s;

  IF p_orden_id IS NULL AND v_rol NOT IN ('admin','superadmin') THEN
    RAISE EXCEPTION 'Solo un administrador puede recibir una factura sin orden de compra'
      USING ERRCODE = 'CO002';
  END IF;

  -- ── El papel ─────────────────────────────────────────────────────────────
  IF v_doc_tipo NOT IN ('guia','factura','otro') THEN
    RAISE EXCEPTION 'Tipo de documento desconocido: %', v_doc_tipo USING ERRCODE = 'CO006';
  END IF;
  IF v_doc_num = '' THEN
    RAISE EXCEPTION 'Falta el número del documento' USING ERRCODE = 'CO006';
  END IF;
  -- El archivo tiene que estar en la carpeta de esta empresa: el path lo manda
  -- el navegador, y sin esto una recepción podría apuntar al papel de otra.
  IF v_path = '' OR split_part(v_path, '/', 1) <> v_empresa::text THEN
    RAISE EXCEPTION 'Falta el archivo del documento, o no es de esta empresa' USING ERRCODE = 'CO006';
  END IF;
  BEGIN
    v_doc_fecha := nullif(btrim(coalesce(p_documento ->> 'fecha', '')), '')::date;
  EXCEPTION WHEN others THEN
    v_doc_fecha := NULL;   -- una fecha mal leída no bloquea: queda sin fecha
  END;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'El documento no tiene ninguna línea' USING ERRCODE = 'CO006';
  END IF;

  -- ── La orden ─────────────────────────────────────────────────────────────
  IF p_orden_id IS NOT NULL THEN
    SELECT numero, estado, proveedor_rut, proveedor_nombre
      INTO v_oc_numero, v_oc_estado, v_oc_rut, v_oc_prov
      FROM ordenes_compra
     WHERE id = p_orden_id AND empresa_id = v_empresa
     FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esa orden no existe' USING ERRCODE = 'CO003';
    END IF;
    IF v_oc_estado NOT IN ('en_espera','recibida_parcial') THEN
      RAISE EXCEPTION 'La orden % está %: ya no se le recibe nada', v_oc_numero, v_oc_estado
        USING ERRCODE = 'CO003';
    END IF;
    -- Sin RUT leído del papel, vale el de la orden.
    v_rut  := coalesce(v_rut, v_oc_rut);
    v_prov := coalesce(v_prov, v_oc_prov);
  END IF;

  -- ── El mismo papel, dos veces ────────────────────────────────────────────
  SELECT numero INTO v_previa
    FROM recepciones
   WHERE empresa_id = v_empresa
     AND estado <> 'cancelada'
     AND coalesce(orden_id::text, 'RUT:' || compras_rut_norm(proveedor_rut))
         = coalesce(p_orden_id::text, 'RUT:' || compras_rut_norm(v_rut))
     AND doc_tipo = v_doc_tipo
     AND compras_doc_norm(doc_numero) = compras_doc_norm(v_doc_num);
  IF v_previa IS NOT NULL THEN
    RAISE EXCEPTION 'Ese documento ya está escaneado (%)', v_previa USING ERRCODE = 'CO004';
  END IF;

  -- Avisos que no bloquean: el mismo papel ya se contó contra OTRA orden (un
  -- proveedor puede facturar dos órdenes juntas, pero también puede ser un
  -- error), y el RUT del papel no es el de la orden.
  SELECT coalesce(jsonb_agg(format('Este documento ya se escaneó en %s (%s)',
                                   coalesce(o.numero, 'una recepción sin orden'), r.numero)), '[]'::jsonb)
    INTO v_avisos
    FROM recepciones r
    LEFT JOIN ordenes_compra o ON o.id = r.orden_id
   WHERE r.empresa_id = v_empresa
     AND r.estado <> 'cancelada'
     AND r.doc_tipo = v_doc_tipo
     AND compras_doc_norm(r.doc_numero) = compras_doc_norm(v_doc_num)
     AND compras_rut_norm(r.proveedor_rut) = compras_rut_norm(v_rut);
  IF compras_rut_norm(p_documento ->> 'proveedor_rut') <> ''
     AND compras_rut_norm(v_oc_rut) <> ''
     AND compras_rut_norm(p_documento ->> 'proveedor_rut') <> compras_rut_norm(v_oc_rut) THEN
    v_avisos := v_avisos || to_jsonb(format('El RUT del documento (%s) no es el de la orden (%s)',
                                            p_documento ->> 'proveedor_rut', v_oc_rut));
  END IF;

  -- El correlativo, sin que dos recepciones simultáneas saquen el mismo.
  PERFORM pg_advisory_xact_lock(hashtext('recepciones:' || v_empresa::text));
  v_numero := compras_siguiente_numero(v_empresa, 'recepciones', 'REC');

  INSERT INTO recepciones (
    empresa_id, numero, orden_id, estado, doc_tipo, doc_numero, doc_fecha,
    doc_path, doc_mime, proveedor_rut, proveedor_nombre, extraccion, modelo,
    escaneo_error, notas, escaneada_por, escaneada_por_id
  ) VALUES (
    v_empresa, v_numero, p_orden_id, 'por_contar', v_doc_tipo, v_doc_num, v_doc_fecha,
    v_path, nullif(btrim(coalesce(p_documento ->> 'mime', '')), ''), v_rut, v_prov,
    p_extraccion, nullif(btrim(coalesce(p_modelo, '')), ''),
    nullif(btrim(coalesce(p_documento ->> 'escaneo_error', '')), ''),
    nullif(btrim(coalesce(p_documento ->> 'notas', '')), ''),
    v_email, auth.uid()
  )
  RETURNING id INTO v_rec_id;

  -- ── Línea por línea ──────────────────────────────────────────────────────
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_pos     := v_pos + 1;
    v_accion  := lower(coalesce(v_linea ->> 'accion', 'recibir'));
    v_motivo  := nullif(lower(btrim(coalesce(v_linea ->> 'motivo_exclusion', ''))), '');
    v_ol_id   := nullif(v_linea ->> 'orden_linea_id', '')::uuid;
    v_dominio := NULL;
    v_cod     := NULL;
    v_factor  := 1;
    v_vinculo := nullif(lower(btrim(coalesce(v_linea ->> 'vinculo', ''))), '');
    v_cant    := nullif(v_linea ->> 'cantidad', '')::numeric;

    IF v_accion NOT IN ('recibir','excluir') THEN
      RAISE EXCEPTION 'Línea %: acción desconocida (%)', v_pos, v_accion USING ERRCODE = 'CO006';
    END IF;
    IF v_cant IS NOT NULL AND v_cant < 0 THEN
      RAISE EXCEPTION 'Línea %: la cantidad no puede ser negativa', v_pos USING ERRCODE = 'CO006';
    END IF;
    IF v_vinculo IS NOT NULL AND v_vinculo NOT IN ('interno','codigo','aprendida','descripcion','manual') THEN
      v_vinculo := 'manual';
    END IF;

    IF v_accion = 'excluir' THEN
      IF v_motivo IS NULL OR v_motivo NOT IN ('no_inventario','no_identificado','otro') THEN
        RAISE EXCEPTION 'Línea %: falta por qué no se recibe', v_pos USING ERRCODE = 'CO006';
      END IF;
      v_ol_id := NULL;
      v_vinculo := NULL;
    ELSIF v_ol_id IS NOT NULL THEN
      IF p_orden_id IS NULL THEN
        RAISE EXCEPTION 'Línea %: una recepción sin orden no puede apuntar a una línea de orden', v_pos
          USING ERRCODE = 'CO005';
      END IF;
      SELECT id, posicion, dominio, item_cod, factor INTO v_ol
        FROM ordenes_compra_lineas
       WHERE id = v_ol_id AND orden_id = p_orden_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Línea %: esa línea no es de la orden %', v_pos, v_oc_numero
          USING ERRCODE = 'CO005';
      END IF;
      IF v_ol.item_cod IS NULL OR v_ol.dominio IS NULL THEN
        RAISE EXCEPTION 'La línea % de la orden no tiene artículo del catálogo: vincúlala en la ficha de la orden antes',
          v_ol.posicion USING ERRCODE = 'CO003';
      END IF;
      v_dominio := v_ol.dominio;
      v_cod     := v_ol.item_cod;
      v_factor  := v_ol.factor;
    ELSE
      -- Contra un artículo del catálogo que NO está en la orden (o sin orden):
      -- entra igual y se reporta como «facturado y no pedido».
      v_dominio := lower(btrim(coalesce(v_linea ->> 'dominio', '')));
      v_cod     := btrim(coalesce(v_linea ->> 'item_cod', ''));
      v_factor  := coalesce(nullif(v_linea ->> 'factor', '')::numeric, 1);
      IF v_dominio NOT IN ('insumo','tela') OR v_cod = '' THEN
        RAISE EXCEPTION 'Línea %: falta decir a qué artículo corresponde, o marcarla como que no se recibe', v_pos
          USING ERRCODE = 'CO006';
      END IF;
      IF v_factor <= 0 THEN
        RAISE EXCEPTION 'Línea %: el factor tiene que ser mayor que 0', v_pos USING ERRCODE = 'CO006';
      END IF;
      IF v_dominio = 'insumo' THEN
        SELECT cod INTO v_cod FROM insumos
         WHERE empresa_id = v_empresa AND compras_cod_norm(cod) = compras_cod_norm(v_cod) LIMIT 1;
      ELSE
        SELECT codigo INTO v_cod FROM telas_catalogo
         WHERE empresa_id = v_empresa AND compras_cod_norm(codigo) = compras_cod_norm(v_cod) LIMIT 1;
      END IF;
      v_existe := FOUND;
      IF NOT v_existe THEN
        RAISE EXCEPTION 'Línea %: no existe el artículo % (%)', v_pos, v_linea ->> 'item_cod', v_dominio
          USING ERRCODE = 'CO008',
                HINT = 'Si es un artículo nuevo, hay que darlo de alta en el catálogo primero';
      END IF;
      v_vinculo := coalesce(v_vinculo, 'manual');
    END IF;

    INSERT INTO recepciones_lineas (
      recepcion_id, empresa_id, posicion, origen,
      fact_codigo, fact_descripcion, fact_cantidad, fact_unidad, fact_paquete,
      orden_linea_id, dominio, item_cod, factor, vinculo,
      accion, motivo_exclusion, nota
    ) VALUES (
      v_rec_id, v_empresa, coalesce(nullif(v_linea ->> 'posicion', '')::integer, v_pos), 'factura',
      nullif(btrim(coalesce(v_linea ->> 'codigo', '')), ''),
      nullif(btrim(coalesce(v_linea ->> 'descripcion', '')), ''),
      v_cant,
      nullif(btrim(coalesce(v_linea ->> 'unidad', '')), ''),
      nullif(v_linea ->> 'paquete', '')::numeric,
      v_ol_id, v_dominio, v_cod, v_factor, v_vinculo,
      v_accion, CASE WHEN v_accion = 'excluir' THEN v_motivo END,
      nullif(btrim(coalesce(v_linea ->> 'nota', '')), '')
    );
  END LOOP;

  RETURN jsonb_build_object('recepcion_id', v_rec_id, 'numero', v_numero, 'avisos', v_avisos);
END $fn$;

REVOKE ALL ON FUNCTION recepcion_abrir(uuid, jsonb, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recepcion_abrir(uuid, jsonb, jsonb, jsonb, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) recepcion_confirmar — el conteo firmado: entra al stock
-- ─────────────────────────────────────────────────────────────────────────────
--
-- p_firma       { recibe, firma, geo?: {lat,lng,precisionM?,capturadaEl},
--                 geo_motivo?, notas? }
-- p_lineas      TODAS las líneas de la recepción, más las que llegaron sin
--               facturar:
--               [{ linea_id | nueva: { orden_linea_id? | dominio+item_cod,
--                                      descripcion? },
--                  facturado?, buena, danada?, esperado?, accion?,
--                  motivo_exclusion?, nota?, fotos?: text[] }]
--               `esperado` es lo que faltaba de la línea de la orden cuando la
--               pantalla se abrió: si cambió, alguien recibió en el medio.
-- p_diferencias la lista que vio quien firmó (se valida la forma y se guarda)
--
-- Devuelve { recepcion_id, numero, resultado, lineas, unidades, danadas,
--            estado_orden }
--
-- TODO O NADA: el conteo, los ingresos al kardex, la orden, la solicitud de
-- origen y lo aprendido, en una transacción.
--
-- El RESULTADO lo decide la base con los números, no con la lista que manda la
-- pantalla: una pantalla vieja o un error de la lógica del navegador no puede
-- hacer pasar por «ok» una recepción con dañados.
CREATE OR REPLACE FUNCTION recepcion_confirmar(
  p_recepcion_id uuid,
  p_firma        jsonb,
  p_lineas       jsonb,
  p_diferencias  jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa    uuid;
  v_email      text;
  v_rec        record;
  -- La orden en variables sueltas (ver `recepcion_abrir`).
  v_oc_numero  text;
  v_oc_estado  text;
  v_oc_rut     text;
  v_oc_sol     uuid;
  v_ol         record;
  v_rl         record;
  v_ol_id      uuid;
  v_ol_pos     integer;

  v_recibe     text := btrim(coalesce(p_firma ->> 'recibe', ''));
  v_firma      text := coalesce(p_firma ->> 'firma', '');
  v_geo        jsonb := p_firma -> 'geo';
  v_geo_mot    text := nullif(btrim(coalesce(p_firma ->> 'geo_motivo', '')), '');
  v_notas      text := nullif(btrim(coalesce(p_firma ->> 'notas', '')), '');

  v_linea      jsonb;
  v_linea_id   uuid;
  v_nueva      jsonb;
  v_buena      numeric(12,3);
  v_danada     numeric(12,3);
  v_fact       numeric(12,3);
  v_esperado   numeric(12,3);
  v_pend       numeric(12,3);
  v_unid       numeric(12,3);
  v_accion     text;
  v_motivo     text;
  v_fotos      text[];
  v_foto       text;
  v_pos_max    integer;
  v_dominio    text;
  v_cod        text;
  v_vistas     uuid[] := '{}';

  v_lote       uuid := gen_random_uuid();
  v_motivo_k   text;
  v_kardex     jsonb := '[]'::jsonb;
  v_rl_ids     uuid[] := '{}';
  v_movs       jsonb;
  i            integer;

  v_n          integer := 0;
  v_danadas    integer := 0;
  v_total      numeric(12,3) := 0;
  v_errores    integer := 0;
  v_resultado  text;
  v_abiertas   integer;
  v_con_algo   integer;
  v_estado     text;
  v_dif        jsonb;
  v_rut_fact   text;
BEGIN
  SELECT s.empresa_id, s.email INTO v_empresa, v_email
    FROM compras_sesion(ARRAY['admin','superadmin','operario','bodeguero']) s;

  -- ── La recepción, BLOQUEADA: dos personas contando la misma a la vez ─────
  SELECT * INTO v_rec
    FROM recepciones
   WHERE id = p_recepcion_id AND empresa_id = v_empresa
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa recepción no existe' USING ERRCODE = 'CO003';
  END IF;
  IF v_rec.estado = 'contada' THEN
    RAISE EXCEPTION '% ya fue contada por % el %', v_rec.numero, coalesce(v_rec.contada_por, 'otra persona'),
      to_char(v_rec.contada_en AT TIME ZONE 'America/Santiago', 'DD-MM-YYYY HH24:MI')
      USING ERRCODE = 'CO003';
  END IF;
  IF v_rec.estado <> 'por_contar' THEN
    RAISE EXCEPTION '% está %: ya no se cuenta', v_rec.numero, v_rec.estado USING ERRCODE = 'CO003';
  END IF;

  -- ── La firma ─────────────────────────────────────────────────────────────
  IF v_recibe = '' THEN
    RAISE EXCEPTION 'Falta el nombre de quien recibe' USING ERRCODE = 'CO007';
  END IF;
  IF length(v_firma) < 500 OR v_firma NOT LIKE 'data:image/png;base64,%' THEN
    RAISE EXCEPTION 'Falta la firma de quien recibe' USING ERRCODE = 'CO007';
  END IF;
  -- La ubicación nunca bloquea: si no vino bien formada, se guarda el motivo.
  IF v_geo IS NOT NULL AND (jsonb_typeof(v_geo) <> 'object'
       OR jsonb_typeof(v_geo -> 'lat') <> 'number' OR jsonb_typeof(v_geo -> 'lng') <> 'number') THEN
    v_geo := NULL;
    v_geo_mot := coalesce(v_geo_mot, 'La ubicación llegó mal formada');
  END IF;
  IF v_geo IS NULL AND v_geo_mot IS NULL THEN
    v_geo_mot := 'Sin ubicación';
  END IF;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' THEN
    RAISE EXCEPTION 'Faltan las líneas contadas' USING ERRCODE = 'CO006';
  END IF;

  -- ── La orden, BLOQUEADA ──────────────────────────────────────────────────
  IF v_rec.orden_id IS NOT NULL THEN
    SELECT numero, estado, proveedor_rut, solicitud_id
      INTO v_oc_numero, v_oc_estado, v_oc_rut, v_oc_sol
      FROM ordenes_compra
     WHERE id = v_rec.orden_id
     FOR UPDATE;
    IF v_oc_estado NOT IN ('en_espera','recibida_parcial') THEN
      RAISE EXCEPTION 'La orden % está %: ya no se le recibe nada. Descarta % y revisa con Gerencia',
        v_oc_numero, v_oc_estado, v_rec.numero USING ERRCODE = 'CO003';
    END IF;

    -- ¿Cambió la orden mientras se contaba? Se mira ANTES de tocar nada: si
    -- dos renglones del papel van a la misma línea de la orden, el segundo
    -- vería lo que ya sumó el primero y rebotaría sin razón.
    FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
      v_esperado := nullif(v_linea ->> 'esperado', '')::numeric;
      CONTINUE WHEN v_esperado IS NULL;
      v_ol_id := coalesce(
        nullif(v_linea #>> '{nueva,orden_linea_id}', '')::uuid,
        (SELECT orden_linea_id FROM recepciones_lineas
          WHERE id = nullif(v_linea ->> 'linea_id', '')::uuid AND recepcion_id = p_recepcion_id)
      );
      CONTINUE WHEN v_ol_id IS NULL;
      SELECT posicion, greatest(cantidad_pedida - cantidad_recibida, 0)
        INTO v_ol_pos, v_pend
        FROM ordenes_compra_lineas
       WHERE id = v_ol_id AND orden_id = v_rec.orden_id
       FOR UPDATE;
      IF FOUND AND round(v_esperado, 3) <> round(v_pend, 3) THEN
        RAISE EXCEPTION 'La orden cambió mientras se contaba (línea % de la orden: faltaban %, ahora faltan %). Cierra el conteo y vuelve a abrirlo',
          v_ol_pos, replace(trim_scale(v_esperado)::text, '.', ','), replace(trim_scale(v_pend)::text, '.', ',')
          USING ERRCODE = 'CO003';
      END IF;
    END LOOP;
  END IF;

  v_motivo_k := v_rec.numero || ' · '
             || coalesce(v_oc_numero, 'sin OC') || ' · '
             || CASE v_rec.doc_tipo WHEN 'guia' THEN 'Guía ' WHEN 'factura' THEN 'Factura ' ELSE 'Doc. ' END
             || v_rec.doc_numero;

  SELECT coalesce(max(posicion), 0) INTO v_pos_max
    FROM recepciones_lineas WHERE recepcion_id = p_recepcion_id;

  -- ── Línea por línea ──────────────────────────────────────────────────────
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_buena    := coalesce(nullif(v_linea ->> 'buena', '')::numeric, 0);
    v_danada   := coalesce(nullif(v_linea ->> 'danada', '')::numeric, 0);
    IF v_buena < 0 OR v_danada < 0 THEN
      RAISE EXCEPTION 'Una cantidad no puede ser negativa' USING ERRCODE = 'CO006';
    END IF;

    -- Las fotos, de la carpeta de esta empresa.
    v_fotos := '{}';
    IF jsonb_typeof(v_linea -> 'fotos') = 'array' THEN
      FOR v_foto IN SELECT jsonb_array_elements_text(v_linea -> 'fotos') LOOP
        IF split_part(v_foto, '/', 1) <> v_empresa::text THEN
          RAISE EXCEPTION 'Una foto no es de esta empresa' USING ERRCODE = 'CO006';
        END IF;
        v_fotos := v_fotos || v_foto;
      END LOOP;
    END IF;

    v_nueva := v_linea -> 'nueva';
    IF v_nueva IS NOT NULL AND jsonb_typeof(v_nueva) = 'object' THEN
      -- ── Llegó algo que el papel no traía ──
      v_pos_max := v_pos_max + 1;
      v_dominio := NULL;
      v_cod := NULL;
      IF nullif(v_nueva ->> 'orden_linea_id', '') IS NOT NULL THEN
        SELECT id, posicion, dominio, item_cod, factor INTO v_ol
          FROM ordenes_compra_lineas
         WHERE id = (v_nueva ->> 'orden_linea_id')::uuid AND orden_id = v_rec.orden_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Lo que llegó sin facturar apunta a una línea que no es de la orden'
            USING ERRCODE = 'CO005';
        END IF;
        IF v_ol.item_cod IS NULL THEN
          RAISE EXCEPTION 'La línea % de la orden no tiene artículo: vincúlala en la ficha de la orden antes',
            v_ol.posicion USING ERRCODE = 'CO003';
        END IF;
        INSERT INTO recepciones_lineas (
          recepcion_id, empresa_id, posicion, origen, fact_descripcion, fact_cantidad,
          orden_linea_id, dominio, item_cod, factor, vinculo, accion
        ) VALUES (
          p_recepcion_id, v_empresa, v_pos_max, 'manual',
          nullif(btrim(coalesce(v_nueva ->> 'descripcion', '')), ''), 0,
          v_ol.id, v_ol.dominio, v_ol.item_cod, v_ol.factor, 'manual', 'recibir'
        )
        RETURNING id INTO v_linea_id;
      ELSE
        v_dominio := lower(btrim(coalesce(v_nueva ->> 'dominio', '')));
        IF v_dominio = 'insumo' THEN
          SELECT cod INTO v_cod FROM insumos
           WHERE empresa_id = v_empresa AND compras_cod_norm(cod) = compras_cod_norm(v_nueva ->> 'item_cod') LIMIT 1;
        ELSIF v_dominio = 'tela' THEN
          SELECT codigo INTO v_cod FROM telas_catalogo
           WHERE empresa_id = v_empresa AND compras_cod_norm(codigo) = compras_cod_norm(v_nueva ->> 'item_cod') LIMIT 1;
        END IF;
        IF v_cod IS NULL THEN
          RAISE EXCEPTION 'No existe el artículo % que llegó sin facturar', v_nueva ->> 'item_cod'
            USING ERRCODE = 'CO008';
        END IF;
        INSERT INTO recepciones_lineas (
          recepcion_id, empresa_id, posicion, origen, fact_descripcion, fact_cantidad,
          dominio, item_cod, factor, vinculo, accion
        ) VALUES (
          p_recepcion_id, v_empresa, v_pos_max, 'manual',
          nullif(btrim(coalesce(v_nueva ->> 'descripcion', '')), ''), 0,
          v_dominio, v_cod, coalesce(nullif(v_nueva ->> 'factor', '')::numeric, 1), 'manual', 'recibir'
        )
        RETURNING id INTO v_linea_id;
      END IF;
    ELSE
      v_linea_id := nullif(v_linea ->> 'linea_id', '')::uuid;
      IF v_linea_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM recepciones_lineas WHERE id = v_linea_id AND recepcion_id = p_recepcion_id
      ) THEN
        RAISE EXCEPTION 'Esa línea no es de %', v_rec.numero USING ERRCODE = 'CO005';
      END IF;
      IF v_linea_id = ANY (v_vistas) THEN
        RAISE EXCEPTION 'Una línea viene dos veces en el conteo' USING ERRCODE = 'CO006';
      END IF;
    END IF;
    v_vistas := v_vistas || v_linea_id;

    -- Lo que se puede corregir al contar: lo facturado (la lectura se pudo
    -- equivocar), si la línea se recibe o no, la nota y las fotos.
    v_fact   := nullif(v_linea ->> 'facturado', '')::numeric;
    v_accion := nullif(lower(btrim(coalesce(v_linea ->> 'accion', ''))), '');
    v_motivo := nullif(lower(btrim(coalesce(v_linea ->> 'motivo_exclusion', ''))), '');
    IF v_fact IS NOT NULL AND v_fact < 0 THEN
      RAISE EXCEPTION 'Lo facturado no puede ser negativo' USING ERRCODE = 'CO006';
    END IF;
    IF v_accion IS NOT NULL AND v_accion NOT IN ('recibir','excluir') THEN
      RAISE EXCEPTION 'Acción desconocida: %', v_accion USING ERRCODE = 'CO006';
    END IF;

    UPDATE recepciones_lineas
       SET fact_cantidad = CASE WHEN origen = 'manual' THEN 0 ELSE coalesce(v_fact, fact_cantidad) END,
           accion = coalesce(v_accion, accion),
           motivo_exclusion = CASE WHEN coalesce(v_accion, accion) = 'excluir'
                                   THEN coalesce(v_motivo, motivo_exclusion) END,
           nota = coalesce(nullif(btrim(coalesce(v_linea ->> 'nota', '')), ''), nota),
           fotos_paths = CASE WHEN cardinality(v_fotos) > 0 THEN v_fotos ELSE fotos_paths END
     WHERE id = v_linea_id
    RETURNING * INTO v_rl;

    IF v_rl.accion = 'excluir' THEN
      IF v_rl.motivo_exclusion IS NULL THEN
        RAISE EXCEPTION 'Línea %: falta por qué no se recibe', v_rl.posicion USING ERRCODE = 'CO006';
      END IF;
      -- Una línea que no se recibe no cuenta nada: lo que se haya tecleado se
      -- descarta para que no entre por error.
      UPDATE recepciones_lineas SET cantidad_buena = 0, cantidad_danada = 0 WHERE id = v_linea_id;
      IF v_rl.motivo_exclusion = 'no_identificado' THEN v_errores := v_errores + 1; END IF;
      CONTINUE;
    END IF;
    IF v_rl.item_cod IS NULL OR v_rl.dominio IS NULL THEN
      RAISE EXCEPTION 'Línea %: no tiene artículo: no se puede recibir', v_rl.posicion USING ERRCODE = 'CO006';
    END IF;

    -- Recibido contra un artículo que la orden no traía.
    IF v_rl.orden_linea_id IS NULL AND v_rec.orden_id IS NOT NULL THEN
      v_errores := v_errores + 1;
    END IF;

    -- A unidades nuestras. El kardex guarda los insumos ENTEROS.
    v_unid := round(v_buena * v_rl.factor, 3);
    IF v_rl.dominio = 'insumo' AND v_unid <> round(v_unid) THEN
      RAISE EXCEPTION 'Línea % (%) da % unidades: los insumos entran en números enteros',
        v_rl.posicion, v_rl.item_cod, replace(trim_scale(v_unid)::text, '.', ',')
        USING ERRCODE = 'CO006', HINT = 'Revisa la cantidad o el factor de la línea';
    END IF;

    -- Los errores que se ven en los números de la línea.
    IF v_danada > 0 THEN v_errores := v_errores + 1; END IF;
    IF round(v_buena + v_danada, 3) <> round(coalesce(v_rl.fact_cantidad, 0), 3) THEN
      v_errores := v_errores + 1;
    END IF;

    UPDATE recepciones_lineas
       SET cantidad_buena = v_buena,
           cantidad_danada = v_danada,
           unidades_ingresadas = v_unid
     WHERE id = v_linea_id;

    -- Solo lo bueno descuenta lo que falta. SIN TOPE: lo que llegó de más
    -- entra y queda como diferencia.
    IF v_rl.orden_linea_id IS NOT NULL AND v_buena > 0 THEN
      UPDATE ordenes_compra_lineas
         SET cantidad_recibida = cantidad_recibida + v_buena,
             estado_linea = CASE
               WHEN estado_linea IN ('faltante_aceptado','cancelada') THEN estado_linea
               WHEN cantidad_recibida + v_buena >= cantidad_pedida THEN 'completa'
               ELSE 'parcial'
             END
       WHERE id = v_rl.orden_linea_id;
    END IF;

    IF v_unid > 0 THEN
      v_kardex := v_kardex || jsonb_build_object(
        'dominio', v_rl.dominio,
        'item_cod', v_rl.item_cod,
        'tipo', 'INGRESO',
        'cantidad', v_unid,
        'destino', 'MP',
        'referencia_tipo', 'recepcion',
        'referencia_id', v_rec.numero,
        'motivo', v_motivo_k,
        'responsable', v_recibe,
        'recibe', v_recibe,
        'notas', CASE WHEN v_danada > 0
                      THEN format('Llegaron además %s dañados, que no entraron',
                                  replace(trim_scale(v_danada)::text, '.', ','))
                 END
      );
      v_rl_ids := v_rl_ids || v_linea_id;
      v_total := v_total + v_unid;
    END IF;
    IF v_danada > 0 THEN v_danadas := v_danadas + 1; END IF;
    IF v_buena > 0 OR v_danada > 0 THEN v_n := v_n + 1; END IF;
  END LOOP;

  -- Toda línea del papel tiene que venir contada: una que falta en la lista
  -- se leería como «llegó 0» sin que nadie lo haya dicho.
  IF EXISTS (
    SELECT 1 FROM recepciones_lineas
     WHERE recepcion_id = p_recepcion_id AND NOT (id = ANY (v_vistas))
  ) THEN
    RAISE EXCEPTION 'Falta contar alguna línea de %: vuelve a abrir el conteo', v_rec.numero
      USING ERRCODE = 'CO006';
  END IF;

  -- ── Lo facturado contra lo que faltaba de la orden ───────────────────────
  -- Facturar MÁS de lo que faltaba es un error; facturar menos es una entrega
  -- parcial, que solo se avisa.
  IF v_rec.orden_id IS NOT NULL THEN
    SELECT v_errores + count(*) INTO v_errores
      FROM ordenes_compra_lineas ol
      JOIN LATERAL (
        SELECT sum(coalesce(l.fact_cantidad, 0)) FILTER (WHERE l.origen = 'factura') AS fact,
               sum(l.cantidad_buena) AS buena
          FROM recepciones_lineas l
         WHERE l.recepcion_id = p_recepcion_id
           AND l.accion = 'recibir'
           AND l.orden_linea_id = ol.id
      ) s ON s.buena IS NOT NULL
     WHERE ol.orden_id = v_rec.orden_id
       -- `cantidad_recibida` ya incluye lo bueno de ESTA recepción: se resta
       -- para comparar contra lo que faltaba antes de contar.
       AND round(coalesce(s.fact, 0), 3)
           > round(greatest(ol.cantidad_pedida - (ol.cantidad_recibida - s.buena), 0), 3);
  END IF;

  -- El RUT del papel no es el de la orden. Vale el que quedó en la recepción
  -- (el revisado por la persona, o el de la orden si el papel no traía), no el
  -- crudo de la lectura: si la lectura se equivocó y se corrigió, no es error.
  v_rut_fact := compras_rut_norm(v_rec.proveedor_rut);
  IF v_rut_fact <> '' AND compras_rut_norm(v_oc_rut) <> '' AND v_rut_fact <> compras_rut_norm(v_oc_rut) THEN
    v_errores := v_errores + 1;
  END IF;

  v_resultado := CASE
    WHEN v_rec.orden_id IS NULL THEN 'sin_orden'
    WHEN v_errores > 0 THEN 'con_diferencias'
    ELSE 'ok'
  END;

  -- ── La lista de diferencias: se valida la forma, no se reescribe ─────────
  IF p_diferencias IS NULL OR jsonb_typeof(p_diferencias) <> 'array' THEN
    p_diferencias := '[]'::jsonb;
  END IF;
  FOR v_dif IN SELECT * FROM jsonb_array_elements(p_diferencias) LOOP
    IF jsonb_typeof(v_dif) <> 'object'
       OR coalesce(v_dif ->> 'tipo', '') NOT IN ('facturado_no_pedido','facturado_de_mas','facturado_de_menos',
                                                'faltante','sobrante','danado','excluida','no_identificado',
                                                'rut_distinto','sin_orden')
       OR coalesce(v_dif ->> 'gravedad', '') NOT IN ('error','aviso')
       OR coalesce(btrim(v_dif ->> 'texto'), '') = '' THEN
      RAISE EXCEPTION 'Una diferencia viene mal armada: %', left(v_dif::text, 200) USING ERRCODE = 'CO006';
    END IF;
  END LOOP;

  -- ── Al stock, por la única puerta ────────────────────────────────────────
  --
  -- Todos los ingresos en UNA llamada y con el mismo lote. Un INGRESO deja
  -- exactamente un renglón por línea, en el mismo orden en que se mandan: por
  -- eso se pueden amarrar de vuelta a las líneas de la recepción.
  IF jsonb_array_length(v_kardex) > 0 THEN
    v_movs := inventario_registrar(v_kardex, jsonb_build_object('lote_id', v_lote)) -> 'movimientos';
    IF jsonb_array_length(v_movs) <> jsonb_array_length(v_kardex) THEN
      RAISE EXCEPTION 'El kardex devolvió % movimientos para % ingresos: se aborta la recepción',
        jsonb_array_length(v_movs), jsonb_array_length(v_kardex);
    END IF;
    FOR i IN 0 .. jsonb_array_length(v_movs) - 1 LOOP
      UPDATE recepciones_lineas
         SET movimiento_id = (v_movs -> i ->> 'id')::uuid
       WHERE id = v_rl_ids[i + 1];
    END LOOP;
  END IF;

  -- ── Lo aprendido ─────────────────────────────────────────────────────────
  --
  -- Lo que una persona emparejó a mano (o por la descripción) queda como
  -- «este código de este proveedor es este artículo nuestro», igual que en la
  -- ficha de la orden: la próxima factura lo reconoce sola. Sin código, se
  -- aprende la descripción.
  IF compras_rut_norm(v_rec.proveedor_rut) <> '' THEN
    INSERT INTO insumo_codigos_proveedor (
      empresa_id, proveedor_rut, clave_tipo, clave, dominio, item_cod,
      descriptor_visto, factor, origen
    )
    SELECT DISTINCT ON (clave_tipo, clave)
           v_empresa, v_rec.proveedor_rut, x.clave_tipo, x.clave, x.dominio, x.item_cod,
           x.fact_descripcion, x.factor, 'recepcion'
      FROM (
        SELECT CASE WHEN compras_codigo_neutro(l.fact_codigo) THEN 'descripcion' ELSE 'codigo' END AS clave_tipo,
               CASE WHEN compras_codigo_neutro(l.fact_codigo)
                    THEN compras_cod_norm(l.fact_descripcion)
                    ELSE upper(btrim(l.fact_codigo)) END AS clave,
               l.dominio, l.item_cod, l.fact_descripcion, l.factor, l.posicion
          FROM recepciones_lineas l
         WHERE l.recepcion_id = p_recepcion_id
           AND l.accion = 'recibir'
           AND l.origen = 'factura'
           AND l.vinculo IN ('descripcion','manual')
           AND l.item_cod IS NOT NULL
      ) x
     WHERE x.clave <> ''
     ORDER BY clave_tipo, clave, x.posicion
    ON CONFLICT (empresa_id, upper(regexp_replace(proveedor_rut, '[^0-9kK]', '', 'g')),
                 clave_tipo, upper(btrim(clave)))
    DO UPDATE SET dominio = EXCLUDED.dominio,
                  item_cod = EXCLUDED.item_cod,
                  factor = EXCLUDED.factor,
                  descriptor_visto = coalesce(EXCLUDED.descriptor_visto, insumo_codigos_proveedor.descriptor_visto),
                  veces_visto = insumo_codigos_proveedor.veces_visto + 1,
                  actualizada_en = now();
  END IF;

  -- ── La recepción queda contada ───────────────────────────────────────────
  UPDATE recepciones
     SET estado = 'contada',
         resultado = v_resultado,
         recibe_nombre = v_recibe,
         firma_png = v_firma,
         firma_geo = v_geo,
         firma_geo_motivo = CASE WHEN v_geo IS NULL THEN v_geo_mot END,
         notas = coalesce(v_notas, notas),
         diferencias = p_diferencias,
         lote_id = CASE WHEN v_total > 0 THEN v_lote END,
         unidades_ingresadas = v_total,
         lineas_danadas = v_danadas,
         envio_finanzas = 'pendiente',
         contada_por = v_email,
         contada_por_id = auth.uid(),
         contada_en = now()
   WHERE id = p_recepcion_id;

  -- ── Cómo queda la orden ──────────────────────────────────────────────────
  IF v_rec.orden_id IS NOT NULL THEN
    SELECT count(*) FILTER (WHERE estado_linea IN ('pendiente','parcial')),
           count(*) FILTER (WHERE cantidad_recibida > 0)
      INTO v_abiertas, v_con_algo
      FROM ordenes_compra_lineas
     WHERE orden_id = v_rec.orden_id;

    v_estado := CASE
      WHEN v_abiertas = 0 THEN 'recibida'
      WHEN v_con_algo > 0 THEN 'recibida_parcial'
      ELSE v_oc_estado   -- solo llegó dañado: sigue esperando
    END;
    UPDATE ordenes_compra SET estado = v_estado WHERE id = v_rec.orden_id;

    -- ── Y la solicitud de la que nació ─────────────────────────────────────
    -- Una línea del pedido de bodega queda «recibida» cuando su artículo llegó
    -- completo en esta orden. El pedido entero, cuando no le queda ninguna
    -- línea esperando.
    IF v_oc_sol IS NOT NULL THEN
      UPDATE solicitudes_reposicion_lineas sl
         SET estado_linea = 'recibida',
             oc_numero = coalesce(sl.oc_numero, v_oc_numero)
       WHERE sl.solicitud_id = v_oc_sol
         AND sl.estado_linea IN ('pendiente','en_orden')
         AND EXISTS (
           SELECT 1 FROM ordenes_compra_lineas l
            WHERE l.orden_id = v_rec.orden_id
              AND l.estado_linea = 'completa'
              AND l.dominio = sl.dominio
              AND compras_cod_norm(l.item_cod) = compras_cod_norm(sl.item_cod)
         );

      IF NOT EXISTS (
        SELECT 1 FROM solicitudes_reposicion_lineas
         WHERE solicitud_id = v_oc_sol
           AND estado_linea IN ('pendiente','en_orden')
      ) THEN
        UPDATE solicitudes_reposicion
           SET estado = 'recibida', actualizada_en = now()
         WHERE id = v_oc_sol AND estado IN ('enviada','en_orden');
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'recepcion_id', p_recepcion_id,
    'numero', v_rec.numero,
    'resultado', v_resultado,
    'lote_id', CASE WHEN v_total > 0 THEN v_lote END,
    'lineas', v_n,
    'unidades', v_total,
    'danadas', v_danadas,
    'estado_orden', v_estado
  );
END $fn$;

REVOKE ALL ON FUNCTION recepcion_confirmar(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recepcion_confirmar(uuid, jsonb, jsonb, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) recepcion_cancelar — descartar una que todavía no se contó
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Para el papel escaneado contra la orden equivocada, o leído tan mal que
-- conviene empezar de nuevo. Con motivo escrito. El archivo se queda: el
-- bucket no deja borrar, y el papel sigue siendo constancia.
CREATE OR REPLACE FUNCTION recepcion_cancelar(p_recepcion_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_empresa uuid;
  v_email   text;
  v_rec     record;
BEGIN
  SELECT s.empresa_id, s.email INTO v_empresa, v_email
    FROM compras_sesion(ARRAY['admin','superadmin','operario','bodeguero']) s;

  IF coalesce(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Falta el motivo para descartarla' USING ERRCODE = 'CO006';
  END IF;

  SELECT id, numero, estado INTO v_rec
    FROM recepciones
   WHERE id = p_recepcion_id AND empresa_id = v_empresa
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa recepción no existe' USING ERRCODE = 'CO003';
  END IF;
  IF v_rec.estado <> 'por_contar' THEN
    RAISE EXCEPTION '% está %: solo se descarta una que todavía no se contó', v_rec.numero, v_rec.estado
      USING ERRCODE = 'CO003';
  END IF;

  UPDATE recepciones
     SET estado = 'cancelada',
         cancelada_por = v_email,
         cancelada_en = now(),
         cancelada_motivo = btrim(p_motivo)
   WHERE id = p_recepcion_id;

  RETURN jsonb_build_object('numero', v_rec.numero, 'estado', 'cancelada');
END $fn$;

REVOKE ALL ON FUNCTION recepcion_cancelar(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recepcion_cancelar(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) Verificación — o queda todo, o no queda nada
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_faltan text[] := '{}';
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recepciones','recepciones_lineas'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN v_faltan := v_faltan || t; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t AND rowsecurity) THEN
      v_faltan := v_faltan || (t || ' (sin RLS)');
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'recepciones' AND column_name = 'estado') THEN
    v_faltan := v_faltan || 'recepciones.estado'::text;
  END IF;

  IF to_regprocedure('public.recepcion_abrir(uuid,jsonb,jsonb,jsonb,text)') IS NULL THEN
    v_faltan := v_faltan || 'recepcion_abrir'::text;
  END IF;
  IF to_regprocedure('public.recepcion_confirmar(uuid,jsonb,jsonb,jsonb)') IS NULL THEN
    v_faltan := v_faltan || 'recepcion_confirmar'::text;
  END IF;
  IF to_regprocedure('public.recepcion_cancelar(uuid,text)') IS NULL THEN
    v_faltan := v_faltan || 'recepcion_cancelar'::text;
  END IF;
  IF to_regprocedure('public.oc_recibir(uuid,jsonb,jsonb)') IS NOT NULL THEN
    v_faltan := v_faltan || 'oc_recibir todavía existe'::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'docs-recepciones' AND public = false) THEN
    v_faltan := v_faltan || 'bucket docs-recepciones PRIVADO'::text;
  END IF;

  -- Las recepciones no tienen plata: la factura puede traer montos, pero esos
  -- se quedan en el archivo, que es privado.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('recepciones','recepciones_lineas')
       AND column_name ~* '(precio|monto|total|neto|iva|costo|valor)'
  ) THEN
    v_faltan := v_faltan || 'HAY UNA COLUMNA DE PLATA'::text;
  END IF;

  -- Los tipos de referencia del kardex tienen que aceptar 'recepcion'.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.inventario_movimientos'::regclass
       AND pg_get_constraintdef(oid) LIKE '%recepcion%'
  ) THEN
    v_faltan := v_faltan || 'inventario_movimientos no acepta referencia_tipo recepcion'::text;
  END IF;

  IF compras_codigo_neutro('1,10E+11') IS NOT TRUE OR compras_codigo_neutro('N/A') IS NOT TRUE
     OR compras_codigo_neutro('ROB 58 55') IS NOT FALSE THEN
    v_faltan := v_faltan || 'compras_codigo_neutro no distingue bien'::text;
  END IF;
  IF compras_doc_norm('261.881') <> compras_doc_norm('0261881')
     OR compras_doc_norm('prueba 1') <> compras_doc_norm('PRUEBA-1')
     OR compras_doc_norm('261881') = compras_doc_norm('261882') THEN
    v_faltan := v_faltan || 'compras_doc_norm no distingue bien'::text;
  END IF;

  IF array_length(v_faltan, 1) > 0 THEN
    RAISE EXCEPTION 'ABORTADO, falta: %', array_to_string(v_faltan, ', ');
  END IF;

  RAISE NOTICE 'Compras 02: recepciones por contar, conteo firmado y el bucket docs-recepciones en su lugar.';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Después de correrlo
-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Queda vacío hasta la primera recepción:
--    SELECT count(*) FROM recepciones;                              -- 0
--
-- 2) Tras contar la primera desde la app, el libro tiene que seguir cuadrando:
--    SELECT count(*) FROM v_inventario_saldos_kardex;                -- 0
--
-- 3) Cada ingreso cuelga de su recepción:
--    SELECT r.numero, r.estado, r.resultado, count(l.*) AS lineas,
--           count(l.movimiento_id) AS con_kardex
--      FROM recepciones r JOIN recepciones_lineas l ON l.recepcion_id = r.id
--     GROUP BY r.numero, r.estado, r.resultado ORDER BY r.numero;

-- ─────────────────────────────────────────────────────────────────────────────
-- REVERSA
-- ─────────────────────────────────────────────────────────────────────────────
-- OJO: si ya se contó algo, el stock YA ENTRÓ por el kardex. Borrar estas
-- tablas no lo saca: queda el ingreso en el libro sin su recepción. Antes de la
-- reversa, deshacer cada recepción contada con un ajuste en el kardex.
--
-- DROP FUNCTION IF EXISTS recepcion_cancelar(uuid, text);
-- DROP FUNCTION IF EXISTS recepcion_confirmar(uuid, jsonb, jsonb, jsonb);
-- DROP FUNCTION IF EXISTS recepcion_abrir(uuid, jsonb, jsonb, jsonb, text);
-- DROP FUNCTION IF EXISTS compras_codigo_neutro(text);
-- (compras_doc_norm se borra DESPUÉS de las tablas: la usa un índice)
-- DROP POLICY IF EXISTS docs_recepciones_select ON storage.objects;
-- DROP POLICY IF EXISTS docs_recepciones_insert ON storage.objects;
-- DROP TABLE IF EXISTS recepciones_lineas;
-- DROP TABLE IF EXISTS recepciones;
-- DROP FUNCTION IF EXISTS compras_doc_norm(text);
-- (el bucket se borra desde el panel, después de vaciarlo)
