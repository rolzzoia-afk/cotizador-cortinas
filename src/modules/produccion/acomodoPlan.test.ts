import { describe, expect, it } from 'vitest';
import { bandasDeLayout, type GrupoRollo, type Placed, type Plan } from '@/modules/cotizador/planCorte';
import type { PanoDibujado } from '@/modules/cotizador/layoutPano';
import { panosDeColmena, panosDelPlan, resumenAcomodo } from './acomodoPlan';
import { libresClasificados } from '@/modules/cotizador/libresPano';

const pieza = (
  nombre: string,
  px: number,
  py: number,
  pw: number,
  ph: number,
  invertida = false,
): Placed => ({
  id: nombre,
  nombre,
  codInt: 'SC 65',
  otId: 'ot-1',
  otNum: '3300',
  // Una invertida ya nace con las medidas cambiadas: `w`/`h` son como se apoya.
  w: pw,
  h: ph,
  px,
  py,
  pw,
  ph,
  invertida,
  failed: false,
});

// El acomodo del demo: VENTANAL (184×285) con BAÑO y COCINA apiladas al lado.
const grupo = (extra: Partial<GrupoRollo> = {}): GrupoRollo => ({
  codInt: 'SC 65',
  placed: [
    pieza('VENTANAL 1', 0, 0, 184, 285),
    pieza('BAÑO 1', 184, 0, 94, 125),
    pieza('COCINA', 184, 125, 94, 125),
  ],
  anchoUtil: 298,
  altoUtil: 285,
  anchoCorte: 300,
  altoCorte: 287,
  efic: 89,
  sobInterno: null,
  ...extra,
});

const plan = (rollo: GrupoRollo[]): Plan => ({
  sobrantes: [],
  rollo,
  sinStock: [],
  otsIncluidas: [],
});

const clasico = (altoPanoCm: number, colmena = ''): PanoDibujado => ({
  pano: 1,
  letra: 'A',
  codInt: 'SC 65',
  producto: 'ROLLER SCREEN PREMIUM',
  anchoRolloCm: 298,
  altoPanoCm,
  piezas: [],
  cortes: [],
  colmena,
  esVertical: false,
  sobrante: null,
  libres: [],
});

