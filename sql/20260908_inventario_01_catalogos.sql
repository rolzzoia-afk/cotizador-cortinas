-- ============================================================================
-- INVENTARIO 01 — Catálogos: unidades, almacenes y la limpieza previa al kardex
-- Fecha: 2026-09-08
-- ============================================================================
--
-- Este es el PRIMERO de los dos scripts de la Entrega B. Correr COMPLETO en el
-- editor SQL de Supabase, y recién después el 02 (kardex). Es idempotente:
-- correrlo dos veces deja el mismo resultado.
--
-- POR QUÉ:
--   Hoy el mismo lugar físico se escribe de cuatro maneras según qué pantalla
--   lo haya guardado (verificado en producción, 2026-09-08):
--       ubicaciones_rack  →  'MATERIAS_PRIMAS' (170)  ·  'LIBERADO' (244)
--       telas_slots       →  'MATERIAS PRIMAS' (211)  ·  'LIBERADO' (130)
--       telas_catalogo    →  'MATERIAS PRIMAS'  (51)  ·  'LIBERADO' (163)
--       movimientos_insumos → 'MP' (1.152) y 2 filas sin almacén
--   Con cuatro nombres para dos bodegas no se puede sumar un saldo por almacén,
--   que es lo primero que necesita el kardex. Acá los almacenes pasan a ser una
--   TABLA, y una función traduce todo lo viejo a su código.
--
-- QUÉ HACE (nada de esto borra datos):
--   0. Respalda los saldos de insumos, telas y camionetas.
--   1. `unidades`  — un, m, m2, rollo, par, caja, kg.
--   2. `almacenes` — MP, LIB y MERMA por empresa, más una CAM-<n> por camioneta
--      (y un trigger para que toda camioneta nueva nazca con la suya).
--   3. `normalizar_almacen(text)` — la misma tabla de equivalencias que usa la
--      app en `src/modules/inventario/almacenes.ts`.
--   4. `insumos`: unidad, contenido por unidad y stock máximo.
--   5. `telas_catalogo`: stock máximo, y `stock_total` pasa a ser CALCULADA
--      como ya lo es en insumos (hoy es una columna suelta que se desalineó en
--      4 telas por décimas: BK 59, BK 61, BK 63 y DU 18).
--   6. `ubicaciones_rack` y `telas_slots`: apuntan al almacén por id.
--   7. `inventario_camioneta`: gana `empresa_id` (hoy solo cuelga del insumo).
--
-- QUÉ NO HACE:
--   No toca ningún saldo, no crea movimientos y no cambia cómo escribe la app.
--   Eso es el script 02.
--
-- REVERSA (al pie del archivo, probada antes de correr esto en producción).
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Inventario 01 · catálogos — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Respaldo de los saldos, antes de tocar nada
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS inv_saldos_backup_kardex_20260908;
CREATE TABLE inv_saldos_backup_kardex_20260908 AS
SELECT 'insumo'::text AS dominio, i.id, i.empresa_id, i.cod AS codigo,
       i.stock_mp::numeric AS stock_mp, i.stock_liberado::numeric AS stock_liberado,
       i.stock_total::numeric AS stock_total
FROM insumos i
UNION ALL
SELECT 'tela', t.id, t.empresa_id, t.codigo,
       COALESCE(t.stock_mp,0), COALESCE(t.stock_liberado,0), COALESCE(t.stock_total,0)
FROM telas_catalogo t;

DROP TABLE IF EXISTS inv_camioneta_backup_kardex_20260908;
CREATE TABLE inv_camioneta_backup_kardex_20260908 AS
SELECT * FROM inventario_camioneta;

