// Lectura y guardado de los interruptores del inventario, con el mismo patrón
// que el resto de las claves de `configuracion` (ver chipsColores).

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  CLAVE_FLAGS_INVENTARIO,
  FLAGS_APAGADOS,
  problemasDeFlags,
  sanearFlags,
  type FlagsInventario,
} from './flags';

export function useFlagsInventario(): {
  flags: FlagsInventario;
  loading: boolean;
  guardar: (nuevos: FlagsInventario) => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [flags, setFlags] = useState<FlagsInventario>(FLAGS_APAGADOS);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setFlags(FLAGS_APAGADOS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('clave', CLAVE_FLAGS_INVENTARIO)
        .maybeSingle<{ valor: string }>();
      setFlags(sanearFlags(data?.valor));
    } catch {
      // Si no se pueden leer, el módulo funciona como hoy. Nunca al revés.
      setFlags(FLAGS_APAGADOS);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async (nuevos: FlagsInventario) => {
    if (!empresaId) return;
    const problemas = problemasDeFlags(nuevos);
    if (problemas.length > 0) throw new Error(problemas[0]);
    const { error } = await supabase.from('configuracion').upsert(
      {
        empresa_id: empresaId,
        clave: CLAVE_FLAGS_INVENTARIO,
        valor: JSON.stringify(nuevos),
      },
      { onConflict: 'empresa_id,clave' },
    );
    if (error) throw error;
    setFlags(nuevos);
  };

  return { flags, loading, guardar };
}
