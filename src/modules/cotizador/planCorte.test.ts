import { describe, it, expect } from 'vitest';
import {
  esLayoutGuillotina,
  extraCmPorTipo,
  guillotinaPack,
  rowToPano,
  generarPlanCorte,
  resumenPlan,
  secuenciaCortes,
  type ColmenaPanoRow,
  type PanoColmena,
  type Pieza,
  type Placed,
} from './planCorte';
import type { OT, VentanaItem } from '@/modules/ots/types';
import { PARAMETROS_CORTE_DEFAULT } from './parametrosCorte';

// ── extraCmPorTipo (Regla 7) ─────────────────────────────────────────
describe('extraCmPorTipo', () => {
  it('DUO: 30 cm extra (corte real 2×alto+30, como tela.ts y el Excel)', () => {
    expect(extraCmPorTipo({ id: 1, producto: 'Roller DUO SC/BK' } as VentanaItem)).toBe(30);
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
    ).toBe(30);
  });

  it('sin producto ni tipo: default 25', () => {
    expect(extraCmPorTipo({ id: 1 } as VentanaItem)).toBe(25);
  });

  it('params custom: cada tipo usa su clave (extraDuoCm/extraVerticalCm/extraAltoCm)', () => {
    const params = { ...PARAMETROS_CORTE_DEFAULT, extraDuoCm: 40, extraVerticalCm: 8, extraAltoCm: 30 };
    expect(extraCmPorTipo({ id: 1, producto: 'Roller DUO' } as VentanaItem, params)).toBe(40);
    expect(extraCmPorTipo({ id: 1, tipo: 'vertical' } as VentanaItem, params)).toBe(8);
    expect(extraCmPorTipo({ id: 1, producto: 'Roller SC' } as VentanaItem, params)).toBe(30);
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

  it('creadoEn cae a datos_extra.fecha_origen y luego a created_at (FIFO)', () => {
    const base = { id: 'a', codigo: 'X', medida_ancho: 1, medida_alto: 1, disponible: true, ot_asignada: null };
    expect(rowToPano({ ...base, datos_extra: { fecha_origen: '2026-02-02' } }).creadoEn).toBe('2026-02-02');
    expect(rowToPano({ ...base, created_at: '2026-03-03T00:00:00Z' }).creadoEn).toBe('2026-03-03T00:00:00Z');
    // creadoEn explícito gana sobre los demás
    expect(
      rowToPano({ ...base, created_at: '2026-03-03T00:00:00Z', datos_extra: { creadoEn: '2026-01-01' } }).creadoEn,
    ).toBe('2026-01-01');
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

  it('calce exacto: el paño se usa entero y no queda nada que anotar', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    // Pieza: ancho nominal 146 (en colmena no lleva BORDE), alto = 205+25 = 230.
    const sobrante = pano('SC001', 146, 230);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].regla).toBe(1);
    expect(plan.sobrantes[0].libres).toEqual([]);
    expect(plan.sobrantes[0].costo).toBe(0);
    expect(plan.rollo).toHaveLength(0);
    expect(plan.sinStock).toHaveLength(0);
  });

  // El taller puede apagar la colmena para que el optimizador corte SOLO tela
  // nueva. El interruptor vive en el motor porque por acá pasan el plan de la
  // UI, el Excel de corte, el PDF, las etiquetas y el descuento de inventario.
  it('colmena apagada: el match exacto se ignora y la pieza sale del rollo', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    const sobrante = pano('SC001', 150, 230); // calzaría EXACTO
    const plan = generarPlanCorte([ot], [sobrante], {
      ...PARAMETROS_CORTE_DEFAULT,
      usarColmenaPanos: false,
    });
    expect(plan.sobrantes).toHaveLength(0);
    expect(plan.rollo).toHaveLength(1);
    expect(plan.sinStock).toHaveLength(0);
  });

  it('el default de fábrica sigue usando la colmena', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    const sobrante = pano('SC001', 150, 230);
    expect(PARAMETROS_CORTE_DEFAULT.usarColmenaPanos).toBe(true);
    const plan = generarPlanCorte([ot], [sobrante], PARAMETROS_CORTE_DEFAULT);
    expect(plan.sobrantes).toHaveLength(1);
  });

  it('colmena apagada: tampoco se usa por best-fit (Regla 2)', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    // Sobrante ancho que en condiciones normales empaqueta la pieza y deja franja.
    const plan = generarPlanCorte([ot], [pano('SC001', 280, 235)], {
      ...PARAMETROS_CORTE_DEFAULT,
      usarColmenaPanos: false,
    });
    expect(plan.sobrantes).toHaveLength(0);
    expect(plan.rollo).toHaveLength(1);
  });

  it('lo que sobra del paño y SIRVE vuelve al rack; lo que no, es merma', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    // Pieza nominal 146×230. Paño 280×235 → tira 134×235 (≥100×200: sirve para
    // otra roller) + faja 146×5, que ni siquiera se anota.
    const plan = generarPlanCorte([ot], [pano('SC001', 280, 235)]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].regla).toBe(2);
    const utiles = plan.sobrantes[0].libres.filter((r) => r.clase === 'sobrante');
    expect(utiles).toHaveLength(1);
    expect([utiles[0].anchoCm, utiles[0].altoCm]).toEqual([134, 235]);
  });

  it('un trozo que no sirve para nada NO cuenta como paño nuevo, solo como merma', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    // Paño 200×235 → tira 54×235: no alcanza ni para roller (100×200) ni para
    // vertical (80×250). Es pérdida, no inventario.
    const plan = generarPlanCorte([ot], [pano('SC001', 200, 235)]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].libres.every((r) => r.clase === 'merma')).toBe(true);
  });

  it('DUO: la pieza reserva el corte real (2×alto+30) — un sobrante 20 cm más corto NO sirve', () => {
    const ventana = {
      codInt: 'DU 28',
      producto: 'ROLLER DUO BLACKOUT PREMIUM',
      ubicacion: 'Living',
      panos: [{ ancho: 1.66, alto: 2.3 }],
    };
    // Pieza dúo: ancho = 166+BORDE(4) = 170; alto = 2×230+30 = 490.
    // Con el bug anterior (extra 10 → 470) este sobrante de 480 se aceptaba
    // aunque la tela real a cortar mide 490.
    const corto = pano('DU 28', 200, 480);
    const planCorto = generarPlanCorte([hacerOT([ventana])], [corto]);
    expect(planCorto.sobrantes).toHaveLength(0);

    const justo = pano('DU 28', 200, 490);
    const planJusto = generarPlanCorte([hacerOT([ventana])], [justo]);
    expect(planJusto.sobrantes).toHaveLength(1);
  });

  it('params custom: bajando el mínimo funcional, la franja vuelve al rack', () => {
    const ot = hacerOT([
      {
        codInt: 'SC001',
        producto: 'Roller SC',
        ubicacion: 'Living',
        panos: [{ ancho: 1.46, alto: 2.05 }],
      },
    ]);
    // Franja 200−146 = 54: con el mínimo de roller (100 de ancho) es merma;
    // bajándolo a 50 el trozo pasa a servir y vuelve al inventario.
    const plan = generarPlanCorte([ot], [pano('SC001', 200, 235)], {
      ...PARAMETROS_CORTE_DEFAULT,
      funcionalRollerMinAnchoCm: 50,
    });
    const utiles = plan.sobrantes[0].libres.filter((r) => r.clase === 'sobrante');
    expect([utiles[0].anchoCm, utiles[0].altoCm]).toEqual([54, 235]);
  });

  it('ya no hay tolerancia de alto: un paño MÁS alto que la cortina sirve igual', () => {
    const ventana = {
      codInt: 'SC001',
      producto: 'Roller SC',
      ubicacion: 'Living',
      panos: [{ ancho: 1.46, alto: 2.05 }],
    };
    // Pieza 146×230 en un paño de 160×280. La ventana de +30 cm lo rechazaba y
    // mandaba la cortina al rollo teniendo la tela en el rack.
    const plan = generarPlanCorte([hacerOT([ventana])], [pano('SC001', 160, 280)]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.rollo).toHaveLength(0);
  });

  it('params custom: extraDuoCm cambia la reserva del dúo', () => {
    const ventana = {
      codInt: 'DU 28',
      producto: 'ROLLER DUO BLACKOUT PREMIUM',
      ubicacion: 'Living',
      panos: [{ ancho: 1.66, alto: 2.3 }],
    };
    // Con extraDuoCm 40 la pieza reserva 2×230+40 = 500 → un sobrante de 490 ya no sirve.
    const sobrante = pano('DU 28', 200, 490);
    const plan = generarPlanCorte([hacerOT([ventana])], [sobrante], {
      ...PARAMETROS_CORTE_DEFAULT,
      extraDuoCm: 40,
    });
    expect(plan.sobrantes).toHaveLength(0);
    const justo = pano('DU 28', 200, 500);
    const planJusto = generarPlanCorte([hacerOT([ventana])], [justo], {
      ...PARAMETROS_CORTE_DEFAULT,
      extraDuoCm: 40,
    });
    expect(planJusto.sobrantes).toHaveLength(1);
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

  it('Regla 2 mejorada: dos cortinas chicas comparten un mismo sobrante', () => {
    const ot = hacerOT([
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L1', alto: 1.6, panos: [{ ancho: 0.52, alto: 1.6 }] },
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L2', alto: 1.6, panos: [{ ancho: 0.75, alto: 1.6 }] },
    ]);
    // Piezas: nominal 52 y 75 cm (bordered 56/79 menos BORDE 4). El sobrante
    // 140×190 las toma juntas (52 + 75 = 127 ≤ 140).
    const sobrante = pano('BK 69', 140, 190);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].placed).toHaveLength(2); // ambas en el mismo sobrante
    expect(plan.rollo).toHaveLength(0); // no quedó nada para el rollo
    // Quedan lado a lado: la más ancha (75) en px=0, la otra (52) a continuación.
    const xs = plan.sobrantes[0].placed.map((p) => p.px).sort((a, b) => a - b);
    expect(xs).toEqual([0, 75]);
    // Franja restante 140−127 = 13 cm: no sirve para otra cortina → merma.
    expect(plan.sobrantes[0].libres.every((r) => r.clase === 'merma')).toBe(true);
  });

  it('Regla 2 mejorada: la cortina que no entra al sobrante cae al rollo', () => {
    const ot = hacerOT([
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L1', alto: 1.6, panos: [{ ancho: 0.52, alto: 1.6 }] },
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L2', alto: 1.6, panos: [{ ancho: 0.75, alto: 1.6 }] },
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L3', alto: 1.6, panos: [{ ancho: 2.5, alto: 1.6 }] },
    ]);
    const sobrante = pano('BK 69', 140, 190);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes[0].placed).toHaveLength(2);
    expect(plan.rollo.length).toBeGreaterThan(0); // la de 2,5 m va al rollo
  });

  it('umbrales nuevos: caso ANGELICA baja a 2 paños de rollo (3 cortinas a colmena)', () => {
    const ot = hacerOT([
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L1', alto: 1.6, panos: [{ ancho: 2.72, alto: 1.6 }] },
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L2', alto: 1.6, panos: [{ ancho: 2.63, alto: 1.6 }] },
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L3', alto: 1.6, panos: [{ ancho: 1.44, alto: 1.6 }] },
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L4', alto: 1.6, panos: [{ ancho: 0.75, alto: 1.6 }] },
      { codInt: 'BK 69', producto: 'Roller BK', ubicacion: 'L5', alto: 1.6, panos: [{ ancho: 0.52, alto: 1.6 }] },
    ]);
    // Tres sobrantes disponibles. El óptimo (igual que el corte manual) usa
    // solo DOS: 133×200 toma 0,52+0,75 (alto 200 entra por VENTANA_ALTO=30) y
    // 146×195 toma 1,44 (144 ≤ 146 sin BORDE). El 122×195 queda INTACTO.
    const sobrantes = [
      pano('BK 69', 133, 200, { _docId: 's-133' }),
      pano('BK 69', 146, 195, { _docId: 's-146' }),
      pano('BK 69', 122, 195, { _docId: 's-122' }), // no debería usarse
    ];
    const plan = generarPlanCorte([ot], sobrantes);
    const r = resumenPlan(plan);
    expect(r.desdeSobrante).toBe(3); // las 3 chicas salen de sobrantes
    expect(r.desdeRollo).toBe(2); // solo 2,72 y 2,63 van al rollo → 2 paños
    // Consolida en 2 sobrantes y preserva el 122×195 → la colmena se achica más.
    expect(plan.sobrantes).toHaveLength(2);
    expect(plan.sobrantes.map((g) => g.sobrante._docId)).not.toContain('s-122');
  });

  it('FIFO en Regla 1: entre dos colmenas EXACTAS usa la más antigua', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 1.46, alto: 2.05 }] },
    ]);
    // Dos sobrantes idénticos (150×230). Reglas Rolzzo: se usa el más antiguo.
    const nueva = pano('SC001', 150, 230, { _docId: 'nueva', creadoEn: '2026-06-01T00:00:00Z' });
    const vieja = pano('SC001', 150, 230, { _docId: 'vieja', creadoEn: '2026-01-01T00:00:00Z' });
    const plan = generarPlanCorte([ot], [nueva, vieja]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].sobrante._docId).toBe('vieja');
  });

  it('Regla 3: con misma antigüedad, desempata por tipo (FALLA antes que SOBRANTE)', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 1.46, alto: 2.05 }] },
    ]);
    // Sin fecha (creadoEn ''): empata FIFO → decide el tipo de sobrante.
    const sobrante = pano('SC001', 150, 230, { _docId: 'normal', tipo: 'SOBRANTE' });
    const falla = pano('SC001', 150, 230, { _docId: 'falla', tipo: 'FALLA' });
    const plan = generarPlanCorte([ot], [sobrante, falla]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].sobrante._docId).toBe('falla');
  });

  it('sin FIFO + best-fit: una pieza chica usa el sobrante más justo, no el más grande', () => {
    const ot = hacerOT([
      { codInt: 'SC001', producto: 'Roller SC', ubicacion: 'L1', alto: 2.0, panos: [{ ancho: 0.7, alto: 2.0 }] },
    ]);
    // Pieza nominal 70 cm (74 - BORDE), alto 225. Hay un sobrante grande y uno justo.
    const grande = pano('SC001', 200, 230, { _docId: 'grande' });
    const justo = pano('SC001', 80, 230, { _docId: 'justo' });
    const plan = generarPlanCorte([ot], [grande, justo]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].sobrante._docId).toBe('justo'); // usa el justo, preserva el grande
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
    // DUO: alto pieza = round(2.0*100)*2 + 30 = 430 (corte real). ancho = 100+4 = 104.
    const sobrante = pano('DUO001', 104, 430);
    const plan = generarPlanCorte([ot], [sobrante]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].sobrante.alto).toBe(430);
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

