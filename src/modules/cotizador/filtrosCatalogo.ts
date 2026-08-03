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
const enChip = (ci: string, chip: string) => CHIP_DE_CODINT[ci.trim()] === chip;
export const FILTROS_CATALOGO: Filtro[] = [
  { id: 'BK', label: 'BK', cls: 'bg-amber-100 text-amber-900 border-amber-400', hexDefault: '#fef3c7',
    match: (p) => ['BLACKOUT_P', 'BLACKOUT_D', 'BLACKOUT_S'].includes(N(p.cod)) },
  { id: 'BK_V', label: 'BK VERT', cls: 'bg-orange-200 text-orange-900 border-orange-400', hexDefault: '#fed7aa',
    match: (p) => N(p.cod).startsWith('BLACKOUT_V') },
  { id: 'SCR', label: 'SCR', cls: 'bg-green-200 text-green-900 border-green-500', hexDefault: '#bbf7d0',
    match: (p) => ['SCREEN_P', 'SCREEN_D', 'SCREEN_S'].includes(N(p.cod)) },
  { id: 'SC_V', label: 'SC VERT', cls: 'bg-emerald-300 text-emerald-900 border-emerald-600', hexDefault: '#6ee7b7',
    match: (p) => N(p.cod).startsWith('SCREEN_V') },
  { id: 'DUO_BK', label: 'DUO BK', cls: 'bg-sky-200 text-sky-900 border-sky-400', hexDefault: '#bae6fd',
    match: (p) => N(p.cod).startsWith('DUOBK') },
  { id: 'DUO_POLI', label: 'DUO POLI', cls: 'bg-blue-200 text-blue-900 border-blue-500', hexDefault: '#bfdbfe',
    match: (p) => N(p.cod).startsWith('DUOPOLI') },
  { id: 'SOFT', label: 'SOFT', cls: 'bg-lime-400 text-lime-950 border-lime-600', hexDefault: '#a3e635',
    match: (_p, ci) => enChip(ci, 'SOFT') },
  { id: 'OSCURA', label: 'OSCURA', cls: 'bg-teal-400 text-teal-950 border-teal-600', hexDefault: '#2dd4bf',
    match: (_p, ci) => enChip(ci, 'OSCURA') },
  { id: 'MOT_VERT', label: 'MOT VERT', cls: 'bg-purple-300 text-purple-950 border-purple-600', hexDefault: '#d8b4fe',
    match: (_p, ci) => enChip(ci, 'MOT_VERT') },
  { id: 'MOT', label: 'MOT', cls: 'bg-amber-700 text-white border-amber-800', hexDefault: '#b45309',
    match: (_p, ci) => enChip(ci, 'MOT') },
  { id: 'MOTOR_GRANDE', label: 'MOTOR GRANDE', cls: 'bg-fuchsia-500 text-white border-fuchsia-700', hexDefault: '#d946ef',
    match: (_p, ci) => enChip(ci, 'MOTOR_GRANDE') },
  { id: 'MOTOR_MG', label: 'MOTOR MG', cls: 'bg-gray-400 text-gray-950 border-gray-600', hexDefault: '#9ca3af',
    match: (_p, ci) => enChip(ci, 'MOTOR_MG') },
];
