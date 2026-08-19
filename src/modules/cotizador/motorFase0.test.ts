import { describe, it, expect } from 'vitest';
import {
  cotizarFase0,
  empacarPanos,
  metrosTelaPorPanos,
  metrosTelaVertical,
  metrosTelaVerticalPorLamas,
  textoInstalacion,
} from './motorFase0';
import { PARAMETROS_DEFAULT } from './preciosFase0';
import {
  RECETAS_DEFAULT,
  REGLAS_PRECIOS_DEFAULT,
  TELA_VERTICAL_DEFAULT,
  conValoresMaximos,
  type ReglasPrecios,
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
  // Fracción pura: sin el piso de una pasada, para poder medir la fórmula sola.
  const LAMAS: TelaVertical = { ...TELA_VERTICAL_DEFAULT, modo: 'lamas', minimoUnaPasada: false };
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
    expect(lamas.familias[0].lamas).toEqual({ total: 31.25, porPasada: POR_PASADA, minimoUnaPasada: false });
    expect(lamas.familias[0].costoTela).toBeLessThan(panos.familias[0].costoTela);
  });

  // El piso de una pasada es lo que hace que estrenar el cobro por lamas no le
  // baje el precio a nadie: bajo 2,64 m se cobra igual que hoy, y de ahí para
  // arriba se cobra la fracción en vez del salto al doble.
  describe('mínimo de una pasada', () => {
    const CON_MINIMO: TelaVertical = { ...TELA_VERTICAL_DEFAULT, modo: 'lamas', minimoUnaPasada: true };
    const m = (ancho: number, tv: TelaVertical) =>
      metrosTelaVerticalPorLamas([{ ancho, altoReal: 2.25 }], tv);

    it('viene puesto de fábrica', () => {
      expect(TELA_VERTICAL_DEFAULT.minimoUnaPasada).toBe(true);
    });

    it('una cortina angosta paga la pasada entera, igual que hoy por paños', () => {
      expect(m(2, CON_MINIMO)).toBeCloseTo(2.25, 4);
      expect(m(2, CON_MINIMO)).toBeCloseTo(metrosTelaVertical([{ ancho: 2, altoReal: 2.25 }], 2.95), 4);
      // Sin el mínimo pagaría 25/33 de pasada.
      expect(m(2, LAMAS)).toBeCloseTo((25 / POR_PASADA) * 2.25, 4);
    });

    it('justo en el borde de la pasada (33 lamas = 2,64 m) los dos modos coinciden', () => {
      expect(m(2.64, CON_MINIMO)).toBeCloseTo(2.25, 4);
      expect(m(2.64, LAMAS)).toBeCloseTo(2.25, 4);
    });

    it('sobre una pasada cobra la fracción, no el doble', () => {
      // 3,00 m = 37,5 lamas = 1,136 pasadas → 2,557 m.
      expect(m(3.0, CON_MINIMO)).toBeCloseTo((37.5 / POR_PASADA) * 2.25, 4);
      // Por paños esa misma cortina cruza el rollo de 2,95 y paga el DOBLE.
      expect(metrosTelaVertical([{ ancho: 3.0, altoReal: 2.25 }], 2.95)).toBeCloseTo(4.5, 4);
    });

    it('nunca cobra menos de una pasada, por angosta que sea la cortina', () => {
      for (const ancho of [0.4, 0.8, 1.5, 2.0, 2.4, 2.64]) {
        expect(m(ancho, CON_MINIMO)).toBeCloseTo(2.25, 4);
      }
    });

    // Ojo con esta asimetría, que es la parte honesta del cambio: una pasada
    // cubre 33 lamas = 2,64 m de cortina, pero por paños una cortina entra
    // entera mientras quepa en el ANCHO DEL ROLLO del código (2,48 · 2,98…).
    // Entre esos dos números el cobro por lamas sale algo más caro que hoy.
    it('entre 2,64 m y el ancho del rollo cobra un poco MÁS que por paños', () => {
      // Rollo 2,98 (el más común del catálogo): 2,80 m entra en un paño.
      expect(metrosTelaVertical([{ ancho: 2.8, altoReal: 2.25 }], 2.98)).toBeCloseTo(2.25, 4);
      // Por lamas son 35 lamas = 1,06 pasadas.
      expect(m(2.8, CON_MINIMO)).toBeCloseTo((35 / POR_PASADA) * 2.25, 4);
      expect(m(2.8, CON_MINIMO)).toBeGreaterThan(2.25);
    });

    it('con el rollo angosto del catálogo (2,48) el cobro por lamas es más barato en todo el tramo', () => {
      for (const ancho of [2.5, 2.64, 2.9, 3.5]) {
        expect(m(ancho, CON_MINIMO)).toBeLessThan(
          metrosTelaVertical([{ ancho, altoReal: 2.25 }], 2.48),
        );
      }
    });
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

// ─────────────────────────────────────────────────────────────────────
// BEEBLACK — sistema con reglas propias: margen 0,60, un metro entero de tela
// extra, mano de obra 83.300, traslado 47.600 e instalación 41.650 embebida +
// 35.000 en la fila de abajo. Sale de la copia beeblack del Excel, cuyo panel
// reusa BLACKOUT_P / SCREEN_P / SCREEN_D con otra lista de materiales.
// ─────────────────────────────────────────────────────────────────────

// La tela beeblack se cobra al MÁXIMO de su familia (no a una tela de
// referencia). BEE-BK va a 48.500: lo tecleado en el panel de la copia, que
// desde el 2026-08-19 es también el valor del catálogo real
// (sql/20260819_tela_beeblack_48500.sql). Un caso mide el 48.415,15 calculado
// con el que se cotizó hasta entonces.
const CAT_BB: CatalogoProductos = {
  ...CAT,
  'BEE-BK01': { cod: 'BEE_BK', producto: 'BEEBLACK BLACKOUT WATERPROOF', tipo: 'PREMIUM', descripcion: 'FB-2589-NEGRO', precio: 8760.92 },
  'BEE-BK': { cod: 'BEE_BK', producto: 'BEEBLACK-BLACKOUT WATERPROFF', tipo: 'PREMIUM', descripcion: '', precio: 48500 },
  'BEE-SC01': { cod: 'BEE_MOSQ', producto: 'BEEBLACK MOSQUITERO', tipo: 'PREMIUM', descripcion: '', precio: 16138.54 },
  'BEE-SC': { cod: 'BEE_MOSQ', producto: 'BEEBLACK-MOSQUITERO', tipo: 'PREMIUM', descripcion: '', precio: 48500 },
};
const AR_BB: Record<string, number> = {
  ...AR,
  'BEE-BK01': 2.98, 'BEE-BK': 2.98, 'BEE-SC01': 2.98, 'BEE-SC': 2.98,
};

// La copia de TRINA tiene la celda del riel ROTA: la fila «ALTO» copia el
// total de la de «ANCHO» (=U115*W115), así que el riel se cobra dos veces por
// ancho. La receta de fábrica sigue a la copia canónica (COTAP-8003, decisión
// del dueño 2026-08-19), de modo que esta cotización —que se cobró así— se
// reproduce con la receta de SU copia, igual que los goldens con los insumos
// de su época.
const REGLAS_TRINA: ReglasPrecios = {
  ...REGLAS_PRECIOS_DEFAULT,
  recetas: {
    ...REGLAS_PRECIOS_DEFAULT.recetas,
    BEE_BK: RECETAS_DEFAULT.BEE_BK.map((l) =>
      l.insumo === 'SLM01' ? { ...l, cantidad: { tipo: 'sumaAnchos' as const, factor: 2 } } : l,
    ),
  },
};

describe('motorFase0 — beeblack (COTJS-10384, cliente TRINA)', () => {
  // Una cortina BEE-BK01 de 0,82 × 0,493 con 40 % de descuento.
  const FILA = { codInt: 'BEE-BK01', ancho: 0.82, alto: 0.493, cantidad: 1, descuento: 0.4 };
  const cotizar = () =>
    cotizarFase0([FILA], CAT_BB, AR_BB, [], PARAMETROS_DEFAULT, false, false, REGLAS_TRINA);

  it('usa el metro entero de tela extra, no los 25 cm del roller', () => {
    const f = cotizar().familias[0];
    // Alto real = 0,493 + 1,00 = 1,493 (Optimizador!K10 de la copia).
    expect(f.metrosTela).toBeCloseTo(1.493, 6);
    expect(f.m2Total).toBeCloseTo(1.22426, 6);
  });

  it('la lista de materiales suma lo mismo que el panel del Excel (X137)', () => {
    const f = cotizar().familias[0];
    expect(f.costoMateriales).toBeCloseTo(307094.5727, 3);
    // Los dos rieles laterales cobran el ANCHO por partida doble: es la celda
    // rota de la copia de TRINA (por eso este bloque pasa REGLAS_TRINA).
    const rieles = f.materiales.filter((l) => l.insumo === 'SLM01');
    expect(rieles).toHaveLength(2);
    expect(rieles[0].total).toBeCloseTo(68330.6, 3);
    expect(rieles[1].total).toBeCloseTo(rieles[0].total, 6);
    // El zuncho simple lleva el x4 aplicado dos veces: suma de altos x 16.
    const zuncho = f.materiales.find((l) => l.insumo === 'SML38');
    expect(zuncho?.cantidad).toBeCloseTo(0.493 * 16, 6);
    expect(zuncho?.total).toBeCloseTo(525.8456, 3);
  });

  it('mano de obra, traslado y margen son los del sistema, no los del roller', () => {
    const f = cotizar().familias[0];
    expect(f.sistema).toBe('Beeblack');
    expect(f.manoObra).toBe(83300);
    expect(f.traslado).toBe(47600);
    // Publicidad: 3.076,8 ÷ 0,60 = 5.128 (en el roller son 1.400 ÷ 0,65).
    expect(f.materiales.find((l) => l.insumo === 'PUB 01')?.precioUnit).toBeCloseTo(5128, 6);
    expect(f.exacto).toBe(true);
  });

  it('la tela se cobra al MÁXIMO de la familia, no a una tela de referencia', () => {
    const f = cotizar().familias[0];
    // BEE-BK (48.500) le gana a la tela elegida, BEE-BK01 (8.760,92).
    expect(f.arquetipoCodInt).toBe('BEE-BK');
    expect(f.precioMl).toBe(48500);
    expect(f.costoTela).toBeCloseTo(72410.5, 3);
  });

  it('VALOR M2 y VAL. UNIT calzan al peso con la cotización', () => {
    const r = cotizar();
    const f = r.familias[0];
    expect(f.costoTotal).toBeCloseTo(510405.0727, 3);
    expect(f.precioM2).toBeCloseTo(416909.0493, 3);
    // Instalación embebida 41.650, distinta de la que cobra la fila de abajo.
    expect(r.lineas[0].instalacionEmbebida).toBe(41650);
    expect(r.lineas[0].valorUnit).toBeCloseTo(552055.0727, 3);
    expect(r.lineas[0].total).toBeCloseTo(331233.0436, 3);
  });

  it('la fila de instalación cobra 35.000 bajo el mínimo de 4', () => {
    const r = cotizar();
    expect(r.instalacion.cantidad).toBe(1);
    expect(r.instalacion.precioUnit).toBe(35000);
    expect(r.instalacion.total).toBe(35000);
    expect(r.instalacion.gratis).toBe(false);
    expect(r.instalacion.partes).toEqual([
      { sistema: 'Beeblack', cantidad: 1, precioUnit: 35000, total: 35000 },
    ]);
  });

  it('subtotal, IVA y total de la cotización', () => {
    const r = cotizar();
    expect(r.subtotalNeto).toBeCloseTo(366233.0436, 3);
    expect(r.totales.totalTransferencia).toBeCloseTo(435817.3219, 3);
  });

  it('con el 48.415,15 que el catálogo traía hasta el 2026-08-19 la tela baja $126,91', () => {
    const cat = { ...CAT_BB, 'BEE-BK': { ...CAT_BB['BEE-BK'], precio: 48415.153846 } };
    const r = cotizarFase0([FILA], cat, AR_BB, [], PARAMETROS_DEFAULT, false, false, REGLAS_TRINA);
    // El 48.500 del panel estaba tecleado a mano; el máximo calculado era
    // 48.415,15, que el motor redondea al peso como hace el Excel.
    expect(r.familias[0].precioMl).toBe(48415);
    expect(r.lineas[0].valorUnit).toBeCloseTo(551928.1677, 3);
    // La diferencia es solo la tela: (48.500 − 48.415) × 1,493 m.
    expect(552055.0727 - r.lineas[0].valorUnit).toBeCloseTo(85 * 1.493, 3);
  });

  it('con 4 beeblack la instalación sale gratis (mismo mínimo que el roller)', () => {
    const r = cotizarFase0(
      [{ codInt: 'BEE-BK01', ancho: 0.82, alto: 0.493, cantidad: 4 }],
      CAT_BB, AR_BB,
    );
    expect(r.instalacion.cantidad).toBe(4);
    expect(r.instalacion.total).toBe(0);
    expect(r.instalacion.gratis).toBe(true);
  });

  it('el panel plantilla de 3,00 × 3,00 da el VALOR M2 de la copia (90.765,59)', () => {
    // Cortina de ejemplo de la copia «SOLO BK O SOLO MOSQUITERO»: su celda
    // T147 dice 90.765,59377777779. Va con la receta de fábrica: en una
    // cortina cuadrada (ancho = alto) la celda del riel rota no se nota.
    const r = cotizarFase0([{ codInt: 'BEE-BK', ancho: 3, alto: 3, cantidad: 1 }], CAT_BB, AR_BB);
    expect(r.familias[0].m2Total).toBeCloseTo(12, 6);
    expect(r.familias[0].metrosTela).toBeCloseTo(4, 6);
    expect(r.familias[0].precioM2).toBeCloseTo(90765.5938, 3);
  });

  it('roller y beeblack juntos: cada uno con su receta y su instalación', () => {
    const r = cotizarFase0(
      [
        { codInt: 'BEE-BK01', ancho: 0.82, alto: 0.493, cantidad: 1 },
        { codInt: 'SC 34', ancho: 1.124, alto: 1.3, cantidad: 1 },
      ],
      CAT_BB, AR_BB,
    );
    const bb = r.familias.find((f) => f.cod === 'BEE_BK');
    const rol = r.familias.find((f) => f.cod === 'SCREEN_P');
    expect(bb?.sistema).toBe('Beeblack');
    expect(rol?.sistema).toBeUndefined();
    // El roller conserva sus números: 25 cm de extra, MO 19.500, traslado 55.000.
    expect(rol?.manoObra).toBe(19500);
    expect(rol?.traslado).toBe(55000);
    expect(rol?.metrosTela).toBeCloseTo(1.55, 6);
    // Dos tramos de instalación a precios distintos; 2 cortinas < 4 → se cobran.
    expect(r.instalacion.cantidad).toBe(2);
    expect(r.instalacion.partes).toHaveLength(2);
    expect(r.instalacion.partes.find((p) => p.sistema === 'Beeblack')?.total).toBe(35000);
    expect(r.instalacion.partes.find((p) => p.sistema === 'Roller')?.total).toBe(17500);
    expect(r.instalacion.total).toBe(52500);
  });

  it('sin instalación no se embebe ni se cobra', () => {
    const r = cotizarFase0(
      [{ codInt: 'BEE-BK01', ancho: 0.82, alto: 0.493, cantidad: 1 }],
      CAT_BB, AR_BB, [], PARAMETROS_DEFAULT, false, true,
    );
    expect(r.lineas[0].instalacionEmbebida).toBe(0);
    expect(r.instalacion.total).toBe(0);
    expect(r.instalacion.partes).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// COTAP-8003 (14-07-2026): la cotización que fija la receta beeblack CANÓNICA.
// Su copia del Excel tiene la fila «ALTO» del riel SLM01 corregida (cobra los
// altos, como dice su rótulo) y el dueño la declaró la buena el 2026-08-19,
// así que se cotiza con las reglas de fábrica tal cual. Cuatro cortinas
// BEE-BK03 con 40 % de descuento; los valores esperados son los PESOS EXACTOS
// del formato de cotización.
// ─────────────────────────────────────────────────────────────────────
describe('motorFase0 — beeblack (COTAP-8003, la copia canónica)', () => {
  const CAT_COTAP: CatalogoProductos = {
    ...CAT_BB,
    'BEE-BK03': { cod: 'BEE_BK', producto: 'BEEBLACK BLACKOUT WATERPROOF', tipo: 'PREMIUM', descripcion: 'FB-6622-BEIGE', precio: 7839 },
  };
  const AR_COTAP = { ...AR_BB, 'BEE-BK03': 2.98 };
  const FILAS = [
    { codInt: 'BEE-BK03', ancho: 2.549, alto: 1.728, cantidad: 1, descuento: 0.4 },
    { codInt: 'BEE-BK03', ancho: 1.583, alto: 2.35, cantidad: 1, descuento: 0.4 },
    { codInt: 'BEE-BK03', ancho: 1.188, alto: 1.726, cantidad: 1, descuento: 0.4 },
    { codInt: 'BEE-BK03', ancho: 1.476, alto: 1.729, cantidad: 1, descuento: 0.4 },
  ];
  const cotizar = () => cotizarFase0(FILAS, CAT_COTAP, AR_COTAP);

  it('el riel cobra los anchos ×2 y los altos ×2 (la celda corregida)', () => {
    const f = cotizar().familias[0];
    const rieles = f.materiales.filter((l) => l.insumo === 'SLM01');
    expect(rieles).toHaveLength(2);
    // Σanchos = 6,796 → ×2 = 13,592 · Σaltos = 7,533 → ×2 = 15,066.
    expect(rieles[0].cantidad).toBeCloseTo(13.592, 6);
    expect(rieles[0].total).toBeCloseTo(566310.68, 2);
    expect(rieles[1].cantidad).toBeCloseTo(15.066, 6);
    expect(rieles[1].total).toBeCloseTo(627724.89, 2);
    expect(f.costoMateriales).toBeCloseTo(2083998.793, 3);
  });

  it('la tela comparte tiros: las dos angostas viajan en un solo paño', () => {
    const f = cotizar().familias[0];
    // 1,188 + 1,476 = 2,664 caben en el rollo de 2,98; la de 1,583 y la de
    // 2,549 van solas. MTS = 2,729 + 3,35 + 2,728. La tela manda BEE-BK a
    // 48.500 (el MÁXIMO de la familia, tal como el panel de la copia).
    expect(f.panos).toHaveLength(3);
    expect(f.metrosTela).toBeCloseTo(8.807, 6);
    expect(f.precioMl).toBe(48500);
    expect(f.costoTela).toBeCloseTo(427139.5, 3);
  });

  it('los cuatro VAL. UNIT calzan AL PESO con el formato de cotización', () => {
    const r = cotizar();
    expect(r.familias[0].precioM2).toBeCloseTo(148128.1869, 3);
    const esperados = [1071685, 827181, 521361, 638311];
    r.lineas.forEach((l, i) => expect(Math.round(l.valorUnit)).toBe(esperados[i]));
  });

  it('subtotal y total transferencia, al peso; instalación gratis por 4', () => {
    const r = cotizar();
    expect(Math.round(r.subtotalNeto)).toBe(1835123);
    expect(Math.round(r.totales.totalTransferencia)).toBe(2183796);
    expect(r.instalacion.gratis).toBe(true);
    expect(r.instalacion.total).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Lo que pasa cuando los datos NO están bien: una cotización nunca debe
// cobrar un número inventado en silencio.
// ─────────────────────────────────────────────────────────────────────
describe('motorFase0 — datos incompletos', () => {
  const CAT_MIN: CatalogoProductos = {
    'BK 09': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 27176 },
    'BK-D': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 31000 },
  };

  it('una tela que no está en el catálogo se cotiza en $0 y avisa (antes cobraba $17.500)', () => {
    const r = cotizarFase0(
      [{ codInt: 'NO-EXISTE', ancho: 1.5, alto: 2, cantidad: 1 }],
      CAT_MIN, {},
    );
    expect(r.lineas[0].valorUnit).toBe(0);
    expect(r.lineas[0].instalacionEmbebida).toBe(0);
    expect(r.lineas[0].total).toBe(0);
    expect(r.subtotalNeto).toBe(0);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toMatchObject({ tipo: 'catalogo', codigo: 'NO-EXISTE' });
  });

  it('el aviso sale UNA vez aunque el código se repita en varias filas', () => {
    const r = cotizarFase0(
      [
        { codInt: 'NO-EXISTE', ancho: 1.5, alto: 2, cantidad: 1 },
        { codInt: 'NO-EXISTE', ancho: 1.2, alto: 2, cantidad: 1 },
      ],
      CAT_MIN, {},
    );
    expect(r.avisos).toHaveLength(1);
  });

  it('una cotización sana no trae ningún aviso', () => {
    const r = cotizarFase0([{ codInt: 'BK 09', ancho: 1.5, alto: 2, cantidad: 1 }], CAT_MIN, {});
    expect(r.avisos).toEqual([]);
  });

  it('con la tela de referencia rota, la familia cae al MÁXIMO en vez de cobrar la tela gratis', () => {
    // Sin BK-D en el catálogo, el arquetipo de BLACKOUT_D no resuelve.
    const sinArquetipo: CatalogoProductos = { 'BK 09': CAT_MIN['BK 09'] };
    const r = cotizarFase0([{ codInt: 'BK 09', ancho: 1.5, alto: 2, cantidad: 1 }], sinArquetipo, {});
    expect(r.familias[0].precioMl).toBe(27176);
    expect(r.familias[0].arquetipoCodInt).toBe('BK 09');
    expect(r.avisos).toEqual([]);
  });

  it('una familia donde ninguna tela tiene precio avisa en vez de cobrar $0 callada', () => {
    const gratis: CatalogoProductos = {
      'X 01': { cod: 'FAM_X', producto: 'ROLLER X', tipo: 'PREMIUM', descripcion: '', precio: 0 },
    };
    const r = cotizarFase0([{ codInt: 'X 01', ancho: 1.5, alto: 2, cantidad: 1 }], gratis, {});
    expect(r.familias[0].costoTela).toBe(0);
    expect(r.avisos.some((a) => a.tipo === 'tela' && a.codigo === 'FAM_X')).toBe(true);
  });

  it('el precio de la familia NO depende del orden de las filas', () => {
    const cat: CatalogoProductos = {
      'BK 09': CAT_MIN['BK 09'],
      'BK 10': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 23782 },
    };
    const a = cotizarFase0(
      [
        { codInt: 'BK 10', ancho: 1.5, alto: 2, cantidad: 1 },
        { codInt: 'BK 09', ancho: 1.5, alto: 2, cantidad: 1 },
      ],
      cat, {},
    );
    const b = cotizarFase0(
      [
        { codInt: 'BK 09', ancho: 1.5, alto: 2, cantidad: 1 },
        { codInt: 'BK 10', ancho: 1.5, alto: 2, cantidad: 1 },
      ],
      cat, {},
    );
    expect(a.familias[0].precioMl).toBe(b.familias[0].precioMl);
    expect(a.subtotalNeto).toBeCloseTo(b.subtotalNeto, 6);
  });

  it('un ancho de rollo guardado en 0 cae al de respaldo y no manda cada pieza a su paño', () => {
    const filas = [
      { codInt: 'BK 09', ancho: 1.0, alto: 2, cantidad: 1 },
      { codInt: 'BK 09', ancho: 1.0, alto: 2, cantidad: 1 },
    ];
    const cero = cotizarFase0(filas, CAT_MIN, { 'BK 09': 0 });
    const sinDato = cotizarFase0(filas, CAT_MIN, {});
    // Respaldo 2,45: las dos cortinas de 1 m comparten paño.
    expect(cero.familias[0].panos).toHaveLength(1);
    expect(cero.familias[0].metrosTela).toBeCloseTo(sinDato.familias[0].metrosTela, 6);
  });
});

describe('motorFase0 — el paso de lama gobierna tela y ferretería juntas', () => {
  const CAT_V: CatalogoProductos = {
    'BK-V-P': { cod: 'BLACKOUT_V_P', producto: 'CORTINA VERTICAL BLACKOUT PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 29231 },
  };
  const cotizar = (pasoLamaM: number) =>
    cotizarFase0(
      [{ codInt: 'BK-V-P', ancho: 2.4, alto: 2, cantidad: 1 }],
      CAT_V, { 'BK-V-P': 2.45 }, [], PARAMETROS_DEFAULT, false, false,
      {
        ...REGLAS_PRECIOS_DEFAULT,
        baseVertical: { ...REGLAS_PRECIOS_DEFAULT.baseVertical, BLACKOUT_V_P: 'BK-V-P' },
        telaVertical: { ...TELA_VERTICAL_DEFAULT, modo: 'lamas', minimoUnaPasada: false, pasoLamaM },
      },
    );

  // El `÷ 0,8 × 10` viejo era el paso 0,08 escrito de otra forma: con el paso
  // de fábrica el número no puede cambiar.
  it('con el paso de fábrica, la ferretería da lo mismo que la fórmula vieja', () => {
    const lamas = cotizar(0.08).familias[0].materiales.find((l) => l.insumo === 'VER 02');
    expect(lamas?.cantidad).toBeCloseTo((2.4 / 0.8) * 10, 6);
  });

  it('cambiar el paso mueve la tela Y los carritos en la misma proporción', () => {
    const a = cotizar(0.08).familias[0];
    const b = cotizar(0.1).familias[0];
    const carritos = (f: typeof a) => f.materiales.find((l) => l.insumo === 'VER 02')?.cantidad ?? 0;
    // Con lamas más separadas se necesitan menos: 2,4/0,1 = 24 en vez de 30.
    expect(carritos(b)).toBeCloseTo(24, 6);
    expect(carritos(b) / carritos(a)).toBeCloseTo(0.8, 6);
    expect(b.metrosTela / a.metrosTela).toBeCloseTo(0.8, 6);
  });

  it('la regla en castellano nombra el paso vigente', () => {
    const linea = cotizar(0.1).familias[0].materiales.find((l) => l.insumo === 'VER 02');
    expect(linea?.regla).toContain('0,1 m');
  });
});

describe('motorFase0 — la fila de instalación cuenta VENTANAS, no paños', () => {
  const CAT: CatalogoProductos = {
    'BK 09': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 27176 },
    'BK-D': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 31000 },
  };
  const fila = (over: Record<string, unknown> = {}) =>
    ({ codInt: 'BK 09', ancho: 1.3, alto: 2.3, cantidad: 1, ...over });

  it('un dual (dos paños, una ventana) se instala UNA vez', () => {
    const r = cotizarFase0(
      [fila({ ventanaId: 'V1' }), fila({ ventanaId: 'V1' }), fila({ ventanaId: 'V2' })],
      CAT, {},
    );
    expect(r.instalacion.cantidad).toBe(2); // dos ventanas, no tres paños
    expect(r.instalacion.total).toBe(2 * 17500);
  });

  it('sin ventanaId se cuenta por pieza, como siempre (regresión)', () => {
    const r = cotizarFase0([fila(), fila(), fila()], CAT, {});
    expect(r.instalacion.cantidad).toBe(3);
  });

  it('una fila con cantidad 3 y sin ventana son 3 instalaciones', () => {
    const r = cotizarFase0([fila({ cantidad: 3 })], CAT, {});
    expect(r.instalacion.cantidad).toBe(3);
  });

  it('contar por ventana puede dejar la cotización bajo el mínimo, y entonces se cobra', () => {
    // 4 paños repartidos en 3 ventanas: por paños habría llegado al mínimo.
    const r = cotizarFase0(
      [
        fila({ ventanaId: 'V1' }), fila({ ventanaId: 'V1' }),
        fila({ ventanaId: 'V2' }), fila({ ventanaId: 'V3' }),
      ],
      CAT, {},
    );
    expect(r.instalacion.cantidad).toBe(3);
    expect(r.instalacion.gratis).toBe(false);
    expect(r.instalacion.total).toBe(3 * 17500);
  });
});

describe('textoInstalacion — el motivo, no siempre «bajo el mínimo»', () => {
  const base = {
    cantidad: 2, precioUnit: 17500, descuento: 0, total: 35000,
    gratis: false, region: false, sinInstalacion: false, partes: [],
  };
  it('bajo el mínimo lo dice', () => {
    expect(textoInstalacion(base, 4)).toBe('2 cortinas, bajo el mínimo de 4');
  });
  it('llegando al mínimo no dice «bajo»', () => {
    expect(textoInstalacion({ ...base, cantidad: 5 }, 4)).toBe('5 cortinas, 4 o más: sin costo');
  });
  it('región con descuento parcial lo dice, aunque supere el mínimo', () => {
    expect(textoInstalacion({ ...base, cantidad: 6, region: true, descuento: 0.5 }, 4)).toBe(
      '6 cortinas, región: 50 % de descuento',
    );
  });
  it('sin instalación lo dice', () => {
    expect(textoInstalacion({ ...base, sinInstalacion: true }, 4)).toBe('2 cortinas, sin instalación');
  });
  it('una sola cortina va en singular', () => {
    expect(textoInstalacion({ ...base, cantidad: 1 }, 4)).toBe('1 cortina, bajo el mínimo de 4');
  });
});