DO $$
DECLARE v_filas int;
BEGIN
  SELECT count(*) INTO v_filas FROM inv_saldos_backup_kardex_20260908;
  IF v_filas = 0 THEN
    RAISE EXCEPTION 'El respaldo salió vacío: se aborta antes de tocar nada';
  END IF;
  RAISE NOTICE '0) Respaldo: % filas de saldos + % líneas de camioneta',
    v_filas, (SELECT count(*) FROM inv_camioneta_backup_kardex_20260908);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) unidades — en qué se mide cada cosa
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `decimales` dice cuántos decimales tiene sentido guardar: una unidad es
-- entera (no existe media manilla), un metro de tela va con dos.
CREATE TABLE IF NOT EXISTS unidades (
  codigo     text PRIMARY KEY,
  nombre     text NOT NULL,
  decimales  int  NOT NULL DEFAULT 0,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO unidades (codigo, nombre, decimales) VALUES
  ('un',    'Unidad',            0),
  ('m',     'Metro',             2),
  ('m2',    'Metro cuadrado',    2),
  ('rollo', 'Rollo',             0),
  ('par',   'Par',               0),
  ('caja',  'Caja',              0),
  ('kg',    'Kilogramo',         2)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

-- El vocabulario lo lee todo el mundo; agregarle una unidad es del admin.
DROP POLICY IF EXISTS unidades_select ON unidades;
CREATE POLICY unidades_select ON unidades FOR SELECT USING (true);

DROP POLICY IF EXISTS unidades_escribe_admin ON unidades;
CREATE POLICY unidades_escribe_admin ON unidades FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','superadmin')));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) almacenes — dónde puede estar el material
-- ─────────────────────────────────────────────────────────────────────────────
--
--   'fisico' → una bodega de verdad (MP, LIB)
--   'movil'  → una camioneta (CAM-1, CAM-2…)
--   'virtual'→ no es un lugar, es un destino contable (MERMA)
CREATE TABLE IF NOT EXISTS almacenes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  codigo       text NOT NULL,
  nombre       text NOT NULL,
  tipo         text NOT NULL DEFAULT 'fisico' CHECK (tipo IN ('fisico','movil','virtual')),
  camioneta_id uuid REFERENCES camionetas(id) ON DELETE SET NULL,
  activo       boolean NOT NULL DEFAULT true,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'almacenes'::regclass AND conname = 'almacenes_codigo_unico'
  ) THEN
    ALTER TABLE almacenes ADD CONSTRAINT almacenes_codigo_unico UNIQUE (empresa_id, codigo);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_almacenes_empresa ON almacenes(empresa_id, activo);

ALTER TABLE almacenes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_isolation ON almacenes;
CREATE POLICY empresa_isolation ON almacenes FOR ALL
  USING (empresa_id = (SELECT get_my_empresa_id()))
  WITH CHECK (empresa_id = (SELECT get_my_empresa_id()));

-- Los tres de siempre, por cada empresa que tenga insumos.
INSERT INTO almacenes (empresa_id, codigo, nombre, tipo)
SELECT e.empresa_id, v.codigo, v.nombre, v.tipo
FROM (SELECT DISTINCT empresa_id FROM insumos) e
CROSS JOIN (VALUES
  ('MP',    'Materias primas', 'fisico'),
  ('LIB',   'Liberado',        'fisico'),
  ('MERMA', 'Merma',           'virtual')
) AS v(codigo, nombre, tipo)
ON CONFLICT (empresa_id, codigo) DO NOTHING;

-- Una por camioneta. El número sale del orden en que se crearon, que es como
-- las nombra la pantalla de Camionetas.
INSERT INTO almacenes (empresa_id, codigo, nombre, tipo, camioneta_id)
SELECT c.empresa_id,
       'CAM-' || c.n,
       COALESCE(NULLIF(trim(c.nombre), ''), 'Camioneta ' || c.n),
       'movil',
       c.id
FROM (
  SELECT id, empresa_id, nombre,
         row_number() OVER (PARTITION BY empresa_id ORDER BY created_at, id) AS n
  FROM camionetas
) c
ON CONFLICT (empresa_id, codigo) DO NOTHING;

