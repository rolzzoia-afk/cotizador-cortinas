-- ============================================================================
-- INVENTARIO 03 — El histórico completo detrás del kardex
-- Fecha: 2026-09-08
-- ============================================================================
--
-- TERCERO de la Entrega B. Correr DESPUÉS del 02. Es idempotente y NO toca
-- ningún saldo: solo reemplaza una vista de lectura.
--
-- POR QUÉ:
--   La pantalla del Kardex tiene un interruptor, «Incluir histórico anterior al
--   kardex», que muestra junto a los movimientos nuevos todo lo que se movió
--   antes de que existiera el libro. Hasta ahora la vista solo juntaba tres
--   fuentes de las cinco: faltaban los cortes de tubos y los paños del taller,
--   que son la mitad de la historia de una tela.
--
--   También faltaban columnas. La vista devolvía la cantidad pero no de dónde
--   salió, a dónde fue, ni en cuánto quedó el saldo, así que la tabla no podía
--   mostrar esas filas con el mismo formato que las nuevas.
--
-- QUÉ HACE:
--   Reemplaza `v_kardex_historico` con las CINCO fuentes y las columnas que la
--   pantalla necesita. Las filas que no son del libro se marcan con `editable
--   = false`: se ven en gris y no se corrigen desde acá — el historial de tubos
--   y paños lo escribe el optimizador, que no se toca.
--
-- OJO: `tubos_historial.empresa_id` es TEXT, no uuid. Comparar sin castear
-- revienta la vista entera.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Inventario 03 · histórico del kardex — INICIADO ==='; END $$;

DO $$
BEGIN
  IF to_regclass('public.inventario_movimientos') IS NULL THEN
    RAISE EXCEPTION 'Falta correr antes sql/20260908_inventario_02_kardex.sql';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Las tres vistas leen con el permiso de QUIEN pregunta
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Una vista, por omisión, corre con los permisos de su DUEÑO: se salta el RLS
-- de las tablas que junta. Las tres vistas del kardex quedaron así al crearlas,
-- y eso significa que alguien con sesión podía leer los movimientos de OTRA
-- empresa preguntándole a la vista en vez de a la tabla.
--
-- `security_invoker` las hace leer con el permiso de quien pregunta, así que
-- vuelve a aplicar el RLS por empresa de cada tabla. Las ocho tablas que se
-- juntan acá tienen RLS con su política de lectura, así que nada se pierde.
ALTER VIEW IF EXISTS v_stock_por_almacen        SET (security_invoker = true);
ALTER VIEW IF EXISTS v_inventario_saldos_kardex SET (security_invoker = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) El histórico, con las cinco fuentes
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Se BORRA en vez de reemplazar: la vista nueva tiene otras columnas y
-- `CREATE OR REPLACE VIEW` solo deja agregarlas al final.
DROP VIEW IF EXISTS v_kardex_historico;

CREATE VIEW v_kardex_historico WITH (security_invoker = true) AS

-- 1) El libro. Es lo único que se puede corregir desde la pantalla.
SELECT
  m.id,
  'kardex'::text        AS fuente,
  true                  AS editable,
  m.empresa_id,
  m.fecha,
  m.dominio,
  m.item_cod,
  m.item_nombre,
  m.tipo,
  m.cantidad,
  m.unidad,
  -- Un paño no se mide con un número sino con dos («106×260»). En vez de
  -- forzarlo dentro de `cantidad`, viaja escrito y la pantalla lo muestra tal
  -- cual cuando viene.
  NULL::text            AS cantidad_texto,
  ao.codigo             AS origen,
  ad.codigo             AS destino,
  COALESCE(m.saldo_destino_post, m.saldo_origen_post) AS saldo_post,
  m.ot,
  COALESCE(m.motivo, m.referencia_tipo)               AS referencia,
  COALESCE(m.responsable, m.usuario_email)            AS quien,
  m.notas,
  m.lote_id
FROM inventario_movimientos m
LEFT JOIN almacenes ao ON ao.id = m.almacen_origen_id
LEFT JOIN almacenes ad ON ad.id = m.almacen_destino_id

UNION ALL

-- 2) Los movimientos de insumos de antes del libro.
SELECT
  mi.id, 'movimientos_insumos', false, mi.empresa_id, mi.fecha, 'insumo',
  upper(btrim(mi.codigo)), mi.producto,
  mi.tipo, mi.cantidad::numeric, 'un', NULL::text,
  CASE WHEN normalizar_almacen(mi.almacen) IS NOT NULL
            AND upper(COALESCE(mi.tipo,'')) LIKE 'SALIDA%'
       THEN normalizar_almacen(mi.almacen) END,
  CASE WHEN normalizar_almacen(mi.almacen) IS NOT NULL
            AND upper(COALESCE(mi.tipo,'')) NOT LIKE 'SALIDA%'
       THEN normalizar_almacen(mi.almacen) END,
  NULL::numeric, mi.ot, mi.bitacora, mi.responsable_entrega, mi.bitacora, NULL::uuid
FROM movimientos_insumos mi

