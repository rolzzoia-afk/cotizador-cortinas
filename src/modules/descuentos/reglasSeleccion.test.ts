import { describe, expect, it, vi } from 'vitest';
import {
  REGLAS_SELECCION_DEFAULT,
  derivarOpciones,
  normalizarReglasSeleccion,
  sonReglasDefault,
  validarReglasSeleccion,
  type ReglasSeleccion,
} from './reglasSeleccion';
import {
  REGLAS_MECANISMO,
  chipsMecanismoOcultos,
  opcionesMecanismoResolucion,
  opcionesMecanismoUI,
} from './reglas-mecanismo';
import {
  REGLAS_TUBERIA,
  descripcionesTuberia,
  espesorTuboPorCodigo,
  opcionesTuberiaResolucion,
  opcionesTuberiaUI,
} from './reglas-tuberia';
import {
  CHIPS_MECANISMO_LEGACY,
  OPCIONES_MECANISMO,
  OPCIONES_MECANISMO_RESOLUCION,
  OPCIONES_TUBERIA,
} from '@/modules/cotizador/fase2';

/** Copia profunda editable de las reglas de fábrica. */
function clonar(): ReglasSeleccion {
  return JSON.parse(JSON.stringify(REGLAS_SELECCION_DEFAULT)) as ReglasSeleccion;
}

// ─────────────────────────────────────────────────────────────────────
// Goldens de derivación: las listas que hoy consume la app tienen que salir
// EXACTAS del catálogo. Si alguien reordena o toca un chip de fábrica, esto
// se cae antes que los tests de negocio.
// ─────────────────────────────────────────────────────────────────────
describe('derivación desde los valores de fábrica', () => {
  it('los chips de mecanismo de la UI son los 13 de siempre, en orden', () => {
    expect(opcionesMecanismoUI()).toEqual([
      'KIT SIMPLE NEGRO 38MM [MEC 32]',
      'KIT SIMPLE BLANCO 38MM [MEC 33]',
      'KIT SIMPLE GRIS 38MM [MEC 34]',
      'KIT REFORZADO NEGRO 38MM [MEC 40]',
      'KIT REFORZADO BLANCO 38MM [MEC 41]',
      'OVALADA GRIS [MEC 12]',
      'OVALADA NEGRO [MEC 38]',
      'OVALADA BLANCO [MEC 39]',
      '0,45mm BCO [MEC 18]',
      '0,45mm NGR [MEC 23]',
      '0,63mm BCO [MEC 28]',
      'VELCRO',
    ]);
    expect(OPCIONES_MECANISMO).toEqual(opcionesMecanismoUI());
  });

  it('los legacy son los 7 chips ocultos', () => {
    expect(chipsMecanismoOcultos()).toEqual([
      'LZ 38 MERG BCO [MEC 05]',
      'OVALADA NEG [MEC 09]',
      'OVALADA BCO [MEC 10]',
      'LZ50 MERG BCO [MEC 06]',
      'LZ50 SFLX NGR [MEC 11]',
      'LZ50 SFLX GRIS [MEC 13]',
      'LZ50 SFLX BCO [MEC 14]',
    ]);
    expect(CHIPS_MECANISMO_LEGACY).toEqual(chipsMecanismoOcultos());
  });

  it('la lista de resolución es UI + duales + ocultos, sin repetidos', () => {
    const res = opcionesMecanismoResolucion();
    expect(OPCIONES_MECANISMO_RESOLUCION).toEqual(res);
    expect(res).toHaveLength(12 + 8 + 7);
    expect(new Set(res).size).toBe(res.length);
  });

  it('las tuberías de la UI salen del catálogo y cierran con VELCRO y VERTICAL', () => {
    expect(opcionesTuberiaUI()).toEqual([
      'E02-TUBO 1.2 / Ø 38 mm',
      'E66 - TUBO (.40mm) - 2.5mm',
      'E78 - TUBO 43MM(ESP1.2)(5.8)',
      'E05 - TUBO Ø 45 mm',
      'E47 - TUBO Ø 63 mm',
      'E65 - TUBO (.63mm)',
      'VELCRO',
      'VERTICAL',
    ]);
    expect(OPCIONES_TUBERIA).toEqual(opcionesTuberiaUI());
  });

  it('las descripciones por código son las de siempre', () => {
    expect(descripcionesTuberia()).toEqual({
      E02: 'E02-TUBO 1.2 / Ø 38 mm',
      E66: 'E66 - TUBO (.40mm) - 2.5mm',
      E78: 'E78 - TUBO 43MM(ESP1.2)(5.8)',
      E05: 'E05 - TUBO Ø 45 mm',
      E47: 'E47 - TUBO Ø 63 mm',
      E65: 'E65 - TUBO (.63mm)',
    });
  });

  it('los espesores derivados son los que usaba la etiqueta Brother', () => {
    expect(espesorTuboPorCodigo()).toEqual({ E02: 1.2, E66: 2.5, E78: 1.2 });
  });

  it('los tubos que las reglas pueden pisar son E02/E66/E78/E65', () => {
    const auto = REGLAS_TUBERIA.tubos.filter((t) => t.autoPorAncho).map((t) => t.codigo);
    expect(new Set(auto)).toEqual(new Set(['E02', 'E66', 'E78', 'E65']));
  });

  it('derivarOpciones junta las cinco listas', () => {
    const o = derivarOpciones();
    expect(o.mecanismoUI).toEqual(OPCIONES_MECANISMO);
    expect(o.mecanismoResolucion).toEqual(OPCIONES_MECANISMO_RESOLUCION);
    expect(o.tuberiaUI).toEqual(OPCIONES_TUBERIA);
    expect(o.tuberiaResolucion).toContain('E05 - TUBO Ø 45 mm');
  });
});

