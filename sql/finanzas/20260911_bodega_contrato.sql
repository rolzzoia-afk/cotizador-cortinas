-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRATO BODEGA ↔ FINANZAS — 2026-09-11
--
-- ⚠️  ESTE ARCHIVO SE CORRE EN EL PROYECTO SUPABASE DE **ROLZZO-FINANZAS**,
--     NO en rolzzo-produccion. Es el único archivo del repo que no va allá.
--
-- Qué es: dos vistas. Nada más. Es todo lo que el sistema de bodega necesita de
-- Finanzas, y todo lo que Finanzas le muestra.
--
--   v_bodega_ordenes        las órdenes aprobadas, para que bodega sepa qué espera
--   v_bodega_orden_lineas   qué trae cada orden
--
-- POR QUÉ VISTAS Y NO ACCESO A LAS TABLAS: así Finanzas puede cambiar sus
-- tablas cuando quiera sin romper la bodega, y la bodega no ve nada que no esté
-- acá. El día que una columna cambie de nombre, se arregla la vista y listo.
--
-- SIN PRECIOS. `rolzzo_ordenes_compra` tiene monto_neto, monto_iva y
-- monto_total, y cada línea tiene precio_unitario y subtotal. Nada de eso se
-- nombra acá, y no es un descuido: del otro lado estas órdenes las mira el
-- taller completo. La comprobación del final ABORTA si alguna columna de la
-- vista se llama precio, monto, total, neto, iva, costo, valor o descuento.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE NO EXISTE EN FINANZAS, Y CÓMO SE RESUELVE
--
-- · UNIDAD de la línea. No hay columna. Sale NULL y del otro lado lo resuelve
--   el `factor` de cada línea (unidades nuestras por unidad de la orden).
-- · POSICIÓN de la línea. Tampoco se guarda. Se numera acá por código y
--   descripción: queda estable mientras las líneas de la orden no cambien.
-- · FECHA ESPERADA de entrega. No se registra. La bodega muestra «—» y cuenta
--   los días desde la aprobación.
-- · REFERENCIA A LA SOLICITUD de bodega. No hay columna propia, así que se lee
--   del campo `notas`: Gerencia escribe «SOL-0007» ahí al crear la orden y esta
--   vista lo extrae. Si no lo escribe, la orden llega igual, solo que la bodega
--   no la relaciona con su pedido.
--
-- LA VUELTA DE LAS SOLICITUDES no está en este archivo. El módulo «Solicitudes»
-- de Finanzas (`rolzzo_solicitudes` + `rolzzo_tarjetas_solicitud`) es de
-- personal y nómina: no tiene productos ni cantidades, así que no sirve de
-- bandeja para los pedidos de bodega. Mientras no exista una pantalla para eso
-- en Finanzas, la solicitud vive en el sistema de bodega y Gerencia la abre
-- ahí; lo único que viaja de vuelta es el «SOL-0007» escrito en `notas`.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) v_bodega_ordenes — una fila por orden que alguna vez fue aprobada
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Solo las APROBADAS (`aprobado_en IS NOT NULL`): una orden en borrador o
-- esperando visto bueno todavía no es algo que la bodega deba esperar. Con los
-- datos de hoy eso deja fuera diez órdenes anuladas que nunca se aprobaron.
--
-- Las ANULADAS que SÍ se aprobaron entran, marcadas: si se fueran de la lista,
-- una orden de la que ya llegó algo desaparecería de la pantalla sin
-- explicación, con la mercadería en el mesón.
CREATE OR REPLACE VIEW v_bodega_ordenes AS
SELECT
  o.id::text                                      AS id,
  -- En Finanzas el número es un entero (1016) y en el papel sale «OC-1016».
  ('OC-' || o.numero::text)                       AS numero,
  -- El estado tal como Finanzas lo escribe; la bodega lo muestra sin traducir y
  -- lleva el suyo aparte (en espera → recibida parcial → recibida → cerrada).
  o.estado::text                                  AS estado,
  (o.estado ILIKE '%anulad%')                     AS anulada,
  o.aprobado_en::timestamptz                      AS aprobada_en,
  o.aprobado_por::text                            AS aprobada_por,
  o.fecha::date                                   AS fecha_emision,
  NULL::date                                      AS fecha_esperada,
  -- El RUT es LA LLAVE entre los dos sistemas: el nombre lo escribe cada uno a
  -- su manera («SINFLEX» acá, «SYNFLEX» allá).
  p.rut::text                                     AS proveedor_rut,
  p.razon_social::text                            AS proveedor_razon_social,
  p.nombre_fantasia::text                         AS proveedor_nombre,
  o.solicitado_por::text                          AS solicitado_por,
  -- «SOL-0007» escrito a mano en las notas. Se busca en mayúsculas para que dé
  -- lo mismo cómo lo tipeen.
  nullif(substring(upper(coalesce(o.notas, '')) from 'SOL-[0-9]+'), '')
                                                  AS solicitud_ref,
  -- La guía de despacho es lo que el bodeguero tiene impreso en la mano cuando
  -- llega el camión: es la mejor forma de encontrar la orden.
  o.guia_despacho::text                           AS guia,
  -- Si Finanzas ya cargó la factura de esta orden, su folio también sirve para
  -- encontrarla. Solo el folio y el tipo; el documento tiene montos que no
  -- salen de allá.
  doc.folio::text                                 AS factura_folio,
  doc.tipo_documento::text                        AS factura_tipo,
  o.notas::text                                   AS comentarios,
  -- No hay `updated_at` en Finanzas, así que no se puede copiar «solo lo que
  -- cambió»: la bodega trae la lista completa de aprobadas cada vez. Con este
  -- volumen sobra.
  greatest(o.created_at, coalesce(o.aprobado_en, o.created_at))::timestamptz
                                                  AS actualizada_en
