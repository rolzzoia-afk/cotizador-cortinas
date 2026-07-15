import { describe, expect, it } from 'vitest';
import {
  claveModelo,
  codigoTuboPorAncho,
  etiquetaModelo,
  modelosParaCategoria,
  validarAnchoCategoria,
  validarAnchoModelo,
  type ModeloDespiece,
} from './tipos';

const base: ModeloDespiece = {
  sistema: 'ROLLER_SIMPLE',
  tipo_rol: 'ROL_SIMPLE',
  mecanismo: 'MEC_05_LZ90_BLANCO',
  codigos_tubo: 'E01; E02',
  diametro_tubo_mm: 38,
  dcto_tubo_cm: 3.8,
  dcto_tela_cm: 0.5,
  suma_peso_cm: 0.1,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 2.2,
  activo: true,
  notas: '',
};

describe('validarAnchoModelo', () => {
  it('acepta anchos dentro del máximo (incluido el límite exacto)', () => {
    expect(validarAnchoModelo(base, 2.0)).toBeNull();
    expect(validarAnchoModelo(base, 2.2)).toBeNull();
  });
  it('rechaza anchos que exceden el máximo', () => {
    const err = validarAnchoModelo(base, 2.21);
    expect(err).toContain('supera el máximo');
    expect(err).toContain('2.2');
  });
  it('sin ancho_max definido no valida (0 = sin límite)', () => {
    expect(validarAnchoModelo({ ...base, ancho_max_m: 0 }, 99)).toBeNull();
  });
});

describe('modelosParaCategoria / validarAnchoCategoria', () => {
  const catalogo: ModeloDespiece[] = [
    base, // ROLLER_SIMPLE max 2.2
    { ...base, mecanismo: 'MEC_28_63mm', ancho_max_m: 3.5 }, // ROLLER_SIMPLE max 3.5
    { ...base, sistema: 'CENEFA_OVALADA', tipo_rol: 'ROL_CENEFA_OV_MOTOR_GRD', mecanismo: 'MEC_09', ancho_max_m: 2.5 },
    { ...base, sistema: 'CENEFA_OVALADA', tipo_rol: 'ROL_CENEFA_OV_MANUAL_45mm', mecanismo: 'MEC_09', ancho_max_m: 3 },
    { ...base, sistema: 'DARK_ROLLER', tipo_rol: 'DARK_INTERNO_38mm', mecanismo: '', ancho_max_m: 2.5 },
    { ...base, sistema: 'DARK_ROLLER', tipo_rol: 'DARK_INTERNO_45mm', mecanismo: '', ancho_max_m: 3 },
  ];

  it('ROL trae todos los roller simple', () => {
    expect(modelosParaCategoria(catalogo, 'ROL')).toHaveLength(2);
  });
  it('las categorías con variante filtran por tipo', () => {
    const grd = modelosParaCategoria(catalogo, 'ROL_CENEFA_OVALADA_MOTOR_GRANDE');
    expect(grd).toHaveLength(1);
    expect(grd[0].tipo_rol).toContain('MOTOR_GRD');
    expect(modelosParaCategoria(catalogo, 'DARK_38mm')[0].tipo_rol).toBe('DARK_INTERNO_38mm');
  });
  it('categoría sin catálogo (VERTICAL) no valida', () => {
    expect(modelosParaCategoria(catalogo, 'VERTICAL')).toHaveLength(0);
    expect(validarAnchoCategoria(catalogo, 'VERTICAL', 9)).toBeNull();
  });
  it('valida contra el MÁXIMO de la categoría (fabricable en al menos un modelo)', () => {
    expect(validarAnchoCategoria(catalogo, 'ROL', 3.0)).toBeNull(); // cabe en el de 3.5
    const err = validarAnchoCategoria(catalogo, 'ROL', 3.6);
    expect(err).toContain('no fabricable');
    expect(err).toContain('3.5');
  });
});

describe('claveModelo / etiquetaModelo', () => {
  it('clave única estable', () => {
    expect(claveModelo(base)).toBe('ROLLER_SIMPLE|ROL_SIMPLE|MEC_05_LZ90_BLANCO');
  });
  it('etiqueta legible con diámetro y sin mecanismo vacío', () => {
    expect(etiquetaModelo(base)).toBe('ROL_SIMPLE · MEC_05_LZ90_BLANCO (38mm)');
    expect(etiquetaModelo({ ...base, mecanismo: '', diametro_tubo_mm: 0 })).toBe('ROL_SIMPLE');
  });
});

describe('codigoTuboPorAncho — regla E02/E66 por ancho', () => {
  const soft38: ModeloDespiece = {
    sistema: 'SOFT_LIGHT',
    tipo_rol: 'SOFT_LIGHT_INTERNO_38mm',
    mecanismo: '',
    codigos_tubo: 'E01; E02; E03; E53; E66',
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
  const roll45: ModeloDespiece = { ...soft38, sistema: 'SOFT_LIGHT', tipo_rol: 'SOFT_LIGHT_INTERNO_45mm', codigos_tubo: 'E04; E05; E39; E46', diametro_tubo_mm: 45 };

  it('38mm: ≤2,2 m usa E02', () => {
    expect(codigoTuboPorAncho(soft38, 2.2)).toBe('E02');
    expect(codigoTuboPorAncho(soft38, 1.5)).toBe('E02');
  });
  it('38mm: >2,2 m usa E66', () => {
    expect(codigoTuboPorAncho(soft38, 2.21)).toBe('E66');
    expect(codigoTuboPorAncho(soft38, 2.97)).toBe('E66');
  });
  it('45mm: usa codigoPorDiametro (E78 default), no la regla E02/E66', () => {
    expect(codigoTuboPorAncho(roll45, 2.97)).toBe('E78');
  });
  it('sin códigos en catálogo: 38 mm sigue regla E02/E66 por diámetro', () => {
    expect(codigoTuboPorAncho({ ...soft38, codigos_tubo: '' }, 2.5)).toBe('E66');
    expect(codigoTuboPorAncho({ ...soft38, codigos_tubo: '' }, 1.5)).toBe('E02');
  });
});
