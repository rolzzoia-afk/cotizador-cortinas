import { describe, expect, it } from 'vitest';
import type { ModeloDespiece } from './tipos';
import {
  DESCRIPCION_TUBERIA,
  REGLAS_TUBERIA,
  canonizarChipTuberia,
  chipTuberiaPorAncho,
  chipTuberiaPorCodigo,
  codigoTuberiaDeChip,
  codigoTuboPorAncho,
  codigosTuberiaCompatibles,
  descripcionTuberia,
  diametroDesdeCategoria,
  diametroDesdeChipMecanismo,
  opcionesTuberiaFiltradas,
  tuberiaCodigoCorto,
  tuberiaCorregidaPorMecanismo,
  tuberiaParaPano,
} from './reglas-tuberia';
import {
  CHIPS_MECANISMO_LEGACY,
  OPCIONES_MECANISMO,
  OPCIONES_MECANISMO_DUAL,
  OPCIONES_TUBERIA,
} from '@/modules/cotizador/fase2';

/** Código del chip resultante (robusto al formato largo/viejo). */
const cod = (chip: string | null) => codigoTuberiaDeChip(chip);

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

  it('63 mm sin categoría: hasta 3 m → E47; más de 3 m → E65 (regla nueva)', () => {
    expect(codigoTuboPorAncho(oscuranti63, 2.5)).toBe('E47');
    expect(codigoTuboPorAncho(oscuranti63, 3.5)).toBe('E65');
    expect(cod(chipTuberiaPorAncho(oscuranti63, 3.5, OPCIONES_TUBERIA))).toBe('E65');
  });

  it('OSCURANTI por categoría → E47 aunque el modelo Excel diga 38 mm', () => {
    const model38 = { ...oscuranti63, diametro_tubo_mm: 38, codigos_tubo: 'E02; E66' };
    expect(codigoTuboPorAncho(model38, 3.51, 'OSCURANTI_63mm')).toBe('E47');
    expect(
      cod(
        tuberiaParaPano(3.51, model38, '0,38mm [E66] 2mm', OPCIONES_TUBERIA, 'OSCURANTI_63mm'),
      ),
    ).toBe('E47');
  });
});

describe('tuberiaParaPano', () => {
  it('ancho 2,99 m sin tubo guardado → chip E66', () => {
    expect(cod(tuberiaParaPano(2.989, soft38, '', OPCIONES_TUBERIA))).toBe('E66');
  });

  it('corrige E02 guardado en cortina ancha → E66', () => {
    expect(
      cod(tuberiaParaPano(2.989, soft38, '0,38mm [E02] 1,2mm', OPCIONES_TUBERIA)),
    ).toBe('E66');
  });

  it('respeta E02 en cortina ≤2,2 m Y migra el chip viejo al texto nuevo', () => {
    const r = tuberiaParaPano(1.745, soft38, '0,38mm [E02] 1,2mm', OPCIONES_TUBERIA);
    expect(r).toBe(DESCRIPCION_TUBERIA.E02); // migró de "0,38mm [E02] 1,2mm"
  });
});

// ── Descripción / parser de tubería ──────────────────────────────────
describe('descripcionTuberia', () => {
  it('desde código corto, chip viejo, chip nuevo y código pelado', () => {
    expect(descripcionTuberia('38mm_E02')).toBe(DESCRIPCION_TUBERIA.E02);
    expect(descripcionTuberia('0,38mm [E02] 1,2mm')).toBe(DESCRIPCION_TUBERIA.E02);
    expect(descripcionTuberia(DESCRIPCION_TUBERIA.E66)).toBe(DESCRIPCION_TUBERIA.E66);
    expect(descripcionTuberia('E47')).toBe(DESCRIPCION_TUBERIA.E47);
  });
  it('fallback: VELCRO / vacío / sin mapa se devuelven tal cual', () => {
    expect(descripcionTuberia('VELCRO')).toBe('VELCRO');
    expect(descripcionTuberia('')).toBe('');
    expect(descripcionTuberia(null)).toBe('');
    expect(descripcionTuberia('63mm')).toBe('63mm');
  });
});

