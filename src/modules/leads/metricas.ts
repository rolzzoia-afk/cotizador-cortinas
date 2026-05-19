// Métricas del Pipeline de leads.
// Carga leads + actividad agregada y los expone como derivados memoizables
// para el componente MetricasLeadsView. Diseñado para el dashboard de la
// pestaña "Métricas" dentro de LeadsPipeline.
//
// Nota de rendimiento: una sola query trae todos los leads del rango y
// otra trae las actividades 'cambio_estado'. Los cálculos se hacen en
// cliente con useMemo — más simple que un RPC y suficiente para volúmenes
// del orden de unos miles de leads.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Lead, LeadActividad, LeadEstado } from './types';
import { ESTADO_ES_PERDIDO, ESTADO_ES_TERMINAL, esLeadDeBot } from './types';

// ── Rango temporal ────────────────────────────────────────────────────
export type RangoMetricas = 'mes' | 'trimestre' | 'anio' | 'todo';

export function rangoEnDias(r: RangoMetricas): number | null {
  switch (r) {
    case 'mes': return 30;
    case 'trimestre': return 90;
    case 'anio': return 365;
    case 'todo': return null;
  }
}

// ── Presupuesto: mapear rango de texto a un monto promedio en CLP ─────
// Estos son los valores que captura el agente IA (ver types.ts) más algunos
// variantes que podrían venir del input manual.
export function presupuestoPromedio(rango: string | null): number {
  if (!rango) return 0;
  const r = rango.toLowerCase();
  if (r.includes('menos de') && r.includes('300')) return 150_000;
  if (r.includes('300') && r.includes('700')) return 500_000;
  if (r.includes('700') && r.includes('1.500')) return 1_100_000;
  if (r.includes('1.500') && r.includes('3.000')) return 2_250_000;
  if (r.includes('más de') && r.includes('3.000')) return 4_000_000;
  return 0;
}

// ── Hook principal ────────────────────────────────────────────────────
export type MetricasLeadsData = {
  leads: Lead[];
  actividad: LeadActividad[];
  loading: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
};

