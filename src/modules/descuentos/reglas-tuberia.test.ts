import { describe, expect, it } from 'vitest';
import type { ModeloDespiece } from './tipos';
import {
  REGLAS_TUBERIA,
  chipTuberiaPorAncho,
  codigoTuboPorAncho,
  tuberiaParaPano,
} from './reglas-tuberia';
import { OPCIONES_TUBERIA } from '@/modules/cotizador/fase2';

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

const oscuranti63: ModeloDespiece = {
  ...soft38,
  sistema: 'OSCURANTI',
  tipo_rol: 'OSCURANTI_63',
  diametro_tubo_mm: 63,
  codigos_tubo: 'E47',
};

describe('REGLAS_TUBERIA.reglaE02E66', () => {
  it('umbral configurable en 2,2 m', () => {
    expect(REGLAS_TUBERIA.reglaE02E66.anchoMaxE02M).toBe(2.2);
  });

  it('38 mm: ≤2,2 m → E02', () => {
    expect(codigoTuboPorAncho(soft38, 2.2)).toBe('E02');
    expect(codigoTuboPorAncho(soft38, 1.5)).toBe('E02');
  });

  it('38 mm: >2,2 m → E66 (aunque el catálogo no liste E66)', () => {
    const sinE66 = { ...soft38, codigos_tubo: 'E01; E02' };
    expect(codigoTuboPorAncho(sinE66, 2.21)).toBe('E66');
    expect(codigoTuboPorAncho(soft38, 2.989)).toBe('E66');
  });

  it('63 mm → E47 por codigoPorDiametro', () => {
    expect(codigoTuboPorAncho(oscuranti63, 3.5)).toBe('E47');
    expect(chipTuberiaPorAncho(oscuranti63, 3.5, OPCIONES_TUBERIA)).toContain('[E47]');
  });

  it('OSCURANTI por categoría → E47 aunque el modelo Excel diga 38 mm', () => {
    const model38 = { ...oscuranti63, diametro_tubo_mm: 38, codigos_tubo: 'E02; E66' };
    expect(codigoTuboPorAncho(model38, 3.51, 'OSCURANTI_63mm')).toBe('E47');
    expect(
      tuberiaParaPano(
        3.51,
        model38,
        '0,38mm [E66] 2mm',
        OPCIONES_TUBERIA,
        'OSCURANTI_63mm',
      ),
    ).toContain('[E47]');
  });
});

describe('tuberiaParaPano', () => {
  it('ancho 2,99 m sin tubo guardado → chip E66', () => {
    expect(
      tuberiaParaPano(2.989, soft38, '', OPCIONES_TUBERIA),
    ).toContain('[E66]');
  });

  it('corrige E02 guardado en cortina ancha → E66', () => {
    expect(
      tuberiaParaPano(
        2.989,
        soft38,
        '0,38mm [E02] 1,2mm',
        OPCIONES_TUBERIA,
      ),
    ).toContain('[E66]');
  });

  it('respeta E02 en cortina ≤2,2 m', () => {
    expect(
      tuberiaParaPano(1.745, soft38, '0,38mm [E02] 1,2mm', OPCIONES_TUBERIA),
    ).toContain('[E02]');
  });
});
