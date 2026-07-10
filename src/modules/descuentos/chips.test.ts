import { describe, expect, it } from 'vitest';
import {
  chipDualPorLadoColor,
  chipMecanismoDeModelo,
  chipMecanismoEfectivo,
  chipMecanismoPorColor,
  chipMecanismoPorNumero,
  chipTuberiaDeModelo,
  codigoTuberiaDeChip,
  esChipDual,
  ladoColorDesdeChipDual,
  mecanismoParaPano,
  modeloDesdeChipMecanismo,
  modeloPorAncho,
  numeroMecPorColor,
  opcionesMecanismoFiltradas,
} from './chips';
import { categoriaEsDual } from './tipos';
import {
  CHIPS_MECANISMO_LEGACY,
  OPCIONES_MECANISMO,
  OPCIONES_MECANISMO_DUAL,
  OPCIONES_MECANISMO_RESOLUCION,
  OPCIONES_TUBERIA,
} from '@/modules/cotizador/fase2';
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
  it('MEC_13 marca el chip "[MEC 13]" (lista de resolución) y 38mm la tubería E02', () => {
    const modelo = m('MEC_13_LZ50_SINFLEX_GRIS');
    expect(chipMecanismoDeModelo(modelo, OPCIONES_MECANISMO_RESOLUCION)).toContain('[MEC 13]');
    // Chip de tubería con descripción larga: 38mm → E02 ("E02-TUBO 1.2 / Ø 38 mm").
    expect(codigoTuberiaDeChip(chipTuberiaDeModelo(modelo, OPCIONES_TUBERIA))).toBe('E02');
  });
  it('63mm → chip E47; pletina (0mm) → VELCRO', () => {
    expect(codigoTuberiaDeChip(chipTuberiaDeModelo(m('MEC_28_X', 63), OPCIONES_TUBERIA))).toBe('E47');
    expect(chipTuberiaDeModelo(m('VELCRO', 0), OPCIONES_TUBERIA)).toBe('VELCRO');
  });
  it('clickear el chip "[MEC 14]" encuentra el modelo MEC_14', () => {
    const candidatos = [m('MEC_13_LZ50_SINFLEX_GRIS'), m('MEC_14_LZ50_SINFLEX_BLANCO')];
    const elegido = modeloDesdeChipMecanismo(candidatos, 'LZ50 SFLX BCO [MEC 14]');
    expect(elegido?.mecanismo).toBe('MEC_14_LZ50_SINFLEX_BLANCO');
  });
  it('MEC_05 encuentra chip en la lista de RESOLUCIÓN (ya no en la de UI)', () => {
    expect(chipMecanismoDeModelo(m('MEC_05_LZ90_BLANCO'), OPCIONES_MECANISMO_RESOLUCION)).toContain('[MEC 05]');
    expect(chipMecanismoDeModelo(m('MEC_05_LZ90_BLANCO'), OPCIONES_MECANISMO)).toBeNull();
    expect(modeloDesdeChipMecanismo([m('MEC_05_LZ90_BLANCO')], 'sin formato')).toBeNull();
  });
});

