// Una tarjeta de la bandeja «Seguimientos de hoy»: el cliente, en qué etapa
// va, cuánto atraso lleva, el conector y el formulario para registrar el
// resultado con su medio.

import { AlertTriangle, CalendarClock, ChevronDown, Clock, Flame, Phone, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PRIORIDAD_LABEL, type Prioridad } from '@/modules/leads/types';
import type { SeguimientoInfo, Urgencia } from '@/modules/leads/seguimientos';
import { EstadoCotizacionMenu } from '../cotizacion/EstadoCotizacionMenu';
import { RegistrarSeguimientoForm } from './RegistrarSeguimientoForm';

export const URGENCIA_CARD: Record<Urgencia, string> = {
  atrasado: 'border-destructive/40 bg-destructive/5',
  hoy: 'border-warning/40 bg-warning/5',
  proximo: 'border-border bg-card/40',
};
const URGENCIA_CHIP: Record<Urgencia, string> = {
  atrasado: 'border-destructive/40 bg-destructive/15 text-destructive',
  hoy: 'border-warning/40 bg-warning/15 text-warning',
  proximo: 'border-success/30 bg-success/15 text-success',
};
export const URGENCIA_ICON: Record<Urgencia, typeof Clock> = {
  atrasado: AlertTriangle,
  hoy: Clock,
  proximo: CalendarClock,
};
const PRIORIDAD_CHIP: Record<Prioridad, string> = {
  alta: 'border-destructive/40 bg-destructive/15 text-destructive',
  media: 'border-warning/40 bg-warning/15 text-warning',
  baja: 'border-border bg-secondary text-muted-foreground',
};

function textoDias(diasDiff: number): string {
  if (diasDiff === 0) return 'Para hoy';
  if (diasDiff < 0) {
    const n = Math.abs(diasDiff);
    return `Atrasado ${n} día${n === 1 ? '' : 's'}`;
  }
  return `En ${diasDiff} día${diasDiff === 1 ? '' : 's'}`;
}

type Props = {
  info: SeguimientoInfo;
  vendedoraNombre: string | null;
  abierto: boolean;
  onToggle: () => void;
  onAbrir?: (leadId: string) => void;
  onRegistrado: () => void | Promise<void>;
};

export function TarjetaSeguimiento({ info, vendedoraNombre, abierto, onToggle, onAbrir, onRegistrado }: Props) {
  const { lead, etapa, urgencia, diasDiff } = info;

  return (
    <div className={cn('rounded-lg border p-3', URGENCIA_CARD[urgencia])}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onAbrir?.(lead.id)}
          className="font-semibold text-foreground hover:text-accent"
          title="Abrir ficha del cliente"
        >
          {lead.nombre || '(sin nombre)'}
        </button>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold',
            PRIORIDAD_CHIP[lead.prioridad],
          )}
        >
          {lead.prioridad === 'alta' && <Flame className="h-2.5 w-2.5" />}
          Prioridad {PRIORIDAD_LABEL[lead.prioridad]}
        </span>
        <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[12px] font-semibold text-accent">
          Seguimiento {etapa} de 3
        </span>
        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-semibold', URGENCIA_CHIP[urgencia])}>
          {textoDias(diasDiff)}
        </span>
        <EstadoCotizacionMenu lead={lead} onCambiado={() => onRegistrado()} />
        {lead.scoring != null && (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-warning/30 bg-warning/15 px-1.5 py-0 text-[12px] font-bold text-warning">
            <Star className="h-2.5 w-2.5 fill-current" />
            {lead.scoring}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {lead.whatsapp_phone && (
          <a
            href={`https://wa.me/${lead.whatsapp_phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-foreground hover:text-accent"
          >
            <Phone className="h-3 w-3" /> {lead.whatsapp_phone}
          </a>
        )}
        {lead.numero_cotizacion && <span title={lead.numero_cotizacion}>{lead.numero_cotizacion}</span>}
        {vendedoraNombre && <span>Vendedora: {vendedoraNombre}</span>}
        {lead.comuna && <span>{lead.comuna}</span>}
      </div>

      {/* CONECTOR / detalle personal — clave en el Seguimiento 2 */}
      {(lead.detalle_personal || etapa === 2) && (
        <div
          className={cn(
            'mt-2 rounded border px-2 py-1.5 text-xs',
            etapa === 2 ? 'border-accent/40 bg-accent/10 text-foreground' : 'border-border bg-background/40 text-muted-foreground',
          )}
        >
          <span className="font-semibold text-accent">Conector: </span>
          {lead.detalle_personal || (
            <span className="italic text-muted-foreground">
              Sin detalle personal cargado — agrégalo en la ficha del cliente para personalizar este seguimiento.
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant={abierto ? 'secondary' : 'default'} onClick={onToggle} className="gap-1">
          {abierto ? 'Cerrar' : 'Registrar resultado'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', abierto && 'rotate-180')} />
        </Button>
      </div>

      {abierto && (
        <div className="mt-2">
          <RegistrarSeguimientoForm leadId={lead.id} etapa={etapa} onRegistrado={onRegistrado} />
        </div>
      )}
    </div>
  );
}
