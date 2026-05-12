-- ============================================================================
-- CRM Fase 1 — Pipeline de Leads
-- Fecha: 2026-05-12
-- ============================================================================
--
-- Contexto:
--   Propuesta CRM (Ivo Matulic, 2026-05-12) plantea pipeline comercial pre-OT
--   con captura de leads, asignación a vendedora y conversión a cotización.
--   Fase 1 es 100% interna — sin dependencias de terceros.
--
-- Decisiones:
--   - 12 estados (set completo de la propuesta), no agrupados.
--   - Tabla `leads` separada de `ots` (un lead puede no convertirse nunca).
--   - FK opcional `ot_id` para vincular cuando se convierte.
--   - Log `leads_actividad` para historial de cambios.
--   - 2 RPCs: cambiar_estado (con auditoría) y vincular_ot (al crear cotización).
--
-- Reversibilidad:
--   DROP FUNCTION lead_cambiar_estado, lead_vincular_ot;
--   DROP TABLE leads_actividad, leads;
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== CRM Fase 1: Pipeline de leads — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Tabla leads
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  nombre          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensivo: si la tabla `leads` pre-existía con otro shape (e.g. de un
-- experimento previo), agregamos las columnas faltantes sin destruir datos.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS empresa_id          uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS nombre              text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS telefono            text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email               text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rut                 text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS canal               text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ubicacion           text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS vendedora_id        uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado              text NOT NULL DEFAULT 'nuevo';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_perdida      text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_estimado      numeric;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS comentarios         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ot_id               uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_actividad_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at          timestamptz NOT NULL DEFAULT now();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- FKs: agregar solo si no existen ya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_vendedora_id_fkey' AND conrelid = 'leads'::regclass
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_vendedora_id_fkey
      FOREIGN KEY (vendedora_id) REFERENCES perfiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_ot_id_fkey' AND conrelid = 'leads'::regclass
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_ot_id_fkey
      FOREIGN KEY (ot_id) REFERENCES ots(id) ON DELETE SET NULL;
  END IF;
END $$;

-- CHECK constraint del estado: solo si no existe (evita reescribir si pre-existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_estado_check' AND conrelid = 'leads'::regclass
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_estado_check CHECK (estado IN (
      'nuevo','contactado','visita_agendada','visita_realizada',
      'cotizando','cotizado','negociacion','en_espera',
      'ganado','perdido_precio','perdido_competencia','perdido_otro'
    ));
  END IF;
END $$;

-- empresa_id debe ser NOT NULL (si la tabla pre-existía sin la columna,
-- el ALTER de arriba la agregó nullable; ahora la forzamos a NOT NULL
-- asumiendo que está vacía o todos los rows tienen empresa_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads'
      AND column_name = 'empresa_id' AND is_nullable = 'YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM leads WHERE empresa_id IS NULL
  ) THEN
    ALTER TABLE leads ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_empresa          ON leads(empresa_id);
CREATE INDEX IF NOT EXISTS idx_leads_empresa_estado   ON leads(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_leads_empresa_vend     ON leads(empresa_id, vendedora_id);
CREATE INDEX IF NOT EXISTS idx_leads_ot               ON leads(ot_id) WHERE ot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_empresa_act      ON leads(empresa_id, ultima_actividad_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Trigger updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION leads_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION leads_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Tabla actividad (audit log)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads_actividad (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensivo: agregar columnas si la tabla pre-existía
ALTER TABLE leads_actividad ADD COLUMN IF NOT EXISTS empresa_id      uuid;
ALTER TABLE leads_actividad ADD COLUMN IF NOT EXISTS tipo            text;
ALTER TABLE leads_actividad ADD COLUMN IF NOT EXISTS detalle         jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads_actividad ADD COLUMN IF NOT EXISTS registrado_por  uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_actividad_lead_id_fkey' AND conrelid = 'leads_actividad'::regclass
  ) THEN
    ALTER TABLE leads_actividad
      ADD CONSTRAINT leads_actividad_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_actividad_registrado_por_fkey' AND conrelid = 'leads_actividad'::regclass
  ) THEN
    ALTER TABLE leads_actividad
      ADD CONSTRAINT leads_actividad_registrado_por_fkey
      FOREIGN KEY (registrado_por) REFERENCES perfiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_actividad_tipo_check' AND conrelid = 'leads_actividad'::regclass
  ) THEN
    ALTER TABLE leads_actividad ADD CONSTRAINT leads_actividad_tipo_check CHECK (tipo IN (
      'creado','cambio_estado','comentario','asignacion','conversion_ot','edicion'
    ));
  END IF;

  -- empresa_id y tipo deben ser NOT NULL si están vacíos / nuevos
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads_actividad'
      AND column_name = 'empresa_id' AND is_nullable = 'YES'
  ) AND NOT EXISTS (SELECT 1 FROM leads_actividad WHERE empresa_id IS NULL) THEN
    ALTER TABLE leads_actividad ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads_actividad'
      AND column_name = 'tipo' AND is_nullable = 'YES'
  ) AND NOT EXISTS (SELECT 1 FROM leads_actividad WHERE tipo IS NULL) THEN
    ALTER TABLE leads_actividad ALTER COLUMN tipo SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_actividad_lead     ON leads_actividad(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_actividad_empresa  ON leads_actividad(empresa_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_actividad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select_empresa ON leads;
CREATE POLICY leads_select_empresa ON leads FOR SELECT
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS leads_insert_empresa ON leads;
CREATE POLICY leads_insert_empresa ON leads FOR INSERT
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS leads_update_empresa ON leads;
CREATE POLICY leads_update_empresa ON leads FOR UPDATE
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS leads_delete_empresa ON leads;
CREATE POLICY leads_delete_empresa ON leads FOR DELETE
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS leads_actividad_select_empresa ON leads_actividad;
CREATE POLICY leads_actividad_select_empresa ON leads_actividad FOR SELECT
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS leads_actividad_insert_empresa ON leads_actividad;
CREATE POLICY leads_actividad_insert_empresa ON leads_actividad FOR INSERT
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) RPC: lead_cambiar_estado
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lead_cambiar_estado(
  p_lead_id        uuid,
  p_nuevo_estado   text,
  p_motivo         text DEFAULT NULL,
  p_comentario     text DEFAULT NULL
) RETURNS leads AS $$
DECLARE
  v_lead    leads;
  v_anterior text;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  v_anterior := v_lead.estado;

  UPDATE leads SET
    estado = p_nuevo_estado,
    motivo_perdida = CASE
      WHEN p_nuevo_estado LIKE 'perdido%' THEN COALESCE(p_motivo, motivo_perdida)
      ELSE NULL
    END,
    ultima_actividad_at = now()
  WHERE id = p_lead_id
  RETURNING * INTO v_lead;

  INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por)
  VALUES (
    p_lead_id,
    v_lead.empresa_id,
    'cambio_estado',
    jsonb_build_object(
      'de', v_anterior,
      'a', p_nuevo_estado,
      'motivo', p_motivo,
      'comentario', p_comentario
    ),
    auth.uid()
  );

  RETURN v_lead;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) RPC: lead_vincular_ot — usada al crear cotización desde lead
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lead_vincular_ot(
  p_lead_id  uuid,
  p_ot_id    uuid
) RETURNS leads AS $$
DECLARE
  v_lead leads;
