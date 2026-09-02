import { describe, expect, it } from 'vitest';
import { COLORES_VENTANA, colorVentana, grupoVentanasDe } from './grupoVentanas';
import type { Ventana } from '../types';

const v = (
  id: string | number,
  muro?: { muroId?: string | null; muroTotal?: number; muroPos?: number },
): Ventana => ({ id, ubicacion: 'LIVING', panos: [], ...muro }) as unknown as Ventana;

describe('grupoVentanasDe', () => {
  it('sin muroId la cortina es individual: el vidrio va limpio', () => {
    const g = grupoVentanasDe([v('a')], v('a'));
    expect(g.total).toBe(1);
    expect(g.indice).toBe(0);
  });

  it('la primera de «2 ventanas» ya dibuja las 2: su lugar y uno vacío', () => {
    const g = grupoVentanasDe([], v('a', { muroId: 'm', muroTotal: 2, muroPos: 0 }));
    expect(g.total).toBe(2);
    expect(g.indice).toBe(0);
    expect(g.miembros[1]).toEqual({ id: null, actual: false });
  });

  it('en plena cadena: la guardada en su lugar, la hermana (sin pos) en el libre', () => {
    const guardada = v('a', { muroId: 'm', muroTotal: 2, muroPos: 0 });
    const hermana = v('b', { muroId: 'm', muroTotal: 2 }); // sin muroPos
    const g = grupoVentanasDe([guardada], hermana);
    expect(g.total).toBe(2);
    expect(g.indice).toBe(1);
    expect(g.miembros.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('VOLVER a la cortina 1 a media carga NO desarma el muro: la 2 queda vacía', () => {
    // El bug que motivó persistir el muro: con la hermana 2 sin guardar, abrir
    // la 1 la mostraba como ventana individual.
    const guardada = v('a', { muroId: 'm', muroTotal: 2, muroPos: 0 });
    const g = grupoVentanasDe([guardada], guardada);
    expect(g.total).toBe(2);
    expect(g.indice).toBe(0);
    expect(g.miembros[1]).toEqual({ id: null, actual: false });
  });

  it('se puede PARTIR por la ventana 2: la actual en el lugar 1 y el 0 vacío', () => {
    const actual = v('a', { muroId: 'm', muroTotal: 2, muroPos: 1 });
    const g = grupoVentanasDe([], actual);
    expect(g.total).toBe(2);
    expect(g.indice).toBe(1);
    expect(g.miembros[0]).toEqual({ id: null, actual: false });
  });

  it('otra cortina con OTRO muro (o sin muro) no se mete al grupo', () => {
    const g = grupoVentanasDe(
      [v('x', { muroId: 'otro', muroTotal: 2, muroPos: 0 }), v('y')],
      v('a', { muroId: 'm', muroTotal: 2, muroPos: 0 }),
    );
    expect(g.total).toBe(2);
    expect(g.miembros.map((m) => m.id)).toEqual(['a', null]);
  });

  it('una réplica extra agranda el muro en vez de perderse', () => {
    const store = [
      v('a', { muroId: 'm', muroTotal: 2, muroPos: 0 }),
      v('b', { muroId: 'm', muroTotal: 2, muroPos: 1 }),
      v('c', { muroId: 'm', muroTotal: 2 }), // replicada, sin lugar
    ];
    const g = grupoVentanasDe(store, store[2]);
    expect(g.total).toBe(3);
    expect(g.miembros.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(g.indice).toBe(2);
  });

  it('dos con la MISMA posición no se pisan: la segunda cae al lugar libre', () => {
    const store = [
      v('a', { muroId: 'm', muroTotal: 2, muroPos: 0 }),
      v('b', { muroId: 'm', muroTotal: 2, muroPos: 0 }),
    ];
    const g = grupoVentanasDe(store, store[1]);
    expect(g.miembros.map((m) => m.id)).toEqual(['a', 'b']);
    expect(g.indice).toBe(1);
  });

  it('la abierta ocupa SU lugar aunque el editor traiga cambios sin guardar', () => {
    const guardada = v('b', { muroId: 'm', muroTotal: 2, muroPos: 1 });
    const enEdicion = v('b', { muroId: 'm', muroTotal: 2, muroPos: 1 });
    const g = grupoVentanasDe([v('a', { muroId: 'm', muroTotal: 2, muroPos: 0 }), guardada], enEdicion);
    expect(g.total).toBe(2);
    expect(g.indice).toBe(1);
    expect(g.miembros.filter((m) => m.actual)).toHaveLength(1);
  });

  it('ids numéricos y string se comparan como iguales (OTs del legacy)', () => {
    const g = grupoVentanasDe([v(7, { muroId: 'm', muroTotal: 2, muroPos: 0 })], v('7', {
      muroId: 'm',
      muroTotal: 2,
      muroPos: 0,
    }));
    expect(g.miembros.filter((m) => m.actual)).toHaveLength(1);
    expect(g.total).toBe(2);
  });
});

describe('colorVentana', () => {
  it('cada ventana del grupo tiene su color y la paleta cicla', () => {
    expect(colorVentana(0)).toBe(COLORES_VENTANA[0]);
    expect(colorVentana(1)).toBe(COLORES_VENTANA[1]);
    expect(colorVentana(COLORES_VENTANA.length)).toBe(COLORES_VENTANA[0]);
  });

  it('los colores del grupo no repiten los de PAÑO (verde #22c55e / amarillo #eab308)', async () => {
    const { PANO_COLORS } = await import('../fase2');
    const deVentana = new Set(COLORES_VENTANA.map((c) => c.toLowerCase()));
    for (const p of PANO_COLORS.slice(0, 2)) {
      expect(deVentana.has(p.hex.toLowerCase())).toBe(false);
    }
  });
});
