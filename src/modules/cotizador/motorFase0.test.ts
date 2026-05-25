import { describe, it, expect } from 'vitest';
import { cotizarFase0, metrosTelaPorPanos, type FilaFase0 } from './motorFase0';
import type { CatalogoProductos } from './types';

// Catálogo mínimo para los casos reales (precio = MAX de la familia COD).
const CAT: CatalogoProductos = {
  'DU 25': { cod: 'DUOBK_D', producto: 'ROLLER DUO BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 40307.692307692305 },
  'DB-P': { cod: 'DUOBK_P', producto: 'ROLLER DUO BLACKOUT PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 32292.30769230769 },
  'DUOP-P': { cod: 'DUOPOLI_P', producto: 'ROLLER DUO POLIESTER PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 28603.93846153846 },
};
const AR: Record<string, number> = { 'DU 25': 2.65, 'DB-P': 2.65, 'DUOP-P': 2.88 };

const cerca = (valor: number, esperado: number, tolPct: number) =>
  Math.abs(valor - esperado) / esperado <= tolPct;

describe('motorFase0 — agrupado de paños', () => {
  it('suma alturas de paño (DUO Blackout Delux, Guillermo)', () => {
    // alto real = (alto+0,25)*2: 5,0 / 4,1 / 4,1 ; anchoRollo 2,65 → 3 paños
    const piezas = [
      { ancho: 2.44, altoReal: 5.0 },
      { ancho: 1.76, altoReal: 4.1 },
      { ancho: 1.76, altoReal: 4.1 },
    ];
    expect(metrosTelaPorPanos(piezas, 2.65)).toBeCloseTo(13.2, 4);
  });
});

describe('motorFase0 — validación contra cotizaciones reales', () => {
  it('Guillermo (Dúo Blackout Delux) — exacto al peso', () => {
    const filas: FilaFase0[] = [
      { codInt: 'DU 25', ancho: 2.44, alto: 2.25, cantidad: 1 },
      { codInt: 'DU 25', ancho: 1.76, alto: 1.8, cantidad: 1 },
      { codInt: 'DU 25', ancho: 1.76, alto: 1.8, cantidad: 1 },
    ];
    const r = cotizarFase0(filas, CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 465137.31, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 282266.46, 0.001)).toBe(true);
    expect(r.familias[0].exacto).toBe(true);
  });

  it('Jorge (Dúo Blackout Premium) — exacto al peso', () => {
    const filas: FilaFase0[] = [
      { codInt: 'DB-P', ancho: 1.7, alto: 2.3, cantidad: 1 },
      { codInt: 'DB-P', ancho: 1.45, alto: 1.5, cantidad: 1 },
      { codInt: 'DB-P', ancho: 0.78, alto: 2.3, cantidad: 1 },
      { codInt: 'DB-P', ancho: 0.78, alto: 2.3, cantidad: 1 },
    ];
    const r = cotizarFase0(filas, CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 349003.15, 0.001)).toBe(true);
    expect(cerca(r.lineas[2].valorUnit, 169601.45, 0.001)).toBe(true);
  });

  it('Francisco (Dúo Poliéster) — dentro de ~2% (precio de tela poliéster por confirmar)', () => {
    const filas: FilaFase0[] = [
      { codInt: 'DUOP-P', ancho: 2.025, alto: 1.9, cantidad: 1 },
      { codInt: 'DUOP-P', ancho: 2.025, alto: 1.9, cantidad: 1 },
    ];
    const r = cotizarFase0(filas, CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 275841.48, 0.02)).toBe(true);
  });

  it('multiplica el valor unitario por la cantidad en el total de línea', () => {
    const r = cotizarFase0([{ codInt: 'DU 25', ancho: 1.5, alto: 2.0, cantidad: 2 }], CAT, AR);
    expect(r.lineas[0].total).toBeCloseTo(r.lineas[0].valorUnit * 2, 4);
  });
});
