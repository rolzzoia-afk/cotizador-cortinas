// La plomería del reconocimiento por cámara: subir las fotos, hablar con la
// función `reconocer-articulo` y con las funciones de la base.
//
// Las reglas viven en `reconocimiento.ts` y la preparación de la foto en
// `reconocimientoImagen.ts`. Acá solo se habla con el servidor.
//
// El bucket es PRIVADO: las fotos se miran con URL firmadas de una hora.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  bandaDeSimilitud,
  mensajeErrorReconocimiento,
  type Candidato,
  type DominioReconocimiento,
  type Juicio,
  type ResultadoReconocimiento,
} from './reconocimiento';

const BUCKET = 'reconocimiento';
const FUNCION = 'reconocer-articulo';
const SEGUNDOS_URL = 3600;

/**
 * El motivo de verdad cuando una función Edge responde con error: el `error` de
 * supabase-js solo dice «respondió mal», y lo que escribió la función viene en
 * el cuerpo. Igual que en `recepcionStore.ts`.
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

async function invocar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCION, { body });
  if (error) throw new Error(mensajeErrorReconocimiento(await motivoDeFuncion(error)));
  const r = (data ?? {}) as { error?: string } & T;
  if (r.error) throw new Error(mensajeErrorReconocimiento(r.error));
  return r as T;
}

// ── Archivos ─────────────────────────────────────────────────────────

/**
 * Sube la foto y su miniatura. Se llama EN PARALELO con el reconocimiento: la
 * persona no espera la subida para ver los candidatos, y si al final no
 * confirma nada, la foto se borra.
 */
export async function subirFotoReconocimiento(
  path: string,
  foto: Blob,
  miniatura: Blob | null,
  pathMin?: string,
): Promise<void> {
  const subir = (p: string, b: Blob) =>
    supabase.storage.from(BUCKET).upload(p, b, {
      // Sin `upsert`: en Storage el upsert es un INSERT … ON CONFLICT y exige
      // una política de SELECT aparte (ver sql/20260821_fotos_telas_insumos_rls).
      upsert: false,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });

  const [r1] = await Promise.all([
    subir(path, foto),
    miniatura && pathMin ? subir(pathMin, miniatura) : Promise.resolve({ error: null }),
  ]);
  if (r1.error) throw new Error(`No se pudo guardar la foto: ${r1.error.message}`);
}

/** Saca del bucket una foto que no se llegó a usar. */
export async function borrarFotos(paths: Array<string | null | undefined>): Promise<void> {
  const limpias = paths.filter((p): p is string => !!p);
  if (limpias.length === 0) return;
  await supabase.storage.from(BUCKET).remove(limpias);
}

export async function urlFirmada(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SEGUNDOS_URL);
  return data?.signedUrl ?? null;
}

// ── Reconocer ────────────────────────────────────────────────────────

/** Despierta la función mientras la persona encuadra. Nunca falla hacia afuera. */
export async function calentarReconocimiento(): Promise<void> {
  try {
    await supabase.functions.invoke(FUNCION, { body: { accion: 'ping' } });
  } catch {
    /* si no se pudo, la primera consulta simplemente tarda un poco más */
  }
}

export async function reconocerFoto(
  dataUrl: string,
  dominio: DominioReconocimiento | null,
): Promise<ResultadoReconocimiento> {
  return invocar<ResultadoReconocimiento>({
    accion: 'reconocer',
    imagen_base64: dataUrl,
    dominio,
  });
}

/** La segunda opinión. Solo se llama cuando `reconocerFoto` devolvió `duda`. */
export async function juzgarFoto(
  reconocimientoId: string,
  dataUrl: string,
): Promise<{ candidatos: Candidato[]; juez: Juicio | null }> {
  return invocar<{ candidatos: Candidato[]; juez: Juicio | null }>({
    accion: 'juzgar',
    reconocimiento_id: reconocimientoId,
    imagen_base64: dataUrl,
  });
}

/**
 * Lo que eligió la persona. Con artículo elegido, la foto pasa a ser una
 * referencia más (la base copia la huella que ya se calculó: aprender no
 * cuesta). Sin artículo, se borra del bucket.
 */
