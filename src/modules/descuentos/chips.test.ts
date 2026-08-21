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
  kitPorTuboElegido,
  ladoColorDesdeChipDual,
  mecanismoParaPano,
  modeloDesdeChipMecanismo,
  modeloPorAncho,
  modeloVentanaPorAncho,
  numeroMecPorColor,
  opcionesMecanismoFiltradas,
  resincronizarChipsPanos,
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
import { REGLAS_MECANISMO } from './reglas-mecanismo';
import { REGLAS_TUBERIA, tuboPorReglaEs45, type ReglasTuberia } from './reglas-tuberia';
import { REGLAS_SELECCION_DEFAULT, type ReglasSeleccion } from './reglasSeleccion';

const m = (mecanismo: string, diametro = 38): ModeloDespiece => ({
  sistema: 'ROLLER_SIMPLE', tipo_rol: 'ROL_SIMPLE', mecanismo,
  codigos_tubo: 'E01; E02', diametro_tubo_mm: diametro,
  dcto_tubo_cm: 3.8, dcto_tela_cm: 0.5, suma_peso_cm: 0.1,
  dcto_cenefa_cm: 0, dcto_cenefa_del_cm: 0, dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0, peso_interno_duo_cm: 0, peso_u_duo_cm: 0,
  ancho_max_m: 2.6, activo: true, notas: '',
});