describe('codigoTuberiaDeChip / chipTuberiaPorCodigo (ambos formatos)', () => {
  it('extrae el código del chip viejo (corchetes) y del nuevo (código al inicio)', () => {
    expect(codigoTuberiaDeChip('0,38mm [E02] 1,2mm')).toBe('E02');
    expect(codigoTuberiaDeChip(DESCRIPCION_TUBERIA.E02)).toBe('E02');
    expect(codigoTuberiaDeChip(DESCRIPCION_TUBERIA.E66)).toBe('E66');
    expect(codigoTuberiaDeChip('VELCRO')).toBe('');
    expect(codigoTuberiaDeChip('')).toBe('');
  });
  it('chipTuberiaPorCodigo encuentra el chip nuevo por código', () => {
    expect(chipTuberiaPorCodigo('E66', OPCIONES_TUBERIA)).toBe(DESCRIPCION_TUBERIA.E66);
    expect(chipTuberiaPorCodigo('E47', OPCIONES_TUBERIA)).toBe(DESCRIPCION_TUBERIA.E47);
    expect(chipTuberiaPorCodigo('', OPCIONES_TUBERIA)).toBeNull();
  });
});

describe('canonizarChipTuberia', () => {
  it('migra el chip viejo al texto nuevo SOLO por formato (sin modelo ni ancho)', () => {
    // Regresión: una OT vieja sin categoría (modelo=null) no se migraba en
    // sincronizarChips y el chip guardado quedaba sin resaltar en el editor.
    expect(canonizarChipTuberia('0,38mm [E02] 1,2mm', OPCIONES_TUBERIA)).toBe(
      DESCRIPCION_TUBERIA.E02,
    );
    expect(canonizarChipTuberia('0,63mm [E47] 2mm', OPCIONES_TUBERIA)).toBe(
      DESCRIPCION_TUBERIA.E47,
    );
  });

  it('deja intactos el texto nuevo, VELCRO, vacío y códigos sin chip base (E53)', () => {
    expect(canonizarChipTuberia(DESCRIPCION_TUBERIA.E66, OPCIONES_TUBERIA)).toBe(
      DESCRIPCION_TUBERIA.E66,
    );
    expect(canonizarChipTuberia('VELCRO', OPCIONES_TUBERIA)).toBe('VELCRO');
    expect(canonizarChipTuberia('', OPCIONES_TUBERIA)).toBe('');
    expect(canonizarChipTuberia('0,40mm [E53] 2mm', OPCIONES_TUBERIA)).toBe('0,40mm [E53] 2mm');
  });
});

// ── Cascada mecanismo → tubería ──────────────────────────────────────
const E02 = DESCRIPCION_TUBERIA.E02;
const E66 = DESCRIPCION_TUBERIA.E66;
const E78 = DESCRIPCION_TUBERIA.E78;
const E05 = DESCRIPCION_TUBERIA.E05;
const E47 = DESCRIPCION_TUBERIA.E47;
const E65 = DESCRIPCION_TUBERIA.E65;
const pletina0: ModeloDespiece = { ...soft38, diametro_tubo_mm: 0, codigos_tubo: '' };

describe('codigosTuberiaCompatibles', () => {
  it('38 → [E02, E66]; 45 → [E78, E05]; 63 → [E47, E65]; desconocido → []', () => {
    expect(codigosTuberiaCompatibles(38)).toEqual(['E02', 'E66']);
    expect(codigosTuberiaCompatibles(45)).toEqual(['E78', 'E05']);
    expect(codigosTuberiaCompatibles(63)).toEqual(['E47', 'E65']);
    expect(codigosTuberiaCompatibles(50)).toEqual([]);
    expect(codigosTuberiaCompatibles(0)).toEqual([]);
  });
});

// Tubo 45 mm: E78 pasa a ser el default (2026-07-14); E05 queda en desuso pero
// sigue seleccionable y NO se pisa en OTs viejas que ya lo tienen guardado.
const roller45: ModeloDespiece = {
  ...soft38,
  sistema: 'CENEFA_OVALADA',
  tipo_rol: 'ROL_CENEFA_OV_MANUAL_45mm',
  mecanismo: 'MEC_09_OVALADA_NEGRO',
  diametro_tubo_mm: 45,
  codigos_tubo: 'E04; E05; E39; E46; E78',
};

