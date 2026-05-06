// Capa 3 anti-huérfanos: hook de monitoreo de planes_corte sin eventos.
// La RPC detectar_planes_huerfanos solo lee. Si la lista cambia (nuevo plan
// huérfano detectado o uno resuelto), el polling de 60s lo refresca.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export type PlanHuerfano = {
  plan_id: string;
  fecha: string;
  ots: string[];
  n_resultados: number;
  age_hours: number;
  optimizer_email: string | null;
};

const POLL_INTERVAL_MS = 60_000;
const VENTANA_DIAS = 7;

export function usePlanesHuerfanos(): {
  planes: PlanHuerfano[];
  loading: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [planes, setPlanes] = useState<PlanHuerfano[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setError(null);
    const { data, error: rpcError } = await (supabase.rpc as any)(
      'detectar_planes_huerfanos',
      { p_empresa_id: empresaId, p_dias: VENTANA_DIAS },
    );
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setPlanes((data ?? []) as PlanHuerfano[]);
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        await cargar();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const timer = setInterval(cargar, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [empresaId, cargar]);

  return { planes, loading, error, refrescar: cargar };
}