-- Una camioneta nueva nace con su almacén: si no, cargarla no tendría dónde
-- anotar el traslado y volveríamos al problema de hoy.
CREATE OR REPLACE FUNCTION almacen_de_camioneta_nueva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_n int := 1;
BEGIN
  -- Se busca el primer número LIBRE, no «cuántas hay + 1»: si una camioneta se
  -- dio de baja, ese código ya está tomado y con `ON CONFLICT DO NOTHING` la
  -- camioneta nueva se habría quedado sin almacén sin que nadie se enterara.
  WHILE EXISTS (
    SELECT 1 FROM almacenes
     WHERE empresa_id = NEW.empresa_id AND codigo = 'CAM-' || v_n
  ) LOOP
    v_n := v_n + 1;
  END LOOP;

  INSERT INTO almacenes (empresa_id, codigo, nombre, tipo, camioneta_id)
  VALUES (NEW.empresa_id, 'CAM-' || v_n,
          COALESCE(NULLIF(trim(NEW.nombre), ''), 'Camioneta ' || v_n),
          'movil', NEW.id);

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_almacen_camioneta_nueva ON camionetas;
CREATE TRIGGER trg_almacen_camioneta_nueva
  AFTER INSERT ON camionetas
  FOR EACH ROW EXECUTE FUNCTION almacen_de_camioneta_nueva();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) normalizar_almacen — las cuatro grafías a un solo código
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Es la MISMA tabla de equivalencias que `src/modules/inventario/almacenes.ts`.
-- Si acá se agrega una, allá también.
--
-- Devuelve NULL ante lo desconocido A PROPÓSITO: adivinar el almacén de una
-- fila es peor que dejarla sin almacén, porque el saldo quedaría mal en dos
-- lugares a la vez.
CREATE OR REPLACE FUNCTION normalizar_almacen(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_texto IS NULL OR btrim(p_texto) = '' THEN NULL
    WHEN upper(btrim(p_texto)) IN ('MP','MATERIAS_PRIMAS','MATERIAS PRIMAS','MATERIA PRIMA','MATERIAS-PRIMAS')
      THEN 'MP'
    WHEN upper(btrim(p_texto)) IN ('LIB','LIBERADO','LIBERADOS')
      THEN 'LIB'
    WHEN upper(btrim(p_texto)) IN ('MERMA','MERMAS','BAJA')
      THEN 'MERMA'
    WHEN upper(btrim(p_texto)) IN ('GALPON','GALPÓN')
      THEN 'GALPON'
    WHEN upper(btrim(p_texto)) = 'ROLZZO'
      THEN 'ROLZZO'
    WHEN upper(btrim(p_texto)) ~ '^CAM[- ]?[0-9]+$'
      THEN 'CAM-' || regexp_replace(upper(btrim(p_texto)), '^CAM[- ]?', '')
    ELSE NULL
  END;
$fn$;

DO $$
BEGIN
  -- Las cuatro grafías que hay en producción tienen que caer donde corresponde.
  IF normalizar_almacen('MATERIAS_PRIMAS') IS DISTINCT FROM 'MP'
     OR normalizar_almacen('MATERIAS PRIMAS') IS DISTINCT FROM 'MP'
     OR normalizar_almacen('mp') IS DISTINCT FROM 'MP'
     OR normalizar_almacen('LIBERADO') IS DISTINCT FROM 'LIB'
     OR normalizar_almacen('CAM 2') IS DISTINCT FROM 'CAM-2'
     OR normalizar_almacen('cualquier cosa') IS NOT NULL THEN
    RAISE EXCEPTION 'normalizar_almacen no traduce como debe';
  END IF;
  RAISE NOTICE '3) normalizar_almacen: las cuatro grafías traducen bien';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) insumos — unidad de medida y objetivo de compra
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Todo lo que hay hoy se cuenta por unidad, así que ese es el default y ningún
-- saldo cambia. La cadena metálica es el caso que espera esto: se compra en
-- ROLLOS de N metros, y hasta ahora el rollo y el metro eran el mismo número.
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS unidad text NOT NULL DEFAULT 'un';
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS contenido_por_unidad numeric(12,3);
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS stock_maximo integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'insumos'::regclass AND conname = 'insumos_unidad_fkey'
  ) THEN
    ALTER TABLE insumos
      ADD CONSTRAINT insumos_unidad_fkey FOREIGN KEY (unidad) REFERENCES unidades(codigo);
  END IF;
END $$;

COMMENT ON COLUMN insumos.stock_maximo IS
  'Hasta cuánto conviene reponer. El mínimo avisa; el máximo dice cuánto pedir.';
COMMENT ON COLUMN insumos.contenido_por_unidad IS
  'Cuánto trae cada unidad cuando no se compra por pieza (metros por rollo, etc.).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) telas_catalogo — stock máximo y el total CALCULADO
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE telas_catalogo ADD COLUMN IF NOT EXISTS stock_maximo numeric(12,3);

-- En insumos, `stock_total` es una columna calculada desde 'mp + liberado' y
-- por eso nunca se desalinea. En telas es una columna suelta que alguien tiene
-- que acordarse de actualizar, y ya se desalineó en 4 códigos por una décima.
-- Se deja calculada, como la de insumos.
DO $$
DECLARE
  v_generada text;
  v_desalineadas int;
  v_detalle text;
