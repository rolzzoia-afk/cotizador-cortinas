-- ============================================================================
-- Alta de los motores pequeños DOM47-DOM53
-- Fecha: 2026-09-04
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Llegan siete códigos nuevos de la línea de motores PEQUEÑOS. CONVIVEN con
--   el DOM38 (Tronic Plus) y el DOM41 (Merygate): no reemplazan a ninguno.
--
--     DOM47  MOTOR PEQUEÑO - CON CABLE WIFI [NARANJA-NEGRO]  [N m - 1.1/30]
--     DOM48  MOTOR PEQUEÑO - INALAMBRICO    [NARANJA-NEGRO]  [N m - 1.5/30-W]
--     DOM49  MOTOR PEQUEÑO - CON CABLE WIFI [NARANJA-BLANCO] [N m - 2/30]
--     DOM50  MOTOR PEQUEÑO - INALAMBRICO    [NARANJA-BLANCO] [N m - 2/30-W]
--     DOM51  HUB - USB [REDONDO]                             (PG7000)
--     DOM52  CONTROL REMOTO (15 CANALES) - NEGRO             (PE5115)
--     DOM53  CONTROL REMOTO (15 CANALES) - BLANCO            (PE5115)
--
--   Reglas de producto (decisión del dueño, 2026-09-04), que ya viven en el
--   CÓDIGO (`MOTORES` en insumosCortina.ts) y no en esta data:
--     · el CONTROL lo decide el color del motor: naranja-NEGRO → DOM52,
--       naranja-BLANCO → DOM53;
--     · NINGUNO arrastra cable de carga — los cuatro vienen con el suyo
--       incorporado (el DOM38 sigue pidiendo su DOM34);
--     · el HUB de los cuatro es el DOM51, que como todo hub arrastra su
--       enchufe DOM04.
--
--   Este SQL cubre solo la DATA que vive en Supabase:
--     1. insumos — alta de las 7 filas (stock 0, se ajusta cuando lleguen)
--     2. configuracion.catalogo_productos_data — las 7 filas VENDIBLES de
--        Fase 1, para poder cobrarlas como adicional
--
--   ⚠ PRECIOS DE VENTA: no venían en la planilla. Se siembran con el precio
--   VIGENTE del producto equivalente del mismo catálogo —motor pequeño 170.000
--   (el del DOM 01 y el DOM 38), hub USB 59.999 (el del DOM 03) y control de 15
--   canales 35.000 (el del DOM 39 y el DOM 42)— y quedan listos para corregir
--   en Admin → Catálogo, o con el UPDATE del pie de este archivo. NO son un
--   número inventado, pero tampoco son la lista de precios nueva: revisarlos.
--
-- Reversibilidad:
--   configuracion_backup_20260904_motores retiene el catálogo pre-cambio. Las
--   filas de insumos se borran con el DELETE del pie.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Alta motores pequeños DOM47-DOM53 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Backup defensivo del catálogo (se guarda como un blob JSON entero)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS configuracion_backup_20260904_motores;
CREATE TABLE configuracion_backup_20260904_motores AS
SELECT * FROM configuracion
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave = 'catalogo_productos_data';

DO $$
DECLARE v_cfg integer;
BEGIN
  SELECT COUNT(*) INTO v_cfg FROM configuracion_backup_20260904_motores;
  IF v_cfg <> 1 THEN
    RAISE EXCEPTION 'Backup esperaba 1 fila catalogo_productos_data pero capturó %', v_cfg;
  END IF;
  RAISE NOTICE 'Step 0 — backup del catálogo tomado (1 fila)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) insumos — alta de las 7 filas. Idempotente.
--    stock_total es columna GENERADA (stock_mp + stock_liberado): no se inserta.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO insumos (empresa_id, cod, categoria, sub_categoria, proveedor, producto,
                     compra, nemotecnico, cod_proveedor, descriptor_proveedor,
                     color, status, minimo, stock_mp, stock_liberado,
                     ubicacion, estado_inventario)
