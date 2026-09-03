import { describe, expect, it } from 'vitest';
import {
  CENEFA_OVALADA_SISTEMA,
  parcheAcciona,
  parcheCadena,
  parcheCenefaSoftLight,
  parcheCenefaTipo,
  parcheColorAccesorios,
  parcheTela,
  parcheVarianteBeeblack,
} from './parches';
import type { CatalogoProductos } from '../types';

describe('parcheColorAccesorios', () => {
  it('pinta las tres piezas con el mismo color', () => {
    expect(parcheColorAccesorios('NEG')).toEqual({
      colorMecanismo: 'NEG',
      colorCadena: 'NEG',
      colorPeso: 'NEG',
    });
  });
});

describe('parcheVarianteBeeblack', () => {
  it('reajusta la instalación cuando la variante nueva no la admite', () => {
    // SEMI solo admite TECHO_A_MURO: un DENTRO_DEL_MARCO heredado se corrige.
    expect(parcheVarianteBeeblack('SEMI', 'DENTRO_DEL_MARCO')).toEqual({
      beeblackVariante: 'SEMI',
      beeblackInstalacion: 'TECHO_A_MURO',
    });
  });

  it('conserva la instalación si la variante nueva la admite', () => {
    expect(parcheVarianteBeeblack('EXTERNO', 'FUERA_DEL_MARCO')).toEqual({
      beeblackVariante: 'EXTERNO',
      beeblackInstalacion: 'FUERA_DEL_MARCO',
    });
  });

  it('sin variante reconocible cae en INTERNO', () => {
    expect(parcheVarianteBeeblack('', undefined).beeblackVariante).toBe('INTERNO');
  });
});

describe('parcheAcciona', () => {
  it('pasar a MOTOR limpia la cadena', () => {
    expect(parcheAcciona('MOTOR', {})).toEqual({
      motorModelo: 'DOM41',
      codCadena: '',
      largoCadena: '',
      colorCadena: '',
      // Sin cadena tampoco hay cadena metálica que cobrar.
      cadenaMetalica: false,
    });
  });

  it('con cenefa ovalada el motor por defecto es el DOM38', () => {
    expect(parcheAcciona('MOTOR', { cenefaOvalada: true }).motorModelo).toBe('DOM38');
  });

  it('respeta el motor ya elegido', () => {
    expect(parcheAcciona('MOTOR', { motorModelo: 'CABLE', cenefaOvalada: true }).motorModelo).toBe(
      'CABLE',
    );
  });

  it('volver a CADENA limpia todo lo del motor', () => {
    expect(parcheAcciona('CADENA', { motorModelo: 'DOM38' })).toEqual({
      motorModelo: '',
      motorTipo: '',
      ladoMotor: '',
    });
  });
});

describe('parcheCadena', () => {
  const cadenas = [{ cod: 'CAD01', nemotecnico: 'CADENA 1 METRO', color: 'BLANCO' }];

  it('sin código limpia los tres campos', () => {
    expect(parcheCadena('', cadenas)).toEqual({
      codCadena: '',
      largoCadena: '',
      colorCadena: '',
      cadenaMetalica: false,
    });
  });

  it('arrastra largo y color de la cadena elegida', () => {
    expect(parcheCadena('CAD01', cadenas)).toEqual({
      codCadena: 'CAD01',
      largoCadena: '1mts',
      colorCadena: 'BCO',
      cadenaMetalica: false,
    });
  });

  it('elegir la METÁLICA enciende el flag que cobra Fase 1', () => {
    // Y al revés: elegir cualquier otra lo apaga (los dos casos de arriba).
    expect(parcheCadena('CAD13', cadenas)).toEqual({
      cadenaMetalica: true,
      codCadena: 'CAD13',
      largoCadena: 'ROLLO',
      colorCadena: 'MET',
    });
  });
});

describe('parcheCenefaTipo', () => {
  it('la ovalada nace CON TIRA', () => {
    expect(parcheCenefaTipo('Ovalada')).toEqual({ cenefa: 'Ovalada', cenefaTira: 'CON TIRA' });
  });

  it('en categoría B la ovalada va SIN TIRA', () => {
    expect(parcheCenefaTipo('Ovalada', { lineaB: true })).toEqual({
      cenefa: 'Ovalada',
      cenefaTira: 'SIN TIRA',
    });
  });

  it('la cuadrada nunca lleva tira', () => {
    expect(parcheCenefaTipo('Cuadrada a muro').cenefaTira).toBe('SIN TIRA');
  });
});

describe('parcheCenefaSoftLight', () => {
  it('la ovalada del sistema deja el campo vacío', () => {
    expect(parcheCenefaSoftLight(CENEFA_OVALADA_SISTEMA)).toEqual({ cenefa: '' });
  });

  it('la cuadrada sí se escribe', () => {
    expect(parcheCenefaSoftLight('Cuadrada a techo')).toEqual({ cenefa: 'Cuadrada a techo' });
  });
});

describe('parcheTela', () => {
  const catalogo: CatalogoProductos = {
    'BK 10': { cod: 'BLACKOUT', producto: 'BLACKOUT BLANCO', tipo: 'PREMIUM' } as never,
  };
  const sel = { codInt: 'BK 10', producto: 'BLACKOUT BLANCO', tipo: 'PREMIUM', descripcion: 'd' };

  it('en dual la tela es del PAÑO', () => {
    const p = parcheTela(sel, catalogo, true);
    expect(p.ventana).toBeUndefined();
    expect(p.pano).toEqual({
      codInt: 'BK 10',
      producto: 'BLACKOUT BLANCO',
      descripcion: 'd',
      tipoTela: 'BK',
    });
  });

  it('fuera de dual la tela es de la VENTANA y el paño solo guarda el tipo', () => {
    const p = parcheTela(sel, catalogo, false);
    expect(p.ventana).toEqual({
      codInt: 'BK 10',
      producto: 'BLACKOUT BLANCO',
      tipo: 'PREMIUM',
      descripcion: 'd',
    });
    expect(p.pano).toEqual({ tipoTela: 'BK' });
  });
});
