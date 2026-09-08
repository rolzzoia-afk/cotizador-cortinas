import { describe, expect, it } from 'vitest';
import { atajosPorRol, kpisTablero, movimientosDelDia } from './tablero';

const SIN_DATOS = {
  insumos: [],
  telas: [],
  movimientosHoy: [],
  panosTotal: 0,
  panosAlerta: 0,
  tubos: 0,
};

describe('kpisTablero — alertas de insumos', () => {
  it('separa lo que frena el armado de lo que solo avisa', () => {
    const k = kpisTablero({
      ...SIN_DATOS,
      insumos: [
        { cod: 'MEC 28', stock_mp: 0, stock_liberado: 0, minimo: 8 }, // sin stock
        { cod: 'TOP 05', stock_mp: -3, stock_liberado: 0, minimo: 2 }, // negativo
        { cod: 'MEC 18', stock_mp: 21, stock_liberado: 6, minimo: 30 }, // bajo mínimo
        { cod: 'MEC 05', stock_mp: 146, stock_liberado: 32, minimo: 40 }, // bien
        { cod: 'DOM 47', stock_mp: 4, stock_liberado: 0, minimo: 0 }, // sin mínimo
      ],
    });
    expect(k.alertasSinStock).toBe(2); // el negativo también frena
    expect(k.alertasBajoMinimo).toBe(1);
    expect(k.alertas).toBe(3);
  });

  it('un artículo descontinuado no cuenta como alerta aunque esté en cero', () => {
    const k = kpisTablero({
      ...SIN_DATOS,
      insumos: [{ cod: 'E 78', stock_mp: 0, stock_liberado: 0, status: 'DESCONTINUADO' }],
    });
    expect(k.alertas).toBe(0);
  });
});

describe('kpisTablero — telas', () => {
  it('cuenta las que están bajo su mínimo, las que tienen stock y las que no tienen mínimo', () => {
    const k = kpisTablero({
      ...SIN_DATOS,
      telas: [
        { codigo: 'BK 07', stock_mp: 42, stock_liberado: 44.2, stock_minimo: 30 }, // bien
        { codigo: 'BK 41', stock_mp: 18.5, stock_liberado: 0, stock_minimo: 25 }, // bajo
        { codigo: 'BK 90', stock_mp: 0, stock_liberado: 6.8, stock_minimo: 20 }, // bajo
        { codigo: 'VE 21', stock_mp: 0, stock_liberado: 0, stock_minimo: 10 }, // bajo, sin stock
        { codigo: 'SC 12', stock_mp: 22, stock_liberado: 22.6, stock_minimo: null }, // sin mínimo
      ],
    });
    expect(k.telasBajoMinimo).toBe(3);
    expect(k.telasConStock).toBe(4);
    expect(k.telasSinMinimo).toBe(1);
    expect(k.telasTotal).toBe(5);
  });

  // Mínimo 0 es «nadie lo definió», no «el mínimo es cero»: si no, toda tela sin
  // mínimo aparecería como que está bien y nunca se repondría.
  it('mínimo cero es lo mismo que sin mínimo', () => {
    const k = kpisTablero({
      ...SIN_DATOS,
      telas: [{ codigo: 'X', stock_mp: 0, stock_liberado: 0, stock_minimo: 0 }],
    });
    expect(k.telasSinMinimo).toBe(1);
    expect(k.telasBajoMinimo).toBe(0);
  });
});

describe('kpisTablero — movimientos del día', () => {
  it('cuenta entradas y salidas con los tipos que existen de verdad', () => {
    const k = kpisTablero({
      ...SIN_DATOS,
      movimientosHoy: [
        { tipo: 'NUEVO INGRESO' },
        { tipo: 'DEVOLUCION' },
        { tipo: 'SALIDA PRODUCCION' },
        { tipo: 'SALIDA PRODUCCION' },
        { tipo: 'AJUSTE' },
      ],
    });
    expect(k.movimientosHoy).toBe(5);
    expect(k.entradasHoy).toBe(2);
    expect(k.salidasHoy).toBe(2);
    // El ajuste no se suma a ninguno: puede ir para cualquier lado.
    expect(k.entradasHoy + k.salidasHoy).toBe(4);
  });
});

describe('movimientosDelDia — la tabla del tablero', () => {
  const insumo = { id: '1', fecha: '2026-09-08T11:42:00Z', tipo: 'SALIDA PRODUCCION', codigo: 'MEC 18', producto: 'Kit roller 45', almacen: 'LIBERADO', cantidad: 4, ot: '3221' }; // prettier-ignore
  const tela = { id: '2', fecha: '2026-09-08T11:20:00Z', tipo: 'SALIDA PRODUCCION', codigo: 'BK 07', producto: 'Blackout arena', almacen: 'MATERIAS PRIMAS', cantidad: 12.4, ot: '3221' }; // prettier-ignore

  it('junta insumos y telas en una sola lista', () => {
    const filas = movimientosDelDia([insumo], [tela]);
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.dominio)).toEqual(['insumo', 'tela']);
  });

  it('normaliza el almacén de las dos fuentes', () => {
    const filas = movimientosDelDia([insumo], [tela]);
    expect(filas.find((f) => f.codigo === 'MEC 18')?.almacen).toBe('LIB');
    expect(filas.find((f) => f.codigo === 'BK 07')?.almacen).toBe('MP');
  });

  it('la tela lleva su unidad en metros y el insumo no', () => {
    const filas = movimientosDelDia([insumo], [tela]);
    expect(filas.find((f) => f.dominio === 'tela')?.unidad).toBe('m');
    expect(filas.find((f) => f.dominio === 'insumo')?.unidad).toBe('');
  });

  it('muestra primero lo más reciente y corta en el límite', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => ({
      ...insumo,
      id: `m${i}`,
      fecha: `2026-09-08T${String(8 + i).padStart(2, '0')}:00:00Z`,
    }));
    const filas = movimientosDelDia(muchos, [], 5);
    expect(filas).toHaveLength(5);
    expect(filas[0].hora > filas[4].hora).toBe(true);
  });

  it('una fila sin fecha o sin código no rompe la tabla', () => {
    const filas = movimientosDelDia([{ id: 'x', tipo: 'AJUSTE' }], []);
    expect(filas[0].hora).toBe('—');
    expect(filas[0].codigo).toBe('—');
    expect(filas[0].cantidad).toBe(0);
  });
});

describe('atajosPorRol', () => {
  it('el bodeguero ve los suyos y no el del optimizador', () => {
    const ids = atajosPorRol('bodeguero').map((a) => a.id);
    expect(ids).toContain('despachar');
    expect(ids).toContain('ingreso');
    expect(ids).not.toContain('optimizador');
  });

  it('producción ve el optimizador pero no el despacho', () => {
    const ids = atajosPorRol('produccion').map((a) => a.id);
    expect(ids).toContain('optimizador');
    expect(ids).not.toContain('despachar');
  });

  it('ventas solo ve el de descontar tela', () => {
    expect(atajosPorRol('ventas').map((a) => a.id)).toEqual(['tela']);
  });

  it('el admin los ve todos y un rol vacío no ve ninguno', () => {
    expect(atajosPorRol('admin')).toHaveLength(4);
    expect(atajosPorRol('superadmin')).toHaveLength(4);
    expect(atajosPorRol('')).toEqual([]);
    expect(atajosPorRol(null)).toEqual([]);
  });
});
