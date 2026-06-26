// Barra de 5 tabs (Tabla / Kanban / Seguimientos / Métricas / Coaching).
// Cada tab cambia la vista activa. Seguimientos muestra un badge rojo
// cuando hay items pendientes.

import {
  BarChart3,
  BookOpen,
  CalendarClock,
  KanbanSquare,
  LayoutList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Vista } from '../LeadsPipeline.types';

interface VistaTabsBarProps {
  vista: Vista;
  onCambio: (v: Vista) => void;
  segPendientes: number;
}

export default function VistaTabsBar({ vista, onCambio, segPendientes }: VistaTabsBarProps) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border">
      <button
        onClick={() => onCambio('tabla')}
        className={cn(
          'inline-flex items-center gap-1 px-3 py-1.5 text-xs transition-colors',
          vista === 'tabla'
            ? 'bg-accent/15 text-accent'
            : 'bg-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutList className="h-3.5 w-3.5" /> Tabla
      </button>
      <button
        onClick={() => onCambio('kanban')}
        className={cn(
          'inline-flex items-center gap-1 border-l border-border px-3 py-1.5 text-xs transition-colors',
          vista === 'kanban'
            ? 'bg-accent/15 text-accent'
            : 'bg-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        <KanbanSquare className="h-3.5 w-3.5" /> Kanban
      </button>
      <button
        onClick={() => onCambio('seguimientos')}
        className={cn(
          'relative inline-flex items-center gap-1 border-l border-border px-3 py-1.5 text-xs transition-colors',
          vista === 'seguimientos'
            ? 'bg-accent/15 text-accent'
            : 'bg-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        <CalendarClock className="h-3.5 w-3.5" /> Seguimientos
        {segPendientes > 0 && (
          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[12px] font-bold text-destructive-foreground">
            {segPendientes}
          </span>
        )}
      </button>
      <button
        onClick={() => onCambio('metricas')}
        className={cn(
          'inline-flex items-center gap-1 border-l border-border px-3 py-1.5 text-xs transition-colors',
          vista === 'metricas'
            ? 'bg-accent/15 text-accent'
            : 'bg-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        <BarChart3 className="h-3.5 w-3.5" /> Métricas
      </button>
      <button
        onClick={() => onCambio('coaching')}
        className={cn(
          'inline-flex items-center gap-1 border-l border-border px-3 py-1.5 text-xs transition-colors',
          vista === 'coaching'
            ? 'bg-accent/15 text-accent'
            : 'bg-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        <BookOpen className="h-3.5 w-3.5" /> Coaching
      </button>
    </div>
  );
}
