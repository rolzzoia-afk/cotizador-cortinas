import { describe, expect, it, vi } from 'vitest';
import type { jsPDF } from 'jspdf';

// Captura el documento al guardar (save vive en la instancia, no en el
// prototipo): subclase real de jsPDF, así las medidas de página son las reales.
const docsGuardados = vi.hoisted(() => [] as unknown[]);
vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  class JsPDFCaptura extends mod.jsPDF {
    constructor(...args: ConstructorParameters<typeof mod.jsPDF>) {
      super(...args);
      (this as { save: unknown }).save = () => {
        docsGuardados.push(this);
        return this;
      };
    }
  }
  return { ...mod, jsPDF: JsPDFCaptura };
});

import {
  agruparEtiquetasPanos,
  especTuboEtiqueta,
  familiaTelaEtiqueta,
  fmtMedidaCm,
  generarEtiquetasPanosPDF,
  ladoCadenaEtiqueta,
  ordenDobleEtiqueta,
  sistemaEtiquetaEstructura,
  textoAccionamiento,
  tipoCortinaEtiqueta,
} from './pdfEtiquetasBrother';
import type { OptimizerRow } from './tela';

describe('fmtMedidaCm', () => {
  it('coma decimal es-CL y sin ",0" redundante', () => {
    expect(fmtMedidaCm(250.5)).toBe('250,5');
    expect(fmtMedidaCm(230)).toBe('230');
    expect(fmtMedidaCm(295.05)).toBe('295,1'); // despiece redondea a 1 decimal
  });
});

describe('familiaTelaEtiqueta', () => {
  it('mapea el chip de tipo de tela', () => {
    expect(familiaTelaEtiqueta('BK')).toBe('BLACKOUT');
    expect(familiaTelaEtiqueta('SCR')).toBe('SCREEN');
    expect(familiaTelaEtiqueta('DU')).toBe('DUO');
  });

  it('sin chip, deriva del nombre del producto', () => {
    expect(familiaTelaEtiqueta(undefined, 'ROLLER BLACKOUT DELUX')).toBe('BLACKOUT');
    expect(familiaTelaEtiqueta('', 'ROLLER SCREEN PREMIUM')).toBe('SCREEN');
    expect(familiaTelaEtiqueta('', 'VERTICAL PVC')).toBe('VERTICAL');
    expect(familiaTelaEtiqueta('', '')).toBe('—');
  });
});

describe('tipoCortinaEtiqueta', () => {
  it('primera palabra del producto, fallback al tipo', () => {
    expect(tipoCortinaEtiqueta('ROLLER BLACKOUT DELUX')).toBe('ROLLER');
    expect(tipoCortinaEtiqueta('', 'DELUX')).toBe('DELUX');
    expect(tipoCortinaEtiqueta()).toBe('—');
  });
});

describe('sistemaEtiquetaEstructura', () => {
  it('DUO por producto, DUAL por flag, si no la familia del producto', () => {
    expect(sistemaEtiquetaEstructura('ROLLER DUO BK', '', false)).toBe('DUO');
    expect(sistemaEtiquetaEstructura('ROLLER SCREEN', '', true)).toBe('DUAL');
    expect(sistemaEtiquetaEstructura('ROLLER BLACKOUT', '', false)).toBe('ROLLER');
  });
});

describe('ordenDobleEtiqueta', () => {
  it('mapea el orden de telas a texto', () => {
    expect(ordenDobleEtiqueta('BK_VID_SCR')).toBe('BK AL VIDRIO');
    expect(ordenDobleEtiqueta('SCR_VID_BK')).toBe('SCR AL VIDRIO');
    expect(ordenDobleEtiqueta('')).toBe('');
  });
});