BEGIN
  UPDATE leads SET
    ot_id = p_ot_id,
    estado = CASE
      WHEN estado IN ('ganado', 'perdido_precio', 'perdido_competencia', 'perdido_otro')
        THEN estado
      ELSE 'cotizando'
    END,
    ultima_actividad_at = now()
  WHERE id = p_lead_id
  RETURNING * INTO v_lead;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por)
  VALUES (
    p_lead_id,
    v_lead.empresa_id,
    'conversion_ot',
    jsonb_build_object('ot_id', p_ot_id),
    auth.uid()
  );

  RETURN v_lead;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) RPC: lead_agregar_comentario
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lead_agregar_comentario(
  p_lead_id     uuid,
  p_texto       text
) RETURNS leads_actividad AS $$
DECLARE
  v_lead    leads;
  v_act     leads_actividad;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  UPDATE leads SET ultima_actividad_at = now() WHERE id = p_lead_id;

  INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por)
  VALUES (
    p_lead_id,
    v_lead.empresa_id,
    'comentario',
    jsonb_build_object('texto', p_texto),
    auth.uid()
  )
  RETURNING * INTO v_act;

  RETURN v_act;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION lead_cambiar_estado     TO authenticated;
GRANT EXECUTE ON FUNCTION lead_vincular_ot         TO authenticated;
GRANT EXECUTE ON FUNCTION lead_agregar_comentario  TO authenticated;

DO $$ BEGIN RAISE NOTICE '=== CRM Fase 1: Pipeline de leads — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Crear lead de prueba:
--    INSERT INTO leads (empresa_id, nombre, telefono, canal)
--    VALUES ('<tu-empresa-uuid>', 'Test Lead', '+56912345678', 'WhatsApp')
--    RETURNING id;
--
-- 2) Cambiar estado:
--    SELECT lead_cambiar_estado('<lead-id>'::uuid, 'contactado', NULL, 'Llamada inicial');
--
-- 3) Verificar actividad:
--    SELECT tipo, detalle, created_at FROM leads_actividad
--    WHERE lead_id = '<lead-id>'::uuid ORDER BY created_at DESC;
--
-- 4) Limpiar:
--    DELETE FROM leads WHERE nombre = 'Test Lead';
-- ============================================================================
