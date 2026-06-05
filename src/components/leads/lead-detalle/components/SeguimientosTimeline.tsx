// Línea de tiempo de los 3 seguimientos del ciclo post-cotización.
// Muestra cuál se hizo, cuál está pendiente, y si el lead fue archivado
// automáticamente por falta de respuesta.

import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEG_RESULTADO_LABEL, type Lead } from '@/modules/leads/types';
import { fechaProximoSeguimiento } from '@/modules/leads/seguimientos';
import { formatFecha } from '../utils/formato';

interface SeguimientosTimelineProps {
  lead: Lead;
}

export default function SeguimientosTimeline({ lead }: SeguimientosTimelineProps) {
  const proxima = fechaProximoSeguimiento(lead);
  const activo = lead.estado === 'cotizado' && !lead.archivado;
  const etapas = [
    { n: 1, fecha: lead.seg1_fecha, resultado: lead.seg1_resultado },
    { n: 2, fecha: lead.seg2_fecha, resultado: lead.seg2_resultado },
    { n: 3, fecha: lead.seg3_fecha, resultado: lead.seg3_resultado },
  ];

  return (
    <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <CalendarClock className="h-3 w-3" /> Seguimientos
      </div>
      {!lead.fecha_cotizacion ? (
        <p className="text-xs text-muted-foreground">
          El ciclo de 3 seguimientos arranca cuando el lead pasa a estado{' '}
          <strong className="text-foreground">Cotizado</strong> (cotización enviada).
        </p>
      ) : (
        <div className="space-y-1.5 text-xs">
          <div className="text-muted-foreground">
            Cotización enviada:{' '}
            <span className="text-foreground">{formatFecha(lead.fecha_cotizacion)}</span>
          </div>
          {etapas.map((e) => {
            const hecho = !!e.fecha;
            const pendiente = activo && lead.etapa_seguimiento === e.n;
            return (
              <div key={e.n} className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                    hecho
                      ? 'border-success/40 bg-success/15 text-success'
                      : pendiente
                        ? 'border-warning/40 bg-warning/15 text-warning'
                        : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {e.n}
                </span>
                <div className="flex-1">
                  {hecho ? (
                    <span className="text-foreground">
                      {SEG_RESULTADO_LABEL[e.resultado as keyof typeof SEG_RESULTADO_LABEL] ||
                        e.resultado}{' '}
                      · <span className="text-muted-foreground">{formatFecha(e.fecha!)}</span>
                    </span>
                  ) : pendiente ? (
                    <span className="text-warning">
                      Pendiente{proxima ? ` · ${formatFecha(proxima.toISOString())}` : ''}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })}
          {lead.archivado && (
            <div className="mt-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">
              Archivado por falta de respuesta
              {lead.fecha_archivado ? ` · ${formatFecha(lead.fecha_archivado)}` : ''}
            </div>
          )}
          {lead.etapa_seguimiento === 4 && !lead.archivado && (
            <div className="mt-1 text-success">Ciclo cerrado — el cliente respondió.</div>
          )}
        </div>
      )}
    </section>
  );
}
