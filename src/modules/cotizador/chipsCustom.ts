// ─────────────────────────────────────────────────────────────────────
// Categorías PROPIAS del catálogo de Fase 1.
//
// Los chips de arriba del catálogo (BK, SCR, MOT…) salen de reglas fijas: la
// familia del producto o su COD_INT. El dueño (2026-09-07) pidió poder agregar
// los suyos —«un botón en el cuadro de colores por categoría para poder
// agregar una categoría que yo quiera»—, por ejemplo para juntar lo de una
// promoción o un proveedor.
//
// Un chip propio no tiene regla: los productos entran a mano, eligiéndolo en
// la ficha del producto (el campo «Categoría del catálogo»). Su color viaja
// con él y no en el mapa de colores, porque no tiene ningún color de fábrica
// del que ser un override.
//
// Módulo puro. La persistencia vive en `chipsCustomStore.ts`.
// ─────────────────────────────────────────────────────────────────────
import { esHexValido } from './chipsColores';

export const CLAVE_CHIPS_CUSTOM = 'chips_catalogo_custom';

/** Cuántas categorías propias se permiten (la fila de chips tiene que caber). */
export const MAX_CHIPS_CUSTOM = 30;

/** Prefijo de los ids propios: los separa de los de fábrica para siempre. */
export const PREFIJO_CHIP_CUSTOM = 'CUSTOM-';

export type ChipCustom = {
  /** `CUSTOM-<slug>` — estable, es lo que se guarda en `Producto.chip`. */
  id: string;
  label: string;
  hex: string;
};

/** ¿Este id es de una categoría propia? */
export const esChipCustom = (id: string): boolean =>
  (id || '').toUpperCase().startsWith(PREFIJO_CHIP_CUSTOM);

/**
 * Id a partir del nombre: mayúsculas, sin tildes y sin nada raro. Dos
 * categorías con el mismo nombre dan el mismo id, que es lo que se quiere
 * (`saneaChipsCustom` descarta la repetida).
 */
export function idChipCustom(label: string): string {
  const slug = (label || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return `${PREFIJO_CHIP_CUSTOM}${slug || Date.now().toString(36).toUpperCase()}`;
}

/** El color con que nace una categoría propia (gris neutro, se cambia al toque). */
export const HEX_CHIP_CUSTOM_DEFAULT = '#a8a29e';

/** Deja pasar solo lo que tiene forma de chip propio, sin repetidos. */
export function saneaChipsCustom(crudo: unknown): ChipCustom[] {
  if (!Array.isArray(crudo)) return [];
  const out: ChipCustom[] = [];
  const vistos = new Set<string>();
  for (const x of crudo) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const label = String(o.label ?? '').trim();
    if (!label) continue;
    const id = esChipCustom(String(o.id ?? ''))
      ? String(o.id).toUpperCase().trim()
      : idChipCustom(label);
    if (vistos.has(id)) continue;
    vistos.add(id);
    out.push({
      id,
      label: label.slice(0, 24),
      hex: esHexValido(o.hex) ? String(o.hex).trim().toLowerCase() : HEX_CHIP_CUSTOM_DEFAULT,
    });
    if (out.length >= MAX_CHIPS_CUSTOM) break;
  }
  return out;
}
