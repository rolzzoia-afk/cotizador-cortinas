// Respaldos del catálogo de productos. Mismo patrón que `reglasPreciosStore`:
// una clave JSON en `configuracion` con las últimas fotos.
//
// Existe porque el catálogo se guarda como un blob entero: una importación de
// Excel o un guardado con datos viejos en pantalla pisa TODOS los precios de
// una vez, y hasta ahora no había forma de volver atrás. El respaldo se toma
// dentro de `guardarCatalogoProductos`, así que cubre por igual al diálogo de
// producto, al clonador y al importador.

import { supabase } from '@/lib/supabase';
import type { CatalogoProductos } from './types';

export const CLAVE_CATALOGO_RESPALDOS = 'catalogo_productos_respaldos';

/** Cuántas fotos del catálogo se conservan. */
export const MAX_RESPALDOS_CATALOGO = 10;

export type RespaldoCatalogo = {
  fecha: string;
  motivo: string;
  catalogo: CatalogoProductos;
  /** El mapa de anchos viaja junto: los tres escritores tocan los dos blobs. */
  anchoRollo: Record<string, number>;
};

/** Deja pasar solo lo que tiene forma de respaldo, y como mucho los últimos 10. */
export function saneaRespaldosCatalogo(crudo: unknown): RespaldoCatalogo[] {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter(
      (r): r is Record<string, unknown> =>
        !!r && typeof r === 'object' && typeof (r as { fecha?: unknown }).fecha === 'string',
    )
    .slice(0, MAX_RESPALDOS_CATALOGO)
    .map((r) => ({
      fecha: r.fecha as string,
      motivo: typeof r.motivo === 'string' ? r.motivo : '',
      catalogo:
        r.catalogo && typeof r.catalogo === 'object' ? (r.catalogo as CatalogoProductos) : {},
      anchoRollo:
        r.anchoRollo && typeof r.anchoRollo === 'object'
          ? (r.anchoRollo as Record<string, number>)
          : {},
    }));
}

export async function cargarRespaldosCatalogo(empresaId: string): Promise<RespaldoCatalogo[]> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_CATALOGO_RESPALDOS)
    .maybeSingle<{ valor: string }>();
  if (error || !data?.valor) return [];
  try {
    return saneaRespaldosCatalogo(JSON.parse(data.valor));
  } catch {
    return [];
  }
}

/** Cuántos códigos tiene una foto — lo que se muestra en la lista de respaldos. */
export const codigosDelRespaldo = (r: RespaldoCatalogo): number => Object.keys(r.catalogo).length;

/**
 * Guarda una foto del catálogo ACTUAL antes de pisarlo. Nunca lanza: un
 * respaldo que falla no puede impedir que se guarde el cambio.
 */
export async function respaldarCatalogo(empresaId: string, motivo: string): Promise<void> {
  try {
    const [catRes, anchoRes, previos] = await Promise.all([
      supabase
        .from('configuracion')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('clave', 'catalogo_productos_data')
        .maybeSingle<{ valor: string }>(),
      supabase
        .from('configuracion')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('clave', 'ancho_rollo_data')
        .maybeSingle<{ valor: string }>(),
      cargarRespaldosCatalogo(empresaId),
    ]);

    const leer = <T>(valor: string | undefined): T | null => {
      if (!valor) return null;
      try {
        return JSON.parse(valor) as T;
      } catch {
        return null;
      }
    };
    const catalogo = leer<CatalogoProductos>(catRes.data?.valor);
    // Sin catálogo previo no hay nada que respaldar (empresa recién creada).
    if (!catalogo || Object.keys(catalogo).length === 0) return;

    const lista: RespaldoCatalogo[] = [
      {
        fecha: new Date().toISOString(),
        motivo,
        catalogo,
        anchoRollo: leer<Record<string, number>>(anchoRes.data?.valor) ?? {},
      },
      ...previos,
    ].slice(0, MAX_RESPALDOS_CATALOGO);

    await supabase.from('configuracion').upsert(
      { empresa_id: empresaId, clave: CLAVE_CATALOGO_RESPALDOS, valor: JSON.stringify(lista) },
      { onConflict: 'empresa_id,clave' },
    );
  } catch (e) {
    console.warn('[Catálogo] No se pudo guardar el respaldo:', e);
  }
}
