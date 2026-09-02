-- ============================================================================
-- Lotes de producción — juntar varias OTs para cortar la tela de una sola vez
-- Fecha: 2026-09-01
-- ============================================================================
--
-- Contexto:
--   El módulo /produccion solo deja trabajar UNA OT a la vez. El jefe de taller
--   necesita ver la cola de lo que está en producción y poder decir «estas tres
--   OTs se cortan juntas»: un lote. El plan de corte de tela del lote se arma
--   con las piezas de esas OTs y nada más.
--
--   Medido sobre 130 OTs reales: juntar OTs casi no ahorra metros (0,3 %), pero
--   consolida 278 paños en 231 → los sobrantes son menos y más grandes, que es
--   justo lo que pasa el mínimo de la colmena (120×180).
--
-- Tabla:
--   lotes_produccion — UNA FILA POR LOTE. Crear/deshacer son insert/delete de
--   una fila, no un read-modify-write de un array compartido: la empresa ya
--   perdió datos por pisarse escrituras sobre estado compartido (incidente de
--   colmena del 28/8), así que acá no se repite el patrón.
--
-- Convenciones del repo:
--   · empresa_id uuid NOT NULL SIN foreign key (igual que el resto).
--   · RLS por empresa_id contra `perfiles`; ESCRITURA solo admin/superadmin.
--   · Idempotente: se puede correr dos veces sin romper nada.
--
-- Reversibilidad:
--   DROP TABLE lotes_produccion;   (no toca ninguna tabla existente)
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Lotes de producción — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) lotes_produccion
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `ots` guarda [{ "id": "<uuid de la OT>", "numero": "<numero_ot crudo>" }]:
--   · el id filtra el plan de corte (es la llave real);
--   · el numero deja mostrarla y abrirla aunque la OT ya haya salido de
--     producción y no venga en la cola.
CREATE TABLE IF NOT EXISTS lotes_produccion (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  nombre        text NOT NULL,
  ots           jsonb NOT NULL DEFAULT '[]'::jsonb,
  creado_por    text,
  creado_por_id uuid,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- El UNIQUE va aparte para que correr el script dos veces no falle con
-- "constraint already exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'lotes_produccion'::regclass
      AND conname  = 'lotes_produccion_nombre_unico'
  ) THEN
    ALTER TABLE lotes_produccion
      ADD CONSTRAINT lotes_produccion_nombre_unico UNIQUE (empresa_id, nombre);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lotes_prod_empresa
  ON lotes_produccion(empresa_id, creado_en DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Row Level Security — todos LEEN, solo admin ESCRIBE
-- ─────────────────────────────────────────────────────────────────────────────
--
-- El operario tiene que ver los lotes (trabaja con ellos), pero armarlos y
-- deshacerlos es decisión del jefe. La UI esconde los botones; esta policy es
-- la que de verdad lo impide.
ALTER TABLE lotes_produccion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lotes_prod_select_empresa ON lotes_produccion;
CREATE POLICY lotes_prod_select_empresa ON lotes_produccion FOR SELECT
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS lotes_prod_insert_admin ON lotes_produccion;
CREATE POLICY lotes_prod_insert_admin ON lotes_produccion FOR INSERT
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM perfiles
      WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS lotes_prod_update_admin ON lotes_produccion;
CREATE POLICY lotes_prod_update_admin ON lotes_produccion FOR UPDATE
  USING (
    empresa_id IN (
      SELECT empresa_id FROM perfiles
      WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM perfiles
      WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS lotes_prod_delete_admin ON lotes_produccion;
CREATE POLICY lotes_prod_delete_admin ON lotes_produccion FOR DELETE
  USING (
    empresa_id IN (
      SELECT empresa_id FROM perfiles
      WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Realtime — el jefe arma el lote en la oficina y el taller lo ve al toque
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'lotes_produccion'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lotes_produccion;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Lotes de producción — COMPLETADO ==='; END $$;

COMMIT;

-- PostgREST tiene que enterarse de la tabla nueva.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Smoke tests (correr a mano después, reemplazando <empresa-uuid>):
--
-- 1) Crear un lote:
--    INSERT INTO lotes_produccion (empresa_id, nombre, ots, creado_por)
--    VALUES ('<empresa-uuid>', 'LOTE DEMO',
--            '[{"id":"<uuid-ot-1>","numero":"3189"}]'::jsonb, 'Prueba')
--    RETURNING id, nombre, ots;
--
-- 2) El nombre no se puede repetir dentro de la empresa:
--    INSERT INTO lotes_produccion (empresa_id, nombre)
--    VALUES ('<empresa-uuid>', 'LOTE DEMO');   -- ERROR 23505 esperado
--
-- 3) Los lotes se leen:
--    SELECT nombre, jsonb_array_length(ots) AS ots, creado_por
--    FROM lotes_produccion WHERE empresa_id = '<empresa-uuid>';
--
-- 4) Escribir con un usuario NO admin tiene que ser rechazado (probar desde la
--    app con una cuenta de rol 'operario': el botón no existe y, si se llama la
--    API a mano, la policy devuelve 0 filas / error de RLS).
--
-- 5) Limpiar:
--    DELETE FROM lotes_produccion WHERE nombre = 'LOTE DEMO';
--
-- 6) Realtime publicado:
--    SELECT tablename FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' ORDER BY tablename;
--    -- debe incluir lotes_produccion
-- ============================================================================
