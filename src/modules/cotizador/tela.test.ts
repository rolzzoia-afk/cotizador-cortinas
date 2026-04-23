import { describe, it, expect } from 'vitest';
import {
  derivarCod,
  obtenerAnchoRollo,
  buildOptimizerRows,
  restorePlanGuardado,
  asignarJuntoEnOrden,
  autoOptimizar,
  calcularPanos,
  type OptimizerRow,
} from './tela';
import type { CatalogoProductos, Producto } from './types';
import type { VentanaItem } from '@/modules/ots/types';

// Helper: construye un Producto con defaults razonables
// (los tests solo leen anchoRollo, el resto es ruido).
function mkCat(entries: Record<string, Partial<Producto>>): CatalogoProductos {
  const out: CatalogoProductos = {};
  for (const [k, v] of Object.entries(entries)) {
    out[k] = {
      cod: k,
      producto: v.producto || 'p',
      tipo: v.tipo || '',
      descripcion: v.descripcion || '',
      precio: v.precio ?? 0,
      anchoRollo: v.anchoRollo,
    };
  }
  return out;
}

// ── derivarCod ────────────────────────────────────────────────────
describe('derivarCod', () => {
  it('forma codigo desde producto con múltiples palabras', () => {
    expect(derivarCod('Roller Screen')).toBe('ROLLER_S');
    expect(derivarCod('Roller Blackout')).toBe('ROLLER_B');
  });

  it('forma codigo desde una sola palabra', () => {
    expect(derivarCod('Cortina')).toBe('CORTINA');
  });

  it('retorna UNKNOWN cuando input vacío', () => {
    expect(derivarCod('')).toBe('UNKNOWN');
    expect(derivarCod('   ')).toBe('UNKNOWN');
  });

  it('usa la inicial del último token (funciona con multi-palabra)', () => {
    expect(derivarCod('Roller DUO Screen Black')).toBe('ROLLER_B');
  });
});

// ── obtenerAnchoRollo ────────────────────────────────────────────
describe('obtenerAnchoRollo', () => {
  const cat = mkCat({
    SC001: { anchoRollo: 2.5 },
    BK002: { anchoRollo: '3.2' },
    NoRollo: {},
  });

  it('retorna ancho del catálogo si existe', () => {
    expect(obtenerAnchoRollo('SC001', cat)).toBe(2.5);
  });

  it('parsea string a number', () => {
    expect(obtenerAnchoRollo('BK002', cat)).toBe(3.2);
  });

  it('default 2.98 si codInt ausente', () => {
    expect(obtenerAnchoRollo(null, cat)).toBe(2.98);
    expect(obtenerAnchoRollo(undefined, cat)).toBe(2.98);
    expect(obtenerAnchoRollo('', cat)).toBe(2.98);
  });

  it('default 2.98 si codInt no está en catálogo', () => {
    expect(obtenerAnchoRollo('OTRO', cat)).toBe(2.98);
  });

  it('default 2.98 si producto no tiene anchoRollo', () => {
    expect(obtenerAnchoRollo('NoRollo', cat)).toBe(2.98);
  });
});

// ── buildOptimizerRows ───────────────────────────────────────────
describe('buildOptimizerRows', () => {
  const cat = mkCat({ SC001: { anchoRollo: 2.98 } });

  function v(overrides: Partial<VentanaItem> = {}): VentanaItem {
    return {
      id: 'v1',
      ubicacion: 'Living',
      codInt: 'SC001',
      producto: 'Roller SC',
      panos: [{ ancho: 1.5, alto: 2.0 }],
      ...overrides,
    };
  }

  it('genera una fila por paño', () => {
    const rows = buildOptimizerRows([v({ panos: [{ ancho: 1, alto: 2 }, { ancho: 1, alto: 2 }] })], cat);
    expect(rows).toHaveLength(2);
  });

  it('calcula altoExtra = alto + 0.25 y m2 correcto', () => {
    const rows = buildOptimizerRows([v({ panos: [{ ancho: 1.5, alto: 2.0 }] })], cat);
    expect(rows[0].altoExtra).toBeCloseTo(2.25, 2);
    expect(rows[0].altoReal).toBeCloseTo(2.25, 2);
    expect(rows[0].m2).toBeCloseTo(3.375, 3);
  });

  it('DUO duplica altoReal', () => {
    const rows = buildOptimizerRows(
      [v({ producto: 'Roller DUO', panos: [{ ancho: 1, alto: 2 }] })],
      cat,
    );
    expect(rows[0].altoReal).toBeCloseTo(4.5, 2);
  });

  it('sufija ubicación con P1/P2 cuando hay múltiples paños', () => {
    const rows = buildOptimizerRows(
      [v({ panos: [{ ancho: 1, alto: 2 }, { ancho: 1, alto: 2 }] })],
      cat,
    );
    expect(rows[0].ubicacion).toContain('P1');
    expect(rows[1].ubicacion).toContain('P2');
  });

  it('sin panos: ignora la ventana', () => {
    const rows = buildOptimizerRows([v({ panos: [] })], cat);
    expect(rows).toHaveLength(0);
  });

  it('rowIdx es correlativo y empieza en 1', () => {
    const rows = buildOptimizerRows(
      [
        v({ panos: [{ ancho: 1, alto: 2 }] }),
        v({ panos: [{ ancho: 1, alto: 2 }, { ancho: 1, alto: 2 }] }),
      ],
      cat,
    );
    expect(rows.map((r) => r.rowIdx)).toEqual([1, 2, 3]);
  });
});

