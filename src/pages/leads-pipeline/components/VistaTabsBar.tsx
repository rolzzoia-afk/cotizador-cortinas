// Barra de pestañas de Clientes (Planilla / Tabla / Kanban / Seguimientos /
// Métricas / Coaching). Seguimientos muestra un globo rojo con los pendientes
// de hoy; Planilla, uno ámbar con las cotizaciones por actualizar.

import {
  BarChart3,
  BookOpen,
  CalendarClock,
  KanbanSquare,
  LayoutList,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Vista } from '../LeadsPipeline.types';

interface VistaTabsBarProps {
  vista: Vista;
  onCambio: (v: Vista) => void;
  segPendientes: number;
  porActualizar: number;
}

const TABS: { id: Vista; texto: string; icono: LucideIcon }[] = [
  { id: 'planilla', texto: 'Planilla', icono: Table2 },
  { id: 'tabla', texto: 'Tabla', icono: LayoutList },
  { id: 'kanban', texto: 'Kanban', icono: KanbanSquare },
  { id: 'seguimientos', texto: 'Seguimientos', icono: CalendarClock },
  { id: 'metricas', texto: 'Métricas', icono: BarChart3 },
  { id: 'coaching', texto: 'Coaching', icono: BookOpen },
];

export default function VistaTabsBar({ vista, onCambio, segPendientes, porActualizar }: VistaTabsBarProps) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border">
      {TABS.map(({ id, texto, icono: Icono }, i) => {
        const globo =
          id === 'seguimientos' && segPendientes > 0
            ? { n: segPendientes, cls: 'bg-destructive text-destructive-foreground', titulo: 'Seguimientos atrasados o para hoy' }
            : id === 'planilla' && porActualizar > 0
              ? { n: porActualizar, cls: 'bg-warning text-background', titulo: 'Cotizaciones por actualizar' }
              : null;
        return (
          <button
            key={id}
            onClick={() => onCambio(id)}
            className={cn(
              'relative inline-flex items-center gap-1 px-3 py-1.5 text-xs transition-colors',
              i > 0 && 'border-l border-border',
              vista === id ? 'bg-accent/15 text-accent' : 'bg-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icono className="h-3.5 w-3.5" /> {texto}
            {globo && (
              <span
                title={globo.titulo}
                className={cn('ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[12px] font-bold', globo.cls)}
              >
                {globo.n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
