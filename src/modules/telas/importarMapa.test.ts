import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import type { ColmenaPano } from '@/modules/admin/colmena';
import {
  parsearContenidoCelda,
  parsearNota,
  parsearMapaExcel,
  diffMapa,
  planAplicacion,
  guardBajasMasivas,
  normCodPano,
  claveIdentidad,
  rackDeColIndex,
  colLogicaDeColIndex,
  type CeldaMapa,
  type ParseoMapa,
} from './importarMapa';

// ── Fixtures ─────────────────────────────────────────────────────────
/** Arma un libro con celdas sueltas (r/c 0-based) en una hoja. */
function wbMapa(celdas: { r: number; c: number; v: string }[], hoja = 'Hoja1'): XLSX.WorkBook {
  const maxR = Math.max(0, ...celdas.map((x) => x.r));
  const maxC = Math.max(0, ...celdas.map((x) => x.c));
  const aoa: string[][] = Array.from({ length: maxR + 1 }, () =>
    Array.from({ length: maxC + 1 }, () => ''),
  );
  for (const { r, c, v } of celdas) aoa[r][c] = v;
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  return wb;
}

let idSeq = 0;
function galpon(
  codigo: string,
  ancho: number | null,
  alto: number | null,
  rack: number,
  m: number,
  col: number,
  over: Partial<ColmenaPano> = {},
): ColmenaPano {
  return {
    id: over.id ?? `p${++idSeq}`,
    empresa_id: 'E1',
    codigo,
    medida_ancho: ancho,
    medida_alto: alto,
    disponible: over.disponible ?? true,
    ot_asignada: over.ot_asignada ?? null,
    fecha_uso: over.fecha_uso ?? null,
    tipo: 'SOBRANTE',
    ubicacion: `MAPA M${m}-${col}`,
    datos_extra: { zona: 'GALPON', rack, m, col, ...(over.datos_extra ?? {}) },
    created_at: over.created_at ?? '2026-06-26T00:00:00Z',
  };
}

function celda(
  rack: number,
  m: number,
  col: number,
  codigo: string,
  ancho: number | null = null,
  alto: number | null = null,
): CeldaMapa {
  return {
    zona: 'GALPON', rack, m, col, cell: `X${rack}${m}${col}`,
    codigo, ancho, alto, comentario: null, raw: codigo,
  };
}
function parseoDe(celdas: CeldaMapa[]): ParseoMapa {
  return { celdas, zonas: ['GALPON'], hoja: 'Hoja1', advertencias: [] };
}

// ── Geometría ────────────────────────────────────────────────────────
describe('geometría', () => {
  it('rack = ceil(colIndex/6), col = colIndex − 1', () => {
    // C(3)→r1 col2 · F(6)→r1 col5 · G(7)→r2 col6 · AP(42)→r7 col41
    expect([rackDeColIndex(3), colLogicaDeColIndex(3)]).toEqual([1, 2]);
    expect([rackDeColIndex(6), colLogicaDeColIndex(6)]).toEqual([1, 5]);
    expect([rackDeColIndex(7), colLogicaDeColIndex(7)]).toEqual([2, 6]);
    expect([rackDeColIndex(42), colLogicaDeColIndex(42)]).toEqual([7, 41]);
  });
});

// ── parsearContenidoCelda ────────────────────────────────────────────
describe('parsearContenidoCelda', () => {
  it('extrae código + medidas en cm', () => {
    expect(parsearContenidoCelda('BK 61 188X250')).toEqual({ codigo: 'BK 61', ancho: 188, alto: 250 });
  });
  it('tolera minúsculas, sin espacio y separador con espacios', () => {
    expect(parsearContenidoCelda('bk61 188 x 250')).toEqual({ codigo: 'BK 61', ancho: 188, alto: 250 });
  });
  it('normaliza el número del código a 2 dígitos', () => {
    expect(parsearContenidoCelda('DU 7 300X216')?.codigo).toBe('DU 07');
  });
  it('acepta medidas en metros (<20 → ×100) y coma decimal', () => {
    expect(parsearContenidoCelda('SC 64 1,88x2,50')).toEqual({ codigo: 'SC 64', ancho: 188, alto: 250 });
  });
  it('acepta medidas entre paréntesis', () => {
    expect(parsearContenidoCelda('SC 64 (178X200)')).toEqual({ codigo: 'SC 64', ancho: 178, alto: 200 });
  });
  it('sin medidas → null en ancho/alto', () => {
    expect(parsearContenidoCelda('BK 61')).toEqual({ codigo: 'BK 61', ancho: null, alto: null });
  });
  it('descarta rótulos y celdas vacías', () => {
    expect(parsearContenidoCelda('')).toBeNull();
    expect(parsearContenidoCelda('RACK 1')).toBeNull();
    expect(parsearContenidoCelda('UBICACIÓN: GALPÓN')).toBeNull();
    expect(parsearContenidoCelda('M1')).toBeNull();
  });
});

