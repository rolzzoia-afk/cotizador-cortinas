-- ============================================================================
-- Índices sobre tubos_historial para reducir Disk IO budget consumption
-- Fecha: 2026-05-15
-- ============================================================================
--
-- Contexto:
--   Supabase reportó "Project is depleting its Disk IO Budget" + "exhausting
--   multiple resources, performance affected" en el plan NANO. Causa raíz:
--   `tubos_historial` no tiene ningún índice más allá del PK. Cada
--   `guardar_plan_atomico` ejecuta ~200 NOT EXISTS contra `tubos_historial`
--   (filtro tombstone V2), y cada uno hace table scan completo. Con
--   decenas de miles de filas en historial, cada save consume IOPS
--   proporcionales a (tubos_del_plan × filas_de_historial).
--
-- Queries cubiertas por los índices:
--   1) Filtro tombstone V2 del RPC (sql/20260513b... y sql/20260515...):
--        WHERE empresa_id = X::text
--          AND tubo_raiz_id = Y
--          AND evento = 'eliminado'
--          AND NOT EXISTS (... evento='ingreso' AND created_at > ...)
--   2) Prefetch consolidación de pesos (optimizador.html línea 2137):
--        WHERE empresa_id = X AND evento = 'ingreso' AND tubo_raiz_id IN (...)
--   3) Prefetch construirEventosTubos (optimizador.html línea 6609):
--        WHERE empresa_id = X AND evento = 'ingreso' AND tubo_raiz_id IN (...)
--   4) Auto-cura tombstone (sincronizarColmenaFinalConTabla línea 2824):
--        WHERE empresa_id = X AND tubo_raiz_id IN (...) ORDER BY created_at DESC
--   5) Capa 4 verificación post-sync (optimizador.html línea 7212):
--        WHERE empresa_id = X AND ot IN (...) AND evento IN (...) AND created_at >= ...
--
-- IMPORTANTE — cómo ejecutar:
--   `CREATE INDEX CONCURRENTLY` NO se puede correr dentro de una transacción.
--   En el SQL Editor de Supabase, ejecutar UN STATEMENT A LA VEZ
--   (seleccionar la línea del CREATE INDEX y "Run selected"). Si el editor
--   intenta envolverlo en una transacción y falla con "CREATE INDEX
--   CONCURRENTLY cannot run inside a transaction block", usar `psql` o
--   eliminar el `CONCURRENTLY` (esto bloquea writes durante el build,
--   ~segundos para una tabla mediana).
--
-- Tipos relevantes:
--   - tubos_historial.empresa_id es `text` (no uuid) por inconsistencia
--     histórica de schema. Los índices van sobre el tipo real.
--
-- Reversibilidad:
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_tubos_historial_tombstone;
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_tubos_historial_ot_evento;
-- ============================================================================

-- 1) Index principal: cubre tombstone V2 + todos los prefetches por tubo_raiz_id.
--    Leading prefix (empresa_id, tubo_raiz_id) cubre lookups por UUID;
--    incluir evento permite filtrar 'eliminado'/'ingreso' sin scan;
--    incluir created_at permite el ORDER BY DESC y el rango created_at > ...
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tubos_historial_tombstone
    ON public.tubos_historial (empresa_id, tubo_raiz_id, evento, created_at);

-- 2) Index para verificación Capa 4 (lookup por OT):
--    Optimizador chequea post-sync que los eventos de las OTs del plan
--    aparezcan en tubos_historial. Sin index, cada Capa 4 hace seq scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tubos_historial_ot_evento
    ON public.tubos_historial (empresa_id, ot, evento, created_at);
