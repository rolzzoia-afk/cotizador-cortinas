import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import type { ColmenaPano } from '@/modules/admin/colmena';
import {
  parsearCodigoLiberado,
  parsearNotaLiberado,
  parsearTachados,
  leerTachados,
  parsearLiberadoExcel,
  ZONA_LIBERADO,
} from './importarLiberado';
import { diffMapa } from './importarMapa';

// ── Fixtures ─────────────────────────────────────────────────────────
const A1 = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

/** Arma un libro con celdas sueltas (r/c 0-based) y notas opcionales. */
function wbLib(
  celdas: { r: number; c: number; v: string; nota?: string }[],
  hoja = 'COLMENA DE PAÑOS (MAPA)',
): XLSX.WorkBook {
  const maxR = Math.max(0, ...celdas.map((x) => x.r));
  const maxC = Math.max(0, ...celdas.map((x) => x.c));
  const aoa: string[][] = Array.from({ length: maxR + 1 }, () =>
    Array.from({ length: maxC + 1 }, () => ''),
  );
  for (const { r, c, v } of celdas) aoa[r][c] = v;
  const ws = XLSX.utils.aoa_to_sheet(aoa) as Record<string, unknown>;
  for (const { r, c, nota } of celdas) {
    if (nota == null) continue;
    const addr = A1(r, c);
    ws[addr] = { ...(ws[addr] as object), c: [{ t: nota }] };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws as XLSX.WorkSheet, hoja);
  return wb;
}

let idSeq = 0;
function liberado(
  codigo: string,
  ancho: number | null,
  alto: number | null,
  rack: number,
  m: number,
  col: number,
  over: Partial<ColmenaPano> = {},
): ColmenaPano {
  return {
    id: over.id ?? `L${++idSeq}`,
    empresa_id: 'E1',
    codigo,
    medida_ancho: ancho,
    medida_alto: alto,
    disponible: over.disponible ?? true,
    ot_asignada: over.ot_asignada ?? null,
    fecha_uso: over.fecha_uso ?? null,
    tipo: 'SOBRANTE',
    ubicacion: `LIBERADO RACK ${rack}`,
    datos_extra: { zona: 'LIBERADO', rack, m, col, ...(over.datos_extra ?? {}) },
    created_at: over.created_at ?? '2026-06-26T00:00:00Z',
  };
}

// ── parsearCodigoLiberado ────────────────────────────────────────────
describe('parsearCodigoLiberado', () => {
  it('normaliza el formato estándar "XX NN"', () => {
    expect(parsearCodigoLiberado('DU 10')).toBe('DU 10');
    expect(parsearCodigoLiberado('du7')).toBe('DU 07');
    expect(parsearCodigoLiberado('SC 07')).toBe('SC 07');
  });
  it('acepta el marcador con letra "XX D" (ya presente en BD)', () => {
    expect(parsearCodigoLiberado('DU D')).toBe('DU D');
    expect(parsearCodigoLiberado('BK D')).toBe('BK D');
    expect(parsearCodigoLiberado('DU D ')).toBe('DU D'); // espacio sobrante
  });
  it('descarta rótulos y vacíos', () => {
    expect(parsearCodigoLiberado('')).toBeNull();
    expect(parsearCodigoLiberado('BUSCAR:')).toBeNull();
    expect(parsearCodigoLiberado('UBICACIÓN:  LIBERADO RACK #1')).toBeNull();
    expect(parsearCodigoLiberado('???')).toBeNull();
  });
});

// ── parsearNotaLiberado ──────────────────────────────────────────────
describe('parsearNotaLiberado', () => {
  it('lee medidas en metros (×100)', () => {
    expect(parsearNotaLiberado('3.00 X 2.20')).toMatchObject({ ancho: 300, alto: 220, complejo: false });
  });
  it('lee medidas en cm', () => {
    expect(parsearNotaLiberado('236X290')).toMatchObject({ ancho: 236, alto: 290, complejo: false });
  });
  it('ignora el prefijo ID/fecha del comentario (toma lo posterior al último ")")', () => {
    const n = parsearNotaLiberado('======\nID#AAAB\nAntonio (2025-02-24 14:08:23) 3.00 X 2.20');
    expect(n).toMatchObject({ ancho: 300, alto: 220 });
  });
  it('dúo (dos pares) → complejo + conserva el comentario', () => {
    const n = parsearNotaLiberado('====== (2025) 0.88 X 5.15  1.11 X 5.15');
    expect(n.ancho).toBe(88);
    expect(n.alto).toBe(515);
    expect(n.complejo).toBe(true);
    expect(n.comentario).toContain('1.11 X 5.15');
  });
  it('nota vacía o sin medida → todo nulo', () => {
    expect(parsearNotaLiberado('')).toMatchObject({ ancho: null, alto: null, complejo: false });
    expect(parsearNotaLiberado('ID#X sin medida')).toMatchObject({ ancho: null, alto: null });
  });
});

