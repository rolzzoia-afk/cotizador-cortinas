import { describe, expect, it } from 'vitest';
import { panosDibujados } from './layoutPano';
import { PARAMETROS_CORTE_DEFAULT } from './parametrosCorte';
import type { OptimizerRow } from './tela';

const fila = (
  ubicacion: string,
  junto: string,
  numeroPano: number,
  ancho: number,
  altoCorte: number,
  extra: Partial<OptimizerRow> = {},
): OptimizerRow =>
  ({
    codInt: 'SC 65',
    producto: 'ROLLER SCREEN PREMIUM',
    ubicacion,
    junto,
    numeroPano,
    ancho,
    altoCorte,
    altoReal: altoCorte,
    anchoRollo: 2.98,
    ...extra,
  }) as unknown as OptimizerRow;

describe('panosDibujados', () => {
  it('las cortinas del mismo paño van una al lado de la otra, sin pisarse', () => {
    const panos = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56),
      fila('DORM 2', 'A', 1, 1.29, 2.56),
    ]);
    expect(panos).toHaveLength(1);
    const [p] = panos;
    expect(p.letra).toBe('A');
    expect(p.piezas.map((x) => x.px)).toEqual([0, 137]);
    expect(p.piezas.map((x) => x.pw)).toEqual([137, 129]);
    expect(p.altoPanoCm).toBe(256);
    expect(p.anchoRolloCm).toBe(298);
  });

  it('el alto del paño es el de la cortina MÁS ALTA del tiro', () => {
    const [p] = panosDibujados([
      fila('PPAL', 'A', 1, 1.2, 2.05),
      fila('DORM', 'A', 1, 1.2, 2.56),
    ]);
    expect(p.altoPanoCm).toBe(256);
  });

  it('cada paño lleva su letra, la misma de la etiqueta y del Dimensionado', () => {
    const panos = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56),
      fila('DORM 2', 'A', 1, 1.29, 2.56),
      fila('LIVING', 'B', 2, 2.5, 2.56),
    ]);
    expect(panos.map((p) => p.letra)).toEqual(['A', 'B']);
    expect(panos.map((p) => p.piezas.length)).toEqual([2, 1]);
  });

  it('la INVERTIDA se dibuja girada: su alto viaja a lo ancho del rollo', () => {
    const [p] = panosDibujados([
      fila('VENTANAL', 'A', 1, 3.4, 2.2, { pano: { invertida: true } as never }),
    ]);
    expect(p.piezas[0].invertida).toBe(true);
    expect(p.piezas[0].pw).toBe(220); // el alto de corte, a lo ancho
    expect(p.piezas[0].ph).toBe(340); // el ancho de la cortina, a lo largo
  });

  it('trae el orden de los cortes: dos cortinas juntas = un corte', () => {
    const [p] = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56),
      fila('DORM 2', 'A', 1, 1.29, 2.56),
    ]);
    expect(p.cortes).toHaveLength(1);
    expect(p.cortes![0].eje).toBe('longitudinal');
    expect(p.cortes![0].posicionCm).toBe(137);
  });

  it('una sola cortina no lleva cortes de separación', () => {
    const [p] = panosDibujados([fila('PPAL', 'A', 1, 1.37, 2.56)]);
    expect(p.cortes).toEqual([]);
  });

  it('marca los paños que salen de colmena (no se bajan del rollo)', () => {
    const panos = panosDibujados(
      [fila('PPAL', 'A', 1, 1.37, 2.56), fila('LIVING', 'B', 2, 1.5, 2.56)],
      PARAMETROS_CORTE_DEFAULT,
      new Map([[2, 'A-27 · 178X210']]),
    );
    expect(panos[0].colmena).toBe('');
    expect(panos[1].colmena).toBe('A-27 · 178X210');
  });

  it('en oscuridad manda el ancho de CORTE real, no el nominal', () => {
    const [p] = panosDibujados([
      fila('VENTANAL', 'A', 1, 2.9, 2.5, { anchoCorteTelaCm: 299.34 }),
    ]);
    expect(p.piezas[0].anchoCm).toBe(299.3);
  });
});
