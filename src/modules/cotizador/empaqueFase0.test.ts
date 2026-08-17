import { describe, it, expect } from 'vitest';
import { anchoEmpaquePeorCasoM } from './empaqueFase0';
import { FORMULAS_DEFAULT, type FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';

// Los goldens de reglas-oscuridad: ancho 200 → tela 192,8 (INT) / 200,6 (SEMI) /
// 207,2 (EXT) en soft light ovalada; 193,3 / 200,9 / 208,8 en cuadrada/dark.
describe('anchoEmpaquePeorCasoM', () => {
  it('soft light 45: gana la cenefa CUADRADA externa (+8,8), no la ovalada (+7,2)', () => {
    // La cenefa se elige en Fase 2, así que el peor caso barre las dos familias.
    expect(anchoEmpaquePeorCasoM('SOFT_LIGHT_45mm', 2.0)).toBeCloseTo(2.088, 4);
  });

  it('soft light 45 de 2,81 (OT 3169) → 2,898', () => {
    expect(anchoEmpaquePeorCasoM('SOFT_LIGHT_45mm', 2.81)).toBeCloseTo(2.898, 4);
  });

  it('dark 38: golden 200 → 208,8', () => {
    expect(anchoEmpaquePeorCasoM('DARK_38mm', 2.0)).toBeCloseTo(2.088, 4);
  });

  it('oscuranti y dark 45 también llegan a 208,8', () => {
    expect(anchoEmpaquePeorCasoM('OSCURANTI_63mm', 2.0)).toBeCloseTo(2.088, 4);
    expect(anchoEmpaquePeorCasoM('DARK_45mm', 2.0)).toBeCloseTo(2.088, 4);
  });

  it('SIEMPRE es mayor que el nominal (el interno, que corta menos, nunca gana)', () => {
    for (const cat of ['SOFT_LIGHT_38mm', 'SOFT_LIGHT_45mm', 'DARK_38mm', 'OSCURANTI_63mm']) {
      expect(anchoEmpaquePeorCasoM(cat, 1.5)!).toBeGreaterThan(1.5);
    }
  });

  it('beeblack: la tela externa es ancho + 2 cm', () => {
    expect(anchoEmpaquePeorCasoM('BEEBLACK_SML', 2.0)).toBeCloseTo(2.02, 4);
  });

  it('roller, dúo y vertical no tienen ajuste por montaje → undefined', () => {
    expect(anchoEmpaquePeorCasoM('ROL', 2.0)).toBeUndefined();
    expect(anchoEmpaquePeorCasoM('DUO_MANUAL_38mm', 2.0)).toBeUndefined();
    expect(anchoEmpaquePeorCasoM('VERTICAL', 2.0)).toBeUndefined();
    expect(anchoEmpaquePeorCasoM(undefined, 2.0)).toBeUndefined();
  });

  it('ancho 0 o negativo → undefined (no rompe el motor)', () => {
    expect(anchoEmpaquePeorCasoM('SOFT_LIGHT_45mm', 0)).toBeUndefined();
    expect(anchoEmpaquePeorCasoM('SOFT_LIGHT_45mm', -1)).toBeUndefined();
  });

  it('respeta el telaAdj EDITADO en el catálogo técnico (no usa constantes propias)', () => {
    const editadas: FormulasFamilias = {
      ...FORMULAS_DEFAULT,
      oscuridad: {
        ...FORMULAS_DEFAULT.oscuridad,
        telaAdj: {
          ...FORMULAS_DEFAULT.oscuridad.telaAdj,
          SOFT_LIGHT_45: [-7.2, 0.6, 20],
        },
      },
    };
    // Con el externo subido a +20 la ovalada pasa a ganarle a la cuadrada.
    expect(anchoEmpaquePeorCasoM('SOFT_LIGHT_45mm', 2.0, editadas)).toBeCloseTo(2.2, 4);
  });

  it('respeta el parche porTipo de un tipo de cortina propio', () => {
    const tipos: TipoCortina[] = [
      { categoria: 'MI_DARK', nombre: 'Mi Dark', grupo: 'Oscuridad', base: 'DARK_38mm', activo: true },
    ];
    const conParche: FormulasFamilias = {
      ...FORMULAS_DEFAULT,
      oscuridad: {
        ...FORMULAS_DEFAULT.oscuridad,
        porTipo: { MI_DARK: { tuboPaso: [4.8, 5, 0] } },
      },
    };
    // El tipo propio se despieza como su molde…
    expect(anchoEmpaquePeorCasoM('MI_DARK', 2.0, FORMULAS_DEFAULT, tipos)).toBeCloseTo(2.088, 4);
    // …pero con su parche: tuboPaso externo 5,4 → 0 suma 5,4 cm más de tela.
    expect(anchoEmpaquePeorCasoM('MI_DARK', 2.0, conParche, tipos)).toBeCloseTo(2.142, 4);
  });
});
