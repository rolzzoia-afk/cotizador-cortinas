import { describe, it, expect } from 'vitest';
import { letraPano } from './letras';

describe('letraPano', () => {
  it('A-Z para los primeros 26', () => {
    expect(letraPano(1)).toBe('A');
    expect(letraPano(2)).toBe('B');
    expect(letraPano(26)).toBe('Z');
  });

  it('sigue estilo Excel después de la Z (nunca da la vuelta)', () => {
    expect(letraPano(27)).toBe('AA');
    expect(letraPano(28)).toBe('AB');
    expect(letraPano(52)).toBe('AZ');
    expect(letraPano(53)).toBe('BA');
    expect(letraPano(78)).toBe('BZ');
    expect(letraPano(79)).toBe('CA');
    expect(letraPano(88)).toBe('CJ'); // el último paño de la OT 268-6
    expect(letraPano(702)).toBe('ZZ');
    expect(letraPano(703)).toBe('AAA');
  });

  it('las letras son únicas (704 paños, 704 letras distintas)', () => {
    const letras = Array.from({ length: 704 }, (_, i) => letraPano(i + 1));
    expect(new Set(letras).size).toBe(704);
  });

  it('fuera de rango → cadena vacía', () => {
    expect(letraPano(0)).toBe('');
    expect(letraPano(-3)).toBe('');
    expect(letraPano(NaN)).toBe('');
  });
});
