// Una entrada del historial: qué cambió, el detalle (campos «de → a», nota,
// motivo) y quién lo hizo, con la fecha.

import { Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import { textoActividad } from '@/modules/leads/historial';
import type { LeadActividad } from '@/modules/leads/types';
import { formatFecha } from '../utils/formato';

interface ActividadItemProps {
  act: LeadActividad;
  nombres: Map<string, string>;
}

export default function ActividadItem({ act, nombres }: ActividadItemProps) {
  const linea = textoActividad(act, nombres);
  return (
    <li
      className={cn(
        'flex gap-3 border-l-2 pl-3 text-xs',
        act.tipo === 'cotizacion' ? 'border-warning/60' : act.tipo === 'seguimiento' ? 'border-accent/50' : 'border-border',
      )}
    >
      <div className="flex-1">
        <div className="text-foreground">{linea.titulo}</div>
        {linea.detalle.map((d, i) => (
          <div key={i} className="mt-0.5 text-muted-foreground">
            {d}
          </div>
        ))}
        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
          {linea.desdeOt && <Factory className="h-3 w-3" aria-label="Desde la OT" />}
          <span className="font-medium text-foreground/80">{linea.quien}</span>
          <span>· {formatFecha(act.created_at)}</span>
        </div>
      </div>
    </li>
  );
}
