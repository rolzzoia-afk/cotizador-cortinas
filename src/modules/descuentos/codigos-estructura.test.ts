import { describe, expect, it } from 'vitest';
import {
  CAMPOS_ESTRUCTURA_B,
  codigoCenefaCuadrada,
  codigoEstructura,
  codigoEstructuraBEfectivo,
  codigoManillaBeeblack,
  codigoPerfilBeeblack,
  codigoPerfilSuperior,
} from './codigos-estructura';
import { COLORES_BUILTIN, type ColorAccesorio } from './coloresAccesorio';

describe('codigoEstructura', () => {
  it('TUBO / PLETINA usan el código de tubería', () => {
    expect(codigoEstructura('TUBO', 'NEGRO', '38mm_E02')).toBe('38mm_E02');
    expect(codigoEstructura('PLETINA', 'NEGRO', 'VELCRO')).toBe('VELCRO');
  });

  it('PESO INTERNO siempre E13 (sin importar color)', () => {
    expect(codigoEstructura('PESO INTERNO', 'NEGRO', '38mm_E02')).toBe('E13');
    expect(codigoEstructura('PESO INTERNO', '', '')).toBe('E13');
  });

  it('PESO U color-fijo: NEGRO→E18, BLANCO→E19, GRIS→E20', () => {
    expect(codigoEstructura('PESO U', 'NEGRO', '')).toBe('E18');
    expect(codigoEstructura('PESO U', 'blanco', '')).toBe('E19');
    expect(codigoEstructura('PESO U', 'GRIS', '')).toBe('E20');
    expect(codigoEstructura('PESO U', 'AZUL', '')).toBe(''); // sin mapeo → vacío
  });

  it('PESO roller color-fijo: NEGRO→E14, BLANCO→E15, GRIS→E16', () => {
    expect(codigoEstructura('PESO', 'NEGRO', '38mm_E02')).toBe('E14');
    expect(codigoEstructura('PESO', 'BLANCO', '')).toBe('E15');
    expect(codigoEstructura('PESO', 'GRIS', '')).toBe('E16');
  });

  it('CENEFA OVALADA color-fijo: NEGRO→E26, BLANCO→E27, GRIS→E28', () => {
    expect(codigoEstructura('CENEFA OVALADA', 'NEGRO', '')).toBe('E26');
    expect(codigoEstructura('CENEFA OVALADA', 'BLANCO', '')).toBe('E27');
    expect(codigoEstructura('CENEFA OVALADA', 'GRIS', '')).toBe('E28');
    expect(codigoEstructura('CENEFA OVALADA', 'ALUMINIO', '')).toBe(''); // sin código fijo → vacío
  });

  it('normaliza color corto/largo/plural (NEG → NEGRO, BCO → BLANCO, GRS → GRIS)', () => {
    expect(codigoEstructura('PESO', 'NEG', '')).toBe('E14');
    expect(codigoEstructura('CENEFA OVALADA', 'BCO', '')).toBe('E27');
    expect(codigoEstructura('PESO U', 'GRS', '')).toBe('E20');
    expect(codigoEstructura('PESO', 'NEGROS', '')).toBe('E14');
  });

  it('PESO SOFT LIGHT (oscuridad): BLANCO→E24, NEGRO→E44, gris sin código', () => {
    expect(codigoEstructura('PESO SOFT LIGHT', 'BLANCO', '')).toBe('E24');
    expect(codigoEstructura('PESO SOFT LIGHT', 'BCO', '')).toBe('E24');
    expect(codigoEstructura('PESO SOFT LIGHT', 'NEGRO', '')).toBe('E44');
    expect(codigoEstructura('PESO SOFT LIGHT', 'NEG', '')).toBe('E44');
    expect(codigoEstructura('PESO SOFT LIGHT', 'GRIS', '')).toBe(''); // soft light no va gris
  });
});

