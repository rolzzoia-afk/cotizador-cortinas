// Goldens de la pizarra BEE-BLACK 2026-07-29 (INTERNO / SEMI / EXTERNO).
// Todas las medidas salen del ancho y el alto REALES con el ajuste de su
// variante; las lamas son UNIDADES (ancho / divisor + 10, entero hacia arriba).
import { describe, expect, it } from 'vitest';
import {
  cortesBeeblack,
  instalacionDefaultBeeblack,
  medidaComponenteBeeblack,
  normalizarInstalacionBeeblack,
  normalizarVarianteBeeblack,
  type VarianteBeeblack,
} from './reglas-beeblack';

const medida = (cortes: ReturnType<typeof cortesBeeblack>, nombre: string) =>
  cortes.find((c) => c.componente === nombre)?.medidaCm;

// ancho 200 · alto 130 en las tres variantes.
const CASOS: Array<{
  variante: VarianteBeeblack;
  perfilAncho: number;
  lateral: number;
  manilla: number;
  anchoTela: number;
  altoTela: number;
  lamas: number;
}> = [
  // 200/1,5 + 10 = 143,33 → 144
  { variante: 'INTERNO', perfilAncho: 194.3, lateral: 124.3, manilla: 125, anchoTela: 195.3, altoTela: 126.8, lamas: 144 },
  // 200/1,55 + 10 = 139,03 → 140 · alto tela = alto − 0,5 MM
  { variante: 'SEMI', perfilAncho: 198, lateral: 128, manilla: 128.7, anchoTela: 199, altoTela: 129.95, lamas: 140 },
  { variante: 'EXTERNO', perfilAncho: 201, lateral: 131, manilla: 131.7, anchoTela: 202, altoTela: 133.5, lamas: 140 },
];

describe('cortesBeeblack — goldens por variante (200 × 130 cm)', () => {
  for (const c of CASOS) {
    it(`${c.variante}`, () => {
      const cortes = cortesBeeblack(c.variante, 200, 130, { manillaIzq: true, manillaDer: true });
      expect(medida(cortes, 'Perfil superior (ancho)'), 'sup').toBe(c.perfilAncho);
      expect(medida(cortes, 'Perfil inferior (ancho)'), 'inf').toBe(c.perfilAncho);
      expect(medida(cortes, 'Perfil lateral izq (alto)'), 'izq').toBe(c.lateral);
      expect(medida(cortes, 'Perfil lateral der (alto)'), 'der').toBe(c.lateral);
      expect(medida(cortes, 'Manilla izq (alto)'), 'manilla izq').toBe(c.manilla);
      expect(medida(cortes, 'Manilla der (alto)'), 'manilla der').toBe(c.manilla);
      expect(medida(cortes, 'Ancho tela'), 'ancho tela').toBe(c.anchoTela);
      expect(medida(cortes, 'Alto tela'), 'alto tela').toBe(c.altoTela);
      expect(medida(cortes, 'Total lamas'), 'lamas').toBe(c.lamas);
    });
  }
});

