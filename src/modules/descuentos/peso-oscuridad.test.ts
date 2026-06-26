import { describe, expect, it } from 'vitest';
import {
  codigoPesoInfOscuridad,
  colorPesoInfOscuridadExcel,
  colorPesoNormalizado,
} from './peso-oscuridad';

describe('peso-oscuridad', () => {
  it('normaliza abreviaturas de color', () => {
    expect(colorPesoNormalizado('BCO')).toBe('BLANCO');
    expect(colorPesoNormalizado('blanco')).toBe('BLANCO');
    expect(colorPesoNormalizado('NEG')).toBe('NEGRO');
    expect(colorPesoNormalizado('Negro')).toBe('NEGRO');
    expect(colorPesoNormalizado('')).toBe('');
  });

  it('código de inventario por color', () => {
    expect(codigoPesoInfOscuridad('BLANCO')).toBe('E24');
    expect(codigoPesoInfOscuridad('BCO')).toBe('E24');
    expect(codigoPesoInfOscuridad('NEGRO')).toBe('E44');
    expect(codigoPesoInfOscuridad('NEG')).toBe('E44');
    expect(codigoPesoInfOscuridad('GRIS')).toBe('');
    expect(codigoPesoInfOscuridad('')).toBe('');
  });

  it('valor de columna Excel "E24 [BLANCO]"', () => {
    expect(colorPesoInfOscuridadExcel('BCO')).toBe('E24 [BLANCO]');
    expect(colorPesoInfOscuridadExcel('NEGRO')).toBe('E44 [NEGRO]');
    // color sin código conocido → solo color (optimizador lo resuelve)
    expect(colorPesoInfOscuridadExcel('GRIS')).toBe('GRIS');
    expect(colorPesoInfOscuridadExcel('')).toBe('');
  });
});
