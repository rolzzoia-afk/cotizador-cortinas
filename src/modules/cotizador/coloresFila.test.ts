import { describe, expect, it } from 'vitest';
import {
  PALETA_FILA,
  colorFilaSaneado,
  estiloFilaPintada,
  nombreColorFila,
  rgbDeHex,
} from './coloresFila';

describe('PALETA_FILA', () => {
  it('trae ocho colores, todos hex válidos y sin repetir', () => {
    expect(PALETA_FILA).toHaveLength(8);
    for (const c of PALETA_FILA) {
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(c.nombre.trim()).not.toBe('');
    }
    const hexes = PALETA_FILA.map((c) => c.hex.toUpperCase());
    expect(new Set(hexes).size).toBe(8);
    const ids = PALETA_FILA.map((c) => c.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('son pasteles: el texto negro del PDF se lee sobre todos', () => {
    // La misma cuenta de luminancia que usa `estiloChipHex` para decidir el
    // color del texto. Si alguien mete un tono oscuro en la paleta, la fila del
    // PDF quedaría con texto negro sobre fondo oscuro (el PDF no lo invierte).
    for (const c of PALETA_FILA) {
      const [r, g, b] = rgbDeHex(c.hex)!;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      expect(lum).toBeGreaterThan(150);
    }
  });
});

describe('rgbDeHex', () => {
  it('convierte a los tres números que pide jsPDF', () => {
    expect(rgbDeHex('#FFD966')).toEqual([255, 217, 102]);
    expect(rgbDeHex('#ffd966')).toEqual([255, 217, 102]);
    expect(rgbDeHex('#abc')).toEqual([170, 187, 204]);
  });

  it('sin color devuelve undefined: la fila cae en el fondo alternado', () => {
    expect(rgbDeHex(undefined)).toBeUndefined();
    expect(rgbDeHex(null)).toBeUndefined();
    expect(rgbDeHex('')).toBeUndefined();
    expect(rgbDeHex('amarillo')).toBeUndefined();
    expect(rgbDeHex('#12345')).toBeUndefined();
  });
});

describe('estiloFilaPintada', () => {
  it('pinta el fondo y fuerza texto oscuro sobre los ocho pasteles', () => {
    for (const c of PALETA_FILA) {
      const e = estiloFilaPintada(c.hex)!;
      expect(e.backgroundColor.toUpperCase()).toBe(c.hex.toUpperCase());
      // Oscuro también en modo oscuro, donde el texto normal es claro.
      expect(e.color).toBe('#1c1917');
    }
  });

  it('sin color no devuelve estilo', () => {
    expect(estiloFilaPintada(undefined)).toBeUndefined();
    expect(estiloFilaPintada('')).toBeUndefined();
  });
});

describe('colorFilaSaneado y nombreColorFila', () => {
  it('guarda el hex en mayúsculas y descarta la basura', () => {
    expect(colorFilaSaneado('#ffd966')).toBe('#FFD966');
    expect(colorFilaSaneado('  #A9D18E ')).toBe('#A9D18E');
    expect(colorFilaSaneado('')).toBeUndefined();
    expect(colorFilaSaneado('rojo')).toBeUndefined();
  });

  it('nombra la pastilla para el globo del botón', () => {
    expect(nombreColorFila('#FFD966')).toBe('Amarillo');
    expect(nombreColorFila('#ffd966')).toBe('Amarillo');
    expect(nombreColorFila(undefined)).toBe('Sin color');
    // Un hex de una OT vieja que ya no está en la paleta se sigue mostrando.
    expect(nombreColorFila('#123456')).toBe('Color propio');
  });
});
