import { describe, it, expect } from 'vitest';
import { retazoSugerido, deduccionesColmena } from './colmenaCorte';
import type { GrupoSobrante, Placed, Plan } from './planCorte';

function placed(py: number, ph: number, pw = 100): Placed {
  return {
    id: 'p1',
    nombre: 'OT1·Living',
    codInt: 'SC 65',
    otId: '1',
    otNum: '1',
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

function grupo(over: Partial<GrupoSobrante> = {}): GrupoSobrante {
  return {
    sobrante: {
      _docId: 'd1',
      cod: 'SC 65',
      ancho: 200,
      alto: 220,
      ubicacion: 'A-1',
      tipo: 'SOBRANTE',
      creadoEn: '',
    },
    placed: [placed(0, 100, 140)],
    regla: 2,
    sobranteAncho: null,
    uw: 200,
    uh: 220,
    ...over,
  };
}

function plan(sobrantes: GrupoSobrante[]): Plan {
  return { sobrantes, rollo: [], sinStock: [], otsIncluidas: [] };
}

describe('retazoSugerido', () => {
  it('banda de alto cuando es el rectángulo de mayor área', () => {
    // altoResto = 220 - (100 + 2) = 118 → banda 200×118 (23.600) vs sin tira
    expect(retazoSugerido(grupo())).toEqual({ ancho: 200, alto: 118 });
  });

  it('usa la tira de ancho (sobranteAncho) cuando no hay banda de alto útil', () => {
    // sobrante 100×120, pieza ph 100 → altoResto = 18 (<30) → no hay banda
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 100, alto: 120, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 100)],
      sobranteAncho: { cod: 'X', ancho: 60, alto: 100 },
    });
    expect(retazoSugerido(g)).toEqual({ ancho: 60, alto: 100 });
  });

  it('elige el de mayor área cuando existen banda y tira', () => {
    // sobrante 100×300, pieza ph 250 → banda 100×48 (4.800) vs tira 60×250 (15.000)
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 100, alto: 300, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 250)],
      sobranteAncho: { cod: 'X', ancho: 60, alto: 250 },
    });
    expect(retazoSugerido(g)).toEqual({ ancho: 60, alto: 250 });
  });

  it('null cuando no queda nada usable (todo consumido, sin tira)', () => {
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 100, alto: 120, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 119)],
      sobranteAncho: null,
    });
    expect(retazoSugerido(g)).toBeNull();
  });
});

describe('deduccionesColmena', () => {
  it('una deducción por sobrante usado: retazo o usado', () => {
    const gRetazo = grupo(); // → retazo 200×118
    const gUsado = grupo({
      sobrante: { _docId: 'd2', cod: 'BK 60', ancho: 100, alto: 120, ubicacion: 'B-2', tipo: '', creadoEn: '' },
      placed: [placed(0, 119)],
      sobranteAncho: null,
    });
    const res = deduccionesColmena(plan([gRetazo, gUsado]));
    expect(res).toEqual([
      {
        docId: 'd1',
        cod: 'SC 65',
        ubicacion: 'A-1',
        ancho: 200,
        alto: 220,
        accion: 'retazo',
        nuevoAncho: 200,
        nuevoAlto: 118,
      },
      {
        docId: 'd2',
        cod: 'BK 60',
        ubicacion: 'B-2',
        ancho: 100,
        alto: 120,
        accion: 'usado',
      },
    ]);
  });

  it('plan sin sobrantes → sin deducciones', () => {
    expect(deduccionesColmena(plan([]))).toEqual([]);
  });
});
