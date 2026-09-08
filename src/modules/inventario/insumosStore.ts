// La lectura de insumos, sus movimientos, sus ubicaciones y sus validadores.
//
// Vivía dentro de la pantalla de Inventario; se saca acá porque ahora la
// necesitan tres submódulos distintos (Insumos, Kardex y Alertas).
//
// Realtime: el canal lleva un id único por montaje. Con un nombre fijo —como
// estaba— en modo estricto de React el efecto corre dos veces y el segundo
// `.on()` cae después del `.subscribe()`, que Supabase rechaza con «cannot add
// postgres_changes callbacks after subscribe()». El síntoma es una pantalla que
// deja de actualizarse sola, sin ningún error visible.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type {
  Insumo,
  Movimiento,
  UbicacionRack,
  Validador,
} from '@/modules/inventario/helpers';

export type ValidadoresMap = Record<string, string[]>;

export type DatosInsumos = {
  insumos: Insumo[];
  movimientos: Movimiento[];
  ubicaciones: UbicacionRack[];
  validadores: ValidadoresMap;
  loading: boolean;
  error: string | null;
};

const VACIO: DatosInsumos = {
  insumos: [],
  movimientos: [],
  ubicaciones: [],
  validadores: {},
  loading: true,
  error: null,
};

function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === '42501') return 'Tu usuario no tiene permiso para ver los insumos.';
  if (code === 'PGRST205' || code === '42P01')
    return 'Falta una tabla del inventario en la base. Avisa a quien administra el sistema.';
  const msg = (e as { message?: string })?.message;
  return msg ? `No se pudieron cargar los insumos: ${msg}` : 'No se pudieron cargar los insumos.';
}

export function useInsumos(): DatosInsumos & {
  recargar: () => Promise<void>;
  /** Para que una pantalla pueda pintar un cambio sin esperar la recarga. */
  aplicarInsumo: (insumo: Insumo) => void;
} {
  const { empresaId } = useAuth();
  const [datos, setDatos] = useState<DatosInsumos>(VACIO);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setDatos({ ...VACIO, loading: false });
      return;
    }
    setDatos((d) => ({ ...d, loading: true, error: null }));
    try {
      const [rVal, rIns, rMov, rUbi] = await Promise.all([
        supabase.from('validadores_insumos').select('*').eq('empresa_id', empresaId).order('orden'),
        supabase.from('insumos').select('*').eq('empresa_id', empresaId).order('cod'),
        supabase
          .from('movimientos_insumos')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false })
          .limit(500),
        supabase.from('ubicaciones_rack').select('*').eq('empresa_id', empresaId),
      ]);

      const primerError = rIns.error || rMov.error || rUbi.error;
      if (primerError) throw primerError;

      const validadores: ValidadoresMap = {};
      for (const v of (rVal.data as Validador[] | null) || []) {
        if (!validadores[v.campo]) validadores[v.campo] = [];
        validadores[v.campo].push(v.valor);
      }

      setDatos({
        insumos: ((rIns.data as Insumo[] | null) || []) as Insumo[],
        movimientos: ((rMov.data as Movimiento[] | null) || []) as Movimiento[],
        ubicaciones: ((rUbi.data as UbicacionRack[] | null) || []) as UbicacionRack[],
        validadores,
        loading: false,
        error: null,
      });
    } catch (e) {
      setDatos({ ...VACIO, loading: false, error: mensajeError(e) });
    }
  }, [empresaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!empresaId) return;
    const canal = supabase
      .channel(`insumos-${crypto.randomUUID()}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'insumos', filter: `empresa_id=eq.${empresaId}` },
        (payload: { eventType: string; new?: Insumo; old?: Insumo }) => {
          setDatos((prev) => {
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              return { ...prev, insumos: prev.insumos.filter((i) => i.id !== payload.old!.id) };
            }
            if (!payload.new?.id) return prev;
            const idx = prev.insumos.findIndex((i) => i.id === payload.new!.id);
            if (idx < 0) return { ...prev, insumos: [...prev.insumos, payload.new] };
            const insumos = [...prev.insumos];
            insumos[idx] = { ...insumos[idx], ...payload.new };
            return { ...prev, insumos };
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [empresaId]);

  const aplicarInsumo = useCallback((insumo: Insumo) => {
    setDatos((prev) => {
      const idx = prev.insumos.findIndex((i) => i.id === insumo.id);
      if (idx < 0) return { ...prev, insumos: [...prev.insumos, insumo] };
      const insumos = [...prev.insumos];
      insumos[idx] = { ...insumos[idx], ...insumo };
      return { ...prev, insumos };
    });
  }, []);

  return { ...datos, recargar: cargar, aplicarInsumo };
}
