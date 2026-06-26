// Vista Kanban con drag-and-drop nativo HTML5 entre columnas de estado.
// Cada columna es un LeadEstado; mover un lead llama a onMover.

import { useMemo, useState } from 'react';
import { Bot, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ESTADOS_LABEL,
  ESTADOS_ORDEN,
  ESTADOS_TONO,
  esLeadDeBot,
  type Lead,
  type LeadEstado,
} from '@/modules/leads/types';
import { TONO_CLS } from '../LeadsPipeline.config';
import { fechaRelativa } from '../utils/fecha-relativa';

interface KanbanVistaProps {
  leads: Lead[];
  vendedoras: { id: string; nombre: string }[];
  onAbrir: (l: Lead) => void;
  onMover: (l: Lead, e: LeadEstado) => void;
}

export default function KanbanVista({
  leads,
  vendedoras,
  onAbrir,
  onMover,
}: KanbanVistaProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadEstado | null>(null);

  const porEstado = useMemo(() => {
    const map: Record<LeadEstado, Lead[]> = {} as Record<LeadEstado, Lead[]>;
    for (const e of ESTADOS_ORDEN) map[e] = [];
    for (const l of leads) {
      if (map[l.estado]) map[l.estado].push(l);
    }
    return map;
  }, [leads]);

  const vendedoraNombre = (id: string | null): string => {
    if (!id) return '';
    return vendedoras.find((v) => v.id === id)?.nombre ?? '';
  };

  const handleDrop = (estado: LeadEstado) => {
    if (!dragId) return;
    const lead = leads.find((l) => l.id === dragId);
    if (lead && lead.estado !== estado) {
      onMover(lead, estado);
    }
    setDragId(null);
    setDragOver(null);
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
        {ESTADOS_ORDEN.map((estado) => {
          const items = porEstado[estado] || [];
          const tono = ESTADOS_TONO[estado];
          return (
            <div
              key={estado}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(estado);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(estado)}
              className={cn(
                'flex w-64 flex-shrink-0 flex-col rounded-lg border bg-card/40 transition-colors',
                dragOver === estado ? 'border-accent ring-2 ring-accent/30' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-semibold',
                    TONO_CLS[tono],
                  )}
                >
                  {ESTADOS_LABEL[estado]}
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {items.length === 0 && (
                  <div className="rounded border border-dashed border-border/50 p-3 text-center text-[12px] text-muted-foreground">
                    Vacío
                  </div>
                )}
                {items.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOver(null);
                    }}
                    onClick={() => onAbrir(l)}
                    className={cn(
                      'cursor-pointer rounded-md border border-border bg-card p-2.5 text-xs shadow-sm transition-all hover:border-accent/50 hover:shadow',
                      dragId === l.id && 'opacity-40',
                    )}
                  >
                    <div className="flex items-center gap-1 font-semibold text-foreground">
                      {esLeadDeBot(l) && (
                        <Bot className="h-3 w-3 flex-shrink-0 text-accent" />
                      )}
                      <span className="truncate">
                        {l.nombre || <span className="text-muted-foreground italic">(sin nombre)</span>}
                      </span>
                      {l.scoring != null && (
                        <span
                          className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-1 text-[11px] font-bold text-warning"
                          title="Scoring del bot"
                        >
                          <Star className="h-2 w-2 fill-current" />
                          {l.scoring}
                        </span>
                      )}
                    </div>
                    {l.whatsapp_phone && (
                      <div className="mt-0.5 text-[12px] text-muted-foreground">{l.whatsapp_phone}</div>
                    )}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground">
                        {l.fuente || '—'}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        {fechaRelativa(l.ultima_actividad_at)}
                      </span>
                    </div>
                    {vendedoraNombre(l.asignado_a) && (
                      <div className="mt-1 truncate text-[12px] text-accent">
                        {vendedoraNombre(l.asignado_a)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
