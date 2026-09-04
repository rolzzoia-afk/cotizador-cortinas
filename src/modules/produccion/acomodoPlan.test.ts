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
  rot = false,
): Placed => ({
  id: nombre,
  nombre,
  codInt: 'SC 65',
  otId: 'ot-1',
  otNum: '3300',
  w: rot ? ph : pw,
  h: rot ? pw : ph,
  px,
  py,
  pw,
  ph,
  rot,
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
  tieneRotaciones: false,
  piezasRotadas: [],
  layoutVertical: null,
  altoVertical: null,
  eficVertical: 0,
  sobInternoV: null,
  decisiones: {},
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

  it('una cortina más ancha que el rollo va girada: no hay otra forma', () => {
    // El plan no tiene acomodo derecho (layoutVertical null): se dibuja el girado.
    const g = grupo({
      placed: [pieza('GALERIA', 0, 0, 250, 344, true)],
      altoUtil: 344,
      altoCorte: 346,
      tieneRotaciones: true,
      layoutVertical: null,
      altoVertical: null,
    });
    const [p] = panosDelPlan(plan([g]));
    // 344 de ancho no entra en los 298 útiles: la ficha ya la marca INVERTIDA,
    // así que se rotula invertida y no «girada por el acomodo».
    expect(p.piezas[0].invertida).toBe(true);
    expect(p.piezas[0].girada).toBe(false);
  });

  it('la que SÍ entraba derecha y el acomodo acostó va como GIRADA, no invertida', () => {
    // 184 de ancho entra de sobra en los 298 del rollo: si sale acostada es
    // decisión del acomodo. La ficha de Fase 1 no dice nada de eso.
    const g = grupo({
      placed: [pieza('BAÑO', 0, 0, 250, 184, true)],
      altoUtil: 250,
      altoCorte: 252,
      tieneRotaciones: true,
      layoutVertical: null,
      altoVertical: null,
    });
    const [p] = panosDelPlan(plan([g]));
    expect(p.piezas[0].girada).toBe(true);
    expect(p.piezas[0].invertida).toBe(false);
  });

  it('si el plan PROPONE girar para ahorrar rollo, acá se dibuja el acomodo derecho', () => {
    // HIJA A girada (195×259) con HIJA B al lado ahorra rollo, pero gira la
    // tela: el acomodo muestra la versión derecha (dos bandas, 365 de alto).
    const g = grupo({
      placed: [pieza('HIJA A', 0, 0, 195, 259, true), pieza('HIJA B', 195, 0, 90, 170)],
      altoUtil: 259,
      altoCorte: 261,
      tieneRotaciones: true,
      layoutVertical: [pieza('HIJA A', 0, 0, 259, 195), pieza('HIJA B', 0, 195, 90, 170)],
      altoVertical: 367,
    });
    const [p] = panosDelPlan(plan([g]));
    expect(p.piezas.every((x) => !x.invertida)).toBe(true);
    expect(p.altoPanoCm).toBe(367);
    expect(p.piezas.map((x) => [x.nombre, x.py])).toEqual([
      ['HIJA A', 0],
      ['HIJA B', 195],
    ]);
    // La franja se calcula sobre el acomodo derecho, no sobre el girado.
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
        tieneRotaciones: false,
        piezasRotadas: [],
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

  it('el giro dentro de un paño del rack es del ACOMODO, nunca la invertida de la ficha', () => {
    const plan = conPanos();
    // 150 de ancho entra en el rollo; lo que no entra es el paño de 250 de alto.
    plan.sobrantes[0].placed = [pieza('PPAL', 0, 0, 275, 150, true)];
    const [p] = panosDeColmena(plan);
    expect(p.piezas[0].girada).toBe(true);
    expect(p.piezas[0].invertida).toBe(false);
  });

  it('el rótulo se adapta a la pizarra que lo muestra (el lote no dice «OT»)', () => {
    const plan = conPanos();
    plan.sobrantes[0].placed = [pieza('OT3215·PPAL', 0, 0, 290, 120)];
    const [p] = panosDeColmena(plan, undefined, undefined, (n) => n.replace(/^OT#?/, ''));
    expect(p.piezas[0].nombre).toBe('3215·PPAL');
  });
});
