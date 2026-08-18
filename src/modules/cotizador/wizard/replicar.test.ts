import { describe, expect, it } from 'vitest';
import { replicarConfiguracion, replicarEnVentanas } from './replicar';
import type { Pano, Ventana } from '../types';

const pano = (over: Partial<Pano> = {}): Pano =>
  ({
    ancho: 1.5,
    alto: 2,
    color: 'BCO',
    colorMecanismo: 'BCO',
    materialTipo: 'CONCRETO',
    superficie: 'TECHO',
    mecanismo: 'SINFLEX BLANCO [MEC 33]',
    tuberia: '38mm [E02]',
    codCadena: 'CAD 03',
    codPeso: 'PCA 04',
    cenefa: 'No',
    tipoTela: 'BK',
    ...over,
  }) as unknown as Pano;

const vent = (over: Partial<Ventana> = {}, panos: Pano[] = [pano()]): Ventana =>
  ({
    id: 'v1',
    ubicacion: 'LIVING',
    categoria: 'ROL',
    codInt: 'BK 18',
    producto: 'ROLLER BLACKOUT DELUX',
    tipo: 'DELUX',
    color: 'BLANCO',
    alto: 2,
    precio: 120000,
    cantidad: 1,
    grupoId: null,
    panos,
    ...over,
  }) as unknown as Ventana;

describe('replicarConfiguracion', () => {
  const origen = vent();

  it('copia la ficha: tela, categoría y todo lo del paño', () => {
    const destino = vent({ id: 'v2', codInt: '', categoria: '' }, [
      pano({ ancho: 2.4, alto: 2.6, mecanismo: '', tuberia: '', codCadena: '', materialTipo: '' }),
    ]);
    const out = replicarConfiguracion(origen, destino);
    expect(out.codInt).toBe('BK 18');
    expect(out.categoria).toBe('ROL');
    expect(out.panos[0].mecanismo).toBe('SINFLEX BLANCO [MEC 33]');
    expect(out.panos[0].tuberia).toBe('38mm [E02]');
    expect(out.panos[0].materialTipo).toBe('CONCRETO');
  });

  it('NO pisa lo que se fue a medir: ancho y alto quedan como estaban', () => {
    const destino = vent({ id: 'v2' }, [pano({ ancho: 2.4, alto: 2.6 })]);
    const out = replicarConfiguracion(origen, destino);
    expect(out.panos[0].ancho).toBe(2.4);
    expect(out.panos[0].alto).toBe(2.6);
  });

  it('NO pisa la identidad de la ventana destino', () => {
    const destino = vent({ id: 'v2', ubicacion: 'DORMITORIO', grupoId: 'g9', grupoOrden: 2 });
    const out = replicarConfiguracion(origen, destino);
    expect(out.id).toBe('v2');
    expect(out.ubicacion).toBe('DORMITORIO');
    expect(out.grupoId).toBe('g9');
    expect(out.grupoOrden).toBe(2);
  });

  it('el precio del destino no se toca: lo recalcula la cotización', () => {
    const destino = vent({ id: 'v2', precio: 0 });
    expect(replicarConfiguracion(origen, destino).precio).toBe(0);
  });

  it('la altura de cierre del dúo es una medida de terreno: no se replica', () => {
    const o = vent({}, [pano({ cierreAlturaCm: 4 })]);
    const destino = vent({ id: 'v2' }, [pano({ cierreAlturaCm: 7 })]);
    expect(replicarConfiguracion(o, destino).panos[0].cierreAlturaCm).toBe(7);
  });

  it('el comentario para el taller es de esa cortina: no se replica', () => {
    const o = vent({}, [pano({ comentarioFinal: 'ojo con la viga' })]);
    const destino = vent({ id: 'v2' }, [pano({ comentarioFinal: '' })]);
    expect(replicarConfiguracion(o, destino).panos[0].comentarioFinal).toBe('');
  });

  it('el destino conserva su cantidad de paños', () => {
    const o = vent({}, [pano(), pano({ ancho: 1.1 })]);
    const destino = vent({ id: 'v2' }, [pano({ ancho: 3, mecanismo: '' })]);
    const out = replicarConfiguracion(o, destino);
    expect(out.panos).toHaveLength(1);
    expect(out.panos[0].ancho).toBe(3);
    expect(out.panos[0].mecanismo).toBe('SINFLEX BLANCO [MEC 33]');
  });

  it('si el destino tiene MÁS paños, los de sobra copian el último del origen', () => {
    const o = vent({}, [pano({ tipoTela: 'BK' })]);
    const destino = vent({ id: 'v2' }, [
      pano({ ancho: 1, tipoTela: '' }),
      pano({ ancho: 2, tipoTela: '' }),
    ]);
    const out = replicarConfiguracion(o, destino);
    expect(out.panos.map((p) => p.tipoTela)).toEqual(['BK', 'BK']);
    expect(out.panos.map((p) => p.ancho)).toEqual([1, 2]);
  });
});

describe('replicarEnVentanas', () => {
  it('solo toca las ventanas elegidas y nunca al origen', () => {
    const origen = vent({ id: 'v1' });
    const otras = [
      vent({ id: 'v2', codInt: '' }, [pano({ mecanismo: '' })]),
      vent({ id: 'v3', codInt: 'SC 64' }, [pano({ mecanismo: 'OTRO [MEC 34]' })]),
    ];
    const out = replicarEnVentanas([origen, ...otras], origen, ['v2']);
    expect(out[0]).toBe(origen);
    expect(out[1].codInt).toBe('BK 18');
    expect(out[2]).toBe(otras[1]); // v3 no estaba en la lista: intacta
  });

  it('incluir el origen en los destinos no lo altera', () => {
    const origen = vent({ id: 'v1' });
    const out = replicarEnVentanas([origen], origen, ['v1']);
    expect(out[0]).toBe(origen);
  });
});
