-- ─────────────────────────────────────────────────────────────────────
-- Backfill 2026-08-27 — 15 tubos fantasma en la colmena (YA APLICADO)
--
-- Este script ya se corrió en producción el 2026-08-27; queda acá como
-- registro y es idempotente (re-correrlo inserta 0 filas).
--
-- QUÉ PASÓ: al guardar los planes del 25-26/8 (OTs #3197 y #3202), el
-- optimizador legacy escribió los eventos `sobrante` de los retazos con un
-- UUID, y el sync completo de la colmena dejó esas mismas piezas con OTRO
-- UUID (desfase conocido del cliente legacy; probablemente dos pestañas o
-- estado local divergente). Resultado: 15 filas de colmena sin ningún evento
-- de origen bajo su UUID → «Inventario fantasma: 15» en Reconciliación y el
-- toast rojo «Descuadre detectado en la colmena» (verificar_salud_colmena,
-- chequeo tubos_sin_origen).
--
-- QUÉ HACE: repone un evento `ingreso` en tubos_historial para cada fila de
-- colmena sin origen, con el UUID que la colmena tiene HOY. Se arregla el
-- historial y no la colmena porque el historial es append-only: el próximo
-- sync completo del legacy no lo pisa (cambiarle el UUID a la colmena sí se
-- revertiría, el cliente manda su estado local).
--
-- created_at = 2026-08-26 19:31:48+00, el timestamp del lote del plan del
-- 26/8: anterior a cualquier corte futuro de estos tubos, así no nacen
-- huérfanos (el chequeo exige origen con created_at <= corte).
--
-- RESPALDO: tubos_historial_backup_20260827_fantasmas (10.912 filas, el
-- historial completo de la empresa antes del insert).
-- REVERSA:  DELETE FROM tubos_historial
--           WHERE fuente = 'backfill_fantasmas_20260827';
--
-- VERIFICADO POST-APLICACIÓN: sin_origen 0 · huérfanos 0 · dup_uuid 0 ·
-- ult_problem 0 · perdidos 901 (sin cambio: patrón viejo, no lo toca este
-- fix). Queda el warning `duplicados_fisicos` = 12, benigno: son lotes de
-- barras vírgenes idénticas sin serial (31× E01 186,0 y 35× E40 185,8 de la
-- gama B en «Clase B», entre otros) — ámbar en el widget, no dispara toast.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS tubos_historial_backup_20260827_fantasmas AS
SELECT * FROM tubos_historial
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9';

INSERT INTO tubos_historial
  (id, empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, evento, fuente, notas, registrado_por, created_at)
SELECT gen_random_uuid(),
       '67c635a5-152c-4780-a066-23f5081175a9',
       ct.tubo_raiz_id, ct.n_colmena, ct.cod, ct.medida_cm,
       'ingreso',
       'backfill_fantasmas_20260827',
       'Backfill 2026-08-27: el sobrante de los planes del 25-26/8 quedó en colmena con un UUID distinto del evento sobrante (desfase del optimizador legacy). Se repone el origen para el UUID vigente.',
       'backfill',
       '2026-08-26 19:31:48+00'::timestamptz
FROM colmena_tubos ct
WHERE ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND ct.tubo_raiz_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tubos_historial th
    WHERE th.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
      AND th.tubo_raiz_id = ct.tubo_raiz_id
      AND th.evento IN ('ingreso','sobrante','restauracion','ajuste','sobrante_error'));

COMMIT;

-- Smoke test (debe dar 0):
-- SELECT COUNT(*) FROM colmena_tubos ct
-- WHERE ct.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--   AND ct.tubo_raiz_id IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM tubos_historial th
--     WHERE th.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--       AND th.tubo_raiz_id = ct.tubo_raiz_id
--       AND th.evento IN ('ingreso','sobrante','restauracion','ajuste','sobrante_error'));
