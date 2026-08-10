// ─────────────────────────────────────────────────────────────────────
// LÍNEA B (gama económica) — flujo completo del motor.
//
// La línea B es la MISMA cortina (roller simple, cenefa ovalada, dúo) fabricada
// con otro juego de herrajes: kits MEC 06/15/37/44/45, tubo E01, pesos
// E40/E69-B, cenefas E60/E72-B y, en dúo, peso U E25/E70-B + peso interno
// E79-B/E71-B. Solo existe en blanco y negro (pizarra 2026-08-07).
//
// Estos tests fijan las tres cosas que un cambio futuro podría romper en
// silencio: qué kit sale por color y categoría, que un color sin receta NO caiga
// a los herrajes de la línea A, y que la línea A siga intacta.
// ─────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { mecanismoParaPano, modeloVentanaPorAncho, resincronizarChipsPanos } from './chips';
import { calcularDespiece } from './despiece';
import { codigoEstructura } from './codigos-estructura';
import {
  codigoInsumoMec,
  esKitLineaBValido,
  kitsLineaB,
  mecLineaB,
  numeroMecDeChip,
} from './reglas-mecanismo';
import { codigoTuboPorAncho, tuberiaCodigoCorto, tuberiaParaPano } from './reglas-tuberia';
import { esFilaLineaB, modelosParaCategoria } from './tipos';
import {
  OPCIONES_MECANISMO,
  OPCIONES_MECANISMO_RESOLUCION,
  OPCIONES_TUBERIA,
} from '@/modules/cotizador/fase2';
import type { ModeloDespiece } from './tipos';

// ── Catálogo sintético: filas A y B de las tres categorías ────────────
const fila = (o: Partial<ModeloDespiece> & { mecanismo: string }): ModeloDespiece => ({
  sistema: 'ROLLER_SIMPLE',
  tipo_rol: 'ROL_SIMPLE',
  codigos_tubo: 'E01; E02',
  diametro_tubo_mm: 38,
  dcto_tubo_cm: 3.8,
  dcto_tela_cm: 0,
  suma_peso_cm: 0.1,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 2.6,
  activo: true,
  notas: '',
  ...o,
});

const NOTA_B = 'LINEA B — gama económica';

// Roller simple
const A_SIMPLE_BCO = fila({ mecanismo: 'MEC_33_KIT_SIMPLE_BLANCO' });
const B_SIMPLE_MEC06 = fila({ mecanismo: 'MEC_06_LZ50_BLANCO', dcto_tubo_cm: 3.8, notas: NOTA_B });
const B_SIMPLE_MEC44 = fila({ mecanismo: 'MEC_44_LZ50_B_BLANCO', dcto_tubo_cm: 3.4, notas: NOTA_B });
const B_SIMPLE_MEC15 = fila({ mecanismo: 'MEC_15_LZ50_B_NEGRO', dcto_tubo_cm: 3.3, notas: NOTA_B });

// Cenefa ovalada roller
const ovalada = (o: Partial<ModeloDespiece> & { mecanismo: string }) =>
  fila({
    sistema: 'CENEFA_OVALADA',
    tipo_rol: 'ROL_CENEFA_OV_MANUAL_38mm',
    dcto_tubo_cm: 1.8,
    dcto_cenefa_cm: 1.5,
    ancho_max_m: 2.5,
    ...o,
  });
const A_OVAL_BCO = ovalada({ mecanismo: 'MEC_10_OVALADA_BLANCO' });
const B_OVAL_BCO = ovalada({ mecanismo: 'MEC_37_OVALADA_B_BLANCO', dcto_tubo_cm: 1.5, notas: NOTA_B });
const B_OVAL_NEG = ovalada({ mecanismo: 'MEC_45_OVALADA_B_NEGRO', dcto_tubo_cm: 1.5, notas: NOTA_B });

// Dúo cenefa ovalada
const duo = (o: Partial<ModeloDespiece> & { mecanismo: string }) =>
  fila({
    sistema: 'CENEFA_OVALADA_DUO',
    tipo_rol: 'DUO_MANUAL_38mm',
    dcto_tubo_cm: 1.5,
    dcto_cenefa_cm: 1.5,
    suma_peso_cm: 0,
    dcto_tela_cm: 0.5,
    peso_interno_duo_cm: 0.5,
    peso_u_duo_cm: 0.1,
    ancho_max_m: 2.5,
    ...o,
  });
