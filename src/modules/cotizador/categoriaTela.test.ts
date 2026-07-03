import { describe, it, expect } from 'vitest';
import { categoriasTela } from './categoriaTela';
import type { CatalogoProductos } from './types';

const base = { cod: 'X', producto: 'X', tipo: 'PREMIUM', descripcion: '', precio: 1 };
const catalogo: CatalogoProductos = {
  'BK 01': { ...base, categoria: 'A' },
  'SC 81': { ...base, categoria: 'B' },
  'DOM 04': { ...base }, // accesorio sin categoría
};

describe('categoriasTela', () => {
  it('devuelve las categorías presentes ordenadas y sin duplicados', () => {
    expect(categoriasTela(['BK 01'], catalogo)).toEqual(['A']);
    expect(categoriasTela(['SC 81', 'SC 81'], catalogo)).toEqual(['B']);
    expect(categoriasTela(['SC 81', 'BK 01'], catalogo)).toEqual(['A', 'B']);
  });

  it('ignora códigos vacíos, desconocidos o sin categoría', () => {
    expect(categoriasTela(['', undefined, 'NO-EXISTE', 'DOM 04'], catalogo)).toEqual([]);
  });

  it('tolera espacios alrededor del código (como las celdas importadas)', () => {
    expect(categoriasTela(['  BK 01  '], catalogo)).toEqual(['A']);
  });
});
