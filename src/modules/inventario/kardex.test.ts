import { describe, it, expect } from 'vitest';
import {
  almacenKardex,
  etiquetaAlmacenCorta,
  lineaDeMovimientoManual,
  lineaDeTela,
  lineasDeCamioneta,
  lineasDeDespacho,
  mensajeErrorKardex,
  resumenDeMovimientos,
  saldosFinales,
  tipoKardexDesdeLegacy,
  type LineaKardex,
  type MovimientoRegistrado,
  type RespuestaKardex,
} from './kardex';

function esError(x: unknown): x is { error: string } {
  return !!x && typeof x === 'object' && 'error' in (x as object);
}

function mov(p: Partial<MovimientoRegistrado>): MovimientoRegistrado {
  return {
    id: 'm1',
    item_cod: 'MEC 18',
    tipo: 'SALIDA',
    origen: 'MP',
    destino: null,
    cantidad: 1,
    saldo_mp: 0,
    saldo_liberado: 0,
    saldo_origen_post: 0,
    saldo_destino_post: null,
    desde_liberado: 0,
    desde_materias_primas: 1,
    ...p,
  };
}

describe('almacenKardex', () => {
  it('lleva las cuatro grafías de bodega al mismo código', () => {
    for (const t of ['MP', 'mp', 'MATERIAS_PRIMAS', 'MATERIAS PRIMAS', '  materias primas  ']) {
      expect(almacenKardex(t)).toBe('MP');
    }
    expect(almacenKardex('LIBERADO')).toBe('LIB');
    expect(almacenKardex('LIB')).toBe('LIB');
    expect(almacenKardex('MERMA')).toBe('MERMA');
  });

  it('entiende las camionetas escritas de varias formas', () => {
    expect(almacenKardex('CAM-1')).toBe('CAM-1');
    expect(almacenKardex('cam 2')).toBe('CAM-2');
    expect(almacenKardex('CAM03')).toBe('CAM-3');
  });

  it('devuelve undefined ante lo desconocido en vez de adivinar', () => {
    // Adivinar acá sería mover stock del lugar equivocado.
    expect(almacenKardex('BODEGA CHICA')).toBeUndefined();
    expect(almacenKardex('')).toBeUndefined();
    expect(almacenKardex(null)).toBeUndefined();
    expect(almacenKardex(undefined)).toBeUndefined();
  });
});

describe('tipoKardexDesdeLegacy', () => {
  it('traduce los tipos que se usan hoy', () => {
    expect(tipoKardexDesdeLegacy('NUEVO INGRESO')).toBe('INGRESO');
    expect(tipoKardexDesdeLegacy('SALIDA PRODUCCION')).toBe('SALIDA');
    expect(tipoKardexDesdeLegacy('DEVOLUCION')).toBe('DEVOLUCION');
    expect(tipoKardexDesdeLegacy('AJUSTE')).toBe('AJUSTE');
  });

  it('un pedido de reposición NO es un movimiento de stock', () => {
    // Hoy ensucia el registro como si algo hubiera entrado o salido.
    expect(tipoKardexDesdeLegacy('PEDIDO REPOSICION')).toBeNull();
  });
});

describe('lineaDeMovimientoManual', () => {
  it('una salida lleva el almacén como ORIGEN', () => {
    const l = lineaDeMovimientoManual({
      tipo: 'SALIDA PRODUCCION',
      codigo: 'MEC 18',
      cantidad: '5',
      almacen: 'LIBERADO',
    });
    expect(esError(l)).toBe(false);
    const linea = l as LineaKardex;
    expect(linea.origen).toBe('LIB');
    expect(linea.destino).toBeUndefined();
    expect(linea.cantidad).toBe(5);
  });

  it('un ingreso lleva el almacén como DESTINO', () => {
    const l = lineaDeMovimientoManual({
      tipo: 'NUEVO INGRESO',
      codigo: 'MEC 18',
      cantidad: 3,
      almacen: 'MP',
    }) as LineaKardex;
    expect(l.destino).toBe('MP');
    expect(l.origen).toBeUndefined();
  });

  it('con OT queda referenciado a la OT, no a «manual»', () => {
    const l = lineaDeMovimientoManual({
      tipo: 'SALIDA PRODUCCION',
      codigo: 'MEC 18',
      cantidad: 1,
      almacen: 'MP',
      ot: ' 3187 ',
    }) as LineaKardex;
    expect(l.ot).toBe('3187');
    expect(l.referencia_tipo).toBe('ot');
  });

  it('rechaza lo que no se puede guardar, con el motivo', () => {
    expect(lineaDeMovimientoManual({ tipo: 'NUEVO INGRESO', codigo: '', cantidad: 1, almacen: 'MP' }))
      .toEqual({ error: 'Selecciona un insumo' });
    expect(lineaDeMovimientoManual({ tipo: 'NUEVO INGRESO', codigo: 'X', cantidad: 0, almacen: 'MP' }))
      .toEqual({ error: 'La cantidad debe ser mayor a 0' });
    expect(esError(lineaDeMovimientoManual({ tipo: 'NUEVO INGRESO', codigo: 'X', cantidad: 1, almacen: 'ZZZ' })))
      .toBe(true);
    expect(esError(lineaDeMovimientoManual({ tipo: 'PEDIDO REPOSICION', codigo: 'X', cantidad: 1, almacen: 'MP' })))
      .toBe(true);
  });
});

