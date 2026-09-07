// Persistencia de las categorías PROPIAS del catálogo. Mismo par que
// `chipsColores.ts` / `chipsCustom.ts`: la lógica pura vive en el módulo y acá
// solo está el viaje a `configuracion`.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { CLAVE_CHIPS_CUSTOM, saneaChipsCustom, type ChipCustom } from './chipsCustom';

export async function guardarChipsCustom(
  empresaId: string,
  chips: ChipCustom[],
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_CHIPS_CUSTOM, valor: JSON.stringify(chips) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

/** Hook: categorías propias de la empresa actual. */
export function useChipsCustom(): {
  chips: ChipCustom[];
  guardar: (nuevos: ChipCustom[]) => Promise<void>;
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const [chips, setChips] = useState<ChipCustom[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [empresaId]);

  const guardar = async (nuevos: ChipCustom[]) => {
    if (!empresaId) return;
    const limpios = saneaChipsCustom(nuevos);
    await guardarChipsCustom(empresaId, limpios);
    setChips(limpios);
  };

  return { chips, guardar, loading };
}
