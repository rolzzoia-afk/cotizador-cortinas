-- ════════════════════════════════════════════════════════════════════
-- FIX · 2026-06-10 (YA APLICADO EN PRODUCCIÓN)
-- Plan e39d647d (OT 3024, "reconstruido-manual@admin", 2026-06-09):
-- fue insertado a mano con es_desecho=false en todas las líneas y
-- fuente='stock', lo que hacía que el Historial de Corte mostrara:
--   · "GUARDAR SOBRANTE" para restos de 0.4 / 1.7 / 6.7 cm (son merma)
--   · cortes desde "colmena A27 / L01" cuando el origen real era un
--     tubo nuevo de largo completo (578 / 600 cm)
--
-- Regla de negocio: sobrante ≤ 10 cm = merma (espejo de MERMA_MAX_MM=100
-- del optimizador). Origen ≥ 570 cm = material nuevo.
--
-- Además (en código, mismo día):
--   · PlanTabla.tsx y exportar-excel.ts ahora fuerzan "DESECHAR MERMA"
--     para sobrantes ≤ 10 cm aunque es_desecho venga falso/ausente, y
--     muestran "TUBO NUEVO" como origen cuando fuente='tubo_nuevo'.
--   · optimizador.html (construirEventosTubos) ya no genera evento
--     'sobrante' para restos ≤ 10 cm — genera 'merma'.
-- ════════════════════════════════════════════════════════════════════

UPDATE planes_corte SET resultados = (
  SELECT jsonb_agg(
    CASE
      WHEN (item->'resultado'->>'sobrante_cm')::numeric > 0
       AND (item->'resultado'->>'sobrante_cm')::numeric <= 10
        THEN jsonb_set(item, '{resultado,es_desecho}', 'true'::jsonb)
      WHEN (item->'resultado'->>'medida_origen')::numeric >= 570
        THEN jsonb_set(item, '{resultado,fuente}', '"tubo_nuevo"'::jsonb)
      ELSE item
    END ORDER BY ord)
  FROM jsonb_array_elements(resultados) WITH ORDINALITY AS t(item, ord)
)
WHERE id = 'e39d647d-17ad-4d6b-959f-860564339ee4';
