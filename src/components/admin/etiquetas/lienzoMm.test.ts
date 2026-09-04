import { describe, expect, it } from 'vitest';
import { aMm, dentroDeLaHoja, pxPorMm, ZOOM_MAX, ZOOM_MIN } from './LienzoMm';

describe('pxPorMm', () => {
  it('al 100 % usa los 96 dpi de CSS, los mismos del documento impreso', () => {
    // 62 mm (el ancho de la etiqueta Brother) → 234,3 px.
    expect(pxPorMm(1) * 62).toBeCloseTo(234.33, 1);
  });

  it('el zoom escala en proporción', () => {
    expect(pxPorMm(2)).toBeCloseTo(pxPorMm(1) * 2, 5);
    expect(pxPorMm(0.5)).toBeCloseTo(pxPorMm(1) / 2, 5);
  });

  it('acota el zoom y aguanta basura', () => {
    expect(pxPorMm(99)).toBe(pxPorMm(ZOOM_MAX));
    expect(pxPorMm(0.01)).toBe(pxPorMm(ZOOM_MIN));
    expect(pxPorMm(NaN)).toBe(pxPorMm(1));
  });
});

describe('aMm', () => {
  it('vuelve de píxeles a milímetros con la misma escala', () => {
    expect(aMm(pxPorMm(1) * 12.5, 1)).toBe(12.5);
    expect(aMm(pxPorMm(1.75) * 8.3, 1.75)).toBe(8.3);
  });

  it('redondea a décimas de milímetro: es la precisión que se puede arrastrar', () => {
    expect(aMm(pxPorMm(1) * 12.3456, 1)).toBe(12.3);
  });
});

describe('dentroDeLaHoja', () => {
  it('no deja que un elemento se salga del papel', () => {
    expect(dentroDeLaHoja(70, 10, 62)).toBe(52);
    expect(dentroDeLaHoja(-5, 10, 62)).toBe(0);
    expect(dentroDeLaHoja(20, 10, 62)).toBe(20);
  });

  it('un elemento más grande que la hoja queda pegado al borde', () => {
    expect(dentroDeLaHoja(5, 80, 62)).toBe(0);
  });

  it('la basura cae en 0', () => {
    expect(dentroDeLaHoja(NaN, 10, 62)).toBe(0);
  });
});
