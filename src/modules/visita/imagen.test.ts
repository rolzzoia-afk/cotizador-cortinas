import { describe, expect, it } from 'vitest';
import { dimensionesEscaladas, LADO_MAX_FOTO } from './imagen';

describe('dimensionesEscaladas', () => {
  it('una foto más grande baja su lado MAYOR al máximo, conservando la proporción', () => {
    // 4032×3024 (foto típica de teléfono, 4:3 horizontal) → 1920×1440.
    expect(dimensionesEscaladas(4032, 3024)).toEqual({ ancho: 1920, alto: 1440 });
    // Vertical: manda el alto.
    expect(dimensionesEscaladas(3024, 4032)).toEqual({ ancho: 1440, alto: 1920 });
  });

  it('NO agranda una foto que ya es chica', () => {
    // Agrandarla sumaría peso sin agregar un solo detalle.
    expect(dimensionesEscaladas(800, 600)).toEqual({ ancho: 800, alto: 600 });
    expect(dimensionesEscaladas(LADO_MAX_FOTO, 100)).toEqual({ ancho: LADO_MAX_FOTO, alto: 100 });
  });

  it('devuelve enteros: un canvas no acepta medio píxel', () => {
    const r = dimensionesEscaladas(3000, 2001);
    expect(Number.isInteger(r.ancho)).toBe(true);
    expect(Number.isInteger(r.alto)).toBe(true);
  });

  it('respeta un máximo distinto al de fábrica', () => {
    expect(dimensionesEscaladas(2000, 1000, 1000)).toEqual({ ancho: 1000, alto: 500 });
  });

  it('medidas imposibles dan 0 en vez de NaN', () => {
    // Sin esto, un bitmap corrupto haría un canvas de NaN×NaN.
    expect(dimensionesEscaladas(0, 100)).toEqual({ ancho: 0, alto: 0 });
    expect(dimensionesEscaladas(-5, 10)).toEqual({ ancho: 0, alto: 0 });
    expect(dimensionesEscaladas(Number.NaN, 10)).toEqual({ ancho: 0, alto: 0 });
  });
});
