-- ============================================================================
-- INVENTARIO 02 — El kardex: un solo libro de movimientos, escrito por la base
-- Fecha: 2026-09-08
-- ============================================================================
--
-- SEGUNDO de los dos scripts de la Entrega B. Correr DESPUÉS del 01
-- (`20260908_inventario_01_catalogos.sql`); si el 01 no corrió, este aborta al
-- principio. Es idempotente.
--
-- POR QUÉ:
--   Hoy el stock se mueve desde el NAVEGADOR con dos escrituras sueltas: una
--   fila en `movimientos_insumos` y un UPDATE del saldo. Entre las dos no hay
--   nada que las una. Si dos personas despachan a la vez, la segunda pisa a la
--   primera y el saldo queda mal sin que nadie se entere. Y hay caminos que ni
--   siquiera dejan movimiento: cargar una camioneta escribe en una columna
--   CALCULADA (`insumos.stock_total`) y la base descarta la escritura en
--   silencio — por eso la camioneta figura con cero líneas aunque se use.
--
--   Este script pone la cuenta del lado de la base: UNA función hace las dos
--   escrituras juntas, con el artículo bloqueado, y deja el movimiento
--   registrado. Si la función falla, no pasa nada de lo dos.
--
-- QUÉ HACE:
--   1. `inventario_movimientos` — el libro. Insumos y telas en la misma tabla,
--      con origen, destino y el saldo que quedó después de cada movimiento.
--   2. `inventario_escrituras_directas_log` — quién sigue escribiendo el stock
--      por fuera. Primero se mira; recién cuando esté vacío se bloquea.
--   3. `inventario_registrar(...)` — la función que escribe. Valida, bloquea el
--      artículo, mueve el saldo y anota. Es la única puerta.
--   4. `inventario_ajuste_sql(...)` — la misma puerta para los scripts, que hoy
--      cambian saldos sin dejar rastro.
--   5. El guard: avisa (o bloquea, según el interruptor) cuando alguien escribe
--      el stock sin pasar por la función.
--   6. La APERTURA: un ingreso por cada saldo que ya existe, para que el libro
--      cuadre con la realidad desde el primer día.
--   7. Tres vistas, y una de ellas es la prueba de que todo esto funciona:
--      `v_inventario_saldos_kardex` tiene que devolver CERO diferencias.
--
-- IMPORTANTE: al terminar, la app sigue funcionando exactamente igual. Nada usa
-- la función todavía: se enciende desde Inventario → Configuración, con el
-- interruptor «Registrar los movimientos en la base», y se puede apagar en el
-- acto.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Inventario 02 · kardex — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) El 01 tiene que estar corrido
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.almacenes') IS NULL OR to_regclass('public.unidades') IS NULL THEN
    RAISE EXCEPTION 'Falta correr antes sql/20260908_inventario_01_catalogos.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'normalizar_almacen') THEN
    RAISE EXCEPTION 'Falta normalizar_almacen(): correr antes el script 01';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) inventario_movimientos — el libro
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Una fila por movimiento. `cantidad` siempre POSITIVA: la dirección la dan el
-- origen y el destino, no el signo — un número negativo suelto no dice si fue
-- una salida o una corrección.
--
-- `saldo_origen_post` / `saldo_destino_post` guardan en cuánto quedó cada
-- almacén DESPUÉS del movimiento. Es lo que hoy no existe y por eso no se puede
-- reconstruir la historia de un artículo.
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL,
  fecha              timestamptz NOT NULL DEFAULT now(),

  dominio            text NOT NULL CHECK (dominio IN ('insumo','tela')),
  item_cod           text NOT NULL,
  item_nombre        text,

  tipo               text NOT NULL CHECK (tipo IN
                       ('INGRESO','SALIDA','TRASLADO','DEVOLUCION','AJUSTE','MERMA','CONTEO')),
  cantidad           numeric(12,3) NOT NULL CHECK (cantidad > 0),
  unidad             text REFERENCES unidades(codigo),

  almacen_origen_id  uuid REFERENCES almacenes(id),
  almacen_destino_id uuid REFERENCES almacenes(id),
  saldo_origen_post  numeric(12,3),
  saldo_destino_post numeric(12,3),

  motivo             text,
  referencia_tipo    text CHECK (referencia_tipo IN
                       ('ot','plan_corte','recepcion','orden_compra','conteo',
                        'camioneta','migracion','apertura','manual')),
  referencia_id      text,
  ot                 text,
  area               text,

  usuario_id         uuid,
  usuario_email      text,
  responsable        text,
  recibe             text,
  notas              text,

  -- Todas las filas que salieron del mismo gesto comparten lote: un despacho
  -- de 9 materiales son 9 filas y un solo `lote_id`.
  lote_id            uuid,

  -- De dónde vino, si se copió de las tablas viejas.
  legacy_tabla       text,
  legacy_id          uuid,

  creado_en          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inv_mov_tiene_almacen
    CHECK (almacen_origen_id IS NOT NULL OR almacen_destino_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_empresa_fecha
  ON inventario_movimientos(empresa_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_item
  ON inventario_movimientos(empresa_id, dominio, item_cod, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_lote
  ON inventario_movimientos(lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_mov_referencia
  ON inventario_movimientos(referencia_tipo, referencia_id);

-- Copiar dos veces la misma fila vieja no puede duplicar el movimiento.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_mov_legacy
  ON inventario_movimientos(legacy_tabla, legacy_id)
  WHERE legacy_id IS NOT NULL;

ALTER TABLE inventario_movimientos ENABLE ROW LEVEL SECURITY;

-- Se LEE con RLS por empresa. NO hay policy de escritura a propósito: la única
-- forma de escribir el libro es la función, que corre como dueña de la base.
-- Un libro contable que cualquiera puede editar a mano no sirve de nada.
DROP POLICY IF EXISTS inv_mov_select_empresa ON inventario_movimientos;
CREATE POLICY inv_mov_select_empresa ON inventario_movimientos FOR SELECT
  USING (empresa_id = (SELECT get_my_empresa_id()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) El registro de quién escribe el stock por fuera
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventario_escrituras_directas_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid,
  tabla         text NOT NULL,
  fila_id       uuid,
  columna       text NOT NULL,
  antes         numeric(12,3),
  despues       numeric(12,3),
  usuario_email text,
  fecha         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_escrituras_fecha
  ON inventario_escrituras_directas_log(fecha DESC);

ALTER TABLE inventario_escrituras_directas_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inv_escrituras_select_admin ON inventario_escrituras_directas_log;
CREATE POLICY inv_escrituras_select_admin ON inventario_escrituras_directas_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','superadmin')));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Los interruptores, leídos desde la base
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Los guarda la app en `configuracion`, clave 'inventario_flags', como un JSON.
-- Cualquier cosa que no sea exactamente `true` es «apagado»: un JSON a medio
-- escribir no puede encender algo que cambia cómo se mueve el stock.
CREATE OR REPLACE FUNCTION inventario_flag(p_empresa_id uuid, p_flag text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    (SELECT (valor::jsonb ->> p_flag) = 'true'
       FROM configuracion
      WHERE empresa_id = p_empresa_id AND clave = 'inventario_flags'
      LIMIT 1),
    false
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) inventario_registrar — la única puerta para mover stock
-- ─────────────────────────────────────────────────────────────────────────────
--
-- p_lineas: [{ dominio, item_cod, tipo, cantidad, origen?, destino?, motivo?,
--              referencia_tipo?, referencia_id?, ot?, area?, responsable?,
--              recibe?, notas? }]
--   `origen` y `destino` son CÓDIGOS de almacén ('MP', 'LIB', 'CAM-1', 'MERMA').
--
-- p_opciones: { lote_id?, forzar_negativo?, liberado_primero? }
--
-- Devuelve: { lote_id, movimientos: [...] }
--
-- Errores (todos con SQLSTATE propio, para que la app diga algo útil):
--   IN001 no hay sesión          IN005 cantidad inválida
--   IN002 no existe el artículo  IN006 almacén desconocido o incoherente
--   IN003 no alcanza el stock    IN007 tu rol no puede hacer ese movimiento
--   IN004 hay un conteo abierto
CREATE OR REPLACE FUNCTION inventario_registrar(
  p_lineas   jsonb,
  p_opciones jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id     uuid;
  v_email       text;
  v_empresa     uuid;
  v_rol         text;
  v_lote        uuid;
  v_forzar      boolean;
  v_lib_primero boolean;
  v_dual        boolean;

  v_linea       jsonb;
  v_dominio     text;
  v_cod         text;
  v_tipo        text;
  v_cant        numeric(12,3);
  v_origen      text;
  v_destino     text;

  v_item_id     uuid;
  v_item_nombre text;
  v_unidad      text;
  v_mp          numeric(12,3);
  v_lib         numeric(12,3);

  v_org_id      uuid;
  v_dst_id      uuid;
  v_saldo_org   numeric(12,3);
  v_saldo_dst   numeric(12,3);

  v_desde_lib   numeric(12,3);
  v_desde_mp    numeric(12,3);
  v_cam_org     numeric(12,3);
  v_cam_dst     numeric(12,3);
  v_mov_id      uuid;
  v_salida      jsonb := '[]'::jsonb;
BEGIN
  -- ── Sesión y rol: NUNCA se confía en lo que manda el navegador ────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = 'IN001';
  END IF;
  v_email := (auth.jwt() ->> 'email');

  SELECT empresa_id, rol INTO v_empresa, v_rol FROM perfiles WHERE id = v_user_id;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Tu usuario no tiene empresa asignada' USING ERRCODE = 'IN001';
  END IF;

  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'No hay ninguna línea que registrar' USING ERRCODE = 'IN005';
  END IF;

  v_lote        := COALESCE((p_opciones ->> 'lote_id')::uuid, gen_random_uuid());
  v_forzar      := COALESCE((p_opciones ->> 'forzar_negativo')::boolean, false);
  v_lib_primero := COALESCE((p_opciones ->> 'liberado_primero')::boolean, true);
  v_dual        := inventario_flag(v_empresa, 'dualWrite');

  -- Forzar un saldo en negativo es decisión de quien administra.
  IF v_forzar AND v_rol NOT IN ('admin','superadmin') THEN
    RAISE EXCEPTION 'Solo un administrador puede dejar el stock en negativo'
      USING ERRCODE = 'IN007';
  END IF;

  -- Marca para el guard: lo que viene ahora SÍ pasó por acá.
  PERFORM set_config('app.inventario_via_rpc', 'on', true);

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_dominio := lower(COALESCE(v_linea ->> 'dominio', 'insumo'));
    v_cod     := btrim(COALESCE(v_linea ->> 'item_cod', ''));
    v_tipo    := upper(COALESCE(v_linea ->> 'tipo', ''));
    v_cant    := COALESCE((v_linea ->> 'cantidad')::numeric, 0);
    v_origen  := normalizar_almacen(v_linea ->> 'origen');
    v_destino := normalizar_almacen(v_linea ->> 'destino');

    IF v_dominio NOT IN ('insumo','tela') THEN
      RAISE EXCEPTION 'Dominio desconocido: %', v_dominio USING ERRCODE = 'IN005';
    END IF;
    IF v_tipo NOT IN ('INGRESO','SALIDA','TRASLADO','DEVOLUCION','AJUSTE','MERMA','CONTEO') THEN
      RAISE EXCEPTION 'Tipo de movimiento desconocido: %', v_tipo USING ERRCODE = 'IN005';
    END IF;
    IF v_cant <= 0 THEN
      RAISE EXCEPTION 'La cantidad tiene que ser mayor que 0 (llegó %)', v_cant
        USING ERRCODE = 'IN005';
    END IF;

    -- Ventas solo puede descontar tela vendida en terreno. Nada más.
    IF v_rol = 'ventas' AND NOT (v_dominio = 'tela' AND v_tipo = 'SALIDA') THEN
      RAISE EXCEPTION 'Tu rol solo puede descontar metros de tela'
        USING ERRCODE = 'IN007';
    END IF;

    -- ── El artículo, BLOQUEADO hasta el final de la transacción ─────────────
    IF v_dominio = 'insumo' THEN
      SELECT id, COALESCE(nemotecnico, descriptor_proveedor, cod), COALESCE(unidad,'un'),
             COALESCE(stock_mp,0), COALESCE(stock_liberado,0)
        INTO v_item_id, v_item_nombre, v_unidad, v_mp, v_lib
        FROM insumos
       WHERE empresa_id = v_empresa AND upper(btrim(cod)) = upper(v_cod)
       FOR UPDATE;
    ELSE
      SELECT id, COALESCE(nemotecnico, descriptor, codigo), 'm',
             COALESCE(stock_mp,0), COALESCE(stock_liberado,0)
        INTO v_item_id, v_item_nombre, v_unidad, v_mp, v_lib
        FROM telas_catalogo
       WHERE empresa_id = v_empresa AND upper(btrim(codigo)) = upper(v_cod)
       FOR UPDATE;
    END IF;

    IF v_item_id IS NULL THEN
      RAISE EXCEPTION 'No existe el artículo % (%)', v_cod, v_dominio
        USING ERRCODE = 'IN002',
              HINT = 'Revisá que el código esté escrito igual que en el catálogo';
    END IF;

    -- El stock de los insumos se guarda en columnas ENTERAS: aceptar 2,5 lo
    -- redondearía en silencio y el libro dejaría de cuadrar con la bodega.
    IF v_dominio = 'insumo' AND v_cant <> round(v_cant) THEN
      RAISE EXCEPTION 'Los insumos se cuentan en números enteros: % no se puede guardar', v_cant
        USING ERRCODE = 'IN005',
              HINT = 'La tela sí admite decimales; los insumos, no.';
    END IF;

    -- ── Origen y destino por tipo ──────────────────────────────────────────
    IF v_tipo IN ('INGRESO','DEVOLUCION') AND v_destino IS NULL THEN
      v_destino := 'MP';
    END IF;
    IF v_tipo = 'MERMA' THEN
      v_destino := 'MERMA';
      IF v_origen IS NULL THEN v_origen := 'MP'; END IF;
    END IF;
    IF v_tipo = 'TRASLADO' AND (v_origen IS NULL OR v_destino IS NULL) THEN
      RAISE EXCEPTION 'Un traslado necesita de dónde sale y a dónde va'
        USING ERRCODE = 'IN006';
    END IF;
    IF v_tipo = 'SALIDA' AND v_destino IS NOT NULL THEN
      RAISE EXCEPTION 'Una salida no tiene almacén de destino: si va a otro almacén es un traslado'
        USING ERRCODE = 'IN006';
    END IF;

    SELECT id INTO v_org_id FROM almacenes
     WHERE empresa_id = v_empresa AND codigo = v_origen AND v_origen IS NOT NULL;
    SELECT id INTO v_dst_id FROM almacenes
     WHERE empresa_id = v_empresa AND codigo = v_destino AND v_destino IS NOT NULL;

    IF v_origen IS NOT NULL AND v_org_id IS NULL THEN
      RAISE EXCEPTION 'No conozco el almacén de origen "%"', v_linea ->> 'origen'
        USING ERRCODE = 'IN006';
    END IF;
    IF v_destino IS NOT NULL AND v_dst_id IS NULL THEN
      RAISE EXCEPTION 'No conozco el almacén de destino "%"', v_linea ->> 'destino'
        USING ERRCODE = 'IN006';
    END IF;
    IF v_org_id IS NULL AND v_dst_id IS NULL THEN
      RAISE EXCEPTION 'El movimiento no dice de dónde sale ni a dónde va'
        USING ERRCODE = 'IN006';
    END IF;

    -- ── «Liberado primero»: una salida sin origen se parte en dos ──────────
    --
    -- El taller saca de Liberado y, cuando se acaba, de Materias primas. Antes
    -- eso lo decidía la persona y quedaba escrito a mano.
    v_desde_lib := 0;
    v_desde_mp  := 0;
    IF v_tipo = 'SALIDA' AND v_origen IS NULL AND v_lib_primero THEN
      v_desde_lib := LEAST(v_cant, GREATEST(v_lib, 0));
      v_desde_mp  := v_cant - v_desde_lib;
    ELSIF v_tipo IN ('SALIDA','MERMA','TRASLADO') THEN
      -- OJO: solo las bodegas descuentan de las columnas del artículo. Lo que
      -- sale de una CAMIONETA no sale de la bodega: ya había salido cuando se
      -- cargó. Restarlo otra vez descuadraría el saldo.
      IF    v_origen = 'LIB' THEN v_desde_lib := v_cant;
      ELSIF v_origen = 'MP'  THEN v_desde_mp  := v_cant;
      END IF;
    END IF;

    -- ── ¿Alcanza? ──────────────────────────────────────────────────────────
    IF NOT v_forzar AND (v_desde_lib > 0 OR v_desde_mp > 0) THEN
      IF v_desde_lib > v_lib OR v_desde_mp > v_mp THEN
        RAISE EXCEPTION 'No alcanza el stock de %: hay % en materias primas y % en liberado, y se piden %',
          v_cod, v_mp, v_lib, v_cant
          USING ERRCODE = 'IN003',
                HINT = 'Sacá solo lo que hay, registrá primero el ingreso que falta, o contá el artículo';
      END IF;
    END IF;

    -- Lo mismo para la camioneta: no se puede devolver lo que no lleva.
    IF NOT v_forzar AND v_origen LIKE 'CAM-%' THEN
      IF COALESCE((
        SELECT ic.cantidad FROM inventario_camioneta ic
          JOIN almacenes a ON a.id = v_org_id
         WHERE ic.camioneta_id = a.camioneta_id AND ic.insumo_id = v_item_id
      ), 0) < v_cant THEN
        RAISE EXCEPTION 'La % no lleva % de %', v_origen, v_cant, v_cod
          USING ERRCODE = 'IN003';
      END IF;
    END IF;

    -- ── Mover el saldo ─────────────────────────────────────────────────────
    IF v_dominio = 'insumo' THEN
      UPDATE insumos
         SET stock_mp = COALESCE(stock_mp,0)
                        - v_desde_mp::int
                        + (CASE WHEN v_destino = 'MP' THEN v_cant::int ELSE 0 END),
             stock_liberado = COALESCE(stock_liberado,0)
                        - v_desde_lib::int
                        + (CASE WHEN v_destino = 'LIB' THEN v_cant::int ELSE 0 END)
       WHERE id = v_item_id
       RETURNING COALESCE(stock_mp,0), COALESCE(stock_liberado,0) INTO v_mp, v_lib;
    ELSE
      UPDATE telas_catalogo
         SET stock_mp = COALESCE(stock_mp,0)
                        - v_desde_mp
                        + (CASE WHEN v_destino = 'MP' THEN v_cant ELSE 0 END),
             stock_liberado = COALESCE(stock_liberado,0)
                        - v_desde_lib
                        + (CASE WHEN v_destino = 'LIB' THEN v_cant ELSE 0 END)
       WHERE id = v_item_id
       RETURNING COALESCE(stock_mp,0), COALESCE(stock_liberado,0) INTO v_mp, v_lib;
    END IF;

    -- Las camionetas y la merma no viven en las columnas del artículo: la
    -- camioneta tiene su propia tabla y la merma no tiene saldo, es un destino.
    v_cam_dst := NULL;
    v_cam_org := NULL;

    IF v_destino LIKE 'CAM-%' THEN
      INSERT INTO inventario_camioneta (empresa_id, camioneta_id, insumo_id, cantidad)
      SELECT v_empresa, a.camioneta_id, v_item_id, v_cant::int
        FROM almacenes a WHERE a.id = v_dst_id
      ON CONFLICT (camioneta_id, insumo_id)
      DO UPDATE SET cantidad = inventario_camioneta.cantidad + EXCLUDED.cantidad
      RETURNING cantidad INTO v_cam_dst;
    END IF;
    IF v_origen LIKE 'CAM-%' THEN
      UPDATE inventario_camioneta ic
         SET cantidad = GREATEST(0, ic.cantidad - v_cant::int)
        FROM almacenes a
       WHERE a.id = v_org_id AND ic.camioneta_id = a.camioneta_id AND ic.insumo_id = v_item_id
      RETURNING ic.cantidad INTO v_cam_org;
    END IF;

    v_saldo_org := CASE WHEN v_origen  = 'LIB' THEN v_lib
                        WHEN v_origen  = 'MP'  THEN v_mp
                        WHEN v_origen LIKE 'CAM-%' THEN v_cam_org
                        WHEN v_origen IS NULL AND v_tipo = 'SALIDA' THEN v_mp + v_lib
                        ELSE NULL END;
    v_saldo_dst := CASE WHEN v_destino = 'LIB' THEN v_lib
                        WHEN v_destino = 'MP'  THEN v_mp
                        WHEN v_destino LIKE 'CAM-%' THEN v_cam_dst
                        ELSE NULL END;

    -- ── Anotar en el libro ─────────────────────────────────────────────────
    INSERT INTO inventario_movimientos (
      empresa_id, dominio, item_cod, item_nombre, tipo, cantidad, unidad,
      almacen_origen_id, almacen_destino_id, saldo_origen_post, saldo_destino_post,
      motivo, referencia_tipo, referencia_id, ot, area,
      usuario_id, usuario_email, responsable, recibe, notas, lote_id
    ) VALUES (
      v_empresa, v_dominio, upper(v_cod), v_item_nombre, v_tipo, v_cant, v_unidad,
      v_org_id, v_dst_id, v_saldo_org, v_saldo_dst,
      v_linea ->> 'motivo',
      COALESCE(v_linea ->> 'referencia_tipo', 'manual'),
      v_linea ->> 'referencia_id',
      v_linea ->> 'ot',
      v_linea ->> 'area',
      v_user_id, v_email,
      v_linea ->> 'responsable', v_linea ->> 'recibe', v_linea ->> 'notas',
      v_lote
    )
    RETURNING id INTO v_mov_id;

    -- ── Copia en el registro viejo, mientras convivan los dos ──────────────
    IF v_dual AND v_dominio = 'insumo' THEN
      INSERT INTO movimientos_insumos (
        empresa_id, fecha, tipo, codigo, producto, almacen, cantidad, ot,
        responsable_entrega, bitacora
      ) VALUES (
        v_empresa, now(),
        CASE v_tipo WHEN 'INGRESO' THEN 'NUEVO INGRESO'
                    WHEN 'SALIDA'  THEN 'SALIDA PRODUCCION'
                    ELSE v_tipo END,
        upper(v_cod), v_item_nombre,
        COALESCE(v_origen, v_destino), v_cant::int,
        v_linea ->> 'ot',
        v_linea ->> 'responsable',
        'kardex ' || v_mov_id::text
      );
    ELSIF v_dual AND v_dominio = 'tela' THEN
      INSERT INTO movimientos_telas (
        empresa_id, fecha, tipo, codigo, metros, almacen, ot, responsable, notas
      ) VALUES (
        v_empresa, now(), v_tipo, upper(v_cod), v_cant,
        COALESCE(v_origen, v_destino), v_linea ->> 'ot',
        v_linea ->> 'responsable', 'kardex ' || v_mov_id::text
      );
    END IF;

    v_salida := v_salida || jsonb_build_object(
      'id', v_mov_id,
      'item_cod', upper(v_cod),
      'tipo', v_tipo,
      'origen', v_origen,
      'destino', v_destino,
      'cantidad', v_cant,
      'saldo_mp', v_mp,
      'saldo_liberado', v_lib,
      'saldo_origen_post', v_saldo_org,
      'saldo_destino_post', v_saldo_dst,
      -- Cuando la salida se partió, la app lo dice en pantalla en vez de que
      -- la persona descubra después que salió de dos lados.
      'desde_liberado', v_desde_lib,
      'desde_materias_primas', v_desde_mp
    );
  END LOOP;

  RETURN jsonb_build_object('lote_id', v_lote, 'movimientos', v_salida);
END;
$fn$;

REVOKE ALL ON FUNCTION inventario_registrar(jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION inventario_registrar(jsonb, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) inventario_ajuste_sql — la misma puerta, para los scripts
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Las cargas masivas y los recoveries cambian saldos desde SQL, sin sesión.
-- Hasta hoy no dejaban ningún rastro; con esto, sí.
CREATE OR REPLACE FUNCTION inventario_ajuste_sql(
  p_empresa_id uuid,
  p_dominio    text,
  p_item_cod   text,
  p_almacen    text,
  p_delta      numeric,
  p_motivo     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cod   text := btrim(p_item_cod);
  v_alm   text := normalizar_almacen(p_almacen);
  v_id    uuid;
  v_nom   text;
  v_mp    numeric(12,3);
  v_lib   numeric(12,3);
  v_mov   uuid;
BEGIN
  IF p_delta = 0 THEN RETURN NULL; END IF;
  IF v_alm IS NULL OR v_alm NOT IN ('MP','LIB') THEN
    RAISE EXCEPTION 'Almacén no válido para un ajuste: %', p_almacen USING ERRCODE = 'IN006';
  END IF;

  PERFORM set_config('app.inventario_via_rpc', 'on', true);

  IF p_dominio = 'insumo' THEN
    UPDATE insumos SET
      stock_mp       = COALESCE(stock_mp,0)       + (CASE WHEN v_alm='MP'  THEN p_delta::int ELSE 0 END),
      stock_liberado = COALESCE(stock_liberado,0) + (CASE WHEN v_alm='LIB' THEN p_delta::int ELSE 0 END)
     WHERE empresa_id = p_empresa_id AND upper(btrim(cod)) = upper(v_cod)
     RETURNING id, COALESCE(nemotecnico, cod), COALESCE(stock_mp,0), COALESCE(stock_liberado,0)
          INTO v_id, v_nom, v_mp, v_lib;
  ELSE
    UPDATE telas_catalogo SET
      stock_mp       = COALESCE(stock_mp,0)       + (CASE WHEN v_alm='MP'  THEN p_delta ELSE 0 END),
      stock_liberado = COALESCE(stock_liberado,0) + (CASE WHEN v_alm='LIB' THEN p_delta ELSE 0 END)
     WHERE empresa_id = p_empresa_id AND upper(btrim(codigo)) = upper(v_cod)
     RETURNING id, COALESCE(nemotecnico, codigo), COALESCE(stock_mp,0), COALESCE(stock_liberado,0)
          INTO v_id, v_nom, v_mp, v_lib;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No existe el artículo %', v_cod USING ERRCODE = 'IN002';
  END IF;

  INSERT INTO inventario_movimientos (
    empresa_id, dominio, item_cod, item_nombre, tipo, cantidad, unidad,
    almacen_origen_id, almacen_destino_id, saldo_origen_post, saldo_destino_post,
    motivo, referencia_tipo, usuario_email
  )
  SELECT p_empresa_id, p_dominio, upper(v_cod), v_nom,
         CASE WHEN p_delta > 0 THEN 'INGRESO' ELSE 'SALIDA' END,
         abs(p_delta),
         CASE WHEN p_dominio = 'tela' THEN 'm' ELSE 'un' END,
         CASE WHEN p_delta < 0 THEN a.id END,
         CASE WHEN p_delta > 0 THEN a.id END,
         CASE WHEN p_delta < 0 THEN (CASE WHEN v_alm='MP' THEN v_mp ELSE v_lib END) END,
         CASE WHEN p_delta > 0 THEN (CASE WHEN v_alm='MP' THEN v_mp ELSE v_lib END) END,
         p_motivo, 'migracion', 'script'
    FROM almacenes a
   WHERE a.empresa_id = p_empresa_id AND a.codigo = v_alm
  RETURNING id INTO v_mov;

  RETURN v_mov;
END;
$fn$;

REVOKE ALL ON FUNCTION inventario_ajuste_sql(uuid, text, text, text, numeric, text) FROM public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) El guard — primero mira, después bloquea
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Mientras `bloqueoDirecto` esté apagado (que es como queda hoy), esto NO
-- impide nada: solo anota quién cambió un saldo sin pasar por la función. Ese
-- registro es la lista de lo que falta migrar; cuando esté vacío una semana, se
-- enciende el bloqueo.
CREATE OR REPLACE FUNCTION inventario_guard_escritura_directa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa uuid;
  v_antes   numeric(12,3);
BEGIN
  IF current_setting('app.inventario_via_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;

  v_empresa := NEW.empresa_id;

  -- La pantalla de Camionetas todavía inserta sin empresa: se busca por la
  -- camioneta para que la fila del registro no quede huérfana.
  IF v_empresa IS NULL AND TG_TABLE_NAME = 'inventario_camioneta' THEN
    SELECT empresa_id INTO v_empresa FROM camionetas WHERE id = NEW.camioneta_id;
  END IF;

  IF inventario_flag(v_empresa, 'bloqueoDirecto') THEN
    RAISE EXCEPTION 'El stock de % solo se mueve con inventario_registrar()', TG_TABLE_NAME
      USING ERRCODE = 'IN008',
            HINT = 'Si esto lo hizo una pantalla, falta migrarla al kardex';
  END IF;

  IF TG_TABLE_NAME = 'inventario_camioneta' THEN
    -- OJO: en un INSERT no existe OLD. Nombrarlo, aunque sea dentro de un CASE
    -- que no se cumple, revienta con «record "old" is not assigned yet».
    IF TG_OP = 'UPDATE' THEN v_antes := OLD.cantidad; ELSE v_antes := NULL; END IF;

    INSERT INTO inventario_escrituras_directas_log
      (empresa_id, tabla, fila_id, columna, antes, despues, usuario_email)
    VALUES (v_empresa, TG_TABLE_NAME, NEW.id, 'cantidad',
            v_antes, NEW.cantidad, (auth.jwt() ->> 'email'));
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.stock_mp,0) IS DISTINCT FROM COALESCE(NEW.stock_mp,0) THEN
    INSERT INTO inventario_escrituras_directas_log
      (empresa_id, tabla, fila_id, columna, antes, despues, usuario_email)
    VALUES (v_empresa, TG_TABLE_NAME, NEW.id, 'stock_mp',
            COALESCE(OLD.stock_mp,0), COALESCE(NEW.stock_mp,0), (auth.jwt() ->> 'email'));
  END IF;
  IF COALESCE(OLD.stock_liberado,0) IS DISTINCT FROM COALESCE(NEW.stock_liberado,0) THEN
    INSERT INTO inventario_escrituras_directas_log
      (empresa_id, tabla, fila_id, columna, antes, despues, usuario_email)
    VALUES (v_empresa, TG_TABLE_NAME, NEW.id, 'stock_liberado',
            COALESCE(OLD.stock_liberado,0), COALESCE(NEW.stock_liberado,0), (auth.jwt() ->> 'email'));
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_stock_insumos ON insumos;
CREATE TRIGGER trg_guard_stock_insumos
  BEFORE UPDATE OF stock_mp, stock_liberado ON insumos
  FOR EACH ROW EXECUTE FUNCTION inventario_guard_escritura_directa();

DROP TRIGGER IF EXISTS trg_guard_stock_telas ON telas_catalogo;
CREATE TRIGGER trg_guard_stock_telas
  BEFORE UPDATE OF stock_mp, stock_liberado ON telas_catalogo
  FOR EACH ROW EXECUTE FUNCTION inventario_guard_escritura_directa();

DROP TRIGGER IF EXISTS trg_guard_stock_camioneta ON inventario_camioneta;
CREATE TRIGGER trg_guard_stock_camioneta
  BEFORE INSERT OR UPDATE OF cantidad ON inventario_camioneta
  FOR EACH ROW EXECUTE FUNCTION inventario_guard_escritura_directa();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) La apertura — el libro arranca con lo que ya hay
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Un movimiento por cada saldo que exista hoy. Sin esto, el libro diría que la
-- bodega está vacía. Es idempotente: si ya hay apertura para ese artículo y
-- almacén, no se repite.
--
-- LOS NEGATIVOS TAMBIÉN ENTRAN. Hay artículos con saldo negativo (E63 con −40
-- en materias primas, VER45 con −200 en liberado, MEC22 con −19…): son
-- despachos que se registraron sin el ingreso correspondiente. Si la apertura
-- los ignorara, el libro y la bodega no cuadrarían desde el primer día y esa
-- diferencia taparía cualquier error nuevo. Un saldo negativo se anota como una
-- SALIDA de ese almacén, que es exactamente lo que pasó.
INSERT INTO inventario_movimientos (
  empresa_id, dominio, item_cod, item_nombre, tipo, cantidad, unidad,
  almacen_origen_id, almacen_destino_id, saldo_origen_post, saldo_destino_post,
  motivo, referencia_tipo, usuario_email
)
SELECT i.empresa_id, 'insumo', upper(btrim(i.cod)),
       COALESCE(i.nemotecnico, i.descriptor_proveedor, i.cod),
       CASE WHEN s.saldo > 0 THEN 'INGRESO' ELSE 'SALIDA' END,
       abs(s.saldo), COALESCE(i.unidad,'un'),
       CASE WHEN s.saldo < 0 THEN a.id END,
       CASE WHEN s.saldo > 0 THEN a.id END,
       CASE WHEN s.saldo < 0 THEN s.saldo END,
       CASE WHEN s.saldo > 0 THEN s.saldo END,
       'Saldo al empezar a llevar el kardex', 'apertura', 'apertura'
FROM insumos i
CROSS JOIN LATERAL (VALUES
  ('MP',  COALESCE(i.stock_mp,0)::numeric),
  ('LIB', COALESCE(i.stock_liberado,0)::numeric)
) AS s(codigo, saldo)
JOIN almacenes a ON a.empresa_id = i.empresa_id AND a.codigo = s.codigo
WHERE s.saldo <> 0
  AND NOT EXISTS (
    SELECT 1 FROM inventario_movimientos m
     WHERE m.empresa_id = i.empresa_id AND m.dominio = 'insumo'
       AND m.item_cod = upper(btrim(i.cod))
       AND m.referencia_tipo = 'apertura'
       AND a.id IN (m.almacen_destino_id, m.almacen_origen_id)
  );

INSERT INTO inventario_movimientos (
  empresa_id, dominio, item_cod, item_nombre, tipo, cantidad, unidad,
  almacen_origen_id, almacen_destino_id, saldo_origen_post, saldo_destino_post,
  motivo, referencia_tipo, usuario_email
)
SELECT t.empresa_id, 'tela', upper(btrim(t.codigo)),
       COALESCE(t.nemotecnico, t.descriptor, t.codigo),
       CASE WHEN s.saldo > 0 THEN 'INGRESO' ELSE 'SALIDA' END,
       abs(s.saldo), 'm',
       CASE WHEN s.saldo < 0 THEN a.id END,
       CASE WHEN s.saldo > 0 THEN a.id END,
       CASE WHEN s.saldo < 0 THEN s.saldo END,
       CASE WHEN s.saldo > 0 THEN s.saldo END,
       'Saldo al empezar a llevar el kardex', 'apertura', 'apertura'
FROM telas_catalogo t
CROSS JOIN LATERAL (VALUES
  ('MP',  COALESCE(t.stock_mp,0)),
  ('LIB', COALESCE(t.stock_liberado,0))
) AS s(codigo, saldo)
JOIN almacenes a ON a.empresa_id = t.empresa_id AND a.codigo = s.codigo
WHERE s.saldo <> 0
  AND NOT EXISTS (
    SELECT 1 FROM inventario_movimientos m
     WHERE m.empresa_id = t.empresa_id AND m.dominio = 'tela'
       AND m.item_cod = upper(btrim(t.codigo))
       AND m.referencia_tipo = 'apertura'
       AND a.id IN (m.almacen_destino_id, m.almacen_origen_id)
  );

-- Lo que ya está arriba de las camionetas también entra al libro.
INSERT INTO inventario_movimientos (
  empresa_id, dominio, item_cod, item_nombre, tipo, cantidad, unidad,
  almacen_destino_id, saldo_destino_post, motivo, referencia_tipo, usuario_email
)
SELECT ic.empresa_id, 'insumo', upper(btrim(i.cod)),
       COALESCE(i.nemotecnico, i.cod), 'INGRESO', ic.cantidad, COALESCE(i.unidad,'un'),
       a.id, ic.cantidad,
       'Saldo al empezar a llevar el kardex', 'apertura', 'apertura'
FROM inventario_camioneta ic
JOIN insumos i   ON i.id = ic.insumo_id
JOIN almacenes a ON a.camioneta_id = ic.camioneta_id
WHERE ic.cantidad > 0
  AND NOT EXISTS (
    SELECT 1 FROM inventario_movimientos m
     WHERE m.empresa_id = ic.empresa_id AND m.dominio = 'insumo'
       AND m.item_cod = upper(btrim(i.cod))
       AND m.referencia_tipo = 'apertura'
       AND m.almacen_destino_id = a.id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) Las vistas
-- ─────────────────────────────────────────────────────────────────────────────

-- El saldo que dice el LIBRO, almacén por almacén.
CREATE OR REPLACE VIEW v_stock_por_almacen AS
SELECT m.empresa_id, m.dominio, m.item_cod, a.codigo AS almacen,
       SUM(CASE WHEN m.almacen_destino_id = a.id THEN m.cantidad ELSE 0 END)
     - SUM(CASE WHEN m.almacen_origen_id  = a.id THEN m.cantidad ELSE 0 END) AS saldo
FROM inventario_movimientos m
JOIN almacenes a
  ON a.empresa_id = m.empresa_id
 AND a.id IN (m.almacen_origen_id, m.almacen_destino_id)
GROUP BY m.empresa_id, m.dominio, m.item_cod, a.codigo;

-- LA PRUEBA de que el kardex está bien: lo que dice el libro contra lo que dice
-- la columna del artículo. Tiene que devolver CERO filas.
CREATE OR REPLACE VIEW v_inventario_saldos_kardex AS
WITH libro AS (
  SELECT empresa_id, dominio, item_cod,
         SUM(CASE WHEN almacen = 'MP'  THEN saldo ELSE 0 END) AS mp,
         SUM(CASE WHEN almacen = 'LIB' THEN saldo ELSE 0 END) AS lib
  FROM v_stock_por_almacen
  GROUP BY empresa_id, dominio, item_cod
),
articulo AS (
  SELECT empresa_id, 'insumo'::text AS dominio, upper(btrim(cod)) AS item_cod,
         COALESCE(stock_mp,0)::numeric AS mp, COALESCE(stock_liberado,0)::numeric AS lib
    FROM insumos
  UNION ALL
  SELECT empresa_id, 'tela', upper(btrim(codigo)),
         COALESCE(stock_mp,0), COALESCE(stock_liberado,0)
    FROM telas_catalogo
)
SELECT COALESCE(a.empresa_id, l.empresa_id) AS empresa_id,
       COALESCE(a.dominio,    l.dominio)    AS dominio,
       COALESCE(a.item_cod,   l.item_cod)   AS item_cod,
       COALESCE(a.mp,  0) AS mp_articulo,
       COALESCE(l.mp,  0) AS mp_libro,
       COALESCE(a.lib, 0) AS lib_articulo,
       COALESCE(l.lib, 0) AS lib_libro,
       (COALESCE(a.mp,0) + COALESCE(a.lib,0)) - (COALESCE(l.mp,0) + COALESCE(l.lib,0)) AS diferencia
FROM articulo a
FULL JOIN libro l
  ON l.empresa_id = a.empresa_id AND l.dominio = a.dominio AND l.item_cod = a.item_cod
WHERE (COALESCE(a.mp,0) + COALESCE(a.lib,0)) <> (COALESCE(l.mp,0) + COALESCE(l.lib,0));

-- Todo lo que se movió alguna vez, incluido lo viejo, en un solo formato.
CREATE OR REPLACE VIEW v_kardex_historico AS
SELECT 'kardex'::text AS fuente, m.empresa_id, m.fecha, m.dominio, m.item_cod,
       m.tipo, m.cantidad, m.ot, m.responsable, m.notas
FROM inventario_movimientos m
UNION ALL
SELECT 'movimientos_insumos', mi.empresa_id, mi.fecha, 'insumo', upper(btrim(mi.codigo)),
       mi.tipo, mi.cantidad::numeric, mi.ot, mi.responsable_entrega, mi.bitacora
FROM movimientos_insumos mi
UNION ALL
SELECT 'movimientos_telas', mt.empresa_id, mt.fecha, 'tela', upper(btrim(mt.codigo)),
       mt.tipo, mt.metros, mt.ot, mt.responsable, mt.notas
FROM movimientos_telas mt;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) Verificación: el libro tiene que cuadrar con la bodega
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_dif int; v_movs int;
BEGIN
  SELECT count(*) INTO v_dif FROM v_inventario_saldos_kardex;
  SELECT count(*) INTO v_movs FROM inventario_movimientos;

  IF v_dif > 0 THEN
    RAISE EXCEPTION 'El libro NO cuadra con la bodega en % artículos: se aborta', v_dif;
  END IF;

  RAISE NOTICE '9) OK · % movimientos de apertura · 0 diferencias entre el libro y la bodega',
    v_movs;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Inventario 02 · kardex — COMPLETADO ==='; END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Smoke tests (correr a mano después, con una sesión de la app)
--
-- 1) El libro cuadra (la prueba principal):
--    SELECT count(*) FROM v_inventario_saldos_kardex;              -- 0
--
-- 2) Un ingreso de prueba, desde el SQL editor NO sirve (necesita sesión):
--    probarlo desde la app con el interruptor encendido, o con:
--    SELECT inventario_registrar(
--      '[{"dominio":"insumo","item_cod":"MEC 18","tipo":"INGRESO",
--         "cantidad":1,"destino":"MP","motivo":"prueba"}]'::jsonb);
--
-- 3) Sacar más de lo que hay tiene que ser RECHAZADO (error IN003):
--    SELECT inventario_registrar(
--      '[{"dominio":"insumo","item_cod":"MEC 18","tipo":"SALIDA",
--         "cantidad":999999}]'::jsonb);
--
-- 4) Después de las pruebas, el libro tiene que seguir cuadrando:
--    SELECT count(*) FROM v_inventario_saldos_kardex;              -- 0
--
-- 5) Quién sigue escribiendo el stock por fuera (esta lista tiene que vaciarse
--    antes de encender el bloqueo):
--    SELECT tabla, columna, count(*), max(fecha)
--      FROM inventario_escrituras_directas_log
--     GROUP BY 1,2 ORDER BY 3 DESC;
--
-- 6) Deshacer las pruebas del punto 2 y 3:
--    DELETE FROM inventario_movimientos WHERE motivo = 'prueba';
--    -- y devolver el saldo a mano con inventario_ajuste_sql(...)
-- ============================================================================
-- REVERSA
--
--   BEGIN;
--   DROP TRIGGER IF EXISTS trg_guard_stock_insumos   ON insumos;
--   DROP TRIGGER IF EXISTS trg_guard_stock_telas     ON telas_catalogo;
--   DROP TRIGGER IF EXISTS trg_guard_stock_camioneta ON inventario_camioneta;
--   DROP FUNCTION IF EXISTS inventario_guard_escritura_directa();
--   DROP VIEW IF EXISTS v_inventario_saldos_kardex;
--   DROP VIEW IF EXISTS v_kardex_historico;
--   DROP VIEW IF EXISTS v_stock_por_almacen;
--   DROP FUNCTION IF EXISTS inventario_registrar(jsonb, jsonb);
--   DROP FUNCTION IF EXISTS inventario_ajuste_sql(uuid, text, text, text, numeric, text);
--   DROP FUNCTION IF EXISTS inventario_flag(uuid, text);
--   DROP TABLE IF EXISTS inventario_escrituras_directas_log;
--   DROP TABLE IF EXISTS inventario_movimientos;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
--
--   Los saldos NO se tocan en la reversa: este script no los movió.
-- ============================================================================
