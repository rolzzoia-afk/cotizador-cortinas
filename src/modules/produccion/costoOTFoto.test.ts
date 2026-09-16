import { describe, expect, it } from 'vitest';
import { calcularCostoOT, type EntradaCostoOT } from './costoOT';
import { fotoCostoOT, fotoDesactualizada, type FotoGuardada, type LineaFotoCosto } from './costoOTFoto';
import type { CatalogoProductos } from '@/modules/cotizador/types';

const CAT: CatalogoProductos = {
  'BK 68': { cod: 'BLACKOUT_D', producto: 'ROLLER BK DELUX', tipo: 'DELUX', descripcion: 'X', precio: 23782, costo: 12990 },
  'SC 64': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN', tipo: 'PREMIUM', descripcion: 'Y', precio: 21786 },
};

const entrada = (extra: Partial<EntradaCostoOT> = {}): EntradaCostoOT => ({
  optimizador: [
    { codInt: 'BK 68', metros: 4.4, esVertical: false },
    { codInt: 'SC 64', metros: 4.2, esVertical: false },
  ],
  catalogo: CAT,
  aluminio: [
    { cod: 'E02', metros: 18.255, merma: 0 },
    { cod: 'E39', metros: 8.83, merma: 0.321 },
    { cod: 'E99', metros: 1, merma: 0 },
  ],
  insumos: [
    { id: 1, codigo: 'TOP03', descripcion: '[TOP03] TOPE', cantidad: 4, grupo: 'INSUMOS' },
    { id: 2, descripcion: 'MANILLA', cantidad: 2, grupo: 'ESTRUCTURA' },
  ],
  precioCalculo: {},
  bodega: [
    { cod: 'E02', costoIva: 16065 },
    { cod: 'E39', costoIva: 8282.4 },
    { cod: 'TOP03', costoIva: 60 },
  ],
  totalConIva: 1_361_586.5,
  iva: 0.19,
  manual: { manoObra: 100_000, tag: 3_500, fallasTelas: [{ cod: 'BK 68', fallas: 1, mts: 1.2 }] },
  ...extra,
});

/** Las cuentas de `ot_costo_guardar`, escritas igual que en el SQL. */
function cuentaDeLaBase(lineas: LineaFotoCosto[], manual: Record<string, unknown>, totalConIva: number, iva: number) {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  let telas = 0;
  let aluminio = 0;
  let insumos = 0;
  let perdida = 0;
  for (const l of lineas) {
    const u = l.costo_unitario ?? 0;
    if (l.tipo === 'tela') {
      telas += l.cantidad * u;
      perdida += l.merma * u;
    } else if (l.tipo === 'aluminio') aluminio += (l.cantidad + l.merma) * u;
    else insumos += l.cantidad * u;
  }
  const costo = telas + aluminio + insumos + n(manual.manoObra) + n(manual.auto) + n(manual.tag) + n(manual.otros);
  const neto = totalConIva / (1 + iva);
  return { costoConFallas: costo + perdida, gananciaReal: neto - costo - perdida };
}

describe('fotoCostoOT', () => {
  it('la base llega al mismo número que la pantalla', () => {
    const e = entrada();
    const costo = calcularCostoOT(e);
    const foto = fotoCostoOT(costo, e.manual!);
    const base = cuentaDeLaBase(foto.lineas, foto.manual, e.totalConIva, e.iva);
    expect(base.costoConFallas).toBeCloseTo(foto.esperado.costoConFallas, 6);
    expect(base.gananciaReal).toBeCloseTo(foto.esperado.gananciaReal, 6);
    expect(foto.esperado.costoConFallas).toBeCloseTo(costo.costoConFallas, 6);
  });

  it('una línea por tela, perfil e insumo, con unidad y origen del costo', () => {
    const costo = calcularCostoOT(entrada());
    const foto = fotoCostoOT(costo, entrada().manual!);
    expect(foto.lineas.map((l) => `${l.tipo}:${l.codigo}`)).toEqual([
      'tela:BK 68',
      'tela:SC 64',
      'aluminio:E02',
      'aluminio:E39',
      'aluminio:E99',
      'insumo:TOP03',
      'insumo:null',
    ]);
    const bk = foto.lineas[0];
    expect(bk).toMatchObject({ unidad: 'm', cantidad: 4.4, merma: 1.2, fallas: 1, costo_unitario: 12990, fuente: 'propio' });
    const e39 = foto.lineas[3];
    expect(e39).toMatchObject({ unidad: 'm', merma: 0.321, fuente: 'bodega' });
    expect(e39.costo_unitario).toBeCloseTo(8282.4 / 5.8, 6);
    expect(e39.referencia).toContain('la barra');
    expect(foto.lineas[5]).toMatchObject({ unidad: 'u', cantidad: 4, costo_unitario: 60 });
  });

  it('lo que no tiene costo va en null y queda nombrado', () => {
    const foto = fotoCostoOT(calcularCostoOT(entrada()), {});
    expect(foto.lineas[1]).toMatchObject({ codigo: 'SC 64', costo_unitario: null, fuente: null });
    expect(foto.sinCosto.telas).toEqual(['SC 64']);
    expect(foto.sinCosto.aluminio).toEqual(['E99']);
    expect(foto.sinCosto.insumos).toEqual(['MANILLA']);
  });

  it('el largo de la barra se escribe aunque nadie lo haya tocado', () => {
    const costo = calcularCostoOT(entrada());
    expect(fotoCostoOT(costo, { manoObra: 1 }).manual).toEqual({ manoObra: 1, largoBarraM: 5.8 });
    expect(fotoCostoOT(costo, { largoBarraM: 5.98 }).manual.largoBarraM).toBe(5.98);
    expect(fotoCostoOT(costo, { largoBarraM: 0 }).manual.largoBarraM).toBe(5.8);
  });
});

describe('fotoDesactualizada', () => {
  const costo = calcularCostoOT(entrada());
  const guardada: FotoGuardada = {
    version: 1,
    guardado_at: '2026-09-16T18:00:00Z',
    guardado_por: 'p1',
    costo_con_fallas: Math.round(costo.costoConFallas * 100) / 100,
    ganancia_real: Math.round(costo.gananciaReal * 100) / 100,
    cobrado_neto: Math.round(costo.neto * 100) / 100,
  };

  it('sin foto hay que guardar', () => {
    expect(fotoDesactualizada(null, costo)).toBe(true);
  });

  it('igual salvo el redondeo de la base: al día', () => {
    expect(fotoDesactualizada(guardada, costo)).toBe(false);
  });

  it('cambió el costo o lo cobrado: desactualizada', () => {
    const conMasAluminio = calcularCostoOT(entrada({ aluminio: [{ cod: 'E02', metros: 30, merma: 0 }] }));
    expect(fotoDesactualizada(guardada, conMasAluminio)).toBe(true);
    const otroTotal = calcularCostoOT(entrada({ totalConIva: 1_400_000 }));
    expect(fotoDesactualizada(guardada, otroTotal)).toBe(true);
  });
});