describe('estados del catálogo', () => {
  it('un tubo oculto sale de la UI pero sigue en la lista de resolución', () => {
    const r = clonar();
    r.tuberia.tubos = r.tuberia.tubos.map((t) =>
      t.codigo === 'E05' ? { ...t, estado: 'oculto' as const } : t,
    );
    expect(opcionesTuberiaUI(r.tuberia)).not.toContain('E05 - TUBO Ø 45 mm');
    expect(opcionesTuberiaResolucion(r.tuberia)).toContain('E05 - TUBO Ø 45 mm');
  });

  it('un tubo opt-in solo aparece con el tubo E78 activado en la OT', () => {
    const r = clonar();
    r.tuberia.tubos = r.tuberia.tubos.map((t) =>
      t.codigo === 'E78' ? { ...t, estado: 'opt_in' as const } : t,
    );
    expect(opcionesTuberiaUI(r.tuberia, false)).not.toContain('E78 - TUBO 43MM(ESP1.2)(5.8)');
    expect(opcionesTuberiaUI(r.tuberia, true)).toContain('E78 - TUBO 43MM(ESP1.2)(5.8)');
  });

  it('un mecanismo oculto sale de la UI y queda en resolución', () => {
    const r = clonar();
    r.mecanismo.mecanismos = r.mecanismo.mecanismos.map((m) =>
      m.chip === 'OVALADA GRIS [MEC 12]' ? { ...m, estado: 'oculto' as const } : m,
    );
    expect(opcionesMecanismoUI(r.mecanismo)).not.toContain('OVALADA GRIS [MEC 12]');
    expect(opcionesMecanismoResolucion(r.mecanismo)).toContain('OVALADA GRIS [MEC 12]');
  });

  it('una tubería nueva aparece en el selector y entre las compatibles de su diámetro', async () => {
    const { codigosTuberiaCompatibles } = await import('./reglas-tuberia');
    const r = clonar();
    r.tuberia.tubos = [
      ...r.tuberia.tubos,
      {
        codigo: 'E90',
        descripcion: 'E90 - TUBO Ø 45 mm reforzado',
        diametroMm: 45,
        espesorMm: 2,
        estado: 'activo',
        autoPorAncho: true,
      },
    ];
    r.tuberia.tubos45mm = [...r.tuberia.tubos45mm, 'E90'];
    expect(opcionesTuberiaUI(r.tuberia)).toContain('E90 - TUBO Ø 45 mm reforzado');
    expect(codigosTuberiaCompatibles(45, r.tuberia)).toContain('E90');
    expect(espesorTuboPorCodigo(r.tuberia).E90).toBe(2);
  });
});