const ovalada38: ModeloDespiece = {
  ...soft38,
  sistema: 'CENEFA_OVALADA',
  tipo_rol: 'ROL_CENEFA_OV_MANUAL_38mm',
  mecanismo: 'MEC_09_OVALADA_NEGRO',
  diametro_tubo_mm: 38,
};
// Chip de cenefa ovalada (sin diámetro explícito en la etiqueta → la heurística
// lo mandaba a 38 mm; ahora el modelo/categoría deciden 38 vs 45).
const CHIP_OVALADA = 'OVALADA NEG [MEC 09]';

describe('tubo 45 mm: E78 default, E05 histórico', () => {
  it('paño 45 mm nuevo (sin tubería guardada) → E78', () => {
    expect(cod(tuberiaParaPano(2.5, roller45, '', OPCIONES_TUBERIA))).toBe('E78');
    expect(cod(chipTuberiaPorAncho(roller45, 2.5, OPCIONES_TUBERIA))).toBe('E78');
  });
  it('OT vieja con E05 guardado → conserva E05 (no lo pisa)', () => {
    expect(cod(tuberiaParaPano(2.5, roller45, E05, OPCIONES_TUBERIA))).toBe('E05');
  });
});

describe('diametroDesdeCategoria', () => {
  it('extrae mm del nombre de la categoría; sin mm o sin regla → null', () => {
    expect(diametroDesdeCategoria('ROL_MANUAL_CENEFA_OVALADA_45mm')).toBe(45);
    expect(diametroDesdeCategoria('ROL_MANUAL_CENEFA_OVALADA_38mm')).toBe(38);
    expect(diametroDesdeCategoria('DUO_MANUAL_45mm')).toBe(45);
    expect(diametroDesdeCategoria('OSCURANTI_63mm')).toBe(63);
    expect(diametroDesdeCategoria('ROL')).toBeNull();
    expect(diametroDesdeCategoria('ROL_CENEFA_OVALADA_MOTOR_GRANDE')).toBeNull();
    expect(diametroDesdeCategoria('')).toBeNull();
    expect(diametroDesdeCategoria(null)).toBeNull();
  });
});