export function useMetricasLeads(rango: RangoMetricas): MetricasLeadsData {
  const { empresaId } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [actividad, setActividad] = useState<LeadActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const dias = rangoEnDias(rango);
      const desde = dias
        ? new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Query 1: leads del rango (creados en el período o aún activos)
      let leadsQ = supabase
        .from('leads' as any)
        .select('*')
        .eq('empresa_id', empresaId);
      if (desde) leadsQ = leadsQ.gte('created_at', desde);
      const { data: leadsData, error: errL } = await leadsQ;
      if (errL) throw new Error(errL.message);
      const ls = ((leadsData || []) as unknown) as Lead[];
      setLeads(ls);

      // Query 2: actividades 'cambio_estado' de esos leads (para tiempos por etapa)
      if (ls.length > 0) {
        const ids = ls.map((l) => l.id);
        const { data: actData, error: errA } = await supabase
          .from('leads_actividad' as any)
          .select('*')
          .eq('empresa_id', empresaId)
          .in('lead_id', ids)
          .eq('tipo', 'cambio_estado')
          .order('created_at', { ascending: true });
        if (errA) throw new Error(errA.message);
        setActividad(((actData || []) as unknown) as LeadActividad[]);
      } else {
        setActividad([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [empresaId, rango]);

  useEffect(() => { cargar(); }, [cargar]);

  return { leads, actividad, loading, error, refrescar: cargar };
}

// ── Cálculos derivados ────────────────────────────────────────────────

export type KpisLeads = {
  totalLeads: number;
  ganados: number;
  perdidos: number;
  enCurso: number;
  tasaCierre: number; // %
  pipelineActivoCLP: number;
  atascadosMasDe14d: number;
};

export function calcularKpis(leads: Lead[]): KpisLeads {
  const total = leads.length;
  const ganados = leads.filter((l) => l.estado === 'ganado').length;
  const perdidos = leads.filter((l) => ESTADO_ES_PERDIDO(l.estado)).length;
  const enCurso = leads.filter((l) => !ESTADO_ES_TERMINAL(l.estado)).length;
  const tasaCierre = total > 0 ? (ganados / total) * 100 : 0;
  const pipelineActivoCLP = leads
    .filter((l) => !ESTADO_ES_TERMINAL(l.estado))
    .reduce((sum, l) => sum + presupuestoPromedio(l.presupuesto_rango), 0);
  const haceCatorceDias = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const atascadosMasDe14d = leads.filter(
    (l) =>
      !ESTADO_ES_TERMINAL(l.estado) &&
      new Date(l.ultima_actividad_at).getTime() < haceCatorceDias,
  ).length;
  return {
    totalLeads: total,
    ganados,
    perdidos,
    enCurso,
    tasaCierre,
    pipelineActivoCLP,
    atascadosMasDe14d,
  };
}

// ── Embudo: agrupa los 12 estados en 8 niveles legibles ───────────────
export type NivelEmbudo = {
  key: string;
  label: string;
  count: number;
  pctAvance: number | null; // % vs nivel anterior (null para el primero)
  acento: 'progreso' | 'negociacion' | 'ganado';
};

export function calcularEmbudo(leads: Lead[]): NivelEmbudo[] {
  const c = (e: LeadEstado) => leads.filter((l) => l.estado === e).length;
  // Acumulamos hacia atrás: si está en "cotizado" antes pasó por "nuevo",
  // "contactado", etc. Para el embudo mostramos cuántos ESTUVIERON al menos
  // en ese nivel (=count actual + niveles posteriores).
  const nuevo = leads.length; // todos pasaron por "nuevo"
  const contactado = leads.length - c('nuevo');
  const visAg =
    contactado - c('contactado');
  const visRe = visAg - c('visita_agendada');
  const cot = visRe - c('visita_realizada');
  const cotZ = cot - c('cotizando');
  const neg = cotZ - c('cotizado') - c('en_espera');
  const gan = c('ganado');

  const niveles: Omit<NivelEmbudo, 'pctAvance'>[] = [
    { key: 'nuevo', label: 'Nuevo', count: nuevo, acento: 'progreso' },
    { key: 'contactado', label: 'Contactado', count: contactado, acento: 'progreso' },
    { key: 'visita_agendada', label: 'Visita agendada', count: visAg, acento: 'progreso' },
    { key: 'visita_realizada', label: 'Visita realizada', count: visRe, acento: 'progreso' },
    { key: 'cotizando', label: 'Cotizando', count: cot, acento: 'progreso' },
    { key: 'cotizado', label: 'Cotizado', count: cotZ, acento: 'progreso' },
    { key: 'negociacion', label: 'Negociación', count: neg, acento: 'negociacion' },
    { key: 'ganado', label: 'Ganado', count: gan, acento: 'ganado' },
  ];

  return niveles.map((n, i) => ({
    ...n,
    pctAvance:
      i === 0
        ? null
        : niveles[i - 1].count > 0
          ? (n.count / niveles[i - 1].count) * 100
          : 0,
  }));
}

// ── Origen de leads (canal/fuente, agrupado) ──────────────────────────
export function calcularOrigen(leads: Lead[]): Array<{ label: string; count: number; pct: number }> {
  const total = leads.length;
  if (total === 0) return [];
  const conteo = new Map<string, number>();
  leads.forEach((l) => {
    let key: string;
    if (esLeadDeBot(l)) key = 'WhatsApp Bot';
    else key = l.fuente || 'Manual / sin fuente';
    conteo.set(key, (conteo.get(key) || 0) + 1);
  });
  return Array.from(conteo.entries())
    .map(([label, count]) => ({ label, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

// ── Motivos de pérdida ────────────────────────────────────────────────
export function calcularMotivosPerdida(leads: Lead[]): Array<{ label: string; count: number; pct: number }> {
  const perdidos = leads.filter((l) => ESTADO_ES_PERDIDO(l.estado));
  const total = perdidos.length;
  if (total === 0) return [];
  const conteo = {
    'Precio': perdidos.filter((l) => l.estado === 'perdido_precio').length,
    'Competencia': perdidos.filter((l) => l.estado === 'perdido_competencia').length,
    'Otro': perdidos.filter((l) => l.estado === 'perdido_otro').length,
  };
  return Object.entries(conteo)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

// ── Tiempos promedio entre etapas ─────────────────────────────────────
// Para cada lead, calculamos cuánto tardó en pasar de un estado al siguiente.
// Después promediamos por par de transiciones.
export type TransicionTiempo = {
  from: LeadEstado;
  to: LeadEstado;
  label: string;
  diasPromedio: number;
  muestras: number;
};

export function calcularTiemposPorEtapa(
  leads: Lead[],
  actividad: LeadActividad[],
): TransicionTiempo[] {
  // Agrupar actividad por lead, ordenada por created_at asc
  const porLead = new Map<string, LeadActividad[]>();
  actividad.forEach((a) => {
    if (!porLead.has(a.lead_id)) porLead.set(a.lead_id, []);
    porLead.get(a.lead_id)!.push(a);
  });

  // Transiciones que nos interesan medir:
  const transiciones: Array<{ from: LeadEstado; to: LeadEstado; label: string }> = [
    { from: 'nuevo', to: 'contactado', label: 'Nuevo → Contactado' },
    { from: 'contactado', to: 'visita_agendada', label: 'Contactado → Visita ag.' },
    { from: 'visita_agendada', to: 'visita_realizada', label: 'Visita ag. → realizada' },
    { from: 'visita_realizada', to: 'cotizando', label: 'Visita → Cotizando' },
    { from: 'cotizando', to: 'cotizado', label: 'Cotizando → Cotizado' },
    { from: 'cotizado', to: 'negociacion', label: 'Cotizado → Negociación' },
    { from: 'negociacion', to: 'ganado', label: 'Negociación → Ganado' },
  ];

  return transiciones.map((t) => {
    const tiempos: number[] = [];
    porLead.forEach((acts) => {
      // Buscar pares from→to consecutivos o no, lo importante es timestamp
      const idxFrom = acts.findIndex(
        (a) => (a.detalle?.to_estado as string) === t.from,
      );
      const idxTo = acts.findIndex(
        (a) => (a.detalle?.to_estado as string) === t.to,
      );
      if (idxFrom >= 0 && idxTo > idxFrom) {
        const ms =
          new Date(acts[idxTo].created_at).getTime() -
          new Date(acts[idxFrom].created_at).getTime();
        if (ms > 0) tiempos.push(ms / (24 * 60 * 60 * 1000));
      }
    });
    const promedio = tiempos.length > 0
      ? tiempos.reduce((s, n) => s + n, 0) / tiempos.length
      : 0;
    return {
      from: t.from,
      to: t.to,
      label: t.label,
      diasPromedio: promedio,
      muestras: tiempos.length,
    };
  });
}

// ── Performance por vendedora ─────────────────────────────────────────
export type VendedoraStats = {
  vendedoraId: string;
  nombre: string;
  asignados: number;
  ganados: number;
  perdidos: number;
  tasaCierre: number;
  diasPromedio: number; // tiempo promedio para llegar a ganado
};

export function calcularPorVendedora(
  leads: Lead[],
  actividad: LeadActividad[],
  vendedoras: Array<{ id: string; nombre: string }>,
): VendedoraStats[] {
  const stats: VendedoraStats[] = vendedoras.map((v) => {
    const propios = leads.filter((l) => l.asignado_a === v.id);
    const ganados = propios.filter((l) => l.estado === 'ganado');
    const perdidos = propios.filter((l) => ESTADO_ES_PERDIDO(l.estado));
    // Días promedio de ganados (desde created_at hasta el cambio_estado a 'ganado')
    const tiempos: number[] = [];
    ganados.forEach((l) => {
      const evGanado = actividad
        .filter((a) => a.lead_id === l.id && a.detalle?.to_estado === 'ganado')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (evGanado) {
        const ms =
          new Date(evGanado.created_at).getTime() -
          new Date(l.created_at).getTime();
        if (ms > 0) tiempos.push(ms / (24 * 60 * 60 * 1000));
      }
    });
    const dias = tiempos.length > 0
      ? tiempos.reduce((s, n) => s + n, 0) / tiempos.length
      : 0;
    const tasa = propios.length > 0 ? (ganados.length / propios.length) * 100 : 0;
    return {
      vendedoraId: v.id,
      nombre: v.nombre,
      asignados: propios.length,
      ganados: ganados.length,
      perdidos: perdidos.length,
      tasaCierre: tasa,
      diasPromedio: dias,
    };
  });
  return stats
    .filter((s) => s.asignados > 0)
    .sort((a, b) => b.ganados - a.ganados);
}

// ── Tendencia semanal: nuevos vs ganados ──────────────────────────────
export type PuntoTendencia = {
  semana: string; // ISO week label
  nuevos: number;
  ganados: number;
};

export function calcularTendenciaSemanal(
  leads: Lead[],
  actividad: LeadActividad[],
  semanas: number = 8,
): PuntoTendencia[] {
  const hoy = new Date();
  const buckets: PuntoTendencia[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - i * 7 - hoy.getDay());
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 7);
    const nuevos = leads.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= inicio.getTime() && t < fin.getTime();
    }).length;
    const ganados = actividad.filter((a) => {
      if (a.detalle?.to_estado !== 'ganado') return false;
      const t = new Date(a.created_at).getTime();
      return t >= inicio.getTime() && t < fin.getTime();
    }).length;
    buckets.push({
      semana: inicio.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }),
      nuevos,
      ganados,
    });
  }
  return buckets;
}

// ── Filtros ───────────────────────────────────────────────────────────
export type FiltrosMetricas = {
  vendedoraId: string | null;
  canal: string | null;
};

export function aplicarFiltros(
  leads: Lead[],
  filtros: FiltrosMetricas,
): Lead[] {
  return leads.filter((l) => {
    if (filtros.vendedoraId && l.asignado_a !== filtros.vendedoraId) return false;
    if (filtros.canal) {
      const esBot = esLeadDeBot(l);
      if (filtros.canal === 'WhatsApp Bot' && !esBot) return false;
      if (filtros.canal !== 'WhatsApp Bot' && (l.fuente || 'Manual / sin fuente') !== filtros.canal) return false;
    }
    return true;
  });
}

// Helper para usar useMemo del lado del componente
export function todasLasMetricas(
  leads: Lead[],
  actividad: LeadActividad[],
  vendedoras: Array<{ id: string; nombre: string }>,
  filtros: FiltrosMetricas,
) {
  const filtrados = aplicarFiltros(leads, filtros);
  return {
    kpis: calcularKpis(filtrados),
    embudo: calcularEmbudo(filtrados),
    origen: calcularOrigen(filtrados),
    motivos: calcularMotivosPerdida(filtrados),
    tiempos: calcularTiemposPorEtapa(filtrados, actividad),
    porVendedora: calcularPorVendedora(filtrados, actividad, vendedoras),
    tendencia: calcularTendenciaSemanal(filtrados, actividad),
  };
}

// Re-export hook auxiliar para memoizar
export function useMetricasDerivadas(
  leads: Lead[],
  actividad: LeadActividad[],
  vendedoras: Array<{ id: string; nombre: string }>,
  filtros: FiltrosMetricas,
) {
  return useMemo(
    () => todasLasMetricas(leads, actividad, vendedoras, filtros),
    [leads, actividad, vendedoras, filtros],
  );
}
