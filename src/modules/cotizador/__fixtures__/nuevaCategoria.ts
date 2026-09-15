// Piezas compartidas por las pruebas del asistente «Nueva categoría». Viven
// acá y no en un `.test.ts` para que importarlas no vuelva a correr las pruebas
// del otro archivo.
import { REGLAS_PRECIOS_DEFAULT } from '../reglasPrecios';
import { categoriasParaSelect } from '@/modules/descuentos/tiposCortina';
import {
  filaNueva,
  type BorradorCategoria,
  type ContextoCategoria,
  type FilaProductoNueva,
} from '../nuevaCategoria';
import type { CatalogoProductos } from '../types';

export const CATALOGO_DEMO: CatalogoProductos = {
  'BK 18': {
    cod: 'BLACKOUT_P', producto: 'ROLLER BLACKOUT PREMIUM', tipo: 'PREMIUM',
    descripcion: 'x', precio: 17877,
  },
  'BK-P': {
    cod: 'BLACKOUT_P', producto: 'ROLLER BLACKOUT PREMIUM', tipo: 'PREMIUM',
    descripcion: 'COLOR POR DEFINIR', precio: 29231,
  },
};

export const ctx = (over: Partial<ContextoCategoria> = {}): ContextoCategoria => ({
  catalogo: CATALOGO_DEMO,
  anchoRollo: {},
  reglas: REGLAS_PRECIOS_DEFAULT,
  chips: [],
  parametros: { iva: 0.19, margenInsumo: 0.65 },
  categoriasSelect: categoriasParaSelect([]),
  hoy: '2026-09-14',
  ...over,
});

export const borrador = (over: Partial<BorradorCategoria> = {}): BorradorCategoria => ({
  nombre: 'Lino',
  tipo: 'roller',
  baseCod: 'LINO',
  pastilla: { modo: 'nueva', label: 'Lino', hex: '#a8a29e' },
  categoriaFabricacion: 'ROL',
  moldes: {},
  baseVerticalDe: {},
  filas: [],
  ...over,
});

/**
 * Una fila lista, con lo mínimo para pasar la revisión. El precio va como
 * escrito a mano y el nombre deja de seguir al tipo: así lo que pone cada
 * prueba es lo que la fila tiene.
 */
export const fila = (
  b: BorradorCategoria,
  c: ContextoCategoria,
  over: Partial<FilaProductoNueva> = {},
): FilaProductoNueva => ({
  ...filaNueva(b, c),
  codInt: 'LN 01',
  precio: 30000,
  precioManual: true,
  productoAuto: false,
  anchoRolloM: 2.98,
  ...over,
});
