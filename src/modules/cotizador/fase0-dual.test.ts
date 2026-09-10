import { describe, expect, it } from 'vitest';
import {
  candidataParaUnir,
  emparejarDualesFase0,
  esFilaBeeblack,
  esGrupoDobleTela,
  intercambiarPanos,
  quitarDeGrupo,
  separarGrupo,
  unirFilas,
  type FilaAgrupable,
  type FilaEmparejable,
} from './fase0-dual';

// tipo de tela por COD_INT: SC*→SCR, BK*→BK.
const tipoTelaDe = (f: FilaEmparejable): string => {
  const c = f.codInt.toUpperCase();
  if (c.startsWith('BK')) return 'BK';
  if (c.startsWith('SC')) return 'SCR';
  return '';
};

const fila = (
  codInt: string,
  ubicacion: string,
  categoria = 'ROL_DUAL',
  ancho = 1.6,
  alto = 1.8,
): FilaEmparejable & { id: string } => ({
  id: `${ubicacion}-${codInt}`,
  categoria,
  ubicacion,
  codInt,
  ancho,
  alto,
});

describe('emparejarDualesFase0', () => {
  it('par SCR+BK misma UBIC → un grupo con la SCR primero', () => {
    const { grupos, avisos } = emparejarDualesFase0(
      [fila('BK 69', 'LIVING'), fila('SC 68', 'LIVING')],
      tipoTelaDe,
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].map((f) => f.codInt)).toEqual(['SC 68', 'BK 69']);
    expect(avisos).toEqual([]);
  });

  it('BK+BK (telas iguales) conserva el orden del Excel', () => {
    const { grupos } = emparejarDualesFase0(
      [fila('BK 70', 'PZA'), fila('BK 69', 'PZA')],
      tipoTelaDe,
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].map((f) => f.codInt)).toEqual(['BK 70', 'BK 69']);
  });

  it('dual con una sola tela → grupo de 1 + aviso', () => {
    const { grupos, avisos } = emparejarDualesFase0([fila('SC 68', 'SOLO')], tipoTelaDe);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toHaveLength(1);
    expect(avisos.some((a) => a.includes('una sola tela'))).toBe(true);
  });

  it('las no-dual quedan como grupos de 1, en orden', () => {
    const { grupos } = emparejarDualesFase0(
      [fila('SC 1', 'A', 'ROL'), fila('SC 68', 'B'), fila('BK 69', 'B')],
      tipoTelaDe,
    );
    expect(grupos).toHaveLength(2);
    expect(grupos[0].map((f) => f.codInt)).toEqual(['SC 1']); // roller simple suelto
    expect(grupos[1].map((f) => f.codInt)).toEqual(['SC 68', 'BK 69']); // dual emparejado
  });

  it('≥3 telas misma UBIC → aviso (se emparejan todas en un grupo)', () => {
    const { grupos, avisos } = emparejarDualesFase0(
      [fila('SC 68', 'X'), fila('BK 69', 'X'), fila('BK 70', 'X')],
      tipoTelaDe,
    );
    expect(grupos).toHaveLength(1);
    expect(avisos.some((a) => a.includes('telas dual'))).toBe(true);
  });

  it('medidas distintas dentro del par → aviso', () => {
    const { avisos } = emparejarDualesFase0(
      [fila('SC 68', 'Y', 'ROL_DUAL', 1.6, 1.8), fila('BK 69', 'Y', 'ROL_DUAL', 1.4, 2.0)],
      tipoTelaDe,
    );
    expect(avisos.some((a) => a.includes('medidas distintas'))).toBe(true);
  });
});

