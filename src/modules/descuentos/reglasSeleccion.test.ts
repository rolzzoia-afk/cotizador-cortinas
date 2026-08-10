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

  it('los ocultos: 7 chips legacy del Excel + los 4 kits de la línea B', () => {
    expect(chipsMecanismoOcultos()).toEqual([
      'LZ 38 MERG BCO [MEC 05]',
      'OVALADA NEG [MEC 09]',
      'OVALADA BCO [MEC 10]',
      'LZ50 MERG BCO [MEC 06]',
      'LZ50 SFLX NGR [MEC 11]',
      'LZ50 SFLX GRIS [MEC 13]',
      'LZ50 SFLX BCO [MEC 14]',
      // LÍNEA B: ocultos porque no se ofrecen en una cortina normal; los pone
      // la rama de línea B, que arma su propio selector.
      'LZ50 PEQUEÑO NGR CAT.B [MEC 15]',
      'OVALADA BCO CAT.B [MEC 37]',
      'ROLLER BCO CAT.B [MEC 44]',
      'OVALADA NGR CAT.B [MEC 45]',
    ]);
    expect(CHIPS_MECANISMO_LEGACY).toEqual(chipsMecanismoOcultos());
  });

  it('la lista de resolución es UI + duales + ocultos, sin repetidos', () => {
    const res = opcionesMecanismoResolucion();
    expect(OPCIONES_MECANISMO_RESOLUCION).toEqual(res);
    expect(res).toHaveLength(12 + 8 + 11); // UI + duales + ocultos (7 legacy + 4 de línea B)
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
      // Tubos de la CATEGORÍA B: ocultos en el selector, resuelven como los demás.
      E01: 'E01 - TUBO 0.8 / Ø 38 mm',
      E39: 'E39 - TUBO .43 - ESP 1.2 (TUBO .45) (GAMA B)',
    });
  });

  it('los espesores derivados son los que usaba la etiqueta Brother', () => {
    // OJO con el E39: el «.43/.45» de su nombre es el CALIBRE, no la pared —
    // igual que el «(.40mm)» del E66, cuyo espesor es 2,5. El suyo es el 1,2
    // que dice «ESP».
    expect(espesorTuboPorCodigo()).toEqual({
      E01: 0.8,
      E02: 1.2,
      E39: 1.2,
      E66: 2.5,
      E78: 1.2,
    });
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
    const codigos = r.tuberia.tubos.map((t) => t.codigo);
    expect(codigos[0]).toBe('E02');
    // Las dos filas corruptas se descartaron: ni la vacía ni la E77 (que
    // tampoco existe en fábrica) entran.
    expect(codigos).not.toContain('');
    expect(codigos).not.toContain('E77');
    // Los demás códigos que quedaron son los que las reglas de fábrica nombran
    // y este catálogo recortado no traía: se reponen para que el motor pueda
    // resolverlos (ver «un catálogo guardado viejo se repone solo»).
    expect(r.tuberia.tubos.slice(1).every((t) => t.estado === 'oculto')).toBe(true);
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

describe('validarReglasSeleccion — categoría B', () => {
  it('rechaza un ancho de corte que no separa los dos tubos', () => {
    const r = clonar();
    r.tuberia.reglaLineaB = { ...r.tuberia.reglaLineaB, anchoMaxM: 0 };
    expect(
      validarReglasSeleccion(r).errores.some((e) => e.includes('ancho de corte')),
    ).toBe(true);
  });

  it('avisa cuando un color con kit de categoría B no tiene códigos de estructura', () => {
    const r = clonar();
    r.colores = [
      ...r.colores,
      {
        codigo: 'DOR',
        nombre: 'DORADO',
        usos: { accesorio: true, manilla: false, tapaOvalada: false, tapaCuadrada: false },
      },
    ];
    r.mecanismo.lineaB = {
      ...r.mecanismo.lineaB,
      reglas: r.mecanismo.lineaB.reglas.map((x, i) =>
        i === 0 ? { ...x, mecPorColor: { ...x.mecPorColor, DOR: 6 } } : x,
      ),
    };
    const { errores, avisos } = validarReglasSeleccion(r);
    expect(errores).toEqual([]);
    expect(avisos.some((a) => a.includes('DOR') && a.includes('códigos de estructura'))).toBe(true);
  });

  it('el blanco y el negro no avisan: sus códigos vienen de fábrica', () => {
    expect(validarReglasSeleccion(REGLAS_SELECCION_DEFAULT).avisos).toEqual([]);
  });

  it('avisa cuando el código de bodega es de un MEC que no está en el catálogo', () => {
    const r = clonar();
    r.mecanismo.lineaB = {
      ...r.mecanismo.lineaB,
      codigoInsumoPorMec: { ...r.mecanismo.lineaB.codigoInsumoPorMec, 99: 'MEC99-B' },
    };
    expect(
      validarReglasSeleccion(r).avisos.some((a) => a.includes('MEC99-B') && a.includes('MEC 99')),
    ).toBe(true);
  });

  it('avisa cuando una regla de categoría B nombra un color fuera del catálogo', () => {
    const r = clonar();
    r.mecanismo.lineaB = {
      ...r.mecanismo.lineaB,
      reglas: r.mecanismo.lineaB.reglas.map((x, i) =>
        i === 0 ? { ...x, mecPorColor: { ...x.mecPorColor, AZL: 6 } } : x,
      ),
    };
    expect(
      validarReglasSeleccion(r).avisos.some(
        (a) => a.includes('AZL') && a.includes('no está en el catálogo de colores'),
      ),
    ).toBe(true);
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

  it('conserva el modo «empieza con» de una regla de cadena por categoría', () => {
    const crudo = JSON.parse(JSON.stringify(REGLAS_SELECCION_DEFAULT));
    crudo.cadenas.reglasCategoria = [
      { descripcion: 'Dúo: cadena corta', categoria: { empiezaCon: 'DUO' }, largo: '1.4mts' },
    ];
    const r = normalizarReglasSeleccion(crudo);
    expect(r.cadenas.reglasCategoria[0].categoria).toEqual({ empiezaCon: 'DUO' });
    expect(r.cadenas.reglasCategoria[0].tramosAlto).toBeUndefined();
  });

  it('una regla por categoría puede traer su propia escalera (el dúo)', () => {
    const crudo = JSON.parse(JSON.stringify(REGLAS_SELECCION_DEFAULT));
    crudo.cadenas.reglasCategoria = [
      {
        descripcion: 'Dúo',
        categoria: { empiezaCon: 'DUO' },
        tramosAlto: [
          { altoMinM: 1.6, largo: '3mts' },
          { altoMinM: 0.9, largo: '0.75' },
          { largo: '' }, // corrupto: se descarta sin tumbar la regla
        ],
      },
    ];
    const r = normalizarReglasSeleccion(crudo);
    expect(r.cadenas.reglasCategoria[0].tramosAlto).toEqual([
      { altoMinM: 1.6, largo: '3mts' },
      { altoMinM: 0.9, largo: '0.75' },
    ]);
    // Con escalera propia la regla no fija un largo único.
    expect(r.cadenas.reglasCategoria[0].largo).toBeUndefined();
  });

  it('una regla sin largo ni escalera se descarta (no dice nada)', () => {
    const crudo = JSON.parse(JSON.stringify(REGLAS_SELECCION_DEFAULT));
    crudo.cadenas.reglasCategoria = [{ descripcion: 'vacía', categoria: 'DUO' }];
    expect(normalizarReglasSeleccion(crudo).cadenas.reglasCategoria).toEqual([]);
  });

  it('valida los tramos de la escalera propia de una regla', () => {
    const r = clonar();
    r.cadenas = {
      ...r.cadenas,
      reglasCategoria: [
        {
          descripcion: 'Dúo',
          categoria: { empiezaCon: 'DUO' },
          tramosAlto: [
            { altoMinM: 1.6, largo: '9mts' },
            { altoMinM: 1.6, largo: '3mts' },
          ],
        },
      ],
    };
    const { errores } = validarReglasSeleccion(r);
    expect(errores.some((e) => e.includes('«Dúo»') && e.includes('largo desconocido'))).toBe(true);
    expect(errores.some((e) => e.includes('«Dúo»') && e.includes('dos tramos'))).toBe(true);
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

// ─────────────────────────────────────────────────────────────────────
// El catálogo guardado REEMPLAZA al de fábrica (a propósito: el admin puede
// borrar filas). El precio de eso es que, al estrenar un chip o un tubo, las
// empresas que ya habían guardado su catálogo se quedaban con una regla que
// apunta a algo que su lista no tiene — y el motor no podía escribir el chip:
// la cortina salía sin kit y sin tubería, EN SILENCIO. Pasó de verdad al
// estrenar la categoría B (los 4 chips CAT.B y el tubo E01, OT 268-3).
// ─────────────────────────────────────────────────────────────────────
describe('un catálogo guardado viejo se repone solo', () => {
  /** Reglas de fábrica menos las piezas que estrenó la categoría B. */
  function guardadoSinPiezasB(): Record<string, unknown> {
    const r = clonar();
    r.mecanismo.mecanismos = r.mecanismo.mecanismos.filter((m) => !m.chip.includes('CAT.B'));
    r.tuberia.tubos = r.tuberia.tubos.filter((t) => t.codigo !== 'E01');
    return r as unknown as Record<string, unknown>;
  }

  it('repone los chips que las reglas nombran y no estaban', () => {
    const viejo = guardadoSinPiezasB();
    const nums = (r: ReglasSeleccion) =>
      new Set(
        opcionesMecanismoResolucion(r.mecanismo)
          .map((c) => c.match(/\[MEC (\d+)\]/)?.[1])
          .filter(Boolean),
      );
    // Antes del saneo faltan los kits de la categoría B…
    expect((viejo as any).mecanismo.mecanismos.some((m: any) => m.chip.includes('CAT.B'))).toBe(false);
    // …y después están los cuatro.
    const sano = normalizarReglasSeleccion(viejo);
    for (const mec of ['15', '37', '44', '45']) {
      expect(nums(sano).has(mec), `MEC ${mec}`).toBe(true);
    }
  });

  it('repone los DOS tubos de la categoría B (E01 y E39)', () => {
    const sano = normalizarReglasSeleccion(guardadoSinPiezasB());
    const codigos = sano.tuberia.tubos.map((t) => t.codigo);
    expect(codigos).toContain('E01');
    expect(codigos).toContain('E39');
    expect(sano.tuberia.reglaLineaB.codigoHasta).toBe('E01');
    expect(sano.tuberia.reglaLineaB.codigoDesde).toBe('E39');
  });

  it('una configuración vieja con `tuboLineaB` suelto se lee como el tramo delgado', () => {
    const viejo = guardadoSinPiezasB();
    delete (viejo as { tuberia?: { reglaLineaB?: unknown } }).tuberia?.reglaLineaB;
    ((viejo as Record<string, Record<string, unknown>>).tuberia).tuboLineaB = 'E01';
    const sano = normalizarReglasSeleccion(viejo);
    expect(sano.tuberia.reglaLineaB.codigoHasta).toBe('E01');
    expect(sano.tuberia.reglaLineaB.codigoDesde).toBe('E39'); // el resto, de fábrica
  });

  it('lo repuesto entra OCULTO: no cambia lo que se ofrece en Fase 2', () => {
    const sano = normalizarReglasSeleccion(guardadoSinPiezasB());
    const ui = opcionesMecanismoUI(sano.mecanismo);
    expect(ui.some((c) => c.includes('CAT.B'))).toBe(false);
    expect(opcionesTuberiaUI(sano.tuberia).some((c) => c.includes('E01'))).toBe(false);
    // …pero sí se puede RESOLVER.
    expect(chipsMecanismoOcultos(sano.mecanismo).some((c) => c.includes('CAT.B'))).toBe(true);
  });

  it('NO resucita una fila borrada a la que ninguna regla apunta', () => {
    const r = clonar();
    // Un chip que el admin puede borrar legítimamente: ninguna regla lo nombra.
    const chipVictima = r.mecanismo.mecanismos.find((m) => !mecEnAlgunaRegla(r, m.chip));
    expect(chipVictima, 'el catálogo de fábrica debería tener alguno').toBeTruthy();
    r.mecanismo.mecanismos = r.mecanismo.mecanismos.filter((m) => m.chip !== chipVictima!.chip);
    const sano = normalizarReglasSeleccion(r as unknown as Record<string, unknown>);
    expect(sano.mecanismo.mecanismos.some((m) => m.chip === chipVictima!.chip)).toBe(false);
  });

  it('no toca nada cuando el catálogo guardado ya está completo', () => {
    const r = clonar();
    const sano = normalizarReglasSeleccion(r as unknown as Record<string, unknown>);
    expect(sano.mecanismo.mecanismos).toEqual(REGLAS_SELECCION_DEFAULT.mecanismo.mecanismos);
    expect(sano.tuberia.tubos).toEqual(REGLAS_SELECCION_DEFAULT.tuberia.tubos);
  });
});

/** ¿Alguna regla nombra el MEC de este chip? (helper del test de arriba) */
function mecEnAlgunaRegla(r: ReglasSeleccion, chip: string): boolean {
  const n = Number(chip.match(/\[MEC (\d+)\]/)?.[1] ?? NaN);
  if (Number.isNaN(n)) return true; // VELCRO y compañía: no arriesgar
  const m = r.mecanismo;
  const enReglas =
    m.reglasAncho.some((x) => x.mec === n || Object.values(x.mecPorColor ?? {}).includes(n)) ||
    m.reglasCategoria.some((x) => x.mec === n) ||
    Object.values(m.colorAMec).includes(n) ||
    Object.values(m.colorAMecReforzado).includes(n) ||
    Object.values(m.kitOvaladaPorColor).includes(n) ||
    m.lineaB.reglas.some(
      (x) =>
        Object.values(x.mecPorColor).includes(n) ||
        Object.values(x.kitsManualesPorColor ?? {}).some((l) => l.includes(n)),
    );
  return enReglas;
}

describe('el validador mira también la categoría B', () => {
  it('denuncia un kit de la categoría B que no existe ni en fábrica', () => {
    const r = clonar();
    r.mecanismo.lineaB.reglas = [
      { descripcion: 'inventada', categoria: 'ROL', mecPorColor: { BLANCO: 97 } },
    ];
    const { errores } = validarReglasSeleccion(r);
    expect(errores.some((e) => e.includes('MEC 97') && e.includes('categoría B'))).toBe(true);
  });

  it('denuncia los tubos de la categoría B que no existen, en los dos tramos', () => {
    const r = clonar();
    r.tuberia.reglaLineaB = { ...r.tuberia.reglaLineaB, codigoHasta: 'E98', codigoDesde: 'E99' };
    const { errores } = validarReglasSeleccion(r);
    expect(errores.some((e) => e.includes('E98') && e.includes('categoría B'))).toBe(true);
    expect(errores.some((e) => e.includes('E99') && e.includes('categoría B'))).toBe(true);
  });

  it('los tubos ocultos de la categoría B NO generan aviso: no ofrecerlos es el diseño', () => {
    const { avisos, errores } = validarReglasSeleccion(clonar());
    expect(errores).toEqual([]);
    expect(avisos.some((a) => a.includes('E01'))).toBe(false);
    expect(avisos.some((a) => a.includes('E39'))).toBe(false);
  });
});
