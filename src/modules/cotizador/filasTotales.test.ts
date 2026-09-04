import { describe, it, expect } from 'vitest';
import { FILAS_TOTALES, NOTA_IVA } from './filasTotales';
import { calcularTotales } from './preciosFase0';

describe('las filas del recuadro de totales', () => {
  const t = calcularTotales(760_646);
  const labels = FILAS_TOTALES.map((f) => f.label);

  it('muestra los dos montos que paga el cliente y, en chico, el neto', () => {
    expect(labels).toEqual(['Total transferencia', 'Total sin IVA', 'Total tarjeta crédito']);
  });

  it('el neto va pegado bajo la transferencia, que es de donde sale', () => {
    const iTransf = FILAS_TOTALES.findIndex((f) => f.id === 'transferencia');
    expect(FILAS_TOTALES.findIndex((f) => f.id === 'neto')).toBe(iTransf + 1);
  });

  it('no desglosa el IVA como línea aparte, ni el abono, ni un «subtotal»', () => {
    const texto = labels.join(' | ').toLowerCase();
    expect(texto).not.toContain('iva 19');
    expect(texto).not.toContain('19%');
    expect(texto).not.toContain('abono');
    expect(texto).not.toContain('subtotal');
    // La única mención al IVA es la del neto: «sin IVA», no un desglose.
    expect(labels.filter((l) => /iva/i.test(l))).toEqual(['Total sin IVA']);
  });

  it('avisa que el IVA va incluido en los montos mostrados', () => {
    expect(NOTA_IVA).toBe('Todos los precios incluyen IVA.');
  });

  it('toma los montos del cálculo real, sin recalcular nada', () => {
    const porId = Object.fromEntries(FILAS_TOTALES.map((f) => [f.id, f.valor(t)]));
    expect(porId.transferencia).toBe(t.totalTransferencia);
    expect(porId.tarjeta).toBe(t.totalTarjeta);
    // El neto es la MISMA base de los valores unitarios de la tabla.
    expect(porId.neto).toBe(t.subtotalNeto);
    // Los dos montos grandes YA traen el IVA dentro (por eso la nota).
    expect(porId.transferencia).toBeGreaterThan(porId.neto);
  });

  it('destaca la transferencia, achica el neto y separa la tarjeta con una línea', () => {
    const transferencia = FILAS_TOTALES.find((f) => f.id === 'transferencia');
    const neto = FILAS_TOTALES.find((f) => f.id === 'neto');
    const tarjeta = FILAS_TOTALES.find((f) => f.id === 'tarjeta');
    expect(transferencia?.fuerte).toBe(true);
    expect(neto?.tenue).toBe(true);
    expect(neto?.fuerte).toBeFalsy();
    expect(tarjeta?.separadorAntes).toBe(true);
    // Un solo monto grande y una sola línea chica: si no, el recuadro deja de
    // tener un precio que el cliente mire primero.
    expect(FILAS_TOTALES.filter((f) => f.fuerte)).toHaveLength(1);
    expect(FILAS_TOTALES.filter((f) => f.tenue)).toHaveLength(1);
  });
});
