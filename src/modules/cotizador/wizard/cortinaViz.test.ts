import { describe, expect, it } from 'vitest';
import {
  colorAccesorioCanonico,
  estiloVizDePano,
  panoLlevaMotor,
  patronDeTipoTela,
  radioRollo,
  telaHexDeProducto,
  varianteViz,
  VIZ,
} from './cortinaViz';
import type { CatalogoProductos, Pano, Ventana } from '../types';

const vent = (over: Partial<Ventana> = {}, pano: Partial<Pano> = {}): Ventana =>
  ({
    id: 'v1',
    ubicacion: 'LIVING',
    categoria: 'ROL',
    codInt: 'BK 18',
    producto: 'ROLLER BLACKOUT DELUX',
    color: 'BLANCO',
    alto: 2,
    cantidad: 1,
    panos: [{ ancho: 1.5, alto: 2, color: '', ...pano } as Pano],
    ...over,
  }) as unknown as Ventana;

describe('varianteViz — qué categorías tienen dibujo', () => {
  it('el roller y sus parientes con cenefa dibujan un roller', () => {
    expect(varianteViz('ROL')).toBe('roller');
    expect(varianteViz('ROL_MANUAL_CENEFA_OVALADA_38mm')).toBe('roller');
    expect(varianteViz('ROL_CENEFA_OVALADA_MOTOR_GRANDE')).toBe('roller');
    expect(varianteViz('PLETINA_ROLLER_V')).toBe('roller');
  });

  it('el dual y el dúo tienen su propia silueta', () => {
    expect(varianteViz('ROL_DUAL')).toBe('dual');
    expect(varianteViz('DUO_MANUAL_38mm')).toBe('duo');
    expect(varianteViz('DUO_MOTOR_GRANDE_45mm')).toBe('duo');
    expect(varianteViz('PLETINA_DUO_V')).toBe('duo');
  });

  it('lo que se fabrica distinto NO se dibuja como roller', () => {
    // Mostrarles un roller genérico confundiría más de lo que ayuda: estas
    // categorías se cargan solo con la ficha clásica.
    expect(varianteViz('VERTICAL')).toBeNull();
    expect(varianteViz('BEEBLACK')).toBeNull();
    expect(varianteViz('SOFT_LIGHT_38mm')).toBeNull();
    expect(varianteViz('DARK_45mm')).toBeNull();
    expect(varianteViz('OSCURANTI_63mm')).toBeNull();
    expect(varianteViz('')).toBeNull();
    expect(varianteViz(undefined)).toBeNull();
  });
});

