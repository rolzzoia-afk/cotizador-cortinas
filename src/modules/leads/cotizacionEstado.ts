// ──────────────────────────────────────────────────────────────────────────
// Estado de la COTIZACIÓN — qué pasa con el documento que se le manda al
// cliente. Es distinto del estado del cliente (Nuevo … Ganado / Perdido):
//
//   Sin enviar      → todavía no sale.
//   Enviada         → se le mandó: arranca el seguimiento 1-2-3.
//   Por actualizar  → hay que cambiarla y volver a mandarla (tarea pendiente
//                     para quien cotiza; la fila queda resaltada).
//   Actualizada     → se volvió a mandar con los cambios: cuenta una versión
//                     más (v2, v3…) y reinicia la cadencia.
//
// Cada cambio pasa por la RPC `lead_cotizacion_estado` (`leadsRpc.ts`), que
// deja en el historial qué cambió, la nota y QUIÉN lo hizo. Mover la OT a
// «Esperando confirmación» en el Panel equivale a marcarla Enviada.
//
// Módulo puro: sin Supabase, para que las pruebas corran en el CI.
// ──────────────────────────────────────────────────────────────────────────
import type { EstadoCotizacion, Lead } from './types';

export const ESTADOS_COTIZACION: EstadoCotizacion[] = [
  'sin_enviar',
  'enviada',
  'por_actualizar',
  'actualizada',
];

export const ESTADO_COTIZACION_LABEL: Record<EstadoCotizacion, string> = {
  sin_enviar: 'Sin enviar',
  enviada: 'Enviada',
  por_actualizar: 'Por actualizar',
  actualizada: 'Actualizada',
};

/** Así lo escribe el Excel del equipo. */
export const ESTADO_COTIZACION_EXCEL: Record<EstadoCotizacion, string> = {
  sin_enviar: 'SIN ENVIAR',
  enviada: 'ENVIADA',
  por_actualizar: 'POR ACTUALIZAR',
  actualizada: 'ACTUALIZADA',
};

export const ESTADO_COTIZACION_TONO: Record<EstadoCotizacion, 'neutral' | 'progress' | 'warn' | 'success'> = {
  sin_enviar: 'neutral',
  enviada: 'progress',
  por_actualizar: 'warn',
  actualizada: 'success',
};

export type OpcionEstadoCotizacion = {
  estado: EstadoCotizacion;
  texto: string;
  ayuda: string;
  /** Muestra un campo para anotar qué hay que cambiar. */
  pideNota: boolean;
  /** Pide confirmación antes (deshace un envío). */
  confirma: boolean;
};

/**
 * Qué ofrece el botón según el estado actual. Nunca ofrece quedarse igual,
 * salvo «volver a enviar» una ya actualizada (cuenta otra versión).
 */
export function opcionesEstadoCotizacion(actual: EstadoCotizacion): OpcionEstadoCotizacion[] {
  const out: OpcionEstadoCotizacion[] = [];
  if (actual === 'sin_enviar') {
    out.push({
      estado: 'enviada',
      texto: 'Marcar enviada',
      ayuda: 'Se le mandó al cliente: arranca el seguimiento 1-2-3.',
      pideNota: false,
      confirma: false,
    });
  }
  if (actual !== 'por_actualizar') {
    out.push({
      estado: 'por_actualizar',
      texto: 'Marcar por actualizar',
      ayuda: 'Queda como tarea: hay que cambiarla y volver a mandarla.',
      pideNota: true,
      confirma: false,
    });
  }
  if (actual !== 'sin_enviar') {
    out.push({
      estado: 'actualizada',
      texto: actual === 'actualizada' ? 'Volver a enviar actualizada' : 'Marcar actualizada',
      ayuda: 'Se mandó con los cambios: cuenta una versión más y reinicia el seguimiento.',
      pideNota: false,
      confirma: false,
    });
    out.push({
      estado: 'sin_enviar',
      texto: 'Volver a «Sin enviar»',
      ayuda: 'Solo si se marcó por error.',
      pideNota: false,
      confirma: true,
    });
  }
  return out;
}

/** «Enviada», «Actualizada · v3». */
export function textoEstadoCotizacion(
  lead: Pick<Lead, 'estado_cotizacion' | 'cotizacion_version'>,
): string {
  const base = ESTADO_COTIZACION_LABEL[lead.estado_cotizacion] ?? lead.estado_cotizacion;
  return lead.cotizacion_version > 1 ? `${base} · v${lead.cotizacion_version}` : base;
}

/** Cuántas cotizaciones esperan que alguien las actualice. */
export function contarPorActualizar(
  leads: Pick<Lead, 'estado_cotizacion' | 'asignado_a'>[],
  vendedoraId?: string | null,
): number {
  return leads.filter(
    (l) =>
      l.estado_cotizacion === 'por_actualizar' && (!vendedoraId || l.asignado_a === vendedoraId),
  ).length;
}
