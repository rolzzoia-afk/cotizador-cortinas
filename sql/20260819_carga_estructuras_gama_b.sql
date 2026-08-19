-- ============================================================================
-- Carga colmena de tuberías — estructuras Gama B + zócalos (conteo físico)
-- Fecha: 2026-08-19
-- Fuente: Excel «Inventario estructuras - Gama B - zocalos (2).xlsx»
-- ============================================================================
--
-- Contexto:
--   Conteo físico de las estructuras de línea B y zócalos. El Excel es la
--   nueva verdad para estos 9 códigos: lo que hoy exista en colmena_tubos con
--   esos códigos SE BORRA y entra el conteo del Excel.
--
--   Códigos y cantidades (147 barras en total):
--     E01   × 40  tubo línea B               → Clase B (39) + L02 (1)
--     E40   × 50  peso roller BLANCO línea B → Clase B (40) + Rack 5 (6) + L05 (4)
--     E69-B ×  5  peso roller NEGRO línea B  → L04
--     E60   ×  8  cenefa BLANCA línea B      → L04 (6) + B5 (2)
--     E32   × 17  zócalo BLANCO              → A59 (14) + L05 (3)
--     E33   × 22  zócalo NEGRO               → A61 (11) + A60 (6) + L05 (5)
--     E34   ×  3  zócalo CAFÉ                → A57
--     E41   ×  1  separador BLANCO           → L06
--     E42   ×  1  separador NEGRO            → L06
--
--   Hoy en BD (se borran): E01 ×39 (A26, L02) · E40 ×40 (A27) · E32 ×4 (L02)
--   · E33 ×3 (L01). Los otros 5 códigos no tienen filas. Total a borrar: 86.
--
-- Notas:
--   - El Excel escribe «E69B»; el código real de insumos y del cotizador es
--     E69-B (con guion) — se carga normalizado para que el optimizador matchee.
--   - tubos_historial.empresa_id es text (memoria project_tubos_historial_empresa_id_text).
--   - SET LOCAL app.sync_active: el borrado es administrativo — sin eventos
--     `eliminado` que ensucien el chequeo de tombstones (mismo mecanismo que
--     la carga inicial del 14/05 y que la RPC sync_colmena_tubos).
--   - fuente = 'backfill_estructuras_gama_b_20260819' sigue la convención de
--     'backfill_colmena_rieles_20260727'. A PROPÓSITO no calza con
--     'carga_inicial%': esta carga es parcial y no debe mover el cutoff de los
--     recoveries (memoria project_recovery_cutoff_carga_inicial).
--   - «Clase B», «Rack 5», B5, A57/A59/A60/A61, L04/L05/L06 son ubicaciones
--     nuevas; n_colmena es texto libre y ninguna choca con las posiciones
--     virtuales del optimizador (LIBERADO / MESA / TUBO NUEVO / PESO NUEVO).
--
-- Reversibilidad:
--   Todo va en UNA transacción: si una aserción falla, ROLLBACK y no queda
--   nada a medias. Post-COMMIT no hay rollback automático (backup Supabase).
--
-- Cómo correr: Supabase SQL Editor, pegado completo. Correrlo con el
--   optimizador CERRADO en todos los navegadores y refrescarlo después.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Carga estructuras Gama B 2026-08-19 — INICIADO ==='; END $$;

-- Borrado administrativo: sin eventos `eliminado` en tubos_historial.
SET LOCAL app.sync_active = 'true';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Pre-flight + borrado de lo existente con estos códigos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_antes integer; v_borrados integer;
BEGIN
  SELECT COUNT(*) INTO v_antes FROM colmena_tubos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;
  RAISE NOTICE '  Tubos totales en colmena antes: %', v_antes;

  DELETE FROM colmena_tubos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND cod IN ('E01','E40','E69-B','E69B','E60','E32','E33','E34','E41','E42');
  GET DIAGNOSTICS v_borrados = ROW_COUNT;
  RAISE NOTICE '  Borrados con códigos del Excel: % (esperados: 86)', v_borrados;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) INSERT atómico de las 147 barras + eventos `ingreso` en el historial
