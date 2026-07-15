import { describe, expect, it } from 'vitest';
import {
  REGLAS_MECANISMO,
  categoriaRequiereMecanismo,
  colorConBandaAncho,
  mecEsFijoPorCategoria,
  mecPorAncho,
  mecPorCategoriaYColor,
  numeroMecPorColor,
  reglaAnchoAplicable,
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

  it('cenefa ovalada motorizada → sin regla (el motor reemplaza al mecanismo)', () => {
    expect(reglaCategoriaAplicable('ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO', 'BCO')).toBeNull();
  });

  it('cenefa ovalada 45 mm (E78) → mismo kit ovalada de bodega que el 38 mm (39/38/12)', () => {
    // 2026-07-15: la ovalada 45 mm dejó de caer al kit simple; usa el kit ovalada.
    expect(mecPorCategoriaYColor('ROL_MANUAL_CENEFA_OVALADA_45mm', 'BCO')).toBe(39);
    expect(mecPorCategoriaYColor('ROL_MANUAL_CENEFA_OVALADA_45mm', 'NEG')).toBe(38);
    expect(mecPorCategoriaYColor('ROL_MANUAL_CENEFA_OVALADA_45mm', 'GRIS')).toBe(12);
    expect(mecPorCategoriaYColor('DUO_MANUAL_45mm', 'BLANCO')).toBe(39);
    expect(mecPorCategoriaYColor('DUO_MANUAL_45mm', 'NEG')).toBe(38);
    expect(mecPorCategoriaYColor('DUO_MANUAL_45mm', 'GRS')).toBe(12);
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

describe('REGLAS_MECANISMO — reglasAncho (banda 2,2–3,0 → kit 45 · >3 → MEC 28)', () => {
  it('ROL en banda: blanco → 18, negro → 23, gris → sin regla (manual)', () => {
    expect(mecPorAncho('ROL', 2.5, 'BCO')).toBe(18);
    expect(mecPorAncho('ROL', 2.5, 'BLANCO')).toBe(18);
    expect(mecPorAncho('ROL', 2.5, 'NEG')).toBe(23);
    expect(mecPorAncho('ROL', 2.5, 'GRS')).toBeNull();
    expect(mecPorAncho('ROL', 2.5, 'GRIS')).toBeNull();
    expect(mecPorAncho('ROL', 2.5)).toBeNull(); // sin color no hay banda
  });
  it('fronteras: 2,2 exacto fuera; 3,0 exacto dentro; >3,0 → MEC 28 (cualquier color)', () => {
    expect(mecPorAncho('ROL', 2.2, 'BCO')).toBeNull();
    expect(mecPorAncho('ROL', 3.0, 'BCO')).toBe(18);
    expect(mecPorAncho('ROL', 3.01, 'BCO')).toBe(28);
    expect(mecPorAncho('ROL', 3.5, 'GRS')).toBe(28); // la fila >3 m es fija, sin color
  });
  it('DUO_MANUAL_38mm en banda: kit ovalada de bodega por color (39/38/12), fila 45 vía modeloMecPorColor', () => {
    // 2026-07-15: el kit MOSTRADO es el ovalada de bodega; la FILA 45 mm del
    // catálogo sigue siendo MEC_18/23 (modeloMecPorColor), que consume modeloPorAncho.
    expect(mecPorAncho('DUO_MANUAL_38mm', 2.5, 'BCO')).toBe(39);
    expect(mecPorAncho('DUO_MANUAL_38mm', 2.5, 'GRS')).toBe(12);
    expect(mecPorAncho('DUO_MANUAL_38mm', 2.5, 'NEG')).toBe(38);
    const reglaNeg = reglaAnchoAplicable('DUO_MANUAL_38mm', 2.5, 'NEG')?.regla;
    expect(reglaNeg?.categoriaModelo).toBe('DUO_MANUAL_45mm');
    expect(reglaNeg?.modeloMecPorColor?.NEG).toBe(23);
    expect(reglaNeg?.modeloMecPorColor?.BCO).toBe(18);
    expect(mecPorAncho('DUO_MANUAL_38mm', 3.5, 'NEG')).toBeNull(); // el dúo no tiene regla >3 m
  });
  it('la regla trae el tubo y la nota para la UI', () => {
    expect(reglaAnchoAplicable('ROL', 2.5, 'BCO')?.regla.tubo).toBe('E78');
    expect(reglaAnchoAplicable('ROL', 3.5, 'GRS')?.regla.tubo).toBe('E65');
    expect(reglaAnchoAplicable('ROL', 2.5, 'NEG')?.regla.nota).toContain('E78');
  });
  it('colorConBandaAncho: decide la vuelta automática 45→38', () => {
    expect(colorConBandaAncho('ROL', 'BCO')).toBe(true);
    expect(colorConBandaAncho('ROL', 'NEGRO')).toBe(true);
    expect(colorConBandaAncho('ROL', 'GRS')).toBe(false); // gris = manual, no se revierte
    expect(colorConBandaAncho('DUO_MANUAL_38mm', 'GRIS')).toBe(true);
    expect(colorConBandaAncho('OSCURANTI_63mm', 'BCO')).toBe(false);
  });
});
