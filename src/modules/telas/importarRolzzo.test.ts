import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import type { ColmenaPano } from '@/modules/admin/colmena';
import {
  parsearRolzzoExcel,
  diffRolzzo,
  planRolzzo,
  claveRolzzo,
  normUbic,
  type FilaRolzzo,
} from './importarRolzzo';

const HEADER = [
  'FECHA', 'TIPO CORTINA', 'COD', 'NEMOTECNICO', 'GRUPO', 'ANCHO', 'ALTO', 'ALTO DUO',
  'PROVEEDOR', 'T. COLMENA', 'UBICACION', 'OT SOBRANTE', 'RESPONSABLE CARGA', 'COD.SERIAL',
  'CORREO CLIENTE', 'FECHA DE SALIDA', 'OT ASIGNADA', 'NOMBRE DEL CLIENTE', 'COMENTARIO',
];
type Row = {
  cod: string; ancho?: number | string; alto?: number | string; ubic: string;
  serial?: string; salida?: string; ot?: string;
};
function fila(r: Row): (string | number)[] {
  const a: (string | number)[] = new Array(HEADER.length).fill('');
  a[2] = r.cod; a[5] = r.ancho ?? ''; a[6] = r.alto ?? ''; a[10] = r.ubic;
  a[13] = r.serial ?? ''; a[15] = r.salida ?? ''; a[16] = r.ot ?? '';
  return a;
}
function wbRolzzo(rows: Row[], hoja = 'COLMENA GALPON (ROLZZO) V-1.1'): XLSX.WorkBook {
  const aoa = [[], [], [], HEADER, ...rows.map(fila)];
  const ws = XLSX.utils.aoa_to_sheet(aoa as (string | number)[][]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  return wb;
}

let idc = 0;
function panoRolzzo(codigo: string, ancho: number, alto: number, ubic: string, over: Partial<ColmenaPano> = {}): ColmenaPano {
  return {
    id: over.id ?? `r${++idc}`, empresa_id: 'E1', codigo,
    medida_ancho: ancho, medida_alto: alto,
    disponible: over.disponible ?? true, ot_asignada: over.ot_asignada ?? null,
    fecha_uso: null, tipo: 'SOBRANTE', ubicacion: ubic,
    datos_extra: { zona: 'ROLZZO', ...(over.datos_extra ?? {}) },
    created_at: '2026-07-06T00:00:00Z',
  };
}

describe('parsearRolzzoExcel', () => {
  it('parsea filas con código/medidas/ubicación/serial y disponibilidad', () => {
    const wb = wbRolzzo([
      { cod: 'BK 09', ancho: 133, alto: 220, ubic: 'A-1', serial: 'N/A' },
      { cod: 'sc 5', ancho: 89, alto: 240, ubic: 'B-10', serial: 'X123' },
      { cod: 'BK 13', ancho: 102, alto: 225, ubic: 'VR-15', ot: '3096' }, // reservado
      { cod: 'SC 32', ancho: 130, alto: 180, ubic: 'B-1', salida: '2026-07-01' }, // salido
    ]);
    const p = parsearRolzzoExcel(wb);
    expect(p.hoja).toMatch(/ROLZZO/i);
    expect(p.filas).toHaveLength(4);
    const bk = p.filas[0];
    expect(bk).toMatchObject({ codigo: 'BK 09', ancho: 133, alto: 220, ubicacion: 'A-1', serial: null, disponible: true });
    expect(p.filas[1]).toMatchObject({ codigo: 'SC 05', serial: 'X123', disponible: true });
    expect(p.filas[2].disponible).toBe(false); // OT asignada
    expect(p.filas[3].disponible).toBe(false); // fecha salida
  });

  it('interpreta medidas en metros (<20 → ×100)', () => {
    const wb = wbRolzzo([{ cod: 'BK 01', ancho: '1,33', alto: '2.2', ubic: 'A-1' }]);
    expect(parsearRolzzoExcel(wb).filas[0]).toMatchObject({ ancho: 133, alto: 220 });
  });

  it('prefiere la hoja V-1.1 sobre la legacy', () => {
    const wb = wbRolzzo([{ cod: 'BK 09', ancho: 133, alto: 220, ubic: 'A-1' }]);
    // agrega una hoja legacy homónima con datos distintos
    const legacy = XLSX.utils.aoa_to_sheet([[], [], [], HEADER, fila({ cod: 'ZZ 99', ancho: 1, alto: 1, ubic: 'Z-9' })] as (string | number)[][]);
    XLSX.utils.book_append_sheet(wb, legacy, 'COLMENA GALPON (ROLZZO)');
    const p = parsearRolzzoExcel(wb);
    expect(p.hoja).toBe('COLMENA GALPON (ROLZZO) V-1.1');
    expect(p.filas.some((f) => f.codigo === 'ZZ 99')).toBe(false);
  });
});

describe('normUbic', () => {
  it('mayúsculas y sin espacios', () => {
    expect(normUbic('a - 19')).toBe('A-19');
    expect(normUbic('VR-11')).toBe('VR-11');
  });
});

describe('diffRolzzo (aditivo)', () => {
  const parseo = (rows: Row[]) => parsearRolzzoExcel(wbRolzzo(rows));

  it('agrega solo lo que falta; cuenta lo que ya está', () => {
    const panos = [panoRolzzo('BK 09', 133, 220, 'A-1'), panoRolzzo('SC 05', 89, 240, 'B-10')];
    const d = diffRolzzo(panos, parseo([
      { cod: 'BK 09', ancho: 133, alto: 220, ubic: 'A-1' }, // ya está
      { cod: 'SC 05', ancho: 89, alto: 240, ubic: 'B-10' }, // ya está
      { cod: 'TR 03', ancho: 148, alto: 145, ubic: 'B-53' }, // nuevo
    ]));
    expect(d.nuevos.map((n) => n.codigo)).toEqual(['TR 03']);
    expect(d.yaEnSistema).toBe(2);
    expect(d.soloEnSistema).toBe(0);
  });

  it('es idempotente: si todo está, 0 nuevos', () => {
    const panos = [panoRolzzo('BK 09', 133, 220, 'A-1')];
    const d = diffRolzzo(panos, parseo([{ cod: 'BK 09', ancho: 133, alto: 220, ubic: 'A-1' }]));
    expect(d.nuevos).toHaveLength(0);
    expect(d.yaEnSistema).toBe(1);
  });

  it('duplicado real: 2 en hoja, 1 en sistema → 1 nuevo', () => {
    const panos = [panoRolzzo('BK 09', 133, 220, 'A-1')];
    const d = diffRolzzo(panos, parseo([
      { cod: 'BK 09', ancho: 133, alto: 220, ubic: 'A-1' },
      { cod: 'BK 09', ancho: 133, alto: 220, ubic: 'A-1' },
    ]));
    expect(d.nuevos).toHaveLength(1);
    expect(d.yaEnSistema).toBe(1);
  });

  it('ignora filas no disponibles de la hoja (OT/salida)', () => {
    const d = diffRolzzo([], parseo([
      { cod: 'BK 13', ancho: 102, alto: 225, ubic: 'VR-15', ot: '3096' },
      { cod: 'SC 32', ancho: 130, alto: 180, ubic: 'B-1', salida: '2026-07-01' },
    ]));
    expect(d.nuevos).toHaveLength(0);
  });

  it('no cuenta paños usados/reservados ni de otras zonas del sistema', () => {
    const panos = [
      panoRolzzo('BK 09', 133, 220, 'A-1', { disponible: false, ot_asignada: '900' }),
      { ...panoRolzzo('BK 09', 133, 220, 'A-1'), datos_extra: { zona: 'GALPON' } } as ColmenaPano,
    ];
    // La hoja trae BK09|133|220|A-1 disponible; en el sistema solo hay uno usado y uno de otra zona
    const d = diffRolzzo(panos, parseo([{ cod: 'BK 09', ancho: 133, alto: 220, ubic: 'A-1' }]));
    expect(d.nuevos).toHaveLength(1); // se agrega porque no hay disponible ROLZZO con esa tupla
  });

  it('reporta soloEnSistema (informativo, sin baja)', () => {
    const panos = [panoRolzzo('BK 99', 100, 100, 'A-9')];
    const d = diffRolzzo(panos, parseo([{ cod: 'TR 03', ancho: 148, alto: 145, ubic: 'B-53' }]));
    expect(d.soloEnSistema).toBe(1);
    expect(d.nuevos.map((n) => n.codigo)).toEqual(['TR 03']);
  });
});

describe('planRolzzo', () => {
  const ctx = { empresaId: 'E1', ahoraISO: '2026-07-13T10:00:00Z' };
  const mkNuevos = (): FilaRolzzo[] => [
    { codigo: 'TR 03', ancho: 148, alto: 145, ubicacion: 'B-53', serial: 'S1', disponible: true, raw: 5 },
    { codigo: 'SC 64', ancho: 114, alto: 240, ubicacion: 'B-4', serial: null, disponible: true, raw: 6 },
  ];

  it('inserta los seleccionados con zona ROLZZO y serial', () => {
    const diff = { nuevos: mkNuevos(), yaEnSistema: 0, soloEnSistema: 0, hoja: 'H', advertencias: [], totalHoja: 2 };
    const plan = planRolzzo(diff, new Set([0, 1]), ctx);
    expect(plan.updates).toHaveLength(0);
    expect(plan.bajas).toHaveLength(0);
    expect(plan.inserts).toHaveLength(2);
    expect(plan.inserts[0]).toMatchObject({
      codigo: 'TR 03', medida_ancho: 148, medida_alto: 145, disponible: true, tipo: 'SOBRANTE', ubicacion: 'B-53',
    });
    expect(plan.inserts[0].datos_extra).toMatchObject({ zona: 'ROLZZO', serial: 'S1', fuente: 'IMPORT_ROLZZO_2026-07-13' });
    expect(plan.inserts[1].datos_extra).not.toHaveProperty('serial');
  });

  it('respeta la selección', () => {
    const diff = { nuevos: mkNuevos(), yaEnSistema: 0, soloEnSistema: 0, hoja: 'H', advertencias: [], totalHoja: 2 };
    const plan = planRolzzo(diff, new Set([1]), ctx);
    expect(plan.inserts.map((i) => i.codigo)).toEqual(['SC 64']);
  });
});

describe('claveRolzzo', () => {
  it('normaliza código y ubicación', () => {
    expect(claveRolzzo('bk 9', 133, 220, 'a-1')).toBe(claveRolzzo('BK 09', 133, 220, 'A-1'));
  });
});
