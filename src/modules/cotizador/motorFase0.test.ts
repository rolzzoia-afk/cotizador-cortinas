import { describe, it, expect } from 'vitest';
import {
  cotizarFase0,
  empacarPanos,
  metrosTelaPorPanos,
  metrosTelaVertical,
  metrosTelaVerticalPorLamas,
} from './motorFase0';
import { PARAMETROS_DEFAULT } from './preciosFase0';
import {
  REGLAS_PRECIOS_DEFAULT,
  TELA_VERTICAL_DEFAULT,
  conValoresMaximos,
  type TelaVertical,
} from './reglasPrecios';
import type { CatalogoProductos } from './types';

// Precios de insumo VIGENTES CUANDO SE COTIZARON los casos reales de abajo
// (hasta julio 2026). El 2026-08-11 subieron los dos tubos y el peso de cordón
// vertical; recalcular esas cotizaciones con los precios nuevos daría otro
// número y el golden dejaría de probar nada. Cada caso se corre con los precios
// de su época; los de hoy se prueban con la cotización COTJS-10491-5.
const REGLAS_HASTA_JULIO_2026 = conValoresMaximos({
  'E 02': 3729.1625,
  'E 02-1': 3729.1625,
  'E 05': 8958.220833,
  'VER 11': 3570,
});

