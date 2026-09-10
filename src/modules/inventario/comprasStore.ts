// Plomería de Compras: leer las solicitudes y las órdenes, y llamar a las
// funciones de la base.
//
// Nada de lógica acá: las cuentas y las reglas viven en `compras.ts`, que se
// puede probar sin base. Esto solo trae datos y traduce errores.
//
// TODA ESCRITURA PASA POR UNA FUNCIÓN DE LA BASE. Las tablas de Compras no
// tienen permiso de escritura para nadie —igual que el kardex—, así que no hay
// forma de dejar una orden a medio recibir desde el navegador.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { LineaOrden, OrdenCompra, ProveedorCompra } from './compras';
import { mensajeErrorCompras } from './comprasMensajes';
import type { LineaParaRpc, LineaSolicitud, Solicitud } from './comprasSolicitud';

/** El error de Supabase con el código de la función ya traducido. */
function traducir(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  return mensajeErrorCompras(err?.code, err?.message);
}

// ── Solicitudes ──────────────────────────────────────────────────────

// Las listas de columnas van LITERALES dentro de cada `.select`, sin partirlas
// ni guardarlas en una constante: así el guardián `consultas.test.ts` puede
// leerlas y comprobar que existen de verdad en `database.ts`. Una columna
// inventada no rompe una fila: PostgREST rechaza la consulta entera y la
// pantalla queda en blanco.

type ResSolicitudes = {
  solicitudes: Solicitud[];
  abierta: Solicitud | null;
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
};

export function useSolicitudes(activo = true): ResSolicitudes {
  const { empresaId } = useAuth();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(activo);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId || !activo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: cabeceras, error: e1 } = await supabase
        .from('solicitudes_reposicion')
        .select('id,numero,estado,creada_por,creada_en,enviada_en,motivo_rechazo,error_envio,notas')
        .eq('empresa_id', empresaId)
        .order('creada_en', { ascending: false })
        .limit(60);
      if (e1) throw e1;

      const ids = (cabeceras ?? []).map((s) => s.id);
      let lineas: Record<string, unknown>[] = [];
      if (ids.length > 0) {
        const { data, error: e2 } = await supabase
          .from('solicitudes_reposicion_lineas')
          .select('id,solicitud_id,dominio,item_cod,nombre,unidad,cantidad,stock_al_pedir,minimo_al_pedir,proveedor_sugerido,motivo,oc_numero,estado_linea,orden')
          .in('solicitud_id', ids)
          .order('orden');
        if (e2) throw e2;
        lineas = data ?? [];
      }

      const porSolicitud = new Map<string, LineaSolicitud[]>();
      for (const l of lineas) {
        const sid = String(l.solicitud_id);
        const arr = porSolicitud.get(sid) ?? [];
        arr.push(l as unknown as LineaSolicitud);
        porSolicitud.set(sid, arr);
      }

      setSolicitudes(
        (cabeceras ?? []).map((s) => ({
          ...(s as unknown as Solicitud),
          lineas: porSolicitud.get(s.id) ?? [],
        })),
      );
      setLoading(false);
    } catch (e) {
      setError(`No se pudieron leer las solicitudes: ${traducir(e)}`);
      setSolicitudes([]);
      setLoading(false);
    }
  }, [empresaId, activo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return {
    solicitudes,
    abierta: solicitudes.find((s) => s.estado === 'borrador') ?? null,
    loading,
    error,
    recargar: cargar,
  };
}

/**
 * «Pedir reposición», desde Alertas, el catálogo o la ficha. Suma a la
 * solicitud que está abierta o la crea. Devuelve el número para el aviso.
 */
export async function sumarASolicitud(
  lineas: LineaParaRpc[],
): Promise<{ numero: string; creada: boolean; nuevas: number; sumadas: number }> {
  const { data, error } = await supabase.rpc('solicitud_abrir_o_sumar', {
    p_lineas: lineas as unknown as never,
  });
  if (error) throw new Error(traducir(error));
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    numero: String(r.numero ?? ''),
    creada: r.creada === true,
    nuevas: Number(r.lineas_nuevas ?? 0),
    sumadas: Number(r.lineas_sumadas ?? 0),
  };
}

