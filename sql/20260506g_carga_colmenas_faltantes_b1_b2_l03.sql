-- ============================================================================
-- Carga: 60 tubos faltantes del taller en colmenas nuevas B1, B2, L03
-- Fecha: 2026-05-06
-- Empresa: rolzzo-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   El taller entregó la planilla del 2026-05-04 incompleta. Hoy completaron
--   con 60 tubos adicionales en 3 colmenas que aún no existían en la BD:
--     - B1 (E28): 20 tubos
--     - B2 (E61: 29, E62: 2): 31 tubos
--     - L03 (E16: 6, E64: 3): 9 tubos
--
--   Cada tubo recibe un tubo_raiz_id nuevo (gen_random_uuid()) y un evento
--   'ingreso' en tubos_historial con fuente='carga_taller_2026_05_06' para
--   trazabilidad y para que la Defensa D del trigger acepte cortes futuros.
--
-- Estado esperado post-carga:
--   colmena_tubos: 152 + 60 = 212 tubos
--   tubos_historial: +60 eventos 'ingreso' con fuente='carga_taller_2026_05_06'
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Carga colmenas faltantes B1/B2/L03 — INICIADO ==='; END $$;

WITH nuevos_tubos(n_colmena, cod, medida_cm) AS (
  VALUES
    -- ── B2 - E61 (29 tubos) ──────────────────────────────────────────
    ('B2', 'E61', 242::numeric),
    ('B2', 'E61', 240.8::numeric),
    ('B2', 'E61', 225.4::numeric),
    ('B2', 'E61', 213.8::numeric),
    ('B2', 'E61', 200.9::numeric),
    ('B2', 'E61', 194.5::numeric),
    ('B2', 'E61', 191.6::numeric),
    ('B2', 'E61', 182.2::numeric),
    ('B2', 'E61', 181.2::numeric),
    ('B2', 'E61', 179::numeric),
    ('B2', 'E61', 180.9::numeric),
    ('B2', 'E61', 179.1::numeric),
    ('B2', 'E61', 179.1::numeric),  -- duplicado físico (verificar UNIQUE)
    ('B2', 'E61', 147::numeric),
    ('B2', 'E61', 85.4::numeric),
    ('B2', 'E61', 80.4::numeric),
    ('B2', 'E61', 85.2::numeric),
    ('B2', 'E61', 87.9::numeric),
    ('B2', 'E61', 79.9::numeric),
    ('B2', 'E61', 76.9::numeric),
    ('B2', 'E61', 61::numeric),
    ('B2', 'E61', 48.6::numeric),
    ('B2', 'E61', 427::numeric),
    ('B2', 'E61', 37.7::numeric),
    ('B2', 'E61', 30.9::numeric),
    ('B2', 'E61', 22::numeric),
    ('B2', 'E61', 260.2::numeric),
    ('B2', 'E61', 341.1::numeric),
    ('B2', 'E61', 339.9::numeric),
    -- ── B2 - E62 (2 tubos) ───────────────────────────────────────────
    ('B2', 'E62', 286.4::numeric),
    ('B2', 'E62', 186.9::numeric),
    -- ── B1 - E28 (20 tubos) ──────────────────────────────────────────
    ('B1', 'E28', 31::numeric),
    ('B1', 'E28', 64::numeric),
    ('B1', 'E28', 95.5::numeric),
    ('B1', 'E28', 96.6::numeric),
    ('B1', 'E28', 104.2::numeric),
    ('B1', 'E28', 106::numeric),
    ('B1', 'E28', 106.7::numeric),
    ('B1', 'E28', 120::numeric),
    ('B1', 'E28', 125.2::numeric),
    ('B1', 'E28', 125.5::numeric),
    ('B1', 'E28', 130.2::numeric),
    ('B1', 'E28', 131.7::numeric),
    ('B1', 'E28', 148.7::numeric),
    ('B1', 'E28', 154::numeric),
    ('B1', 'E28', 167.7::numeric),
    ('B1', 'E28', 190.4::numeric),
    ('B1', 'E28', 193::numeric),
    ('B1', 'E28', 197.5::numeric),
    ('B1', 'E28', 207.1::numeric),
    ('B1', 'E28', 224.4::numeric),
    -- ── L03 - E16 (6 tubos) ──────────────────────────────────────────
    ('L03', 'E16', 360::numeric),
    ('L03', 'E16', 376.7::numeric),
    ('L03', 'E16', 336.4::numeric),
    ('L03', 'E16', 385.9::numeric),
    ('L03', 'E16', 372.9::numeric),
    ('L03', 'E16', 223.5::numeric),
    -- ── L03 - E64 (3 tubos) ──────────────────────────────────────────
    ('L03', 'E64', 313.3::numeric),
    ('L03', 'E64', 246::numeric),
    ('L03', 'E64', 455.4::numeric)
),
generated AS (
  SELECT *, gen_random_uuid() AS raiz_id FROM nuevos_tubos
),
ins_ct AS (
  INSERT INTO colmena_tubos (
    empresa_id, n_colmena, cod, medida_cm, medida_mm,
    tubo_raiz_id, agregado_por_admin
  )
  SELECT
    '67c635a5-152c-4780-a066-23f5081175a9'::uuid,
    n_colmena, cod, medida_cm, (medida_cm * 10)::integer,
    raiz_id, true
  FROM generated
  RETURNING tubo_raiz_id, n_colmena, cod, medida_cm
)
INSERT INTO tubos_historial (
  empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
  evento, registrado_por, notas, fuente
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9'::text,
  tubo_raiz_id, n_colmena, cod, medida_cm,
  'ingreso', 'sistema',
  'Carga inicial taller — colmenas B1/B2/L03 entregadas el 2026-05-06',
  'carga_taller_2026_05_06'
FROM ins_ct;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación final.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_total integer;
        v_nuevos_ingreso integer;
        v_nuevos_b1 integer;
        v_nuevos_b2 integer;
        v_nuevos_l03 integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  SELECT COUNT(*) INTO v_nuevos_ingreso FROM tubos_historial
   WHERE fuente = 'carga_taller_2026_05_06';
  SELECT COUNT(*) INTO v_nuevos_b1 FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND n_colmena = 'B1';
  SELECT COUNT(*) INTO v_nuevos_b2 FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND n_colmena = 'B2';
  SELECT COUNT(*) INTO v_nuevos_l03 FROM colmena_tubos
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND n_colmena = 'L03';

  RAISE NOTICE 'Inventario total: % tubos (esperado: 212)', v_total;
  RAISE NOTICE 'Eventos ingreso del recovery: % (esperado: 60)', v_nuevos_ingreso;
  RAISE NOTICE 'Distribución nuevos: B1=% · B2=% · L03=%', v_nuevos_b1, v_nuevos_b2, v_nuevos_l03;
  RAISE NOTICE 'Esperado: B1=20 · B2=31 · L03=9';

  IF v_total <> 212 THEN
    RAISE EXCEPTION 'Total esperado 212 tubos, hay % — ABORTAR', v_total;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Carga colmenas faltantes — COMPLETADO ==='; END $$;

COMMIT;