// Catálogo mínimo para los casos reales. Cada COD tiene un producto cuyo precio
// equivale al MAX de la familia (lo que usa el motor para roller/dúo) o al
// COD_INT base (lo que usan las verticales).
const CAT: CatalogoProductos = {
  // Dúo
  'DU 25': { cod: 'DUOBK_D', producto: 'ROLLER DUO BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 40307.692307692305 },
  'DB-P':  { cod: 'DUOBK_P', producto: 'ROLLER DUO BLACKOUT PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 32292.30769230769 },
  'DU 28': { cod: 'DUOBK_P', producto: 'ROLLER DUO BLACKOUT PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 32292.30769230769 },
  'DU 07': { cod: 'DUOPOLI_P', producto: 'ROLLER DUO POLIESTER PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 22346.153846153844 },
  // Roller
  'SC 34': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 31582 },
  'SC 17': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 31582 },
  'BK 18': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 41868 },
  'BK 50': { cod: 'BLACKOUT_S', producto: 'ROLLER BLACKOUT STANDARD', tipo: 'STANDARD', descripcion: '', precio: 29231 },
  // OT Jeferson: SC 93 (precio propio 0 → hereda arquetipo SC-P) y BK 68.
  'SC 93': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 0 },
  'BK 68': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 23782 },
  // COD_INT arquetipo de cada familia (precio de tela por gama, regla del Excel)
  'SC-P':  { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM (base)', tipo: 'PREMIUM', descripcion: '', precio: 31582 },
  'BK-P':  { cod: 'BLACKOUT_P', producto: 'ROLLER BLACKOUT PREMIUM (base)', tipo: 'PREMIUM', descripcion: '', precio: 29231 },
  'BK-D':  { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX (base)', tipo: 'DELUX', descripcion: '', precio: 41868 },
  // Verticales (el precio del catálogo no se usa; el motor lo toma del base)
  'SC 34-V':  { cod: 'SCREEN_V_P', producto: 'CORTINA VERTICAL SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 0 },
  'SC 03-V':  { cod: 'SCREEN_V_P', producto: 'CORTINA VERTICAL SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 0 },
  'SC 17-V':  { cod: 'SCREEN_V_P', producto: 'CORTINA VERTICAL SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 0 },
  'BK 49-V':  { cod: 'BLACKOUT_V_P', producto: 'CORTINA VERTICAL BLACKOUT PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 0 },
  // Adicionales (precio fijo del catálogo × cantidad − descuento)
  'INST':       { cod: 'INSTALACION', producto: 'INSTALACION ROLLER', tipo: 'INSTALACION', descripcion: '', precio: 17500 },
  'CENF C':     { cod: 'ACCESORIO', producto: 'CENEFA CUADRADA', tipo: 'ACCESORIO', descripcion: '', precio: 40000 },
  'CENF O':     { cod: 'ACCESORIO', producto: 'CENEFA OVALADA', tipo: 'ACCESORIO', descripcion: '', precio: 20000 },
  'INSTCENF':   { cod: 'INSTALACION', producto: 'INSTALACION CENEFA', tipo: 'INSTALACION', descripcion: '', precio: 25000 },
  'DOM 38':     { cod: 'ACCESORIO', producto: 'MOTOR MG', tipo: 'ACCESORIO', descripcion: '', precio: 170000 },
  'DOM 04':     { cod: 'ACCESORIO', producto: 'MOTOR MOR-MERI', tipo: 'ACCESORIO', descripcion: '', precio: 170000 },
  'DOM 39':     { cod: 'ACCESORIO', producto: 'CONTROL 15 CANALES', tipo: 'ACCESORIO', descripcion: '', precio: 35000 },
  'DOM 33':     { cod: 'ACCESORIO', producto: 'PUERTO USB MG', tipo: 'ACCESORIO', descripcion: '', precio: 195000 },
  'DOM 34':     { cod: 'ACCESORIO', producto: 'ROUTER', tipo: 'ACCESORIO', descripcion: '', precio: 28500 },
  'INSTMOTMG':  { cod: 'INSTALACION', producto: 'INSTALACION MOTOR', tipo: 'INSTALACION', descripcion: '', precio: 18000 },
  // COTJS-10491-5 (OT 3169), la cotización que fija los precios de HOY
  'BK 60':   { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 41868 },
  'DU 12':   { cod: 'DUOBK_P', producto: 'ROLLER DUO BLACKOUT PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 32292.30769230769 },
  'SC 65':   { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 31582 },
  'BK 60-V': { cod: 'BLACKOUT_V_D', producto: 'CORTINA VERTICAL BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 0 },
  'SOFTLDER': { cod: 'ACCESORIO', producto: 'SISTEMA SOFT LIGHT', tipo: 'ACCESORIO', descripcion: '', precio: 99000 },
};
const AR: Record<string, number> = {
  'DU 25': 2.65, 'DB-P': 2.65, 'DU 28': 2.95, 'DU 07': 2.95,
  'SC 34': 2.98, 'SC 17': 2.98, 'BK 18': 2.98, 'BK 50': 2.98,
  'SC 34-V': 2.98, 'SC 03-V': 2.48, 'SC 17-V': 2.98, 'BK 49-V': 2.98,
  'SC 93': 2.98, 'BK 68': 2.98,
  // COTJS-10491-5 (OT 3169)
  'BK 60': 2.98, 'DU 12': 2.95, 'SC 65': 2.98, 'BK 60-V': 2.98,
};

const cerca = (valor: number, esperado: number, tolPct: number) =>
  Math.abs(valor - esperado) / esperado <= tolPct;

/** Cotiza un caso real con los precios de insumo que regían cuando se vendió. */
const cotizarDeEsaEpoca = (
  filas: Parameters<typeof cotizarFase0>[0],
  adicionales: Parameters<typeof cotizarFase0>[3] = [],
  params = PARAMETROS_DEFAULT,
  region = false,
) => cotizarFase0(filas, CAT, AR, adicionales, params, region, false, REGLAS_HASTA_JULIO_2026);

describe('motorFase0 — armado de paños', () => {
  it('paños roller: ordena por ancho y agrupa tomando alto máximo', () => {
    const piezas = [
      { ancho: 1.124, altoReal: 1.55 },
      { ancho: 1.168, altoReal: 1.557 },
      { ancho: 0.992, altoReal: 1.56 },
    ];
    expect(metrosTelaPorPanos(piezas, 2.98)).toBeCloseTo(3.117, 3);
  });

  it('paños vertical: nº de paños = redondear (ancho ÷ ancho de rollo)', () => {
    expect(metrosTelaVertical([{ ancho: 1.869, altoReal: 2.55 }], 2.98)).toBeCloseTo(2.55, 3);
  });
});

describe('motorFase0 — tela vertical cobrada por lamas', () => {
  const LAMAS: TelaVertical = { ...TELA_VERTICAL_DEFAULT, modo: 'lamas' };
  // Rollo 2,95 ÷ lama 0,089 = 33,1 → 33 lamas por pasada.
  const POR_PASADA = 33;

  it('cobra la fracción de pasada que la cortina usa', () => {
    // 2,00 m ÷ 0,08 = 25 lamas → 25/33 de pasada × 2,25 m = 1,7045 m.
    const m = metrosTelaVerticalPorLamas([{ ancho: 2, altoReal: 2.25 }], LAMAS);
    expect(m).toBeCloseTo((25 / POR_PASADA) * 2.25, 4);
    // Por paños esa misma cortina paga la pasada entera.
    expect(metrosTelaVertical([{ ancho: 2, altoReal: 2.25 }], 2.95)).toBeCloseTo(2.25, 4);
  });

  it('no tiene el escalón del paño: cruzar el ancho del rollo no duplica el costo', () => {
    // 2,90 y 3,00 caen a uno y otro lado del rollo de 2,95.
    const antes = metrosTelaVerticalPorLamas([{ ancho: 2.9, altoReal: 2.25 }], LAMAS);
    const despues = metrosTelaVerticalPorLamas([{ ancho: 3.0, altoReal: 2.25 }], LAMAS);
    expect(despues / antes).toBeCloseTo(3.0 / 2.9, 4); // crece igual que el ancho
    // Por paños, esos mismos 10 cm duplican la tela.
    const pAntes = metrosTelaVertical([{ ancho: 2.9, altoReal: 2.25 }], 2.95);
    const pDespues = metrosTelaVertical([{ ancho: 3.0, altoReal: 2.25 }], 2.95);
    expect(pDespues / pAntes).toBe(2);
  });

  it('suma cortinas de altos distintos', () => {
    const piezas = [
      { ancho: 1.6, altoReal: 2.0 },
      { ancho: 2.4, altoReal: 2.5 },
    ];
    const esperado = (20 / POR_PASADA) * 2.0 + (30 / POR_PASADA) * 2.5;
    expect(metrosTelaVerticalPorLamas(piezas, LAMAS)).toBeCloseTo(esperado, 4);
  });

  it('un rollo más angosto que la lama rinde una lama, no divide por cero', () => {
    const raro: TelaVertical = { ...LAMAS, anchoRolloVerticalM: 0.05 };
    const m = metrosTelaVerticalPorLamas([{ ancho: 2, altoReal: 2.25 }], raro);
    expect(Number.isFinite(m)).toBe(true);
    expect(m).toBeCloseTo(25 * 2.25, 4); // 25 lamas, 1 por pasada
  });

  it('cotizarFase0 usa el modo de las reglas y no el ancho de rollo del catálogo', () => {
    const cat: CatalogoProductos = {
      'BK-V-P': { cod: 'BLACKOUT_V_P', producto: 'CORTINA VERTICAL BLACKOUT PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 29231 },
    };
    const filas = [{ codInt: 'BK-V-P', ancho: 2.5, alto: 2, cantidad: 1 }];
    // El mapa de anchos trae el del ROLLER (2,45): en modo lamas se ignora.
    const anchos = { 'BK-V-P': 2.45 };
    const base = { ...REGLAS_PRECIOS_DEFAULT, baseVertical: { BLACKOUT_V_P: 'BK-V-P' } };

    const panos = cotizarFase0(filas, cat, anchos, [], PARAMETROS_DEFAULT, false, false, base);
    const lamas = cotizarFase0(filas, cat, anchos, [], PARAMETROS_DEFAULT, false, false, {
      ...base,
      telaVertical: LAMAS,
    });

    // Por paños: 2,5 > 2,45 → 2 paños de 2,25 m.
    expect(panos.familias[0].metrosTela).toBeCloseTo(4.5, 3);
    expect(panos.familias[0].lamas).toBeUndefined();
    // Por lamas: 31,25 lamas ÷ 33 × 2,25 m.
    expect(lamas.familias[0].metrosTela).toBeCloseTo((31.25 / POR_PASADA) * 2.25, 4);
    expect(lamas.familias[0].lamas).toEqual({ total: 31.25, porPasada: POR_PASADA });
    expect(lamas.familias[0].costoTela).toBeLessThan(panos.familias[0].costoTela);
  });
});

describe('motorFase0 — validación al peso contra cotizaciones reales', () => {
  // ───── Dúo ─────
  it('Guillermo — Dúo Blackout Delux (3 cortinas) — exacto', () => {
    const r = cotizarDeEsaEpoca([
      { codInt: 'DU 25', ancho: 2.44, alto: 2.25, cantidad: 1 },
      { codInt: 'DU 25', ancho: 1.76, alto: 1.8, cantidad: 1 },
      { codInt: 'DU 25', ancho: 1.76, alto: 1.8, cantidad: 1 },
    ]);
    expect(cerca(r.lineas[0].valorUnit, 465137.31, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 282266.46, 0.001)).toBe(true);
  });

  it('Jorge — Dúo Blackout Premium (4 cortinas) — exacto', () => {
    const r = cotizarDeEsaEpoca([
      { codInt: 'DB-P', ancho: 1.7, alto: 2.3, cantidad: 1 },
      { codInt: 'DB-P', ancho: 1.45, alto: 1.5, cantidad: 1 },
      { codInt: 'DB-P', ancho: 0.78, alto: 2.3, cantidad: 1 },
      { codInt: 'DB-P', ancho: 0.78, alto: 2.3, cantidad: 1 },
    ]);
    expect(cerca(r.lineas[0].valorUnit, 349003.15, 0.001)).toBe(true);
    expect(cerca(r.lineas[2].valorUnit, 169601.45, 0.001)).toBe(true);
  });

  it('Jeanine — Dúo Poliéster Premium — exacto', () => {
    const r = cotizarDeEsaEpoca([
      { codInt: 'DU 07', ancho: 1.757, alto: 1.3, cantidad: 1 },
    ]);
    expect(cerca(r.lineas[0].valorUnit, 245061.99, 0.001)).toBe(true);
  });

  it('Camila (OT 3048) — Dúo Blackout Premium DU 28 (4 cortinas) — exacto', () => {
    // Golden de la cotización de esa OT: rollo 2,95, tela DB-P 32.292, MTS 15,3.
    const r = cotizarDeEsaEpoca([
      { codInt: 'DU 28', ancho: 1.66, alto: 2.3, cantidad: 1 },
      { codInt: 'DU 28', ancho: 1.61, alto: 2.3, cantidad: 1 },
      { codInt: 'DU 28', ancho: 0.595, alto: 1.015, cantidad: 1 },
      { codInt: 'DU 28', ancho: 2.18, alto: 2.3, cantidad: 1 },
    ]);
    expect(cerca(r.lineas[0].valorUnit, 284926.19, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 276871.19, 0.001)).toBe(true);
    expect(cerca(r.lineas[2].valorUnit, 65051.38, 0.001)).toBe(true);
    expect(cerca(r.lineas[3].valorUnit, 368698.25, 0.001)).toBe(true);
  });

  it('extraAltoCm custom afecta metros de tela y precio (como la celda del Excel)', () => {
    const filas = [{ codInt: 'SC 34', ancho: 1.5, alto: 2.0, cantidad: 1 }];
    const base = cotizarFase0(filas, CAT, AR);
    const conExtra = cotizarFase0(filas, CAT, AR, [], { ...PARAMETROS_DEFAULT, extraAltoCm: 35 });
    // alto real 2,25 → 2,35: más tela y más precio.
    expect(conExtra.lineas[0].valorUnit).toBeGreaterThan(base.lineas[0].valorUnit);
    // Con el default explícito reproduce el histórico exacto.
    const explicito = cotizarFase0(filas, CAT, AR, [], { ...PARAMETROS_DEFAULT });
    expect(explicito.lineas[0].valorUnit).toBeCloseTo(base.lineas[0].valorUnit, 6);
  });

  // ───── Roller Premium / Delux ─────
  it('Felipe — Screen Premium (3 cortinas) — exacto', () => {
    const r = cotizarDeEsaEpoca([
      { codInt: 'SC 34', ancho: 1.124, alto: 1.3, cantidad: 1 },
      { codInt: 'SC 34', ancho: 1.168, alto: 1.307, cantidad: 1 },
      { codInt: 'SC 34', ancho: 0.992, alto: 1.31, cantidad: 1 },
    ]);
    expect(cerca(r.lineas[0].valorUnit, 123832.7, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 128494.2, 0.001)).toBe(true);
    expect(cerca(r.lineas[2].valorUnit, 111950.68, 0.001)).toBe(true);
  });

  it('Alejandro — Screen Premium (9 cortinas, mezcla anchos/altos) — exacto', () => {
    const r = cotizarDeEsaEpoca([
      { codInt: 'SC 17', ancho: 1.352, alto: 2.36, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.254, alto: 2.36, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.349, alto: 2.36, cantidad: 1 },
      { codInt: 'SC 17', ancho: 0.745, alto: 1.4, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.874, alto: 1.4, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.886, alto: 1.4, cantidad: 1 },
      { codInt: 'SC 17', ancho: 0.745, alto: 1.4, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.973, alto: 2.3, cantidad: 1 },
      { codInt: 'SC 17', ancho: 0.898, alto: 2.3, cantidad: 1 },
    ]);
    expect(cerca(r.lineas[0].valorUnit, 150329.51, 0.001)).toBe(true);
    expect(cerca(r.lineas[7].valorUnit, 206884.59, 0.001)).toBe(true);
  });

  it('Felipe — Blackout Delux (2 cortinas) — exacto', () => {
    const r = cotizarDeEsaEpoca([
      { codInt: 'BK 18', ancho: 1.23, alto: 1.4, cantidad: 1 },
      { codInt: 'BK 18', ancho: 1.1, alto: 1.41, cantidad: 1 },
    ]);
    expect(cerca(r.lineas[0].valorUnit, 139601.96, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 127358.68, 0.001)).toBe(true);
  });

  // ───── Roller Standard ─────
  it('Alejandro — Blackout Standard (2 cortinas) — dentro de ~0,5% (residual menor)', () => {
    const r = cotizarDeEsaEpoca([
      { codInt: 'BK 50', ancho: 1.5, alto: 1.0, cantidad: 1 },
      { codInt: 'BK 50', ancho: 2.0, alto: 1.9, cantidad: 1 },
    ]);
    expect(cerca(r.lineas[0].valorUnit, 101556.21, 0.01)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 210268.91, 0.01)).toBe(true);
  });

  // ───── Verticales ─────
  it('Felipe — Vertical Screen Premium — exacto', () => {
    const r = cotizarDeEsaEpoca([{ codInt: 'SC 34-V', ancho: 1.869, alto: 2.3, cantidad: 1 }]);
    expect(cerca(r.lineas[0].valorUnit, 383068.76, 0.001)).toBe(true);
  });

  it('Jeanine — Vertical Screen Premium (2 cortinas) — exacto', () => {
    const r = cotizarDeEsaEpoca([
      { codInt: 'SC 03-V', ancho: 0.878, alto: 2.38, cantidad: 1 },
      { codInt: 'SC 17-V', ancho: 2.255, alto: 2.38, cantidad: 1 },
    ]);
    expect(cerca(r.lineas[0].valorUnit, 207347.57, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 469804.99, 0.001)).toBe(true);
  });

  it('Giovanni — Vertical Blackout Premium — exacto', () => {
    const r = cotizarDeEsaEpoca([{ codInt: 'BK 49-V', ancho: 2.791, alto: 2.337, cantidad: 1 }]);
    expect(cerca(r.lineas[0].valorUnit, 436026.86, 0.001)).toBe(true);
  });

  // ───── Cotización completa con descuentos por línea y adicionales ─────
  it('Alejandro — cotización completa (16 cortinas con 20% dcto + 12 adicionales) — total exacto', () => {
    const cortinas = [
      // 9 Screen Premium (SC 17)
      { codInt: 'SC 17', ancho: 1.352, alto: 2.36, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 17', ancho: 1.254, alto: 2.36, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 17', ancho: 1.349, alto: 2.36, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 17', ancho: 0.745, alto: 1.4, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 17', ancho: 1.874, alto: 1.4, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 17', ancho: 1.886, alto: 1.4, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 17', ancho: 0.745, alto: 1.4, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 17', ancho: 1.973, alto: 2.3, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 17', ancho: 0.898, alto: 2.3, cantidad: 1, descuento: 0.2 },
      // 5 Blackout Delux (BK 61)
      { codInt: 'BK 18', ancho: 1.352, alto: 2.364, cantidad: 1, descuento: 0.2 },
      { codInt: 'BK 18', ancho: 2.7, alto: 2.364, cantidad: 1, descuento: 0.2 },
      { codInt: 'BK 18', ancho: 2.642, alto: 1.45, cantidad: 1, descuento: 0.2 },
      { codInt: 'BK 18', ancho: 2.638, alto: 1.45, cantidad: 1, descuento: 0.2 },
      { codInt: 'BK 18', ancho: 3, alto: 2.4, cantidad: 1, descuento: 0.2 },
      // 2 Blackout Standard (BK 50)
      { codInt: 'BK 50', ancho: 1.5, alto: 1.0, cantidad: 1, descuento: 0.2 },
      { codInt: 'BK 50', ancho: 2.0, alto: 1.9, cantidad: 1, descuento: 0.2 },
    ];
    const adicionales = [
      { codInt: 'INST', cantidad: 16, descuento: 1 }, // gratis
      { codInt: 'CENF C', cantidad: 4.07, descuento: 0.1 },
      { codInt: 'INSTCENF', cantidad: 1, descuento: 0.1 },
      { codInt: 'CENF C', cantidad: 3.02, descuento: 0.1 },
      { codInt: 'INSTCENF', cantidad: 1, descuento: 0.1 },
      { codInt: 'DOM 38', cantidad: 2, descuento: 0.3 },
      { codInt: 'DOM 04', cantidad: 1, descuento: 0.3 },
      { codInt: 'DOM 39', cantidad: 1, descuento: 0.1 },
      { codInt: 'DOM 33', cantidad: 1, descuento: 0.1 },
      { codInt: 'DOM 34', cantidad: 1, descuento: 0 },
      { codInt: 'INSTMOTMG', cantidad: 3, descuento: 0.1 },
      { codInt: 'CENF O', cantidad: 1.5, descuento: 0.1 },
    ];
    const r = cotizarDeEsaEpoca(cortinas, adicionales);
    // Adicionales exactos al peso (12 items)
    expect(r.adicionales.length).toBe(12);
    const sumaAdic = r.adicionales.reduce((s, a) => s + a.total, 0);
    expect(cerca(sumaAdic, 968340, 0.0001)).toBe(true);
    // Subtotal completo (cortinas + adicionales) — la única holgura viene del
    // residual de Blackout Standard (~0,4%), que diluye a ~0,01% en el total.
    expect(cerca(r.subtotalNeto, 2983696.24, 0.001)).toBe(true);
    expect(cerca(r.totales.totalTransferencia, 3550598.53, 0.001)).toBe(true);
  });

  // ───── OT Jeferson (JEFERSON- LA FLORIDA.xlsm): 6 SC 93 + 1 BK 68 ─────
  // Valida el fix #1: SC usa el arquetipo SC-P (31.582), no el MAX de familia;
  // SC 93 (precio propio 0) cotiza igual heredando el arquetipo; DCT% por código
  // (SC 20% / BK 25%) y cenefa ovalada con 30%. VAL. UNIT/TOTAL de la hoja
  // "Formato de Cotización"; subtotal = SUBTOTAL PAGO TRANSF. del Excel.
  it('Jeferson — Screen Premium (SC 93) + Blackout Delux (BK 68) con descuentos — cuadra al peso', () => {
    const cortinas = [
      { codInt: 'SC 93', ancho: 1.618, alto: 2.301, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 93', ancho: 1.075, alto: 2.301, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 93', ancho: 1.57, alto: 2.305, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 93', ancho: 1.6, alto: 2.305, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 93', ancho: 1.067, alto: 2.305, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 93', ancho: 1.631, alto: 2.305, cantidad: 1, descuento: 0.2 },
      { codInt: 'BK 68', ancho: 2.7, alto: 2.305, cantidad: 1, descuento: 0.25 },
    ];
    const adic = [{ codInt: 'CENF O', cantidad: 2.7, descuento: 0.3 }];
    const r = cotizarDeEsaEpoca(cortinas, adic);
    // VAL. UNIT (incluye instalación 17.500) — primera SC y la BK
    expect(cerca(r.lineas[0].valorUnit, 168903.61, 0.001)).toBe(true);
    expect(cerca(r.lineas[6].valorUnit, 275677.77, 0.001)).toBe(true);
    // TOTAL por línea (con descuento por código)
    expect(cerca(r.lineas[0].total, 135122.89, 0.001)).toBe(true);
    expect(cerca(r.lineas[6].total, 206758.33, 0.001)).toBe(true);
    // Cenefa ovalada 2,7 × 20.000 − 30% = 37.800
    expect(cerca(r.adicionales[0].total, 37800, 0.001)).toBe(true);
    // Instalación: 6 SC + 1 BK = 7 cortinas (≥4) en RM → GRATIS ($0), no suma al total.
    expect(r.instalacion.cantidad).toBe(7);
    expect(r.instalacion.total).toBe(0);
    expect(r.instalacion.gratis).toBe(true);
    // Subtotal neto = SUBTOTAL PAGO TRANSF. del Excel
    expect(cerca(r.subtotalNeto, 970120.46, 0.001)).toBe(true);
  });

  // ───── Precios VIGENTES (2026-08) ─────
  // COTJS-10491-5 = OT 3169. Es el golden de los precios de HOY: fija el alza
  // de los tubos (E 02 / E 05) y del peso de cordón vertical (VER 11), y el
  // perfil de cenefa del dúo premium (+0,20 fijo). Mezcla las 4 familias que
  // usan esos insumos, así que un retroceso en cualquiera se ve acá.
  it('CARLA (COTJS-10491-5 / OT 3169) — 4 familias con los precios de hoy — exacto', () => {
    const r = cotizarFase0([
      { codInt: 'BK 60-V', ancho: 2.64, alto: 2.405, cantidad: 1, descuento: 0.35 },
      { codInt: 'DU 12', ancho: 1.66, alto: 1.93, cantidad: 1, descuento: 0.2 },
      { codInt: 'BK 60', ancho: 2.81, alto: 2.398, cantidad: 1, descuento: 0.25 },
      { codInt: 'SC 65', ancho: 1.357, alto: 2.398, cantidad: 1, descuento: 0.2 },
      { codInt: 'SC 65', ancho: 1.455, alto: 2.398, cantidad: 1, descuento: 0.2 },
    ], CAT, AR);
    // VAL. UNIT de cada línea, tal como los imprime la hoja.
    expect(cerca(r.lineas[0].valorUnit, 475064.65, 0.001)).toBe(true); // vertical BK 60-V
    expect(cerca(r.lineas[1].valorUnit, 316338.43, 0.001)).toBe(true); // dúo (E 26 +0,20)
    expect(cerca(r.lineas[2].valorUnit, 288766.52, 0.001)).toBe(true); // blackout (tubo E 05)
    expect(cerca(r.lineas[3].valorUnit, 140932.16, 0.001)).toBe(true);
    expect(cerca(r.lineas[4].valorUnit, 149846.2, 0.001)).toBe(true);
    // TOTAL con el descuento que tecleó la vendedora en ESA cotización.
    expect(cerca(r.lineas[2].total, 216574.89, 0.001)).toBe(true);
    // VALOR M² combinado por familia (los paneles de colores del Excel).
    const vm2 = (cod: string) => r.familias.find((f) => f.cod === cod)?.precioM2 ?? 0;
    expect(cerca(vm2('BLACKOUT_D'), 36456.24, 0.001)).toBe(true);
    expect(cerca(vm2('DUOBK_P'), 41289.66, 0.001)).toBe(true);
    expect(cerca(vm2('SCREEN_P'), 34350.36, 0.001)).toBe(true);
    expect(cerca(vm2('BLACKOUT_V_D'), 62070.52, 0.001)).toBe(true);
    // 4 cortinas roller/dúo (la vertical no cuenta) → instalación gratis.
    expect(r.instalacion.cantidad).toBe(4);
    expect(r.instalacion.gratis).toBe(true);

    // ── Desglose: lo que muestra el probador de Admin → Precios ──
    const bk = r.familias.find((f) => f.cod === 'BLACKOUT_D')!;
    // La tela se cobra al precio del arquetipo de la familia, no al de BK 60.
    expect(bk.arquetipoCodInt).toBe('BK-D');
    // La tabla de materiales suma exactamente el costo de materiales.
    for (const f of r.familias) {
      expect(f.materiales.reduce((s, l) => s + l.total, 0)).toBeCloseTo(f.costoMateriales, 6);
    }
    // Los paños explican los metros de tela (las verticales no arman paños).
    expect(bk.panos.reduce((s, p) => s + p.alto, 0)).toBeCloseTo(bk.metrosTela, 9);
    expect(r.familias.find((f) => f.cod === 'BLACKOUT_V_D')!.panos).toEqual([]);
    // Las dos SC 65 comparten paño: 1,357 + 1,455 = 2,812 entra en el rollo de 2,98.
    const sc = r.familias.find((f) => f.cod === 'SCREEN_P')!;
    expect(sc.panos).toHaveLength(1);
    expect(sc.panos[0].cortinas).toHaveLength(2);
    // Y cada línea cierra la identidad del Excel: m² × valor m² + instalación.
    for (const l of r.lineas) {
      expect(l.m2 * l.precioM2 + l.instalacionEmbebida).toBeCloseTo(l.valorUnit, 6);
    }
  });
});

describe('motorFase0 — instalación gratis 4+ / región (Fase 2)', () => {
  const cortina = (n: number) =>
    Array.from({ length: n }, () => ({ codInt: 'SC 34', ancho: 1.3, alto: 2.3, cantidad: 1 }));

  it('4+ cortinas roller en RM → instalación GRATIS ($0) y no altera el subtotal', () => {
    const r = cotizarFase0(cortina(4), CAT, AR);
    expect(r.instalacion.cantidad).toBe(4);
    expect(r.instalacion.descuento).toBe(1);
    expect(r.instalacion.total).toBe(0);
    expect(r.instalacion.gratis).toBe(true);
    // subtotal = sólo las líneas (instalación 0)
    const sumaLineas = r.lineas.reduce((s, l) => s + l.total, 0);
    expect(r.subtotalNeto).toBeCloseTo(sumaLineas, 6);
  });

  // Término #1 de la cotización: "Instalación GRATIS mínimo de 4 cortinas
  // roller — 3 o menos, valor instalación $17.500 c/u + IVA". Hasta el
  // 2026-08-11 la app aplicaba el 100% de descuento SIEMPRE y la regalaba.
  it('menos del mínimo en RM → se cobra la instalación por cortina', () => {
    const r = cotizarFase0(cortina(3), CAT, AR);
    expect(r.instalacion.cantidad).toBe(3);
    expect(r.instalacion.descuento).toBe(0);
    expect(r.instalacion.total).toBe(3 * 17500);
    expect(r.instalacion.gratis).toBe(false);
    // Y sí suma al subtotal, a diferencia del caso 4+.
    const sumaLineas = r.lineas.reduce((s, l) => s + l.total, 0);
    expect(r.subtotalNeto).toBeCloseTo(sumaLineas + 3 * 17500, 6);
  });

  it('el mínimo se cuenta por cortina, no por familia (2 screen + 2 blackout = 4)', () => {
    const r = cotizarFase0([
      { codInt: 'SC 34', ancho: 1.3, alto: 2.3, cantidad: 1 },
      { codInt: 'SC 34', ancho: 1.3, alto: 2.3, cantidad: 1 },
      { codInt: 'BK 18', ancho: 1.3, alto: 2.3, cantidad: 1 },
      { codInt: 'BK 18', ancho: 1.3, alto: 2.3, cantidad: 1 },
    ], CAT, AR);
    expect(r.instalacion.cantidad).toBe(4);
    expect(r.instalacion.total).toBe(0);
    expect(r.instalacion.gratis).toBe(true);
  });

  it('una cortina con cantidad 4 también llega al mínimo', () => {
    const r = cotizarFase0([{ codInt: 'SC 34', ancho: 1.3, alto: 2.3, cantidad: 4 }], CAT, AR);
    expect(r.instalacion.cantidad).toBe(4);
    expect(r.instalacion.total).toBe(0);
  });

  it('región con % editable → aplica el descuento de región, no el de RM', () => {
    const params = { ...PARAMETROS_DEFAULT, instalacionDescuentoRegion: 0.5 };
    const r = cotizarFase0(cortina(4), CAT, AR, [], params, true);
    expect(r.instalacion.region).toBe(true);
    expect(r.instalacion.descuento).toBe(0.5);
    expect(r.instalacion.total).toBe(4 * 17500 * 0.5);
    expect(r.instalacion.gratis).toBe(false);
  });

  it('región por defecto (0%) → instalación completa aunque sean 4+', () => {
    const r = cotizarFase0(cortina(5), CAT, AR, [], PARAMETROS_DEFAULT, true);
    expect(r.instalacion.total).toBe(5 * 17500);
  });

  it('verticales no cuentan para la instalación roller (cantidad 0, total 0)', () => {
    const r = cotizarFase0(
      [{ codInt: 'SC 34-V', ancho: 1.869, alto: 2.3, cantidad: 1 }],
      CAT,
      AR,
    );
    expect(r.instalacion.cantidad).toBe(0);
    expect(r.instalacion.total).toBe(0);
  });

  it('el mínimo de cortinas es configurable (min 2 → 2 cortinas ya es gratis)', () => {
    const params = { ...PARAMETROS_DEFAULT, instalacionGratisMinCortinas: 2 };
    const r = cotizarFase0(cortina(2), CAT, AR, [], params);
    expect(r.instalacion.gratis).toBe(true);
    expect(r.instalacion.total).toBe(0);
  });

  it('sin instalación (cliente retira) → quita $17.500 del VAL. UNIT de cada cortina', () => {
    const filas = [{ codInt: 'SC 34', ancho: 1.3, alto: 2.3, cantidad: 1 }];
    const conInst = cotizarFase0(filas, CAT, AR);
    // 7º arg region=false, 8º sinInstalacion=true
    const sinInst = cotizarFase0(filas, CAT, AR, [], PARAMETROS_DEFAULT, false, true);
    expect(conInst.lineas[0].valorUnit - sinInst.lineas[0].valorUnit).toBeCloseTo(17500, 6);
    expect(sinInst.instalacion.total).toBe(0);
    expect(sinInst.instalacion.sinInstalacion).toBe(true);
    // Con 1 cortina (bajo el mínimo) el subtotal baja DOS veces la instalación:
    // la embebida en el VAL. UNIT y el recargo de la cotización chica.
    expect(conInst.subtotalNeto - sinInst.subtotalNeto).toBeCloseTo(2 * 17500, 6);
  });
});

describe('motorFase0 — proveedor de tarjeta (Mercado Pago / Flow)', () => {
  const filas = [{ codInt: 'SC 34', ancho: 1.3, alto: 2.3, cantidad: 1 }];

  it('con Flow el total tarjeta usa la comisión Flow; el resto no cambia', () => {
    const mp = cotizarFase0(filas, CAT, AR);
    const flow = cotizarFase0(filas, CAT, AR, [], {
      ...PARAMETROS_DEFAULT,
      proveedorTarjeta: 'flow',
    });
    // Transferencia idéntica: el proveedor solo afecta el pago con tarjeta.
    expect(flow.subtotalNeto).toBeCloseTo(mp.subtotalNeto, 6);
    expect(flow.totales.totalTransferencia).toBeCloseTo(mp.totales.totalTransferencia, 6);
    // Tarjeta: 4,15% de recargo en vez de 13,8%.
    expect(flow.totales.subtotalTarjeta).toBeCloseTo(
      flow.subtotalNeto * (1 + PARAMETROS_DEFAULT.recargoTarjetaFlow),
      6,
    );
    expect(mp.totales.subtotalTarjeta).toBeCloseTo(
      mp.subtotalNeto * (1 + PARAMETROS_DEFAULT.recargoTarjeta),
      6,
    );
    expect(flow.totales.totalTarjeta).toBeLessThan(mp.totales.totalTarjeta);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Peor caso de montaje (oscuridad / beeblack): mientras no se sepa si la
// cortina va interna, semi o externa, el precio empaca con el ancho de tela
// del montaje que MÁS gasta. El Excel manual cotizaba todo como interno y
// regalaba la diferencia cuando salía semi/externa.
// ─────────────────────────────────────────────────────────────────────
describe('motorFase0 — ancho de empaque (peor caso de montaje)', () => {
  it('sin anchoEmpaque: dos cortinas de 1,40 y 1,50 comparten paño en rollo 2,98', () => {
    const piezas = [
      { ancho: 1.4, altoReal: 2.5 },
      { ancho: 1.5, altoReal: 2.5 },
    ];
    expect(empacarPanos(piezas, 2.98)).toHaveLength(1);
    expect(metrosTelaPorPanos(piezas, 2.98)).toBeCloseTo(2.5, 3);
  });

  it('con anchoEmpaque (soft light externo): las mismas dos ya NO caben juntas', () => {
    // 1,40 → 1,488 y 1,50 → 1,588 (ancho + 8,8 cm de la cuadrada externa).
    const piezas = [
      { ancho: 1.4, altoReal: 2.5, anchoEmpaque: 1.488 },
      { ancho: 1.5, altoReal: 2.5, anchoEmpaque: 1.588 },
    ];
    const panos = empacarPanos(piezas, 2.98);
    expect(panos).toHaveLength(2);
    // Dos paños = el doble de tela: es justo lo que antes se regalaba.
    expect(metrosTelaPorPanos(piezas, 2.98)).toBeCloseTo(5, 3);
  });

  it('el paño acumula el ancho de EMPAQUE, no el nominal', () => {
    const piezas = [
      { ancho: 1.0, altoReal: 2, anchoEmpaque: 1.088 },
      { ancho: 1.2, altoReal: 2.4, anchoEmpaque: 1.288 },
    ];
    const [pano] = empacarPanos(piezas, 2.98);
    expect(pano.ancho).toBeCloseTo(2.376, 3); // 1,088 + 1,288
    expect(pano.alto).toBeCloseTo(2.4, 3);
  });

  it('cotizarFase0: el peor caso cobra MÁS tela pero deja los m² intactos', () => {
    const filas = [
      { codInt: 'BK 18', ancho: 1.4, alto: 2.25, cantidad: 1 },
      { codInt: 'BK 18', ancho: 1.5, alto: 2.25, cantidad: 1 },
    ];
    const nominal = cotizarFase0(filas, CAT, AR);
    const peorCaso = cotizarFase0(
      filas.map((f, i) => ({ ...f, anchoEmpaqueM: [1.488, 1.588][i] })),
      CAT,
      AR,
    );
    const fam = (r: typeof nominal) => r.familias.find((x) => x.cod === 'BLACKOUT_D')!;
    // Un paño → dos: la tela se duplica.
    expect(fam(nominal).panos).toHaveLength(1);
    expect(fam(peorCaso).panos).toHaveLength(2);
    expect(fam(peorCaso).metrosTela).toBeGreaterThan(fam(nominal).metrosTela);
    // Los m² son los de la ventana del cliente: NO se inflan.
    expect(fam(peorCaso).m2Total).toBeCloseTo(fam(nominal).m2Total, 6);
    expect(peorCaso.subtotalNeto).toBeGreaterThan(nominal.subtotalNeto);
  });

  it('sin anchoEmpaqueM el resultado es idéntico al de siempre (regresión)', () => {
    const filas = [
      { codInt: 'SC 34', ancho: 1.124, alto: 1.3, cantidad: 1 },
      { codInt: 'SC 34', ancho: 1.168, alto: 1.307, cantidad: 2 },
      { codInt: 'BK 18', ancho: 0.992, alto: 1.31, cantidad: 1 },
    ];
    const a = cotizarFase0(filas, CAT, AR);
    const b = cotizarFase0(
      filas.map((f) => ({ ...f, anchoEmpaqueM: undefined })),
      CAT,
      AR,
    );
    expect(b.subtotalNeto).toBeCloseTo(a.subtotalNeto, 6);
    expect(b.totales.totalTransferencia).toBeCloseTo(a.totales.totalTransferencia, 6);
  });

  it('un anchoEmpaque de 0 o negativo se ignora (cae al nominal)', () => {
    const piezas = [
      { ancho: 1.4, altoReal: 2.5, anchoEmpaque: 0 },
      { ancho: 1.5, altoReal: 2.5, anchoEmpaque: -3 },
    ];
    expect(empacarPanos(piezas, 2.98)).toHaveLength(1);
  });
});