describe('lineasDeDespacho', () => {
  it('arma una línea por material, sin origen: la base reparte', () => {
    const l = lineasDeDespacho(
      [{ codigo: 'MEC 18', cantidad: 2 }, { codigo: 'E39', cantidad: 1 }],
      { ot: '3187', responsable: 'Juan', recibe: 'Pedro' },
    );
    expect(l).toHaveLength(2);
    expect(l.every((x) => x.origen === undefined)).toBe(true);
    expect(l.every((x) => x.tipo === 'SALIDA')).toBe(true);
    expect(l[0].ot).toBe('3187');
    expect(l[0].referencia_tipo).toBe('ot');
    expect(l[0].recibe).toBe('Pedro');
  });

  it('descarta las filas vacías o en cero en vez de mandarlas', () => {
    const l = lineasDeDespacho(
      [{ codigo: '', cantidad: 5 }, { codigo: 'E39', cantidad: 0 }, { codigo: 'E39', cantidad: 2 }],
      {},
    );
    expect(l).toHaveLength(1);
  });
});

describe('lineasDeCamioneta', () => {
  it('cargar es un TRASLADO de bodega a camioneta, no una salida', () => {
    // El material sigue siendo de la empresa: solo cambió de lugar.
    const [l] = lineasDeCamioneta('cargar', 'CAM-1', [{ codigo: 'MEC 18', cantidad: 4 }]);
    expect(l.tipo).toBe('TRASLADO');
    expect(l.origen).toBe('MP');
    expect(l.destino).toBe('CAM-1');
    expect(l.referencia_tipo).toBe('camioneta');
  });

  it('devolver invierte el sentido', () => {
    const [l] = lineasDeCamioneta('devolver', 'CAM-1', [{ codigo: 'MEC 18', cantidad: 1 }]);
    expect(l.origen).toBe('CAM-1');
    expect(l.destino).toBe('MP');
  });

  it('dar de baja sale de la camioneta y no vuelve a ninguna bodega', () => {
    const [l] = lineasDeCamioneta('baja', 'CAM-1', [{ codigo: 'MEC 18', cantidad: 1 }]);
    expect(l.tipo).toBe('MERMA');
    expect(l.origen).toBe('CAM-1');
    expect(l.destino).toBeUndefined();
  });
});

describe('lineaDeTela', () => {
  it('los metros admiten decimales con coma', () => {
    const l = lineaDeTela({ codigo: 'SC48', tipo: 'SALIDA PRODUCCION', metros: '12,5' }) as LineaKardex;
    expect(l.cantidad).toBe(12.5);
    expect(l.dominio).toBe('tela');
  });

  it('una salida de tela sin almacén se reparte sola', () => {
    const l = lineaDeTela({ codigo: 'SC48', tipo: 'SALIDA PRODUCCION', metros: 3 }) as LineaKardex;
    expect(l.origen).toBeUndefined();
  });

  it('un ingreso de tela sin almacén entra a materias primas', () => {
    const l = lineaDeTela({ codigo: 'SC48', tipo: 'NUEVO INGRESO', metros: 30 }) as LineaKardex;
    expect(l.destino).toBe('MP');
  });

  it('el traslado usa el almacén como destino y saca de la otra bodega', () => {
    // La pantalla tiene un solo campo, y su título dice «MP ↔ Liberado».
    const a = lineaDeTela({ codigo: 'SC48', tipo: 'TRASLADO', metros: 5, almacen: 'LIBERADO' }) as LineaKardex;
    expect(a.destino).toBe('LIB');
    expect(a.origen).toBe('MP');

    const b = lineaDeTela({ codigo: 'SC48', tipo: 'TRASLADO', metros: 5, almacen: 'MATERIAS PRIMAS' }) as LineaKardex;
    expect(b.destino).toBe('MP');
    expect(b.origen).toBe('LIB');
  });

  it('un ajuste sin decir si suma o resta se rechaza en vez de adivinar', () => {
    // Adivinarlo movería los metros para el lado contrario.
    expect(esError(lineaDeTela({ codigo: 'SC48', tipo: 'AJUSTE', metros: 2 }))).toBe(true);

    const suma = lineaDeTela({ codigo: 'SC48', tipo: 'AJUSTE', metros: 2, sentido: 'suma' }) as LineaKardex;
    expect(suma.destino).toBe('MP');
    expect(suma.origen).toBeUndefined();

    const resta = lineaDeTela({ codigo: 'SC48', tipo: 'AJUSTE', metros: 2, sentido: 'resta', almacen: 'LIBERADO' }) as LineaKardex;
    expect(resta.origen).toBe('LIB');
    expect(resta.destino).toBeUndefined();
  });
});

