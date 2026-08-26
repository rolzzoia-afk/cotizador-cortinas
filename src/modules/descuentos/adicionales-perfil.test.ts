import { describe, expect, it } from 'vitest';
import {
  buscarAdicionalPerfil,
  colorPerfilDesdeAdicional,
  colorPerfilFilaExcel,
  colorPerfilSistemaDesdeAdicional,
  esAdicionalPerfilSistema,
} from './adicionales-perfil';
import type { AdicionalFase0Persistido } from '@/modules/ots/types';

const adicionalesOscuranti: AdicionalFase0Persistido[] = [
  { codInt: 'P-DER', cantidad: 9, descuento: 0, ubicacion: 'PERFIL DEF', colorAcc: 'CAFÉ' },
  { codInt: 'P-IZQ', cantidad: 9, descuento: 0, ubicacion: 'PERFIL IZQ', colorAcc: 'CAFÉ' },
  { codInt: 'P-INF', cantidad: 3.5, descuento: 0, ubicacion: 'PERFIL INF', colorAcc: 'CAFÉ' },
];

const adicionalesSoft: AdicionalFase0Persistido[] = [
  { codInt: 'SOFTLDER', cantidad: 1, descuento: 0, ubicacion: 'PERFIL DEF', colorAcc: 'BLANCO' },
  { codInt: 'SOFTLIZQ', cantidad: 1, descuento: 0, ubicacion: 'PERFIL IZQ', colorAcc: 'BLANCO' },
];

describe('adicionales-perfil', () => {
  it('encuentra perfil izquierdo oscuranti por codInt y ubicacion', () => {
    const adic = buscarAdicionalPerfil('izq', adicionalesOscuranti, 'OSCURANTI_63mm');
    expect(adic?.codInt).toBe('P-IZQ');
    expect(colorPerfilDesdeAdicional('izq', adicionalesOscuranti, 'OSCURANTI_63mm')).toBe('CAFÉ');
  });

  it('prefiere adicionales SOFT en categoría soft light', () => {
    const mix = [...adicionalesOscuranti, ...adicionalesSoft];
    expect(colorPerfilDesdeAdicional('izq', mix, 'SOFT_LIGHT_38mm')).toBe('BLANCO');
    expect(colorPerfilDesdeAdicional('der', mix, 'SOFT_LIGHT_38mm')).toBe('BLANCO');
  });

  it('colorPerfilFilaExcel prioriza izquierdo si está activo', () => {
    expect(
      colorPerfilFilaExcel(adicionalesOscuranti, 'OSCURANTI_63mm', { izq: true, der: true }),
    ).toBe('CAFÉ');
  });

  it('colorPerfilFilaExcel usa inferior si solo base activo', () => {
    expect(colorPerfilFilaExcel(adicionalesOscuranti, 'OSCURANTI_63mm', { inf: true })).toBe('CAFÉ');
  });
});

// El SISTEMA DARK ROLLER se compra por VENTANA (una fila por ubicación, con su
// color) y no nombra un lado, así que no lo veía ninguna de las funciones de
// arriba: la hoja de estructura y las etiquetas caían al color de la cortina.
describe('colorPerfilSistemaDesdeAdicional', () => {
  const dark: AdicionalFase0Persistido[] = [
    { codInt: 'DARK', cantidad: 1, descuento: 0.25, ubicacion: 'PPAL', colorAcc: 'CAFÉ' },
    { codInt: 'DARK', cantidad: 1, descuento: 0.25, ubicacion: 'JOSEFA', colorAcc: 'BLANCO' },
  ];

  it('reconoce los códigos de sistema', () => {
    expect(esAdicionalPerfilSistema('DARK')).toBe(true);
    expect(esAdicionalPerfilSistema('p-adi')).toBe(true);
    expect(esAdicionalPerfilSistema('P-IZQ')).toBe(false);
    expect(esAdicionalPerfilSistema('CENF C')).toBe(false);
  });

  it('toma el color del adicional de SU ubicación', () => {
    expect(colorPerfilSistemaDesdeAdicional(dark, 'PPAL')).toBe('CAFÉ');
    expect(colorPerfilSistemaDesdeAdicional(dark, 'JOSEFA')).toBe('BLANCO');
  });

  it('acepta la UBIC. con sufijo de paño', () => {
    expect(colorPerfilSistemaDesdeAdicional(dark, 'PPAL-G1')).toBe('CAFÉ');
    expect(colorPerfilSistemaDesdeAdicional(dark, 'JOSEFA P2')).toBe('BLANCO');
  });

  it('no contesta por una ubicación ajena', () => {
    expect(colorPerfilSistemaDesdeAdicional(dark, 'COMEDOR')).toBe('');
  });

  it('un adicional sin ubicación vale para toda la OT, pero pierde con el que calza', () => {
    const conGlobal: AdicionalFase0Persistido[] = [
      ...dark,
      { codInt: 'DARK', cantidad: 1, descuento: 0, ubicacion: '', colorAcc: 'NEGRO' },
    ];
    expect(colorPerfilSistemaDesdeAdicional(conGlobal, 'COMEDOR')).toBe('NEGRO');
    expect(colorPerfilSistemaDesdeAdicional(conGlobal, 'PPAL')).toBe('CAFÉ');
  });

  it('sin ubicación en la fila solo responde si no hay ambigüedad', () => {
    expect(colorPerfilSistemaDesdeAdicional(dark)).toBe('');
    const todosCafe = dark.map((a) => ({ ...a, colorAcc: 'CAFÉ' }));
    expect(colorPerfilSistemaDesdeAdicional(todosCafe)).toBe('CAFÉ');
  });

  it('ignora adicionales sin color, sin cantidad o de otro tipo', () => {
    expect(
      colorPerfilSistemaDesdeAdicional(
        [{ codInt: 'DARK', cantidad: 1, descuento: 0, ubicacion: 'PPAL', colorAcc: '' }],
        'PPAL',
      ),
    ).toBe('');
    expect(
      colorPerfilSistemaDesdeAdicional(
        [{ codInt: 'DARK', cantidad: 0, descuento: 0, ubicacion: 'PPAL', colorAcc: 'CAFÉ' }],
        'PPAL',
      ),
    ).toBe('');
    expect(colorPerfilSistemaDesdeAdicional(adicionalesOscuranti, 'PERFIL IZQ')).toBe('');
  });

  it('el perfil por lado le gana al sistema', () => {
    const mix = [...adicionalesOscuranti, ...dark];
    expect(colorPerfilDesdeAdicional('izq', mix, 'DARK_38mm') || colorPerfilSistemaDesdeAdicional(mix, 'JOSEFA')).toBe(
      'CAFÉ',
    );
  });
});
