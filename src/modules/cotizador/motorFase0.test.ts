import { describe, it, expect } from 'vitest';
import {
  cotizarFase0,
  metrosTelaPorPanos,
  metrosTelaVertical,
} from './motorFase0';
import type { CatalogoProductos } from './types';

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
  // COD_INT base de cada familia roller (precio que usa la vertical equivalente)
  'SC-P':  { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM (base)', tipo: 'PREMIUM', descripcion: '', precio: 31582 },
  'BK-P':  { cod: 'BLACKOUT_P', producto: 'ROLLER BLACKOUT PREMIUM (base)', tipo: 'PREMIUM', descripcion: '', precio: 29231 },
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
};
const AR: Record<string, number> = {
  'DU 25': 2.65, 'DB-P': 2.65, 'DU 28': 2.95, 'DU 07': 2.95,
  'SC 34': 2.98, 'SC 17': 2.98, 'BK 18': 2.98, 'BK 50': 2.98,
  'SC 34-V': 2.98, 'SC 03-V': 2.48, 'SC 17-V': 2.98, 'BK 49-V': 2.98,
};

const cerca = (valor: number, esperado: number, tolPct: number) =>
  Math.abs(valor - esperado) / esperado <= tolPct;

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

describe('motorFase0 — validación al peso contra cotizaciones reales', () => {
  // ───── Dúo ─────
  it('Guillermo — Dúo Blackout Delux (3 cortinas) — exacto', () => {
    const r = cotizarFase0([
      { codInt: 'DU 25', ancho: 2.44, alto: 2.25, cantidad: 1 },
      { codInt: 'DU 25', ancho: 1.76, alto: 1.8, cantidad: 1 },
      { codInt: 'DU 25', ancho: 1.76, alto: 1.8, cantidad: 1 },
    ], CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 465137.31, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 282266.46, 0.001)).toBe(true);
  });

  it('Jorge — Dúo Blackout Premium (4 cortinas) — exacto', () => {
    const r = cotizarFase0([
      { codInt: 'DB-P', ancho: 1.7, alto: 2.3, cantidad: 1 },
      { codInt: 'DB-P', ancho: 1.45, alto: 1.5, cantidad: 1 },
      { codInt: 'DB-P', ancho: 0.78, alto: 2.3, cantidad: 1 },
      { codInt: 'DB-P', ancho: 0.78, alto: 2.3, cantidad: 1 },
    ], CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 349003.15, 0.001)).toBe(true);
    expect(cerca(r.lineas[2].valorUnit, 169601.45, 0.001)).toBe(true);
  });

  it('Jeanine — Dúo Poliéster Premium — exacto', () => {
    const r = cotizarFase0([
      { codInt: 'DU 07', ancho: 1.757, alto: 1.3, cantidad: 1 },
    ], CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 245061.99, 0.001)).toBe(true);
  });

  // ───── Roller Premium / Delux ─────
  it('Felipe — Screen Premium (3 cortinas) — exacto', () => {
    const r = cotizarFase0([
      { codInt: 'SC 34', ancho: 1.124, alto: 1.3, cantidad: 1 },
      { codInt: 'SC 34', ancho: 1.168, alto: 1.307, cantidad: 1 },
      { codInt: 'SC 34', ancho: 0.992, alto: 1.31, cantidad: 1 },
    ], CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 123832.7, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 128494.2, 0.001)).toBe(true);
    expect(cerca(r.lineas[2].valorUnit, 111950.68, 0.001)).toBe(true);
  });

  it('Alejandro — Screen Premium (9 cortinas, mezcla anchos/altos) — exacto', () => {
    const r = cotizarFase0([
      { codInt: 'SC 17', ancho: 1.352, alto: 2.36, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.254, alto: 2.36, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.349, alto: 2.36, cantidad: 1 },
      { codInt: 'SC 17', ancho: 0.745, alto: 1.4, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.874, alto: 1.4, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.886, alto: 1.4, cantidad: 1 },
      { codInt: 'SC 17', ancho: 0.745, alto: 1.4, cantidad: 1 },
      { codInt: 'SC 17', ancho: 1.973, alto: 2.3, cantidad: 1 },
      { codInt: 'SC 17', ancho: 0.898, alto: 2.3, cantidad: 1 },
    ], CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 150329.51, 0.001)).toBe(true);
    expect(cerca(r.lineas[7].valorUnit, 206884.59, 0.001)).toBe(true);
  });

  it('Felipe — Blackout Delux (2 cortinas) — exacto', () => {
    const r = cotizarFase0([
      { codInt: 'BK 18', ancho: 1.23, alto: 1.4, cantidad: 1 },
      { codInt: 'BK 18', ancho: 1.1, alto: 1.41, cantidad: 1 },
    ], CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 139601.96, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 127358.68, 0.001)).toBe(true);
  });

  // ───── Roller Standard ─────
  it('Alejandro — Blackout Standard (2 cortinas) — dentro de ~0,5% (residual menor)', () => {
    const r = cotizarFase0([
      { codInt: 'BK 50', ancho: 1.5, alto: 1.0, cantidad: 1 },
      { codInt: 'BK 50', ancho: 2.0, alto: 1.9, cantidad: 1 },
    ], CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 101556.21, 0.01)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 210268.91, 0.01)).toBe(true);
  });

  // ───── Verticales ─────
  it('Felipe — Vertical Screen Premium — exacto', () => {
    const r = cotizarFase0(
      [{ codInt: 'SC 34-V', ancho: 1.869, alto: 2.3, cantidad: 1 }],
      CAT, AR,
    );
    expect(cerca(r.lineas[0].valorUnit, 383068.76, 0.001)).toBe(true);
  });

  it('Jeanine — Vertical Screen Premium (2 cortinas) — exacto', () => {
    const r = cotizarFase0([
      { codInt: 'SC 03-V', ancho: 0.878, alto: 2.38, cantidad: 1 },
      { codInt: 'SC 17-V', ancho: 2.255, alto: 2.38, cantidad: 1 },
    ], CAT, AR);
    expect(cerca(r.lineas[0].valorUnit, 207347.57, 0.001)).toBe(true);
    expect(cerca(r.lineas[1].valorUnit, 469804.99, 0.001)).toBe(true);
  });

  it('Giovanni — Vertical Blackout Premium — exacto', () => {
    const r = cotizarFase0(
      [{ codInt: 'BK 49-V', ancho: 2.791, alto: 2.337, cantidad: 1 }],
      CAT, AR,
    );
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
    const r = cotizarFase0(cortinas, CAT, AR, adicionales);
    // Adicionales exactos al peso (12 items)
    expect(r.adicionales.length).toBe(12);
    const sumaAdic = r.adicionales.reduce((s, a) => s + a.total, 0);
    expect(cerca(sumaAdic, 968340, 0.0001)).toBe(true);
    // Subtotal completo (cortinas + adicionales) — la única holgura viene del
    // residual de Blackout Standard (~0,4%), que diluye a ~0,01% en el total.
    expect(cerca(r.subtotalNeto, 2983696.24, 0.001)).toBe(true);
    expect(cerca(r.totales.totalTransferencia, 3550598.53, 0.001)).toBe(true);
  });
});
