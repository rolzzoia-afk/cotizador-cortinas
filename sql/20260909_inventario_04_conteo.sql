-- ============================================================================
-- INVENTARIO 04 — Conteo físico de insumos y telas
-- Fecha: 2026-09-09
-- ============================================================================
--
-- CUARTO de la serie. Correr DESPUÉS del 02. Es idempotente y NO toca ningún
-- saldo al aplicarse: crea tablas y funciones. Los saldos recién se mueven
-- cuando alguien CIERRA un conteo desde la pantalla.
--
-- POR QUÉ:
--   Los tubos ya tienen su conteo (`inventarios` + snapshot + diff + firma),
--   y funciona. Los insumos y las telas no tienen ninguno: el saldo se
--   corrige a mano, sin registro de quién contó ni de qué había antes. Un
--   inventario que se ajusta sin dejar rastro no es un inventario, es una
--   opinión.
--
-- CÓMO ES EL CONTEO:
--   · DOBLE CIEGO: dos personas cuentan el mismo artículo sin verse. Si los
--     dos dan el mismo número, se toma. Si no, la línea queda marcada
--     «vuelvan a contar» y alguien decide. Es la única manera barata de
--     detectar el error de conteo, que es mucho más común que el robo.
--   · CONGELADO: mientras el conteo está abierto, el stock de esos artículos
--     NO se puede mover. Si se moviera, la diferencia que se está midiendo
--     dejaría de significar nada.
--   · Al cerrar, cada línea con diferencia genera UN movimiento de tipo
--     CONTEO en el kardex, con el saldo que quedó. Nadie edita el saldo: se
--     corrige con un movimiento, como todo lo demás.
--
-- OJO: `insumos.stock_mp` y `stock_liberado` son INTEGER. Un conteo de telas
-- admite decimales; uno de insumos, no.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Inventario 04 · conteo físico — INICIADO ==='; END $$;

DO $$
BEGIN
  IF to_regclass('public.inventario_movimientos') IS NULL THEN
    RAISE EXCEPTION 'Falta correr antes sql/20260908_inventario_02_kardex.sql';
  END IF;
  IF to_regclass('public.almacenes') IS NULL THEN
    RAISE EXCEPTION 'Falta correr antes sql/20260908_inventario_01_catalogos.sql';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Las tres tablas
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Son NUEVAS a propósito y no reusan `inventarios`: esa tabla es la del conteo
-- de TUBOS, y mientras tiene una fila activa bloquea `sync_colmena_tubos`. Un
-- conteo de insumos no tiene por qué frenar el optimizador de corte.

CREATE TABLE IF NOT EXISTS conteos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  dominio       text NOT NULL CHECK (dominio IN ('insumo','tela')),
  -- Código del almacén que se cuenta: 'MP' o 'LIB'.
  almacen       text NOT NULL,
  -- Filtro opcional del alcance, para no contar 1.012 artículos de una vez.
  categoria     text,
  modo          text NOT NULL DEFAULT 'doble_ciego'
                CHECK (modo IN ('simple','doble_ciego')),
  estado        text NOT NULL DEFAULT 'activo'
                CHECK (estado IN ('activo','cerrado','cancelado')),
  lineas_total  integer NOT NULL DEFAULT 0,
  iniciado_por       uuid,
  iniciado_por_email text,
  iniciado_en   timestamptz NOT NULL DEFAULT now(),
  cerrado_por       uuid,
  cerrado_por_email text,
  cerrado_en    timestamptz,
  firma_png     text,
  notas         text,
  ajustadas     integer
);

-- Un conteo activo por empresa + dominio + almacén: dos abiertos sobre lo
-- mismo harían que cada uno midiera contra un saldo distinto.
CREATE UNIQUE INDEX IF NOT EXISTS conteos_activo_unico
  ON conteos (empresa_id, dominio, almacen)
  WHERE estado = 'activo';
CREATE INDEX IF NOT EXISTS conteos_empresa_fecha
  ON conteos (empresa_id, iniciado_en DESC);

