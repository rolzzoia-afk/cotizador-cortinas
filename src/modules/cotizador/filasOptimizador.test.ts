import { describe, expect, it } from 'vitest';
import { filasOptimizadorDeOT, tieneAgrupacionManual } from './filasOptimizador';
import type { CatalogoProductos } from './types';
import type { OT, VentanaItem } from '@/modules/ots/types';

const cat: CatalogoProductos = {
  'BK 18': {
    cod: 'BK 18',
    producto: 'ROLLER BLACKOUT DELUX',
    tipo: 'DELUX',
    descripcion: '',
    precio: 0,
    anchoRollo: 2.98,
  },
  'SC 64': {
    cod: 'SC 64',
    producto: 'ROLLER SCREEN PREMIUM',
    tipo: 'PREMIUM',
    descripcion: '',
    precio: 0,
    anchoRollo: 2.98,
  },
};

const VENTANAS: VentanaItem[] = [
  {
    id: 'v1',
    ubicacion: 'Living',
    codInt: 'BK 18',
    producto: 'ROLLER BLACKOUT DELUX',
    tipo: 'DELUX',
    categoria: 'ROL',
    grupoId: null,
    alto: 1.8,
    precio: 0,
    cantidad: 1,
    panos: [{ ancho: 1.4, alto: 1.8 }],
  },
  {
    id: 'v2',
    ubicacion: 'Comedor',
    codInt: 'SC 64',
    producto: 'ROLLER SCREEN PREMIUM',
    tipo: 'PREMIUM',
    categoria: 'ROL',
    grupoId: null,
    alto: 1.8,
    precio: 0,
    cantidad: 1,
    panos: [{ ancho: 1.45, alto: 1.8 }],
  },
];

function ot(ventanas: VentanaItem[], optimizerRows?: unknown[]): OT {
  return {
    id: 'ot1',
    estado: 'produccion',
    subEtapa: null,
    datosGenerales: { ot: '3197', cliente: 'Constanza', optimizerRows },
    storeVentanas: ventanas,
    cotizacionCount: 0,
    fechaCreacion: '',
    fechaModificacion: '',
    notas: '',
    totalConIva: 0,
  };
}

describe('tieneAgrupacionManual', () => {
  it('la letra «?» es «sin asignar», no una agrupación', () => {
    expect(tieneAgrupacionManual([{ junto: '?' }] as never)).toBe(false);
    expect(tieneAgrupacionManual([{ junto: '' }] as never)).toBe(false);
    expect(tieneAgrupacionManual([{ junto: 'A' }] as never)).toBe(true);
  });

  it('basta con que UNA fila esté agrupada', () => {
    expect(tieneAgrupacionManual([{ junto: '' }, { junto: 'B' }] as never)).toBe(true);
  });
});

describe('filasOptimizadorDeOT', () => {
  it('una OT sin ventanas no tiene filas', () => {
    expect(filasOptimizadorDeOT(ot([]), cat)).toEqual([]);
  });

  it('una fila por paño, con la tela de cada cortina', () => {
    const filas = filasOptimizadorDeOT(ot(VENTANAS), cat);
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.codInt)).toEqual(['BK 18', 'SC 64']);
    expect(filas.map((f) => f.ventanaId)).toEqual(['v1', 'v2']);
  });

  it('sin plan guardado reparte los paños sola', () => {
    const filas = filasOptimizadorDeOT(ot(VENTANAS), cat);
    // Nadie las agrupó a mano, así que salen con letra asignada.
    expect(filas.every((f) => f.junto && f.junto !== '?')).toBe(true);
  });

  it('respeta lo que el dimensionador agrupó a mano', () => {
    const frescas = filasOptimizadorDeOT(ot(VENTANAS), cat);
    // Las dos cortinas puestas en el MISMO paño a mano, aunque sean de telas
    // distintas: manda lo guardado, no el reparto automático.
    const guardado = frescas.map((f) => ({ ...f, junto: 'Z' }));
    const filas = filasOptimizadorDeOT(ot(VENTANAS, guardado), cat);
    expect(filas.map((f) => f.junto)).toEqual(['Z', 'Z']);
  });

  it('un plan guardado de otro tamaño se descarta: manda la OT de hoy', () => {
    // Se agregó una cortina después de guardar: el plan viejo ya no calza y
    // aplicarlo por índice pondría las medidas de una cortina en otra.
    const guardado = [{ junto: 'Z', codInt: 'XX' }];
    const filas = filasOptimizadorDeOT(ot(VENTANAS, guardado), cat);
    expect(filas.map((f) => f.codInt)).toEqual(['BK 18', 'SC 64']);
  });
});
