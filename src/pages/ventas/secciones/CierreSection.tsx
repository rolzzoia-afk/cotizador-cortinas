// Sección "Cierre de ventas": inputs de cotizaciones enviadas/cerradas +
// gauge del % de cierre + KPI numérico de pendientes.

import { CircleAlert, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import SectionHeader from '../components/SectionHeader';
import NumInput from '../components/NumInput';
import Gauge from '../components/Gauge';

interface CierreSectionProps {
  envVal: number;
  cerVal: number;
  errorCierre: boolean;
  pctCierre: number;
  pendientes: number;
  setVal: (clave: string, valor: number) => void;
}

export default function CierreSection({
  envVal,
  cerVal,
  errorCierre,
  pctCierre,
  pendientes,
  setVal,
}: CierreSectionProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionHeader
        icon={<ClipboardCheck className="h-4 w-4" />}
        iconBg="rgba(239,68,68,0.15)"
        iconColor="#ef4444"
        title="Cierre de ventas"
        sub="Cotizaciones enviadas vs cerradas definitivamente"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-secondary p-4 text-center">
          <div className="text-xs text-muted-foreground">Cotizaciones enviadas</div>
          <NumInput
            value={envVal}
            onChange={(v) => setVal('cierre_enviadas', v)}
            className="w-full border-0 border-b-2 border-border bg-transparent text-center text-5xl font-extrabold leading-none text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <div className="rounded-xl border border-border bg-secondary p-4 text-center">
          <div className="text-xs text-muted-foreground">Cotizaciones cerradas</div>
          <NumInput
            value={cerVal}
            onChange={(v) => setVal('cierre_cerradas', v)}
            className={cn(
              'w-full border-0 border-b-2 bg-transparent text-center text-5xl font-extrabold leading-none text-foreground focus:outline-none',
              errorCierre
                ? 'border-red-500 focus:border-red-500'
                : 'border-border focus:border-accent',
            )}
          />
          {errorCierre && (
            <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-destructive">
              <CircleAlert className="h-3 w-3" /> No puede superar las enviadas
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-around gap-5 rounded-xl border border-border bg-secondary p-4 md:col-span-2">
          <div className="text-center">
            <Gauge pct={pctCierre} hasData={envVal > 0} />
            <div className="mt-1.5 text-[11px] text-muted-foreground">% de cierre real</div>
          </div>
          <div className="p-3 text-center">
            <div className="mb-1.5 text-[13px] text-muted-foreground">Tasa de cierre</div>
            <div className="text-3xl font-extrabold text-foreground">
              {envVal > 0 ? `${pctCierre}%` : '—'}
            </div>
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              de las cotizaciones se cerraron
            </div>
          </div>
          <div className="p-3 text-center">
            <div className="mb-1 text-[13px] text-muted-foreground">Cotizaciones pendientes</div>
            <div className="text-4xl font-extrabold text-accent">
              {envVal > 0 ? pendientes : '—'}
            </div>
            <div className="text-[11px] text-muted-foreground">sin cerrar aún</div>
          </div>
        </div>
      </div>
    </div>
  );
}
