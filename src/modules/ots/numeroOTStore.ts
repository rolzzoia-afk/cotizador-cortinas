// El puerto de `numeroOT.ts` contra la BD real: la consulta de duplicado y la
// RPC del correlativo. Separado del módulo puro a propósito — importar el
// cliente de Supabase exige las variables de entorno, y eso haría que los tests
// de la lógica de folio no pudieran correr sin ellas.
import { supabase } from '@/lib/supabase';
import type { PuertoNumeroOT } from './numeroOT';

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
