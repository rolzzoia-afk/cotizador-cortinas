// Helpers de parseo y extracción del Historial de Corte.
// Los planes vienen de Supabase con JSON jsonb-empacado de distinta forma
// según el origen — estos helpers normalizan la lectura.

import type { Orden, Plan, ResultadoCorte, ResultadoItem } from '../HistorialCorte.types';

export function tryParse<T>(val: unknown, fallback: T): T {
  if (Array.isArray(val)) return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function getR(item: ResultadoItem): ResultadoCorte {
  return (item.resultado ?? item) as ResultadoCorte;
}

export function getOrd(item: ResultadoItem, ordenes: Orden[]): Orden {
  const raw = item.orden;
  if (raw && typeof raw === 'object') return raw;
  const r = getR(item);
  const ordIdOrVal = (r.orden ?? item.orden) as string | null;
  return ordenes.find((o) => o.id === ordIdOrVal) || ({} as Orden);
}

export function extraerOTs(plan: Plan): string[] {
  const set = new Set<string>();
  for (const item of plan.resultados || []) {
    const ord = getOrd(item, plan.ordenes || []);
    const r = getR(item);
    const ot = ord.ot || ord.numero_ot || r.orden;
    if (ot && ot !== '-') set.add(String(ot).trim());
  }
  return [...set];
}