FROM rolzzo_ordenes_compra o
LEFT JOIN rolzzo_contactos  p   ON p.id   = o.contacto_id
LEFT JOIN rolzzo_documentos doc ON doc.id = o.documento_id
WHERE o.aprobado_en IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) v_bodega_orden_lineas — qué trae cada orden
-- ─────────────────────────────────────────────────────────────────────────────
--
-- El PDF trae por línea CÓD. PROVEEDOR · CÓD. INTERNO · NEMOTÉCNICO · CANTIDAD.
-- El CÓDIGO INTERNO es el nuestro, y es lo que permite que casi toda línea se
-- vincule sola con el artículo del inventario. Sin él, alguien tendría que
-- emparejar cada línea a mano, en el mesón, con el camión esperando.
--
-- Se copia TAL CUAL, con espacios y todo («DU 30», «SC 54»): del otro lado se
-- normaliza, y también se normaliza nuestro catálogo, que guarda esos mismos
-- códigos con espacio. No hay que arreglarlo acá.
CREATE OR REPLACE VIEW v_bodega_orden_lineas AS
SELECT
  d.id::text                                      AS id,
  d.orden_compra_id::text                         AS orden_id,
  -- Finanzas no guarda el orden de las líneas. Se numera por código y
  -- descripción para que la bodega las vea siempre igual entre una
  -- sincronización y otra.
  row_number() OVER (
    PARTITION BY d.orden_compra_id
    ORDER BY coalesce(nullif(btrim(d.codigo_interno), ''), 'ZZZZ'),
             coalesce(nullif(btrim(d.nemotecnico), ''), d.descripcion, ''),
             d.id
  )::int                                          AS posicion,
  d.codigo_interno::text                          AS codigo_interno,
  d.codigo_prov::text                             AS codigo_proveedor,
  -- El nemotécnico es lo que sale en el papel; la descripción es el respaldo
  -- para las líneas viejas que no lo tienen.
  coalesce(nullif(btrim(d.nemotecnico), ''), d.descripcion)::text
                                                  AS descripcion,
  d.cantidad::numeric                             AS cantidad,
  NULL::text                                      AS unidad,
  coalesce(o.aprobado_en, o.created_at)::timestamptz AS actualizada_en
FROM rolzzo_orden_compra_items d
JOIN rolzzo_ordenes_compra o ON o.id = d.orden_compra_id
WHERE o.aprobado_en IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Permisos — cerrados a propósito
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Supabase le da permiso a `anon` y `authenticated` sobre toda tabla o vista
-- nueva del esquema `public`. Si se dejara así, cualquiera con la llave pública
-- de Finanzas podría leer qué se le compra a quién. Se revoca explícitamente.
--
-- La bodega entra con una llave de servicio guardada como secreto de su función
-- Edge, así que solo `service_role` necesita leer. Un rol propio de solo
-- lectura sería mejor todavía, y queda como mejora.
REVOKE ALL ON v_bodega_ordenes, v_bodega_orden_lineas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v_bodega_ordenes, v_bodega_orden_lineas TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Comprobación del contrato — ABORTA si algo no calza
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Corre acá, en Finanzas, para que el error se vea al correr el archivo y no
-- tres días después, cuando la bodega no entienda por qué no le llegan las
-- órdenes.
DO $$
DECLARE
  v_esperado text[];
  v_real     text[];
  v_falta    text[];
  v_plata    text;
  v_ordenes  int;
  v_lineas   int;