describe('normCodPano', () => {
  it('unifica variantes al formato de BD', () => {
    expect(normCodPano('du 7')).toBe('DU 07');
    expect(normCodPano('DU07')).toBe('DU 07');
    expect(normCodPano('BK 61')).toBe('BK 61');
  });
});

describe('parsearNota', () => {
  it('extrae ANCHO/ALTO limpios de la nota (sin comentario)', () => {
    const n = parsearNota('====== | ID#X | Autor | COD: BK 61 | ANCHO: 188 | ALTO: 250 | ¿ESTATUS?');
    expect(n).toMatchObject({ ancho: 188, alto: 250, complejo: false, comentario: null });
  });
  it('funciona con saltos de línea', () => {
    expect(parsearNota('COD: DU 12\nANCHO: 300\nALTO: 352')).toMatchObject({ ancho: 300, alto: 352 });
  });
  it('caso "2 paños": toma el primer alto y conserva el comentario completo', () => {
    const txt = 'COD: SC 85\nANCHO: 300\nALTO: (2 PAÑOS)\n214\n129\n¿ESTATUS?';
    const n = parsearNota(txt);
    expect(n.ancho).toBe(300);
    expect(n.alto).toBe(214); // el "2" de "(2 PAÑOS)" no se cuela
    expect(n.complejo).toBe(true);
    expect(n.comentario).toContain('2 PAÑOS');
  });
  it('nota vacía → todo nulo', () => {
    expect(parsearNota('')).toMatchObject({ ancho: null, alto: null, complejo: false, comentario: null });
  });
});

