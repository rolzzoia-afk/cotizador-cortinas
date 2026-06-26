import { describe, expect, it } from 'vitest';
import {
  buscarAdicionalPerfil,
  colorPerfilDesdeAdicional,
  colorPerfilFilaExcel,
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
