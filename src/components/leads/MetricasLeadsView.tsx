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
import { useAuth } from '@/lib/auth';
import {
  TEMPERATURA_COLOR,
  TEMPERATURA_LABEL,
  calcularProgresoVendedoras,
  calcularReunionDiaria,
  useMetasReunion,
  useMetricasDerivadas,
  useMetricasLeads,
  type FiltrosMetricas,
  type RangoMetricas,
  type Temperatura,
} from '@/modules/leads/metricas';
import type { VendedoraOpt } from '@/modules/leads/hooks';

import { COLORES_ORIGEN, COLORES_PERDIDA } from './metricas-view/MetricasLeadsView.config';
import { fmtCLP, fmtPct } from './metricas-view/utils/formato';
import KpiCard from './metricas-view/components/KpiCard';
import Section from './metricas-view/components/Section';
import DonutGrafico from './metricas-view/components/DonutGrafico';
import EmptyMini from './metricas-view/components/EmptyMini';
import ReunionDiariaPanel from './metricas-view/components/ReunionDiariaPanel';
import EmbudoAsesoraTabla from './metricas-view/components/EmbudoAsesoraTabla';
import FlujoTemperaturaChart from './metricas-view/charts/FlujoTemperaturaChart';
import FlujoMonetarioChart from './metricas-view/charts/FlujoMonetarioChart';
import TiemposPorEtapaChart from './metricas-view/charts/TiemposPorEtapaChart';
import TendenciaSemanalChart from './metricas-view/charts/TendenciaSemanalChart';

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
        <FlujoTemperaturaChart data={m.flujoTemperatura} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Lectura: cada banda muestra cuántos leads había en ese estado al cierre de la semana. Si la banda caliente o ganado crece, el pipeline está madurando.
        </p>
      </Section>

      {/* Flujo monetario del pipeline activo */}
      <Section
        title="Monto en pipeline activo por semana"
        subtitle="Suma estimada del presupuesto de leads frío + tibio + caliente. Refleja la 'plata posible' por cerrar."
      >
        <FlujoMonetarioChart data={m.flujoTemperatura} />
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
        <TiemposPorEtapaChart tiempos={m.tiempos} />
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
        <TendenciaSemanalChart data={m.tendencia} />
      </Section>
    </div>
  );
}
