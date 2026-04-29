-- ============================================================================
-- DRY-RUN: identificar los tubos del baseline 3673315c-0c40-4f16-94ed-3aff26a710f2
-- que fueron borrados silenciosamente de colmena_tubos por un sync stale el
-- 29/4 ~15:28 (operario postventa@cortinasrolzzo.cl, cliente cache pre-baseline).
--
-- Este script es READ-ONLY. NO modifica nada.
-- Correr y verificar:
--   - Q1 debe devolver ~81 filas (los candidatos a recuperar)
--   - Q2 debe devolver el conteo agregado por colmena para revisar a ojo
--   - Q3 lista los empresa_id involucrados (debería ser uno solo)
-- ============================================================================

-- Q1) Lista completa de candidatos a recuperar
WITH baseline_ingreso AS (
    -- Todos los tubos que el baseline insertó originalmente
    SELECT
        empresa_id,
        tubo_raiz_id,
        n_colmena,
        cod,
        medida_cm,
        created_at AS baseline_at
    FROM tubos_historial
    WHERE evento = 'ingreso'
      AND notas LIKE '%3673315c-0c40-4f16-94ed-3aff26a710f2%'
),
con_evento_posterior AS (
    -- Tubos que SÍ tuvieron evento legítimo después del baseline (corte, eliminado,
    -- sobrante consumido, etc.) — NO los recuperamos, eso es uso normal.
    SELECT DISTINCT bi.tubo_raiz_id
    FROM baseline_ingreso bi
    JOIN tubos_historial th
      ON th.tubo_raiz_id = bi.tubo_raiz_id
     AND th.empresa_id   = bi.empresa_id
     AND th.created_at   > bi.baseline_at
     AND th.evento IN ('corte', 'eliminado', 'merma', 'ingreso')
)
SELECT
    bi.empresa_id,
    bi.tubo_raiz_id,
    bi.n_colmena,
    bi.cod,
    bi.medida_cm,
    bi.baseline_at
FROM baseline_ingreso bi
LEFT JOIN colmena_tubos ct
       ON ct.tubo_raiz_id = bi.tubo_raiz_id
      AND ct.empresa_id::text = bi.empresa_id
LEFT JOIN con_evento_posterior cep
       ON cep.tubo_raiz_id = bi.tubo_raiz_id
WHERE ct.id IS NULL          -- ya NO está en colmena_tubos
  AND cep.tubo_raiz_id IS NULL  -- y no tuvo evento legítimo posterior
ORDER BY bi.n_colmena, bi.cod, bi.medida_cm;


-- Q2) Resumen agregado por colmena (para sanity check visual)
WITH baseline_ingreso AS (
    SELECT empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, created_at AS baseline_at
    FROM tubos_historial
    WHERE evento = 'ingreso'
      AND notas LIKE '%3673315c-0c40-4f16-94ed-3aff26a710f2%'
),
con_evento_posterior AS (
    SELECT DISTINCT bi.tubo_raiz_id
    FROM baseline_ingreso bi
    JOIN tubos_historial th
      ON th.tubo_raiz_id = bi.tubo_raiz_id
     AND th.empresa_id   = bi.empresa_id
     AND th.created_at   > bi.baseline_at
     AND th.evento IN ('corte', 'eliminado', 'merma', 'ingreso')
)
SELECT
    bi.n_colmena,
    COUNT(*) AS perdidos,
    array_agg(DISTINCT bi.cod ORDER BY bi.cod) AS codigos
FROM baseline_ingreso bi
LEFT JOIN colmena_tubos ct
       ON ct.tubo_raiz_id = bi.tubo_raiz_id
      AND ct.empresa_id::text = bi.empresa_id
LEFT JOIN con_evento_posterior cep
       ON cep.tubo_raiz_id = bi.tubo_raiz_id
WHERE ct.id IS NULL
  AND cep.tubo_raiz_id IS NULL
GROUP BY bi.n_colmena
ORDER BY perdidos DESC;


-- Q3) Empresa(s) afectada(s) — esperamos exactamente una fila
WITH baseline_ingreso AS (
    SELECT empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, created_at AS baseline_at
    FROM tubos_historial
    WHERE evento = 'ingreso'
      AND notas LIKE '%3673315c-0c40-4f16-94ed-3aff26a710f2%'
),
con_evento_posterior AS (
    SELECT DISTINCT bi.tubo_raiz_id
    FROM baseline_ingreso bi
    JOIN tubos_historial th
      ON th.tubo_raiz_id = bi.tubo_raiz_id
     AND th.empresa_id   = bi.empresa_id
     AND th.created_at   > bi.baseline_at
     AND th.evento IN ('corte', 'eliminado', 'merma', 'ingreso')
)
SELECT
    bi.empresa_id,
    COUNT(*) AS total_perdidos
FROM baseline_ingreso bi
LEFT JOIN colmena_tubos ct
       ON ct.tubo_raiz_id = bi.tubo_raiz_id
      AND ct.empresa_id::text = bi.empresa_id
LEFT JOIN con_evento_posterior cep
       ON cep.tubo_raiz_id = bi.tubo_raiz_id
WHERE ct.id IS NULL
  AND cep.tubo_raiz_id IS NULL
GROUP BY bi.empresa_id;