describe('mecanismoParaPano — kit reforzado MEC 40/41 (#18)', () => {
  const chip40 = 'KIT REFORZADO NEGRO 38MM [MEC 40]';
  it('un MEC 40 guardado en ROL se CONSERVA (es kit de inventario, no legacy)', () => {
    const out = mecanismoParaPano(
      { mecanismo: chip40, color: 'NEG' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 1.5,
    );
    expect(out).toBe(chip40);
  });
  it('sobre 3 m la regla de ancho lo reemplaza por MEC 28', () => {
    const out = mecanismoParaPano(
      { mecanismo: chip40, color: 'NEG' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 3.5,
    );
    expect(out).toContain('[MEC 28]');
  });
});

// El kit debe seguir al color de accesorios igual que la cadena (que conserva
// el largo y cambia el color): acá se conserva la FAMILIA — un reforzado no
// baja a simple. Antes de este fix, un kit de inventario guardado se quedaba
// con el color viejo hasta que alguien tocara el chip a mano.
describe('mecanismoParaPano — el kit sigue al color de accesorios', () => {
  const SIMPLE_BCO = 'KIT SIMPLE BLANCO 38MM [MEC 33]';
  const REFORZADO_BCO = 'KIT REFORZADO BLANCO 38MM [MEC 41]';
  const kit = (p: Parameters<typeof mecanismoParaPano>[0], color: string, categoria = 'ROL') =>
    mecanismoParaPano(p, color, null, OPCIONES_MECANISMO_RESOLUCION, categoria, 1.5);

  it('kit simple blanco + color NEG → kit simple negro', () => {
    expect(kit({ mecanismo: SIMPLE_BCO }, 'NEG')).toContain('[MEC 32]');
  });

  it('el color del PAÑO manda sobre el de la ventana', () => {
    expect(kit({ mecanismo: SIMPLE_BCO, colorMecanismo: 'GRS' }, 'BCO')).toContain('[MEC 34]');
  });

  it('mismo color: devuelve el chip guardado sin cambios', () => {
    expect(kit({ mecanismo: SIMPLE_BCO }, 'BCO')).toBe(SIMPLE_BCO);
  });

  it('kit REFORZADO blanco + NEG → reforzado negro (no baja al simple)', () => {
    expect(kit({ mecanismo: REFORZADO_BCO }, 'NEG')).toContain('[MEC 40]');
  });

  it('reforzado + GRS: no hay reforzado gris, se conserva el guardado', () => {
    expect(kit({ mecanismo: REFORZADO_BCO }, 'GRS')).toBe(REFORZADO_BCO);
  });

  it('color sin kit de bodega (MET): conserva el guardado', () => {
    expect(kit({ mecanismo: SIMPLE_BCO }, 'MET')).toBe(SIMPLE_BCO);
  });

  it('el recolor no pisa las reglas: la de oscuranti sigue fijando MEC 28', () => {
    // Y el soft light ovalado sigue yendo a su kit ovalada, no al simple.
    expect(kit({ mecanismo: SIMPLE_BCO }, 'NEG', 'OSCURANTI_63mm')).toContain('[MEC 28]');
    expect(kit({ mecanismo: SIMPLE_BCO }, 'NEG', 'SOFT_LIGHT_38mm')).toContain('[MEC 38]');
  });

  it('DARK 38 mm (sin regla de categoría) con kit blanco + NEG → MEC 32', () => {
    // El caso reportado desde Fase 2: el botón de color cambiaba la cadena pero
    // el kit se quedaba en «KIT SIMPLE BLANCO» con los accesorios en negro.
    expect(kit({ mecanismo: SIMPLE_BCO }, 'NEG', 'DARK_38mm')).toContain('[MEC 32]');
  });

  it('el kit 45 mm fuera de banda (elección manual) NO se recolorea', () => {
    // 18/23 no son familia de color: dentro de la banda los mueve la regla por
    // ancho; fuera de ella son manuales y se respetan.
    const manual45 = '0,45mm BCO [MEC 18]';
    expect(kit({ mecanismo: manual45 }, 'GRS')).toBe(manual45);
  });

  it('dentro de la banda 2,2–3,0 m manda la regla por ancho, no el recolor', () => {
    expect(
      mecanismoParaPano(
        { mecanismo: SIMPLE_BCO }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5, true,
      ),
    ).toContain('[MEC 23]');
  });

  it('«NEGROS» / «BLANCAS» tecleados en Fase 1 cuentan como el color (2026-08-21)', () => {
    // La vendedora escribe el color en plural en la grilla y la cortina salía
    // con el kit blanco por defecto: ninguna regla reconocía «NEGROS».
    expect(kit({}, 'NEGROS')).toContain('[MEC 32]');
    expect(kit({ mecanismo: SIMPLE_BCO }, 'negros')).toContain('[MEC 32]');
    expect(kit({ mecanismo: REFORZADO_BCO }, 'NEGRAS')).toContain('[MEC 40]');
    expect(kit({}, 'BLANCAS')).toBe(SIMPLE_BCO);
    expect(kit({}, 'GRISES')).toContain('[MEC 34]');
  });
});

describe('modeloPorAncho — soft light 38 mm banda E78', () => {
  const soft = (variante: string, diam: 38 | 45): ModeloDespiece => ({
    ...m('', diam),
    sistema: 'SOFT_LIGHT',
    tipo_rol: `SOFT_LIGHT_${variante}_${diam}mm`,
    codigos_tubo: diam === 45 ? 'E04; E05; E78' : 'E01; E02; E66',
  });
  const catalogo = [soft('INTERNO', 38), soft('INTERNO', 45), soft('EXTERNO', 38), soft('EXTERNO', 45)];
  const base38 = soft('EXTERNO', 38);

  it('en banda 2,2–3,0 m con toggle E78 sube al 45 mm del mismo variante', () => {
    const out = modeloPorAncho(catalogo, 'SOFT_LIGHT_38mm', 2.5, base38, 'BLANCO', true);
    expect(out?.diametro_tubo_mm).toBe(45);
    expect(out?.tipo_rol).toBe('SOFT_LIGHT_EXTERNO_45mm');
  });

  it('el borde superior 3,0 m entra; 2,2 m NO (banda estricta como roller)', () => {
    expect(modeloPorAncho(catalogo, 'SOFT_LIGHT_38mm', 3.0, base38, 'BLANCO', true)?.diametro_tubo_mm).toBe(45);
    expect(modeloPorAncho(catalogo, 'SOFT_LIGHT_38mm', 2.2, base38, 'BLANCO', true)?.diametro_tubo_mm).toBe(38);
  });

  it('sin toggle E78 se queda en 38 mm', () => {
    expect(modeloPorAncho(catalogo, 'SOFT_LIGHT_38mm', 2.5, base38, 'BLANCO', false)?.diametro_tubo_mm).toBe(38);
  });

  it('fuera de banda (>3 m) se queda en 38 mm aunque el toggle esté activo', () => {
    expect(modeloPorAncho(catalogo, 'SOFT_LIGHT_38mm', 3.2, base38, 'BLANCO', true)?.diametro_tubo_mm).toBe(38);
  });

  it('al bajar de banda revierte un modelo 45 mm a 38 mm', () => {
    const out = modeloPorAncho(catalogo, 'SOFT_LIGHT_38mm', 1.8, soft('EXTERNO', 45), 'BLANCO', true);
    expect(out?.diametro_tubo_mm).toBe(38);
    expect(out?.tipo_rol).toBe('SOFT_LIGHT_EXTERNO_38mm');
  });
});

describe('modeloPorAncho — DARK 38 mm banda E78 (mismo mecanismo que soft light)', () => {
  const dark = (variante: string, diam: 38 | 45): ModeloDespiece => ({
    ...m('', diam),
    sistema: 'DARK_ROLLER',
    tipo_rol: `DARK_${variante}_${diam}mm`,
    codigos_tubo: diam === 45 ? 'E04; E05; E78' : 'E01; E02; E66',
  });
  const catalogo = [dark('INTERNO', 38), dark('INTERNO', 45), dark('EXTERNO', 38), dark('EXTERNO', 45)];
  const base38 = dark('EXTERNO', 38);

  it('en banda 2,2–3,0 m con toggle E78 sube al 45 mm del mismo variante', () => {
    const out = modeloPorAncho(catalogo, 'DARK_38mm', 2.5, base38, 'NEGRO', true);
    expect(out?.diametro_tubo_mm).toBe(45);
    expect(out?.tipo_rol).toBe('DARK_EXTERNO_45mm');
  });

  it('el borde superior 3,0 m entra; 2,2 m NO', () => {
    expect(modeloPorAncho(catalogo, 'DARK_38mm', 3.0, base38, 'NEGRO', true)?.diametro_tubo_mm).toBe(45);
    expect(modeloPorAncho(catalogo, 'DARK_38mm', 2.2, base38, 'NEGRO', true)?.diametro_tubo_mm).toBe(38);
  });

  it('sin toggle E78 se queda en 38 mm', () => {
    expect(modeloPorAncho(catalogo, 'DARK_38mm', 2.5, base38, 'NEGRO', false)?.diametro_tubo_mm).toBe(38);
  });

  it('fuera de banda (>3 m) se queda en 38 mm aunque el toggle esté activo', () => {
    expect(modeloPorAncho(catalogo, 'DARK_38mm', 3.2, base38, 'NEGRO', true)?.diametro_tubo_mm).toBe(38);
  });

  it('al bajar de banda revierte un modelo 45 mm a 38 mm', () => {
    const out = modeloPorAncho(catalogo, 'DARK_38mm', 1.8, dark('EXTERNO', 45), 'NEGRO', true);
    expect(out?.diametro_tubo_mm).toBe(38);
    expect(out?.tipo_rol).toBe('DARK_EXTERNO_38mm');
  });
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

  it('VERTICAL no resuelve mecanismo aunque ahora tenga modelo (sin kit de bodega)', () => {
    expect(
      mecanismoParaPano({}, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'VERTICAL', 1.5),
    ).toBe('');
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

describe('mecanismoParaPano — soft light CC usa kit simple (como DARK)', () => {
  it('SOFT_LIGHT_38mm + cenefa Cuadrada + BCO → kit simple MEC 33 (NO ovalada MEC 39)', () => {
    const mec = mecanismoParaPano(
      { colorPeso: 'BCO', mecanismo: '', cenefa: 'Cuadrada a muro' },
      'Blanco',
      null,
      OPCIONES_MECANISMO,
      'SOFT_LIGHT_38mm',
    );
    expect(mec).toContain('[MEC 33]');
    expect(mec).not.toContain('[MEC 39]');
  });

  it('SOFT_LIGHT_38mm + cenefa Cuadrada + NEG → kit simple MEC 32', () => {
    expect(
      mecanismoParaPano(
        { colorMecanismo: 'NEG', mecanismo: '', cenefa: 'Cuadrada a techo' },
        '',
        null,
        OPCIONES_MECANISMO,
        'SOFT_LIGHT_38mm',
      ),
    ).toContain('[MEC 32]');
  });

  it('SOFT_LIGHT_38mm con cenefa OVALADA conserva el kit ovalada MEC 39 (regresión)', () => {
    expect(
      mecanismoParaPano(
        { colorPeso: 'BCO', mecanismo: '', cenefa: 'Ovalada' },
        'Blanco',
        null,
        OPCIONES_MECANISMO,
        'SOFT_LIGHT_38mm',
      ),
    ).toContain('[MEC 39]');
  });
});

// El DARK sobre tubería 0,45 usa el kit COMPLETO de 45 mm y nada de la armadura
// de cenefa ovalada (regla del usuario 2026-07-31).
describe('mecanismoParaPano — DARK 0,45 usa el kit 45 completo', () => {
  const modelo45 = { diametro_tubo_mm: 45 } as never;
  const dark45 = (color: string, mecanismo = '') =>
    mecanismoParaPano({ colorMecanismo: color, mecanismo }, '', modelo45, OPCIONES_MECANISMO, 'DARK_45mm');

  it('blanco → MEC 18 · negro → MEC 23', () => {
    expect(dark45('BCO')).toContain('[MEC 18]');
    expect(dark45('NEG')).toContain('[MEC 23]');
  });

  it('café y gris caen al kit negro (no hay kit 45 de esos colores)', () => {
    expect(dark45('CAFÉ')).toContain('[MEC 23]');
    expect(dark45('GRS')).toContain('[MEC 23]');
  });

  it('NO usa el kit simple de 38 ni el ovalada', () => {
    const mec = dark45('NEG');
    expect(mec).not.toContain('[MEC 32]');
    expect(mec).not.toContain('[MEC 38]');
  });

  it('corrige una OT guardada con el kit simple, pero respeta otra elección', () => {
    // MEC 32 es kit de inventario: lo pisa el que corresponde al diámetro.
    expect(dark45('NEG', 'KIT SIMPLE NEGRO 38MM [MEC 32]')).toContain('[MEC 23]');
    // Un chip fuera de los kits de inventario se respeta.
    expect(dark45('NEG', 'OVALADA NEGRO [MEC 38]')).toContain('[MEC 38]');
  });

  it('el DARK de 38 mm conserva el kit simple por color', () => {
    const mec = mecanismoParaPano(
      { colorMecanismo: 'NEG', mecanismo: '' },
      '',
      { diametro_tubo_mm: 38 } as never,
      OPCIONES_MECANISMO,
      'DARK_38mm',
    );
    expect(mec).toContain('[MEC 32]');
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
  it('al bajar de 3 m con flag E78 cae en la banda 2,2–3,0 → kit 45 (MEC 18)', () => {
    expect(
      mecanismoParaPano({ mecanismo: CHIP28 }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5, true),
    ).toContain('[MEC 18]');
  });
  it('al bajar de 3 m SIN flag E78 (default): la banda no aplica → kit por color (MEC 33)', () => {
    expect(
      mecanismoParaPano({ mecanismo: CHIP28 }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5),
    ).toContain('[MEC 33]');
  });
  it('al bajar de 2,2 m vuelve al kit por color', () => {
    expect(
      mecanismoParaPano({ mecanismo: CHIP28 }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.0),
    ).toContain('[MEC 33]');
  });
});

describe('banda 2,2–3,0 m → kit 45 mm + tubo E78 (flag usarTuboE78, 7º arg)', () => {
  it('ROL CON flag: blanco → MEC 18; negro → MEC 23; en la banda', () => {
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5, true),
    ).toContain('[MEC 18]');
    expect(
      mecanismoParaPano({ mecanismo: 'KIT SIMPLE NEGRO 38MM [MEC 32]' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5, true),
    ).toContain('[MEC 23]');
  });
  it('ROL SIN flag (default): la banda no aplica → kit por color 38 (MEC 33/32)', () => {
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5),
    ).toContain('[MEC 33]');
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5),
    ).toContain('[MEC 32]');
  });
  it('ROL gris: la banda NO fuerza nada (elección manual); sigue el kit 38 gris', () => {
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'GRS', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5, true),
    ).toContain('[MEC 34]');
  });
  it('ROL gris: un kit 45 elegido a mano se CONSERVA en la sincronización', () => {
    const manual45 = '0,45mm BCO [MEC 18]';
    expect(
      mecanismoParaPano({ mecanismo: manual45 }, 'GRS', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5, true),
    ).toBe(manual45);
    // Incluso fuera de la banda (fue elección manual, no automática).
    expect(
      mecanismoParaPano({ mecanismo: manual45 }, 'GRS', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 1.5, true),
    ).toBe(manual45);
  });
  it('ROL blanco: el kit 45 puesto por la banda VUELVE al kit color bajo 2,2 m', () => {
    expect(
      mecanismoParaPano({ mecanismo: '0,45mm BCO [MEC 18]' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.0, true),
    ).toContain('[MEC 33]');
  });
  it('guarda de coherencia: MEC 18 + modelo 45 mm + flag OFF → conserva MEC 18 (BOM coherente)', () => {
    // Una OT con E78 planificado (modelo 45) que aún NO se re-guardó con el flag
    // apagado: el kit NO debe bajar mientras el modelo siga en 45 (trío coherente).
    const rol45 = m('MEC_18_045_DECORELLI_BLANCO', 45);
    expect(
      mecanismoParaPano({ mecanismo: '0,45mm BCO [MEC 18]' }, 'BCO', rol45, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5, false),
    ).toContain('[MEC 18]');
    // Con el modelo ya revertido a 38, sí baja al kit por color.
    const rol38 = m('MEC_07_ROLLER_BLANCO', 38);
    expect(
      mecanismoParaPano({ mecanismo: '0,45mm BCO [MEC 18]' }, 'BCO', rol38, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.5, false),
    ).toContain('[MEC 33]');
  });
  it('fronteras (flag ON): 2,2 exacto NO entra; 3,0 exacto SÍ; >3,0 pasa a MEC 28', () => {
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 2.2, true),
    ).toContain('[MEC 33]');
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 3.0, true),
    ).toContain('[MEC 18]');
    // >3 m (MEC 28) es estructural: no depende del flag.
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL', 3.01),
    ).toContain('[MEC 28]');
  });
  it('DUO_MANUAL_38mm en banda CON flag: kit ovalada de bodega por color (mismo que en 38 mm)', () => {
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'DUO_MANUAL_38mm', 2.5, true),
    ).toContain('[MEC 38]');
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'GRS', null, OPCIONES_MECANISMO_RESOLUCION, 'DUO_MANUAL_38mm', 2.5, true),
    ).toContain('[MEC 12]');
    // Una OT guardada con el chip viejo de banda (MEC 23) migra al kit ovalada.
    expect(
      mecanismoParaPano({ mecanismo: '0,45mm NGR [MEC 23]' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'DUO_MANUAL_38mm', 2.5, true),
    ).toContain('[MEC 38]');
    // Bajo la banda sigue la regla de categoría (kit ovalada 38 por color).
    expect(
      mecanismoParaPano({ mecanismo: '0,45mm NGR [MEC 23]' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'DUO_MANUAL_38mm', 1.5, true),
    ).toContain('[MEC 38]');
  });
  it('cenefa ovalada roller 38 mm en banda CON flag: kit ovalada por color (39/38); gris no sube', () => {
    // El kit ovalada 38 mostrado es igual que en 38 mm (reglaCategoria da lo mismo);
    // lo que cambia con el flag es que el MODELO/tubo cruza a 45 mm/E78 (ver
    // modeloPorAncho). Aquí validamos que la banda no rompe el kit por color.
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, true),
    ).toContain('[MEC 39]');
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, true),
    ).toContain('[MEC 38]');
    // Gris: la banda no aplica → kit ovalada gris 12 (queda en 38 mm/E66).
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'GRS', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, true),
    ).toContain('[MEC 12]');
  });
});

