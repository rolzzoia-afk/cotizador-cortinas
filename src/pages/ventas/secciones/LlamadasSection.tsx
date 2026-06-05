// Sección "Llamadas diarias": grid con una tarjeta por vendedora con
// (llamadas, cotizaciones atendidas) y un badge que indica % de
// cotizaciones del día atendidas por esa vendedora.

import {
  ChevronUp,
  CircleAlert,
  CircleCheckBig,
  CircleDot,
  Hourglass,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import SectionHeader from '../components/SectionHeader';
import NumInput from '../components/NumInput';
import { iniciales, slugify } from '../utils/helpers';

interface LlamadasSectionProps {
  vendedoras: string[];
  totalCanales: number;
  totalLlamadas: number;
  getVal: (clave: string) => number;
  setVal: (clave: string, valor: number) => void;
}

export default function LlamadasSection({
  vendedoras,
  totalCanales,
  totalLlamadas,
  getVal,
  setVal,
}: LlamadasSectionProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionHeader
        icon={<Phone className="h-4 w-4" />}
        iconBg="rgba(245,158,11,0.15)"
        iconColor="#f59e0b"
        title="Llamadas diarias"
        sub="Cotizaciones atendidas por vendedora"
        right={
          <div className="text-right text-[22px] font-extrabold text-foreground">
            {totalLlamadas}
            <span className="block text-[11px] font-normal text-muted-foreground">llamadas</span>
          </div>
        }
      />
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))' }}
      >
        {vendedoras.map((v) => {
          const ll = getVal('ll_llamadas_' + slugify(v));
          const cot = getVal('ll_cotz_' + slugify(v));
          const pctCot =
            totalCanales > 0
              ? Math.round((cot / totalCanales) * 100)
              : cot > 0
                ? 100
                : 0;
          const badge =
            cot > 0
              ? pctCot >= 70
                ? {
                    cls: 'border-success/30 bg-success/15 text-success',
                    icon: <CircleCheckBig className="h-3 w-3" />,
                    text: `${pctCot}% de cotizaciones (${cot}/${totalCanales || cot})`,
                  }
                : pctCot >= 40
                  ? {
                      cls: 'border-warning/30 bg-warning/15 text-warning',
                      icon: <ChevronUp className="h-3 w-3" />,
                      text: `${pctCot}% de cotizaciones (${cot}/${totalCanales || cot})`,
                    }
                  : {
                      cls: 'border-destructive/30 bg-destructive/15 text-destructive',
                      icon: <CircleAlert className="h-3 w-3" />,
                      text: `${pctCot}% de cotizaciones (${cot}/${totalCanales || cot})`,
                    }
              : ll > 0
                ? {
                    cls: 'border-border bg-secondary text-muted-foreground',
                    icon: <CircleDot className="h-3 w-3" />,
                    text: '0 cotizaciones asignadas',
                  }
                : {
                    cls: 'border-border bg-secondary text-muted-foreground',
                    icon: <Hourglass className="h-3 w-3" />,
                    text: 'Sin datos aún',
                  };
          return (
            <div
              key={v}
              className="flex flex-col gap-2.5 rounded-xl border border-border bg-secondary p-3.5"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-foreground">
                  {iniciales(v)}
                </div>
                <div className="text-[13px] font-semibold text-foreground">{v}</div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Llamadas del día
                  </Label>
                  <NumInput
                    value={ll}
                    onChange={(nv) => setVal('ll_llamadas_' + slugify(v), nv)}
                    className="w-full rounded-md border border-border bg-card px-1.5 py-1.5 text-center text-xl font-bold text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Cotizaciones atendidas
                  </Label>
                  <NumInput
                    value={cot}
                    onChange={(nv) => setVal('ll_cotz_' + slugify(v), nv)}
                    className="w-full rounded-md border border-border bg-card px-1.5 py-1.5 text-center text-xl font-bold text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div
                className={cn(
                  'flex items-center justify-center gap-1 rounded-full border px-2 py-1 text-center text-[10px] font-semibold',
                  badge.cls,
                )}
              >
                {badge.icon} {badge.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
