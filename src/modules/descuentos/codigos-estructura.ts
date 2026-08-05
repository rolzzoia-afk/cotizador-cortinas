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
//   · BEEBLACK perfiles→ BLANCO→SML04 · NEGRO→SML05 · CAFÉ→SML06 (los 4 iguales)
//   · BEEBLACK manillas→ BLANCO→SML10 · NEGRO→SML11 · CAFÉ→SML12 (agarradera)
//
// Si el color no tiene código fijo (otro color), devuelve '' y la etiqueta
// cae al color como identificador.
//
// Un color dado de alta en Admin puede traer sus PROPIOS códigos: se consultan
// primero (overlay) y estas tablas quedan como respaldo. Los colores de fábrica
// no declaran nada, así que siguen resolviendo por acá.
// ─────────────────────────────────────────────────────────────────────
import {
  insumoDeColor,
  type ColorAccesorio,
  type InsumosColor,
} from './coloresAccesorio';

/** El código que el color declaró para esta pieza, o el de la tabla de fábrica. */
function conOverlay(
  campo: keyof InsumosColor,
  color: string | null | undefined,
  colores: readonly ColorAccesorio[] | undefined,
  fallback: string,
): string {
  return insumoDeColor(color, campo, colores) ?? fallback;
}

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

/** Perfil ZÓCALO (lateral/base) de soft light / dark: código por color de perfil.
 *  Barra de 5,80 m; mismo mapeo que el optimizador legacy (café ≡ madera). */
export const ZOCALO_POR_COLOR: Record<string, string> = {
  BLANCO: 'E32',
  NEGRO: 'E33',
  CAFÉ: 'E34',
};

/** Perfil SEPARADOR de soft light / dark: código por color (E41/E42/E43). */
export const SEPARADOR_POR_COLOR: Record<string, string> = {
  BLANCO: 'E41',
  NEGRO: 'E42',
  CAFÉ: 'E43',
};

/** PERFIL SUPERIOR de oscuranti (columna "PERFIL SUPERIOR (CENEF.PRO)"): perfil
 *  rectangular 50×25, código por color de perfil (E50/E49/E52). Es OTRO perfil
 *  que el separador (E41/E42/E43); barra de 5,80 m igual que el resto. Va
 *  siempre en oscuranti; soft light y DARK no lo llevan. */
export const PERFIL_SUPERIOR_POR_COLOR: Record<string, string> = {
  BLANCO: 'E50',
  NEGRO: 'E49',
  CAFÉ: 'E52',
};

/** Cenefa CUADRADA (Dark / Oscuranti): código por color de PERFIL (E29/E30/E31).
 *  Mismo criterio que zócalo/separador (café ≡ madera). Catálogo del optimizador:
 *  CENEFA CUADRADA|NEGRO=E29 · BLANCO=E30 · CAFÉ=E31. */
export const CENEFA_CUADRADA_POR_COLOR: Record<string, string> = {
  NEGRO: 'E29',
  BLANCO: 'E30',
  CAFÉ: 'E31',
};

/** BEEBLACK: los CUATRO perfiles (superior, inferior y los dos laterales) salen
 *  del MISMO riel, por color de accesorios. Barra de 6,00 m. */
export const PERFIL_BEEBLACK_POR_COLOR: Record<string, string> = {
  BLANCO: 'SML04',
  NEGRO: 'SML05',
  CAFÉ: 'SML06',
};

/** BEEBLACK: la manilla es la AGARRADERA (magnetic bidirectional track shift).
 *  Se cobra como accesorio en Fase 1 y se corta acá, no es insumo de kit. */
export const MANILLA_BEEBLACK_POR_COLOR: Record<string, string> = {
  BLANCO: 'SML10',
  NEGRO: 'SML11',
  CAFÉ: 'SML12',
};

/** Color de perfil canónico: 'CAFE' (sin tilde) y 'MADERA' → clave 'CAFÉ'. */
function colorPerfilCanonico(color: string | null | undefined): string {
  const c = colorCanonico(color);
  return c === 'MADERA' || c === 'CAFE' ? 'CAFÉ' : c;
}