export async function quitarLineaSolicitud(lineaId: string): Promise<{ borrada: boolean }> {
  const { data, error } = await supabase.rpc('solicitud_quitar_linea', { p_linea_id: lineaId });
  if (error) throw new Error(traducir(error));
  const r = (data ?? {}) as Record<string, unknown>;
  return { borrada: r.solicitud_borrada === true };
}

export async function cancelarSolicitud(solicitudId: string, motivo?: string): Promise<void> {
  const { error } = await supabase.rpc('solicitud_cancelar', {
    p_solicitud_id: solicitudId,
    p_motivo: motivo ?? '',
  });
  if (error) throw new Error(traducir(error));
}

/**
 * Manda la solicitud a Gerencia.
 *
 * Hoy `destino` vuelve `'local'`: Finanzas no tiene bandeja de pedidos de
 * bodega, así que «enviada» quiere decir que Gerencia la abre en Compras →
 * Solicitudes. El día que Finanzas tenga dónde recibirla vuelve `'finanzas'`
 * con su identificador, y si en ese momento no contesta, la solicitud se queda
 * en borrador con el motivo escrito y se puede reintentar.
 */
export async function enviarSolicitud(
  solicitudId: string,
): Promise<{ numero: string; lineas: number; destino: string; aviso: string }> {
  const { data, error } = await supabase.functions.invoke('enviar-solicitud-finanzas', {
    body: { solicitud_id: solicitudId },
  });
  if (error) {
    // El cuerpo del error trae el motivo de verdad; el `error` a secas solo
    // dice que el servidor respondió mal.
    const cuerpo = (data ?? {}) as { error?: string };
    throw new Error(cuerpo.error || error.message);
  }
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.error) throw new Error(String(r.error));
  return {
    numero: String(r.numero ?? ''),
    lineas: Number(r.lineas ?? 0),
    destino: String(r.destino ?? 'local'),
    aviso: String(r.aviso ?? ''),
  };
}

// ── Órdenes de compra ────────────────────────────────────────────────

type ResOrdenes = {
  ordenes: OrdenCompra[];
  ultimaSync: string | null;
  errorSync: string | null;
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
};

export function useOrdenesCompra(activo = true): ResOrdenes {
  const { empresaId } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [errorSync, setErrorSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(activo);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId || !activo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rOrd, rSync] = await Promise.all([
        supabase
          .from('ordenes_compra')
          .select('id,numero,estado,estado_finanzas,anulada,aprobada_en,aprobada_por,fecha_emision,fecha_esperada,proveedor_rut,proveedor_nombre,solicitado_por,solicitud_ref,guia,factura_folio,factura_tipo,comentarios,conflicto,cerrada_motivo')
          .eq('empresa_id', empresaId)
          .order('aprobada_en', { ascending: false })
          .limit(300),
        supabase
          .from('ordenes_compra_sync')
          .select('fin,ok,error')
          .eq('empresa_id', empresaId)
          .order('inicio', { ascending: false })
          .limit(1),
      ]);
      if (rOrd.error) throw rOrd.error;

      const ids = (rOrd.data ?? []).map((o) => o.id);
      let lineas: Record<string, unknown>[] = [];
      // Un `.in()` con más de 200 identificadores da un 414 que no siempre se
      // ve como error: se pide por tandas.
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error: eL } = await supabase
          .from('ordenes_compra_lineas')
          .select('id,orden_id,posicion,codigo_interno,codigo_proveedor,descripcion,cantidad_pedida,unidad,dominio,item_cod,factor,vinculo,cantidad_recibida,estado_linea,conflicto,nota')
          .in('orden_id', ids.slice(i, i + 150))
          .order('posicion');
        if (eL) throw eL;
        lineas.push(...(data ?? []));
      }

      const porOrden = new Map<string, LineaOrden[]>();
      for (const l of lineas) {
        const oid = String(l.orden_id);
        const arr = porOrden.get(oid) ?? [];
        arr.push(l as unknown as LineaOrden);
        porOrden.set(oid, arr);
      }

      setOrdenes(
        (rOrd.data ?? []).map((o) => ({
          ...(o as unknown as OrdenCompra),
          lineas: porOrden.get(o.id) ?? [],
        })),
      );
      const ultima = rSync.data?.[0];
      setUltimaSync(ultima?.fin ?? null);
      setErrorSync(ultima && ultima.ok === false ? (ultima.error ?? 'falló') : null);
      setLoading(false);
    } catch (e) {
      setError(`No se pudieron leer las órdenes: ${traducir(e)}`);
      setOrdenes([]);
      setLoading(false);
    }
  }, [empresaId, activo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { ordenes, ultimaSync, errorSync, loading, error, recargar: cargar };
}

