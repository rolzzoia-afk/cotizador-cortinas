-- ─────────────────────────────────────────────────────────────────────────────
-- ARREGLO URGENTE — hoy NINGÚN movimiento de stock se puede registrar
-- 2026-09-11
--
-- Dos errores que se tapaban uno al otro. Se descubrieron probando la
-- recepción de compras, pero no son de ella: rompen el kardex entero.
--
-- 1) EL CONGELADO DEL CONTEO rompía todo cambio de saldo.
--    Desde `20260909_inventario_04_conteo.sql`, cualquier UPDATE del saldo de
--    `insumos` o `telas_catalogo` falla con
--        record "new" has no field "codigo"     (en insumos)
--        record "new" has no field "cod"        (en telas)
--    El trigger `conteo_congela_articulo` sirve a las dos tablas y leía el
--    código con `CASE … THEN NEW.cod ELSE NEW.codigo END`. PL/pgSQL arma la
--    expresión ENTERA antes de evaluarla: nombra las dos columnas en las dos
--    tablas, y cada una tiene solo una. La rama que no se usa revienta igual.
--    → Se lee el código desde `to_jsonb(NEW)`, que no exige que la columna
--      exista.
--
-- 2) LA COPIA DE TELAS AL REGISTRO VIEJO nunca funcionó.
--    Con `dualWrite` encendido, `inventario_registrar` copia cada movimiento
--    de tela a `movimientos_telas` con el almacén 'MP' / 'LIB'. Esa tabla solo
--    acepta 'MATERIAS PRIMAS' / 'LIBERADO' (y cuatro tipos), así que la copia
--    fallaba y se llevaba el movimiento entero. `movimientos_telas` está vacía.
--    → Se traduce el almacén y el tipo al idioma de la tabla vieja. El resto
--      de la función queda IDÉNTICO al script del kardex.
--
-- A QUIÉN AFECTABA: al kardex, a Despacho, al Ingreso rápido, a Movimientos, a
-- la ficha de telas y a cualquier escritura directa del saldo. La base NO dejó
-- nada a medias: el error aborta la transacción entera, así que lo que falló
-- no se registró. Del 8 al 11 de septiembre no hay ni un movimiento de stock, y
-- los registros de la base de las últimas 24 horas no muestran intentos.
--
-- IDEMPOTENTE. Se corre en el SQL Editor de producción, ANTES de
-- `20260911_compras_02_recepcion.sql`.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) El congelado del conteo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION conteo_congela_articulo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_dominio text := CASE TG_TABLE_NAME WHEN 'insumos' THEN 'insumo' ELSE 'tela' END;
  -- OJO: por JSON, no con `NEW.cod` / `NEW.codigo`. Este trigger sirve a DOS
  -- tablas y cada una tiene solo una de esas columnas; nombrar la otra, aunque
  -- sea en la rama de un CASE que no se cumple, hace fallar TODA actualización
  -- del saldo.
  v_cod     text := upper(btrim(
                 to_jsonb(NEW) ->> CASE TG_TABLE_NAME WHEN 'insumos' THEN 'cod' ELSE 'codigo' END
               ));
  v_conteo  uuid;
