// Line chart: leads nuevos vs ganados por semana.

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
import {
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from '../MetricasLeadsView.config';

interface TendenciaSemanalChartProps {
  data: Array<{ semana: string; nuevos: number; ganados: number }>;
}

export default function TendenciaSemanalChart({ data }: TendenciaSemanalChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <ReTooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="nuevos" stroke="#7F77DD" strokeWidth={2} dot={{ r: 3 }} name="Nuevos" />
          <Line
            type="monotone"
            dataKey="ganados"
            stroke="#1D9E75"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Ganados"
            strokeDasharray="4 4"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
