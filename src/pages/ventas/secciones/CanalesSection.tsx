// Sección "Fuente de cotizaciones": grid con un mini-card por canal +
// pie chart con la distribución. Cada card muestra el % del total.

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from 'recharts';
import { CircleDot, MessageCircle } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import NumInput from '../components/NumInput';
import { CANAL_COLORS } from '../Ventas.config';
import { slugify } from '../utils/helpers';

interface CanalesSectionProps {
  canales: string[];
  totalCanales: number;
  canalesChartData: Array<{ name: string; value: number; color: string }>;
  getVal: (clave: string) => number;
  setVal: (clave: string, valor: number) => void;
}

export default function CanalesSection({
  canales,
  totalCanales,
  canalesChartData,
  getVal,
  setVal,
}: CanalesSectionProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionHeader
        icon={<MessageCircle className="h-4 w-4" />}
        iconBg="rgba(99,102,241,0.15)"
        iconColor="#818cf8"
        title="Fuente de cotizaciones"
        sub="Cantidad de mensajes recibidos por canal hoy"
        right={
          <div className="text-right text-[22px] font-extrabold text-foreground">
            {totalCanales}
            <span className="block text-[11px] font-normal text-muted-foreground">total</span>
          </div>
        }
      />
      <div className="flex flex-wrap items-start gap-5">
        <div
          className="grid flex-1 gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            minWidth: 200,
          }}
        >
          {canales.map((canal, i) => {
            const color = CANAL_COLORS[i % CANAL_COLORS.length];
            const v = getVal('canal_' + slugify(canal));
            const pct = totalCanales > 0 ? Math.round((v / totalCanales) * 100) : 0;
            return (
              <div
                key={canal}
                className="rounded-xl border border-border bg-secondary p-3.5 text-center"
              >
                <div
                  className="mb-2.5 flex items-center justify-center gap-1.5 text-[11px]"
                  style={{ color }}
                >
                  <CircleDot className="h-2 w-2 fill-current" /> {canal}
                </div>
                <NumInput
                  value={v}
                  onChange={(nv) => setVal('canal_' + slugify(canal), nv)}
                  className="w-full border-0 border-b-2 border-border bg-transparent text-center text-[28px] font-extrabold text-foreground focus:border-accent focus:outline-none"
                />
                <div className="mt-1.5 text-[11px] text-muted-foreground">{pct}% del total</div>
              </div>
            );
          })}
        </div>
        <div className="h-32 w-32 flex-shrink-0">
          {canalesChartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={canalesChartData}
                  dataKey="value"
                  innerRadius={38}
                  outerRadius={62}
                  paddingAngle={1}
                  strokeWidth={0}
                >
                  {canalesChartData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
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
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
