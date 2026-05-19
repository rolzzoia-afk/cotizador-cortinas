// Dashboard de métricas del Pipeline de leads.
// Se renderiza como tercera vista dentro de LeadsPipeline (junto a Tabla y Kanban).
//
// Vista por rol:
//   - admin → ve todas las vendedoras, puede filtrar.
//   - ventas → ve solo sus propios leads (filtro forzado a su user id).
//
// Performance: todos los cálculos están en useMemo dentro del hook
// useMetricasDerivadas. El componente solo renderiza.

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import {
  useMetricasDerivadas,
  useMetricasLeads,
  type FiltrosMetricas,
  type RangoMetricas,
} from '@/modules/leads/metricas';
import type { VendedoraOpt } from '@/modules/leads/hooks';

const COLORES_ORIGEN = ['#7F77DD', '#1D9E75', '#378ADD', '#EF9F27', '#888780', '#D85A30', '#D4537E'];
const COLORES_PERDIDA = ['#E24B4A', '#D85A30', '#888780'];

// Estilo de tooltip consistente y legible en modo oscuro
const TOOLTIP_STYLE = {
  backgroundColor: '#1f1f1f',
  border: '1px solid #3a3a3a',
  borderRadius: 6,
  fontSize: 12,
  color: '#f5f5f5',
  padding: '6px 10px',
} as const;
const TOOLTIP_ITEM_STYLE = { color: '#f5f5f5' };
const TOOLTIP_LABEL_STYLE = { color: '#f5f5f5', fontWeight: 500, marginBottom: 2 };

// ── Formateadores ─────────────────────────────────────────────────────
const fmtCLP = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
};

const fmtPct = (n: number, decimales = 1): string =>
  `${n.toFixed(decimales).replace('.', ',')}%`;

const fmtDias = (n: number): string => {
  if (n === 0) return '—';
  if (n < 1) return `${(n * 24).toFixed(1)}h`;
  return `${n.toFixed(1)} d`;
};

