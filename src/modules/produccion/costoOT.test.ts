import { describe, it, expect } from 'vitest';
import {
  LARGO_BARRA_M,
  calcularCostoOT,
  claveCosto,
  costoMetroAluminio,
  costoMetroTela,
  costoUnitarioInsumo,
  panosDeColmena,
  type EntradaCostoOT,
} from './costoOT';
import type { CatalogoProductos } from '@/modules/cotizador/types';

const CAT: CatalogoProductos = {
  'BK 68': {
    cod: 'BLACKOUT_D',
    producto: 'ROLLER BK DELUX',
    tipo: 'DELUX',
    descripcion: 'X',
    precio: 23782,
    costo: 6000,
  },
  'SC 64': {
    cod: 'SCREEN_P',
    producto: 'ROLLER SCREEN',
    tipo: 'PREMIUM',
    descripcion: 'Y',
    precio: 21786,
    // Sin costo cargado a propósito.
  },
};

const base = (extra: Partial<EntradaCostoOT> = {}): EntradaCostoOT => ({
  optimizador: [],
  catalogo: CAT,
  aluminio: [],
  insumos: [],
  precioCalculo: {},
  bodega: [],
  totalConIva: 0,
  iva: 0.19,
  ...extra,
});

describe('claveCosto', () => {
  it('hace calzar el código del cálculo con el de la bodega', () => {
    expect(claveCosto('E 02')).toBe('E02');
    expect(claveCosto('e02')).toBe('E02');
    expect(claveCosto('TAP 01 -19')).toBe('TAP0119');
    expect(claveCosto(undefined)).toBe('');
  });
});

describe('costoMetroAluminio', () => {
  const bodega = new Map([['E02', 16065]]);
  const calculo = new Map([
    ['E02', 4462.5],
    ['E13', 2900.625],
  ]);

  it('manda la bodega: la barra dividida por su largo da el metro', () => {
    const r = costoMetroAluminio('E 02', bodega, calculo, LARGO_BARRA_M);
    expect(r.fuente).toBe('bodega');
    expect(r.costoM).toBeCloseTo(16065 / 5.8, 4);
    expect(r.detalleFuente).toContain('la barra');
  });

  it('sin costo en bodega usa el $/m del cálculo', () => {
    const r = costoMetroAluminio('E13', bodega, calculo, LARGO_BARRA_M);
    expect(r.fuente).toBe('calculo');
    expect(r.costoM).toBe(2900.625);
  });

  it('un código que nadie conoce queda sin costo, no en cero', () => {
    const r = costoMetroAluminio('E99', bodega, calculo, LARGO_BARRA_M);
    expect(r.costoM).toBeNull();
    expect(r.fuente).toBeNull();
  });

  it('el largo de la barra cambia el precio del metro', () => {
    const r = costoMetroAluminio('E02', bodega, calculo, 5.98);
    expect(r.costoM).toBeCloseTo(16065 / 5.98, 4);
    expect(r.detalleFuente).toContain('5,98');
  });
});

describe('costoUnitarioInsumo', () => {
  // El costo de bodega es el de UNA unidad, no el del paquete: TOP03 vale
  // 60,00 con paquete de 100 y el cálculo lo cobra a 59,50.
  it('usa el costo de bodega tal cual, sin dividir por el paquete', () => {
    const r = costoUnitarioInsumo('TOP 03', new Map([['TOP03', 60]]), new Map([['TOP03', 59.5]]));
    expect(r.costoUnit).toBe(60);
    expect(r.fuente).toBe('bodega');
  });

  it('cae al cálculo y después a nada', () => {
    expect(costoUnitarioInsumo('TOP03', new Map(), new Map([['TOP03', 59.5]])).fuente).toBe('calculo');
    expect(costoUnitarioInsumo('XXX', new Map(), new Map()).costoUnit).toBeNull();
    expect(costoUnitarioInsumo(undefined, new Map(), new Map()).costoUnit).toBeNull();
  });
});

