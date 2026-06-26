import { describe, expect, it } from 'vitest';
import {
  ajusteCenefaCuadradaCm,
  anchoNominalCenefaCorte,
  buscarAdicionalCenefaOvalada,
  cenefaOvaladaDesdeAdicional,
  esAdicionalCenefaOvalada,
  esRollerOVertical,
  etiquetaTipInstCenefa,
  indexCenefasOvaladasAdicionales,
  medidaCorteCenefaCuadrada,
  medidaCorteCenefaOvalada,
  ubicacionCoincideConAdicional,
} from './adicionales-cenefa';
import type { ModeloDespiece } from './tipos';

const modeloRoller: ModeloDespiece = {
  sistema: 'ROLLER_SIMPLE',
  tipo_rol: 'ROL_SIMPLE',
  mecanismo: 'MEC_05',
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
  ancho_max_m: 3,
  activo: true,
  notas: '',
};

const modeloCenefa: ModeloDespiece = {
  ...modeloRoller,
  sistema: 'CENEFA_OVALADA',
  tipo_rol: 'ROL_CENEFA_OV_MANUAL_38mm',
  dcto_tubo_cm: 1.8,
  dcto_cenefa_cm: 1.5,
};

const modeloSoftLight: ModeloDespiece = {
  ...modeloRoller,
  sistema: 'SOFT_LIGHT',
  tipo_rol: 'SOFT_LIGHT_INTERNO_38mm',
  dcto_tubo_cm: 1.2,
};

const adicPza3G2 = { codInt: 'CENFO', cantidad: 2.96, descuento: 0, ubicacion: 'PZA 3-G2' };

describe('adicionales-cenefa', () => {
  it('detecta CENFO y CENF O', () => {
    expect(esAdicionalCenefaOvalada('CENFO')).toBe(true);
    expect(esAdicionalCenefaOvalada('CENF O')).toBe(true);
    expect(esAdicionalCenefaOvalada('DOM 38')).toBe(false);
  });

  it('solo coincide ubicación exacta (no IZQ/DER)', () => {
    expect(ubicacionCoincideConAdicional('PZA 3-G2', 'PZA 3-G2')).toBe(true);
    expect(ubicacionCoincideConAdicional('PZA 3 IZQ-G2', 'PZA 3-G2')).toBe(false);
  });

  it('busca adicional solo en la misma ubicación', () => {
    expect(buscarAdicionalCenefaOvalada('PZA 3-G2', [adicPza3G2])?.cantidad).toBe(2.96);
    expect(buscarAdicionalCenefaOvalada('PZA 3 IZQ-G2', [adicPza3G2])).toBeNull();
  });

  it('prioriza ancho del paño; Soft Light interno → cenefa 295.7 (296.9 − 1.2)', () => {
    expect(anchoNominalCenefaCorte(adicPza3G2, 296.9)).toBe(296.9);
    expect(
      cenefaOvaladaDesdeAdicional(adicPza3G2, modeloSoftLight, {
        anchoPanoCm: 296.9,
        categoria: 'SOFT_LIGHT_38mm',
        sentido: 'INTERNO',
      }),
    ).toBe(295.7);
  });

  it('roller cenefa ovalada: tapa = ancho − dcto_cenefa (1.5)', () => {
    expect(cenefaOvaladaDesdeAdicional(adicPza3G2, modeloRoller, { anchoPanoCm: 296.9 })).toBe(295.4);
    expect(cenefaOvaladaDesdeAdicional(adicPza3G2, modeloRoller, { anchoPanoCm: 0 })).toBe(294.5);
  });

  it('indexa adicionales por ubicación normalizada', () => {
    const map = indexCenefasOvaladasAdicionales([
      { codInt: 'CENFO', cantidad: 2.96, descuento: 0, ubicacion: 'pza 3-g2' },
      { codInt: 'CENFO', cantidad: 2.99, descuento: 0, ubicacion: 'PZA 2-G3' },
    ]);
    expect(map.get('PZA 3-G2')?.cantidad).toBe(2.96);
  });

  it('modelo cenefa integrado usa su propio dcto_cenefa', () => {
    expect(medidaCorteCenefaOvalada(250, modeloCenefa)).toBe(248.5); // 250 − 1.5
  });
});

describe('cenefa cuadrada (verticales/roller)', () => {
  it('ajuste por TIP. INST: +1 / +2 / −0,5 (muro a muro es la base)', () => {
    expect(ajusteCenefaCuadradaCm('CON_1_TAPA')).toBe(1);
    expect(ajusteCenefaCuadradaCm('CON_2_TAPAS')).toBe(2);
    expect(ajusteCenefaCuadradaCm('MURO_MURO')).toBe(-0.5);
    // legacy/vacío → muro a muro
    expect(ajusteCenefaCuadradaCm('SIN_TAPA')).toBe(-0.5);
    expect(ajusteCenefaCuadradaCm(undefined)).toBe(-0.5);
  });

  it('ancho corte est. = ancho inicial + ajuste (ej. 269,40 muro a muro → 268,90)', () => {
    expect(medidaCorteCenefaCuadrada(269.4, 'MURO_MURO')).toBe(268.9);
    expect(medidaCorteCenefaCuadrada(269.4, 'CON_1_TAPA')).toBe(270.4);
    expect(medidaCorteCenefaCuadrada(269.4, 'CON_2_TAPAS')).toBe(271.4);
    expect(medidaCorteCenefaCuadrada(269.4, undefined)).toBe(268.9);
    expect(medidaCorteCenefaCuadrada(0, 'MURO_MURO')).toBe(0);
  });

  it('esRollerOVertical: ROL* y VERTICAL', () => {
    expect(esRollerOVertical('ROL')).toBe(true);
    expect(esRollerOVertical('ROL_DUAL')).toBe(true);
    expect(esRollerOVertical('VERTICAL')).toBe(true);
    expect(esRollerOVertical('SOFT_LIGHT_38mm')).toBe(false);
    expect(esRollerOVertical('')).toBe(false);
  });

  it('etiqueta TIP. INST: legacy/vacío → "MURO_MURO"', () => {
    expect(etiquetaTipInstCenefa('MURO_MURO')).toBe('MURO_MURO');
    expect(etiquetaTipInstCenefa('CON_1_TAPA')).toBe('CON_1_TAPA');
    expect(etiquetaTipInstCenefa('SIN_TAPA')).toBe('MURO_MURO');
    expect(etiquetaTipInstCenefa(undefined)).toBe('MURO_MURO');
  });
});