// ── Componente principal ──────────────────────────────────────────────
export function MetricasLeadsView({
  vendedoras,
}: {
  vendedoras: VendedoraOpt[];
}) {
  const { user, perfil } = useAuth();
  const esAdmin = perfil?.rol === 'admin';

  // Default = 'todo' para no esconder leads viejos que se ganaron/perdieron recientemente.
  // El filtro de rango se aplica al created_at del lead (no a la última actividad).
  const [rango, setRango] = useState<RangoMetricas>('todo');
  const [filtroVendedora, setFiltroVendedora] = useState<string>('');
  const [filtroCanal, setFiltroCanal] = useState<string>('');

  const { leads, actividad, loading, error, refrescar } = useMetricasLeads(rango);

  // Si no es admin, forzamos filtro a la propia vendedora
  const filtros = useMemo<FiltrosMetricas>(
    () => ({
      vendedoraId: esAdmin ? (filtroVendedora || null) : (user?.id || null),
      canal: filtroCanal || null,
    }),
    [esAdmin, filtroVendedora, filtroCanal, user?.id],
  );

  const m = useMetricasDerivadas(leads, actividad, vendedoras, filtros);

  // Canales únicos para el filtro
  const canalesDisponibles = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.whatsapp_wa_id || l.scoring != null) set.add('WhatsApp Bot');
      else set.add(l.fuente || 'Manual / sin fuente');
    });
    return Array.from(set).sort();
  }, [leads]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando métricas…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        Error al cargar métricas: {error}
        <button
          onClick={() => refrescar()}
          className="ml-2 underline"
        >
          reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={rango}
          onChange={(e) => setRango(e.target.value as RangoMetricas)}
          className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
          title="Filtra por fecha de creación del lead"
        >
          <option value="todo">Todo el histórico</option>
          <option value="anio">Leads creados en último año</option>
          <option value="trimestre">Leads creados en últimos 90 días</option>
          <option value="mes">Leads creados en últimos 30 días</option>
        </select>
        {esAdmin && (
          <select
            value={filtroVendedora}
            onChange={(e) => setFiltroVendedora(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
          >
            <option value="">Todas las vendedoras</option>
            {vendedoras.map((v) => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        )}
        <select
          value={filtroCanal}
          onChange={(e) => setFiltroCanal(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
        >
          <option value="">Todos los canales</option>
          {canalesDisponibles.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {!esAdmin && (
          <span className="ml-auto rounded-md bg-secondary px-2 py-1 text-muted-foreground">
            Viendo tus propios leads
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Leads del período"
          value={String(m.kpis.totalLeads)}
          sub={`${m.kpis.enCurso} en curso`}
        />
        <KpiCard
          label="Ganados"
          value={String(m.kpis.ganados)}
          sub={fmtPct(m.kpis.tasaCierre) + ' de cierre'}
          accent="success"
        />
        <KpiCard
          label="Pipeline activo (est.)"
          value={fmtCLP(m.kpis.pipelineActivoCLP)}
          sub={`${m.kpis.enCurso} leads`}
        />
        <KpiCard
          label="Atascados >14 días"
          value={String(m.kpis.atascadosMasDe14d)}
          sub={m.kpis.atascadosMasDe14d > 0 ? 'Revisar' : 'Sin atrasos'}
          accent={m.kpis.atascadosMasDe14d > 0 ? 'warn' : undefined}
          icon={m.kpis.atascadosMasDe14d > 0 ? <AlertTriangle className="h-3 w-3" /> : undefined}
        />
      </div>

      {/* Embudo */}
      <Section title="Embudo de conversión" subtitle="Cuántos leads pasaron por cada etapa y el % de avance entre ellas.">
        <div className="space-y-1.5">
          {m.embudo.map((nivel, idx) => {
            // Paleta gradiente como el mockup: púrpura → ámbar → verde
            // Los 6 primeros niveles en púrpura (3 tonos), negociación en ámbar, ganado en verde.
            const colorBg =
              nivel.acento === 'ganado'
                ? '#97C459' // verde fuerte
                : nivel.acento === 'negociacion'
                  ? '#FAC775' // ámbar
                  : idx < 4
                    ? '#CECBF6' // púrpura claro
                    : '#AFA9EC'; // púrpura medio
            const colorText = nivel.acento === 'ganado' ? '#173404' : nivel.acento === 'negociacion' ? '#412402' : '#26215C';
            const ancho = Math.max(15, (nivel.count / (m.embudo[0]?.count || 1)) * 100);
            return (
              <div key={nivel.key} className="flex items-center gap-3 text-xs">
                <div
                  className="flex items-center justify-between rounded-md px-3 py-1.5 transition-all"
                  style={{
                    width: `${ancho}%`,
                    background: colorBg,
                    color: colorText,
                  }}
                >
                  <span className="font-medium">{nivel.label}</span>
                  <span className="font-medium">{nivel.count}</span>
                </div>
                <span className="min-w-[70px] text-muted-foreground">
                  {nivel.pctAvance == null ? '—' : `${fmtPct(nivel.pctAvance, 0)} →`}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Origen + Motivos de pérdida lado a lado */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Section title="Origen de leads" subtitle="De dónde vienen los prospectos.">
          {m.origen.length === 0 ? (
            <EmptyMini text="Sin datos en este período" />
          ) : (
            <DonutGrafico data={m.origen} colors={COLORES_ORIGEN} />
          )}
        </Section>
        <Section title="Motivos de pérdida" subtitle="Por qué se perdieron los leads cerrados.">
          {m.motivos.length === 0 ? (
            <EmptyMini text="Sin leads perdidos" />
          ) : (
            <DonutGrafico data={m.motivos} colors={COLORES_PERDIDA} />
          )}
        </Section>
      </div>

      {/* Tiempos por etapa */}
      <Section
        title="Tiempo promedio por etapa"
        subtitle="Identifica cuellos de botella: la etapa más larga frena todo el embudo."
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={m.tiempos.map((t) => ({
                name: t.label,
                dias: Number(t.diasPromedio.toFixed(1)),
                muestras: t.muestras,
              }))}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: 'días', position: 'insideBottom', offset: -5, fontSize: 11 }} />
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
                {m.tiempos.map((t, i) => (
                  <Cell
                    key={i}
                    fill={t.diasPromedio > 7 ? '#E24B4A' : t.diasPromedio > 3 ? '#EF9F27' : '#1D9E75'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Performance por vendedora — solo admin */}
      {esAdmin && (
        <Section
          title="Performance por vendedora"
          subtitle="Ranking ordenado por leads ganados."
          icon={<Trophy className="h-3.5 w-3.5" />}
        >
          {m.porVendedora.length === 0 ? (
            <EmptyMini text="Sin leads asignados en este período" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-1.5 text-left font-normal">Vendedora</th>
                    <th className="px-2 py-1.5 text-right font-normal">Asignados</th>
                    <th className="px-2 py-1.5 text-right font-normal">Ganados</th>
                    <th className="px-2 py-1.5 text-right font-normal">% cierre</th>
                    <th className="px-2 py-1.5 text-right font-normal">Días prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {m.porVendedora.map((v, i) => {
                    const cierreColor =
                      v.tasaCierre >= 20
                        ? { bg: '#0F6E56', fg: '#E1F5EE' } // teal fuerte
                        : v.tasaCierre >= 10
                          ? { bg: '#085041', fg: '#9FE1CB' } // teal medio
                          : v.asignados > 0
                            ? { bg: '#791F1F', fg: '#F7C1C1' } // rojo
                            : { bg: 'transparent', fg: 'var(--muted-foreground)' };
                    const diasColor =
                      v.diasPromedio > 0 && v.diasPromedio < 14
                        ? { bg: '#0F6E56', fg: '#E1F5EE' }
                        : v.diasPromedio >= 21
                          ? { bg: '#854F0B', fg: '#FAEEDA' } // ámbar
                          : { bg: 'transparent', fg: 'var(--muted-foreground)' };
                    return (
                      <tr
                        key={v.vendedoraId}
                        className={cn(
                          'border-b border-border/50',
                          i === 0 && 'bg-success/10',
                        )}
                      >
                        <td className="px-2 py-2 font-medium">
                          {i === 0 && (
                            <span className="mr-1.5" style={{ color: '#FAC775' }}>★</span>
                          )}
                          {v.nombre}
                        </td>
                        <td className="px-2 py-2 text-right">{v.asignados}</td>
                        <td className="px-2 py-2 text-right font-medium">{v.ganados}</td>
                        <td className="px-2 py-2 text-right">
                          <span
                            className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: cierreColor.bg, color: cierreColor.fg }}
                          >
                            {fmtPct(v.tasaCierre)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span
                            className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: diasColor.bg, color: diasColor.fg }}
                          >
                            {fmtDias(v.diasPromedio)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* Tendencia semanal */}
      <Section
        title="Tendencia semanal"
        subtitle="Leads nuevos vs leads ganados por semana."
        icon={<TrendingUp className="h-3.5 w-3.5" />}
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={m.tendencia} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
              <Line type="monotone" dataKey="ganados" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3 }} name="Ganados" strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'success' | 'warn';
  icon?: React.ReactNode;
}) {
  // Colores explícitos para que se lean bien tanto en oscuro como claro
  const valueColor =
    accent === 'warn'
      ? '#F0997B' // coral suave, muy legible en oscuro
      : accent === 'success'
        ? '#5DCAA5'
        : undefined;
  const subColor =
    accent === 'warn'
      ? '#F0997B'
      : accent === 'success'
        ? '#5DCAA5'
        : 'var(--muted-foreground)';
  return (
    <div className="rounded-md bg-secondary/40 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-medium" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub && (
        <div
          className="mt-0.5 flex items-center gap-1 text-[11px]"
          style={{ color: subColor }}
        >
          {icon}
          {sub}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <strong className="text-sm">{title}</strong>
      </div>
      {subtitle && (
        <p className="mb-3 text-[11px] text-muted-foreground">{subtitle}</p>
      )}
      {children}
    </div>
  );
}

function DonutGrafico({
  data,
  colors,
}: {
  data: Array<{ label: string; count: number; pct: number }>;
  colors: string[];
}) {
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

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
