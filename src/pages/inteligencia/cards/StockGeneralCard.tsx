// Tabla general de stock con filtros por categoría, columnas de stock,
// mínimo, estado, posición de rack y tendencia.

import { useMemo } from 'react';
import { Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import GlassCard from '../components/GlassCard';
import EmptyState from '../components/EmptyState';
import { fmt } from '../utils/formato';
import type { Insumo, Rack } from '../Inteligencia.types';

interface StockGeneralCardProps {
  insumos: Insumo[];
  racks: Rack[];
  consumoMap: Record<string, number>;
  filtro: string | null;
  onFiltro: (c: string | null) => void;
}

export default function StockGeneralCard({
  insumos,
  racks,
  consumoMap,
  filtro,
  onFiltro,
}: StockGeneralCardProps) {
  const categorias = useMemo(
    () =>
      [
        ...new Set(insumos.map((i) => i.categoria || 'Sin categoría').filter(Boolean)),
      ].sort() as string[],
    [insumos],
  );

  const filtrados = filtro ? insumos.filter((i) => i.categoria === filtro) : insumos;

  return (
    <GlassCard
      title="Estado general del stock"
      icon={<Boxes className="h-4 w-4" />}
      iconColor="#7C75F0"
      extra={
        <div className="flex max-w-[60%] flex-wrap gap-1 md:max-w-none">
          <button
            onClick={() => onFiltro(null)}
            className={cn(
              'rounded-full border border-blue-500/30 bg-accent/10 px-2 py-0.5 text-[10px]',
              !filtro ? 'font-bold text-blue-300' : 'text-accent/70',
            )}
          >
            Todos
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              onClick={() => onFiltro(c)}
              className={cn(
                'rounded-full border border-blue-500/30 bg-accent/10 px-2 py-0.5 text-[10px]',
                filtro === c ? 'font-bold text-blue-300' : 'text-accent/70',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      }
    >
      {insumos.length === 0 ? (
        <EmptyState icon="📦" text="Sin insumos en el catálogo" />
      ) : (
        <div className="dp-scroll max-h-[520px] overflow-auto pr-1">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 text-left font-semibold">Insumo</th>
                <th className="px-2 py-2 text-right font-semibold">Stock</th>
                <th className="px-2 py-2 text-right font-semibold">Mínimo</th>
                <th className="px-2 py-2 text-center font-semibold">Estado</th>
                <th className="hidden px-2 py-2 text-right font-semibold md:table-cell">Rack</th>
                <th className="hidden px-2 py-2 text-right font-semibold md:table-cell">30d</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((ins, i) => {
                const stock = ins.stock_total;
                const min = ins.minimo != null ? Number(ins.minimo) : null;
                const cod = (ins.cod || '').toUpperCase();
                const cons30 = consumoMap[cod] || 0;

                let badgeCls = 'border-success/30 bg-success/15 text-success';
                let badgeTxt = 'OK';
                let rowStyle = '';
                if (stock <= 0) {
                  badgeCls = 'border-destructive/30 bg-destructive/15 text-destructive';
                  badgeTxt = 'Sin stock';
                  rowStyle = 'bg-destructive/[0.04]';
                } else if (min !== null && stock <= min) {
                  badgeCls = 'border-warning/30 bg-warning/15 text-warning';
                  badgeTxt = 'Bajo min';
                  rowStyle = 'bg-warning/[0.04]';
                }

                const rack = racks.find(
                  (r) => (r.codigo_insumo || '').toUpperCase() === cod,
                );
                const pos = rack
                  ? `${rack.rack}·${rack.fila}-${rack.columna}`
                  : ins.ubicacion || '—';

                let tendColor = '#71717a';
                let tendTxt = '—';
                if (cons30 > 0) {
                  const tasaDiaria = cons30 / 30;
                  const diasRest = tasaDiaria > 0 ? Math.floor(stock / tasaDiaria) : null;
                  if (diasRest !== null) {
                    tendColor =
                      diasRest < 7 ? '#ef4444' : diasRest < 15 ? '#f59e0b' : '#22c55e';
                    tendTxt = `${diasRest}d`;
                  } else {
                    tendTxt = String(fmt(cons30));
                  }
                }

                return (
                  <tr
                    key={`${cod}-${i}`}
                    className={cn('border-b border-border', rowStyle)}
                  >
                    <td className="max-w-[160px] truncate px-2 py-1.5">
                      <strong className="text-foreground">
                        {ins.nemotecnico || ins.cod || '—'}
                      </strong>
                      <div className="text-[10px] text-muted-foreground">
                        {ins.cod || ''} · {ins.categoria || ins.sub_categoria || ''}
                      </div>
                    </td>
                    <td
                      className="px-2 py-1.5 text-right font-bold"
                      style={{
                        color:
                          stock <= 0
                            ? '#ef4444'
                            : min !== null && stock <= min
                              ? '#f59e0b'
                              : '#f4f4f5',
                      }}
                    >
                      {fmt(stock)}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        {ins.unidad || ''}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground">{fmt(min)}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                          badgeCls,
                        )}
                      >
                        {badgeTxt}
                      </span>
                    </td>
                    <td className="hidden px-2 py-1.5 text-right text-[10px] text-muted-foreground md:table-cell">
                      {pos}
                    </td>
                    <td
                      className="hidden px-2 py-1.5 text-right md:table-cell"
                      style={{ color: tendColor }}
                    >
                      <span className="text-[11px]">{tendTxt}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
