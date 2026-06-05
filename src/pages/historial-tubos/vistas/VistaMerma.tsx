// Vista "Merma": dashboard de eventos tipo merma. Agrupa por mes + código,
// muestra KPIs (cm/m totales, cantidad de eventos) y un chart apilado de
// barras por mes con un color por código.

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Eraser, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StatBox from '../components/StatBox';
import EmptyState from '../components/EmptyState';
import { PALETA } from '../HistorialTubos.config';
import { formatMes } from '../utils/formato-fechas';
import type { Evento } from '../HistorialTubos.types';

interface VistaMermaProps {
  empresaId: string | null | undefined;
}

type MermaEvento = Pick<
  Evento,
  'cod' | 'medida_cm' | 'evento' | 'created_at' | 'n_colmena' | 'ot' | 'notas'
> & { id?: string };

export default function VistaMerma({ empresaId }: VistaMermaProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MermaEvento[]>([]);

  useEffect(() => {
    if (!empresaId) return;
    const run = async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from('tubos_historial')
        .select('cod, medida_cm, evento, created_at, n_colmena, ot, notas')
        .eq('empresa_id', empresaId)
        .eq('evento', 'merma')
        .order('created_at', { ascending: false })
        .limit(500);
      setData((rows as MermaEvento[]) ?? []);
      setLoading(false);
    };
    run();
  }, [empresaId]);

  const { totalCm, totalM, porMes, meses, cods, chartData } = useMemo(() => {
    const porMes = new Map<
      string,
      Map<string, { total_cm: number; count: number; detalles: MermaEvento[] }>
    >();
    let totalCm = 0;
    for (const e of data) {
      totalCm += e.medida_cm ?? 0;
      const mes = formatMes(e.created_at);
      if (!porMes.has(mes)) porMes.set(mes, new Map());
      const codes = porMes.get(mes)!;
      if (!codes.has(e.cod)) codes.set(e.cod, { total_cm: 0, count: 0, detalles: [] });
      const entry = codes.get(e.cod)!;
      entry.total_cm += e.medida_cm ?? 0;
      entry.count += 1;
      entry.detalles.push(e);
    }
    const meses = [...porMes.keys()].reverse();
    const cods = [...new Set(data.map((e) => e.cod))];
    const chartData = meses.map((mes) => {
      const row: Record<string, number | string> = { mes };
      for (const c of cods) {
        const cm = porMes.get(mes)?.get(c)?.total_cm ?? 0;
        row[c] = Math.round(cm * 10) / 10;
      }
      return row;
    });
    return {
      totalCm,
      totalM: (totalCm / 100).toFixed(2),
      porMes,
      meses,
      cods,
      chartData,
    };
  }, [data]);

  if (loading) {
    return <EmptyState>Cargando merma…</EmptyState>;
  }

  if (data.length === 0) {
    return (
      <EmptyState>
        <Trash2 className="mx-auto mb-3 h-10 w-10" />
        No hay merma registrada aún.
        <p className="mt-2 text-xs">
          Se registrará automáticamente al guardar planes de corte desde el optimizador.
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatBox value={Math.round(totalCm).toLocaleString('es-CL')} label="cm total merma" />
        <StatBox value={totalM} label="metros merma" />
        <StatBox value={String(data.length)} label="eventos" />
      </div>

      <div className="mb-4 rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h6 className="flex items-center gap-1.5 text-sm font-bold">
            <Eraser className="h-4 w-4 text-destructive" />
            Merma por mes y código
          </h6>
        </div>
        <div className="h-[260px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                formatter={(v: number) => [`${v} cm`]}
                cursor={{ fill: 'hsl(var(--accent) / 0.08)' }}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {cods.map((c, i) => (
                <Bar
                  key={c}
                  dataKey={c}
                  stackId="merma"
                  fill={PALETA[i % PALETA.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4 pb-10">
        {meses.map((mes) => {
          const codes = porMes.get(mes)!;
          const totalMes = [...codes.values()].reduce((s, v) => s + v.total_cm, 0);
          const maxCm = Math.max(...[...codes.values()].map((v) => v.total_cm));
          const ordenados = [...codes.entries()].sort(
            (a, b) => b[1].total_cm - a[1].total_cm,
          );
          const totalEventos = [...codes.values()].reduce((s, v) => s + v.count, 0);

          return (
            <div key={mes}>
              <div className="mb-2 border-b pb-1 text-sm font-bold text-muted-foreground">
                📅 {mes} — total:{' '}
                <strong className="text-foreground">
                  {Math.round(totalMes).toLocaleString('es-CL')} cm
                </strong>{' '}
                ({(totalMes / 100).toFixed(2)} m)
              </div>
              {ordenados.map(([codigo, info]) => (
                <div
                  key={codigo}
                  className="flex items-center gap-3 border-b border-border/40 py-1.5"
                >
                  <div className="min-w-[80px] text-sm font-bold">{codigo}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-destructive"
                      style={{ width: `${(info.total_cm / maxCm) * 100}%` }}
                    />
                  </div>
                  <div className="min-w-[120px] text-right text-xs text-muted-foreground">
                    {Math.round(info.total_cm)} cm · {info.count} corte
                    {info.count !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Ver detalle de cada merma ({totalEventos} eventos)
                </summary>
                <div className="mt-2 overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Colmena</TableHead>
                        <TableHead className="text-right">cm</TableHead>
                        <TableHead>OT</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...codes.values()]
                        .flatMap((v) => v.detalles)
                        .sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime(),
                        )
                        .map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-bold">{e.cod}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {e.n_colmena ?? '—'}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-destructive">
                              {(e.medida_cm ?? 0).toFixed(1)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {e.ot ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </>
  );
}
