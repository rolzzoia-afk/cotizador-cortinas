// ─────────────────────────────────────────────────────────────────────
// Importador de la zona ROLZZO desde el Excel del galpón (hoja
// "COLMENA GALPON (ROLZZO) V-1.1"). A diferencia de la grilla GALPÓN, esta
// hoja es una TABLA completa: una fila por paño con COD, ANCHO, ALTO,
// UBICACIÓN (slot A-/B-/VR-), OT ASIGNADA, COD.SERIAL y FECHA DE SALIDA.
//
// Módulo PURO (parseo + diff), sin React/Supabase. Reconciliación ADITIVA:
// "traer los datos de la hoja" → agregar al sistema los paños de la hoja que
// aún no están; NO da de baja nada (decisión del usuario 2026-07-13).
//
// Identidad = tupla (código, ancho, alto, ubicación). En la BD, 1456 paños
// ROLZZO disponibles dan 1455 tuplas distintas → la tupla es de hecho una
// llave estable, así que el import es idempotente: re-subir la misma hoja no
// agrega nada.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import type { ColmenaPano } from '@/modules/admin/colmena';
import { normCodPano, type PanoInsertMapa, type PlanAplicacion } from '@/modules/telas/importarMapa';

export const ZONA_ROLZZO = 'ROLZZO';

const normHeader = (s: unknown) =>
  String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Ubicación canónica: mayúsculas, sin espacios ("a - 19" → "A-19"). */
export const normUbic = (s: unknown) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, '');

/** Medida de celda a cm (coma o punto; < 20 se interpreta en metros → ×100). */
function aCm(v: unknown): number | null {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const cm = n < 20 ? n * 100 : n;
  return Math.round(cm);
}

export type FilaRolzzo = {
  codigo: string;
  ancho: number | null;
  alto: number | null;
  ubicacion: string;
  serial: string | null;
  disponible: boolean;
  raw: number; // índice de fila en la hoja (trazabilidad)
};

export type ParseoRolzzo = {
  filas: FilaRolzzo[];
  hoja: string;
  advertencias: string[];
};

/** Localiza la fila de cabecera (tiene COD y UBICACION) y mapea columnas por nombre. */
function mapaColumnas(rows: unknown[][]): { headerIdx: number; col: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const r = rows[i] || [];
    const headers = r.map(normHeader);
    if (headers.includes('cod') && headers.includes('ubicacion')) {
      const col: Record<string, number> = {};
      r.forEach((c, j) => {
        const h = normHeader(c);
        if (h && !(h in col)) col[h] = j;
      });
      return { headerIdx: i, col };
    }
  }
  return null;
}

/** Elige la hoja ROLZZO. Prefiere la versión "V-1.1"; evita la hoja legacy de 100k filas. */
function elegirHojaRolzzo(wb: WorkBook): string | null {
  const cand = wb.SheetNames.filter((n) => normHeader(n).includes('rolzzo'));
  if (cand.length === 0) return null;
  const conVersion = cand.find((n) => /1\.1|v-?1/.test(normHeader(n)));
  if (conVersion) return conVersion;
  // Sin marca de versión: la de menos filas (la legacy tiene ~100k).
  return cand
    .map((n) => {
      const ref = wb.Sheets[n]?.['!ref'];
      return { n, filas: ref ? XLSX.utils.decode_range(ref).e.r + 1 : 0 };
    })
    .sort((a, b) => a.filas - b.filas)[0].n;
}

export function parsearRolzzoExcel(wb: WorkBook): ParseoRolzzo {
  const advertencias: string[] = [];
  const hoja = elegirHojaRolzzo(wb);
  if (!hoja) return { filas: [], hoja: '', advertencias: ['No se encontró una hoja ROLZZO en el libro.'] };

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[hoja], {
    header: 1,
    raw: false,
    defval: '',
  }) as unknown[][];
  const mapa = mapaColumnas(rows);
  if (!mapa) {
    return { filas: [], hoja, advertencias: ['La hoja ROLZZO no tiene columnas COD y UBICACION.'] };
  }
  const { headerIdx, col } = mapa;
  const cell = (r: unknown[], name: string) => (col[name] != null ? r[col[name]] : undefined);

  const filas: FilaRolzzo[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const codRaw = String(cell(r, 'cod') ?? '').trim();
    if (!/^[A-Za-z]{2,3}\s*\d/.test(codRaw)) continue; // fila vacía o no-paño
    const ubic = normUbic(cell(r, 'ubicacion'));
    if (!ubic) {
      advertencias.push(`Fila ${i + 1}: paño ${codRaw} sin ubicación; se omite.`);
      continue;
    }
    const otAsignada = String(cell(r, 'ot asignada') ?? '').trim();
    const fechaSalida = String(cell(r, 'fecha de salida') ?? '').trim();
    const serialRaw = String(cell(r, 'cod.serial') ?? '').trim();
    filas.push({
      codigo: normCodPano(codRaw),
      ancho: aCm(cell(r, 'ancho')),
      alto: aCm(cell(r, 'alto')),
      ubicacion: ubic,
      serial: serialRaw && serialRaw.toUpperCase() !== 'N/A' ? serialRaw : null,
      disponible: !otAsignada && !fechaSalida,
      raw: i,
    });
  }
  return { filas, hoja, advertencias };
}