// Regresión del bug: la cenefa ovalada 45 mm ofrecía E02/E66 (la heurística
// OVALADA→38 le ganaba al modelo). El modelo/categoría deben mandar el diámetro.
describe('cenefa ovalada: el diámetro sale del modelo/categoría, no de OVALADA→38', () => {
  it('opciones con modelo 45 mm + chip OVALADA → E78 y E05', () => {
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {
        mecanismoChip: CHIP_OVALADA,
        modelo: roller45,
        categoria: 'ROL_MANUAL_CENEFA_OVALADA_45mm',
      }),
    ).toEqual([E78, E05]);
  });
  it('opciones sin modelo pero categoría 45 mm + chip OVALADA → E78 y E05', () => {
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {
        mecanismoChip: CHIP_OVALADA,
        categoria: 'ROL_MANUAL_CENEFA_OVALADA_45mm',
      }),
    ).toEqual([E78, E05]);
  });
  it('opciones con modelo 38 mm + chip OVALADA → E02 y E66 (no regresiona)', () => {
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {
        mecanismoChip: CHIP_OVALADA,
        modelo: ovalada38,
        categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      }),
    ).toEqual([E02, E66]);
  });
  it('corrige la tubería a E78 al elegir mecanismo OVALADA con modelo 45 mm', () => {
    expect(
      cod(tuberiaCorregidaPorMecanismo(CHIP_OVALADA, E02, 2.5, OPCIONES_TUBERIA, 'ROL_MANUAL_CENEFA_OVALADA_45mm', roller45)),
    ).toBe('E78');
  });
  it('modelo 45 mm con E05 ya compatible → null (no pisa el histórico)', () => {
    expect(
      tuberiaCorregidaPorMecanismo(CHIP_OVALADA, E05, 2.5, OPCIONES_TUBERIA, 'ROL_MANUAL_CENEFA_OVALADA_45mm', roller45),
    ).toBeNull();
  });
  it('modelo 38 mm mantiene la corrección a 38 mm (E66 por ancho)', () => {
    expect(
      cod(tuberiaCorregidaPorMecanismo(CHIP_OVALADA, E05, 2.5, OPCIONES_TUBERIA, 'ROL_MANUAL_CENEFA_OVALADA_38mm', ovalada38)),
    ).toBe('E66');
  });

  // El caso real: la cenefa ovalada 45 mm no tiene regla de mecanismo, así que
  // cae al "kit simple 38MM [MEC 32]". Ese 38 es del kit, NO del tubo → la
  // categoría 45 mm debe mandar el diámetro del tubo (E78/E05).
  const KIT_38 = 'KIT SIMPLE NEGRO 38MM [MEC 32]';
  it('categoría 45 mm + kit simple 38MM → opciones E78/E05 (el 38 es del kit)', () => {
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {
        mecanismoChip: KIT_38,
        modelo: roller45,
        categoria: 'ROL_MANUAL_CENEFA_OVALADA_45mm',
      }),
    ).toEqual([E78, E05]);
  });
  it('categoría 45 mm + kit simple 38MM → corrige la tubería a E78', () => {
    expect(
      cod(tuberiaCorregidaPorMecanismo(KIT_38, E02, 2.5, OPCIONES_TUBERIA, 'ROL_MANUAL_CENEFA_OVALADA_45mm', roller45)),
    ).toBe('E78');
  });
  it('roller simple "ROL" (sin mm en categoría) + kit simple 38MM → sigue en 38 mm', () => {
    // La categoría sin mm no aporta diámetro → manda el chip explícito (38 mm).
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, { mecanismoChip: KIT_38, categoria: 'ROL' }),
    ).toEqual([E02, E66]);
  });

  // Default (pre-selección) por categoría, aunque el modelo sea null o falte el ancho.
  it('default sin modelo pero categoría 45 mm → E78 (no espera al producto)', () => {
    expect(cod(tuberiaParaPano(2.5, null, '', OPCIONES_TUBERIA, 'ROL_MANUAL_CENEFA_OVALADA_45mm'))).toBe('E78');
  });
  it('default con ancho 0 y categoría 45 mm → E78', () => {
    expect(cod(tuberiaParaPano(0, roller45, '', OPCIONES_TUBERIA, 'ROL_MANUAL_CENEFA_OVALADA_45mm'))).toBe('E78');
  });
  it('codigoTuboPorAncho: el modelo real manda; la categoría decide sin modelo', () => {
    // El diámetro del MODELO gana (la banda 2,2–3,0 fuerza la fila 45 aunque la
    // categoría diga _38mm); la categoría con mm solo decide sin modelo cargado.
    expect(codigoTuboPorAncho(roller45, 2.5, 'DUO_MANUAL_38mm')).toBe('E78');
    expect(codigoTuboPorAncho({ ...ovalada38, diametro_tubo_mm: 0 }, 2.5, 'ROL_MANUAL_CENEFA_OVALADA_45mm')).toBe('E78');
    expect(codigoTuboPorAncho(ovalada38, 2.5, 'ROL_MANUAL_CENEFA_OVALADA_38mm')).toBe('E66');
  });
});

// Banda 2,2–3,0 m (kit 45 + tubo E78, 2026-07-14): con el modelo ya forzado a
// la fila 45 por modeloPorAncho, el tubo guardado de otra franja se corrige.
describe('tubo de la banda 2,2–3,0 m (modelo 45 forzado)', () => {
  it('cortina que crece a la banda con E02/E66 guardado → E78', () => {
    expect(cod(tuberiaParaPano(2.5, roller45, E02, OPCIONES_TUBERIA, 'ROL'))).toBe('E78');
    expect(cod(tuberiaParaPano(2.5, roller45, E66, OPCIONES_TUBERIA, 'ROL'))).toBe('E78');
  });
  it('dúo manual 38 en banda (modelo 45): E66 guardado → E78 aunque la categoría diga 38', () => {
    expect(cod(tuberiaParaPano(2.5, roller45, E66, OPCIONES_TUBERIA, 'DUO_MANUAL_38mm'))).toBe('E78');
  });
  it('E05 guardado (manual/histórico) NO se pisa en la banda', () => {
    expect(cod(tuberiaParaPano(2.5, roller45, E05, OPCIONES_TUBERIA, 'ROL'))).toBe('E05');
  });
  it('cortina que baja de la banda (modelo vuelto a 38): E78 guardado → E02', () => {
    expect(cod(tuberiaParaPano(2.0, soft38, E78, OPCIONES_TUBERIA, 'ROL'))).toBe('E02');
  });
});

