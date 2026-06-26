import { describe, expect, it } from 'vitest';
import {
  cortesSoftLight38,
  medidaCenefaSoftLight38,
  varianteSoftLight38,
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

describe('varianteSoftLight38', () => {
  it('prioriza sentido INTERNO sobre modelo SEMI', () => {
    expect(
      varianteSoftLight38({
        categoria: 'SOFT_LIGHT_38mm',
        sentido: 'INTERNO',
        modelo: soft38,
      }),
    ).toBe('INTERNO');
  });

  it('sin sentido usa tipo_rol del modelo', () => {
    expect(
      varianteSoftLight38({ categoria: 'SOFT_LIGHT_38mm', modelo: soft38 }),
    ).toBe('SEMI');
  });
});

describe('cortesSoftLight38', () => {
  it('medida cenefa interno: ancho 296.9 → 295.7', () => {
    expect(medidaCenefaSoftLight38(296.9, 'INTERNO')).toBe(295.7);
  });

  it('INTERNO: ancho 296.9 → tubo 293.9, peso 289.9', () => {
    expect(cortesSoftLight38(296.9, 'INTERNO')).toEqual({
      tubo: 293.9,
      peso: 289.9,
      tela: 289.7,
    });
  });
});
