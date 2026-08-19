// Persistencia de las introducciones de pasos de luz del informe, editadas en
// Admin. Mismo patrón que `bloquesInformeStore.ts`: una clave JSON en
// `configuracion`. La lógica pura vive en `introsInforme.ts`.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  INTROS_INFORME_DEFAULT,
  normalizarIntrosInforme,
  type IntrosInforme,
} from './introsInforme';

export const CLAVE_INTROS_INFORME = 'informe_visita_intros';

export async function cargarIntrosInforme(empresaId: string): Promise<IntrosInforme> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_INTROS_INFORME)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Informe visita] Error cargando intros, se usan las de fábrica:', error.message);
    return INTROS_INFORME_DEFAULT;
  }
  if (!data?.valor) return INTROS_INFORME_DEFAULT;
  try {
    return normalizarIntrosInforme(JSON.parse(data.valor));
  } catch {
    return INTROS_INFORME_DEFAULT;
  }
}

export async function guardarIntrosInforme(
  empresaId: string,
  intros: IntrosInforme,
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    {
      empresa_id: empresaId,
      clave: CLAVE_INTROS_INFORME,
      valor: JSON.stringify(normalizarIntrosInforme(intros)),
    },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

export function useIntrosInforme(): {
  intros: IntrosInforme;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [intros, setIntros] = useState<IntrosInforme>(INTROS_INFORME_DEFAULT);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setIntros(INTROS_INFORME_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setIntros(await cargarIntrosInforme(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { intros, loading, refresh: cargar };
}
