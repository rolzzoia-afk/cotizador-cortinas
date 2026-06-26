// Top 7 insumos más consumidos en los últimos 30 días + chart de barras del
// top 5. Muestra también días de stock restante al ritmo actual.

import { useMemo } from 'react';
import { Package } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import GlassCard from '../components/GlassCard';
import EmptyState from '../components/EmptyState';
import { fmt } from '../utils/formato';
import type { Insumo, Mov } from '../Inteligencia.types';

interface ConsumoCardProps {
  salidas: Mov[];
  insumos: Insumo[];
}

export default function ConsumoCard({ salidas, insumos }: ConsumoCardProps) {
  const { top, top5 } = useMemo(() => {
    if (salidas.length === 0) return { top: [], top5: [] };
    const mapa: Record<string, { desc: string; cantidad: number; movs: number }> = {};
    for (const m of salidas) {
      const key = (m.codigo || '').trim() || (m.producto || '?').trim();
      const desc = (m.producto || m.codigo || '?').trim();
      if (!mapa[key]) mapa[key] = { desc, cantidad: 0, movs: 0 };
      mapa[key].cantidad += Number(m.cantidad) || 0;
      mapa[key].movs++;
    }
    const sorted = Object.entries(mapa)
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .slice(0, 7);
    const top5arr = sorted.slice(0, 5).map(([k, v]) => ({
      key: k,
      name: v.desc.length > 16 ? v.desc.slice(0, 14) + '…' : v.desc,
      value: v.cantidad,
    }));
    return { top: sorted, top5: top5arr };
  }, [salidas]);

  const barColors = ['#7C75F0', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

  return (
    <GlassCard
      title="Top insumos — últimos 30 días"
      icon={<Package className="h-4 w-4" />}
      iconColor="#7C75F0"
    >
      {top.length === 0 ? (
        <EmptyState icon="📊" text="Sin movimientos de salida en los últimos 30 días" />
      ) : (
        <>
          <div className="mb-2.5 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <ReTooltip
                  cursor={{ fill: 'hsl(var(--accent) / 0.08)' }}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  formatter={(v: number) => [`${fmt(v)} unid.`, '']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {top5.map((_, i) => (
                    <Cell key={i} fill={barColors[i % barColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {top.map(([key, val], i) => {
              const ins = insumos.find(
                (x) => (x.cod || '').toUpperCase() === key.toUpperCase(),
              );
              const cat = ins?.categoria || ins?.sub_categoria || '';
              const tasaDiaria = val.cantidad / 30;
              const diasStock =
                ins && ins.stock_total > 0 && tasaDiaria > 0
                  ? Math.floor(ins.stock_total / tasaDiaria)
                  : null;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2.5 border-b border-border py-2 last:border-0"
                >
                  <span className="w-8 flex-shrink-0 text-xs font-bold text-muted-foreground">
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px] font-medium text-foreground">
                      {val.desc}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {cat}
                      {diasStock !== null && ` · ${diasStock}d de stock`}
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-right text-[13px] font-bold text-foreground">
                    {fmt(val.cantidad)}
                    <div className="text-[12px] font-normal text-muted-foreground">
                      {val.movs} mov.
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </GlassCard>
  );
}
