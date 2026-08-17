// ─────────────────────────────────────────────────────────────────────
// EQUIVALENCIA — las recetas de fábrica dan lo MISMO que el código viejo.
//
// Antes de este cambio, la lista de materiales de cada familia estaba escrita
// a mano dentro de motorFase0.ts. Ahora son datos. Este test guarda una copia
// LITERAL de aquel código y compara los dos caminos sobre un barrido de
// familias, anchos, cantidades y márgenes.
//
// Los goldens (cotizaciones reales) solo cubren un puñado de combinaciones; el
// barrido cubre los bordes que ellos no ven: los anchos justo en 2,19 / 2,191 /
// 2,20 / 2,50, la cantidad al cuadrado del dúo delux, y las familias con un COD
// que no está en el catálogo de recetas.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { materialesFamilia } from './motorFase0';
import { MARGEN_INSUMO, INSUMO_VALOR_MAXIMO } from './preciosFase0';
import { REGLAS_PRECIOS_DEFAULT, resolverReceta } from './reglasPrecios';

// ── Copia LITERAL del cálculo anterior (no tocar: es la referencia) ────
type Ctx = { n: number; sw: number; wle219: number; wge2191: number; wle250: number; cge220: number };
type MapaInsumos = Record<string, number>;

const mkPv = (margen: number, insumos: MapaInsumos) => (c: string): number => (insumos[c] ?? 0) / margen;
const raw = (c: string, insumos: MapaInsumos): number => insumos[c] ?? 0;

function clasificar(cod: string) {
  const isDuoBk = cod.startsWith('DUOBK');
  const isDuoPoli = cod.startsWith('DUOPOLI');
  const isDuo = isDuoBk || isDuoPoli || cod.startsWith('DUO');
  const isScreen = cod.startsWith('SCREEN');
  const gama = cod.endsWith('_D') ? 'D' : cod.endsWith('_S') ? 'S' : 'P';
  return { isDuoBk, isDuoPoli, isDuo, isScreen, gama };
}

function costoMaterialesViejo(cod: string, ctx: Ctx, margenInsumo: number, insumos: MapaInsumos): number {
  const pv = mkPv(margenInsumo, insumos);
  const { isDuo, isDuoPoli, isScreen, gama } = clasificar(cod);
  const { n, sw, wle219, wge2191, wle250, cge220 } = ctx;
  let m = 0;

  if (!isDuo) {
    if (gama === 'S') {
      m += pv('E 02-1') * (isScreen ? wle219 : wle250);
    } else {
      m += pv('E 02') * wle219 + pv('E 05') * wge2191;
    }
    m += pv('E 15') * sw;
    m += pv('MEC 18') * n;
    m += pv('CAD 03') * n;
    m += pv('TOP 03') * n;
    m += (gama === 'S' ? raw('INS 95', insumos) : pv('INS 95')) * n;
    m += pv('PCA 04') * n;
    m += pv('TAP 01 -19') * n * 2;
    m += pv('ZUN 06') * sw * 2;
    m += pv('PUB 01') * n;
    if (!(isScreen && gama === 'S')) m += pv('MAT00001') * n;
    return m;
  }

  m += pv('E 02') * wle219 + pv('E 05') * wge2191;
  const e26 = sw + (cod === 'DUOBK_P' ? 0.2 : 0);
  m += pv('E 26') * e26;
  if (cod === 'DUOBK_P' || isDuoPoli) {
    m += pv('MIC 01') * sw;
    m += pv('CIN 02') * sw;
  }
  m += pv('E 18') * sw;
  m += pv('E 13') * sw;
  const insRaw = cod === 'DUOBK_D' || cod === 'DUOBK_S' || isDuoPoli;
  m += (insRaw ? raw('INS 95', insumos) : pv('INS 95')) * n;
  m += pv('MEC 09') * n;
  m += pv('MEC 18') * cge220 * 2;
  m += pv('CAD 02') * n;
  m += pv('PCA 04') * n;
  m += pv('ZUN 06') * sw * 2;
  m += pv('TAP 09') * n * 2;
  if (cod === 'DUOBK_P') m += pv('MAT00001') * n;
  else if (cod === 'DUOBK_D' || cod === 'DUOBK_S') m += pv('MAT00001') * n * 2 * n;
  else if (isDuoPoli) m += pv('MAT00001') * 2 * n;
  m += pv('BRA 02') * n * 3;
  m += pv('PUB 01') * n;
  return m;
}

function costoMaterialesVerticalViejo(
  n: number, sw: number, sumAlto: number, margenInsumo: number, insumos: MapaInsumos,
): number {
  const pv = mkPv(margenInsumo, insumos);
  const lamas = (sw / 0.8) * 10;
  let m = 0;
  m += pv('VER 35') * sw;
  m += pv('VER 02') * lamas;
  m += pv('VER 19') * lamas;
  m += pv('VER 03') * lamas;
  m += pv('VER 04') * lamas;
  m += pv('VER 05') * 4;
  m += pv('VER 06') * n * 3;
  m += pv('VER 07') * n;
  m += pv('VER 08') * n;
  m += pv('VER 09') * n;
  m += pv('VER 10') * n;
  m += pv('VER 11') * n * 2;
  m += pv('VER 15') * sumAlto * 2;
  m += pv('VER 22') * sumAlto * 5;
  m += pv('VER 24') * n;
  m += pv('VER 30') * n;
  m += pv('CAD 02') * n;
  m += pv('VER 29') * n;
  m += pv('MAT00001') * n;
  return m;
}

