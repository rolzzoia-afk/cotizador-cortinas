// La plomería del kardex: llamar a la función de la base y leer el libro.
//
// La cuenta y las traducciones están en `kardex.ts`, que es puro y testeado.
// Acá solo se habla con Supabase.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import {
  mensajeErrorKardex,
  type LineaKardex,
  type OpcionesKardex,
  type RespuestaKardex,
  type TipoKardex,
} from './kardex';
import type { FilaKardexVista } from './kardexVista';

export type ResultadoKardex =
  | { ok: true; respuesta: RespuestaKardex }
  | { ok: false; motivo: string; codigo?: string };

/**
 * Registra uno o varios movimientos en una sola llamada.
 *
 * TODAS las líneas van juntas a propósito: la función las hace o no las hace.
 * Hoy, un despacho de nueve materiales son nueve escrituras sueltas y, si la
 * quinta falla, las cuatro anteriores ya descontaron y la OT queda a medio
 * despachar sin que nadie se entere.
 */
export async function registrarMovimientos(
  lineas: LineaKardex[],
  opciones: OpcionesKardex = {},
): Promise<ResultadoKardex> {
  if (lineas.length === 0) {
    return { ok: false, motivo: 'No hay nada que registrar.' };
  }
  const { data, error } = await supabase.rpc('inventario_registrar', {
    p_lineas: lineas as unknown as Json,
    p_opciones: opciones as unknown as Json,
  });

  if (error) {
    // Postgres manda el SQLSTATE en `code`; los nuestros son IN001…IN008.
    const codigo = (error as { code?: string }).code;
    return { ok: false, motivo: mensajeErrorKardex(codigo, error.message), codigo };
  }
  return { ok: true, respuesta: data as unknown as RespuestaKardex };
}

/**
 * El código de bodega de una camioneta («CAM-1»), que es como la nombra el
 * kardex.
 *
 * La camioneta se identifica por su uuid en toda la app, pero el libro habla en
 * códigos. El script 01 le creó una bodega a cada camioneta y un disparador se
 * la crea a las que vengan; si aun así no la tiene, se devuelve `null` y quien
 * llama avisa, en vez de inventar un código y mover stock a ninguna parte.
 */
export async function codigoBodegaDeCamioneta(camionetaId: string): Promise<string | null> {
  const { data } = await supabase
    .from('almacenes')
    .select('codigo')
    .eq('camioneta_id', camionetaId)
    .maybeSingle<{ codigo: string }>();
  return data?.codigo ?? null;
}

/** El mismo registro, con el `guardando` para los botones. */
export function useRegistrarKardex(): {
  guardando: boolean;
  registrar: (lineas: LineaKardex[], opciones?: OpcionesKardex) => Promise<ResultadoKardex>;
} {
  const [guardando, setGuardando] = useState(false);

  const registrar = useCallback(
    async (lineas: LineaKardex[], opciones: OpcionesKardex = {}) => {
      setGuardando(true);
      try {
        return await registrarMovimientos(lineas, opciones);
      } finally {
        setGuardando(false);
      }
    },
    [],
  );

  return { guardando, registrar };
}

// ─────────────────────────────────────────────────────────────────────
// Leer el libro
// ─────────────────────────────────────────────────────────────────────

export type FiltrosKardex = {
  /** Qué tanto para atrás se pide. `null` = sin tope. */
  desde?: string | null;
  tipo?: TipoKardex | '';
  itemCod?: string;
  /** `false` = solo el libro; `true` = también lo anterior al kardex. */
  incluirHistorico?: boolean;
  limite?: number;
};

function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  // La tabla no existe todavía: falta correr la migración, no es una falla.
  if (code === 'PGRST205' || code === '42P01') {
    return 'Falta correr la migración sql/20260908_inventario_03_kardex_historico.sql para ver el kardex.';
  }
  const msg = (e as { message?: string })?.message;
  return msg ? `No se pudo cargar el kardex: ${msg}` : 'No se pudo cargar el kardex.';
}

/**
 * El libro. Se lee siempre de `v_kardex_historico`, que junta los movimientos
 * nuevos con todo lo que se movió antes de que el kardex existiera; el
 * interruptor de la pantalla decide si esas filas viejas entran o no.
 *
 * Los filtros que reducen MUCHO —la fecha y el tipo— los hace la base. Los
 * demás se resuelven en pantalla sobre lo que ya llegó: son instantáneos y
 * evitan ir y volver a la base por cada clic en un chip.
 */
export function useKardex(filtros: FiltrosKardex = {}): {
  movimientos: FilaKardexVista[];
  /** Cuántas hay en total, para el «N de M» del pie. */
  total: number;
  loading: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [movimientos, setMovimientos] = useState<FilaKardexVista[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { desde, tipo, itemCod, incluirHistorico, limite } = filtros;
  const tope = limite || 500;

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const columnas =
        'id,fuente,editable,fecha,dominio,item_cod,item_nombre,tipo,cantidad,unidad,cantidad_texto,origen,destino,saldo_post,ot,referencia,quien,notas,lote_id';

      const vista = () => supabase.from('v_kardex_historico');

      const armar = (conteo: boolean) => {
        let q = conteo
          ? vista().select('id', { count: 'exact', head: true })
          : vista().select(columnas);
        q = q.eq('empresa_id', empresaId);
        if (!incluirHistorico) q = q.eq('editable', true);
        if (tipo) q = q.eq('tipo', tipo);
        if (itemCod) q = q.eq('item_cod', itemCod.trim().toUpperCase());
        if (desde) q = q.gte('fecha', desde);
        return conteo ? q : q.order('fecha', { ascending: false }).limit(tope);
      };

      const [rFilas, rTotal] = await Promise.all([armar(false), armar(true)]);
      if (rFilas.error) throw rFilas.error;

      setMovimientos((rFilas.data as unknown as FilaKardexVista[] | null) || []);
      setTotal(rTotal.count ?? 0);
      setLoading(false);
    } catch (e) {
      setError(mensajeError(e));
      setMovimientos([]);
      setLoading(false);
    }
  }, [empresaId, desde, tipo, itemCod, incluirHistorico, tope]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { movimientos, total, loading, error, refrescar: cargar };
}

/**
 * La prueba de que el libro cuadra con la bodega, para la pantalla de
 * Configuración: la vista devuelve UNA FILA POR ARTÍCULO DESCUADRADO, así que
 * lo sano es que venga vacía.
 */
export function useSaldosVsKardex(activo: boolean): {
  descuadres: Array<{ item_cod: string; dominio: string; diferencia: number }>;
  escriturasDirectas: number;
  loading: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [descuadres, setDescuadres] = useState<
    Array<{ item_cod: string; dominio: string; diferencia: number }>
  >([]);
  const [escriturasDirectas, setEscriturasDirectas] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId || !activo) return;
    setLoading(true);
    setError(null);
    try {
      const [rDif, rLog] = await Promise.all([
        supabase
          .from('v_inventario_saldos_kardex')
          .select('item_cod,dominio,diferencia')
          .eq('empresa_id', empresaId)
          .limit(200),
        supabase
          .from('inventario_escrituras_directas_log')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId),
      ]);
      if (rDif.error) throw rDif.error;
      setDescuadres(
        (rDif.data as Array<{ item_cod: string; dominio: string; diferencia: number }> | null) || [],
      );
      setEscriturasDirectas(rLog.count || 0);
      setLoading(false);
    } catch (e) {
      setError(mensajeError(e));
      setLoading(false);
    }
  }, [empresaId, activo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { descuadres, escriturasDirectas, loading, error, refrescar: cargar };
}
