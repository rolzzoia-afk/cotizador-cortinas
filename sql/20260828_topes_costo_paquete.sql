-- ─────────────────────────────────────────────────────────────────────
-- Topes de cadena 2026-08-28 — corregir el paquete de TOP05 y TOP06
--
-- QUÉ PASA: los topes se compran de a 100, y así están cargados casi todos:
--
--   cod    can_x_paquete  costo     nemotecnico
--   TOP01  100            20,00     TOPES /F-22 BLANCOS
--   TOP03  100            50,42     TOPES TRANSPARENTES
--   TOP04  100            25,00     TOPES GRISES
--   TOP05  1              9.900,00  TOPES NEGROS - ROLZZO      ← el PAQUETE
--   TOP06  1              9.900,00  TOPES METALICOS - ROLZZO   ← el PAQUETE
--
-- El TOP05 y el TOP06 quedaron con `can_x_paquete = 1` y el precio del
-- PAQUETE en `costo`, así que el costo por OT los lee a $9.900 CADA UNO. Con
-- los topes ahora emitidos en el BOM (2 por cortina), una OT de 6 cortinas
-- negras sumaría $118.800 en topes en vez de $1.188. Confirmado con el dueño
-- el 2026-08-28: esos $9.900 son el paquete de 100.
--
-- QUÉ HACE: pone `can_x_paquete = 100` en los dos. NO toca `costo`: el costo
-- unitario se calcula `costo_iva / max(1, can_x_paquete)` (ver
-- InsumosPreciosSection y produccion/costoOT.ts), así que con esto el tope
-- pasa a valer $99 la unidad, en línea con los otros topes.
--
-- El PRECIO DE VENTA no se toca: la receta sigue cobrando su `TOP 03`
-- genérico por cortina, igual que el Excel. Esto es solo costo interno.
--
-- RESPALDO: insumos_backup_20260828_topes (las 6 filas TOP antes del cambio).
-- REVERSA:  UPDATE insumos i SET can_x_paquete = b.can_x_paquete
--           FROM insumos_backup_20260828_topes b WHERE i.id = b.id;
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Respaldo de las filas que se tocan (y sus vecinas, para poder comparar).
CREATE TABLE IF NOT EXISTS insumos_backup_20260828_topes AS
SELECT *
FROM insumos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND cod LIKE 'TOP%';

-- 2. El arreglo. Solo si siguen con el paquete en 1: re-correrlo no hace nada.
UPDATE insumos
SET can_x_paquete = 100,
    updated_at = now()
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND cod IN ('TOP05', 'TOP06')
  AND COALESCE(can_x_paquete, 0) <= 1;

COMMIT;

-- ── Verificación (correr después; deben quedar los 6 con paquete 100) ──
-- SELECT cod, nemotecnico, can_x_paquete, costo, costo_iva,
--        ROUND(COALESCE(costo_iva, costo) / GREATEST(1, can_x_paquete), 2) AS costo_unitario
-- FROM insumos
-- WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--   AND cod LIKE 'TOP%'
-- ORDER BY cod;
--
-- Esperado: TOP05 y TOP06 con can_x_paquete = 100 y costo_unitario ≈ 99,00.
