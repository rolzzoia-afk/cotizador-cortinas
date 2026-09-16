// Los seguimientos del cliente: cada uno con su número, por dónde se hizo y
// qué respondió, y quién lo registró. Arriba, la cadencia 1-2-3 pendiente.

import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEG_RESULTADO_LABEL, type Lead, type LeadSeguimiento } from '@/modules/leads/types';
import { fechaProximoSeguimiento, MEDIO_LABEL } from '@/modules/leads/seguimientos';
import { formatFecha } from '../utils/formato';

interface SeguimientosTimelineProps {
  lead: Lead;
  seguimientos: LeadSeguimiento[];
  nombres: Map<string, string>;
}

export default function SeguimientosTimeline({ lead, seguimientos, nombres }: SeguimientosTimelineProps) {
  const proxima = fechaProximoSeguimiento(lead);
  const activo = lead.estado === 'cotizado' && !lead.archivado;
  const pendiente = activo && lead.etapa_seguimiento >= 1 && lead.etapa_seguimiento <= 3;

  return (
    <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <CalendarClock className="h-3 w-3" /> Seguimientos
      </div>

      {lead.fecha_cotizacion && (
        <div className="text-xs text-muted-foreground">
          Cotización enviada: <span className="text-foreground">{formatFecha(lead.fecha_cotizacion)}</span>
        </div>
      )}

      {seguimientos.length === 0 && !pendiente && (
        <p className="text-xs text-muted-foreground">
          {lead.fecha_cotizacion
            ? 'Sin seguimientos registrados.'
            : 'El ciclo de 3 seguimientos arranca cuando la cotización se marca Enviada.'}
        </p>
      )}

      <ol className="space-y-1.5 text-xs">
        {seguimientos.map((s) => (
          <li key={s.id} className="flex items-start gap-2">
            <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-success/40 bg-success/15 text-[12px] font-bold text-success">
              {s.n}
            </span>
            <div className="flex-1">
              <div className="text-foreground">
                {s.medio && <strong>{MEDIO_LABEL[s.medio]}: </strong>}
                {s.nota || SEG_RESULTADO_LABEL[s.resultado]}
              </div>
              <div className="text-muted-foreground">
                {formatFecha(s.fecha)}
                {s.nota && ` · ${SEG_RESULTADO_LABEL[s.resultado]}`}
                {s.registrado_por && ` · por ${nombres.get(s.registrado_por) ?? 'alguien del equipo'}`}
                {!s.etapa && ' · extra'}
              </div>
            </div>
          </li>
        ))}
        {pendiente && (
          <li className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[12px] font-bold',
                'border-warning/40 bg-warning/15 text-warning',
              )}
            >
              {seguimientos.length + 1}
            </span>
            <span className="text-warning">
              Seguimiento {lead.etapa_seguimiento} de 3 pendiente
              {proxima ? ` · ${formatFecha(proxima.toISOString())}` : ''}
            </span>
          </li>
        )}
      </ol>

      {lead.archivado && (
        <div className="mt-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          Archivado por falta de respuesta
          {lead.fecha_archivado ? ` · ${formatFecha(lead.fecha_archivado)}` : ''}
        </div>
      )}
      {lead.etapa_seguimiento === 4 && !lead.archivado && (
        <div className="mt-1 text-xs text-success">Ciclo cerrado — el cliente respondió.</div>
      )}
    </section>
  );
}
