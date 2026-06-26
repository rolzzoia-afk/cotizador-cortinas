import { describe, expect, it } from 'vitest';
import {
  cortesBeeblack,
  medidaComponenteBeeblack,
  normalizarVarianteBeeblack,
} from './reglas-beeblack';

const medida = (cortes: ReturnType<typeof cortesBeeblack>, nombre: string) =>
  cortes.find((c) => c.componente === nombre)?.medidaCm;

describe('cortesBeeblack — INTERNO golden (200 × 130,1 cm)', () => {
  const cortes = cortesBeeblack('INTERNO', 200, 130.1, {
    manillaIzq: true,
    manillaDer: true,
  });

  it('perfiles ancho y alto', () => {
    expect(medida(cortes, 'Perfil superior (ancho)')).toBe(194.3);
    expect(medida(cortes, 'Perfil inferior (ancho)')).toBe(194.3);
    expect(medida(cortes, 'Perfil lateral izq (alto)')).toBe(124.4);
    expect(medida(cortes, 'Perfil lateral der (alto)')).toBe(124.4);
  });

  it('manillas ON', () => {
    expect(medida(cortes, 'Manilla izq (alto)')).toBe(125.1);
    expect(medida(cortes, 'Manilla der (alto)')).toBe(125.1);
  });

  it('tela y lamas', () => {
    expect(medida(cortes, 'Ancho tela')).toBe(195.3);
    expect(medida(cortes, 'Alto tela')).toBe(126.9);
    expect(medida(cortes, 'Total lamas corte')).toBe(140.2);
  });
});

describe('cortesBeeblack — EXTERNO_SEMI golden (150 × 130, extras ON)', () => {
  const cortes = cortesBeeblack('EXTERNO_SEMI', 150, 130, {
    extraAnchoIzq: true,
    extraAnchoDer: true,
    extraAltoSup: true,
    extraAltoInf: true,
    manillaIzq: true,
    manillaDer: true,
  });

  it('perfiles con extras', () => {
    expect(medida(cortes, 'Perfil superior (ancho)')).toBe(151);
    expect(medida(cortes, 'Perfil inferior (ancho)')).toBe(151);
    expect(medida(cortes, 'Perfil lateral izq (alto)')).toBe(131);
    expect(medida(cortes, 'Perfil lateral der (alto)')).toBe(131);
  });

  it('manillas EXTERNO (alto + 6 − 4,3)', () => {
    expect(medida(cortes, 'Manilla izq (alto)')).toBe(131.7);
    expect(medida(cortes, 'Manilla der (alto)')).toBe(131.7);
  });

  it('tela y lamas ancladas en base ancho con extras', () => {
    expect(medida(cortes, 'Ancho tela')).toBe(151.3);
    expect(medida(cortes, 'Alto tela')).toBe(132.8);
    expect(medida(cortes, 'Total lamas corte')).toBe(110.9);
  });
});

describe('cortesBeeblack — toggles y overrides', () => {
  it('manillas OFF no generan cortes', () => {
    const cortes = cortesBeeblack('INTERNO', 200, 130.1, {});
    expect(medida(cortes, 'Manilla izq (alto)')).toBeUndefined();
    expect(medida(cortes, 'Manilla der (alto)')).toBeUndefined();
  });

  it('override manual de perfil', () => {
    const cortes = cortesBeeblack('INTERNO', 200, 130.1, {}, { perfilSupAncho: 190 });
    expect(medida(cortes, 'Perfil superior (ancho)')).toBe(190);
  });
});

describe('normalizarVarianteBeeblack', () => {
  it('mapea sentido Fase 0', () => {
    expect(normalizarVarianteBeeblack('INTERNO')).toBe('INTERNO');
    expect(normalizarVarianteBeeblack('EXTERNO')).toBe('EXTERNO_SEMI');
    expect(normalizarVarianteBeeblack('SEMI')).toBe('EXTERNO_SEMI');
  });
});

describe('medidaComponenteBeeblack', () => {
  it('devuelve medida de manilla calculada', () => {
    expect(
      medidaComponenteBeeblack('INTERNO', 'manillaIzq', 200, 130.1, {
        manillaIzq: true,
      }),
    ).toBe(125.1);
  });
});
