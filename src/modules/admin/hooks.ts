import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Tela, TelaInput } from './types';

// ── Hook: Telas (inventario del panel Ojo de Dios) ──────────────────────────
// Lee tabla `telas` + realtime. Filtra por empresa_id.
type TelaRow = {
  id: string;
  codigo: string;
  nombre: string;
  ancho_m: number | null;
  metros_disponibles: number | null;
  alerta_minimo: number | null;
  fecha_actualizacion: string | null;
};

function rowToTela(r: TelaRow): Tela {
  return {
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    ancho_m: r.ancho_m,
    metros_disponibles: Number(r.metros_disponibles ?? 0),
    alerta_minimo: Number(r.alerta_minimo ?? 10),
    fechaActualizacion: r.fecha_actualizacion,
  };
}

export function useTelas(): {
  telas: Tela[];
  loading: boolean;
  guardar: (input: TelaInput) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [telas, setTelas] = useState<Tela[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('telas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('codigo');
      if (!error && data) {
        setTelas((data as TelaRow[]).map(rowToTela));
      }
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!empresaId) return;
    // Channel name único por mount: en React StrictMode el efecto corre 2x;
    // si reutilizamos el mismo nombre, el segundo .on() después del primer
    // .subscribe() tira "cannot add postgres_changes callbacks after subscribe()".
    const channelName = `telas-realtime-${crypto.randomUUID()}`;
    const ch = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'telas',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => cargar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId, cargar]);

  const guardar = useCallback(
    async (input: TelaInput) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const { error } = await supabase
        .from('telas')
        .upsert(
          {
            empresa_id: empresaId,
            codigo: input.codigo.toUpperCase(),
            nombre: input.nombre,
            ancho_m: input.ancho_m,
            metros_disponibles: input.metros_disponibles,
            alerta_minimo: input.alerta_minimo,
            fecha_actualizacion: new Date().toISOString(),
          },
          { onConflict: 'empresa_id,codigo' },
        );
      if (error) throw error;
    },
    [empresaId],
  );

  const eliminar = useCallback(async (id: string) => {
    const { error } = await supabase.from('telas').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return { telas, loading, guardar, eliminar };
}

// ── Hook: Reconciliación de inventario ──────────────────────────────────────
// Llama a la RPC obtener_reconciliacion_inventario que devuelve counters,
// tendencia diaria y top anomalías en un solo round-trip.
export type ReconciliacionCounters = {
  huerfanos: number;
  huerfanos_7d: number;
  fantasmas: number;
  fantasmas_7d: number;
  perdidos: number;
  perdidos_7d: number;
};

export type ReconciliacionTendenciaDia = {
  dia: string;
  huerfanos: number;
  fantasmas: number;
};

export type ReconciliacionAnomaliaHuerfano = {
  tubo_raiz_id: string;
  n_colmena: string;
  cod: string;
  medida_cm: number;
  created_at: string;
  ot: string | null;
  detalle: string | null;
};

export type ReconciliacionAnomaliaFantasma = {
  tubo_raiz_id: string;
  n_colmena: string;
  cod: string;
  medida_cm: number;
  created_at: string;
};

export type ReconciliacionData = {
  counters: ReconciliacionCounters;
  tendencia: ReconciliacionTendenciaDia[];
  top_huerfanos: ReconciliacionAnomaliaHuerfano[];
  top_fantasmas: ReconciliacionAnomaliaFantasma[];
  generado_en: string;
};

export function useReconciliacion(opts?: { dias?: number; limite?: number }): {
  data: ReconciliacionData | null;
  loading: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
} {
  const dias = opts?.dias ?? 30;
  const limite = opts?.limite ?? 50;
  const [data, setData] = useState<ReconciliacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'obtener_reconciliacion_inventario' as any,
        { p_dias_tendencia: dias, p_limite_anomalias: limite },
      );
      if (rpcError) {
        // PostgrestError no es Error clásico — extraer mensaje + code/hint
        // si existen, sino fallback a JSON. Sin esto la UI mostraba "[object Object]".
        const parts = [rpcError.message, rpcError.code, rpcError.hint, rpcError.details]
          .filter(Boolean)
          .join(' · ');
        throw new Error(parts || JSON.stringify(rpcError));
      }
      setData(rpcData as ReconciliacionData);
    } catch (e) {
      let msg: string;
      if (e instanceof Error) {
        msg = e.message;
      } else if (e && typeof e === 'object' && 'message' in e) {
        msg = String((e as { message: unknown }).message);
      } else {
        msg = JSON.stringify(e);
      }
      // Loggear también a consola con el objeto completo para debug en DevTools.
      console.error('[useReconciliacion] error:', e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dias, limite]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  return { data, loading, error, refrescar };
}

// ── Hook: Versión mínima (control del panel Ojo de Dios) ─────────────────────
// Lee `configuracion.clave='version_minima_version'` con realtime.
export function useVersionMinima(): {
  version: string | null;
  loading: boolean;
  forzarActualizacion: () => Promise<string>;
} {
  const { empresaId } = useAuth();
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('clave', 'version_minima_version')
        .maybeSingle<{ valor: string }>();
      setVersion(data?.valor ?? null);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!empresaId) return;
    // Ver useTelas: channel name único para evitar conflicto en StrictMode.
    const channelName = `version-realtime-${crypto.randomUUID()}`;
    const ch = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'configuracion',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => cargar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId, cargar]);

  const forzarActualizacion = useCallback(async (): Promise<string> => {
    if (!empresaId) throw new Error('Empresa no resuelta');
    const nueva = version
      ? (Math.round((parseFloat(version) + 0.1) * 10) / 10).toFixed(1)
      : '1.0';
    const { error } = await supabase.from('configuracion').upsert(
      {
        empresa_id: empresaId,
        clave: 'version_minima_version',
        valor: nueva,
      },
      { onConflict: 'empresa_id,clave' },
    );
    if (error) throw error;
    return nueva;
  }, [empresaId, version]);

  return { version, loading, forzarActualizacion };
}
