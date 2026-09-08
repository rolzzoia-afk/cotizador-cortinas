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

export type FilaKardex = {
  id: string;
  fecha: string;
  /** La base lo guarda con un CHECK; acá llega como texto y así se muestra. */
  dominio: string;
  item_cod: string;
  item_nombre: string | null;
  tipo: string;
  cantidad: number;
  unidad: string | null;
  almacen_origen_id: string | null;
  almacen_destino_id: string | null;
  saldo_origen_post: number | null;
  saldo_destino_post: number | null;
  motivo: string | null;
  referencia_tipo: string | null;
  ot: string | null;
  usuario_email: string | null;
  responsable: string | null;
  recibe: string | null;
  notas: string | null;
  lote_id: string | null;
};

export type FiltrosKardex = {
  dominio?: 'insumo' | 'tela';
  itemCod?: string;
  tipo?: TipoKardex;
  desde?: string;
  hasta?: string;
  ot?: string;
  limite?: number;
};

export type Almacen = { id: string; codigo: string; nombre: string; tipo: string };

function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  // La tabla no existe todavía: falta correr la migración, no es una falla.
  if (code === 'PGRST205' || code === '42P01') {
    return 'Falta correr la migración sql/20260908_inventario_02_kardex.sql para ver el kardex.';
  }
  const msg = (e as { message?: string })?.message;
  return msg ? `No se pudo cargar el kardex: ${msg}` : 'No se pudo cargar el kardex.';
}

/**
 * El libro, con sus filtros. Trae también los almacenes, porque el movimiento
 * guarda el id y en pantalla hay que mostrar «MP» o «CAM-1».
 */
export function useKardex(filtros: FiltrosKardex = {}): {
  movimientos: FilaKardex[];
  almacenes: Almacen[];
  loading: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [movimientos, setMovimientos] = useState<FilaKardex[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { dominio, itemCod, tipo, desde, hasta, ot, limite } = filtros;

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('inventario_movimientos')
        .select('id,fecha,dominio,item_cod,item_nombre,tipo,cantidad,unidad,almacen_origen_id,almacen_destino_id,saldo_origen_post,saldo_destino_post,motivo,referencia_tipo,ot,usuario_email,responsable,recibe,notas,lote_id')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false })
        .limit(limite || 300);

      if (dominio) q = q.eq('dominio', dominio);
      if (tipo) q = q.eq('tipo', tipo);
      if (itemCod) q = q.eq('item_cod', itemCod.trim().toUpperCase());
      if (ot) q = q.eq('ot', ot.trim());
      if (desde) q = q.gte('fecha', desde);
      if (hasta) q = q.lte('fecha', hasta);

      const [rMov, rAlm] = await Promise.all([
        q,
        supabase.from('almacenes').select('id,codigo,nombre,tipo').eq('empresa_id', empresaId),
      ]);
      if (rMov.error) throw rMov.error;

      setMovimientos((rMov.data as FilaKardex[] | null) || []);
      setAlmacenes((rAlm.data as Almacen[] | null) || []);
      setLoading(false);
    } catch (e) {
      setError(mensajeError(e));
      setMovimientos([]);
      setLoading(false);
    }
  }, [empresaId, dominio, itemCod, tipo, desde, hasta, ot, limite]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { movimientos, almacenes, loading, error, refrescar: cargar };
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
