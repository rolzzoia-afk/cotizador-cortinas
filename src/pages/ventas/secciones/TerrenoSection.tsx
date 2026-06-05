// Sección "Vendedores en terreno": tabla con ranking por % de cierre.
// Cada fila tiene inputs editables para visitas totales y cerradas.

import {
  ChevronUp,
  CircleAlert,
  CircleCheckBig,
  CircleDot,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SectionHeader from '../components/SectionHeader';
import NumInput from '../components/NumInput';
import { slugify } from '../utils/helpers';

type TerrenoEntry = {
  nombre: string;
  total: number;
  cerradas: number;
  pct: number;
};

interface TerrenoSectionProps {
  terrenoData: TerrenoEntry[];
  setVal: (clave: string, valor: number) => void;
}

export default function TerrenoSection({ terrenoData, setVal }: TerrenoSectionProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionHeader
        icon={<MapPin className="h-4 w-4" />}
        iconBg="rgba(14,165,233,0.15)"
        iconColor="#38bdf8"
        title="Vendedores en terreno"
        sub="Visitas del día y tasa de cierre por vendedor"
      />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['#', 'Vendedor', 'Visitas totales', 'Visitas cerradas', '% Cierre', 'Estado'].map(
                (h, i) => (
                  <th
                    key={h}
                    className={cn(
                      'border-b border-border px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground',
                      i === 0 ? 'w-9 text-left' : i === 1 ? 'text-left' : 'text-center',
                    )}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {terrenoData.map((d, i) => {
              const rank = i + 1;
              const rankCls =
                rank === 1
                  ? 'bg-warning/15 text-warning'
                  : rank === 2
                    ? 'bg-muted text-muted-foreground'
                    : rank === 3
                      ? 'bg-warning/15 text-warning'
                      : '';
              const pctCls =
                d.pct >= 60
                  ? 'border-success/30 bg-success/15 text-success'
                  : d.pct >= 30
                    ? 'border-warning/30 bg-warning/15 text-warning'
                    : 'border-destructive/30 bg-destructive/15 text-destructive';
              const estado =
                d.total === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    <CircleDot className="inline h-3 w-3" /> Sin datos
                  </span>
                ) : d.pct >= 60 ? (
                  <span className="text-xs font-semibold text-success">
                    <CircleCheckBig className="inline h-3 w-3" /> Excelente
                  </span>
                ) : d.pct >= 30 ? (
                  <span className="text-xs font-semibold text-warning">
                    <ChevronUp className="inline h-3 w-3" /> En progreso
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-destructive">
                    <CircleAlert className="inline h-3 w-3" /> Bajo
                  </span>
                );
              return (
                <tr
                  key={d.nombre}
                  className="border-b border-border transition-colors hover:bg-secondary/40"
                >
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                        rankCls,
                      )}
                    >
                      {rank}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[13px]">
                    <strong className="text-foreground">{d.nombre}</strong>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <NumInput
                      value={d.total}
                      onChange={(v) => setVal('ter_total_' + slugify(d.nombre), v)}
                      className="w-16 rounded-md border border-border bg-card px-1.5 py-1 text-center text-base font-bold text-foreground focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <NumInput
                      value={d.cerradas}
                      onChange={(v) => setVal('ter_cerradas_' + slugify(d.nombre), v)}
                      className="w-16 rounded-md border border-border bg-card px-1.5 py-1 text-center text-base font-bold text-foreground focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={cn(
                        'inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold',
                        pctCls,
                      )}
                    >
                      {d.pct}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">{estado}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