CREATE TABLE IF NOT EXISTS conteo_lineas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conteo_id    uuid NOT NULL REFERENCES conteos(id) ON DELETE CASCADE,
  empresa_id   uuid NOT NULL,
  item_cod     text NOT NULL,
  item_nombre  text,
  -- Lo que decía el sistema CUANDO SE ABRIÓ el conteo. Congelado a propósito:
  -- es contra este número que se mide la diferencia.
  saldo_sistema numeric(12,3) NOT NULL DEFAULT 0,
  -- Lo que alguien decidió que queda. NULL = todavía sin resolver.
  saldo_final  numeric(12,3),
  ajustada     boolean NOT NULL DEFAULT false,
  UNIQUE (conteo_id, item_cod)
);

CREATE INDEX IF NOT EXISTS conteo_lineas_conteo ON conteo_lineas (conteo_id);

CREATE TABLE IF NOT EXISTS conteo_tallies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conteo_id    uuid NOT NULL REFERENCES conteos(id) ON DELETE CASCADE,
  linea_id     uuid NOT NULL REFERENCES conteo_lineas(id) ON DELETE CASCADE,
  empresa_id   uuid NOT NULL,
  -- 'A' y 'B' son los dos contadores del doble ciego.
  contador     text NOT NULL CHECK (contador IN ('A','B')),
  usuario_id   uuid,
  usuario_email text,
  cantidad     numeric(12,3) NOT NULL,
  contado_en   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (linea_id, contador)
);

CREATE INDEX IF NOT EXISTS conteo_tallies_conteo ON conteo_tallies (conteo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) RLS: cada empresa ve lo suyo
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE conteos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteo_lineas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteo_tallies  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conteos','conteo_lineas','conteo_tallies'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t AND policyname = 'empresa_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY empresa_isolation ON %I FOR SELECT TO authenticated
           USING (empresa_id = (SELECT get_my_empresa_id()))', t);
    END IF;
  END LOOP;
END $$;

-- Sin policies de escritura a propósito: todo se escribe por las funciones de
-- abajo, que son SECURITY DEFINER. Es el mismo criterio de `inventarios`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) El congelado
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Mientras un conteo está abierto, el saldo de sus artículos no se mueve. Va
-- como trigger sobre las tablas de stock y no dentro de `inventario_registrar`
-- porque así también atrapa las escrituras directas que todavía quedan: si el
-- taller descuenta por el camino viejo, la diferencia medida sería basura.
CREATE OR REPLACE FUNCTION conteo_congela_articulo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_dominio text := CASE TG_TABLE_NAME WHEN 'insumos' THEN 'insumo' ELSE 'tela' END;
  v_cod     text := upper(btrim(CASE TG_TABLE_NAME WHEN 'insumos' THEN NEW.cod ELSE NEW.codigo END));
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

DROP TRIGGER IF EXISTS trg_conteo_congela_insumos ON insumos;
CREATE TRIGGER trg_conteo_congela_insumos
  BEFORE UPDATE OF stock_mp, stock_liberado ON insumos
  FOR EACH ROW EXECUTE FUNCTION conteo_congela_articulo();