// ── Rotación proactiva (caso real OT 266-1 de Eduardo) ──────────────
describe('generarPlanCorte — propone rotación cuando ahorra tela', () => {
  it('dos screen ~150×185 → rotados consumen ~306cm de rollo en vez de ~422', () => {
    const ot = hacerOT([
      { producto: 'ROLLER SCREEN - TRASLUCIDA PREMIUM', codInt: 'TR 02', ubicacion: 'TERRAZA IZQ', alto: 1.85, panos: [{ ancho: 1.501, alto: 1.85 }] },
      { producto: 'ROLLER SCREEN - TRASLUCIDA PREMIUM', codInt: 'TR 02', ubicacion: 'TERRAZA DER', alto: 1.85, panos: [{ ancho: 1.475, alto: 1.85 }] },
    ]);
    const plan = generarPlanCorte([ot], []);
    expect(plan.rollo).toHaveLength(1);
    const g = plan.rollo[0];
    // El layout propuesto rota las piezas (210 de ancho cabe en el rollo)
    expect(g.tieneRotaciones).toBe(true);
    expect(g.piezasRotadas.length).toBe(2);
    expect(g.altoCorte).toBeLessThan(330); // ~306-310 vs ~422 sin rotar
    // La alternativa vertical (sin rotación) sigue disponible para rechazar
    expect(g.layoutVertical).not.toBeNull();
    expect(g.altoVertical).toBeGreaterThan(400);
  });

  it('si rotar no ahorra (≥20cm), se mantiene el layout sin rotación', () => {
    const ot = hacerOT([
      { producto: 'ROLLER SCREEN', codInt: 'TR 02', ubicacion: 'V1', alto: 2.0, panos: [{ ancho: 2.8, alto: 2.0 }] },
    ]);
    const plan = generarPlanCorte([ot], []);
    expect(plan.rollo).toHaveLength(1);
    expect(plan.rollo[0].tieneRotaciones).toBe(false);
  });
});