describe('cenefa ovalada 45 mm (E78): mismo kit ovalada de bodega que el 38 mm', () => {
  // 2026-07-15: las categorías 45 mm dejaron de caer al kit simple 32/33/34.
  it('ROL_MANUAL_CENEFA_OVALADA_45mm → 39 blanco / 38 negro / 12 gris', () => {
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL_MANUAL_CENEFA_OVALADA_45mm', 2.0),
    ).toContain('[MEC 39]');
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL_MANUAL_CENEFA_OVALADA_45mm', 2.0),
    ).toContain('[MEC 38]');
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'GRS', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL_MANUAL_CENEFA_OVALADA_45mm', 2.0),
    ).toContain('[MEC 12]');
  });
  it('DUO_MANUAL_45mm → 39 blanco / 38 negro / 12 gris', () => {
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'DUO_MANUAL_45mm', 2.0),
    ).toContain('[MEC 39]');
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'DUO_MANUAL_45mm', 2.0),
    ).toContain('[MEC 38]');
  });
  it('un kit simple guardado (MEC 33) en una ovalada 45 migra al kit ovalada', () => {
    expect(
      mecanismoParaPano({ mecanismo: 'KIT SIMPLE BLANCO 38MM [MEC 33]' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL_MANUAL_CENEFA_OVALADA_45mm', 2.0),
    ).toContain('[MEC 39]');
  });
});