BEGIN
  -- El cierre del propio conteo es lo único que puede mover estos saldos.
  IF current_setting('app.conteo_cerrando', true) = 'on' THEN
    RETURN NEW;
  END IF;
  -- Solo importa si el saldo cambió de verdad.
  IF NEW.stock_mp IS NOT DISTINCT FROM OLD.stock_mp
     AND NEW.stock_liberado IS NOT DISTINCT FROM OLD.stock_liberado THEN
    RETURN NEW;
  END IF;

  SELECT c.id INTO v_conteo
    FROM conteos c
    JOIN conteo_lineas l ON l.conteo_id = c.id
   WHERE c.estado = 'activo'
     AND c.empresa_id = NEW.empresa_id
     AND c.dominio = v_dominio
     AND upper(btrim(l.item_cod)) = v_cod
   LIMIT 1;

  IF v_conteo IS NOT NULL THEN
    RAISE EXCEPTION 'El artículo % está en un conteo abierto: su saldo queda congelado hasta cerrarlo', v_cod
      USING ERRCODE = 'IN004',
            HINT = 'Cierra o cancela el conteo en Inventario → Conteo físico.';
  END IF;
  RETURN NEW;
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) inventario_registrar, con la copia de telas traducida
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Copia EXACTA de la sección 4 de `20260908_inventario_02_kardex.sql` (ya
-- corregido). Lo único distinto es el bloque «ELSIF v_dual AND v_dominio =
-- 'tela'».

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

  -- Los renglones que se anotan por esta línea. Casi siempre uno; dos cuando la
  -- salida se repartió entre liberado y materias primas.
  v_tramos      jsonb;
  v_tramo       jsonb;

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
              HINT = 'Revisa que el código esté escrito igual que en el catálogo';
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
    -- Una salida sin origen se reparte sola (liberado primero). Si ese reparto
    -- está apagado hay que decidir de dónde sale, o no saldría de ninguna parte
    -- y el movimiento quedaría en nada sin que nadie se entere.
    IF v_tipo = 'SALIDA' AND v_origen IS NULL AND NOT v_lib_primero THEN
      v_origen := 'MP';
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
    -- La salida que se reparte sola es la única que puede llegar acá sin
    -- almacenes: los suyos los eligen los saldos, más abajo.
    IF v_org_id IS NULL AND v_dst_id IS NULL
       AND NOT (v_tipo = 'SALIDA' AND v_origen IS NULL) THEN
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
                HINT = 'Saca solo lo que hay, registra primero el ingreso que falta, o cuenta el artículo';
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
                        ELSE NULL END;
    v_saldo_dst := CASE WHEN v_destino = 'LIB' THEN v_lib
                        WHEN v_destino = 'MP'  THEN v_mp
                        WHEN v_destino LIKE 'CAM-%' THEN v_cam_dst
                        ELSE NULL END;

    -- ── Los renglones que se van a anotar ──────────────────────────────────
    --
    -- Casi siempre uno. La excepción es la salida que se repartió: cada bodega
    -- tiene que quedar anotada por separado. Un solo renglón sin origen no le
    -- descontaría a ninguna, y el libro terminaría diciendo que hay más stock
    -- del que hay — que es justo lo que este script viene a impedir.
    IF v_tipo = 'SALIDA' AND v_origen IS NULL THEN
      v_tramos := '[]'::jsonb;
      IF v_desde_lib > 0 THEN
        v_tramos := v_tramos || jsonb_build_object(
          'origen', 'LIB', 'cantidad', v_desde_lib, 'saldo_origen_post', v_lib,
          'origen_id', (SELECT id FROM almacenes
                         WHERE empresa_id = v_empresa AND codigo = 'LIB'));
      END IF;
      IF v_desde_mp > 0 THEN
        v_tramos := v_tramos || jsonb_build_object(
          'origen', 'MP', 'cantidad', v_desde_mp, 'saldo_origen_post', v_mp,
          'origen_id', (SELECT id FROM almacenes
                         WHERE empresa_id = v_empresa AND codigo = 'MP'));
      END IF;
    ELSE
      v_tramos := jsonb_build_array(jsonb_build_object(
        'origen', v_origen, 'origen_id', v_org_id, 'saldo_origen_post', v_saldo_org,
        'destino', v_destino, 'destino_id', v_dst_id, 'saldo_destino_post', v_saldo_dst,
        'cantidad', v_cant));
    END IF;

    -- ── Anotar en el libro ─────────────────────────────────────────────────
    FOR v_tramo IN SELECT * FROM jsonb_array_elements(v_tramos) LOOP
      INSERT INTO inventario_movimientos (
        empresa_id, dominio, item_cod, item_nombre, tipo, cantidad, unidad,
        almacen_origen_id, almacen_destino_id, saldo_origen_post, saldo_destino_post,
        motivo, referencia_tipo, referencia_id, ot, area,
        usuario_id, usuario_email, responsable, recibe, notas, lote_id
      ) VALUES (
        v_empresa, v_dominio, upper(v_cod), v_item_nombre, v_tipo,
        (v_tramo ->> 'cantidad')::numeric, v_unidad,
        (v_tramo ->> 'origen_id')::uuid,
        (v_tramo ->> 'destino_id')::uuid,
        (v_tramo ->> 'saldo_origen_post')::numeric,
        (v_tramo ->> 'saldo_destino_post')::numeric,
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

      -- ── Copia en el registro viejo, mientras convivan los dos ────────────
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
          COALESCE(v_tramo ->> 'origen', v_tramo ->> 'destino'),
          (v_tramo ->> 'cantidad')::numeric::int,
          v_linea ->> 'ot',
          v_linea ->> 'responsable',
          'kardex ' || v_mov_id::text
        );
      ELSIF v_dual AND v_dominio = 'tela' THEN
        -- El registro viejo de telas habla OTRO idioma: sus CHECK solo aceptan
        -- 'MATERIAS PRIMAS' / 'LIBERADO' y cuatro tipos. Copiar 'MP' o
        -- 'DEVOLUCION' tal cual hacía fallar el movimiento ENTERO, no solo la
        -- copia (arreglado por `20260911_fix_stock_bloqueado.sql`).
        INSERT INTO movimientos_telas (
          empresa_id, fecha, tipo, codigo, metros, almacen, ot, responsable, notas
        ) VALUES (
          v_empresa, now(),
          CASE v_tipo WHEN 'DEVOLUCION' THEN 'INGRESO'
                      WHEN 'MERMA'      THEN 'SALIDA'
                      WHEN 'CONTEO'     THEN 'AJUSTE'
                      ELSE v_tipo END,
          upper(v_cod), (v_tramo ->> 'cantidad')::numeric,
          CASE COALESCE(v_tramo ->> 'origen', v_tramo ->> 'destino')
            WHEN 'LIB' THEN 'LIBERADO'
            ELSE 'MATERIAS PRIMAS' END,
          v_linea ->> 'ot',
          v_linea ->> 'responsable', 'kardex ' || v_mov_id::text
        );
      END IF;

      v_salida := v_salida || jsonb_build_object(
        'id', v_mov_id,
        'item_cod', upper(v_cod),
        'tipo', v_tipo,
        'origen', v_tramo ->> 'origen',
        'destino', v_tramo ->> 'destino',
        'cantidad', (v_tramo ->> 'cantidad')::numeric,
        'saldo_mp', v_mp,
        'saldo_liberado', v_lib,
        'saldo_origen_post', (v_tramo ->> 'saldo_origen_post')::numeric,
        'saldo_destino_post', (v_tramo ->> 'saldo_destino_post')::numeric,
        -- Cuando la salida se partió, la app lo dice en pantalla en vez de que
        -- la persona descubra después que salió de dos lados.
        'desde_liberado', v_desde_lib,
        'desde_materias_primas', v_desde_mp
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('lote_id', v_lote, 'movimientos', v_salida);
END;
$fn$;

REVOKE ALL ON FUNCTION inventario_registrar(jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION inventario_registrar(jsonb, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Verificación — se mueve un saldo de cada tabla y se deshace en el acto
-- ─────────────────────────────────────────────────────────────────────────────
--
-- La prueba NO deja nada escrito (la deshace su propia excepción), pero si el
-- trigger siguiera roto, el UPDATE falla con otro error y el script entero se
-- aborta.
DO $$
DECLARE
  v_ins text;
  v_tel text;
BEGIN
  SELECT cod INTO v_ins FROM insumos ORDER BY cod LIMIT 1;
  SELECT codigo INTO v_tel FROM telas_catalogo ORDER BY codigo LIMIT 1;

  BEGIN
    UPDATE insumos SET stock_mp = coalesce(stock_mp, 0) + 1 WHERE cod = v_ins;
    UPDATE telas_catalogo SET stock_mp = coalesce(stock_mp, 0) + 1 WHERE codigo = v_tel;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001', MESSAGE = 'deshacer la prueba';
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN
      RAISE NOTICE 'OK: insumos y telas vuelven a aceptar cambios de saldo (prueba deshecha).';
  END;

  IF pg_get_functiondef('public.inventario_registrar(jsonb,jsonb)'::regprocedure)
     NOT LIKE '%''MATERIAS PRIMAS''%' THEN
    RAISE EXCEPTION 'inventario_registrar no quedó con la copia de telas traducida';
  END IF;
END $$;

COMMIT;

-- Después de correrlo, el libro tiene que seguir cuadrando:
--   SELECT count(*) FROM v_inventario_saldos_kardex;    -- 0
