-- Numeración secuencial de OTs por empresa y periodo (año+mes).
--
-- Reemplaza el anterior `String(Math.floor(Date.now() / 1000)).slice(-4)` que
-- generaba colisiones cada ~2.7 horas y números no ordenados.
--
-- Formato: año(2 dígitos) + mes(1 o 2 dígitos) + "-" + secuencial.
-- Ejemplos:
--   "261-1"   → enero 2026, OT 1
--   "265-12"  → mayo 2026, OT 12
--   "2611-1"  → noviembre 2026, OT 1
--   "2612-3"  → diciembre 2026, OT 3
--   "271-1"   → enero 2027, OT 1
--
-- Garantías:
--   • Sin colisiones (UPSERT atómico ON CONFLICT)
--   • Por empresa: cada empresa tiene su propia secuencia
--   • Reinicia automáticamente al cambiar de mes/año
--   • Soporta clicks simultáneos sin duplicados

-- ── 1. Tabla de contadores ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ot_contadores (
  empresa_id    uuid NOT NULL,
  periodo       text NOT NULL, -- ej. '261', '265', '2611', '2612', '271'
  ultimo_numero int  NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa_id, periodo)
);

-- ── 2. RLS ─────────────────────────────────────────────────────────
ALTER TABLE ot_contadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ot_contadores_select ON ot_contadores;
CREATE POLICY ot_contadores_select ON ot_contadores
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = (select auth.uid())));

DROP POLICY IF EXISTS ot_contadores_modify ON ot_contadores;
CREATE POLICY ot_contadores_modify ON ot_contadores
  FOR ALL TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = (select auth.uid())))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM perfiles WHERE id = (select auth.uid())));

-- ── 3. Función generadora ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION generar_numero_ot(p_empresa_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anio_corto int;
  v_mes int;
  v_periodo text;
  v_nuevo int;
BEGIN
  v_anio_corto := EXTRACT(YEAR FROM NOW())::int % 100;
  v_mes        := EXTRACT(MONTH FROM NOW())::int;
  -- Periodo concatenado sin guión: 261 = enero/26, 2611 = noviembre/26.
  -- No hay ambigüedad porque el año 261 d.C. ya pasó.
  v_periodo := v_anio_corto::text || v_mes::text;

  INSERT INTO ot_contadores (empresa_id, periodo, ultimo_numero)
  VALUES (p_empresa_id, v_periodo, 1)
  ON CONFLICT (empresa_id, periodo)
  DO UPDATE SET ultimo_numero = ot_contadores.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_nuevo;

  RETURN v_periodo || '-' || v_nuevo::text;
END;
$$;

GRANT EXECUTE ON FUNCTION generar_numero_ot(uuid) TO authenticated;
