// Las familias de código y el alta de un artículo.
//
// El código NO lo elige el navegador: lo asigna la base con `insumo_crear`,
// que bloquea la fila de la familia mientras reparte el número. Con dos
// personas dando de alta a la vez, la segunda espera y se lleva el siguiente
// —si el número saliera de acá, las dos verían el mismo y una se caería—.
//
// `insumo_siguiente_codigo` solo PREVISUALIZA: no reserva nada, porque reservar
// quemaría un correlativo cada vez que alguien cancela el diálogo.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { mapaColoresPorCodigo, mensajeErrorAlta, type FamiliaInsumo } from './codigosInsumo';
import type { Insumo } from './helpers';

/** Los campos del formulario que entienden `insumo_crear`. */
export type DatosInsumoNuevo = {
  nemotecnico?: string;
  categoria?: string;
  sub_categoria?: string;
  producto?: string;
  proveedor?: string;
  compra?: string;
  color?: string;
  minimo?: string;
  can_x_paquete?: string;
  costo?: string;
  ubicacion?: string;
  cod_proveedor?: string;
  estado_inventario?: string;
  descriptor_proveedor?: string;
  comentarios?: string;
  foto_url?: string;
  unidad?: string;
};

export type Unidad = { codigo: string; nombre: string; decimales: number };

function codigoDeError(e: unknown): string | undefined {
  return (e as { code?: string })?.code || undefined;
}

function textoDeError(e: unknown): string {
  return (e as { message?: string })?.message || String(e);
}

// La lista la piden el diálogo de alta y la pantalla de Configuración. Se
// guarda la promesa, no el resultado: dos pantallas que montan a la vez
// comparten una sola consulta (mismo patrón que `flagsStore`).
const cacheFamilias = new Map<string, Promise<FamiliaInsumo[]>>();

function leerFamilias(empresaId: string): Promise<FamiliaInsumo[]> {
  const guardada = cacheFamilias.get(empresaId);
  if (guardada) return guardada;

  const pedido = (async () => {
    const { data, error } = await supabase
      .from('familias_insumo')
      .select('id,prefijo,nombre,categoria,sub_categoria,digitos,siguiente,activo,descripcion')
      .eq('empresa_id', empresaId)
      .order('prefijo');
    if (error) throw error;
    return (data || []) as FamiliaInsumo[];
  })();

  cacheFamilias.set(empresaId, pedido);
  return pedido;
}

/** Olvida lo leído: se llama al guardar una familia o al crear un artículo. */
export function olvidarFamilias(empresaId?: string) {
  if (empresaId) cacheFamilias.delete(empresaId);
  else cacheFamilias.clear();
}

export function useFamiliasInsumo(): {
  familias: FamiliaInsumo[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [familias, setFamilias] = useState<FamiliaInsumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setFamilias([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setFamilias(await leerFamilias(empresaId));
    } catch (e) {
      // Sin familias el alta sigue funcionando con código a mano: se avisa,
      // pero no se rompe la pantalla.
      olvidarFamilias(empresaId);
      setError(mensajeErrorAlta(codigoDeError(e), textoDeError(e)));
      setFamilias([]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const recargar = useCallback(async () => {
    olvidarFamilias(empresaId ?? undefined);
    await cargar();
  }, [empresaId, cargar]);

  return { familias, loading, error, recargar };
}

export function useUnidades(): { unidades: Unidad[]; loading: boolean } {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('unidades').select('codigo,nombre,decimales').order('codigo');
      if (!vivo) return;
      setUnidades((data || []) as Unidad[]);
      setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return { unidades, loading };
}

/**
 * Los códigos del catálogo con su color: hasta dónde llegó cada familia y qué
 * sufijo le toca a cada llave.
 *
 * Se piden aparte y no de `insumosStore` porque quien los necesita —la
 * pantalla de Configuración y el Kardex— no usa las 1.012 fichas completas con
 * sus fotos y comentarios: le bastan dos columnas.
 */
export function useCodigosInsumo(): {
  codigos: string[];
  /** `MEC32 → BLANCO`, para armar el código visible desde una llave suelta. */
  colores: Map<string, string>;
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const [codigos, setCodigos] = useState<string[]>([]);
  const [colores, setColores] = useState<Map<string, string>>(() => new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) {
      setCodigos([]);
      setColores(new Map());
      setLoading(false);
      return;
    }
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('insumos')
        .select('cod,color')
        .eq('empresa_id', empresaId);
      if (!vivo) return;
      const filas = (data || []) as Array<{ cod: string | null; color: string | null }>;
      setCodigos(filas.map((r) => r.cod || ''));
      setColores(mapaColoresPorCodigo(filas));
      setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  return { codigos, colores, loading };
}

/**
 * El código que le tocaría al próximo artículo de esta familia. Es solo para
 * mostrarlo mientras se llena el formulario: el definitivo lo asigna la base
 * al guardar, y puede ser otro si alguien se adelantó.
 */
export async function previsualizarCodigo(
  prefijo: string,
): Promise<{ ok: true; cod: string } | { ok: false; motivo: string }> {
  const { data, error } = await supabase.rpc('insumo_siguiente_codigo', { p_prefijo: prefijo });
  if (error) {
    return { ok: false, motivo: mensajeErrorAlta(codigoDeError(error), textoDeError(error)) };
  }
  return { ok: true, cod: String(data ?? '') };
}

/**
 * Guarda una familia desde Configuración.
 *
 * El `prefijo` NO se puede cambiar: es la llave con la que se buscan los
 * códigos ya emitidos. Renombrar MEC a MECA dejaría 46 artículos huérfanos de
 * su familia y el próximo correlativo empezaría de nuevo en 1.
 */
export async function guardarFamilia(
  id: string,
  cambios: Partial<
    Pick<FamiliaInsumo, 'nombre' | 'categoria' | 'sub_categoria' | 'digitos' | 'siguiente' | 'activo' | 'descripcion'>
  >,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error } = await supabase.from('familias_insumo').update(cambios).eq('id', id);
  if (error) return { ok: false, motivo: mensajeErrorAlta(codigoDeError(error), textoDeError(error)) };
  olvidarFamilias();
  return { ok: true };
}

/** Crea una familia nueva. El prefijo va normalizado y validado desde la UI. */
export async function crearFamilia(
  empresaId: string,
  familia: Omit<FamiliaInsumo, 'id'>,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error } = await supabase
    .from('familias_insumo')
    .insert({ ...familia, empresa_id: empresaId });
  if (error) return { ok: false, motivo: mensajeErrorAlta(codigoDeError(error), textoDeError(error)) };
  olvidarFamilias(empresaId);
  return { ok: true };
}

/**
 * Da de alta el artículo. `codManual` es para lo que trae código de fábrica o
 * de una serie externa; la base solo se lo acepta a un administrador.
 */
export async function crearInsumo(
  prefijo: string,
  datos: DatosInsumoNuevo,
  codManual?: string | null,
): Promise<{ ok: true; insumo: Insumo } | { ok: false; motivo: string }> {
  const { data, error } = await supabase.rpc('insumo_crear', {
    p_prefijo: prefijo || '',
    p_datos: datos as unknown as Record<string, string>,
    p_cod_manual: codManual || undefined,
  });
  if (error) {
    return { ok: false, motivo: mensajeErrorAlta(codigoDeError(error), textoDeError(error)) };
  }
  return { ok: true, insumo: data as unknown as Insumo };
}
