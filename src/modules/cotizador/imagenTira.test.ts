import { describe, expect, it } from 'vitest';
import { ANCHO_MAX_TIRA_PX, medidasReducidas } from './imagenTira';

describe('medidasReducidas', () => {
  it('achica al ancho máximo conservando la proporción', () => {
    // La tira original del Excel manual: 2646 × 284.
    const m = medidasReducidas(2646, 284);
    expect(m.ancho).toBe(ANCHO_MAX_TIRA_PX);
    expect(m.ancho / m.alto).toBeCloseTo(2646 / 284, 1);
  });

  it('una imagen que ya viene chica no se agranda', () => {
    expect(medidasReducidas(1400, 150)).toEqual({ ancho: 1400, alto: 150 });
  });

  it('redondea a píxeles enteros: un canvas no acepta decimales', () => {
    const m = medidasReducidas(1000.4, 333.7, 500);
    expect(Number.isInteger(m.ancho)).toBe(true);
    expect(Number.isInteger(m.alto)).toBe(true);
  });

  it('una franja larguísima nunca queda en cero de alto', () => {
    expect(medidasReducidas(20000, 3, 1600).alto).toBe(1);
  });

  it('medidas inservibles devuelven cero: quien llama aborta la subida', () => {
    for (const [a, b] of [
      [0, 100],
      [100, 0],
      [-5, 5],
      [NaN, 10],
      [Infinity, 10],
    ]) {
      expect(medidasReducidas(a, b)).toEqual({ ancho: 0, alto: 0 });
    }
  });
});
