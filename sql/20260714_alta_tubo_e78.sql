-- ============================================================================
-- Alta de tubo E78 — nuevo tubo 45 mm por defecto
-- Fecha: 2026-07-14
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto:
--   Llega un tubo nuevo, código E78 ("TUBO 43MM(ESP1.2)(5.8)", barra virgen
--   579 cm), que se usa en los mecanismos de 45 mm (roller simple, dúo, cenefa
--   ovalada, etc.). Los 4 tubos 45 mm actuales (E04, E05, E39, E46) están
--   AGOTADOS; E05 —el que el cotizador pre-seleccionaba— está incluso "(DESUSO)".
--
--   El código de tubo que se auto-selecciona lo decide reglas-tuberia.ts (cambio
--   de código, PR aparte): 45 mm → E78 por defecto, con E05 aún seleccionable.
--   Este SQL cubre solo la DATA que vive en Supabase:
--     1. descuentos_modelo.codigos_tubo — anexar E78 al grupo 45 mm (informativo)
--     2. configuracion.catalogo_reemplazos_data — catálogos del optimizador legacy
--     3. insumos — alta de la fila E78 (stock 0)
--
--   Los descuentos de despiece (dcto_tubo_cm, dcto_cenefa_cm, ...) son por
--   MECANISMO, no por tubo: NO cambian.
--
-- Reversibilidad:
--   Tablas *_backup_e78_20260714 retienen el estado pre-cambio de las filas
--   tocadas de descuentos_modelo y configuracion. La fila insumos E78 se borra
--   con:  DELETE FROM insumos WHERE empresa_id='…' AND cod='E78';
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Alta tubo E78 — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Backups defensivos
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS descuentos_modelo_backup_e78_20260714;
CREATE TABLE descuentos_modelo_backup_e78_20260714 AS
SELECT * FROM descuentos_modelo
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND codigos_tubo = 'E04; E05; E39; E46';

DROP TABLE IF EXISTS configuracion_backup_e78_20260714;
CREATE TABLE configuracion_backup_e78_20260714 AS
SELECT * FROM configuracion
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
  AND clave = 'catalogo_reemplazos_data';

DO $$
DECLARE v_dm integer; v_cfg integer;
BEGIN
  SELECT COUNT(*) INTO v_dm  FROM descuentos_modelo_backup_e78_20260714;
  SELECT COUNT(*) INTO v_cfg FROM configuracion_backup_e78_20260714;
  RAISE NOTICE 'Step 1 — backups: descuentos_modelo(45mm)=%, configuracion=%', v_dm, v_cfg;
  IF v_dm <> 25 THEN
    RAISE WARNING 'Backup descuentos_modelo esperaba 25 filas 45 mm pero capturó %', v_dm;
  END IF;
  IF v_cfg <> 1 THEN
    RAISE EXCEPTION 'Backup configuracion esperaba 1 fila catalogo_reemplazos_data pero capturó %', v_cfg;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) descuentos_modelo: anexar E78 al grupo de tubos 45 mm (idempotente)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_upd integer;
BEGIN
  UPDATE descuentos_modelo
  SET codigos_tubo = 'E04; E05; E39; E46; E78'
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND codigos_tubo = 'E04; E05; E39; E46';
  GET DIAGNOSTICS v_upd = ROW_COUNT;
  RAISE NOTICE 'Step 2: % filas 45 mm con E78 anexado', v_upd;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) configuracion.catalogo_reemplazos_data — catálogos del optimizador (idempotente)
--    valor es TEXT con JSON: cast a jsonb, editar, volver a text.
--    - catalogoColores:    E78 → "Aluminio"
--    - catalogoMedidas:    E78 → 579 (cm de barra virgen)
--    - catalogoAccesorios: "TUBO 43MM(ESP1.2)(5.8)|ALUMINIO" → "E78"
--    - catalogoReemplazos: E78 ↔ E04/E05/E39/E46 (para consumir sobrantes mutuamente)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v jsonb;
  r jsonb;
  v_e04 text;
  v_e05 text;
