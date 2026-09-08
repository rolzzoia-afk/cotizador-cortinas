// Persistencia de los TÉRMINOS Y CONDICIONES por empresa.
// Mismo patrón que `parametros.ts`: una clave JSON en la tabla `configuracion`.
// La lógica pura (merge, dedupe, defaults) vive en `terminos.ts` para que el
// motor y sus tests no dependan de Supabase.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TERMINOS_DEFAULT, normalizarTerminos, type ConfigTerminos } from './terminos';
import { respaldarTerminos } from './terminosRespaldos';

export const CLAVE_TERMINOS = 'terminos_condiciones';

export async function cargarTerminos(empresaId: string): Promise<ConfigTerminos> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_TERMINOS)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Términos] Error cargando, usando defaults:', error.message);
    return TERMINOS_DEFAULT;
  }
  if (!data?.valor) return TERMINOS_DEFAULT;
  try {
    return normalizarTerminos(JSON.parse(data.valor));
  } catch {
    return TERMINOS_DEFAULT;
  }
}

export async function guardarTerminos(
  empresaId: string,
  config: ConfigTerminos,
  motivo = 'Guardado desde Admin',
): Promise<void> {
  // Foto de lo que había ANTES: importar desde una planilla puede reemplazar
  // los términos de un grupo entero, y son los que se le mandan al cliente.
  await respaldarTerminos(empresaId, motivo);
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_TERMINOS, valor: JSON.stringify(config) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

/** Hook: términos y condiciones de la empresa actual. */
export function useTerminos(): {
  terminos: ConfigTerminos;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [terminos, setTerminos] = useState<ConfigTerminos>(TERMINOS_DEFAULT);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setTerminos(TERMINOS_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTerminos(await cargarTerminos(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { terminos, loading, refresh: cargar };
}
