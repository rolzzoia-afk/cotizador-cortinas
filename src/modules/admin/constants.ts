// Config del panel Ojo de Dios — estados de OT con label/color/bg estilo legacy.
// En el cotizador ya existe OT_ESTADO_META — este archivo es más corto y usa
// el estado "entregado" que legacy tenía para OTs cerradas (instalada + lista).

import type { OTEstado } from '@/modules/ots/types';

export const ODIOS_ESTADOS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  cotizacion: { label: 'Cotización', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  esperando:  { label: 'Esperando',  color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
  terreno:    { label: 'Terreno',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  aprobada:   { label: 'Aprobada',   color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  produccion: { label: 'Producción', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  lista:      { label: 'Lista',      color: '#c084fc', bg: 'rgba(168,85,247,0.15)' },
  instalada:  { label: 'Instalada',  color: '#14b8a6', bg: 'rgba(20,184,166,0.15)' },
  entregado:  { label: 'Entregado',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  archivada:  { label: 'Archivada',  color: '#71717a', bg: 'rgba(113,113,122,0.15)' },
};

export const ESTADOS_ACTIVOS: OTEstado[] = ['cotizacion', 'esperando', 'terreno', 'produccion'];

export function diasDesde(fechaStr: string | null | undefined): string {
  if (!fechaStr) return '—';
  const d = Math.floor((Date.now() - new Date(fechaStr).getTime()) / 86400000);
  return d === 0 ? 'hoy' : d === 1 ? '1 día' : `${d} días`;
}
