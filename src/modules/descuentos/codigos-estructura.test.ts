import { describe, expect, it } from 'vitest';
import { codigoEstructura } from './codigos-estructura';

describe('codigoEstructura', () => {
  it('TUBO / PLETINA usan el código de tubería', () => {
    expect(codigoEstructura('TUBO', 'NEGRO', '38mm_E02')).toBe('38mm_E02');
    expect(codigoEstructura('PLETINA', 'NEGRO', 'VELCRO')).toBe('VELCRO');
  });

  it('PESO INTERNO siempre E13 (sin importar color)', () => {
    expect(codigoEstructura('PESO INTERNO', 'NEGRO', '38mm_E02')).toBe('E13');
    expect(codigoEstructura('PESO INTERNO', '', '')).toBe('E13');
  });

  it('PESO U color-fijo: NEGRO→E18, BLANCO→E19, GRIS→E20', () => {
    expect(codigoEstructura('PESO U', 'NEGRO', '')).toBe('E18');
    expect(codigoEstructura('PESO U', 'blanco', '')).toBe('E19');
    expect(codigoEstructura('PESO U', 'GRIS', '')).toBe('E20');
    expect(codigoEstructura('PESO U', 'AZUL', '')).toBe(''); // sin mapeo → vacío
  });

  it('PESO roller color-fijo: NEGRO→E14, BLANCO→E15, GRIS→E16', () => {
    expect(codigoEstructura('PESO', 'NEGRO', '38mm_E02')).toBe('E14');
    expect(codigoEstructura('PESO', 'BLANCO', '')).toBe('E15');
    expect(codigoEstructura('PESO', 'GRIS', '')).toBe('E16');
  });

  it('CENEFA OVALADA color-fijo: NEGRO→E26, BLANCO→E27, GRIS→E28', () => {
    expect(codigoEstructura('CENEFA OVALADA', 'NEGRO', '')).toBe('E26');
    expect(codigoEstructura('CENEFA OVALADA', 'BLANCO', '')).toBe('E27');
    expect(codigoEstructura('CENEFA OVALADA', 'GRIS', '')).toBe('E28');
    expect(codigoEstructura('CENEFA OVALADA', 'ALUMINIO', '')).toBe(''); // sin código fijo → vacío
  });

  it('normaliza color corto/largo/plural (NEG → NEGRO, BCO → BLANCO, GRS → GRIS)', () => {
    expect(codigoEstructura('PESO', 'NEG', '')).toBe('E14');
    expect(codigoEstructura('CENEFA OVALADA', 'BCO', '')).toBe('E27');
    expect(codigoEstructura('PESO U', 'GRS', '')).toBe('E20');
    expect(codigoEstructura('PESO', 'NEGROS', '')).toBe('E14');
  });

  it('PESO SOFT LIGHT (oscuridad): BLANCO→E24, NEGRO→E44, gris sin código', () => {
    expect(codigoEstructura('PESO SOFT LIGHT', 'BLANCO', '')).toBe('E24');
    expect(codigoEstructura('PESO SOFT LIGHT', 'BCO', '')).toBe('E24');
    expect(codigoEstructura('PESO SOFT LIGHT', 'NEGRO', '')).toBe('E44');
    expect(codigoEstructura('PESO SOFT LIGHT', 'NEG', '')).toBe('E44');
    expect(codigoEstructura('PESO SOFT LIGHT', 'GRIS', '')).toBe(''); // soft light no va gris
  });
});
