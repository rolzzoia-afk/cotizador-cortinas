import { describe, expect, it } from 'vitest';
import type { Pano } from './types';
import {
  beeblackEsDoble,
  bracketDeCenefa,
  cantidadBrackets,
  cantidadSuplementosAuto,
  cantidadTarugos,
  cenefaCuadradaTapasFijas,
  codigoManillaPorColor,
  codigoMotorDesdeAdicional,
  esAdicionalHubDomotica,
  esCategoriaDuo,
  esCenefaOvalada,
  insumosBeeblackDeCortina,
  insumosDePano,
  insumosMotorDePano,
  insumosVerticalDePano,
  llevaCenefaCuadradaImplicita,
  llevaCenefaOvaladaImplicita,
  llevaTapasPeso,
  manillaDesdeAdicional,
  faltantesDomoticaInventario,
  faltantesManillasInventario,
  otLlevaDomotica,
  panoLlevaDomotica,
  tapaCenefaCuadrada,
  tapaPesoOscuridad,
  tarugoDeMaterial,
} from './insumosCortina';
import type { AdicionalFase0Persistido } from '@/modules/ots/types';

const pano = (p: Partial<Pano>): Partial<Pano> => p;

describe('codigoMotorDesdeAdicional / esAdicionalHubDomotica', () => {
  it('normaliza el código del adicional a modelo de motor (con o sin espacio)', () => {
    expect(codigoMotorDesdeAdicional('DOM 38')).toBe('DOM38');
    expect(codigoMotorDesdeAdicional('DOM38')).toBe('DOM38');
    expect(codigoMotorDesdeAdicional('dom 41')).toBe('DOM41');
  });
  it('adicionales que no son unidad de motor → null', () => {
    expect(codigoMotorDesdeAdicional('DOM 39')).toBeNull(); // control
    expect(codigoMotorDesdeAdicional('DOM 43')).toBeNull(); // hub domótica
    expect(codigoMotorDesdeAdicional('DOM 05')).toBeNull(); // router
    expect(codigoMotorDesdeAdicional('INSTMOTMG')).toBeNull(); // instalación
    expect(codigoMotorDesdeAdicional('CENF O')).toBeNull();
    expect(codigoMotorDesdeAdicional('')).toBeNull();
    expect(codigoMotorDesdeAdicional(undefined)).toBeNull();
  });
  it('hub de domótica reconoce DOM43 con o sin espacio', () => {
    expect(esAdicionalHubDomotica('DOM 43')).toBe(true);
    expect(esAdicionalHubDomotica('DOM43')).toBe(true);
    expect(esAdicionalHubDomotica('DOM 38')).toBe(false);
    expect(esAdicionalHubDomotica('')).toBe(false);
  });
});

describe('manillaDesdeAdicional / codigoManillaPorColor', () => {
  it('normaliza el código del adicional a manilla + color (con o sin espacio)', () => {
    expect(manillaDesdeAdicional('HER 47')).toEqual({ codigo: 'HER47', color: 'NEG' });
    expect(manillaDesdeAdicional('HER48')).toEqual({ codigo: 'HER48', color: 'BCO' });
    expect(manillaDesdeAdicional('her 49')).toEqual({ codigo: 'HER49', color: 'CAFÉ' });
  });
  it('adicionales que no son manilla → null', () => {
    expect(manillaDesdeAdicional('HER 48X')).toBeNull();
    expect(manillaDesdeAdicional('DOM 38')).toBeNull();
    expect(manillaDesdeAdicional('')).toBeNull();
    expect(manillaDesdeAdicional(undefined)).toBeNull();
  });
  it('código de bodega por color del paño (corto o largo)', () => {
    expect(codigoManillaPorColor('NEG')).toBe('HER47');
    expect(codigoManillaPorColor('NEGRO')).toBe('HER47');
    expect(codigoManillaPorColor('BCO')).toBe('HER48');
    expect(codigoManillaPorColor('CAFÉ')).toBe('HER49');
    expect(codigoManillaPorColor('CAFE')).toBe('HER49');
    expect(codigoManillaPorColor('MET')).toBe('');
    expect(codigoManillaPorColor('')).toBe('');
  });

  it('plurales y femeninos tecleados en Fase 1 («NEGROS», «blancas») valen como el color', () => {
    expect(codigoManillaPorColor('NEGROS')).toBe('HER47');
    expect(codigoManillaPorColor('blancas')).toBe('HER48');
    expect(tapaPesoOscuridad('NEGROS').codigo).toBe('TAP31');
    expect(tapaCenefaCuadrada('BLANCOS').codigo).toBe('TAP33');
  });
});

describe('cantidadBrackets', () => {
  it('hasta 1 m → 2; sobre 1 m suma 1 cada 60 cm iniciados', () => {
    expect(cantidadBrackets(0.8)).toBe(2);
    expect(cantidadBrackets(1.0)).toBe(2);
    expect(cantidadBrackets(1.01)).toBe(3);
    expect(cantidadBrackets(1.5)).toBe(3);
    expect(cantidadBrackets(1.6)).toBe(3); // regresión flotante: 1,6−1 en metros daría 4
    expect(cantidadBrackets(2.0)).toBe(4);
    expect(cantidadBrackets(3.0)).toBe(6);
  });
});

describe('llevaTapasPeso', () => {
  it('roller (incluye ovalada, motorizados, DUAL y pletina roller); excluye dúo/pletina dúo/oscuridad', () => {
    expect(llevaTapasPeso('ROL')).toBe(true);
    expect(llevaTapasPeso('ROL_MANUAL_CENEFA_OVALADA_38mm')).toBe(true);
    expect(llevaTapasPeso('ROL_CENEFA_OVALADA_MOTOR_GRANDE')).toBe(true);
    // Dual: cada roller/tela lleva su barra de peso con 2 tapas (2026-07-15).
    expect(llevaTapasPeso('ROL_DUAL')).toBe(true);
    // Pletina roller: barra de peso roller con 2 tapas (2026-07-20).
    expect(llevaTapasPeso('PLETINA_ROLLER_V')).toBe(true);
    // Pletina dúo: NO usa tapas roller (usa el juego dúo, ver llevaTapasDuo).
    expect(llevaTapasPeso('PLETINA_DUO_V')).toBe(false);
    expect(llevaTapasPeso('DUO_MANUAL_38mm')).toBe(false);
    expect(llevaTapasPeso('SOFT_LIGHT_38mm')).toBe(false);
    expect(llevaTapasPeso('OSCURANTI_63mm')).toBe(false);
    expect(llevaTapasPeso('VERTICAL')).toBe(false);
    expect(llevaTapasPeso('')).toBe(false);
  });
});

