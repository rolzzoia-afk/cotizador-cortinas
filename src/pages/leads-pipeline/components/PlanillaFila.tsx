// Una fila de la Planilla. Las celdas van en el MISMO orden que
// `GRUPOS_PLANILLA` (encabezado). Tocar la fila abre la ficha; el estado de
// la cotización y «+ Seg.» funcionan sin abrirla.

import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCLP } from '@/lib/formatters';
import { EstadoCotizacionMenu } from '@/components/leads/cotizacion/EstadoCotizacionMenu';
import { SeguimientoRapido } from '@/components/leads/seguimientos/SeguimientoRapido';
import { TICKET_LABEL, type CeldaSeguimiento, type FilaPlanilla } from '@/modules/leads/planilla';
import { ESTADOS_TONO, type Lead } from '@/modules/leads/types';
import { TONO_CLS } from '../LeadsPipeline.config';
import { fechaRelativa } from '../utils/fecha-relativa';

/** Encabezado: grupo → columnas. Las celdas de `PlanillaFila` siguen este orden. */
export const GRUPOS_PLANILLA: { titulo: string; columnas: string[] }[] = [
  { titulo: 'Cliente', columnas: ['Nombre'] },
  { titulo: 'Fecha', columnas: ['Fecha', 'Mes · sem.', 'Día'] },
  {
    titulo: 'Contacto',
    columnas: ['Teléfono', 'Instagram', 'Mail', 'Comuna', 'Región', 'Canal', 'Qué anuncio viene', 'Mensaje', 'Información adicional'],
  },
  {
    titulo: 'Cotización',
    columnas: ['Estado cotización', 'N° de cotización', 'Monto cotizado', 'Tipo de cotización', 'Cotización final', 'Cant. de procesos'],
  },
  { titulo: 'Equipo', columnas: ['Llamada', 'Persona que cotiza', 'Salida visita', 'Vendedor'] },
  {
    titulo: 'Seguimiento',
    columnas: ['Estado', 'Potencial', 'Estado del proceso', 'Respuesta del cliente', 'Seguimiento 1', 'Seguimiento 2', 'Seguimiento 3', ''],
  },
  { titulo: 'Historial', columnas: ['Último cambio'] },
];

const TD = 'border-t border-border px-2 py-1.5 align-top text-xs';
const vacio = <span className="text-muted-foreground/60">—</span>;

function Texto({ v, ancho = 'max-w-[180px]' }: { v: string; ancho?: string }) {
  if (!v) return vacio;
  return (
    <span className={cn('block truncate', ancho)} title={v}>
      {v}
    </span>
  );
}

function Seg({ c }: { c: CeldaSeguimiento | null }) {
  if (!c) return vacio;
  return (
    <div className="min-w-[120px] max-w-[170px]" title={`${c.fecha} · ${c.medio} · ${c.respuesta}`}>
      <div className="text-muted-foreground">
        {c.fecha}
        {c.medio && ` · ${c.medio}`}
      </div>
      <div className="truncate text-foreground">{c.respuesta}</div>
    </div>
  );
}

type Props = {
  fila: FilaPlanilla;
  lead: Lead;
  onAbrir: (leadId: string) => void;
  onCambio: () => void | Promise<void>;
};

