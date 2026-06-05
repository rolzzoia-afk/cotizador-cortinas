// Donut chart con leyenda arriba: usado para "Origen de leads" y
// "Motivos de pérdida".

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from 'recharts';
import {
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from '../MetricasLeadsView.config';
import { fmtPct } from '../utils/formato';

interface DonutGraficoProps {
  data: Array<{ label: string; count: number; pct: number }>;
  colors: string[];
}

export default function DonutGrafico({ data, colors }: DonutGraficoProps) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
        {data.map((d, i) => (
          <span key={d.label} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: colors[i % colors.length] }}
            />
            {d.label} {fmtPct(d.pct, 0)}
          </span>
        ))}
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={64}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <ReTooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              formatter={(value: number, name: string) => [`${value} leads`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
