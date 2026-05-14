-- ============================================================================
-- Carga inicial colmena — recuento físico completo
-- Fecha: 2026-05-14
-- ============================================================================
--
-- Contexto:
--   Postventa hizo un conteo físico completo del taller. Toda la BD de
--   colmena_tubos arranca de cero con este recuento como baseline.
--
--   `fuente = 'carga_inicial'` es el marcador que los recoveries usan
--   como cutoff (memoria project_recovery_cutoff_carga_inicial): cualquier
--   restauración futura va a respetar este punto como piso, sin resucitar
--   fantasmas pre-recuento.
--
-- Lo que hace:
--   1) Pre-flight: contar y reportar tubos actuales en BD.
--   2) DELETE de todos los colmena_tubos de la empresa.
--   3) INSERT de 217 tubos nuevos con uuid generado por la BD.
--   4) INSERT de 217 eventos `ingreso` con fuente='carga_inicial' en
--      tubos_historial, atómicamente (CTE WITH ... RETURNING).
--   5) Verificación: cantidad de tubos == cantidad de eventos.
--
-- Reversibilidad:
--   No hay rollback automático. Si algo sale mal post-COMMIT, el plan B es
--   restaurar desde backup de Supabase. Por eso TODO esto va en una sola
--   transacción — si falla, ROLLBACK y no quedan cambios.
--
-- Notas:
--   - tubos_historial.empresa_id es text (memoria project_tubos_historial_empresa_id_text)
--   - colmena_tubos.tubo_raiz_id es NOT NULL (memoria project_colmena_tubos_uuid_not_null)
--   - El INSERT usa gen_random_uuid() para satisfacer el constraint.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Carga inicial colmena 2026-05-14 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Pre-flight: reportar el estado actual
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM colmena_tubos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  RAISE NOTICE '  Tubos actuales en BD (se van a borrar): %', v_count;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Borrar inventario actual
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DO $$ BEGIN RAISE NOTICE '  Borrado completo.'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) INSERT atómico de tubos + eventos de historial
-- ─────────────────────────────────────────────────────────────────────────────
WITH datos(n_colmena, cod, medida_cm) AS (
  VALUES
  ('A35', 'E02', 191.9),
  ('A35', 'E02', 164.6),
  ('A35', 'E02', 161.8),
  ('A35', 'E02', 161.6),
  ('A35', 'E02', 185.5),
  ('A35', 'E02', 161.5),
  ('A35', 'E02', 143.9),
  ('A35', 'E02', 163.4),
  ('A35', 'E02', 146.4),
  ('A34', 'E02', 139),
  ('A34', 'E02', 136.1),
  ('A34', 'E02', 102.8),
  ('A35', 'E02', 286.5),
  ('A35', 'E02', 220.2),
  ('A33', 'E66', 201.3),
  ('A33', 'E66', 182.2),
  ('A33', 'E66', 174.3),
  ('A33', 'E66', 156.4),
  ('A33', 'E66', 171.8),
  ('A30', 'E66', 140),
  ('A30', 'E66', 132.2),
  ('A30', 'E66', 142.2),
  ('A30', 'E66', 134.5),
  ('A30', 'E66', 143.2),
  ('A33', 'E66', 310.4),
  ('A29', 'E16', 211.2),
  ('A29', 'E16', 207.3),
  ('A29', 'E16', 212),
  ('A29', 'E16', 190.3),
  ('A29', 'E16', 170.7),
  ('A29', 'E16', 194.6),
  ('A29', 'E16', 163.6),
  ('A29', 'E16', 163.4),
  ('A29', 'E16', 160.5),
  ('A29', 'E16', 162.8),
  ('A29', 'E16', 165.2),
  ('A29', 'E16', 164.1),
  ('A29', 'E16', 154.8),
  ('A29', 'E16', 154.4),
  ('A29', 'E16', 139.3),
  ('A29', 'E16', 138),
  ('A29', 'E16', 134.5),
  ('A29', 'E16', 135.1),
  ('A29', 'E16', 114.5),
  ('A29', 'E16', 136.5),
  ('A29', 'E16', 147.8),
  ('A27', 'E63', 134.8),
  ('A27', 'E63', 113.3),
  ('A28', 'E64', 94.3),
  ('A27', 'E63', 260.7),
  ('A27', 'E63', 217.3),
  ('A27', 'E63', 235.1),
  ('A28', 'E64', 236.2),
  ('A28', 'E64', 137.2),
  ('A28', 'E64', 192.3),
  ('A28', 'E64', 247.8),
  ('A28', 'E64', 246.3),
  ('A28', 'E64', 247.1),
  ('A28', 'E64', 200.3),
  ('A28', 'E64', 197.1),
  ('A28', 'E64', 194),
  ('A28', 'E64', 181.8),
  ('A28', 'E64', 184),
  ('A28', 'E64', 178.2),
  ('A28', 'E64', 177),
  ('A28', 'E64', 164.7),
  ('A28', 'E64', 156),
  ('A28', 'E64', 152),
  ('A28', 'E64', 150.8),
  ('A28', 'E64', 131.2),
  ('A28', 'E64', 134.5),
  ('A27', 'E63', 206.7),
  ('A27', 'E63', 197.5),
  ('A27', 'E63', 170.6),
  ('A27', 'E63', 170.4),
  ('A27', 'E63', 152.6),
  ('A27', 'E63', 134.8),
  ('A27', 'E63', 134.2),
  ('A27', 'E63', 138.8),
  ('A27', 'E63', 133),
  ('B1', 'E28', 64),
  ('B1', 'E28', 95.4),
  ('B1', 'E28', 96.3),
  ('B1', 'E28', 103.7),
  ('B1', 'E28', 104.1),
  ('B1', 'E28', 106.7),
  ('B1', 'E28', 106),
  ('B1', 'E28', 120.3),
  ('B1', 'E28', 125.2),
  ('B1', 'E28', 125.1),
  ('B1', 'E28', 130.2),
  ('B1', 'E28', 131.2),
  ('B1', 'E28', 148.5),
  ('B1', 'E28', 169.5),
  ('B1', 'E28', 167.8),
  ('B1', 'E28', 190.4),
  ('B1', 'E28', 193),
  ('B1', 'E28', 197.5),
  ('B1', 'E28', 207.2),
  ('B1', 'E28', 209.6),
  ('B1', 'E28', 207.5),
  ('B1', 'E28', 236.4),
  ('B1', 'E28', 237.5),
  ('B2', 'E61', 32.5),
  ('B2', 'E61', 37.7),
  ('B2', 'E61', 42.7),
  ('B2', 'E61', 159.6),
  ('B2', 'E61', 75.7),
  ('B2', 'E61', 74.8),
  ('B2', 'E61', 80.4),
  ('B2', 'E61', 85.2),
  ('B2', 'E61', 85.3),
  ('B2', 'E61', 87.9),
  ('B2', 'E61', 147),
  ('B2', 'E61', 179.1),
  ('B2', 'E61', 178.9),
  ('B2', 'E61', 182.1),
  ('B2', 'E61', 194.5),
  ('B2', 'E61', 200.4),
  ('B2', 'E61', 213.7),
  ('B3', 'E62', 40.5),
  ('B3', 'E62', 46.8),
  ('B3', 'E62', 41.8),
  ('B3', 'E62', 42.3),
  ('B3', 'E62', 45),
  ('B3', 'E62', 58),
  ('B3', 'E62', 83.2),
  ('B3', 'E62', 85.1),
  ('B3', 'E62', 89.3),
  ('B3', 'E62', 102.7),
  ('B3', 'E62', 116.9),
  ('B3', 'E62', 116.7),
  ('B3', 'E62', 116.4),
  ('B3', 'E62', 117.3),
  ('B3', 'E62', 119.5),
  ('B3', 'E62', 118.1),
  ('B3', 'E62', 121.2),
  ('B3', 'E62', 122.5),
  ('B3', 'E62', 128),
  ('B3', 'E62', 131.5),
  ('B3', 'E62', 134.6),
  ('B3', 'E62', 141.7),
  ('B3', 'E62', 143.6),
  ('B3', 'E62', 141.8),
  ('B3', 'E62', 143.1),
  ('B3', 'E62', 135.9),
  ('B3', 'E62', 149.9),
  ('B3', 'E62', 159.8),
  ('B3', 'E62', 186.8),
  ('B3', 'E62', 227.2),
  ('A20', 'E13', 217.9),
  ('A20', 'E13', 202.1),
  ('A20', 'E13', 186.2),
  ('A20', 'E13', 181.2),
  ('A20', 'E13', 186.8),
  ('A20', 'E13', 166.8),
  ('A20', 'E13', 138.9),
  ('A20', 'E13', 147.5),
  ('A20', 'E13', 102.4),
  ('A14', 'E19', 224),
  ('A14', 'E19', 178.7),
  ('A14', 'E19', 151.8),
  ('A14', 'E19', 154.7),
  ('A14', 'E19', 147.4),
  ('A14', 'E19', 137),
  ('A14', 'E19', 104.4),
  ('A14', 'E19', 95),
  ('A14', 'E19', 85),
  ('A14', 'E19', 86.4),
  ('A14', 'E19', 84.4),
  ('A15', 'E18', 184.1),
  ('A15', 'E18', 186.6),
  ('A15', 'E18', 189),
  ('A15', 'E18', 191.9),
  ('A15', 'E18', 180.2),
  ('A15', 'E18', 163.9),
  ('A15', 'E18', 131.6),
  ('A15', 'E18', 137.5),
  ('A15', 'E18', 114.5),
  ('A15', 'E18', 102.9),
  ('A16', 'E20', 191),
  ('A16', 'E20', 180.9),
  ('A16', 'E20', 148.2),
  ('A16', 'E20', 94.5),
  ('A16', 'E20', 200.9),
  ('A16', 'E20', 153.6),
  ('A16', 'E20', 142.5),
  ('A16', 'E20', 129),
  ('A16', 'E20', 126),
  ('A16', 'E20', 90.8),
  ('A16', 'E20', 104.6),
  ('L03', 'E62', 307.8),
  ('L03', 'E62', 229.6),
  ('L03', 'E61', 323.4),
  ('L03', 'E61', 338),
  ('L03', 'E61', 342.7),
  ('L03', 'E61', 241.5),
  ('L03', 'E28', 318.7),
  ('A28', 'E64', 246.5),
  ('A28', 'E64', 244),
  ('A28', 'E64', 194),
  ('A28', 'E64', 200.1),
  ('A28', 'E64', 186),
  ('A28', 'E64', 140.9),
  ('A28', 'E64', 137.9),
  ('A28', 'E64', 135.5),
  ('A28', 'E64', 133.2),
  ('A28', 'E64', 132.9),
  ('A28', 'E64', 131.5),
  ('L02', 'E02', 419.3),
  ('A34', 'E02', 160.3),
  ('L03', 'E63', 303.3),
  ('L03', 'E63', 164.2),
  ('A28', 'E64', 97.4),
  ('A28', 'E64', 97),
  ('L03', 'E63', 406.6),
  ('L03', 'E28', 223.5)

),
nuevos_tubos AS (
  INSERT INTO colmena_tubos (
    empresa_id, n_colmena, cod, medida_cm, medida_mm,
    tubo_raiz_id, agregado_por_admin
  )
  SELECT
    '67c635a5-152c-4780-a066-23f5081175a9'::uuid,
    d.n_colmena,
    d.cod,
    d.medida_cm,
    ROUND(d.medida_cm * 10)::int,
    gen_random_uuid(),
    false
  FROM datos d
  RETURNING tubo_raiz_id, n_colmena, cod, medida_cm
)
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, medida_resultado_cm,
  evento, fuente, notas, registrado_por, created_at
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  nt.tubo_raiz_id,
  nt.n_colmena,
  nt.cod,
  nt.medida_cm,
  nt.medida_cm,
  'ingreso',
  'carga_inicial',
  'Conteo físico completo del 14/05/2026 — baseline post-recuento del taller. Lote total: 217 tubos en 16 colmenas (A14-A35, B1-B3, L02, L03).',
  'cortinasrolzzo@hotmail.com',
  now() - interval '1 second'