describe('panosDelPlan', () => {
  it('traduce cada bajada de rollo con sus piezas apiladas donde el plan las puso', () => {
    const [p] = panosDelPlan(plan([grupo()]));
    expect(p.letra).toBe('R1');
    expect(p.anchoRolloCm).toBe(300);
    expect(p.altoPanoCm).toBe(287);
    expect(p.piezas.map((x) => x.nombre)).toEqual(['VENTANAL 1', 'BAÑO 1', 'COCINA']);
    // COCINA quedó DEBAJO de BAÑO 1: mismo x, py > 0.
    expect(p.piezas[2]).toMatchObject({ px: 184, py: 125, pw: 94, ph: 125 });
  });

  it('la franja del costado sale clasificada con el criterio del cierre del corte', () => {
    const [p] = panosDelPlan(plan([grupo()]));
    // útil 298 − maxX 278 = 20 de ancho → merma.
    expect(p.sobrante).toMatchObject({ anchoCm: 20, altoCm: 287, clase: 'merma' });
  });

  it('cuenta TODA la tela libre, no solo la franja del costado', () => {
    const [p] = panosDelPlan(plan([grupo()]));
    // Franja de 20 (298 útiles − 278) entera, y el hueco bajo la columna
    // apilada (94 de ancho × 35 de alto): ese es el que salía en negro.
    expect(p.libres).toHaveLength(2);
    expect(p.libres).toContainEqual(
      expect.objectContaining({ x: 278, anchoCm: 20, altoCm: 285, clase: 'merma' }),
    );
    expect(p.libres).toContainEqual(
      expect.objectContaining({ x: 184, y: 250, anchoCm: 94, altoCm: 35, clase: 'merma' }),
    );
  });

  it('trae la secuencia de cortes de guillotina del acomodo apilado', () => {
    const [p] = panosDelPlan(plan([grupo()]));
    expect(p.cortes).not.toBeNull();
    // Al menos el longitudinal que separa el ventanal y el transversal de la columna.
    expect(p.cortes!.length).toBeGreaterThanOrEqual(2);
    expect(p.cortes!.some((c) => c.eje === 'longitudinal')).toBe(true);
    expect(p.cortes!.some((c) => c.eje === 'transversal')).toBe(true);
  });

  it('la INVERTIDA de la ficha se dibuja acostada y con las medidas de la ficha', () => {
    // Se apoya 250 de ancho × 344 de largo; como cortina se vendió 344 × 250.
    const g = grupo({
      placed: [pieza('GALERIA', 0, 0, 250, 344, true)],
      altoUtil: 344,
      altoCorte: 346,
    });
    const [p] = panosDelPlan(plan([g]));
    expect(p.piezas[0].invertida).toBe(true);
    expect(p.piezas[0].anchoCm).toBe(344);
    expect(p.piezas[0].altoCorteCm).toBe(250);
    expect(p.piezas[0].pw).toBe(250);
  });

  it('el acomodo dibuja lo que el plan armó: ninguna cortina se gira acá', () => {
    const g = grupo({
      placed: [pieza('HIJA A', 0, 0, 259, 195), pieza('HIJA B', 0, 195, 90, 170)],
      altoUtil: 365,
      altoCorte: 367,
    });
    const [p] = panosDelPlan(plan([g]));
    expect(p.piezas.every((x) => !x.invertida)).toBe(true);
    expect(p.altoPanoCm).toBe(367);
    expect(p.piezas.map((x) => [x.nombre, x.py])).toEqual([
      ['HIJA A', 0],
      ['HIJA B', 195],
    ]);
    expect(p.sobrante).toMatchObject({ anchoCm: 39, altoCm: 367 });
  });

  it('usa el nombre de producto del catálogo cuando se le entrega', () => {
    const [p] = panosDelPlan(
      plan([grupo()]),
      undefined,
      new Map([['SC 65', 'ROLLER SCREEN PREMIUM']]),
    );
    expect(p.producto).toBe('ROLLER SCREEN PREMIUM');
  });

  it('plan vacío → sin paños', () => {
    expect(panosDelPlan(plan([]))).toEqual([]);
  });
});

describe('resumenAcomodo', () => {
  it('compara metros de rollo: el demo ahorra 123 cm (18 %)', () => {
    const r = resumenAcomodo(
      panosDelPlan(plan([grupo({ altoCorte: 572 })])),
      [clasico(285), clasico(285), clasico(125)],
    );
    expect(r).toMatchObject({ mPlan: 5.72, mClasico: 6.95, ahorroCm: 123, pct: 18 });
  });

  it('los paños de colmena no cuentan como rollo del acomodo clásico', () => {
    const r = resumenAcomodo(panosDelPlan(plan([grupo()])), [
      clasico(285),
      clasico(200, 'A-27 · 178X210'),
    ]);
    expect(r?.mClasico).toBe(2.85);
  });

  it('sin paños de un lado no hay comparación', () => {
    expect(resumenAcomodo([], [clasico(285)])).toBeNull();
    expect(resumenAcomodo(panosDelPlan(plan([grupo()])), [])).toBeNull();
  });
});

describe('bandasDeLayout — paños que baja un acomodo', () => {
  it('cortinas al hilo, aunque tengan altos distintos: UN paño', () => {
    expect(bandasDeLayout([pieza('A', 0, 0, 150, 260), pieza('B', 150, 0, 100, 180)])).toBe(1);
  });

  it('una costura de lado a lado es otro paño', () => {
    // A y B arriba (alto 200), C abajo a todo el ancho: la mesa baja dos trozos.
    expect(
      bandasDeLayout([pieza('A', 0, 0, 149, 200), pieza('B', 149, 0, 149, 200), pieza('C', 0, 200, 298, 100)]),
    ).toBe(2);
  });

  it('columnas desfasadas no tienen costura completa: UN paño cortado a lo largo', () => {
    // Col 1: A(200) sobre C(100); col 2: D(100) sobre B(200). Mismo alto (300)
    // que el acomodo en dos bandas, pero un solo trozo bajado del rollo.
    expect(
      bandasDeLayout([
        pieza('A', 0, 0, 149, 200),
        pieza('C', 0, 200, 149, 100),
        pieza('D', 149, 0, 149, 100),
        pieza('B', 149, 100, 149, 200),
      ]),
    ).toBe(1);
  });

  it('las piezas que no entraron no cuentan; sin piezas, cero', () => {
    const fallida = { ...pieza('X', 0, 0, 100, 100), failed: true, px: -1, py: -1 };
    expect(bandasDeLayout([pieza('A', 0, 0, 150, 260), fallida])).toBe(1);
    expect(bandasDeLayout([])).toBe(0);
  });
});

