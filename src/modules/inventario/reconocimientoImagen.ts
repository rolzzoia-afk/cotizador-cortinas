// ─────────────────────────────────────────────────────────────────────
// CÓMO SE PREPARA UNA FOTO ANTES DE RECONOCERLA.
//
// Tres cosas, y las tres son de rendimiento:
//
// 1. SE ACHICA A 1024 px. El motor de huellas cobra por píxel y no mejora con
//    más resolución; y de paso la foto viaja en ~150 KB, que en la bodega con
//    datos móviles es la diferencia entre dos segundos y diez.
//
// 2. LA TELA SE RECORTA CUADRADA, POR EL CENTRO. Una tela es un color y una
//    textura: si en la foto entra medio galpón de fondo, la huella describe el
//    galpón. El insumo NO se recorta —su forma completa es justamente lo que lo
//    identifica—.
//
// 3. SE SACA UNA MINIATURA DE 256 px del mismo bitmap. Es la que se muestra en
//    listas y candidatos: pesa ~15 KB en vez de ~150 KB.
//
// Regla heredada de `comprimirFoto`: si algo falla (un HEIC de iPhone que el
// navegador no sabe abrir), se sigue con el original. Nunca se pierde la foto
// por culpa del optimizador.
//
// `medidasParaEmbedding` es pura (sin canvas) para poder probarla.
// ─────────────────────────────────────────────────────────────────────

import { comprimirFoto, dimensionesEscaladas } from '@/modules/visita/imagen';
import type { DominioReconocimiento } from './reconocimiento';

/** Lado mayor con el que viaja la foto al motor de huellas. */
export const LADO_EMBEDDING = 1024;
/** Lado mayor de la miniatura que se muestra en pantalla. */
export const LADO_MINIATURA = 256;

const CALIDAD_FOTO = 0.8;
const CALIDAD_MINIATURA = 0.7;

export type Recorte = {
  /** Qué parte del original se toma. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** A qué tamaño se dibuja. */
  ancho: number;
  alto: number;
};

/**
 * Qué parte de la foto se usa y a qué tamaño queda.
 *
 * La tela sale cuadrada desde el centro (el encuadre que se le pide a la
 * persona: «que la tela llene el cuadro»); el insumo entero.
 */
export function medidasParaEmbedding(
  anchoOrig: number,
  altoOrig: number,
  dominio: DominioReconocimiento,
  ladoMax: number = LADO_EMBEDDING,
): Recorte {
  if (!(anchoOrig > 0) || !(altoOrig > 0)) {
    return { sx: 0, sy: 0, sw: 0, sh: 0, ancho: 0, alto: 0 };
  }
  if (dominio === 'tela') {
    const lado = Math.min(anchoOrig, altoOrig);
    const destino = Math.min(lado, ladoMax);
    return {
      sx: Math.round((anchoOrig - lado) / 2),
      sy: Math.round((altoOrig - lado) / 2),
      sw: lado,
      sh: lado,
      ancho: Math.round(destino),
      alto: Math.round(destino),
    };
  }
  const { ancho, alto } = dimensionesEscaladas(anchoOrig, altoOrig, ladoMax);
  return { sx: 0, sy: 0, sw: anchoOrig, sh: altoOrig, ancho, alto };
}

export type FotoPreparada = {
  /** La que se guarda como referencia y la que viaja al motor. */
  foto: Blob;
  /** La que se muestra en pantalla. `null` si no se pudo generar. */
  miniatura: Blob | null;
  /** La misma foto en `data:image/jpeg;base64,…`, que es como viaja. */
  dataUrl: string;
};

function dibujar(bitmap: ImageBitmap, r: Recorte, calidad: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = r.ancho;
  canvas.height = r.alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, r.ancho, r.alto);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad));
}

export function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result ?? ''));
    lector.onerror = () => reject(new Error('No se pudo leer la foto'));
    lector.readAsDataURL(blob);
  });
}

/**
 * Deja la foto lista: achicada, recortada si es tela, con su miniatura y en
 * data URL. La MISMA preparación al enseñar y al consultar — si la referencia
 * y la consulta se preparan distinto, sus huellas dejan de compararse bien.
 */
export async function prepararParaEmbedding(
  archivo: Blob,
  dominio: DominioReconocimiento,
): Promise<FotoPreparada> {
  const deRespaldo = async (): Promise<FotoPreparada> => {
    const file = archivo instanceof File ? archivo : new File([archivo], 'foto.jpg', { type: archivo.type });
    const { blob } = await comprimirFoto(file);
    return { foto: blob, miniatura: null, dataUrl: await blobADataUrl(blob) };
  };

  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return deRespaldo();

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch {
    // HEIC/HEIF de iPhone: el navegador no sabe abrirlo. Va como vino y la
    // función responde con el mensaje que explica cómo cambiar el formato.
    return deRespaldo();
  }

  try {
    const medidas = medidasParaEmbedding(bitmap.width, bitmap.height, dominio);
    if (medidas.ancho === 0) return deRespaldo();
    const foto = await dibujar(bitmap, medidas, CALIDAD_FOTO);
    if (!foto) return deRespaldo();

    const chica = medidasParaEmbedding(bitmap.width, bitmap.height, dominio, LADO_MINIATURA);
    const miniatura = await dibujar(bitmap, chica, CALIDAD_MINIATURA);

    return { foto, miniatura, dataUrl: await blobADataUrl(foto) };
  } catch {
    return deRespaldo();
  } finally {
    bitmap.close?.();
  }
}
