import { describe, it, expect } from 'vitest';
import { FILAS_TOTALES, rotuloIva } from './filasTotales';
import { calcularTotales } from './preciosFase0';

describe('las filas del recuadro de totales', () => {
  const t = calcularTotales(760_646);
  const labels = FILAS_TOTALES.map((f) => f.label(t));

  it('replica el desglose de la planilla: cada forma de pago con su subtotal, su IVA y su total', () => {
    expect(labels).toEqual([
      'Subtotal pago tarjeta d.c.',
      'IVA 19%',
      'Tot. tarjeta de crédito',
      'Subtotal pago transf.',
      'IVA 19%',
      'Total pago transf.',
    ]);
  });

  it('el orden es el del Excel: primero el bloque de la tarjeta, después el de la transferencia', () => {
    const ids = FILAS_TOTALES.map((f) => f.id);
    expect(ids).toEqual([
      'tarjetaSubtotal',
      'tarjetaIva',
      'tarjeta',
      'transferenciaSubtotal',
      'transferenciaIva',
      'transferencia',
    ]);
  });

  it('no imprime el abono inicial: `calcularTotales` lo sigue calculando, pero no se muestra', () => {
    expect(labels.join(' | ').toLowerCase()).not.toContain('abono');
  });

  it('toma los montos del cálculo real, sin recalcular nada', () => {
    const porId = Object.fromEntries(FILAS_TOTALES.map((f) => [f.id, f.valor(t)]));
    expect(porId.tarjetaSubtotal).toBe(t.subtotalTarjeta);
    expect(porId.tarjetaIva).toBe(t.ivaTarjeta);
    expect(porId.tarjeta).toBe(t.totalTarjeta);
    expect(porId.transferenciaSubtotal).toBe(t.subtotalNeto);
    expect(porId.transferenciaIva).toBe(t.ivaTransferencia);
    expect(porId.transferencia).toBe(t.totalTransferencia);
  });

  it('cada bloque cuadra: subtotal + IVA = total', () => {
    const v = Object.fromEntries(FILAS_TOTALES.map((f) => [f.id, f.valor(t)]));
    expect(v.tarjetaSubtotal + v.tarjetaIva).toBeCloseTo(v.tarjeta, 6);
    expect(v.transferenciaSubtotal + v.transferenciaIva).toBeCloseTo(v.transferencia, 6);
  });

  it('el subtotal de transferencia ES el neto: la misma base de la columna TOTAL de la tabla', () => {
    const neto = FILAS_TOTALES.find((f) => f.id === 'transferenciaSubtotal');
    expect(neto?.valor(t)).toBe(760_646);
  });

  it('destaca los dos totales y separa los bloques con una línea', () => {
    expect(FILAS_TOTALES.filter((f) => f.fuerte).map((f) => f.id)).toEqual([
      'tarjeta',
      'transferencia',
    ]);
    // Una sola línea divisoria: la que abre el bloque de la transferencia.
    expect(FILAS_TOTALES.filter((f) => f.separadorAntes).map((f) => f.id)).toEqual([
      'transferenciaSubtotal',
    ]);
  });

  it('la leyenda de cuotas cuelga del total con TARJETA, que es la que la explica', () => {
    const conLeyenda = FILAS_TOTALES.filter((f) => f.llevaLeyendaCuotas);
    expect(conLeyenda.map((f) => f.id)).toEqual(['tarjeta']);
  });
});

describe('rotuloIva — el % sale del cálculo, no de un 19 escrito a mano', () => {
  it('usa la tasa real de la empresa', () => {
    expect(rotuloIva(0.19)).toBe('IVA 19%');
    expect(rotuloIva(0.1)).toBe('IVA 10%');
  });

  it('una tasa con decimales se muestra con coma, como el resto de la app (es-CL)', () => {
    expect(rotuloIva(0.125)).toBe('IVA 12,5%');
  });

  it('el recuadro rotula la tasa con la que de verdad se calculó', () => {
    const t = calcularTotales(100_000, { iva: 0.1 });
    const fila = FILAS_TOTALES.find((f) => f.id === 'transferenciaIva');
    expect(fila?.label(t)).toBe('IVA 10%');
    expect(fila?.valor(t)).toBeCloseTo(10_000, 6);
  });
});
