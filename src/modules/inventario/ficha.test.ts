import { describe, expect, it } from 'vitest';
import {
  consumoUltimosMeses,
  coberturaMeses,
  descripcionMovimiento,
  faltanParaMinimo,
  movimientosDeArticulo,
  promedioMensual,
  saldosDeInsumo,
} from './ficha';
import type { Movimiento } from './helpers';

// Se arman al mediodía a propósito: a las 23:00 de Chile la fecha en UTC ya es
// del día siguiente y un movimiento del 31 se contaría en el mes que viene.
const mov = (p: Partial<Movimiento>): Movimiento => ({
  id: Math.random().toString(36).slice(2),
  fecha: '2026-09-08T12:00:00',
  mes: null,
  tipo: 'SALIDA PRODUCCION',
  codigo: 'MEC 18',
  producto: 'Kit roller 45 mm blanco',
  almacen: 'LIBERADO',
  cantidad: 4,
  ot: '3221',
  responsable_entrega: 'Marcelo',
  recepcion: null,
  bitacora: null,
  ...p,
});

describe('saldosDeInsumo — dónde está lo que hay', () => {
  it('separa bodega de camionetas: el total es lo de bodega', () => {
    const s = saldosDeInsumo({ stock_mp: 21, stock_liberado: 6 }, [
      { nombre: 'Camioneta 1', cantidad: 3 },
    ]);
    expect(s.mp).toBe(21);
    expect(s.liberado).toBe(6);
    expect(s.total).toBe(27);
    expect(s.enCamionetas).toBe(3);
  });

  // Una camioneta que carga el artículo y hoy tiene 0 se muestra igual: no es
  // lo mismo que una que nunca lo lleva.
  it('deja pasar las camionetas tal como llegan, incluso en 0', () => {
    const s = saldosDeInsumo({ stock_mp: 5, stock_liberado: 0 }, [
      { nombre: 'Camioneta 1', cantidad: 0 },
      { nombre: 'Camioneta 2', cantidad: 2 },
    ]);
    expect(s.camionetas).toHaveLength(2);
    expect(s.enCamionetas).toBe(2);
  });

  it('un negativo se muestra tal cual: es el dato real', () => {
    expect(saldosDeInsumo({ stock_mp: -3, stock_liberado: 0 }).total).toBe(-3);
  });
});

describe('faltanParaMinimo', () => {
  it('dice cuánto falta', () => {
    expect(faltanParaMinimo(27, 30)).toBe(3);
  });

  it('sobre el mínimo no falta nada', () => {
    expect(faltanParaMinimo(40, 30)).toBe(0);
  });

  // 418 artículos están así: el 0 es «nadie lo definió», no «el mínimo es 0».
  it('sin mínimo definido devuelve null, no cero', () => {
    expect(faltanParaMinimo(27, 0)).toBeNull();
    expect(faltanParaMinimo(27, null)).toBeNull();
  });
});

describe('consumoUltimosMeses', () => {
  const hoy = new Date(2026, 8, 8); // septiembre 2026

  it('devuelve seis meses, del más viejo al más nuevo', () => {
    const c = consumoUltimosMeses([], hoy);
    expect(c).toHaveLength(6);
    expect(c.map((m) => m.etiqueta)).toEqual(['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep']);
    expect(c[5].clave).toBe('2026-09');
  });

  it('suma las salidas en el mes que les toca', () => {
    const c = consumoUltimosMeses(
      [
        mov({ fecha: '2026-09-08T12:00:00', cantidad: 4 }),
        mov({ fecha: '2026-09-01T12:00:00', cantidad: 6 }),
        mov({ fecha: '2026-08-20T12:00:00', cantidad: 10 }),
      ],
      hoy,
    );
    expect(c.find((m) => m.clave === '2026-09')?.salidas).toBe(10);
    expect(c.find((m) => m.clave === '2026-08')?.salidas).toBe(10);
  });

  it('la merma también es consumo; el traslado y el ajuste no', () => {
    const c = consumoUltimosMeses(
      [
        mov({ tipo: 'MERMA', cantidad: 2 }),
        mov({ tipo: 'TRASLADO', cantidad: 50 }),
        mov({ tipo: 'AJUSTE', cantidad: 30 }),
        mov({ tipo: 'NUEVO INGRESO', cantidad: 100 }),
      ],
      hoy,
    );
    expect(c.find((m) => m.clave === '2026-09')?.salidas).toBe(2);
  });

  it('lo más viejo que la ventana no entra', () => {
    const c = consumoUltimosMeses([mov({ fecha: '2025-12-10T12:00:00', cantidad: 99 })], hoy);
    expect(c.reduce((s, m) => s + m.salidas, 0)).toBe(0);
  });

  it('una fecha rota o vacía no rompe la cuenta', () => {
    const c = consumoUltimosMeses(
      [mov({ fecha: null, cantidad: 5 }), mov({ fecha: 'ayer', cantidad: 5 })],
      hoy,
    );
    expect(c.reduce((s, m) => s + m.salidas, 0)).toBe(0);
  });
});

