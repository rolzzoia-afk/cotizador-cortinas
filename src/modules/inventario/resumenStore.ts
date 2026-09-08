// Los tres números que la barra lateral muestra pegados a un submódulo:
// cuántas alertas de stock hay, si hay un conteo abierto y cuántas OT esperan
// despacho.
//
// Es a propósito lo más liviano posible: lo carga el layout, o sea que corre en
// TODAS las pantallas del módulo. Trae solo las columnas que necesita para
// contar y no se suscribe a realtime; se refresca al cambiar de submódulo.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { estadoArticulo, estadoPideAtencion } from './badges';

/** OTs que ya se pueden ir a buscar a bodega. Igual que en /bodeguero. */
const ESTADOS_DESPACHABLES = ['aprobada', 'en_produccion', 'produccion', 'lista'];

export type ResumenInventario = {
  /** Insumos sin stock, en negativo o bajo el mínimo. */
  alertas: number;
  /** Hay un inventario de tubos abierto ahora mismo. */
  conteoActivo: boolean;
  /** OTs esperando que bodega les saque el material. */
  despacho: number;
  loading: boolean;
};

const VACIO: ResumenInventario = { alertas: 0, conteoActivo: false, despacho: 0, loading: true };

export function useResumenInventario(): ResumenInventario & { refrescar: () => Promise<void> } {
  const { empresaId } = useAuth();
  const [datos, setDatos] = useState<ResumenInventario>(VACIO);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setDatos({ ...VACIO, loading: false });
      return;
    }
    try {
      const [rIns, rConteo, rOts] = await Promise.all([
        supabase
          .from('insumos')
          .select('stock_mp,stock_liberado,minimo,status')
          .eq('empresa_id', empresaId),
        // `inventarios` todavía no está en los tipos generados.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('inventarios')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('estado', 'activo')
          .limit(1),
        supabase.from('ots').select('estado').eq('empresa_id', empresaId),
      ]);

      const insumos = (rIns.data || []) as Array<{
        stock_mp: number | null;
        stock_liberado: number | null;
        minimo: number | null;
        status: string | null;
      }>;
      const alertas = insumos.filter((i) =>
        estadoPideAtencion(
          estadoArticulo({
            total: (i.stock_mp || 0) + (i.stock_liberado || 0),
            minimo: i.minimo,
            status: i.status,
          }),
        ),
      ).length;

      const ots = (rOts.data || []) as Array<{ estado: string | null }>;
      const despacho = ots.filter((o) =>
        ESTADOS_DESPACHABLES.includes((o.estado || '').toLowerCase().trim()),
      ).length;

      setDatos({
        alertas,
        conteoActivo: ((rConteo.data as unknown[] | null) || []).length > 0,
        despacho,
        loading: false,
      });
    } catch {
      // Un contador que no se pudo leer no puede tapar el módulo entero: se
      // muestra la barra sin badges.
      setDatos({ ...VACIO, loading: false });
    }
  }, [empresaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { ...datos, refrescar: cargar };
}
