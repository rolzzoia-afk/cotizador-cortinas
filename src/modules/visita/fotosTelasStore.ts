// Carga las fotos del inventario de telas (`telas_catalogo.foto_url`) para el
// informe de visita. Ver fotosTelas.ts para cómo se elige la foto de cada tela.
import { supabase } from '@/lib/supabase';
import { mapaFotosTelas, type FotosTelas } from './fotosTelas';

/**
 * Código → foto de las telas de la empresa que tienen foto cargada. Si la
 * consulta falla devuelve un mapa vacío: el informe sale sin esas fotos, no
 * se cae.
 */
export async function cargarFotosTelas(empresaId: string): Promise<FotosTelas> {
  const { data, error } = await supabase
    .from('telas_catalogo')
    .select('codigo, foto_url')
    .eq('empresa_id', empresaId)
    .not('foto_url', 'is', null);
  if (error) {
    console.warn('[Informe visita] No se pudieron leer las fotos de las telas:', error.message);
    return {};
  }
  return mapaFotosTelas(data ?? []);
}
