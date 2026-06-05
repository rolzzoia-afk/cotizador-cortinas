// Card colapsable de un plan. Cabecera con fecha, badges (actual / versión
// anterior / corregido), cantidad de cortes, errores y OTs. Click expande
// para mostrar la tabla detallada.

import { ChevronDown, FileSpreadsheet, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import PlanTabla from './PlanTabla';
import { extraerOTs } from '../utils/parsers';
import { fmtFechaHora } from '../utils/formato';
import type { Plan } from '../HistorialCorte.types';

interface PlanCardProps {
  plan: Plan;
  errores: { linea_idx: number; motivo: string }[];
  esActual: boolean;
  esVersionAnterior: boolean;
  expandido: boolean;
  /** Número correlativo de prioridad (1 = más urgente). null = sin asignar */
  correlativo?: number | null;
  onToggle: () => void;
  onRegistrarError: (idx: number) => void;
  onMarcarSobranteInexistente: (idx: number, descripcion: string) => void;
  onDescargarExcel: () => void;
}

export default function PlanCard({
  plan,
  errores,
  esActual,
  esVersionAnterior,
  expandido,
  correlativo,
  onToggle,
  onRegistrarError,
  onMarcarSobranteInexistente,
  onDescargarExcel,
}: PlanCardProps) {
  const fechaStr = fmtFechaHora(plan.fecha);
  const nCortes = plan.resultados.length;
  const hasErrors = errores.length > 0;
  const ots = extraerOTs(plan);
  const esCorregido = !!plan.fecha_correccion;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border transition-colors',
        esVersionAnterior
          ? 'ml-4 border-dashed border-border bg-card/50 opacity-80'
          : hasErrors
            ? 'border-destructive/30 bg-card'
            : esActual
              ? 'border-success/40 bg-card'
              : 'border-border bg-card',
      )}
    >
      <div className="flex w-full items-stretch">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/40"
        >
          {correlativo != null && (
            <span
              className="flex h-12 min-w-12 flex-shrink-0 flex-col items-center justify-center rounded-md border border-accent/40 bg-accent/10 px-2 font-mono tabular-nums leading-none"
              title="Correlativo: orden de prioridad por fecha de entrega más próxima"
            >
              <span className="text-[8.5px] font-semibold uppercase tracking-wider text-accent/80">
                Corr
              </span>
              <span className="mt-0.5 text-[18px] font-bold text-accent">{correlativo}</span>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
              <Scissors className="h-4 w-4 flex-shrink-0 text-accent" />
              {fechaStr}
              {esActual && (
                <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                  Actual
                </span>
              )}
              {esVersionAnterior && (
                <span className="rounded-full border border-muted-foreground/30 bg-muted/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Versión anterior
                </span>
              )}
              {esCorregido && (
                <span
                  className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning"
                  title="Plan generado al aplicar correcciones sobre una versión anterior"
                >
                  Corregido
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground">
              <span>
                {nCortes} corte{nCortes !== 1 ? 's' : ''}
              </span>
              {hasErrors && (
                <span className="text-destructive">
                  · ⚠ {errores.length} error{errores.length > 1 ? 'es' : ''}
                </span>
              )}
              {ots.map((ot) => (
                <span
                  key={ot}
                  className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-accent"
                >
                  OT {ot}
                </span>
              ))}
            </div>
          </div>
          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground transition-transform', expandido && 'rotate-180')}
          />
        </button>
        <button
          onClick={onDescargarExcel}
          title="Descargar Excel"
          aria-label="Descargar Excel"
          className="flex shrink-0 items-center justify-center border-l border-border px-3 text-success transition-colors hover:bg-success/10"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </button>
      </div>
      {expandido && (
        <div className="border-t border-border">
          <PlanTabla
            plan={plan}
            errores={errores}
            onRegistrarError={onRegistrarError}
            onMarcarSobranteInexistente={onMarcarSobranteInexistente}
            readonly={esVersionAnterior}
          />
        </div>
      )}
    </div>
  );
}
