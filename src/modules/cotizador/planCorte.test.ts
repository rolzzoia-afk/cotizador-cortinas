import { describe, it, expect } from 'vitest';
import {
  extraCmPorTipo,
  rowToPano,
  generarPlanCorte,
  resumenPlan,
  type ColmenaPanoRow,
  type PanoColmena,
} from './planCorte';
import type { OT, VentanaItem } from '@/modules/ots/types';

// ── extraCmPorTipo (Regla 7) ─────────────────────────────────────────
describe('extraCmPorTipo', () => {
  it('DUO: 10 cm extra', () => {
    expect(extraCmPorTipo({ id: 1, producto: 'Roller DUO SC/BK' } as VentanaItem)).toBe(10);
  });

  it('Vertical (producto): 5 cm extra', () => {
    expect(extraCmPorTipo({ id: 1, producto: 'Cortina Vertical 89mm' } as VentanaItem)).toBe(5);
  });

  it('Vertical (tipo): 5 cm extra', () => {
    expect(extraCmPorTipo({ id: 1, tipo: 'vertical' } as VentanaItem)).toBe(5);
  });

  it('Roller SC por default: 25 cm extra', () => {
    expect(extraCmPorTipo({ id: 1, producto: 'Roller SC' } as VentanaItem)).toBe(25);
  });

  it('Roller BK: 25 cm extra', () => {
    expect(extraCmPorTipo({ id: 1, producto: 'Roller BK' } as VentanaItem)).toBe(25);
  });

  it('DUO gana sobre Vertical en conflicto (DUO primero)', () => {
    expect(
      extraCmPorTipo({ id: 1, producto: 'DUO Vertical' } as VentanaItem),
    ).toBe(10);
  });

  it('sin producto ni tipo: default 25', () => {
    expect(extraCmPorTipo({ id: 1 } as VentanaItem)).toBe(25);
  });
});

// ── rowToPano (normalización Supabase → interno) ───────────────────
describe('rowToPano', () => {
  it('normaliza row completo', () => {
    const row: ColmenaPanoRow = {
      id: 'abc-123',
      codigo: 'SC001',
      medida_ancho: 150,
      medida_alto: 200,
      tipo: 'SOBRANTE',
      ubicacion: 'A-30',
      disponible: true,
      ot_asignada: null,
      datos_extra: { creadoEn: '2026-01-15T10:00:00Z', fuente: 'GALPON_ROLZZO' },
    };
    expect(rowToPano(row)).toEqual({
      _docId: 'abc-123',
      cod: 'SC001',
      ancho: 150,
      alto: 200,
      ubicacion: 'A-30',
      tipo: 'SOBRANTE',
      creadoEn: '2026-01-15T10:00:00Z',
    });
  });

  it('usa defaults para campos null/undefined', () => {
    const row: ColmenaPanoRow = {
      id: 'x',
      codigo: null,
      medida_ancho: null,
      medida_alto: null,
      disponible: true,
      ot_asignada: null,
    };
    expect(rowToPano(row)).toEqual({
      _docId: 'x',
      cod: '',
      ancho: 0,
      alto: 0,
      ubicacion: '',
      tipo: '',
      creadoEn: '',
    });
  });
});

// ── generarPlanCorte ────────────────────────────────────────────────
function hacerOT(ventanas: Partial<VentanaItem>[], otNum = '1001'): OT {
  return {
    id: `ot-${otNum}`,
    estado: 'aprobada',
    subEtapa: null,
    datosGenerales: { ot: otNum, cliente: 'Test' },
    storeVentanas: ventanas.map((v, i) => ({ id: i + 1, ...v }) as VentanaItem),
    cotizacionCount: 0,
    fechaCreacion: '2026-01-15T10:00:00Z',
    fechaModificacion: '2026-01-15T10:00:00Z',
    notas: '',
    totalConIva: 0,
  };
}

function pano(cod: string, ancho: number, alto: number, extra: Partial<PanoColmena> = {}): PanoColmena {
  return {
    _docId: `${cod}-${ancho}x${alto}`,
    cod,
    ancho,
    alto,
    ubicacion: 'A-1',
    tipo: extra.tipo || 'SOBRANTE',
    creadoEn: extra.creadoEn || '',
    ...extra,
  };
}

