// ──────────────────────────────────────────────────────────────────────────
// Motor de seguimientos — Sistema "Menos Ruido, Más Control"
//
// Regla del manual de seguimiento de ventas:
//   • Seguimiento 1: al día siguiente de enviar la cotización  (cotización + 1 día)
//   • Seguimiento 2: a los 2 días del Seguimiento 1            (incluye el "CONECTOR")
//   • Seguimiento 3: a los 4 días del Seguimiento 2
//   • Si tras el 3º intento no hay respuesta → se archiva (día +8 aprox.)
//
// El ciclo arranca cuando el lead pasa a estado 'cotizado' (la cotización fue
// enviada). El trigger `trg_leads_seguimiento` en la BD setea fecha_cotizacion
// y etapa_seguimiento = 1 en ese momento.
// ──────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase';
import {
  PRIORIDAD_PESO,
  type Lead,
  type Prioridad,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const MS_DIA = 86_400_000;

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DIA);
}

/** Fecha (con hora) del día, normalizada a medianoche local. */
function soloFecha(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Calcula la fecha en que corresponde hacer el seguimiento pendiente.
 * Si las etapas previas se hicieron en fecha, el offset desde la cotización
 * es +1, +3 y +7 días. Si se atrasaron, se cuenta desde la fecha real del
 * seguimiento anterior (fiel al manual: "a los 2 días del seguimiento 1").
 */
export function fechaProximoSeguimiento(lead: Lead): Date | null {
  if (!lead.fecha_cotizacion) return null;
  const etapa = lead.etapa_seguimiento;
  if (etapa < 1 || etapa > 3) return null;

  const cot = new Date(lead.fecha_cotizacion);
  const seg1Due = addDays(cot, 1);
  const seg2Due = addDays(lead.seg1_fecha ? new Date(lead.seg1_fecha) : seg1Due, 2);
  const seg3Due = addDays(lead.seg2_fecha ? new Date(lead.seg2_fecha) : seg2Due, 4);

  return etapa === 1 ? seg1Due : etapa === 2 ? seg2Due : seg3Due;
}

export type Urgencia = 'atrasado' | 'hoy' | 'proximo';

export const URGENCIA_LABEL: Record<Urgencia, string> = {
  atrasado: 'Atrasado',
  hoy: 'Para hoy',
  proximo: 'Próximo',
};

export type SeguimientoInfo = {
  lead: Lead;
  etapa: number; // 1..3
  due: Date;
  urgencia: Urgencia;
  diasDiff: number; // <0 atrasado por N días; 0 hoy; >0 faltan N días
};

/** Devuelve la info de seguimiento de un lead, o null si no aplica. */
export function infoSeguimiento(lead: Lead, hoy: Date = new Date()): SeguimientoInfo | null {
  if (lead.archivado) return null;
  if (lead.estado !== 'cotizado') return null;
  const due = fechaProximoSeguimiento(lead);
  if (!due) return null;

  const diasDiff = Math.round((soloFecha(due) - soloFecha(hoy)) / MS_DIA);
  const urgencia: Urgencia = diasDiff < 0 ? 'atrasado' : diasDiff === 0 ? 'hoy' : 'proximo';
  return { lead, etapa: lead.etapa_seguimiento, due, urgencia, diasDiff };
}

const URGENCIA_PESO: Record<Urgencia, number> = { atrasado: 0, hoy: 1, proximo: 2 };

/**
 * Construye la bandeja de seguimientos: leads cotizados con seguimiento
 * pendiente, ordenados por urgencia → prioridad → fecha.
 */
export function bandejaSeguimientos(
  leads: Lead[],
  opts?: { vendedoraId?: string | null; incluirProximos?: boolean; hoy?: Date },
): SeguimientoInfo[] {
  const hoy = opts?.hoy ?? new Date();
  const out: SeguimientoInfo[] = [];
  for (const l of leads) {
    if (opts?.vendedoraId && l.asignado_a !== opts.vendedoraId) continue;
    const info = infoSeguimiento(l, hoy);
    if (!info) continue;
    if (!opts?.incluirProximos && info.urgencia === 'proximo') continue;
    out.push(info);
  }
  out.sort((a, b) => {
    if (URGENCIA_PESO[a.urgencia] !== URGENCIA_PESO[b.urgencia]) {
      return URGENCIA_PESO[a.urgencia] - URGENCIA_PESO[b.urgencia];
    }
    const pa = PRIORIDAD_PESO[a.lead.prioridad] ?? 1;
    const pb = PRIORIDAD_PESO[b.lead.prioridad] ?? 1;
    if (pa !== pb) return pa - pb;
    return a.due.getTime() - b.due.getTime();
  });
  return out;
}

export type ResumenBandeja = { atrasados: number; hoy: number; proximos: number };

/** Conteos para los chips de resumen de la bandeja. */
export function resumenBandeja(
  leads: Lead[],
  opts?: { vendedoraId?: string | null; hoy?: Date },
): ResumenBandeja {
  const todos = bandejaSeguimientos(leads, { ...opts, incluirProximos: true });
  return {
    atrasados: todos.filter((s) => s.urgencia === 'atrasado').length,
    hoy: todos.filter((s) => s.urgencia === 'hoy').length,
    proximos: todos.filter((s) => s.urgencia === 'proximo').length,
  };
}

/**
 * Sugerencia automática de prioridad a partir de las señales del lead.
 * Parámetros (alineados con la política de prioridad de clientes):
 *   • ALTA: scoring ≥ 70, o presupuesto en los rangos altos, o urgencia alta.
 *   • BAJA: scoring < 40, o presupuesto en el rango más bajo.
 *   • MEDIA: el resto.
 */
export function prioridadSugerida(lead: Pick<Lead,
  'scoring' | 'presupuesto_rango' | 'urgencia'>): Prioridad {
  const pres = lead.presupuesto_rango ?? '';
  const urg = lead.urgencia ?? '';
  if (
    (lead.scoring ?? 0) >= 70 ||
    pres === '$1.500.000 - $3.000.000' ||
    pres === 'Más de $3.000.000' ||
    /alta|urg/i.test(urg)
  ) {
    return 'alta';
  }
  if ((lead.scoring != null && lead.scoring < 40) || pres === 'Menos de $300.000') {
    return 'baja';
  }
  return 'media';
}

// ──────────────────────────────────────────────────────────────────────────
// Acciones contra la base de datos
// ──────────────────────────────────────────────────────────────────────────

/** Registra el resultado del seguimiento pendiente y avanza el ciclo. */
export async function registrarSeguimiento(
  leadId: string,
  resultado: string,
  nota?: string | null,
): Promise<Lead> {
  const { data, error } = await supabase.rpc('registrar_seguimiento' as any, {
    p_lead_id: leadId,
    p_resultado: resultado,
    p_nota: nota ?? null,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Lead;
}

/** Archiva los leads cotizados sin respuesta cuyo día +8 ya pasó. Devuelve cuántos. */
export async function archivarSeguimientosVencidos(empresaId: string): Promise<number> {
  const { data, error } = await supabase.rpc('archivar_seguimientos_vencidos' as any, {
    p_empresa_id: empresaId,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Actualiza prioridad y/o detalle personal (el "CONECTOR") de un lead. */
export async function actualizarPrioridadDetalle(
  leadId: string,
  patch: { prioridad?: Prioridad; detalle_personal?: string | null },
): Promise<void> {
  const row: Record<string, unknown> = { ultima_actividad_at: new Date().toISOString() };
  if (patch.prioridad !== undefined) row.prioridad = patch.prioridad;
  if (patch.detalle_personal !== undefined) {
    row.detalle_personal = patch.detalle_personal?.trim() || null;
  }
  const { error } = await supabase.from('leads' as any).update(row).eq('id', leadId);
  if (error) throw new Error(error.message);
}
