// Respaldos de los TÉRMINOS Y CONDICIONES. Calcado de `catalogoRespaldos.ts`:
// una clave JSON en `configuracion` con las últimas fotos.
//
// Existe por la importación desde planilla: cargar los términos de un .xlsm
// puede REEMPLAZAR los de un grupo entero de una sola vez, y esos textos son
// los que la empresa le manda al cliente. El respaldo se toma dentro de
// `guardarTerminos`, así que cubre por igual al editor y al importador.

import { supabase } from '@/lib/supabase';
import { normalizarTerminos, type ConfigTerminos } from './terminos';

export const CLAVE_TERMINOS_RESPALDOS = 'terminos_respaldos';

/** Cuántas fotos se conservan. */
export const MAX_RESPALDOS_TERMINOS = 10;

export type RespaldoTerminos = {
  fecha: string;
  motivo: string;
  config: ConfigTerminos;
};

/** Deja pasar solo lo que tiene forma de respaldo, y como mucho los últimos 10. */
export function saneaRespaldosTerminos(crudo: unknown): RespaldoTerminos[] {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter(
      (r): r is Record<string, unknown> =>
        !!r && typeof r === 'object' && typeof (r as { fecha?: unknown }).fecha === 'string',
    )
    .slice(0, MAX_RESPALDOS_TERMINOS)
    .map((r) => ({
      fecha: r.fecha as string,
      motivo: typeof r.motivo === 'string' ? r.motivo : '',
      config: normalizarTerminos(r.config),
    }));
}

/** Cuántos términos tiene una foto — lo que se muestra en la lista. */
export const terminosDelRespaldo = (r: RespaldoTerminos): number =>
  r.config.grupos.reduce((s, g) => s + g.terminos.length, 0);

export async function cargarRespaldosTerminos(empresaId: string): Promise<RespaldoTerminos[]> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_TERMINOS_RESPALDOS)
    .maybeSingle<{ valor: string }>();
  if (error || !data?.valor) return [];
  try {
    return saneaRespaldosTerminos(JSON.parse(data.valor));
  } catch {
    return [];
  }
}

/**
 * Guarda una foto de los términos ACTUALES antes de pisarlos. Nunca lanza: un
 * respaldo que falla no puede impedir que se guarde el cambio.
 */
export async function respaldarTerminos(empresaId: string, motivo: string): Promise<void> {
  try {
    const [actual, previos] = await Promise.all([
      supabase
        .from('configuracion')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('clave', 'terminos_condiciones')
        .maybeSingle<{ valor: string }>(),
      cargarRespaldosTerminos(empresaId),
    ]);
    // Sin nada guardado no hay nada que respaldar (empresa recién creada: sus
    // términos son los de fábrica y no se pierden).
    if (!actual.data?.valor) return;
    let config: ConfigTerminos;
    try {
      config = normalizarTerminos(JSON.parse(actual.data.valor));
    } catch {
      return;
    }
    const lista: RespaldoTerminos[] = [
      { fecha: new Date().toISOString(), motivo, config },
      ...previos,
    ].slice(0, MAX_RESPALDOS_TERMINOS);

    await supabase.from('configuracion').upsert(
      { empresa_id: empresaId, clave: CLAVE_TERMINOS_RESPALDOS, valor: JSON.stringify(lista) },
      { onConflict: 'empresa_id,clave' },
    );
  } catch (e) {
    console.warn('[Términos] No se pudo guardar el respaldo:', e);
  }
}
