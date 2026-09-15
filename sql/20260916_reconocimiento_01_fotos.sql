-- ============================================================================
-- RECONOCIMIENTO 01 — identificar un insumo o una tela con la cámara
-- Fecha: 2026-09-16
-- ============================================================================
--
-- POR QUÉ:
--   En bodega hay cientos de insumos casi iguales y telas de tonos cercanos.
--   Hoy identificar uno exige leer la etiqueta o conocerlo de memoria. La idea
--   del dueño: apuntar la cámara y que la app diga cuál es.
--
--   Cómo funciona: cada foto se convierte en una «huella» numérica (un vector
--   de 1024 números) con un servicio externo, y se busca la más parecida entre
--   las fotos que ya se le enseñaron al sistema. La cuenta del parecido la hace
--   la BASE, con un índice hecho para eso (pgvector): mirar 5.000 fotos tarda
--   milisegundos y no depende del teléfono.
--
--   La app PROPONE hasta 5 candidatos; la persona confirma. Cada confirmación
--   se guarda como una foto de referencia más, así que el sistema mejora solo.
--
-- QUÉ HACE:
--   1. Enciende la extensión `vector` (la primera del repo).
--   2. `articulo_fotos` — las fotos de referencia y su huella, por artículo.
--   3. `reconocimientos` — el registro de cada consulta: qué se propuso, qué
--      eligió la persona y cuánto tardó cada parte. Es lo que permite CALIBRAR
--      los umbrales con datos reales en vez de a ojo.
--   4. Cinco funciones: indexar una foto, buscar parecidos, registrar una
--      consulta, confirmar el resultado y borrar una foto.
--   5. El bucket privado `reconocimiento` con la política de siempre.
--
-- QUÉ NO HACE:
--   - No toca `insumos` ni `telas_catalogo`: ni una columna, ni un trigger. Las
--     pantallas que ya existen no cambian de velocidad.
--   - No llama a ningún servicio externo: eso lo hace la función
--     `reconocer-articulo`, que es la única que tiene la llave.
--   - No enciende nada. El interruptor `reconocimiento` de Inventario →
--     Configuración manda; apagado, la función responde 409.
--
-- ORDEN DE EJECUCIÓN:
--   Después de `20260908_inventario_02_kardex.sql` (usa `inventario_flag`).
--   Al terminar: `npm run types:gen`.
--
-- IDEMPOTENTE: se puede correr dos veces.
-- REVERSA: al pie del archivo.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Reconocimiento 01 · fotos — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Lo que tiene que estar antes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.inventario_flag(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'RE-SETUP: falta inventario_flag(); corre antes sql/20260908_inventario_02_kardex.sql';
  END IF;
  IF to_regclass('public.insumos') IS NULL OR to_regclass('public.telas_catalogo') IS NULL THEN
    RAISE EXCEPTION 'RE-SETUP: faltan las tablas insumos / telas_catalogo';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) pgvector
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Va en el esquema `extensions`, que es donde Supabase deja las extensiones. Por
-- eso TODAS las funciones de acá abajo llevan `SET search_path = public,
-- extensions`: sin eso, el tipo `vector` y el operador `<=>` no se encuentran
-- DENTRO de la función, aunque en el editor SQL funcionen (el editor tiene otro
-- search_path y engaña).
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) articulo_fotos — las fotos que se le enseñaron al sistema
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `cod` es el código del artículo en MAYÚSCULAS y sin espacios de sobra: es
-- `insumos.cod` o `telas_catalogo.codigo`. No hay clave foránea a propósito —
-- renombrar un código no puede borrar las fotos que ya se enseñaron.
--
-- `bucket` NULL significa que `path` es la URL pública de la foto de la ficha
-- (`foto_url`), que se indexa de una vez sin volver a subir nada.
--
-- `origen`:
--   enrolamiento  alguien le enseñó el artículo a propósito, ángulo por ángulo
--   ficha         la foto que el artículo ya tenía, indexada en lote
--   confirmacion  una consulta que la persona confirmó: el sistema aprende solo
CREATE TABLE IF NOT EXISTS articulo_fotos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL,
  dominio           text NOT NULL CHECK (dominio IN ('insumo', 'tela')),
  cod               text NOT NULL,
  bucket            text,
  path              text NOT NULL,
  path_min          text,
  angulo            text NOT NULL DEFAULT 'libre'
                      CHECK (angulo IN ('frente','lado','arriba','etiqueta','escala','libre')),
  origen            text NOT NULL DEFAULT 'enrolamiento'
                      CHECK (origen IN ('enrolamiento','ficha','confirmacion')),
  embedding         extensions.vector(1024) NOT NULL,
  modelo            text NOT NULL,
  creado_por        uuid,
  creado_por_email  text,
  creada_en         timestamptz NOT NULL DEFAULT now()
);