describe('bracketDeCenefa', () => {
  it('ovalada → BRA01 (corto) / BRA02 (largo), default corto', () => {
    expect(bracketDeCenefa('Ovalada', 'CORTO')?.codigo).toBe('BRA01');
    expect(bracketDeCenefa('Ovalada', 'LARGO')?.codigo).toBe('BRA02');
    expect(bracketDeCenefa('Ovalada', '')?.codigo).toBe('BRA01');
  });
  it('cuadrada a techo → BRA04; a muro → BRA05', () => {
    expect(bracketDeCenefa('Cuadrada a techo', '')?.codigo).toBe('BRA04');
    expect(bracketDeCenefa('Cuadrada a muro', '')?.codigo).toBe('BRA05');
  });
  it("'Cuadrada' legacy → BRA05 salvo superficie TECHO → BRA04", () => {
    expect(bracketDeCenefa('Cuadrada', '', 'TECHO')?.codigo).toBe('BRA04');
    expect(bracketDeCenefa('Cuadrada', '', 'PARED')?.codigo).toBe('BRA05');
    expect(bracketDeCenefa('Cuadrada', '')?.codigo).toBe('BRA05');
  });
  it('DARK (cenefa cuadrada implícita, cenefa vacía) → BRA05 muro / BRA04 techo', () => {
    expect(bracketDeCenefa('No', '', 'PARED', 'DARK_38mm')?.codigo).toBe('BRA05');
    expect(bracketDeCenefa('', '', '', 'DARK_45mm')?.codigo).toBe('BRA05');
    expect(bracketDeCenefa('No', '', 'TECHO', 'DARK_38mm')?.codigo).toBe('BRA04');
  });
  it('sin cenefa → null (categoría no-DARK)', () => {
    expect(bracketDeCenefa('No', '')).toBeNull();
    expect(bracketDeCenefa('', '')).toBeNull();
    expect(bracketDeCenefa('No', '', '', 'SOFT_LIGHT_38mm')).toBeNull();
  });
  it('el DÚO sin tipo elegido emite el LARGO: su receta cobra BRA02 (2026-08-20)', () => {
    // La cenefa del dúo va por SISTEMA (CENEFA_OVALADA_DUO), la marque la ficha o no.
    expect(bracketDeCenefa('', '', '', 'DUO_MANUAL_38mm')?.codigo).toBe('BRA02');
    expect(bracketDeCenefa('Ovalada', '', '', 'DUO_MOTOR_GRANDE_45mm')?.codigo).toBe('BRA02');
    // Un CORTO elegido a mano sigue ganando.
    expect(bracketDeCenefa('Ovalada', 'CORTO', '', 'DUO_MANUAL_38mm')?.codigo).toBe('BRA01');
    // El roller de cenefa ovalada conserva su default CORTO…
    expect(bracketDeCenefa('', '', '', 'ROL_MANUAL_CENEFA_OVALADA_38mm')?.codigo).toBe('BRA01');
    // …y la pletina dúo (velcro) sigue sin cenefa.
    expect(bracketDeCenefa('', '', '', 'PLETINA_DUO_V')).toBeNull();
  });
});

describe('llevaCenefaCuadradaImplicita', () => {
  it('DARK y OSCURANTI sí; soft light / roller no', () => {
    expect(llevaCenefaCuadradaImplicita('DARK_38mm')).toBe(true);
    expect(llevaCenefaCuadradaImplicita('DARK_45mm')).toBe(true);
    // Oscuranti lleva su cenefa cuadrada delantera siempre (pizarra 2026-07-28).
    expect(llevaCenefaCuadradaImplicita('OSCURANTI_63mm')).toBe(true);
    expect(llevaCenefaCuadradaImplicita('SOFT_LIGHT_38mm')).toBe(false);
    expect(llevaCenefaCuadradaImplicita('ROL')).toBe(false);
    expect(llevaCenefaCuadradaImplicita('')).toBe(false);
  });
});

describe('llevaCenefaOvaladaImplicita — la cenefa que trae el SISTEMA', () => {
  it('el dúo la lleva aunque su categoría no diga «cenefa ovalada»', () => {
    // Se fabrica en CENEFA_OVALADA_DUO y todas sus filas traen dcto_cenefa_cm:
    // el despiece corta la cenefa siempre. Mirando el TEXTO de la categoría el
    // dúo quedaba sin tapa, sin bracket y sin línea de cenefa en el BOM.
    expect(llevaCenefaOvaladaImplicita('DUO_MANUAL_38mm')).toBe(true);
    expect(llevaCenefaOvaladaImplicita('DUO_MANUAL_45mm')).toBe(true);
    expect(llevaCenefaOvaladaImplicita('DUO_MOTOR_PEQUEÑO_38mm')).toBe(true);
    expect(llevaCenefaOvaladaImplicita('DUO_MOTOR_GRANDE_45mm')).toBe(true);
    // Y el roller ovalado, que ya la llevaba por el nombre.
    expect(llevaCenefaOvaladaImplicita('ROL_MANUAL_CENEFA_OVALADA_38mm')).toBe(true);
  });

  it('la pletina dúo (velcro) NO lleva cenefa, ni el roller simple', () => {
    expect(llevaCenefaOvaladaImplicita('PLETINA_DUO_V')).toBe(false);
    expect(llevaCenefaOvaladaImplicita('PLETINA_ROLLER_V')).toBe(false);
    expect(llevaCenefaOvaladaImplicita('ROL')).toBe(false);
    expect(llevaCenefaOvaladaImplicita('VERTICAL')).toBe(false);
    expect(llevaCenefaOvaladaImplicita('')).toBe(false);
  });

  it('y el dúo cuenta como cenefa ovalada aunque su ficha esté vacía', () => {
    expect(esCenefaOvalada('', 'DUO_MANUAL_38mm')).toBe(true);
    expect(esCenefaOvalada('No', 'DUO_MANUAL_38mm')).toBe(true);
    expect(esCenefaOvalada('', 'PLETINA_DUO_V')).toBe(false);
  });
});

describe('cenefaCuadradaTapasFijas', () => {
  it('DARK/OSCURANTI (cenefa implícita) y soft light con cenefa CUADRADA → tapas fijas', () => {
    expect(cenefaCuadradaTapasFijas('DARK_38mm')).toBe(true);
    expect(cenefaCuadradaTapasFijas('OSCURANTI_63mm')).toBe(true);
    expect(cenefaCuadradaTapasFijas('SOFT_LIGHT_38mm', 'Cuadrada a muro')).toBe(true);
    expect(cenefaCuadradaTapasFijas('SOFT_LIGHT_45mm', 'Cuadrada a techo')).toBe(true);
  });
  it('soft light OVALADA y roller cuadrada → NO fijas (siguen el selector)', () => {
    expect(cenefaCuadradaTapasFijas('SOFT_LIGHT_38mm', 'Ovalada')).toBe(false);
    expect(cenefaCuadradaTapasFijas('SOFT_LIGHT_38mm')).toBe(false);
    expect(cenefaCuadradaTapasFijas('ROL', 'Cuadrada a muro')).toBe(false);
  });
});

describe('tarugoDeMaterial', () => {
  it('vulcanita→TAR01; concreto/cerámica (con y sin tilde)→TAR03; madera/otro→null', () => {
    expect(tarugoDeMaterial('VULCANITA')?.codigo).toBe('TAR01');
    expect(tarugoDeMaterial('CONCRETO')?.codigo).toBe('TAR03');
    expect(tarugoDeMaterial('CERÁMICA')?.codigo).toBe('TAR03');
    expect(tarugoDeMaterial('CERAMICA')?.codigo).toBe('TAR03');
    expect(tarugoDeMaterial('MADERA')).toBeNull();
    expect(tarugoDeMaterial('')).toBeNull();
  });
});

