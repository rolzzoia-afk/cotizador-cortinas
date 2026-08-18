// Persistencia del resumen de visita editado en Admin. Mismo patrón que
// `reglasSeleccionStore.ts`: una clave JSON en `configuracion`. La lógica pura
// vive en `checklistVisita.ts`.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  CHECKLIST_VISITA_DEFAULT,
  normalizarChecklistVisita,
  type ChecklistVisita,
} from './checklistVisita';

export const CLAVE_CHECKLIST_VISITA = 'checklist_visita';

export async function cargarChecklistVisita(empresaId: string): Promise<ChecklistVisita> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_CHECKLIST_VISITA)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Checklist visita] Error cargando, se usa el de fábrica:', error.message);
    return CHECKLIST_VISITA_DEFAULT;
  }
  if (!data?.valor) return CHECKLIST_VISITA_DEFAULT;
  try {
    return normalizarChecklistVisita(JSON.parse(data.valor));
  } catch {
    return CHECKLIST_VISITA_DEFAULT;
  }
}

export async function guardarChecklistVisita(
  empresaId: string,
  checklist: ChecklistVisita,
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    {
      empresa_id: empresaId,
      clave: CLAVE_CHECKLIST_VISITA,
      valor: JSON.stringify(normalizarChecklistVisita(checklist)),
    },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

export function useChecklistVisita(): {
  checklist: ChecklistVisita;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [checklist, setChecklist] = useState<ChecklistVisita>(CHECKLIST_VISITA_DEFAULT);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setChecklist(CHECKLIST_VISITA_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setChecklist(await cargarChecklistVisita(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { checklist, loading, refresh: cargar };
}