const roller63: ModeloDespiece = {
  ...soft38,
  sistema: 'ROLLER_SIMPLE',
  tipo_rol: 'ROL_SIMPLE',
  mecanismo: 'MEC_28_63mm_BLANCO_DER_IZQ',
  diametro_tubo_mm: 63,
  codigos_tubo: 'E08; E47',
};

describe('regla 63 mm (E47 / E65 por ancho)', () => {
  it('hasta 3 m → E47; más de 3 m → E65', () => {
    expect(codigoTuboPorAncho(roller63, 3.0)).toBe('E47');
    expect(codigoTuboPorAncho(roller63, 3.01)).toBe('E65');
    expect(codigoTuboPorAncho(roller63, 3.5)).toBe('E65');
  });

  it('OSCURANTI 63 mm sigue en E47 por categoría, aun sobre 3 m', () => {
    expect(codigoTuboPorAncho(roller63, 3.5, 'OSCURANTI_63mm')).toBe('E47');
  });

  it('tuberiaParaPano corrige E47↔E65 al cruzar 3 m', () => {
    expect(cod(tuberiaParaPano(3.5, roller63, E47, OPCIONES_TUBERIA))).toBe('E65');
    expect(cod(tuberiaParaPano(2.5, roller63, E65, OPCIONES_TUBERIA))).toBe('E47');
  });

  it('tuberiaCorregidaPorMecanismo: MEC 28 con E02 a 3,5 m → E65; con E65 → null', () => {
    expect(tuberiaCorregidaPorMecanismo('0,63mm BCO [MEC 28]', E02, 3.5, OPCIONES_TUBERIA)).toBe(E65);
    expect(tuberiaCorregidaPorMecanismo('0,63mm BCO [MEC 28]', E65, 3.5, OPCIONES_TUBERIA)).toBeNull();
  });

  it('roller >3 m (E65) que pasa a OSCURANTI se corrige a E47 por categoría', () => {
    // Regresión: TUBOS_AUTO_POR_ANCHO debe incluir E65, si no el E65 guardado
    // sobrevivía y OSCURANTI (siempre E47) quedaba con el tubo equivocado.
    expect(cod(tuberiaParaPano(3.5, roller63, E65, OPCIONES_TUBERIA, 'OSCURANTI_63mm'))).toBe('E47');
    // Y el E02/E66 legacy sigue corrigiéndose igual.
    expect(cod(tuberiaParaPano(3.5, roller63, E66, OPCIONES_TUBERIA, 'OSCURANTI_63mm'))).toBe('E47');
  });
});

describe('tuberiaCodigoCorto — pletina (velcro)', () => {
  const pletinaRoller: ModeloDespiece = {
    ...soft38,
    sistema: 'PLETINA_ROLLER',
    tipo_rol: 'PLETINA_ROLLER_V',
    diametro_tubo_mm: 0,
  };
  const pletinaDuo: ModeloDespiece = { ...pletinaRoller, sistema: 'PLETINA_DUO', tipo_rol: 'PLETINA_DUO_V' };
  it('modelo pletina → "VELCRO" (no el nombre del sistema)', () => {
    expect(tuberiaCodigoCorto(pletinaRoller, '', 0.8)).toBe('VELCRO');
    expect(tuberiaCodigoCorto(pletinaDuo, '', 0.8)).toBe('VELCRO');
  });
  it('chip VELCRO explícito → "VELCRO" aunque el modelo falte', () => {
    expect(tuberiaCodigoCorto(null, 'VELCRO', 0.8)).toBe('VELCRO');
  });
});

