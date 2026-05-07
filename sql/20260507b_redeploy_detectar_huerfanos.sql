-- ============================================================================
-- Fix: re-deploy detectar_planes_huerfanos sin filtro temporal
-- Fecha: 2026-05-07
-- ============================================================================
--
-- Bug detectado:
--   La versión deployada de detectar_planes_huerfanos(uuid, integer) tenía
--   un filtro `AND th.created_at >= pr.fecha` que NO está en el repo (PR #40
--   explícitamente lo removió). Alguien lo agregó directamente en BD.
--
--   Este filtro genera falsos positivos:
--     - El optimizador inserta events vía sync_colmena_tubos PRIMERO
--     - Después hace INSERT a planes_corte
--     - Resultado: events created_at < plan.fecha (típicamente por 1-5 segundos)
--     - Filter excluye los events → plan se marca como huérfano falsamente
--
--   Caso real: plan ce763f27 (OT 2942) tiene 14 cortes + 7 mermas + 7 sobrantes
--   en tubos_historial pero el detector lo flageaba como huérfano.
--
-- También se ajusta el default de p_dias (estaba 30, repo tiene 7).
--
-- Re-deploy idéntico al PR #40 original (sql/20260506_detectar_planes_huerfanos.sql).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detectar_planes_huerfanos(
  p_empresa_id uuid,
  p_dias integer DEFAULT 7
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
    )
  ORDER BY pr.fecha DESC;
$$;

GRANT EXECUTE ON FUNCTION public.detectar_planes_huerfanos(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.detectar_planes_huerfanos(uuid, integer) IS
'Capa 3 monitoreo: devuelve planes_corte sin eventos en tubos_historial (huérfanos).
Detección por OT — NINGUNA OT del plan tiene eventos corte/sobrante/merma jamás.
Solo lee, no modifica. Ventana default 7 días.
NOTA: NO se restringe a eventos posteriores a la fecha del plan, porque el
optimizador inserta events vía sync_colmena_tubos ANTES del INSERT a planes_corte
(events created_at < plan.fecha por unos segundos).';

-- Smoke test:
-- SELECT * FROM detectar_planes_huerfanos(
--   '67c635a5-152c-4780-a066-23f5081175a9'::uuid,
--   7
-- );
-- Esperado: NO debería listar plan ce763f27 (OT 2942) porque tiene events.
