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
  especTuboEtiqueta,
  familiaTelaEtiqueta,
  fmtMedidaCm,
  generarEtiquetasPanosPDF,
  ladoCadenaEtiqueta,
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

describe('especTuboEtiqueta', () => {
  it('arma "38 mm de 1,2 mm" desde código corto + chip', () => {
    expect(especTuboEtiqueta('38mm_E02', '0,38mm [E02] 1,2mm')).toBe('38 mm de 1,2 mm');
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

describe('generarEtiquetasPanosPDF', () => {
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
