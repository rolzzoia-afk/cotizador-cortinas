import { describe, expect, it } from 'vitest';
import {
  chipMecanismoDeModelo,
  chipMecanismoEfectivo,
  chipMecanismoPorColor,
  chipTuberiaDeModelo,
  mecanismoParaPano,
  modeloDesdeChipMecanismo,
  numeroMecPorColor,
  opcionesMecanismoFiltradas,
} from './chips';
import { OPCIONES_MECANISMO, OPCIONES_TUBERIA } from '@/modules/cotizador/fase2';
import type { ModeloDespiece } from './tipos';

const m = (mecanismo: string, diametro = 38): ModeloDespiece => ({
  sistema: 'ROLLER_SIMPLE', tipo_rol: 'ROL_SIMPLE', mecanismo,
  codigos_tubo: 'E01; E02', diametro_tubo_mm: diametro,
  dcto_tubo_cm: 3.8, dcto_tela_cm: 0.5, suma_peso_cm: 0.1,
  dcto_cenefa_cm: 0, dcto_cenefa_del_cm: 0, dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0, peso_interno_duo_cm: 0, peso_u_duo_cm: 0,
  ancho_max_m: 2.6, activo: true, notas: '',
});

describe('chips ↔ modelo', () => {
  it('MEC_13 marca el chip "[MEC 13]" y 38mm marca la tubería 0,38mm', () => {
    const modelo = m('MEC_13_LZ50_SINFLEX_GRIS');
    expect(chipMecanismoDeModelo(modelo, OPCIONES_MECANISMO)).toContain('[MEC 13]');
    expect(chipTuberiaDeModelo(modelo, OPCIONES_TUBERIA)).toContain('0,38mm');
  });
  it('63mm → chip 0,63mm; pletina (0mm) → VELCRO', () => {
    expect(chipTuberiaDeModelo(m('MEC_28_X', 63), OPCIONES_TUBERIA)).toContain('0,63mm');
    expect(chipTuberiaDeModelo(m('VELCRO', 0), OPCIONES_TUBERIA)).toBe('VELCRO');
  });
  it('clickear el chip "[MEC 14]" encuentra el modelo MEC_14', () => {
    const candidatos = [m('MEC_13_LZ50_SINFLEX_GRIS'), m('MEC_14_LZ50_SINFLEX_BLANCO')];
    const elegido = modeloDesdeChipMecanismo(candidatos, 'LZ50 SFLX BCO [MEC 14]');
    expect(elegido?.mecanismo).toBe('MEC_14_LZ50_SINFLEX_BLANCO');
  });
  it('MEC_05 encuentra chip cuando está en OPCIONES_MECANISMO', () => {
    expect(chipMecanismoDeModelo(m('MEC_05_LZ90_BLANCO'), OPCIONES_MECANISMO)).toContain('[MEC 05]');
    expect(modeloDesdeChipMecanismo([m('MEC_05_LZ90_BLANCO')], 'sin formato')).toBeNull();
  });
});

describe('MAPEO_COLOR_MEC inventario', () => {
  it('BCO → 33, GRS → 34, NEG → 32', () => {
    expect(numeroMecPorColor('BCO')).toBe(33);
    expect(numeroMecPorColor('BLANCO')).toBe(33);
    expect(numeroMecPorColor('GRS')).toBe(34);
    expect(numeroMecPorColor('GRIS')).toBe(34);
    expect(numeroMecPorColor('NEG')).toBe(32);
    expect(numeroMecPorColor('NEGRO')).toBe(32);
  });

  it('chipMecanismoPorColor resuelve chips de inventario', () => {
    expect(chipMecanismoPorColor('BCO', OPCIONES_MECANISMO)).toContain('[MEC 33]');
    expect(chipMecanismoPorColor('GRS', OPCIONES_MECANISMO)).toContain('[MEC 34]');
    expect(chipMecanismoPorColor('NEG', OPCIONES_MECANISMO)).toContain('[MEC 32]');
  });
});