// ── parsearTachados ──────────────────────────────────────────────────
describe('parsearTachados', () => {
  it('marca las celdas cuya fuente lleva <strike/>', () => {
    const styles =
      '<styleSheet>' +
      '<fonts count="3"><font><sz val="11.0"/></font><font><strike/><sz val="11.0"/></font><font/></fonts>' +
      '<cellXfs count="3"><xf fontId="0"/><xf fontId="1"/><xf fontId="2"/></cellXfs>' +
      '</styleSheet>';
    const ws =
      '<worksheet><sheetData><row r="1">' +
      '<c r="A1" s="0"><v>a</v></c>' + // fuente normal
      '<c r="B1" s="1"><v>b</v></c>' + // fuente tachada
      '<c r="C1"><v>c</v></c>' + // sin s → fontId 0
      '</row></sheetData></worksheet>';
    const set = parsearTachados(styles, ws);
    expect(set.has('B1')).toBe(true);
    expect(set.has('A1')).toBe(false);
    expect(set.has('C1')).toBe(false);
  });
  it('sin fuentes tachadas → set vacío', () => {
    const styles = '<styleSheet><fonts count="1"><font/></fonts><cellXfs count="1"><xf fontId="0"/></cellXfs></styleSheet>';
    const ws = '<worksheet><sheetData><row r="1"><c r="A1" s="0"><v>a</v></c></row></sheetData></worksheet>';
    expect(parsearTachados(styles, ws).size).toBe(0);
  });
});

describe('leerTachados', () => {
  it('bytes que no son un zip → set vacío (degradación segura)', () => {
    const basura = new Uint8Array([1, 2, 3, 4, 5]);
    expect(leerTachados(basura, 'COLMENA DE PAÑOS (MAPA)').size).toBe(0);
  });
});

// ── parsearLiberadoExcel ─────────────────────────────────────────────
describe('parsearLiberadoExcel', () => {
  // Bloque RACK #1 (header r5) + RACK #2 (header r14), con títulos que acotan.
  const H = 5;
  const base = [
    { r: H, c: 1, v: 'UBICACIÓN:  LIBERADO RACK #1' },
    { r: H + 2, c: 1, v: 'BUSCAR:' },
    { r: H + 4, c: 0, v: 'ZZ 99' }, // columna A (margen) → se ignora
    { r: H + 4, c: 1, v: 'DU 10', nota: '(2025) 3.00 X 2.20' }, // m1 col1 → 300×220
    { r: H + 4, c: 2, v: 'DU D', nota: '(2025) 2.80 X 4.60' }, // m1 col2 → 280×460
    { r: H + 4, c: 3, v: 'SC 74', nota: '(2025) 0.88 X 5.15 1.11 X 5.15' }, // dúo
    { r: H + 4, c: 4, v: 'DU 11', nota: '(2025) 3.00 X 2.40' }, // m1 col4 → se tachará
    { r: H + 5, c: 1, v: 'BK 61' }, // m2 col1, sin nota
    { r: H + 5, c: 2, v: '???' }, // ilegible → advertencia
    { r: H + 8, c: 1, v: 'COLMENA DE PAÑOS:  POR ERROR' }, // título (acota rack1)
    { r: H + 9, c: 1, v: 'UBICACIÓN:  LIBERADO RACK #2' },
    { r: H + 13, c: 1, v: 'SC 40', nota: '(2025) 2.50 X 2.05' }, // rack2 m1 col1
  ];
  const tachados = new Set([A1(H + 4, 4)]); // DU 11

  it('parsea bloques, coordenadas rack/m/col y medidas de la nota', () => {
    const p = parsearLiberadoExcel(wbLib(base), { tachados });
    expect(p.zonas).toEqual([ZONA_LIBERADO]);
    const cods = p.celdas.map((c) => c.codigo).sort();
    expect(cods).toEqual(['BK 61', 'DU 10', 'DU D', 'SC 40', 'SC 74']);
    const du10 = p.celdas.find((c) => c.codigo === 'DU 10')!;
    expect([du10.zona, du10.rack, du10.m, du10.col]).toEqual(['LIBERADO', 1, 1, 1]);
    expect([du10.ancho, du10.alto]).toEqual([300, 220]);
    const bk61 = p.celdas.find((c) => c.codigo === 'BK 61')!;
    expect([bk61.rack, bk61.m, bk61.col]).toEqual([1, 2, 1]);
    const sc40 = p.celdas.find((c) => c.codigo === 'SC 40')!;
    expect([sc40.rack, sc40.m, sc40.col]).toEqual([2, 1, 1]); // segundo bloque
  });

  it('salta los códigos tachados (paños usados)', () => {
    const p = parsearLiberadoExcel(wbLib(base), { tachados });
    expect(p.celdas.find((c) => c.codigo === 'DU 11')).toBeUndefined();
  });

  it('incluye el marcador "DU D" (no lo trata como ilegible)', () => {
    const p = parsearLiberadoExcel(wbLib(base), { tachados });
    const duD = p.celdas.find((c) => c.codigo === 'DU D')!;
    expect([duD.rack, duD.m, duD.col]).toEqual([1, 1, 2]);
    expect([duD.ancho, duD.alto]).toEqual([280, 460]);
  });

  it('ignora la columna A (margen) y reporta ilegibles', () => {
    const p = parsearLiberadoExcel(wbLib(base), { tachados });
    expect(p.celdas.find((c) => c.codigo === 'ZZ 99')).toBeUndefined(); // col 0
    expect(p.advertencias.some((a) => /ilegible/i.test(a))).toBe(true);
  });

  it('dúo: marca complejo y conserva el comentario', () => {
    const p = parsearLiberadoExcel(wbLib(base), { tachados });
    const sc74 = p.celdas.find((c) => c.codigo === 'SC 74')!;
    expect(sc74.ancho).toBe(88);
    expect(sc74.comentario).toContain('1.11 X 5.15');
  });

  it('sin bloques LIBERADO → parseo vacío', () => {
    const wb = wbLib([{ r: 1, c: 1, v: 'DU 10' }]); // sin rótulo de bloque
    const p = parsearLiberadoExcel(wb, { tachados: new Set() });
    expect(p.celdas).toHaveLength(0);
    expect(p.zonas).toEqual([]);
  });
});