VALUES
  ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'DOM47', 'INSUMO', 'MOTOR', 'ROLZZO', 'ROLLER/DUO',
   'IMPORTACION', 'MOTOR PEQUEÑO - CON CABLE WIFI [NARANJA-NEGRO] [N m - 1.1/30]',
   'PD25LEQ1.1/30', 'Electronic Limits, Built-in', 'NEGRO', 'AGOTADO', 0, 0, 0, '2DA AV.', 'ACTIVO'),
  ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'DOM48', 'INSUMO', 'MOTOR', 'ROLZZO', 'ROLLER/DUO',
   'IMPORTACION', 'MOTOR PEQUEÑO - INALAMBRICO [NARANJA-NEGRO] [N m - 1.5/30-W]',
   'PD25TEQ1.5/30-W', 'Electronic Limits, Built-in', 'NEGRO', 'AGOTADO', 0, 0, 0, '2DA AV.', 'ACTIVO'),
  ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'DOM49', 'INSUMO', 'MOTOR', 'ROLZZO', 'ROLLER/DUO',
   'IMPORTACION', 'MOTOR PEQUEÑO - CON CABLE WIFI [NARANJA-BLANCO] [N m - 2/30]',
   'PD28LEQ2/30', 'Electronic Limits, Built-in', 'BLANCO', 'AGOTADO', 0, 0, 0, '2DA AV.', 'ACTIVO'),
  ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'DOM50', 'INSUMO', 'MOTOR', 'ROLZZO', 'ROLLER/DUO',
   'IMPORTACION', 'MOTOR PEQUEÑO - INALAMBRICO [NARANJA-BLANCO] [N m - 2/30-W]',
   'PD28TEQ2/30-W', 'Electronic Limits, Built-in', 'BLANCO', 'AGOTADO', 0, 0, 0, '2DA AV.', 'ACTIVO'),
  ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'DOM51', 'INSUMO', 'MOTOR', 'ROLZZO', 'HUB',
   'IMPORTACION', 'HUB - USB [REDONDO]',
   'PG7000', 'RF control, Wifi function', 'N/A', 'AGOTADO', 0, 0, 0, '2DA AV.', 'ACTIVO'),
  ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'DOM52', 'INSUMO', 'MOTOR', 'ROLZZO', 'CONTROL',
   'IMPORTACION', 'CONTROL REMOTO (15 CANALES) - NEGRO',
   'PE5115', 'Touch screen remote, 15 channels', 'NEGRO', 'AGOTADO', 0, 0, 0, '2DA AV.', 'ACTIVO'),
  ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'DOM53', 'INSUMO', 'MOTOR', 'ROLZZO', 'CONTROL',
   'IMPORTACION', 'CONTROL REMOTO (15 CANALES) - BLANCO',
   'PE5115', 'Touch screen remote, 15 channels', 'BLANCO', 'AGOTADO', 0, 0, 0, '2DA AV.', 'ACTIVO')
ON CONFLICT (empresa_id, cod) DO NOTHING;

DO $$
DECLARE v_ins integer;
BEGIN
  SELECT COUNT(*) INTO v_ins FROM insumos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND cod IN ('DOM47','DOM48','DOM49','DOM50','DOM51','DOM52','DOM53');
  IF v_ins <> 7 THEN
    RAISE EXCEPTION 'Step 1 falló: se esperaban 7 insumos DOM47-DOM53 y hay %', v_ins;
  END IF;
  RAISE NOTICE 'Step 1: 7 insumos DOM47-DOM53 presentes';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) catalogo_productos_data — las 7 filas vendibles de Fase 1. Idempotente:
--    `||` sobre el jsonb PISA la llave si ya existiera, así que se aplica solo
--    a las que faltan para no borrar un precio ya corregido a mano.
--
--    La llave es el COD_INT con espacio ("DOM 47"), como el resto del catálogo:
--    la app normaliza "DOM47" tecleado contra esta forma.
--    `descuento` copia el del equivalente (0,3 los motores, 0,1 hub y control).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v      jsonb;
  nuevos jsonb;
  k      text;
  v_add  integer := 0;