// ── Identidad y diff ─────────────────────────────────────────────────
export const claveRolzzo = (
  codigo: unknown,
  ancho: number | null,
  alto: number | null,
  ubic: unknown,
): string => `${normCodPano(codigo)}|${ancho ?? ''}|${alto ?? ''}|${normUbic(ubic)}`;

/** Clave de un paño ROLZZO de BD (misma normalización que la hoja). */
function clavePanoRolzzo(p: ColmenaPano): string {
  return claveRolzzo(
    p.codigo,
    p.medida_ancho == null ? null : Math.round(p.medida_ancho),
    p.medida_alto == null ? null : Math.round(p.medida_alto),
    p.ubicacion,
  );
}

export type DiffRolzzo = {
  /** Paños de la hoja que faltan en el sistema (a agregar). */
  nuevos: FilaRolzzo[];
  /** Paños de la hoja que ya están en el sistema. */
  yaEnSistema: number;
  /** Paños ROLZZO disponibles en el sistema que no están en la hoja (informativo). */
  soloEnSistema: number;
  hoja: string;
  advertencias: string[];
  totalHoja: number;
};

/**
 * Reconciliación ADITIVA por tupla. Solo considera paños disponibles de la hoja.
 * Compara contra los paños ROLZZO disponibles (no baja) del sistema; por cada
 * tupla, el excedente de la hoja sobre el sistema son "nuevos" a insertar. NUNCA
 * marca bajas (decisión del usuario). Idempotente: re-subir la hoja → 0 nuevos.
 */
export function diffRolzzo(panos: ColmenaPano[], parseo: ParseoRolzzo): DiffRolzzo {
  const dbCounts = new Map<string, number>();
  for (const p of panos) {
    if (p.datos_extra?.zona !== ZONA_ROLZZO) continue;
    if (!p.disponible || p.datos_extra?.baja) continue;
    const k = clavePanoRolzzo(p);
    dbCounts.set(k, (dbCounts.get(k) ?? 0) + 1);
  }

  const sheetGroups = new Map<string, FilaRolzzo[]>();
  for (const f of parseo.filas) {
    if (!f.disponible) continue;
    const k = claveRolzzo(f.codigo, f.ancho, f.alto, f.ubicacion);
    sheetGroups.set(k, [...(sheetGroups.get(k) ?? []), f]);
  }

  const nuevos: FilaRolzzo[] = [];
  let yaEnSistema = 0;
  const sheetCounts = new Map<string, number>();
  for (const [k, filas] of sheetGroups) {
    sheetCounts.set(k, filas.length);
    const dbN = dbCounts.get(k) ?? 0;
    const extra = filas.length - dbN;
    for (let i = 0; i < extra; i++) nuevos.push(filas[i]);
    yaEnSistema += Math.min(filas.length, dbN);
  }

  let soloEnSistema = 0;
  for (const [k, dbN] of dbCounts) {
    soloEnSistema += Math.max(0, dbN - (sheetCounts.get(k) ?? 0));
  }

  return {
    nuevos,
    yaEnSistema,
    soloEnSistema,
    hoja: parseo.hoja,
    advertencias: parseo.advertencias,
    totalHoja: parseo.filas.length,
  };
}

// ── Plan de aplicación (solo inserts) ────────────────────────────────
export function planRolzzo(
  diff: DiffRolzzo,
  seleccion: Set<number>, // índices dentro de diff.nuevos
  ctx: { empresaId: string; ahoraISO: string },
): PlanAplicacion {
  const fuente = `IMPORT_ROLZZO_${ctx.ahoraISO.slice(0, 10)}`;
  const inserts: PanoInsertMapa[] = diff.nuevos
    .map((f, i) => ({ f, i }))
    .filter(({ i }) => seleccion.has(i))
    .map(({ f }) => ({
      empresa_id: ctx.empresaId,
      codigo: f.codigo,
      medida_ancho: f.ancho,
      medida_alto: f.alto,
      disponible: true,
      tipo: 'SOBRANTE',
      ubicacion: f.ubicacion,
      datos_extra: {
        zona: ZONA_ROLZZO,
        fuente,
        creadoEn: ctx.ahoraISO,
        ...(f.serial ? { serial: f.serial } : {}),
      },
    }));
  return { inserts, updates: [], bajas: [], fuente };
}
