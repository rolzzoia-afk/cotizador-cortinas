-- ============================================================================
-- DIAGNÓSTICO (SOLO LECTURA): ¿está actualizada la función RPC en la base?
-- Fecha: 2026-05-15
-- Empresa: 67c635a5-152c-4780-a066-23f5081175a9 (rolzzoia-produccion)
-- ============================================================================
--
-- Hipótesis:
--   El optimizador "auto-cura" los tubos tombstoneados mandándole eventos de
--   ingreso a la RPC vía el parámetro p_eventos. Pero ese auto-curado solo
--   funciona si la función guardar_plan_atomico de la BD CONSIDERA p_eventos
--   en su filtro tombstone. Ese fix está en el archivo
--   sql/20260515_rpc_tombstone_considera_p_eventos.sql — si nunca se ejecutó,
--   la función en la BD es vieja y descarta el tubo igual → "216 en BD vs 217".
--
-- Este script NO modifica nada. Solo SELECT.
-- ============================================================================


-- ─── BLOQUE 1: ¿La función RPC tiene el fix de p_eventos? ───────────────────
-- Si la columna `tiene_fix_p_eventos` da FALSE para guardar_plan_atomico,
-- ESA es la causa: hay que ejecutar 20260515_rpc_tombstone_considera_p_eventos.sql
SELECT
  p.proname                                                                   AS funcion,
  pg_get_function_identity_arguments(p.oid)                                   AS argumentos,
  (pg_get_functiondef(p.oid) ILIKE '%jsonb_array_elements(COALESCE(p_eventos%') AS tiene_fix_p_eventos
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('guardar_plan_atomico', 'sync_colmena_tubos')
ORDER BY p.proname, argumentos;


-- ─── BLOQUE 2: tombstones activos (tubos "marcados como eliminados") ────────
-- UUIDs con un evento 'eliminado' sin un 'ingreso' posterior. La columna
-- `esta_en_inventario` dice si ese UUID está HOY en colmena_tubos — si alguno
-- da TRUE, ese es exactamente el tubo que la RPC descarta en cada guardado.
WITH emp AS (
  SELECT '67c635a5-152c-4780-a066-23f5081175a9'::uuid AS empresa_id
),
elim AS (
  SELECT th.tubo_raiz_id, MAX(th.created_at) AS max_elim
  FROM tubos_historial th, emp
  WHERE th.empresa_id = emp.empresa_id::text
    AND th.evento = 'eliminado'
    AND th.tubo_raiz_id IS NOT NULL
  GROUP BY th.tubo_raiz_id
),
ingr AS (
  SELECT th.tubo_raiz_id, MAX(th.created_at) AS max_ingr
  FROM tubos_historial th, emp
  WHERE th.empresa_id = emp.empresa_id::text
    AND th.evento = 'ingreso'
    AND th.tubo_raiz_id IS NOT NULL
  GROUP BY th.tubo_raiz_id
)
SELECT
  e.tubo_raiz_id,
  e.max_elim,
  i.max_ingr,
  EXISTS (
    SELECT 1 FROM colmena_tubos ct, emp
    WHERE ct.empresa_id = emp.empresa_id
      AND ct.tubo_raiz_id = e.tubo_raiz_id
  ) AS esta_en_inventario
FROM elim e
LEFT JOIN ingr i ON i.tubo_raiz_id = e.tubo_raiz_id
WHERE i.max_ingr IS NULL OR i.max_ingr <= e.max_elim
ORDER BY e.max_elim DESC;


-- ─── BLOQUE 3: estado actual (inventario + planes nuevos) ───────────────────
-- tubos_ahora seguramente dará 216 (la prueba fallida lo movió de 217).
-- planes_ultimo_dia muestra los planes huérfanos nuevos de las pruebas de hoy.
SELECT
  (SELECT COUNT(*) FROM colmena_tubos
     WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid)            AS tubos_ahora,
  (SELECT COUNT(*) FROM planes_corte
     WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
       AND fecha >= NOW() - INTERVAL '1 day')                                   AS planes_ultimo_dia;
