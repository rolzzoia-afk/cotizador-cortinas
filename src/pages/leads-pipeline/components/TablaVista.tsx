// Vista tabla de leads — filas clickeables, dropdown de cambio rápido de
// estado por fila, marcas visuales para leads del bot y scoring.

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

interface TablaVistaProps {
  leads: Lead[];
  vendedoras: { id: string; nombre: string }[];
  onAbrir: (l: Lead) => void;
  onCambioRapido: (l: Lead, e: LeadEstado) => void;
}

export default function TablaVista({
  leads,
  vendedoras,
  onAbrir,
  onCambioRapido,
}: TablaVistaProps) {
  const vendedoraNombre = (id: string | null): string => {
    if (!id) return '—';
    return vendedoras.find((v) => v.id === id)?.nombre ?? '—';
  };

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
        Sin leads que mostrar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card/40">
      <table className="w-full text-sm">
        <thead className="bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Nombre</th>
            <th className="px-3 py-2 text-left">Contacto</th>
            <th className="px-3 py-2 text-left">Canal</th>
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2 text-left">Vendedora</th>
            <th className="px-3 py-2 text-left">Última act.</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr
              key={l.id}
              onClick={() => onAbrir(l)}
              className="cursor-pointer border-t border-border transition-colors hover:bg-secondary/30"
            >
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  {esLeadDeBot(l) && (
                    <Bot
                      className="h-3.5 w-3.5 flex-shrink-0 text-accent"
                      aria-label="Lead derivado por el bot de WhatsApp"
                    />
                  )}
                  <span>
                    {l.nombre || <span className="text-muted-foreground italic">(sin nombre)</span>}
                  </span>
                  {l.scoring != null && (
                    <span
                      className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-warning/30 bg-warning/15 px-1.5 py-0 text-[10px] font-bold text-warning"
                      title="Scoring del bot (0-100)"
                    >
                      <Star className="h-2.5 w-2.5 fill-current" />
                      {l.scoring}
                    </span>
                  )}
                </div>
                {l.comuna && (
                  <div className="text-[11px] text-muted-foreground">{l.comuna}</div>
                )}
              </td>
              <td className="px-3 py-2.5 text-xs">
                {l.whatsapp_phone && <div>{l.whatsapp_phone}</div>}
                {l.email && <div className="text-muted-foreground">{l.email}</div>}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.fuente || '—'}</td>
              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                <select
                  value={l.estado}
                  onChange={(e) => onCambioRapido(l, e.target.value as LeadEstado)}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold focus:outline-none',
                    TONO_CLS[ESTADOS_TONO[l.estado]],
                  )}
                >
                  {ESTADOS_ORDEN.map((s) => (
                    <option key={s} value={s} className="bg-card text-foreground">
                      {ESTADOS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2.5 text-xs text-foreground">
                {vendedoraNombre(l.asignado_a)}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {fechaRelativa(l.ultima_actividad_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
