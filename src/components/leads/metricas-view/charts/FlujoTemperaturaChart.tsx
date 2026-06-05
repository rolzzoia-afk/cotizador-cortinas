// Chart de área apilada: cuántos leads había en cada temperatura
// (frío/tibio/caliente/ganado/perdido) al cierre de cada semana.

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TEMPERATURA_COLOR } from '@/modules/leads/metricas';
import {
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from '../MetricasLeadsView.config';

interface FlujoTemperaturaChartProps {
  data: Array<Record<string, number | string>>;
}

export default function FlujoTemperaturaChart({ data }: FlujoTemperaturaChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <ReTooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
          />
          <Area type="monotone" dataKey="frio"     stackId="1" stroke={TEMPERATURA_COLOR.frio.fg}     fill={TEMPERATURA_COLOR.frio.fg}     fillOpacity={0.7} name="Frío" />
          <Area type="monotone" dataKey="tibio"    stackId="1" stroke={TEMPERATURA_COLOR.tibio.fg}    fill={TEMPERATURA_COLOR.tibio.fg}    fillOpacity={0.7} name="Tibio" />
          <Area type="monotone" dataKey="caliente" stackId="1" stroke={TEMPERATURA_COLOR.caliente.fg} fill={TEMPERATURA_COLOR.caliente.fg} fillOpacity={0.7} name="Caliente" />
          <Area type="monotone" dataKey="ganado"   stackId="1" stroke={TEMPERATURA_COLOR.ganado.fg}   fill={TEMPERATURA_COLOR.ganado.fg}   fillOpacity={0.7} name="Ganado" />
          <Area type="monotone" dataKey="perdido"  stackId="1" stroke={TEMPERATURA_COLOR.perdido.fg}  fill={TEMPERATURA_COLOR.perdido.fg}  fillOpacity={0.7} name="Perdido" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