describe('opcionesMecanismoFiltradas', () => {
  const modelos = [m('MEC_05_LZ90_BLANCO'), m('MEC_13_LZ50_SINFLEX_GRIS')];

  it('siempre muestra MEC 32/33/34 para categorías con mecanismo', () => {
    const opts = opcionesMecanismoFiltradas(modelos, 'ROL', 'MET', OPCIONES_MECANISMO);
    expect(opts.some((o) => o.includes('[MEC 32]'))).toBe(true);
    expect(opts.some((o) => o.includes('[MEC 33]'))).toBe(true);
    expect(opts.some((o) => o.includes('[MEC 34]'))).toBe(true);
    expect(opts.some((o) => o.includes('[MEC 05]'))).toBe(false);
  });

  it('BCO en ROL incluye MEC 33 entre los kits de inventario', () => {
    const opts = opcionesMecanismoFiltradas(modelos, 'ROL', 'BCO', OPCIONES_MECANISMO);
    expect(opts.filter((o) => o.includes('[MEC 3'))).toHaveLength(3);
    expect(opts.some((o) => o.includes('[MEC 33]'))).toBe(true);
  });

  it('GRS incluye los tres kits de inventario', () => {
    const opts = opcionesMecanismoFiltradas(modelos, 'ROL', 'GRS', OPCIONES_MECANISMO);
    expect(opts.some((o) => o.includes('[MEC 34]'))).toBe(true);
    expect(opts.some((o) => o.includes('[MEC 33]'))).toBe(true);
  });

  it('VERTICAL no muestra opciones', () => {
    expect(opcionesMecanismoFiltradas(modelos, 'VERTICAL', 'BCO', OPCIONES_MECANISMO)).toEqual([]);
  });

  it('conserva selección manual no-legacy fuera del filtro', () => {
    const manual = 'KIT SIMPLE NEGRO 38MM [MEC 32]';
    const opts = opcionesMecanismoFiltradas(modelos, 'ROL', 'BCO', OPCIONES_MECANISMO, manual);
    expect(opts.some((o) => o.includes('[MEC 33]'))).toBe(true);
    expect(opts).toContain(manual);
  });

  it('no incluye MEC 05 legacy en la lista', () => {
    const legacy = 'LZ 38 MERG BCO [MEC 05]';
    const opts = opcionesMecanismoFiltradas(modelos, 'ROL', 'BCO', OPCIONES_MECANISMO, legacy);
    expect(opts.some((o) => o.includes('[MEC 05]'))).toBe(false);
    expect(opts.some((o) => o.includes('[MEC 33]'))).toBe(true);
  });
});

describe('mecanismoParaPano — pre-selección Fase 2', () => {
  it('BCO en colorPeso (sin colorMecanismo) → MEC 33', () => {
    const mec = mecanismoParaPano(
      { colorPeso: 'BCO', mecanismo: '' },
      'Blanco',
      m('MEC_05_LZ90_BLANCO'),
      OPCIONES_MECANISMO,
      'ROL',
    );
    expect(mec).toContain('[MEC 33]');
  });

  it('legacy MEC 05 + BCO → MEC 33', () => {
    expect(
      mecanismoParaPano(
        { colorMecanismo: 'BCO', mecanismo: 'LZ 38 MERG BCO [MEC 05]' },
        '',
        null,
        OPCIONES_MECANISMO,
        'ROL',
      ),
    ).toContain('[MEC 33]');
  });

  it('SOFT_LIGHT_38mm + BCO → MEC 39', () => {
    expect(
      mecanismoParaPano(
        { colorPeso: 'BCO', mecanismo: '' },
        'Blanco',
        null,
        OPCIONES_MECANISMO,
        'SOFT_LIGHT_38mm',
      ),
    ).toContain('[MEC 39]');
  });

  it('OSCURANTI_63mm → siempre MEC 28', () => {
    expect(
      mecanismoParaPano(
        { colorMecanismo: 'NEG', mecanismo: 'KIT SIMPLE NEGRO 38MM [MEC 32]' },
        '',
        null,
        OPCIONES_MECANISMO,
        'OSCURANTI_63mm',
      ),
    ).toContain('[MEC 28]');
  });
});

describe('opcionesMecanismoFiltradas — categorías especiales', () => {
  const modelos = [m('MEC_05_LZ90_BLANCO')];

  it('OSCURANTI muestra catálogo completo (sin legacy) para permitir cambio manual', () => {
    const opts = opcionesMecanismoFiltradas(modelos, 'OSCURANTI_63mm', 'BCO', OPCIONES_MECANISMO);
    expect(opts.length).toBeGreaterThan(1);
    expect(opts.some((o) => o.includes('[MEC 28]'))).toBe(true);
    expect(opts.some((o) => o.includes('[MEC 33]'))).toBe(true);
  });

  it('SOFT_LIGHT_38mm + BCO muestra catálogo completo con MEC 39', () => {
    const opts = opcionesMecanismoFiltradas(
      modelos,
      'SOFT_LIGHT_38mm',
      'BCO',
      OPCIONES_MECANISMO,
    );
    expect(opts.length).toBeGreaterThan(1);
    expect(opts.some((o) => o.includes('[MEC 39]'))).toBe(true);
  });
});

describe('mecanismoParaPano — respeta cambio manual', () => {
  it('OSCURANTI: MEC 10 manual no se pisa', () => {
    const manual = 'OVALADA BCO [MEC 10]';
    expect(
      mecanismoParaPano(
        { mecanismo: manual },
        '',
        null,
        OPCIONES_MECANISMO,
        'OSCURANTI_63mm',
      ),
    ).toBe(manual);
  });
});

describe('chipMecanismoEfectivo — inventario gana sobre legacy Excel', () => {
  it('BCO + MEC 05 guardado → MEC 33', () => {
    const legacy = 'LZ 38 MERG BCO [MEC 05]';
    const efectivo = chipMecanismoEfectivo(
      legacy,
      'BCO',
      m('MEC_05_LZ90_BLANCO'),
      OPCIONES_MECANISMO,
    );
    expect(efectivo).toContain('[MEC 33]');
  });

  it('GRS + MEC 13 guardado → MEC 34', () => {
    expect(
      chipMecanismoEfectivo('LZ50 SFLX GRIS [MEC 13]', 'GRS', null, OPCIONES_MECANISMO),
    ).toContain('[MEC 34]');
  });
});
