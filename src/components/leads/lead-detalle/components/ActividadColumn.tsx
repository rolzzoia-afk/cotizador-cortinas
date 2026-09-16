// Columna derecha del LeadDetalleDialog: comentario nuevo + historial del
// cliente (qué cambió y quién), con filtro por tipo.

import { useState } from 'react';
import { Calendar, History, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { filtrarActividad, type FiltroHistorial } from '@/modules/leads/historial';
import type { Lead, LeadActividad } from '@/modules/leads/types';
import ActividadItem from './ActividadItem';
import { formatFecha } from '../utils/formato';

const FILTROS: { id: FiltroHistorial; texto: string }[] = [
  { id: 'todo', texto: 'Todo' },
  { id: 'cotizacion', texto: 'Cotización' },
  { id: 'seguimientos', texto: 'Seguimientos' },
  { id: 'cambios', texto: 'Cambios' },
];

interface ActividadColumnProps {
  lead: Lead;
  actividad: LeadActividad[];
  nombres: Map<string, string>;
  comentario: string;
  setComentario: (s: string) => void;
  savingComentario: boolean;
  onComentar: () => void;
}

export default function ActividadColumn({
  lead,
  actividad,
  nombres,
  comentario,
  setComentario,
  savingComentario,
  onComentar,
}: ActividadColumnProps) {
  const [filtro, setFiltro] = useState<FiltroHistorial>('todo');
  const visibles = filtrarActividad(actividad, filtro);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          <History className="mr-1 inline h-3 w-3" />
          Historial
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
        <Button onClick={onComentar} disabled={savingComentario || !comentario.trim()} size="sm" className="w-full">
          {savingComentario && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Comentar
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 border-t border-border pt-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[12px] transition-colors',
              filtro === f.id
                ? 'border-accent bg-accent/15 font-semibold text-accent'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {f.texto}
          </button>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        <Calendar className="mr-1 inline h-3 w-3" />
        Creado: {formatFecha(lead.created_at)}
      </div>

      <ul className="space-y-3">
        {visibles.length === 0 && (
          <li className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            {actividad.length === 0 ? 'Sin actividad registrada todavía.' : 'Nada de este tipo.'}
          </li>
        )}
        {visibles.map((a) => (
          <ActividadItem key={a.id} act={a} nombres={nombres} />
        ))}
      </ul>
    </div>
  );
}
