// Sección "Cotización" de la ficha: N°, monto, ticket, el botón de estado de
// la cotización (Enviada · Por actualizar · Actualizada), abrir o crear la OT
// y registrar un seguimiento.

import { useState } from 'react';
import { ChevronDown, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatCLP } from '@/lib/formatters';
import { numeroCotizacionCorto, TICKET_LABEL, ticketDeMonto } from '@/modules/leads/planilla';
import type { Lead } from '@/modules/leads/types';
import { EstadoCotizacionMenu } from '../../cotizacion/EstadoCotizacionMenu';
import { RegistrarSeguimientoForm } from '../../seguimientos/RegistrarSeguimientoForm';

interface CotizacionSectionProps {
  lead: Lead;
  creandoOT: boolean;
  onCrearOT: () => void;
  onAbrirOT: () => void;
  onCambio: () => void | Promise<void>;
}

export default function CotizacionSection({ lead, creandoOT, onCrearOT, onAbrirOT, onCambio }: CotizacionSectionProps) {
  const [registrando, setRegistrando] = useState(false);
  const monto = lead.monto === null ? null : Number(lead.monto);
  const ticket = ticketDeMonto(monto);
  const etapaPendiente =
    lead.estado === 'cotizado' && !lead.archivado && lead.etapa_seguimiento >= 1 && lead.etapa_seguimiento <= 3
      ? lead.etapa_seguimiento
      : null;

  return (
    <section
      className={cn(
        'space-y-2 rounded-lg border p-3',
        lead.estado_cotizacion === 'por_actualizar' ? 'border-warning/50 bg-warning/5' : 'border-border bg-secondary/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cotización</div>
        <EstadoCotizacionMenu lead={lead} onCambiado={() => onCambio()} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[11px] text-muted-foreground">N° de cotización</div>
          <div className="truncate font-semibold text-foreground" title={lead.numero_cotizacion ?? ''}>
            {numeroCotizacionCorto(lead.numero_cotizacion) || '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Monto cotizado</div>
          <div className="font-semibold text-foreground">
            {monto ? formatCLP(monto) : '—'}
            {ticket && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{TICKET_LABEL[ticket]}</span>}
          </div>
        </div>
      </div>

      {lead.estado_cotizacion === 'por_actualizar' && (
        <p className="text-xs text-warning">
          Hay que actualizarla y volver a mandarla. Cuando esté, márcala «Actualizada».
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!lead.ot_id ? (
          <Button onClick={onCrearOT} disabled={creandoOT} size="sm" className="flex-1 gap-1.5">
            {creandoOT && <Loader2 className="h-4 w-4 animate-spin" />}
            <FileText className="h-4 w-4" />
            Crear cotización (OT)
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onAbrirOT} className="flex-1 gap-1.5">
            <ExternalLink className="h-4 w-4" />
            Abrir OT
          </Button>
        )}
        <Button
          size="sm"
          variant={registrando ? 'secondary' : 'outline'}
          onClick={() => setRegistrando((v) => !v)}
          className="flex-1 gap-1"
        >
          Registrar seguimiento
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', registrando && 'rotate-180')} />
        </Button>
      </div>

      {registrando && (
        <RegistrarSeguimientoForm
          leadId={lead.id}
          etapa={etapaPendiente}
          onRegistrado={async () => {
            setRegistrando(false);
            await onCambio();
          }}
        />
      )}
    </section>
  );
}
