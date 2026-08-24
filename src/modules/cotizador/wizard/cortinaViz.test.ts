import { describe, expect, it } from 'vitest';
import {
  colorAccesorioCanonico,
  estiloVizDePano,
  panoLlevaMotor,
  patronDeTipoTela,
  perfilesVizDePano,
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

  it('la vertical dibuja su riel con lamas (catálogo de diseños 2026-08-19)', () => {
    expect(varianteViz('VERTICAL')).toBe('vertical');
  });

  it('lo que se fabrica distinto tiene SU dibujo, no el del roller', () => {
    // La oscuridad dibuja guías + zócalo + cajón; el oscuranti aparte (su tubo
    // de 63 mm se nota) y el beeblack es un acordeón con marco (2026-08-20).
    expect(varianteViz('BEEBLACK')).toBe('beeblack');
    expect(varianteViz('SOFT_LIGHT_38mm')).toBe('oscuridad');
    expect(varianteViz('SOFT_LIGHT_45mm')).toBe('oscuridad');
    expect(varianteViz('DARK_38mm')).toBe('oscuridad');
    expect(varianteViz('DARK_45mm')).toBe('oscuridad');
    expect(varianteViz('OSCURANTI_63mm')).toBe('oscuranti');
  });

  it('sin categoría no hay dibujo', () => {
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

  it('DARK y OSCURANTI dibujan el cajón aunque la ficha no marque cenefa (implícita)', () => {
    // El despiece la corta por sistema; el dibujo tiene que mostrarla igual.
    const dark = estiloVizDePano(vent({ categoria: 'DARK_38mm' }), { cenefa: '' } as Pano, undefined, 'oscuridad');
    expect(dark.cenefa).toBe('cuadrada');
    const osc = estiloVizDePano(vent({ categoria: 'OSCURANTI_63mm' }), { cenefa: '' } as Pano, undefined, 'oscuranti');
    expect(osc.cenefa).toBe('cuadrada');
    // El soft light también trae la suya, pero OVALADA (primer eslabón de su
    // cadena de corte): sin elegir nada se dibuja la ovalada del sistema…
    const sl = estiloVizDePano(vent({ categoria: 'SOFT_LIGHT_38mm' }), { cenefa: '' } as Pano, undefined, 'oscuridad');
    expect(sl.cenefa).toBe('ovalada');
    // …y con «Cuadrada» elegida pasa a familia CC (espejo del DARK): cajón.
    const cc = estiloVizDePano(
      vent({ categoria: 'SOFT_LIGHT_38mm' }),
      { cenefa: 'Cuadrada a muro' } as Pano,
      undefined,
      'oscuridad',
    );
    expect(cc.cenefa).toBe('cuadrada');
  });

  it('en el beeblack el cierre de la VENTANA define el RECORRIDO del acordeón', () => {
    // 'IZQUIERDA-DERECHA' = parte anclado a la IZQUIERDA y cierra hacia la
    // derecha (es un recorrido, no el lado del mando — el bug 2026-08-20 lo
    // espejaba al revés). 'DE ARRIBA ABAJO' baja desde el riel superior.
    const bee = (direccion: string) =>
      estiloVizDePano(
        vent({ categoria: 'BEEBLACK', direccion } as Partial<Ventana>),
        {} as Pano,
        undefined,
        'beeblack',
      );
    expect(bee('IZQUIERDA-DERECHA').beeCierre).toBe('izq-der');
    expect(bee('DERECHA-IZQUIERDA').beeCierre).toBe('der-izq');
    expect(bee('DE ARRIBA ABAJO').beeCierre).toBe('arriba-abajo');
    // Sin cierre elegido todavía, se dibuja el recorrido más común.
    expect(bee('').beeCierre).toBe('izq-der');
    // Las demás variantes no traen recorrido de acordeón.
    expect(estiloVizDePano(vent(), {} as Pano).beeCierre).toBeUndefined();
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

  it('la dual entrega las DOS telas: [0] la del vidrio, [1] la de adelante', () => {
    // El dibujo cuelga las dos a distinta altura; sin este par solo se veía una.
    const catalogo = {
      'SC 64': { descripcion: 'CS 9000 BLANCO' },
      'BK 18': { descripcion: 'CS 0303 NEGRO' },
    } as unknown as CatalogoProductos;
    const v = vent({ codInt: 'SC 64' }, { codInt: 'SC 64', tipoTela: 'SCR' });
    v.panos.push({ ancho: 1.5, alto: 2, color: '', codInt: 'BK 18', tipoTela: 'BK' } as Pano);
    const e = estiloVizDePano(v, v.panos[0], catalogo, 'dual');
    expect(e.telaDual?.[0]).toEqual({
      hex: telaHexDeProducto('SC 64', catalogo),
      patron: 'screen',
      definida: true,
    });
    expect(e.telaDual?.[1]).toEqual({
      hex: telaHexDeProducto('BK 18', catalogo),
      patron: 'solida',
      definida: true,
    });
  });

  it('el rollo de adelante sin tela queda marcado (se dibuja tenue), no copia la del otro', () => {
    // Solo el rollo 1 hereda la tela de la ventana: es la suya.
    const v = vent({ categoria: 'ROL_DUAL', codInt: 'BK 18' });
    const e = estiloVizDePano(v, v.panos[0], undefined, 'dual');
    expect(e.telaDual?.[0].definida).toBe(true);
    expect(e.telaDual?.[1].definida).toBe(false);
  });

  it('fuera de la dual no hay par de telas', () => {
    expect(estiloVizDePano(vent(), vent().panos[0], undefined, 'roller').telaDual).toBeUndefined();
  });

  it('el peso de la oscuridad solo existe en blanco o negro: el café lleva peso NEGRO', () => {
    // Fotos del dueño (2026-08-21): soft light con perfiles café y peso negro.
    // Es lo que dice el catálogo (E24 blanco / E44 negro, nada más).
    const negro = estiloVizDePano(vent(), { colorMecanismo: 'NEG' } as Pano).herrajesHex;
    const blanco = estiloVizDePano(vent(), { colorMecanismo: 'BCO' } as Pano).herrajesHex;
    const cafe = estiloVizDePano(
      vent({ categoria: 'SOFT_LIGHT_38mm' }),
      { colorMecanismo: 'CAFÉ' } as Pano,
      undefined,
      'oscuridad',
    );
    expect(cafe.herrajesHex).not.toBe(negro);
    expect(cafe.pesoHex).toBe(negro);
    expect(
      estiloVizDePano(vent({ categoria: 'DARK_38mm' }), { colorMecanismo: 'BCO' } as Pano, undefined, 'oscuridad')
        .pesoHex,
    ).toBe(blanco);
    // Fuera de la oscuridad el peso sigue al color de accesorios.
    const rol = estiloVizDePano(vent(), { colorMecanismo: 'CAFÉ' } as Pano, undefined, 'roller');
    expect(rol.pesoHex).toBe(rol.herrajesHex);
  });

  it('la oscuridad trae sus perfiles; el resto no', () => {
    expect(estiloVizDePano(vent(), {} as Pano, undefined, 'roller').perfiles).toBeUndefined();
    const sl = estiloVizDePano(vent({ categoria: 'SOFT_LIGHT_38mm' }), {} as Pano, undefined, 'oscuridad');
    expect(sl.perfiles).toEqual({ izq: true, der: true, base: false, sepIzq: false, sepDer: false, sepBase: false });
  });
});

describe('perfilesVizDePano — se dibuja lo que el taller corta', () => {
  const sl = (pano: Partial<Pano>) =>
    perfilesVizDePano(vent({ categoria: 'SOFT_LIGHT_38mm' }), pano as Pano);

  it('sin flags, la variante manda: laterales sí, base no (mismo default que el despiece)', () => {
    expect(sl({})).toEqual({ izq: true, der: true, base: false, sepIzq: false, sepDer: false, sepBase: false });
  });

  it('el base aparece solo al activarlo, y un lateral se puede apagar', () => {
    expect(sl({ perfilInfActivo: true })?.base).toBe(true);
    expect(sl({ perfilIzqActivo: false })?.izq).toBe(false);
    expect(sl({ perfilIzqActivo: false })?.der).toBe(true);
  });

  it('retro-compat: una superficie marcada cuenta como perfil activo aunque falte el flag', () => {
    // Igual que `cortesOscuridad`: infActivo || infMuro || infPiso || infMarco.
    expect(sl({ perfilInfPiso: true })?.base).toBe(true);
    expect(sl({ perfilInfMarco: true })?.base).toBe(true);
  });

  it('los separadores se dibujan por lado', () => {
    expect(sl({ separadorIzq: true, separadorInf: true })).toMatchObject({ sepIzq: true, sepDer: false, sepBase: true });
  });

  it('el DARK y el OSCURANTI también; el roller no tiene perfiles', () => {
    expect(perfilesVizDePano(vent({ categoria: 'DARK_45mm' }), {} as Pano)?.izq).toBe(true);
    expect(perfilesVizDePano(vent({ categoria: 'OSCURANTI_63mm' }), {} as Pano)?.der).toBe(true);
    expect(perfilesVizDePano(vent(), {} as Pano)).toBeNull();
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