// ── Barrido ───────────────────────────────────────────────────────────
const ANCHOS = [1.0, 2.18, 2.19, 2.1905, 2.191, 2.2, 2.49, 2.5, 2.51, 3.0];
const ALTOS = [1.3, 2.3];
const FAMILIAS = [
  'BLACKOUT_P', 'BLACKOUT_D', 'BLACKOUT_S',
  'SCREEN_P', 'SCREEN_D', 'SCREEN_S',
  'DUOBK_P', 'DUOBK_D', 'DUOBK_S',
  'DUOPOLI_P', 'DUOPOLI_D', 'DUOPOLI_S',
];
// Familias con un COD que no está en el catálogo de recetas: el código viejo
// igual les daba una lista de materiales por parecido, y eso hay que conservarlo.
const FAMILIAS_DESCONOCIDAS = ['FOO_P', 'FOO_D', 'FOO_S', 'SCREENX_S', 'DUO_X', 'DUOBKX_P'];

// Precios de otra época, para probar que el mapa de insumos viaja bien.
const INSUMOS_VIEJOS: MapaInsumos = {
  ...INSUMO_VALOR_MAXIMO,
  'E 02': 3729.1625, 'E 02-1': 3729.1625, 'E 05': 8958.220833, 'VER 11': 3570,
};
const comoReglas = (insumos: MapaInsumos) => ({
  ...REGLAS_PRECIOS_DEFAULT,
  insumos: Object.fromEntries(Object.entries(insumos).map(([k, v]) => [k, { valorMaximo: v }])),
});

const ctxDe = (piezas: { ancho: number; alto: number }[]): Ctx => ({
  n: piezas.length,
  sw: piezas.reduce((s, p) => s + p.ancho, 0),
  wle219: piezas.filter((p) => p.ancho <= 2.19).reduce((s, p) => s + p.ancho, 0),
  wge2191: piezas.filter((p) => p.ancho >= 2.191).reduce((s, p) => s + p.ancho, 0),
  wle250: piezas.filter((p) => p.ancho <= 2.5).reduce((s, p) => s + p.ancho, 0),
  cge220: piezas.filter((p) => p.ancho >= 2.2).length,
});

/** Combinaciones de 1 a 4 cortinas, variando anchos y altos. */
function combinaciones(): { ancho: number; alto: number }[][] {
  const out: { ancho: number; alto: number }[][] = [];
  for (const a of ANCHOS) for (const alto of ALTOS) out.push([{ ancho: a, alto }]);
  for (let i = 0; i < ANCHOS.length; i++) {
    const a = ANCHOS[i];
    const b = ANCHOS[(i + 3) % ANCHOS.length];
    const c = ANCHOS[(i + 7) % ANCHOS.length];
    out.push([{ ancho: a, alto: 1.3 }, { ancho: b, alto: 2.3 }]);
    out.push([{ ancho: a, alto: 2.3 }, { ancho: b, alto: 1.3 }, { ancho: c, alto: 2.0 }]);
    out.push([
      { ancho: a, alto: 1.3 }, { ancho: b, alto: 2.3 },
      { ancho: c, alto: 2.0 }, { ancho: a, alto: 2.3 },
    ]);
  }
  return out;
}

describe('recetas de fábrica ≡ el cálculo de materiales anterior', () => {
  const casos = combinaciones();

  for (const margen of [MARGEN_INSUMO, 0.5]) {
    for (const [etiquetaInsumos, insumos] of [
      ['precios de hoy', INSUMO_VALOR_MAXIMO],
      ['precios de otra época', INSUMOS_VIEJOS],
    ] as const) {
      it(`roller y dúo — margen ${margen} · ${etiquetaInsumos}`, () => {
        const reglas = comoReglas(insumos);
        for (const cod of [...FAMILIAS, ...FAMILIAS_DESCONOCIDAS]) {
          for (const piezas of casos) {
            const viejo = costoMaterialesViejo(cod, ctxDe(piezas), margen, insumos);
            const nuevo = materialesFamilia(
              resolverReceta(cod, false, reglas.recetas), piezas, reglas.insumos, margen,
            );
            expect(
              Math.abs(nuevo.total - viejo),
              `${cod} · ${piezas.map((p) => p.ancho).join('/')}`,
            ).toBeLessThan(1e-6);
            // El total tiene que ser la suma de las líneas que se muestran.
            const suma = nuevo.lineas.reduce((s, l) => s + l.total, 0);
            expect(Math.abs(suma - nuevo.total)).toBeLessThan(1e-9);
          }
        }
      });

      it(`verticales — margen ${margen} · ${etiquetaInsumos}`, () => {
        const reglas = comoReglas(insumos);
        for (const piezas of casos) {
          const n = piezas.length;
          const sw = piezas.reduce((s, p) => s + p.ancho, 0);
          const sumAlto = piezas.reduce((s, p) => s + p.alto, 0);
          const viejo = costoMaterialesVerticalViejo(n, sw, sumAlto, margen, insumos);
          const nuevo = materialesFamilia(
            resolverReceta('SCREEN_V_P', true, reglas.recetas), piezas, reglas.insumos, margen,
          );
          expect(Math.abs(nuevo.total - viejo)).toBeLessThan(1e-6);
        }
      });
    }
  }

  it('la receta vertical es la misma para todas las gamas', () => {
    for (const cod of ['BLACKOUT_V_P', 'BLACKOUT_V_D', 'SCREEN_V_S']) {
      expect(resolverReceta(cod, true)).toBe(resolverReceta('SCREEN_V_P', true));
    }
  });

  it('un dúo desconocido cae en la receta genérica, no en la del dúo premium', () => {
    expect(resolverReceta('DUO_X', false)).toBe(REGLAS_PRECIOS_DEFAULT.recetas.DUO_GENERICO);
    expect(resolverReceta('DUO_X', false)).not.toBe(REGLAS_PRECIOS_DEFAULT.recetas.DUOBK_P);
  });
});
