// Columna derecha del LeadDetalleDialog: textarea para agregar comentario
// + timeline completa de actividad del lead.

import { Calendar, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Lead, LeadActividad } from '@/modules/leads/types';
import ActividadItem from './ActividadItem';
import { formatFecha } from '../utils/formato';

interface ActividadColumnProps {
  lead: Lead;
  actividad: LeadActividad[];
  comentario: string;
  setComentario: (s: string) => void;
  savingComentario: boolean;
  onComentar: () => void;
}

export default function ActividadColumn({
  lead,
  actividad,
  comentario,
  setComentario,
  savingComentario,
  onComentar,
}: ActividadColumnProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="mr-1 inline h-3 w-3" />
          Actividad
        </div>
        <span className="text-[12px] text-muted-foreground">{actividad.length} entradas</span>
      </div>

      <div className="space-y-2">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Agregar comentario…"
          rows={2}
          className="w-full rounded-md border border-border bg-card px-2 py-2 text-xs focus:border-accent focus:outline-none"
        />
        <Button
          onClick={onComentar}
          disabled={savingComentario || !comentario.trim()}
          size="sm"
          className="w-full"
        >
          {savingComentario && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Comentar
        </Button>
      </div>

      <div className="border-t border-border pt-2 text-xs text-muted-foreground">
        <Calendar className="mr-1 inline h-3 w-3" />
        Creado: {formatFecha(lead.created_at)}
      </div>

      <ul className="space-y-3">
        {actividad.length === 0 && (
          <li
            className={cn(
              'rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground',
            )}
          >
            Sin actividad registrada todavía.
          </li>
        )}
        {actividad.map((a) => (
          <ActividadItem key={a.id} act={a} />
        ))}
      </ul>
    </div>
  );
}