describe('listas de chips (UI vs resolución)', () => {
  it('la lista de UI ya no ofrece chips legacy; la de resolución los conserva', () => {
    for (const legacy of CHIPS_MECANISMO_LEGACY) {
      expect(OPCIONES_MECANISMO).not.toContain(legacy);
      expect(OPCIONES_MECANISMO_RESOLUCION).toContain(legacy);
    }
    // MEC 28 no es "legacy": es el fijo de Oscuranti y sigue en la UI.
    expect(OPCIONES_MECANISMO.some((o) => o.includes('[MEC 28]'))).toBe(true);
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

describe('modeloPorAncho (roller simple: 63 mm sobre 3 m)', () => {
  const roller38 = m('MEC_07_ROLLER_BLANCO', 38);
  const roller63 = m('MEC_28_63mm_BLANCO_DER_IZQ', 63);
  const modelos = [roller38, roller63];

  it('ROL >3 m sube al modelo 63 mm (MEC 28)', () => {
    expect(modeloPorAncho(modelos, 'ROL', 3.2, roller38, 'BCO')?.mecanismo).toBe('MEC_28_63mm_BLANCO_DER_IZQ');
  });
  it('ROL exactamente 3 m NO sube (regla es > 3, no ≥)', () => {
    expect(modeloPorAncho(modelos, 'ROL', 3.0, roller38, 'BCO')).toBe(roller38);
  });
  it('ROL que baja de 3 m vuelve al modelo 38 mm por color', () => {
    expect(modeloPorAncho(modelos, 'ROL', 2.5, roller63, 'BCO')?.mecanismo).toBe('MEC_07_ROLLER_BLANCO');
  });
  it('OSCURANTI (63 mm legítimo, sin regla de ancho) no se toca', () => {
    const osc = m('MEC_28_OSC', 63);
    expect(modeloPorAncho([osc], 'OSCURANTI_63mm', 3.5, osc, 'BCO')).toBe(osc);
  });
  it('sin candidato 63 mm en la categoría → conserva el modelo actual', () => {
    expect(modeloPorAncho([roller38], 'ROL', 3.5, roller38, 'BCO')).toBe(roller38);
  });
});

describe('categoriaEsDual', () => {
  it('solo ROL_DUAL es dual; ROL y las dúo-ovaladas no', () => {
    expect(categoriaEsDual('ROL_DUAL')).toBe(true);
    expect(categoriaEsDual('ROL')).toBe(false);
    expect(categoriaEsDual('DUO_MANUAL_38mm')).toBe(false);
    expect(categoriaEsDual('')).toBe(false);
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
  it('OSCURANTI: MEC 10 manual no se pisa (con la lista de resolución)', () => {
    const manual = 'OVALADA BCO [MEC 10]';
    expect(
      mecanismoParaPano(
        { mecanismo: manual },
        '',
        null,
        OPCIONES_MECANISMO_RESOLUCION,
        'OSCURANTI_63mm',
      ),
    ).toBe(manual);
  });

  it('chip legacy guardado sin color (OT vieja) sigue resolviendo tras la limpieza de la UI', () => {
    // Sin color de accesorios ni regla de categoría: el guardado legacy se
    // conserva porque la lista de RESOLUCIÓN aún lo conoce.
    const legacy = 'LZ50 SFLX BCO [MEC 14]';
    expect(
      mecanismoParaPano({ mecanismo: legacy }, '', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL'),
    ).toBe(legacy);
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

describe('regla de mecanismo por ancho (roller >3 m → MEC 28)', () => {
  const CHIP28 = '0,63mm BCO [MEC 28]';
  it('MEC 28 puesto por ancho NO es revertido por la sincronización (>3 m)', () => {
    expect(
      mecanismoParaPano({ mecanismo: CHIP28 }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 3.5),
    ).toBe(CHIP28);
  });
  it('kit por color guardado en cortina >3 m → MEC 28', () => {
    expect(
      mecanismoParaPano({ mecanismo: 'KIT SIMPLE BLANCO 38MM [MEC 33]' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 3.5),
    ).toContain('[MEC 28]');
  });
  it('al bajar de 3 m vuelve al kit por color', () => {
    expect(
      mecanismoParaPano({ mecanismo: CHIP28 }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5),
    ).toContain('[MEC 33]');
  });
});

describe('mecanismos duales', () => {
  it('esChipDual reconoce los 8 chips duales y rechaza kits/legacy', () => {
    expect(esChipDual('DUAL DERECHO BLANCO [MEC 01]')).toBe(true);
    expect(esChipDual('DUAL IZQUIERDO GRIS [MEC 25]')).toBe(true);
    expect(esChipDual('KIT SIMPLE BLANCO 38MM [MEC 33]')).toBe(false);
    expect(esChipDual('0,63mm BCO [MEC 28]')).toBe(false);
  });

  it('chipMecanismoPorNumero encuentra el chip cero-padded [MEC 01]', () => {
    expect(chipMecanismoPorNumero(1, OPCIONES_MECANISMO_DUAL)).toBe('DUAL DERECHO BLANCO [MEC 01]');
  });

  it('chipDualPorLadoColor: tabla lado×color; MIXTO+GRS degrada a DERECHO; sin color → null', () => {
    expect(chipDualPorLadoColor('DERECHO', 'BCO', OPCIONES_MECANISMO_DUAL)).toBe('DUAL DERECHO BLANCO [MEC 01]');
    expect(chipDualPorLadoColor('IZQUIERDO', 'NEG', OPCIONES_MECANISMO_DUAL)).toBe('DUAL IZQUIERDO NEGRO [MEC 04]');
    expect(chipDualPorLadoColor('MIXTO', 'GRS', OPCIONES_MECANISMO_DUAL)).toBe('DUAL DERECHO GRIS [MEC 24]');
    expect(chipDualPorLadoColor('DERECHO', 'MET', OPCIONES_MECANISMO_DUAL)).toBeNull();
  });

  it('ladoColorDesdeChipDual deriva lado + color del chip', () => {
    expect(ladoColorDesdeChipDual('DUAL MIXTO NEGRO [MEC 20]')).toEqual({ lado: 'MIXTO', dualColor: 'NEG' });
    expect(ladoColorDesdeChipDual('KIT SIMPLE BLANCO 38MM [MEC 33]')).toBeNull();
  });

  it('mecanismoParaPano dual: conserva chip dual guardado; lo deriva del lado/color; dual=false lo reemplaza', () => {
    // Conserva el chip dual ya elegido.
    expect(
      mecanismoParaPano({ dual: true, mecanismo: 'DUAL IZQUIERDO NEGRO [MEC 04]' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL'),
    ).toBe('DUAL IZQUIERDO NEGRO [MEC 04]');
    // OT vieja dual sin chip: deriva de dualLado + color.
    expect(
      mecanismoParaPano({ dual: true, dualLado: 'DERECHO', mecanismo: '' }, 'GRS', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL'),
    ).toBe('DUAL DERECHO GRIS [MEC 24]');
    // Con dual=false, un chip dual guardado se reemplaza por el kit por color.
    expect(
      mecanismoParaPano({ dual: false, mecanismo: 'DUAL DERECHO BLANCO [MEC 01]' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL'),
    ).toContain('[MEC 33]');
  });

  it('modeloDesdeChipMecanismo encuentra el modelo ROLLER_DUAL cero-padded', () => {
    const dual = m('MEC_01_DUAL_DERECHO_BLANCO');
    expect(modeloDesdeChipMecanismo([dual], 'DUAL DERECHO BLANCO [MEC 01]')?.mecanismo).toBe('MEC_01_DUAL_DERECHO_BLANCO');
  });
});