-- La misma foto no se indexa dos veces: así el reindexado de las fichas se
-- puede correr todas las veces que haga falta.
CREATE UNIQUE INDEX IF NOT EXISTS articulo_fotos_unica
  ON articulo_fotos (empresa_id, dominio, cod, path);

CREATE INDEX IF NOT EXISTS articulo_fotos_articulo
  ON articulo_fotos (empresa_id, dominio, cod);

-- El índice que hace rápida la búsqueda por parecido. HNSW con distancia
-- coseno: el mismo operador (`<=>`) que usa `articulos_parecidos`. Si se usara
-- otra distancia, el índice no se aprovecharía y la búsqueda sería un barrido.
CREATE INDEX IF NOT EXISTS articulo_fotos_embedding
  ON articulo_fotos USING hnsw (embedding extensions.vector_cosine_ops);

ALTER TABLE articulo_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS articulo_fotos_select_empresa ON articulo_fotos;
CREATE POLICY articulo_fotos_select_empresa ON articulo_fotos
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT get_my_empresa_id()));
-- Sin políticas de escritura: se escribe por las funciones de más abajo.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) reconocimientos — qué se preguntó, qué se propuso y qué eligió la persona
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Es el cuaderno con el que se CALIBRAN los umbrales. Sin esto habría que
-- adivinar desde qué parecido una propuesta es «segura».
--
-- Los cuatro `ms_*` dicen dónde se va el tiempo (huella, búsqueda, segunda
-- opinión, total): si algún día esto se siente lento, el número ya está.
CREATE TABLE IF NOT EXISTS reconocimientos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL,
  dominio           text CHECK (dominio IN ('insumo', 'tela')),
  consulta_path     text,
  consulta_path_min text,
  embedding         extensions.vector(1024),
  candidatos        jsonb NOT NULL DEFAULT '[]'::jsonb,
  sugerido          text,
  juez_usado        boolean NOT NULL DEFAULT false,
  juez_eleccion     text,
  juez_codigo_leido text,
  juez_confianza    text,
  resultado         text NOT NULL DEFAULT 'pendiente'
                      CHECK (resultado IN ('pendiente','confirmado','ninguno')),
  elegido           text,
  elegido_dominio   text CHECK (elegido_dominio IN ('insumo', 'tela')),
  modelo            text,
  usuario_id        uuid,
  usuario_email     text,
  ms_embedding      int,
  ms_busqueda       int,
  ms_juez           int,
  ms_total          int,
  creada_en         timestamptz NOT NULL DEFAULT now(),
  confirmada_en     timestamptz
);

CREATE INDEX IF NOT EXISTS reconocimientos_empresa_fecha
  ON reconocimientos (empresa_id, creada_en DESC);

ALTER TABLE reconocimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reconocimientos_select_empresa ON reconocimientos;
CREATE POLICY reconocimientos_select_empresa ON reconocimientos
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT get_my_empresa_id()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Las funciones
-- ─────────────────────────────────────────────────────────────────────────────

-- ¿Quién llama puede trabajar sobre esta empresa? La función `reconocer-articulo`
-- entra con la llave de servicio (sin usuario) y ya verificó el perfil; una
-- persona solo puede tocar su propia empresa.
CREATE OR REPLACE FUNCTION reconocimiento_empresa_ok(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT auth.uid() IS NULL
      OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND empresa_id = p_empresa_id);
$fn$;