describe('emparejarDualesFase0 — BEEBLACK marcado DOBLE', () => {
  // El beeblack no es categoría dual: el par lo marca la columna TIPO=DOBLE de
  // su planilla, así que el caller pasa su propio predicado.
  const tipoTelaBb = (f: FilaEmparejable): string => {
    const c = f.codInt.toUpperCase();
    if (c.startsWith('BEE-SC')) return 'SCR'; // mosquitero al vidrio
    if (c.startsWith('BEE-BK')) return 'BK';
    return '';
  };
  const dobles = new Set(['DORM-BEE-BK', 'DORM-BEE-SC']);
  const esDoble = (f: FilaEmparejable & { id: string }) => dobles.has(f.id);

  it('junta las 2 filas de la misma UBIC con la mosquitera primero', () => {
    const { grupos, avisos } = emparejarDualesFase0(
      [
        fila('BEE-BK', 'DORM', 'BEEBLACK'),
        fila('BEE-SC', 'DORM', 'BEEBLACK'),
        fila('BEE-BK', 'LIVING', 'BEEBLACK'), // SIMPLE: queda sola
      ],
      tipoTelaBb,
      esDoble,
    );
    expect(grupos).toHaveLength(2);
    expect(grupos[0].map((f) => f.codInt)).toEqual(['BEE-SC', 'BEE-BK']);
    expect(grupos[1].map((f) => f.codInt)).toEqual(['BEE-BK']);
    expect(avisos).toEqual([]);
  });

  it('una sola fila marcada DOBLE avisa que falta su par', () => {
    const solo = new Set(['DORM-BEE-BK']);
    const { grupos, avisos } = emparejarDualesFase0(
      [fila('BEE-BK', 'DORM', 'BEEBLACK')],
      tipoTelaBb,
      (f: FilaEmparejable & { id: string }) => solo.has(f.id),
    );
    expect(grupos).toHaveLength(1);
    expect(avisos.some((a) => a.includes('una sola tela'))).toBe(true);
  });
});

// Decide si cada paño guarda SU tela. El beeblack doble la necesita: sin esto
// los dos paños se guardaban sin codInt propio y al reabrir la OT ambos
// mostraban la SCREEN (la que queda primera tras el emparejado), perdiendo el
// blackout.
describe('esGrupoDobleTela', () => {
  it('beeblack con 2 filas → tela por paño', () => {
    expect(esGrupoDobleTela('BEEBLACK', 2)).toBe(true);
  });

  it('beeblack simple (1 fila) → tela de la ventana', () => {
    expect(esGrupoDobleTela('BEEBLACK', 1)).toBe(false);
  });

  it('roller dual → tela por paño con cualquier tamaño de grupo', () => {
    expect(esGrupoDobleTela('ROL_DUAL', 2)).toBe(true);
    expect(esGrupoDobleTela('ROL_DUAL', 1)).toBe(true);
  });

  it('roller normal de 2 paños → NO es doble tela (son 2 cortinas)', () => {
    expect(esGrupoDobleTela('ROL', 2)).toBe(false);
  });

  it('sin nFilas responde "¿puede llevar tela por paño?" (espejo al editar)', () => {
    expect(esGrupoDobleTela('BEEBLACK')).toBe(true);
    expect(esGrupoDobleTela('BEEBLACK_MOSQ')).toBe(true);
    expect(esGrupoDobleTela('ROL')).toBe(false);
  });
});

// ── Unir / separar a mano en la grilla ───────────────────────────────

// Las telas de la OT ANDREA: blackout + traslúcida sobre el mismo riel.
const tipoBb = (f: FilaAgrupable): string => {
  const c = f.codInt.toUpperCase();
  if (c.startsWith('BEE-SC')) return 'SCR';
  return c.startsWith('BEE-') ? 'BK' : '';
};

const ag = (p: Partial<FilaAgrupable> & { id: string }): FilaAgrupable => ({
  categoria: 'BEEBLACK',
  ubicacion: 'PPAL',
  codInt: 'BEE-BK05',
  ancho: 2.97,
  alto: 1.884,
  ...p,
});

describe('esFilaBeeblack', () => {
  it('por categoría o, si todavía no hay, por el código', () => {
    expect(esFilaBeeblack({ categoria: 'BEEBLACK', codInt: '' })).toBe(true);
    expect(esFilaBeeblack({ categoria: '', codInt: 'BEE-TR01' })).toBe(true);
    expect(esFilaBeeblack({ categoria: 'ROL', codInt: 'SC 54' })).toBe(false);
  });
});