// ── parsearMapaExcel ─────────────────────────────────────────────────
describe('parsearMapaExcel', () => {
  it('usa rótulos M como ancla de fila y deriva rack/col por posición', () => {
    // A=col0 (rótulos M), C=col2 (rack1 col2), D=col3, G=col6 (rack2 col6)
    const wb = wbMapa([
      { r: 1, c: 0, v: 'M3' }, { r: 1, c: 2, v: 'BK 61 188X250' },
      { r: 2, c: 0, v: 'M2' }, { r: 2, c: 2, v: 'SC 33 220X222' }, { r: 2, c: 3, v: 'DU 07 300X216' },
      { r: 3, c: 0, v: 'M1' }, { r: 3, c: 2, v: 'BK 67 300X114' }, { r: 3, c: 6, v: 'TR 05 150X150' },
    ]);
    const p = parsearMapaExcel(wb);
    expect(p.zonas).toEqual(['GALPON']);
    expect(p.celdas).toHaveLength(5);
    const bk61 = p.celdas.find((c) => c.codigo === 'BK 61')!;
    expect([bk61.rack, bk61.m, bk61.col]).toEqual([1, 3, 2]);
    const tr05 = p.celdas.find((c) => c.codigo === 'TR 05')!;
    expect([tr05.rack, tr05.m, tr05.col]).toEqual([2, 1, 6]);
  });

  it('sin rótulos M usa el offset calibrado (fila 18 = M1)', () => {
    // C18 (r=17,c=2) → rack1, M1, col2
    const wb = wbMapa([{ r: 17, c: 2, v: 'BK 61 188X250' }]);
    const p = parsearMapaExcel(wb);
    expect(p.celdas).toHaveLength(1);
    expect([p.celdas[0].rack, p.celdas[0].m, p.celdas[0].col]).toEqual([1, 1, 2]);
  });

  it('lee las medidas de la NOTA de la celda (el texto solo trae el código)', () => {
    const wb = wbMapa([{ r: 17, c: 2, v: 'BK 61' }]); // sin medidas en el texto
    const ws = wb.Sheets['Hoja1'] as Record<string, { c?: { t: string }[] } | undefined>;
    ws['C18'] = { ...ws['C18'], c: [{ t: 'COD: BK 61\nANCHO: 188\nALTO: 250\n¿ESTATUS?' }] };
    const p = parsearMapaExcel(wb);
    expect(p.celdas[0]).toMatchObject({ codigo: 'BK 61', ancho: 188, alto: 250, comentario: null });
  });

  it('nota "2 paños": alto best-effort y conserva el comentario', () => {
    const wb = wbMapa([{ r: 17, c: 2, v: 'SC 85' }]);
    const ws = wb.Sheets['Hoja1'] as Record<string, { c?: { t: string }[] } | undefined>;
    ws['C18'] = { ...ws['C18'], c: [{ t: 'COD: SC 85\nANCHO: 300\nALTO: (2 PAÑOS)\n214\n129' }] };
    const p = parsearMapaExcel(wb);
    expect(p.celdas[0].ancho).toBe(300);
    expect(p.celdas[0].alto).toBe(214);
    expect(p.celdas[0].comentario).toContain('2 PAÑOS');
  });

  it('con rótulos, ignora códigos en filas sin M', () => {
    const wb = wbMapa([
      { r: 1, c: 0, v: 'M2' }, { r: 1, c: 2, v: 'BK 61 188X250' },
      { r: 2, c: 0, v: 'M1' }, { r: 2, c: 2, v: 'SC 33 220X222' },
      { r: 8, c: 2, v: 'DU 07 300X216' }, // fila sin rótulo → se ignora
    ]);
    const p = parsearMapaExcel(wb);
    expect(p.celdas.map((c) => c.codigo).sort()).toEqual(['BK 61', 'SC 33']);
  });

  it('coordenada duplicada: primera gana + advertencia', () => {
    const wb = wbMapa([
      { r: 1, c: 0, v: 'M1' }, { r: 1, c: 2, v: 'BK 61 188X250' },
      { r: 1, c: 3, v: 'SC 33 220X222' },
      { r: 5, c: 0, v: 'M1' }, { r: 5, c: 2, v: 'BK 99 100X100' }, // misma clave R1·M1·col2
    ]);
    const p = parsearMapaExcel(wb);
    const enCol2 = p.celdas.filter((c) => c.col === 2);
    expect(enCol2).toHaveLength(1);
    expect(enCol2[0].codigo).toBe('BK 61');
    expect(p.advertencias.length).toBe(1);
  });
});

