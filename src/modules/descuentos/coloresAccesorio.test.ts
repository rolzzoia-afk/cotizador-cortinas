// El catálogo de colores de accesorios: qué se ofrece dónde, qué código de
// insumo gana, y qué pasa el día que alguien da de alta un color nuevo.
import { describe, expect, it, vi } from 'vitest';
import {
  COLORES_BUILTIN,
  colorPorCodigo,
  coloresParaUso,
  insumoDeColor,
  mecDeColor,
  nombreDeColor,
  opcionesColorConGuardado,
  validarColores,
  type ColorAccesorio,
} from './coloresAccesorio';
import {
  OPCIONES_ACCESORIO_COLOR,
  OPCIONES_COLOR_TAPA_CUADRADA,
  OPCIONES_COLOR_TAPA_OVALADA,
  OPCIONES_MANILLA_COLOR,
} from '@/modules/cotizador/fase2';
import {
  REGLAS_SELECCION_DEFAULT,
  normalizarReglasSeleccion,
  sonReglasDefault,
  validarReglasSeleccion,
} from './reglasSeleccion';
import { REGLAS_MECANISMO } from './reglas-mecanismo';
import { REGLAS_TUBERIA } from './reglas-tuberia';
import { REGLAS_CADENA } from './reglas-cadena';

/** Un color dado de alta en Admin, con parte de sus códigos completados. */
const DORADO: ColorAccesorio = {
  codigo: 'DOR',
  nombre: 'DORADO',
  usos: { accesorio: true, manilla: true, tapaOvalada: false, tapaCuadrada: false },
  insumos: { kitSimple: 43, tapaPesoIzq: 'TAP80', tapaPesoDer: 'TAP81', pesoRoller: 'E90' },
};

describe('las listas de Fase 2 salen del catálogo', () => {
  // Golden de la derivación: estas cuatro listas estaban escritas a mano y
  // ahora se calculan. Si cambia el catálogo de fábrica, esto avisa.
  it('reproducen exactamente las de fábrica', () => {
    expect(OPCIONES_ACCESORIO_COLOR).toEqual(['MET', 'NEG', 'BCO', 'GRS']);
    expect(OPCIONES_MANILLA_COLOR).toEqual(['NEG', 'BCO', 'CAFÉ']);
    expect(OPCIONES_COLOR_TAPA_OVALADA).toEqual(['NEG', 'BCO', 'GRS']);
    expect(OPCIONES_COLOR_TAPA_CUADRADA).toEqual(['NEG', 'BCO', 'CAFÉ']);
  });

  it('un color nuevo aparece solo en los usos que se le marcaron', () => {
    const con = [...COLORES_BUILTIN, DORADO];
    expect(coloresParaUso('accesorio', con)).toContain('DOR');
    expect(coloresParaUso('manilla', con)).toContain('DOR');
    expect(coloresParaUso('tapaOvalada', con)).not.toContain('DOR');
  });

  it('un color retirado sigue mostrándose en la cortina que ya lo tenía', () => {
    const opciones = coloresParaUso('accesorio', COLORES_BUILTIN);
    expect(opcionesColorConGuardado(opciones, 'DOR')).toContain('DOR');
    // El que ya está en la lista no se duplica (ni por diferencia de mayúsculas).
    expect(opcionesColorConGuardado(opciones, 'bco')).toEqual(opciones);
    expect(opcionesColorConGuardado(opciones, '')).toEqual(opciones);
  });
});

describe('resolución de un color', () => {
  it('se encuentra por código o por nombre, sin importar mayúsculas', () => {
    expect(colorPorCodigo('bco')?.nombre).toBe('BLANCO');
    expect(colorPorCodigo('BLANCO')?.codigo).toBe('BCO');
    expect(colorPorCodigo('DOR')).toBeNull();
  });

  it('el nombre largo cae al propio código si el color no está', () => {
    expect(nombreDeColor('NEG')).toBe('NEGRO');
    expect(nombreDeColor('DOR')).toBe('DOR');
  });

  it('el código del color gana; sin catálogo o sin declararlo, no hay overlay', () => {
    const con = [...COLORES_BUILTIN, DORADO];
    expect(insumoDeColor('DOR', 'tapaPesoIzq', con)).toBe('TAP80');
    expect(mecDeColor('DOR', 'kitSimple', con)).toBe(43);
    // Lo que el color no declaró (y los colores de fábrica, que no declaran
    // nada) devuelve null → el consumidor usa su tabla de siempre.
    expect(insumoDeColor('DOR', 'tapaDuo', con)).toBeNull();
    expect(insumoDeColor('BCO', 'tapaPesoIzq', con)).toBeNull();
    expect(insumoDeColor('DOR', 'tapaPesoIzq', undefined)).toBeNull();
  });
});