// «BK 73» se vende con el precio de «BK-D» porque su propio precio es 0. El
// costo tiene que heredar por el mismo camino: si no, ese código sale «sin
// costo» para siempre, por más veces que se importe el Excel.
describe('costoMetroTela', () => {
  const CATREF: CatalogoProductos = {
    ...CAT,
    'BK-D': { cod: 'BLACKOUT_D', producto: 'ARQUETIPO', tipo: 'DELUX', descripcion: '', precio: 41868, costo: 22869 },
    'BK 73': { cod: 'BLACKOUT_D', producto: 'ROLLER BK 73', tipo: 'DELUX', descripcion: '', precio: 0 },
  };
  const ref = (codInt: string) => (CATREF[codInt]?.cod === 'BLACKOUT_D' ? 'BK-D' : '');

  it('el costo propio manda', () => {
    const r = costoMetroTela('BK 68', CATREF, ref);
    expect(r.costoM).toBe(6000);
    expect(r.origenCosto).toBe('propio');
  });

  it('sin costo propio hereda el de la tela que le fija el precio', () => {
    const r = costoMetroTela('BK 73', CATREF, ref);
    expect(r.costoM).toBe(22869);
    expect(r.origenCosto).toBe('referencia');
    expect(r.refCosto).toBe('BK-D');
  });

  it('si la referencia tampoco tiene costo, queda sin costo', () => {
    expect(costoMetroTela('SC 64', CATREF, () => 'SC 64').costoM).toBeNull();
    expect(costoMetroTela('SC 64', CATREF).origenCosto).toBeNull();
  });
});

describe('panosDeColmena', () => {
  it('cuenta cuántos paños salieron de retazo por código', () => {
    const m = panosDeColmena({
      a: { cod: 'BK 68', ancho: 100, alto: 200, ubic: 'A1' },
      b: { cod: 'BK68', ancho: 90, alto: 180, ubic: 'A2' },
      c: { cod: 'SC 64', ancho: 90, alto: 180, ubic: 'A3' },
    });
    expect(m.get('BK68')).toBe(2);
    expect(m.get('SC64')).toBe(1);
  });

  it('sin corte general confirmado no cuenta nada', () => {
    expect(panosDeColmena(undefined).size).toBe(0);
  });
});

describe('calcularCostoOT — telas', () => {
  it('cobra los metros del optimizador al costo del catálogo', () => {
    const r = calcularCostoOT(
      base({ optimizador: [{ codInt: 'BK 68', metros: 10, esVertical: false }] }),
    );
    expect(r.telas).toHaveLength(1);
    expect(r.telas[0].costo).toBe(60000);
    expect(r.totalTelas).toBe(60000);
    expect(r.telasSinCosto).toEqual([]);
  });

  it('una tela que hereda el precio hereda también el costo', () => {
    const r = calcularCostoOT(
      base({
        catalogo: {
          ...CAT,
          'BK-D': { cod: 'BLACKOUT_D', producto: 'ARQ', tipo: 'DELUX', descripcion: '', precio: 41868, costo: 20000 },
          'BK 73': { cod: 'BLACKOUT_D', producto: 'BK 73', tipo: 'DELUX', descripcion: '', precio: 0 },
        },
        telaReferencia: () => 'BK-D',
        optimizador: [{ codInt: 'BK 73', metros: 3, esVertical: false }],
      }),
    );
    expect(r.telas[0].costoM).toBe(20000);
    expect(r.telas[0].refCosto).toBe('BK-D');
    expect(r.totalTelas).toBe(60000);
    expect(r.telasSinCosto).toEqual([]);
  });

  it('una tela sin costo cargado suma $0 y queda nombrada', () => {
    const r = calcularCostoOT(
      base({ optimizador: [{ codInt: 'SC 64', metros: 8, esVertical: false }] }),
    );
    expect(r.telas[0].costoM).toBeNull();
    expect(r.telas[0].costo).toBe(0);
    expect(r.telasSinCosto).toEqual(['SC 64']);
  });

  // Si los metros de falla entraran al costo Y a la pérdida, el mismo desastre
  // se descontaría dos veces de la ganancia.
  it('la falla va a la pérdida, no al costo de la tela', () => {
    const r = calcularCostoOT(
      base({
        optimizador: [{ codInt: 'BK 68', metros: 10, esVertical: false }],
        manual: { fallasTelas: [{ cod: 'BK 68', fallas: 1, mts: 2 }] },
      }),
    );
    expect(r.telas[0].total).toBe(12); // los metros consumidos SÍ son 12
    expect(r.telas[0].costo).toBe(60000); // pero se cobran 10
    expect(r.telas[0].perdida).toBe(12000);
    expect(r.perdidaFallas).toBe(12000);
    expect(r.costoTotal).toBe(60000);
    expect(r.costoConFallas).toBe(72000);
  });

  it('una falla anotada en una tela que no está en el optimizador igual aparece', () => {
    const r = calcularCostoOT(
      base({ manual: { fallasTelas: [{ cod: 'BK 68', fallas: 1, mts: 3 }] } }),
    );
    expect(r.telas.map((t) => t.codInt)).toEqual(['BK 68']);
    expect(r.telas[0].mts).toBe(0);
    expect(r.perdidaFallas).toBe(18000);
  });

  it('los paños de colmena se cuentan sin tocar el costo', () => {
    const r = calcularCostoOT(
      base({
        optimizador: [{ codInt: 'BK 68', metros: 10, esVertical: false }],
        colmena: { p1: { cod: 'BK 68', ancho: 100, alto: 200, ubic: 'A1' } },
      }),
    );
    expect(r.telas[0].panosColmena).toBe(1);
    expect(r.telas[0].costo).toBe(60000);
  });
});