describe('diametroDesdeChipMecanismo', () => {
  it('mapa exhaustivo de TODOS los chips de UI y legacy (uno nuevo sin regla rompe acá)', () => {
    const esperado: Record<string, number | null> = {
      // OPCIONES_MECANISMO (UI limpia)
      'KIT SIMPLE NEGRO 38MM [MEC 32]': 38,
      'KIT SIMPLE BLANCO 38MM [MEC 33]': 38,
      'KIT SIMPLE GRIS 38MM [MEC 34]': 38,
      'KIT REFORZADO NEGRO 38MM [MEC 40]': 38,
      'KIT REFORZADO BLANCO 38MM [MEC 41]': 38,
      'OVALADA GRIS [MEC 12]': 38,
      'OVALADA NEGRO [MEC 38]': 38,
      'OVALADA BLANCO [MEC 39]': 38,
      '0,63mm BCO [MEC 28]': 63,
      // Pletina (velcro): no es un kit MEC, no tiene diámetro de tubo.
      VELCRO: null,
      // CHIPS_MECANISMO_LEGACY
      'LZ 38 MERG BCO [MEC 05]': 38,
      'OVALADA NEG [MEC 09]': 38,
      'OVALADA BCO [MEC 10]': 38,
      'LZ50 MERG BCO [MEC 06]': 38, // el 50 de "LZ50" NO es diámetro
      'LZ50 SFLX NGR [MEC 11]': 38,
      'LZ50 SFLX GRIS [MEC 13]': 38,
      'LZ50 SFLX BCO [MEC 14]': 38,
      '0,45mm BCO [MEC 18]': 45,
      '0,45mm NGR [MEC 23]': 45,
      // OPCIONES_MECANISMO_DUAL (todos tubo 38 mm)
      'DUAL DERECHO BLANCO [MEC 01]': 38,
      'DUAL IZQUIERDO BLANCO [MEC 02]': 38,
      'DUAL DERECHO NEGRO [MEC 03]': 38,
      'DUAL IZQUIERDO NEGRO [MEC 04]': 38,
      'DUAL MIXTO BLANCO [MEC 19]': 38,
      'DUAL MIXTO NEGRO [MEC 20]': 38,
      'DUAL DERECHO GRIS [MEC 24]': 38,
      'DUAL IZQUIERDO GRIS [MEC 25]': 38,
    };
    for (const chip of [...OPCIONES_MECANISMO, ...OPCIONES_MECANISMO_DUAL, ...CHIPS_MECANISMO_LEGACY]) {
      expect(chip in esperado, `chip sin regla en el test: ${chip}`).toBe(true);
      expect(diametroDesdeChipMecanismo(chip), chip).toBe(esperado[chip]);
    }
  });

  it('vacío / null / desconocido → null', () => {
    expect(diametroDesdeChipMecanismo('')).toBeNull();
    expect(diametroDesdeChipMecanismo(null)).toBeNull();
    expect(diametroDesdeChipMecanismo(undefined)).toBeNull();
    expect(diametroDesdeChipMecanismo('MOTOR SOMFY')).toBeNull();
  });
});

