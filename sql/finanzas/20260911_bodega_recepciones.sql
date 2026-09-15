-- ─────────────────────────────────────────────────────────────────────────────
-- BANDEJA DE RECEPCIONES PARA GERENCIA — 2026-09-11
--
-- ⚠️  ESTE ARCHIVO SE CORRE EN EL PROYECTO SUPABASE DE **ROLZZO-FINANZAS**,
--     NO en rolzzo-produccion (igual que 20260911_bodega_contrato.sql).
--
-- Qué es: donde le llega a Gerencia cada factura que la bodega recibió,
-- contó y firmó. Llega SIEMPRE, esté todo bien o con errores:
--
--   resultado = ok               lo contado es lo facturado y lo pedido
--   resultado = con_diferencias  faltó, sobró, llegó dañado, no estaba pedido…
--   resultado = sin_orden        la ingresó un administrador sin orden de compra
--
-- Cada fila trae la lista de diferencias ya escrita para leer («Línea 3 «RO
-- ROLLER…»: facturados 35, contados 30 (faltan 5)»), las líneas con sus tres
-- números (pedido, facturado, contado), quién recibió, cuándo y dónde firmó, y
-- las rutas del documento, la firma y las fotos en el bucket privado
-- `bodega-recepciones` de ESTE proyecto (se copian acá: Gerencia no depende de
-- que la bodega esté arriba para ver la factura).
--
-- LA ESCRIBE SOLO LA BODEGA, por la función `bodega_registrar_recepcion`, con
-- la llave de servicio. Es IDEMPOTENTE por `id` (el de la recepción en la
-- bodega): reenviar después de un corte de red no duplica la fila. Y un
-- reenvío NUNCA pisa lo que escribió Gerencia (`procesado`, `notas_gerencia`).
--
-- SIN PRECIOS: la bodega no los tiene. La comprobación del final aborta si
-- aparece una columna de plata, y la función rechaza un envío que traiga una
-- clave de plata.
--
-- Nada de esto toca las tablas de Finanzas: ni las órdenes ni los documentos.
-- `orden_finanzas_id` es el id de `rolzzo_ordenes_compra` como texto y SIN
-- llave foránea: una bandeja no rechaza un envío porque la orden se borró.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) La bandeja
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bodega_recepciones (
  id                 uuid PRIMARY KEY,
  origen             text NOT NULL DEFAULT 'bodega-rolzzo',
  version            integer NOT NULL DEFAULT 1,
  numero             text NOT NULL,

  orden_finanzas_id  text,
  orden_numero       text,
  proveedor_rut      text,
  proveedor_nombre   text,

  doc_tipo           text,
  doc_numero         text,
  doc_fecha          date,
  documento_path     text,
  documento_mime     text,

  resultado          text NOT NULL CHECK (resultado IN ('ok','con_diferencias','sin_orden')),
  errores            integer NOT NULL DEFAULT 0,
  avisos             integer NOT NULL DEFAULT 0,
  diferencias        jsonb NOT NULL DEFAULT '[]'::jsonb,
  lineas             jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- { nombre, fecha, usuario, geo: {lat,lng,precisionM,capturadaEl} | null, geo_motivo }
  recibio            jsonb,
  firma_path         text,
  fotos_paths        text[] NOT NULL DEFAULT '{}',
  notas              text,
  -- Todo lo que llegó, tal cual, por si una columna de arriba no alcanza.
  payload            jsonb NOT NULL,

  escaneada_en       timestamptz,
  contada_en         timestamptz,
  recibida_en        timestamptz NOT NULL DEFAULT now(),
  actualizada_en     timestamptz NOT NULL DEFAULT now(),
  veces_recibida     integer NOT NULL DEFAULT 1,

  -- ── De Gerencia: la bodega nunca los toca ──
  procesado          boolean NOT NULL DEFAULT false,
  procesado_en       timestamptz,
  procesado_por      text,
  notas_gerencia     text
);

CREATE INDEX IF NOT EXISTS idx_bodega_recepciones_bandeja
  ON bodega_recepciones(procesado, recibida_en DESC);
CREATE INDEX IF NOT EXISTS idx_bodega_recepciones_resultado
  ON bodega_recepciones(resultado, recibida_en DESC);
CREATE INDEX IF NOT EXISTS idx_bodega_recepciones_orden
  ON bodega_recepciones(orden_numero);