// ── Lo que la MESA puede cortar ──────────────────────────────────────
// Las mesas de hoy cortan de punta a punta y la otra dirección se consigue
// girando el paño (recorrido del taller, 2026-09-01). Un acomodo que no se
// pueda ir partiendo en dos no ahorra tela: obliga al operario a improvisar.
describe('empaque guillotina', () => {
  const pieza = (nombre: string, w: number, h: number): Pieza => ({
    id: nombre,
    nombre,
    codInt: 'BK 61',
    otId: 'ot1',
    otNum: '268-7',
    w,
    h,
  });
  const puesta = (nombre: string, px: number, py: number, pw: number, ph: number): Placed => ({
    ...pieza(nombre, pw, ph),
    px,
    py,
    pw,
    ph,
    rot: false,
    failed: false,
  });

  it('detecta el acomodo REAL de la OT 268-7 que ninguna cuchilla separa', () => {
    // Layout que MaxRects proponía para su BK 61: no hay una sola línea recta
    // que cruce el paño sin partir una cortina por la mitad.
    const layout = [
      puesta('BOW W.', 0, 0, 176, 185),
      puesta('DOR PRIN', 0, 185, 192, 165),
      puesta('LIVING', 0, 350, 140, 195),
      puesta('DOR VISITA', 176, 0, 120, 165),
      puesta('OFICINA', 140, 350, 120, 165),
      puesta('LAT IZQ VELCRO', 260, 165, 37, 171),
      puesta('LAT DER VELCRO', 260, 336, 37, 171),
    ];
    expect(esLayoutGuillotina(layout, 298, 545)).toBe(false);
    expect(secuenciaCortes(layout, 298, 545)).toBeNull();
  });

  it('el molinete de 5 piezas tampoco se puede cortar', () => {
    const molinete = [
      puesta('arriba', 0, 0, 60, 40),
      puesta('derecha', 60, 0, 40, 60),
      puesta('abajo', 40, 60, 60, 40),
      puesta('izquierda', 0, 40, 40, 60),
      puesta('centro', 40, 40, 20, 20),
    ];
    expect(esLayoutGuillotina(molinete, 100, 100)).toBe(false);
  });

  it('acomoda esas MISMAS 7 cortinas de forma cortable', () => {
    const items = [
      pieza('BOW W.', 176, 185),
      pieza('DOR PRIN', 192, 165),
      pieza('LIVING', 140, 195),
      pieza('DOR VISITA', 120, 165),
      pieza('OFICINA', 120, 165),
      pieza('LAT IZQ VELCRO', 37, 171),
      pieza('LAT DER VELCRO', 37, 171),
    ];
    const pl = guillotinaPack(items, 298, 700, false);
    expect(pl.every((p) => !p.failed)).toBe(true);
    expect(esLayoutGuillotina(pl, 298, 700)).toBe(true);
  });

  it('todo lo que acomoda se puede cortar, y nunca superpone piezas', () => {
    // Medidas de cortina plausibles, con semilla fija para que el test sea
    // reproducible: lo que se prueba es la propiedad, no un caso puntual.
    let semilla = 12345;
    const rnd = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let caso = 0; caso < 40; caso++) {
      const n = 2 + Math.floor(rnd() * 8);
      const items = Array.from({ length: n }, (_, i) =>
        pieza(`C${i}`, 40 + Math.round(rnd() * 250), 100 + Math.round(rnd() * 350)),
      );
      const pl = guillotinaPack(items, 298, 4000, false);
      const ok = pl.filter((p) => !p.failed);
      expect(esLayoutGuillotina(pl, 298, 4000)).toBe(true);
      for (let i = 0; i < ok.length; i++) {
        for (let j = i + 1; j < ok.length; j++) {
          const a = ok[i];
          const b = ok[j];
          const separadas =
            a.px + a.pw <= b.px || b.px + b.pw <= a.px || a.py + a.ph <= b.py || b.py + b.ph <= a.py;
          expect(separadas).toBe(true);
        }
      }
    }
  });

  it('una pieza más ancha que el rollo no entra (queda failed, como MaxRects)', () => {
    const pl = guillotinaPack([pieza('ANCHA', 400, 200)], 298, 1000, false);
    expect(pl[0].failed).toBe(true);
  });
});