BEGIN
  SELECT valor::jsonb INTO v
  FROM configuracion
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'catalogo_reemplazos_data';

  r := v->'catalogoReemplazos';
  -- Anexa "; E78" a E04/E05 solo si aún no lo tienen (idempotente).
  v_e04 := r->>'E04';
  v_e05 := r->>'E05';
  IF v_e04 IS NOT NULL AND position('E78' in v_e04) = 0 THEN v_e04 := v_e04 || '; E78'; END IF;
  IF v_e05 IS NOT NULL AND position('E78' in v_e05) = 0 THEN v_e05 := v_e05 || '; E78'; END IF;

  v := jsonb_set(v, '{catalogoColores}',
        (v->'catalogoColores') || jsonb_build_object('E78', 'Aluminio'));
  v := jsonb_set(v, '{catalogoMedidas}',
        (v->'catalogoMedidas') || jsonb_build_object('E78', 579));
  v := jsonb_set(v, '{catalogoAccesorios}',
        (v->'catalogoAccesorios') || jsonb_build_object('TUBO 43MM(ESP1.2)(5.8)|ALUMINIO', 'E78'));
  v := jsonb_set(v, '{catalogoReemplazos}',
        r || jsonb_build_object('E78', 'E04; E05; E39; E46')
          || jsonb_build_object('E04', v_e04)
          || jsonb_build_object('E05', v_e05));

  UPDATE configuracion
  SET valor = v::text
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
    AND clave = 'catalogo_reemplazos_data';

  RAISE NOTICE 'Step 3: catalogos optimizador actualizados (color=%, medida=%, reemplazo E78=%, E04=%, E05=%)',
    v->'catalogoColores'->>'E78', v->'catalogoMedidas'->>'E78',
    v->'catalogoReemplazos'->>'E78', v->'catalogoReemplazos'->>'E04', v->'catalogoReemplazos'->>'E05';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) insumos — alta de E78 (stock 0; se ajusta cuando llegue). Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
-- stock_total es columna GENERADA (stock_mp + stock_liberado): no se inserta.
INSERT INTO insumos (empresa_id, cod, categoria, sub_categoria, producto,
                     nemotecnico, color, status, minimo,
                     stock_mp, stock_liberado)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'E78', 'INSUMO', 'TUBERÍA',
        'ROLLER/DUO', 'TUBO 43MM(ESP1.2)(5.8)', 'N/A', 'OK', 0, 0, 0)
ON CONFLICT (empresa_id, cod) DO NOTHING;

DO $$
DECLARE v_ins integer;
BEGIN
  SELECT COUNT(*) INTO v_ins FROM insumos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid AND cod = 'E78';
  IF v_ins <> 1 THEN
    RAISE EXCEPTION 'Step 4 falló: insumos E78 quedó en % filas', v_ins;
  END IF;
  RAISE NOTICE 'Step 4: insumo E78 presente (1 fila)';
END $$;

DO $$ BEGIN RAISE NOTICE '=== Alta tubo E78 — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT (correr aparte):
--
-- 1) descuentos_modelo con E78 (esperado: 25)
--    SELECT count(*) FROM descuentos_modelo
--    WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND codigos_tubo LIKE '%E78%';
--
-- 2) insumo E78
--    SELECT cod, nemotecnico, sub_categoria, status, stock_total FROM insumos
--    WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid AND cod='E78';
--
-- 3) catálogos del optimizador
--    SELECT (valor::jsonb)->'catalogoColores'->>'E78'   AS color,
--           (valor::jsonb)->'catalogoMedidas'->>'E78'   AS medida,
--           (valor::jsonb)->'catalogoReemplazos'->>'E78' AS reemplazo_e78,
--           (valor::jsonb)->'catalogoReemplazos'->>'E04' AS reemplazo_e04,
--           (valor::jsonb)->'catalogoReemplazos'->>'E05' AS reemplazo_e05
--    FROM configuracion
--    WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid
--      AND clave='catalogo_reemplazos_data';
--
-- Reversa:
--    UPDATE descuentos_modelo dm SET codigos_tubo = b.codigos_tubo
--    FROM descuentos_modelo_backup_e78_20260714 b WHERE dm.id = b.id;
--    UPDATE configuracion c SET valor = b.valor
--    FROM configuracion_backup_e78_20260714 b WHERE c.id = b.id;
--    DELETE FROM insumos
--    WHERE empresa_id='67c635a5-152c-4780-a066-23f5081175a9'::uuid AND cod='E78';
-- ============================================================================
