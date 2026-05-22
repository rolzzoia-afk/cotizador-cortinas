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
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarDays,
  Flame,
  Loader2,
  Pencil,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  Area,
  AreaChart,
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
  TEMPERATURA_COLOR,
  TEMPERATURA_LABEL,
  calcularProgresoVendedoras,
  calcularReunionDiaria,
  useMetasReunion,
  useMetricasDerivadas,
  useMetricasLeads,
  type EmbudoAsesora,
  type FiltrosMetricas,
  type ProgresoVendedora,
  type RangoMetricas,
  type ReunionDiaria,
  type Temperatura,
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

  // Metas + datos del mes actual (independiente del filtro de rango)
  const { metas, leads: leadsMes, periodo, guardarMeta } = useMetasReunion();

  const reunion = useMemo(() => {
    const propios = esAdmin ? leadsMes : leadsMes.filter((l) => l.asignado_a === user?.id);
    const metaMes = esAdmin
      ? Object.values(metas).reduce((s, n) => s + n, 0)
      : metas[user?.id ?? ''] ?? 0;
    return calcularReunionDiaria(propios, metaMes, periodo);
  }, [leadsMes, metas, esAdmin, user?.id, periodo]);

  const progreso = useMemo(
    () => calcularProgresoVendedoras(leadsMes, vendedoras, metas, periodo),
    [leadsMes, vendedoras, metas, periodo],
  );

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
      {/* Reunión diaria */}
      <ReunionDiariaPanel
        reunion={reunion}
        progreso={progreso}
        esAdmin={esAdmin}
        periodo={periodo}
        metas={metas}
        vendedoras={vendedoras}
        onGuardarMeta={guardarMeta}
      />

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

      {/* Clientes por temperatura */}
      <Section
        title="Clientes por temperatura"
        subtitle="Cuántos hay en cada nivel de calor y el monto estimado en pesos."
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {(['frio','tibio','caliente','ganado','perdido'] as Temperatura[]).map((t) => {
            const stat = m.temperatura.find((x) => x.temperatura === t);
            const c = TEMPERATURA_COLOR[t];
            return (
              <div
                key={t}
                className="rounded-md p-3"
                style={{ background: c.bg }}
              >
                <div className="flex items-center gap-1 text-[11px]" style={{ color: c.fg, opacity: 0.85 }}>
                  <span>{c.icon}</span>
                  <span>{TEMPERATURA_LABEL[t]}</span>
                </div>
                <div className="mt-0.5 text-2xl font-medium" style={{ color: c.fg }}>
                  {stat?.count ?? 0}
                </div>
                <div className="mt-0.5 text-[11px]" style={{ color: c.fg, opacity: 0.85 }}>
                  {fmtCLP(stat?.montoCLP ?? 0)}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Flujo temporal de temperatura */}
      <Section
        title="Flujo de clientes a lo largo del tiempo"
        subtitle="Cómo se han movido los leads entre frío, tibio, caliente y ganado semana a semana."
      >
        <div className="mb-2 flex flex-wrap gap-3 text-[11px]">
          {(['frio','tibio','caliente','ganado','perdido'] as Temperatura[]).map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: TEMPERATURA_COLOR[t].fg }}
              />
              {TEMPERATURA_LABEL[t]}
            </span>
          ))}
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={m.flujoTemperatura} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
        <p className="mt-2 text-[11px] text-muted-foreground">
          Lectura: cada banda muestra cuántos leads había en ese estado al cierre de la semana. Si la banda caliente o ganado crece, el pipeline está madurando.
        </p>
      </Section>

      {/* Flujo monetario del pipeline activo */}
      <Section
        title="Monto en pipeline activo por semana"
        subtitle="Suma estimada del presupuesto de leads frío + tibio + caliente. Refleja la 'plata posible' por cerrar."
      >
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={m.flujoTemperatura} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => (v >= 1_000_000 ? `$${(v/1_000_000).toFixed(0)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`)}
              />
              <ReTooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value: number) => [fmtCLP(value), 'Pipeline activo']}
              />
              <Area type="monotone" dataKey="montoActivoCLP" stroke="#7F77DD" fill="#7F77DD" fillOpacity={0.3} name="Pipeline activo" />
            </AreaChart>
          </ResponsiveContainer>
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

      {/* Efectividad por asesora — solo admin */}
      {esAdmin && (
        <Section
          title="Efectividad por asesora"
          subtitle="El embudo de cada vendedora: de cuántas cotizaciones envió, cuántas avanzaron por cada etapa de seguimiento hasta cerrar."
          icon={<Trophy className="h-3.5 w-3.5" />}
        >
          {m.embudoAsesora.length === 0 ? (
            <EmptyMini text="Sin leads asignados en este período" />
          ) : (
            <EmbudoAsesoraTabla filas={m.embudoAsesora} />
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

// ── Reunión diaria ────────────────────────────────────────────────────
function BarraAvance({ pct }: { pct: number }) {
  const w = Math.min(100, Math.max(0, pct));
  const color =
    pct >= 100 ? '#1D9E75' : pct >= 60 ? '#7F77DD' : pct >= 30 ? '#EF9F27' : '#E24B4A';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

function ReunionDiariaPanel({
  reunion,
  progreso,
  esAdmin,
  periodo,
  metas,
  vendedoras,
  onGuardarMeta,
}: {
  reunion: ReunionDiaria;
  progreso: ProgresoVendedora[];
  esAdmin: boolean;
  periodo: string;
  metas: Record<string, number>;
  vendedoras: VendedoraOpt[];
  onGuardarMeta: (vendedoraId: string, monto: number) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const nombrePeriodo = new Date(periodo + '-01T00:00:00').toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-accent" />
          <div>
            <div className="text-base font-bold text-foreground">Reunión diaria</div>
            <div className="text-[11px] capitalize text-muted-foreground">{nombrePeriodo}</div>
          </div>
        </div>
        {esAdmin && (
          <button
            onClick={() => setEditando((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> {editando ? 'Cerrar' : 'Editar metas'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Meta del mes" value={fmtCLP(reunion.metaMes)} />
        <KpiCard
          label="Vendido"
          value={fmtCLP(reunion.acumulado)}
          sub={fmtPct(reunion.avancePct, 0) + ' de la meta'}
          accent="success"
        />
        <KpiCard
          label="Brecha"
          value={fmtCLP(reunion.brecha)}
          sub={reunion.brecha > 0 ? 'falta' : 'meta lograda'}
          accent={reunion.brecha > 0 ? 'warn' : 'success'}
        />
        <KpiCard
          label="Ritmo diario"
          value={fmtCLP(reunion.ritmoDiario)}
          sub={`${reunion.diasHabilesRestantes} días hábiles`}
        />
        <KpiCard
          label="Clientes calientes"
          value={String(reunion.clientesCalientes)}
          sub="activos"
          icon={<Flame className="h-3 w-3" />}
        />
        <KpiCard
          label="Cierres ayer"
          value={String(reunion.cierresAyer)}
          sub={`${reunion.cierresMes} en el mes`}
        />
      </div>

      <div className="mt-3">
        <BarraAvance pct={reunion.avancePct} />
      </div>

      {esAdmin &&
        (editando ? (
          <MetasEditor vendedoras={vendedoras} metas={metas} onGuardarMeta={onGuardarMeta} />
        ) : progreso.length > 0 ? (
          <div className="mt-4 space-y-2">
            {progreso.map((p) => (
              <div key={p.vendedoraId} className="text-xs">
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="font-medium text-foreground">{p.nombre}</span>
                  <span className="text-muted-foreground">
                    {fmtCLP(p.vendido)} / {fmtCLP(p.meta)} · aporte {fmtPct(p.aportePct, 0)}
                  </span>
                </div>
                <BarraAvance pct={p.avancePct} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Todavía no hay metas cargadas. Usa "Editar metas" para definir la meta mensual de cada vendedora.
          </p>
        ))}
    </div>
  );
}

function MetasEditor({
  vendedoras,
  metas,
  onGuardarMeta,
}: {
  vendedoras: VendedoraOpt[];
  metas: Record<string, number>;
  onGuardarMeta: (vendedoraId: string, monto: number) => Promise<void>;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    vendedoras.forEach((v) => {
      o[v.id] = metas[v.id] ? String(metas[v.id]) : '';
    });
    return o;
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      for (const v of vendedoras) {
        const nuevo = Number(valores[v.id] || 0);
        if (nuevo !== (metas[v.id] ?? 0)) await onGuardarMeta(v.id, nuevo);
      }
      toast.success('Metas guardadas');
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      {vendedoras.map((v) => (
        <div key={v.id} className="flex items-center gap-2 text-xs">
          <span className="w-40 truncate text-foreground">{v.nombre}</span>
          <span className="text-muted-foreground">$</span>
          <input
            type="number"
            min={0}
            step={100000}
            value={valores[v.id] ?? ''}
            onChange={(e) => setValores((p) => ({ ...p, [v.id]: e.target.value }))}
            placeholder="0"
            className="w-40 rounded-md border border-border bg-card px-2 py-1 text-foreground focus:border-accent focus:outline-none"
          />
          {valores[v.id] && Number(valores[v.id]) > 0 && (
            <span className="text-muted-foreground">{fmtCLP(Number(valores[v.id]))}</span>
          )}
        </div>
      ))}
      <button
        onClick={guardar}
        disabled={guardando}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-60"
      >
        {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar metas
      </button>
    </div>
  );
}

function EmbudoAsesoraTabla({ filas }: { filas: EmbudoAsesora[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-2 py-1.5 text-left font-normal">Asesora</th>
            <th className="px-2 py-1.5 text-right font-normal" title="Leads asignados">Asignados</th>
            <th className="px-2 py-1.5 text-right font-normal" title="Cotizaciones enviadas">Cotiz.</th>
            <th className="px-2 py-1.5 text-right font-normal" title="Clientes que respondieron">Contactos</th>
            <th className="px-2 py-1.5 text-right font-normal" title="Seguimiento 2 realizado">Seg 2</th>
            <th className="px-2 py-1.5 text-right font-normal" title="Seguimiento 3 realizado">Seg 3</th>
            <th className="px-2 py-1.5 text-right font-normal" title="Visitas">Visitas</th>
            <th className="px-2 py-1.5 text-right font-normal" title="Cierres ganados">Cierres</th>
            <th className="px-2 py-1.5 text-right font-normal" title="Cierres / Cotizaciones">% cierre</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((v, i) => {
            const cierreColor =
              v.tasaCierre >= 20
                ? { bg: '#0F6E56', fg: '#E1F5EE' }
                : v.tasaCierre >= 10
                  ? { bg: '#085041', fg: '#9FE1CB' }
                  : v.cotizaciones > 0
                    ? { bg: '#791F1F', fg: '#F7C1C1' }
                    : { bg: 'transparent', fg: 'var(--muted-foreground)' };
            return (
              <tr key={v.vendedoraId} className={cn('border-b border-border/50', i === 0 && 'bg-success/10')}>
                <td className="px-2 py-2 font-medium">
                  {i === 0 && <span className="mr-1.5" style={{ color: '#FAC775' }}>★</span>}
                  {v.nombre}
                </td>
                <td className="px-2 py-2 text-right">{v.asignados}</td>
                <td className="px-2 py-2 text-right">{v.cotizaciones}</td>
                <td className="px-2 py-2 text-right">{v.contactosEfectivos}</td>
                <td className="px-2 py-2 text-right">{v.seg2}</td>
                <td className="px-2 py-2 text-right">{v.seg3}</td>
                <td className="px-2 py-2 text-right">{v.visitas}</td>
                <td className="px-2 py-2 text-right font-medium">{v.cierres}</td>
                <td className="px-2 py-2 text-right">
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: cierreColor.bg, color: cierreColor.fg }}
                  >
                    {fmtPct(v.tasaCierre)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
