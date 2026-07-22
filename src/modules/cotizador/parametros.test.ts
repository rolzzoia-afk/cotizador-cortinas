// Tests de los parámetros comerciales configurables por empresa.
// Garantizan que: (1) los defaults reproducen el comportamiento histórico,
// (2) datos corruptos en la BD nunca rompen el cotizador, y (3) el motor
// usa de verdad los parámetros custom.
import { describe, expect, it } from 'vitest';
import {
  IVA,
  MARGEN_INSUMO,
  RECARGO_TARJETA,
  RECARGO_TARJETA_FLOW,
  PARAMETROS_DEFAULT,
  calcularTotales,
  normalizarParametros,
  precioVentaInsumo,
  recargoTarjetaEfectivo,
} from './preciosFase0';

describe('normalizarParametros', () => {
  it('null/garbage → defaults completos', () => {
    expect(normalizarParametros(null)).toEqual(PARAMETROS_DEFAULT);
    expect(normalizarParametros('basura')).toEqual(PARAMETROS_DEFAULT);
    expect(normalizarParametros(42)).toEqual(PARAMETROS_DEFAULT);
    expect(normalizarParametros({})).toEqual(PARAMETROS_DEFAULT);
  });

  it('toma solo los campos numéricos válidos y completa el resto', () => {
    const out = normalizarParametros({ iva: 0.21, traslado: 60000, manoObraRoller: 'veinte' });
    expect(out.iva).toBe(0.21);
    expect(out.traslado).toBe(60000);
    expect(out.manoObraRoller).toBe(PARAMETROS_DEFAULT.manoObraRoller); // string inválido
    expect(out.margenInsumo).toBe(PARAMETROS_DEFAULT.margenInsumo);
  });

  it('rechaza negativos, NaN e Infinity', () => {
    const out = normalizarParametros({ iva: -1, traslado: NaN, instalacionRoller: Infinity });
    expect(out.iva).toBe(PARAMETROS_DEFAULT.iva);
    expect(out.traslado).toBe(PARAMETROS_DEFAULT.traslado);
    expect(out.instalacionRoller).toBe(PARAMETROS_DEFAULT.instalacionRoller);
  });

  it('margenInsumo = 0 no puede pasar (división por cero)', () => {
    const out = normalizarParametros({ margenInsumo: 0 });
    expect(out.margenInsumo).toBe(PARAMETROS_DEFAULT.margenInsumo);
  });

  it('campos extra desconocidos se ignoran', () => {
    const out = normalizarParametros({ hacker: 999, iva: 0.19 });
    expect((out as Record<string, unknown>).hacker).toBeUndefined();
  });

  it('proveedorTarjeta: conserva "flow", cualquier otra cosa → mercadopago', () => {
    expect(normalizarParametros({ proveedorTarjeta: 'flow' }).proveedorTarjeta).toBe('flow');
    expect(normalizarParametros({}).proveedorTarjeta).toBe('mercadopago');
    expect(normalizarParametros({ proveedorTarjeta: 'webpay' }).proveedorTarjeta).toBe('mercadopago');
    expect(normalizarParametros({ proveedorTarjeta: 42 }).proveedorTarjeta).toBe('mercadopago');
  });

  it('recargoTarjetaFlow: numérico se conserva, inválido cae al default', () => {
    expect(normalizarParametros({ recargoTarjetaFlow: 0.05 }).recargoTarjetaFlow).toBe(0.05);
    expect(normalizarParametros({ recargoTarjetaFlow: 'x' }).recargoTarjetaFlow).toBe(
      RECARGO_TARJETA_FLOW,
    );
  });

  it('parámetros de corte: defaults históricos presentes', () => {
    expect(PARAMETROS_DEFAULT.extraAltoCm).toBe(25);
    expect(PARAMETROS_DEFAULT.extraDuoCm).toBe(30);
    expect(PARAMETROS_DEFAULT.extraMesaDuoCm).toBe(10);
    expect(PARAMETROS_DEFAULT.extraVerticalCm).toBe(5);
    expect(PARAMETROS_DEFAULT.dctoAltoFinalVerticalCm).toBe(13);
    expect(PARAMETROS_DEFAULT.descAnchoCorteCm).toBe(3.5);
    expect(PARAMETROS_DEFAULT.anchoRolloDefaultM).toBe(2.98);
    expect(PARAMETROS_DEFAULT.anchoRolloPlanCm).toBe(300);
    expect(PARAMETROS_DEFAULT.colmenaMinAnchoCm).toBe(120);
    expect(PARAMETROS_DEFAULT.colmenaMinAltoCm).toBe(180);
    expect(PARAMETROS_DEFAULT.diasAlertaColmena).toBe(90);
  });

  it('parámetros de corte: custom válidos se conservan, garbage cae al default', () => {
    const out = normalizarParametros({ extraDuoCm: 35, ventanaAltoCm: 'x', bordeCm: -2 });
    expect(out.extraDuoCm).toBe(35);
    expect(out.ventanaAltoCm).toBe(PARAMETROS_DEFAULT.ventanaAltoCm);
    expect(out.bordeCm).toBe(PARAMETROS_DEFAULT.bordeCm);
  });

  it('clamps de corte: rollo 0 y plan ≤ 2×margen caen a defaults; días se redondean', () => {
    expect(normalizarParametros({ anchoRolloDefaultM: 0 }).anchoRolloDefaultM).toBe(
      PARAMETROS_DEFAULT.anchoRolloDefaultM,
    );
    const out = normalizarParametros({ anchoRolloPlanCm: 8, margenRolloCm: 5 });
    expect(out.anchoRolloPlanCm).toBe(PARAMETROS_DEFAULT.anchoRolloPlanCm);
    expect(out.margenRolloCm).toBe(PARAMETROS_DEFAULT.margenRolloCm);
    expect(normalizarParametros({ diasAlertaColmena: 90.7 }).diasAlertaColmena).toBe(91);
  });
});