// ── Categoría B: sus 4 piezas por color son un OVERLAY, igual que la línea A.
// Sin nada declarado mandan las tablas de fábrica, así que una empresa que no
// toca el catálogo calcula exactamente lo mismo que antes de mover esto a config.
describe('codigoEstructura — categoría B', () => {
  const DORADO: ColorAccesorio = {
    codigo: 'DOR',
    nombre: 'DORADO',
    usos: { accesorio: true, manilla: false, tapaOvalada: false, tapaCuadrada: false },
    insumos: { pesoRollerB: 'E90-B', cenefaOvaladaB: 'E91-B' },
  };
  const CON_DORADO = [...COLORES_BUILTIN, DORADO];

  it('sin overlay manda la tabla de fábrica', () => {
    expect(codigoEstructura('PESO', 'BCO', '', CON_DORADO, true)).toBe('E40');
    expect(codigoEstructura('PESO', 'NEG', '', CON_DORADO, true)).toBe('E69-B');
    expect(codigoEstructura('PESO U', 'BCO', '', CON_DORADO, true)).toBe('E25');
    expect(codigoEstructura('PESO INTERNO', 'NEG', '', CON_DORADO, true)).toBe('E71-B');
    expect(codigoEstructura('CENEFA OVALADA', 'BCO', '', CON_DORADO, true)).toBe('E60');
  });

  it('un color puede declarar sus propios códigos de categoría B', () => {
    expect(codigoEstructura('PESO', 'DOR', '', CON_DORADO, true)).toBe('E90-B');
    expect(codigoEstructura('CENEFA OVALADA', 'DOR', '', CON_DORADO, true)).toBe('E91-B');
    // Lo que no declaró sigue sin código: el dorado no tiene peso U de categoría B.
    expect(codigoEstructura('PESO U', 'DOR', '', CON_DORADO, true)).toBe('');
  });

  it('el overlay de la categoría B no toca a la línea A', () => {
    const bcoConB: ColorAccesorio[] = COLORES_BUILTIN.map((c) =>
      c.codigo === 'BCO' ? { ...c, insumos: { pesoRollerB: 'E90-B' } } : c,
    );
    expect(codigoEstructura('PESO', 'BCO', '', bcoConB, false)).toBe('E15');
    expect(codigoEstructura('PESO', 'BCO', '', bcoConB, true)).toBe('E90-B');
    // El peso interno de la línea A sigue siendo E13 fijo, sin mirar el color.
    expect(codigoEstructura('PESO INTERNO', 'NEG', '', bcoConB, false)).toBe('E13');
  });

  it('codigoEstructuraBEfectivo responde lo mismo que el despiece', () => {
    expect(codigoEstructuraBEfectivo('pesoRollerB', 'DOR', CON_DORADO)).toBe('E90-B');
    expect(codigoEstructuraBEfectivo('pesoRollerB', 'BCO', CON_DORADO)).toBe('E40');
    expect(codigoEstructuraBEfectivo('pesoUB', 'DOR', CON_DORADO)).toBe('');
    expect(CAMPOS_ESTRUCTURA_B.map((c) => c.campo)).toEqual([
      'pesoRollerB',
      'pesoUB',
      'pesoInternoB',
      'cenefaOvaladaB',
      'tapaPesoB',
      'tapaDuoB',
    ]);
  });
});

describe('codigoPerfilSuperior (oscuranti, perfil rectangular 50×25, por color de perfil)', () => {
  it('BLANCO→E50, NEGRO→E49, CAFÉ/CAFE/MADERA→E52', () => {
    expect(codigoPerfilSuperior('BLANCO')).toBe('E50');
    expect(codigoPerfilSuperior('NEGRO')).toBe('E49');
    expect(codigoPerfilSuperior('CAFÉ')).toBe('E52');
    expect(codigoPerfilSuperior('CAFE')).toBe('E52'); // sin tilde
    expect(codigoPerfilSuperior('MADERA')).toBe('E52'); // madera ≡ café
  });

  it('color sin mapeo o vacío → vacío', () => {
    expect(codigoPerfilSuperior('GRIS')).toBe('');
    expect(codigoPerfilSuperior('')).toBe('');
    expect(codigoPerfilSuperior(null)).toBe('');
  });
});

describe('codigoCenefaCuadrada (Dark/Oscuranti, por color de perfil)', () => {
  it('NEGRO→E29, BLANCO→E30, CAFÉ/CAFE/MADERA→E31', () => {
    expect(codigoCenefaCuadrada('NEGRO')).toBe('E29');
    expect(codigoCenefaCuadrada('BLANCO')).toBe('E30');
    expect(codigoCenefaCuadrada('CAFÉ')).toBe('E31');
    expect(codigoCenefaCuadrada('CAFE')).toBe('E31'); // sin tilde
    expect(codigoCenefaCuadrada('MADERA')).toBe('E31'); // café ≡ madera
  });

  it('color sin mapeo → vacío', () => {
    expect(codigoCenefaCuadrada('GRIS')).toBe('');
    expect(codigoCenefaCuadrada('')).toBe('');
    expect(codigoCenefaCuadrada(null)).toBe('');
  });
});

// BEEBLACK: los CUATRO perfiles salen del mismo riel; las manillas son las
// agarraderas (se cobran en Fase 1 y se cortan por la hoja de estructura).
describe('BEEBLACK — riel de perfiles y agarradera', () => {
  it('los 4 perfiles usan el mismo código por color', () => {
    for (const col of [
      'PERFIL SUPERIOR (ANCHO)',
      'PERFIL INFERIOR (ANCHO)',
      'PERFIL LATERAL IZQ (ALTO)',
      'PERFIL LATERAL DER (ALTO)',
    ]) {
      expect(codigoEstructura(col, 'BLANCO', ''), col).toBe('SML04');
      expect(codigoEstructura(col, 'NEGRO', ''), col).toBe('SML05');
      expect(codigoEstructura(col, 'CAFÉ', ''), col).toBe('SML06');
    }
  });

  it('las manillas usan la agarradera SML10/11/12', () => {
    expect(codigoEstructura('MANILLA IZQ (ALTO)', 'BLANCO', '')).toBe('SML10');
    expect(codigoEstructura('MANILLA DER (ALTO)', 'NEGRO', '')).toBe('SML11');
    expect(codigoEstructura('MANILLA IZQ (ALTO)', 'CAFE', '')).toBe('SML12'); // sin tilde
  });

  it('helpers directos y colores sin mapeo', () => {
    expect(codigoPerfilBeeblack('MADERA')).toBe('SML06'); // madera ≡ café
    expect(codigoManillaBeeblack('MADERA')).toBe('SML12');
    expect(codigoPerfilBeeblack('GRIS')).toBe('');
    expect(codigoManillaBeeblack(null)).toBe('');
  });
});
