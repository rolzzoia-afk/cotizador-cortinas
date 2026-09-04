// Carga de la COLMENA DE PAÑOS disponible — una sola puerta para todo el
// cotizador y producción.
//
// Por qué existe: PostgREST corta cada `select` en 1.000 filas. Los siete
// lugares que leían `colmena_panos` lo hacían con un `.select` simple y SIN
// `order`, así que con la colmena llena (≈2.000 paños) cada pantalla veía un
// subconjunto DISTINTO e indeterminado de la misma colmena: el Plan de Corte
// asignaba un paño que la hoja de corte no conocía, y las etiquetas imprimían
// un paño que ya estaba cortado. Acá se pagina y se ordena siempre igual.
//
// El orden (created_at, id) es además el que el motor necesita: FIFO estable.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { rowToPano, type ColmenaPanoRow, type PanoColmena } from './planCorte';

const PAGINA = 1000;

/**
 * Trae TODAS las filas de colmena_panos disponibles de la empresa, paginando.
 * Devuelve la fila cruda: quien necesite el tipo del motor pasa por `rowToPano`
 * (o usa `cargarColmenaPanos`, que ya lo hace).
 */
export async function cargarColmenaDisponible(empresaId: string): Promise<ColmenaPanoRow[]> {
  const todas: ColmenaPanoRow[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('colmena_panos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('disponible', true)
      .order('created_at')
      .order('id')
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    const lote = (data || []) as ColmenaPanoRow[];
    todas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todas;
}

/** Igual que `cargarColmenaDisponible`, ya normalizada al tipo del motor. */
export async function cargarColmenaPanos(empresaId: string): Promise<PanoColmena[]> {
  return (await cargarColmenaDisponible(empresaId)).map(rowToPano);
}

/**
 * Hook con la colmena disponible ya normalizada. `refrescar` la vuelve a bajar
 * (después de cerrar un corte, por ejemplo).
 */
export function useColmenaDisponible(): {
  panos: PanoColmena[];
  cargando: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [panos, setPanos] = useState<PanoColmena[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setCargando(true);
    try {
      setPanos(await cargarColmenaPanos(empresaId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [empresaId]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!empresaId) return;
      setCargando(true);
      try {
        const lista = await cargarColmenaPanos(empresaId);
        if (!cancelado) {
          setPanos(lista);
          setError(null);
        }
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId]);

  return { panos, cargando, error, refrescar: cargar };
}
