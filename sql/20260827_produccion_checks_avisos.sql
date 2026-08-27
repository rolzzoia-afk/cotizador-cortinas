-- ============================================================================
-- Módulo Producción visual — avance del taller + avisos de emergencia
-- Fecha: 2026-08-27
-- ============================================================================
--
-- Contexto:
--   El taller trabaja hoy con el Excel del plan de corte y los PDF de la OT.
--   El módulo /produccion los muestra EN PANTALLA y deja que el operario vaya
--   marcando lo que ya hizo, con el avance en vivo entre navegadores.
--
--   Ese avance NO puede vivir en `ots.datos_generales`: la app guarda la OT
--   ENTERA en cada upsert, así que dos operarios marcando a la vez se pisarían
--   (last-write-wins). Por eso una fila por check, con su UNIQUE.
--
-- Tablas:
--   1) produccion_checks   — una fila por cosa marcada.
--   2) avisos_produccion   — el botón de emergencia de cada pantalla.
--
-- Convenciones del repo:
--   · empresa_id uuid NOT NULL SIN foreign key (igual que el resto).
--   · RLS por empresa_id contra `perfiles`.
--   · Idempotente: se puede correr dos veces sin romper nada.
--
-- Reversibilidad:
--   DROP TABLE produccion_checks; DROP TABLE avisos_produccion;
--   (no toca ninguna tabla existente)
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Producción: checks + avisos — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) produccion_checks — el avance del taller, una fila por marca
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `clave` identifica QUÉ se marcó dentro del área:
--   · Estructura : 'r{idx}'  = índice de la fila en plan.resultados[]
--   · Paños      : el pieceId de la pieza de tela
--   · Prueba     : el id de la ventana
--   · Bodega     : '{GRUPO}|{CODIGO}'
--   · Sentinels  : '__area__' (el área quedó lista), '__inicio__|{GRUPO}',
--                  '__fin__|{GRUPO}', '__rack__|{GRUPO}' (el rack va en `nota`)
--
-- `ref` acota la clave a un contexto: en Estructura es el plan_id, porque un
-- plan corregido nace con id nuevo y su avance tiene que empezar de cero en
-- vez de heredar marcas de filas que ya no existen.
CREATE TABLE IF NOT EXISTS produccion_checks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  ot            text NOT NULL,
  area          text NOT NULL,
  ref           text NOT NULL DEFAULT '',
  clave         text NOT NULL,
  hecho         boolean NOT NULL DEFAULT true,
  nota          text,
  hecho_por     text,
  hecho_por_id  uuid,
  hecho_en      timestamptz NOT NULL DEFAULT now()
);

-- El CHECK y el UNIQUE se agregan aparte para que correr el script dos veces
-- no falle con "constraint already exists".
DO $$
BEGIN
  ALTER TABLE produccion_checks DROP CONSTRAINT IF EXISTS produccion_checks_area_check;
  ALTER TABLE produccion_checks ADD CONSTRAINT produccion_checks_area_check
    CHECK (area IN ('estructura','panos','dimensionado','armado','prueba','bodega'));

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'produccion_checks'::regclass
      AND conname  = 'produccion_checks_unico'
  ) THEN
    ALTER TABLE produccion_checks
      ADD CONSTRAINT produccion_checks_unico UNIQUE (empresa_id, area, ot, ref, clave);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prod_checks_ot ON produccion_checks(empresa_id, ot, area);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) avisos_produccion — el botón de emergencia de cada pantalla
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS avisos_produccion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  ot           text NOT NULL DEFAULT '',
  area         text NOT NULL DEFAULT 'general',
  mensaje      text NOT NULL,
  creado_por   text,
  creado_por_id uuid,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  atendido     boolean NOT NULL DEFAULT false,
  atendido_por text,
  atendido_en  timestamptz
);

