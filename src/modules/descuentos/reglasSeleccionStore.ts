// Persistencia de las reglas de selección (tuberías y mecanismos) editadas en
// Admin → Catálogo técnico. Mismo patrón que `formulasStore.ts`: una clave JSON
// en `configuracion`. La lógica pura vive en `reglasSeleccion.ts`.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  REGLAS_SELECCION_DEFAULT,
  normalizarReglasSeleccion,
  validarReglasSeleccion,
  type ReglasSeleccion,
} from './reglasSeleccion';

export const CLAVE_REGLAS_SELECCION = 'reglas_seleccion';
export const CLAVE_REGLAS_SELECCION_RESPALDOS = 'reglas_seleccion_respaldos';

/** Cuántas fotos de las reglas se conservan. */
export const MAX_RESPALDOS_REGLAS = 10;

export type RespaldoReglas = {
  fecha: string;
  motivo: string;
  reglas: ReglasSeleccion;
};

export async function cargarReglasSeleccion(empresaId: string): Promise<ReglasSeleccion> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_REGLAS_SELECCION)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Reglas] Error cargando, se usan las de fábrica:', error.message);
    return REGLAS_SELECCION_DEFAULT;
  }
  if (!data?.valor) return REGLAS_SELECCION_DEFAULT;
  try {
    const reglas = normalizarReglasSeleccion(JSON.parse(data.valor));
    // Las reglas guardadas pueden haber quedado inconsistentes (p.ej. se borró
    // un tubo que una regla todavía nombra). No se bloquea el cotizador —cada
    // evaluador tiene su propio fail-open— pero queda el rastro en consola.
    const { errores } = validarReglasSeleccion(reglas);
    for (const e of errores) console.warn('[Reglas guardadas]', e);
    return reglas;
  } catch {
    return REGLAS_SELECCION_DEFAULT;
  }
}

export async function guardarReglasSeleccion(
  empresaId: string,
  reglas: ReglasSeleccion,
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_REGLAS_SELECCION, valor: JSON.stringify(reglas) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

export async function cargarRespaldosReglas(empresaId: string): Promise<RespaldoReglas[]> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_REGLAS_SELECCION_RESPALDOS)
    .maybeSingle<{ valor: string }>();
  if (error || !data?.valor) return [];
  try {
    const crudo = JSON.parse(data.valor);
    if (!Array.isArray(crudo)) return [];
    return crudo
      .filter((r) => r && typeof r === 'object' && typeof r.fecha === 'string')
      .slice(0, MAX_RESPALDOS_REGLAS)
      .map((r) => ({
        fecha: r.fecha as string,
        motivo: (r.motivo as string) || '',
        reglas: normalizarReglasSeleccion(r.reglas),
      }));
  } catch {
    return [];
  }
}

/**
 * Guarda una foto de las reglas antes de tocarlas. Nunca lanza: un respaldo que
 * falla no puede impedir que el admin guarde su cambio.
 */
export async function respaldarReglasSeleccion(
  empresaId: string,
  reglas: ReglasSeleccion,
  motivo: string,
): Promise<void> {
  try {
    const previos = await cargarRespaldosReglas(empresaId);
    const lista = [{ fecha: new Date().toISOString(), motivo, reglas }, ...previos].slice(
      0,
      MAX_RESPALDOS_REGLAS,
    );
    await supabase.from('configuracion').upsert(
      {
        empresa_id: empresaId,
        clave: CLAVE_REGLAS_SELECCION_RESPALDOS,
        valor: JSON.stringify(lista),
      },
      { onConflict: 'empresa_id,clave' },
    );
  } catch (e) {
    console.warn('[Reglas] No se pudo guardar el respaldo:', e);
  }
}

/**
 * Hook de las reglas de la empresa. `loading` importa: mientras carga se
 * devuelven las de fábrica, así que quien CALCULA o GUARDA chips para
 * producción debe esperar (Fase 0/2/4 lo hacen).
 */
export function useReglasSeleccion(): {
  reglas: ReglasSeleccion;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [reglas, setReglas] = useState<ReglasSeleccion>(REGLAS_SELECCION_DEFAULT);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setReglas(REGLAS_SELECCION_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setReglas(await cargarReglasSeleccion(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { reglas, loading, refresh: cargar };
}
