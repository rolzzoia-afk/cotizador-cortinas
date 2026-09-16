// La foto del costo de una OT en la base: leer la última guardada y guardar
// una nueva con la RPC `ot_costo_guardar` (sql/20260916_costos_ot_01_foto.sql).
// Lo arma `costoOTFoto.ts`; esto solo habla con Supabase.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type { FotoCostoOT, FotoGuardada } from './costoOTFoto';

/**
 * La foto guardada de UNA OT y cómo reemplazarla. Solo la pide la pantalla de
 * costo, que ya es de administradores (la tabla tampoco se deja leer por otros).
 */
export function useFotoCostoOT(otId: string | null | undefined): {
  foto: FotoGuardada | null;
  loading: boolean;
  guardar: (foto: FotoCostoOT, iva: number) => Promise<FotoGuardada>;
} {
  const [foto, setFoto] = useState<FotoGuardada | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!otId) {
      setFoto(null);
      return;
    }
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('ots_costos')
          .select('version, guardado_at, guardado_por, costo_con_fallas, ganancia_real, cobrado_neto')
          .eq('ot_id', otId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelado) setFoto(data ?? null);
      } catch (e) {
        console.warn('[Producción] No se pudo leer el costo guardado de la OT:', e);
        if (!cancelado) setFoto(null);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [otId]);

  const guardar = useCallback(
    async (nueva: FotoCostoOT, iva: number): Promise<FotoGuardada> => {
      if (!otId) throw new Error('No hay una OT cargada.');
      const { data, error } = await supabase.rpc('ot_costo_guardar', {
        p_ot_id: otId,
        p_manual: nueva.manual as unknown as Json,
        p_lineas: nueva.lineas as unknown as Json,
        p_sin_costo: nueva.sinCosto as unknown as Json,
        p_iva: iva,
        p_esperado: nueva.esperado as unknown as Json,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('La base no devolvió el costo guardado.');
      const guardada: FotoGuardada = {
        version: data.version,
        guardado_at: data.guardado_at,
        guardado_por: data.guardado_por,
        costo_con_fallas: data.costo_con_fallas,
        ganancia_real: data.ganancia_real,
        cobrado_neto: data.cobrado_neto,
      };
      setFoto(guardada);
      return guardada;
    },
    [otId],
  );

  return { foto, loading, guardar };
}
