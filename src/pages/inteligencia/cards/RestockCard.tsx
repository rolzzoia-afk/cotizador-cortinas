// Sugerencias de reposición priorizadas. Lista limpia con número a la
// derecha + unidad + barra de progreso animada. Scroll vertical para listas
// largas.

import { useMemo } from 'react';
import GlassCard from '../components/GlassCard';
import EmptyState from '../components/EmptyState';
import StockBar from '../components/StockBar';
import { fmt } from '../utils/formato';
import type { Insumo } from '../Inteligencia.types';

interface RestockCardProps {
  insumos: Insumo[];
  consumoMap: Record<string, number>;
}

interface Sugerencia {
  ins: Insumo;
  urgencia: number;
  motivo: string;
  cantSugerida: number;
  barValue: number;
  barMax: number;
}

export default function RestockCard({ insumos, consumoMap }: RestockCardProps) {
  const sugerencias = useMemo(() => {
    const arr: Sugerencia[] = [];
    for (const ins of insumos) {
      const cod = (ins.cod || '').trim().toUpperCase();
      const stock = ins.stock_total;
      const min = ins.minimo != null ? Number(ins.minimo) : null;
      const consumo30d = consumoMap[cod] || 0;
      const tasaDiaria = consumo30d / 30;
      let urgencia = 0;
      let motivo = '';
      let cantSugerida = 0;
      let barValue = 0;
      let barMax = 1;
      if (min !== null && stock <= min) {
        urgencia = stock <= 0 ? 3 : stock < min * 0.5 ? 2 : 1;
        cantSugerida = Math.ceil(min - stock + consumo30d);
        motivo = stock <= 0 ? 'Sin stock' : `Stock bajo mínimo (${fmt(stock)}/${fmt(min)})`;
        barValue = Math.max(0, stock);
        barMax = min;
      } else if (tasaDiaria > 0 && stock > 0) {
        const diasRestantes = stock / tasaDiaria;
        if (diasRestantes < 15) {
          urgencia = diasRestantes < 7 ? 2 : 1;
          cantSugerida = Math.ceil(consumo30d * 1.5);
          motivo = `${Math.floor(diasRestantes)}d de stock al ritmo actual`;
          barValue = diasRestantes;
          barMax = 15;
        }
      }
      if (urgencia > 0) arr.push({ ins, urgencia, motivo, cantSugerida, barValue, barMax });
    }
    return arr.sort((a, b) => b.urgencia - a.urgencia);
  }, [insumos, consumoMap]);

  return (
    <GlassCard title="Sugerencias de reposición" icon={null} iconColor="" count={sugerencias.length}>
      {sugerencias.length === 0 ? (
        <EmptyState icon="" text="Sin necesidades de reposición urgentes" />
      ) : (
        <ul className="dp-scroll max-h-[420px] overflow-y-auto divide-y divide-border/50 pr-1">
          {sugerencias.map((s, i) => {
            const tone =
              s.urgencia >= 3
                ? 'text-destructive'
                : s.urgencia >= 2
                  ? 'text-warning'
                  : 'text-foreground';
            const barTone: 'destructive' | 'warning' | 'success' =
              s.urgencia >= 3 ? 'destructive' : s.urgencia >= 2 ? 'warning' : 'success';
            return (
              <li key={`${s.ins.cod}-${i}`} className="dp-row py-2.5">
                <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-foreground">
                      {s.ins.nemotecnico || s.ins.cod}
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                      {s.motivo}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`dp-num text-[15px] font-medium leading-none ${tone}`}>
                      {fmt(s.cantSugerida)}
                    </div>
                    <div className="mt-1 text-[12px] uppercase tracking-wide text-muted-foreground">
                      sugerido
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <StockBar value={s.barValue} max={s.barMax} tone={barTone} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
