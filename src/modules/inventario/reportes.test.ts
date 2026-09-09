import { describe, expect, it } from 'vitest';
import {
  claveMes,
  consumoMensual,
  loQueNoSeMueve,
  mermaMensual,
  millones,
  nombreGrupo,
  nombreMes,
  pesos,
  promedioMensual,
  ultimosMeses,
  valorizar,
  type ArticuloValorizable,
} from './reportes';

const HOY = '2026-09-09T12:00:00.000Z';

describe('valorizar', () => {
  const lista: ArticuloValorizable[] = [
    { codigo: 'A', grupo: 'TUBERÍA', saldo: 10, costo: 1000 },
    { codigo: 'B', grupo: 'TUBERÍA', saldo: 5, costo: 2000 },
    { codigo: 'C', grupo: 'MOTOR', saldo: 2, costo: 50_000 },
    { codigo: 'D', grupo: null, saldo: 3, costo: 100 },
  ];

  it('suma saldo × costo y agrupa de mayor a menor', () => {
    const v = valorizar(lista);
    expect(v.total).toBe(120_300);
    expect(v.grupos).toEqual([
      { nombre: 'Motor', valor: 100_000 },
      { nombre: 'Tubería', valor: 20_000 },
      { nombre: 'Sin clasificar', valor: 300 },
    ]);
  });

  it('lo que NO tiene costo no suma en cero: se cuenta aparte', () => {
    const v = valorizar([...lista, { codigo: 'E', grupo: 'MOTOR', saldo: 8, costo: null }]);
    expect(v.total).toBe(120_300);
    expect(v.sinCosto).toBe(1);
  });

  it('un artículo sin costo pero también sin saldo no le falta plata a nadie', () => {
    const v = valorizar([{ codigo: 'X', grupo: 'A', saldo: 0, costo: null }]);
    expect(v.sinCosto).toBe(0);
  });

  it('un saldo negativo no resta valor al inventario', () => {
    const v = valorizar([{ codigo: 'X', grupo: 'A', saldo: -5, costo: 1000 }]);
    expect(v.total).toBe(0);
  });

  it('un catálogo vacío no revienta', () => {
    expect(valorizar([])).toEqual({ total: 0, sinCosto: 0, grupos: [] });
  });
});

describe('nombreGrupo', () => {
  it('deja legible el grito de la base', () => {
    expect(nombreGrupo('TUBERÍA')).toBe('Tubería');
    expect(nombreGrupo('PESO INFERIOR')).toBe('Peso inferior');
  });

  it('sin grupo no inventa uno', () => {
    expect(nombreGrupo(null)).toBe('Sin clasificar');
    expect(nombreGrupo('  ')).toBe('Sin clasificar');
  });
});

describe('meses', () => {
  it('la clave es comparable y el nombre es corto', () => {
    expect(claveMes('2026-09-09T00:00:00.000Z')).toMatch(/^2026-09$/);
    expect(nombreMes('2026-01')).toBe('Ene');
    expect(nombreMes('2026-12')).toBe('Dic');
  });

  it('una fecha que no se entiende no arma una clave falsa', () => {
    expect(claveMes('el martes')).toBeNull();
    expect(claveMes(null)).toBeNull();
  });

  it('los últimos 12 meses terminan en el de hoy y cruzan el año', () => {
    const m = ultimosMeses(HOY, 12);
    expect(m).toHaveLength(12);
    expect(m[11]).toBe('2026-09');
    expect(m[0]).toBe('2025-10');
  });
});

describe('consumoMensual', () => {
  const costos = new Map([['MEC 18', 1000]]);
  const salidas = [
    { codigo: 'MEC 18', cantidad: 10, fecha: '2026-08-15T00:00:00.000Z' },
    { codigo: 'mec 18', cantidad: 5, fecha: '2026-08-20T00:00:00.000Z' },
    { codigo: 'MEC 18', cantidad: 3, fecha: '2026-09-02T00:00:00.000Z' },
    { codigo: 'SIN COSTO', cantidad: 100, fecha: '2026-08-01T00:00:00.000Z' },
    { codigo: 'MEC 18', cantidad: 99, fecha: '2020-01-01T00:00:00.000Z' },
  ];

  it('valoriza por mes y no distingue mayúsculas', () => {
    const b = consumoMensual(salidas, costos, HOY, 12);
    expect(b.find((x) => x.clave === '2026-08')?.valor).toBe(15_000);
    expect(b.find((x) => x.clave === '2026-09')?.valor).toBe(3_000);
  });

  it('lo que no tiene costo NO suma: mejor una barra baja que un número falso', () => {
    const b = consumoMensual(salidas, costos, HOY, 12);
    expect(b.find((x) => x.clave === '2026-08')?.valor).toBe(15_000);
  });

  it('marca el mes en curso, que todavía no terminó', () => {
    const b = consumoMensual(salidas, costos, HOY, 12);
    expect(b[11].enCurso).toBe(true);
    expect(b[10].enCurso).toBe(false);
  });

  it('los meses sin salidas salen en cero, no se saltan', () => {
    expect(consumoMensual([], costos, HOY, 12).filter((b) => b.valor === 0)).toHaveLength(12);
  });
});

