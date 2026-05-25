import { describe, it, expect } from 'vitest';
import { calcularRollerBKSCR, metrosTelaPorPanos, type ItemFase0 } from './motorFase0';

// Caso de referencia: 3 ROLLER BLACKOUT PREMIUM (BK-P), manual.
// precio/ml tela = 29.231 ; ancho de rollo = 2,45 m.
// Los números esperados se derivan de las fórmulas decodificadas del Excel
// (Optimizador + Cotizador). Sirven para detectar regresiones en el motor.
// La validación final "al peso" se hace comparando este desglose contra una
// cotización real del Excel.
const CASO: ItemFase0[] = [
  { codInt: 'BK-P', ancho: 1.5, alto: 2.0, cantidad: 1, precioMl: 29231, anchoRollo: 2.45 },
  { codInt: 'BK-P', ancho: 2.4, alto: 2.3, cantidad: 1, precioMl: 29231, anchoRollo: 2.45 },
  { codInt: 'BK-P', ancho: 1.2, alto: 1.8, cantidad: 1, precioMl: 29231, anchoRollo: 2.45 },
];

describe('motorFase0 — familia Roller Blackout/Screen', () => {
  it('agrupa paños y calcula metros de tela (MTS)', () => {
    const piezas = [
      { codInt: 'BK-P', ancho: 1.5, altoReal: 2.25, m2: 3.375 },
      { codInt: 'BK-P', ancho: 2.4, altoReal: 2.55, m2: 6.12 },
      { codInt: 'BK-P', ancho: 1.2, altoReal: 2.05, m2: 2.46 },
    ];
    // 3 alturas distintas → 3 paños → MTS = 2,55 + 2,25 + 2,05 = 6,85
    expect(metrosTelaPorPanos(piezas, 2.45)).toBeCloseTo(6.85, 4);
  });

  it('reproduce el precio/m² combinado y los totales del Excel', () => {
    const r = calcularRollerBKSCR(CASO);
    const fam = r.familias[0];
    expect(fam.metrosTela).toBeCloseTo(6.85, 4);
    expect(fam.m2Total).toBeCloseTo(11.955, 3);
    expect(fam.costoMateriales).toBeCloseTo(143696.62, 1);
    expect(fam.costoTotal).toBeCloseTo(457428.97, 1);
    expect(fam.precioM2).toBeCloseTo(38262.57, 1);

    expect(r.subtotalNeto).toBeCloseTo(509928.97, 1);
    expect(r.totales.totalTransferencia).toBeCloseTo(606815.48, 1);
    expect(r.totales.totalTarjeta).toBeCloseTo(690556.01, 1);
    expect(r.totales.abono50).toBeCloseTo(303407.74, 1);
  });

  it('multiplica el valor unitario por la cantidad en el total de línea', () => {
    const r = calcularRollerBKSCR([
      { codInt: 'BK-P', ancho: 1.5, alto: 2.0, cantidad: 2, precioMl: 29231, anchoRollo: 2.45 },
    ]);
    const l = r.lineas[0];
    expect(l.total).toBeCloseTo(l.valorUnit * 2, 4);
  });
});
