// ─────────────────────────────────────────────────────────────────────
// Cálculos puros para la barra de progreso de stock.
//
// Por qué vive acá y no dentro de ProductRow / StockBar:
//   - Es lógica determinística (mismo item → mismo número) y pura.
//   - Permite cambiar la fórmula en un solo lugar si en el futuro hay
//     que ajustar el denominador (ej. si se agrega "stock asignado por
//     temporada" o algo así).
//   - Facilita testearla aisladamente.
// ─────────────────────────────────────────────────────────────────────

import type { InventoryItem } from '../types';

// Mínimo razonable para que la barra no se vea "rota" cuando el item
// tiene asignaciones muy chicas. Si en algún caso real un item tiene
// menos de 30m de stock original, el denominador se piso a 30 — la
// barra muestra "casi llena" en vez de un valor visualmente desproporcionado.
const MIN_DENOM_METERS = 30;

/**
 * Devuelve el valor de referencia (denominador) para la barra de progreso.
 *
 * Prioridad:
 *   1. `metrosOriginales` (snapshot al ingreso) — el caso normal.
 *   2. `totalMetros` actual — fallback si por alguna razón el item no tiene metros_originales.
 *   3. `rollos * metros` — fallback histórico (legacy).
 *   4. Mínimo 30 m para que la barra se vea proporcional.
 */
export function calcMaxMeters(item: InventoryItem): number {
  return Math.max(
    item.metrosOriginales || item.totalMetros || 0,
    item.totalMetros || 0,
    item.rollos * item.metros,
    MIN_DENOM_METERS,
  );
}

/**
 * Devuelve el porcentaje (0-100) que la barra debe mostrar para este item.
 */
export function calcStockPercent(item: InventoryItem): number {
  const max = calcMaxMeters(item);
  if (max <= 0) return 0;
  return Math.min(100, Math.round((item.totalMetros / max) * 100));
}