describe('loQueNoSeMueve', () => {
  const articulos = [
    { codigo: 'VIEJO', nombre: 'Nunca salió', grupo: null, saldo: 10, costo: 1000 },
    { codigo: 'QUIETO', nombre: 'Hace 8 meses', grupo: null, saldo: 4, costo: 2000 },
    { codigo: 'ACTIVO', nombre: 'Salió el mes pasado', grupo: null, saldo: 7, costo: 500 },
    { codigo: 'VACIO', nombre: 'Sin saldo', grupo: null, saldo: 0, costo: 9000 },
  ];
  const ultimas = new Map([
    ['QUIETO', '2026-01-09T00:00:00.000Z'],
    ['ACTIVO', '2026-08-09T00:00:00.000Z'],
    ['VACIO', '2020-01-01T00:00:00.000Z'],
  ]);

  it('el que nunca salió es el más quieto de todos', () => {
    const r = loQueNoSeMueve(articulos, ultimas, HOY);
    expect(r.articulos[0].codigo).toBe('VIEJO');
    expect(r.articulos[0].meses).toBeNull();
  });

  it('deja fuera lo que se movió hace poco y lo que no tiene saldo', () => {
    const r = loQueNoSeMueve(articulos, ultimas, HOY);
    expect(r.articulos.map((a) => a.codigo)).toEqual(['VIEJO', 'QUIETO']);
  });

  it('suma cuánta plata está parada', () => {
    expect(loQueNoSeMueve(articulos, ultimas, HOY).valorParado).toBe(18_000);
  });

  it('un artículo quieto sin costo aparece igual, valorizado en cero', () => {
    const r = loQueNoSeMueve(
      [{ codigo: 'X', nombre: 'X', grupo: null, saldo: 5, costo: null }],
      new Map(),
      HOY,
    );
    expect(r.articulos).toHaveLength(1);
    expect(r.valorParado).toBe(0);
  });
});

describe('mermaMensual', () => {
  // Mediodía UTC a propósito: el mes se decide con la fecha LOCAL, así que
  // una marca a medianoche UTC del día 1 cae en el mes anterior en Chile.
  const mermas = [
    { medida_ancho: 100, medida_alto: 200, fecha: '2026-08-05T12:00:00.000Z' },
    { medida_ancho: 50, medida_alto: 100, fecha: '2026-08-15T12:00:00.000Z' },
    { medida_ancho: null, medida_alto: 200, fecha: '2026-08-20T12:00:00.000Z' },
  ];

  it('convierte centímetros a metros cuadrados', () => {
    const b = mermaMensual(mermas, HOY, 12);
    expect(b.find((x) => x.clave === '2026-08')?.valor).toBe(2.5);
  });

  it('una merma sin medida no cuenta', () => {
    const b = mermaMensual([mermas[2]], HOY, 12);
    expect(b.every((x) => x.valor === 0)).toBe(true);
  });
});

describe('promedioMensual', () => {
  it('no cuenta el mes en curso: arrastraría el promedio hacia abajo', () => {
    const barras = [
      { clave: '1', etiqueta: 'a', valor: 10, enCurso: false },
      { clave: '2', etiqueta: 'b', valor: 20, enCurso: false },
      { clave: '3', etiqueta: 'c', valor: 1, enCurso: true },
    ];
    expect(promedioMensual(barras)).toBe(15);
  });

  it('sin meses cerrados devuelve cero en vez de dividir por cero', () => {
    expect(promedioMensual([{ clave: '1', etiqueta: 'a', valor: 5, enCurso: true }])).toBe(0);
  });
});

describe('formato', () => {
  it('los pesos van con puntos de miles', () => {
    expect(pesos(375187620)).toBe('$ 375.187.620');
  });

  it('los millones con un decimal y coma', () => {
    expect(millones(375187620)).toBe('375,2');
  });
});