describe('cantidadTarugos', () => {
  it('vulcanita/concreto/cerámica → tarugos; madera → 0; roller sin cenefa → 4', () => {
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA' }), 'ROL', 1.5)).toBe(4);
    expect(cantidadTarugos(pano({ materialTipo: 'CONCRETO' }), 'ROL', 1.5)).toBe(4);
    expect(cantidadTarugos(pano({ materialTipo: 'MADERA' }), 'ROL', 1.5)).toBe(0);
  });
  it('vertical: 1 tarugo por bracket según superficie (madera → 0)', () => {
    // cantidadBrackets(1,5) = 3; cantidadBrackets(2,12) = 4
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA' }), 'VERTICAL', 1.5)).toBe(3);
    expect(cantidadTarugos(pano({ materialTipo: 'CONCRETO' }), 'VERTICAL', 2.12)).toBe(4);
    expect(cantidadTarugos(pano({ materialTipo: 'MADERA' }), 'VERTICAL', 1.5)).toBe(0);
  });
  it('cenefa ovalada: 1/bracket a techo, 2/bracket a muro', () => {
    // cantidadBrackets(1,5) = 3
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA', cenefa: 'Ovalada', superficie: 'TECHO' }), 'ROL', 1.5)).toBe(3);
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA', cenefa: 'Ovalada', superficie: 'PARED' }), 'ROL', 1.5)).toBe(6);
  });
  it('cenefa cuadrada: 1/bracket', () => {
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA', cenefa: 'Cuadrada a muro' }), 'ROL', 1.5)).toBe(3);
  });
  it('DARK (cenefa cuadrada implícita): 1/bracket; madera → 0', () => {
    // cantidadBrackets(2,0)=4 · (2,5)=5 · (3,0)=6
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA' }), 'DARK_38mm', 2.0)).toBe(4);
    expect(cantidadTarugos(pano({ materialTipo: 'CONCRETO' }), 'DARK_38mm', 2.5)).toBe(5);
    expect(cantidadTarugos(pano({ materialTipo: 'MADERA' }), 'DARK_38mm', 3.0)).toBe(0);
  });
  it('el dúo trae su cenefa ovalada puesta: tarugos de cenefa (2/bracket a muro, 1 a techo)', () => {
    // El dúo se fabrica en el sistema CENEFA_OVALADA_DUO: la cenefa va SIEMPRE,
    // así que se fija como cualquier ovalada y no con los 4 del roller pelado.
    // cantidadBrackets(1,5) = 3.
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA' }), 'DUO_MANUAL_38mm', 1.5)).toBe(6);
    expect(
      cantidadTarugos(pano({ materialTipo: 'CONCRETO', superficie: 'TECHO' }), 'DUO_MOTOR_PEQUEÑO_38mm', 1.5),
    ).toBe(3);
    expect(cantidadTarugos(pano({ materialTipo: 'MADERA' }), 'DUO_MANUAL_38mm', 1.5)).toBe(0);
    // La pletina dúo (velcro) NO lleva cenefa: se pega, sin fijaciones.
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA' }), 'PLETINA_DUO_V', 1.5)).toBe(0);
  });
  it('pletina (velcro): 0 tarugos aunque tenga material', () => {
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA' }), 'PLETINA_ROLLER_V', 1.5)).toBe(0);
    expect(cantidadTarugos(pano({ materialTipo: 'CONCRETO' }), 'PLETINA_DUO_V', 1.5)).toBe(0);
  });
});