// ── Integración con diffMapa ─────────────────────────────────────────
describe('LIBERADO + diffMapa', () => {
  it('reconcilia por (rack,m,col): sin cambio / modificado / baja / nuevo', () => {
    const H = 5;
    const wb = wbLib([
      { r: H, c: 1, v: 'UBICACIÓN:  LIBERADO RACK #1' },
      { r: H + 4, c: 1, v: 'DU 10', nota: '3.00 X 2.20' }, // m1 col1 → sin cambio
      { r: H + 4, c: 2, v: 'BK 61', nota: '3.00 X 1.74' }, // m1 col2 → código cambia (era SC 40)
      { r: H + 4, c: 3, v: 'TR 05', nota: '1.50 X 1.50' }, // m1 col3 → nuevo
    ]);
    const parseo = parsearLiberadoExcel(wb, { tachados: new Set() });
    const panos = [
      liberado('DU 10', 300, 220, 1, 1, 1), // sin cambio
      liberado('SC 40', 250, 205, 1, 1, 2), // modificado (código)
      liberado('DU 99', 300, 300, 1, 1, 9), // baja (celda ausente en la hoja)
    ];
    const d = diffMapa(panos, parseo);
    expect(d.zonasTocadas).toEqual(['LIBERADO']);
    expect(d.sinCambio.map((p) => p.codigo)).toEqual(['DU 10']);
    expect(d.modificados.map((m) => m.pano.codigo)).toEqual(['SC 40']);
    expect(d.modificados[0].cambiaCodigo).toBe(true);
    expect(d.nuevos.map((c) => c.codigo)).toEqual(['TR 05']);
    expect(d.bajas.map((p) => p.codigo)).toEqual(['DU 99']);
  });

  it('un parseo LIBERADO no toca los paños GALPON', () => {
    const H = 5;
    const wb = wbLib([
      { r: H, c: 1, v: 'UBICACIÓN:  LIBERADO RACK #1' },
      { r: H + 4, c: 1, v: 'DU 10', nota: '3.00 X 2.20' },
    ]);
    const parseo = parsearLiberadoExcel(wb, { tachados: new Set() });
    const panos = [
      liberado('DU 10', 300, 220, 1, 1, 1),
      { ...liberado('BK 99', 100, 100, 1, 1, 1), datos_extra: { zona: 'GALPON', rack: 1, m: 1, col: 1 } } as ColmenaPano,
    ];
    const d = diffMapa(panos, parseo);
    expect(d.bajas).toHaveLength(0);
    expect(d.zonasTocadas).toEqual(['LIBERADO']);
  });
});
