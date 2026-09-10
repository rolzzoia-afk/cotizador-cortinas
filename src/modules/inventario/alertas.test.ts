import { describe, expect, it } from 'vitest';
import {
  cantidadSugerida,
  coberturaMeses,
  conBorrador,
  consumoPorCodigo,
  estadoDeAlerta,
  filtrarAlertas,
  ordenarAlertas,
  pideAtencion,
  resumenAlertas,
  resumenCambios,
  textoCantidad,
  textoCobertura,
  type ArticuloAlerta,
} from './alertas';

function art(p: Partial<ArticuloAlerta> & { id: string; codigo: string }): ArticuloAlerta {
  return {
    dominio: 'insumo',
    nombre: 'Artículo',
    ahora: 10,
    minimo: 5,
    maximo: null,
    ...p,
  };
}

// Las filas de la lámina, con sus números.
const LISTA: ArticuloAlerta[] = [
  art({ id: '1', codigo: 'MEC 28', nombre: 'Kit invertida 63 mm', ahora: 0, minimo: 8, maximo: 20 }),
  art({ id: '2', codigo: 'TOP 05', nombre: 'Tope plástico blanco', ahora: -3, minimo: 2, maximo: 10 }),
  art({
    id: '3',
    codigo: 'BK 90',
    nombre: 'Blackout gris plomo',
    dominio: 'tela',
    ahora: 6.8,
    minimo: 20,
    maximo: 60,
  }),
  art({
    id: '4',
    codigo: 'MEC 18',
    nombre: 'Kit roller 45 mm blanco',
    ahora: 27,
    minimo: 30,
    maximo: 60,
    consumoMes: 20,
  }),
  art({ id: '5', codigo: 'DOM 47', nombre: 'Motor pequeño', ahora: 4, minimo: null, maximo: null }),
  art({ id: '6', codigo: 'INS 01', nombre: 'Sano', ahora: 100, minimo: 10, maximo: 120 }),
  art({
    id: '7',
    codigo: 'OLD 01',
    nombre: 'Descontinuado',
    ahora: 0,
    minimo: 5,
    status: 'DESCONTINUADO',
  }),
];

describe('cantidadSugerida', () => {
  it('es «dejar en» menos lo que hay hoy', () => {
    expect(cantidadSugerida(LISTA[0])).toBe(20);
    expect(cantidadSugerida(LISTA[2])).toBe(53.2);
  });

  it('un saldo negativo se suma: hay que reponer también lo que falta', () => {
    expect(cantidadSugerida(LISTA[1])).toBe(13);
  });

  it('sin máximo definido NO inventa una cantidad', () => {
    expect(cantidadSugerida(LISTA[4])).toBeNull();
  });

  it('si ya hay más de lo que se quería dejar, no sugiere comprar', () => {
    expect(cantidadSugerida(art({ id: 'x', codigo: 'X', ahora: 200, maximo: 120 }))).toBe(0);
  });
});

describe('textoCantidad', () => {
  it('los insumos van enteros y las telas con dos decimales', () => {
    expect(textoCantidad(27, 'insumo')).toBe('27');
    expect(textoCantidad(6.8, 'tela')).toBe('6,80');
  });
});

describe('estadoDeAlerta y pideAtencion', () => {
  it('lo descontinuado sale de las alertas aunque esté en cero', () => {
    expect(estadoDeAlerta(LISTA[6])).toBe('descontinuado');
    expect(pideAtencion(LISTA[6])).toBe(false);
  });

  it('sin stock, negativo y bajo mínimo piden atención', () => {
    expect(pideAtencion(LISTA[0])).toBe(true);
    expect(pideAtencion(LISTA[1])).toBe(true);
    expect(pideAtencion(LISTA[3])).toBe(true);
  });

  it('un artículo sin mínimo definido no pide atención: nadie dijo cuánto es poco', () => {
    expect(estadoDeAlerta(LISTA[4])).toBe('sin_minimo');
    expect(pideAtencion(LISTA[4])).toBe(false);
  });
});

describe('cobertura', () => {
  it('dice para cuántos meses alcanza cuando se sabe qué sale', () => {
    expect(coberturaMeses(LISTA[3])).toBeCloseTo(1.35);
    expect(textoCobertura(LISTA[3])).toEqual({ texto: '1,4 meses', variante: 'warning' });
  });

  it('menos de un mes es rojo; más de dos, verde', () => {
    expect(textoCobertura(art({ id: 'a', codigo: 'A', ahora: 10, consumoMes: 20 })).variante).toBe(
      'destructive',
    );
    expect(textoCobertura(art({ id: 'b', codigo: 'B', ahora: 100, consumoMes: 20 })).variante).toBe(
      'success',
    );
  });

  it('sin historia de consumo dice el estado, que es lo único que se sabe', () => {
    expect(textoCobertura(LISTA[2])).toEqual({ texto: 'Crítico', variante: 'destructive' });
    expect(textoCobertura(LISTA[5])).toEqual({ texto: 'Cubierto', variante: 'success' });
  });

  it('el saldo cero o negativo manda sobre cualquier cálculo', () => {
    expect(textoCobertura(LISTA[0]).texto).toBe('Sin stock');
    expect(textoCobertura(LISTA[1]).texto).toBe('Negativo');
  });

  it('sin mínimo no hay contra qué medir', () => {
    expect(textoCobertura(LISTA[4])).toEqual({ texto: 'Sin mínimo', variante: 'muted' });
  });
});

