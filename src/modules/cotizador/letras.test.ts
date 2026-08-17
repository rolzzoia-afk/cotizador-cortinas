import { describe, it, expect } from 'vitest';
import { letraPano } from './letras';

describe('letraPano', () => {
  it('A-Z para los primeros 26', () => {
    expect(letraPano(1)).toBe('A');
    expect(letraPano(2)).toBe('B');
    expect(letraPano(26)).toBe('Z');
  });

  it('después de la Z repite la misma letra: AA, BB, CC… (nunca da la vuelta)', () => {
    expect(letraPano(27)).toBe('AA');
    expect(letraPano(28)).toBe('BB');
    expect(letraPano(29)).toBe('CC');
    expect(letraPano(44)).toBe('RR');
    expect(letraPano(52)).toBe('ZZ');
  });

  it('cada vuelta al abecedario suma una copia de la letra', () => {
    expect(letraPano(53)).toBe('AAA');
    expect(letraPano(54)).toBe('BBB');
    expect(letraPano(78)).toBe('ZZZ');
    expect(letraPano(79)).toBe('AAAA');
    expect(letraPano(88)).toBe('JJJJ'); // el último paño de la OT 268-6
  });

  it('las letras son únicas (260 paños = 10 vueltas, 260 letras distintas)', () => {
    const letras = Array.from({ length: 260 }, (_, i) => letraPano(i + 1));
    expect(new Set(letras).size).toBe(260);
  });

  it('fuera de rango → cadena vacía', () => {
    expect(letraPano(0)).toBe('');
    expect(letraPano(-3)).toBe('');
    expect(letraPano(NaN)).toBe('');
  });
});
