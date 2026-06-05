// Helper puro: extrae el conjunto único de OTs asociadas a un plan.
// Mira tanto `plan.ordenes` (autoritativo) como cada línea de
// `plan.resultados` (fallback por si ordenes viene vacío).
//
// Vive en utils/ porque es determinístico y testeable. Lo usan
// `CorreccionRetroactivaSection` y `HistorialPlanes`.

import type { PlanResumen } from '@/modules/admin/correcciones';

export function extraerOTsPlan(plan: PlanResumen): string[] {
  const set = new Set<string>();
  for (const o of plan.ordenes || []) {
    const ot = (o?.ot || '').toString().trim();
    if (ot && ot !== '-') set.add(ot);
  }
  for (const linea of plan.resultados || []) {
    const ordRef = (linea as { orden?: { ot?: string } }).orden;
    const ot = (ordRef?.ot || '').toString().trim();
    if (ot && ot !== '-') set.add(ot);
  }
  return [...set].sort();
}
