import { describe, expect, it } from 'vitest';
import {
  cortesSoftLight38,
  medidaCenefaSoftLight,
  varianteSoftLight,
} from './reglas-soft-light';
import type { ModeloDespiece } from './tipos';

const soft38: ModeloDespiece = {
  sistema: 'SOFT_LIGHT',
  tipo_rol: 'SOFT_LIGHT_SEMI_38mm',
  mecanismo: '',
  codigos_tubo: 'E66',
  diametro_tubo_mm: 38,
  dcto_tubo_cm: 1.2,
  dcto_tela_cm: 0.2,
  suma_peso_cm: 0.1,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 3,
  activo: true,
  notas: '',
};

const soft45: ModeloDespiece = {
  ...soft38,
  tipo_rol: 'SOFT_LIGHT_INTERNO_45mm',
  codigos_tubo: 'E78',
  diametro_tubo_mm: 45,
};

describe('varianteSoftLight', () => {
  it('prioriza sentido INTERNO sobre modelo SEMI', () => {
    expect(
      varianteSoftLight({
        categoria: 'SOFT_LIGHT_38mm',
        sentido: 'INTERNO',
        modelo: soft38,
      }),
    ).toEqual({ familia: 'SOFT_LIGHT_38', variante: 'INTERNO' });
  });

  it('sin sentido usa tipo_rol del modelo', () => {
    expect(varianteSoftLight({ categoria: 'SOFT_LIGHT_38mm', modelo: soft38 })).toEqual({
      familia: 'SOFT_LIGHT_38',
      variante: 'SEMI',
    });
  });

  it('la categoría 45 mm da la familia 45', () => {
    expect(
      varianteSoftLight({ categoria: 'SOFT_LIGHT_45mm', sentido: 'INTERNO', modelo: soft45 }),
    ).toEqual({ familia: 'SOFT_LIGHT_45', variante: 'INTERNO' });
  });

  it('un soft light 38 sobre tubo de 45 (banda E78) corta como 45', () => {
    expect(
      varianteSoftLight({ categoria: 'SOFT_LIGHT_38mm', sentido: 'INTERNO', modelo: soft45 }),
    ).toEqual({ familia: 'SOFT_LIGHT_45', variante: 'INTERNO' });
  });

  it('una cortina que no es soft light no tiene familia', () => {
    expect(varianteSoftLight({ categoria: 'ROL', sentido: 'INTERNO', modelo: soft38 })).toBeNull();
  });
});

describe('cortesSoftLight38', () => {
  it('medida cenefa interno: ancho 296.9 → 295.7', () => {
    expect(medidaCenefaSoftLight(296.9, 'SOFT_LIGHT_38', 'INTERNO')).toBe(295.7);
  });

  it('INTERNO: ancho 296.9 → tubo 293.9, peso 289.9', () => {
    expect(cortesSoftLight38(296.9, 'INTERNO')).toEqual({
      tubo: 293.9,
      peso: 289.9,
      tela: 289.7,
    });
  });
});

// OT 3169: el 45 descuenta 1,5 en INTERNO (el 38 descuenta 1,2). SEMI y EXTERNO
// comparten tabla con el 38.
describe('cenefa del soft light 45 mm', () => {
  it('INTERNO: ancho 281 → 279,5', () => {
    expect(medidaCenefaSoftLight(281, 'SOFT_LIGHT_45', 'INTERNO')).toBe(279.5);
    expect(medidaCenefaSoftLight(281, 'SOFT_LIGHT_38', 'INTERNO')).toBe(279.8);
  });

  it('SEMI y EXTERNO miden igual que el 38', () => {
    expect(medidaCenefaSoftLight(281, 'SOFT_LIGHT_45', 'SEMI')).toBe(287.6);
    expect(medidaCenefaSoftLight(281, 'SOFT_LIGHT_45', 'EXTERNO')).toBe(294.2);
  });
});
