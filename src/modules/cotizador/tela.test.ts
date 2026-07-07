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
import { PARAMETROS_CORTE_DEFAULT } from './parametrosCorte';
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

  it('DUO: reserva altoReal = 2×(alto+0,25) y corte real = 2×alto+0,30', () => {
    const rows = buildOptimizerRows(
      [v({ producto: 'Roller DUO', panos: [{ ancho: 1, alto: 2 }] })],
      cat,
    );
    expect(rows[0].isDuo).toBe(true);
    expect(rows[0].altoReal).toBeCloseTo(4.5, 2); // 2×(2+0,25)
    expect(rows[0].altoCorte).toBeCloseTo(4.3, 2); // 2×2+0,30
  });

  it('no-DUO: altoCorte = altoReal = alto+0,25', () => {
    const rows = buildOptimizerRows([v({ panos: [{ ancho: 1, alto: 2 }] })], cat);
    expect(rows[0].isDuo).toBe(false);
    expect(rows[0].altoCorte).toBeCloseTo(2.25, 2);
    expect(rows[0].altoReal).toBeCloseTo(2.25, 2);
  });

  it('parámetros custom: extraAltoCm/extraDuoCm/anchoRolloDefaultM gobiernan la geometría', () => {
    const params = { ...PARAMETROS_CORTE_DEFAULT, extraAltoCm: 30, extraDuoCm: 40, anchoRolloDefaultM: 2.5 };
    const roller = buildOptimizerRows([v({ panos: [{ ancho: 1, alto: 2 }] })], cat, params);
    expect(roller[0].extra).toBeCloseTo(0.3, 3);
    expect(roller[0].altoExtra).toBeCloseTo(2.3, 2);
    expect(roller[0].altoCorte).toBeCloseTo(2.3, 2);
    const duo = buildOptimizerRows(
      [v({ producto: 'Roller DUO', codInt: 'NO-EN-CAT', panos: [{ ancho: 1, alto: 2 }] })],
      cat,
      params,
    );
    expect(duo[0].altoReal).toBeCloseTo(4.6, 2); // 2×(2+0,30)
    expect(duo[0].altoCorte).toBeCloseTo(4.4, 2); // 2×2+0,40
    expect(duo[0].anchoRollo).toBeCloseTo(2.5, 2); // default custom (codInt fuera de catálogo)
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

  it('propaga sentido y direccion de la ventana a la fila (etiqueta)', () => {
    const rows = buildOptimizerRows(
      [v({ sentido: 'INTERNO', direccion: 'CAD [DERECHA]' } as Partial<VentanaItem>)],
      cat,
    );
    expect(rows[0].sentido).toBe('INTERNO');
    expect(rows[0].direccion).toBe('CAD [DERECHA]');
  });

  it('deriva tuberiaCod del modelo aunque el chip del paño venga vacío', () => {
    const modelo = { diametro_tubo_mm: 38, sistema: 'ROLLER', codigos_tubo: 'E02;E66' };
    const rows = buildOptimizerRows(
      [v({ categoria: 'ROL', modelo, panos: [{ ancho: 1.5, alto: 2.0 }] } as Partial<VentanaItem>)],
      cat,
    );
    // ancho 1,5 m ≤ 2,2 m → E02 (regla por ancho), sin chip elegido a mano.
    expect(rows[0].tuberiaCod).toBe('38mm_E02');
  });

  it('respeta el tubo elegido a mano en el chip del paño', () => {
    const modelo = { diametro_tubo_mm: 38, sistema: 'ROLLER', codigos_tubo: 'E02;E66' };
    const rows = buildOptimizerRows(
      [v({ categoria: 'ROL', modelo, panos: [{ ancho: 1.5, alto: 2.0, tuberia: '0,38mm [E66] 1,2mm' }] } as Partial<VentanaItem>)],
      cat,
    );
    expect(rows[0].tuberiaCod).toBe('38mm_E66');
  });

  it('piezas: cenefa ovalada usa el despiece real (medida) + código por estructura', () => {
    const modelo = {
      sistema: 'CENEFA_OVALADA',
      tipo_rol: 'ROL_CENEFA_OV_MANUAL_38mm',
      diametro_tubo_mm: 38,
      codigos_tubo: 'E02;E66',
      dcto_tubo_cm: 1.8,
      dcto_cenefa_cm: 1.5,
      suma_peso_cm: 0.1,
    };
    const rows = buildOptimizerRows(
      [v({ modelo, color: 'NEGRO', panos: [{ ancho: 1.565, alto: 2.726 }] } as Partial<VentanaItem>)],
      cat,
    );
    const piezas = rows[0].piezas || [];
    const tubo = piezas.find((p) => p.columnaExcel === 'TUBO');
    const peso = piezas.find((p) => p.columnaExcel === 'PESO');
    const cenefa = piezas.find((p) => p.columnaExcel === 'CENEFA OVALADA');
    // Medidas reales (no la resta hardcodeada ancho−3.8/−4.2).
    expect(tubo?.medidaCm).toBe(153.2); // 156.5 − 1.8 − 1.5
    expect(peso?.medidaCm).toBe(152.8); // tubo − 0.4
    expect(cenefa?.medidaCm).toBe(155); // 156.5 − 1.5
    // Códigos: tubo del catálogo de tubería; cenefa/peso color-fijo (NEGRO).
    expect(tubo?.cod).toBe('38mm_E02');
    expect(peso?.cod).toBe('E14'); // peso roller negro
    expect(cenefa?.cod).toBe('E26'); // cenefa ovalada negro
    expect(cenefa?.color).toBe('NEGRO');
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
    altoCorte: 2.25,
    isDuo: false,
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
  it('Camila (OT 3048) — paños dúo: igual o mejor que el Excel, nunca inferior', () => {
    // 4 dúos DU 28 (rollo 2,95). El Excel corta 3 paños / 14,7 m
    // (0,595+2,18 juntos; 1,61 y 1,66 solos). La app debe igualar o mejorar.
    const cat = mkCat({ 'DU 28': { anchoRollo: 2.95, producto: 'ROLLER DUO BLACKOUT PREMIUM' } });
    const rows = buildOptimizerRows(
      [
        { id: 1, ubicacion: 'LIVING IZQ-G1', codInt: 'DU 28', producto: 'ROLLER DUO BLACKOUT PREMIUM', panos: [{ ancho: 1.66, alto: 2.3 }] },
        { id: 2, ubicacion: 'LIVING DER-G1', codInt: 'DU 28', producto: 'ROLLER DUO BLACKOUT PREMIUM', panos: [{ ancho: 1.61, alto: 2.3 }] },
        { id: 3, ubicacion: 'OFICINA-G2', codInt: 'DU 28', producto: 'ROLLER DUO BLACKOUT PREMIUM', panos: [{ ancho: 0.595, alto: 1.015 }] },
        { id: 4, ubicacion: 'PPAL-G3', codInt: 'DU 28', producto: 'ROLLER DUO BLACKOUT PREMIUM', panos: [{ ancho: 2.18, alto: 2.3 }] },
      ],
      cat,
    );
    const out = autoOptimizar(rows);
    const { panos } = calcularPanos(out);

    // Cortes idénticos al Excel: ancho −3,5 y alto = 2×alto+0,30.
    const porUbic = Object.fromEntries(panos.map((p) => [out[panos.indexOf(p)].ubicacion, p]));
    expect(porUbic['LIVING IZQ-G1'].anchoCorteCm).toBeCloseTo(162.5, 1);
    expect(porUbic['LIVING IZQ-G1'].altoCorteCm).toBeCloseTo(490, 1);
    expect(porUbic['OFICINA-G2'].anchoCorteCm).toBeCloseTo(56, 1);
    expect(porUbic['OFICINA-G2'].altoCorteCm).toBeCloseTo(233, 1);

    // Optimización ≥ Excel: a lo más 3 paños y a lo más 14,7 m de tela cortada.
    const grupos = new Map<string | number, number>();
    for (const r of out) {
      const alto = r.altoCorte;
      grupos.set(r.numeroPano, Math.max(grupos.get(r.numeroPano) ?? 0, alto));
    }
    const metros = [...grupos.values()].reduce((s, a) => s + a, 0);
    expect(grupos.size).toBeLessThanOrEqual(3);
    expect(metros).toBeLessThanOrEqual(14.7 + 1e-9);
  });

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

  it('agrupa distinto alto en un mismo paño mientras entren a lo ancho', () => {
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
    // 3 cortinas de ancho 1 (Σ=3 ≤ rollo 3), distinto alto → un solo paño (nº 1).
    expect(out.map((r) => r.numeroPano)).toEqual([1, 1, 1]);
    expect(new Set(out.map((r) => r.junto)).size).toBe(1);
  });

  it('empieza nuevo paño cuando el ancho acumulado supera el rollo', () => {
    const cat = mkCat({ A: { anchoRollo: 2.98 } });
    const rows = buildOptimizerRows(
      [
        { id: 1, ubicacion: 'L1', codInt: 'A', producto: 'x', panos: [{ ancho: 1.6, alto: 2 }] },
        { id: 2, ubicacion: 'L2', codInt: 'A', producto: 'x', panos: [{ ancho: 1.6, alto: 3 }] },
      ],
      cat,
    );
    const out = autoOptimizar(rows);
    // 1,6 + 1,6 = 3,2 > 2,98 → cada una su paño (aunque compartan COD_INT).
    expect(new Set(out.map((r) => r.numeroPano)).size).toBe(2);
  });

  it('best-fit: anchos 1,5/1,5/1,0/1,0 en rollo 2,98 → 2 paños (next-fit daba 3)', () => {
    const cat = mkCat({ A: { anchoRollo: 2.98 } });
    const rows = buildOptimizerRows(
      [
        { id: 1, ubicacion: 'L1', codInt: 'A', producto: 'x', panos: [{ ancho: 1.5, alto: 2 }] },
        { id: 2, ubicacion: 'L2', codInt: 'A', producto: 'x', panos: [{ ancho: 1.5, alto: 2 }] },
        { id: 3, ubicacion: 'L3', codInt: 'A', producto: 'x', panos: [{ ancho: 1.0, alto: 2 }] },
        { id: 4, ubicacion: 'L4', codInt: 'A', producto: 'x', panos: [{ ancho: 1.0, alto: 2 }] },
      ],
      cat,
    );
    const out = autoOptimizar(rows);
    // Cada 1,5 se empareja con un 1,0 (2,5 ≤ 2,98) → 2 paños, no 3.
    const panos = new Set(out.map((r) => r.numeroPano));
    expect(panos.size).toBe(2);
    // Cada paño usa 1,5 + 1,0 = 2,5 m de ancho (máximo acumulado del grupo).
    for (const p of panos) {
      const anchoUsado = Math.max(...out.filter((r) => r.numeroPano === p).map((r) => r.anchoPano));
      expect(anchoUsado).toBeCloseTo(2.5, 5);
    }
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

  it('descAnchoCorteCm custom cambia el ancho de corte', () => {
    const rows = buildOptimizerRows(
      [{ id: 1, ubicacion: 'L', codInt: 'SC', producto: 'p', panos: [{ ancho: 1.5, alto: 2.0 }] }],
      cat,
    );
    const { panos } = calcularPanos(rows, { ...PARAMETROS_CORTE_DEFAULT, descAnchoCorteCm: 4 });
    expect(panos[0].anchoCorteCm).toBe(146); // 150 − 4
  });
});