describe('opcionesTuberiaFiltradas', () => {
  it('mecanismo 38 mm → exactamente E02 y E66', () => {
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {
        mecanismoChip: 'KIT SIMPLE NEGRO 38MM [MEC 32]',
      }),
    ).toEqual([E02, E66]);
  });

  it('MEC 28 (63 mm) → E47 y E65; MEC 18 legacy (45 mm) → E78 y E05', () => {
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, { mecanismoChip: '0,63mm BCO [MEC 28]' }),
    ).toEqual([E47, E65]);
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, { mecanismoChip: '0,45mm BCO [MEC 18]' }),
    ).toEqual([E78, E05]);
  });

  it('la regla de categoría (OSCURANTI→E47) gana sobre el chip de mecanismo', () => {
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {
        mecanismoChip: 'KIT SIMPLE NEGRO 38MM [MEC 32]',
        categoria: 'OSCURANTI_63mm',
      }),
    ).toEqual([E47]);
  });

  it('la tubería guardada incompatible se conserva al final (escape OTs viejas)', () => {
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {
        mecanismoChip: 'KIT SIMPLE NEGRO 38MM [MEC 32]',
        tuberiaActual: E47,
      }),
    ).toEqual([E02, E66, E47]);
    // Incluso un chip retirado de OPCIONES_TUBERIA (E53, quitado 2026-07-08).
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {
        mecanismoChip: 'KIT SIMPLE NEGRO 38MM [MEC 32]',
        tuberiaActual: '0,40mm [E53] 2mm',
      }),
    ).toEqual([E02, E66, '0,40mm [E53] 2mm']);
  });

  it('sin mecanismo cae al diámetro del modelo; pletina → VELCRO', () => {
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, { modelo: soft38 }),
    ).toEqual([E02, E66]);
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, { modelo: pletina0 }),
    ).toEqual(['VELCRO']);
  });

  it('sin datos (ni mecanismo ni modelo, o chip irreconocible) → todas', () => {
    expect(opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {})).toEqual([...OPCIONES_TUBERIA]);
    expect(
      opcionesTuberiaFiltradas(OPCIONES_TUBERIA, { mecanismoChip: 'MOTOR SOMFY' }),
    ).toEqual([...OPCIONES_TUBERIA]);
  });
});

describe('tuberiaCorregidaPorMecanismo', () => {
  it('cambiar a MEC 28 (63 mm) con tubería E02 → corrige a E47', () => {
    expect(
      tuberiaCorregidaPorMecanismo('0,63mm BCO [MEC 28]', E02, 1.5, OPCIONES_TUBERIA),
    ).toBe(E47);
  });

  it('cambiar a 38 mm con tubería E47 → E02 o E66 según el ancho (regla 2,2 m)', () => {
    const mec32 = 'KIT SIMPLE NEGRO 38MM [MEC 32]';
    expect(tuberiaCorregidaPorMecanismo(mec32, E47, 1.5, OPCIONES_TUBERIA)).toBe(E02);
    expect(tuberiaCorregidaPorMecanismo(mec32, E47, 2.5, OPCIONES_TUBERIA)).toBe(E66);
  });

  it('tubería ya compatible → null (respeta la elección; el ajuste fino es de tuberiaParaPano)', () => {
    const mec32 = 'KIT SIMPLE NEGRO 38MM [MEC 32]';
    expect(tuberiaCorregidaPorMecanismo(mec32, E02, 1.5, OPCIONES_TUBERIA)).toBeNull();
    expect(tuberiaCorregidaPorMecanismo(mec32, E66, 1.5, OPCIONES_TUBERIA)).toBeNull();
  });

  it('VELCRO o tubería vacía con mecanismo 38 mm → rellena por ancho', () => {
    const mec33 = 'KIT SIMPLE BLANCO 38MM [MEC 33]';
    expect(tuberiaCorregidaPorMecanismo(mec33, 'VELCRO', 1.5, OPCIONES_TUBERIA)).toBe(E02);
    expect(tuberiaCorregidaPorMecanismo(mec33, '', 1.5, OPCIONES_TUBERIA)).toBe(E02);
  });

  it('ancho 0 con 38 mm → E02 por prefijo (edge documentado)', () => {
    expect(
      tuberiaCorregidaPorMecanismo('KIT SIMPLE NEGRO 38MM [MEC 32]', E47, 0, OPCIONES_TUBERIA),
    ).toBe(E02);
  });

  it('la regla de categoría manda: OSCURANTI + E66 → E47', () => {
    expect(
      tuberiaCorregidaPorMecanismo(
        'KIT SIMPLE NEGRO 38MM [MEC 32]', E66, 1.5, OPCIONES_TUBERIA, 'OSCURANTI_63mm',
      ),
    ).toBe(E47);
  });

  it('chip sin diámetro y sin regla de categoría → null (no toca nada)', () => {
    expect(
      tuberiaCorregidaPorMecanismo('MOTOR SOMFY', E02, 1.5, OPCIONES_TUBERIA),
    ).toBeNull();
  });
});
