-- Reglas Rolzzo v1.0 (sección 7) — Registro de MERMA de telas/paños.
-- Un sobrante que no llega a 120×180 cm, o una colmena dada de baja, se
-- registra acá con trazabilidad completa (código, medida, OT, colmena origen).
-- Ya aplicada en producción 2026-06-26 (migración `create_telas_mermas`).
CREATE TABLE IF NOT EXISTS telas_mermas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id uuid NOT NULL,
  codigo text,
  medida_ancho numeric,
  medida_alto numeric,
  motivo text,                 -- sobrante_colmena | sobrante_rollo | baja_antiguedad
  ot_origen text,
  colmena_origen_id uuid,      -- id de colmena_panos de origen, si aplica
  fecha timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telas_mermas_empresa ON telas_mermas (empresa_id);

ALTER TABLE telas_mermas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_isolation ON telas_mermas;
CREATE POLICY empresa_isolation ON telas_mermas
  FOR ALL TO authenticated
  USING (empresa_id = (SELECT get_my_empresa_id()))
  WITH CHECK (empresa_id = (SELECT get_my_empresa_id()));
