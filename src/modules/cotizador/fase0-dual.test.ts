import { describe, expect, it } from 'vitest';
import { emparejarDualesFase0, type FilaEmparejable } from './fase0-dual';

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
