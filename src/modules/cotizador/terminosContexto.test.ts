import { describe, expect, it } from 'vitest';
import { categoriasParaTerminos, filaEsBeeblack } from './terminosContexto';
import { TERMINOS_DEFAULT, terminosParaCotizacion, type ConfigTerminos } from './terminos';
import type { CatalogoProductos } from './types';

const tela = (cod: string, categoria: string): CatalogoProductos[string] => ({
  cod,
  producto: 'X',
  tipo: 'PREMIUM',
  descripcion: '',
  precio: 1,
  categoria,
});

// Las telas BEE-* están catalogadas con gama 'A' (hay que ponerles algo): es
// justo lo que hacía salir los términos de la roller A en una cotización que
// solo llevaba beeblack.
const CAT: CatalogoProductos = {
  'BEE-BK01': tela('BEE_BK', 'A'),
  'SC 34': tela('SCREEN_P', 'A'),
  'BK 50': tela('BLACKOUT_S', 'B'),
};

/** Los grupos del dueño: beeblack por categoría de producto, roller por gama. */
const CONFIG: ConfigTerminos = {
  grupos: [
    { id: 'gen', nombre: 'General', siempre: true, terminos: ['general'] },
    { id: 'a', nombre: 'Gama A', telas: ['A'], terminos: ['roller A'] },
    { id: 'b', nombre: 'Gama B', telas: ['B'], terminos: ['roller B'] },
    { id: 'bb', nombre: 'Beeblack', categorias: ['BEEBLACK'], terminos: ['beeblack'] },
  ],
};

const terminosDe = (filas: Parameters<typeof categoriasParaTerminos>[0]) => {
  const { catsProducto, catsTela } = categoriasParaTerminos(filas, CAT);
  return terminosParaCotizacion(CONFIG, catsProducto, catsTela);
};

describe('filaEsBeeblack', () => {
  it('lo reconoce por categoría o por código, aunque la fila no tenga categoría', () => {
    expect(filaEsBeeblack({ codInt: 'BEE-BK01' })).toBe(true);
    expect(filaEsBeeblack({ codInt: 'SC 34', categoria: 'BEEBLACK' })).toBe(true);
    expect(filaEsBeeblack({ codInt: 'SC 34' })).toBe(false);
    expect(filaEsBeeblack({})).toBe(false);
  });
});

describe('categoriasParaTerminos', () => {
  it('una cotización SOLO beeblack no muestra los términos de la roller', () => {
    // El reclamo del dueño: salían los de roller A porque la tela BEE figura
    // como gama A y el grupo beeblack no aplicaba nunca (sin categoría).
    expect(terminosDe([{ codInt: 'BEE-BK01' }])).toEqual(['general', 'beeblack']);
  });

  it('beeblack + roller categoría A: salen los DOS', () => {
    expect(terminosDe([{ codInt: 'BEE-BK01' }, { codInt: 'SC 34' }])).toEqual([
      'general',
      'roller A',
      'beeblack',
    ]);
  });

  it('categoría A + categoría B: salen los dos', () => {
    expect(terminosDe([{ codInt: 'SC 34' }, { codInt: 'BK 50' }])).toEqual([
      'general',
      'roller A',
      'roller B',
    ]);
  });

  it('la fila con categoría BEEBLACK escrita también cuenta, sin duplicar', () => {
    const { catsProducto } = categoriasParaTerminos(
      [{ codInt: 'BEE-BK01', categoria: 'BEEBLACK' }],
      CAT,
    );
    expect(catsProducto).toEqual(['BEEBLACK']);
  });

  it('las demás categorías de producto siguen viajando', () => {
    const { catsProducto, catsTela } = categoriasParaTerminos(
      [{ codInt: 'SC 34', categoria: 'DARK_38mm' }, { codInt: 'BEE-BK01' }],
      CAT,
    );
    expect(catsProducto).toEqual(['BEEBLACK', 'DARK_38MM']);
    expect(catsTela).toEqual(['A']); // solo la SC 34
  });

  it('sin cortinas no hay ninguna categoría (y quedan los términos generales)', () => {
    expect(categoriasParaTerminos([], CAT)).toEqual({ catsProducto: [], catsTela: [] });
    expect(terminosParaCotizacion(TERMINOS_DEFAULT, [], []).length).toBeGreaterThan(0);
  });
});