UNION ALL

-- 3) Los movimientos de telas de antes del libro.
SELECT
  mt.id, 'movimientos_telas', false, mt.empresa_id, mt.fecha, 'tela',
  upper(btrim(mt.codigo)), NULL,
  mt.tipo, mt.metros, 'm', NULL::text,
  CASE WHEN normalizar_almacen(mt.almacen) IS NOT NULL
            AND upper(COALESCE(mt.tipo,'')) LIKE 'SALIDA%'
       THEN normalizar_almacen(mt.almacen) END,
  CASE WHEN normalizar_almacen(mt.almacen) IS NOT NULL
            AND upper(COALESCE(mt.tipo,'')) NOT LIKE 'SALIDA%'
       THEN normalizar_almacen(mt.almacen) END,
  NULL::numeric, mt.ot, mt.notas, mt.responsable, mt.notas, NULL::uuid
FROM movimientos_telas mt

UNION ALL

-- 4) Las cargas y devoluciones de camioneta de antes del libro.
SELECT
  mc.id, 'movimientos_camioneta', false, mc.empresa_id, mc.created_at, 'insumo',
  upper(btrim(COALESCE(i.cod, ''))), COALESCE(i.nemotecnico, i.descriptor_proveedor),
  upper(mc.tipo), mc.cantidad::numeric, 'un', NULL::text,
  CASE WHEN mc.tipo IN ('carga') THEN 'MP' ELSE a.codigo END,
  CASE WHEN mc.tipo IN ('carga') THEN a.codigo
       WHEN mc.tipo IN ('devolucion') THEN 'MP' END,
  NULL::numeric, NULL, mc.motivo, mc.registrado_por, mc.motivo, NULL::uuid
FROM movimientos_camioneta mc
LEFT JOIN insumos i   ON i.id = mc.insumo_id
LEFT JOIN almacenes a ON a.camioneta_id = mc.camioneta_id

UNION ALL

-- 5) El historial de tubos: los cortes y los sobrantes del optimizador.
--    `empresa_id` es TEXT en esta tabla: el cast es obligatorio.
SELECT
  th.id, 'tubos_historial', false, th.empresa_id::uuid, th.created_at, 'insumo',
  upper(btrim(COALESCE(th.cod, ''))),
  NULLIF(concat_ws(' ', 'Colmena', th.n_colmena), 'Colmena'),
  upper(th.evento),
  COALESCE(th.medida_resultado_cm, th.medida_cm), 'cm', NULL::text,
  NULLIF(th.n_colmena, ''), NULL,
  NULL::numeric, th.ot, th.notas, th.registrado_por, th.notas, NULL::uuid
FROM tubos_historial th
WHERE th.evento IN ('corte', 'sobrante', 'merma')
  -- Un uuid mal escrito en una columna de texto tumbaría la vista entera.
  AND th.empresa_id ~ '^[0-9a-fA-F-]{36}$'

UNION ALL

-- 6) Los paños que el taller cortó y guardó en la colmena.
--    Un paño no tiene «cantidad»: tiene dos medidas. Van escritas.
SELECT
  cp.id, 'colmena_panos', false, cp.empresa_id, cp.created_at, 'tela',
  upper(btrim(COALESCE(cp.codigo, ''))), 'Paño sobrante',
  'SOBRANTE', NULL::numeric, NULL::text,
  concat_ws('×', round(cp.medida_ancho)::text, round(cp.medida_alto)::text),
  'Corte', NULLIF(cp.ubicacion, ''),
  NULL::numeric, cp.ot_asignada, cp.tipo,
  'Dimensionado', NULL::text, NULL::uuid
FROM colmena_panos cp;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_total bigint; v_fuentes int;
BEGIN
  SELECT count(*), count(DISTINCT fuente) INTO v_total, v_fuentes FROM v_kardex_historico;
  IF v_fuentes < 4 THEN
    RAISE EXCEPTION 'La vista quedó con % fuentes: se esperaban al menos 4', v_fuentes;
  END IF;
  RAISE NOTICE 'OK · % filas en el histórico, de % fuentes', v_total, v_fuentes;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Inventario 03 · histórico del kardex — COMPLETADO ==='; END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Smoke tests
--
-- 1) Cuántas filas aporta cada fuente:
--    SELECT fuente, count(*) FROM v_kardex_historico GROUP BY 1 ORDER BY 2 DESC;
--
-- 2) Solo el libro (lo que se puede corregir):
--    SELECT count(*) FROM v_kardex_historico WHERE editable;
--
-- 3) Los saldos siguen cuadrando (esta vista no toca nada):
--    SELECT count(*) FROM v_inventario_saldos_kardex;            -- 0
-- ============================================================================
-- REVERSA
--
--   Volver a la vista de tres fuentes que dejó el script 02: correr de nuevo
--   la sección 8 de `sql/20260908_inventario_02_kardex.sql` precedida de
--   `DROP VIEW IF EXISTS v_kardex_historico;`.
--   Ningún saldo se toca en ninguno de los dos sentidos.
-- ============================================================================