export async function confirmarReconocimiento(
  id: string,
  eleccion: { dominio: DominioReconocimiento; cod: string } | null,
  path?: string | null,
  pathMin?: string | null,
): Promise<void> {
  // Los parámetros van como `undefined` y no como `null`: la función los tiene
  // con DEFAULT NULL, así que omitirlos es exactamente lo mismo.
  const { error } = await supabase.rpc('reconocimiento_confirmar', {
    p_id: id,
    p_dominio: eleccion?.dominio ?? undefined,
    p_elegido: eleccion?.cod ?? undefined,
    p_path: (eleccion && path) || undefined,
    p_path_min: (eleccion && pathMin) || undefined,
  });
  if (error) throw new Error(`No se pudo guardar tu elección: ${error.message}`);
  if (!eleccion) await borrarFotos([path, pathMin]);
}

// ── Enseñar ──────────────────────────────────────────────────────────

export async function indexarFoto(datos: {
  dominio: DominioReconocimiento;
  cod: string;
  path: string;
  pathMin?: string | null;
  angulo: string;
}): Promise<string | null> {
  const r = await invocar<{ foto_id?: string }>({
    accion: 'indexar',
    dominio: datos.dominio,
    cod: datos.cod,
    path: datos.path,
    path_min: datos.pathMin ?? null,
    angulo: datos.angulo,
  });
  return r.foto_id ?? null;
}

export type AvanceReindexado = {
  indexadas: number;
  pendientes: number;
  errores: number;
  /** Con texto: no está trabajando, está aguantando el límite por minuto. */
  esperando?: string;
};

/** Cuántas esperas seguidas se aguantan antes de rendirse y mostrar el motivo. */
const MAX_PAUSAS = 8;

/**
 * Indexa las fotos que los artículos YA tenían, de a lotes. Es el atajo para
 * empezar: nadie tiene que fotografiar de nuevo lo que ya estaba.
 *
 * El motor de huellas limita cuántas fotos acepta por minuto. Cuando avisa que
 * se pasó, esto NO se cae: espera lo que pide y sigue donde iba. Un catálogo
 * grande con una cuenta apretada demora, pero termina.
 */
export async function reindexarFichas(
  dominio: DominioReconocimiento,
  onProgreso?: (a: AvanceReindexado) => void,
): Promise<AvanceReindexado> {
  const total: AvanceReindexado = { indexadas: 0, pendientes: 0, errores: 0 };
  let pausas = 0;
  // Cuántas fotos rotas se dejaron atrás. El servidor no puede anotar que una
  // foto falló —no hay dónde—, así que sin esto la misma volvería a salir
  // primera cada vez y el reindexado se quedaría pegado en ella.
  let saltar = 0;
  // Tope de seguridad: 500 tandas, muy por encima del catálogo.
  for (let vuelta = 0; vuelta < 500; vuelta++) {
    const r = await invocar<{
      indexadas: number;
      pendientes: number;
      errores: Array<{ cod: string; motivo: string }>;
      esperar_ms?: number;
      motivo?: string;
    }>({ accion: 'reindexar-fichas', dominio, saltar });
    total.indexadas += r.indexadas ?? 0;
    total.errores += r.errores?.length ?? 0;
    total.pendientes = r.pendientes ?? 0;

    if (r.esperar_ms && total.pendientes > 0) {
      // Si espera y espera y nunca deja pasar una, no es congestión pasajera:
      // se muestra lo que dijo el motor, que es lo único que explica por qué.
      if (++pausas > MAX_PAUSAS) {
        throw new Error(r.motivo ?? 'El motor de reconocimiento no acepta más fotos por ahora.');
      }
      const seg = Math.max(1, Math.round(r.esperar_ms / 1000));
      onProgreso?.({ ...total, esperando: `Esperando ${seg} s — el motor no acepta más fotos por minuto` });
      await new Promise((res) => setTimeout(res, r.esperar_ms));
      continue;
    }

    pausas = 0;
    saltar += r.errores?.length ?? 0;
    onProgreso?.({ ...total });
    if (total.pendientes === 0) break;
    // Una tanda sin nada indexado y sin errores no puede pasar; si pasa, es que
    // algo no avanza y se corta para no dar vueltas sobre lo mismo.
    if ((r.indexadas ?? 0) === 0 && (r.errores?.length ?? 0) === 0) break;
  }
  return total;
}