describe('promedioMensual y coberturaMeses', () => {
  const hoy = new Date(2026, 8, 8);

  // El mes en curso va a la mitad: contarlo bajaría el promedio sin motivo.
  it('el promedio deja fuera el mes que todavía corre', () => {
    const c = consumoUltimosMeses(
      [
        mov({ fecha: '2026-04-10T12:00:00', cantidad: 20 }),
        mov({ fecha: '2026-05-10T12:00:00', cantidad: 20 }),
        mov({ fecha: '2026-06-10T12:00:00', cantidad: 20 }),
        mov({ fecha: '2026-07-10T12:00:00', cantidad: 20 }),
        mov({ fecha: '2026-08-10T12:00:00', cantidad: 20 }),
        mov({ fecha: '2026-09-02T12:00:00', cantidad: 1 }),
      ],
      hoy,
    );
    expect(promedioMensual(c)).toBe(20);
  });

  it('la cobertura son los meses que aguanta lo que hay', () => {
    expect(coberturaMeses(27, 20)).toBe(1.4);
  });

  it('sin consumo no hay cobertura: null, no infinito', () => {
    expect(coberturaMeses(27, 0)).toBeNull();
  });
});

describe('movimientosDeArticulo', () => {
  it('filtra por código sin importar mayúsculas ni espacios de más', () => {
    const filas = movimientosDeArticulo(
      [mov({ codigo: 'mec  18' }), mov({ codigo: 'MEC 05' }), mov({ codigo: ' MEC 18 ' })],
      'MEC 18',
    );
    expect(filas).toHaveLength(2);
  });

  it('un código vacío no arrastra los movimientos sin código', () => {
    expect(movimientosDeArticulo([mov({ codigo: null }), mov({ codigo: '' })], '')).toEqual([]);
  });

  it('lo más nuevo primero', () => {
    const filas = movimientosDeArticulo(
      [
        mov({ fecha: '2026-08-01T12:00:00' }),
        mov({ fecha: '2026-09-08T12:00:00' }),
        mov({ fecha: '2026-09-01T12:00:00' }),
      ],
      'MEC 18',
    );
    expect(filas.map((f) => f.fecha)).toEqual([
      '2026-09-08T12:00:00',
      '2026-09-01T12:00:00',
      '2026-08-01T12:00:00',
    ]);
  });
});

describe('descripcionMovimiento — de dónde salió y a dónde fue', () => {
  it('una salida a una OT', () => {
    expect(descripcionMovimiento(mov({}))).toBe('Liberado → OT 3221');
  });

  it('una salida sin OT no inventa una', () => {
    expect(descripcionMovimiento(mov({ ot: null }))).toBe('Liberado → salida');
  });

  it('un ingreso viene de afuera', () => {
    expect(descripcionMovimiento(mov({ tipo: 'NUEVO INGRESO', almacen: 'MP' }))).toBe(
      '— → Materias primas',
    );
  });

  it('una devolución vuelve de la OT', () => {
    expect(descripcionMovimiento(mov({ tipo: 'DEVOLUCION', almacen: 'MP' }))).toBe(
      'OT 3221 → Materias primas',
    );
  });

  it('el pedido de reposición no mueve stock y se dice así', () => {
    expect(descripcionMovimiento(mov({ tipo: 'PEDIDO REPOSICION' }))).toBe(
      'Pedido de reposición',
    );
  });

  it('un ajuste dice dónde se ajustó', () => {
    expect(descripcionMovimiento(mov({ tipo: 'AJUSTE', almacen: 'MATERIAS_PRIMAS' }))).toBe(
      'Ajuste en Materias primas',
    );
  });
});
