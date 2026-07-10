import { describe, expect, it } from 'vitest';
import type { Pano } from './types';
import {
  bracketDeCenefa,
  cantidadBrackets,
  cantidadTarugos,
  insumosDePano,
  insumosMotorDePano,
  llevaTapasPeso,
  otLlevaDomotica,
  panoLlevaDomotica,
} from './insumosCortina';

const pano = (p: Partial<Pano>): Partial<Pano> => p;

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
  it('solo roller (incluye ovalada y motorizados); excluye dual/pletina/dúo/oscuridad', () => {
    expect(llevaTapasPeso('ROL')).toBe(true);
    expect(llevaTapasPeso('ROL_MANUAL_CENEFA_OVALADA_38mm')).toBe(true);
    expect(llevaTapasPeso('ROL_CENEFA_OVALADA_MOTOR_GRANDE')).toBe(true);
    expect(llevaTapasPeso('ROL_DUAL')).toBe(false);
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

describe('cantidadTarugos', () => {
  it('solo con vulcanita; roller sin cenefa → 4', () => {
    expect(cantidadTarugos(pano({ materialTipo: 'VULCANITA' }), 'ROL', 1.5)).toBe(4);
    expect(cantidadTarugos(pano({ materialTipo: 'CONCRETO' }), 'ROL', 1.5)).toBe(0);
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
});

describe('insumosMotorDePano', () => {
  it('DOM38 → motor + control DOM39 + cable DOM40 + enchufe DOM04', () => {
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM38' }));
    expect(out.map((i) => i.codigo)).toEqual(['DOM38', 'DOM39', 'DOM40', 'DOM04']);
  });
  it('DOM41 con 2 controles adicionales → DOM42 total 3, y hub adicional DOM43', () => {
    const out = insumosMotorDePano(pano({ motorModelo: 'DOM41', motorControlAdicCant: 2, motorHubUsbCant: 1 }));
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