describe('insumosDePano', () => {
  it('roller blanco → tapas TAP19/TAP01 + 2 tornillos TOR02 + 2 topes TOP01', () => {
    const out = insumosDePano(pano({ color: 'BCO' }), { categoria: 'ROL', anchoM: 1.5 });
    const map = Object.fromEntries(out.map((i) => [i.codigo, i.cantidad]));
    expect(map).toEqual({ TAP19: 1, TAP01: 1, TOR02: 2, TOP01: 2 });
  });
  it('MET: sigue sin tapas ni tornillos, pero SÍ lleva sus 2 topes metálicos', () => {
    // El metálico nunca tuvo tapas de peso roller; el tope, en cambio, sí
    // tiene código propio por color (TOP06), así que se emite (2026-08-28).
    const out = insumosDePano(pano({ color: 'MET' }), { categoria: 'ROL', anchoM: 1.5 });
    expect(out.map((i) => [i.codigo, i.cantidad])).toEqual([['TOP06', 2]]);
  });
  it('topes de cadena: 2 por cadena, del color de accesorios', () => {
    const topes = (p: Partial<Pano>, categoria: string) =>
      insumosDePano(p, { categoria, anchoM: 1.5 }).filter((i) => i.codigo.startsWith('TOP'));
    // Los cuatro colores que se venden.
    expect(topes(pano({ color: 'BCO' }), 'ROL')[0]).toMatchObject({ codigo: 'TOP01', cantidad: 2 });
    expect(topes(pano({ color: 'GRS' }), 'ROL')[0]).toMatchObject({ codigo: 'TOP04', cantidad: 2 });
    expect(topes(pano({ color: 'NEG' }), 'ROL')[0]).toMatchObject({ codigo: 'TOP05', cantidad: 2 });
    expect(topes(pano({ color: 'MET' }), 'ROL')[0]).toMatchObject({ codigo: 'TOP06', cantidad: 2 });
    // La VERTICAL lleva cadena de roller, así que lleva sus topes.
    expect(topes(pano({ color: 'NEG' }), 'VERTICAL')[0]).toMatchObject({ codigo: 'TOP05', cantidad: 2 });
  });

  it('sin cadena no hay topes: motor, beeblack y pletina', () => {
    const topes = (categoria: string) =>
      insumosDePano(pano({ color: 'NEG' }), { categoria, anchoM: 1.5 }).filter((i) =>
        i.codigo.startsWith('TOP'),
      );
    // Vendida COMO motor: su precio no trae cadena.
    expect(topes('ROL_MOTOR_38mm')).toEqual([]);
    expect(topes('BEEBLACK_ESTANDAR')).toEqual([]);
    expect(topes('PLETINA_ROLLER_V')).toEqual([]);
  });

  it('el tope elegido a mano manda; en la VERTICAL se calcula igual', () => {
    const conTope = (categoria: string) =>
      insumosDePano(pano({ color: 'NEG', codTope: 'TOP06' }), { categoria, anchoM: 1.5 })
        .filter((i) => i.codigo.startsWith('TOP'))
        .map((i) => i.codigo);
    expect(conTope('ROL')).toEqual(['TOP06']);
    // La vertical NO lee el tope del paño: así una ventana convertida desde
    // roller no arrastra el viejo (mismo criterio que su cadena).
    expect(conTope('VERTICAL')).toEqual(['TOP05']);
  });

  it('un color nuevo sin tope declarado emite la pieza SIN código, no la esconde', () => {
    const colores = [
      { codigo: 'DOR', nombre: 'DORADO', usos: {}, insumos: {} },
    ] as unknown as Parameters<typeof insumosDePano>[1]['colores'];
    const out = insumosDePano(pano({ color: 'DOR' }), { categoria: 'ROL', anchoM: 1.5, colores });
    const tope = out.find((i) => i.descripcion.startsWith('TOPE DE CADENA'));
    expect(tope).toMatchObject({ codigo: '', cantidad: 2 });
  });

  it('cenefa ovalada → +6 tornillos TOR02 y brackets por ancho', () => {
    const out = insumosDePano(
      pano({ color: 'NEG', cenefa: 'Ovalada', bracketTipo: 'CORTO' }),
      { categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm', anchoM: 1.5 },
    );
    const tor = out.filter((i) => i.codigo === 'TOR02').reduce((a, i) => a + i.cantidad, 0);
    expect(tor).toBe(2 + 6); // 2 de las tapas + 6 de la cenefa ovalada
    expect(out.find((i) => i.codigo === 'BRA01')?.cantidad).toBe(3);
  });
  it('vulcanita roller sin cenefa → 4 tarugos TAR01', () => {
    const out = insumosDePano(pano({ color: 'BCO', materialTipo: 'VULCANITA' }), { categoria: 'ROL', anchoM: 1.5 });
    expect(out.find((i) => i.codigo === 'TAR01')?.cantidad).toBe(4);
  });
  it('concreto roller sin cenefa → 4 tarugos TAR03; cerámica ovalada muro 1,5 m → 6 TAR03', () => {
    const conc = insumosDePano(pano({ color: 'BCO', materialTipo: 'CONCRETO' }), { categoria: 'ROL', anchoM: 1.5 });
    expect(conc.find((i) => i.codigo === 'TAR03')?.cantidad).toBe(4);
    const cer = insumosDePano(
      pano({ color: 'NEG', materialTipo: 'CERÁMICA', cenefa: 'Ovalada', superficie: 'PARED' }),
      { categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm', anchoM: 1.5 },
    );
    expect(cer.find((i) => i.codigo === 'TAR03')?.cantidad).toBe(6);
  });
  it('DÚO → 2 tapas exteriores por color + 2 TAP13 (a presión) + los fierros de su cenefa', () => {
    const out = insumosDePano(pano({ color: 'NEG' }), { categoria: 'DUO_MANUAL_38mm', anchoM: 1.5 });
    const map = Object.fromEntries(out.map((i) => [i.codigo, i.cantidad]));
    expect(map.TAP11).toBe(2); // exterior negro
    expect(map.TAP13).toBe(2); // interno
    // Las tapas de peso del dúo van a presión: sus 2 tornillos NO se emiten.
    // Los 6 TOR02 son los de la cenefa ovalada, que el dúo lleva por sistema.
    expect(map.TOR02).toBe(6);
    // Sin bracket elegido, el dúo emite el LARGO: su receta cobra BRA02 ×3
    // (decisión del dueño 2026-08-20).
    expect(map.BRA02).toBe(3); // cantidadBrackets(1,5)
    // El dúo lleva UNA cadena, así que lleva sus 2 topes (negro → TOP05).
    expect(map.TOP05).toBe(2);
    // Color fuera de mapa (MET): sin tapa exterior, pero la cenefa va igual.
    const met = insumosDePano(pano({ color: 'MET' }), { categoria: 'DUO_MANUAL_38mm', anchoM: 1.5 });
    expect(met.map((i) => i.codigo)).toEqual(['TAP13', 'TOP06', 'TOR02', 'BRA02']);
  });
  it('SOFT LIGHT → 2 tapas de peso TAP26/TAP31 por color, a presión (SIN tornillos)', () => {
    const blanco = insumosDePano(pano({ color: 'BCO', cenefa: 'Ovalada' }), { categoria: 'SOFT_LIGHT_38mm', anchoM: 2.5 });
    const bm = Object.fromEntries(blanco.map((i) => [i.codigo, i.cantidad]));
    expect(bm.TAP26).toBe(2); // tapa blanca ×2
    // Las tapas van a presión: sus tornillos NO se emiten. Los TOR02 presentes
    // (6) son solo los de la cenefa ovalada, no de las tapas.
    expect(bm.TOR02).toBe(6);
    const negro = insumosDePano(pano({ color: 'NEG', cenefa: 'Ovalada' }), { categoria: 'SOFT_LIGHT_38mm', anchoM: 2.5 });
    expect(negro.find((i) => i.codigo === 'TAP31')?.cantidad).toBe(2); // tapa negra ×2
    // Gris no se vende: item sin código (solo descripción), igual ×2.
    const gris = insumosDePano(pano({ color: 'GRS', cenefa: 'Ovalada' }), { categoria: 'SOFT_LIGHT_38mm', anchoM: 2.5 });
    const tapaGris = gris.find((i) => i.descripcion.includes('TAPA PESO SOFT.LIGHT/DARK'));
    expect(tapaGris?.codigo).toBe('');
    expect(tapaGris?.cantidad).toBe(2);
  });
  it('dúo vulcanita → 6 tarugos TAR01 (2 por bracket de su cenefa, a muro)', () => {
    const out = insumosDePano(pano({ color: 'GRS', materialTipo: 'VULCANITA' }), { categoria: 'DUO_MANUAL_38mm', anchoM: 1.5 });
    expect(out.find((i) => i.codigo === 'TAR01')?.cantidad).toBe(6);
  });
  it('pletina roller → tapas roller (2 + TOR02), SIN tarugos aunque haya material', () => {
    const out = insumosDePano(pano({ color: 'BCO', materialTipo: 'VULCANITA' }), { categoria: 'PLETINA_ROLLER_V', anchoM: 0.8 });
    const map = Object.fromEntries(out.map((i) => [i.codigo, i.cantidad]));
    expect(map.TAP19).toBe(1);
    expect(map.TAP01).toBe(1);
    expect(map.TOR02).toBe(2);
    expect(out.some((i) => i.codigo === 'TAR01')).toBe(false); // velcro: 0 tarugos
  });
  it('pletina dúo → juego de tapas dúo (a presión), SIN tarugos', () => {
    const out = insumosDePano(pano({ color: 'NEG', materialTipo: 'VULCANITA' }), { categoria: 'PLETINA_DUO_V', anchoM: 0.8 });
    const map = Object.fromEntries(out.map((i) => [i.codigo, i.cantidad]));
    expect(map.TAP11).toBe(2); // exterior negro dúo
    expect(map.TAP13).toBe(2); // interno
    expect(out.some((i) => i.codigo === 'TOR02')).toBe(false); // a presión
    expect(out.some((i) => i.codigo === 'TAR01')).toBe(false); // velcro: 0 tarugos
  });
  it('suplemento SUB01: roller→2, cenefa ovalada 1,5 m→3 (brackets), override manual manda', () => {
    const roller = insumosDePano(pano({ color: 'BCO', suplementoTipo: 'SUB01' }), { categoria: 'ROL', anchoM: 1.5 });
    expect(roller.find((i) => i.codigo === 'SUB01')?.cantidad).toBe(2);
    const ovalada = insumosDePano(
      pano({ color: 'BCO', suplementoTipo: 'SUB02', cenefa: 'Ovalada' }),
      { categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm', anchoM: 1.5 },
    );
    expect(ovalada.find((i) => i.codigo === 'SUB02')?.cantidad).toBe(3);
    const override = insumosDePano(pano({ color: 'BCO', suplementoTipo: 'SUB01', suplementoCant: 5 }), { categoria: 'ROL', anchoM: 1.5 });
    expect(override.find((i) => i.codigo === 'SUB01')?.cantidad).toBe(5);
    // Sin tipo → sin suplemento.
    expect(insumosDePano(pano({ color: 'BCO' }), { categoria: 'ROL', anchoM: 1.5 }).some((i) => i.codigo?.startsWith('SUB'))).toBe(false);
  });
});

describe('insumosVerticalDePano', () => {
  // ancho 2,12 m → cantidadBrackets = 4; carritos del caso ROSSANA G1 = 26.
  const cod = (out: ReturnType<typeof insumosVerticalDePano>) =>
    Object.fromEntries(out.map((i) => [i.codigo, i]));

  it('set BLANCO: códigos, cantidades, grupos y "CALCULAR" del cordón y la cadena inferior', () => {
    const out = insumosVerticalDePano({ colorAcc: 'BCO', anchoM: 2.12, carritos: 26 });
    const m = cod(out);
    // PRODUCCIÓN (montaje sobre la tela)
    expect(m.VER41).toMatchObject({ cantidad: 26, grupo: 'PRODUCCION' }); // peso lama = carritos
    expect(m.VER45).toMatchObject({ cantidad: 26, grupo: 'PRODUCCION' }); // sujetador blanco = carritos
    // ESTRUCTURA (ferretería del sistema)
    expect(m.VER37).toMatchObject({ cantidad: 1, grupo: 'ESTRUCTURA' }); // peso cordón blanco
    expect(m.VER40).toMatchObject({ cantidad: 26, grupo: 'ESTRUCTURA' }); // carrito = carritos
    expect(m.VER43).toMatchObject({ grupo: 'ESTRUCTURA', calcular: true }); // cordón blanco → CALCULAR
    expect(m.VER50).toMatchObject({ cantidad: 1, grupo: 'ESTRUCTURA' }); // kit
    expect(m.VER52).toMatchObject({ cantidad: 1, grupo: 'ESTRUCTURA' }); // peso cadena blanco
    // INSTALACIÓN (terreno)
    expect(m.VER38).toMatchObject({ cantidad: 4, grupo: 'INSTALACION' }); // bracket = cantidadBrackets(2,12)
    expect(m.VER39).toMatchObject({ grupo: 'INSTALACION', calcular: true }); // cadena inferior → CALCULAR
    // No aparecen los códigos del set negro.
    expect(m.VER59).toBeUndefined();
    expect(m.VER56).toBeUndefined();
    expect(m.VER64).toBeUndefined();
    expect(m.VER58).toBeUndefined();
  });

  it('set NEGRO: peso cordón y peso cadena son ambos VER64; cordón VER59, sujetador VER56, cadena inferior VER58', () => {
    const out = insumosVerticalDePano({ colorAcc: 'NEGRO', anchoM: 1.5, carritos: 18 });
    const m = cod(out);
    expect(m.VER59).toMatchObject({ calcular: true, grupo: 'ESTRUCTURA' }); // cordón negro
    expect(m.VER56).toMatchObject({ cantidad: 18, grupo: 'PRODUCCION' }); // sujetador transparente
    expect(m.VER58).toMatchObject({ calcular: true, grupo: 'INSTALACION' }); // cadena inferior negro
    // El peso del cordón pasa a VER64 (mismo código que el peso de cadena): dos
    // líneas VER64 en ESTRUCTURA, cantidad 1 c/u → se consolidan a ×2 aguas abajo.
    const ver64 = out.filter((i) => i.codigo === 'VER64');
    expect(ver64).toHaveLength(2);
    expect(ver64.every((i) => i.grupo === 'ESTRUCTURA' && i.cantidad === 1)).toBe(true);
    // En negro el peso del cordón ya NO es VER37.
    expect(m.VER37).toBeUndefined();
    // Sus contrapartes blancas no aparecen.
    expect(m.VER43).toBeUndefined();
    expect(m.VER45).toBeUndefined();
    expect(m.VER52).toBeUndefined();
    expect(m.VER39).toBeUndefined();
    // Carrito común (ahora ESTRUCTURA).
    expect(m.VER40).toMatchObject({ cantidad: 18, grupo: 'ESTRUCTURA' });
  });

  it('gris (y cualquier color no-negro) usa el set BLANCO: no hay vertical gris', () => {
    const m = cod(insumosVerticalDePano({ colorAcc: 'GRIS', anchoM: 1.5, carritos: 18 }));
    expect(m.VER43).toBeDefined(); // cordón blanco
    expect(m.VER45).toBeDefined(); // sujetador blanco
    expect(m.VER52).toBeDefined(); // peso cadena blanco
    expect(m.VER59).toBeUndefined();
  });

  it('los "CALCULAR" van con cantidad 0 (los mide el terreno)', () => {
    const out = insumosVerticalDePano({ colorAcc: 'BCO', anchoM: 2.12, carritos: 26 });
    const calc = out.filter((i) => i.calcular);
    expect(calc.map((i) => i.codigo).sort()).toEqual(['VER39', 'VER43']);
    expect(calc.every((i) => i.cantidad === 0)).toBe(true);
  });

  it('imanes VER55 ×2 (ESTRUCTURA) solo cuando el ancho pasa de 3 m', () => {
    // Exactamente 3,00 m NO lleva imanes.
    expect(cod(insumosVerticalDePano({ colorAcc: 'BCO', anchoM: 3, carritos: 36 })).VER55).toBeUndefined();
    // 3,01 m sí: 2 imanes, en ESTRUCTURA, sumados a los carritos (VER40 intacto).
    const anchos = insumosVerticalDePano({ colorAcc: 'BCO', anchoM: 3.01, carritos: 36 });
    const m = cod(anchos);
    expect(m.VER55).toMatchObject({ cantidad: 2, grupo: 'ESTRUCTURA' });
    expect(m.VER40).toMatchObject({ cantidad: 36, grupo: 'ESTRUCTURA' }); // carritos NO cambian
  });
});

// Kit SML del BEEBLACK (lista del usuario 2026-07-31). Todo a PRODUCCIÓN salvo
// la tapa de esquinero; el doble dobla todo menos esquineros y sus tapas.
describe('insumosBeeblackDeCortina', () => {
  const cod = (out: ReturnType<typeof insumosBeeblackDeCortina>) =>
    Object.fromEntries(out.map((i) => [i.codigo, i]));

  it('set BLANCO simple: códigos, cantidades y cuadros', () => {
    const m = cod(insumosBeeblackDeCortina('BLANCO'));
    expect(m.SML45).toMatchObject({ cantidad: 2, grupo: 'PRODUCCION' }); // carro inferior manilla
    expect(m.SML16).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' }); // esquinero grande
    expect(m.SML25).toMatchObject({ cantidad: 2, grupo: 'PRODUCCION' }); // carro guía de nylon
    expect(m.SML32).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' }); // tapa de cobre
    expect(m.SML31).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' }); // clip de alambre
    expect(m.SML35).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' }); // rodillo guía de cuerda
    // La tapa del esquinero es lo ÚNICO que se coloca en terreno.
    expect(m.SML47).toMatchObject({ cantidad: 4, grupo: 'INSTALACION' });
    // Nada del set oscuro.
    expect(m.SML46).toBeUndefined();
    expect(m.SML17).toBeUndefined();
    expect(m.SML26).toBeUndefined();
    expect(m.SML48).toBeUndefined();
  });

  it('la tira magnética y la felpa van CALCULAR (cantidad 0)', () => {
    // Sin medida de cordón (Fase 2 sin llenar) el cordón también sale CALCULAR.
    const calc = insumosBeeblackDeCortina('BLANCO', false, 250).filter((i) => i.calcular);
    expect(calc.map((i) => i.codigo).sort()).toEqual(['SML33', 'SML34']);
    expect(calc.every((i) => i.cantidad === 0 && i.grupo === 'PRODUCCION')).toBe(true);
  });

  describe('cordón', () => {
    it('blanco SML36 / oscuro SML37, con los cm que le pasan', () => {
      expect(cod(insumosBeeblackDeCortina('BLANCO', false, 250.4)).SML36).toMatchObject({
        cantidad: 250.4,
        grupo: 'PRODUCCION',
      });
      expect(cod(insumosBeeblackDeCortina('NEGRO', false, 250.4)).SML37).toBeDefined();
      expect(cod(insumosBeeblackDeCortina('CAFÉ', false, 250.4)).SML37).toBeDefined();
      expect(cod(insumosBeeblackDeCortina('BLANCO', false, 250.4)).SML37).toBeUndefined();
    });

    it('el doble NO lo duplica: una estructura, un recorrido de cordón', () => {
      expect(cod(insumosBeeblackDeCortina('BLANCO', true, 250.4)).SML36.cantidad).toBe(250.4);
    });

    it('sin medida sale CALCULAR en vez de un 0 engañoso', () => {
      expect(cod(insumosBeeblackDeCortina('BLANCO')).SML36).toMatchObject({
        cantidad: 0,
        calcular: true,
      });
    });
  });

  it('set NEGRO: carro inferior SML46, esquinero SML17, nylon SML26, tapa SML48', () => {
    const m = cod(insumosBeeblackDeCortina('NEGRO'));
    expect(m.SML46).toMatchObject({ cantidad: 2, grupo: 'PRODUCCION' });
    expect(m.SML17).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' });
    expect(m.SML26).toMatchObject({ cantidad: 2, grupo: 'PRODUCCION' });
    expect(m.SML48).toMatchObject({ cantidad: 4, grupo: 'INSTALACION' });
    expect(m.SML45).toBeUndefined();
  });

  it('set CAFÉ: esquinero y tapa propios, pero comparte SML46/SML26 con el negro', () => {
    const m = cod(insumosBeeblackDeCortina('CAFÉ'));
    expect(m.SML18).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' });
    expect(m.SML49).toMatchObject({ cantidad: 4, grupo: 'INSTALACION' });
    expect(m.SML46).toBeDefined();
    expect(m.SML26).toBeDefined();
    expect(m.SML16).toBeUndefined();
    expect(m.SML17).toBeUndefined();
  });

  it('gris o color desconocido cae al set BLANCO', () => {
    expect(cod(insumosBeeblackDeCortina('GRIS')).SML16).toBeDefined();
    expect(cod(insumosBeeblackDeCortina('')).SML45).toBeDefined();
  });

  it('DOBLE: todo ×2 salvo esquineros y sus tapas (son de la estructura)', () => {
    const m = cod(insumosBeeblackDeCortina('BLANCO', true));
    expect(m.SML45.cantidad).toBe(4);
    expect(m.SML25.cantidad).toBe(4);
    expect(m.SML32.cantidad).toBe(8);
    expect(m.SML31.cantidad).toBe(8);
    expect(m.SML35.cantidad).toBe(8);
    // Una sola estructura → 4 esquineros y 4 tapas, igual que en el simple.
    expect(m.SML16.cantidad).toBe(4);
    expect(m.SML47.cantidad).toBe(4);
    // Los CALCULAR siguen sin número.
    expect(m.SML33.cantidad).toBe(0);
  });

  it('la BARRA de la manilla no es insumo: solo sus carros y su felpa', () => {
    // La agarradera (SML10/11/12) se cobra en Fase 1 y se corta por estructura.
    const codigos = insumosBeeblackDeCortina('BLANCO').map((i) => i.codigo);
    expect(codigos).not.toContain('SML10');
    expect(codigos).not.toContain('SML11');
    expect(codigos).not.toContain('SML12');
  });
});

describe('beeblackEsDoble', () => {
  it('lo marca el flag dual del paño o tener más de un paño', () => {
    expect(beeblackEsDoble(pano({ dual: true }))).toBe(true);
    expect(beeblackEsDoble(pano({}), 2)).toBe(true);
    expect(beeblackEsDoble(pano({}), 1)).toBe(false);
    expect(beeblackEsDoble(pano({}))).toBe(false);
  });
});

// Regla del taller: lo ÚNICO que sale solo al motorizar es el cable DOM34 del
// DOM38. Los CONTROLES (DOM39/DOM42) y la domótica se piden en Fase 2.
describe('insumosMotorDePano', () => {
  it('DOM38 sin elección de cargador → motor + cable, SIN control ni hub ni DOM04', () => {
    // No todos los motores llevan hub: el kit no agrega cargador por defecto.
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM38' }));
    expect(out.map((i) => i.codigo)).toEqual(['DOM38', 'DOM34']);
  });
  it("'NINGUNO' explícito → igual que sin elección (sin hub ni DOM04)", () => {
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM38', motorCargador: 'NINGUNO' }));
    expect(out.map((i) => i.codigo)).toEqual(['DOM38', 'DOM34']);
  });
  it('los controles salen SOLO de la cantidad pedida en Fase 2', () => {
    const sinPedir = insumosMotorDePano(pano({ motorModelo: 'DOM38' }));
    expect(sinPedir.some((i) => i.codigo === 'DOM39')).toBe(false);
    const conDos = insumosMotorDePano(pano({ motorModelo: 'DOM38', motorControlAdicCant: 2 }));
    expect(conDos.find((i) => i.codigo === 'DOM39')?.cantidad).toBe(2);
  });
  it('DOM38 + hub DOM43 elegido → agrega DOM04 (enchufe del hub) + DOM43', () => {
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM38', motorCargador: 'DOM43' }));
    expect(out.map((i) => i.codigo)).toEqual(['DOM38', 'DOM34', 'DOM04', 'DOM43']);
  });
  it('DOM38 + adaptador DOM33 → DOM33 sin DOM04 (el enchufe alimenta al hub, no al adaptador)', () => {
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM38', motorCargador: 'DOM33' }));
    expect(out.map((i) => i.codigo)).toEqual(['DOM38', 'DOM34', 'DOM33']);
    expect(out.some((i) => i.codigo === 'DOM43' || i.codigo === 'DOM03' || i.codigo === 'DOM04')).toBe(false);
  });
  it('DOM38 + HUB USB DOM03 forzado → DOM04 + DOM03', () => {
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM38', motorCargador: 'DOM03' }));
    expect(out.map((i) => i.codigo)).toEqual(['DOM38', 'DOM34', 'DOM04', 'DOM03']);
  });
  it('DOM41: solo el motor (sin control, sin cable) + controles/hub pedidos en Fase 2', () => {
    const base = insumosMotorDePano(pano({ motorModelo: 'DOM41' }));
    expect(base.map((i) => i.codigo)).toEqual(['DOM41']); // sin DOM42, sin cable (#28), sin hub
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM41', motorControlAdicCant: 2, motorHubUsbCant: 1 }));
    expect(out.some((i) => i.codigo === 'DOM34')).toBe(false);
    const ctrl = out.filter((i) => i.codigo === 'DOM42').reduce((a, i) => a + i.cantidad, 0);
    expect(ctrl).toBe(2); // solo los pedidos en Fase 2
    // Los hubs ADICIONALES (explícitos) siguen saliendo aunque el kit no lleve cargador.
    expect(out.find((i) => i.codigo === 'DOM43')?.cantidad).toBe(1);
  });
  it("'CABLE' futuro o sin motor → sin códigos", () => {
    expect(insumosMotorDePano(pano({ motorModelo: 'CABLE' }))).toEqual([]);
    expect(insumosMotorDePano(pano({}))).toEqual([]);
  });
  it('F15: DOM41 con cenefa ovalada (chip o categoría) cae a DOM38 (+cable)', () => {
    const porChip = insumosMotorDePano(pano({ motorModelo: 'DOM41', cenefa: 'Ovalada' }));
    expect(porChip.map((i) => i.codigo)).toEqual(['DOM38', 'DOM34']);
    // Y el control pedido pasa a ser el del DOM38 (DOM39), no el DOM42.
    const conControl = insumosMotorDePano(pano({ motorModelo: 'DOM41', cenefa: 'Ovalada', motorControlAdicCant: 1 }));
    expect(conControl.map((i) => i.codigo)).toEqual(['DOM38', 'DOM34', 'DOM39']);
    const porCategoria = insumosMotorDePano(pano({ motorModelo: 'DOM41' }), 'ROL_CENEFA_OVALADA_MOTOR_GRANDE');
    expect(porCategoria[0].codigo).toBe('DOM38');
    // Sin cenefa ovalada, DOM41 se mantiene.
    expect(insumosMotorDePano(pano({ motorModelo: 'DOM41' }))[0].codigo).toBe('DOM41');
  });
});

describe('faltantesManillasInventario', () => {
  const adic = (
    codInt: string, cantidad: number, ubicacion = 'LIVING',
  ): AdicionalFase0Persistido => ({ codInt, cantidad, descuento: 0, ubicacion });
  const cant = (out: ReturnType<typeof faltantesManillasInventario>, cod: string) =>
    out.find((i) => i.codigo === cod)?.cantidad ?? 0;

  // El caso real: en un beeblack doble la ventana tiene 2 paños, así que su
  // ubicación es "LIVING-G1"/"LIVING-G2" y el cruce con el adicional "LIVING"
  // falla → manillaCant queda 0 y la manilla cobrada no salía en ningún lado.
  it('manillas cobradas que no bajaron a ningún paño salen igual', () => {
    const out = faltantesManillasInventario([adic('HER 49', 2), adic('HER 48', 2)], {});
    expect(cant(out, 'HER49')).toBe(2);
    expect(cant(out, 'HER48')).toBe(2);
    expect(out.find((i) => i.codigo === 'HER49')?.descripcion).toBe('MANILLA PLANA CAFE');
  });

  it('descuenta lo que ya emitieron los paños', () => {
    expect(cant(faltantesManillasInventario([adic('HER48', 3)], { HER48: 1 }), 'HER48')).toBe(2);
  });

  it('emitido ≥ cobrado → no agrega nada (no duplica la manilla de Fase 2)', () => {
    expect(faltantesManillasInventario([adic('HER48', 2)], { HER48: 2 })).toEqual([]);
    expect(faltantesManillasInventario([adic('HER48', 1)], { HER48: 5 })).toEqual([]);
    expect(faltantesManillasInventario(undefined, {})).toEqual([]);
  });

  it('ignora los adicionales que no son manillas', () => {
    expect(faltantesManillasInventario([adic('DOM38', 2), adic('INST', 1)], {})).toEqual([]);
  });
});

describe('faltantesDomoticaInventario', () => {
  const adic = (
    codInt: string, cantidad: number, ubicacion = 'LIVING',
  ): AdicionalFase0Persistido => ({ codInt, cantidad, descuento: 0, ubicacion });
  const cant = (out: ReturnType<typeof faltantesDomoticaInventario>, cod: string) =>
    out.find((i) => i.codigo === cod)?.cantidad ?? 0;

  it('3 motores cobrados con 1 emitido → faltan 2, con sus 2 cables (DOM38 = DOM34)', () => {
    const out = faltantesDomoticaInventario([adic('DOM 38', 3)], { DOM38: 1, DOM34: 1 });
    expect(cant(out, 'DOM38')).toBe(2);
    expect(cant(out, 'DOM34')).toBe(2);
  });

  it('sin ningún paño emitido → salen todos los cobrados', () => {
    const out = faltantesDomoticaInventario([adic('DOM 38', 3)], {});
    expect(cant(out, 'DOM38')).toBe(3);
    expect(cant(out, 'DOM34')).toBe(3);
  });

  it('el DOM41 no lleva cable de carga', () => {
    const out = faltantesDomoticaInventario([adic('DOM41', 2, 'UBIC-QUE-NO-CALZA')], { DOM41: 0 });
    expect(cant(out, 'DOM41')).toBe(2);
    expect(cant(out, 'DOM34')).toBe(0);
  });

  it('emitido ≥ cobrado → no agrega nada (nunca resta un motor puesto en Fase 2)', () => {
    expect(faltantesDomoticaInventario([adic('DOM38', 1)], { DOM38: 2, DOM34: 2 })).toEqual([]);
    expect(faltantesDomoticaInventario(undefined, { DOM38: 1 })).toEqual([]);
  });

  it('los CONTROLES salen por la cantidad vendida, no uno por motor', () => {
    const out = faltantesDomoticaInventario([adic('DOM 38', 5), adic('DOM 39', 2)], {});
    expect(cant(out, 'DOM38')).toBe(5);
    expect(cant(out, 'DOM39')).toBe(2);
    // Sin controles vendidos no sale ninguno, por muchos motores que haya.
    expect(cant(faltantesDomoticaInventario([adic('DOM38', 5)], {}), 'DOM39')).toBe(0);
  });

  it('cada HUB vendido arrastra su router DOM05 y su adaptador DOM33', () => {
    const out = faltantesDomoticaInventario([adic('DOM 43', 2)], {});
    expect(cant(out, 'DOM43')).toBe(2);
    expect(cant(out, 'DOM05')).toBe(2);
    expect(cant(out, 'DOM33')).toBe(2);
  });

  it('sin hub vendido no hay router ni adaptador', () => {
    const out = faltantesDomoticaInventario([adic('DOM 38', 1)], {});
    expect(cant(out, 'DOM05')).toBe(0);
    expect(cant(out, 'DOM33')).toBe(0);
  });

  it('descuenta lo que el kit de Fase 2 ya emitió (hub elegido como cargador)', () => {
    const out = faltantesDomoticaInventario([adic('DOM43', 1)], { DOM43: 1, DOM33: 1 });
    expect(cant(out, 'DOM43')).toBe(0);
    expect(cant(out, 'DOM33')).toBe(0);
    expect(cant(out, 'DOM05')).toBe(1); // el router no lo pone ningún kit
  });
});

describe('panoLlevaDomotica', () => {
  it('flag nuevo o legacy exacto CON DOMÓTICA → true', () => {
    expect(panoLlevaDomotica(pano({ motorDomotica: true }))).toBe(true);
    expect(panoLlevaDomotica(pano({ motorTipo: 'CON DOMÓTICA' }))).toBe(true);
  });
  it("'INALAMB. SIN DOMO' NO es domótica (regresión: 'SIN DOMO' contiene 'DOM')", () => {
    expect(panoLlevaDomotica(pano({ motorTipo: 'INALAMB. SIN DOMO' }))).toBe(false);
    expect(panoLlevaDomotica(pano({ motorModelo: 'DOM41' }))).toBe(false);
    expect(panoLlevaDomotica(pano({}))).toBe(false);
  });
});

describe('otLlevaDomotica', () => {
  it('true si algún paño tiene domótica (o motorTipo legacy CON DOMÓTICA)', () => {
    const v = (p: Partial<Pano>) => ({ panos: [p] }) as never;
    expect(otLlevaDomotica([v({ motorDomotica: true })])).toBe(true);
    expect(otLlevaDomotica([v({ motorTipo: 'CON DOMÓTICA' })])).toBe(true);
    expect(otLlevaDomotica([v({ motorModelo: 'DOM41' })])).toBe(false);
    // 'INALAMB. SIN DOMO' no debe encender la domótica (DOM43 fantasma).
    expect(otLlevaDomotica([v({ motorTipo: 'INALAMB. SIN DOMO' })])).toBe(false);
  });
});

describe('esCategoriaDuo', () => {
  it('DUO_* sí; PLETINA_DUO_V y ROL no', () => {
    expect(esCategoriaDuo('DUO_MANUAL_38mm')).toBe(true);
    expect(esCategoriaDuo('DUO_MOTOR_GRANDE_45mm')).toBe(true);
    expect(esCategoriaDuo('PLETINA_DUO_V')).toBe(false);
    expect(esCategoriaDuo('ROL')).toBe(false);
    expect(esCategoriaDuo('')).toBe(false);
  });
});

describe('cantidadSuplementosAuto', () => {
  it('roller → 2; con cenefa (ovalada/cuadrada) → 1 por bracket', () => {
    expect(cantidadSuplementosAuto(pano({}), 'ROL', 1.5)).toBe(2);
    expect(cantidadSuplementosAuto(pano({ cenefa: 'Ovalada' }), 'ROL', 1.5)).toBe(3); // brackets(1,5)=3
    expect(cantidadSuplementosAuto(pano({ cenefa: 'Cuadrada a muro' }), 'ROL', 2.0)).toBe(4);
  });
});

describe('insumosDePano — tapas de la categoría B (2026-08-14)', () => {
  it('roller B blanco → TAP18 en AMBOS lados (×2), a presión: SIN tornillos', () => {
    const out = insumosDePano(pano({ color: 'BCO' }), { categoria: 'ROL', anchoM: 1.5, lineaB: true });
    const tapas = out.filter((i) => i.codigo === 'TAP18');
    expect(tapas).toHaveLength(2); // misma tapa izquierda y derecha
    // Aclaración 2026-08-17: la tapa B se coloca a presión, no lleva TOR02.
    expect(out.some((i) => i.codigo === 'TOR02')).toBe(false);
    // Y ninguna tapa de la línea A.
    expect(out.some((i) => ['TAP19', 'TAP01'].includes(i.codigo))).toBe(false);
  });

  it('roller B negro → TAP28-B ×2, sin tornillos', () => {
    const out = insumosDePano(pano({ color: 'NEG' }), { categoria: 'ROL', anchoM: 1.5, lineaB: true });
    expect(out.filter((i) => i.codigo === 'TAP28-B')).toHaveLength(2);
    expect(out.some((i) => ['TAP04', 'TAP05'].includes(i.codigo))).toBe(false);
    expect(out.some((i) => i.codigo === 'TOR02')).toBe(false);
  });

  it('roller B con cenefa ovalada: la cenefa SÍ conserva sus 6 tornillos (solo se van los de la tapa)', () => {
    const out = insumosDePano(pano({ color: 'BCO', cenefa: 'Ovalada' }), {
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      anchoM: 1.5,
      lineaB: true,
    });
    const tor = out.filter((i) => i.codigo === 'TOR02').reduce((a, i) => a + i.cantidad, 0);
    expect(tor).toBe(6);
  });

  it('un color B sin tapa propia cae a la tapa de la línea A, y esa sí se atornilla', () => {
    // El gris no existe en la gama B: si llegara, usa TAP20/TAP10 con sus 2 TOR02.
    const out = insumosDePano(pano({ color: 'GRS' }), { categoria: 'ROL', anchoM: 1.5, lineaB: true });
    expect(out.map((i) => i.codigo)).toEqual(expect.arrayContaining(['TAP20', 'TAP10']));
    expect(out.find((i) => i.codigo === 'TOR02')?.cantidad).toBe(2);
  });

  it('dúo B (blanco o negro) → exterior TAP17 ×2, y la interna TAP13 SE MANTIENE', () => {
    for (const color of ['BCO', 'NEG']) {
      const out = insumosDePano(pano({ color }), { categoria: 'DUO_MANUAL_38mm', anchoM: 1.5, lineaB: true });
      expect(out.find((i) => i.codigo === 'TAP17')?.cantidad).toBe(2);
      expect(out.find((i) => i.codigo === 'TAP13')?.cantidad).toBe(2);
      expect(out.some((i) => ['TAP12', 'TAP11'].includes(i.codigo))).toBe(false);
    }
  });

  it('sin lineaB todo queda como siempre (regresión)', () => {
    const out = insumosDePano(pano({ color: 'BCO' }), { categoria: 'ROL', anchoM: 1.5 });
    const map = Object.fromEntries(out.map((i) => [i.codigo, i.cantidad]));
    expect(map).toEqual({ TAP19: 1, TAP01: 1, TOR02: 2, TOP01: 2 });
  });

  it('el overlay del color pisa la tabla B de fábrica', () => {
    const colores = [
      { codigo: 'NEG', nombre: 'NEGRO', insumos: { tapaPesoB: 'TAP99-B' } },
    ] as unknown as Parameters<typeof insumosDePano>[1]['colores'];
    const out = insumosDePano(pano({ color: 'NEG' }), { categoria: 'ROL', anchoM: 1.5, lineaB: true, colores });
    expect(out.filter((i) => i.codigo === 'TAP99-B')).toHaveLength(2);
  });
});
