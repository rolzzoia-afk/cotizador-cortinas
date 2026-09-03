import { describe, expect, it } from 'vitest';
import { consolidarInsumos } from './inventarioOT';
import type { FilaCalculo } from './calculoGeneral';
import type { Pano, Ventana } from './types';

// La hoja de inventario es lo que bodega picka. Acá se cubre solo la CADENA
// METÁLICA: es el primer insumo del sistema que se pide en METROS y no en
// unidades, y la diferencia la tiene que ver el bodeguero en el papel.
const ventana = (pano: Partial<Pano>, categoria = 'ROL'): Ventana =>
  ({
    id: 'v1',
    ubicacion: 'Living',
    categoria,
    codInt: 'SC 65',
    producto: 'ROLLER SCREEN',
    tipo: '',
    color: 'BCO',
    alto: 2.3,
    precio: 0,
    cantidad: 1,
    panos: [{ ancho: 1.5, alto: 2.3, color: 'BCO', ...pano }],
  }) as unknown as Ventana;

const fila = (piezaId = 'v1_0'): FilaCalculo =>
  ({ piezaId, ubicacion: 'Living', ancho: 1.5, alto: 2.3 }) as unknown as FilaCalculo;

describe('consolidarInsumos — cadena metálica', () => {
  const cadenaDe = (items: ReturnType<typeof consolidarInsumos>) =>
    items.find((i) => i.codigo === 'CAD13');

  it('sale en METROS (2 × el alto) y no como una unidad', () => {
    const items = consolidarInsumos([ventana({ cadenaMetalica: true })], [fila()]);
    expect(cadenaDe(items)).toMatchObject({ cantidad: 4.6, unidad: 'm' });
    expect(cadenaDe(items)?.descripcion).toBe('[CAD13] CADENA METÁLICA 4,6 M');
  });

  it('reemplaza a la plástica: no se pide una cadena de más', () => {
    const items = consolidarInsumos([ventana({ cadenaMetalica: true, codCadena: 'CAD13' })], [fila()]);
    const cadenas = items.filter((i) => (i.codigo || '').startsWith('CAD'));
    expect(cadenas).toHaveLength(1);
    expect(cadenas[0].codigo).toBe('CAD13');
  });

  it('dos cortinas suman metros en una sola línea', () => {
    const v = ventana({ cadenaMetalica: true });
    (v.panos as Pano[]).push({ ancho: 1.2, alto: 1.5, color: 'BCO', cadenaMetalica: true } as Pano);
    const items = consolidarInsumos([v], [fila(), fila('v1_1')]);
    expect(cadenaDe(items)?.cantidad).toBeCloseTo(7.6, 6);
  });

  it('sin el flag se pide la cadena de siempre, por unidad', () => {
    const items = consolidarInsumos([ventana({ codCadena: 'CAD03', largoCadena: '4mts', colorCadena: 'NEG' })], [fila()]);
    expect(cadenaDe(items)).toBeUndefined();
    expect(items.find((i) => i.codigo === 'CAD03')).toMatchObject({ cantidad: 1 });
  });
});
