// ─────────────────────────────────────────────────────────────────────
// Colores de los chips de categoría del catálogo (Fase 0), editables por
// empresa. Se guarda un mapa chipId → color hex en `configuracion`
// (clave 'chips_catalogo_colores'); los chips sin override usan sus clases
// Tailwind por defecto.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export const CLAVE_CHIPS_COLORES = 'chips_catalogo_colores';

export type ChipsColores = Record<string, string>; // chipId → '#rrggbb'

// Las dos funciones de color son puras y las necesita también el generador del
// PDF, que se carga aparte y no debe arrastrar React ni Supabase. Viven en
// `coloresFila.ts` y se re-exportan acá para no tocar a quien ya las importaba.
// El `export {...} from` no crea binding local, así que además se importan: este
// módulo usa `esHexValido` más abajo.
export { esHexValido, estiloChipHex } from './coloresFila';
import { esHexValido } from './coloresFila';

export async function guardarChipsColores(
  empresaId: string,
  colores: ChipsColores,
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_CHIPS_COLORES, valor: JSON.stringify(colores) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

/** Hook: overrides de color de los chips de la empresa actual. */
export function useChipsColores(): {
  colores: ChipsColores;
  guardar: (nuevos: ChipsColores) => Promise<void>;
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const [colores, setColores] = useState<ChipsColores>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) {
      setColores({});
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
          .eq('clave', CLAVE_CHIPS_COLORES)
          .maybeSingle<{ valor: string }>();
        if (data?.valor) {
          const raw = JSON.parse(data.valor) as Record<string, unknown>;
          const limpio: ChipsColores = {};
          for (const [k, v] of Object.entries(raw || {})) if (esHexValido(v)) limpio[k] = v;
          setColores(limpio);
        } else {
          setColores({});
        }
      } catch {
        setColores({});
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId]);

  const guardar = async (nuevos: ChipsColores) => {
    if (!empresaId) return;
    await guardarChipsColores(empresaId, nuevos);
    setColores(nuevos);
  };

  return { colores, guardar, loading };
}
