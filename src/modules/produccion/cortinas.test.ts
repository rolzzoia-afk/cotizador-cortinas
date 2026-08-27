import { describe, expect, it } from 'vitest';
import { cortinasDeOT } from './cortinas';
import type { OT, VentanaItem } from '@/modules/ots/types';

function ot(ventanas: VentanaItem[]): OT {
  return {
    id: 'ot1',
    estado: 'produccion',
    subEtapa: 'Prueba',
    datosGenerales: { ot: '3197' },
    storeVentanas: ventanas,
    cotizacionCount: 0,
    fechaCreacion: '',
    fechaModificacion: '',
    notas: '',
    totalConIva: 0,
  };
}

describe('cortinasDeOT', () => {
  it('una fila por PAÑO: tres paños son tres cortinas que se prueban aparte', () => {
    const lista = cortinasDeOT(
      ot([
        {
          id: 'v1',
          ubicacion: 'LIVING',
          producto: 'ROLLER SCREEN PREMIUM',
          codInt: 'SC 64',
          alto: 1.8,
          panos: [
            { ancho: 1.4, alto: 1.8 },
            { ancho: 1.45, alto: 1.8 },
            { ancho: 1.5, alto: 1.8 },
          ],
        },
      ]),
    );
    expect(lista).toHaveLength(3);
    expect(lista.map((c) => c.piezaId)).toEqual(['v1_0', 'v1_1', 'v1_2']);
    expect(lista.map((c) => c.rotulo)).toEqual(['1 de 3', '2 de 3', '3 de 3']);
  });

  it('una ventana de un solo paño no lleva rótulo', () => {
    const [c] = cortinasDeOT(
      ot([{ id: 'v9', ubicacion: 'COMEDOR', alto: 2, panos: [{ ancho: 1.2, alto: 2 }] }]),
    );
    expect(c.rotulo).toBe('');
    expect(c.piezaId).toBe('v9_0');
    expect(c.ancho).toBe(1.2);
    expect(c.alto).toBe(2);
  });

  it('la identidad es la misma que usa la hoja del cálculo general', () => {
    // `${ventanaId}_${panoIndex}` — si esto cambia, una cortina marcada en
    // Armado dejaría de ser la misma en Prueba.
    const [c] = cortinasDeOT(ot([{ id: 42, panos: [{ ancho: 1, alto: 1 }] }]));
    expect(c.piezaId).toBe('42_0');
  });

  it('una ventana sin paños igual aparece: no se puede perder una cortina', () => {
    const [c] = cortinasDeOT(ot([{ id: 'v3', ubicacion: 'PIEZA', alto: 2.1 }]));
    expect(c.piezaId).toBe('v3_0');
    expect(c.alto).toBe(2.1);
    expect(c.ancho).toBe(0);
  });

  it('sin ubicación lo dice, en vez de dejar la fila muda', () => {
    const [c] = cortinasDeOT(ot([{ id: 'v4', panos: [{ ancho: 1, alto: 1 }] }]));
    expect(c.ubicacion).toBe('Sin ubicación');
  });

  it('el color del paño le gana al de la ventana', () => {
    const [a, b] = cortinasDeOT(
      ot([
        {
          id: 'v5',
          color: 'BLANCO',
          panos: [
            { ancho: 1, alto: 1, color: 'GRIS' },
            { ancho: 1, alto: 1 },
          ],
        },
      ]),
    );
    expect(a.color).toBe('GRIS');
    expect(b.color).toBe('BLANCO');
  });

  it('medidas con basura no rompen la lista', () => {
    const [c] = cortinasDeOT(
      ot([{ id: 'v6', panos: [{ ancho: 'ancho?' as unknown as number, alto: '1,5' }] }]),
    );
    expect(c.ancho).toBe(0);
    expect(c.alto).toBe(1); // «1,5» con coma no es número: se lee lo que se puede
  });

  it('una OT vacía o nula devuelve una lista vacía', () => {
    expect(cortinasDeOT(null)).toEqual([]);
    expect(cortinasDeOT(ot([]))).toEqual([]);
  });
});