describe('normalizarReglasSeleccion', () => {
  it('sin nada guardado devuelve los valores de fábrica', () => {
    expect(normalizarReglasSeleccion(null)).toEqual(REGLAS_SELECCION_DEFAULT);
    expect(normalizarReglasSeleccion('basura')).toEqual(REGLAS_SELECCION_DEFAULT);
    expect(sonReglasDefault(normalizarReglasSeleccion({}))).toBe(true);
  });

  it('un ida y vuelta por JSON no cambia nada', () => {
    const ida = JSON.parse(JSON.stringify(REGLAS_SELECCION_DEFAULT));
    expect(sonReglasDefault(normalizarReglasSeleccion(ida))).toBe(true);
  });

  it('un array guardado REEMPLAZA al default (no se mezcla por índice)', () => {
    const r = normalizarReglasSeleccion({
      mecanismo: {
        reglasAncho: [
          { descripcion: 'única', categoria: 'ROL', anchoMinM: 2, mec: 32, tubo: 'E02', nota: '' },
        ],
      },
    });
    expect(r.mecanismo.reglasAncho).toHaveLength(1);
    expect(r.mecanismo.reglasAncho[0].categoria).toBe('ROL');
    // Lo que no se tocó sigue de fábrica.
    expect(r.mecanismo.reglasCategoria).toEqual(REGLAS_MECANISMO.reglasCategoria);
  });

  it('descarta filas corruptas y conserva las buenas', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = normalizarReglasSeleccion({
      tuberia: {
        tubos: [
          { codigo: 'E02', descripcion: 'ok', diametroMm: 38 },
          { codigo: '', descripcion: 'sin código', diametroMm: 38 },
          { codigo: 'E77' }, // sin descripción ni diámetro
        ],
      },
    });
    expect(r.tuberia.tubos).toHaveLength(1);
    expect(r.tuberia.tubos[0].codigo).toBe('E02');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('si al sanear no queda ninguna fila vuelve el default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = normalizarReglasSeleccion({ tuberia: { tubos: [{ nada: true }] } });
    expect(r.tuberia.tubos).toEqual(REGLAS_TUBERIA.tubos);
    warn.mockRestore();
  });

  it('re-numera las claves de codigoPorDiametro (el JSON las guarda como texto)', () => {
    const r = normalizarReglasSeleccion({
      tuberia: { codigoPorDiametro: { '45': 'E78', '63': 'E47', '50': 'E90' } },
    });
    expect(r.tuberia.codigoPorDiametro[45]).toBe('E78');
    expect(r.tuberia.codigoPorDiametro[50]).toBe('E90');
  });

  it('completa los campos faltantes de una fila con sus defaults', () => {
    const r = normalizarReglasSeleccion({
      tuberia: { tubos: [{ codigo: 'e91', descripcion: 'nuevo', diametroMm: 38 }] },
    });
    expect(r.tuberia.tubos[0]).toEqual({
      codigo: 'E91',
      descripcion: 'nuevo',
      diametroMm: 38,
      espesorMm: null,
      estado: 'activo',
      autoPorAncho: true,
    });
  });

  it('un estado desconocido cae a activo', () => {
    const r = normalizarReglasSeleccion({
      mecanismo: { mecanismos: [{ chip: 'X [MEC 99]', estado: 'quizás' }] },
    });
    expect(r.mecanismo.mecanismos[0].estado).toBe('activo');
  });

  it('conserva la banda de oscuridad editada y completa la mitad faltante', () => {
    const r = normalizarReglasSeleccion({
      mecanismo: { bandaOscuridadE78: { anchoMinM: 2.0 } },
    });
    expect(r.mecanismo.bandaOscuridadE78).toEqual({ anchoMinM: 2.0, anchoMaxM: 3.0 });
  });

  it('conserva el mapa de kits reforzados por color editado en Admin', () => {
    const r = normalizarReglasSeleccion({
      mecanismo: { colorAMecReforzado: { BCO: 41, blanco: 41, GRS: 42 } },
    });
    expect(r.mecanismo.colorAMecReforzado).toEqual({ BCO: 41, BLANCO: 41, GRS: 42 });
    // Sin nada guardado quedan los de fábrica.
    expect(normalizarReglasSeleccion({}).mecanismo.colorAMecReforzado).toEqual(
      REGLAS_MECANISMO.colorAMecReforzado,
    );
  });
});

