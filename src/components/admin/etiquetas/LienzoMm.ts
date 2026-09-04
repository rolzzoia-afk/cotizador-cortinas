// La cuenta del lienzo del editor de etiquetas, aparte del componente para
// poder probarla: una etiqueta se mide en milímetros y la pantalla en píxeles.
//
// El zoom es explícito (no «lo que quepa»): el dueño compara contra la etiqueta
// impresa que tiene en la mano, así que el 100 % tiene que ser 100 % de verdad.

/** Milímetros por pulgada, para pasar de mm a px con el DPI de referencia. */
const MM_POR_PULGADA = 25.4;

/**
 * CSS asume 96 px por pulgada: es el mismo número con el que el navegador
 * convierte los `mm` del documento impreso, así que el lienzo y la etiqueta
 * hablan el mismo idioma.
 */
export const PX_POR_PULGADA = 96;

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;

/** Cuántos píxeles mide un milímetro con este zoom. */
export function pxPorMm(zoom: number): number {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(zoom) ? zoom : 1));
  return (PX_POR_PULGADA / MM_POR_PULGADA) * z;
}

/** Píxeles de pantalla → milímetros de etiqueta, redondeado a décimas. */
export function aMm(px: number, zoom: number): number {
  const mm = px / pxPorMm(zoom);
  return Math.round(mm * 10) / 10;
}

/** Un valor en mm, acotado a la hoja para que nada se dibuje fuera del papel. */
export function dentroDeLaHoja(valor: number, tamano: number, limite: number): number {
  const v = Number.isFinite(valor) ? valor : 0;
  return Math.min(Math.max(0, v), Math.max(0, limite - tamano));
}
