import { describe, expect, it } from 'vitest';
import {
  clavePieza,
  esTiroCompartido,
  filasDelLote,
  juntoPorOT,
  resumenTiros,
  tirosDelLote,
  type FilaLote,
} from './hojaLote';
import type { CatalogoProductos } from '@/modules/cotizador/types';
import type { OT } from '@/modules/ots/types';

// Catálogo mínimo: dos telas con rollo de 2,98 m.
const catalogo = {
  'BK 10': { producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', cod: 'BLACKOUT', anchoRollo: 2.98 },
  'SC 10': { producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', cod: 'SCREEN', anchoRollo: 2.98 },
} as unknown as CatalogoProductos;

/** Una OT con las ventanas que se le pidan (ancho/alto en metros). */
const ot = (
  id: string,
  numero: string,
  ventanas: { id: string; ubicacion: string; codInt: string; ancho: number; alto: number }[],
): OT =>
  ({
    id,
    estado: 'produccion',
    subEtapa: 'dimensionado',
    datosGenerales: { ot: numero, cliente: 'Cliente' },
    storeVentanas: ventanas.map((v) => ({
      id: v.id,
      ubicacion: v.ubicacion,
      categoria: 'ROL',
      codInt: v.codInt,
      producto: catalogo[v.codInt]?.producto ?? '',
      tipo: 'DELUX',
      color: 'BCO',
      alto: v.alto,
      precio: 0,
      cantidad: 1,
      panos: [{ ancho: String(v.ancho), alto: String(v.alto), codInt: v.codInt }],
    })),
  }) as unknown as OT;

// Dos órdenes que comparten la BK 10: es el caso para el que se inventó el lote.
const OT_A = ot('ot-a', '#3215', [
  { id: 'va1', ubicacion: 'LIVING', codInt: 'BK 10', ancho: 1.0, alto: 2.0 },
  { id: 'va2', ubicacion: 'COMEDOR', codInt: 'SC 10', ancho: 1.2, alto: 2.0 },
]);
const OT_B = ot('ot-b', '#3213', [
  { id: 'vb1', ubicacion: 'DORM 1', codInt: 'BK 10', ancho: 1.2, alto: 2.0 },
]);

describe('filasDelLote', () => {
  it('junta las filas de todas las OTs y cada una recuerda de quién es', () => {
    const filas = filasDelLote([OT_A, OT_B], catalogo);
    expect(filas).toHaveLength(3);
    expect(new Set(filas.map((f) => f.otNum))).toEqual(new Set(['#3215', '#3213']));
    // El empacador copia la fila entera al asignarle paño: si perdiera estos
    // campos, el tiro no podría decir de qué orden es cada cortina.
    expect(filas.every((f) => !!f.otId && !!f.otNum)).toBe(true);
  });

  it('una OT sin ventanas no aporta filas ni rompe el lote', () => {
    const vacia = ot('ot-c', '#9999', []);
    expect(filasDelLote([OT_A, vacia], catalogo)).toHaveLength(2);
    expect(filasDelLote([vacia], catalogo)).toEqual([]);
  });
});

describe('tirosDelLote — lo que llega a la mesa', () => {
  it('las cortinas de DOS órdenes con la misma tela viajan en el MISMO tiro', () => {
    // 1,00 + 1,20 = 2,20 m entran en el rollo de 2,98: un solo tiro de BK 10.
    const tiros = tirosDelLote(filasDelLote([OT_A, OT_B], catalogo));
    const bk = tiros.find((t) => t.codInt === 'BK 10');
    expect(bk).toBeDefined();
    expect(bk!.cortinas).toHaveLength(2);
    expect(bk!.otsNum.sort()).toEqual(['#3213', '#3215']);
    expect(esTiroCompartido(bk!)).toBe(true);
  });

  it('cada tela abre su propio tiro', () => {
    const tiros = tirosDelLote(filasDelLote([OT_A, OT_B], catalogo));
    expect(tiros).toHaveLength(2);
    expect(tiros.map((t) => t.codInt).sort()).toEqual(['BK 10', 'SC 10']);
    const sc = tiros.find((t) => t.codInt === 'SC 10')!;
    expect(esTiroCompartido(sc)).toBe(false);
    expect(sc.otsNum).toEqual(['#3215']);
  });

  it('el tiro se baja al alto de la cortina más alta y suma los anchos', () => {
    const alta = ot('ot-d', '#4000', [
      { id: 'vd1', ubicacion: 'ESCALERA', codInt: 'BK 10', ancho: 1.0, alto: 2.6 },
    ]);
    const tiros = tirosDelLote(filasDelLote([OT_A, alta], catalogo));
    const bk = tiros.find((t) => t.codInt === 'BK 10')!;
    // La más alta (2,60) manda el largo; el ancho es la suma de las dos.
    expect(bk.altoCorteCm).toBe(Math.max(...bk.cortinas.map((c) => c.altoCm)));
    expect(bk.anchoUsadoCm).toBe(bk.cortinas.reduce((s, c) => s + c.anchoCm, 0));
    expect(bk.anchoUsadoCm).toBeLessThanOrEqual(bk.anchoRolloCm);
  });

  it('cada cortina del tiro dice su OT y su ubicación', () => {
    const bk = tirosDelLote(filasDelLote([OT_A, OT_B], catalogo)).find(
      (t) => t.codInt === 'BK 10',
    )!;
    const living = bk.cortinas.find((c) => c.ubicacion === 'LIVING');
    const dorm = bk.cortinas.find((c) => c.ubicacion === 'DORM 1');
    expect(living?.otNum).toBe('#3215');
    expect(dorm?.otNum).toBe('#3213');
  });

  it('los tiros salen numerados y con letra, en el orden en que se bajan', () => {
    const tiros = tirosDelLote(filasDelLote([OT_A, OT_B], catalogo));
    expect(tiros.map((t) => t.numero)).toEqual([1, 2]);
    expect(tiros.map((t) => t.letra)).toEqual(['A', 'B']);
  });

  it('sin filas no hay tiros', () => {
    expect(tirosDelLote([])).toEqual([]);
  });
});

describe('juntoPorOT — la letra que ve cada orden', () => {
  it('las dos órdenes que comparten tiro ven la MISMA letra', () => {
    // Esta es la falla que se está arreglando: antes cada OT calculaba su
    // letra con sus propias cortinas, así que la «A» de una y la «A» de la
    // otra eran tiros distintos y ninguna describía el que llegó a la mesa.
    const filas = filasDelLote([OT_A, OT_B], catalogo);
    const mapas = juntoPorOT(filas);
    const letraA = mapas.get('ot-a')!.get(clavePieza('va1', 0))!.letra;
    const letraB = mapas.get('ot-b')!.get(clavePieza('vb1', 0))!.letra;
    expect(letraA).toBe(letraB);
  });

  it('cortinas de telas distintas NO comparten letra', () => {
    const mapas = juntoPorOT(filasDelLote([OT_A, OT_B], catalogo));
    const bk = mapas.get('ot-a')!.get(clavePieza('va1', 0))!.letra;
    const sc = mapas.get('ot-a')!.get(clavePieza('va2', 0))!.letra;
    expect(bk).not.toBe(sc);
  });

  it('hay un mapa por orden: dos OTs con la misma id de ventana no se pisan', () => {
    const uno = ot('ot-1', '#1', [
      { id: 'v1', ubicacion: 'LIVING', codInt: 'BK 10', ancho: 1.0, alto: 2.0 },
    ]);
    const dos = ot('ot-2', '#2', [
      { id: 'v1', ubicacion: 'DORM', codInt: 'SC 10', ancho: 1.0, alto: 2.0 },
    ]);
    const mapas = juntoPorOT(filasDelLote([uno, dos], catalogo));
    expect(mapas.size).toBe(2);
    // Misma llave 'v1_0' en las dos, pero cada una con la letra de SU tiro.
    const a = mapas.get('ot-1')!.get('v1_0')!.letra;
    const b = mapas.get('ot-2')!.get('v1_0')!.letra;
    expect(a).not.toBe(b);
  });
});

describe('resumenTiros', () => {
  it('cuenta tiros, compartidos, cortinas y metros a bajar', () => {
    const tiros = tirosDelLote(filasDelLote([OT_A, OT_B], catalogo));
    const r = resumenTiros(tiros);
    expect(r.tiros).toBe(2);
    expect(r.compartidos).toBe(1);
    expect(r.cortinas).toBe(3);
    expect(r.metros).toBeGreaterThan(0);
  });

  it('sin tiros todo en cero', () => {
    expect(resumenTiros([])).toEqual({ tiros: 0, compartidos: 0, cortinas: 0, metros: 0 });
  });
});

describe('clavePieza', () => {
  it('es la misma llave que usa el cálculo general', () => {
    expect(clavePieza('v1', 0)).toBe('v1_0');
    expect(clavePieza(7, 2)).toBe('7_2');
  });
});

describe('FilaLote', () => {
  it('es una fila del optimizador con la orden encima', () => {
    const f = filasDelLote([OT_A], catalogo)[0] satisfies FilaLote;
    expect(f).toHaveProperty('codInt');
    expect(f).toHaveProperty('junto');
    expect(f).toHaveProperty('otNum');
  });
});
