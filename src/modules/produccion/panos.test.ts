import { describe, expect, it } from 'vitest';
import { clavesDePano, clavesDeSeccion } from './panos';

const rows = [
  { ventanaId: 'v1', panoIndex: 0 },
  { ventanaId: 'v1', panoIndex: 1 },
  { ventanaId: 'v2', panoIndex: 0 },
];

describe('clavesDePano', () => {
  it('le da a cada paño la pieza de su primera cortina', () => {
    // Las dos primeras cortinas se cortan juntas (paño 1); la tercera es el 2.
    const cortinas = [{ pano: 1 }, { pano: 1 }, { pano: 2 }];
    const mapa = clavesDePano(cortinas, rows, 'ot-9');
    expect(mapa.get(1)).toBe('ot-9_v1_p0');
    expect(mapa.get(2)).toBe('ot-9_v2_p0');
    expect(mapa.size).toBe(2);
  });

  it('la marca sigue a la pieza aunque el paño cambie de número', () => {
    // Mismo plan reagrupado: lo que era el paño 2 ahora es el 1.
    const antes = clavesDePano([{ pano: 1 }, { pano: 1 }, { pano: 2 }], rows, 'ot-9');
    const despues = clavesDePano([{ pano: 2 }, { pano: 2 }, { pano: 1 }], rows, 'ot-9');
    expect(despues.get(1)).toBe(antes.get(2));
    expect(despues.get(2)).toBe(antes.get(1));
  });

  it('una cortina sin fila del optimizador no inventa clave', () => {
    const mapa = clavesDePano([{ pano: 1 }, { pano: 2 }], [rows[0]], 'ot-9');
    expect(mapa.get(1)).toBe('ot-9_v1_p0');
    expect(mapa.has(2)).toBe(false);
  });

  it('sin cortinas devuelve un mapa vacío', () => {
    expect(clavesDePano([], rows, 'ot-9').size).toBe(0);
  });
});

describe('clavesDeSeccion', () => {
  const mapa = new Map([
    [1, 'ot-9_v1_p0'],
    [2, 'ot-9_v2_p0'],
  ]);

  it('devuelve las claves de los paños de esa hoja, en orden', () => {
    expect(clavesDeSeccion([{ pano: 2 }, { pano: 1 }], mapa)).toEqual([
      'ot-9_v2_p0',
      'ot-9_v1_p0',
    ]);
  });

  it('un paño sin clave se salta en vez de contarse mal', () => {
    expect(clavesDeSeccion([{ pano: 1 }, { pano: 7 }], mapa)).toEqual(['ot-9_v1_p0']);
  });
});