/** Código del perfil zócalo (E32/E33/E34) por color; '' si el color no calza. */
export function codigoZocaloPerfil(
  color: string | null | undefined,
  colores?: readonly ColorAccesorio[],
): string {
  return conOverlay('zocalo', color, colores, ZOCALO_POR_COLOR[colorPerfilCanonico(color)] || '');
}

/** Código del perfil separador (E41/E42/E43) por color; '' si el color no calza. */
export function codigoSeparadorPerfil(
  color: string | null | undefined,
  colores?: readonly ColorAccesorio[],
): string {
  return conOverlay('separador', color, colores, SEPARADOR_POR_COLOR[colorPerfilCanonico(color)] || '');
}

/** Código del PERFIL SUPERIOR de oscuranti (E50/E49/E52); '' si el color no calza. */
export function codigoPerfilSuperior(
  color: string | null | undefined,
  colores?: readonly ColorAccesorio[],
): string {
  return conOverlay(
    'perfilSuperior',
    color,
    colores,
    PERFIL_SUPERIOR_POR_COLOR[colorPerfilCanonico(color)] || '',
  );
}

/** Código de la cenefa cuadrada (E29/E30/E31) por color de perfil; '' si no calza. */
export function codigoCenefaCuadrada(
  color: string | null | undefined,
  colores?: readonly ColorAccesorio[],
): string {
  return conOverlay(
    'cenefaCuadrada',
    color,
    colores,
    CENEFA_CUADRADA_POR_COLOR[colorPerfilCanonico(color)] || '',
  );
}

/** Código del riel BEEBLACK (SML04/05/06) por color; '' si el color no calza. */
export function codigoPerfilBeeblack(color: string | null | undefined): string {
  return PERFIL_BEEBLACK_POR_COLOR[colorPerfilCanonico(color)] || '';
}

/** Código de la agarradera BEEBLACK (SML10/11/12) por color; '' si no calza. */
export function codigoManillaBeeblack(color: string | null | undefined): string {
  return MANILLA_BEEBLACK_POR_COLOR[colorPerfilCanonico(color)] || '';
}

/**
 * Código de inventario de una pieza del despiece, según su columna del Excel
 * de órdenes (misma lógica que el optimizador de estructura).
 * Devuelve '' cuando el color no tiene código fijo (cae al color en la etiqueta).
 */
export function codigoEstructura(
  columnaExcel: string,
  colorAccesorios: string | null | undefined,
  tuberiaCod: string | null | undefined,
  colores?: readonly ColorAccesorio[],
): string {
  const color = colorCanonico(colorAccesorios);
  const overlay = (campo: keyof InsumosColor, fallback: string) =>
    conOverlay(campo, colorAccesorios, colores, fallback);
  switch (columnaExcel) {
    case 'TUBO':
    case 'PLETINA':
      return tuberiaCod || '';
    case 'PESO INTERNO':
      return COD_PESO_INTERNO;
    case 'PESO':
      return overlay('pesoRoller', PESO_ROLLER_POR_COLOR[color] || '');
    case 'PESO U':
      return overlay('pesoU', PESO_U_POR_COLOR[color] || '');
    case 'PESO SOFT LIGHT':
      // Peso inferior de oscuridad (Soft Light / Dark): E24 blanco / E44 negro.
      // Gris no aplica (soft light no se vende en gris) → cae al color.
      return overlay('pesoOscuridad', PESO_OSCURIDAD_POR_COLOR[color] || '');
    case 'CENEFA OVALADA':
      return overlay('cenefaOvalada', CENEFA_OVALADA_POR_COLOR[color] || '');
    // BEEBLACK: los 4 perfiles son el mismo riel; las manillas, la agarradera.
    case 'PERFIL SUPERIOR (ANCHO)':
    case 'PERFIL INFERIOR (ANCHO)':
    case 'PERFIL LATERAL IZQ (ALTO)':
    case 'PERFIL LATERAL DER (ALTO)':
      return codigoPerfilBeeblack(colorAccesorios);
    case 'MANILLA IZQ (ALTO)':
    case 'MANILLA DER (ALTO)':
      return codigoManillaBeeblack(colorAccesorios);
    default:
      return '';
  }
}