-- Cerrada a la llave pública: con RLS y sin políticas, solo la llave de
-- servicio la ve. Supabase abre toda tabla nueva a anon/authenticated: se
-- revoca explícito y se comprueba al final.
ALTER TABLE bodega_recepciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bodega_recepciones FROM PUBLIC, anon, authenticated;
GRANT ALL ON bodega_recepciones TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) El bucket de los papeles, las firmas y las fotos
-- ─────────────────────────────────────────────────────────────────────────────
--
-- PRIVADO y sin políticas para usuarios: lo sube la bodega con la llave de
-- servicio, y Gerencia lo abre con URL firmadas (o desde el panel).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bodega-recepciones', 'bodega-recepciones', false, 20971520,
        ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 20971520,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) bodega_registrar_recepcion — la única puerta de entrada
-- ─────────────────────────────────────────────────────────────────────────────
--
-- p: el envío de la bodega (ver `supabase/functions/enviar-recepcion-finanzas/
--    payload.ts` en el repo de la bodega).
--
-- Devuelve { id, numero, veces_recibida, procesado }.
CREATE OR REPLACE FUNCTION bodega_registrar_recepcion(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_id    uuid;
  v_fila  bodega_recepciones;
  v_fecha date;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'El envío viene vacío';
  END IF;
  BEGIN
    v_id := (p ->> 'id')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'El envío no trae un id válido';
  END;
  IF v_id IS NULL OR coalesce(btrim(p ->> 'numero'), '') = '' THEN
    RAISE EXCEPTION 'El envío no trae id o número';
  END IF;
  IF coalesce(p ->> 'resultado', '') NOT IN ('ok','con_diferencias','sin_orden') THEN
    RAISE EXCEPTION 'Resultado desconocido: %', p ->> 'resultado';
  END IF;
  -- Sin plata: ninguna clave del envío, a ninguna profundidad, puede llamarse
  -- como un monto.
  IF p::text ~* '"[a-z_]*(precio|monto|total|neto|iva|costo|valor|descuento)[a-z_]*"\s*:' THEN
    RAISE EXCEPTION 'El envío trae un campo de plata: se rechaza';
  END IF;
  BEGIN
    v_fecha := nullif(p #>> '{documento,fecha}', '')::date;
  EXCEPTION WHEN others THEN
    v_fecha := NULL;
  END;

  INSERT INTO bodega_recepciones AS b (
    id, origen, version, numero, orden_finanzas_id, orden_numero,
    proveedor_rut, proveedor_nombre, doc_tipo, doc_numero, doc_fecha,
    documento_path, documento_mime, resultado, errores, avisos,
    diferencias, lineas, recibio, firma_path, fotos_paths, notas, payload,
    escaneada_en, contada_en
  ) VALUES (
    v_id,
    coalesce(p ->> 'origen', 'bodega-rolzzo'),
    coalesce((p ->> 'version')::integer, 1),
    p ->> 'numero',
    p #>> '{orden,finanzas_id}',
    p #>> '{orden,numero}',
    p #>> '{proveedor,rut}',
    p #>> '{proveedor,nombre}',
    p #>> '{documento,tipo}',
    p #>> '{documento,numero}',
    v_fecha,
    p #>> '{documento,path}',
    p #>> '{documento,mime}',
    p ->> 'resultado',
    coalesce((p ->> 'errores')::integer, 0),
    coalesce((p ->> 'avisos')::integer, 0),
    coalesce(p -> 'diferencias', '[]'::jsonb),
    coalesce(p -> 'lineas', '[]'::jsonb),
    p -> 'recibio',
    p ->> 'firma_path',
    coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p -> 'fotos_paths', '[]'::jsonb))), '{}'),
    p ->> 'notas',
    p,
    nullif(p ->> 'escaneada_en', '')::timestamptz,
    nullif(p ->> 'contada_en', '')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    origen = EXCLUDED.origen,
    version = EXCLUDED.version,
    numero = EXCLUDED.numero,
    orden_finanzas_id = EXCLUDED.orden_finanzas_id,
    orden_numero = EXCLUDED.orden_numero,
    proveedor_rut = EXCLUDED.proveedor_rut,
    proveedor_nombre = EXCLUDED.proveedor_nombre,
    doc_tipo = EXCLUDED.doc_tipo,
    doc_numero = EXCLUDED.doc_numero,
    doc_fecha = EXCLUDED.doc_fecha,
    documento_path = EXCLUDED.documento_path,
    documento_mime = EXCLUDED.documento_mime,
    resultado = EXCLUDED.resultado,
    errores = EXCLUDED.errores,
    avisos = EXCLUDED.avisos,
    diferencias = EXCLUDED.diferencias,
    lineas = EXCLUDED.lineas,
    recibio = EXCLUDED.recibio,
    firma_path = EXCLUDED.firma_path,
    fotos_paths = EXCLUDED.fotos_paths,
    notas = EXCLUDED.notas,
    payload = EXCLUDED.payload,
    escaneada_en = EXCLUDED.escaneada_en,
    contada_en = EXCLUDED.contada_en,
    actualizada_en = now(),
    veces_recibida = b.veces_recibida + 1
    -- procesado, procesado_en, procesado_por y notas_gerencia NO se tocan.
  RETURNING * INTO v_fila;

  RETURN jsonb_build_object(
    'id', v_fila.id,
    'numero', v_fila.numero,
    'veces_recibida', v_fila.veces_recibida,
    'procesado', v_fila.procesado
  );
