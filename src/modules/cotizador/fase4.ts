// Helpers y constantes de Fase 4 (Producción).
// Portado parcial del legacy: solo sub-etapas + BOM read-only.
// Plan de corte, colmena, optimizador de paños y PDF siguen en legacy
// por ahora (se abren desde el botón "Abrir Tela (legacy)").

import type { SubEtapaProd } from '@/modules/ots/types';

// Meta por sub-etapa: label, color, % de avance.
export const SUB_ETAPA_META: Record<
  SubEtapaProd,
  { label: string; color: string; bg: string; border: string; pct: number; orden: number }
> = {
  Estructura: {
    label: 'Estructura',
    color: '#60a5fa',
    bg: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.4)',
    pct: 55,
    orden: 1,
  },
  'Paños': {
    label: 'Paños',
    color: '#818cf8',
    bg: 'rgba(99,102,241,0.15)',
    border: 'rgba(99,102,241,0.4)',
    pct: 62,
    orden: 2,
  },
  Dimensionado: {
    label: 'Dimensionado',
    color: '#c084fc',
    bg: 'rgba(168,85,247,0.15)',
    border: 'rgba(168,85,247,0.4)',
    pct: 69,
    orden: 3,
  },
  Armado: {
    label: 'Armado',
    color: '#f472b6',
    bg: 'rgba(244,114,182,0.15)',
    border: 'rgba(244,114,182,0.4)',
    pct: 76,
    orden: 4,
  },
  Prueba: {
    label: 'Prueba',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.15)',
    border: 'rgba(251,191,36,0.4)',
    pct: 83,
    orden: 5,
  },
  Lista: {
    label: 'Lista',
    color: '#4ade80',
    bg: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.4)',
    pct: 90,
    orden: 6,
  },
};

// Categoría → color del badge en la tabla BOM.
export function colorCategoria(cat: string): string {
  const c = (cat || '').toUpperCase();
  if (c.includes('TUBER')) return '#60a5fa';
  if (c.includes('MECAN')) return '#c084fc';
  if (c.includes('MOTOR')) return '#f472b6';
  if (c.includes('CADEN')) return '#fbbf24';
  if (c.includes('PAÑO') || c.includes('PANO')) return '#4ade80';
  if (c.includes('CENEFA')) return '#fb923c';
  if (c.includes('TAPA')) return '#38bdf8';
  if (c.includes('MANILLA')) return '#a3e635';
  if (c.includes('SOPORT')) return '#818cf8';
  return '#9ca3af';
}