describe('modeloPorAncho — banda 2,2–3,0 m (kit 45 / E78)', () => {
  const rol38 = m('MEC_07_ROLLER_BLANCO', 38);
  const rol45b = m('MEC_18_045_DECORELLI_BLANCO', 45);
  const rol45n = m('MEC_23_045_ROLZZO_NEGRO', 45);
  const rol63 = m('MEC_28_63mm_BLANCO_DER_IZQ', 63);
  const modelosRol = [rol38, rol45b, rol45n, rol63];

  const duo38 = (mec: string): ModeloDespiece => ({
    ...m(mec, 38), sistema: 'CENEFA_OVALADA_DUO', tipo_rol: 'DUO_CENEFA_OV_MANUAL_38mm',
  });
  const duo45 = (mec: string): ModeloDespiece => ({
    ...m(mec, 45), sistema: 'CENEFA_OVALADA_DUO', tipo_rol: 'DUO_CENEFA_OV_MANUAL_45mm',
  });
  const modelosDuo = [
    duo38('MEC_09_OVALADA_NEGRO'), duo38('MEC_10_OVALADA_BLANCO'),
    duo45('MEC_18_OVALADA_BLANCO'), duo45('MEC_18_OVALADA_GRIS'), duo45('MEC_23_OVALADA_NEGRO'),
  ];

  // Cenefa ovalada roller: filas reales del catálogo (MEC_10 blanco / MEC_09
  // negro / MEC_12 gris, tanto 38 como 45). La banda cruza _38mm → _45mm.
  const ovRol = (mec: string, diam: number): ModeloDespiece => ({
    ...m(mec, diam), sistema: 'CENEFA_OVALADA',
    tipo_rol: diam === 45 ? 'ROL_CENEFA_OV_MANUAL_45mm' : 'ROL_CENEFA_OV_MANUAL_38mm',
  });
  const modelosOvRol = [
    ovRol('MEC_10_OVALADA_BLANCO', 38), ovRol('MEC_09_OVALADA_NEGRO', 38), ovRol('MEC_12_OVALADA_GRIS', 38),
    ovRol('MEC_10_OVALADA_BLANCO', 45), ovRol('MEC_09_OVALADA_NEGRO', 45), ovRol('MEC_12_OVALADA_GRIS', 45),
  ];

  it('ROL 2,5 m CON flag: blanco → DECORELLI 45; negro → ROLZZO 45', () => {
    expect(modeloPorAncho(modelosRol, 'ROL', 2.5, rol38, 'BCO', true)?.mecanismo).toBe('MEC_18_045_DECORELLI_BLANCO');
    expect(modeloPorAncho(modelosRol, 'ROL', 2.5, rol38, 'NEG', true)?.mecanismo).toBe('MEC_23_045_ROLZZO_NEGRO');
  });
  it('ROL 2,5 m SIN flag (default): no cruza, conserva el modelo 38', () => {
    expect(modeloPorAncho(modelosRol, 'ROL', 2.5, rol38, 'BCO')).toBe(rol38);
    expect(modeloPorAncho(modelosRol, 'ROL', 2.5, rol38, 'NEG')).toBe(rol38);
  });
  it('ROL 2,5 m gris CON flag → sin regla: conserva el modelo actual', () => {
    expect(modeloPorAncho(modelosRol, 'ROL', 2.5, rol38, 'GRS', true)).toBe(rol38);
  });
  it('ROL que baja de 2,2 m revierte el 45 de banda al 38 por color', () => {
    expect(modeloPorAncho(modelosRol, 'ROL', 2.0, rol45b, 'BCO')?.mecanismo).toBe('MEC_07_ROLLER_BLANCO');
  });
  it('ROL blanco: apagar el flag revierte el 45 de banda al 38 (dentro del rango)', () => {
    expect(modeloPorAncho(modelosRol, 'ROL', 2.5, rol45b, 'BCO', false)?.mecanismo).toBe('MEC_07_ROLLER_BLANCO');
  });
  it('ROL gris con 45 manual NO se revierte al bajar el ancho', () => {
    expect(modeloPorAncho(modelosRol, 'ROL', 2.0, rol45b, 'GRS')).toBe(rol45b);
  });
  it('DUO_MANUAL_38mm 2,5 m CON flag: cruza al catálogo 45 y desambigua MEC 18 por color', () => {
    expect(modeloPorAncho(modelosDuo, 'DUO_MANUAL_38mm', 2.5, modelosDuo[0], 'GRS', true)?.mecanismo).toBe('MEC_18_OVALADA_GRIS');
    expect(modeloPorAncho(modelosDuo, 'DUO_MANUAL_38mm', 2.5, modelosDuo[0], 'BCO', true)?.mecanismo).toBe('MEC_18_OVALADA_BLANCO');
    expect(modeloPorAncho(modelosDuo, 'DUO_MANUAL_38mm', 2.5, modelosDuo[0], 'NEG', true)?.mecanismo).toBe('MEC_23_OVALADA_NEGRO');
  });
  it('DUO que baja de 2,2 m vuelve a su fila MANUAL_38 por color', () => {
    const en45 = duo45('MEC_23_OVALADA_NEGRO');
    expect(modeloPorAncho(modelosDuo, 'DUO_MANUAL_38mm', 1.5, en45, 'NEG')?.mecanismo).toBe('MEC_09_OVALADA_NEGRO');
  });
  it('cenefa ovalada roller 38 mm 2,5 m CON flag: cruza a la fila 45 (MEC_10/09); gris no cruza', () => {
    const ov38b = modelosOvRol[0];
    expect(modeloPorAncho(modelosOvRol, 'ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, ov38b, 'BCO', true))
      .toMatchObject({ mecanismo: 'MEC_10_OVALADA_BLANCO', diametro_tubo_mm: 45 });
    expect(modeloPorAncho(modelosOvRol, 'ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, ov38b, 'NEG', true))
      .toMatchObject({ mecanismo: 'MEC_09_OVALADA_NEGRO', diametro_tubo_mm: 45 });
    // Gris no tiene regla de banda → conserva el modelo 38.
    const ov38g = modelosOvRol[2];
    expect(modeloPorAncho(modelosOvRol, 'ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, ov38g, 'GRS', true)?.diametro_tubo_mm).toBe(38);
    // Sin flag (default): blanco tampoco cruza.
    expect(modeloPorAncho(modelosOvRol, 'ROL_MANUAL_CENEFA_OVALADA_38mm', 2.5, ov38b, 'BCO')?.diametro_tubo_mm).toBe(38);
  });

  // Modelo de ventana NUEVA (Fase 0 al importar/guardar): color + regla por ancho
  // en un solo paso. Regresión del bug "el Excel de órdenes salía en E66": sin
  // esto la cortina importada nacía en 38 mm y solo se corregía al abrirla en Fase 2.
  describe('modeloVentanaPorAncho — banda aplicada al crear la ventana', () => {
    it('ROL en banda CON flag: blanco → DECORELLI 45; negro → ROLZZO 45', () => {
      expect(modeloVentanaPorAncho(modelosRol, 'ROL', 'BCO', 2.5, true)).toBe(rol45b);
      expect(modeloVentanaPorAncho(modelosRol, 'ROL', 'NEG', 2.8, true)).toBe(rol45n);
      expect(modeloVentanaPorAncho(modelosRol, 'ROL', 'BCO', 3.0, true)?.diametro_tubo_mm).toBe(45);
    });
    it('ROL en banda SIN flag (default): se queda en 38 mm', () => {
      expect(modeloVentanaPorAncho(modelosRol, 'ROL', 'BCO', 2.5)?.diametro_tubo_mm).toBe(38);
      expect(modeloVentanaPorAncho(modelosRol, 'ROL', 'NEG', 2.8)?.diametro_tubo_mm).toBe(38);
    });
    it('ROL fuera de banda: 2,2 m exacto → 38 mm; >3 m → 63 mm (sin flag)', () => {
      expect(modeloVentanaPorAncho(modelosRol, 'ROL', 'BCO', 2.2)?.diametro_tubo_mm).toBe(38);
      expect(modeloVentanaPorAncho(modelosRol, 'ROL', 'BCO', 3.5)).toBe(rol63);
    });
    it('DUO_MANUAL_38mm en banda CON flag: cruza al catálogo 45 por color', () => {
      expect(modeloVentanaPorAncho(modelosDuo, 'DUO_MANUAL_38mm', 'BCO', 2.5, true)?.mecanismo).toBe('MEC_18_OVALADA_BLANCO');
      expect(modeloVentanaPorAncho(modelosDuo, 'DUO_MANUAL_38mm', 'NEG', 2.6, true)?.mecanismo).toBe('MEC_23_OVALADA_NEGRO');
    });
  });
});

describe('resincronizarChipsPanos — recálculo de chips al re-guardar (Fase 0)', () => {
  it('modelo 38 + flag OFF: baja MEC 18 → kit color 33 y fija tubo E66 (>2,2 m)', () => {
    const rol38 = m('MEC_07_ROLLER_BLANCO', 38);
    const panos: Record<string, unknown>[] = [
      { ancho: 2.5, color: 'BCO', mecanismo: '0,45mm BCO [MEC 18]', tuberia: '' },
    ];
    resincronizarChipsPanos(panos, 'BCO', rol38, 'ROL', OPCIONES_MECANISMO_RESOLUCION, OPCIONES_TUBERIA, false);
    expect(String(panos[0].mecanismo)).toContain('[MEC 33]');
    expect(codigoTuberiaDeChip(String(panos[0].tuberia))).toBe('E66');
  });
  it('modelo 45 + flag ON: fija kit 45 (MEC 18) y tubo E78', () => {
    const rol45 = m('MEC_18_045_DECORELLI_BLANCO', 45);
    const panos: Record<string, unknown>[] = [{ ancho: 2.5, color: 'BCO', mecanismo: '', tuberia: '' }];
    resincronizarChipsPanos(panos, 'BCO', rol45, 'ROL', OPCIONES_MECANISMO_RESOLUCION, OPCIONES_TUBERIA, true);
    expect(String(panos[0].mecanismo)).toContain('[MEC 18]');
    expect(codigoTuberiaDeChip(String(panos[0].tuberia))).toBe('E39');
  });
  it('paño dual del mismo color: no toca sus chips ni la tubería', () => {
    const dualPano: Record<string, unknown> = {
      ancho: 2.5, color: 'BCO', dual: true,
      mecanismo: 'DUAL DERECHO BLANCO [MEC 01]', tuberia: 'x',
    };
    resincronizarChipsPanos(
      [dualPano], 'BCO', m('MEC_18_045_DECORELLI_BLANCO', 45), 'ROL_DUAL',
      OPCIONES_MECANISMO_RESOLUCION, OPCIONES_TUBERIA, true,
    );
    expect(dualPano.mecanismo).toBe('DUAL DERECHO BLANCO [MEC 01]');
    expect(dualPano.tuberia).toBe('x');
  });

  it('cambio de color en Fase 1: el kit sigue al color nuevo', () => {
    const panos: Record<string, unknown>[] = [
      { ancho: 1.5, color: 'NEG', colorMecanismo: 'NEG', mecanismo: 'KIT SIMPLE BLANCO 38MM [MEC 33]', tuberia: '' },
    ];
    resincronizarChipsPanos(panos, 'NEG', m('MEC_07_ROLLER_NEGRO', 38), 'ROL', OPCIONES_MECANISMO_RESOLUCION, OPCIONES_TUBERIA, false);
    expect(String(panos[0].mecanismo)).toContain('[MEC 32]');
  });

  it('cambio de color en un dual: recolorea el chip y sus lado/color derivados', () => {
    const dualPano: Record<string, unknown> = {
      ancho: 2.5, color: 'NEG', colorMecanismo: 'NEG', dual: true,
      mecanismo: 'DUAL IZQUIERDO BLANCO [MEC 02]', dualLado: 'IZQUIERDO', dualColor: 'BCO', tuberia: 'x',
    };
    resincronizarChipsPanos(
      [dualPano], 'NEG', m('MEC_02_DUAL_IZQUIERDO_BLANCO', 38), 'ROL_DUAL',
      OPCIONES_MECANISMO_RESOLUCION, OPCIONES_TUBERIA, false,
    );
    expect(dualPano.mecanismo).toBe('DUAL IZQUIERDO NEGRO [MEC 04]');
    expect(dualPano.dualLado).toBe('IZQUIERDO');
    expect(dualPano.dualColor).toBe('NEG');
    // La tubería del dual sigue sin derivarse del modelo.
    expect(dualPano.tuberia).toBe('x');
  });

  it('dual con paños de distinto color: el kit es UNO por ventana (se espeja del primero)', () => {
    // Un solo bracket dual → un solo chip. Sin el espejado, dos filas con
    // colores distintos dejaban chips duales divergentes en la misma ventana.
    const panos: Record<string, unknown>[] = [
      { ancho: 2.5, dual: true, colorMecanismo: 'NEG', mecanismo: 'DUAL DERECHO BLANCO [MEC 01]' },
      { ancho: 2.5, dual: true, colorMecanismo: 'BCO', mecanismo: 'DUAL DERECHO BLANCO [MEC 01]' },
    ];
    resincronizarChipsPanos(
      panos, 'NEG', m('MEC_01_DUAL_DERECHO_BLANCO', 38), 'ROL_DUAL',
      OPCIONES_MECANISMO_RESOLUCION, OPCIONES_TUBERIA, false,
    );
    expect(panos.map((p) => p.mecanismo)).toEqual([
      'DUAL DERECHO NEGRO [MEC 03]',
      'DUAL DERECHO NEGRO [MEC 03]',
    ]);
    expect(panos.every((p) => p.dualColor === 'NEG')).toBe(true);
  });

  it('ventana ROL_DUAL cuyo paño aún no trae el flag: igual se trata como dual', () => {
    // Pasa con una OT creada en Fase 1 y todavía no abierta en Fase 2 (es Fase 2
    // quien escribe `dual` en el paño). Sin la regla por categoría, acá le
    // habríamos puesto un kit SIMPLE y una tubería.
    const pano: Record<string, unknown> = {
      ancho: 2.5, color: 'NEG', colorMecanismo: 'NEG',
      mecanismo: 'DUAL DERECHO BLANCO [MEC 01]', tuberia: 'x',
    };
    resincronizarChipsPanos(
      [pano], 'NEG', m('MEC_01_DUAL_DERECHO_BLANCO', 38), 'ROL_DUAL',
      OPCIONES_MECANISMO_RESOLUCION, OPCIONES_TUBERIA, false,
    );
    expect(pano.mecanismo).toBe('DUAL DERECHO NEGRO [MEC 03]');
    expect(pano.tuberia).toBe('x');
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

  it('mecanismoParaPano dual: conserva el chip del mismo color; lo deriva del lado/color; dual=false lo reemplaza', () => {
    // Mismo color que el chip guardado: lo conserva tal cual.
    expect(
      mecanismoParaPano({ dual: true, mecanismo: 'DUAL IZQUIERDO NEGRO [MEC 04]' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL'),
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

  it('mecanismoParaPano dual: al cambiar el color recolorea el chip conservando el LADO', () => {
    // El caso del vendedor: OT dual blanca que pasa a negra desde el botón de
    // color de accesorios. Cambia el color, NO el lado.
    expect(
      mecanismoParaPano({ dual: true, mecanismo: 'DUAL IZQUIERDO BLANCO [MEC 02]' }, 'NEG', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL'),
    ).toBe('DUAL IZQUIERDO NEGRO [MEC 04]');
    // El color del PAÑO manda sobre el de la ventana.
    expect(
      mecanismoParaPano({ dual: true, mecanismo: 'DUAL DERECHO BLANCO [MEC 01]', colorMecanismo: 'NEG' }, 'BCO', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL'),
    ).toBe('DUAL DERECHO NEGRO [MEC 03]');
    // MIXTO no existe en gris: cae a DERECHO gris (tabla lado×color).
    expect(
      mecanismoParaPano({ dual: true, mecanismo: 'DUAL MIXTO NEGRO [MEC 20]' }, 'GRS', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL'),
    ).toBe('DUAL DERECHO GRIS [MEC 24]');
    // Color sin chips duales (MET/CAFÉ): conserva el guardado en vez de vaciarlo.
    expect(
      mecanismoParaPano({ dual: true, mecanismo: 'DUAL DERECHO BLANCO [MEC 01]' }, 'MET', null, OPCIONES_MECANISMO_RESOLUCION, 'ROL'),
    ).toBe('DUAL DERECHO BLANCO [MEC 01]');
  });

  it('modeloDesdeChipMecanismo encuentra el modelo ROLLER_DUAL cero-padded', () => {
    const dual = m('MEC_01_DUAL_DERECHO_BLANCO');
    expect(modeloDesdeChipMecanismo([dual], 'DUAL DERECHO BLANCO [MEC 01]')?.mecanismo).toBe('MEC_01_DUAL_DERECHO_BLANCO');
  });
});

describe('el kit sigue al tubo: E39 (Ø45) elegido a mano con el interruptor de la OT apagado (OT 3195, 2026-08-21)', () => {
  const E39 = 'E39 - TUBO .43 - ESP 1.2 (TUBO .45)';
  const E02 = 'E02-TUBO 1.2 / Ø 38 mm';
  const E65 = 'E65 - TUBO 63 mm';
  const SIMPLE_BCO = 'KIT SIMPLE BLANCO 38MM [MEC 33]';
  const K45_BCO = '0,45mm BCO [MEC 18]';
  const rol38 = m('MEC_07_ROLLER_BLANCO', 38);
  const rol45b = m('MEC_18_045_DECORELLI_BLANCO', 45);
  const rol45n = m('MEC_23_045_ROLZZO_NEGRO', 45);
  const modelosRol = [rol38, rol45b, rol45n];
  const OPC = OPCIONES_MECANISMO_RESOLUCION;

  describe('kitPorTuboElegido — lo que cambia al tocar el chip del tubo', () => {
    it('ROL + E39: kit de 45 por color y la cortina queda marcada «45 a mano»', () => {
      expect(kitPorTuboElegido({ mecanismo: SIMPLE_BCO }, 'BCO', 'ROL', E39, OPC)).toEqual({
        mecanismo: K45_BCO, tubo45Manual: true,
      });
      expect(kitPorTuboElegido({ mecanismo: SIMPLE_BCO }, 'NEG', 'ROL', E39, OPC)?.mecanismo).toContain('[MEC 23]');
      // Gris/café: no hay kit 45 de ese color → al negro (como el DARK 45).
      expect(kitPorTuboElegido({ mecanismo: 'KIT SIMPLE GRIS 38MM [MEC 34]' }, 'GRS', 'ROL', E39, OPC)?.mecanismo).toContain('[MEC 23]');
      // Un 45 ya elegido en gris se respeta.
      expect(kitPorTuboElegido({ mecanismo: K45_BCO }, 'GRS', 'ROL', E39, OPC)).toEqual({ mecanismo: null, tubo45Manual: true });
    });
    it('ROL + tubo de 38: desmarca y baja un kit de 45 al kit por color', () => {
      expect(kitPorTuboElegido({ mecanismo: K45_BCO }, 'BCO', 'ROL', E02, OPC)).toEqual({
        mecanismo: SIMPLE_BCO, tubo45Manual: false,
      });
      // Un kit de 38 ya puesto no se toca.
      expect(kitPorTuboElegido({ mecanismo: SIMPLE_BCO }, 'BCO', 'ROL', E02, OPC)).toEqual({ mecanismo: null, tubo45Manual: false });
    });
    it('ROL + tubo de 63: kit de 63 (MEC 28)', () => {
      expect(kitPorTuboElegido({ mecanismo: SIMPLE_BCO }, 'BCO', 'ROL', E65, OPC)?.mecanismo).toContain('[MEC 28]');
    });
    it('ovalada / dúo: el kit ovalada sirve en 38 y 45, solo queda la marca', () => {
      expect(kitPorTuboElegido({ mecanismo: 'KIT OVALADA BLANCO [MEC 39]' }, 'BCO', 'DUO_MANUAL_38mm', E39, OPC)).toEqual({ mecanismo: null, tubo45Manual: true });
      expect(kitPorTuboElegido({ mecanismo: 'KIT OVALADA BLANCO [MEC 39]' }, 'BCO', 'ROL_MANUAL_CENEFA_OVALADA_38mm', E02, OPC)).toEqual({ mecanismo: null, tubo45Manual: false });
    });
    it('no opina: VELCRO/vacío, dual, categoría B, oscuridad, pletina, vertical', () => {
      expect(kitPorTuboElegido({ mecanismo: SIMPLE_BCO }, 'BCO', 'ROL', 'VELCRO', OPC)).toBeNull();
      expect(kitPorTuboElegido({ mecanismo: SIMPLE_BCO }, 'BCO', 'ROL', '', OPC)).toBeNull();
      expect(kitPorTuboElegido({ mecanismo: 'DUAL DERECHO BLANCO [MEC 01]', dual: true }, 'BCO', 'ROL', E39, OPC)).toBeNull();
      expect(kitPorTuboElegido({ mecanismo: SIMPLE_BCO }, 'BCO', 'ROL', E39, OPC, undefined, true)).toBeNull();
      expect(kitPorTuboElegido({ mecanismo: SIMPLE_BCO }, 'BCO', 'DARK_38mm', E39, OPC)).toBeNull();
      expect(kitPorTuboElegido({ mecanismo: '' }, 'BCO', 'VERTICAL', E39, OPC)).toBeNull();
    });
  });

  describe('mecanismoParaPano — con el modelo en 45 mm el roller simple lleva el kit de 45', () => {
    it('modelo 45 + kit de 38 guardado → kit de 45 por color (interruptor apagado)', () => {
      expect(mecanismoParaPano({ mecanismo: SIMPLE_BCO }, 'BCO', rol45b, OPC, 'ROL', 2.47, false)).toContain('[MEC 18]');
      expect(mecanismoParaPano({ mecanismo: SIMPLE_BCO }, 'NEG', rol45n, OPC, 'ROL', 2.47, false)).toContain('[MEC 23]');
      // Y también fuera de la banda: manda el diámetro, no el ancho.
      expect(mecanismoParaPano({ mecanismo: SIMPLE_BCO }, 'BCO', rol45b, OPC, 'ROL', 1.8, false)).toContain('[MEC 18]');
    });
    it('modelo 45 + blanco/negro: el kit 45 se recolorea con el color, como la banda', () => {
      expect(mecanismoParaPano({ mecanismo: K45_BCO }, 'NEG', rol45n, OPC, 'ROL', 2.47, false)).toContain('[MEC 23]');
    });
    it('modelo 45 + gris: un kit 45 elegido se respeta; sin kit 45 cae al negro', () => {
      expect(mecanismoParaPano({ mecanismo: K45_BCO }, 'GRS', rol45b, OPC, 'ROL', 2.47, false)).toBe(K45_BCO);
      expect(mecanismoParaPano({ mecanismo: 'KIT SIMPLE GRIS 38MM [MEC 34]' }, 'GRS', rol45b, OPC, 'ROL', 2.47, false)).toContain('[MEC 23]');
    });
    it('la marca «45 a mano» abre la banda del paño aunque el interruptor esté apagado', () => {
      expect(mecanismoParaPano({ mecanismo: SIMPLE_BCO, tubo45Manual: true }, 'BCO', null, OPC, 'ROL', 2.47, false)).toContain('[MEC 18]');
    });
    it('sin marca ni modelo 45, nada cambia: kit por color 38 (regresión)', () => {
      expect(mecanismoParaPano({ mecanismo: SIMPLE_BCO }, 'BCO', rol38, OPC, 'ROL', 2.47, false)).toBe(SIMPLE_BCO);
    });
  });

  describe('modeloPorAncho — la marca «45 a mano» sube y mantiene la fila de 45', () => {
    it('ROL 2,47 m blanco, interruptor apagado + marca → fila DECORELLI 45', () => {
      expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol38, 'BCO', false, undefined, undefined, false, true)).toBe(rol45b);
      expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol38, 'NEG', false, undefined, undefined, false, true)).toBe(rol45n);
    });
    it('con marca, la fila 45 NO se revierte al apagar el interruptor ni al salir de la banda', () => {
      expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol45b, 'BCO', false, undefined, undefined, false, true)).toBe(rol45b);
      expect(modeloPorAncho(modelosRol, 'ROL', 1.8, rol45b, 'BCO', false, undefined, undefined, false, true)).toBe(rol45b);
    });
    it('sin marca sigue igual que siempre: apagar el interruptor revierte la banda automática', () => {
      expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol45b, 'BCO', false)).toBe(rol38);
      expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol38, 'BCO', false)).toBe(rol38);
    });
  });

  describe('resincronizarChipsPanos — al re-guardar desde Fase 1 el 45 a mano se conserva', () => {
    it('modelo 45 (ya recalculado con la marca) + E39 + MEC 33 guardado → MEC 18 + E39', () => {
      const panos: Array<Record<string, unknown>> = [
        { ancho: 2.47, alto: 2.0, mecanismo: SIMPLE_BCO, tuberia: E39, tubo45Manual: true },
      ];
      resincronizarChipsPanos(panos, 'BCO', rol45b, 'ROL', OPC, OPCIONES_TUBERIA, false);
      expect(panos[0].mecanismo).toContain('[MEC 18]');
      expect(codigoTuberiaDeChip(panos[0].tuberia as string)).toBe('E39');
    });
  });
});

describe('E66 descontinuado → la regla de tubería asigna E39 (Ø45) sobre 2,2 m: fila y kit siguen al tubo (OT 3195, 2026-08-21)', () => {
  // La configuración VIVA desde el SQL 20260820 (la fábrica sigue con E66).
  const reglasTub39: ReglasTuberia = {
    ...REGLAS_TUBERIA,
    reglaE02E66: { ...REGLAS_TUBERIA.reglaE02E66, codigoDesde: 'E39' },
  };
  const reglasSel39: ReglasSeleccion = { ...REGLAS_SELECCION_DEFAULT, tuberia: reglasTub39 };
  const SIMPLE_BCO = 'KIT SIMPLE BLANCO 38MM [MEC 33]';
  const rol38 = m('MEC_07_ROLLER_BLANCO', 38);
  const rol45b = m('MEC_18_045_DECORELLI_BLANCO', 45);
  const rol45n = m('MEC_23_045_ROLZZO_NEGRO', 45);
  const rol63 = m('MEC_28_63mm_BLANCO_DER_IZQ', 63);
  const modelosRol = [rol38, rol45b, rol45n, rol63];
  const OPC = OPCIONES_MECANISMO_RESOLUCION;
  const RM = REGLAS_MECANISMO;

  it('tuboPorReglaEs45: con la regla viva, sobre 2,2 m es Ø45; con la de fábrica (E66) nunca', () => {
    expect(tuboPorReglaEs45(2.47, 'ROL', reglasTub39)).toBe(true);
    expect(tuboPorReglaEs45(2.2, 'ROL', reglasTub39)).toBe(false);
    expect(tuboPorReglaEs45(2.47, 'ROL', REGLAS_TUBERIA)).toBe(false);
    // La categoría con tubo propio (oscuranti → E47) no entra.
    expect(tuboPorReglaEs45(2.47, 'OSCURANTI_63mm', reglasTub39)).toBe(false);
  });

  it('modeloPorAncho: ROL 2,47 m, interruptor apagado → fila de 45 por color (blanco DECORELLI, negro ROLZZO)', () => {
    expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol38, 'BCO', false, RM, undefined, false, false, reglasTub39)).toBe(rol45b);
    expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol38, 'NEG', false, RM, undefined, false, false, reglasTub39)).toBe(rol45n);
    // Gris no tiene fila en la banda: igual es de 45 → la fila del kit 45 negro.
    expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol38, 'GRS', false, RM, undefined, false, false, reglasTub39)).toBe(rol45n);
  });

  it('modeloPorAncho: bajo 2,2 m sigue en 38 y sobre 3 m manda el 63 (estructural)', () => {
    expect(modeloPorAncho(modelosRol, 'ROL', 2.0, rol38, 'BCO', false, RM, undefined, false, false, reglasTub39)).toBe(rol38);
    expect(modeloPorAncho(modelosRol, 'ROL', 2.0, rol45b, 'BCO', false, RM, undefined, false, false, reglasTub39)).toBe(rol38);
    expect(modeloPorAncho(modelosRol, 'ROL', 3.2, rol38, 'BCO', false, RM, undefined, false, false, reglasTub39)).toBe(rol63);
  });

  it('modeloPorAncho: con la regla de fábrica (E66) nada cambia', () => {
    expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol38, 'BCO', false, RM, undefined, false, false, REGLAS_TUBERIA)).toBe(rol38);
    expect(modeloPorAncho(modelosRol, 'ROL', 2.47, rol45b, 'BCO', false, RM, undefined, false, false, REGLAS_TUBERIA)).toBe(rol38);
  });

  it('mecanismoParaPano: ROL 2,47 m con kit de 38 guardado → kit de 45 por color, aunque la fila siga en 38', () => {
    expect(mecanismoParaPano({ mecanismo: SIMPLE_BCO }, 'BCO', rol38, OPC, 'ROL', 2.47, false, reglasSel39)).toContain('[MEC 18]');
    expect(mecanismoParaPano({ mecanismo: SIMPLE_BCO }, 'NEG', rol38, OPC, 'ROL', 2.47, false, reglasSel39)).toContain('[MEC 23]');
    expect(mecanismoParaPano({ mecanismo: 'KIT SIMPLE GRIS 38MM [MEC 34]' }, 'GRS', rol38, OPC, 'ROL', 2.47, false, reglasSel39)).toContain('[MEC 23]');
    // Bajo 2,2 m: kit de 38 por color, como siempre.
    expect(mecanismoParaPano({ mecanismo: SIMPLE_BCO }, 'BCO', rol38, OPC, 'ROL', 2.0, false, reglasSel39)).toBe(SIMPLE_BCO);
    // Con la regla de fábrica (E66) el kit de 38 se queda.
    expect(mecanismoParaPano({ mecanismo: SIMPLE_BCO }, 'BCO', rol38, OPC, 'ROL', 2.47, false)).toBe(SIMPLE_BCO);
  });

  it('la ovalada y el dúo conservan su kit ovalada (sirve en 38 y 45); solo cruza la fila', () => {
    expect(mecanismoParaPano({ mecanismo: '' }, 'BCO', null, OPC, 'ROL_MANUAL_CENEFA_OVALADA_38mm', 2.47, false, reglasSel39)).toContain('[MEC 39]');
    expect(mecanismoParaPano({ mecanismo: '' }, 'NEG', null, OPC, 'DUO_MANUAL_38mm', 2.47, false, reglasSel39)).toContain('[MEC 38]');
  });

  it('modeloVentanaPorAncho: una cortina NUEVA de 2,47 m nace en 45 (Fase 1 al guardar/importar)', () => {
    expect(modeloVentanaPorAncho(modelosRol, 'ROL', 'BCO', 2.47, false, RM, undefined, false, reglasTub39)).toBe(rol45b);
    expect(modeloVentanaPorAncho(modelosRol, 'ROL', 'BCO', 2.0, false, RM, undefined, false, reglasTub39)).toBe(rol38);
  });

  it('resincronizarChipsPanos: la OT guardada con E39 + MEC 33 (fila 38) se corrige al re-guardar', () => {
    const panos: Array<Record<string, unknown>> = [
      { ancho: 2.47, alto: 2.0, mecanismo: SIMPLE_BCO, tuberia: 'E39 - TUBO .43 - ESP 1.2 (TUBO .45)' },
    ];
    resincronizarChipsPanos(panos, 'BCO', rol38, 'ROL', OPC, OPCIONES_TUBERIA, false, reglasSel39);
    expect(panos[0].mecanismo).toContain('[MEC 18]');
    expect(codigoTuberiaDeChip(panos[0].tuberia as string)).toBe('E39');
  });
});