BEGIN
  SELECT valor::jsonb INTO v
  FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'catalogo_productos_data';

  nuevos := jsonb_build_object(
    'DOM 47', jsonb_build_object(
      'cod', 'ACCESORIO', 'tipo', 'ACCESORIO', 'precio', 170000, 'descuento', 0.3,
      'producto', 'MOTOR PEQUEÑO (1 POR ROLLER) - CABLE WIFI NEGRO',
      'descripcion', 'MOTOR PEQUEÑO CON CABLE WIFI [NARANJA-NEGRO] 1.1 Nm', 'categoria', 'A'),
    'DOM 48', jsonb_build_object(
      'cod', 'ACCESORIO', 'tipo', 'ACCESORIO', 'precio', 170000, 'descuento', 0.3,
      'producto', 'MOTOR PEQUEÑO (1 POR ROLLER) - INALAMBRICO NEGRO',
      'descripcion', 'MOTOR PEQUEÑO INALAMBRICO [NARANJA-NEGRO] 1.5 Nm', 'categoria', 'A'),
    'DOM 49', jsonb_build_object(
      'cod', 'ACCESORIO', 'tipo', 'ACCESORIO', 'precio', 170000, 'descuento', 0.3,
      'producto', 'MOTOR PEQUEÑO (1 POR ROLLER) - CABLE WIFI BLANCO',
      'descripcion', 'MOTOR PEQUEÑO CON CABLE WIFI [NARANJA-BLANCO] 2 Nm', 'categoria', 'A'),
    'DOM 50', jsonb_build_object(
      'cod', 'ACCESORIO', 'tipo', 'ACCESORIO', 'precio', 170000, 'descuento', 0.3,
      'producto', 'MOTOR PEQUEÑO (1 POR ROLLER) - INALAMBRICO BLANCO',
      'descripcion', 'MOTOR PEQUEÑO INALAMBRICO [NARANJA-BLANCO] 2 Nm', 'categoria', 'A'),
    'DOM 51', jsonb_build_object(
      'cod', 'ACCESORIO', 'tipo', 'ACCESORIO', 'precio', 59999, 'descuento', 0.1,
      'producto', 'HUB USB REDONDO',
      'descripcion', 'HUB - USB [REDONDO] - CONF DE DOMOTICA', 'categoria', 'A'),
    'DOM 52', jsonb_build_object(
      'cod', 'ACCESORIO', 'tipo', 'ACCESORIO', 'precio', 35000, 'descuento', 0.1,
      'producto', 'CONTROL 15 CANALES (NEGRO)',
      'descripcion', 'CONTROL REMOTO TOUCH 15 CANALES - NEGRO', 'categoria', 'A'),
    'DOM 53', jsonb_build_object(
      'cod', 'ACCESORIO', 'tipo', 'ACCESORIO', 'precio', 35000, 'descuento', 0.1,
      'producto', 'CONTROL 15 CANALES (BLANCO)',
      'descripcion', 'CONTROL REMOTO TOUCH 15 CANALES - BLANCO', 'categoria', 'A')
  );

  FOR k IN SELECT jsonb_object_keys(nuevos) LOOP
    IF v ? k THEN
      RAISE NOTICE 'Step 2: «%» ya estaba en el catálogo — se respeta lo que hay', k;
    ELSE
      v := v || jsonb_build_object(k, nuevos->k);
      v_add := v_add + 1;
    END IF;
  END LOOP;

  UPDATE configuracion
  SET valor = v::text
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'catalogo_productos_data';

  RAISE NOTICE 'Step 2: % código(s) agregado(s) al catálogo de Fase 1', v_add;
END $$;

DO $$
DECLARE v_cat integer;
BEGIN
  SELECT COUNT(*) INTO v_cat
  FROM configuracion c, jsonb_object_keys(c.valor::jsonb) k
  WHERE c.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND c.clave = 'catalogo_productos_data'
    AND k IN ('DOM 47','DOM 48','DOM 49','DOM 50','DOM 51','DOM 52','DOM 53');
  IF v_cat <> 7 THEN
    RAISE EXCEPTION 'Step 2 falló: se esperaban 7 códigos en el catálogo y hay %', v_cat;
  END IF;
  RAISE NOTICE 'Step 2 verificado: los 7 códigos son vendibles en Fase 1';
END $$;

DO $$ BEGIN RAISE NOTICE '=== Alta motores pequeños — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT (correr aparte):
--
-- 1) los 7 insumos
--    SELECT cod, nemotecnico, sub_categoria, producto, status, stock_total
--    FROM insumos
--    WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND cod IN ('DOM47','DOM48','DOM49','DOM50','DOM51','DOM52','DOM53')
--    ORDER BY cod;
--
-- 2) los 7 códigos vendibles, con su precio
--    SELECT e.k AS cod_int, e.v->>'producto' AS producto, e.v->>'precio' AS precio
--    FROM configuracion c, jsonb_each(c.valor::jsonb) AS e(k, v)
--    WHERE c.empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND c.clave='catalogo_productos_data'
--      AND e.k IN ('DOM 47','DOM 48','DOM 49','DOM 50','DOM 51','DOM 52','DOM 53')
--    ORDER BY e.k;
--
-- Corregir un precio de venta (ejemplo con el DOM 47):
--    UPDATE configuracion
--    SET valor = (valor::jsonb || jsonb_build_object(
--          'DOM 47', (valor::jsonb->'DOM 47') || jsonb_build_object('precio', 199000)
--        ))::text
--    WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND clave='catalogo_productos_data';
--    (o, más simple, editarlo en Admin → Catálogo)
--
-- Reversa:
--    UPDATE configuracion c SET valor = b.valor
--    FROM configuracion_backup_20260904_motores b WHERE c.id = b.id;
--    DELETE FROM insumos
--    WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND cod IN ('DOM47','DOM48','DOM49','DOM50','DOM51','DOM52','DOM53');
-- ============================================================================