describe('consumoPorCodigo', () => {
  const salidas = [
    { codigo: 'MEC 18', cantidad: 60, fecha: '2026-08-01T00:00:00.000Z' },
    { codigo: 'mec 18', cantidad: 60, fecha: '2026-07-01T00:00:00.000Z' },
    { codigo: 'MEC 18', cantidad: 999, fecha: '2020-01-01T00:00:00.000Z' }, // fuera de rango
    { codigo: null, cantidad: 5, fecha: '2026-08-01T00:00:00.000Z' },
    { codigo: 'TOP 05', cantidad: null, fecha: '2026-08-01T00:00:00.000Z' },
  ];

  it('promedia por mes y no distingue mayúsculas', () => {
    const m = consumoPorCodigo(salidas, 6, '2026-03-01T00:00:00.000Z');
    expect(m.get('MEC 18')).toBe(20);
  });

  it('deja fuera lo viejo, lo sin código y lo sin cantidad', () => {
    const m = consumoPorCodigo(salidas, 6, '2026-03-01T00:00:00.000Z');
    expect(m.size).toBe(1);
  });

  it('una salida guardada en negativo cuenta igual como consumo', () => {
    const m = consumoPorCodigo(
      [{ codigo: 'X', cantidad: -12, fecha: '2026-08-01T00:00:00.000Z' }],
      6,
      '2026-03-01T00:00:00.000Z',
    );
    expect(m.get('X')).toBe(2);
  });
});

describe('filtrarAlertas', () => {
  it('«piden atención» deja fuera lo sano, lo sin mínimo y lo descontinuado', () => {
    expect(filtrarAlertas(LISTA, 'atencion').map((a) => a.codigo)).toEqual([
      'MEC 28',
      'TOP 05',
      'BK 90',
      'MEC 18',
    ]);
  });

  it('«sin mínimo» encuentra justo los que nunca van a avisar', () => {
    expect(filtrarAlertas(LISTA, 'sin_minimo').map((a) => a.codigo)).toEqual(['DOM 47']);
  });

  it('la búsqueda mira el código y el nombre', () => {
    expect(filtrarAlertas(LISTA, 'todas', 'roller').map((a) => a.codigo)).toEqual(['MEC 18']);
    expect(filtrarAlertas(LISTA, 'todas', 'bk 90').map((a) => a.codigo)).toEqual(['BK 90']);
  });

  it('se puede pedir solo un dominio', () => {
    const soloTelas = filtrarAlertas(LISTA, 'todas', '', new Set(['tela'] as const));
    expect(soloTelas.map((a) => a.codigo)).toEqual(['BK 90']);
  });

  it('un conjunto de dominios vacío no esconde nada', () => {
    expect(filtrarAlertas(LISTA, 'todas', '', new Set()).length).toBe(LISTA.length);
  });
});

describe('ordenarAlertas', () => {
  it('primero lo que más duele: negativo, sin stock, bajo mínimo', () => {
    expect(ordenarAlertas(LISTA).map((a) => a.codigo)).toEqual([
      'TOP 05',
      'MEC 28',
      'BK 90',
      'MEC 18',
      'DOM 47',
      'INS 01',
      'OLD 01',
    ]);
  });

  it('no toca la lista original', () => {
    const antes = LISTA.map((a) => a.codigo);
    ordenarAlertas(LISTA);
    expect(LISTA.map((a) => a.codigo)).toEqual(antes);
  });
});

describe('resumenAlertas', () => {
  it('cuenta lo que dicen las tarjetas de arriba', () => {
    expect(resumenAlertas(LISTA)).toEqual({ sinStock: 2, bajoMinimo: 2, sinMinimo: 1 });
  });
});

describe('el borrador', () => {
  it('aplica encima lo que todavía no se guardó', () => {
    const a = conBorrador(LISTA[3], { '4': { minimo: 40 } });
    expect(a.minimo).toBe(40);
    expect(a.maximo).toBe(60);
  });

  it('un artículo sin cambios vuelve tal cual', () => {
    expect(conBorrador(LISTA[3], {})).toBe(LISTA[3]);
  });

  it('borrar el mínimo a propósito NO se confunde con no haberlo tocado', () => {
    expect(conBorrador(LISTA[3], { '4': { minimo: null } }).minimo).toBeNull();
  });

  it('la frase cuenta por campo, no por artículo', () => {
    expect(resumenCambios({ a: { minimo: 1 }, b: { minimo: 2 }, c: { maximo: 9 } })).toBe(
      'Cambiaste el punto de reposición de 2 artículos y el objetivo de 1',
    );
  });

  it('en singular se lee bien', () => {
    expect(resumenCambios({ a: { minimo: 1 } })).toBe(
      'Cambiaste el punto de reposición de 1 artículo',
    );
  });

  it('sin cambios no hay frase que mostrar', () => {
    expect(resumenCambios({})).toBeNull();
  });
});
