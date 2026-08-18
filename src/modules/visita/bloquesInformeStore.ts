// Persistencia de los bloques fijos del informe de visita, editados en Admin.
// Mismo patrón que `checklistVisitaStore.ts`: una clave JSON en `configuracion`.
// La lógica pura vive en `bloquesInforme.ts`.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  BLOQUES_INFORME_DEFAULT,
  normalizarBloquesInforme,
  type BloquesInforme,
} from './bloquesInforme';

export const CLAVE_BLOQUES_INFORME = 'informe_visita_bloques';

export async function cargarBloquesInforme(empresaId: string): Promise<BloquesInforme> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_BLOQUES_INFORME)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Informe visita] Error cargando bloques, se usan los de fábrica:', error.message);
    return BLOQUES_INFORME_DEFAULT;
  }
  if (!data?.valor) return BLOQUES_INFORME_DEFAULT;
  try {
    return normalizarBloquesInforme(JSON.parse(data.valor));
  } catch {
    return BLOQUES_INFORME_DEFAULT;
  }
}

export async function guardarBloquesInforme(
  empresaId: string,
  bloques: BloquesInforme,
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    {
      empresa_id: empresaId,
      clave: CLAVE_BLOQUES_INFORME,
      valor: JSON.stringify(normalizarBloquesInforme(bloques)),
    },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

export function useBloquesInforme(): {
  bloques: BloquesInforme;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [bloques, setBloques] = useState<BloquesInforme>(BLOQUES_INFORME_DEFAULT);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setBloques(BLOQUES_INFORME_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setBloques(await cargarBloquesInforme(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { bloques, loading, refresh: cargar };
}
