// Bar chart horizontal: tiempo promedio (días) que cada etapa demora.
// Identifica el cuello de botella del embudo.

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
import {
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from '../MetricasLeadsView.config';

interface TiemposPorEtapaChartProps {
  tiempos: Array<{ label: string; diasPromedio: number; muestras: number }>;
}

export default function TiemposPorEtapaChart({ tiempos }: TiemposPorEtapaChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={tiempos.map((t) => ({
            name: t.label,
            dias: Number(t.diasPromedio.toFixed(1)),
            muestras: t.muestras,
          }))}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            label={{ value: 'días', position: 'insideBottom', offset: -5, fontSize: 11 }}
          />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
          <ReTooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value: number, _name: string, ctx: any) => [
              `${value} días (${ctx.payload.muestras} muestras)`,
              'Promedio',
            ]}
          />
          <Bar dataKey="dias" radius={[0, 4, 4, 0]}>
            {tiempos.map((t, i) => (
              <Cell
                key={i}
                fill={
                  t.diasPromedio > 7
                    ? '#E24B4A'
                    : t.diasPromedio > 3
                      ? '#EF9F27'
                      : '#1D9E75'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
