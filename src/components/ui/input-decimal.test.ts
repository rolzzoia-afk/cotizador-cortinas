// Los helpers del InputDecimal. El componente no se testea acá porque el
// entorno de vitest es `node` (sin DOM); lo que importa —qué se acepta como
// número terminado y qué no— es puro y vive en estas dos funciones.
import { describe, expect, it } from 'vitest';
import { decimalATexto, textoADecimal } from './input-decimal';

describe('textoADecimal', () => {
  it('acepta coma y punto como separador decimal', () => {
    expect(textoADecimal('0,65')).toBe(0.65);
    expect(textoADecimal('0.65')).toBe(0.65);
    expect(textoADecimal('2,45')).toBe(2.45);
  });

  it('acepta enteros y negativos', () => {
    expect(textoADecimal('83300')).toBe(83300);
    expect(textoADecimal('0')).toBe(0);
    expect(textoADecimal('-1,5')).toBe(-1.5);
  });

  it('ignora los espacios de los costados', () => {
    expect(textoADecimal('  0,6  ')).toBe(0.6);
  });

  // El corazón del bug: mientras se teclea «0,6» el campo pasa por «0,». Si eso
  // se tomara como número, el padre guardaría un 0 y repintaría el campo,
  // borrando la coma recién escrita.
  it('devuelve null mientras el número está a medio escribir', () => {
    expect(textoADecimal('0,')).toBeNull();
    expect(textoADecimal('0.')).toBeNull();
    expect(textoADecimal('-')).toBeNull();
    expect(textoADecimal('')).toBeNull();
    expect(textoADecimal('   ')).toBeNull();
  });

  it('devuelve null con basura', () => {
    expect(textoADecimal('abc')).toBeNull();
    expect(textoADecimal('1,2,3')).toBeNull();
  });

  it('los ceros a la derecha no cambian el número (se pueden seguir tecleando)', () => {
    expect(textoADecimal('0,50')).toBe(0.5);
    expect(textoADecimal('0,500')).toBe(0.5);
  });
});

describe('decimalATexto', () => {
  it('muestra con coma', () => {
    expect(decimalATexto(0.6)).toBe('0,6');
    expect(decimalATexto(2.45)).toBe('2,45');
  });

  it('deja los enteros sin decoración', () => {
    expect(decimalATexto(83300)).toBe('83300');
    expect(decimalATexto(0)).toBe('0');
  });

  it('un valor no numérico queda vacío', () => {
    expect(decimalATexto(NaN)).toBe('');
  });

  it('ida y vuelta', () => {
    for (const v of [0, 0.6, 0.65, 1, 2.45, 41650, 0.0415]) {
      expect(textoADecimal(decimalATexto(v))).toBe(v);
    }
  });
});
