// Tests de los helpers del Panel KPI Ventas: el rango de fechas que
// alimenta los botones Hoy/Semana/Mes y la suma de registros del período.

import { describe, expect, it } from 'vitest';
import {
  construirHistorial,
  diasDelRango,
  fechaISO,
  rangoPeriodo,
  sumarRegistros,
  textoPeriodo,
} from './helpers';

describe('rangoPeriodo', () => {
  it('dia: solo la fecha seleccionada', () => {
    expect(rangoPeriodo('2026-07-28', 'dia')).toEqual({
      desde: '2026-07-28',
      hasta: '2026-07-28',
      dias: 1,
    });
  });

  it('semana: desde el lunes de esa semana hasta la fecha (martes)', () => {
    // 2026-07-28 es martes; el lunes de su semana es el 27.
    expect(rangoPeriodo('2026-07-28', 'semana')).toEqual({
      desde: '2026-07-27',
      hasta: '2026-07-28',
      dias: 2,
    });
  });

  it('semana: si la fecha ES lunes, el rango es solo ese día', () => {
    expect(rangoPeriodo('2026-07-27', 'semana')).toEqual({
      desde: '2026-07-27',
      hasta: '2026-07-27',
      dias: 1,
    });
  });

  it('semana: el domingo cierra la semana que empezó el lunes anterior', () => {
    // 2026-07-26 es domingo → lunes 2026-07-20, 7 días.
    expect(rangoPeriodo('2026-07-26', 'semana')).toEqual({
      desde: '2026-07-20',
      hasta: '2026-07-26',
      dias: 7,
    });
  });

  it('semana: cruza el cambio de mes', () => {
    // 2026-04-01 es miércoles → lunes 2026-03-30.
    expect(rangoPeriodo('2026-04-01', 'semana')).toEqual({
      desde: '2026-03-30',
      hasta: '2026-04-01',
      dias: 3,
    });
  });

  it('mes: desde el 1° hasta la fecha seleccionada', () => {
    expect(rangoPeriodo('2026-07-28', 'mes')).toEqual({
      desde: '2026-07-01',
      hasta: '2026-07-28',
      dias: 28,
    });
  });

  it('mes: si la fecha es el 1°, el rango es solo ese día', () => {
    expect(rangoPeriodo('2026-07-01', 'mes')).toEqual({
      desde: '2026-07-01',
      hasta: '2026-07-01',
      dias: 1,
    });
  });

  it('mes: febrero de año bisiesto', () => {
    expect(rangoPeriodo('2028-02-29', 'mes')).toEqual({
      desde: '2028-02-01',
      hasta: '2028-02-29',
      dias: 29,
    });
  });

  it('nunca incluye días futuros: hasta es siempre la fecha activa', () => {
    (['dia', 'semana', 'mes'] as const).forEach((p) => {
      expect(rangoPeriodo('2026-07-28', p).hasta).toBe('2026-07-28');
    });
  });
});

describe('diasDelRango', () => {
  it('devuelve los días en orden cronológico', () => {
    expect(diasDelRango(rangoPeriodo('2026-04-01', 'semana'))).toEqual([
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
    ]);
  });

  it('un solo día para el período diario', () => {
    expect(diasDelRango(rangoPeriodo('2026-07-28', 'dia'))).toEqual(['2026-07-28']);
  });

  it('la cantidad de días coincide con rango.dias', () => {
    const r = rangoPeriodo('2026-07-28', 'mes');
    expect(diasDelRango(r)).toHaveLength(r.dias);
  });
});

describe('sumarRegistros', () => {
  it('acumula las claves repetidas de días distintos', () => {
    expect(
      sumarRegistros([
        { clave: 'canal_whatsapp', valor: 3 },
        { clave: 'canal_whatsapp', valor: 5 },
        { clave: 'cierre_enviadas', valor: 2 },
      ]),
    ).toEqual({ canal_whatsapp: 8, cierre_enviadas: 2 });
  });

  it('trata valores nulos o no numéricos como 0', () => {
    expect(
      sumarRegistros([
        { clave: 'canal_web', valor: null },
        { clave: 'canal_web', valor: '4' },
      ]),
    ).toEqual({ canal_web: 4 });
  });

  it('sin filas devuelve un objeto vacío', () => {
    expect(sumarRegistros([])).toEqual({});
  });
});

describe('construirHistorial', () => {
  const rango = rangoPeriodo('2026-07-28', 'semana'); // lunes 27 + martes 28
  const filas = [
    { fecha: '2026-07-27', clave: 'canal_whatsapp', valor: 4 },
    { fecha: '2026-07-27', clave: 'll_llamadas_ana', valor: 2 },
    { fecha: '2026-07-28', clave: 'canal_whatsapp', valor: 6 },
    { fecha: '2026-07-28', clave: 'cierre_cerradas', valor: 3 },
  ];

  it('devuelve un punto por día del rango, en orden', () => {
    const hist = construirHistorial(filas, rango, ['WhatsApp'], ['Ana']);
    expect(hist).toHaveLength(2);
    expect(hist[0]).toMatchObject({ Mensajes: 4, Llamadas: 2, Cierres: 0 });
    expect(hist[1]).toMatchObject({ Mensajes: 6, Llamadas: 0, Cierres: 3 });
  });

  it('los días sin registros quedan en cero (no se saltan)', () => {
    const hist = construirHistorial([], rango, ['WhatsApp'], ['Ana']);
    expect(hist.map((h) => h.Mensajes)).toEqual([0, 0]);
  });

  it('ignora claves de canales/vendedoras que ya no están configurados', () => {
    const hist = construirHistorial(filas, rango, [], []);
    expect(hist.map((h) => h.Mensajes + h.Llamadas)).toEqual([0, 0]);
    expect(hist[1].Cierres).toBe(3);
  });
});

describe('fechaISO', () => {
  it('usa la fecha LOCAL (no UTC): 23:30 en Chile sigue siendo el mismo día', () => {
    const d = new Date(2026, 6, 28, 23, 30, 0); // 28-07-2026 23:30 hora local
    expect(fechaISO(d)).toBe('2026-07-28');
  });

  it('rellena mes y día con cero', () => {
    expect(fechaISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('textoPeriodo', () => {
  it('etiqueta cada período', () => {
    expect(textoPeriodo('dia').chip).toBe('DIARIO');
    expect(textoPeriodo('semana').chip).toBe('SEMANA');
    expect(textoPeriodo('mes').chip).toBe('MES');
    expect(textoPeriodo('semana').sufijo).toBe('en la semana');
    expect(textoPeriodo('mes').delLapso).toBe('del mes');
  });
});