// ── restorePlanGuardado ──────────────────────────────────────────
describe('restorePlanGuardado', () => {
  const mkRow = (i: number): OptimizerRow => ({
    rowIdx: i,
    cod: 'X',
    cant: 1,
    producto: 'P',
    codInt: 'C',
    tipo: '',
    ancho: 1,
    alto: 2,
    anchoCm: 100,
    altoCm: 200,
    extra: 0.25,
    altoExtra: 2.25,
    altoReal: 2.25,
    m2: 2.25,
    anchoRollo: 2.98,
    anchoPano: 1,
    numeroPano: '',
    junto: '',
    ubicacion: `U${i}`,
    ventanaId: i,
    panoIndex: 0,
  });

  it('pisa campos editables si la cantidad de filas coincide', () => {
    const base = [mkRow(1), mkRow(2)];
    const guardadas = [
      { anchoPano: 1.5, numeroPano: 5, junto: 'A' },
      { anchoPano: 2.5, numeroPano: 6, junto: 'B' },
    ];
    const out = restorePlanGuardado(base, guardadas);
    expect(out[0].junto).toBe('A');
    expect(out[0].anchoPano).toBe(1.5);
    expect(out[0].numeroPano).toBe(5);
    expect(out[1].junto).toBe('B');
    // Campos no editables no se tocan
    expect(out[0].ubicacion).toBe('U1');
  });

  it('retorna rows intactas si la cantidad no coincide', () => {
    const base = [mkRow(1), mkRow(2)];
    const out = restorePlanGuardado(base, [{ junto: 'A' }]);
    expect(out).toBe(base);
  });

  it('retorna rows intactas si guardadas no es array', () => {
    const base = [mkRow(1)];
    expect(restorePlanGuardado(base, undefined)).toBe(base);
  });
});

// ── asignarJuntoEnOrden ─────────────────────────────────────────
describe('asignarJuntoEnOrden', () => {
  it('agrupa filas con mismo codInt + altoReal bajo mismo junto', () => {
    const cat = mkCat({ SC: { anchoRollo: 3 } });
    const rows = buildOptimizerRows(
      [
        { id: 1, ubicacion: 'L', codInt: 'SC', producto: 'p', panos: [{ ancho: 1, alto: 2 }] },
        { id: 2, ubicacion: 'L', codInt: 'SC', producto: 'p', panos: [{ ancho: 1, alto: 2 }] },
      ],
      cat,
    );
    const out = asignarJuntoEnOrden(rows);
    expect(out[0].junto).toBe(out[1].junto); // mismo grupo
    expect(out[0].anchoPano).toBe(1);
    expect(out[1].anchoPano).toBe(2); // acumulado
  });

  it('empieza nuevo junto si excede ancho del rollo', () => {
    const cat = mkCat({ SC: { anchoRollo: 3 } });
    const rows = buildOptimizerRows(
      [
        { id: 1, ubicacion: 'L', codInt: 'SC', producto: 'p', panos: [{ ancho: 2, alto: 2 }] },
        { id: 2, ubicacion: 'L', codInt: 'SC', producto: 'p', panos: [{ ancho: 2, alto: 2 }] },
      ],
      cat,
    );
    const out = asignarJuntoEnOrden(rows);
    expect(out[0].junto).not.toBe(out[1].junto);
  });

  it('asigna RR a fila que excede ancho del rollo sola', () => {
    const cat = mkCat({ SC: { anchoRollo: 2.98 } });
    const rows = buildOptimizerRows(
      [{ id: 1, ubicacion: 'L', codInt: 'SC', producto: 'p', panos: [{ ancho: 3.5, alto: 2 }] }],
      cat,
    );
    const out = asignarJuntoEnOrden(rows);
    expect(out[0].junto).toBe('RR');
  });

  it('empieza nuevo junto si cambia codInt', () => {
    const cat = mkCat({ A: { anchoRollo: 3 }, B: { anchoRollo: 3 } });
    const rows = buildOptimizerRows(
      [
        { id: 1, ubicacion: 'L', codInt: 'A', producto: 'x', panos: [{ ancho: 1, alto: 2 }] },
        { id: 2, ubicacion: 'L', codInt: 'B', producto: 'y', panos: [{ ancho: 1, alto: 2 }] },
      ],
      cat,
    );
    const out = asignarJuntoEnOrden(rows);
    expect(out[0].junto).not.toBe(out[1].junto);
  });
});

