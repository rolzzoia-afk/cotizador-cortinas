import { describe, it, expect } from 'vitest';
import {
  deduccionesColmena,
  mermaSobrante,
  piezasColmenaSnapshot,
  retazoSugerido,
  salidasDeColmena,
} from './colmenaCorte';
import { libresClasificados } from './libresPano';
import type { GrupoSobrante, Placed, Plan } from './planCorte';

function placed(py: number, ph: number, pw = 100, id = 'p1', otId = '1'): Placed {
  return {
    id,
    nombre: 'OT1·Living',
    codInt: 'SC 65',
    otId,
    otNum: otId,
    w: pw,
    h: ph,
    px: 0,
    py,
    pw,
    ph,
    rot: false,
    failed: false,
  };
}

/**
 * Un grupo de colmena como lo arma el motor: los `libres` salen de la MISMA
 * función que usa el plan, así el test no inventa una geometría propia.
 */
function grupo(over: Partial<GrupoSobrante> = {}): GrupoSobrante {
  const base: GrupoSobrante = {
    sobrante: {
      _docId: 'd1',
      cod: 'SC 65',
      ancho: 200,
      alto: 420,
      ubicacion: 'A-1',
      tipo: 'SOBRANTE',
      creadoEn: '',
    },
    placed: [placed(0, 200, 140)],
    regla: 2,
    uw: 200,
    uh: 420,
    libres: [],
    cortes: [],
    tieneRotaciones: false,
    piezasRotadas: [],
    costo: 0,
    ...over,
  };
  return {
    ...base,
    libres: over.libres ?? libresClasificados(base.placed, base.uw, base.uh),
  };
}

function plan(sobrantes: GrupoSobrante[]): Plan {
  return { sobrantes, rollo: [], sinStock: [], otsIncluidas: [] };
}

describe('salidasDeColmena', () => {
  it('lista lo que queda del paño con el mismo formato que un corte de rollo', () => {
    // Paño 200×420, una cortina de 140×200 en la esquina: queda la tira del
    // costado (60×420) y la faja de abajo (140×220).
    const s = salidasDeColmena(grupo());
    expect(s.map((x) => `${x.ancho}x${x.alto}:${x.clase}`).sort()).toEqual([
      '140x220:sobrante',
      '60x420:merma',
    ]);
    expect(s.every((x) => x.detalle === 'resto_colmena')).toBe(true);
  });

  it('cada salida sabe de qué paño del rack salió', () => {
    const [s] = salidasDeColmena(grupo());
    expect(s.colmenaOrigen).toEqual({
      docId: 'd1',
      ubicacion: 'A-1',
      cod: 'SC 65',
      ancho: 200,
      alto: 420,
    });
    expect(s.codInt).toBe('SC 65');
  });

  it('las hilachas de menos de 10 cm no se anotan', () => {
    // Paño 205×200 con una cortina de 200×195: quedan 5×200 y 200×5.
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 205, alto: 200, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 195, 200)],
      uw: 205,
      uh: 200,
    });
    expect(salidasDeColmena(g)).toEqual([]);
  });

  it('un paño usado ENTERO no deja ninguna salida', () => {
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 140, alto: 200, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 200, 140)],
      uw: 140,
      uh: 200,
    });
    expect(g.libres).toEqual([]);
    expect(salidasDeColmena(g)).toEqual([]);
  });
});

describe('retazoSugerido / mermaSobrante', () => {
  it('el retazo es el trozo ÚTIL más grande', () => {
    expect(retazoSugerido(grupo())).toEqual({ ancho: 140, alto: 220 });
  });

  it('la merma es la pérdida más grande', () => {
    expect(mermaSobrante(grupo())).toEqual({ ancho: 60, alto: 420 });
  });

  it('null cuando el paño no deja nada de esa clase', () => {
    // Paño 200×260 con una cortina de 200×200: solo queda 200×60, que no sirve
    // ni para roller (100×200) ni para vertical (80×250) → todo merma.
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 200, alto: 260, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 200, 200)],
      uw: 200,
      uh: 260,
    });
    expect(retazoSugerido(g)).toBeNull();
    expect(mermaSobrante(g)).toEqual({ ancho: 200, alto: 60 });
  });
});

describe('deduccionesColmena', () => {
  it('el paño SIEMPRE se consume y trae lo que dejó el corte', () => {
    const res = deduccionesColmena(plan([grupo()]));
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      docId: 'd1',
      cod: 'SC 65',
      ubicacion: 'A-1',
      ancho: 200,
      alto: 420,
      accion: 'usado',
    });
    // Ya no se achica el paño en su lugar: el rack no puede decir que en A-1
    // hay un paño de 140×220 cuando en realidad quedaron dos trozos sueltos.
    expect(res[0].nuevoAncho).toBeUndefined();
    expect(res[0].salidas).toHaveLength(2);
  });

  it('plan sin sobrantes → sin deducciones', () => {
    expect(deduccionesColmena(plan([]))).toEqual([]);
  });
});

describe('piezasColmenaSnapshot', () => {
  const g = grupo({
    placed: [placed(0, 200, 140, 'ot1_v1_p0', 'ot1'), placed(0, 200, 60, 'ot2_v9_p0', 'ot2')],
  });

  it('sin filtro devuelve todas las piezas del plan', () => {
    expect(Object.keys(piezasColmenaSnapshot(plan([g]))).sort()).toEqual([
      'ot1_v1_p0',
      'ot2_v9_p0',
    ]);
  });

  it('en un LOTE cada OT sella solo sus piezas', () => {
    // Sin el filtro, las dos OTs del lote se atribuían los paños de la otra y
    // `costoOT` cargaba dos veces la misma tela.
    expect(Object.keys(piezasColmenaSnapshot(plan([g]), 'ot1'))).toEqual(['ot1_v1_p0']);
    expect(piezasColmenaSnapshot(plan([g]), 'ot1').ot1_v1_p0).toEqual({
      cod: 'SC 65',
      ancho: 200,
      alto: 420,
      ubic: 'A-1',
    });
  });
});
