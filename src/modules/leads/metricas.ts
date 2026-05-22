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
import { ESTADO_ES_PERDIDO, ESTADO_ES_TERMINAL, esLeadDeBot, SEG_RESULTADO_POSITIVO } from './types';

// El estado destino de un cambio_estado: la RPC guarda la clave como `a`, pero
// algunos datos antiguos usaban `to_estado`. Leemos ambas por robustez.
function estadoDestino(a: LeadActividad): LeadEstado | undefined {
  const d = a.detalle as Record<string, unknown> | null;
  return (d?.to_estado ?? d?.a) as LeadEstado | undefined;
}

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

// Monto efectivo del lead: usa el monto real si está cargado; si no, lo estima
// desde el rango de presupuesto (proxy) para que el dashboard nunca quede vacío.
export function montoLead(l: Pick<Lead, 'monto' | 'presupuesto_rango'>): number {
  if (l.monto != null && l.monto > 0) return l.monto;
  return presupuestoPromedio(l.presupuesto_rango);
}

// Periodo 'YYYY-MM'
export function periodoActual(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mismoPeriodo(iso: string | null, periodo: string): boolean {
  if (!iso) return false;
  return periodoActual(new Date(iso)) === periodo;
}

function esAyer(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  return (
    d.getFullYear() === ayer.getFullYear() &&
    d.getMonth() === ayer.getMonth() &&
    d.getDate() === ayer.getDate()
  );
}

// Días hábiles (lun-vie) que quedan en el mes, contando hoy.
export function diasHabilesRestantes(d: Date = new Date()): number {
  const year = d.getFullYear();
  const month = d.getMonth();
  const finMes = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let dia = d.getDate(); dia <= finMes; dia++) {
    const wd = new Date(year, month, dia).getDay();
    if (wd !== 0 && wd !== 6) count++;
  }
  return count;
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

// ── Clasificación por temperatura ─────────────────────────────────────
// Frío:     todavía no se concretó nada — solo pidió info / fue contactado / agendó visita
// Tibio:    ya hay cotización con precio — el cliente conoce el monto
// Caliente: ya tuvo visita real (showroom o terreno) — máximo compromiso recíproco
// Ganado:   cerró
// Perdido:  se cayó en algún punto
export type Temperatura = 'frio' | 'tibio' | 'caliente' | 'ganado' | 'perdido';

export function temperaturaDeLead(l: Pick<Lead, 'estado'>): Temperatura {
  if (l.estado === 'ganado') return 'ganado';
  if (ESTADO_ES_PERDIDO(l.estado)) return 'perdido';
  if (l.estado === 'visita_realizada' || l.estado === 'negociacion' || l.estado === 'en_espera') return 'caliente';
  if (l.estado === 'cotizando' || l.estado === 'cotizado') return 'tibio';
  return 'frio';
}

export const TEMPERATURA_LABEL: Record<Temperatura, string> = {
  frio: 'Frío',
  tibio: 'Tibio',
  caliente: 'Caliente',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

export const TEMPERATURA_COLOR: Record<Temperatura, { bg: string; fg: string; icon: string }> = {
  frio:     { bg: '#1F3A5F', fg: '#85B7EB', icon: '❄' },
  tibio:    { bg: '#3D2F12', fg: '#EF9F27', icon: '◐' },
  caliente: { bg: '#4A1B0C', fg: '#F0997B', icon: '🔥' },
  ganado:   { bg: '#173404', fg: '#97C459', icon: '✓' },
  perdido:  { bg: '#3B0E0E', fg: '#F09595', icon: '✕' },
};

export type StatTemperatura = {
  temperatura: Temperatura;
  count: number;
  montoCLP: number;
  pct: number;
};

export function calcularPorTemperatura(leads: Lead[]): StatTemperatura[] {
  const total = leads.length;
  const ordenes: Temperatura[] = ['frio', 'tibio', 'caliente', 'ganado', 'perdido'];
  return ordenes.map((t) => {
    const subset = leads.filter((l) => temperaturaDeLead(l) === t);
    const monto = subset.reduce((s, l) => s + presupuestoPromedio(l.presupuesto_rango), 0);
    return {
      temperatura: t,
      count: subset.length,
      montoCLP: monto,
      pct: total > 0 ? (subset.length / total) * 100 : 0,
    };
  });
}

// Flujo temporal: cuántos leads en cada temperatura semana a semana.
// Para cada lead vivo en una semana, lo clasificamos según el estado en que estaba
// en ese momento (reconstruido a partir del histórico de actividades).
export type PuntoFlujoTemperatura = {
  semana: string;
  frio: number;
  tibio: number;
  caliente: number;
  ganado: number;
  perdido: number;
  montoActivoCLP: number; // monto total de leads frio+tibio+caliente
};

export function calcularFlujoTemperaturaSemanal(
  leads: Lead[],
  actividad: LeadActividad[],
  semanas: number = 8,
): PuntoFlujoTemperatura[] {
  const hoy = new Date();
  const buckets: PuntoFlujoTemperatura[] = [];

  // Pre-construir: por cada lead, lista ordenada de [timestamp → estado]
  const transicionesPorLead = new Map<string, Array<{ ts: number; estado: LeadEstado }>>();
  leads.forEach((l) => {
    transicionesPorLead.set(l.id, [
      { ts: new Date(l.created_at).getTime(), estado: 'nuevo' as LeadEstado },
    ]);
  });
  actividad.forEach((a) => {
    const lista = transicionesPorLead.get(a.lead_id);
    if (!lista) return;
    const to = estadoDestino(a);
    if (!to) return;
    lista.push({ ts: new Date(a.created_at).getTime(), estado: to });
  });

  for (let i = semanas - 1; i >= 0; i--) {
    const finSemana = new Date(hoy);
    finSemana.setDate(finSemana.getDate() - i * 7);
    finSemana.setHours(23, 59, 59, 999);
    const inicioSemana = new Date(finSemana);
    inicioSemana.setDate(inicioSemana.getDate() - 6);
    inicioSemana.setHours(0, 0, 0, 0);
    const cutoffTs = finSemana.getTime();

    const conteo: Record<Temperatura, number> = {
      frio: 0, tibio: 0, caliente: 0, ganado: 0, perdido: 0,
    };
    let montoActivo = 0;

    leads.forEach((l) => {
      // ¿Este lead existía a fin de semana?
      const createdTs = new Date(l.created_at).getTime();
      if (createdTs > cutoffTs) return;

      // ¿Cuál era su estado al cierre de esa semana?
      const transiciones = transicionesPorLead.get(l.id) || [];
      let estadoEnSemana: LeadEstado = 'nuevo';
      for (const t of transiciones) {
        if (t.ts <= cutoffTs) estadoEnSemana = t.estado;
        else break;
      }
      const temp = temperaturaDeLead({ estado: estadoEnSemana });
      conteo[temp]++;
      if (temp === 'frio' || temp === 'tibio' || temp === 'caliente') {
        montoActivo += presupuestoPromedio(l.presupuesto_rango);
      }
    });

    buckets.push({
      semana: inicioSemana.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }),
      ...conteo,
      montoActivoCLP: montoActivo,
    });
  }

  return buckets;
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
      const idxFrom = acts.findIndex((a) => estadoDestino(a) === t.from);
      const idxTo = acts.findIndex((a) => estadoDestino(a) === t.to);
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
        .filter((a) => a.lead_id === l.id && estadoDestino(a) === 'ganado')
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
      if (estadoDestino(a) !== 'ganado') return false;
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

// ── Embudo de efectividad por asesora ─────────────────────────────────
// KPIs alineados con la propuesta de medición de efectividad en ventas.
function haCotizado(l: Lead): boolean {
  return (
    l.fecha_cotizacion != null ||
    l.ot_id != null ||
    l.estado === 'cotizado' ||
    l.estado === 'negociacion' ||
    l.estado === 'en_espera' ||
    l.estado === 'ganado'
  );
}

function contactoEfectivo(l: Lead): boolean {
  if (SEG_RESULTADO_POSITIVO(l.seg1_resultado ?? '')) return true;
  if (SEG_RESULTADO_POSITIVO(l.seg2_resultado ?? '')) return true;
  if (SEG_RESULTADO_POSITIVO(l.seg3_resultado ?? '')) return true;
  return ['negociacion', 'en_espera', 'visita_realizada', 'ganado'].includes(l.estado);
}

function tuvoVisita(l: Lead): boolean {
  if (l.estado === 'visita_agendada' || l.estado === 'visita_realizada') return true;
  return (
    l.seg1_resultado === 'agendo_visita' ||
    l.seg2_resultado === 'agendo_visita' ||
    l.seg3_resultado === 'agendo_visita'
  );
}

export type EmbudoAsesora = {
  vendedoraId: string;
  nombre: string;
  asignados: number;
  cotizaciones: number;
  contactosEfectivos: number;
  seg2: number;
  seg3: number;
  visitas: number;
  cierres: number;
  tasaCierre: number; // cierres / cotizaciones * 100
};

export function calcularEmbudoPorAsesora(
  leads: Lead[],
  vendedoras: Array<{ id: string; nombre: string }>,
): EmbudoAsesora[] {
  return vendedoras
    .map((v) => {
      const propios = leads.filter((l) => l.asignado_a === v.id);
      const cotizaciones = propios.filter(haCotizado).length;
      const cierres = propios.filter((l) => l.estado === 'ganado').length;
      return {
        vendedoraId: v.id,
        nombre: v.nombre,
        asignados: propios.length,
        cotizaciones,
        contactosEfectivos: propios.filter(contactoEfectivo).length,
        seg2: propios.filter((l) => l.seg2_fecha != null).length,
        seg3: propios.filter((l) => l.seg3_fecha != null).length,
        visitas: propios.filter(tuvoVisita).length,
        cierres,
        tasaCierre: cotizaciones > 0 ? (cierres / cotizaciones) * 100 : 0,
      };
    })
    .filter((e) => e.asignados > 0)
    .sort((a, b) => b.cierres - a.cierres);
}

// ── Reunión diaria y metas ────────────────────────────────────────────
export type ReunionDiaria = {
  periodo: string;
  metaMes: number;
  acumulado: number;
  brecha: number;
  avancePct: number;
  ritmoDiario: number;
  diasHabilesRestantes: number;
  clientesCalientes: number;
  cierresAyer: number;
  cierresMes: number;
};

export function calcularReunionDiaria(
  leads: Lead[],
  metaMes: number,
  periodo: string = periodoActual(),
): ReunionDiaria {
  const ganadosMes = leads.filter(
    (l) => l.estado === 'ganado' && mismoPeriodo(l.fecha_cierre, periodo),
  );
  const acumulado = ganadosMes.reduce((s, l) => s + montoLead(l), 0);
  const brecha = Math.max(0, metaMes - acumulado);
  const dias = diasHabilesRestantes();
  const calientes = leads.filter(
    (l) => !l.archivado && temperaturaDeLead(l) === 'caliente',
  ).length;
  const cierresAyer = leads.filter(
    (l) => l.estado === 'ganado' && esAyer(l.fecha_cierre),
  ).length;
  return {
    periodo,
    metaMes,
    acumulado,
    brecha,
    avancePct: metaMes > 0 ? (acumulado / metaMes) * 100 : 0,
    ritmoDiario: dias > 0 ? brecha / dias : brecha,
    diasHabilesRestantes: dias,
    clientesCalientes: calientes,
    cierresAyer,
    cierresMes: ganadosMes.length,
  };
}

export type ProgresoVendedora = {
  vendedoraId: string;
  nombre: string;
  meta: number;
  vendido: number;
  avancePct: number;
  aportePct: number; // vendido / meta global del mes * 100
  cierres: number;
  calientes: number;
};

export function calcularProgresoVendedoras(
  leads: Lead[],
  vendedoras: Array<{ id: string; nombre: string }>,
  metasPorVendedora: Record<string, number>,
  periodo: string = periodoActual(),
): ProgresoVendedora[] {
  const metaGlobal = Object.values(metasPorVendedora).reduce((s, n) => s + n, 0);
  return vendedoras
    .map((v) => {
      const propios = leads.filter((l) => l.asignado_a === v.id);
      const ganadosMes = propios.filter(
        (l) => l.estado === 'ganado' && mismoPeriodo(l.fecha_cierre, periodo),
      );
      const vendido = ganadosMes.reduce((s, l) => s + montoLead(l), 0);
      const meta = metasPorVendedora[v.id] ?? 0;
      const calientes = propios.filter(
        (l) => !l.archivado && temperaturaDeLead(l) === 'caliente',
      ).length;
      return {
        vendedoraId: v.id,
        nombre: v.nombre,
        meta,
        vendido,
        avancePct: meta > 0 ? (vendido / meta) * 100 : 0,
        aportePct: metaGlobal > 0 ? (vendido / metaGlobal) * 100 : 0,
        cierres: ganadosMes.length,
        calientes,
      };
    })
    .filter((p) => p.meta > 0 || p.vendido > 0)
    .sort((a, b) => b.vendido - a.vendido);
}

// ── Hook: metas + leads para reunión diaria (mes actual, sin filtro de rango) ──
export function useMetasReunion(periodo: string = periodoActual()) {
  const { empresaId } = useAuth();
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const [{ data: metasData }, { data: leadsData }] = await Promise.all([
      supabase
        .from('metas_vendedora' as any)
        .select('vendedora_id, monto_meta')
        .eq('empresa_id', empresaId)
        .eq('periodo', periodo),
      supabase.from('leads' as any).select('*').eq('empresa_id', empresaId),
    ]);
    const map: Record<string, number> = {};
    ((metasData || []) as unknown as Array<{ vendedora_id: string; monto_meta: number }>).forEach((m) => {
      map[String(m.vendedora_id)] = Number(m.monto_meta) || 0;
    });
    setMetas(map);
    setLeads(((leadsData || []) as unknown) as Lead[]);
    setLoading(false);
  }, [empresaId, periodo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarMeta = useCallback(
    async (vendedoraId: string, monto: number) => {
      if (!empresaId) return;
      const { error } = await supabase.from('metas_vendedora' as any).upsert(
        {
          empresa_id: empresaId,
          vendedora_id: vendedoraId,
          periodo,
          monto_meta: monto,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'empresa_id,vendedora_id,periodo' },
      );
      if (error) throw new Error(error.message);
      setMetas((prev) => ({ ...prev, [vendedoraId]: monto }));
    },
    [empresaId, periodo],
  );

  return { metas, leads, loading, periodo, refrescar: cargar, guardarMeta };
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
    tiempos: calcularTiemposPorEtapa(actividad),
    porVendedora: calcularPorVendedora(filtrados, actividad, vendedoras),
    embudoAsesora: calcularEmbudoPorAsesora(filtrados, vendedoras),
    tendencia: calcularTendenciaSemanal(filtrados, actividad),
    temperatura: calcularPorTemperatura(filtrados),
    flujoTemperatura: calcularFlujoTemperaturaSemanal(filtrados, actividad),
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
