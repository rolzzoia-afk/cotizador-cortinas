// Lecturas de la recepción: las de una orden, las de la empresa, una con sus
// líneas, lo aprendido de los proveedores y el catálogo para emparejar.
//
// Las listas de columnas van LITERALES dentro de cada `.select`: así el
// guardián `consultas.test.ts` puede comprobar que existen de verdad.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { GeoFirma } from '@/modules/ots/types';
import type { DominioCompra } from './compras';
import { mensajeErrorCompras } from './comprasMensajes';
import type { LineaConteo, MotivoExclusion, Vinculo } from './recepcion';
import type { ArticuloCatalogo } from './recepcionCatalogo';
import type { Diferencia } from './recepcionDiferencias';
import type { Aprendida, ExtraccionFactura } from './recepcionFactura';

function traducir(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  return mensajeErrorCompras(err?.code, err?.message);
}

/** Antes de correr el SQL de la recepción la tabla no existe: no es un error que mostrar. */
function faltaLaTabla(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === 'PGRST205' || code === '42P01' || code === '42703';
}

export type RecepcionResumen = {
  id: string;
  numero: string;
  orden_id: string | null;
  estado: string;
  resultado: string | null;
  doc_tipo: string;
  doc_numero: string;
  doc_fecha: string | null;
  proveedor_rut: string | null;
  proveedor_nombre: string | null;
  unidades_ingresadas: number;
  lineas_danadas: number;
  envio_finanzas: string | null;
  envio_finanzas_detalle: string | null;
  recibe_nombre: string | null;
  escaneada_por: string | null;
  contada_por: string | null;
  creada_en: string;
  contada_en: string | null;
};

export type LineaRecepcion = {
  id: string;
  posicion: number;
  origen: 'factura' | 'manual';
  fact_codigo: string | null;
  fact_descripcion: string | null;
  fact_cantidad: number | null;
  fact_unidad: string | null;
  fact_paquete: number | null;
  orden_linea_id: string | null;
  dominio: DominioCompra | null;
  item_cod: string | null;
  factor: number;
  vinculo: Vinculo | null;
  accion: 'recibir' | 'excluir';
  motivo_exclusion: MotivoExclusion | null;
  cantidad_buena: number;
  cantidad_danada: number;
  unidades_ingresadas: number;
  movimiento_id: string | null;
  fotos_paths: string[];
  nota: string | null;
};

export type RecepcionDetalle = RecepcionResumen & {
  doc_path: string;
  doc_mime: string | null;
  extraccion: ExtraccionFactura | null;
  modelo: string | null;
  escaneo_error: string | null;
  firma_geo: GeoFirma | null;
  firma_geo_motivo: string | null;
  diferencias: Diferencia[];
  notas: string | null;
  lote_id: string | null;
  envio_finanzas_en: string | null;
  envio_finanzas_intentos: number;
  cancelada_por: string | null;
  cancelada_en: string | null;
  cancelada_motivo: string | null;
  lineas: LineaRecepcion[];
};

const n = (v: unknown) => (v == null ? 0 : Number(v));
const nOrNull = (v: unknown) => (v == null ? null : Number(v));

function aResumen(r: Record<string, unknown>): RecepcionResumen {
  return {
    ...(r as unknown as RecepcionResumen),
    unidades_ingresadas: n(r.unidades_ingresadas),
    lineas_danadas: n(r.lineas_danadas),
  };
}

function aLinea(l: Record<string, unknown>): LineaRecepcion {
  return {
    ...(l as unknown as LineaRecepcion),
    fact_cantidad: nOrNull(l.fact_cantidad),
    fact_paquete: nOrNull(l.fact_paquete),
    factor: n(l.factor) || 1,
    cantidad_buena: n(l.cantidad_buena),
    cantidad_danada: n(l.cantidad_danada),
    unidades_ingresadas: n(l.unidades_ingresadas),
    fotos_paths: Array.isArray(l.fotos_paths) ? (l.fotos_paths as string[]) : [],
  };
}