describe('secuenciaCortes', () => {
  const p = (nombre: string, px: number, py: number, pw: number, ph: number): Placed => ({
    id: nombre, nombre, codInt: 'SC 65', otId: 'ot1', otNum: '1', w: pw, h: ph,
    px, py, pw, ph, rot: false, failed: false,
  });

  it('dos cortinas lado a lado: un corte a lo largo', () => {
    const cortes = secuenciaCortes([p('PPAL', 0, 0, 137, 256), p('DORM', 137, 0, 129, 256)], 298, 256);
    expect(cortes).toEqual([
      expect.objectContaining({ n: 1, eje: 'longitudinal', posicionCm: 137, girar: false }),
    ]);
    expect(cortes![0].deja).toEqual(['PPAL', 'DORM']);
  });

  it('dos bandas: primero el transversal y después el otro, avisando el giro', () => {
    const cortes = secuenciaCortes(
      [
        p('PPAL', 0, 0, 137, 256),
        p('PPAL 2', 137, 0, 137, 256),
        p('DORM', 0, 256, 129, 258),
        p('DORM 2', 129, 256, 129, 258),
      ],
      298,
      514,
    )!;
    expect(cortes.map((c) => c.eje)).toEqual(['transversal', 'longitudinal', 'longitudinal']);
    expect(cortes[0].posicionCm).toBe(256);
    expect(cortes[0].girar).toBe(false);
    expect(cortes[1].girar).toBe(true); // cambia de sentido → hay que girar
    expect(cortes[2].girar).toBe(false); // sigue en el mismo sentido
  });

  it('una sola cortina no lleva ningún corte de separación', () => {
    expect(secuenciaCortes([p('PPAL', 0, 0, 137, 256)], 298, 256)).toEqual([]);
  });

  it('la franja que sobra al costado no cuenta como corte', () => {
    // La cortina usa 137 de 298: el resto se limpia, no separa dos piezas.
    expect(secuenciaCortes([p('PPAL', 0, 0, 137, 256)], 298, 256)).toHaveLength(0);
  });
});