const B_DUO_BCO = duo({ mecanismo: 'MEC_37_DUO_B_BLANCO', notas: NOTA_B });
const B_DUO_NEG = duo({ mecanismo: 'MEC_45_DUO_B_NEGRO', notas: NOTA_B });

const CATALOGO = [
  A_SIMPLE_BCO, B_SIMPLE_MEC06, B_SIMPLE_MEC44, B_SIMPLE_MEC15,
  A_OVAL_BCO, B_OVAL_BCO, B_OVAL_NEG,
  B_DUO_BCO, B_DUO_NEG,
];

const OPC = OPCIONES_MECANISMO_RESOLUCION;
const mecB = (
  p: Record<string, unknown>,
  color: string,
  categoria: string,
  ancho = 1.5,
  lineaB = true,
) => mecanismoParaPano(p, color, null, OPC, categoria, ancho, false, undefined, lineaB);

describe('línea B — qué kit sale por color y categoría', () => {
  it('roller simple: blanco → MEC 06 (default de la pizarra) · negro → MEC 15', () => {
    expect(numeroMecDeChip(mecB({}, 'BLANCO', 'ROL'))).toBe(6);
    expect(numeroMecDeChip(mecB({}, 'NEGRO', 'ROL'))).toBe(15);
  });

  it('cenefa ovalada 38: blanco → MEC 37 · negro → MEC 45', () => {
    const cat = 'ROL_MANUAL_CENEFA_OVALADA_38mm';
    expect(numeroMecDeChip(mecB({}, 'BLANCO', cat))).toBe(37);
    expect(numeroMecDeChip(mecB({}, 'NEGRO', cat))).toBe(45);
  });

  it('dúo 38 comparte el kit de la ovalada, igual que en la línea A', () => {
    expect(numeroMecDeChip(mecB({}, 'BLANCO', 'DUO_MANUAL_38mm'))).toBe(37);
    expect(numeroMecDeChip(mecB({}, 'NEGRO', 'DUO_MANUAL_38mm'))).toBe(45);
  });

  it('el ancho NO cambia el kit: la línea B no tiene bandas de 45 ni 63 mm', () => {
    for (const ancho of [0.8, 2.5, 3.4]) {
      expect(numeroMecDeChip(mecB({}, 'BLANCO', 'ROL', ancho))).toBe(6);
    }
  });

  it('respeta el MEC 44 elegido a mano en el simple blanco (la pizarra da dos)', () => {
    const conMec44 = { mecanismo: 'ROLLER BCO CAT.B [MEC 44]' };
    expect(numeroMecDeChip(mecB(conMec44, 'BLANCO', 'ROL'))).toBe(44);
    expect(kitsLineaB('ROL', 'BLANCO')).toEqual([6, 44]);
    expect(esKitLineaBValido('ROL', 'BLANCO', 44)).toBe(true);
    // …pero MEC 44 no es una opción del negro: vuelve al default de su color.
    expect(esKitLineaBValido('ROL', 'NEGRO', 44)).toBe(false);
    expect(numeroMecDeChip(mecB(conMec44, 'NEGRO', 'ROL'))).toBe(15);
  });

  it('el kit sigue al color: cambiar blanco→negro recolorea dentro de la línea B', () => {
    const guardado = { mecanismo: 'LZ50 MERG BCO [MEC 06]' };
    expect(numeroMecDeChip(mecB(guardado, 'NEGRO', 'ROL'))).toBe(15);
  });
});

describe('línea B — un color sin receta no cae a la línea A', () => {
  it('gris deja el mecanismo como estaba (no toma el kit gris MEC 34)', () => {
    expect(mecLineaB('ROL', 'GRIS')).toBeNull();
    expect(mecB({}, 'GRIS', 'ROL')).toBe('');
    expect(mecB({ mecanismo: 'LZ50 MERG BCO [MEC 06]' }, 'GRIS', 'ROL')).toBe(
      'LZ50 MERG BCO [MEC 06]',
    );
  });

  it('sin kits para ofrecer, el selector de la cortina gris queda vacío', () => {
    expect(kitsLineaB('ROL', 'GRIS')).toEqual([]);
  });
});

