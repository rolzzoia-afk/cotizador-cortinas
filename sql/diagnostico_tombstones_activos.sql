-- ============================================================================
-- Diagnostico: TODOS los UUIDs con tombstone activo en tubos_historial
-- Fecha: 2026-05-15
-- ============================================================================
--
-- Lista TODOS los tubo_raiz_id de tubos_historial cuyo MAX(eliminado.created_at)
-- es mayor o igual al MAX(ingreso.created_at) (o no tiene ingreso). Esos son
-- los que el RPC tombstone V2 descarta. NO joinea contra colmena_tubos:
-- incluye los UUIDs que pueden estar SOLO en el cache local del browser.
--
-- Tambien devuelve el conteo total + un sample de los 50 mas recientes.
-- Si el conteo es chico (< 50), revisar uno por uno cual coincide con la
-- colmena que el optimizador esta intentando sincronizar.
--
-- Empresa: taller (cambiar si corresponde).
-- ============================================================================

WITH max_elim AS (
    SELECT tubo_raiz_id, MAX(created_at) AS ts
    FROM tubos_historial
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
      AND evento = 'eliminado'
      AND tubo_raiz_id IS NOT NULL
    GROUP BY tubo_raiz_id
),
max_ing AS (
    SELECT tubo_raiz_id, MAX(created_at) AS ts
    FROM tubos_historial
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
      AND evento = 'ingreso'
      AND tubo_raiz_id IS NOT NULL
    GROUP BY tubo_raiz_id
),
tombstoned AS (
    SELECT e.tubo_raiz_id, e.ts AS max_elim_ts, i.ts AS max_ing_ts
    FROM max_elim e
    LEFT JOIN max_ing i USING (tubo_raiz_id)
    WHERE i.ts IS NULL OR i.ts <= e.ts
)
SELECT
    (SELECT COUNT(*) FROM tombstoned)                AS total_tombstoneados,
    t.tubo_raiz_id,
    t.max_elim_ts,
    t.max_ing_ts,
    th.n_colmena   AS ultimo_n_colmena,
    th.cod         AS ultimo_cod,
    th.medida_cm   AS ultima_medida_cm,
    th.fuente      AS ultimo_fuente
FROM tombstoned t
LEFT JOIN LATERAL (
    SELECT n_colmena, cod, medida_cm, fuente
    FROM tubos_historial
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
      AND tubo_raiz_id = t.tubo_raiz_id
      AND evento = 'eliminado'
    ORDER BY created_at DESC
    LIMIT 1
) th ON true
ORDER BY t.max_elim_ts DESC
LIMIT 50;