// ── El paño de colmena se aprovecha en DOS dimensiones ───────────────
//
// Antes las cortinas iban en UNA fila, se rechazaba todo paño más alto que la
// cortina + 30 cm y se elegía por ancho sobrante. Estos casos son los que ese
// motor perdía.
describe('colmena — empaque 2D', () => {
  const roller = (codInt: string, ubic: string, ancho: number, alto: number) => ({
    codInt,
    producto: 'ROLLER BLACKOUT',
    ubicacion: ubic,
    alto,
    panos: [{ ancho, alto }],
  });

  it('dos cortinas anchas y bajas se APILAN en dos filas', () => {
    // 2,90×0,95 → 290×120 cada una. En un paño de 300×250 entran una sobre la
    // otra; con una sola fila el paño se descartaba y las dos iban al rollo.
    const ot = hacerOT([roller('SC 65', 'COCINA 1', 2.9, 0.95), roller('SC 65', 'COCINA 2', 2.9, 0.95)]);
    const plan = generarPlanCorte([ot], [pano('SC 65', 300, 250)]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].placed).toHaveLength(2);
    expect(plan.rollo).toHaveLength(0);
    const ys = plan.sobrantes[0].placed.map((p) => p.py).sort((a, b) => a - b);
    expect(ys).toEqual([0, 120]);
  });

  it('la penalidad por paño nuevo hace ganar al paño JUSTO sobre el GRANDE', () => {
    // 70×225. El grande deja 130×230, que vuelve al rack: la colmena no baja.
    const ot = hacerOT([roller('SC001', 'L1', 0.7, 2.0)]);
    const grande = pano('SC001', 200, 230, { _docId: 'grande' });
    const justo = pano('SC001', 80, 230, { _docId: 'justo' });
    expect(generarPlanCorte([ot], [grande, justo]).sobrantes[0].sobrante._docId).toBe('justo');
    // Con la penalidad en 0 vuelve a mandar solo la merma → gana el grande.
    const sinPenalidad = generarPlanCorte([ot], [grande, justo], {
      ...PARAMETROS_CORTE_DEFAULT,
      colmenaPenalidadNuevoPanoCm2: 0,
    });
    expect(sinPenalidad.sobrantes[0].sobrante._docId).toBe('grande');
  });

  it('no parte un paño grande en dos chicos para ahorrar dos palmos de merma', () => {
    // 100×175. El 200×400 no deja NADA de merma, pero deja DOS paños nuevos.
    const ot = hacerOT([roller('SC001', 'L1', 1.0, 1.5)]);
    const chico = pano('SC001', 110, 185, { _docId: 'chico' });
    const enorme = pano('SC001', 200, 400, { _docId: 'enorme' });
    expect(generarPlanCorte([ot], [enorme, chico]).sobrantes[0].sobrante._docId).toBe('chico');
  });

  it('pero sí prefiere el paño que deja UN trozo útil sobre el que solo deja merma', () => {
    // 100×175. El 250×185 pierde 150×185 entero (merma, 27.750 cm²); el
    // 110×400 pierde 10×400 (4.000) y devuelve 100×225 al rack (20.000 de
    // penalidad) → 24.000 < 27.750.
    const ot = hacerOT([roller('SC001', 'L1', 1.0, 1.5)]);
    const anchoInutil = pano('SC001', 250, 185, { _docId: 'ancho' });
    const largoUtil = pano('SC001', 110, 400, { _docId: 'largo' });
    expect(generarPlanCorte([ot], [anchoInutil, largoUtil]).sobrantes[0].sobrante._docId).toBe('largo');
  });

  it('cuatro cortinas iguales caben todas en un paño y no se parten en dos', () => {
    // 4 × 70×195. En 300×220 entran las cuatro (merma 11.400); en 273×195 solo
    // tres, y la cuarta se iría al rollo.
    const ot = hacerOT([1, 2, 3, 4].map((n) => roller('BK 61', `DORM ${n}`, 0.7, 1.7)));
    const plan = generarPlanCorte([ot], [
      pano('BK 61', 273, 195, { _docId: 'chico' }),
      pano('BK 61', 300, 220, { _docId: 'grande' }),
    ]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].sobrante._docId).toBe('grande');
    expect(plan.sobrantes[0].placed).toHaveLength(4);
    expect(plan.rollo).toHaveLength(0);
  });

  it('una cortina GIRADA entra donde derecha no entraba', () => {
    // 170×270 en un paño de 273×195: acostada mide 270×170 y calza.
    const ot = hacerOT([roller('BK 61', 'ESCRITORIO', 1.7, 2.45)]);
    const plan = generarPlanCorte([ot], [pano('BK 61', 273, 195)]);
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.sobrantes[0].tieneRotaciones).toBe(true);
    expect(plan.sobrantes[0].piezasRotadas).toHaveLength(1);
    expect(plan.rollo).toHaveLength(0);
  });

  it('con el giro apagado esa misma cortina se va al rollo', () => {
    const ot = hacerOT([roller('BK 61', 'ESCRITORIO', 1.7, 2.45)]);
    const plan = generarPlanCorte([ot], [pano('BK 61', 273, 195)], {
      ...PARAMETROS_CORTE_DEFAULT,
      colmenaPermiteGiro: false,
    });
    expect(plan.sobrantes).toHaveLength(0);
    expect(plan.rollo).toHaveLength(1);
  });

  it('si el operario RECHAZA el giro, la cortina cae al rollo', () => {
    const ot = hacerOT([roller('BK 61', 'ESCRITORIO', 1.7, 2.45)]);
    const conGiro = generarPlanCorte([ot], [pano('BK 61', 273, 195)]);
    const id = conGiro.sobrantes[0].piezasRotadas[0].id;
    const rechazado = generarPlanCorte([ot], [pano('BK 61', 273, 195)], PARAMETROS_CORTE_DEFAULT, undefined, undefined, {
      sinGiro: new Set([id]),
    });
    expect(rechazado.sobrantes).toHaveLength(0);
    expect(rechazado.rollo).toHaveLength(1);
  });

  it('una VERTICAL nunca se acuesta, ni en la colmena ni en el rollo', () => {
    // Sus lamas van a lo ancho del rollo; girada quedarían atravesadas.
    const vertical = {
      codInt: 'BK 18-V',
      producto: 'CORTINA VERTICAL',
      tipo: 'VERTICAL',
      ubicacion: 'VITRINA',
      alto: 2.45,
      panos: [{ ancho: 1.7, alto: 2.45 }],
    };
    const plan = generarPlanCorte([hacerOT([vertical])], [pano('BK 18-V', 273, 195)]);
    expect(plan.sobrantes).toHaveLength(0);
    expect(plan.rollo).toHaveLength(1);
    expect(plan.rollo[0].placed.every((p) => !p.rot)).toBe(true);
  });

  it('una pieza sin código no toma los paños que tampoco lo tienen', () => {
    // `colmena_panos.codigo` viene null en varias filas viejas: '' === '' las
    // hacía calzar con cualquier tela.
    const ot = hacerOT([{ codInt: '', producto: 'Roller SC', ubicacion: 'L1', panos: [{ ancho: 1.4, alto: 2.0 }] }]);
    const plan = generarPlanCorte([ot], [pano('', 200, 250)]);
    expect(plan.sobrantes).toHaveLength(0);
  });

  it('el acomodo del paño es siempre cortable por la mesa y sin solapes', () => {
    const ot = hacerOT([
      roller('BK 61', 'L1', 0.7, 1.7),
      roller('BK 61', 'L2', 1.45, 1.9),
      roller('BK 61', 'L3', 0.52, 1.6),
      roller('BK 61', 'L4', 1.16, 1.4),
    ]);
    const plan = generarPlanCorte([ot], [pano('BK 61', 300, 250), pano('BK 61', 200, 220)]);
    expect(plan.sobrantes.length).toBeGreaterThan(0);
    for (const g of plan.sobrantes) {
      expect(esLayoutGuillotina(g.placed, g.uw, g.uh)).toBe(true);
      expect(g.cortes).not.toBeNull();
      for (const a of g.placed) {
        for (const b of g.placed) {
          if (a === b) continue;
          const solapa =
            a.px < b.px + b.pw && b.px < a.px + a.pw && a.py < b.py + b.ph && b.py < a.py + a.ph;
          expect(solapa).toBe(false);
        }
      }
      // Todo lo puesto cae DENTRO del paño.
      for (const p of g.placed) {
        expect(p.px + p.pw).toBeLessThanOrEqual(g.uw);
        expect(p.py + p.ph).toBeLessThanOrEqual(g.uh);
      }
    }
  });

  it('en multieje la colmena se sigue usando (la cortadora CNC)', () => {
    const ot = hacerOT([roller('SC 65', 'COCINA 1', 2.9, 0.95), roller('SC 65', 'COCINA 2', 2.9, 0.95)]);
    const plan = generarPlanCorte([ot], [pano('SC 65', 300, 250)], {
      ...PARAMETROS_CORTE_DEFAULT,
      modoCorte: 'multieje',
    });
    expect(plan.sobrantes[0].placed).toHaveLength(2);
  });

  it('la colmena no toca el plan de rollo: sin paños del código, sale idéntico', () => {
    const ot = hacerOT([
      roller('BK 61', 'L1', 1.72, 1.6),
      roller('BK 61', 'L2', 1.88, 1.4),
      roller('BK 61', 'L3', 1.36, 1.7),
    ]);
    const sinColmena = generarPlanCorte([ot], []);
    const conOtraTela = generarPlanCorte([ot], [pano('SC 65', 300, 250)]);
    expect(sinColmena.rollo).toHaveLength(1);
    expect(sinColmena.rollo[0].placed.filter((p) => !p.failed)).toHaveLength(3);
    expect(conOtraTela.sobrantes).toEqual([]);
    expect(conOtraTela.rollo[0].altoCorte).toBe(sinColmena.rollo[0].altoCorte);
    expect(conOtraTela.rollo[0].placed).toEqual(sinColmena.rollo[0].placed);
  });
});

