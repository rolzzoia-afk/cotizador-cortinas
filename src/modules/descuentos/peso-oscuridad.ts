// ─────────────────────────────────────────────────────────────────────
// Código de inventario del PESO INFERIOR de los sistemas de oscuridad
// (Soft Light / Dark / Oscuranti), según su color.
//
// El Excel de órdenes lleva la columna COLOR PESO INF. SOFT LIGHT junto a
// PESO SOFT LIGHT (optimizador legacy). Formato: "E24 [BLANCO]".
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────

/** Código de inventario del peso inferior de oscuridad por color (normalizado). */
const PESO_INF_OSCURIDAD_POR_COLOR: Record<string, string> = {
  BLANCO: 'E24',
  NEGRO: 'E44',
};

/** Normaliza abreviaturas/variantes de color al nombre completo en mayúsculas. */
export function colorPesoNormalizado(color: string | undefined | null): string {
  const c = (color || '').trim().toUpperCase().replace(/S$/, '');
  if (!c) return '';
  if (c === 'BCO' || c === 'BLANCO' || c === 'BLANC') return 'BLANCO';
  if (c === 'NEG' || c === 'NEGRO' || c === 'NGO') return 'NEGRO';
  if (c === 'GRI' || c === 'GRS' || c === 'GRIS' || c === 'GRISE') return 'GRIS';
  if (c === 'CAFE' || c === 'CAFÉ' || c === 'CAF') return 'CAFÉ';
  return c;
}

/** Código de inventario del peso inferior de oscuridad para un color dado. */
export function codigoPesoInfOscuridad(color: string | undefined | null): string {
  return PESO_INF_OSCURIDAD_POR_COLOR[colorPesoNormalizado(color)] || '';
}

/**
 * Valor de la columna COLOR PESO INF. SOFT LIGHT del Excel de órdenes.
 * Formato "E24 [BLANCO]" si hay código; si no, solo "[BLANCO]" para que el
 * optimizador resuelva el código por catálogo. Vacío si no hay color.
 */
export function colorPesoInfOscuridadExcel(color: string | undefined | null): string {
  const colorFull = colorPesoNormalizado(color);
  if (!colorFull) return '';
  const cod = PESO_INF_OSCURIDAD_POR_COLOR[colorFull];
  return cod ? `${cod} [${colorFull}]` : colorFull;
}