// ── diffMapa ─────────────────────────────────────────────────────────
describe('diffMapa', () => {
  it('clasifica nuevo / sin cambio / modificado / baja', () => {
    const panos = [
      galpon('BK 61', 188, 250, 1, 1, 2), // sin cambio (±1)
      galpon('SC 33', 220, 222, 1, 1, 3), // modificado (código distinto en sheet)
      galpon('DU 07', 300, 216, 1, 1, 4), // baja (no está en sheet)
    ];
    const parseo = parseoDe([
      celda(1, 1, 2, 'BK 61', 189, 250), // +1 cm → tolerancia
      celda(1, 1, 3, 'BK 12', 220, 222), // código cambia
      celda(1, 1, 5, 'TR 05', 150, 150), // nuevo
    ]);
    const d = diffMapa(panos, parseo);
    expect(d.nuevos.map((c) => c.codigo)).toEqual(['TR 05']);
    expect(d.sinCambio.map((p) => p.codigo)).toEqual(['BK 61']);
    expect(d.modificados.map((m) => m.pano.codigo)).toEqual(['SC 33']);
    expect(d.modificados[0].cambiaCodigo).toBe(true);
    expect(d.bajas.map((p) => p.codigo)).toEqual(['DU 07']);
  });

  it('modificado por medidas fuera de tolerancia (+2 cm)', () => {
    const panos = [galpon('BK 61', 188, 250, 1, 1, 2)];
    const d = diffMapa(panos, parseoDe([celda(1, 1, 2, 'BK 61', 190, 250)]));
    expect(d.sinCambio).toHaveLength(0);
    expect(d.modificados).toHaveLength(1);
    expect(d.modificados[0].cambiaMedidas).toBe(true);
    expect(d.modificados[0].cambiaCodigo).toBe(false);
  });

  it('paño reservado (ot_asignada) cuya celda cambió → conflicto, no modificado ni baja', () => {
    const panos = [galpon('SC 65', 200, 200, 1, 1, 2, { disponible: false, ot_asignada: '267-7' })];
    const d = diffMapa(panos, parseoDe([celda(1, 1, 2, 'BK 12', 100, 100)]));
    expect(d.modificados).toHaveLength(0);
    expect(d.bajas).toHaveLength(0);
    expect(d.conflictos).toHaveLength(1);
    expect(d.conflictos[0].motivo).toContain('267-7');
  });

  it('paño usado cuya celda desaparece → conflicto (no baja)', () => {
    const panos = [galpon('SC 65', 200, 200, 1, 1, 2, { disponible: false, ot_asignada: '900-1' })];
    const d = diffMapa(panos, parseoDe([])); // sheet vacío
    expect(d.bajas).toHaveLength(0);
    expect(d.conflictos).toHaveLength(1);
    expect(d.conflictos[0].motivo).toContain('ya no está');
  });

  it('ROLZZO / CORTE / zona ausente quedan intactas', () => {
    const panos = [
      { ...galpon('SC 10', 100, 100, 1, 1, 2), datos_extra: { zona: 'ROLZZO' }, ubicacion: 'A-19' },
      { ...galpon('BK 20', 100, 100, 1, 1, 3), datos_extra: { zona: 'CORTE' }, ubicacion: 'C-1' },
      { ...galpon('DU 30', 100, 100, 2, 1, 6), datos_extra: { zona: 'LIBERADO', rack: 2, m: 1, col: 6 } },
    ] as ColmenaPano[];
    // Sheet solo trae GALPON → nada de esos paños debe aparecer.
    const d = diffMapa(panos, parseoDe([celda(1, 1, 2, 'TR 01', 100, 100)]));
    expect(d.bajas).toHaveLength(0);
    expect(d.conflictos).toHaveLength(0);
    expect(d.nuevos).toHaveLength(1); // la celda GALPON del sheet
    expect(d.zonasTocadas).toEqual(['GALPON']);
  });

  it('paño en zona tocada sin coordenadas → conflicto (nunca baja)', () => {
    const huerfano = { ...galpon('BK 99', 100, 100, 1, 1, 2), datos_extra: { zona: 'GALPON' } } as ColmenaPano;
    const d = diffMapa([huerfano], parseoDe([]));
    expect(d.bajas).toHaveLength(0);
    expect(d.conflictos).toHaveLength(1);
    expect(d.conflictos[0].motivo).toContain('sin coordenada');
  });

  it('celda vacía (sin medidas en sheet) no marca modificado si el código coincide', () => {
    const panos = [galpon('BK 61', 188, 250, 1, 1, 2)];
    const d = diffMapa(panos, parseoDe([celda(1, 1, 2, 'BK 61', null, null)]));
    expect(d.sinCambio).toHaveLength(1);
    expect(d.modificados).toHaveLength(0);
  });

  it('paño con baja previa se ignora (no bloquea el insert de la celda)', () => {
    const dadoDeBaja = {
      ...galpon('BK 61', 188, 250, 1, 1, 2),
      datos_extra: { zona: 'GALPON', rack: 1, m: 1, col: 2, baja: true },
    } as ColmenaPano;
    const d = diffMapa([dadoDeBaja], parseoDe([celda(1, 1, 2, 'TR 05', 150, 150)]));
    expect(d.nuevos.map((c) => c.codigo)).toEqual(['TR 05']);
    expect(d.bajas).toHaveLength(0);
  });
});