describe('línea A intacta (regresiones)', () => {
  it('el MEC 06 de una cortina A sigue migrando al kit por color', () => {
    const chip = mecanismoParaPano(
      { mecanismo: 'LZ50 MERG BCO [MEC 06]' },
      'BLANCO',
      A_SIMPLE_BCO,
      OPCIONES_MECANISMO,
      'ROL',
      1.5,
    );
    expect(numeroMecDeChip(chip)).toBe(33);
  });

  it('una cortina A nunca elige una fila marcada LINEA B, aunque venga primera', () => {
    // El catálogo pone la fila B de blanco antes que la A para forzar el caso.
    const desordenado = [B_SIMPLE_MEC44, B_SIMPLE_MEC06, A_SIMPLE_BCO];
    const elegido = modeloVentanaPorAncho(desordenado, 'ROL', 'BLANCO', 1.5);
    expect(elegido?.mecanismo).toBe('MEC_33_KIT_SIMPLE_BLANCO');
    expect(esFilaLineaB(elegido!)).toBe(false);
  });

  it('sin filas de su línea, se usan las que haya (catálogo a medio dar de alta)', () => {
    expect(modelosParaCategoria([A_SIMPLE_BCO], 'ROL', undefined, true)).toEqual([A_SIMPLE_BCO]);
  });
});

describe('línea B — la fila del catálogo y sus medidas de corte', () => {
  it('elige la fila del kit B, no la de la línea A', () => {
    const bcoB = modeloVentanaPorAncho(CATALOGO, 'ROL', 'BLANCO', 1.5, false, undefined, undefined, true);
    expect(bcoB?.mecanismo).toBe('MEC_06_LZ50_BLANCO');
    const negB = modeloVentanaPorAncho(CATALOGO, 'ROL', 'NEGRO', 1.5, false, undefined, undefined, true);
    expect(negB?.mecanismo).toBe('MEC_15_LZ50_B_NEGRO');
  });

  it('roller simple blanco MEC 06 (ancho 100): tubo 96,2 · peso 95,8 · tela 95,7', () => {
    const cortes = calcularDespiece(B_SIMPLE_MEC06, 100).cortes;
    const med = (c: string) => cortes.find((x) => x.componente === c)?.medidaCm;
    expect(med('Tubo')).toBe(96.2);
    expect(med('Peso')).toBe(95.8);
    expect(med('Tela (ancho)')).toBe(95.7);
  });

  it('roller simple blanco MEC 44 (−3,4): tubo 96,6 · peso 96,2 · tela 96,1', () => {
    const cortes = calcularDespiece(B_SIMPLE_MEC44, 100).cortes;
    const med = (c: string) => cortes.find((x) => x.componente === c)?.medidaCm;
    expect(med('Tubo')).toBe(96.6);
    expect(med('Peso')).toBe(96.2);
    expect(med('Tela (ancho)')).toBe(96.1);
  });

  it('roller simple negro MEC 15 (−3,3): tubo 96,7 · peso 96,3 · tela 96,2', () => {
    const cortes = calcularDespiece(B_SIMPLE_MEC15, 100).cortes;
    const med = (c: string) => cortes.find((x) => x.componente === c)?.medidaCm;
    expect(med('Tubo')).toBe(96.7);
    expect(med('Peso')).toBe(96.3);
    expect(med('Tela (ancho)')).toBe(96.2);
  });

  it('cenefa ovalada B (ancho −1,5 cenefa, −1,5 tubo): cenefa 98,5 · tubo 97 · peso 96,6', () => {
    const cortes = calcularDespiece(B_OVAL_BCO, 100).cortes;
    const med = (c: string) => cortes.find((x) => x.componente === c)?.medidaCm;
    expect(med('Cenefa ovalada')).toBe(98.5);
    expect(med('Tubo')).toBe(97);
    expect(med('Peso')).toBe(96.6);
    expect(med('Tela (ancho)')).toBe(96.5);
  });

  it('dúo B: tela = tubo −0,5 · peso interno = tela · peso U = tubo −0,1', () => {
    const cortes = calcularDespiece(B_DUO_BCO, 100).cortes;
    const med = (c: string) => cortes.find((x) => x.componente === c)?.medidaCm;
    expect(med('Cenefa ovalada')).toBe(98.5);
    expect(med('Tubo')).toBe(97);
    expect(med('Tela (ancho)')).toBe(96.5);
    expect(med('Peso interno (E13)')).toBe(96.5);
    expect(med('Peso U (lágrima)')).toBe(96.9);
  });
});

