// Sección con los datos capturados por el agente IA (bot de WhatsApp):
// scoring, producto de interés, cantidad ventanas, medidas tomadas,
// instalación, urgencia, motivo de derivación, resumen para vendedor.

import { Bot, Star } from 'lucide-react';
import type { Lead } from '@/modules/leads/types';

interface AgenteDataSectionProps {
  lead: Lead;
}

export default function AgenteDataSection({ lead }: AgenteDataSectionProps) {
  return (
    <section className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-accent">
        <Bot className="h-3 w-3" /> Datos capturados por agente IA
      </div>
      <div className="space-y-1 text-xs">
        {lead.scoring != null && (
          <div className="flex items-center gap-1.5">
            <Star className="h-3 w-3 text-warning" />
            <span className="text-muted-foreground">Scoring:</span>
            <span className="font-bold text-foreground">{lead.scoring}/100</span>
          </div>
        )}
        {lead.producto_interes && (
          <div>
            <span className="text-muted-foreground">Producto: </span>
            <span className="text-foreground">{lead.producto_interes}</span>
          </div>
        )}
        {lead.cantidad_ventanas != null && (
          <div>
            <span className="text-muted-foreground">Cantidad ventanas: </span>
            <span className="text-foreground">{lead.cantidad_ventanas}</span>
          </div>
        )}
        {lead.tiene_medidas != null && (
          <div>
            <span className="text-muted-foreground">Medidas tomadas: </span>
            <span className="text-foreground">{lead.tiene_medidas ? 'Sí' : 'No'}</span>
          </div>
        )}
        {lead.necesita_instalacion != null && (
          <div>
            <span className="text-muted-foreground">Requiere instalación: </span>
            <span className="text-foreground">{lead.necesita_instalacion ? 'Sí' : 'No'}</span>
          </div>
        )}
        {lead.urgencia && (
          <div>
            <span className="text-muted-foreground">Urgencia: </span>
            <span className="text-foreground">{lead.urgencia}</span>
          </div>
        )}
        {lead.motivo_derivacion && (
          <div>
            <span className="text-muted-foreground">Motivo derivación: </span>
            <span className="text-foreground">{lead.motivo_derivacion}</span>
          </div>
        )}
      </div>
      {lead.resumen_para_vendedor && (
        <div className="mt-2 rounded border border-accent/20 bg-card/40 p-2 text-xs italic text-foreground">
          "{lead.resumen_para_vendedor}"
        </div>
      )}
    </section>
  );
}
