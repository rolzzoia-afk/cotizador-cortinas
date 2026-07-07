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

  it('DUO_MANUAL_38mm + BCO → MEC 39 (cenefa ovalada blanco, no kit simple)', () => {
    const regla = reglaCategoriaAplicable('DUO_MANUAL_38mm', 'BCO');
    expect(regla?.mec).toBe(39);
    expect(regla?.codigoInventario).toBe('MEC_39_OVALADA_BLANCO');
    expect(mecPorCategoriaYColor('DUO_MANUAL_38mm', 'BLANCO')).toBe(39);
  });

  it('DUO_MANUAL_38mm + NEG → MEC 38 y + GRS → MEC 12 (kits ovalada de bodega)', () => {
    const negro = reglaCategoriaAplicable('DUO_MANUAL_38mm', 'NEG');
    expect(negro?.mec).toBe(38);
    expect(negro?.codigoInventario).toBe('MEC_38_OVALADA_NEGRO');
    expect(mecPorCategoriaYColor('DUO_MANUAL_38mm', 'NEGRO')).toBe(38);
    const gris = reglaCategoriaAplicable('DUO_MANUAL_38mm', 'GRIS');
    expect(gris?.mec).toBe(12);
    expect(gris?.codigoInventario).toBe('MEC_12_OVALADA_GRIS');
    expect(mecPorCategoriaYColor('DUO_MANUAL_38mm', 'GRS')).toBe(12);
  });

  it('ROL_MANUAL_CENEFA_OVALADA_38mm → kits ovalada por color (39/38/12)', () => {
    const blanco = reglaCategoriaAplicable('ROL_MANUAL_CENEFA_OVALADA_38mm', 'BCO');
    expect(blanco?.mec).toBe(39);
    expect(blanco?.codigoInventario).toBe('MEC_39_OVALADA_BLANCO');
    expect(mecPorCategoriaYColor('ROL_MANUAL_CENEFA_OVALADA_38mm', 'BLANCO')).toBe(39);
    expect(mecPorCategoriaYColor('ROL_MANUAL_CENEFA_OVALADA_38mm', 'NEG')).toBe(38);
    expect(mecPorCategoriaYColor('ROL_MANUAL_CENEFA_OVALADA_38mm', 'GRIS')).toBe(12);
  });

  it('cenefa ovalada motorizada o 45 mm → sin regla (motor / kit simple)', () => {
    expect(reglaCategoriaAplicable('ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO', 'BCO')).toBeNull();
    expect(reglaCategoriaAplicable('ROL_MANUAL_CENEFA_OVALADA_45mm', 'BCO')).toBeNull();
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