// La categoría B tiene UNA sola banda por ancho, la suya: hasta 2,5 m el tubo
// delgado E01 (Ø38 0,8) y por encima el E39 (Ø45 1,2), porque el E01 no aguanta
// esos anchos. No participa de ninguna banda de la categoría A. El tramo ancho
// SOLO existe en roller simple: la ovalada y el dúo B no tienen tubo para eso.
describe('categoría B — su propia banda de tubo (E01 / E39)', () => {
  const tuboB = (ancho: number, categoria = 'ROL', modelo = B_SIMPLE_MEC06) =>
    codigoTuboPorAncho(modelo, ancho, categoria, undefined, true);

  it('hasta 2,5 m va el E01; el 2,50 exacto todavía es E01', () => {
    expect(tuboB(1.0)).toBe('E01');
    expect(tuboB(2.2)).toBe('E01');
    expect(tuboB(2.5)).toBe('E01');
  });

  it('sobre 2,5 m el roller simple pasa al E39', () => {
    expect(tuboB(2.51)).toBe('E39');
    expect(tuboB(2.8)).toBe('E39');
    expect(tuboB(3.0)).toBe('E39');
  });

  it('el E39 SOLO existe en roller simple: la ovalada y el dúo se quedan en E01', () => {
    const oval = 'ROL_MANUAL_CENEFA_OVALADA_38mm';
    expect(tuboB(2.8, oval, B_OVAL_BCO)).toBe('E01');
    expect(tuboB(3.0, oval, B_OVAL_NEG)).toBe('E01');
    expect(tuboB(2.8, 'DUO_MANUAL_38mm', B_DUO_BCO)).toBe('E01');
    // Lo que corta a esas cortinas es el ancho máximo de su fila, no el tubo.
    expect(B_OVAL_BCO.ancho_max_m).toBeLessThanOrEqual(2.5);
  });

  it('el match de la categoría es EXACTO: «ROL_MANUAL_…» no es «ROL»', () => {
    // Con un `includes` en vez de igualdad, la ovalada se llevaría el E39 solo
    // porque su nombre empieza con ROL. Este test fija justamente eso.
    expect(tuboB(2.8, 'ROL')).toBe('E39');
    expect(tuboB(2.8, 'ROL_MANUAL_CENEFA_OVALADA_38mm', B_OVAL_BCO)).toBe('E01');
  });

  it('no participa de las bandas de la categoría A (E66/E78/E65)', () => {
    for (const ancho of [1.0, 2.5, 2.8, 3.5]) {
      expect(['E01', 'E39']).toContain(tuboB(ancho));
    }
    // La misma cortina en la categoría A sí obedece la regla E02/E66.
    expect(codigoTuboPorAncho(A_SIMPLE_BCO, 1.0, 'ROL')).toBe('E02');
    expect(codigoTuboPorAncho(A_SIMPLE_BCO, 2.5, 'ROL')).toBe('E66');
  });

  it('el ancho mueve el TUBO pero no el KIT', () => {
    expect(numeroMecDeChip(mecB({}, 'BLANCO', 'ROL', 2.8))).toBe(6);
    expect(numeroMecDeChip(mecB({}, 'NEGRO', 'ROL', 2.8))).toBe(15);
  });

  it('el chip sale del catálogo aunque los dos tubos estén ocultos', () => {
    const chipAngosto = tuberiaParaPano(
      1.5, B_SIMPLE_MEC06, '', OPCIONES_TUBERIA, 'ROL', undefined, true,
    );
    expect(chipAngosto).toContain('E01');
    const chipAncho = tuberiaParaPano(
      2.8, B_SIMPLE_MEC06, '', OPCIONES_TUBERIA, 'ROL', undefined, true,
    );
    expect(chipAncho).toContain('E39');
    // La ovalada ancha se queda con su E01.
    const chipOval = tuberiaParaPano(
      2.8, B_OVAL_BCO, '', OPCIONES_TUBERIA, 'ROL_MANUAL_CENEFA_OVALADA_38mm', undefined, true,
    );
    expect(chipOval).toContain('E01');
  });

  it('el rótulo lleva el diámetro REAL del tubo, no el de la fila de despiece', () => {
    // La fila del catálogo es de 38 mm y sirve para los dos tubos; el E39 es de 45.
    expect(tuberiaCodigoCorto(B_SIMPLE_MEC06, '', 1.5, 'ROL', undefined, true)).toBe('38mm_E01');
    expect(tuberiaCodigoCorto(B_SIMPLE_MEC06, '', 2.8, 'ROL', undefined, true)).toBe('45mm_E39');
    // En la categoría A manda el diámetro del modelo, como siempre.
    expect(tuberiaCodigoCorto(A_SIMPLE_BCO, '', 1.5, 'ROL')).toBe('38mm_E02');
  });
});