describe('estiloVizDePano — cómo se pinta', () => {
  it('el color de accesorios manda en los herrajes', () => {
    expect(estiloVizDePano(vent(), { colorMecanismo: 'NEG' } as Pano).herrajesColor).toBe('NEGRO');
    expect(estiloVizDePano(vent(), { colorMecanismo: 'BCO' } as Pano).herrajesColor).toBe('BLANCO');
    expect(estiloVizDePano(vent(), { colorMecanismo: 'GRS' } as Pano).herrajesColor).toBe('GRIS');
  });

  it('un color desconocido no rompe el dibujo: cae al herraje gris', () => {
    const e = estiloVizDePano(vent(), { colorMecanismo: 'FUCSIA' } as Pano);
    expect(e.herrajesHex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('el tipo de tela define la textura', () => {
    expect(patronDeTipoTela('SCR')).toBe('screen');
    expect(patronDeTipoTela('BK')).toBe('solida');
    expect(patronDeTipoTela('DU')).toBe('bandas');
    expect(patronDeTipoTela('')).toBe('screen');
  });

  it('el dúo va en bandas aunque su tela diga otra cosa', () => {
    const e = estiloVizDePano(vent({ categoria: 'DUO_MANUAL_38mm' }), { tipoTela: 'BK' } as Pano, undefined, 'duo');
    expect(e.telaPatron).toBe('bandas');
  });

  it('con motor no se dibuja cadena, y el lado lo manda el motor', () => {
    const e = estiloVizDePano(vent(), {
      motorModelo: 'DOM38',
      ladoMotor: 'IZQUIERDA',
      cierreVert: 'Derecha',
    } as Pano);
    expect(e.accionamiento).toBe('motor');
    expect(e.lado).toBe('izquierda');
  });

  it('sin motor, el lado lo manda la posición de la cadena', () => {
    const e = estiloVizDePano(vent(), { cierreVert: 'Izquierda' } as Pano);
    expect(e.accionamiento).toBe('cadena');
    expect(e.lado).toBe('izquierda');
  });

  it('la cenefa se clasifica en ovalada, cuadrada o ninguna', () => {
    expect(estiloVizDePano(vent(), { cenefa: 'No' } as Pano).cenefa).toBe('no');
    expect(estiloVizDePano(vent(), { cenefa: 'Ovalada' } as Pano).cenefa).toBe('ovalada');
    expect(estiloVizDePano(vent(), { cenefa: 'Cuadrada a techo' } as Pano).cenefa).toBe('cuadrada');
  });

  it('en dual cada paño trae su tela; en el resto manda la de la ventana', () => {
    const catalogo = {
      'BK 18': { descripcion: 'CS 0303 NEGRO' },
      'SC 64': { descripcion: 'CS 9000 BLANCO' },
    } as unknown as CatalogoProductos;
    const v = vent({ codInt: 'BK 18' }, { codInt: 'SC 64' });
    expect(estiloVizDePano(v, v.panos[0], catalogo, 'roller').telaHex).toBe(
      telaHexDeProducto('BK 18', catalogo),
    );
    expect(estiloVizDePano(v, v.panos[0], catalogo, 'dual').telaHex).toBe(
      telaHexDeProducto('SC 64', catalogo),
    );
  });
});

describe('color de tela desde la descripción', () => {
  it('reconoce los nombres que aparecen en el catálogo', () => {
    const cat = {
      A: { descripcion: 'CS 0303 IVORY' },
      B: { descripcion: 'BLACKOUT NEGRO' },
      C: { descripcion: 'SIN COLOR CONOCIDO' },
    } as unknown as CatalogoProductos;
    expect(telaHexDeProducto('A', cat)).not.toBe(telaHexDeProducto('B', cat));
    // Lo que no reconoce cae a un neutro, nunca a undefined.
    expect(telaHexDeProducto('C', cat)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(telaHexDeProducto('NO EXISTE', cat)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(telaHexDeProducto(undefined, undefined)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('panoLlevaMotor', () => {
  it('cualquier rastro de motor cuenta (mismo criterio que el gate de Fase 2)', () => {
    expect(panoLlevaMotor({ motorModelo: 'DOM38' } as Pano)).toBe(true);
    expect(panoLlevaMotor({ ladoMotor: 'DERECHA' } as Pano)).toBe(true);
    expect(panoLlevaMotor({ motorTipo: 'CON DOMÓTICA' } as Pano)).toBe(true);
    expect(panoLlevaMotor({} as Pano)).toBe(false);
  });
});

describe('radioRollo — el rollo engorda al enrollar', () => {
  it('sin tela encima es el tubo desnudo', () => {
    expect(radioRollo(0)).toBeCloseTo(VIZ.tr, 6);
  });

  it('crece con la tela enrollada, pero cada vez menos (área constante)', () => {
    const r1 = radioRollo(200);
    const r2 = radioRollo(400);
    expect(r1).toBeGreaterThan(VIZ.tr);
    expect(r2).toBeGreaterThan(r1);
    // El segundo tramo suma menos que el primero: es un rollo, no un cono.
    expect(r2 - r1).toBeLessThan(r1 - VIZ.tr);
  });

  it('un valor negativo no produce NaN', () => {
    expect(radioRollo(-50)).toBeCloseTo(VIZ.tr, 6);
  });
});

describe('colorAccesorioCanonico', () => {
  it('normaliza corto, largo y plural al mismo nombre', () => {
    for (const c of ['NEG', 'NEGRO', 'negros']) expect(colorAccesorioCanonico(c)).toBe('NEGRO');
    for (const c of ['BCO', 'BLANCO', 'blanca']) expect(colorAccesorioCanonico(c)).toBe('BLANCO');
    for (const c of ['GRS', 'GRIS', 'GRISES']) expect(colorAccesorioCanonico(c)).toBe('GRIS');
    expect(colorAccesorioCanonico('')).toBe('');
    expect(colorAccesorioCanonico(undefined)).toBe('');
  });
});