describe('modoCorte', () => {
  const otMuchas = hacerOT([
    { producto: 'ROLLER BLACKOUT', codInt: 'BK 61', ubicacion: 'BOW W.', alto: 1.6, panos: [{ ancho: 1.72, alto: 1.6 }] },
    { producto: 'ROLLER BLACKOUT', codInt: 'BK 61', ubicacion: 'DOR PRIN', alto: 1.4, panos: [{ ancho: 1.88, alto: 1.4 }] },
    { producto: 'ROLLER BLACKOUT', codInt: 'BK 61', ubicacion: 'LIVING', alto: 1.7, panos: [{ ancho: 1.36, alto: 1.7 }] },
    { producto: 'ROLLER BLACKOUT', codInt: 'BK 61', ubicacion: 'VISITA', alto: 1.4, panos: [{ ancho: 1.16, alto: 1.4 }] },
    { producto: 'ROLLER BLACKOUT', codInt: 'BK 61', ubicacion: 'OFICINA', alto: 1.4, panos: [{ ancho: 1.16, alto: 1.4 }] },
  ]);

  it('de fábrica el plan sale cortable por la mesa', () => {
    expect(PARAMETROS_CORTE_DEFAULT.modoCorte).toBe('guillotina');
    const plan = generarPlanCorte([otMuchas], []);
    for (const g of plan.rollo) {
      expect(esLayoutGuillotina(g.placed, g.anchoUtil, g.altoUtil)).toBe(true);
    }
  });

  it('en multieje se conserva el acomodo libre (la cortadora CNC)', () => {
    const libre = generarPlanCorte([otMuchas], [], {
      ...PARAMETROS_CORTE_DEFAULT,
      modoCorte: 'multieje',
    });
    const mesa = generarPlanCorte([otMuchas], []);
    // La CNC aprovecha igual o mejor: nunca pide más tela que la mesa.
    const alto = (p: typeof libre) => p.rollo.reduce((s, g) => s + g.altoCorte, 0);
    expect(alto(libre)).toBeLessThanOrEqual(alto(mesa));
  });
});
