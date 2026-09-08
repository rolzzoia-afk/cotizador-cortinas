// ─────────────────────────────────────────────────────────────────────
// EL COLOR DE FONDO DE UNA FILA DE LA COTIZACIÓN.
//
// En la planilla manual las vendedoras pintan filas para agrupar de un vistazo:
// las dos cortinas del living en amarillo, las del escritorio en verde, las de
// la visita en celeste. La app lo replica en la grilla de Fase 1/3 y lo imprime
// en el PDF que recibe el cliente.
//
// Es PRESENTACIÓN y nada más: el color no entra al motor de precios, ni al Excel
// de órdenes, ni a Fase 2, ni a producción.
//
// Por qué una paleta CERRADA y no un selector libre:
//   · el texto del PDF es negro y estos tonos lo dejan legible;
//   · son los mismos que ya se usan en la planilla, así que nadie tiene que
//     buscar «el amarillo bueno»;
//   · pantalla y papel pintan exactamente el mismo color.
// Se guarda el HEX (no un identificador de la paleta) para que cambiar o ampliar
// la lista no obligue a migrar ninguna OT ya guardada.
//
// Módulo PURO y SIN dependencias: lo importan el generador del PDF (que se carga
// aparte, sin React) y `fase0-reconcile`. Por eso las dos funciones de color
// viven acá y `chipsColores.ts` —que sí trae React y Supabase por su hook— las
// re-exporta, en vez de al revés.
// ─────────────────────────────────────────────────────────────────────

export type ColorFila = { id: string; nombre: string; hex: string };

/** ¿Es un color hex válido (#rgb o #rrggbb)? */
export function esHexValido(s: unknown): s is string {
  return typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
}

/**
 * Estilo inline para un chip a partir de su color de fondo: texto negro o
 * blanco según luminancia, borde un poco más oscuro que el fondo.
 */
export function estiloChipHex(hex: string): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const dark = (n: number) => Math.max(0, Math.round(n * 0.72));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return {
    backgroundColor: `#${full.toLowerCase()}`,
    color: lum > 150 ? '#1c1917' : '#ffffff',
    borderColor: `#${toHex(dark(r))}${toHex(dark(g))}${toHex(dark(b))}`,
  };
}

/** Los ocho colores que ofrece el botón de paleta, en el orden en que se ven. */
export const PALETA_FILA: readonly ColorFila[] = [
  { id: 'amarillo', nombre: 'Amarillo', hex: '#FFD966' },
  { id: 'verde', nombre: 'Verde', hex: '#A9D18E' },
  { id: 'celeste', nombre: 'Celeste', hex: '#9DC3E6' },
  { id: 'naranja', nombre: 'Naranja', hex: '#F4B183' },
  { id: 'rosado', nombre: 'Rosado', hex: '#F4B6C2' },
  { id: 'lila', nombre: 'Lila', hex: '#B4A7D6' },
  { id: 'turquesa', nombre: 'Turquesa', hex: '#9EE0DE' },
  { id: 'gris', nombre: 'Gris', hex: '#BFBFBF' },
] as const;

/** Componentes 0-255 de un hex, o `undefined` si no es un color válido. */
export type RgbFila = readonly [number, number, number];

/**
 * Hex → RGB para jsPDF, que pinta con tres números. Devuelve `undefined` para
 * cualquier cosa que no sea un color: así una fila sin pintar cae sola en el
 * fondo alternado de siempre en vez de quedar negra.
 */
export function rgbDeHex(hex: string | null | undefined): RgbFila | undefined {
  if (!esHexValido(hex)) return undefined;
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ] as const;
}

/**
 * Estilo inline de una fila pintada. El color del texto lo decide la luminancia
 * del fondo (`estiloChipHex`), no el tema: sobre un pastel el texto va oscuro
 * aunque la app esté en modo oscuro, donde el texto normal es claro y
 * desaparecería.
 *
 * `undefined` cuando la fila no está pintada, para poder pasarlo directo a
 * `style` sin ensuciar el markup.
 */
export function estiloFilaPintada(
  hex: string | null | undefined,
): { backgroundColor: string; color: string } | undefined {
  if (!esHexValido(hex)) return undefined;
  const { backgroundColor, color } = estiloChipHex(hex);
  return { backgroundColor, color };
}

/** El color que se guarda al elegir una pastilla, o `undefined` para «sin color». */
export function colorFilaSaneado(hex: string | null | undefined): string | undefined {
  if (!esHexValido(hex)) return undefined;
  return hex.trim().toUpperCase();
}

/** Nombre de la pastilla, para el `title` del botón y los lectores de pantalla. */
export function nombreColorFila(hex: string | null | undefined): string {
  const c = colorFilaSaneado(hex);
  if (!c) return 'Sin color';
  return PALETA_FILA.find((p) => p.hex.toUpperCase() === c)?.nombre ?? 'Color propio';
}
