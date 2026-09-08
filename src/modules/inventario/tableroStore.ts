// Lo que el tablero le pide a la base. La cuenta la hace `tablero.ts`, que es
// puro y está testeado; acá solo se leen filas.
//
// Los paños se cargan con `cargarTodosLosPanos`, la misma función que usa la
// pantalla de la colmena: la antigüedad de un paño sale de una cadena de tres
// fechas (`fecha_origen` → `creadoEn` → `created_at`) que no se puede filtrar
// en SQL, y un KPI que contara distinto que la pantalla sería peor que no
// tenerlo.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { cargarTodosLosPanos } from '@/modules/admin/colmena';
import { enAlerta } from '@/modules/telas/colmenaViva';
import {
  kpisTablero,
  movimientosDelDia,
  type FilaMovimiento,
  type KpisTablero,
  type MovimientoCrudo,
} from './tablero';

export type DatosTablero = {
  kpis: KpisTablero;
  movimientos: FilaMovimiento[];
  loading: boolean;
  error: string | null;
};

const KPIS_VACIOS: KpisTablero = {
  alertas: 0,
  alertasSinStock: 0,
  alertasBajoMinimo: 0,
  movimientosHoy: 0,
  entradasHoy: 0,
  salidasHoy: 0,
  telasBajoMinimo: 0,
  telasConStock: 0,
  telasTotal: 0,
  telasSinMinimo: 0,
  panosAlerta: 0,
  panosTotal: 0,
  tubos: 0,
};

/** Traduce el error de Supabase a algo que se pueda leer y accionar. */
function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === '42501') return 'Tu usuario no tiene permiso para ver el inventario.';
  if (code === 'PGRST205' || code === '42P01')
    return 'Falta una tabla del inventario en la base. Avisa a quien administra el sistema.';
  const msg = (e as { message?: string })?.message;
  return msg ? `No se pudo cargar el tablero: ${msg}` : 'No se pudo cargar el tablero.';
}

export function useTablero(): DatosTablero & { refrescar: () => Promise<void> } {
  const { empresaId } = useAuth();
  const [datos, setDatos] = useState<DatosTablero>({
    kpis: KPIS_VACIOS,
    movimientos: [],
    loading: true,
    error: null,
  });

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setDatos({ kpis: KPIS_VACIOS, movimientos: [], loading: false, error: null });
      return;
    }
    setDatos((d) => ({ ...d, loading: true, error: null }));
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const [rIns, rTelas, rMovIns, rMovTelas, rTubos, panos] = await Promise.all([
        supabase
          .from('insumos')
          .select('cod,nemotecnico,stock_mp,stock_liberado,minimo,status')
          .eq('empresa_id', empresaId),
        supabase
          .from('telas_catalogo')
          .select('codigo,descripcion,stock_mp,stock_liberado,stock_minimo')
          .eq('empresa_id', empresaId),
        supabase
          .from('movimientos_insumos')
          .select('id,fecha,tipo,codigo,producto,almacen,cantidad,ot')
          .eq('empresa_id', empresaId)
          .gte('fecha', hoy)
          .order('fecha', { ascending: false })
          .limit(200),
        supabase
          .from('movimientos_telas')
          .select('id,fecha,tipo,codigo,producto,almacen,cantidad,ot')
          .eq('empresa_id', empresaId)
          .gte('fecha', hoy)
          .order('fecha', { ascending: false })
          .limit(200),
        supabase
          .from('colmena_tubos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId),
        cargarTodosLosPanos(empresaId),
      ]);

      const primerError = rIns.error || rTelas.error || rMovIns.error || rMovTelas.error;
      if (primerError) throw primerError;

      const hoyISO = new Date().toISOString();
      const disponibles = panos.filter((p) => p.disponible && !p.datos_extra?.baja);
      const movIns = (rMovIns.data || []) as MovimientoCrudo[];
      const movTelas = (rMovTelas.data || []) as MovimientoCrudo[];

      setDatos({
        kpis: kpisTablero({
          insumos: (rIns.data || []) as never,
          telas: (rTelas.data || []) as never,
          movimientosHoy: [...movIns, ...movTelas],
          panosTotal: disponibles.length,
          panosAlerta: disponibles.filter((p) => enAlerta(p, hoyISO)).length,
          tubos: rTubos.count ?? 0,
        }),
        movimientos: movimientosDelDia(movIns, movTelas),
        loading: false,
        error: null,
      });
    } catch (e) {
      setDatos({ kpis: KPIS_VACIOS, movimientos: [], loading: false, error: mensajeError(e) });
    }
  }, [empresaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { ...datos, refrescar: cargar };
}
