-- ============================================================================
-- Diagnostico: tubos en colmena con tombstone activo
-- Fecha: 2026-05-15
-- ============================================================================
--
-- Lista los UUIDs que estan en colmena_tubos (inventario fisico actual) pero
-- tienen un `eliminado` en tubos_historial sin `ingreso` posterior. Esos son
-- los que el RPC tombstone V2 descarta al sincronizar, disparando
-- "Verificacion fallo: N en BD vs M enviados".
--
-- Cambiar el empresa_id si no es el taller.
-- ============================================================================

WITH max_elim AS (
    SELECT tubo_raiz_id, MAX(created_at) AS ts
    FROM tubos_historial
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
      AND evento = 'eliminado'
    GROUP BY tubo_raiz_id
),
max_ing AS (
    SELECT tubo_raiz_id, MAX(created_at) AS ts
    FROM tubos_historial
    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
      AND evento = 'ingreso'
    GROUP BY tubo_raiz_id
),
tombstoned AS (
    SELECT e.tubo_raiz_id, e.ts AS max_elim_ts, i.ts AS max_ing_ts
    FROM max_elim e
    LEFT JOIN max_ing i USING (tubo_raiz_id)
    WHERE i.ts IS NULL OR i.ts <= e.ts
)
SELECT
    ct.tubo_raiz_id,
    ct.n_colmena,
    ct.cod,
    ct.medida_cm,
    t.max_elim_ts,
    t.max_ing_ts
FROM colmena_tubos ct
JOIN tombstoned t ON t.tubo_raiz_id = ct.tubo_raiz_id
WHERE ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
ORDER BY ct.n_colmena, ct.cod, ct.medida_cm;
