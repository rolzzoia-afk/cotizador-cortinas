// ─────────────────────────────────────────────────────────────────────
// LAS FOTOS DE LA VISITA.
//
// Una foto de teléfono moderno pesa entre 3 y 12 MB. En terreno, con datos
// móviles, subir diez de esas es una eternidad — y para dejar constancia de
// cómo estaba la ventana no hace falta el original a tamaño completo. Acá se
// achican en el navegador antes de subirlas, igual que el audio del video.
//
// Regla que no se rompe: si algo falla al comprimir (un HEIC de iPhone que el
// navegador no sabe abrir, o una foto que ya venía chica), se sube el ORIGINAL.
// Nunca se pierde una foto por culpa del optimizador.
//
// `dimensionesEscaladas` es pura (sin canvas) para poder testearla.
// ─────────────────────────────────────────────────────────────────────

/** Lado mayor al que se reduce una foto. Suficiente para ver detalles del muro. */
export const LADO_MAX_FOTO = 1920;

/** Calidad JPEG de la foto comprimida. */
const CALIDAD_JPEG = 0.85;

/** Máximo de fotos por visita: más que esto es un álbum, no un respaldo. */
export const MAX_FOTOS_VISITA = 20;

/**
 * Tamaño destino conservando la proporción: el lado MAYOR baja a `maxLado`.
 * Una foto que ya es más chica se deja tal cual — agrandarla solo sumaría peso
 * sin agregar un solo detalle.
 */
export function dimensionesEscaladas(
  ancho: number,
  alto: number,
  maxLado: number = LADO_MAX_FOTO,
): { ancho: number; alto: number } {
  if (!(ancho > 0) || !(alto > 0)) return { ancho: 0, alto: 0 };
  const mayor = Math.max(ancho, alto);
  if (mayor <= maxLado) return { ancho: Math.round(ancho), alto: Math.round(alto) };
  const factor = maxLado / mayor;
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor) };
}

export type FotoComprimida = { blob: Blob; contentType: string; ext: string };

/** Extensión utilizable del nombre del archivo, o `porDefecto`. */
function extensionDe(nombre: string, porDefecto: string): string {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? '';
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : porDefecto;
}

const original = (file: File): FotoComprimida => ({
  blob: file,
  contentType: file.type || 'image/jpeg',
  ext: extensionDe(file.name, 'jpg'),
});

/**
 * Achica una foto a JPEG de lado máximo `LADO_MAX_FOTO`.
 *
 * Devuelve el ORIGINAL cuando el navegador no puede decodificarla o cuando el
 * resultado no pesa menos (fotos ya optimizadas, capturas de pantalla PNG con
 * pocos colores): comprimir para engordar no tiene sentido.
 */
export async function comprimirFoto(file: File): Promise<FotoComprimida> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return original(file);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC/HEIF de iPhone y formatos exóticos: viajan como vinieron.
    return original(file);
  }
  try {
    const { ancho, alto } = dimensionesEscaladas(bitmap.width, bitmap.height);
    if (ancho === 0 || alto === 0) return original(file);
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original(file);
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG),
    );
    if (!blob || blob.size >= file.size) return original(file);
    return { blob, contentType: 'image/jpeg', ext: 'jpg' };
  } catch {
    return original(file);
  } finally {
    bitmap.close?.();
  }
}
