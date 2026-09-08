import { describe, it, expect } from 'vitest';
import {
  almacenesPresentes,
  companerosDeLote,
  csvDeKardex,
  desdeDelRango,
  filtrarFilas,
  FILTROS_VACIOS,
  origenDestino,
  textoCantidad,
  textoSaldo,
  usuariosPresentes,
  type FilaKardexVista,
} from './kardexVista';

function fila(p: Partial<FilaKardexVista> = {}): FilaKardexVista {
  return {
    id: 'm1',
    fuente: 'kardex',
    editable: true,
    fecha: '2026-09-08T14:42:00.000Z',
    dominio: 'insumo',
    item_cod: 'MEC 18',
    item_nombre: 'Kit roller 45',
    tipo: 'SALIDA',
    cantidad: 4,
    unidad: 'un',
    cantidad_texto: null,
    origen: 'LIB',
    destino: null,
    saldo_post: 27,
    ot: '3221',
    referencia: 'Despacho de OT',
    quien: 'Marcelo',
    notas: null,
    lote_id: 'l1',
    ...p,
  };
}

describe('desdeDelRango', () => {
  it('«hoy» empieza a la medianoche local, no a las 00:00 UTC', () => {
    // En Chile son 3 horas: un despacho de las 22:00 caería en «mañana».
    const ahora = new Date('2026-09-08T14:42:00');
    const desde = new Date(desdeDelRango('hoy', ahora)!);
    expect(desde.getHours()).toBe(0);
    expect(desde.getDate()).toBe(8);
  });

  it('7 días incluye hoy: son 7 días contando este', () => {
    const ahora = new Date('2026-09-08T14:42:00');
    expect(new Date(desdeDelRango('7d', ahora)!).getDate()).toBe(2);
  });

  it('«todo» no pone tope', () => {
    expect(desdeDelRango('todo')).toBeNull();
  });
});

describe('textoCantidad', () => {
  it('las unidades van enteras y los metros con dos decimales', () => {
    expect(textoCantidad(fila({ cantidad: 4, unidad: 'un' }))).toBe('4 un');
    expect(textoCantidad(fila({ cantidad: 12.4, unidad: 'm' }))).toBe('12,40 m');
    expect(textoCantidad(fila({ cantidad: 248, unidad: 'cm' }))).toBe('248 cm');
  });

  it('un paño trae su medida escrita y se muestra tal cual', () => {
    expect(textoCantidad(fila({ cantidad: null, unidad: null, cantidad_texto: '106×260' }))).toBe(
      '106×260',
    );
  });

  it('sin cantidad muestra una raya, no un cero', () => {
    // Un cero diría que se movió nada; la raya dice que no aplica.
    expect(textoCantidad(fila({ cantidad: null, cantidad_texto: null }))).toBe('—');
  });
});

describe('textoSaldo', () => {
  it('el saldo de una tela lleva decimales; el de un insumo, no', () => {
    expect(textoSaldo({ saldo_post: 86.2, unidad: 'm' })).toBe('86,20');
    expect(textoSaldo({ saldo_post: 27, unidad: 'un' })).toBe('27');
  });

  it('las filas del historial no tienen saldo y lo dicen', () => {
    expect(textoSaldo({ saldo_post: null, unidad: 'cm' })).toBe('—');
  });
});

describe('origenDestino', () => {
  it('una salida muestra la OT como destino, no una raya', () => {
    // «Liberado → —» no le dice nada a nadie.
    expect(origenDestino(fila())).toEqual({ desde: 'Liberado', hacia: 'OT 3221' });
  });

  it('un traslado muestra las dos bodegas', () => {
    expect(origenDestino(fila({ tipo: 'TRASLADO', origen: 'MP', destino: 'CAM-1', ot: null })))
      .toEqual({ desde: 'Materias primas', hacia: 'Camioneta 1' });
  });

  it('un ingreso no tiene origen', () => {
    expect(origenDestino(fila({ tipo: 'INGRESO', origen: null, destino: 'MP', ot: null })))
      .toEqual({ desde: '—', hacia: 'Materias primas' });
  });

  it('un ajuste pasa en un solo almacén y no inventa un destino', () => {
    expect(origenDestino(fila({ tipo: 'AJUSTE', origen: 'MP', destino: null, ot: null })))
      .toEqual({ desde: 'Materias primas', hacia: null });
  });
});