DROP TRIGGER IF EXISTS trg_conteo_congela_telas ON telas_catalogo;
CREATE TRIGGER trg_conteo_congela_telas
  BEFORE UPDATE OF stock_mp, stock_liberado ON telas_catalogo
  FOR EACH ROW EXECUTE FUNCTION conteo_congela_articulo();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) conteo_iniciar — abre el conteo y congela el saldo de arranque
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION conteo_iniciar(
  p_dominio   text,
  p_almacen   text DEFAULT 'MP',
  p_modo      text DEFAULT 'doble_ciego',
  p_categoria text DEFAULT NULL,
  p_notas     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa uuid;
  v_rol     text;
  v_uid     uuid := auth.uid();
  v_email   text := (auth.jwt() ->> 'email');
  v_alm     text := normalizar_almacen(p_almacen);
  v_id      uuid;
  v_n       integer;
BEGIN
  SELECT empresa_id, rol INTO v_empresa, v_rol FROM perfiles WHERE id = v_uid;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = 'IN001';
  END IF;
  IF v_rol NOT IN ('admin','superadmin') THEN
    RAISE EXCEPTION 'Solo un administrador abre y cierra un conteo' USING ERRCODE = 'IN007';
  END IF;
  IF p_dominio NOT IN ('insumo','tela') THEN
    RAISE EXCEPTION 'Dominio desconocido: %', p_dominio USING ERRCODE = 'IN005';
  END IF;
  IF v_alm IS NULL OR v_alm NOT IN ('MP','LIB') THEN
    RAISE EXCEPTION 'Un conteo se hace sobre materias primas o liberado, no sobre %', p_almacen
      USING ERRCODE = 'IN006';
  END IF;

  BEGIN
    INSERT INTO conteos (empresa_id, dominio, almacen, categoria, modo,
                         iniciado_por, iniciado_por_email, notas)
    VALUES (v_empresa, p_dominio, v_alm, NULLIF(btrim(p_categoria), ''), p_modo,
            v_uid, v_email, p_notas)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya hay un conteo abierto de % en %. Ciérralo o cancélalo antes de abrir otro.',
      p_dominio, v_alm USING ERRCODE = 'P0001';
  END;

  -- Las líneas, con el saldo de ESTE momento. De acá en adelante ese número no
  -- se mueve: es contra él que se mide la diferencia.
  IF p_dominio = 'insumo' THEN
    INSERT INTO conteo_lineas (conteo_id, empresa_id, item_cod, item_nombre, saldo_sistema)
    SELECT v_id, v_empresa, upper(btrim(i.cod)),
           COALESCE(i.nemotecnico, i.descriptor_proveedor, i.cod),
           CASE WHEN v_alm = 'MP' THEN COALESCE(i.stock_mp,0) ELSE COALESCE(i.stock_liberado,0) END
      FROM insumos i
     WHERE i.empresa_id = v_empresa
       AND i.cod IS NOT NULL AND btrim(i.cod) <> ''
       AND (p_categoria IS NULL OR upper(btrim(COALESCE(i.sub_categoria,''))) = upper(btrim(p_categoria)))
       AND COALESCE(i.status,'') <> 'DESCONTINUADO';
  ELSE
    INSERT INTO conteo_lineas (conteo_id, empresa_id, item_cod, item_nombre, saldo_sistema)
    SELECT v_id, v_empresa, upper(btrim(t.codigo)),
           COALESCE(t.nemotecnico, t.descriptor, t.codigo),
           CASE WHEN v_alm = 'MP' THEN COALESCE(t.stock_mp,0) ELSE COALESCE(t.stock_liberado,0) END
      FROM telas_catalogo t
     WHERE t.empresa_id = v_empresa
       AND t.codigo IS NOT NULL AND btrim(t.codigo) <> ''
       AND (p_categoria IS NULL OR upper(btrim(COALESCE(t.tipo,''))) = upper(btrim(p_categoria)))
       AND COALESCE(t.estado,'') <> 'DESCONTINUADO';
  END IF;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Ese alcance no tiene ningún artículo que contar' USING ERRCODE = 'IN002';
  END IF;
  UPDATE conteos SET lineas_total = v_n WHERE id = v_id;

  RETURN v_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION conteo_iniciar(text, text, text, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) conteo_tally_set — lo que contó UNA persona
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Doble ciego de verdad: esta función NO devuelve lo que contó el otro. Si lo
-- devolviera, el segundo contador terminaría confirmando el número del primero
-- y el doble conteo no serviría de nada.
CREATE OR REPLACE FUNCTION conteo_tally_set(
  p_conteo_id uuid,
  p_item_cod  text,
  p_contador  text,
  p_cantidad  numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa uuid;
  v_uid     uuid := auth.uid();
  v_linea   uuid;
  v_dominio text;
BEGIN
  SELECT empresa_id INTO v_empresa FROM perfiles WHERE id = v_uid;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = 'IN001';
  END IF;
  IF p_cantidad < 0 THEN
    RAISE EXCEPTION 'No se puede contar una cantidad negativa' USING ERRCODE = 'IN005';
  END IF;

  SELECT c.dominio INTO v_dominio
    FROM conteos c
   WHERE c.id = p_conteo_id AND c.empresa_id = v_empresa AND c.estado = 'activo';
  IF v_dominio IS NULL THEN
    RAISE EXCEPTION 'Ese conteo no está abierto' USING ERRCODE = 'IN004';
  END IF;
  IF v_dominio = 'insumo' AND p_cantidad <> round(p_cantidad) THEN
    RAISE EXCEPTION 'Los insumos se cuentan en números enteros' USING ERRCODE = 'IN005';
  END IF;

  SELECT id INTO v_linea FROM conteo_lineas
   WHERE conteo_id = p_conteo_id AND upper(btrim(item_cod)) = upper(btrim(p_item_cod));
  IF v_linea IS NULL THEN
    RAISE EXCEPTION 'El artículo % no está en el alcance de este conteo', p_item_cod
      USING ERRCODE = 'IN002';
  END IF;

  INSERT INTO conteo_tallies (conteo_id, linea_id, empresa_id, contador,
                              usuario_id, usuario_email, cantidad)
  VALUES (p_conteo_id, v_linea, v_empresa, upper(btrim(p_contador)),
          v_uid, (auth.jwt() ->> 'email'), p_cantidad)
  ON CONFLICT (linea_id, contador) DO UPDATE
    SET cantidad = EXCLUDED.cantidad,
        usuario_id = EXCLUDED.usuario_id,
        usuario_email = EXCLUDED.usuario_email,
        contado_en = now();
END;
$fn$;

GRANT EXECUTE ON FUNCTION conteo_tally_set(uuid, text, text, numeric) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) conteo_diff — qué calza y qué no
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Solo la ve quien puede cerrar: mostrarle los dos números al que todavía
-- está contando rompería el ciego.
CREATE OR REPLACE FUNCTION conteo_diff(p_conteo_id uuid)
RETURNS TABLE (
  item_cod     text,
  item_nombre  text,
  saldo_sistema numeric,
  conteo_a     numeric,
  conteo_b     numeric,
  diferencia   numeric,
  estado       text,      -- 'calzan' | 'discrepan' | 'sin_contar' | 'parcial'
  saldo_final  numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa uuid;
  v_rol     text;
  v_modo    text;
BEGIN
  SELECT p.empresa_id, p.rol INTO v_empresa, v_rol FROM perfiles p WHERE p.id = auth.uid();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = 'IN001';
  END IF;
  IF v_rol NOT IN ('admin','superadmin') THEN
    RAISE EXCEPTION 'Las diferencias las mira quien cierra el conteo' USING ERRCODE = 'IN007';
  END IF;

  SELECT c.modo INTO v_modo FROM conteos c
   WHERE c.id = p_conteo_id AND c.empresa_id = v_empresa;
  IF v_modo IS NULL THEN
    RAISE EXCEPTION 'No existe ese conteo' USING ERRCODE = 'IN002';
  END IF;

  RETURN QUERY
  SELECT
    l.item_cod,
    l.item_nombre,
    l.saldo_sistema,
    ta.cantidad AS conteo_a,
    tb.cantidad AS conteo_b,
    -- La diferencia solo tiene sentido cuando hay un número acordado.
    CASE
      WHEN v_modo = 'simple' AND ta.cantidad IS NOT NULL THEN ta.cantidad - l.saldo_sistema
      WHEN ta.cantidad IS NOT NULL AND tb.cantidad IS NOT NULL AND ta.cantidad = tb.cantidad
        THEN ta.cantidad - l.saldo_sistema
    END AS diferencia,
    CASE
      WHEN ta.cantidad IS NULL AND tb.cantidad IS NULL THEN 'sin_contar'
      WHEN v_modo = 'simple' THEN 'calzan'
      WHEN ta.cantidad IS NULL OR tb.cantidad IS NULL THEN 'parcial'
      WHEN ta.cantidad = tb.cantidad THEN 'calzan'
      ELSE 'discrepan'
    END AS estado,
    l.saldo_final
  FROM conteo_lineas l
  LEFT JOIN conteo_tallies ta ON ta.linea_id = l.id AND ta.contador = 'A'
  LEFT JOIN conteo_tallies tb ON tb.linea_id = l.id AND tb.contador = 'B'
  WHERE l.conteo_id = p_conteo_id
  ORDER BY l.item_cod;
END;
$fn$;

GRANT EXECUTE ON FUNCTION conteo_diff(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) conteo_cerrar — ajusta y deja el movimiento
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `p_resoluciones` es [{ item_cod, cantidad }]: lo que alguien decidió para
-- las líneas que no calzaron. Las que calzaron se toman solas.
--
-- Las líneas SIN CONTAR no se tocan. Cerrar un conteo a medias es normal —se
-- contó una estantería, no el galpón— y poner en cero lo que nadie miró sería
-- destruir el inventario con la excusa de ordenarlo.
CREATE OR REPLACE FUNCTION conteo_cerrar(
  p_conteo_id    uuid,
  p_firma_png    text DEFAULT NULL,
  p_resoluciones jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa  uuid;
  v_rol      text;
  v_dominio  text;
  v_almacen  text;
  v_modo     text;
  v_alm_id   uuid;
  v_res      jsonb;
  v_fila     record;
  v_final    numeric;
  v_delta    numeric;
  v_saldo    numeric;
  v_ajustes  integer := 0;
  v_email    text := (auth.jwt() ->> 'email');
BEGIN
  SELECT p.empresa_id, p.rol INTO v_empresa, v_rol FROM perfiles p WHERE p.id = auth.uid();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = 'IN001';
  END IF;
  IF v_rol NOT IN ('admin','superadmin') THEN
    RAISE EXCEPTION 'Solo un administrador cierra un conteo' USING ERRCODE = 'IN007';
  END IF;

  SELECT c.dominio, c.almacen, c.modo INTO v_dominio, v_almacen, v_modo
    FROM conteos c
   WHERE c.id = p_conteo_id AND c.empresa_id = v_empresa AND c.estado = 'activo';
  IF v_dominio IS NULL THEN
    RAISE EXCEPTION 'Ese conteo no está abierto' USING ERRCODE = 'IN004';
  END IF;

  SELECT id INTO v_alm_id FROM almacenes
   WHERE empresa_id = v_empresa AND codigo = v_almacen;

  -- Lo resuelto a mano, indexado por código.
  SELECT COALESCE(jsonb_object_agg(upper(btrim(x ->> 'item_cod')), (x ->> 'cantidad')::numeric), '{}'::jsonb)
    INTO v_res
    FROM jsonb_array_elements(COALESCE(p_resoluciones, '[]'::jsonb)) x
   WHERE x ->> 'item_cod' IS NOT NULL AND x ->> 'cantidad' IS NOT NULL;

  -- El cierre es lo único que puede mover un saldo congelado.
  PERFORM set_config('app.conteo_cerrando', 'on', true);
  PERFORM set_config('app.inventario_via_rpc', 'on', true);

  FOR v_fila IN
    SELECT l.id, l.item_cod, l.item_nombre, l.saldo_sistema,
           ta.cantidad AS a, tb.cantidad AS b
      FROM conteo_lineas l
      LEFT JOIN conteo_tallies ta ON ta.linea_id = l.id AND ta.contador = 'A'
      LEFT JOIN conteo_tallies tb ON tb.linea_id = l.id AND tb.contador = 'B'
     WHERE l.conteo_id = p_conteo_id
  LOOP
    v_final := NULL;
    -- 1) lo que alguien resolvió a mano manda;
    IF v_res ? upper(btrim(v_fila.item_cod)) THEN
      v_final := (v_res ->> upper(btrim(v_fila.item_cod)))::numeric;
    -- 2) si no, los dos números que coinciden;
    ELSIF v_modo = 'simple' AND v_fila.a IS NOT NULL THEN
      v_final := v_fila.a;
    ELSIF v_fila.a IS NOT NULL AND v_fila.b IS NOT NULL AND v_fila.a = v_fila.b THEN
      v_final := v_fila.a;
    END IF;

    -- 3) lo que nadie contó o quedó en discrepancia se deja como estaba.
    IF v_final IS NULL THEN
      CONTINUE;
    END IF;

    v_delta := v_final - v_fila.saldo_sistema;
    UPDATE conteo_lineas SET saldo_final = v_final, ajustada = (v_delta <> 0)
     WHERE id = v_fila.id;
    IF v_delta = 0 THEN
      CONTINUE;
    END IF;

    -- El saldo se pone en lo contado y se anota el movimiento.
    IF v_dominio = 'insumo' THEN
      IF v_almacen = 'MP' THEN
        UPDATE insumos SET stock_mp = round(v_final)::int
         WHERE empresa_id = v_empresa AND upper(btrim(cod)) = upper(btrim(v_fila.item_cod))
         RETURNING stock_mp INTO v_saldo;
      ELSE
        UPDATE insumos SET stock_liberado = round(v_final)::int
         WHERE empresa_id = v_empresa AND upper(btrim(cod)) = upper(btrim(v_fila.item_cod))
         RETURNING stock_liberado INTO v_saldo;
      END IF;
    ELSE
      IF v_almacen = 'MP' THEN
        UPDATE telas_catalogo SET stock_mp = v_final
         WHERE empresa_id = v_empresa AND upper(btrim(codigo)) = upper(btrim(v_fila.item_cod))
         RETURNING stock_mp INTO v_saldo;
      ELSE
        UPDATE telas_catalogo SET stock_liberado = v_final
         WHERE empresa_id = v_empresa AND upper(btrim(codigo)) = upper(btrim(v_fila.item_cod))
         RETURNING stock_liberado INTO v_saldo;
      END IF;
    END IF;

    IF v_saldo IS NULL THEN
      CONTINUE;  -- el artículo se borró mientras se contaba
    END IF;

    -- Un solo movimiento por línea, con el saldo que quedó. El almacén va del
    -- lado que corresponde: sumar es un destino, restar es un origen.
    INSERT INTO inventario_movimientos (
      empresa_id, dominio, item_cod, item_nombre, tipo, cantidad, unidad,
      almacen_origen_id, almacen_destino_id, saldo_origen_post, saldo_destino_post,
      motivo, referencia_tipo, referencia_id, usuario_id, usuario_email, lote_id
    ) VALUES (
      v_empresa, v_dominio, upper(btrim(v_fila.item_cod)), v_fila.item_nombre,
      'CONTEO', abs(v_delta),
      CASE WHEN v_dominio = 'tela' THEN 'm' ELSE 'un' END,
      CASE WHEN v_delta < 0 THEN v_alm_id END,
      CASE WHEN v_delta > 0 THEN v_alm_id END,
      CASE WHEN v_delta < 0 THEN v_saldo END,
      CASE WHEN v_delta > 0 THEN v_saldo END,
      'Conteo físico', 'conteo', p_conteo_id::text, auth.uid(), v_email, p_conteo_id
    );
    v_ajustes := v_ajustes + 1;
  END LOOP;

  UPDATE conteos
     SET estado = 'cerrado', cerrado_por = auth.uid(), cerrado_por_email = v_email,
         cerrado_en = now(), firma_png = p_firma_png, ajustadas = v_ajustes
   WHERE id = p_conteo_id;

  RETURN jsonb_build_object('conteo_id', p_conteo_id, 'ajustadas', v_ajustes);
