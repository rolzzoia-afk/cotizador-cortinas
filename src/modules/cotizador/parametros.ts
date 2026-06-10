// ─────────────────────────────────────────────────────────────────────
// Parámetros comerciales del cotizador, configurables POR EMPRESA.
//
// Fuente: tabla `configuracion`, clave 'parametros_cotizador' (JSON).
// Si la empresa no tiene valores guardados se usan los defaults
// históricos de Rolzzo (preciosFase0.ts). Editable desde el panel
// Admin → "Parámetros de cotización".
//
// El tipo y los defaults viven en preciosFase0.ts (módulo puro, sin
// React/Supabase) para que el motor y sus tests no dependan de este
// archivo. Aquí solo está la carga/guardado y el hook.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PARAMETROS_DEFAULT, type ParametrosCotizador } from './preciosFase0';

export { PARAMETROS_DEFAULT, type ParametrosCotizador };

export const CLAVE_PARAMETROS = 'parametros_cotizador';

/** Mezcla lo guardado con los defaults, ignorando valores no numéricos. */
export function normalizarParametros(raw: unknown): ParametrosCotizador {
  const out: ParametrosCotizador = { ...PARAMETROS_DEFAULT };
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(PARAMETROS_DEFAULT) as (keyof ParametrosCotizador)[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    }
  }
  // margenInsumo = 0 dividiría por cero.
  if (out.margenInsumo <= 0) out.margenInsumo = PARAMETROS_DEFAULT.margenInsumo;
  return out;
}

export async function cargarParametros(empresaId: string): Promise<ParametrosCotizador> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_PARAMETROS)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Parámetros] Error cargando, usando defaults:', error.message);
    return { ...PARAMETROS_DEFAULT };
  }
  if (!data?.valor) return { ...PARAMETROS_DEFAULT };
  try {
    return normalizarParametros(JSON.parse(data.valor));
  } catch {
    return { ...PARAMETROS_DEFAULT };
  }
}

export async function guardarParametros(
  empresaId: string,
  params: ParametrosCotizador,
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_PARAMETROS, valor: JSON.stringify(params) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

/** Hook: parámetros del cotizador de la empresa actual. */
export function useParametrosCotizador(): {
  parametros: ParametrosCotizador;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [parametros, setParametros] = useState<ParametrosCotizador>({ ...PARAMETROS_DEFAULT });
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    if (!empresaId) {
      setParametros({ ...PARAMETROS_DEFAULT });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setParametros(await cargarParametros(empresaId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  return { parametros, loading, refresh: cargar };
}