function PlanillaFilaBase({ fila: f, lead, onAbrir, onCambio }: Props) {
  const parar = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <tr
      onClick={() => onAbrir(f.id)}
      className={cn(
        'group cursor-pointer transition-colors hover:bg-secondary/40',
        f.porActualizar && 'bg-warning/10',
        f.archivado && 'text-muted-foreground',
      )}
    >
      <td
        className={cn(
          TD,
          'sticky left-0 z-10 min-w-[170px] max-w-[220px] border-r font-semibold text-foreground group-hover:bg-secondary',
          f.porActualizar ? 'bg-warning/20' : 'bg-card',
        )}
      >
        <div className="flex items-center gap-1">
          {f.atrasado && (
            <span title={f.avisoAtraso} aria-label={f.avisoAtraso} className="flex-shrink-0 cursor-help">
              <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden />
            </span>
          )}
          <span className="truncate" title={f.nombre}>
            {f.nombre || <span className="italic text-muted-foreground">(sin nombre)</span>}
          </span>
        </div>
      </td>

      <td className={cn(TD, 'whitespace-nowrap')}>{f.fecha}</td>
      <td className={cn(TD, 'whitespace-nowrap')}>
        {f.mes} · S{f.semana}
      </td>
      <td className={cn(TD, 'whitespace-nowrap')}>{f.dia}</td>

      <td className={cn(TD, 'whitespace-nowrap')}>{f.telefono || vacio}</td>
      <td className={TD}>
        <Texto v={f.instagram} ancho="max-w-[130px]" />
      </td>
      <td className={TD}>
        <Texto v={f.mail} />
      </td>
      <td className={TD}>
        <Texto v={f.comuna} ancho="max-w-[120px]" />
      </td>
      <td className={TD}>
        <Texto v={f.region} ancho="max-w-[120px]" />
      </td>
      <td className={TD}>
        <Texto v={f.canal} ancho="max-w-[110px]" />
      </td>
      <td className={TD}>
        <Texto v={f.anuncio} ancho="max-w-[140px]" />
      </td>
      <td className={TD}>
        <Texto v={f.mensaje} ancho="max-w-[220px]" />
      </td>
      <td className={TD}>
        <Texto v={f.infoAdicional} ancho="max-w-[200px]" />
      </td>

      <td className={TD} onClick={parar}>
        <EstadoCotizacionMenu lead={lead} onCambiado={() => onCambio()} />
      </td>
      <td className={TD}>
        {f.numeroCotizacion ? (
          <span className="block max-w-[170px] truncate font-medium" title={f.numeroCotizacionCompleto}>
            {f.numeroCotizacion}
          </span>
        ) : (
          vacio
        )}
      </td>
      <td className={cn(TD, 'whitespace-nowrap text-right tabular-nums')}>{f.monto ? formatCLP(f.monto) : vacio}</td>
      <td className={cn(TD, 'whitespace-nowrap')}>{f.ticket ? TICKET_LABEL[f.ticket] : vacio}</td>
      <td className={cn(TD, 'whitespace-nowrap text-right tabular-nums')}>
        {f.cotizacionFinal ? <span className="font-semibold text-success">{formatCLP(f.cotizacionFinal)}</span> : vacio}
      </td>
      <td className={cn(TD, 'text-center tabular-nums')}>{f.cantProcesos || vacio}</td>

      <td className={TD}>
        <Texto v={f.llamada} ancho="max-w-[110px]" />
      </td>
      <td className={TD}>
        <Texto v={f.cotiza} ancho="max-w-[110px]" />
      </td>
      <td className={TD}>
        <Texto v={f.visita} ancho="max-w-[110px]" />
      </td>
      <td className={TD}>
        <Texto v={f.vendedor} ancho="max-w-[130px]" />
      </td>

      <td className={TD}>
        <span
          className={cn(
            'inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-semibold',
            TONO_CLS[ESTADOS_TONO[f.estado]],
          )}
        >
          {f.estadoTexto}
        </span>
      </td>
      <td className={cn(TD, 'whitespace-nowrap')}>{f.potencial || vacio}</td>
      <td className={cn(TD, f.atrasado && 'font-semibold text-destructive')}>
        <Texto v={f.estadoProceso} ancho="max-w-[190px]" />
      </td>
      <td className={TD}>
        <Texto v={f.respuesta} ancho="max-w-[180px]" />
      </td>
      {f.seguimientos.map((c, i) => (
        <td key={i} className={TD}>
          <Seg c={c} />
        </td>
      ))}
      <td className={cn(TD, 'whitespace-nowrap')} onClick={parar}>
        <div className="flex items-center gap-1">
          <SeguimientoRapido lead={lead} onRegistrado={onCambio} />
          {f.seguimientosExtra > 0 && (
            <span className="text-[11px] text-muted-foreground" title="Seguimientos después del 3.º">
              +{f.seguimientosExtra}
            </span>
          )}
        </div>
      </td>

      <td className={cn(TD, 'whitespace-nowrap')}>
        {f.ultimoCambio ? (
          <div title={new Date(f.ultimoCambioFecha).toLocaleString('es-CL')}>
            <div>{f.ultimoCambio}</div>
            <div className="text-muted-foreground">
              {[f.ultimoCambioQuien, fechaRelativa(f.ultimoCambioFecha)].filter(Boolean).join(' · ')}
            </div>
          </div>
        ) : (
          vacio
        )}
      </td>
    </tr>
  );
}

const PlanillaFila = memo(PlanillaFilaBase);
export default PlanillaFila;