END;
$fn$;

GRANT EXECUTE ON FUNCTION conteo_cerrar(uuid, text, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) conteo_cancelar — se abandona sin tocar ningún saldo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION conteo_cancelar(p_conteo_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa uuid;
  v_rol     text;
BEGIN
  SELECT p.empresa_id, p.rol INTO v_empresa, v_rol FROM perfiles p WHERE p.id = auth.uid();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = 'IN001';
  END IF;
  IF v_rol NOT IN ('admin','superadmin') THEN
    RAISE EXCEPTION 'Solo un administrador cancela un conteo' USING ERRCODE = 'IN007';
  END IF;

  UPDATE conteos
     SET estado = 'cancelado', cerrado_por = auth.uid(),
         cerrado_por_email = (auth.jwt() ->> 'email'), cerrado_en = now(),
         notas = concat_ws(' · ', notas, NULLIF(btrim(p_motivo), ''))
   WHERE id = p_conteo_id AND empresa_id = v_empresa AND estado = 'activo';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ese conteo no está abierto' USING ERRCODE = 'IN004';
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION conteo_cancelar(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_faltan text[];
BEGIN
  SELECT array_agg(f) INTO v_faltan FROM unnest(ARRAY[
    'conteo_iniciar','conteo_tally_set','conteo_diff','conteo_cerrar','conteo_cancelar',
    'conteo_congela_articulo'
  ]) f WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f);
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'No se crearon las funciones: %', array_to_string(v_faltan, ', ');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conteo_congela_insumos') THEN
    RAISE EXCEPTION 'Falta el trigger que congela los insumos en conteo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conteo_congela_telas') THEN
    RAISE EXCEPTION 'Falta el trigger que congela las telas en conteo';
  END IF;

  RAISE NOTICE 'OK · tablas, funciones y triggers del conteo creados';