describe('mensajeErrorKardex', () => {
  it('IN003 suma qué se puede hacer al mensaje de la base', () => {
    const m = mensajeErrorKardex('IN003', 'No alcanza el stock de MEC 18: hay 2 en materias primas');
    expect(m).toContain('hay 2 en materias primas');
    expect(m).toContain('contar el artículo');
  });

  it('IN001 no muestra el mensaje crudo: dice qué hacer', () => {
    expect(mensajeErrorKardex('IN001', 'No hay sesión activa')).toContain('Vuelve a entrar');
  });

  it('un código desconocido no deja a la persona sin explicación', () => {
    expect(mensajeErrorKardex(undefined, '')).toBe('No se pudo registrar el movimiento.');
    expect(mensajeErrorKardex('23505', 'duplicado')).toBe('duplicado');
  });
});

describe('resumenDeMovimientos', () => {
  it('cuenta la salida repartida entre las dos bodegas', () => {
    const r: RespuestaKardex = {
      lote_id: 'l1',
      movimientos: [
        mov({ id: 'a', cantidad: 15, origen: 'LIB' }),
        mov({ id: 'b', cantidad: 5, origen: 'MP' }),
      ],
    };
    const texto = resumenDeMovimientos(r);
    expect(texto).toContain('15 de liberado');
    expect(texto).toContain('5 de materias primas');
  });

  it('un movimiento simple se cuenta en una frase', () => {
    const r: RespuestaKardex = {
      lote_id: 'l1',
      movimientos: [mov({ tipo: 'TRASLADO', cantidad: 4, origen: 'MP', destino: 'CAM-1' })],
    };
    expect(resumenDeMovimientos(r)).toBe('MEC 18: 4 de materias primas a camioneta 1.');
  });

  it('un despacho de varios artículos avisa cuántos se repartieron', () => {
    const r: RespuestaKardex = {
      lote_id: 'l1',
      movimientos: [
        mov({ item_cod: 'A', origen: 'LIB' }),
        mov({ item_cod: 'A', origen: 'MP' }),
        mov({ item_cod: 'B', origen: 'MP' }),
      ],
    };
    expect(resumenDeMovimientos(r)).toBe('2 artículos movidos (1 salieron de dos bodegas).');
  });

  it('no revienta con una respuesta vacía o nula', () => {
    expect(resumenDeMovimientos(null)).toContain('No se registró');
    expect(resumenDeMovimientos({ lote_id: 'x', movimientos: [] })).toContain('No se registró');
  });
});

describe('saldosFinales', () => {
  it('de una salida repartida se queda con el saldo del ÚLTIMO renglón', () => {
    // Los anteriores son saldos intermedios de la misma llamada.
    const r: RespuestaKardex = {
      lote_id: 'l1',
      movimientos: [
        mov({ item_cod: 'A', origen: 'LIB', saldo_mp: 10, saldo_liberado: 0 }),
        mov({ item_cod: 'A', origen: 'MP', saldo_mp: 7, saldo_liberado: 0 }),
      ],
    };
    expect(saldosFinales(r).get('A')).toEqual({ stock_mp: 7, stock_liberado: 0 });
  });
});

describe('etiquetaAlmacenCorta', () => {
  it('nombra las bodegas como las nombra la gente', () => {
    expect(etiquetaAlmacenCorta('MP')).toBe('materias primas');
    expect(etiquetaAlmacenCorta('LIB')).toBe('liberado');
    expect(etiquetaAlmacenCorta('CAM-2')).toBe('camioneta 2');
    expect(etiquetaAlmacenCorta(null)).toBe('ningún lado');
  });
});