describe('candidataParaUnir', () => {
  it('la otra tela de la misma ubicación y medidas', () => {
    const filas = [ag({ id: 'a' }), ag({ id: 'b', codInt: 'BEE-TR01' })];
    expect(candidataParaUnir(filas, 'a')?.id).toBe('b');
  });

  it('el botón sale en las DOS filas del par: también busca hacia arriba', () => {
    const filas = [ag({ id: 'a' }), ag({ id: 'b', codInt: 'BEE-TR01' })];
    expect(candidataParaUnir(filas, 'b')?.id).toBe('a');
  });

  it('otra ubicación no es la misma cortina', () => {
    const filas = [ag({ id: 'a' }), ag({ id: 'b', ubicacion: 'HIJA', codInt: 'BEE-TR01' })];
    expect(candidataParaUnir(filas, 'a')).toBeNull();
  });

  it('la ubicación calza sin importar mayúsculas ni espacios de más', () => {
    const filas = [ag({ id: 'a', ubicacion: 'ppal  l' }), ag({ id: 'b', ubicacion: 'PPAL L' })];
    expect(candidataParaUnir(filas, 'a')?.id).toBe('b');
  });

  it('dos telas de un mismo riel miden igual: si no, no son la misma cortina', () => {
    const filas = [ag({ id: 'a' }), ag({ id: 'b', alto: 1.9, codInt: 'BEE-TR01' })];
    expect(candidataParaUnir(filas, 'a')).toBeNull();
  });

  it('una fila que ya está en un grupo no se ofrece ni se une', () => {
    const filas = [ag({ id: 'a' }), ag({ id: 'b', vid: 'v1', panoIndex: 0, codInt: 'BEE-TR01' })];
    expect(candidataParaUnir(filas, 'a')).toBeNull();
    expect(candidataParaUnir(filas, 'b')).toBeNull();
  });

  it('un roller no se une aunque calce todo lo demás', () => {
    const filas = [
      ag({ id: 'a', categoria: 'ROL', codInt: 'SC 54' }),
      ag({ id: 'b', categoria: 'ROL', codInt: 'BK 43' }),
    ];
    expect(candidataParaUnir(filas, 'a')).toBeNull();
  });

  it('la más cercana hacia abajo, no la del final', () => {
    const filas = [
      ag({ id: 'a' }),
      ag({ id: 'cerca', codInt: 'BEE-TR01' }),
      ag({ id: 'lejos', codInt: 'BEE-TR01' }),
    ];
    expect(candidataParaUnir(filas, 'a')?.id).toBe('cerca');
  });
});

describe('unirFilas', () => {
  it('mismo vid, paños 0 y 1, y las deja pegadas', () => {
    const filas = [ag({ id: 'a' }), ag({ id: 'otra', ubicacion: 'HIJA' }), ag({ id: 'b' })];
    const r = unirFilas(filas, 'a', 'b', tipoBb);
    expect(r.map((f) => f.id)).toEqual(['a', 'b', 'otra']);
    expect(r[0].vid).toBeTruthy();
    expect(r[1].vid).toBe(r[0].vid);
    expect([r[0].panoIndex, r[1].panoIndex]).toEqual([0, 1]);
    expect(r[2].vid).toBeUndefined();
  });

  it('el mosquitero va al vidrio, aunque se haya pulsado en el blackout', () => {
    const filas = [ag({ id: 'bk' }), ag({ id: 'sc', codInt: 'BEE-SC01' })];
    const r = unirFilas(filas, 'bk', 'sc', tipoBb);
    expect(r.map((f) => f.id)).toEqual(['sc', 'bk']);
    expect(r[0].panoIndex).toBe(0);
  });

  it('blackout + traslúcida: manda la fila desde la que se pulsó', () => {
    const filas = [ag({ id: 'bk' }), ag({ id: 'tr', codInt: 'BEE-TR01' })];
    expect(unirFilas(filas, 'tr', 'bk', tipoBb).map((f) => f.id)).toEqual(['tr', 'bk']);
    expect(unirFilas(filas, 'bk', 'tr', tipoBb).map((f) => f.id)).toEqual(['bk', 'tr']);
  });

  it('el par se queda donde estaba la primera de las dos', () => {
    const filas = [ag({ id: 'x', ubicacion: 'HIJA' }), ag({ id: 'a' }), ag({ id: 'b' })];
    expect(unirFilas(filas, 'b', 'a', tipoBb).map((f) => f.id)).toEqual(['x', 'b', 'a']);
  });

  it('unir una fila consigo misma o con una que no existe no hace nada', () => {
    const filas = [ag({ id: 'a' }), ag({ id: 'b' })];
    expect(unirFilas(filas, 'a', 'a', tipoBb)).toBe(filas);
    expect(unirFilas(filas, 'a', 'fantasma', tipoBb)).toBe(filas);
  });
});