-- ─────────────────────────────────────────────────────────────────────────────
WITH datos(n_colmena, cod, medida_cm) AS (
  VALUES
  ('Clase B', 'E01', 181.3),
  ('Clase B', 'E01', 156.6),
  ('Clase B', 'E01', 182),
  ('Clase B', 'E01', 190.5),
  ('Clase B', 'E01', 257.9),
  ('Clase B', 'E01', 265.2),
  ('Clase B', 'E01', 180.8),
  ('L02', 'E01', 283.2),
  ('Clase B', 'E01', 76.5),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E01', 186),
  ('Clase B', 'E40', 209),
  ('Clase B', 'E40', 188.2),
  ('Clase B', 'E40', 190.1),
  ('Clase B', 'E40', 166.8),
  ('Clase B', 'E40', 122.5),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Clase B', 'E40', 185.8),
  ('Rack 5', 'E40', 111.5),
  ('Rack 5', 'E40', 95.8),
  ('Rack 5', 'E40', 75),
  ('Rack 5', 'E40', 95.8),
  ('Rack 5', 'E40', 95.8),
  ('Rack 5', 'E40', 167.8),
  ('L05', 'E40', 283.3),
  ('L05', 'E40', 285.6),
  ('L05', 'E40', 286.2),
  ('L05', 'E40', 385.3),
  ('L04', 'E69-B', 256.8),
  ('L04', 'E69-B', 437.4),
  ('L04', 'E69-B', 478.7),
  ('L04', 'E69-B', 477.6),
  ('L04', 'E69-B', 190),
  ('L04', 'E60', 298.5),
  ('L04', 'E60', 280.5),
  ('L04', 'E60', 298.5),
  ('L04', 'E60', 190),
  ('L04', 'E60', 263.3),
  ('L04', 'E60', 117.7),
  ('B5', 'E60', 173.5),
  ('B5', 'E60', 162),
  ('A59', 'E32', 120.2),
  ('A59', 'E32', 170.5),
  ('A59', 'E32', 124.5),
  ('A59', 'E32', 134),
  ('A59', 'E32', 139.2),
  ('A59', 'E32', 137.7),
  ('A59', 'E32', 136.5),
  ('A59', 'E32', 136.2),
  ('A59', 'E32', 228.8),
  ('A59', 'E32', 290),
  ('A59', 'E32', 140),
  ('A59', 'E32', 221),
  ('A59', 'E32', 193),
  ('A59', 'E32', 147.1),
  ('L05', 'E32', 237.2),
  ('L05', 'E32', 236.5),
  ('L05', 'E32', 282.8),
  ('L05', 'E33', 345),
  ('L05', 'E33', 309),
  ('L05', 'E33', 160.4),
  ('L05', 'E33', 213),
  ('L05', 'E33', 167.5),
  ('A61', 'E33', 122),
  ('A61', 'E33', 121),
  ('A61', 'E33', 128.5),
  ('A61', 'E33', 125.5),
  ('A61', 'E33', 135.4),
  ('A61', 'E33', 131.8),
  ('A61', 'E33', 126),
  ('A61', 'E33', 126.7),
  ('A61', 'E33', 166.5),
  ('A61', 'E33', 129),
  ('A61', 'E33', 129.4),
  ('A60', 'E33', 90.2),
  ('A60', 'E33', 100),
  ('A60', 'E33', 119),
  ('A60', 'E33', 93),
  ('A60', 'E33', 118.5),
  ('A57', 'E34', 315.4),
  ('A57', 'E34', 171),
  ('A57', 'E34', 172.6),
  ('L06', 'E41', 211.2),
  ('L06', 'E42', 324.8),
  ('A60', 'E33', 130.4)
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
  'backfill_estructuras_gama_b_20260819',
  'Conteo físico de estructuras Gama B + zócalos del 19/08/2026. Reemplaza todo el stock previo de E01/E40/E69-B/E60/E32/E33/E34/E41/E42. Lote: 147 barras.',
  'cortinasrolzzo@hotmail.com',
  now() - interval '1 second'
FROM nuevos_tubos nt;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Aserciones: conteo por código EXACTO al Excel, o ROLLBACK
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cod text; v_esperado integer; v_real integer; v_hist integer;
BEGIN
  FOR v_cod, v_esperado IN
    SELECT * FROM (VALUES
      ('E01', 40), ('E40', 50), ('E69-B', 5), ('E60', 8), ('E32', 17),
      ('E33', 22), ('E34', 3), ('E41', 1), ('E42', 1)
    ) AS t(cod, n)
  LOOP
    SELECT COUNT(*) INTO v_real FROM colmena_tubos
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid AND cod = v_cod;
    RAISE NOTICE '  %: % barras (esperadas %)', v_cod, v_real, v_esperado;
    IF v_real <> v_esperado THEN
      RAISE EXCEPTION 'Conteo de % incorrecto: esperado %, real %', v_cod, v_esperado, v_real;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_hist FROM tubos_historial
  WHERE empresa_id::text = '67c635a5-152c-4780-a066-23f5081175a9'
    AND fuente = 'backfill_estructuras_gama_b_20260819';
  RAISE NOTICE '  Eventos ingreso en historial: % (esperados 147)', v_hist;
  IF v_hist <> 147 THEN
    RAISE EXCEPTION 'Eventos de historial incorrectos: esperados 147, reales %', v_hist;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Carga estructuras Gama B 2026-08-19 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Por código (deben calzar con el encabezado de este archivo):
--    SELECT cod, COUNT(*) FROM colmena_tubos
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND cod IN ('E01','E40','E69-B','E60','E32','E33','E34','E41','E42')
--    GROUP BY cod ORDER BY cod;
--
-- 2) Por ubicación:
--    SELECT n_colmena, COUNT(*) FROM colmena_tubos
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND cod IN ('E01','E40','E69-B','E60','E32','E33','E34','E41','E42')
--    GROUP BY n_colmena ORDER BY n_colmena;
--    → Clase B 79 · A59 14 · L05 12 · L04 11 · A61 11 · Rack 5 6 · A60 6
--      · A57 3 · B5 2 · L06 2 · L02 1
--
-- 3) Optimizador legacy: recargar y verificar que la tabla de colmenas
--    muestre Clase B / Rack 5 / A57–A61 / B5 / L04–L06 con estos códigos.
-- ============================================================================
