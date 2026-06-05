// Sección "Evolución de la semana/mes": chart de líneas con la evolución
// diaria de mensajes recibidos, llamadas y cierres.

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import type { Periodo } from '../Ventas.types';

type HistorialEntry = {
  label: string;
  Mensajes: number;
  Llamadas: number;
  Cierres: number;
};

interface HistorialSectionProps {
  historial: HistorialEntry[];
  periodo: Periodo;
}

export default function HistorialSection({ historial, periodo }: HistorialSectionProps) {
  if (periodo === 'dia' || historial.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionHeader
        icon={<TrendingUp className="h-4 w-4" />}
        iconBg="rgba(99,102,241,0.15)"
        iconColor="#818cf8"
        title={periodo === 'semana' ? 'Evolución de la semana' : 'Evolución del mes'}
        sub="Mensajes recibidos, llamadas y cierres"
      />
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={historial}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <ReTooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
                color: 'hsl(var(--popover-foreground))',
              }}
              labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="line"
              formatter={(v) => (
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>
              )}
            />
            <Line type="monotone" dataKey="Mensajes" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Llamadas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Cierres" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