// Tipos de instalación reales (pizarra 2026-07-30): van pegados a la variante y
// lo ÚNICO que mueven son los perfiles laterales.
describe('instalación BEEBLACK', () => {
  it('EXTERNO fuera del marco corta los laterales 1 cm más largos', () => {
    const cortes = cortesBeeblack('EXTERNO', 200, 130, { manillaIzq: true }, {}, false, 'FUERA_DEL_MARCO');
    expect(medida(cortes, 'Perfil lateral izq (alto)')).toBe(132); // 130 + 2
    expect(medida(cortes, 'Perfil lateral der (alto)')).toBe(132);
  });

  it('el resto de las piezas de EXTERNO no cambia con la instalación', () => {
    const muro = cortesBeeblack('EXTERNO', 200, 130, { manillaIzq: true }, {}, false, 'TECHO_A_MURO');
    const fuera = cortesBeeblack('EXTERNO', 200, 130, { manillaIzq: true }, {}, false, 'FUERA_DEL_MARCO');
    for (const pieza of ['Perfil superior (ancho)', 'Perfil inferior (ancho)', 'Manilla izq (alto)', 'Ancho tela', 'Alto tela', 'Total lamas']) {
      expect(medida(fuera, pieza), pieza).toBe(medida(muro, pieza));
    }
    // Techo a muro es el default de EXTERNO: mismos 131 de la pizarra.
    expect(medida(muro, 'Perfil lateral izq (alto)')).toBe(131);
  });

  it('INTERNO y SEMI ignoran una instalación que no es suya', () => {
    expect(medida(cortesBeeblack('INTERNO', 200, 130, {}, {}, false, 'FUERA_DEL_MARCO'), 'Perfil lateral izq (alto)')).toBe(124.3);
    expect(medida(cortesBeeblack('SEMI', 200, 130, {}, {}, false, 'FUERA_DEL_MARCO'), 'Perfil lateral izq (alto)')).toBe(128);
  });

  it('con cierre vertical el ajuste sigue al lateral (que ahora va sobre el ancho)', () => {
    // Girada 90°: el lateral se corta sobre el ancho real → 200 + 2.
    const cortes = cortesBeeblack('EXTERNO', 200, 130, {}, {}, true, 'FUERA_DEL_MARCO');
    expect(medida(cortes, 'Perfil lateral izq (alto)')).toBe(202);
    expect(medida(cortes, 'Perfil superior (ancho)')).toBe(131); // 130 + 1
  });

  it('normalizarInstalacionBeeblack canoniza contra la variante', () => {
    expect(normalizarInstalacionBeeblack('FUERA_DEL_MARCO', 'EXTERNO')).toBe('FUERA_DEL_MARCO');
    expect(normalizarInstalacionBeeblack('Fuera del marco', 'EXTERNO')).toBe('FUERA_DEL_MARCO');
    // Legacy de la planilla de cotización: no es un tipo real.
    expect(normalizarInstalacionBeeblack('PISO_TECHO_PERFIL_MEDIO', 'EXTERNO')).toBe('TECHO_A_MURO');
    // Instalación de otra variante o vacía → el default de la que se pide.
    expect(normalizarInstalacionBeeblack('FUERA_DEL_MARCO', 'INTERNO')).toBe('DENTRO_DEL_MARCO');
    expect(normalizarInstalacionBeeblack('', 'SEMI')).toBe('TECHO_A_MURO');
    expect(normalizarInstalacionBeeblack(null, 'EXTERNO')).toBe('TECHO_A_MURO');
  });

  it('cada variante tiene su default', () => {
    expect(instalacionDefaultBeeblack('INTERNO')).toBe('DENTRO_DEL_MARCO');
    expect(instalacionDefaultBeeblack('SEMI')).toBe('TECHO_A_MURO');
    expect(instalacionDefaultBeeblack('EXTERNO')).toBe('TECHO_A_MURO');
  });
});

describe('cortesBeeblack — lamas (unidades, hacia arriba)', () => {
  it('siempre entero y hacia arriba', () => {
    // 100/1,5 + 10 = 76,67 → 77
    expect(medida(cortesBeeblack('INTERNO', 100, 130), 'Total lamas')).toBe(77);
    // 155/1,55 + 10 = 110 exacto → 110 (no sube de más)
    expect(medida(cortesBeeblack('SEMI', 155, 130), 'Total lamas')).toBe(110);
    // 155,1/1,55 + 10 = 110,06 → 111
    expect(medida(cortesBeeblack('EXTERNO', 155.1, 130), 'Total lamas')).toBe(111);
  });
});

describe('cortesBeeblack — la tela NO viaja a la hoja de estructura', () => {
  it('tela y lamas sin columna del Excel; perfiles y manillas con la suya', () => {
    const cortes = cortesBeeblack('INTERNO', 200, 130, { manillaIzq: true });
    const col = (nombre: string) => cortes.find((c) => c.componente === nombre)?.columnaExcel;
    expect(col('Ancho tela')).toBe('');
    expect(col('Alto tela')).toBe('');
    expect(col('Total lamas')).toBe('');
    expect(col('Perfil superior (ancho)')).toBe('PERFIL SUPERIOR (ANCHO)');
    expect(col('Manilla izq (alto)')).toBe('MANILLA IZQ (ALTO)');
  });
});