/** Una línea guardada, lista para contarla. */
export function lineaAConteo(l: LineaRecepcion): LineaConteo {
  return {
    id: l.id,
    posicion: l.posicion,
    origen: l.origen,
    fact_codigo: l.fact_codigo,
    fact_descripcion: l.fact_descripcion,
    fact_cantidad: l.fact_cantidad,
    fact_unidad: l.fact_unidad,
    orden_linea_id: l.orden_linea_id,
    dominio: l.dominio,
    item_cod: l.item_cod,
    factor: l.factor,
    vinculo: l.vinculo,
    accion: l.accion,
    motivo_exclusion: l.motivo_exclusion,
    cantidad_buena: l.cantidad_buena,
    cantidad_danada: l.cantidad_danada,
    nota: l.nota,
    fotos: l.fotos_paths,
  };
}

type Lista = {
  recepciones: RecepcionResumen[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
};

/**
 * Las recepciones de la empresa (las 200 más nuevas), o solo las de una orden.
 * La firma no se trae: pesa varios KB por recepción.
 */
function useListaRecepciones(filtro: { ordenId?: string; activo: boolean }): Lista {
  const { empresaId } = useAuth();
  const [recepciones, setRecepciones] = useState<RecepcionResumen[]>([]);
  const [loading, setLoading] = useState(filtro.activo);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId || !filtro.activo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let q = supabase
      .from('recepciones')
      .select('id,numero,orden_id,estado,resultado,doc_tipo,doc_numero,doc_fecha,proveedor_rut,proveedor_nombre,unidades_ingresadas,lineas_danadas,envio_finanzas,envio_finanzas_detalle,recibe_nombre,escaneada_por,contada_por,creada_en,contada_en')
      .eq('empresa_id', empresaId)
      .order('creada_en', { ascending: false })
      .limit(200);
    if (filtro.ordenId) q = q.eq('orden_id', filtro.ordenId);
    const { data, error: e } = await q;
    if (e) {
      setError(faltaLaTabla(e) ? null : `No se pudieron leer las recepciones: ${traducir(e)}`);
      setRecepciones([]);
    } else {
      setRecepciones((data ?? []).map((r) => aResumen(r as Record<string, unknown>)));
    }
    setLoading(false);
  }, [empresaId, filtro.activo, filtro.ordenId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { recepciones, loading, error, recargar: cargar };
}

export const useRecepcionesEmpresa = (activo = true) => useListaRecepciones({ activo });
export const useRecepcionesDeOrden = (ordenId: string | undefined) =>
  useListaRecepciones({ ordenId, activo: !!ordenId });

/** Una recepción con todo: sus líneas, las diferencias, dónde se firmó. */
export function useRecepcion(id: string | undefined): {
  recepcion: RecepcionDetalle | null;
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
} {
  const [recepcion, setRecepcion] = useState<RecepcionDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: cab, error: e1 } = await supabase
        .from('recepciones')
        .select('id,numero,orden_id,estado,resultado,doc_tipo,doc_numero,doc_fecha,doc_path,doc_mime,proveedor_rut,proveedor_nombre,extraccion,modelo,escaneo_error,recibe_nombre,firma_geo,firma_geo_motivo,diferencias,notas,lote_id,unidades_ingresadas,lineas_danadas,envio_finanzas,envio_finanzas_detalle,envio_finanzas_en,envio_finanzas_intentos,escaneada_por,contada_por,creada_en,contada_en,cancelada_por,cancelada_en,cancelada_motivo')
        .eq('id', id)
        .maybeSingle();
      if (e1) throw e1;
      if (!cab) {
        setRecepcion(null);
        setError('Esa recepción no existe o no es de esta empresa.');
        return;
      }
      const { data: lin, error: e2 } = await supabase
        .from('recepciones_lineas')
        .select('id,posicion,origen,fact_codigo,fact_descripcion,fact_cantidad,fact_unidad,fact_paquete,orden_linea_id,dominio,item_cod,factor,vinculo,accion,motivo_exclusion,cantidad_buena,cantidad_danada,unidades_ingresadas,movimiento_id,fotos_paths,nota')
        .eq('recepcion_id', id)
        .order('posicion');
      if (e2) throw e2;
      const c = cab as unknown as Record<string, unknown>;
      setRecepcion({
        ...(aResumen(c) as RecepcionResumen),
        ...(c as unknown as Omit<RecepcionDetalle, keyof RecepcionResumen | 'lineas'>),
        unidades_ingresadas: n(c.unidades_ingresadas),
        lineas_danadas: n(c.lineas_danadas),
        envio_finanzas_intentos: n(c.envio_finanzas_intentos),
        diferencias: Array.isArray(c.diferencias) ? (c.diferencias as Diferencia[]) : [],
        extraccion: (c.extraccion ?? null) as ExtraccionFactura | null,
        firma_geo: (c.firma_geo ?? null) as GeoFirma | null,
        lineas: (lin ?? []).map((l) => aLinea(l as Record<string, unknown>)),
      });
    } catch (e) {
      setError(`No se pudo leer la recepción: ${traducir(e)}`);
      setRecepcion(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { recepcion, loading, error, recargar: cargar };
}

/**
 * Lo aprendido de los proveedores: «este código de este proveedor es este
 * artículo nuestro». Es una tabla chica: se trae entera.
 */
export async function leerAprendidas(): Promise<Aprendida[]> {
  const { data, error } = await supabase
    .from('insumo_codigos_proveedor')
    .select('proveedor_rut,clave_tipo,clave,dominio,item_cod,factor')
    .limit(2000);
  if (error) return [];
  return (data ?? []).map((a) => ({
    ...(a as unknown as Aprendida),
    factor: a.factor == null ? null : Number(a.factor),
  }));
}

/**
 * El catálogo entero en su forma mínima, para emparejar sin orden y para el
 * buscador de artículos. Insumos y telas juntos, como los ve el bodeguero.
 */
export function useCatalogoCompras(activo = true): { catalogo: ArticuloCatalogo[]; loading: boolean } {
  const { empresaId } = useAuth();
  const [catalogo, setCatalogo] = useState<ArticuloCatalogo[]>([]);
  const [loading, setLoading] = useState(activo);

  useEffect(() => {
    if (!empresaId || !activo) {
      setLoading(false);
      return;
    }
    let vivo = true;
    void (async () => {
      const [ins, tel] = await Promise.all([
        supabase
          .from('insumos')
          .select('cod,nemotecnico,producto,cod_proveedor,descriptor_proveedor,can_x_paquete')
          .eq('empresa_id', empresaId)
          .limit(3000),
        supabase
          .from('telas_catalogo')
          .select('codigo,nemotecnico,descriptor,cod_ext,proveedor_codigo')
          .eq('empresa_id', empresaId)
          .limit(3000),
      ]);
      if (!vivo) return;
      const lista: ArticuloCatalogo[] = [];
      for (const i of ins.data ?? []) {
        if (!i.cod) continue;
        lista.push({
          dominio: 'insumo',
          cod: String(i.cod),
          nombre: String(i.nemotecnico || i.producto || i.cod),
          cod_proveedor: i.cod_proveedor ?? null,
          descriptor_proveedor: i.descriptor_proveedor ?? null,
          can_x_paquete: i.can_x_paquete ?? null,
        });
      }
      for (const t of tel.data ?? []) {
        if (!t.codigo) continue;
        lista.push({
          dominio: 'tela',
          cod: String(t.codigo),
          nombre: String(t.nemotecnico || t.descriptor || t.codigo),
          cod_proveedor: t.cod_ext || t.proveedor_codigo || null,
          descriptor_proveedor: t.descriptor ?? null,
        });
      }
      setCatalogo(lista);
      setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [empresaId, activo]);

  return { catalogo, loading };
}
