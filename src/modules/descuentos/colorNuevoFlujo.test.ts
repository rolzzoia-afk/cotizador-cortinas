// El día que alguien da de alta un color de accesorios (un dorado), ¿qué hace
// la app sola y qué queda a mano? Este archivo recorre el flujo completo con un
// color que NO existe de fábrica.
import { describe, expect, it } from 'vitest';
import { COLORES_BUILTIN, type ColorAccesorio } from './coloresAccesorio';
import { REGLAS_SELECCION_DEFAULT, type ReglasSeleccion } from './reglasSeleccion';
import { REGLAS_MECANISMO } from './reglas-mecanismo';
import { mecanismoParaPano, opcionesMecanismoFiltradas } from './chips';
import { elegirModeloPorColor, type ModeloDespiece } from './tipos';
import { codigoEstructura, codigoZocaloPerfil } from './codigos-estructura';
import { colorPesoInfOscuridadExcel } from './peso-oscuridad';
import { insumosDePano, tapaCenefaCuadrada, codigoManillaPorColor } from '@/modules/cotizador/insumosCortina';
import { derivarLargoColor, codCadenaAutoPorAlto, type CadenaInsumo } from '@/modules/cotizador/cadenas';
import type { Pano } from '@/modules/cotizador/types';

const CHIP_DORADO = 'KIT SIMPLE DORADO 38MM [MEC 43]';

/** El color tal como lo dejaría el asistente con todos los pasos completos. */
const DORADO: ColorAccesorio = {
  codigo: 'DOR',
  nombre: 'DORADO',
  usos: { accesorio: true, manilla: true, tapaOvalada: false, tapaCuadrada: true },
  insumos: {
    kitSimple: 43,
    tapaPesoIzq: 'TAP80',
    tapaPesoDer: 'TAP81',
    tapaCuadrada: 'TAP82',
    manilla: 'HER90',
    pesoRoller: 'E90',
    pesoOscuridad: 'E91',
    zocalo: 'E92',
  },
};

/** Un color declarado pero sin ningún código completado (paso 3 en blanco). */
const DORADO_PELADO: ColorAccesorio = {
  codigo: 'DOR',
  nombre: 'DORADO',
  usos: { accesorio: true, manilla: false, tapaOvalada: false, tapaCuadrada: false },
};

const reglasCon = (color: ColorAccesorio): ReglasSeleccion => ({
  ...REGLAS_SELECCION_DEFAULT,
  mecanismo: {
    ...REGLAS_MECANISMO,
    mecanismos: [...REGLAS_MECANISMO.mecanismos, { chip: CHIP_DORADO, estado: 'activo' }],
    kitsInventario: [...REGLAS_MECANISMO.kitsInventario, 43],
    colorAMec: { ...REGLAS_MECANISMO.colorAMec, DOR: 43, DORADO: 43 },
  },
  colores: [...COLORES_BUILTIN, color],
});

const opcionesCon = (r: ReglasSeleccion) => r.mecanismo.mecanismos.map((m) => m.chip);

const modelo = (mecanismo: string): ModeloDespiece =>
  ({
    sistema: 'ROLLER',
    tipo_rol: 'MANUAL_38',
    mecanismo,
    diametro_tubo_mm: 38,
    activo: true,
  }) as unknown as ModeloDespiece;

describe('mecanismo de un color nuevo', () => {
  it('se elige solo el kit que el asistente mapeó', () => {
    const r = reglasCon(DORADO);
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'DOR', null, opcionesCon(r), 'ROL', 1.5, false, r),
    ).toBe(CHIP_DORADO);
  });

  it('al cambiar el color de una cortina, el kit pasa al del color nuevo', () => {
    const r = reglasCon(DORADO);
    expect(
      mecanismoParaPano(
        { mecanismo: 'KIT SIMPLE BLANCO 38MM [MEC 33]' },
        'DOR',
        null,
        opcionesCon(r),
        'ROL',
        1.5,
        false,
        r,
      ),
    ).toBe(CHIP_DORADO);
  });

  it('sin kit mapeado el mecanismo queda a mano, sin romper nada', () => {
    // Es el mismo trato que reciben hoy el metálico y el café.
    const r: ReglasSeleccion = {
      ...REGLAS_SELECCION_DEFAULT,
      colores: [...COLORES_BUILTIN, DORADO_PELADO],
    };
    expect(
      mecanismoParaPano({ mecanismo: '' }, 'DOR', null, opcionesCon(r), 'ROL', 1.5, false, r),
    ).toBe('');
  });

  it('el kit nuevo aparece en la lista que ve el vendedor', () => {
    const r = reglasCon(DORADO);
    const opts = opcionesMecanismoFiltradas(
      [],
      'ROL',
      'DOR',
      opcionesCon(r),
      '',
      r.mecanismo,
      r.tipos,
    );
    expect(opts).toContain(CHIP_DORADO);
  });
});

describe('modelo de fabricación', () => {
  it('se toma la fila cuyo mecanismo nombra el color', () => {
    const cands = [modelo('MEC_33_ROLLER_BLANCO'), modelo('MEC_43_ROLLER_DORADO')];
    expect(elegirModeloPorColor(cands, 'DORADO')?.mecanismo).toBe('MEC_43_ROLLER_DORADO');
  });

  it('sin fila propia usa la primera de la categoría (no se queda sin modelo)', () => {
    const cands = [modelo('MEC_33_ROLLER_BLANCO')];
    expect(elegirModeloPorColor(cands, 'DORADO')?.mecanismo).toBe('MEC_33_ROLLER_BLANCO');
  });
});

