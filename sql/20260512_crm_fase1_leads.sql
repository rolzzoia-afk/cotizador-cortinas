-- ============================================================================
-- CRM Fase 1 — Pipeline de Leads (integrado con tabla del Agente IA)
-- Fecha: 2026-05-12
-- ============================================================================
--
-- Contexto:
--   La tabla `leads` YA EXISTE en la BD, creada para el Agente IA de WhatsApp
--   (proyecto agente-playground, 2026-05-04). Schema actual:
--     id, empresa_id, whatsapp_phone, whatsapp_wa_id, nombre, comuna,
--     producto_interes, cantidad_ventanas, tiene_medidas, necesita_instalacion,
--     urgencia, presupuesto_rango, fuente, estado, motivo_derivacion, scoring,
--     asignado_a, asignado_at, tomado_at, ot_id, resumen_para_vendedor,
--     created_at, updated_at.
--
--   Decidimos UNIFICAR: una sola tabla `leads` que sirve tanto al agente
--   (ingestion WhatsApp automática) como al pipeline manual de Fase 1.
--
-- Cambios:
--   1) Agregar columnas faltantes para flujo manual: email, rut, comentarios,
--      ultima_actividad_at.
--   2) whatsapp_phone pasa a nullable (vendedoras cargan leads de canales
--      sin WhatsApp). fuente recibe default 'manual'.
--   3) CHECK del estado: drop si existe + recrear con 12 estados unificados.
--   4) Crear tabla leads_actividad (audit log, no existía).
--   5) RLS por empresa_id.
--   6) RPCs lead_cambiar_estado, lead_vincular_ot, lead_agregar_comentario
--      mapeadas a las columnas reales del agente.
--
-- Reversibilidad parcial:
--   DROP FUNCTION lead_cambiar_estado, lead_vincular_ot, lead_agregar_comentario;
--   DROP TABLE leads_actividad;
--   -- las columnas agregadas a leads quedan (no destructivo)
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== CRM Fase 1 (integrado agente) — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Asegurar que la tabla `leads` existe (si no, crear shape mínimo del agente)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Agregar columnas que faltan (idempotente)
-- ─────────────────────────────────────────────────────────────────────────────
-- Columnas del agente (por si la tabla no las tuviera)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_phone        text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_wa_id        text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS nombre                text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS comuna                text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS producto_interes      text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cantidad_ventanas     integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tiene_medidas         boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS necesita_instalacion  boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS urgencia              text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS presupuesto_rango     text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fuente                text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado                text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_derivacion     text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scoring               integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS asignado_a            uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS asignado_at           timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tomado_at             timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ot_id                 uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS resumen_para_vendedor text;

-- Columnas que agregamos para flujo manual de Fase 1
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email                 text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rut                   text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS comentarios           text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_actividad_at   timestamptz NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Aflojar NOT NULL que bloquean carga manual + defaults convenientes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- whatsapp_phone: nullable (vendedora puede no tener WhatsApp del lead)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads'
      AND column_name='whatsapp_phone' AND is_nullable='NO'
  ) THEN
    ALTER TABLE leads ALTER COLUMN whatsapp_phone DROP NOT NULL;
    RAISE NOTICE '  whatsapp_phone: NOT NULL removido';
  END IF;

  -- fuente: mantener NOT NULL si ya lo era, pero agregar default 'manual'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads' AND column_name='fuente'
  ) THEN
    ALTER TABLE leads ALTER COLUMN fuente SET DEFAULT 'manual';
    RAISE NOTICE '  fuente: default ''manual'' aplicado';
  END IF;

  -- estado: default 'nuevo'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads' AND column_name='estado'
  ) THEN
    ALTER TABLE leads ALTER COLUMN estado SET DEFAULT 'nuevo';
    -- Si está nullable y queremos garantizar consistencia: poblar nulls
    UPDATE leads SET estado = 'nuevo' WHERE estado IS NULL;
    -- Forzar NOT NULL solo si no quedan nulls
    IF NOT EXISTS (SELECT 1 FROM leads WHERE estado IS NULL) THEN
      ALTER TABLE leads ALTER COLUMN estado SET NOT NULL;
    END IF;
  END IF;

  -- empresa_id: forzar NOT NULL si está limpio
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads'
      AND column_name='empresa_id' AND is_nullable='YES'
  ) AND NOT EXISTS (SELECT 1 FROM leads WHERE empresa_id IS NULL) THEN
    ALTER TABLE leads ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) FKs (agregar solo si no existen)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='leads'::regclass
      AND confrelid='perfiles'::regclass
      AND 'asignado_a' = ANY (SELECT a.attname FROM pg_attribute a
        WHERE a.attrelid=conrelid AND a.attnum=ANY(conkey))
  ) THEN
    BEGIN
      ALTER TABLE leads
        ADD CONSTRAINT leads_asignado_a_fkey
        FOREIGN KEY (asignado_a) REFERENCES perfiles(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='leads'::regclass
      AND confrelid='ots'::regclass
  ) THEN
    BEGIN
      ALTER TABLE leads
        ADD CONSTRAINT leads_ot_id_fkey
        FOREIGN KEY (ot_id) REFERENCES ots(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) CHECK constraint del estado (drop existente + recrear con 12 estados)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Si hay rows con estados que NO están en el set nuevo, abortar.
  SELECT COUNT(*) INTO v_count
  FROM leads
  WHERE estado NOT IN (
    'nuevo','contactado','visita_agendada','visita_realizada',
    'cotizando','cotizado','negociacion','en_espera',
    'ganado','perdido_precio','perdido_competencia','perdido_otro'
  );

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Hay % filas en leads con estados fuera del set unificado. Revisar estos valores antes de aplicar el CHECK: SELECT DISTINCT estado FROM leads;', v_count;
  END IF;

  -- Drop CHECK previo (con cualquier nombre razonable) y recrear
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_estado_check;
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_estado_valido;

  ALTER TABLE leads ADD CONSTRAINT leads_estado_check CHECK (estado IN (
    'nuevo','contactado','visita_agendada','visita_realizada',
    'cotizando','cotizado','negociacion','en_espera',
    'ganado','perdido_precio','perdido_competencia','perdido_otro'
  ));
  RAISE NOTICE '  CHECK estado: 12 estados unificados';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_empresa          ON leads(empresa_id);
