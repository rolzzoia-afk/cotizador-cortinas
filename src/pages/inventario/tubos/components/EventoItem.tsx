// Fila de un evento en la lista del historial técnico.
// Renderiza el ícono + label del tipo de evento, la medida, OT, colmena,
// notas y la fecha. Las restauraciones (esRestauracion=true) van resaltadas
// con un divisor rosa y un fondo distinto.

import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { EV, FUENTE_CFG } from '../HistorialTubos.config';
import { formatFechaHora } from '../utils/formato-fechas';
import type { Evento } from '../HistorialTubos.types';

interface EventoItemProps {
  e: Evento;
}

export default function EventoItem({ e }: EventoItemProps) {
  const cfg = EV[e.evento] ?? { color: 'text-muted-foreground', icon: Box, label: e.evento };
  const Icon = cfg.icon;
  const medida = e.medida_cm != null ? `${Number(e.medida_cm).toFixed(1)} cm` : '—';
  const resultado =
    e.medida_resultado_cm != null ? `→ ${Number(e.medida_resultado_cm).toFixed(1)} cm` : '';
  const esRest = cfg.esRestauracion === true;
  const fuenteLabel =
    e.evento === 'ingreso'
      ? e.fuente
        ? FUENTE_CFG[e.fuente]?.label ?? e.fuente
        : 'Origen desconocido'
      : null;

  return (
    <>
      {esRest && (
        <li className="relative mx-4 my-1 border-t border-dashed border-pink-400/35 text-center">
          <span className="bg-background px-2 text-[12px] text-pink-400">
            — PUNTO DE RESTAURACIÓN —
          </span>
        </li>
      )}
      <li
        className={cn(
          'relative flex gap-3 px-4 py-2.5',
          esRest && 'mx-2 my-1 rounded-lg border border-pink-400/25 bg-pink-500/5',
        )}
      >
        <div
          className={cn(
            'mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted',
            cfg.color,
          )}
        >
          <Icon className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
            <Badge variant="secondary" className={cn('uppercase tracking-wide', cfg.color)}>
              {cfg.label}
            </Badge>
            {!esRest && (
              <span className="font-normal text-muted-foreground">
                {medida} {resultado}
              </span>
            )}
            {fuenteLabel && (
              <Badge variant="outline" className="text-[12px]">
                {fuenteLabel}
              </Badge>
            )}
          </div>
          {e.ot && (
            <div className="text-xs text-muted-foreground">
              OT: <strong>{e.ot}</strong> · Colmena: {e.n_colmena ?? '—'}
            </div>
          )}
          {!e.ot && e.n_colmena && (
            <div className="text-xs text-muted-foreground">Colmena: {e.n_colmena}</div>
          )}
          {e.notas && (
            <div
              className={cn(
                'mt-1 text-xs italic text-muted-foreground',
                esRest && 'not-italic text-pink-400',
              )}
            >
              {e.notas}
            </div>
          )}
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {formatFechaHora(e.created_at)}
            {e.registrado_por ? ` · ${e.registrado_por}` : ''}
          </div>
        </div>
      </li>
    </>
  );
}
