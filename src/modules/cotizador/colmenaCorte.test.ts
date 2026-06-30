import { describe, it, expect } from 'vitest';
import { retazoSugerido, mermaSobrante, deduccionesColmena } from './colmenaCorte';
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
      alto: 420,
      ubicacion: 'A-1',
      tipo: 'SOBRANTE',
      creadoEn: '',
    },
    placed: [placed(0, 200, 140)],
    regla: 2,
    sobranteAncho: null,
    uw: 200,
    uh: 420,
    ...over,
  };
}

function plan(sobrantes: GrupoSobrante[]): Plan {
  return { sobrantes, rollo: [], sinStock: [], otsIncluidas: [] };
}

describe('retazoSugerido (gate colmena 120×180)', () => {
  it('banda de alto cuando califica como colmena y es la de mayor área', () => {
    // sobrante 200×420, pieza ph 200 → altoResto = 420-(200+2)=218 ≥180,
    // ancho 200 ≥120 → banda 200×218 válida como colmena.
    expect(retazoSugerido(grupo())).toEqual({ ancho: 200, alto: 218 });
  });

  it('NO deja retazo si la banda no llega al mínimo de alto (180)', () => {
    // sobrante 200×260, pieza ph 200 → altoResto = 58 (<180) → no es colmena.
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 200, alto: 260, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 200)],
      uh: 260,
    });
    expect(retazoSugerido(g)).toBeNull();
  });

  it('usa la tira de ancho (ya gateada por planCorte) cuando no hay banda útil', () => {
    // sobrante 130×200, pieza ph 190 → altoResto = 8 → sin banda; tira 130×200.
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 130, alto: 200, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 190)],
      sobranteAncho: { cod: 'X', ancho: 130, alto: 200 },
      uw: 130,
      uh: 200,
    });
    expect(retazoSugerido(g)).toEqual({ ancho: 130, alto: 200 });
  });

  it('elige el de mayor área cuando banda y tira califican', () => {
    // sobrante 125×450, pieza ph 250 → banda 125×198 (24.750) vs tira 130×250 (32.500)
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 125, alto: 450, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 250)],
      sobranteAncho: { cod: 'X', ancho: 130, alto: 250 },
      uw: 125,
      uh: 450,
    });
    expect(retazoSugerido(g)).toEqual({ ancho: 130, alto: 250 });
  });

  it('null cuando no queda nada que califique como colmena', () => {
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 100, alto: 120, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 119)],
      sobranteAncho: null,
      uw: 100,
      uh: 120,
    });
    expect(retazoSugerido(g)).toBeNull();
  });
});

describe('mermaSobrante', () => {
  it('es null cuando el remanente sobrevive como colmena', () => {
    expect(mermaSobrante(grupo())).toBeNull();
  });

  it('devuelve el remanente como merma cuando no califica (banda baja)', () => {
    // sobrante 200×260, pieza 200 ancho × 200 alto → solo banda 200×58 (<180).
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 200, alto: 260, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 200, 200)],
      uw: 200,
      uh: 260,
    });
    expect(mermaSobrante(g)).toEqual({ ancho: 200, alto: 58 });
  });

  it('toma la tira de ancho como merma si es la mayor y no califica', () => {
    // pieza 140 de ancho en sobrante de 200 → tira 60×260 (15.600);
    // banda 200×58 (11.600). Ninguna es colmena → merma = la mayor (tira).
    const g = grupo({
      sobrante: { _docId: 'd', cod: 'X', ancho: 200, alto: 260, ubicacion: '', tipo: '', creadoEn: '' },
      placed: [placed(0, 200, 140)],
      uw: 200,
      uh: 260,
    });
    expect(mermaSobrante(g)).toEqual({ ancho: 60, alto: 260 });
  });
});

describe('deduccionesColmena', () => {
  it('una deducción por sobrante usado: retazo (con merma null) o usado (con merma)', () => {
    const gRetazo = grupo(); // → retazo 200×218
    const gUsado = grupo({
      sobrante: { _docId: 'd2', cod: 'BK 60', ancho: 200, alto: 260, ubicacion: 'B-2', tipo: '', creadoEn: '' },
      placed: [placed(0, 200, 200)],
      sobranteAncho: null,
      uw: 200,
      uh: 260,
    });
    const res = deduccionesColmena(plan([gRetazo, gUsado]));
    expect(res).toEqual([
      {
        docId: 'd1',
        cod: 'SC 65',
        ubicacion: 'A-1',
        ancho: 200,
        alto: 420,
        accion: 'retazo',
        nuevoAncho: 200,
        nuevoAlto: 218,
        merma: null,
      },
      {
        docId: 'd2',
        cod: 'BK 60',
        ubicacion: 'B-2',
        ancho: 200,
        alto: 260,
        accion: 'usado',
        merma: { ancho: 200, alto: 58 },
      },
    ]);
  });

  it('plan sin sobrantes → sin deducciones', () => {
    expect(deduccionesColmena(plan([]))).toEqual([]);
  });
});