describe('especTuboEtiqueta', () => {
  it('arma "38 mm de 1,2 mm" desde código corto + chip', () => {
    expect(especTuboEtiqueta('38mm_E02', '0,38mm [E02] 1,2mm')).toBe('38 mm de 1,2 mm');
  });

  it('con el chip largo nuevo saca el espesor del código (E02→1,2; E66→2,5)', () => {
    expect(especTuboEtiqueta('38mm_E02', 'E02-TUBO 1.2 / Ø 38 mm')).toBe('38 mm de 1,2 mm');
    expect(especTuboEtiqueta('38mm_E66', 'E66 - TUBO (.40mm) - 2.5mm')).toBe('38 mm de 2,5 mm');
  });

  it('sin espesor en el chip deja solo el diámetro', () => {
    expect(especTuboEtiqueta('38mm_E02', '')).toBe('38 mm');
    expect(especTuboEtiqueta('38mm_E02')).toBe('38 mm');
  });

  it('sin código de tubo no inventa nada', () => {
    expect(especTuboEtiqueta(undefined, '1,2mm')).toBe('');
    expect(especTuboEtiqueta('', '1,2mm')).toBe('');
  });
});

describe('ladoCadenaEtiqueta', () => {
  it('limpia el formato "CAD [DERECHA]" de Fase 0', () => {
    expect(ladoCadenaEtiqueta('CAD [DERECHA]')).toBe('DERECHA');
    expect(ladoCadenaEtiqueta('CAD IZQUIERDA')).toBe('IZQUIERDA');
    expect(ladoCadenaEtiqueta(undefined)).toBe('—');
  });
});

describe('textoAccionamiento', () => {
  it('cadena: largo + color con nombre completo', () => {
    expect(textoAccionamiento({ largoCadena: '4', colorCadena: 'NEG' })).toBe('4 METROS NEGRO');
    expect(textoAccionamiento({ largoCadena: '1,5', colorCadena: 'BCO' })).toBe(
      '1,5 METROS BLANCO',
    );
  });

  it('motor gana sobre la cadena', () => {
    expect(textoAccionamiento({ motorTipo: 'Somfy', largoCadena: '4' })).toBe('MOTOR SOMFY');
  });

  it('sin datos devuelve vacío', () => {
    expect(textoAccionamiento({})).toBe('');
  });
});

describe('agruparEtiquetasPanos', () => {
  const fila = (junto: string, numeroPano: number | string, altoCorte = 2.65): OptimizerRow =>
    ({ codInt: 'SC 64', junto, numeroPano, altoCorte }) as unknown as OptimizerRow;

  it('corte en conjunto → UNA etiqueta con la letra repetida ("A-A")', () => {
    const grupos = agruparEtiquetasPanos([
      fila('A', 1),
      fila('A', 1),
      fila('B', 2),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].junto).toBe('A-A');
    expect(grupos[0].cortinas).toBe(2);
    expect(grupos[1].junto).toBe('B');
  });

  it('la etiqueta del grupo lleva el alto MAYOR (el tiro se corta a ese alto)', () => {
    const grupos = agruparEtiquetasPanos([fila('A', 1, 2.05), fila('A', 1, 2.65)]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].row.altoCorte).toBe(2.65);
  });

  it('tres cortinas juntas → "A-A-A"', () => {
    const grupos = agruparEtiquetasPanos([fila('A', 1), fila('A', 1), fila('A', 1)]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].junto).toBe('A-A-A');
  });

  it('misma letra pero distinto N° de paño NO se agrupa (letras se reciclan tras la Z)', () => {
    const grupos = agruparEtiquetasPanos([fila('A', 1), fila('A', 27)]);
    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.junto)).toEqual(['A', 'A']);
  });

  it('filas sin letra o sin N° de paño (planes legacy) van cada una con su etiqueta', () => {
    const grupos = agruparEtiquetasPanos([
      fila('', ''),
      fila('', ''),
      fila('·', 3),
      fila('A', ''),
      fila('A', ''),
    ]);
    expect(grupos).toHaveLength(5);
  });
});

