// ─────────────────────────────────────────────────────────────────────
// CÓDIGOS DE ESTRUCTURA — réplica de la lógica del optimizador legacy
// (optimizador.html: asignación de `cod` por componente del despiece).
//
// Cada pieza del despiece tiene un código de inventario fijo por color
// (tomado del catálogo de accesorios del taller):
//   · TUBO / PLETINA   → código de tubería (38mm_E02, E47, …)
//   · PESO INTERNO     → SIEMPRE E13 (excepción dura, sin importar color)
//   · PESO (roller)    → NEGRO→E14 · BLANCO→E15 · GRIS→E16
//   · PESO U (lágrima) → NEGRO→E18 · BLANCO→E19 · GRIS→E20
//   · CENEFA OVALADA   → NEGRO→E26 · BLANCO→E27 · GRIS→E28
//
// Si el color no tiene código fijo (otro color), devuelve '' y la etiqueta
// cae al color como identificador.
// ─────────────────────────────────────────────────────────────────────

/** Normaliza color de accesorios (corto "NEG"/largo "NEGRO"/plural) a canónico. */
function colorCanonico(color: string | null | undefined): string {
  const c = (color || '').toUpperCase().trim();
  if (c.startsWith('NEG')) return 'NEGRO';
  if (c.startsWith('BCO') || c.startsWith('BLA') || c.startsWith('BLN')) return 'BLANCO';
  if (c.startsWith('GR')) return 'GRIS'; // GRS, GRIS, GRISES, GRI
  return c;
}

/** Peso inferior roller (barra de peso): código por color. */
export const PESO_ROLLER_POR_COLOR: Record<string, string> = {
  NEGRO: 'E14',
  BLANCO: 'E15',
  GRIS: 'E16',
};

/** Peso inferior de dúo lágrima: código por color. */
export const PESO_U_POR_COLOR: Record<string, string> = {
  NEGRO: 'E18',
  BLANCO: 'E19',
  GRIS: 'E20',
};

/** Cenefa ovalada: código por color. */
export const CENEFA_OVALADA_POR_COLOR: Record<string, string> = {
  NEGRO: 'E26',
  BLANCO: 'E27',
  GRIS: 'E28',
};

/** Peso interno de dúo: constante de taller (E13), sin importar color. */
export const COD_PESO_INTERNO = 'E13';

/** Peso inferior de sistemas de oscuridad (Soft Light / Dark): código por color. */
export const PESO_OSCURIDAD_POR_COLOR: Record<string, string> = {
  BLANCO: 'E24',
  NEGRO: 'E44',
};

/**
 * Código de inventario de una pieza del despiece, según su columna del Excel
 * de órdenes (misma lógica que el optimizador de estructura).
 * Devuelve '' cuando el color no tiene código fijo (cae al color en la etiqueta).
 */
export function codigoEstructura(
  columnaExcel: string,
  colorAccesorios: string | null | undefined,
  tuberiaCod: string | null | undefined,
): string {
  const color = colorCanonico(colorAccesorios);
  switch (columnaExcel) {
    case 'TUBO':
    case 'PLETINA':
      return tuberiaCod || '';
    case 'PESO INTERNO':
      return COD_PESO_INTERNO;
    case 'PESO':
      return PESO_ROLLER_POR_COLOR[color] || '';
    case 'PESO U':
      return PESO_U_POR_COLOR[color] || '';
    case 'PESO SOFT LIGHT':
      // Peso inferior de oscuridad (Soft Light / Dark): E24 blanco / E44 negro.
      // Gris no aplica (soft light no se vende en gris) → cae al color.
      return PESO_OSCURIDAD_POR_COLOR[color] || '';
    case 'CENEFA OVALADA':
      return CENEFA_OVALADA_POR_COLOR[color] || '';
    default:
      return '';
  }
}
