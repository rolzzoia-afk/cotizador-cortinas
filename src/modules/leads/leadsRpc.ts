// ──────────────────────────────────────────────────────────────────────────
// Escrituras de Clientes que dejan rastro en el historial.
//
// Todas pasan por RPC (`sql/20260916_clientes_01_planilla_seguimiento.sql`):
// la base firma cada cambio con `auth.uid()` y guarda qué cambió. Un `update`
// directo a `leads` no deja historial: no usarlo para datos que ve el equipo.
// ──────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type { EstadoCotizacion, Lead, LeadSeguimiento } from './types';

/** Campos que acepta `lead_editar`. Lo demás lo ignora la base. */
export type PatchLead = Partial<
  Pick<
    Lead,
    | 'nombre'
    | 'whatsapp_phone'
    | 'email'
    | 'rut'
    | 'comuna'
    | 'region'
    | 'instagram'
    | 'fuente'
    | 'anuncio'
    | 'mensaje'
    | 'comentarios'
    | 'llamada_por'
    | 'cotizado_por'
    | 'visita_por'
    | 'presupuesto_rango'
    | 'prioridad'
    | 'detalle_personal'
    | 'monto'
  >
>;

/** Edita datos del cliente; deja UNA entrada «Editó …» con de → a y autor. */
export async function editarLead(leadId: string, patch: PatchLead): Promise<Lead> {
  const { data, error } = await supabase.rpc('lead_editar', {
    p_lead_id: leadId,
    p_patch: patch as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Lead;
}

/** Asigna (o quita) la vendedora; queda en el historial con autor. */
export async function asignarLead(leadId: string, perfilId: string | null): Promise<Lead> {
  const { data, error } = await supabase.rpc('lead_asignar', {
    p_lead_id: leadId,
    // La RPC acepta NULL para «sin asignar»; el tipo generado no lo dice.
    p_perfil_id: perfilId as string,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Lead;
}

/** Cambia el estado de la cotización (queda en el historial con nota y autor). */
export async function cambiarEstadoCotizacion(
  leadId: string,
  estado: EstadoCotizacion,
  nota?: string | null,
): Promise<Lead> {
  const { data, error } = await supabase.rpc('lead_cotizacion_estado', {
    p_lead_id: leadId,
    p_estado: estado,
    p_nota: nota?.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Lead;
}

/** id → nombre de todas las personas de la empresa (para firmar el historial). */
export async function cargarNombresPerfiles(): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc('nombres_perfiles_empresa');
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((p) => [String(p.id), String(p.nombre)]));
}

/** Todos los seguimientos de la empresa, en UNA consulta (nunca `.in()` con cientos de ids). */
export async function cargarSeguimientosEmpresa(empresaId: string): Promise<LeadSeguimiento[]> {
  const { data, error } = await supabase
    .from('leads_seguimientos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('fecha', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeadSeguimiento[];
}
