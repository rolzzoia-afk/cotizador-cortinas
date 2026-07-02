import { describe, expect, it } from 'vitest';
import {
  especTuboEtiqueta,
  familiaTelaEtiqueta,
  fmtMedidaCm,
  ladoCadenaEtiqueta,
  textoAccionamiento,
  tipoCortinaEtiqueta,
} from './pdfEtiquetasBrother';

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
