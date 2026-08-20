import { describe, expect, it } from 'vitest';
import {
  FORMAS_VENTANA,
  aplicarSeleccion,
  formaDef,
  rotuloForma,
  ventanaHermana,
} from './selectorVentanas';
import type { Pano, Ventana } from '../types';

const pano = (over: Partial<Pano> = {}): Pano =>
  ({
    ancho: 1.85,
    alto: 2.3,
    color: 'NEGRO',
    colorMecanismo: 'NEGRO',
    materialTipo: 'CONCRETO',
    superficie: 'TECHO',
    mecanismo: 'SINFLEX NEGRO [MEC 34]',
    tuberia: '38mm [E02]',
    codCadena: 'CAD 03',
    cenefa: 'Ovalada',
    tipoTela: 'BK',
    ...over,
  }) as unknown as Pano;

const vent = (over: Partial<Ventana> = {}, panos: Pano[] = [pano()]): Ventana =>
  ({
    id: 'v1',
    ubicacion: 'LIVING IZQ',
    categoria: 'ROL',
    codInt: 'BK 18',
    producto: 'ROLLER BLACKOUT DELUX',
    tipo: 'DELUX',
    color: 'NEGRO',
    alto: 2.3,
    precio: 120000,
    cantidad: 1,
    grupoId: null,
    panos,
    ...over,
  }) as unknown as Ventana;

/** La cortina en blanco que crea la página antes de pasar por el selector. */
const enBlanco = (): Ventana =>
  vent({ id: 'nueva', ubicacion: '', categoria: '', codInt: '', producto: '', tipo: '' }, [
    pano({ ancho: 0, alto: 0, mecanismo: '', tuberia: '', codCadena: '', tipoTela: '' }),
  ]);

describe('formas de ventana', () => {
  it('cada forma trae las caras que le corresponden: bow 3, L 2, triangular 1', () => {
    expect(formaDef('bow')?.panos).toBe(3);
    expect(formaDef('ele')?.panos).toBe(2);
    expect(formaDef('triangular')?.panos).toBe(1);
    // La «ventana en U» se eliminó (2026-08-19): era lo mismo que un bow window.
    expect(FORMAS_VENTANA).toHaveLength(3);
  });

  it('rotuloForma devuelve el rótulo del modelo, y vacío si la ventana es recta', () => {
    expect(rotuloForma({ formaVentana: 'bow' })).toBe('BOW WINDOW');
    expect(rotuloForma({ formaVentana: null })).toBe('');
    expect(rotuloForma(undefined)).toBe('');
  });

  it('todas las formas tienen etiqueta y rótulo, y el rótulo va en mayúsculas', () => {
    for (const f of FORMAS_VENTANA) {
      expect(f.etiqueta.length).toBeGreaterThan(0);
      expect(f.rotulo).toBe(f.rotulo.toUpperCase());
    }
  });
});

describe('aplicarSeleccion — estándar', () => {
  it('N ventanas = N cortinas separadas: la primera con 1 paño y N−1 hermanas', () => {
    const r = aplicarSeleccion(enBlanco(), { tipo: 'estandar', cantidad: 3 });
    expect(r.ventana.panos).toHaveLength(1);
    expect(r.hermanasPendientes).toBe(2);
  });

  it('1 ventana no deja hermanas ni anota forma', () => {
    const r = aplicarSeleccion(enBlanco(), { tipo: 'estandar', cantidad: 1 });
    expect(r.hermanasPendientes).toBe(0);
    expect(r.ventana.formaVentana).toBeFalsy();
  });

  it('una cantidad absurda se acota en vez de crear cien fichas', () => {
    expect(aplicarSeleccion(enBlanco(), { tipo: 'estandar', cantidad: 999 }).hermanasPendientes)
      .toBe(11);
    expect(aplicarSeleccion(enBlanco(), { tipo: 'estandar', cantidad: 0 }).hermanasPendientes)
      .toBe(0);
  });
});

describe('aplicarSeleccion — especial', () => {
  it('la ventana especial es UNA cortina: fija los paños del modelo y lo anota', () => {
    const r = aplicarSeleccion(enBlanco(), { tipo: 'especial', forma: 'bow' });
    expect(r.ventana.panos).toHaveLength(3);
    expect(r.ventana.formaVentana).toBe('bow');
  });

  it('no deja hermanas pendientes: el ángulo es una sola ventana', () => {
    const r = aplicarSeleccion(enBlanco(), { tipo: 'especial', forma: 'ele' });
    expect(r.hermanasPendientes).toBe(0);
  });

  it('la triangular queda con su único paño', () => {
    const r = aplicarSeleccion(enBlanco(), { tipo: 'especial', forma: 'triangular' });
    expect(r.ventana.panos).toHaveLength(1);
    expect(r.ventana.formaVentana).toBe('triangular');
  });
});

describe('ventanaHermana', () => {
  const origen = vent();

  it('copia la ficha completa: tela, categoría, mecanismo y color', () => {
    const h = ventanaHermana(origen);
    expect(h.codInt).toBe('BK 18');
    expect(h.categoria).toBe('ROL');
    expect(h.color).toBe('NEGRO');
    expect(h.panos[0].mecanismo).toBe('SINFLEX NEGRO [MEC 34]');
    expect(h.panos[0].cenefa).toBe('Ovalada');
  });

  it('comparte la ubicación: es otra cortina de la MISMA ventana', () => {
    expect(ventanaHermana(origen).ubicacion).toBe('LIVING IZQ');
  });

  it('nace con id propio y sin las medidas del origen', () => {
    const h = ventanaHermana(origen);
    expect(h.id).not.toBe(origen.id);
    expect(h.panos[0].ancho).toBeFalsy();
    expect(h.panos[0].alto).toBeFalsy();
    expect(h.alto).toBe(0);
  });

  it('no hereda el conjunto ni el precio del origen', () => {
    const h = ventanaHermana(vent({ grupoId: 'g1', grupoOrden: 2 }));
    expect(h.grupoId).toBeNull();
    expect(h.precio).toBe(0);
    expect(h.subtotal).toBeUndefined();
  });

  it('es UNA cortina: no hereda el multiplicador comercial del origen', () => {
    // Si el origen dice «3 iguales acá», heredarlo cobraría 3 por cada hermana.
    expect(ventanaHermana(vent({ cantidad: 3 })).cantidad).toBe(1);
  });

  it('una cortina idéntica lleva los MISMOS paños, en blanco', () => {
    // Un ventanal de 2 paños replicado como cortina de 1 paño no es la misma.
    const h = ventanaHermana(vent({}, [pano(), pano({ ancho: 1.2 })]));
    expect(h.panos).toHaveLength(2);
    expect(h.panos.every((p) => !p.ancho && !p.alto)).toBe(true);
    expect(h.panos[1].mecanismo).toBe('SINFLEX NEGRO [MEC 34]');
  });

  it('replicar una ventana especial conserva su forma y sus caras', () => {
    const h = ventanaHermana(vent({ formaVentana: 'bow' }, [pano(), pano(), pano()]));
    expect(h.formaVentana).toBe('bow');
    expect(h.panos).toHaveLength(3);
  });

  it('NO hereda el giro del corte: eso lo decide su propio ancho o su conjunto', () => {
    const h = ventanaHermana(vent({ grupoId: 'g1' }, [pano({ invertida: true } as never)]));
    expect(h.panos[0].invertida).toBeFalsy();
  });
});
