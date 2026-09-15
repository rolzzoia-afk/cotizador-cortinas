// Plomería de la recepción: subir el papel y las fotos, leerlo con la función
// `escanear-factura`, y llamar a las funciones de la base que abren, cuentan y
// descartan una recepción.
//
// Las cuentas viven en `recepcion*.ts`. Acá solo se habla con la base. Las
// lecturas están en `recepcionesLecturaStore.ts`.
//
// Los archivos van a un bucket PRIVADO: una factura trae montos, y los montos
// no se le muestran al taller. Se ven con URL firmadas de una hora.

import { supabase } from '@/lib/supabase';
import { comprimirFoto } from '@/modules/visita/imagen';
import { mensajeErrorCompras } from './comprasMensajes';
import { rutaArchivoRecepcion, type TipoDocumento } from './recepcion';
import type { Diferencia } from './recepcionDiferencias';
import type { ExtraccionFactura } from './recepcionFactura';
import type { GeoFirma } from '@/modules/ots/types';

const BUCKET = 'docs-recepciones';
const SEGUNDOS_URL = 3600;

function traducir(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  return mensajeErrorCompras(err?.code, err?.message);
}

/**
 * El motivo de verdad cuando una función Edge responde con error. El `error`
 * de supabase-js solo dice «respondió mal»; lo que escribió la función viene
 * en el cuerpo de la respuesta.
 */
async function motivoDeFuncion(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const cuerpo = (await ctx.clone().json()) as { error?: string };
      if (cuerpo?.error) return String(cuerpo.error);
    } catch {
      /* el cuerpo no era JSON: queda el mensaje genérico */
    }
  }
  return error instanceof Error ? error.message : String(error);
}

// ── Archivos ─────────────────────────────────────────────────────────

/**
 * Sube el papel. Una foto se achica antes (una de teléfono pesa 3 a 12 MB y
 * para leerla alcanza con 1920 px); un PDF o un HEIC viajan como vinieron.
 * Se sube ANTES de leerlo: si la lectura falla, el papel igual queda guardado.
 */
export async function subirDocumentoRecepcion(
  empresaId: string,
  carpeta: string,
  archivo: File,
): Promise<{ path: string; mime: string }> {
  const esPdf = archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name);
  const { blob, contentType, ext } = esPdf
    ? { blob: archivo as Blob, contentType: 'application/pdf', ext: 'pdf' }
    : await comprimirFoto(archivo);
  const path = rutaArchivoRecepcion(empresaId, carpeta, `documento.${ext}`);
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    // Sin `upsert`: el bucket no deja reemplazar ni borrar desde el navegador.
    upsert: false,
    contentType,
    cacheControl: '3600',
  });
  if (error) throw new Error(`No se pudo subir el documento: ${error.message}`);
  return { path, mime: contentType };
}

