import { describe, expect, it } from 'vitest';
import {
  eliminarProductoDeCatalogo,
  familiasDelCatalogo,
  guardarProductoEnCatalogo,
  normCod,
  tiposDelCatalogo,
} from './catalogoEdicion';
import type { CatalogoProductos, Producto } from './types';

const prod = (over: Partial<Producto> = {}): Producto => ({
  cod: 'BLACKOUT_D',
  producto: 'ROLLER BLACKOUT DELUX',
  tipo: 'DELUX',
  descripcion: 'RUSTICO LINO',
  precio: 27176,
  ...over,
});

const CAT: CatalogoProductos = {
  'BK 09': prod({ colorGrupo: 'lino' }),
  'BK 10': prod({ descripcion: 'RUSTICO TOSTADO', precio: 23782 }),
};
const AR: Record<string, number> = { 'BK 09': 2.98, 'BK 10': 2.98 };

describe('guardarProductoEnCatalogo', () => {
  it('crea un código nuevo con su ancho de rollo', () => {
    const r = guardarProductoEnCatalogo(CAT, AR, null, 'bk  77', prod({ precio: 30000 }), 3.0);
    expect(r.catalogo['BK 77'].precio).toBe(30000);
    expect(r.catalogo['BK 77'].anchoRollo).toBe(3.0);
    expect(r.anchoRollo['BK 77']).toBe(3.0);
    expect(CAT['BK 77']).toBeUndefined(); // no muta el original
  });

  it('edita preservando campos no editados (colorGrupo)', () => {
    const r = guardarProductoEnCatalogo(CAT, AR, 'BK 09', 'BK 09', prod({ precio: 99000 }), null);
    expect(r.catalogo['BK 09'].precio).toBe(99000);
    expect(r.catalogo['BK 09'].colorGrupo).toBe('lino');
  });

  it('rename: mueve la clave en catálogo y ancho de rollo', () => {
    const r = guardarProductoEnCatalogo(CAT, AR, 'BK 09', 'BK 90', prod(), null);
    expect(r.catalogo['BK 09']).toBeUndefined();
    expect(r.catalogo['BK 90']).toBeDefined();
    expect(r.anchoRollo['BK 09']).toBeUndefined();
    expect(r.anchoRollo['BK 90']).toBe(2.98); // migra el ancho previo
  });

  it('rename con ancho nuevo: usa el nuevo, no el migrado', () => {
    const r = guardarProductoEnCatalogo(CAT, AR, 'BK 09', 'BK 90', prod(), 2.5);
    expect(r.anchoRollo['BK 90']).toBe(2.5);
    expect(r.anchoRollo['BK 09']).toBeUndefined();
  });
});

describe('eliminarProductoDeCatalogo', () => {
  it('borra el código de catálogo y ancho de rollo sin mutar', () => {
    const r = eliminarProductoDeCatalogo(CAT, AR, 'BK 09');
    expect(r.catalogo['BK 09']).toBeUndefined();
    expect(r.anchoRollo['BK 09']).toBeUndefined();
    expect(r.catalogo['BK 10']).toBeDefined();
    expect(CAT['BK 09']).toBeDefined();
  });
});

describe('helpers de datalist', () => {
  it('familias y tipos distintos ordenados', () => {
    const cat: CatalogoProductos = {
      ...CAT,
      'SC 01': prod({ cod: 'SCREEN_P', tipo: 'PREMIUM' }),
    };
    expect(familiasDelCatalogo(cat)).toEqual(['BLACKOUT_D', 'SCREEN_P']);
    expect(tiposDelCatalogo(cat)).toEqual(['DELUX', 'PREMIUM']);
  });

  it('normCod colapsa espacios y sube a mayúsculas', () => {
    expect(normCod('  bk   09 ')).toBe('BK 09');
  });
});