describe('separarGrupo', () => {
  it('las dos vuelven a ser cortinas completas', () => {
    const filas = [
      ag({ id: 'a', vid: 'v1', panoIndex: 0 }),
      ag({ id: 'b', vid: 'v1', panoIndex: 1 }),
      ag({ id: 'c', vid: 'v2', panoIndex: 0, ubicacion: 'HIJA' }),
    ];
    const r = separarGrupo(filas, 'v1');
    expect(r.slice(0, 2).every((f) => f.vid === undefined && f.panoIndex === undefined)).toBe(true);
    expect(r[2].vid).toBe('v2');
  });
});

describe('intercambiarPanos', () => {
  it('cambia cuál paga el riel, y el orden de la grilla lo muestra', () => {
    const filas = [
      ag({ id: 'a', vid: 'v1', panoIndex: 0 }),
      ag({ id: 'b', vid: 'v1', panoIndex: 1, codInt: 'BEE-TR01' }),
    ];
    const r = intercambiarPanos(filas, 'v1');
    expect(r.map((f) => f.id)).toEqual(['b', 'a']);
    expect(r.map((f) => f.panoIndex)).toEqual([0, 1]);
  });

  it('un grupo que no tiene exactamente dos paños se deja quieto', () => {
    const filas = [ag({ id: 'a', vid: 'v1', panoIndex: 0 })];
    expect(intercambiarPanos(filas, 'v1')).toBe(filas);
  });
});

describe('quitarDeGrupo', () => {
  it('sacar una tela deja a la otra como cortina suelta, no como 2.ª tela huérfana', () => {
    const filas = [
      ag({ id: 'a', vid: 'v1', panoIndex: 0 }),
      ag({ id: 'b', vid: 'v1', panoIndex: 1 }),
    ];
    const r = quitarDeGrupo(filas, 'a');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('b');
    expect(r[0].vid).toBeUndefined();
    expect(r[0].panoIndex).toBeUndefined();
  });

  it('con tres paños se renumera y el grupo sigue en pie', () => {
    const filas = [
      ag({ id: 'a', vid: 'v1', panoIndex: 0 }),
      ag({ id: 'b', vid: 'v1', panoIndex: 1 }),
      ag({ id: 'c', vid: 'v1', panoIndex: 2 }),
    ];
    const r = quitarDeGrupo(filas, 'b');
    expect(r.map((f) => f.id)).toEqual(['a', 'c']);
    expect(r.map((f) => f.panoIndex)).toEqual([0, 1]);
  });

  it('una fila suelta se saca y nadie más se entera', () => {
    const filas = [ag({ id: 'a' }), ag({ id: 'b', vid: 'v1', panoIndex: 0 })];
    const r = quitarDeGrupo(filas, 'a');
    expect(r.map((f) => f.id)).toEqual(['b']);
    expect(r[0].vid).toBe('v1');
  });
});
