-- ============================================================================
-- DIAGNÓSTICO (SOLO LECTURA): planes de prueba huérfanos del 2026-05-15
-- Fecha: 2026-05-15
-- Empresa: 67c635a5-152c-4780-a066-23f5081175a9 (rolzzoia-produccion)
-- ============================================================================
--
-- Contexto:
--   Durante las pruebas del optimizador, varios guardados "se quedaban cargando"
--   y mostraban el error de verificación, pero el RPC alcanzaba a escribir un
--   plan_corte + eventos en tubos_historial ANTES de fallar (bug ya corregido
--   en optimizador.html el 2026-05-15). Resultado: planes_corte huérfanos +
--   eventos de corte/sobrante que nunca pasaron físicamente. Conteo inicial:
--   35 planes_corte en los últimos 7 días.
--
--   El inventario colmena_tubos ya fue reseteado a ~217 tubos (merge manual con
--   el inventario real del taller), así que el inventario en sí está bien — lo
--   que falta es limpiar los planes y eventos de prueba para que no rompan el
--   próximo guardado real (un evento 'corte'/'eliminado' sin 'ingreso' posterior
--   hace que el RPC descarte ese tubo en el siguiente sync = "tubo que falta").
--
-- Este script NO modifica nada. Solo SELECT. Es 100% seguro de correr.
--
-- Cómo usarlo:
--   Pegá cada bloque numerado en el editor SQL de Supabase, corré uno por uno,
--   y devolvé el resultado de cada uno. Con eso se arma el script de limpieza
--   exacto (con respaldo y verificación, como sql/20260507d_rollback_planes_no_ejecutados.sql).
-- ============================================================================


-- ─── BLOQUE 0: Confirmación rápida (inventario + planes recientes) ──────────
-- total_colmena_tubos debería dar ~217. planes_ultimos_7d debería dar ~35.
WITH emp AS (
  SELECT '67c635a5-152c-4780-a066-23f5081175a9'::uuid AS empresa_id  -- rolzzoia-produccion
)
SELECT
  (SELECT COUNT(*) FROM colmena_tubos ct, emp WHERE ct.empresa_id = emp.empresa_id) AS total_colmena_tubos,
  (SELECT COUNT(*) FROM planes_corte pc, emp
     WHERE pc.empresa_id = emp.empresa_id
       AND pc.fecha >= (NOW() - INTERVAL '7 days'))                               AS planes_ultimos_7d;


-- ─── BLOQUE 1: planes_corte de los últimos 7 días ───────────────────────────
-- Muestra TODOS los planes recientes. Los de prueba son los que NO se cortaron
-- físicamente. Fijate especialmente en:
--   · tipo            → 'respaldo' es el punto de restauración; el otro es el plan activo
--   · n_snapshot      → si es 0, el plan tiene el snapshot vacío (bug ya corregido)
--   · ot_resumen      → la(s) OT del plan
WITH emp AS (
  SELECT '67c635a5-152c-4780-a066-23f5081175a9'::uuid AS empresa_id  -- rolzzoia-produccion
)
SELECT
  pc.id,
  pc.fecha,
  pc.fecha_correccion,
  pc.tipo,
  pc.optimizer_email,
  jsonb_array_length(COALESCE(pc.resultados, '[]'::jsonb))          AS n_resultados,
  jsonb_array_length(COALESCE(pc.snapshot_inventario, '[]'::jsonb)) AS n_snapshot,
  (
    SELECT string_agg(DISTINCT (o->>'ot'), ', ')
    FROM jsonb_array_elements(COALESCE(pc.ordenes, '[]'::jsonb)) o
  ) AS ot_resumen
FROM planes_corte pc, emp
WHERE pc.empresa_id = emp.empresa_id
  AND pc.fecha >= (NOW() - INTERVAL '7 days')
ORDER BY pc.fecha DESC;


-- ─── BLOQUE 2: eventos de tubos_historial de los últimos 7 días ─────────────
-- Agrupado por día + fuente + evento. Sirve para distinguir:
--   · los eventos del merge real (fuente tipo 'carga_inicial', 'merge...', etc.)
--     → esos se CONSERVAN
--   · los eventos de las pruebas del optimizador (fuente 'optimizador',
--     'consolidacion_peso', 'sync_tombstone_autocurado', 'ingreso_retroactivo_auto')
--     → esos se BORRAN en la limpieza
WITH emp AS (
  SELECT '67c635a5-152c-4780-a066-23f5081175a9'::uuid AS empresa_id  -- rolzzoia-produccion
)
SELECT
  (th.created_at AT TIME ZONE 'UTC')::date AS dia,
  th.fuente,
  th.evento,
  COUNT(*) AS cantidad,
  MIN(th.created_at) AS primero,
  MAX(th.created_at) AS ultimo
