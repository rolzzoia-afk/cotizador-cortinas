// ─────────────────────────────────────────────────────────────────────
// QUÉ OTs entran al plan de corte de tela. Módulo PURO: es la decisión que
// antes vivía dentro del `cargar()` de PlanCorteSection, sacada afuera para
// poder probarla y para que el plan de un LOTE use exactamente el mismo motor
// con otra lista de OTs.
//
// Dos alcances:
//   · OT abierta  — la OT desde la que se abrió el optimizador SIEMPRE entra,
//                   aunque no esté en producción, y la acompañan todas las que
//                   sí lo están (el plan combinado de siempre).
//   · Lote        — SOLO las OTs del lote que siguen en producción. Nada se
//                   inyecta: si el jefe armó el lote, la lista es la suya.
// ─────────────────────────────────────────────────────────────────────

import type { OT } from '@/modules/ots/types';

/** La fila cruda de `ots` tal como la pide el plan de corte. */
export type FilaOTPlan = {
  id: string;
  items: unknown;
  datos_generales: unknown;
  numero_ot: string | null;
};

/**
 * Pasa las filas de OTs en producción a la forma que come el motor de corte.
 *
 * Descarta las huérfanas (sin cliente y sin OT en datos_generales: fantasmas
 * que quedaron en producción) y las que no tienen ventanas, y completa el
 * número desde la columna `numero_ot` cuando datos_generales no lo trae.
 */
export function otsDelPlan(filas: FilaOTPlan[]): OT[] {
  return (filas || [])
    .map((row) => {
      const dgOriginal = (row.datos_generales || {}) as OT['datosGenerales'];
      const tieneDatos =
        (dgOriginal.cliente || '').trim() !== '' || (dgOriginal.ot || '').trim() !== '';
      if (!tieneDatos) return null;

      const dg = { ...dgOriginal };
      if (!dg.ot && row.numero_ot) dg.ot = row.numero_ot;
      return {
        id: row.id,
        storeVentanas: (row.items || []) as OT['storeVentanas'],
        datosGenerales: dg,
      } as OT;
    })
    .filter((o): o is OT => o !== null && (o.storeVentanas || []).length > 0);
}

export type AlcancePlan = { otActual: OT } | { otIds: string[] };

/**
 * La lista definitiva de OTs del plan, según el alcance.
 *
 * En modo OT abierta reproduce el comportamiento histórico: las OTs en
 * producción más la OT actual si no venía en la lista (antes se omitía y el
 * usuario veía solo los paños de OTRAS OTs creyendo que eran de la suya).
 *
 * En modo lote NO se inyecta nada: una OT del lote que ya salió de producción
 * simplemente no aparece, y la pantalla lo avisa.
 */
export function resolverOtsDelPlan(otsProd: OT[], alcance: AlcancePlan): OT[] {
  if ('otIds' in alcance) {
    const quiero = new Set(alcance.otIds.map((id) => String(id)));
    return otsProd.filter((o) => quiero.has(String(o.id)));
  }
  const actual = alcance.otActual;
  const yaIncluida = otsProd.some((o) => String(o.id) === String(actual.id));
  return yaIncluida ? otsProd : [actual, ...otsProd];
}
