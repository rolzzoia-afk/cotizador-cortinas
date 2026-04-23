import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { otToRow, rowToOT } from './mappers';
import type { OT, OTEstado, OTRow, SubEtapaProd } from './types';

// Anti-sobreescritura: si el Realtime llega dentro de los 3s de nuestro último
// write local, lo ignoramos (el servidor está confirmando lo que acabamos de
// escribir). Portado del legacy (_ultimaEscrituraLocalMs).
const WRITE_COOLDOWN_MS = 3000;

export type UseOTs = {
  ots: OT[];
  loading: boolean;
  online: boolean;
  crearOT: (datosGenerales: OT['datosGenerales']) => Promise<OT>;
  moverEstado: (id: string, nuevoEstado: OTEstado) => Promise<void>;
  moverSubEtapa: (id: string, subEtapa: SubEtapaProd) => Promise<void>;
  archivar: (id: string) => Promise<void>;
  restaurar: (id: string) => Promise<void>;
  eliminarDefinitivo: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useOTs(): UseOTs {
  const { empresaId } = useAuth();
  const [ots, setOts] = useState<OT[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const ultimoWriteRef = useRef(0);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ots')
        .select('*')
        .eq('empresa_id', empresaId);
      if (error) throw error;
      const lista = ((data as unknown as OTRow[] | null) || [])
        .map(rowToOT)
        .filter((o) => {
          const dg = o.datosGenerales || {};
          return (dg.cliente || '').trim() || (dg.ot || '').trim();
        });
      setOts(lista);
      setOnline(true);
    } catch (e) {
      console.warn('[OTs] Error al cargar:', e);
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Realtime: INSERT/UPDATE/DELETE sobre `ots` de esta empresa.
  // Channel name único por mount (StrictMode-safe).
  useEffect(() => {
    if (!empresaId) return;
    const channelName = `ots-realtime-${crypto.randomUUID()}`;
    const ch = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'ots',
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload: { eventType: string; new?: OTRow; old?: { id: string } }) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const ot = rowToOT(payload.new);
            const dg = ot.datosGenerales || {};
            if (!(dg.cliente || '').trim() && !(dg.ot || '').trim()) return;
            setOts((prev) => (prev.find((o) => o.id === ot.id) ? prev : [...prev, ot]));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const ot = rowToOT(payload.new);
            const msDesdeWrite = Date.now() - ultimoWriteRef.current;
            if (msDesdeWrite < WRITE_COOLDOWN_MS) return;
            setOts((prev) => {
              const idx = prev.findIndex((o) => o.id === ot.id);
              if (idx < 0) return [...prev, ot];
              const next = [...prev];
              next[idx] = ot;
              return next;
            });
          } else if (payload.eventType === 'DELETE' && payload.old?.id) {
            const delId = payload.old.id;
            setOts((prev) => prev.filter((o) => o.id !== delId));
          }
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setOnline(true);
        else if (status === 'CHANNEL_ERROR') setOnline(false);
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId]);

  const guardarOT = useCallback(
    async (ot: OT) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      ultimoWriteRef.current = Date.now();
      const { error } = await supabase
        .from('ots')
        .upsert(otToRow(ot, empresaId) as unknown as never, { onConflict: 'id' });
      if (error) throw error;
    },
    [empresaId],
  );

  const crearOT: UseOTs['crearOT'] = useCallback(
    async (dg) => {
      const now = new Date().toISOString();
      const ot: OT = {
        id: crypto.randomUUID(),
        estado: 'cotizacion',
        subEtapa: null,
        datosGenerales: dg,
        storeVentanas: [],
        cotizacionCount: 0,
        fechaCreacion: now,
        fechaModificacion: now,
        notas: '',
        totalConIva: 0,
      };
      await guardarOT(ot);
      setOts((prev) => [...prev, ot]);
      return ot;
    },
    [guardarOT],
  );

  const conHistorial = (ot: OT, nuevoEstado: OTEstado): OT => {
    const dg = { ...(ot.datosGenerales || {}) };
    const hist = [...(dg.historialEstados || [])];
    hist.push({ de: ot.estado, a: nuevoEstado, fecha: new Date().toISOString() });
    dg.historialEstados = hist;
    return { ...ot, datosGenerales: dg };
  };

  const moverEstado: UseOTs['moverEstado'] = useCallback(
    async (id, nuevoEstado) => {
      const actual = ots.find((o) => o.id === id);
      if (!actual) return;
      const base = conHistorial(actual, nuevoEstado);
      const actualizada: OT = {
        ...base,
        estado: nuevoEstado,
        subEtapa: nuevoEstado === 'produccion' ? actual.subEtapa || 'Estructura' : null,
        fechaModificacion: new Date().toISOString(),
      };
      setOts((prev) => prev.map((o) => (o.id === id ? actualizada : o)));
      await guardarOT(actualizada);
    },
    [ots, guardarOT],
  );

  const moverSubEtapa: UseOTs['moverSubEtapa'] = useCallback(
    async (id, subEtapa) => {
      const actual = ots.find((o) => o.id === id);
      if (!actual) return;
      const actualizada: OT = {
        ...actual,
        subEtapa,
        fechaModificacion: new Date().toISOString(),
      };
      setOts((prev) => prev.map((o) => (o.id === id ? actualizada : o)));
      await guardarOT(actualizada);
    },
    [ots, guardarOT],
  );

  const archivar: UseOTs['archivar'] = useCallback(
    async (id) => {
      const actual = ots.find((o) => o.id === id);
      if (!actual) return;
      const actualizada: OT = {
        ...actual,
        estado: 'archivada',
        fechaModificacion: new Date().toISOString(),
      };
      setOts((prev) => prev.map((o) => (o.id === id ? actualizada : o)));
      await guardarOT(actualizada);
    },
    [ots, guardarOT],
  );

  const restaurar: UseOTs['restaurar'] = useCallback(
    async (id) => {
      const actual = ots.find((o) => o.id === id);
      if (!actual) return;
      const actualizada: OT = {
        ...actual,
        estado: 'cotizacion',
        fechaModificacion: new Date().toISOString(),
      };
      setOts((prev) => prev.map((o) => (o.id === id ? actualizada : o)));
      await guardarOT(actualizada);
    },
    [ots, guardarOT],
  );

  const eliminarDefinitivo: UseOTs['eliminarDefinitivo'] = useCallback(async (id) => {
    setOts((prev) => prev.filter((o) => o.id !== id));
    const { error } = await supabase.from('ots').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return {
    ots,
    loading,
    online,
    crearOT,
    moverEstado,
    moverSubEtapa,
    archivar,
    restaurar,
    eliminarDefinitivo,
    refresh: cargar,
  };
}

// Hook de una OT específica por ID. Carga directo desde Supabase + permite
// guardar parches parciales. Útil para páginas de Fase 1/3 que editan una OT.
export function useOT(id: string | undefined): {
  ot: OT | null;
  loading: boolean;
  guardar: (patch: Partial<OT>) => Promise<void>;
  guardarCompleto: (ot: OT) => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [ot, setOt] = useState<OT | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !empresaId) {
      setOt(null);
      setLoading(false);
      return;
    }
    let cancelado = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ots')
        .select('*')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .maybeSingle<OTRow>();
      if (!cancelado) {
        if (error) {
          console.warn('[useOT] error:', error);
          setOt(null);
        } else {
          setOt(data ? rowToOT(data) : null);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, empresaId]);

  const guardarCompleto = useCallback(
    async (nueva: OT) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const { error } = await supabase
        .from('ots')
        .upsert(otToRow(nueva, empresaId) as unknown as never, { onConflict: 'id' });
      if (error) throw error;
      setOt(nueva);
    },
    [empresaId],
  );

  const guardar = useCallback(
    async (patch: Partial<OT>) => {
      if (!ot) return;
      const nueva = {
        ...ot,
        ...patch,
        fechaModificacion: new Date().toISOString(),
      } as OT;
      await guardarCompleto(nueva);
    },
    [ot, guardarCompleto],
  );

  return { ot, loading, guardar, guardarCompleto };
}