FROM tubos_historial th, emp
WHERE th.empresa_id = emp.empresa_id::text
  AND th.created_at >= (NOW() - INTERVAL '7 days')
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2, 3;


-- ─── BLOQUE 3: conteo actual del inventario ─────────────────────────────────
-- Debería dar ~217 (el inventario real del taller que cargaste con el merge).
WITH emp AS (
  SELECT '67c635a5-152c-4780-a066-23f5081175a9'::uuid AS empresa_id  -- rolzzoia-produccion
)
SELECT COUNT(*) AS total_colmena_tubos
FROM colmena_tubos ct, emp
WHERE ct.empresa_id = emp.empresa_id;


-- ─── BLOQUE 4: estado del lock de sincronización ────────────────────────────
WITH emp AS (
  SELECT '67c635a5-152c-4780-a066-23f5081175a9'::uuid AS empresa_id  -- rolzzoia-produccion
)
SELECT css.*
FROM colmena_sync_state css, emp
WHERE css.empresa_id = emp.empresa_id;


-- ─── BLOQUE 5: ⚠️ "MINAS" — tubos que romperían el próximo guardado ─────────
-- Tubos que HOY están en colmena_tubos (inventario real) pero cuyo ÚLTIMO evento
-- en el historial es 'corte', 'eliminado' o 'merma'. Para el RPC, esos tubos
-- están "consumidos/tombstoneados" → los descartaría en el próximo sync (el
-- mismo síntoma "N en BD vs M enviados (faltan)"). Si este bloque devuelve filas,
-- la limpieza de eventos de prueba es necesaria, no opcional.
WITH emp AS (
  SELECT '67c635a5-152c-4780-a066-23f5081175a9'::uuid AS empresa_id  -- rolzzoia-produccion
),
ultimo_evento AS (
  SELECT DISTINCT ON (th.tubo_raiz_id)
    th.tubo_raiz_id,
    th.evento      AS ultimo_evento,
    th.fuente      AS ultima_fuente,
    th.created_at  AS ultimo_evento_at
  FROM tubos_historial th, emp
  WHERE th.empresa_id = emp.empresa_id::text
    AND th.tubo_raiz_id IS NOT NULL
  ORDER BY th.tubo_raiz_id, th.created_at DESC
)
SELECT
  ct.n_colmena,
  ct.cod,
  ct.medida_cm,
  ct.tubo_raiz_id,
  ue.ultimo_evento,
  ue.ultima_fuente,
  ue.ultimo_evento_at
FROM colmena_tubos ct
JOIN emp ON ct.empresa_id = emp.empresa_id
JOIN ultimo_evento ue ON ue.tubo_raiz_id = ct.tubo_raiz_id
WHERE ue.ultimo_evento IN ('corte', 'eliminado', 'merma')
ORDER BY ue.ultimo_evento_at DESC;


-- ─── BLOQUE 6: resumen de conteo de "minas" ─────────────────────────────────
-- La versión corta del bloque 5: cuántos tubos están en riesgo.
WITH emp AS (
  SELECT '67c635a5-152c-4780-a066-23f5081175a9'::uuid AS empresa_id  -- rolzzoia-produccion
),
ultimo_evento AS (
  SELECT DISTINCT ON (th.tubo_raiz_id)
    th.tubo_raiz_id,
    th.evento AS ultimo_evento
  FROM tubos_historial th, emp
  WHERE th.empresa_id = emp.empresa_id::text
    AND th.tubo_raiz_id IS NOT NULL
  ORDER BY th.tubo_raiz_id, th.created_at DESC
)
SELECT
  COUNT(*) FILTER (WHERE ue.ultimo_evento IN ('corte','eliminado','merma')) AS tubos_en_riesgo,
  COUNT(*)                                                                 AS tubos_con_historial
FROM colmena_tubos ct
JOIN emp ON ct.empresa_id = emp.empresa_id
LEFT JOIN ultimo_evento ue ON ue.tubo_raiz_id = ct.tubo_raiz_id;