describe('validarReglasSeleccion', () => {
  it('los valores de fábrica no tienen errores ni avisos', () => {
    const { errores, avisos } = validarReglasSeleccion(REGLAS_SELECCION_DEFAULT);
    expect(errores).toEqual([]);
    expect(avisos).toEqual([]);
  });

  it('detecta el MEC de una regla que no tiene chip (la falla silenciosa histórica)', () => {
    const r = clonar();
    r.mecanismo.reglasCategoria = [
      { descripcion: 'inventada', categoria: 'ROL', mec: 77 },
    ];
    const { errores } = validarReglasSeleccion(r);
    expect(errores.some((e) => e.includes('MEC 77'))).toBe(true);
  });

  it('detecta un MEC inexistente en el mapa de kits reforzados', () => {
    const r = clonar();
    r.mecanismo.colorAMecReforzado = { ...r.mecanismo.colorAMecReforzado, GRS: 88 };
    const { errores } = validarReglasSeleccion(r);
    expect(errores.some((e) => e.includes('MEC 88'))).toBe(true);
  });

  it('detecta un tubo referenciado que no existe en el catálogo', () => {
    const r = clonar();
    r.mecanismo.reglasAncho = r.mecanismo.reglasAncho.map((x, i) =>
      i === 0 ? { ...x, tubo: 'E99' } : x,
    );
    const { errores } = validarReglasSeleccion(r);
    expect(errores.some((e) => e.includes('E99'))).toBe(true);
  });

  it('avisa cuando una regla asigna un tubo oculto', () => {
    const r = clonar();
    r.tuberia.tubos = r.tuberia.tubos.map((t) =>
      t.codigo === 'E65' ? { ...t, estado: 'oculto' as const } : t,
    );
    const { errores, avisos } = validarReglasSeleccion(r);
    expect(errores).toEqual([]);
    expect(avisos.some((a) => a.includes('E65'))).toBe(true);
  });

  it('rechaza un chip sin número de MEC y acepta VELCRO', () => {
    const r = clonar();
    r.mecanismo.mecanismos = [...r.mecanismo.mecanismos, { chip: 'KIT NUEVO', estado: 'activo' }];
    expect(validarReglasSeleccion(r).errores.some((e) => e.includes('KIT NUEVO'))).toBe(true);
    // VELCRO ya viene de fábrica sin [MEC n] y no genera error.
    expect(validarReglasSeleccion(REGLAS_SELECCION_DEFAULT).errores).toEqual([]);
  });

  it('rechaza un código de tubo repetido y un rango de ancho invertido', () => {
    const r = clonar();
    r.tuberia.tubos = [...r.tuberia.tubos, { ...r.tuberia.tubos[0] }];
    r.mecanismo.reglasAncho = r.mecanismo.reglasAncho.map((x, i) =>
      i === 1 ? { ...x, anchoMinM: 3.0, anchoMaxM: 2.2 } : x,
    );
    const { errores } = validarReglasSeleccion(r);
    expect(errores.some((e) => e.includes('repetido'))).toBe(true);
    expect(errores.some((e) => e.includes('mayor que el mínimo'))).toBe(true);
  });

  it('no deja vaciar un catálogo entero', () => {
    const r = clonar();
    r.tuberia.tubos = [];
    expect(validarReglasSeleccion(r).errores.some((e) => e.includes('vacío'))).toBe(true);
  });

  it('avisa cuando dos reglas de la misma categoría y gate se superponen', () => {
    const r = clonar();
    r.mecanismo.reglasAncho = [
      { descripcion: 'A', categoria: 'ROL', anchoMinM: 1, anchoMaxM: 2.5, mec: 32, tubo: 'E02', nota: '' },
      { descripcion: 'B', categoria: 'ROL', anchoMinM: 2, anchoMaxM: 3, mec: 33, tubo: 'E66', nota: '' },
    ];
    expect(validarReglasSeleccion(r).avisos.some((a) => a.includes('se superponen'))).toBe(true);
  });
});