describe('calcularCostoOT — aluminio e insumos', () => {
  it('la merma se pagó igual: se corta de la misma barra', () => {
    const r = calcularCostoOT(
      base({
        aluminio: [{ cod: 'E02', metros: 2, merma: 0.5 }],
        bodega: [{ cod: 'E02', costoIva: 5800 }], // 1.000 el metro con barra de 5,80
      }),
    );
    expect(r.aluminio[0].costo).toBeCloseTo(2500, 6);
    expect(r.totalAluminio).toBeCloseTo(2500, 6);
  });

  it('el aluminio sin costo suma $0 y queda nombrado', () => {
    const r = calcularCostoOT(base({ aluminio: [{ cod: 'E99', metros: 3, merma: 0 }] }));
    expect(r.aluminio[0].costo).toBe(0);
    expect(r.aluminioSinCosto).toEqual(['E99']);
  });

  it('los insumos se cobran por unidad', () => {
    const r = calcularCostoOT(
      base({
        insumos: [
          { id: 1, codigo: 'TAP01', descripcion: 'TAPA', cantidad: 4, grupo: 'INSUMOS' },
          { id: 2, descripcion: 'MANILLA SIN CÓDIGO', cantidad: 2, grupo: 'INSTALACION' },
        ],
        bodega: [{ cod: 'TAP 01', costoIva: 254.66 }],
      }),
    );
    expect(r.insumos[0].costo).toBeCloseTo(1018.64, 6);
    expect(r.insumos[1].costoUnit).toBeNull();
    expect(r.insumosSinCosto).toEqual(['MANILLA SIN CÓDIGO']);
    expect(r.totalInsumos).toBeCloseTo(1018.64, 6);
  });
});

describe('calcularCostoOT — indicadores', () => {
  it('el neto sale del total con IVA y el margen de la ganancia real', () => {
    const r = calcularCostoOT(
      base({
        optimizador: [{ codInt: 'BK 68', metros: 10, esVertical: false }],
        totalConIva: 238000, // neto 200.000
        manual: { manoObra: 30000, auto: 10000, tag: 5000 },
      }),
    );
    expect(r.neto).toBeCloseTo(200000, 6);
    expect(r.costoTotal).toBe(105000);
    expect(r.ganancia).toBeCloseTo(95000, 6);
    expect(r.margen).toBeCloseTo(0.475, 6);
  });

  it('las fallas bajan la ganancia una sola vez', () => {
    const r = calcularCostoOT(
      base({
        optimizador: [{ codInt: 'BK 68', metros: 10, esVertical: false }],
        totalConIva: 238000,
        manual: { fallasTelas: [{ cod: 'BK 68', mts: 5 }] },
      }),
    );
    expect(r.ganancia).toBeCloseTo(140000, 6); // 200.000 − 60.000
    expect(r.perdidaFallas).toBe(30000);
    expect(r.gananciaReal).toBeCloseTo(110000, 6);
    expect(r.gananciaReal).toBeCloseTo(r.neto - r.costoConFallas, 6);
  });

  it('una OT sin total cobrado deja el margen en blanco, no en 0 %', () => {
    expect(calcularCostoOT(base()).margen).toBeNull();
  });
});