BEGIN
  SELECT is_generated INTO v_generada
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'telas_catalogo'
     AND column_name = 'stock_total';

  IF v_generada = 'ALWAYS' THEN
    RAISE NOTICE '5) telas_catalogo.stock_total ya estaba calculada: no se toca';
    RETURN;
  END IF;

  SELECT count(*), string_agg(codigo || ' (' || COALESCE(stock_total,0) || ' → ' ||
           (COALESCE(stock_mp,0) + COALESCE(stock_liberado,0)) || ')', ', ' ORDER BY codigo)
    INTO v_desalineadas, v_detalle
    FROM telas_catalogo
   WHERE COALESCE(stock_total,0) <> COALESCE(stock_mp,0) + COALESCE(stock_liberado,0);

  IF v_desalineadas > 0 THEN
    RAISE NOTICE '5) % tela(s) tenían el total desalineado y quedan cuadradas: %',
      v_desalineadas, v_detalle;
  END IF;

  -- Sin vistas que dependan de la columna (verificado): se puede rehacer.
  ALTER TABLE telas_catalogo DROP COLUMN stock_total;
  ALTER TABLE telas_catalogo
    ADD COLUMN stock_total numeric
    GENERATED ALWAYS AS (COALESCE(stock_mp,0) + COALESCE(stock_liberado,0)) STORED;

  RAISE NOTICE '5) telas_catalogo.stock_total ahora se calcula sola';
END $$;

-- Ningún saldo de tela se movió más allá de la décima que estaba mal sumada.
DO $$
DECLARE v_malas int;
BEGIN
  SELECT count(*) INTO v_malas
    FROM telas_catalogo t
    JOIN inv_saldos_backup_kardex_20260908 b ON b.id = t.id AND b.dominio = 'tela'
   WHERE COALESCE(t.stock_mp,0) <> b.stock_mp
      OR COALESCE(t.stock_liberado,0) <> b.stock_liberado;
  IF v_malas > 0 THEN
    RAISE EXCEPTION 'Se movió el saldo de % telas: eso no debía pasar', v_malas;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Las ubicaciones apuntan al almacén por id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ubicaciones_rack ADD COLUMN IF NOT EXISTS almacen_id uuid REFERENCES almacenes(id);
ALTER TABLE telas_slots      ADD COLUMN IF NOT EXISTS almacen_id uuid REFERENCES almacenes(id);

UPDATE ubicaciones_rack u
   SET almacen_id = a.id
  FROM almacenes a
 WHERE a.empresa_id = u.empresa_id
   AND a.codigo = normalizar_almacen(u.almacen)
   AND u.almacen_id IS DISTINCT FROM a.id;

-- OJO: telas_slots.empresa_id es TEXT, no uuid (así está en producción). Sin el
-- cast la comparación falla en tiempo de ejecución.
UPDATE telas_slots s
   SET almacen_id = a.id
  FROM almacenes a
 WHERE a.empresa_id::text = s.empresa_id
   AND a.codigo = normalizar_almacen(s.almacen)
   AND s.almacen_id IS DISTINCT FROM a.id;

DO $$
DECLARE v_rack int; v_slots int;
BEGIN
  SELECT count(*) INTO v_rack  FROM ubicaciones_rack
   WHERE almacen_id IS NULL AND normalizar_almacen(almacen) IS NOT NULL;
  SELECT count(*) INTO v_slots FROM telas_slots
   WHERE almacen_id IS NULL AND normalizar_almacen(almacen) IS NOT NULL;
  IF v_rack > 0 OR v_slots > 0 THEN
    RAISE EXCEPTION 'Quedaron % posiciones de rack y % de telas con almacén conocido y sin id',
      v_rack, v_slots;
  END IF;
  RAISE NOTICE '6) Posiciones enlazadas: % en rack, % en telas',
    (SELECT count(*) FROM ubicaciones_rack WHERE almacen_id IS NOT NULL),
    (SELECT count(*) FROM telas_slots      WHERE almacen_id IS NOT NULL);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) inventario_camioneta — que sepa de qué empresa es
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Hoy solo cuelga del insumo y de la camioneta; para consultarla por empresa
-- hay que pasar siempre por `camionetas`, y el kardex la necesita directa.
ALTER TABLE inventario_camioneta ADD COLUMN IF NOT EXISTS empresa_id uuid;

UPDATE inventario_camioneta ic
   SET empresa_id = c.empresa_id
  FROM camionetas c
 WHERE c.id = ic.camioneta_id
   AND ic.empresa_id IS DISTINCT FROM c.empresa_id;

DO $$
DECLARE v_huerfanas int;
BEGIN
  SELECT count(*) INTO v_huerfanas FROM inventario_camioneta WHERE empresa_id IS NULL;
  IF v_huerfanas > 0 THEN
    RAISE EXCEPTION '% líneas de camioneta sin empresa: se aborta', v_huerfanas;
  END IF;
END $$;