DO $$
BEGIN
  ALTER TABLE avisos_produccion DROP CONSTRAINT IF EXISTS avisos_produccion_area_check;
  ALTER TABLE avisos_produccion ADD CONSTRAINT avisos_produccion_area_check
    CHECK (area IN ('estructura','panos','dimensionado','armado','prueba','bodega','general'));
END $$;

CREATE INDEX IF NOT EXISTS idx_avisos_prod_pendientes
  ON avisos_produccion(empresa_id, atendido, creado_en DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Row Level Security — por empresa, como el resto de las tablas
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE produccion_checks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos_produccion  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prod_checks_select_empresa ON produccion_checks;
CREATE POLICY prod_checks_select_empresa ON produccion_checks FOR SELECT
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS prod_checks_insert_empresa ON produccion_checks;
CREATE POLICY prod_checks_insert_empresa ON produccion_checks FOR INSERT
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS prod_checks_update_empresa ON produccion_checks;
CREATE POLICY prod_checks_update_empresa ON produccion_checks FOR UPDATE
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS prod_checks_delete_empresa ON produccion_checks;
CREATE POLICY prod_checks_delete_empresa ON produccion_checks FOR DELETE
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS avisos_prod_select_empresa ON avisos_produccion;
CREATE POLICY avisos_prod_select_empresa ON avisos_produccion FOR SELECT
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS avisos_prod_insert_empresa ON avisos_produccion;
CREATE POLICY avisos_prod_insert_empresa ON avisos_produccion FOR INSERT
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS avisos_prod_update_empresa ON avisos_produccion;
CREATE POLICY avisos_prod_update_empresa ON avisos_produccion FOR UPDATE
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS avisos_prod_delete_empresa ON avisos_produccion;
CREATE POLICY avisos_prod_delete_empresa ON avisos_produccion FOR DELETE
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Realtime — sin esto dos operarios en la misma OT no se ven entre ellos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'produccion_checks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produccion_checks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'avisos_produccion'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.avisos_produccion;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Producción: checks + avisos — COMPLETADO ==='; END $$;

COMMIT;

-- PostgREST tiene que enterarse de las tablas nuevas.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Smoke tests (correr a mano después, reemplazando <empresa-uuid>):
--
-- 1) Marcar una fila del plan:
--    INSERT INTO produccion_checks (empresa_id, ot, area, ref, clave, hecho_por)
--    VALUES ('<empresa-uuid>', '3197', 'estructura', 'plan-demo', 'r0', 'Prueba')
--    RETURNING id, hecho, hecho_en;
--
-- 2) Volver a marcarla NO puede duplicar (el upsert de la app usa este UNIQUE):
--    INSERT INTO produccion_checks (empresa_id, ot, area, ref, clave, hecho)
--    VALUES ('<empresa-uuid>', '3197', 'estructura', 'plan-demo', 'r0', false)
--    ON CONFLICT (empresa_id, area, ot, ref, clave)
--    DO UPDATE SET hecho = EXCLUDED.hecho, hecho_en = now()
--    RETURNING id, hecho;   -- mismo id, hecho = false
--
-- 3) Un área que no existe tiene que ser rechazada:
--    INSERT INTO produccion_checks (empresa_id, ot, area, clave)
--    VALUES ('<empresa-uuid>', '3197', 'pintura', 'r0');   -- ERROR esperado
--
-- 4) Aviso de emergencia:
--    INSERT INTO avisos_produccion (empresa_id, ot, area, mensaje, creado_por)
--    VALUES ('<empresa-uuid>', '3197', 'estructura', 'Falta el tubo E39', 'Prueba')
--    RETURNING id, atendido;
--
-- 5) Limpiar:
--    DELETE FROM produccion_checks WHERE ref = 'plan-demo';
--    DELETE FROM avisos_produccion WHERE mensaje = 'Falta el tubo E39';
--
-- 6) Realtime publicado:
--    SELECT tablename FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' ORDER BY tablename;
--    -- debe incluir avisos_produccion y produccion_checks
-- ============================================================================