FROM nuevos_tubos;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Verificación post-INSERT
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count_tubos    integer;
  v_count_hist     integer;
  v_count_colmenas integer;
BEGIN
  SELECT COUNT(*) INTO v_count_tubos FROM colmena_tubos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

  SELECT COUNT(*) INTO v_count_hist FROM tubos_historial
  WHERE empresa_id::text = '67c635a5-152c-4780-a066-23f5081175a9'::text
    AND fuente = 'carga_inicial'
    AND created_at > now() - interval '5 minutes';

  SELECT COUNT(DISTINCT n_colmena) INTO v_count_colmenas FROM colmena_tubos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

  RAISE NOTICE '  Tubos insertados:   %', v_count_tubos;
  RAISE NOTICE '  Eventos ingreso:    %', v_count_hist;
  RAISE NOTICE '  Colmenas distintas: %', v_count_colmenas;

  IF v_count_tubos <> 217 THEN
    RAISE EXCEPTION 'Conteo de tubos incorrecto: esperado 217, real %', v_count_tubos;
  END IF;
  IF v_count_hist <> 217 THEN
    RAISE EXCEPTION 'Conteo de eventos incorrecto: esperado 217, real %', v_count_hist;
  END IF;
  IF v_count_colmenas <> 16 THEN
    RAISE EXCEPTION 'Colmenas distintas incorrecto: esperado 16, real %', v_count_colmenas;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Carga inicial colmena 2026-05-14 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Conteo total:
--    SELECT COUNT(*) FROM colmena_tubos
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
--    → 217
--
-- 2) Por colmena:
--    SELECT n_colmena, COUNT(*) FROM colmena_tubos
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--    GROUP BY n_colmena ORDER BY n_colmena;
--
-- 3) Historial baseline:
--    SELECT COUNT(*) FROM tubos_historial
--    WHERE empresa_id::text = '67c635a5-152c-4780-a066-23f5081175a9'::text
--      AND fuente = 'carga_inicial'
--      AND created_at::date = '2026-05-14';
--    → 217
--
-- 4) Optimizador: recargar el HTML y verificar que aparezca el inventario
--    nuevo en la tabla de colmenas. El freshness indicator debe estar verde.
-- ============================================================================