describe('insumos y códigos de bodega', () => {
  const pano = (p: Partial<Pano>): Partial<Pano> => p;

  it('roller dorado con códigos completados → sus tapas y sus tornillos', () => {
    const out = insumosDePano(pano({ color: 'DOR' }), {
      categoria: 'ROL',
      anchoM: 1.5,
      colores: [...COLORES_BUILTIN, DORADO],
    });
    const map = Object.fromEntries(out.map((i) => [i.codigo, i.cantidad]));
    expect(map).toEqual({ TAP80: 1, TAP81: 1, TOR02: 2 });
  });

  it('sin códigos, la tapa igual se emite SIN código y los tornillos NO faltan', () => {
    // Antes desaparecían las dos tapas y los tornillos en silencio, y en bodega
    // no había forma de notar que faltaba material.
    const out = insumosDePano(pano({ color: 'DOR' }), {
      categoria: 'ROL',
      anchoM: 1.5,
      colores: [...COLORES_BUILTIN, DORADO_PELADO],
    });
    expect(out.filter((i) => !i.codigo)).toHaveLength(2);
    expect(out.some((i) => i.descripcion.includes('DOR'))).toBe(true);
    expect(out.find((i) => i.codigo === 'TOR02')?.cantidad).toBe(2);
  });

  it('el metálico conserva su comportamiento de siempre (sin tapas ni tornillos)', () => {
    expect(insumosDePano(pano({ color: 'MET' }), { categoria: 'ROL', anchoM: 1.5 })).toEqual([]);
    expect(
      insumosDePano(pano({ color: 'MET' }), {
        categoria: 'ROL',
        anchoM: 1.5,
        colores: COLORES_BUILTIN,
      }),
    ).toEqual([]);
  });

  it('tapa de cenefa cuadrada y manilla salen con el código del color', () => {
    const con = [...COLORES_BUILTIN, DORADO];
    expect(tapaCenefaCuadrada('DOR', con).codigo).toBe('TAP82');
    expect(codigoManillaPorColor('DOR', con)).toBe('HER90');
    // Y los de fábrica no cambian.
    expect(tapaCenefaCuadrada('NEG', con).codigo).toBe('TAP32');
    expect(codigoManillaPorColor('BCO', con)).toBe('HER48');
  });
});

describe('estructura (peso, perfiles) del color nuevo', () => {
  const con = [...COLORES_BUILTIN, DORADO];

  it('el peso roller y el de oscuridad usan los códigos del catálogo', () => {
    expect(codigoEstructura('PESO', 'DOR', '', con)).toBe('E90');
    expect(codigoEstructura('PESO SOFT LIGHT', 'DOR', '', con)).toBe('E91');
    expect(codigoZocaloPerfil('DOR', con)).toBe('E92');
  });

  it('lo que el color no declaró sale sin código, como cualquier color raro', () => {
    expect(codigoEstructura('PESO U', 'DOR', '', con)).toBe('');
    expect(codigoEstructura('CENEFA OVALADA', 'DOR', '', con)).toBe('');
  });

  it('los colores de fábrica siguen resolviendo por sus tablas', () => {
    expect(codigoEstructura('PESO', 'NEG', '', con)).toBe('E14');
    expect(codigoEstructura('PESO', 'BCO', '', undefined)).toBe('E15');
    expect(codigoZocaloPerfil('BLANCO', con)).toBe('E32');
  });

  it('la columna del Excel muestra código y color juntos', () => {
    expect(colorPesoInfOscuridadExcel('DOR', con)).toBe('E91 [DOR]');
    expect(colorPesoInfOscuridadExcel('BCO')).toBe('E24 [BLANCO]');
  });
});

describe('cadena: se resuelve contra el inventario', () => {
  const insumos: CadenaInsumo[] = [
    { cod: 'CAD03', nemotecnico: 'CADENA INFINITA 4 METROS', color: 'NEGRO' } as CadenaInsumo,
    { cod: 'CAD90', nemotecnico: 'CADENA INFINITA 4 METROS', color: 'DORADO' } as CadenaInsumo,
  ];

  it('una cadena de color nuevo conserva su color al ida y vuelta', () => {
    // Con '' acá, Fase 2 creía en cada sincronización que el color había
    // cambiado y rehacía la cadena una y otra vez.
    expect(derivarLargoColor('CAD90', insumos)).toEqual({
      largoCadena: '4mts',
      colorCadena: 'DORADO',
    });
  });

  it('se auto-selecciona si existe la cadena de ese color', () => {
    expect(codCadenaAutoPorAlto(2.5, 'DORADO', 'ROL', insumos)).toBe('CAD90');
    expect(codCadenaAutoPorAlto(2.5, 'NEG', 'ROL', insumos)).toBe('CAD03');
  });

  it('sin cadena de ese color no inventa una: la elige el vendedor', () => {
    expect(codCadenaAutoPorAlto(2.5, 'DORADO', 'ROL', [insumos[0]])).toBeNull();
    // Y el metálico sigue sin auto-seleccionar, como hasta ahora.
    expect(codCadenaAutoPorAlto(2.5, 'MET', 'ROL', insumos)).toBeNull();
  });
});