// ── guardBajasMasivas ────────────────────────────────────────────────
describe('guardBajasMasivas', () => {
  const conBajas = (nBajas: number, nDisponibles: number): { diff: any; panos: ColmenaPano[] } => {
    const bajas = Array.from({ length: nBajas }, (_, i) => galpon(`BK ${i}`, 1, 1, 1, 1, i + 1));
    const panos = Array.from({ length: nDisponibles }, (_, i) => galpon(`SC ${i}`, 1, 1, 2, 1, i + 1));
    return {
      diff: { bajas, zonasTocadas: ['GALPON'] },
      panos: [...panos, ...bajas],
    };
  };
  it('15 bajas / 100 disponibles → excede', () => {
    const { diff, panos } = conBajas(15, 100);
    expect(guardBajasMasivas(diff, panos)[0].excede).toBe(true);
  });
  it('15 bajas / 400 disponibles → no excede (bajo el 10%)', () => {
    const { diff, panos } = conBajas(15, 400);
    expect(guardBajasMasivas(diff, panos)[0].excede).toBe(false);
  });
  it('8 bajas / 20 disponibles → no excede (bajo el mínimo absoluto)', () => {
    const { diff, panos } = conBajas(8, 20);
    expect(guardBajasMasivas(diff, panos)[0].excede).toBe(false);
  });
});

// ── planAplicacion ───────────────────────────────────────────────────
describe('planAplicacion', () => {
  const ctx = { empresaId: 'E1', ahoraISO: '2026-07-13T10:00:00Z' };

  it('respeta la selección y arma inserts/updates/bajas', () => {
    const nueva = celda(1, 1, 5, 'TR 05', 150, 150);
    const pMod = galpon('SC 33', 220, 222, 1, 1, 3, { datos_extra: { zona: 'GALPON', rack: 1, m: 1, col: 3, creadoEn: '2026-01-01' } });
    const pBaja = galpon('DU 07', 300, 216, 1, 1, 4);
    const diff: any = {
      nuevos: [nueva],
      modificados: [{ celda: celda(1, 1, 3, 'BK 12', 220, 222), pano: pMod, cambiaCodigo: true, cambiaMedidas: false }],
      bajas: [pBaja],
      conflictos: [],
      sinCambio: [],
      zonasTocadas: ['GALPON'],
    };
    const sel = {
      nuevos: new Set([claveIdentidad('GALPON', 1, 1, 5)]),
      modificados: new Set([pMod.id]),
      bajas: new Set([pBaja.id]),
    };
    const plan = planAplicacion(diff, sel, ctx);
    expect(plan.fuente).toBe('IMPORT_MAPA_2026-07-13');
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({
      codigo: 'TR 05', medida_ancho: 150, disponible: true, tipo: 'SOBRANTE', ubicacion: 'MAPA M1-5',
    });
    expect(plan.inserts[0].datos_extra).toMatchObject({ zona: 'GALPON', rack: 1, m: 1, col: 5, fuente: 'IMPORT_MAPA_2026-07-13' });
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].codigo).toBe('BK 12');
    // preserva creadoEn previo
    expect(plan.updates[0].datos_extra).toMatchObject({ creadoEn: '2026-01-01', actualizadoEn: ctx.ahoraISO });
    expect(plan.bajas).toHaveLength(1);
    expect(plan.bajas[0].datos_extra).toMatchObject({ baja: true, motivo_baja: 'no está en el MAPA importado' });
  });

  it('no selecciona → plan vacío', () => {
    const diff: any = {
      nuevos: [celda(1, 1, 5, 'TR 05', 150, 150)],
      modificados: [], bajas: [], conflictos: [], sinCambio: [], zonasTocadas: ['GALPON'],
    };
    const plan = planAplicacion(diff, { nuevos: new Set(), modificados: new Set(), bajas: new Set() }, ctx);
    expect(plan.inserts).toHaveLength(0);
  });

  it('update no pisa medida existente con null del sheet', () => {
    const pMod = galpon('BK 61', 188, 250, 1, 1, 2);
    const diff: any = {
      nuevos: [], bajas: [], conflictos: [], sinCambio: [], zonasTocadas: ['GALPON'],
      modificados: [{ celda: celda(1, 1, 2, 'SC 99', null, null), pano: pMod, cambiaCodigo: true, cambiaMedidas: false }],
    };
    const plan = planAplicacion(diff, { nuevos: new Set(), modificados: new Set([pMod.id]), bajas: new Set() }, ctx);
    expect(plan.updates[0].medida_ancho).toBe(188);
    expect(plan.updates[0].medida_alto).toBe(250);
    expect(plan.updates[0].codigo).toBe('SC 99');
  });
});
