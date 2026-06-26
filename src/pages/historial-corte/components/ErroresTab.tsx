// Tab "Errores registrados": chart de barras por motivo + tabla con los
// últimos 200 errores.

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
import { useMemo } from 'react';
import { MOTIVO_COLOR } from '../HistorialCorte.config';
import type { ErrorRow } from '../HistorialCorte.types';

interface ErroresTabProps {
  errores: ErrorRow[];
}

export default function ErroresTab({ errores }: ErroresTabProps) {
  const motivosData = useMemo(() => {
    const conteo: Record<string, number> = {};
    errores.forEach((e) => {
      const m = e.motivo || 'Otro';
      conteo[m] = (conteo[m] || 0) + 1;
    });
    return Object.entries(conteo).map(([name, value]) => ({
      name,
      value,
      color: MOTIVO_COLOR[name] || '#a1a1aa',
    }));
  }, [errores]);

  return (
    <div className="p-5">
      {motivosData.length > 0 && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-4">
          <h6 className="mb-3 text-sm font-semibold text-foreground">
            Cantidad de errores por motivo
          </h6>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={motivosData}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  interval={0}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                />
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
                  formatter={(v: number) => [`${v} error${v > 1 ? 'es' : ''}`, '']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {motivosData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {['Fecha', 'OT', 'Código', 'Medida', 'Motivo', 'Reemplazo', 'Por'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[12px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {errores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Sin errores registrados aún.
                  </td>
                </tr>
              ) : (
                errores.map((e, i) => {
                  const fecha = new Date(e.created_at).toLocaleString('es-CL', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const color = MOTIVO_COLOR[e.motivo] || '#a1a1aa';
                  const reemplazo = e.reemplazo_cod
                    ? `Colmena ${e.reemplazo_colmena} · ${e.reemplazo_cod} (${Number(e.reemplazo_medida_cm || 0).toFixed(1)} cm)`
                    : '—';
                  return (
                    <tr key={e.id ?? i} className="border-b border-border hover:bg-secondary/40">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fecha}</td>
                      <td className="whitespace-nowrap px-3 py-2">{e.ot || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">{e.cod_original || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {e.medida_cm != null ? `${Number(e.medida_cm).toFixed(1)} cm` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: `${color}20`,
                            borderColor: `${color}55`,
                            color,
                          }}
                        >
                          {e.motivo}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{reemplazo}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {e.registrado_por || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