-- La policy vieja llegaba a la empresa dando la vuelta por `camionetas`. Ahora
-- que la columna existe, se compara directo (y sigue valiendo lo mismo).
DROP POLICY IF EXISTS empresa_isolation ON inventario_camioneta;
CREATE POLICY empresa_isolation ON inventario_camioneta FOR ALL
  USING (
    empresa_id = (SELECT get_my_empresa_id())
    OR camioneta_id IN (SELECT id FROM camionetas WHERE empresa_id = (SELECT get_my_empresa_id()))
  )
  WITH CHECK (
    camioneta_id IN (SELECT id FROM camionetas WHERE empresa_id = (SELECT get_my_empresa_id()))
  );

CREATE INDEX IF NOT EXISTS idx_inv_camioneta_empresa
  ON inventario_camioneta(empresa_id, insumo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) Verificación final — ningún saldo se movió
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_dif int; v_alm int;
BEGIN
  SELECT count(*) INTO v_dif
    FROM inv_saldos_backup_kardex_20260908 b
    JOIN insumos i ON i.id = b.id AND b.dominio = 'insumo'
   WHERE i.stock_mp::numeric <> b.stock_mp
      OR i.stock_liberado::numeric <> b.stock_liberado;
  IF v_dif > 0 THEN
    RAISE EXCEPTION 'Cambió el saldo de % insumos: eso no debía pasar', v_dif;
  END IF;

  SELECT count(*) INTO v_alm FROM almacenes;
  RAISE NOTICE '8) OK · % almacenes · % unidades · saldos intactos',
    v_alm, (SELECT count(*) FROM unidades);
END $$;

DO $$ BEGIN RAISE NOTICE '=== Inventario 01 · catálogos — COMPLETADO ==='; END $$;

COMMIT;

-- PostgREST tiene que enterarse de las tablas y columnas nuevas.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Smoke tests (correr a mano después)
--
-- 1) Los almacenes quedaron creados:
--    SELECT codigo, nombre, tipo, activo FROM almacenes ORDER BY codigo;
--    -- MP, LIB, MERMA y una CAM-<n> por camioneta
--
-- 2) Las cuatro grafías traducen al mismo código:
--    SELECT DISTINCT almacen, normalizar_almacen(almacen) FROM ubicaciones_rack
--    UNION SELECT DISTINCT almacen, normalizar_almacen(almacen) FROM telas_slots;
--
-- 3) Ninguna posición quedó sin almacén:
--    SELECT count(*) FROM ubicaciones_rack WHERE almacen_id IS NULL;   -- 0
--    SELECT count(*) FROM telas_slots      WHERE almacen_id IS NULL;   -- 0
--
-- 4) El total de las telas ahora se calcula solo (no se puede escribir):
--    UPDATE telas_catalogo SET stock_total = 999 WHERE codigo = 'BK 59';
--    -- ERROR esperado: cannot insert into generated column
--
-- 5) Los saldos siguen iguales que en el respaldo:
--    SELECT count(*) FROM inv_saldos_backup_kardex_20260908 b
--      JOIN insumos i ON i.id = b.id AND b.dominio = 'insumo'
--     WHERE i.stock_mp <> b.stock_mp OR i.stock_liberado <> b.stock_liberado;  -- 0
--
-- ============================================================================
-- REVERSA (si algo saliera mal, en este orden)
--
--   BEGIN;
--   DROP TRIGGER IF EXISTS trg_almacen_camioneta_nueva ON camionetas;
--   DROP FUNCTION IF EXISTS almacen_de_camioneta_nueva();
--   ALTER TABLE ubicaciones_rack DROP COLUMN IF EXISTS almacen_id;
--   ALTER TABLE telas_slots      DROP COLUMN IF EXISTS almacen_id;
--   ALTER TABLE inventario_camioneta DROP COLUMN IF EXISTS empresa_id;
--   ALTER TABLE insumos DROP COLUMN IF EXISTS unidad,
--                       DROP COLUMN IF EXISTS contenido_por_unidad,
--                       DROP COLUMN IF EXISTS stock_maximo;
--   ALTER TABLE telas_catalogo DROP COLUMN IF EXISTS stock_maximo;
--   -- devolver stock_total de las telas a columna suelta, con sus valores viejos:
--   ALTER TABLE telas_catalogo DROP COLUMN stock_total;
--   ALTER TABLE telas_catalogo ADD COLUMN stock_total numeric;
--   UPDATE telas_catalogo t SET stock_total = b.stock_total
--     FROM inv_saldos_backup_kardex_20260908 b
--    WHERE b.id = t.id AND b.dominio = 'tela';
--   DROP FUNCTION IF EXISTS normalizar_almacen(text);
--   DROP TABLE IF EXISTS almacenes;
--   DROP TABLE IF EXISTS unidades;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
-- ============================================================================
