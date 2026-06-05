// Helpers puros de formato para el Panel de Inteligencia.

import type { OT } from '../Inteligencia.types';

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('es-CL', { maximumFractionDigits: 1 });
}

export function diasDesde(fecha: string | null): number {
  if (!fecha) return 999;
  const d = new Date(fecha);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function fmtFecha(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function fmtFechaHora(fecha: string | null): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return `${d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString(
    'es-CL',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

export function dgStr(ot: OT, keys: string[]): string | null {
  const dg = (ot.datos_generales || {}) as Record<string, unknown>;
  for (const k of keys) {
    const v = dg[k];
    if (v != null && v !== '') return String(v);
  }
  return null;
}
