// Subida y borrado de las fotos referenciales del informe de visita.
//
// Van al bucket PÚBLICO `informe-assets` (ver sql/20260820_informe_assets.sql):
// terminan como `<img src>` dentro de un correo que le llega al cliente, y una
// URL firmada se vencería a la hora dejando el correo con la foto rota. No son
// datos de nadie: son fotos referenciales de producto, las mismas que hoy se
// adjuntan a mano.
//
// Se comprimen con el mismo `comprimirFoto` de la visita (1920 px, JPEG 0,85,
// con caída al original si el navegador no sabe abrir el formato).
import { supabase } from '@/lib/supabase';
import { comprimirFoto } from './imagen';
import { BUCKET_INFORME, pathDeUrlPublica } from './imagenesInforme';

/** Sufijo aleatorio: dos fotos subidas en el mismo milisegundo no se pisan. */
const sufijo = () => Math.random().toString(36).slice(2, 8);

/**
 * Sube una foto y devuelve su URL pública.
 *
 * `grupo` solo ordena la carpeta (`intro-duo`, `bloque-rodapie`, `tela-DU39`):
 * el archivo se identifica por su nombre único, así que reemplazar una foto
 * nunca pisa la anterior de otro texto.
 */
export async function subirFotoInforme(
  empresaId: string,
  grupo: string,
  file: File,
): Promise<string> {
  const { blob, contentType, ext } = await comprimirFoto(file);
  const carpeta = (grupo || 'general').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 40);
  const path = `${empresaId}/${carpeta}/${Date.now()}-${sufijo()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET_INFORME)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_INFORME).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('No se pudo obtener la URL pública de la foto.');
  return data.publicUrl;
}

/**
 * Borra el archivo de una foto del bucket. Una URL que no sea de este bucket se
 * ignora en silencio: se quitó de la lista y con eso basta, no es nuestra.
 *
 * No lanza: quedarse con un archivo huérfano es preferible a dejar la pantalla
 * de Admin trabada por un permiso de storage.
 */
export async function borrarFotoInforme(url: string): Promise<void> {
  const path = pathDeUrlPublica(url);
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET_INFORME).remove([path]);
  if (error) console.warn('[Informe visita] No se pudo borrar la foto:', error.message);
}