END $$;

DO $$ BEGIN RAISE NOTICE '=== Inventario 04 · conteo físico — COMPLETADO ==='; END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Smoke tests (correr con sesión de admin desde la app, NO desde el editor:
-- las funciones necesitan auth.uid())
--
-- 1) Abrir un conteo chico y ver cuántas líneas quedaron:
--    SELECT conteo_iniciar('insumo','MP','doble_ciego','MECANISMO');
--    SELECT lineas_total FROM conteos WHERE estado='activo';
--
-- 2) Que el congelado funcione — esto TIENE que fallar con IN004:
--    UPDATE insumos SET stock_mp = stock_mp + 1
--     WHERE cod = (SELECT item_cod FROM conteo_lineas LIMIT 1);
--
-- 3) Cancelar y comprobar que ningún saldo se movió:
--    SELECT conteo_cancelar((SELECT id FROM conteos WHERE estado='activo'));
--    SELECT count(*) FROM v_inventario_saldos_kardex;           -- 0
-- ============================================================================
-- REVERSA
--
--   Los conteos cerrados YA ajustaron saldos y dejaron su movimiento en el
--   kardex: eso no se deshace borrando tablas, se corrige con otro movimiento.
--   Para quitar la maquinaria sin tocar ningún saldo:
--
--     DROP TRIGGER IF EXISTS trg_conteo_congela_insumos ON insumos;
--     DROP TRIGGER IF EXISTS trg_conteo_congela_telas ON telas_catalogo;
--     DROP FUNCTION IF EXISTS conteo_cancelar(uuid, text);
--     DROP FUNCTION IF EXISTS conteo_cerrar(uuid, text, jsonb);
--     DROP FUNCTION IF EXISTS conteo_diff(uuid);
--     DROP FUNCTION IF EXISTS conteo_tally_set(uuid, text, text, numeric);
--     DROP FUNCTION IF EXISTS conteo_iniciar(text, text, text, text, text);
--     DROP FUNCTION IF EXISTS conteo_congela_articulo();
--     ALTER TABLE conteos RENAME TO conteos_retirado;   -- nunca DROP: es historia
-- ============================================================================