describe('validarColores', () => {
  it('los de fábrica no tienen errores ni avisos', () => {
    expect(validarColores(COLORES_BUILTIN)).toEqual({ errores: [], avisos: [] });
  });

  it('rechaza códigos repetidos, vacíos o mal formados', () => {
    const err = (cs: ColorAccesorio[]) => validarColores(cs).errores.join(' ');
    expect(err([...COLORES_BUILTIN, { ...DORADO, codigo: 'BCO' }])).toContain('repetido');
    expect(err([...COLORES_BUILTIN, { ...DORADO, codigo: '' }])).toContain('sin código');
    expect(err([...COLORES_BUILTIN, { ...DORADO, codigo: 'MI COLOR' }])).toContain('no sirve');
  });

  it('rechaza dos colores con el mismo nombre: elegirían el mismo modelo', () => {
    const err = validarColores([...COLORES_BUILTIN, { ...DORADO, nombre: 'BLANCO' }]).errores;
    expect(err.join(' ')).toContain('mismo nombre');
  });

  it('exige nombre, porque con él se buscan el modelo y la cadena', () => {
    const err = validarColores([...COLORES_BUILTIN, { ...DORADO, nombre: '' }]).errores;
    expect(err.join(' ')).toContain('nombre');
  });

  it('avisa si un color no se ofrece en ningún selector', () => {
    const sinUsos = {
      ...DORADO,
      usos: { accesorio: false, manilla: false, tapaOvalada: false, tapaCuadrada: false },
    };
    expect(validarColores([...COLORES_BUILTIN, sinUsos]).avisos.join(' ')).toContain(
      'ningún uso',
    );
  });

  it('avisa (sin bloquear) si se quitó un color de fábrica', () => {
    const sinGris = COLORES_BUILTIN.filter((c) => c.codigo !== 'GRS');
    const r = validarColores(sinGris);
    expect(r.errores).toEqual([]);
    expect(r.avisos.join(' ')).toContain('GRS');
  });
});

describe('persistencia dentro de las reglas de selección', () => {
  it('sin nada guardado quedan los de fábrica', () => {
    expect(normalizarReglasSeleccion({}).colores).toEqual(COLORES_BUILTIN);
    expect(sonReglasDefault(normalizarReglasSeleccion({}))).toBe(true);
  });

  it('un ida y vuelta por JSON conserva el color con sus códigos', () => {
    const guardado = JSON.parse(
      JSON.stringify({ colores: [...COLORES_BUILTIN, DORADO] }),
    );
    const r = normalizarReglasSeleccion(guardado);
    expect(r.colores).toHaveLength(COLORES_BUILTIN.length + 1);
    expect(r.colores.at(-1)).toEqual(DORADO);
  });

  it('descarta filas corruptas o repetidas y conserva las buenas', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = normalizarReglasSeleccion({
      colores: [
        { codigo: 'DOR', nombre: 'DORADO', usos: { accesorio: true } },
        { codigo: 'DOR', nombre: 'REPETIDO', usos: { accesorio: true } },
        { nombre: 'SIN CÓDIGO' },
        'basura',
      ],
    });
    expect(r.colores.map((c) => c.codigo)).toEqual(['DOR']);
    // Los usos que no vinieron quedan apagados, no indefinidos.
    expect(r.colores[0].usos).toEqual({
      accesorio: true,
      manilla: false,
      tapaOvalada: false,
      tapaCuadrada: false,
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('si al sanear no queda ninguno, vuelven los de fábrica', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(normalizarReglasSeleccion({ colores: [{ nada: true }] }).colores).toEqual(
      COLORES_BUILTIN,
    );
    warn.mockRestore();
  });

  it('descarta códigos de insumo vacíos pero conserva los buenos del mismo color', () => {
    const r = normalizarReglasSeleccion({
      colores: [
        {
          codigo: 'DOR',
          nombre: 'DORADO',
          usos: { accesorio: true },
          insumos: { tapaPesoIzq: '  ', pesoRoller: 'e90', kitSimple: 'no es número' },
        },
      ],
    });
    expect(r.colores[0].insumos).toEqual({ pesoRoller: 'E90' });
  });

  it('el validador general ve los colores junto con las reglas', () => {
    const r = validarReglasSeleccion({
      ...REGLAS_SELECCION_DEFAULT,
      colores: [...COLORES_BUILTIN, { ...DORADO, codigo: 'BCO' }],
    });
    expect(r.errores.join(' ')).toContain('repetido');
  });

  it('avisa cuando un mapa de kits nombra un color que no está en el catálogo', () => {
    const r = validarReglasSeleccion({
      mecanismo: { ...REGLAS_MECANISMO, colorAMec: { ...REGLAS_MECANISMO.colorAMec, DOR: 33 } },
      tuberia: REGLAS_TUBERIA,
      tipos: [],
      colores: COLORES_BUILTIN,
      cadenas: REGLAS_CADENA,
    });
    expect(r.errores).toEqual([]);
    expect(r.avisos.join(' ')).toContain('DOR');
  });
});
