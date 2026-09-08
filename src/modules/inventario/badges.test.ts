import { describe, expect, it } from 'vitest';
import {
  badgeEstadoArticulo,
  badgeTipoMovimiento,
  esMovimientoEntrada,
  esMovimientoSalida,
  estadoArticulo,
  estadoPideAtencion,
  tipoMovimientoCanonico,
} from './badges';

describe('tipo de movimiento — los cuatro tipos que hay hoy en la base', () => {
  it('traduce los rótulos viejos a los del kardex', () => {
    expect(tipoMovimientoCanonico('NUEVO INGRESO')).toBe('INGRESO');
    expect(tipoMovimientoCanonico('SALIDA PRODUCCION')).toBe('SALIDA');
    expect(tipoMovimientoCanonico('AJUSTE')).toBe('AJUSTE');
    expect(tipoMovimientoCanonico('DEVOLUCION')).toBe('DEVOLUCION');
  });

  it('da igual cómo venga escrito', () => {
    for (const t of ['nuevo ingreso', ' NUEVO INGRESO ', 'Nuevo Ingreso']) {
      expect(tipoMovimientoCanonico(t), t).toBe('INGRESO');
    }
    expect(tipoMovimientoCanonico('salida producción')).toBe('SALIDA');
    expect(tipoMovimientoCanonico('devolución')).toBe('DEVOLUCION');
  });

  it('los tipos nuevos del kardex pasan derecho', () => {
    for (const t of ['INGRESO', 'SALIDA', 'TRASLADO', 'MERMA', 'CONTEO', 'CORTE', 'SOBRANTE']) {
      expect(tipoMovimientoCanonico(t), t).toBe(t);
    }
  });

  it('lo que no reconoce lo dice, no lo adivina', () => {
    for (const t of ['', '   ', null, undefined, 'PEDIDO REPOSICION', 'LO QUE SEA']) {
      expect(tipoMovimientoCanonico(t), String(t)).toBeUndefined();
    }
  });
});

describe('badgeTipoMovimiento — los colores de la lámina', () => {
  it('pinta cada tipo con su color', () => {
    expect(badgeTipoMovimiento('NUEVO INGRESO')).toEqual({
      texto: 'Ingreso',
      variante: 'success',
    });
    expect(badgeTipoMovimiento('SALIDA PRODUCCION')).toEqual({
      texto: 'Salida',
      variante: 'destructive',
    });
    expect(badgeTipoMovimiento('TRASLADO')).toEqual({ texto: 'Traslado', variante: 'accent' });
    expect(badgeTipoMovimiento('AJUSTE')).toEqual({ texto: 'Ajuste', variante: 'warning' });
    expect(badgeTipoMovimiento('MERMA')).toEqual({ texto: 'Merma', variante: 'default' });
    expect(badgeTipoMovimiento('CORTE')).toEqual({ texto: 'Corte', variante: 'muted' });
  });

  // Un tipo raro se muestra tal cual: si un día alguien inventa un tipo nuevo,
  // que se vea, no que se disfrace de otro.
  it('un tipo desconocido se muestra tal cual y en gris', () => {
    expect(badgeTipoMovimiento('PEDIDO REPOSICION')).toEqual({
      texto: 'PEDIDO REPOSICION',
      variante: 'muted',
    });
    expect(badgeTipoMovimiento(null)).toEqual({ texto: '—', variante: 'muted' });
  });
});

describe('entradas y salidas — el KPI del día', () => {
  it('suman el ingreso y la devolución', () => {
    expect(esMovimientoEntrada('NUEVO INGRESO')).toBe(true);
    expect(esMovimientoEntrada('DEVOLUCION')).toBe(true);
    expect(esMovimientoEntrada('SALIDA PRODUCCION')).toBe(false);
  });

  it('restan la salida y la merma', () => {
    expect(esMovimientoSalida('SALIDA PRODUCCION')).toBe(true);
    expect(esMovimientoSalida('MERMA')).toBe(true);
  });

  // El ajuste puede ir para arriba o para abajo: no se cuenta en ninguno de los
  // dos lados, para que la suma del KPI no mienta.
  it('el ajuste y el traslado no son ni entrada ni salida', () => {
    for (const t of ['AJUSTE', 'TRASLADO', 'CONTEO']) {
      expect(esMovimientoEntrada(t), t).toBe(false);
      expect(esMovimientoSalida(t), t).toBe(false);
    }
  });
});

describe('estado del artículo', () => {
  it('descontinuado gana a todo, incluso con stock', () => {
    expect(estadoArticulo({ total: 50, minimo: 10, status: 'DESCONTINUADO' })).toBe(
      'descontinuado',
    );
    expect(estadoArticulo({ total: 0, status: 'DESCONTINUADO' })).toBe('descontinuado');
  });

  it('el saldo negativo se llama por su nombre', () => {
    expect(estadoArticulo({ total: -3, minimo: 2 })).toBe('negativo');
  });

  it('cero es sin stock, aunque tenga mínimo', () => {
    expect(estadoArticulo({ total: 0, minimo: 8 })).toBe('sin_stock');
    expect(estadoArticulo({ total: 0 })).toBe('sin_stock');
  });

  it('bajo el mínimo avisa; justo en el mínimo, no', () => {
    expect(estadoArticulo({ total: 27, minimo: 30 })).toBe('bajo_minimo');
    expect(estadoArticulo({ total: 30, minimo: 30 })).toBe('con_stock');
    expect(estadoArticulo({ total: 31, minimo: 30 })).toBe('con_stock');
  });

  // Mínimo 0 o vacío NO es «el mínimo es cero»: es que nadie lo definió. Son 418
  // artículos en producción que nunca van a avisar, y el tablero lo dice.
  it('sin mínimo definido no es lo mismo que mínimo cero', () => {
    expect(estadoArticulo({ total: 4, minimo: 0 })).toBe('sin_minimo');
    expect(estadoArticulo({ total: 4, minimo: null })).toBe('sin_minimo');
    expect(estadoArticulo({ total: 4 })).toBe('sin_minimo');
  });

  it('un total nulo se trata como cero', () => {
    expect(estadoArticulo({ total: null })).toBe('sin_stock');
    expect(estadoArticulo({ total: undefined })).toBe('sin_stock');
  });

  it('el badge dice lo mismo que el estado', () => {
    expect(badgeEstadoArticulo({ total: -3 })).toEqual({
      texto: 'Negativo',
      variante: 'destructive',
    });
    expect(badgeEstadoArticulo({ total: 27, minimo: 30 })).toEqual({
      texto: 'Bajo mínimo',
      variante: 'warning',
    });
    expect(badgeEstadoArticulo({ total: 178, minimo: 40 })).toEqual({
      texto: 'Con stock',
      variante: 'success',
    });
  });
});

describe('estadoPideAtencion — qué entra al contador de alertas', () => {
  it('cuenta el negativo, el sin stock y el bajo mínimo', () => {
    expect(estadoPideAtencion('negativo')).toBe(true);
    expect(estadoPideAtencion('sin_stock')).toBe(true);
    expect(estadoPideAtencion('bajo_minimo')).toBe(true);
  });

  it('no cuenta lo que está bien ni lo que ya nadie repone', () => {
    expect(estadoPideAtencion('con_stock')).toBe(false);
    expect(estadoPideAtencion('sin_minimo')).toBe(false);
    expect(estadoPideAtencion('descontinuado')).toBe(false);
  });
});
