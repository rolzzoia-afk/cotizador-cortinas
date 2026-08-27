// ─────────────────────────────────────────────────────────────────────
// Las filas del optimizador de paños de UNA OT.
//
// Es la receta que ya usaba Fase 4 para armar la hoja de corte, las etiquetas
// y el BOM, ahora en un solo lugar porque el módulo Producción necesita
// EXACTAMENTE las mismas filas: si el taller viera un plan distinto del que se
// imprime, cortaría otra cosa.
//
// El orden importa y no es caprichoso:
//   1. Se recalculan las filas frescas desde las ventanas (medidas de hoy).
//   2. Se le encima lo GUARDADO en la OT, que es lo que el dimensionador
//      acomodó a mano en la pantalla de Tela.
//   3. Solo si nadie agrupó nada todavía se reparte automáticamente.
// ─────────────────────────────────────────────────────────────────────

import {
  asignarJuntoEnOrden,
  buildOptimizerRows,
  restorePlanGuardado,
  type OptimizerRow,
} from './tela';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametros';
import type { CatalogoProductos } from './types';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import { REGLAS_SELECCION_DEFAULT, type ReglasSeleccion } from '@/modules/descuentos/reglasSeleccion';
import type { OT } from '@/modules/ots/types';

/**
 * ¿El plan ya trae paños agrupados a mano? La letra `'?'` es la marca de «sin
 * asignar» del optimizador, así que no cuenta como agrupación.
 */
export function tieneAgrupacionManual(rows: OptimizerRow[]): boolean {
  return rows.some((r) => r.junto && r.junto !== '' && r.junto !== '?');
}

export function filasOptimizadorDeOT(
  ot: OT,
  catalogo: CatalogoProductos,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  formulas?: FormulasFamilias,
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
): OptimizerRow[] {
  const frescas = buildOptimizerRows(ot.storeVentanas, catalogo, params, formulas, reglas);
  if (frescas.length === 0) return [];
  const restauradas = restorePlanGuardado(frescas, ot.datosGenerales?.optimizerRows);
  return tieneAgrupacionManual(restauradas) ? restauradas : asignarJuntoEnOrden(restauradas);
}
