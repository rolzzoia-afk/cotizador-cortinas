// ─────────────────────────────────────────────────────────────────────
// EL NÚMERO DE UNA OT NUEVA.
//
// Dos caminos, y los dos tienen que existir: la vendedora que trae el número
// de su Excel lo teclea, y la que empieza de cero en terreno deja el campo
// vacío y la BD le da el correlativo del mes.
//
// Vivía suelto dentro de Fase 0. Se extrajo cuando «Nueva OT — Terreno» pasó a
// necesitar lo mismo: dos copias de esta validación terminan divergiendo, y el
// día que diverjan una de las dos va a dejar entrar un número repetido.
//
// El puerto existe para poder probar el duplicado y el correlativo sin
// Supabase: la implementación real está al final del archivo.
// ─────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase';

export type PuertoNumeroOT = {
  /** ¿Ya hay una OT de esta empresa con ese número? */
  existeNumero(empresaId: string, numero: string): Promise<boolean>;
  /** El correlativo del periodo (RPC `generar_numero_ot`, formato AAM-N). */
  generarNumero(empresaId: string): Promise<string>;
};

/**
 * Resuelve el folio de una OT nueva: el tecleado (si no está repetido) o el
 * correlativo automático.
 *
 * Lanza `Error` con un mensaje mostrable tal cual al usuario — quien llama solo
 * tiene que pasarlo a un toast.
 */
export async function resolverNumeroOT(
  puerto: PuertoNumeroOT,
  empresaId: string,
  tecleado: string,
): Promise<string> {
  const numero = String(tecleado ?? '').trim();
  if (numero) {
    if (await puerto.existeNumero(empresaId, numero)) {
      throw new Error(
        `Ya existe una OT con el número ${numero}. Usa otro (ej. ${numero}-B) o deja el ` +
          'campo vacío para el correlativo automático.',
      );
    }
    return numero;
  }
  return String((await puerto.generarNumero(empresaId)) ?? '');
}

export const puertoSupabaseNumeroOT: PuertoNumeroOT = {
  async existeNumero(empresaId, numero) {
    const { data, error } = await supabase
      .from('ots')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('numero_ot', numero)
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  },
  async generarNumero(empresaId) {
    const { data, error } = await supabase.rpc('generar_numero_ot' as never, {
      p_empresa_id: empresaId,
    } as never);
    if (error) throw error;
    return String(data ?? '');
  },
};
