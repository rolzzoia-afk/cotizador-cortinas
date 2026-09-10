import { describe, expect, it } from 'vitest';
import {
  cantidadDe,
  columnaDelAlmacen,
  filaMovimiento,
  problemaDelMovimiento,
  stockDespues,
} from './movimientos';
import type { Insumo } from './helpers';

const INSUMO = {
  id: 'i1',
  cod: 'MEC 18',
  nemotecnico: 'Kit roller 45 mm blanco',
  descriptor_proveedor: null,
  categoria: 'Mecanismos',
  sub_categoria: 'Roller',
  proveedor: 'Chantilly',
  producto: null,
  compra: null,
  cod_proveedor: 'CH-4518',
  color: null,
  minimo: 30,
  can_x_paquete: 10,
  costo: 8190,
  costo_iva: null,
  ubicacion: 'R3-Q-5',
  stock_mp: 21,
  stock_liberado: 6,
  stock_total: 27,
  estado_inventario: 'ACTIVO',
  status: null,
  foto_url: null,
  comentarios: null,
} satisfies Insumo;

const ENTRADA = {
  tipo: 'SALIDA PRODUCCION',
  codigo: 'MEC 18',
  cantidad: '4',
  almacen: 'LIBERADO' as const,
  ot: ' 3221 ',
  responsable_entrega: 'Marcelo',
};

describe('problemaDelMovimiento', () => {
  it('sin insumo no se guarda', () => {
    expect(problemaDelMovimiento({ ...ENTRADA, codigo: '  ' })).toBe('Selecciona un insumo');
  });

  it('la cantidad tiene que ser mayor a 0', () => {
    expect(problemaDelMovimiento({ ...ENTRADA, cantidad: '0' })).toContain('mayor a 0');
    expect(problemaDelMovimiento({ ...ENTRADA, cantidad: '-2' })).toContain('mayor a 0');
    expect(problemaDelMovimiento({ ...ENTRADA, cantidad: 'tres' })).toContain('mayor a 0');
  });

  it('un movimiento completo se puede guardar', () => {
    expect(problemaDelMovimiento(ENTRADA)).toBeNull();
  });
});

describe('cantidadDe — la cantidad es entera', () => {
  // La columna es INTEGER: 2,5 unidades no existe y se guardaría truncado.
  it('trunca los decimales', () => {
    expect(cantidadDe({ cantidad: '2.9' })).toBe(2);
  });

  it('lo que no es número es 0', () => {
    expect(cantidadDe({ cantidad: '' })).toBe(0);
    expect(cantidadDe({ cantidad: 'abc' })).toBe(0);
  });
});

describe('columnaDelAlmacen', () => {
  it('cada almacén tiene su columna', () => {
    expect(columnaDelAlmacen('MP')).toBe('stock_mp');
    expect(columnaDelAlmacen('LIBERADO')).toBe('stock_liberado');
  });
});

describe('stockDespues', () => {
  it('una salida resta del almacén que le toca', () => {
    const r = stockDespues(INSUMO, ENTRADA);
    expect(r.campo).toBe('stock_liberado');
    expect(r.valor).toBe(2);
    expect(r.recortado).toBe(false);
  });

  it('una entrada suma', () => {
    expect(stockDespues(INSUMO, { ...ENTRADA, tipo: 'NUEVO INGRESO', almacen: 'MP' }).valor).toBe(
      25,
    );
  });

  it('una devolución suma', () => {
    expect(stockDespues(INSUMO, { ...ENTRADA, tipo: 'DEVOLUCION' }).valor).toBe(10);
  });

  // Así funciona hoy: si sacan más de lo que hay, el sobrante se pierde. Se
  // avisa (`recortado`) en vez de dejarlo pasar callado.
  it('sacar más de lo que hay deja el stock en 0 y lo marca', () => {
    const r = stockDespues(INSUMO, { ...ENTRADA, cantidad: '10' });
    expect(r.valor).toBe(0);
    expect(r.sinRecortar).toBe(-4);
    expect(r.recortado).toBe(true);
  });

  it('un ajuste se trata como salida: es como está hoy', () => {
    expect(stockDespues(INSUMO, { ...ENTRADA, tipo: 'AJUSTE' }).valor).toBe(2);
  });
});

describe('filaMovimiento', () => {
  const ahora = new Date(2026, 8, 8, 12, 0, 0);

  it('arma la fila con el nombre del insumo y el mes en texto', () => {
    const f = filaMovimiento(ENTRADA, INSUMO, 'e1', ahora);
    expect(f.empresa_id).toBe('e1');
    expect(f.codigo).toBe('MEC 18');
    expect(f.producto).toBe('Kit roller 45 mm blanco');
    expect(f.mes).toBe('SEPTIEMBRE');
    expect(f.cantidad).toBe(4);
  });

  it('la OT viaja sin los espacios de los costados', () => {
    expect(filaMovimiento(ENTRADA, INSUMO, 'e1', ahora).ot).toBe('3221');
  });

  it('los campos vacíos van nulos, no como texto vacío', () => {
    const f = filaMovimiento({ ...ENTRADA, ot: '   ', bitacora: '' }, INSUMO, 'e1', ahora);
    expect(f.ot).toBeNull();
    expect(f.bitacora).toBeNull();
  });

  it('sin insumo cargado no inventa el nombre', () => {
    expect(filaMovimiento(ENTRADA, undefined, 'e1', ahora).producto).toBe('');
  });
});