describe('recargoTarjetaEfectivo', () => {
  it('mercadopago (default) usa recargoTarjeta; flow usa recargoTarjetaFlow', () => {
    expect(recargoTarjetaEfectivo(PARAMETROS_DEFAULT)).toBe(RECARGO_TARJETA);
    expect(
      recargoTarjetaEfectivo({ ...PARAMETROS_DEFAULT, proveedorTarjeta: 'flow' }),
    ).toBe(RECARGO_TARJETA_FLOW);
  });
});

describe('calcularTotales con parámetros custom', () => {
  it('sin opts reproduce el comportamiento histórico', () => {
    const t = calcularTotales(100000);
    expect(t.ivaTransferencia).toBeCloseTo(100000 * IVA, 5);
    expect(t.subtotalTarjeta).toBeCloseTo(100000 * (1 + RECARGO_TARJETA), 5);
    expect(t.abono50).toBeCloseTo(t.totalTransferencia / 2, 5);
  });

  it('IVA y recargo custom cambian los totales', () => {
    const t = calcularTotales(100000, { iva: 0.1, recargoTarjeta: 0.05 });
    expect(t.ivaTransferencia).toBeCloseTo(10000, 5);
    expect(t.totalTransferencia).toBeCloseTo(110000, 5);
    expect(t.subtotalTarjeta).toBeCloseTo(105000, 5);
    expect(t.ivaTarjeta).toBeCloseTo(10500, 5);
    expect(t.totalTarjeta).toBeCloseTo(115500, 5);
  });
});

describe('precioVentaInsumo con margen custom', () => {
  it('default usa MARGEN_INSUMO histórico', () => {
    expect(precioVentaInsumo('CAD 03')).toBeCloseTo(1190 / MARGEN_INSUMO, 5);
  });
  it('margen custom cambia el precio de venta', () => {
    expect(precioVentaInsumo('CAD 03', 0.5)).toBeCloseTo(2380, 5);
  });
  it('insumo desconocido → 0', () => {
    expect(precioVentaInsumo('NO-EXISTE')).toBe(0);
  });
});
