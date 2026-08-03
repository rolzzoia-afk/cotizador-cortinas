import { describe, expect, it } from 'vitest';
import {
  agruparPorColmena,
  coincideBusqueda,
  compararColmenas,
  diasEnColmena,
  enAlerta,
  familiaCod,
  familiaDominante,
  mapaPrimerIngreso,
  notaSlot,
  sectorDeColmena,
  type TuboColmena,
} from './colmenaTubos';

const tubo = (p: Partial<TuboColmena> = {}): TuboColmena => ({
  id: p.id ?? Math.random().toString(36).slice(2),
  // `?? 'A1'` no sirve: los tests pasan n_colmena: null a propósito.
  n_colmena: 'n_colmena' in p ? p.n_colmena! : 'A1',
  cod: p.cod ?? 'E02',
  medida_cm: p.medida_cm ?? 200,
  tubo_raiz_id: p.tubo_raiz_id ?? null,
  created_at: p.created_at ?? null,
  serial: p.serial ?? null,
});

describe('familiaCod', () => {
  it('clasifica cada familia de código de la colmena', () => {
    expect(familiaCod('E02')).toBe('TUBO');
    expect(familiaCod('E78')).toBe('TUBO');
    expect(familiaCod('E24')).toBe('PESO');
    expect(familiaCod('E44')).toBe('PESO');
    expect(familiaCod('E13')).toBe('PESO');
    expect(familiaCod('E30')).toBe('CENEFA');
    expect(familiaCod('E26')).toBe('CENEFA');
    expect(familiaCod('E32')).toBe('PERFIL');
    expect(familiaCod('E41')).toBe('PERFIL');
    expect(familiaCod('E50')).toBe('PERFIL');
    expect(familiaCod('VER63')).toBe('VERTICAL');
    expect(familiaCod('SML04')).toBe('BEEBLACK');
    // El typo histórico SLM01/02/03 de la tabla insumos cae igual en beeblack.
    expect(familiaCod('SLM01')).toBe('BEEBLACK');
    expect(familiaCod('XXX')).toBe('OTRO');
    expect(familiaCod('')).toBe('OTRO');
    expect(familiaCod(null)).toBe('OTRO');
  });

  it('tolera espacios y minúsculas', () => {
    expect(familiaCod(' e 02 ')).toBe('TUBO');
    expect(familiaCod('ver61')).toBe('VERTICAL');
  });
});

describe('orden de ubicaciones', () => {
  it('ordena numéricamente: A4 < A27 < A51 < B1 < L02', () => {
    const ordenadas = ['L02', 'A27', 'B1', 'A4', 'A51'].sort(compararColmenas);
    expect(ordenadas).toEqual(['A4', 'A27', 'A51', 'B1', 'L02']);
  });

  it('sectorDeColmena toma el prefijo de letras', () => {
    expect(sectorDeColmena('A27')).toBe('A');
    expect(sectorDeColmena('L02')).toBe('L');
    expect(sectorDeColmena('b1')).toBe('B');
    expect(sectorDeColmena('7')).toBe('?');
  });
});

describe('notaSlot — slots reservados del optimizador', () => {
  it('marca pesos, largos y virtuales', () => {
    expect(notaSlot('A27')).toBe('pesos');
    expect(notaSlot('A29')).toBe('pesos');
    expect(notaSlot('L01')).toBe('largos');
    expect(notaSlot('MESA')).toBe('virtual');
    expect(notaSlot('A4')).toBeNull();
  });
});

