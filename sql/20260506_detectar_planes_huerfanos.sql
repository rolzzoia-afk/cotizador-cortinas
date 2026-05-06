-- ============================================================================
-- Capa 3 anti-huérfanos: RPC de detección
-- Fecha: 2026-05-06
-- ============================================================================
--
-- Contexto:
--   Capa 1 (PR #38) y Capa 2 (PR #39) previenen la creación de nuevos planes
--   huérfanos (planes_corte sin eventos correspondientes en tubos_historial).
--   Capa 3 es monitoreo: detecta huérfanos que ya pudieron quedar (por bugs,
--   incidentes, casos edge) y los muestra en un banner del panel de admin.
--
--   Esta RPC NO modifica datos. Solo lee y devuelve la lista.
--
-- Detección por OT (no por plan_id porque el optimizador legacy nunca lo setea):
--   Un plan es huérfano si:
--     - Tiene `resultados` no vacío (jsonb_array_length > 0)
--     - `tipo IS NULL` (no es plan especial como restauración)
--     - NINGUNA de las OTs en `pc.ordenes` tiene eventos
--       corte/sobrante/merma en tubos_historial posteriores a `pc.fecha`
--
--   Si después se hace recovery (eventos rellenados o plan borrado), el plan
--   automáticamente sale del filtro — no necesita estado "resuelto" persistido.
--
-- Ventana de tiempo:
--   Por defecto 30 días. Planes muy viejos rara vez justifican monitoreo
--   activo (probablemente ya se resolvieron o son irrelevantes).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detectar_planes_huerfanos(
  p_empresa_id uuid,
  p_dias integer DEFAULT 30
) RETURNS TABLE (
  plan_id uuid,
  fecha timestamptz,
  ots text[],
  n_resultados integer,
  age_hours numeric,
  optimizer_email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH planes_recientes AS (
    SELECT
      pc.id,
      pc.fecha,
      pc.optimizer_email,
      pc.ordenes,
      jsonb_array_length(COALESCE(pc.resultados, '[]'::jsonb)) AS n_resultados,
      ARRAY(
        SELECT DISTINCT (o->>'ot')
        FROM jsonb_array_elements(COALESCE(pc.ordenes, '[]'::jsonb)) AS o
        WHERE o->>'ot' IS NOT NULL
      ) AS ots_arr
    FROM planes_corte pc
    WHERE pc.empresa_id = p_empresa_id
      AND pc.tipo IS NULL
      AND pc.fecha >= NOW() - (p_dias || ' days')::interval
      AND jsonb_array_length(COALESCE(pc.resultados, '[]'::jsonb)) > 0
  )
  SELECT
    pr.id,
    pr.fecha,
    pr.ots_arr,
    pr.n_resultados,
    ROUND(EXTRACT(EPOCH FROM (NOW() - pr.fecha)) / 3600.0, 1)::numeric,
    pr.optimizer_email
  FROM planes_recientes pr
  WHERE array_length(pr.ots_arr, 1) > 0
    AND NOT EXISTS (
      SELECT 1 FROM tubos_historial th
      WHERE th.empresa_id = p_empresa_id::text
        AND th.ot = ANY(pr.ots_arr)
        AND th.evento IN ('corte', 'sobrante', 'merma')
        AND th.created_at >= pr.fecha
    )
  ORDER BY pr.fecha DESC;
$$;

GRANT EXECUTE ON FUNCTION public.detectar_planes_huerfanos(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.detectar_planes_huerfanos(uuid, integer) IS
'Capa 3 monitoreo: devuelve planes_corte sin eventos en tubos_historial (huérfanos).
Detección por OT — NINGUNA OT del plan tiene eventos corte/sobrante/merma posteriores a la fecha del plan.
Solo lee, no modifica. Ventana default 30 días.';

-- ============================================================================
-- Smoke test (post-deploy):
-- ============================================================================
-- SELECT * FROM detectar_planes_huerfanos(
--   '67c635a5-152c-4780-a066-23f5081175a9'::uuid,
--   30
-- );
-- Esperado: 0 filas (recovery 2026-05-05 ya borró los huérfanos de OT 2939/2941)
-- ============================================================================