describe('resumenAcomodo — primero los paños', () => {
  it('el demo baja de 3 tiros a 1 paño (ventanal con la columna al lado)', () => {
    const r = resumenAcomodo(panosDelPlan(plan([grupo()])), [clasico(285), clasico(285), clasico(125)]);
    expect(r).toMatchObject({ panosPlan: 1, panosClasico: 3, ahorroPanos: 2 });
  });

  it('los paños de colmena no cuentan como paños bajados del rollo', () => {
    const r = resumenAcomodo(panosDelPlan(plan([grupo()])), [clasico(285), clasico(200, 'A-27 · 178X210')]);
    expect(r?.panosClasico).toBe(1);
  });
});

describe('panosDeColmena — el trozo real que hay en el rack', () => {
  const puestas = [pieza('COCINA 1', 0, 0, 290, 120), pieza('COCINA 2', 0, 120, 290, 120)];
  const conPanos = (): Plan => ({
    sobrantes: [
      {
        sobrante: {
          _docId: 'd1',
          cod: 'SC 65',
          ancho: 300,
          alto: 250,
          ubicacion: 'MAPA M2-31',
          tipo: 'SOBRANTE',
          creadoEn: '',
        },
        placed: puestas,
        regla: 2,
        uw: 300,
        uh: 250,
        libres: libresClasificados(puestas, 300, 250),
        cortes: [],
        costo: 0,
      },
    ],
    rollo: [],
    sinStock: [],
    otsIncluidas: [],
  });

  it('dibuja el paño con SU medida, no con el ancho del rollo', () => {
    const [p] = panosDeColmena(conPanos());
    expect(p.anchoRolloCm).toBe(300);
    expect(p.altoPanoCm).toBe(250);
    expect(p.colmena).toBe('MAPA M2-31 · 300X250');
    expect(p.letra).toBe('C1');
  });

  it('las cortinas van donde el empacador las puso (apiladas incluidas)', () => {
    const [p] = panosDeColmena(conPanos());
    expect(p.piezas.map((x) => [x.nombre, x.px, x.py])).toEqual([
      ['COCINA 1', 0, 0],
      ['COCINA 2', 0, 120],
    ]);
  });

  it('lo que queda del paño viene contado (no se recalcula del rollo)', () => {
    const [p] = panosDeColmena(conPanos());
    expect(p.libres.map((r) => `${r.anchoCm}x${r.altoCm}`).sort()).toEqual(['10x250', '290x10']);
    expect(p.sobrante).toBeNull();
  });

  it('en el rack también la única acostada es la INVERTIDA de la ficha', () => {
    const plan = conPanos();
    plan.sobrantes[0].placed = [pieza('PPAL', 0, 0, 275, 150, true)];
    const [p] = panosDeColmena(plan);
    expect(p.piezas[0].invertida).toBe(true);
    // Se apoya 275 × 150; como cortina se vendió 150 de ancho × 275 de alto.
    expect(p.piezas[0].anchoCm).toBe(150);
    expect(p.piezas[0].altoCorteCm).toBe(275);
  });

  it('el rótulo se adapta a la pizarra que lo muestra (el lote no dice «OT»)', () => {
    const plan = conPanos();
    plan.sobrantes[0].placed = [pieza('OT3215·PPAL', 0, 0, 290, 120)];
    const [p] = panosDeColmena(plan, undefined, undefined, (n) => n.replace(/^OT#?/, ''));
    expect(p.piezas[0].nombre).toBe('3215·PPAL');
  });
});
