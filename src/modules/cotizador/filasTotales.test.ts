import { describe, it, expect } from 'vitest';
import { FILAS_TOTALES, NOTA_IVA } from './filasTotales';
import { calcularTotales } from './preciosFase0';

describe('las filas del recuadro de totales', () => {
  const t = calcularTotales(760_646);
  const labels = FILAS_TOTALES.map((f) => f.label);

  it('muestra solo los dos montos que paga el cliente', () => {
    expect(labels).toEqual(['Total transferencia', 'Total tarjeta crédito']);
  });

  it('no desglosa el IVA, el subtotal ni el abono', () => {
    const texto = labels.join(' | ').toLowerCase();
    expect(texto).not.toContain('iva');
    expect(texto).not.toContain('abono');
    expect(texto).not.toContain('subtotal');
  });

  it('avisa que el IVA va incluido en los montos mostrados', () => {
    expect(NOTA_IVA).toBe('Todos los precios incluyen IVA.');
  });

  it('toma los montos del cálculo real, sin recalcular nada', () => {
    const porId = Object.fromEntries(FILAS_TOTALES.map((f) => [f.id, f.valor(t)]));
    expect(porId.transferencia).toBe(t.totalTransferencia);
    expect(porId.tarjeta).toBe(t.totalTarjeta);
    // Los montos mostrados YA traen el IVA dentro (por eso la nota).
    expect(porId.transferencia).toBeGreaterThan(t.subtotalNeto);
  });

  it('destaca la transferencia y separa la tarjeta con una línea', () => {
    const transferencia = FILAS_TOTALES.find((f) => f.id === 'transferencia');
    const tarjeta = FILAS_TOTALES.find((f) => f.id === 'tarjeta');
    expect(transferencia?.fuerte).toBe(true);
    expect(tarjeta?.separadorAntes).toBe(true);
  });
});