// ── autoOptimizar ──────────────────────────────────────────────
describe('autoOptimizar', () => {
  it('ordena por codInt asc, luego por altoReal desc', () => {
    const cat = mkCat({ A: { anchoRollo: 3 }, B: { anchoRollo: 3 } });
    const rows = buildOptimizerRows(
      [
        { id: 1, ubicacion: 'L1', codInt: 'B', producto: 'y', panos: [{ ancho: 1, alto: 1 }] },
        { id: 2, ubicacion: 'L2', codInt: 'A', producto: 'x', panos: [{ ancho: 1, alto: 3 }] },
        { id: 3, ubicacion: 'L3', codInt: 'A', producto: 'x', panos: [{ ancho: 1, alto: 1 }] },
      ],
      cat,
    );
    const out = autoOptimizar(rows);
    expect(out.map((r) => r.codInt)).toEqual(['A', 'A', 'B']);
    // A con mayor alto primero
    expect(out[0].altoReal).toBeGreaterThan(out[1].altoReal);
  });

  it('asigna numeroPano correlativo por grupo', () => {
    const cat = mkCat({ A: { anchoRollo: 3 } });
    const rows = buildOptimizerRows(
      [
        { id: 1, ubicacion: 'L1', codInt: 'A', producto: 'x', panos: [{ ancho: 1, alto: 2 }] },
        { id: 2, ubicacion: 'L2', codInt: 'A', producto: 'x', panos: [{ ancho: 1, alto: 2 }] },
        { id: 3, ubicacion: 'L3', codInt: 'A', producto: 'x', panos: [{ ancho: 1, alto: 3 }] },
      ],
      cat,
    );
    const out = autoOptimizar(rows);
    // Dos de alto 2 juntos (pano 2 después de ordenar), uno de alto 3 (pano 1).
    const panoAlto3 = out.find((r) => r.altoReal > 3);
    expect(panoAlto3?.numeroPano).toBe(1);
  });
});

// ── calcularPanos ───────────────────────────────────────────────
describe('calcularPanos', () => {
  const cat = mkCat({ SC: { anchoRollo: 2.98 } });

  it('anchoCorte = ancho − 3.5, altoCorte = alto + 25', () => {
    const rows = buildOptimizerRows(
      [{ id: 1, ubicacion: 'L', codInt: 'SC', producto: 'p', panos: [{ ancho: 1.5, alto: 2.0 }] }],
      cat,
    );
    const { panos } = calcularPanos(rows);
    expect(panos[0].anchoCorteCm).toBe(146.5); // 150 - 3.5
    expect(panos[0].altoCorteCm).toBe(225); // 200 + 25
  });

  it('totalM2 suma los m2 calculados por paño', () => {
    const rows = buildOptimizerRows(
      [
        { id: 1, ubicacion: 'L', codInt: 'SC', producto: 'p', panos: [{ ancho: 1, alto: 2 }] },
        { id: 2, ubicacion: 'L', codInt: 'SC', producto: 'p', panos: [{ ancho: 1, alto: 2 }] },
      ],
      cat,
    );
    const { totalM2, totalPanos } = calcularPanos(rows);
    expect(totalPanos).toBe(2);
    // cada paño: (100/100) * (225/100) = 2.25 m2 → 4.5 total
    expect(totalM2).toBeCloseTo(4.5, 2);
  });

  it('plan vacío: totales en 0', () => {
    expect(calcularPanos([])).toEqual({ panos: [], totalM2: 0, totalPanos: 0 });
  });
});
