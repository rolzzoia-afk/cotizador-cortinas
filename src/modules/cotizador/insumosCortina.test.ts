import { describe, expect, it } from 'vitest';
import type { Pano } from './types';
import {
  bracketDeCenefa,
  cantidadBrackets,
  cantidadSuplementosAuto,
  cantidadTarugos,
  codigoMotorDesdeAdicional,
  esAdicionalHubDomotica,
  esCategoriaDuo,
  insumosDePano,
  insumosMotorDePano,
  llevaTapasPeso,
  otLlevaDomotica,
  panoLlevaDomotica,
  tarugoDeMaterial,
} from './insumosCortina';

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
  it('roller (incluye ovalada, motorizados y DUAL); excluye pletina/dúo/oscuridad', () => {
    expect(llevaTapasPeso('ROL')).toBe(true);
    expect(llevaTapasPeso('ROL_MANUAL_CENEFA_OVALADA_38mm')).toBe(true);
    expect(llevaTapasPeso('ROL_CENEFA_OVALADA_MOTOR_GRANDE')).toBe(true);
    // Dual: cada roller/tela lleva su barra de peso con 2 tapas (2026-07-15).
    expect(llevaTapasPeso('ROL_DUAL')).toBe(true);
    expect(llevaTapasPeso('PLETINA_ROLLER_V')).toBe(false);
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
  it('sin cenefa → null', () => {
    expect(bracketDeCenefa('No', '')).toBeNull();
    expect(bracketDeCenefa('', '')).toBeNull();
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
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA' }), 'VERTICAL', 1.5)).toBe(0);
  });
  it('cenefa ovalada: 1/bracket a techo, 2/bracket a muro', () => {
    // cantidadBrackets(1,5) = 3
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA', cenefa: 'Ovalada', superficie: 'TECHO' }), 'ROL', 1.5)).toBe(3);
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA', cenefa: 'Ovalada', superficie: 'PARED' }), 'ROL', 1.5)).toBe(6);
  });
  it('cenefa cuadrada: 1/bracket', () => {
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA', cenefa: 'Cuadrada a muro' }), 'ROL', 1.5)).toBe(3);
  });
  it('dúo sin cenefa se fija con brackets → 4 tarugos como el roller (no 0)', () => {
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA' }), 'DUO_MANUAL_38mm', 1.5)).toBe(4);
    expect(cantidadTarugos(pano({ materialTipo: 'CONCRETO' }), 'DUO_MOTOR_PEQUEÑO_38mm', 1.5)).toBe(4);
    expect(cantidadTarugos(pano({ materialTipo: 'MADERA' }), 'DUO_MANUAL_38mm', 1.5)).toBe(0);
  });
});

describe('insumosDePano', () => {
  it('roller blanco → tapas TAP19/TAP01 + 2 tornillos TOR02', () => {
    const out = insumosDePano(pano({ color: 'BCO' }), { categoria: 'ROL', anchoM: 1.5 });
    const map = Object.fromEntries(out.map((i) => [i.codigo, i.cantidad]));
    expect(map).toEqual({ TAP19: 1, TAP01: 1, TOR02: 2 });
  });
  it('color de accesorios fuera de mapa (MET) → sin tapas ni tornillos de tapa', () => {
    expect(insumosDePano(pano({ color: 'MET' }), { categoria: 'ROL', anchoM: 1.5 })).toEqual([]);
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
  it('DÚO → 2 tapas exteriores por color + 2 TAP13, SIN tornillos (a presión)', () => {
    const out = insumosDePano(pano({ color: 'NEG' }), { categoria: 'DUO_MANUAL_38mm', anchoM: 1.5 });
    const map = Object.fromEntries(out.map((i) => [i.codigo, i.cantidad]));
    expect(map.TAP11).toBe(2); // exterior negro
    expect(map.TAP13).toBe(2); // interno
    expect(out.some((i) => i.codigo === 'TOR02')).toBe(false); // a presión
    // Color fuera de mapa (MET): solo las 2 internas.
    const met = insumosDePano(pano({ color: 'MET' }), { categoria: 'DUO_MANUAL_38mm', anchoM: 1.5 });
    expect(met.map((i) => i.codigo)).toEqual(['TAP13']);
  });
  it('dúo vulcanita sin cenefa → 4 tarugos TAR01 (además de las tapas dúo)', () => {
    const out = insumosDePano(pano({ color: 'GRS', materialTipo: 'VULCANITA' }), { categoria: 'DUO_MANUAL_38mm', anchoM: 1.5 });
    expect(out.find((i) => i.codigo === 'TAR01')?.cantidad).toBe(4);
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

describe('insumosMotorDePano', () => {
  it('DOM38 → motor + control DOM39 + cable DOM40 + enchufe DOM04', () => {
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM38' }));
    expect(out.map((i) => i.codigo)).toEqual(['DOM38', 'DOM39', 'DOM40', 'DOM04']);
  });
  it('DOM41: motor + DOM42 + DOM04, SIN cable DOM40 (#28); controles/hub adicionales', () => {
    const base = insumosMotorDePano(pano({ motorModelo: 'DOM41' }));
    expect(base.map((i) => i.codigo)).toEqual(['DOM41', 'DOM42', 'DOM04']); // sin DOM40
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM41', motorControlAdicCant: 2, motorHubUsbCant: 1 }));
    expect(out.some((i) => i.codigo === 'DOM40')).toBe(false);
    const ctrl = out.filter((i) => i.codigo === 'DOM42').reduce((a, i) => a + i.cantidad, 0);
    expect(ctrl).toBe(3); // 1 del kit + 2 adicionales
    expect(out.find((i) => i.codigo === 'DOM43')?.cantidad).toBe(1);
  });
  it("'CABLE' futuro o sin motor → sin códigos", () => {
    expect(insumosMotorDePano(pano({ motorModelo: 'CABLE' }))).toEqual([]);
    expect(insumosMotorDePano(pano({}))).toEqual([]);
  });
  it('F15: DOM41 con cenefa ovalada (chip o categoría) cae a DOM38+DOM39', () => {
    const porChip = insumosMotorDePano(pano({ motorModelo: 'DOM41', cenefa: 'Ovalada' }));
    expect(porChip.map((i) => i.codigo)).toEqual(['DOM38', 'DOM39', 'DOM40', 'DOM04']);
    const porCategoria = insumosMotorDePano(pano({ motorModelo: 'DOM41' }), 'ROL_CENEFA_OVALADA_MOTOR_GRANDE');
    expect(porCategoria[0].codigo).toBe('DOM38');
    // Sin cenefa ovalada, DOM41 se mantiene.
    expect(insumosMotorDePano(pano({ motorModelo: 'DOM41' }))[0].codigo).toBe('DOM41');
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