describe('generarEtiquetasPanosPDF', () => {
  it('una página por paño físico: 3 cortinas con corte en conjunto → 2 etiquetas', () => {
    docsGuardados.length = 0;
    const fila = (junto: string, numeroPano: number): OptimizerRow =>
      ({
        codInt: 'SC 64',
        producto: 'ROLLER SCREEN PREMIUM',
        tipo: 'PREMIUM',
        junto,
        numeroPano,
        altoCorte: 2.65,
        pano: { tipoTela: 'SCR' },
      }) as unknown as OptimizerRow;
    generarEtiquetasPanosPDF(
      [fila('A', 1), fila('A', 1), fila('B', 2)],
      { ot: '3097', cliente: 'BARBARA / LEONARDO', fecha: '2026-07-07' },
      {},
    );
    const doc = docsGuardados[0] as jsPDF;
    expect(doc.getNumberOfPages()).toBe(2);
  });
  it('páginas exactas de 62×51 mm, sin sobrante (y sin volteo de jsPDF)', () => {
    docsGuardados.length = 0;
    const row = {
      codInt: 'SC 93',
      producto: 'ROLLER SCREEN PREMIUM',
      tipo: 'PREMIUM',
      junto: 'A',
      altoCorte: 2.551,
      pano: { tipoTela: 'SCR' },
    } as unknown as OptimizerRow;
    generarEtiquetasPanosPDF(
      [row, row],
      { ot: '267-3', cliente: 'JEFFI', fecha: '2026-07-03' },
      { 'SC 93': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: 'TEXTURE PERLA 5%', precio: 23820 } },
    );
    expect(docsGuardados).toHaveLength(1);
    const doc = docsGuardados[0] as jsPDF;
    expect(doc.getNumberOfPages()).toBe(2);
    for (let p = 1; p <= 2; p++) {
      doc.setPage(p);
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(62, 1);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(51, 1);
    }
  });
});

describe('generarEtiquetasPanosPDF — omite paños de colmena', () => {
  const fila = (junto: string, numeroPano: number, ventanaId: string, panoIndex = 0): OptimizerRow =>
    ({
      codInt: 'SC 64',
      producto: 'ROLLER SCREEN PREMIUM',
      tipo: 'PREMIUM',
      junto,
      numeroPano,
      ventanaId,
      panoIndex,
      altoCorte: 2.65,
      pano: { tipoTela: 'SCR' },
    }) as unknown as OptimizerRow;
  const meta = { ot: '3115', cliente: 'LUIS-VIVIANA', fecha: '2026-07-15' };

  it('paño de colmena no lleva etiqueta: 3 paños, 1 de colmena → 2 etiquetas', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPanosPDF(
      [fila('A', 1, 'V1'), fila('B', 2, 'V2'), fila('C', 3, 'V3')],
      meta,
      {},
      (r) => r.ventanaId === 'V3',
    );
    expect(n).toBe(2);
    expect((docsGuardados[0] as jsPDF).getNumberOfPages()).toBe(2);
  });

  it('si ALGUNA pieza del paño en conjunto sale de colmena, se omite todo el paño', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPanosPDF(
      [fila('A', 1, 'V1'), fila('A', 1, 'V2'), fila('B', 2, 'V3')],
      meta,
      {},
      (r) => r.ventanaId === 'V2', // una de las dos cortinas del paño A
    );
    expect(n).toBe(1); // solo queda el paño B
    expect((docsGuardados[0] as jsPDF).getNumberOfPages()).toBe(1);
  });

  it('todos los paños de colmena → 0 etiquetas y NO genera PDF', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPanosPDF(
      [fila('A', 1, 'V1'), fila('B', 2, 'V2')],
      meta,
      {},
      () => true,
    );
    expect(n).toBe(0);
    expect(docsGuardados).toHaveLength(0);
  });

  it('sin callback → imprime todos (regresión del comportamiento previo)', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPanosPDF([fila('A', 1, 'V1'), fila('B', 2, 'V2')], meta, {});
    expect(n).toBe(2);
    expect((docsGuardados[0] as jsPDF).getNumberOfPages()).toBe(2);
  });
});
