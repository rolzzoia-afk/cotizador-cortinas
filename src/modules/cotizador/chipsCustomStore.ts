// Persistencia de las categorías PROPIAS del catálogo. Mismo par que
// `chipsColores.ts` / `chipsCustom.ts`: la lógica pura vive en el módulo y acá
// solo está el viaje a `configuracion`.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { CLAVE_CHIPS_CUSTOM, saneaChipsCustom, type ChipCustom } from './chipsCustom';

/**
 * Evento que avisa que las categorías propias cambiaron. Cada `useChipsCustom`
 * tiene su propia copia, así que sin esto una categoría creada desde el
 * asistente no aparecía en la fila de chips de Fase 1 hasta recargar la página.
 * Mismo mecanismo que `rolzzo:reglas-precios`.
 */
const EVENTO_CAMBIO = 'rolzzo:chips-custom';

export async function guardarChipsCustom(
  empresaId: string,
  chips: ChipCustom[],
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_CHIPS_CUSTOM, valor: JSON.stringify(chips) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO));
}

/** Hook: categorías propias de la empresa actual. */
export function useChipsCustom(): {
  chips: ChipCustom[];
  guardar: (nuevos: ChipCustom[]) => Promise<void>;
  refresh: () => void;
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const [chips, setChips] = useState<ChipCustom[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!empresaId) {
      setChips([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('empresa_id', empresaId)
          .eq('clave', CLAVE_CHIPS_CUSTOM)
          .maybeSingle<{ valor: string }>();
        setChips(data?.valor ? saneaChipsCustom(JSON.parse(data.valor)) : []);
      } catch {
        setChips([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId, version]);

  // Otra sección de la misma pestaña guardó: se relee en vez de quedarse con la
  // copia vieja.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener(EVENTO_CAMBIO, refresh);
    return () => window.removeEventListener(EVENTO_CAMBIO, refresh);
  }, [refresh]);

  const guardar = async (nuevos: ChipCustom[]) => {
    if (!empresaId) return;
    const limpios = saneaChipsCustom(nuevos);
    await guardarChipsCustom(empresaId, limpios);
    setChips(limpios);
  };

  return { chips, guardar, refresh, loading };
}
