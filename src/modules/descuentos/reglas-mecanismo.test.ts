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
  // La banda 2,2–3,0 m (tubo E78) requiere el flag usarTuboE78 = true (4º arg).
  // Con el flag apagado (default) el rango se queda en 38 mm → tubo E66.
  it('ROL en banda CON flag E78: blanco → 18, negro → 23, gris → sin regla (manual)', () => {
    expect(mecPorAncho('ROL', 2.5, 'BCO', true)).toBe(18);
    expect(mecPorAncho('ROL', 2.5, 'BLANCO', true)).toBe(18);
    expect(mecPorAncho('ROL', 2.5, 'NEG', true)).toBe(23);
    expect(mecPorAncho('ROL', 2.5, 'GRS', true)).toBeNull();
    expect(mecPorAncho('ROL', 2.5, 'GRIS', true)).toBeNull();
    expect(mecPorAncho('ROL', 2.5, undefined, true)).toBeNull(); // sin color no hay banda
  });
  it('ROL en banda SIN flag E78 (default): no sube: se queda en 38 mm (null)', () => {
    expect(mecPorAncho('ROL', 2.5, 'BCO')).toBeNull();
    expect(mecPorAncho('ROL', 2.5, 'NEG')).toBeNull();
    expect(mecPorAncho('ROL', 2.5, 'BCO', false)).toBeNull();
  });
  it('fronteras (flag E78 ON): 2,2 exacto fuera; 3,0 exacto dentro; >3,0 → MEC 28 sin flag', () => {
    expect(mecPorAncho('ROL', 2.2, 'BCO', true)).toBeNull();
    expect(mecPorAncho('ROL', 3.0, 'BCO', true)).toBe(18);
    // La fila >3 m (MEC 28/E65) es estructural: NO depende del flag E78.
    expect(mecPorAncho('ROL', 3.01, 'BCO')).toBe(28);
    expect(mecPorAncho('ROL', 3.01, 'BCO', true)).toBe(28);
    expect(mecPorAncho('ROL', 3.5, 'GRS')).toBe(28); // la fila >3 m es fija, sin color
  });
  it('DUO_MANUAL_38mm en banda (flag E78 ON): kit ovalada 39/38/12, fila 45 vía modeloMecPorColor', () => {
    expect(mecPorAncho('DUO_MANUAL_38mm', 2.5, 'BCO', true)).toBe(39);
    expect(mecPorAncho('DUO_MANUAL_38mm', 2.5, 'GRS', true)).toBe(12);
    expect(mecPorAncho('DUO_MANUAL_38mm', 2.5, 'NEG', true)).toBe(38);
    const reglaNeg = reglaAnchoAplicable('DUO_MANUAL_38mm', 2.5, 'NEG', true)?.regla;
    expect(reglaNeg?.categoriaModelo).toBe('DUO_MANUAL_45mm');
    expect(reglaNeg?.modeloMecPorColor?.NEG).toBe(23);
    expect(reglaNeg?.modeloMecPorColor?.BCO).toBe(18);
    expect(mecPorAncho('DUO_MANUAL_38mm', 3.5, 'NEG', true)).toBeNull(); // el dúo no tiene regla >3 m
    // Sin flag no sube.
    expect(mecPorAncho('DUO_MANUAL_38mm', 2.5, 'BCO')).toBeNull();
  });
  it('cenefa ovalada roller 38 mm en banda (flag E78 ON): kit 39/38, fila 45 vía 10/9; gris no sube', () => {
    expect(mecPorAncho('ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, 'BCO', true)).toBe(39);
    expect(mecPorAncho('ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, 'NEG', true)).toBe(38);
    expect(mecPorAncho('ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, 'GRS', true)).toBeNull(); // gris → 38/E66
    const regla = reglaAnchoAplicable('ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, 'BCO', true)?.regla;
    expect(regla?.categoriaModelo).toBe('ROL_MANUAL_CENEFA_OVALADA_45mm');
    expect(regla?.modeloMecPorColor?.BCO).toBe(10); // fila 45 = MEC_10 blanco
    expect(regla?.modeloMecPorColor?.NEG).toBe(9); //  fila 45 = MEC_09 negro
    expect(regla?.tubo).toBe('E78');
    // Sin flag (default) no sube: se queda en 38 mm.
    expect(mecPorAncho('ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, 'BCO')).toBeNull();
  });
  it('la regla trae el tubo y la nota para la UI (flag E78 ON)', () => {
    expect(reglaAnchoAplicable('ROL', 2.5, 'BCO', true)?.regla.tubo).toBe('E78');
    expect(reglaAnchoAplicable('ROL', 3.5, 'GRS')?.regla.tubo).toBe('E65'); // >3 m sin flag
    expect(reglaAnchoAplicable('ROL', 2.5, 'NEG', true)?.regla.nota).toContain('E78');
  });
  it('colorConBandaAncho: decide la vuelta automática 45→38 (NO gateado por el flag)', () => {
    expect(colorConBandaAncho('ROL', 'BCO')).toBe(true);
    expect(colorConBandaAncho('ROL', 'NEGRO')).toBe(true);
    expect(colorConBandaAncho('ROL', 'GRS')).toBe(false); // gris = manual, no se revierte
    expect(colorConBandaAncho('DUO_MANUAL_38mm', 'GRIS')).toBe(true);
    expect(colorConBandaAncho('ROL_MANUAL_CENEFA_OVALADA_38mm', 'BCO')).toBe(true);
    expect(colorConBandaAncho('ROL_MANUAL_CENEFA_OVALADA_38mm', 'GRS')).toBe(false);
    expect(colorConBandaAncho('OSCURANTI_63mm', 'BCO')).toBe(false);
  });
});