BEGIN
  -- Las columnas del contrato, una por una.
  v_esperado := ARRAY['id','numero','estado','anulada','aprobada_en','aprobada_por',
                      'fecha_emision','fecha_esperada','proveedor_rut','proveedor_razon_social',
                      'proveedor_nombre','solicitado_por','solicitud_ref','guia',
                      'factura_folio','factura_tipo','comentarios','actualizada_en'];
  SELECT array_agg(column_name::text) INTO v_real FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'v_bodega_ordenes';
  SELECT array_agg(x) INTO v_falta FROM unnest(v_esperado) x
   WHERE NOT (x = ANY (coalesce(v_real, '{}')));
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'v_bodega_ordenes: faltan columnas %', array_to_string(v_falta, ', ');
  END IF;

  v_esperado := ARRAY['id','orden_id','posicion','codigo_interno','codigo_proveedor',
                      'descripcion','cantidad','unidad','actualizada_en'];
  SELECT array_agg(column_name::text) INTO v_real FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'v_bodega_orden_lineas';
  SELECT array_agg(x) INTO v_falta FROM unnest(v_esperado) x
   WHERE NOT (x = ANY (coalesce(v_real, '{}')));
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'v_bodega_orden_lineas: faltan columnas %', array_to_string(v_falta, ', ');
  END IF;

  -- Ninguna columna de plata, en ninguna de las dos.
  SELECT string_agg(table_name || '.' || column_name, ', ') INTO v_plata
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name IN ('v_bodega_ordenes','v_bodega_orden_lineas')
     AND column_name ~* '(precio|monto|total|neto|iva|costo|valor|descuento)';
  IF v_plata IS NOT NULL THEN
    RAISE EXCEPTION 'El contrato NO puede exponer plata, y expone: %', v_plata;
  END IF;

  -- Y nadie más que el servicio puede leerlas.
  IF has_table_privilege('anon', 'v_bodega_ordenes', 'SELECT')
     OR has_table_privilege('authenticated', 'v_bodega_ordenes', 'SELECT')
     OR has_table_privilege('anon', 'v_bodega_orden_lineas', 'SELECT')
     OR has_table_privilege('authenticated', 'v_bodega_orden_lineas', 'SELECT') THEN
    RAISE EXCEPTION 'Las vistas quedaron legibles con la llave pública. Revisar los REVOKE.';
  END IF;

  SELECT count(*) INTO v_ordenes FROM v_bodega_ordenes;
  SELECT count(*) INTO v_lineas  FROM v_bodega_orden_lineas;
  IF v_ordenes = 0 THEN
    RAISE EXCEPTION 'El contrato quedó sin órdenes: ninguna tiene aprobado_en. Revisar el filtro.';
  END IF;

  RAISE NOTICE 'Contrato de bodega en su lugar: % órdenes aprobadas, % líneas, sin plata y cerrado a la llave pública.',
    v_ordenes, v_lineas;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Prueba de humo (correr después, en Finanzas)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT numero, estado, anulada, proveedor_razon_social, guia, aprobada_en
--   FROM v_bodega_ordenes ORDER BY aprobada_en DESC;
--
-- SELECT o.numero, l.posicion, l.codigo_interno, l.codigo_proveedor,
--        l.descripcion, l.cantidad
--   FROM v_bodega_orden_lineas l
--   JOIN v_bodega_ordenes o ON o.id = l.orden_id
--  ORDER BY o.numero DESC, l.posicion;
--
-- Esperado con los datos del 2026-09-10: SIETE órdenes aprobadas — las cinco en
-- estado «pendiente» (OC-1013 … OC-1017, que son las que la bodega espera) y
-- dos anuladas que alcanzaron a aprobarse. Las otras diez anuladas nunca se
-- aprobaron y no salen.
--
-- La OC con la línea «DC.151.20.0005 · DU 30 · LUXOR DUO TABACO 3.0 MTS · 50»
-- tiene que aparecer: ese «DU 30» es la tela DU 30 de nuestro catálogo y se
-- vincula sola.

-- ─────────────────────────────────────────────────────────────────────────────
-- REVERSA
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP VIEW IF EXISTS v_bodega_orden_lineas;
-- DROP VIEW IF EXISTS v_bodega_ordenes;
