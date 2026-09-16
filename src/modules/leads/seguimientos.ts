// ──────────────────────────────────────────────────────────────────────────
// Motor de seguimientos — acciones contra la base.
//
// La lógica pura (cadencia 1-2-3, bandeja, prioridad sugerida, medios y
// respuestas rápidas) vive en `cadencia.ts` y se re-exporta acá para que los
// imports de siempre sigan funcionando.
// ──────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase';
import type { Lead, Medio, Prioridad } from './types';
import { editarLead } from './leadsRpc';

export {
  fechaProximoSeguimiento,
  infoSeguimiento,
  bandejaSeguimientos,
  resumenBandeja,
  prioridadSugerida,
  seguimientosPorLead,
  URGENCIA_LABEL,
  MEDIOS,
  MEDIO_LABEL,
  MEDIO_EXCEL,
  RESPUESTAS_RAPIDAS,
  type Urgencia,
  type SeguimientoInfo,
  type ResumenBandeja,
  type RespuestaRapida,
} from './cadencia';

/**
 * Registra un seguimiento con su medio. Si hay una etapa pendiente (1-3)
 * avanza la cadencia; si no, lo anota igual como seguimiento extra.
 */
export async function registrarSeguimiento(
  leadId: string,
  resultado: string,
  nota?: string | null,
  medio?: Medio | null,
): Promise<Lead> {
  const { data, error } = await supabase.rpc('registrar_seguimiento', {
    p_lead_id: leadId,
    p_resultado: resultado,
    p_nota: nota?.trim() || undefined,
    p_medio: medio ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Lead;
}

/** Archiva los leads cotizados sin respuesta cuyo día +8 ya pasó. Devuelve cuántos. */
export async function archivarSeguimientosVencidos(empresaId: string): Promise<number> {
  const { data, error } = await supabase.rpc('archivar_seguimientos_vencidos', {
    p_empresa_id: empresaId,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Actualiza prioridad y/o detalle personal (el "CONECTOR") de un lead. Queda en el historial. */
export async function actualizarPrioridadDetalle(
  leadId: string,
  patch: { prioridad?: Prioridad; detalle_personal?: string | null },
): Promise<void> {
  await editarLead(leadId, patch);
}