-- Guarda una foto ya subida, con su huella. `ON CONFLICT DO NOTHING`: repetir
-- el indexado de la misma foto no duplica ni falla.
CREATE OR REPLACE FUNCTION articulo_foto_indexar(
  p_empresa_id uuid,
  p_dominio    text,
  p_cod        text,
  p_bucket     text,
  p_path       text,
  p_path_min   text,
  p_angulo     text,
  p_origen     text,
  p_embedding  extensions.vector(1024),
  p_modelo     text,
  p_usuario_id uuid DEFAULT NULL,
  p_email      text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_id  uuid;
  v_cod text := upper(btrim(p_cod));
BEGIN
  IF NOT reconocimiento_empresa_ok(p_empresa_id) THEN
    RAISE EXCEPTION 'Esa foto no es de tu empresa' USING ERRCODE = 'RE001';
  END IF;
  IF v_cod = '' THEN
    RAISE EXCEPTION 'Falta el código del artículo' USING ERRCODE = 'RE002';
  END IF;

  INSERT INTO articulo_fotos (
    empresa_id, dominio, cod, bucket, path, path_min, angulo, origen,
    embedding, modelo, creado_por, creado_por_email
  )
  VALUES (
    p_empresa_id, p_dominio, v_cod, nullif(btrim(p_bucket), ''), p_path,
    nullif(btrim(p_path_min), ''), coalesce(nullif(p_angulo, ''), 'libre'),
    coalesce(nullif(p_origen, ''), 'enrolamiento'),
    p_embedding, p_modelo, p_usuario_id, p_email
  )
  ON CONFLICT (empresa_id, dominio, cod, path) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM articulo_fotos
    WHERE empresa_id = p_empresa_id AND dominio = p_dominio AND cod = v_cod AND path = p_path;
  END IF;
  RETURN v_id;
END $fn$;

-- Los artículos más parecidos a una huella.
--
-- Primero se piden las 60 fotos más cercanas (eso lo resuelve el índice HNSW),
-- después se agrupan por artículo con su mejor parecido y recién al final se
-- juntan con el nombre. Hacerlo en ese orden es lo que mantiene la consulta en
-- milisegundos: el join corre sobre 5 filas, no sobre todo el catálogo.
--
-- Devuelve dónde está la foto para la miniatura, no una URL: firmar la URL es
-- cosa de la función, que es la única que puede.
CREATE OR REPLACE FUNCTION articulos_parecidos(
  p_empresa_id uuid,
  p_embedding  extensions.vector(1024),
  p_dominio    text DEFAULT NULL,
  p_k          int DEFAULT 5,
  p_modelo     text DEFAULT NULL
)
RETURNS TABLE (
  dominio     text,
  cod         text,
  nombre      text,
  foto_url    text,
  foto_bucket text,
  foto_path   text,
  similitud   numeric,
  n_fotos     int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
BEGIN
  IF NOT reconocimiento_empresa_ok(p_empresa_id) THEN
    RAISE EXCEPTION 'No puedes buscar en otra empresa' USING ERRCODE = 'RE001';
  END IF;

  RETURN QUERY
  WITH cercanas AS (
    SELECT f.dominio, f.cod, f.bucket, f.path, f.path_min,
           1 - (f.embedding <=> p_embedding) AS sim
    FROM articulo_fotos f
    WHERE f.empresa_id = p_empresa_id
      AND (p_dominio IS NULL OR f.dominio = p_dominio)
      AND (p_modelo IS NULL OR f.modelo = p_modelo)
    ORDER BY f.embedding <=> p_embedding
    LIMIT 60
  ),
  mejores AS (
    SELECT DISTINCT ON (c.dominio, c.cod)
           c.dominio, c.cod, c.bucket, c.path, c.path_min, c.sim
    FROM cercanas c
    ORDER BY c.dominio, c.cod, c.sim DESC
  ),
  top AS (
    SELECT m.* FROM mejores m ORDER BY m.sim DESC LIMIT greatest(coalesce(p_k, 5), 1)
  )
  SELECT
    t.dominio,
    t.cod,
    CASE t.dominio
      WHEN 'insumo' THEN coalesce(nullif(btrim(i.nemotecnico), ''),
                                  nullif(btrim(i.descriptor_proveedor), ''),
                                  nullif(btrim(i.producto), ''), t.cod)
      ELSE coalesce(nullif(btrim(te.nemotecnico), ''),
                    nullif(btrim(te.descriptor), ''), t.cod)
    END::text AS nombre,
    CASE t.dominio WHEN 'insumo' THEN i.foto_url ELSE te.foto_url END::text AS foto_url,
    t.bucket::text AS foto_bucket,
    coalesce(t.path_min, t.path)::text AS foto_path,
    round(t.sim::numeric, 4) AS similitud,
    (SELECT count(*)::int FROM articulo_fotos f2
      WHERE f2.empresa_id = p_empresa_id AND f2.dominio = t.dominio AND f2.cod = t.cod) AS n_fotos
  FROM top t
  LEFT JOIN insumos i
    ON t.dominio = 'insumo' AND i.empresa_id = p_empresa_id AND upper(btrim(i.cod)) = t.cod
  LEFT JOIN telas_catalogo te
    ON t.dominio = 'tela' AND te.empresa_id = p_empresa_id AND upper(btrim(te.codigo)) = t.cod
  ORDER BY t.sim DESC;
END $fn$;

-- Deja escrita la consulta con lo que se propuso. La foto todavía no se guardó
-- en el bucket (se sube en paralelo); su ruta llega al confirmar.
CREATE OR REPLACE FUNCTION reconocimiento_registrar(
  p_empresa_id   uuid,
  p_dominio      text,
  p_embedding    extensions.vector(1024),
  p_candidatos   jsonb,
  p_sugerido     text,
  p_modelo       text,
  p_usuario_id   uuid,
  p_email        text,
  p_ms_embedding int DEFAULT NULL,
  p_ms_busqueda  int DEFAULT NULL,
  p_ms_total     int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  IF NOT reconocimiento_empresa_ok(p_empresa_id) THEN
    RAISE EXCEPTION 'No puedes escribir en otra empresa' USING ERRCODE = 'RE001';
  END IF;

  INSERT INTO reconocimientos (
    empresa_id, dominio, embedding, candidatos, sugerido, modelo,
    usuario_id, usuario_email, ms_embedding, ms_busqueda, ms_total
  )
  VALUES (
    p_empresa_id, nullif(p_dominio, ''), p_embedding,
    coalesce(p_candidatos, '[]'::jsonb), nullif(btrim(p_sugerido), ''), p_modelo,
    p_usuario_id, p_email, p_ms_embedding, p_ms_busqueda, p_ms_total
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

-- Lo que dijo la segunda opinión, cuando hubo dudas.
CREATE OR REPLACE FUNCTION reconocimiento_juez(
  p_id            uuid,
  p_eleccion      text,
  p_codigo_leido  text,
  p_confianza     text,
  p_candidatos    jsonb,
  p_ms_juez       int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_empresa FROM reconocimientos WHERE id = p_id;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Esa consulta no existe' USING ERRCODE = 'RE003';
  END IF;
  IF NOT reconocimiento_empresa_ok(v_empresa) THEN
    RAISE EXCEPTION 'Esa consulta no es de tu empresa' USING ERRCODE = 'RE001';
  END IF;

  UPDATE reconocimientos
  SET juez_usado    = true,
      juez_eleccion = nullif(btrim(p_eleccion), ''),
      juez_codigo_leido = nullif(btrim(p_codigo_leido), ''),
      juez_confianza = nullif(btrim(p_confianza), ''),
      candidatos    = coalesce(p_candidatos, candidatos),
      ms_juez       = p_ms_juez,
      sugerido      = coalesce(nullif(btrim(p_eleccion), ''), sugerido)
  WHERE id = p_id;
END $fn$;

-- La persona eligió. Si eligió un artículo, la foto de la consulta pasa a ser
-- una foto de referencia más: se copia la huella que YA se calculó, sin volver
-- a preguntarle al servicio. Aprender no cuesta nada.
CREATE OR REPLACE FUNCTION reconocimiento_confirmar(
  p_id       uuid,
  p_dominio  text DEFAULT NULL,
  p_elegido  text DEFAULT NULL,
  p_path     text DEFAULT NULL,
  p_path_min text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  r          reconocimientos%ROWTYPE;
  v_empresa  uuid;
  v_email    text;
  v_cod      text := upper(btrim(coalesce(p_elegido, '')));
BEGIN
  SELECT p.empresa_id, (auth.jwt() ->> 'email') INTO v_empresa, v_email
  FROM perfiles p WHERE p.id = auth.uid();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay sesión' USING ERRCODE = 'RE004';
  END IF;

  SELECT * INTO r FROM reconocimientos WHERE id = p_id AND empresa_id = v_empresa;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Esa consulta no existe' USING ERRCODE = 'RE003';
  END IF;

  UPDATE reconocimientos
  SET resultado         = CASE WHEN v_cod = '' THEN 'ninguno' ELSE 'confirmado' END,
      elegido           = nullif(v_cod, ''),
      elegido_dominio   = nullif(btrim(coalesce(p_dominio, '')), ''),
      consulta_path     = coalesce(nullif(btrim(coalesce(p_path, '')), ''), consulta_path),
      consulta_path_min = coalesce(nullif(btrim(coalesce(p_path_min, '')), ''), consulta_path_min),
      confirmada_en     = now()
  WHERE id = p_id;

  -- Aprender: solo si hay artículo, foto guardada y huella.
  IF v_cod <> '' AND p_path IS NOT NULL AND btrim(p_path) <> '' AND r.embedding IS NOT NULL THEN
    INSERT INTO articulo_fotos (
      empresa_id, dominio, cod, bucket, path, path_min, angulo, origen,
      embedding, modelo, creado_por, creado_por_email
    )
    VALUES (
      v_empresa, coalesce(nullif(btrim(coalesce(p_dominio, '')), ''), r.dominio, 'insumo'),
      v_cod, 'reconocimiento', p_path, nullif(btrim(coalesce(p_path_min, '')), ''),
      'libre', 'confirmacion', r.embedding, coalesce(r.modelo, 'desconocido'),
      auth.uid(), v_email
    )
    ON CONFLICT (empresa_id, dominio, cod, path) DO NOTHING;
  END IF;
END $fn$;

-- Sacar una foto de referencia que no sirve (salió movida, es de otro artículo).
-- El archivo del bucket lo borra el navegador después: la política lo permite.
CREATE OR REPLACE FUNCTION articulo_foto_borrar(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_empresa uuid;
BEGIN
  SELECT p.empresa_id INTO v_empresa FROM perfiles p WHERE p.id = auth.uid();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay sesión' USING ERRCODE = 'RE004';
  END IF;
  DELETE FROM articulo_fotos WHERE id = p_id AND empresa_id = v_empresa;
END $fn$;

-- Permisos: `anon` no entra a ninguna. Las que reciben `p_empresa_id` las llama
-- la función `reconocer-articulo` con la llave de servicio, y de todas formas
-- verifican la empresa de quien llama.
REVOKE ALL ON FUNCTION reconocimiento_empresa_ok(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION articulo_foto_indexar(uuid, text, text, text, text, text, text, text, extensions.vector, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION articulos_parecidos(uuid, extensions.vector, text, int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION reconocimiento_registrar(uuid, text, extensions.vector, jsonb, text, text, uuid, text, int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION reconocimiento_juez(uuid, text, text, text, jsonb, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION reconocimiento_confirmar(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION articulo_foto_borrar(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION reconocimiento_empresa_ok(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION articulo_foto_indexar(uuid, text, text, text, text, text, text, text, extensions.vector, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION articulos_parecidos(uuid, extensions.vector, text, int, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reconocimiento_registrar(uuid, text, extensions.vector, jsonb, text, text, uuid, text, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION reconocimiento_juez(uuid, text, text, text, jsonb, int) TO service_role;
GRANT EXECUTE ON FUNCTION reconocimiento_confirmar(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION articulo_foto_borrar(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) El bucket de las fotos
-- ─────────────────────────────────────────────────────────────────────────────
--
-- PRIVADO: son fotos de la bodega y no tienen por qué quedar en una URL que
-- cualquiera pueda abrir. Se ven con URL firmadas de una hora.
--
-- Acá SÍ se puede borrar desde el navegador (una foto movida, o la consulta que
-- no era de ningún artículo), así que va UNA sola política `FOR ALL` acotada a
-- la carpeta de la empresa — la misma forma que `fotos-telas`. Partirla en
-- INSERT/SELECT/DELETE rompería cualquier subida con `upsert`.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reconocimiento', 'reconocimiento', false, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 5242880,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS reconocimiento_rw ON storage.objects;
CREATE POLICY reconocimiento_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'reconocimiento'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  )
  WITH CHECK (
    bucket_id = 'reconocimiento'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Verificación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_faltan text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'No quedó instalada la extensión vector';
  END IF;
  IF to_regclass('public.articulo_fotos') IS NULL OR to_regclass('public.reconocimientos') IS NULL THEN
    RAISE EXCEPTION 'Faltan las tablas del reconocimiento';
  END IF;

  SELECT array_agg(f) INTO v_faltan
  FROM unnest(ARRAY[
    'articulo_foto_indexar','articulos_parecidos','reconocimiento_registrar',
    'reconocimiento_juez','reconocimiento_confirmar','articulo_foto_borrar',
    'reconocimiento_empresa_ok'
  ]) AS f
  WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f);
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan funciones: %', v_faltan;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'articulo_fotos_embedding'
      AND indexdef ILIKE '%hnsw%'
  ) THEN
    RAISE EXCEPTION 'Falta el índice HNSW: la búsqueda por parecido sería un barrido completo';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'reconocimiento' AND public = false) THEN
    RAISE EXCEPTION 'El bucket `reconocimiento` tiene que existir y ser privado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass AND polname = 'reconocimiento_rw'
  ) THEN
    RAISE EXCEPTION 'Falta la política reconocimiento_rw';
  END IF;

  RAISE NOTICE '=== Reconocimiento 01 · LISTO. Falta: desplegar reconocer-articulo, poner VOYAGE_API_KEY y encender el interruptor. ===';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICACIÓN A MANO (después de correr)
-- ============================================================================
-- 1) Cuántas fotos hay enseñadas, por dominio:
--    SELECT dominio, origen, count(*) FROM articulo_fotos GROUP BY 1,2 ORDER BY 1,2;
--
-- 2) Cuánto tarda de verdad una búsqueda (tiene que decir «Index Scan using
--    articulo_fotos_embedding»; si dice «Seq Scan», el índice no se está usando):
--    EXPLAIN ANALYZE
--    SELECT cod, 1 - (embedding <=> (SELECT embedding FROM articulo_fotos LIMIT 1)) AS sim
--    FROM articulo_fotos ORDER BY embedding <=> (SELECT embedding FROM articulo_fotos LIMIT 1) LIMIT 60;
--
-- 3) Calibrar los umbrales con lo que pasó de verdad:
--    SELECT dominio, resultado, juez_usado,
--           (candidatos->0->>'similitud')::numeric AS top1,
--           (candidatos->1->>'similitud')::numeric AS top2,
--           elegido = sugerido AS acierto, ms_total
--      FROM reconocimientos ORDER BY creada_en DESC;
--
-- ============================================================================
-- REVERSA (copiar y correr entero; no borra la extensión)
-- ============================================================================
-- BEGIN;
--   DROP POLICY IF EXISTS reconocimiento_rw ON storage.objects;
--   DROP FUNCTION IF EXISTS articulo_foto_borrar(uuid);
--   DROP FUNCTION IF EXISTS reconocimiento_confirmar(uuid, text, text, text, text);
--   DROP FUNCTION IF EXISTS reconocimiento_juez(uuid, text, text, text, jsonb, int);
--   DROP FUNCTION IF EXISTS reconocimiento_registrar(uuid, text, extensions.vector, jsonb, text, text, uuid, text, int, int, int);
--   DROP FUNCTION IF EXISTS articulos_parecidos(uuid, extensions.vector, text, int, text);
--   DROP FUNCTION IF EXISTS articulo_foto_indexar(uuid, text, text, text, text, text, text, text, extensions.vector, text, uuid, text);
--   DROP FUNCTION IF EXISTS reconocimiento_empresa_ok(uuid);
--   -- Las fotos NO se borran: se renombran, por si hay que volver atrás.
--   ALTER TABLE reconocimientos RENAME TO reconocimientos_retirado;
--   ALTER TABLE articulo_fotos  RENAME TO articulo_fotos_retirado;
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
