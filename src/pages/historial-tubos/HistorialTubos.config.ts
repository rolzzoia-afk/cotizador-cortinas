// Configuración visual compartida: íconos, colores y labels de eventos.
// Centraliza la representación gráfica para que las 3 vistas se mantengan
// consistentes entre sí.

import {
  ArrowLeftRight,
  Box,
  History,
  Pencil,
  RotateCw,
  Scissors,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { EvCfg } from './HistorialTubos.types';

export const EV: Record<string, EvCfg> = {
  ingreso: { color: 'text-success', icon: Box, label: 'Ingreso' },
  corte: { color: 'text-accent', icon: Scissors, label: 'Corte' },
  sobrante: { color: 'text-accent', icon: ArrowLeftRight, label: 'Sobrante' },
  merma: { color: 'text-destructive', icon: Trash2, label: 'Merma' },
  error_reemplazo: { color: 'text-warning', icon: RotateCw, label: 'Reemplazo error' },
  sobrante_error: { color: 'text-fuchsia-400', icon: ArrowLeftRight, label: 'Sobrante error' },
  ajuste: { color: 'text-warning', icon: Pencil, label: 'Ajuste admin' },
  eliminado: { color: 'text-muted-foreground', icon: XCircle, label: 'Eliminado' },
  restauracion: {
    color: 'text-pink-400',
    icon: History,
    label: 'Restauración',
    esRestauracion: true,
  },
};

export const FUENTE_CFG: Record<string, { label: string }> = {
  excel: { label: 'Carga Excel' },
  optimizador_nuevo: { label: 'Tubo nuevo (opt.)' },
  retroactivo: { label: 'Registro retroactivo' },
  manual: { label: 'Ingreso manual' },
};

export const PALETA = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e', '#a1a1aa'];
