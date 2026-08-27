// ─────────────────────────────────────────────────────────────────────
// La imagen de la tira de proyectos que sube el administrador.
//
// La tira de fábrica salió del Excel manual: el original pesaba 1,8 MB y se
// guardó reducida a 1400 × 150 en JPEG, 48 KB. Una foto recién sacada del
// teléfono pesa eso o más, y jsPDF la EMBEBE entera en el archivo: un par de
// megas ahí dentro convierten la cotización en algo impresentable para mandar
// por WhatsApp. Por eso la imagen se reduce y se recomprime EN EL NAVEGADOR
// antes de subirla.
//
// De paso se mide su proporción, que es justo lo que el PDF necesita para
// reservarle el alto sin deformarla (`medidasTira` en `pdfCotizacion.ts`).
//
// JPEG a propósito: la tira va sobre papel blanco, no necesita transparencia y
// en PNG pesaría de más. El fondo se pinta blanco antes de dibujar, porque un
// PNG con alfa aplanado a JPEG sale con el fondo negro.
// ─────────────────────────────────────────────────────────────────────

/** Más ancho que esto no aporta nada: la tira se imprime a 194 mm de ancho. */
export const ANCHO_MAX_TIRA_PX = 1600;

const CALIDAD_JPEG = 0.82;

/**
 * Medidas a las que se reduce la imagen conservando la proporción. Una imagen
 * que ya viene chica no se agranda: se sube tal cual.
 */
export function medidasReducidas(
  ancho: number,
  alto: number,
  maxAncho: number = ANCHO_MAX_TIRA_PX,
): { ancho: number; alto: number } {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) {
    return { ancho: 0, alto: 0 };
  }
  if (ancho <= maxAncho) return { ancho: Math.round(ancho), alto: Math.round(alto) };
  return { ancho: maxAncho, alto: Math.max(1, Math.round((alto * maxAncho) / ancho)) };
}

export type TiraPreparada = {
  /** El archivo liviano que se sube al bucket. */
  archivo: File;
  /** Proporción ancho/alto de la imagen ORIGINAL. */
  ratio: number;
  /** Peso final, para poder avisar cuánto quedó. */
  bytes: number;
};

/** Carga el archivo en un `<img>` para poder medirlo y redibujarlo. */
function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = url;
  });
}

/**
 * Reduce, recomprime y mide la imagen elegida por el admin. Devuelve el
 * archivo que hay que subir y su proporción.
 */
export async function prepararImagenTira(file: File): Promise<TiraPreparada> {
  const img = await cargarImagen(file);
  const anchoReal = img.naturalWidth || img.width;
  const altoReal = img.naturalHeight || img.height;
  const destino = medidasReducidas(anchoReal, altoReal);
  if (!destino.ancho || !destino.alto) throw new Error('La imagen no tiene medidas válidas.');

  const canvas = document.createElement('canvas');
  canvas.width = destino.ancho;
  canvas.height = destino.alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, destino.ancho, destino.alto);
  ctx.drawImage(img, 0, 0, destino.ancho, destino.alto);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG),
  );
  if (!blob) throw new Error('El navegador no pudo comprimir la imagen.');

  return {
    archivo: new File([blob], 'tira-proyectos.jpg', { type: 'image/jpeg' }),
    ratio: anchoReal / altoReal,
    bytes: blob.size,
  };
}