describe('cadenas — normalización y validación', () => {
  it('un catálogo de cadenas guardado REEMPLAZA al de fábrica', () => {
    const r = normalizarReglasSeleccion({
      cadenas: {
        cadenas: [{ codigo: 'cad90', largo: '4mts', color: 'dorado', estado: 'activo' }],
      },
    });
    expect(r.cadenas.cadenas).toEqual([
      { codigo: 'CAD90', largo: '4mts', color: 'DORADO', estado: 'activo' },
    ]);
    // Lo no guardado se queda con lo de fábrica.
    expect(r.cadenas.tramosAlto).toEqual(REGLAS_SELECCION_DEFAULT.cadenas.tramosAlto);
  });

  it('un catálogo VACÍO es legítimo: el largo se deduce del nombre del insumo', () => {
    const r = normalizarReglasSeleccion({ cadenas: { cadenas: [] } });
    expect(r.cadenas.cadenas).toEqual([]);
  });

  it('descarta cadenas corruptas y repetidas', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = normalizarReglasSeleccion({
      cadenas: {
        cadenas: [
          { codigo: 'CAD01', largo: '3mts', color: 'GRS', estado: 'activo' },
          { codigo: 'CAD01', largo: '4mts', color: 'GRS', estado: 'activo' }, // repetida
          { largo: '3mts' }, // sin código
          'basura',
        ],
      },
    });
    expect(r.cadenas.cadenas.map((c) => c.codigo)).toEqual(['CAD01']);
    expect(r.cadenas.cadenas[0].largo).toBe('3mts'); // gana la primera
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('si la escalera queda vacía al sanear, vuelve la de fábrica', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = normalizarReglasSeleccion({ cadenas: { tramosAlto: [{ largo: '' }, {}] } });
    expect(r.cadenas.tramosAlto).toEqual(REGLAS_SELECCION_DEFAULT.cadenas.tramosAlto);
    warn.mockRestore();
  });

  it('sobrevive la ida y vuelta por JSON', () => {
    const r = normalizarReglasSeleccion(
      JSON.parse(JSON.stringify(REGLAS_SELECCION_DEFAULT)),
    );
    expect(r.cadenas).toEqual(REGLAS_SELECCION_DEFAULT.cadenas);
    expect(sonReglasDefault(r)).toBe(true);
  });

  it('conserva el modo «empieza con» de la regla del dúo', () => {
    const r = normalizarReglasSeleccion(JSON.parse(JSON.stringify(REGLAS_SELECCION_DEFAULT)));
    expect(r.cadenas.reglasCategoria[0].categoria).toEqual({ empiezaCon: 'DUO' });
  });

  it('rechaza un largo desconocido y dos tramos que empiezan igual', () => {
    const r = clonar();
    r.cadenas = {
      ...r.cadenas,
      cadenas: [{ codigo: 'CAD99', largo: '7mts', color: 'BCO', estado: 'activo' }],
      tramosAlto: [
        { altoMinM: 2, largo: '4mts' },
        { altoMinM: 2, largo: '3mts' },
      ],
    };
    const { errores } = validarReglasSeleccion(r);
    expect(errores.some((e) => e.includes('largo desconocido'))).toBe(true);
    expect(errores.some((e) => e.includes('dos tramos'))).toBe(true);
  });

  it('avisa cuando dos cadenas activas son del mismo largo y color', () => {
    const r = clonar();
    r.cadenas = {
      ...r.cadenas,
      cadenas: [
        { codigo: 'CAD05', largo: '4mts', color: 'BCO', estado: 'activo' },
        { codigo: 'CAD21', largo: '4mts', color: 'BCO', estado: 'activo' },
      ],
    };
    const { avisos, errores } = validarReglasSeleccion(r);
    expect(errores).toEqual([]);
    expect(avisos.some((a) => a.includes('mismo largo y color'))).toBe(true);
  });

  it('avisa si la vertical usa una cadena oculta', () => {
    const r = clonar();
    r.cadenas = {
      ...r.cadenas,
      cadenas: [{ codigo: 'CAD06', largo: '3mts', color: 'BCO', estado: 'oculto' }],
    };
    expect(validarReglasSeleccion(r).avisos.some((a) => a.includes('está oculta'))).toBe(true);
  });

  it('no deja vaciar la escalera de alturas', () => {
    const r = clonar();
    r.cadenas = { ...r.cadenas, tramosAlto: [] };
    expect(validarReglasSeleccion(r).errores.some((e) => e.includes('escalera'))).toBe(true);
  });
});