describe('cortesBeeblack — manillas y separadores (opt-in)', () => {
  it('manillas OFF no generan cortes', () => {
    const cortes = cortesBeeblack('INTERNO', 200, 130, {});
    expect(medida(cortes, 'Manilla izq (alto)')).toBeUndefined();
    expect(medida(cortes, 'Manilla der (alto)')).toBeUndefined();
  });

  it('separadores OFF no generan cortes', () => {
    const cortes = cortesBeeblack('INTERNO', 200, 130, {});
    expect(cortes.some((c) => c.columnaExcel.startsWith('SEPARADOR'))).toBe(false);
  });

  it('cada separador hereda la medida del perfil de su lado', () => {
    const cortes = cortesBeeblack('INTERNO', 200, 130, {
      sepIzq: true,
      sepDer: true,
      sepSup: true,
      sepInf: true,
    });
    // Laterales → alto (124,3) · superior e inferior → ancho (194,3).
    expect(medida(cortes, 'Separador izquierdo')).toBe(124.3);
    expect(medida(cortes, 'Separador derecho')).toBe(124.3);
    expect(medida(cortes, 'Separador superior')).toBe(194.3);
    expect(medida(cortes, 'Separador base')).toBe(194.3);
  });

  it('el separador hereda el override del perfil de su lado', () => {
    const cortes = cortesBeeblack('INTERNO', 200, 130, { sepIzq: true }, { perfilLatIzq: 120 });
    expect(medida(cortes, 'Separador izquierdo')).toBe(120);
  });

  it('override propio del separador manda sobre lo heredado', () => {
    const cortes = cortesBeeblack('INTERNO', 200, 130, { sepSup: true }, { sepSup: 180 });
    expect(medida(cortes, 'Separador superior')).toBe(180);
  });
});

describe('cortesBeeblack — overrides', () => {
  it('override manual de perfil', () => {
    const cortes = cortesBeeblack('INTERNO', 200, 130, {}, { perfilSupAncho: 190 });
    expect(medida(cortes, 'Perfil superior (ancho)')).toBe(190);
    expect(medida(cortes, 'Perfil inferior (ancho)')).toBe(194.3); // el otro no se toca
  });

  it('sin ancho o sin alto no hay cortes', () => {
    expect(cortesBeeblack('INTERNO', 0, 130)).toEqual([]);
    expect(cortesBeeblack('INTERNO', 200, 0)).toEqual([]);
  });
});

describe('normalizarVarianteBeeblack', () => {
  it('mapea el sentido de Fase 1', () => {
    expect(normalizarVarianteBeeblack('INTERNO')).toBe('INTERNO');
    expect(normalizarVarianteBeeblack('EXTERNO')).toBe('EXTERNO');
    expect(normalizarVarianteBeeblack('SEMI')).toBe('SEMI');
  });

  it('el valor legacy EXTERNO_SEMI de los paños guardados cae a EXTERNO', () => {
    expect(normalizarVarianteBeeblack('EXTERNO_SEMI')).toBe('EXTERNO');
  });

  it('sin dato usa el fallback', () => {
    expect(normalizarVarianteBeeblack('')).toBe('INTERNO');
    expect(normalizarVarianteBeeblack(null, 'SEMI')).toBe('SEMI');
  });
});

describe('medidaComponenteBeeblack', () => {
  it('devuelve la medida calculada de la manilla', () => {
    expect(medidaComponenteBeeblack('INTERNO', 'manillaIzq', 200, 130)).toBe(125);
    expect(medidaComponenteBeeblack('SEMI', 'manillaDer', 200, 130)).toBe(128.7);
  });
});