// ── Las fotos de un artículo ─────────────────────────────────────────

export type FotoArticulo = {
  id: string;
  path: string;
  bucket: string | null;
  angulo: string;
  origen: 'enrolamiento' | 'ficha' | 'confirmacion';
  creada_en: string;
  creado_por_email: string | null;
  /** Lista para mostrar: firmada si está en el bucket, pública si es la ficha. */
  url: string | null;
};

type FilaFoto = {
  id: string;
  path: string;
  path_min: string | null;
  bucket: string | null;
  angulo: string;
  origen: FotoArticulo['origen'];
  creada_en: string;
  creado_por_email: string | null;
};

/**
 * Las fotos de referencia de un artículo. Se monta SOLO dentro de la pestaña
 * «Fotos»: el listado de insumos y el de telas no consultan esta tabla ni una
 * vez, para que abrirlos siga costando lo mismo que antes. Tampoco hay canal
 * Realtime; se recarga a mano después de enseñar o borrar.
 */
export function useFotosArticulo(
  dominio: DominioReconocimiento,
  cod: string,
): {
  fotos: FotoArticulo[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  borrar: (foto: FotoArticulo) => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [fotos, setFotos] = useState<FotoArticulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const codigo = cod.trim().toUpperCase();
    if (!empresaId || !codigo) {
      setFotos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('articulo_fotos')
        // Nunca `embedding`: son 1024 números por fila que el navegador no usa.
        .select('id, path, path_min, bucket, angulo, origen, creada_en, creado_por_email')
        .eq('empresa_id', empresaId)
        .eq('dominio', dominio)
        .eq('cod', codigo)
        .order('creada_en', { ascending: true });
      if (e) throw e;

      const filas = (data ?? []) as FilaFoto[];
      const delBucket = filas.filter((f) => f.bucket === BUCKET);
      const firmadas = new Map<string, string>();
      if (delBucket.length > 0) {
        const { data: urls } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(delBucket.map((f) => f.path_min ?? f.path), SEGUNDOS_URL);
        for (const u of urls ?? []) {
          if (u.path && u.signedUrl) firmadas.set(u.path, u.signedUrl);
        }
      }
      setFotos(
        filas.map((f) => ({
          id: f.id,
          path: f.path,
          bucket: f.bucket,
          angulo: f.angulo,
          origen: f.origen,
          creada_en: f.creada_en,
          creado_por_email: f.creado_por_email,
          url: f.bucket === BUCKET ? firmadas.get(f.path_min ?? f.path) ?? null : f.path,
        })),
      );
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      setError(msg ? `No se pudieron cargar las fotos: ${msg}` : 'No se pudieron cargar las fotos.');
      setFotos([]);
    } finally {
      setLoading(false);
    }
  }, [empresaId, dominio, cod]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const borrar = useCallback(
    async (foto: FotoArticulo) => {
      const { error: e } = await supabase.rpc('articulo_foto_borrar', { p_id: foto.id });
      if (e) throw new Error(`No se pudo borrar la foto: ${e.message}`);
      // El archivo solo se borra si era del bucket: la foto de la ficha vive en
      // otro lado y la sigue usando el catálogo.
      if (foto.bucket === BUCKET) await borrarFotos([foto.path, foto.path.replace(/\.jpg$/i, '_min.jpg')]);
      await cargar();
    },
    [cargar],
  );

  return { fotos, loading, error, recargar: cargar, borrar };
}

/**
 * Cómo viene acertando, para CALIBRAR los umbrales con datos y no a ojo. Solo
 * para el panel de Admin: mira las últimas consultas confirmadas y cuenta, por
 * banda, cuántas veces el primer candidato era el bueno.
 */
