// Persistencia de las fórmulas de corte editadas en Admin → Catálogo técnico.
// Mismo patrón que `docCotizacionStore.ts`: una clave JSON en `configuracion`.
// La lógica pura (tipos, defaults, normalizar) vive en `formulasFamilias.ts`.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  FORMULAS_DEFAULT,
  normalizarFormulas,
  type FormulasFamilias,
} from './formulasFamilias';

export const CLAVE_FORMULAS = 'formulas_familias';
export const CLAVE_FORMULAS_RESPALDOS = 'formulas_respaldos';

/** Cuántas fotos del catálogo de fórmulas se conservan. */
export const MAX_RESPALDOS_FORMULAS = 10;

export type RespaldoFormulas = {
  fecha: string;
  motivo: string;
  formulas: FormulasFamilias;
};

export async function cargarFormulas(empresaId: string): Promise<FormulasFamilias> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_FORMULAS)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Fórmulas] Error cargando, se usan las de fábrica:', error.message);
    return FORMULAS_DEFAULT;
  }
  if (!data?.valor) return FORMULAS_DEFAULT;
  try {
    return normalizarFormulas(JSON.parse(data.valor));
  } catch {
    return FORMULAS_DEFAULT;
  }
}

export async function guardarFormulas(empresaId: string, f: FormulasFamilias): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_FORMULAS, valor: JSON.stringify(f) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

export async function cargarRespaldosFormulas(empresaId: string): Promise<RespaldoFormulas[]> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_FORMULAS_RESPALDOS)
    .maybeSingle<{ valor: string }>();
  if (error || !data?.valor) return [];
  try {
    const crudo = JSON.parse(data.valor);
    if (!Array.isArray(crudo)) return [];
    return crudo
      .filter((r) => r && typeof r === 'object' && typeof r.fecha === 'string')
      .slice(0, MAX_RESPALDOS_FORMULAS)
      .map((r) => ({
        fecha: r.fecha as string,
        motivo: (r.motivo as string) || '',
        formulas: normalizarFormulas(r.formulas),
      }));
  } catch {
    return [];
  }
}

/**
 * Guarda una foto de las fórmulas antes de tocarlas. Nunca lanza: un respaldo
 * que falla no puede impedir que el admin guarde su cambio.
 */
export async function respaldarFormulas(
  empresaId: string,
  formulas: FormulasFamilias,
  motivo: string,
): Promise<void> {
  try {
    const previos = await cargarRespaldosFormulas(empresaId);
    const lista = [{ fecha: new Date().toISOString(), motivo, formulas }, ...previos].slice(
      0,
      MAX_RESPALDOS_FORMULAS,
    );
    await supabase.from('configuracion').upsert(
      {
        empresa_id: empresaId,
        clave: CLAVE_FORMULAS_RESPALDOS,
        valor: JSON.stringify(lista),
      },
      { onConflict: 'empresa_id,clave' },
    );
  } catch (e) {
    console.warn('[Fórmulas] No se pudo guardar el respaldo:', e);
  }
}

/**
 * Hook de las fórmulas de la empresa. `loading` importa: mientras carga se
 * devuelven las de fábrica, así que quien CALCULA para producción debe esperar
 * (los documentos de Fase 4 ya lo hacen en su useMemo).
 */
export function useFormulasFamilias(): {
  formulas: FormulasFamilias;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [formulas, setFormulas] = useState<FormulasFamilias>(FORMULAS_DEFAULT);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setFormulas(FORMULAS_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setFormulas(await cargarFormulas(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { formulas, loading, refresh: cargar };
}