END $fn$;

REVOKE ALL ON FUNCTION bodega_registrar_recepcion(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bodega_registrar_recepcion(jsonb) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Comprobación — ABORTA si algo no calza
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_plata text;
BEGIN
  IF to_regclass('public.bodega_recepciones') IS NULL THEN
    RAISE EXCEPTION 'No quedó la tabla bodega_recepciones';
  END IF;
  IF to_regprocedure('public.bodega_registrar_recepcion(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'No quedó la función bodega_registrar_recepcion';
  END IF;

  SELECT string_agg(column_name, ', ') INTO v_plata
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'bodega_recepciones'
     AND column_name ~* '(precio|monto|total|neto|iva|costo|valor|descuento)';
  IF v_plata IS NOT NULL THEN
    RAISE EXCEPTION 'La bandeja NO puede tener plata, y tiene: %', v_plata;
  END IF;

  IF has_table_privilege('anon', 'bodega_recepciones', 'SELECT')
     OR has_table_privilege('authenticated', 'bodega_recepciones', 'SELECT')
     OR has_function_privilege('anon', 'bodega_registrar_recepcion(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'bodega_registrar_recepcion(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'La bandeja quedó abierta a la llave pública. Revisar los REVOKE.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'bodega-recepciones' AND public = false) THEN
    RAISE EXCEPTION 'El bucket bodega-recepciones no quedó PRIVADO';
  END IF;

  RAISE NOTICE 'Bandeja de recepciones en su lugar: tabla, bucket privado y función, cerrados a la llave pública.';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Cómo la mira Gerencia (SQL Editor de Finanzas)
-- ─────────────────────────────────────────────────────────────────────────────
-- Lo que falta revisar, lo con errores primero:
--   SELECT numero, orden_numero, proveedor_nombre, doc_tipo, doc_numero,
--          resultado, errores, avisos, recibio ->> 'nombre' AS recibio,
--          contada_en
--     FROM bodega_recepciones
--    WHERE NOT procesado
--    ORDER BY (resultado = 'ok'), contada_en DESC;
--
-- Qué no calzó en una:
--   SELECT d ->> 'gravedad' AS gravedad, d ->> 'texto' AS que_paso
--     FROM bodega_recepciones, jsonb_array_elements(diferencias) d
--    WHERE numero = 'REC-0001';
--
-- Marcarla revisada:
--   UPDATE bodega_recepciones
--      SET procesado = true, procesado_en = now(), procesado_por = 'Gerencia',
--          notas_gerencia = 'Se pidió nota de crédito por los 5 m faltantes'
--    WHERE numero = 'REC-0001';
--
-- El documento, la firma y las fotos: Storage → bodega-recepciones → carpeta
-- con el id de la recepción.

-- ─────────────────────────────────────────────────────────────────────────────
-- Prueba (correr aparte, en Finanzas; se deshace sola)
-- ─────────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- SELECT bodega_registrar_recepcion('{"id":"00000000-0000-0000-0000-000000000001","numero":"REC-PRUEBA","resultado":"ok","documento":{"tipo":"factura","numero":"1"}}'::jsonb);
-- UPDATE bodega_recepciones SET procesado = true, notas_gerencia = 'visto' WHERE numero = 'REC-PRUEBA';
-- -- el reenvío suma una vez y NO pisa lo de Gerencia: veces_recibida 2, procesado true
-- SELECT bodega_registrar_recepcion('{"id":"00000000-0000-0000-0000-000000000001","numero":"REC-PRUEBA","resultado":"con_diferencias"}'::jsonb);
-- SELECT numero, resultado, veces_recibida, procesado, notas_gerencia FROM bodega_recepciones WHERE numero = 'REC-PRUEBA';
-- -- y uno con plata se rechaza:
-- SELECT bodega_registrar_recepcion('{"id":"00000000-0000-0000-0000-000000000002","numero":"X","resultado":"ok","lineas":[{"precio_unitario":10}]}'::jsonb);
-- ROLLBACK;

-- ─────────────────────────────────────────────────────────────────────────────
-- REVERSA
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS bodega_registrar_recepcion(jsonb);
-- DROP TABLE IF EXISTS bodega_recepciones;
-- (el bucket se borra desde el panel, después de vaciarlo)
