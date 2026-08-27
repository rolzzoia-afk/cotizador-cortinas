import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

/**
 * Canales de contacto configurados en `kpi_config` — la misma lista que edita
 * el engranaje de /ventas y que ya consumen Leads y el panel KPI. Devuelve []
 * mientras carga o si la empresa todavía no tiene config; quien la usa cae a
 * `CANALES_FALLBACK` a través de `opcionesCanal`.
 */
export function useCanalesContacto(): { canales: string[]; loading: boolean } {
  const { empresaId } = useAuth();
  const [canales, setCanales] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('kpi_config')
        .select('canales')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (!vivo) return;
      setCanales(Array.isArray(data?.canales) ? (data.canales as string[]) : []);
      setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  return { canales, loading };
}