describe('generarPlanCorte', () => {
  it('plan vacío si no hay piezas', () => {
    const plan = generarPlanCorte([], []);
    expect(plan.sobrantes).toEqual([]);
    expect(plan.rollo).toEqual([]);
    expect(plan.sinStock).toEqual([]);
  });

  it('Regla 1: match exacto ancho+alto → va a sobrantes', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    // Pieza: ancho = 1.46m*100 + BORDE(4) = 150, alto = 2.05m*100 + extra(25) = 230
    const sobrante = pano('SC001', 150, 230);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].regla).toBe(1);
    expect(plan.sobrantes[0].sobranteAncho).toBeNull();
    expect(plan.rollo).toHaveLength(0);
    expect(plan.sinStock).toHaveLength(0);
  });

  it('Regla 2: ancho mayor genera sobranteAncho si excede MIN_SOB (30)', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    // Pieza: 150x230. Sobrante: 200x235 → excede 50cm de ancho y 5cm de alto
    const sobrante = pano('SC001', 200, 235);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].regla).toBe(2);
    expect(plan.sobrantes[0].sobranteAncho).toEqual({
      cod: 'SC001',
      ancho: 50, // 200 - 150
      alto: 235,
    });
  });

  it('no matchea si el sobrante es más chico que la pieza', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 2.0, alto: 2.0 }],
      },
    ]);
    // Pieza 204x225, sobrante 100x100 no alcanza
    const sobrante = pano('SC001', 100, 100);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes).toHaveLength(0);
    // Cae a rollo
    expect(plan.rollo.length).toBeGreaterThan(0);
  });

  it('piezas de codInt distinto no compiten por el mismo sobrante', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'L1',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
      {
        codInt: 'BK002',
        producto: 'Roller BK',
        ubicacion: 'L2',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    const sobranteSC = pano('SC001', 150, 230);
    const plan = generarPlanCorte([ot], [sobranteSC]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].sobrante.cod).toBe('SC001');
    // BK002 sin sobrante → rollo
    expect(plan.rollo).toHaveLength(1);
    expect(plan.rollo[0].codInt).toBe('BK002');
  });

  it('un mismo sobrante no se asigna a dos piezas', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 1.46, alto: 2.05 }] },
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L2', panos: [{ ancho: 1.46, alto: 2.05 }] },
    ]);
    const sobrante = pano('SC001', 150, 230);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes).toHaveLength(1);
    // La segunda pieza cayó a rollo
    expect(plan.rollo.length).toBeGreaterThan(0);
  });

  it('Regla 3: prioridad por tipo (FALLA antes que SOBRANTE)', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 1.46, alto: 2.05 }] },
    ]);
    const sobrante = pano('SC001', 150, 230, { _docId: 'normal', tipo: 'SOBRANTE' });
    const falla = pano('SC001', 150, 230, { _docId: 'falla', tipo: 'FALLA' });
    const plan = generarPlanCorte([ot], [sobrante, falla]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].sobrante._docId).toBe('falla');
  });

  it('Regla 4: FIFO por creadoEn dentro del mismo tipo', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 1.46, alto: 2.05 }] },
    ]);
    const nuevo = pano('SC001', 150, 230, { _docId: 'nuevo', creadoEn: '2026-02-01T00:00:00Z' });
    const viejo = pano('SC001', 150, 230, { _docId: 'viejo', creadoEn: '2026-01-01T00:00:00Z' });
    const plan = generarPlanCorte([ot], [nuevo, viejo]);
    expect(plan.sobrantes[0].sobrante._docId).toBe('viejo');
  });

  it('pieza sin codInt: no debería matchear sobrantes (queda en rollo o sinStock)', () => {
    const ot = hacerOT([
      { codInt: '', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 1.46, alto: 2.05 }] },
    ]);
    const sobrante = pano('SC001', 150, 230);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes).toHaveLength(0);
  });

  it('DUO dobla la altura de la pieza (Regla 7)', () => {
    const ot = hacerOT([
      {
        codInt: 'DUO001',
        producto: 'Roller DUO',
        ubicacion: 'L1',
        panos: [{ ancho: 1.0, alto: 2.0 }],
      },
    ]);
    // DUO: alto pieza = round(2.0*100)*2 + 10 = 410. ancho = 100+4 = 104.
    const sobrante = pano('DUO001', 104, 410);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].sobrante.alto).toBe(410);
  });

  it('múltiples OTs: label incluye OT cuando multiOT', () => {
    const ot1 = hacerOT([{ codInt: 'SC001', producto: 'Roller SC', ubicacion: 'Living', panos: [{ ancho: 1.0, alto: 2.0 }] }], '100');
    const ot2 = hacerOT([{ codInt: 'SC001', producto: 'Roller SC', ubicacion: 'Living', panos: [{ ancho: 1.0, alto: 2.0 }] }], '200');
    const sobrante = pano('SC001', 104, 225);
    const plan = generarPlanCorte([ot1, ot2], [sobrante]);
    const labels = [
      ...plan.sobrantes.flatMap((g) => g.placed.map((p) => p.nombre)),
      ...plan.rollo.flatMap((g) => g.placed.map((p) => p.nombre)),
    ];
    expect(labels.some((l) => l.includes('OT100'))).toBe(true);
    expect(labels.some((l) => l.includes('OT200'))).toBe(true);
  });

  it('incluye otsIncluidas con num y cliente', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 1.0, alto: 2.0 }] },
    ], '555');
    const plan = generarPlanCorte([ot], []);
    expect(plan.otsIncluidas).toEqual([
      { id: 'ot-555', num: '555', cliente: 'Test' },
    ]);
  });

  it('packing de rollo: 1 pieza grande sin sobrantes cae a rollo', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 2.5, alto: 2.0 }] },
    ]);
    const plan = generarPlanCorte([ot], []);
    expect(plan.rollo).toHaveLength(1);
    expect(plan.rollo[0].codInt).toBe('SC001');
    expect(plan.rollo[0].placed.length).toBeGreaterThan(0);
    // Eficiencia razonable (>0)
    expect(plan.rollo[0].efic).toBeGreaterThan(0);
  });

  it('piezas con ambas dimensiones > rollo (298cm) caen a sinStock', () => {
    // Pieza 5m × 5m: ancho=504 y alto=525 post-margen, ambos > 298 → imposible
    // de packear incluso rotando.
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'L1',
        panos: [{ ancho: 5.0, alto: 5.0 }],
      },
    ]);
    const plan = generarPlanCorte([ot], []);
    expect(plan.sinStock.length).toBeGreaterThan(0);
    expect(plan.sinStock[0].codInt).toBe('SC001');
  });

  it('ventana sin panos se ignora', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', panos: [] },
    ]);
    const plan = generarPlanCorte([ot], []);
    expect(plan.sobrantes).toHaveLength(0);
    expect(plan.rollo).toHaveLength(0);
    expect(plan.sinStock).toHaveLength(0);
  });
});

// ── resumenPlan ────────────────────────────────────────────────────
describe('resumenPlan', () => {
  it('suma piezas de sobrantes + rollo + sinStock', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 1.46, alto: 2.05 }] },
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L2', panos: [{ ancho: 1.46, alto: 2.05 }] },
    ]);
    const sobrante = pano('SC001', 150, 230);
    const plan = generarPlanCorte([ot], [sobrante]);
    const r = resumenPlan(plan);
    expect(r.totalPiezas).toBe(2);
    expect(r.desdeSobrante).toBe(1);
    expect(r.desdeRollo + r.sinStock).toBe(1);
  });

  it('plan vacío: todo en 0', () => {
    const r = resumenPlan({ sobrantes: [], rollo: [], sinStock: [], otsIncluidas: [] });
    expect(r).toEqual({ totalPiezas: 0, desdeSobrante: 0, desdeRollo: 0, sinStock: 0 });
  });
});
