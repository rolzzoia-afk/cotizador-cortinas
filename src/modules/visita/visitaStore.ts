// Subida y lectura de los archivos de la visita, y la llamada a la Edge
// Function que redacta el informe.
//
// El bucket `visitas` es PRIVADO: nada de `getPublicUrl`. Para mostrar el video
// o la firma se pide una URL firmada de corta vida. La política RLS exige que
// la primera carpeta del path sea el empresa_id (sql/20260819_visitas…sql).
import { supabase } from '@/lib/supabase';

export const BUCKET_VISITAS = 'visitas';

/** Vida de las URL firmadas que se le pasan al `<video>`/`<img>` (1 hora). */
const SEGUNDOS_URL_FIRMADA = 3600;

const extension = (nombre: string, porDefecto: string) => {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? '';
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : porDefecto;
};

async function subir(path: string, cuerpo: Blob | File, contentType: string): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET_VISITAS)
    .upload(path, cuerpo, { upsert: true, contentType, cacheControl: '3600' });
  if (error) throw error;
  return path;
}

export function subirVideoVisita(empresaId: string, otId: string, file: File): Promise<string> {
  const ext = extension(file.name, 'mp4');
  return subir(
    `${empresaId}/${otId}/video-${Date.now()}.${ext}`,
    file,
    file.type || 'video/mp4',
  );
}

export function subirAudioVisita(empresaId: string, otId: string, wav: Blob): Promise<string> {
  return subir(`${empresaId}/${otId}/audio-${Date.now()}.wav`, wav, 'audio/wav');
}

export function subirFirmaVisita(empresaId: string, otId: string, png: Blob): Promise<string> {
  return subir(`${empresaId}/${otId}/firma-${Date.now()}.png`, png, 'image/png');
}

/**
 * Sube una foto de la visita. El sufijo aleatorio evita que dos fotos elegidas
 * en la misma tanda —que se suben dentro del mismo milisegundo— se pisen entre
 * sí por compartir el `Date.now()`.
 */
export function subirFotoVisita(
  empresaId: string,
  otId: string,
  foto: Blob,
  ext = 'jpg',
  contentType = 'image/jpeg',
): Promise<string> {
  const sufijo = Math.random().toString(36).slice(2, 8);
  return subir(`${empresaId}/${otId}/foto-${Date.now()}-${sufijo}.${ext}`, foto, contentType);
}

/** Borra un archivo de la visita (una foto que se subió por equivocación). */
export async function borrarArchivoVisita(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_VISITAS).remove([path]);
  if (error) throw error;
}

/** URL temporal para mostrar un archivo del bucket privado. */
export async function urlFirmadaVisita(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_VISITAS)
    .createSignedUrl(path, SEGUNDOS_URL_FIRMADA);
  if (error) {
    console.warn('[Visita] No se pudo firmar la URL:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * URL firmadas de varios archivos en UNA sola llamada.
 *
 * Las miniaturas de las fotos se piden todas juntas: con `createSignedUrl` por
 * foto, veinte fotos eran veinte viajes al servidor. Devuelve un mapa
 * path → URL; los que fallen simplemente no aparecen.
 */
export async function urlsFirmadasVisita(paths: string[]): Promise<Record<string, string>> {
  const limpios = paths.filter(Boolean);
  if (limpios.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(BUCKET_VISITAS)
    .createSignedUrls(limpios, SEGUNDOS_URL_FIRMADA);
  if (error) {
    console.warn('[Visita] No se pudieron firmar las URL:', error.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out[item.path] = item.signedUrl;
  }
  return out;
}

export type InformeGenerado = { transcripcion: string; informe: string };

/**
 * Transcribe el audio de la visita y pide el informe redactado.
 *
 * Todo el trabajo pesado (y las claves) viven en la Edge Function: el navegador
 * solo manda el path del audio que ya subió, más el ESQUELETO con la estructura
 * y los datos reales de la orden (los arma el cliente, que es donde viven los
 * tipos del cotizador) para que el modelo complete en vez de inventar.
 */
export async function generarInformeVisita(
  otId: string,
  audioPath: string,
  esqueleto?: string,
): Promise<InformeGenerado> {
  const { data, error } = await supabase.functions.invoke<
    InformeGenerado & { error?: string }
  >('informe-visita', { body: { otId, audioPath, esqueleto } });
  if (error) {
    // El cuerpo del error trae el mensaje útil de la función; el `error` de
    // supabase-js solo dice "non-2xx status code".
    const detalle = await (error as { context?: { json?: () => Promise<{ error?: string }> } })
      .context?.json?.()
      .then((j) => j?.error)
      .catch(() => undefined);
    throw new Error(detalle || error.message);
  }
  if (!data || data.error) throw new Error(data?.error || 'La función no devolvió el informe');
  return { transcripcion: data.transcripcion ?? '', informe: data.informe ?? '' };
}