CREATE INDEX IF NOT EXISTS idx_leads_empresa_estado   ON leads(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_leads_empresa_asign    ON leads(empresa_id, asignado_a);
CREATE INDEX IF NOT EXISTS idx_leads_ot               ON leads(ot_id) WHERE ot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_empresa_act      ON leads(empresa_id, ultima_actividad_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Trigger updated_at + ultima_actividad_at (sync automático en UPDATE)
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
-- 8) Tabla actividad (audit log)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads_actividad (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  empresa_id      uuid NOT NULL,
  tipo            text NOT NULL,
  detalle         jsonb NOT NULL DEFAULT '{}'::jsonb,
  registrado_por  uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_actividad_tipo_check CHECK (tipo IN (
    'creado','cambio_estado','comentario','asignacion','conversion_ot','edicion','agente_ingreso'
  ))
);

CREATE INDEX IF NOT EXISTS idx_leads_actividad_lead     ON leads_actividad(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_actividad_empresa  ON leads_actividad(empresa_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) Row Level Security
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
-- 10) RPCs (mapeadas a columnas reales del agente)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lead_cambiar_estado(
  p_lead_id        uuid,
  p_nuevo_estado   text,
  p_motivo         text DEFAULT NULL,
  p_comentario     text DEFAULT NULL
) RETURNS leads AS $$
DECLARE
  v_lead     leads;
  v_anterior text;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  v_anterior := v_lead.estado;

  UPDATE leads SET
    estado = p_nuevo_estado,
    motivo_derivacion = CASE
      WHEN p_nuevo_estado LIKE 'perdido%' THEN COALESCE(p_motivo, motivo_derivacion)
      ELSE motivo_derivacion
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
      WHEN estado IN ('ganado','perdido_precio','perdido_competencia','perdido_otro')
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

CREATE OR REPLACE FUNCTION lead_agregar_comentario(
  p_lead_id  uuid,
  p_texto    text
) RETURNS leads_actividad AS $$
DECLARE
  v_lead   leads;
  v_act    leads_actividad;
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
GRANT EXECUTE ON FUNCTION lead_vincular_ot        TO authenticated;
GRANT EXECUTE ON FUNCTION lead_agregar_comentario TO authenticated;

DO $$ BEGIN RAISE NOTICE '=== CRM Fase 1 (integrado agente) — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Insertar lead manual (sin WhatsApp):
--    INSERT INTO leads (empresa_id, nombre, comuna, fuente)
--    VALUES ('<empresa-uuid>', 'Test Manual', 'Las Condes', 'manual')
--    RETURNING id, estado, fuente;
--
-- 2) Cambiar estado:
--    SELECT lead_cambiar_estado('<lead-id>'::uuid, 'contactado', NULL, 'Llamada inicial');
--
-- 3) Vincular OT:
--    SELECT lead_vincular_ot('<lead-id>'::uuid, '<ot-id>'::uuid);
--
-- 4) Ver actividad:
--    SELECT tipo, detalle, created_at FROM leads_actividad
--    WHERE lead_id = '<lead-id>'::uuid ORDER BY created_at DESC;
--
-- 5) Limpiar:
--    DELETE FROM leads WHERE nombre = 'Test Manual';
-- ============================================================================
