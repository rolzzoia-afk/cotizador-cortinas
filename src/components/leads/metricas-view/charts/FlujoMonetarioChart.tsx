// Chart de área del monto del pipeline activo (frío+tibio+caliente) por
// semana — refleja la "plata posible" por cerrar.

import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { fmtCLP } from '../utils/formato';

interface FlujoMonetarioChartProps {
  data: Array<Record<string, number | string>>;
}

export default function FlujoMonetarioChart({ data }: FlujoMonetarioChartProps) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `$${(v / 1_000_000).toFixed(0)}M`
                : v >= 1_000
                  ? `$${(v / 1_000).toFixed(0)}K`
                  : `$${v}`
            }
          />
          <ReTooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value: number) => [fmtCLP(value), 'Pipeline activo']}
          />
          <Area
            type="monotone"
            dataKey="montoActivoCLP"
            stroke="#7F77DD"
            fill="#7F77DD"
            fillOpacity={0.3}
            name="Pipeline activo"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