export async function aciertoPorBanda(
  empresaId: string,
): Promise<Array<{ banda: string; total: number; acertadas: number; msMediano: number }>> {
  const { data } = await supabase
    .from('reconocimientos')
    .select('sugerido, elegido, resultado, candidatos, ms_total')
    .eq('empresa_id', empresaId)
    .eq('resultado', 'confirmado')
    .order('creada_en', { ascending: false })
    .limit(300);

  const cubos = new Map<string, { total: number; acertadas: number; ms: number[] }>();
  for (const fila of (data ?? []) as Array<Record<string, unknown>>) {
    const lista = (fila.candidatos ?? []) as Array<{ cod?: string; similitud?: number }>;
    const primero = lista[0];
    if (!primero?.cod) continue;
    const banda = bandaDeSimilitud(Number(primero.similitud ?? 0));
    const cubo = cubos.get(banda) ?? { total: 0, acertadas: 0, ms: [] };
    cubo.total++;
    if (String(fila.elegido ?? '').toUpperCase() === String(primero.cod).toUpperCase()) {
      cubo.acertadas++;
    }
    const ms = Number(fila.ms_total ?? 0);
    if (ms > 0) cubo.ms.push(ms);
    cubos.set(banda, cubo);
  }

  return ['seguro', 'probable', 'dudoso'].map((banda) => {
    const c = cubos.get(banda) ?? { total: 0, acertadas: 0, ms: [] };
    const ordenados = [...c.ms].sort((a, b) => a - b);
    return {
      banda,
      total: c.total,
      acertadas: c.acertadas,
      msMediano: ordenados.length ? ordenados[Math.floor(ordenados.length / 2)] : 0,
    };
  });
}

export type ArticuloEnsenado = { cod: string; nombre: string; fotos: number };

/**
 * Qué artículos ya se pueden reconocer. Saber el número no sirve de nada si no
 * se sabe CUÁLES son: sin esta lista no hay con qué probar.
 *
 * Solo para el panel de Admin, y solo cuando se pide: el nombre no está en
 * `articulo_fotos` —ahí vive el código— y traerlo cuesta una consulta más.
 */
export async function articulosEnsenados(
  empresaId: string,
  dominio: DominioReconocimiento,
): Promise<ArticuloEnsenado[]> {
  const { data } = await supabase
    .from('articulo_fotos')
    .select('cod')
    .eq('empresa_id', empresaId)
    .eq('dominio', dominio);

  const cuenta = new Map<string, number>();
  for (const f of (data ?? []) as Array<{ cod: string }>) {
    const c = String(f.cod ?? '').toUpperCase();
    if (c) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  }
  const cods = [...cuenta.keys()].sort();
  if (cods.length === 0) return [];

  const tabla = dominio === 'tela' ? 'telas_catalogo' : 'insumos';
  const campo = dominio === 'tela' ? 'codigo' : 'cod';
  const nombres = new Map<string, string>();
  // De a 100: una lista muy larga en la URL termina en un 414 silencioso.
  for (let i = 0; i < cods.length; i += 100) {
    const { data: filas } = await supabase
      .from(tabla)
      .select(`${campo}, nemotecnico`)
      .eq('empresa_id', empresaId)
      .in(campo, cods.slice(i, i + 100));
    // Dos tablas con la columna de código distinta: el tipado generado no puede
    // resolver un `select` armado en tiempo de ejecución.
    for (const f of (filas ?? []) as unknown as Array<Record<string, unknown>>) {
      const c = String(f[campo] ?? '').toUpperCase();
      const n = String(f.nemotecnico ?? '').trim();
      if (c && n) nombres.set(c, n);
    }
  }

  return cods.map((cod) => ({ cod, nombre: nombres.get(cod) ?? cod, fotos: cuenta.get(cod) ?? 0 }));
}

/** Cuántas fotos tiene enseñadas cada artículo. Solo para el panel de Admin. */
export async function conteoFotos(
  empresaId: string,
): Promise<{ insumo: number; tela: number; consultas: number }> {
  const [ins, tel, rec] = await Promise.all([
    supabase.from('articulo_fotos').select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId).eq('dominio', 'insumo'),
    supabase.from('articulo_fotos').select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId).eq('dominio', 'tela'),
    supabase.from('reconocimientos').select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId),
  ]);
  return { insumo: ins.count ?? 0, tela: tel.count ?? 0, consultas: rec.count ?? 0 };
}