describe('línea B — códigos de bodega de cada pieza', () => {
  const cod = (columna: string, color: string, lineaB: boolean) =>
    codigoEstructura(columna, color, '38mm_E01', undefined, lineaB);

  it('peso roller: blanco E40 · negro E69-B', () => {
    expect(cod('PESO', 'BLANCO', true)).toBe('E40');
    expect(cod('PESO', 'NEGRO', true)).toBe('E69-B');
  });

  it('cenefa ovalada: blanco E60 · negro E72-B', () => {
    expect(cod('CENEFA OVALADA', 'BLANCO', true)).toBe('E60');
    expect(cod('CENEFA OVALADA', 'NEGRO', true)).toBe('E72-B');
  });

  it('dúo: peso U blanco E25 / negro E70-B · peso interno blanco E79-B / negro E71-B', () => {
    expect(cod('PESO U', 'BLANCO', true)).toBe('E25');
    expect(cod('PESO U', 'NEGRO', true)).toBe('E70-B');
    expect(cod('PESO INTERNO', 'BLANCO', true)).toBe('E79-B');
    expect(cod('PESO INTERNO', 'NEGRO', true)).toBe('E71-B');
  });

  it('la línea A queda igual, incluido el peso interno fijo E13', () => {
    expect(cod('PESO', 'BLANCO', false)).toBe('E15');
    expect(cod('PESO', 'NEGRO', false)).toBe('E14');
    expect(cod('CENEFA OVALADA', 'BLANCO', false)).toBe('E27');
    expect(cod('PESO U', 'NEGRO', false)).toBe('E18');
    expect(cod('PESO INTERNO', 'BLANCO', false)).toBe('E13');
  });

  it('un color sin receta B no inventa código', () => {
    expect(cod('PESO', 'GRIS', true)).toBe('');
    expect(cod('CENEFA OVALADA', 'GRIS', true)).toBe('');
  });

  it('los kits B llevan sufijo en bodega; el resto sigue siendo MEC<nn>', () => {
    expect(codigoInsumoMec(44)).toBe('MEC44-B');
    expect(codigoInsumoMec(45)).toBe('MEC45-B');
    expect(codigoInsumoMec(6)).toBe('MEC06');
    expect(codigoInsumoMec(33)).toBe('MEC33');
  });
});

describe('línea B — sincronización de los paños', () => {
  it('una OT con paños A y B deja a cada uno con sus herrajes', () => {
    const panos: Array<Record<string, unknown>> = [
      { ancho: 1.5, mecanismo: '', tuberia: '' },
      { ancho: 1.5, mecanismo: '', tuberia: '' },
    ];
    // Mismas listas que pasa Fase 1 al re-guardar: mecanismos de RESOLUCIÓN
    // (los kits B están ocultos) y tuberías de UI.
    resincronizarChipsPanos(
      panos,
      'BLANCO',
      A_SIMPLE_BCO,
      'ROL',
      OPCIONES_MECANISMO_RESOLUCION,
      OPCIONES_TUBERIA,
      false,
      undefined,
      [false, true],
    );
    expect(numeroMecDeChip(String(panos[0].mecanismo))).toBe(33);
    expect(String(panos[0].tuberia)).toContain('E02');
    expect(numeroMecDeChip(String(panos[1].mecanismo))).toBe(6);
    expect(String(panos[1].tuberia)).toContain('E01');
  });
});