/** La foto de un problema en una línea (una caja rota, una etiqueta distinta). */
export async function subirFotoLinea(empresaId: string, recepcionId: string, archivo: File): Promise<string> {
  const { blob, contentType, ext } = await comprimirFoto(archivo);
  const path = rutaArchivoRecepcion(empresaId, `recepciones/${recepcionId}`, `foto.${ext}`);
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: false,
    contentType,
    cacheControl: '3600',
  });
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`);
  return path;
}

export async function urlFirmadaDocumento(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SEGUNDOS_URL);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ── La lectura ───────────────────────────────────────────────────────

/**
 * Le pide a la función `escanear-factura` que lea el papel ya subido. No
 * guarda nada: lo leído se revisa en pantalla y recién se guarda al abrir la
 * recepción.
 */
export async function escanearFactura(path: string): Promise<{ extraccion: ExtraccionFactura; modelo: string }> {
  const { data, error } = await supabase.functions.invoke('escanear-factura', { body: { path } });
  if (error) throw new Error(await motivoDeFuncion(error));
  const r = (data ?? {}) as { extraccion?: ExtraccionFactura; modelo?: string; error?: string };
  if (r.error) throw new Error(r.error);
  if (!r.extraccion) throw new Error('La lectura no devolvió nada.');
  return { extraccion: r.extraccion, modelo: String(r.modelo ?? '') };
}

// ── Las funciones de la base ─────────────────────────────────────────

export type DocumentoAbrir = {
  tipo: TipoDocumento;
  numero: string;
  fecha?: string | null;
  path: string;
  mime?: string | null;
  proveedor_rut?: string | null;
  proveedor_nombre?: string | null;
  escaneo_error?: string | null;
};

/** Guarda el papel revisado: la recepción queda POR CONTAR. No toca el stock. */
export async function abrirRecepcion(
  ordenId: string | null,
  documento: DocumentoAbrir,
  lineas: Array<Record<string, unknown>>,
  extraccion: ExtraccionFactura | null,
  modelo: string | null,
): Promise<{ recepcionId: string; numero: string; avisos: string[] }> {
  const { data, error } = await supabase.rpc('recepcion_abrir', {
    // `null` = sin orden; la base solo se lo permite a un administrador.
    p_orden_id: ordenId as string,
    p_documento: {
      ...documento,
      numero: documento.numero.trim(),
      fecha: documento.fecha || null,
    } as never,
    p_lineas: lineas as never,
    p_extraccion: (extraccion ?? null) as never,
    p_modelo: modelo ?? undefined,
  });
  if (error) throw new Error(traducir(error));
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    recepcionId: String(r.recepcion_id ?? ''),
    numero: String(r.numero ?? ''),
    avisos: Array.isArray(r.avisos) ? r.avisos.map(String) : [],
  };
}

export type FirmaRecepcion = {
  recibe: string;
  /** PNG en base64 (`data:image/png;base64,…`), como la firma de Despacho. */
  firma: string;
  geo?: GeoFirma | null;
  geoMotivo?: string | null;
  notas?: string | null;
};

export type ResultadoConfirmar = {
  numero: string;
  resultado: string;
  lineas: number;
  unidades: number;
  danadas: number;
  estadoOrden: string | null;
};

/** El conteo firmado: lo bueno entra al stock, todo junto o nada. */
export async function confirmarRecepcion(
  recepcionId: string,
  firma: FirmaRecepcion,
  lineas: Array<Record<string, unknown>>,
  diferencias: Diferencia[],
): Promise<ResultadoConfirmar> {
  const { data, error } = await supabase.rpc('recepcion_confirmar', {
    p_recepcion_id: recepcionId,
    p_firma: {
      recibe: firma.recibe.trim(),
      firma: firma.firma,
      geo: firma.geo ?? null,
      geo_motivo: firma.geoMotivo ?? null,
      notas: firma.notas?.trim() || null,
    } as never,
    p_lineas: lineas as never,
    p_diferencias: diferencias as never,
  });
  if (error) throw new Error(traducir(error));
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    numero: String(r.numero ?? ''),
    resultado: String(r.resultado ?? ''),
    lineas: Number(r.lineas ?? 0),
    unidades: Number(r.unidades ?? 0),
    danadas: Number(r.danadas ?? 0),
    estadoOrden: r.estado_orden ? String(r.estado_orden) : null,
  };
}

/** Descarta una recepción que todavía no se contó. El papel se queda guardado. */
export async function cancelarRecepcion(recepcionId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('recepcion_cancelar', {
    p_recepcion_id: recepcionId,
    p_motivo: motivo,
  });
  if (error) throw new Error(traducir(error));
}

/**
 * Le manda la recepción contada a Gerencia (la bandeja de Rolzzo-Finanzas).
 * La marca «enviada» la pone la función, y solo con el acuse de Finanzas en la
 * mano: la app nunca da por enviado algo que no llegó.
 */
export async function enviarRecepcionFinanzas(recepcionId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('enviar-recepcion-finanzas', {
    body: { recepcion_id: recepcionId },
  });
  if (error) throw new Error(await motivoDeFuncion(error));
  const r = (data ?? {}) as { error?: string };
  if (r.error) throw new Error(r.error);
}

/** La firma se pide aparte: pesa varios KB y casi nunca se mira. */
export async function firmaDeRecepcion(recepcionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('recepciones')
    .select('firma_png')
    .eq('id', recepcionId)
    .maybeSingle();
  if (error) throw new Error(traducir(error));
  return data?.firma_png ?? null;
}
