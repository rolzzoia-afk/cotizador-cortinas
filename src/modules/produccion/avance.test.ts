import { describe, expect, it } from 'vitest';
import { calcularAvance, calcularSubEtapa, debeAvanzar } from './avance';

describe('calcularAvance', () => {
  it('cuenta solo las claves que existen', () => {
    const hechas = new Set(['r0', 'r2', 'r99']);
    expect(calcularAvance(['r0', 'r1', 'r2', 'r3'], hechas)).toEqual({
      hechas: 2,
      total: 4,
      pct: 50,
    });
  });

  it('sin nada que marcar es 0, nunca NaN', () => {
    expect(calcularAvance([], new Set())).toEqual({ hechas: 0, total: 0, pct: 0 });
  });

  it('todo marcado es 100', () => {
    expect(calcularAvance(['a'], new Set(['a'])).pct).toBe(100);
  });
});

// El flujo real: Estructura ∥ Paños → Dimensionado; Armado espera a los dos.
describe('calcularSubEtapa', () => {
  it('sin nada cerrado, la OT está en Estructura', () => {
    expect(calcularSubEtapa({})).toBe('Estructura');
  });

  it('cerrar Paños habilita Dimensionado', () => {
    expect(calcularSubEtapa({ panos: true })).toBe('Dimensionado');
  });

  it('cerrar SOLO Estructura no adelanta nada: falta el paño', () => {
    expect(calcularSubEtapa({ estructura: true })).toBe('Estructura');
  });

  it('Estructura sola con los paños listos sigue en Dimensionado', () => {
    expect(calcularSubEtapa({ estructura: true, panos: true })).toBe('Dimensionado');
  });

  it('Armado necesita Estructura Y Dimensionado', () => {
    expect(calcularSubEtapa({ dimensionado: true, panos: true })).toBe('Dimensionado');
    expect(calcularSubEtapa({ estructura: true, dimensionado: true, panos: true })).toBe('Armado');
  });

  it('Armado cerrado manda a Prueba y Prueba cerrada, a Lista', () => {
    expect(calcularSubEtapa({ estructura: true, dimensionado: true, armado: true })).toBe('Prueba');
    expect(calcularSubEtapa({ armado: true, prueba: true })).toBe('Lista');
  });

  it('la bodega no mueve la sub-etapa: prepara material, no fabrica', () => {
    expect(calcularSubEtapa({ bodega: true })).toBe('Estructura');
  });
});

describe('debeAvanzar', () => {
  it('una OT sin sub-etapa arranca donde diga el taller', () => {
    expect(debeAvanzar(null, 'Estructura')).toBe(true);
    expect(debeAvanzar(undefined, 'Armado')).toBe(true);
  });

  it('avanza cuando el objetivo está más adelante', () => {
    expect(debeAvanzar('Estructura', 'Dimensionado')).toBe(true);
    expect(debeAvanzar('Armado', 'Lista')).toBe(true);
  });

  it('NUNCA retrocede: es la regla que protege el override del Panel', () => {
    expect(debeAvanzar('Armado', 'Dimensionado')).toBe(false);
    expect(debeAvanzar('Lista', 'Estructura')).toBe(false);
  });

  it('quedarse donde está tampoco es avanzar (no se re-escribe la OT)', () => {
    expect(debeAvanzar('Prueba', 'Prueba')).toBe(false);
  });
});
