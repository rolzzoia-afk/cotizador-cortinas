// Chart apilado de errores de corte por día + motivo, con lista de los
// últimos 5 errores. Usa la paleta de colores COLORES_ERROR de la config.

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import GlassCard from '../components/GlassCard';
import EmptyState from '../components/EmptyState';
import { COLORES_ERROR } from '../Inteligencia.config';
import type { ErrorCorte } from '../Inteligencia.types';

interface ErroresCorteCardProps {
  errores: ErrorCorte[];
}

export default function ErroresCorteCard({ errores }: ErroresCorteCardProps) {
  const { chartData, motivos, ultimos5 } = useMemo(() => {
    if (errores.length === 0) return { chartData: [], motivos: [], ultimos5: [] };
    const porDia: Record<string, Record<string, number>> = {};
    for (const e of errores) {
      const dia = new Date(e.created_at).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
      });
      if (!porDia[dia]) porDia[dia] = {};
      const m = e.motivo || 'Otro';
      porDia[dia][m] = (porDia[dia][m] || 0) + 1;
    }
    const dias = Object.keys(porDia);
    const motivosSet = [...new Set(errores.map((e) => e.motivo || 'Otro'))];
    const data = dias.map((dia) => {
      const row: Record<string, string | number> = { dia };
      for (const m of motivosSet) row[m] = porDia[dia][m] || 0;
      return row;
    });
    return { chartData: data, motivos: motivosSet, ultimos5: [...errores].reverse().slice(0, 5) };
  }, [errores]);

  return (
    <GlassCard
      title="Errores de corte — por motivo"
      icon={<AlertTriangle className="h-4 w-4" />}
      iconColor="#ef4444"
      count={errores.length}
      countColor="#ef4444"
    >
      {errores.length === 0 ? (
        <EmptyState icon="✅" text="Sin errores registrados aún." />
      ) : (
        <>
          <div className="mb-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <ReTooltip
                  cursor={{ fill: 'hsl(var(--accent) / 0.08)' }}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 11,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 9, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                {motivos.map((m) => (
                  <Bar
                    key={m}
                    dataKey={m}
                    stackId="errores"
                    fill={COLORES_ERROR[m] || '#a1a1aa'}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Últimos registros
          </div>
          {ultimos5.map((e, i) => {
            const fecha = new Date(e.created_at).toLocaleDateString('es-CL', {
              day: '2-digit',
              month: '2-digit',
            });
            const color = COLORES_ERROR[e.motivo || 'Otro'] || '#a1a1aa';
            const reemplazo = e.reemplazo_cod
              ? `→ ${e.reemplazo_cod} Col.${e.reemplazo_colmena}`
              : '';
            return (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-border py-1.5 last:border-0"
              >
                <div
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[12px] font-semibold text-foreground">
                    {e.motivo}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {e.ot || '—'} · {e.cod_original || '—'}
                    {e.medida_cm != null && ` · ${Number(e.medida_cm).toFixed(1)} cm`}
                    {reemplazo && ` · ${reemplazo}`}
                  </div>
                </div>
                <span className="flex-shrink-0 text-[10px] text-muted-foreground">{fecha}</span>
              </div>
            );
          })}
        </>
      )}
    </GlassCard>
  );
}
