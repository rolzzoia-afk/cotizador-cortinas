import { describe, expect, it } from 'vitest';
import { buildOptimizerRows, autoOptimizar } from './tela';
import { construirFilasCorte, type OTParaCorte } from './exportCorteExcel';
import type { PanoColmena } from './planCorte';
import type { OT } from '@/modules/ots/types';

// OT ANGELICA del ejemplo: 5 cortinas BK 69, rollo 2,98 m.
const ANCHOS = [2.72, 2.63, 1.44, 0.75, 0.52];

function otAngelica(): OT {
  const ventanas = ANCHOS.map((ancho, i) => ({
    id: `v${i}`,
    ubicacion: `LIVING ${i}`,
    codInt: 'BK 69',
    producto: 'ROLLER BLACKOUT DELUX',
    tipo: 'DELUX',
    alto: 1.6,
    panos: [{ ancho, alto: 1.6 }],
  }));
  return {
    id: 'ot1',
    datosGenerales: { ot: '3043', cliente: 'ANGELICA' },
    storeVentanas: ventanas,
  } as unknown as OT;
}

function paraCorte(ot: OT): OTParaCorte {
  const rows = autoOptimizar(buildOptimizerRows(ot.storeVentanas, {}));
  return { ot, rows };
}

describe('construirFilasCorte', () => {
  it('sin colmena: agrupa por JUNTO, una fila por paño de rollo', () => {
    const filas = construirFilasCorte([paraCorte(otAngelica())], []);
    // Grupos esperados: A=2,72 · B=2,63 · C=1,44+0,75+0,52 → 3 paños.
    expect(filas).toHaveLength(3);
    expect(filas.every((f) => f.origen === 'ROLLO')).toBe(true);
    expect(filas.every((f) => f.ot === '3043' && f.cliente === 'ANGELICA')).toBe(true);
    expect(filas.every((f) => f.cod === 'BK 69')).toBe(true);
    expect(filas.every((f) => f.tipo === 'ROLLER BLACKOUT DELUX')).toBe(true);
    expect(filas.every((f) => f.altoCortePano === 1.85)).toBe(true); // 1,60 + 0,25
    expect(filas.map((f) => f.seCortaJunto)).toEqual(['A', 'B', 'C']);
    expect(filas.map((f) => f.panos)).toEqual([1, 2, 3]);
  });

  it('con sobrante que calza: esa pieza sale como COLMENA y deja de ocupar paño', () => {
    // Sobrante exacto para la cortina de 0,52 m → pieza 56×185 (ancho+4, alto+25).
    const colmena: PanoColmena[] = [
      { _docId: 's1', cod: 'BK 69', ancho: 56, alto: 185, ubicacion: 'A-1', tipo: 'SOBRANTE', creadoEn: '' },
    ];
    const filas = construirFilasCorte([paraCorte(otAngelica())], colmena);
    const colmenaRows = filas.filter((f) => f.origen.startsWith('COLMENA'));
    const rolloRows = filas.filter((f) => f.origen === 'ROLLO');
    expect(colmenaRows).toHaveLength(1);
    expect(colmenaRows[0].origen).toBe('COLMENA 56x185');
    expect(colmenaRows[0].seCortaJunto).toBe('');
    // Quedan los 3 paños de rollo (el grupo C ahora solo trae 1,44 + 0,75).
    expect(rolloRows).toHaveLength(3);
  });

  it('exporta varias OTs distinguidas por la columna OT', () => {
    const otA = otAngelica();
    const otB = otAngelica();
    (otB as unknown as { datosGenerales: { ot: string; cliente: string } }).datosGenerales = {
      ot: '3044',
      cliente: 'CAROLINA',
    };
    (otB as unknown as { id: string }).id = 'ot2';
    const filas = construirFilasCorte([paraCorte(otA), paraCorte(otB)], []);
    expect(new Set(filas.map((f) => f.ot))).toEqual(new Set(['3043', '3044']));
  });
});