describe('agruparPorColmena', () => {
  it('agrupa por ubicación y sector, con conteo y metros', () => {
    const sectores = agruparPorColmena([
      tubo({ n_colmena: 'A4', cod: 'E02', medida_cm: 200 }),
      tubo({ n_colmena: 'A4', cod: 'E02', medida_cm: 150 }),
      tubo({ n_colmena: 'A27', cod: 'E24', medida_cm: 100 }),
      tubo({ n_colmena: 'L02', cod: 'VER63', medida_cm: 500 }),
    ]);
    expect(sectores.map((s) => s.sector)).toEqual(['A', 'L']);
    const a = sectores[0];
    expect(a.total).toBe(3);
    expect(a.estantes.map((e) => e.colmena)).toEqual(['A4', 'A27']);
    expect(a.estantes[0].tubos).toHaveLength(2);
    expect(a.estantes[0].metros).toBeCloseTo(3.5, 5);
    expect(a.estantes[0].familiaDominante).toBe('TUBO');
    expect(a.estantes[1].nota).toBe('pesos');
    expect(sectores[1].estantes[0].familiaDominante).toBe('VERTICAL');
  });

  it('los tubos sin ubicación caen a un sector propio, AL FINAL (no se esconden)', () => {
    const sectores = agruparPorColmena([
      tubo({ n_colmena: null, cod: 'E02' }),
      tubo({ n_colmena: 'B1', cod: 'E02' }),
    ]);
    expect(sectores.map((s) => s.sector)).toEqual(['B', '?']);
    expect(sectores[1].estantes[0].colmena).toBe('SIN UBICACIÓN');
    expect(sectores[1].total).toBe(1);
  });

  it('familiaDominante gana la más frecuente del estante', () => {
    expect(
      familiaDominante([tubo({ cod: 'E02' }), tubo({ cod: 'E30' }), tubo({ cod: 'E30' })]),
    ).toBe('CENEFA');
  });
});

describe('antigüedad desde tubos_historial (created_at de la colmena NO sirve)', () => {
  const HOY = '2026-08-03T12:00:00Z';

  it('mapaPrimerIngreso se queda con el evento más antiguo por tubo', () => {
    const m = mapaPrimerIngreso([
      { tubo_raiz_id: 'u1', created_at: '2026-05-10T00:00:00Z' },
      { tubo_raiz_id: 'u1', created_at: '2026-01-02T00:00:00Z' },
      { tubo_raiz_id: 'u2', created_at: '2026-07-30T00:00:00Z' },
      { tubo_raiz_id: null, created_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(m.get('u1')).toBe('2026-01-02T00:00:00Z');
    expect(m.get('u2')).toBe('2026-07-30T00:00:00Z');
    expect(m.size).toBe(2);
  });

  it('usa el historial, NO el created_at que el sync del optimizador renueva', () => {
    // created_at reciente (lo pisó el último sync) pero ingreso real viejo.
    const t = tubo({ tubo_raiz_id: 'u1', created_at: '2026-08-01T00:00:00Z' });
    const ingresos = mapaPrimerIngreso([
      { tubo_raiz_id: 'u1', created_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(diasEnColmena(t, ingresos, HOY)).toBe(214);
    expect(enAlerta(t, ingresos, HOY)).toBe(true);
  });

  it('sin evento de ingreso no inventa antigüedad', () => {
    const t = tubo({ tubo_raiz_id: 'u9', created_at: '2020-01-01T00:00:00Z' });
    expect(diasEnColmena(t, new Map(), HOY)).toBeNull();
    expect(enAlerta(t, new Map(), HOY)).toBe(false);
  });

  it('un tubo reciente no está en alerta', () => {
    const t = tubo({ tubo_raiz_id: 'u1' });
    const ingresos = new Map([['u1', '2026-07-30T00:00:00Z']]);
    expect(enAlerta(t, ingresos, HOY)).toBe(false);
  });
});

describe('coincideBusqueda', () => {
  const t = tubo({ n_colmena: 'A27', cod: 'E24', medida_cm: 213.5 });
  it('busca por código, ubicación o medida', () => {
    expect(coincideBusqueda(t, 'e24')).toBe(true);
    expect(coincideBusqueda(t, 'a27')).toBe(true);
    expect(coincideBusqueda(t, '213')).toBe(true);
    expect(coincideBusqueda(t, 'E02')).toBe(false);
    expect(coincideBusqueda(t, '  ')).toBe(false);
  });
});
