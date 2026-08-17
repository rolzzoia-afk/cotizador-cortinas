// Chips de categoría del catálogo de Fase 1: el color y el criterio con que se
// filtran los productos al cotizar.
//
// Vive fuera de la página porque también lo usa la MAQUETA del catálogo en el
// editor del documento (Admin → Documento), y así el panel de administrador no
// arrastra el bundle del cotizador.

import type { Producto } from '@/modules/cotizador/types';

const N = (s?: string) => (s || '').toUpperCase();

const CHIP_DE_CODINT: Record<string, string> = {
  // MOT
  'DOM 01': 'MOT', 'DOM 02': 'MOT', 'DOM 03': 'MOT', 'DOM 05': 'MOT', INSTMOT: 'MOT',
  // MOTOR MG (DOM 41 motor Merygate + DOM 42 su control Livorno 15 CH)
  'DOM 33': 'MOTOR_MG', 'DOM 34': 'MOTOR_MG', 'DOM 38': 'MOTOR_MG', 'DOM 39': 'MOTOR_MG',
  'DOM 41': 'MOTOR_MG', 'DOM 42': 'MOTOR_MG', INSTMOTMG: 'MOTOR_MG',
  // SOFT
  SOFTLDER: 'SOFT', SOFTLIZQ: 'SOFT', 'CENF O': 'SOFT', INSTSOFT: 'SOFT',
  // OSCURA
  'CEN-PRO': 'OSCURA', 'P-DER': 'OSCURA', 'P-IZQ': 'OSCURA', 'P-INST': 'OSCURA',
  // MOT VERT
  'MOT 01': 'MOT_VERT', 'MOT 03': 'MOT_VERT', 'INSTMOT-VERT': 'MOT_VERT',
  // MOTOR GRANDE
  'DOM 35': 'MOTOR_GRANDE', 'DOM 36': 'MOTOR_GRANDE', 'DOM 37': 'MOTOR_GRANDE', INSTMOTCA: 'MOTOR_GRANDE',
};

export type Filtro = {
  id: string;
  label: string;
  cls: string;
  /** Color por defecto del chip (equivalente hex de sus clases Tailwind). */
  hexDefault: string;
  match: (p: Producto, codInt: string) => boolean;
};

/** Chip cajón de sastre: todo lo que no calza en ningún otro cae acá, para que
 *  un producto nuevo NUNCA quede invisible en el catálogo de Fase 1. */
export const CHIP_OTROS = 'OTROS';

/**
 * Reglas por FAMILIA (`Producto.cod`). Se evalúan en orden: la primera que
 * matchea gana, así BLACKOUT_V* cae en BK VERT y no en BK. Son por PREFIJO a
 * propósito: una gama nueva (BLACKOUT_X, SCREEN_ECO…) entra sola al chip de su
 * familia sin tocar código. Antes eran listas cerradas —BLACKOUT_P/D/S— y
 * cualquier familia nueva quedaba sin chip.
 */
const REGLAS_POR_COD: { chip: string; test: (cod: string) => boolean }[] = [
  { chip: 'BK_V', test: (c) => c.startsWith('BLACKOUT_V') },
  { chip: 'SC_V', test: (c) => c.startsWith('SCREEN_V') },
  { chip: 'DUO_BK', test: (c) => c.startsWith('DUOBK') },
  { chip: 'DUO_POLI', test: (c) => c.startsWith('DUOPOLI') },
  { chip: 'BK', test: (c) => c.startsWith('BLACKOUT') },
  { chip: 'SCR', test: (c) => c.startsWith('SCREEN') },
];

/**
 * Chip donde vive un producto. Fuente ÚNICA de verdad: los `match` de
 * FILTROS_CATALOGO la consultan, así cada producto cae en exactamente un chip
 * (partición, sin duplicados ni huecos).
 *
 * Prioridad:
 *  1. `p.chip` elegido a mano en el diálogo del producto (gana siempre).
 *  2. El diccionario de COD_INT sueltos (motores, soft, oscura…), cuyo `cod`
 *     no alcanza para agruparlos (todos son ACCESORIO).
 *  3. Las reglas por familia.
 *  4. `OTROS`.
 */
export function chipDeProducto(p: Producto, codInt: string): string {
  const explicito = N(p.chip).trim();
  if (explicito && CHIP_IDS.includes(explicito)) return explicito;
  const porCodInt = CHIP_DE_CODINT[(codInt || '').trim()];
  if (porCodInt) return porCodInt;
  const cod = N(p.cod).trim();
  return REGLAS_POR_COD.find((r) => r.test(cod))?.chip ?? CHIP_OTROS;
}

export const FILTROS_CATALOGO: Filtro[] = [
  { id: 'BK', label: 'BK', cls: 'bg-amber-100 text-amber-900 border-amber-400', hexDefault: '#fef3c7' },
  { id: 'BK_V', label: 'BK VERT', cls: 'bg-orange-200 text-orange-900 border-orange-400', hexDefault: '#fed7aa' },
  { id: 'SCR', label: 'SCR', cls: 'bg-green-200 text-green-900 border-green-500', hexDefault: '#bbf7d0' },
  { id: 'SC_V', label: 'SC VERT', cls: 'bg-emerald-300 text-emerald-900 border-emerald-600', hexDefault: '#6ee7b7' },
  { id: 'DUO_BK', label: 'DUO BK', cls: 'bg-sky-200 text-sky-900 border-sky-400', hexDefault: '#bae6fd' },
  { id: 'DUO_POLI', label: 'DUO POLI', cls: 'bg-blue-200 text-blue-900 border-blue-500', hexDefault: '#bfdbfe' },
  { id: 'SOFT', label: 'SOFT', cls: 'bg-lime-400 text-lime-950 border-lime-600', hexDefault: '#a3e635' },
  { id: 'OSCURA', label: 'OSCURA', cls: 'bg-teal-400 text-teal-950 border-teal-600', hexDefault: '#2dd4bf' },
  { id: 'MOT_VERT', label: 'MOT VERT', cls: 'bg-purple-300 text-purple-950 border-purple-600', hexDefault: '#d8b4fe' },
  { id: 'MOT', label: 'MOT', cls: 'bg-amber-700 text-white border-amber-800', hexDefault: '#b45309' },
  { id: 'MOTOR_GRANDE', label: 'MOTOR GRANDE', cls: 'bg-fuchsia-500 text-white border-fuchsia-700', hexDefault: '#d946ef' },
  { id: 'MOTOR_MG', label: 'MOTOR MG', cls: 'bg-gray-400 text-gray-950 border-gray-600', hexDefault: '#9ca3af' },
  { id: CHIP_OTROS, label: 'Otros', cls: 'bg-stone-300 text-stone-900 border-stone-500', hexDefault: '#d6d3d1' },
].map((f) => ({ ...f, match: (p: Producto, ci: string) => chipDeProducto(p, ci) === f.id }));

/** Ids válidos de chip (para validar el `chip` guardado en un producto). */
export const CHIP_IDS: string[] = FILTROS_CATALOGO.map((f) => f.id);

/** Label visible de un chip; si el id no existe, el id crudo. */
export const labelChip = (id: string): string =>
  FILTROS_CATALOGO.find((f) => f.id === id)?.label ?? id;
