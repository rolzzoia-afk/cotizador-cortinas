// La lectura y la escritura de «Alertas y reposición».
//
// Junta insumos y telas en UNA lista: el que va a comprar no ordena su día por
// el tipo de artículo. Además trae las salidas de los últimos meses para poder
// decir para cuánto alcanza lo que hay.
//
// Lo que se guarda acá son el MÍNIMO y el MÁXIMO, no el saldo: son columnas de
// configuración del artículo y no las toca el guardián de escrituras directas.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { consumoPorCodigo, type ArticuloAlerta, type BorradorAlertas } from './alertas';

/** Cuántos meses de salidas se promedian para la cobertura. */
export const MESES_CONSUMO = 6;

function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === '42501') return 'Tu usuario no tiene permiso para ver el inventario.';
  if (code === 'PGRST205' || code === '42P01')
    return 'Falta una tabla del inventario en la base. Avisa a quien administra el sistema.';
  const msg = (e as { message?: string })?.message;
  return msg ? `No se pudieron cargar las alertas: ${msg}` : 'No se pudieron cargar las alertas.';
}

export function useAlertas(): {
  articulos: ArticuloAlerta[];
  /** Pedidos de reposición registrados que todavía no llegaron. */
  pedidosEnCamino: { total: number; masViejoDias: number | null };
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [articulos, setArticulos] = useState<ArticuloAlerta[]>([]);
  const [pedidos, setPedidos] = useState<{ total: number; masViejoDias: number | null }>({
    total: 0,
    masViejoDias: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - MESES_CONSUMO);
      const desdeISO = desde.toISOString();

      const [rIns, rTel, rSal, rPed] = await Promise.all([
        supabase
          .from('insumos')
          .select('id,cod,nemotecnico,descriptor_proveedor,minimo,stock_maximo,stock_mp,stock_liberado,status')
          .eq('empresa_id', empresaId),
        supabase
          .from('telas_catalogo')
          .select('id,codigo,nemotecnico,descriptor,stock_minimo,stock_maximo,stock_mp,stock_liberado,estado,status_stock')
          .eq('empresa_id', empresaId),
        supabase
          .from('movimientos_insumos')
          .select('codigo,cantidad,fecha')
          .eq('empresa_id', empresaId)
          .ilike('tipo', 'SALIDA%')
          .gte('fecha', desdeISO),
        supabase
          .from('movimientos_insumos')
          .select('fecha')
          .eq('empresa_id', empresaId)
          .eq('tipo', 'PEDIDO REPOSICION')
          .order('fecha'),
      ]);

      const primerError = rIns.error || rTel.error;
      if (primerError) throw primerError;

      const consumo = consumoPorCodigo(rSal.data || [], MESES_CONSUMO, desdeISO);
      const deCodigo = (c: string | null) => consumo.get(String(c ?? '').trim().toUpperCase()) ?? null;

      const insumos: ArticuloAlerta[] = (rIns.data || []).map((i) => ({
        id: `insumo:${i.id}`,
        dominio: 'insumo',
        codigo: i.cod || '',
        nombre: i.nemotecnico || i.descriptor_proveedor || i.cod || '',
        ahora: Number(i.stock_mp ?? 0) + Number(i.stock_liberado ?? 0),
        minimo: i.minimo ?? null,
        maximo: i.stock_maximo ?? null,
        status: i.status,
        consumoMes: deCodigo(i.cod),
      }));

      const telas: ArticuloAlerta[] = (rTel.data || []).map((t) => ({
        id: `tela:${t.id}`,
        dominio: 'tela',
        codigo: t.codigo || '',
        nombre: t.nemotecnico || t.descriptor || t.codigo || '',
        ahora: Number(t.stock_mp ?? 0) + Number(t.stock_liberado ?? 0),
        minimo: t.stock_minimo ?? null,
        maximo: t.stock_maximo ?? null,
        // El catálogo de telas guarda el «descontinuado» en `estado`.
        status:
          String(t.estado ?? '').trim().toUpperCase() === 'DESCONTINUADO'
            ? 'DESCONTINUADO'
            : t.status_stock,
        consumoMes: deCodigo(t.codigo),
      }));

      const fechas = (rPed.data || []).map((p) => Date.parse(String(p.fecha ?? ''))).filter((n) => !Number.isNaN(n));
      setPedidos({
        total: fechas.length,
        masViejoDias:
          fechas.length > 0
            ? Math.floor((Date.now() - Math.min(...fechas)) / 86_400_000)
            : null,
      });
      setArticulos([...insumos, ...telas].filter((a) => a.codigo));
      setLoading(false);
    } catch (e) {
      setError(mensajeError(e));
      setArticulos([]);
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { articulos, pedidosEnCamino: pedidos, loading, error, recargar: cargar };
}

/**
 * Guarda el mínimo y el máximo de cada artículo tocado. Los insumos cuentan en
 * ENTEROS: su columna `minimo` es integer y un 2,5 se guardaría como 2 sin
 * avisar, así que se redondea acá y se dice en pantalla.
 */
export async function guardarPuntosDeReposicion(
  borrador: BorradorAlertas,
): Promise<{ ok: true; guardados: number } | { ok: false; motivo: string }> {
  const entradas = Object.entries(borrador);
  if (entradas.length === 0) return { ok: true, guardados: 0 };

  try {
    for (const [clave, cambio] of entradas) {
      const [dominio, id] = clave.split(':');
      if (!id) continue;
      if (dominio === 'insumo') {
        // `minimo` y `stock_maximo` son INTEGER en insumos: un 2,5 se guardaría
        // como 2 sin avisar, así que se redondea acá a la vista.
        const patch: { minimo?: number | null; stock_maximo?: number | null } = {};
        if (cambio.minimo !== undefined) {
          patch.minimo = cambio.minimo == null ? null : Math.round(cambio.minimo);
        }
        if (cambio.maximo !== undefined) {
          patch.stock_maximo = cambio.maximo == null ? null : Math.round(cambio.maximo);
        }
        const { error } = await supabase.from('insumos').update(patch).eq('id', id);
        if (error) throw error;
      } else {
        const patch: { stock_minimo?: number | null; stock_maximo?: number | null } = {};
        if (cambio.minimo !== undefined) patch.stock_minimo = cambio.minimo;
        if (cambio.maximo !== undefined) patch.stock_maximo = cambio.maximo;
        const { error } = await supabase.from('telas_catalogo').update(patch).eq('id', id);
        if (error) throw error;
      }
    }
    return { ok: true, guardados: entradas.length };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
