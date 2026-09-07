/**
 * Con qué TUBO se arma una cortina invertida.
 *
 * La invertida se corta rotada en el rollo y va colgada de un tubo más grueso.
 * Hasta ahora había uno solo, el de 63 mm (`E 47` + kit `MEC 28`), que es el
 * del Excel «COTIZADOR PARA CORTINAS MAYORES A 3,00 MTS». El dueño
 * (2026-09-07) pidió poder invertir también con el de 45 mm —el mismo `E 05`
 * del roller grande, con el kit `MEC 18`—, y anunció un tercero de 40 mm que
 * todavía no tiene códigos.
 *
 * Este módulo es la lista de diámetros y nada más: qué insumos cambia cada uno
 * vive en `reglasPrecios.ts` (`tuboInvertida45`), editable desde Admin. Cuando
 * llegue el de 40 mm se agrega acá su número y allá su recambio.
 */

/** Diámetros que hoy se pueden elegir en la grilla, en el orden en que se ofrecen. */
export const DIAMETROS_INVERTIDA = [63, 45] as const;

/** Milímetros del tubo de una invertida. El 40 está declarado y todavía no se ofrece. */
export type TuboInvertidaMm = 63 | 45 | 40;

/** Con el que se invierte si nadie eligió: el de siempre. */
export const TUBO_INVERTIDA_DEFAULT: TuboInvertidaMm = 63;

/** ¿Este valor guardado es un diámetro de invertida que la app entienda? */
export function esTuboInvertida(x: unknown): x is TuboInvertidaMm {
  return x === 63 || x === 45 || x === 40;
}

/**
 * El diámetro con el que se cotiza una fila: lo elegido, o el de siempre.
 * Todo el que necesite el número pasa por acá, así una fila vieja (sin el
 * campo) y una fila nueva con 63 dan exactamente lo mismo.
 */
export function tuboInvertidaDe(x: unknown): TuboInvertidaMm {
  return esTuboInvertida(x) ? x : TUBO_INVERTIDA_DEFAULT;
}

/** «63 mm» — como se rotula en la grilla, la ficha y el desglose. */
export const rotuloTuboInvertida = (mm: TuboInvertidaMm): string => `${mm} mm`;
