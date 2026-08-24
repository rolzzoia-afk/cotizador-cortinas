import { describe, it, expect } from 'vitest';
import { calcularEscala } from './LienzoEscalado';

describe('la escala de la vista previa del documento', () => {
  it('achica el documento hasta que su ancho real quepa en el editor', () => {
    // Monitor de 1600 px con el panel de propiedades al lado: la vista previa
    // tiene ~850 px para dibujar una página de 1600.
    expect(calcularEscala(850, 1600)).toBeCloseTo(0.53125, 5);
  });

  it('nunca agranda: si sobra espacio, el documento va a tamaño natural', () => {
    expect(calcularEscala(1600, 850)).toBe(1);
    expect(calcularEscala(850, 850)).toBe(1);
  });

  it('vale 1 mientras no se haya medido (evita dividir por cero)', () => {
    expect(calcularEscala(0, 1600)).toBe(1);
    expect(calcularEscala(850, 0)).toBe(1);
    expect(calcularEscala(0, 0)).toBe(1);
  });

  it('vale 1 con medidas inválidas', () => {
    expect(calcularEscala(NaN, 1600)).toBe(1);
    expect(calcularEscala(850, Infinity)).toBe(1);
    expect(calcularEscala(-100, 1600)).toBe(1);
  });
});
