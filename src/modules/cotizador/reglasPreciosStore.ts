// Persistencia de las reglas de precio editadas en Admin → Precios. Mismo
// patrón que `reglasSeleccionStore.ts`: una clave JSON en `configuracion`, con
// respaldos. La lógica pura vive en `reglasPrecios.ts`.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  REGLAS_PRECIOS_DEFAULT,
  normalizarReglasPrecios,
  validarReglasPrecios,
  type ReglasPrecios,
} from './reglasPrecios';

export const CLAVE_REGLAS_PRECIOS = 'reglas_precios';
export const CLAVE_REGLAS_PRECIOS_RESPALDOS = 'reglas_precios_respaldos';

/** Cuántas fotos de las reglas se conservan. */
export const MAX_RESPALDOS_PRECIOS = 10;

export type RespaldoPrecios = {
  fecha: string;
  motivo: string;
  reglas: ReglasPrecios;
};

export async function cargarReglasPrecios(empresaId: string): Promise<ReglasPrecios> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_REGLAS_PRECIOS)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Precios] Error cargando, se usan los de fábrica:', error.message);
    return REGLAS_PRECIOS_DEFAULT;
  }
  if (!data?.valor) return REGLAS_PRECIOS_DEFAULT;
  try {
    const reglas = normalizarReglasPrecios(JSON.parse(data.valor));
    // Lo guardado puede haber quedado inconsistente (p.ej. se borró un insumo
    // que una receta todavía nombra). No se bloquea el cotizador, pero queda el
    // rastro en consola.
    const { errores } = validarReglasPrecios(reglas);
    for (const e of errores) console.warn('[Precios guardados]', e);
    return reglas;
  } catch {
    return REGLAS_PRECIOS_DEFAULT;
  }
}

export async function guardarReglasPrecios(
  empresaId: string,
  reglas: ReglasPrecios,
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_REGLAS_PRECIOS, valor: JSON.stringify(reglas) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

export async function cargarRespaldosPrecios(empresaId: string): Promise<RespaldoPrecios[]> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_REGLAS_PRECIOS_RESPALDOS)
    .maybeSingle<{ valor: string }>();
  if (error || !data?.valor) return [];
  try {
    const crudo = JSON.parse(data.valor);
    if (!Array.isArray(crudo)) return [];
    return crudo
      .filter((r) => r && typeof r === 'object' && typeof r.fecha === 'string')
      .slice(0, MAX_RESPALDOS_PRECIOS)
      .map((r) => ({
        fecha: r.fecha as string,
        motivo: (r.motivo as string) || '',
        reglas: normalizarReglasPrecios(r.reglas),
      }));
  } catch {
    return [];
  }
}

/**
 * Guarda una foto de los precios antes de tocarlos. Nunca lanza: un respaldo
 * que falla no puede impedir que el admin guarde su cambio.
 */
export async function respaldarReglasPrecios(
  empresaId: string,
  reglas: ReglasPrecios,
  motivo: string,
): Promise<void> {
  try {
    const previos = await cargarRespaldosPrecios(empresaId);
    const lista = [{ fecha: new Date().toISOString(), motivo, reglas }, ...previos].slice(
      0,
      MAX_RESPALDOS_PRECIOS,
    );
    await supabase.from('configuracion').upsert(
      {
        empresa_id: empresaId,
        clave: CLAVE_REGLAS_PRECIOS_RESPALDOS,
        valor: JSON.stringify(lista),
      },
      { onConflict: 'empresa_id,clave' },
    );
  } catch (e) {
    console.warn('[Precios] No se pudo guardar el respaldo:', e);
  }
}

/**
 * Hook de las reglas de precio de la empresa. `loading` importa: mientras carga
 * se devuelven las de fábrica, así que quien COTIZA para guardar debe esperar
 * (si no, una cotización quedaría guardada con precios que no son los suyos).
 */
export function useReglasPrecios(): {
  reglas: ReglasPrecios;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [reglas, setReglas] = useState<ReglasPrecios>(REGLAS_PRECIOS_DEFAULT);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setReglas(REGLAS_PRECIOS_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setReglas(await cargarReglasPrecios(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { reglas, loading, refresh: cargar };
}
