// Defaults y paleta del Panel KPI Ventas.

import type { KpiConfig } from './Ventas.types';

export const DEFAULT_CONFIG: KpiConfig = {
  meta_visitas: 3,
  meta_cierre_pct: 50,
  canales: ['Instagram', 'WhatsApp 1', 'WhatsApp 2', 'WhatsApp 3', 'Shopify'],
  vendedoras: ['Génesis', 'María C.', 'Luisanna', 'Adriana', 'Analí'],
  terreno: ['Alan', 'Antonio', 'Lourdes'],
};

export const CANAL_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#22c55e',
  '#ef4444',
  '#38bdf8',
  '#a855f7',
  '#f97316',
  '#ec4899',
];