describe('filtrarFilas', () => {
  const filas = [
    fila({ id: 'a', dominio: 'insumo', item_cod: 'MEC 18' }),
    fila({ id: 'b', dominio: 'tela', item_cod: 'BK 07', quien: 'Karina' }),
    fila({ id: 'c', dominio: 'insumo', item_cod: 'CAD 13', origen: 'MP', destino: 'CAM-1', ot: null }),
  ];

  it('los tres chips filtran por dominio', () => {
    expect(filtrarFilas(filas, { ...FILTROS_VACIOS, telas: false }).map((f) => f.id)).toEqual([
      'a',
      'c',
    ]);
    expect(
      filtrarFilas(filas, { ...FILTROS_VACIOS, insumos: false, camionetas: false }).map((f) => f.id),
    ).toEqual(['b']);
  });

  it('«camionetas» no es un dominio: es por dónde pasó el movimiento', () => {
    // El traslado a la camioneta es de insumos Y de camionetas a la vez.
    const soloCam = filtrarFilas(filas, {
      ...FILTROS_VACIOS,
      insumos: false,
      telas: false,
    });
    expect(soloCam.map((f) => f.id)).toEqual(['c']);
  });

  it('la búsqueda mira el código, el nombre, la OT y la referencia', () => {
    expect(filtrarFilas(filas, { ...FILTROS_VACIOS, busqueda: 'cad' }).map((f) => f.id)).toEqual(['c']);
    expect(filtrarFilas(filas, { ...FILTROS_VACIOS, busqueda: '3221' })).toHaveLength(2);
  });

  it('el filtro de almacén mira los dos lados del movimiento', () => {
    expect(filtrarFilas(filas, { ...FILTROS_VACIOS, almacen: 'CAM-1' }).map((f) => f.id)).toEqual([
      'c',
    ]);
  });

  it('el de usuario es exacto: dos «Karina» distintas no se mezclan', () => {
    expect(filtrarFilas(filas, { ...FILTROS_VACIOS, usuario: 'Karina' }).map((f) => f.id)).toEqual([
      'b',
    ]);
  });
});

describe('listas de filtros', () => {
  it('solo ofrecen lo que aparece de verdad en pantalla', () => {
    const filas = [fila({ origen: 'LIB', destino: null }), fila({ origen: 'MP', destino: 'CAM-1' })];
    expect(almacenesPresentes(filas)).toEqual(['CAM-1', 'LIB', 'MP']);
    expect(usuariosPresentes(filas)).toEqual(['Marcelo']);
  });
});

describe('companerosDeLote', () => {
  it('cuenta los OTROS movimientos del mismo despacho', () => {
    const filas = [fila({ id: 'a' }), fila({ id: 'b' }), fila({ id: 'c', lote_id: 'l2' })];
    expect(companerosDeLote(filas, filas[0])).toBe(1);
    expect(companerosDeLote(filas, filas[2])).toBe(0);
  });

  it('una fila del historial viejo no tiene lote y no cuenta nada', () => {
    expect(companerosDeLote([fila({ lote_id: null })], fila({ lote_id: null }))).toBe(0);
  });
});

describe('csvDeKardex', () => {
  it('sale con BOM y separado por punto y coma, que es lo que abre Excel en español', () => {
    const csv = csvDeKardex([fila()]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')[0]).toContain('Fecha;Artículo');
    expect(csv).toContain('MEC 18;Kit roller 45;SALIDA;Liberado;;4;un;27;3221');
  });

  it('un texto con punto y coma no parte la fila en dos', () => {
    const csv = csvDeKardex([fila({ referencia: 'Rotura; se cortó mal' })]);
    expect(csv).toContain('"Rotura; se cortó mal"');
  });
});