export type ResultadoSync = {
  nuevas: number;
  actualizadas: number;
  lineas: number;
  vinculadas: number;
  solicitudes?: number;
  /** Solo en modo prueba: lo que llegaría, sin escribir nada. */
  modo?: string;
  ordenes?: number;
};

/**
 * Le pregunta a Finanzas por sus órdenes. Con `probar` devuelve lo que traería
 * sin escribir nada, que es para el primer día: confirmar que el contrato
 * calza antes de meter datos.
 */
export async function sincronizarOrdenes(modo?: 'probar'): Promise<ResultadoSync> {
  const { data, error } = await supabase.functions.invoke('sincronizar-ordenes-compra', {
    body: modo ? { modo } : {},
  });
  if (error) {
    const cuerpo = (data ?? {}) as { error?: string };
    throw new Error(cuerpo.error || error.message);
  }
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.error) throw new Error(String(r.error));
  return {
    nuevas: Number(r.nuevas ?? 0),
    actualizadas: Number(r.actualizadas ?? 0),
    lineas: Number(r.lineas ?? 0),
    vinculadas: Number(r.vinculadas ?? 0),
    solicitudes: Number(r.solicitudes ?? 0),
    modo: r.modo ? String(r.modo) : undefined,
    ordenes: r.ordenes != null ? Number(r.ordenes) : undefined,
  };
}

export async function vincularLinea(
  lineaId: string,
  dominio: 'insumo' | 'tela',
  itemCod: string,
  factor = 1,
  aprender = true,
): Promise<void> {
  const { error } = await supabase.rpc('oc_vincular_linea', {
    p_linea_id: lineaId,
    p_dominio: dominio,
    p_item_cod: itemCod,
    p_factor: factor,
    p_aprender: aprender,
  });
  if (error) throw new Error(traducir(error));
}

export async function cerrarOrden(ordenId: string, motivo: string): Promise<number> {
  const { data, error } = await supabase.rpc('oc_cerrar', {
    p_orden_id: ordenId,
    p_motivo: motivo,
  });
  if (error) throw new Error(traducir(error));
  return Number((data as Record<string, unknown> | null)?.lineas_aceptadas ?? 0);
}

// ── Proveedores ──────────────────────────────────────────────────────

export function useProveedoresCompras(activo = true): {
  proveedores: ProveedorCompra[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [proveedores, setProveedores] = useState<ProveedorCompra[]>([]);
  const [loading, setLoading] = useState(activo);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId || !activo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('proveedores')
      .select('id,rut,razon_social,nombre,alias,activo')
      .eq('empresa_id', empresaId)
      .order('razon_social');
    if (e) {
      setError(`No se pudieron leer los proveedores: ${traducir(e)}`);
      setProveedores([]);
    } else {
      setProveedores((data ?? []) as unknown as ProveedorCompra[]);
    }
    setLoading(false);
  }, [empresaId, activo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { proveedores, loading, error, recargar: cargar };
}

/**
 * Los alias son lo ÚNICO que se edita a mano de un proveedor: «en nuestros
 * artículos este se llama SINFLEX». Lo demás lo trae Finanzas y se pisaría en
 * la siguiente sincronización.
 */
export async function guardarAliasProveedor(id: string, alias: string[]): Promise<void> {
  const limpios = [...new Set(alias.map((a) => a.trim().toUpperCase()).filter(Boolean))];
  const { error } = await supabase
    .from('proveedores')
    .update({ alias: limpios, actualizado_en: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(traducir(error));
}
