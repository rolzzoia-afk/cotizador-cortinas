import { describe, expect, it } from 'vitest';
import {
  REGLAS_MECANISMO,
  categoriaRequiereMecanismo,
  mecEsFijoPorCategoria,
  mecPorCategoriaYColor,
  numeroMecPorColor,
  reglaCategoriaAplicable,
} from './reglas-mecanismo';

describe('REGLAS_MECANISMO — colorAMec', () => {
  it('BCO → 33, GRS → 34, NEG → 32', () => {
    expect(numeroMecPorColor('BCO')).toBe(33);
    expect(numeroMecPorColor('BLANCO')).toBe(33);
    expect(numeroMecPorColor('GRS')).toBe(34);
    expect(numeroMecPorColor('GRIS')).toBe(34);
    expect(numeroMecPorColor('NEG')).toBe(32);
    expect(numeroMecPorColor('NEGRO')).toBe(32);
  });
});

describe('REGLAS_MECANISMO — reglasCategoria', () => {
  it('OSCURANTI siempre → MEC 28', () => {
    const regla = reglaCategoriaAplicable('OSCURANTI_63mm', 'NEG');
    expect(regla?.mec).toBe(28);
    expect(regla?.codigoInventario).toBe('MEC_28_63mm_BLANCO_DERECHO_IZQ');
    expect(mecPorCategoriaYColor('OSCURANTI_63mm', 'NEG')).toBe(28);
    expect(mecEsFijoPorCategoria('OSCURANTI_63mm')).toBe(true);
  });

  it('SOFT_LIGHT_38mm + BCO → MEC 39', () => {
    const regla = reglaCategoriaAplicable('SOFT_LIGHT_38mm', 'BCO');
    expect(regla?.mec).toBe(39);
    expect(regla?.codigoInventario).toBe('MEC_39_OVALADA_BLANCO');
    expect(mecPorCategoriaYColor('SOFT_LIGHT_38mm', 'BCO')).toBe(39);
  });

  it('SOFT_LIGHT_38mm sin blanco → sin regla de categoría', () => {
    expect(reglaCategoriaAplicable('SOFT_LIGHT_38mm', 'GRS')).toBeNull();
    expect(mecPorCategoriaYColor('SOFT_LIGHT_38mm', 'GRS')).toBeNull();
  });

  it('ROL estándar → cae en colorAMec, no en reglasCategoria', () => {
    expect(reglaCategoriaAplicable('ROL', 'BCO')).toBeNull();
    expect(mecPorCategoriaYColor('ROL', 'BCO')).toBeNull();
    expect(numeroMecPorColor('BCO')).toBe(33);
  });
});

describe('REGLAS_MECANISMO — categoriasSinMecanismo', () => {
  it('VERTICAL y BEEBLACK no requieren mecanismo', () => {
    for (const cat of REGLAS_MECANISMO.categoriasSinMecanismo) {
      expect(categoriaRequiereMecanismo(cat)).toBe(false);
    }
    expect(categoriaRequiereMecanismo('ROL')).toBe(true);
  });
});
