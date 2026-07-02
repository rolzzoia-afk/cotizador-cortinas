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

/** ¿Es un color hex válido (#rgb o #rrggbb)? */
export function esHexValido(s: unknown): s is string {
  return typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
}

/**
 * Estilo inline para un chip a partir de su color de fondo: texto negro o
 * blanco según luminancia, borde un poco más oscuro que el fondo.
 */
export function estiloChipHex(hex: string): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const dark = (n: number) => Math.max(0, Math.round(n * 0.72));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return {
    backgroundColor: `#${full.toLowerCase()}`,
    color: lum > 150 ? '#1c1917' : '#ffffff',
    borderColor: `#${toHex(dark(r))}${toHex(dark(g))}${toHex(dark(b))}`,
  };
}

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
