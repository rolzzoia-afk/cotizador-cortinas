import { describe, it, expect } from 'vitest';
import {
  cotizarFase0,
  metrosTelaPorPanos,
  metrosTelaVertical,
} from './motorFase0';
import type { CatalogoProductos } from './types';

// Catálogo mínimo para los casos reales. Para cada COD se incluye un producto
// cuyo precio es el MAX de esa familia (lo que usa el motor como precio/ml).
const CAT: CatalogoProductos = {
  // Familias dúo (Guillermo / Jorge / Francisco)
  'DU 25': { cod: 'DUOBK_D', producto: 'ROLLER DUO BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 40307.692307692305 },
  'DB-P': { cod: 'DUOBK_P', producto: 'ROLLER DUO BLACKOUT PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 32292.30769230769 },
  'DUOP-P': { cod: 'DUOPOLI_P', producto: 'ROLLER DUO POLIESTER PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 28603.93846153846 },
  // Familias roller del caso Felipe (precio/ml de 2020)
  'SC 34': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 31582 },
  'BK 18': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 41868 },
  'SC 34-V': { cod: 'SCREEN_V_P', producto: 'CORTINA VERTICAL SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 38942.2923076923 },
};
const AR: Record<string, number> = {
  'DU 25': 2.65, 'DB-P': 2.65, 'DUOP-P': 2.88,
  'SC 34': 2.98, 'BK 18': 2.98, 'SC 34-V': 2.98,
};

const cerca = (valor: number, esperado: number, tolPct: number) =>
  Math.abs(valor - esperado) / esperado <= tolPct;

describe('motorFase0 — armado de paños (algoritmo correcto)', () => {
  it('paños roller: ordena por ancho y agrupa tomando alto máximo', () => {
    // Caso Felipe Screen Premium: anchos 1.124/1.168/0.992 y altos casi
    // iguales (1.55/1.557/1.56). Acomoda 0.992+1.124 en un paño (alto 1.56)
    // y 1.168 en otro (alto 1.557). MTS = 3.117.
    const piezas = [
      { ancho: 1.124, altoReal: 1.55 },
      { ancho: 1.168, altoReal: 1.557 },
      { ancho: 0.992, altoReal: 1.56 },
    ];
    expect(metrosTelaPorPanos(piezas, 2.98)).toBeCloseTo(3.117, 3);
  });

  it('paños vertical: nº de paños = redondear (ancho ÷ ancho de rollo)', () => {
    const piezas = [{ ancho: 1.869, altoReal: 2.55 }];
    // ancho 1.869 / rollo 2.98 = 0,627 → redondea a 1 paño. MTS = 2,55.
    expect(metrosTelaVertical(piezas, 2.98)).toBeCloseTo(2.55, 3);
  });
});

describe('motorFase0 — validación al peso contra cotizaciones reales', () => {
  it('Guillermo (Dúo Blackout Delux) — exacto', () => {
    const r = cotizarFase0(
      [
        { codInt: 'DU 25', ancho: 2.44, alto: 2.25, cantidad: 1 },
        { codInt: 'DU 25', ancho: 1.76, alto: 1.8, cantidad: 1 },
        { codInt: 'DU 25', ancho: 1.76, alto: 1.8, cantidad: 1 },
      ],
      CAT, AR,
    );
    expect(cerca(r.lineas[0].valorUnit, 465137.31, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 282266.46, 0.001)).toBe(true);
  });

  it('Jorge (Dúo Blackout Premium) — exacto', () => {
    const r = cotizarFase0(
      [
        { codInt: 'DB-P', ancho: 1.7, alto: 2.3, cantidad: 1 },
        { codInt: 'DB-P', ancho: 1.45, alto: 1.5, cantidad: 1 },
        { codInt: 'DB-P', ancho: 0.78, alto: 2.3, cantidad: 1 },
        { codInt: 'DB-P', ancho: 0.78, alto: 2.3, cantidad: 1 },
      ],
      CAT, AR,
    );
    expect(cerca(r.lineas[0].valorUnit, 349003.15, 0.001)).toBe(true);
    expect(cerca(r.lineas[2].valorUnit, 169601.45, 0.001)).toBe(true);
  });

  it('Francisco (Dúo Poliéster) — ~1,6% (ajuste fino pendiente)', () => {
    const r = cotizarFase0(
      [
        { codInt: 'DUOP-P', ancho: 2.025, alto: 1.9, cantidad: 1 },
        { codInt: 'DUOP-P', ancho: 2.025, alto: 1.9, cantidad: 1 },
      ],
      CAT, AR,
    );
    expect(cerca(r.lineas[0].valorUnit, 275841.48, 0.02)).toBe(true);
  });

  it('Felipe Screen Premium (3 cortinas) — exacto', () => {
    const r = cotizarFase0(
      [
        { codInt: 'SC 34', ancho: 1.124, alto: 1.3, cantidad: 1 },
        { codInt: 'SC 34', ancho: 1.168, alto: 1.307, cantidad: 1 },
        { codInt: 'SC 34', ancho: 0.992, alto: 1.31, cantidad: 1 },
      ],
      CAT, AR,
    );
    expect(cerca(r.lineas[0].valorUnit, 123832.7, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 128494.2, 0.001)).toBe(true);
    expect(cerca(r.lineas[2].valorUnit, 111950.68, 0.001)).toBe(true);
  });

  it('Felipe Blackout Delux (2 cortinas) — exacto', () => {
    const r = cotizarFase0(
      [
        { codInt: 'BK 18', ancho: 1.23, alto: 1.4, cantidad: 1 },
        { codInt: 'BK 18', ancho: 1.1, alto: 1.41, cantidad: 1 },
      ],
      CAT, AR,
    );
    expect(cerca(r.lineas[0].valorUnit, 139601.96, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 127358.68, 0.001)).toBe(true);
  });

  it('Felipe Vertical Screen Premium — ~5% (receta vertical pendiente de afinar)', () => {
    const r = cotizarFase0(
      [{ codInt: 'SC 34-V', ancho: 1.869, alto: 2.3, cantidad: 1 }],
      CAT, AR,
    );
    expect(cerca(r.lineas[0].valorUnit, 383068.76, 0.06)).toBe(true);
  });
});
