// ─────────────────────────────────────────────────────────────────────
// Importador de la COLMENA DE PAÑOS (MAPA) desde el Excel del galpón.
//
// El usuario mantiene un Google Sheet "COLMENA DE PAÑOS (MAPA)" con la grilla
// física del galpón: 7 RACKs, filas M1..M9, columnas numeradas, UN paño por
// celda. Cada celda contiene el código de tela + medidas (ej. "BK 61 188X250").
// Este módulo (PURO, sin React/Supabase) lo parsea, lo reconcilia contra
// `colmena_panos` (NO reemplaza) y arma el plan de inserts/updates/bajas.
//
// GEOMETRÍA (calibrada desde los 151 paños GALPON ya cargados — fuente
// COLMENA_PANOS_MAPA, 2026-06-26 — leyendo datos_extra.cell = celda A1 original):
//   • rack  = ceil(colIndexXlsx / 6)   → C-F=r1, G-L=r2, … AK-AP=r7
//   • col   = colIndexXlsx − 1         → C(3)=col2 … AP(42)=col41
//   • m     = 19 − filaXlsx            → fila 18=M1 … fila 13=M6 (M crece hacia arriba)
// colIndexXlsx/filaXlsx son 1-based (A=1). Si el Sheet trae rótulos "M1".."M9"
// en alguna columna, se usan como fuente autoritativa de la fila→M (robusto a
// desplazamientos verticales); si no, se cae al offset calibrado (19 − fila).
//
// INCÓGNITA DE CALIBRACIÓN (ajustar al ver el export real): el formato EXACTO
// del texto dentro de cada celda. `parsearContenidoCelda` es tolerante (código
// 2-3 letras + número, medidas "AxB" en cm o metros, coma o punto decimal); si
// el Sheet usa otro layout, es el único punto a tocar.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import type { ColmenaPano } from '@/modules/admin/colmena';
import { ZONAS, zonaDe } from '@/modules/telas/colmenaViva';

// ── Geometría ────────────────────────────────────────────────────────
const COLS_POR_RACK = 6;
/** Fila xlsx (1-based) de M1 cuando el Sheet no trae rótulos "M". Calibrado. */
const FILA_M1_DEFECTO = 18;
/** Zona por defecto de las celdas del MAPA (histórico: solo GALPON). */
export const ZONA_MAPA_DEFECTO = 'GALPON';
/** Tolerancia de medidas (cm) para considerar una celda "sin cambio". */
export const TOLERANCIA_CM = 1;

export const rackDeColIndex = (colIndex1: number): number =>
  Math.ceil(colIndex1 / COLS_POR_RACK);
export const colLogicaDeColIndex = (colIndex1: number): number => colIndex1 - 1;

/** Entero de coordenada ≥ 1, o null (misma semántica que colmenaViva.coord). */
function coord(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Normaliza un código de paño al formato de `colmena_panos.codigo`: prefijo en
 * mayúsculas + espacio + número con 2 dígitos ("du 7" / "DU07" → "DU 07").
 * Si no calza el patrón, colapsa espacios y sube a mayúsculas.
 */
export function normCodPano(s: unknown): string {
  const base = String(s ?? '').trim().toUpperCase();
  const m = base.match(/^([A-Z]{2,3})\s*0*(\d{1,3})\b/);
  if (!m) return base.replace(/\s+/g, ' ');
  return `${m[1]} ${m[2].padStart(2, '0')}`;
}

/** Número de celda a cm. Heurística: < 20 se interpreta en metros (×100). */
function aCm(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const cm = n < 20 ? n * 100 : n;
  return Math.round(cm * 10) / 10;
}

/**
 * Parsea el contenido de UNA celda del MAPA → código + medidas. Tolerante:
 * acepta "BK 61 188X250", "bk61 188 x 250", "SC 64 (178X200)", "DU 07\n1,88x2,50".
 * Devuelve null si no hay un código reconocible (rótulos, vacíos, basura).
 */
export function parsearContenidoCelda(
  raw: unknown,
): { codigo: string; ancho: number | null; alto: number | null } | null {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const mCod = s.match(/^([A-Za-z]{2,3})\s*0*(\d{1,3})\b/);
  if (!mCod) return null;
  const codigo = `${mCod[1].toUpperCase()} ${mCod[2].padStart(2, '0')}`;
  const mMed = s.match(/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
  const ancho = mMed ? aCm(mMed[1]) : null;
  const alto = mMed ? aCm(mMed[2]) : null;
  return { codigo, ancho, alto };
}

// ── Parseo del libro ─────────────────────────────────────────────────
/**
 * Parsea la NOTA (comentario) de una celda del MAPA → medidas + comentario.
 * Formato típico: "… | COD: BK 61 | ANCHO: 188 | ALTO: 250 | ¿ESTATUS? …".
 * Las medidas del MAPA viven en la nota, no en el texto de la celda.
 * Caso "2 paños" ("ALTO: (2 PAÑOS) 214 129"): `alto` = primer número (best-effort),
 * `complejo=true` y se conserva la nota completa como comentario (pedido del usuario).
 */
export function parsearNota(texto: unknown): {
  ancho: number | null;
  alto: number | null;
  comentario: string | null;
  complejo: boolean;
} {
  const s = String(texto ?? '').replace(/\r/g, '');
  if (!s.trim()) return { ancho: null, alto: null, comentario: null, complejo: false };
  const plano = s.replace(/\n/g, ' ');
  const mA = plano.match(/ANCHO:\s*(\d+(?:[.,]\d+)?)/i);
  const ancho = mA ? aCm(mA[1]) : null;
  const altoTxt = (plano.match(/ALTO:\s*(.*?)(?:¿|QUIEN\s+CARGA|$)/i)?.[1] ?? '').trim();
  // Quita paréntesis ("(2 PAÑOS)") para que su número no se cuele como alto.
  const sinParen = altoTxt.replace(/\([^)]*\)/g, ' ');
  const nums = [...sinParen.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0]);
  const complejo = /\(|PAÑO/i.test(altoTxt) || nums.length > 1;
  const alto = nums.length ? aCm(nums[0]) : null;
  return { ancho, alto, comentario: complejo ? s.trim() : null, complejo };
}

export type CeldaMapa = {
  zona: string;
  rack: number;
  m: number;
  col: number;
  /** Referencia A1 original del xlsx (ej. "C18") — trazabilidad. */
  cell: string;
  codigo: string;
  ancho: number | null;
  alto: number | null;
  /** Nota de la celda a preservar (solo casos "2 paños"); null si medida limpia. */
  comentario: string | null;
  /** Texto original de la celda (preview/diagnóstico). */
  raw: string;
};

export type ParseoMapa = {
  celdas: CeldaMapa[];
  zonas: string[];
  hoja: string;
  advertencias: string[];
};

/** Escanea las celdas buscando rótulos "M1".."M9" → mapa filaIdx0 → M. */
function mapaFilasM(rows: unknown[][]): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < rows.length; i++) {
    for (const c of rows[i] || []) {
      const mm = String(c ?? '').trim().toUpperCase().match(/^M\s*0*(\d{1,2})$/);
      if (mm) {
        const m = Number(mm[1]);
        if (m >= 1 && !map.has(i)) map.set(i, m);
      }
    }
  }
  return map;
}

/** Referencia A1 de una celda 0-based (fila, col) → "C18". */
function refA1(filaIdx0: number, colIdx0: number): string {
  return XLSX.utils.encode_cell({ r: filaIdx0, c: colIdx0 });
}

/**
 * Elige la hoja del MAPA y devuelve sus filas. Preferencia por nombre ("…(MAPA)"):
 * el libro real trae hojas ROLZZO de 100k+ filas que no se deben recorrer. Si no
 * hay ninguna con "MAPA" en el nombre, cae a puntuar por códigos pero solo las
 * primeras filas de cada hoja (tope de seguridad). Compartida por el parser de
 * GALPON y el de LIBERADO para garantizar que lean la MISMA hoja.
 */
export function elegirHojaMapa(wb: WorkBook): { hoja: string; rows: unknown[][] } {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filasDe = (nombre: string): unknown[][] =>
    XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: false, defval: '' }) as unknown[][];

  const preferida = wb.SheetNames.find((n) => norm(n).includes('mapa'));
  let mejorHoja = preferida ?? wb.SheetNames[0] ?? '';
  let mejorRows: unknown[][] = mejorHoja ? filasDe(mejorHoja) : [];
  if (!preferida) {
    let mejorScore = -1;
    for (const nombre of wb.SheetNames) {
      const sh = wb.Sheets[nombre];
      const ref = sh?.['!ref'];
      const nFilas = ref ? XLSX.utils.decode_range(ref).e.r + 1 : 0;
      if (nFilas > 5000) continue; // hoja enorme (ROLZZO/mermas) → no es el MAPA
      const rows = filasDe(nombre);
      let score = 0;
      for (const r of rows) for (const c of r || []) if (parsearContenidoCelda(c)) score++;
      if (score > mejorScore) {
        mejorScore = score;
        mejorHoja = nombre;
        mejorRows = rows;
      }
    }
  }
  return { hoja: mejorHoja, rows: mejorRows };
}

/**
 * Parsea el libro del MAPA → celdas con coordenadas rack/m/col. Elige la hoja
 * con más contenido tipo código. Detecta rótulos M para anclar las filas; si no
 * hay, usa el offset calibrado. Zona = GALPON (histórico); ajustable si el Sheet
 * incorpora un bloque LIBERADO rotulado.
 */
export function parsearMapaExcel(wb: WorkBook): ParseoMapa {
  const advertencias: string[] = [];
  const { hoja: mejorHoja, rows: mejorRows } = elegirHojaMapa(wb);

  const filasM = mapaFilasM(mejorRows);
  const usarLabels = filasM.size >= 2;
  const mDeFila = (filaIdx0: number): number | null => {
    if (usarLabels) return filasM.get(filaIdx0) ?? null; // fuera de la grilla → null
    return FILA_M1_DEFECTO - (filaIdx0 + 1) + 1; // 19 − filaXlsx
  };

  // Worksheet real: las medidas del MAPA están en la NOTA de cada celda (.c),
  // no en el texto; se leen del objeto de hoja, no de sheet_to_json.
  const ws = wb.Sheets[mejorHoja] as Record<string, { c?: { t?: string }[] } | undefined>;

  const celdas: CeldaMapa[] = [];
  const vistos = new Set<string>();
  for (let i = 0; i < mejorRows.length; i++) {
    const fila = mejorRows[i] || [];
    for (let j = 0; j < fila.length; j++) {
      const parsed = parsearContenidoCelda(fila[j]);
      if (!parsed) continue;
      const m = mDeFila(i);
      if (m === null || m < 1) continue; // fila fuera de la grilla
      const colIndex1 = j + 1;
      const rack = rackDeColIndex(colIndex1);
      const col = colLogicaDeColIndex(colIndex1);
      if (rack < 1 || col < 1) continue;
      const clave = claveIdentidad(ZONA_MAPA_DEFECTO, rack, m, col);
      if (vistos.has(clave)) {
        advertencias.push(
          `Coordenada duplicada R${rack}·M${m}·col${col} (celda ${refA1(i, j)}): se ignora la repetición.`,
        );
        continue;
      }
      vistos.add(clave);
      const notaTxt = (ws[refA1(i, j)]?.c ?? []).map((x) => x.t ?? '').join('\n');
      const nota = parsearNota(notaTxt);
      celdas.push({
        zona: ZONA_MAPA_DEFECTO,
        rack,
        m,
        col,
        cell: refA1(i, j),
        codigo: parsed.codigo,
        ancho: nota.ancho ?? parsed.ancho,
        alto: nota.alto ?? parsed.alto,
        comentario: nota.comentario,
        raw: String(fila[j] ?? '').replace(/\s+/g, ' ').trim(),
      });
    }
  }

  const zonas = Array.from(new Set(celdas.map((c) => c.zona)));
  return { celdas, zonas, hoja: mejorHoja, advertencias };
}

// ── Identidad y diff ─────────────────────────────────────────────────
export const claveIdentidad = (zona: string, rack: number, m: number, col: number): string =>
  `${zona}|${rack}|${m}|${col}`;

/** Clave de un paño de BD desde sus coordenadas; null si le faltan. */
export function clavePano(p: ColmenaPano): string | null {
  const d = p.datos_extra ?? {};
  const rack = coord(d.rack);
  const m = coord(d.m);
  const col = coord(d.col);
  if (rack === null || m === null || col === null) return null;
  return claveIdentidad(zonaDe(p), rack, m, col);
}

/** ¿La zona se dibuja como grilla M×col (GALPON/LIBERADO)? Las 'slots' no se tocan. */
function esZonaGrid(zona: string): boolean {
  return (ZONAS[zona]?.modo ?? 'grid') === 'grid';
}

function medidasIguales(
  celda: CeldaMapa,
  p: ColmenaPano,
): boolean {
  const cmpUno = (nuevo: number | null, viejo: number | null) => {
    if (nuevo === null) return true; // el Sheet sin medida no cuenta como cambio
    if (viejo === null) return false;
    return Math.abs(nuevo - viejo) <= TOLERANCIA_CM;
  };
  return cmpUno(celda.ancho, p.medida_ancho) && cmpUno(celda.alto, p.medida_alto);
}

export type ModificadoMapa = {
  celda: CeldaMapa;
  pano: ColmenaPano;
  cambiaCodigo: boolean;
  cambiaMedidas: boolean;
};
export type ConflictoMapa = {
  pano: ColmenaPano | null;
  celda: CeldaMapa | null;
  motivo: string;
};
export type DiffMapa = {
  nuevos: CeldaMapa[];
  modificados: ModificadoMapa[];
  bajas: ColmenaPano[];
  conflictos: ConflictoMapa[];
  sinCambio: ColmenaPano[];
  zonasTocadas: string[];
};

/**
 * Reconcilia el MAPA parseado contra los paños de BD. Llave = (zona,rack,m,col).
 * SOLO considera zonas grilla presentes en el archivo (GALPON; y LIBERADO si el
 * Sheet lo trae). ROLZZO/CORTE quedan intactas por construcción. Paños con
 * datos_extra.baja previo se ignoran. Ver reglas en el encabezado del plan.
 */
export function diffMapa(panos: ColmenaPano[], parseo: ParseoMapa): DiffMapa {
  const zonasTocadas = parseo.zonas.filter(esZonaGrid);
  const zonasSet = new Set(zonasTocadas);

  // Índice del Sheet por clave (el parser ya deduplicó por coordenada).
  const sheetByClave = new Map<string, CeldaMapa>();
  for (const c of parseo.celdas) {
    const k = claveIdentidad(c.zona, c.rack, c.m, c.col);
    if (!sheetByClave.has(k)) sheetByClave.set(k, c);
  }

  const conflictos: ConflictoMapa[] = [];
  // Paños en alcance: zona tocada + no dados de baja previamente.
  const enAlcance = panos.filter(
    (p) => zonasSet.has(zonaDe(p)) && !p.datos_extra?.baja,
  );
  const dbByClave = new Map<string, ColmenaPano[]>();
  for (const p of enAlcance) {
    const k = clavePano(p);
    if (k === null) {
      conflictos.push({ pano: p, celda: null, motivo: 'Paño sin coordenada rack/m/col en la base' });
      continue;
    }
    dbByClave.set(k, [...(dbByClave.get(k) ?? []), p]);
  }

  const nuevos: CeldaMapa[] = [];
  const modificados: ModificadoMapa[] = [];
  const bajas: ColmenaPano[] = [];
  const sinCambio: ColmenaPano[] = [];

  // 1) Recorre las celdas del Sheet.
  for (const [clave, celda] of sheetByClave) {
    const grupo = dbByClave.get(clave) ?? [];
    if (grupo.length === 0) {
      nuevos.push(celda);
      continue;
    }
    const disponibles = grupo.filter((p) => p.disponible);
    if (disponibles.length === 0) {
      const p = grupo[0];
      conflictos.push({
        pano: p,
        celda,
        motivo: `Celda ocupada en el MAPA pero el paño está usado/reservado${
          p.ot_asignada ? ` (OT ${p.ot_asignada})` : ''
        }`,
      });
      continue;
    }
    if (disponibles.length > 1) {
      conflictos.push({
        pano: disponibles[0],
        celda,
        motivo: `Hay ${disponibles.length} paños disponibles en la misma celda R${celda.rack}·M${celda.m}·col${celda.col}`,
      });
      continue;
    }
    const p = disponibles[0];
    const cambiaCodigo = normCodPano(celda.codigo) !== normCodPano(p.codigo);
    const cambiaMedidas = !medidasIguales(celda, p);
    if (!cambiaCodigo && !cambiaMedidas) sinCambio.push(p);
    else modificados.push({ celda, pano: p, cambiaCodigo, cambiaMedidas });
  }

  // 2) Paños de BD cuya celda ya no está en el Sheet.
  for (const [clave, grupo] of dbByClave) {
    if (sheetByClave.has(clave)) continue;
    for (const p of grupo) {
      if (p.disponible) bajas.push(p);
      else
        conflictos.push({
          pano: p,
          celda: null,
          motivo: `Paño usado/reservado${
            p.ot_asignada ? ` (OT ${p.ot_asignada})` : ''
          } y su celda ya no está en el MAPA`,
        });
    }
  }

  return { nuevos, modificados, bajas, conflictos, sinCambio, zonasTocadas };
}

// ── Guard de bajas masivas ───────────────────────────────────────────
export type GuardBajaZona = {
  zona: string;
  bajas: number;
  disponibles: number;
  excede: boolean;
};
const BAJA_ABS_MIN = 10;
const BAJA_REL_MIN = 0.1;

/** Por zona tocada: ¿las bajas superan 10 absolutas Y el 10% de los disponibles? */
export function guardBajasMasivas(diff: DiffMapa, panos: ColmenaPano[]): GuardBajaZona[] {
  return diff.zonasTocadas.map((zona) => {
    const disponibles = panos.filter(
      (p) => zonaDe(p) === zona && p.disponible && !p.datos_extra?.baja,
    ).length;
    const bajas = diff.bajas.filter((p) => zonaDe(p) === zona).length;
    const excede = bajas > BAJA_ABS_MIN && bajas > BAJA_REL_MIN * disponibles;
    return { zona, bajas, disponibles, excede };
  });
}

// ── Plan de aplicación ───────────────────────────────────────────────
export type PanoInsertMapa = {
  empresa_id: string;
  codigo: string;
  medida_ancho: number | null;
  medida_alto: number | null;
  disponible: true;
  tipo: 'SOBRANTE';
  ubicacion: string;
  datos_extra: Record<string, unknown>;
};
export type PanoUpdateMapa = {
  id: string;
  codigo: string;
  medida_ancho: number | null;
  medida_alto: number | null;
  datos_extra: Record<string, unknown>;
};
export type PanoBajaMapa = { id: string; datos_extra: Record<string, unknown> };

export type PlanAplicacion = {
  inserts: PanoInsertMapa[];
  updates: PanoUpdateMapa[];
  bajas: PanoBajaMapa[];
  fuente: string;
};

export type SeleccionMapa = {
  nuevos: Set<string>; // claveIdentidad
  modificados: Set<string>; // pano.id
  bajas: Set<string>; // pano.id
};

/**
 * Construye el plan de escrituras a partir del diff y la selección del usuario.
 * `ctx.ahoraISO` viene del componente (módulo puro: sin Date.now()). No inventa
 * `fecha_origen`: los paños nuevos heredan su antigüedad de created_at en BD.
 */
export function planAplicacion(
  diff: DiffMapa,
  seleccion: SeleccionMapa,
  ctx: { empresaId: string; ahoraISO: string },
): PlanAplicacion {
  const fuente = `IMPORT_MAPA_${ctx.ahoraISO.slice(0, 10)}`;

  const inserts: PanoInsertMapa[] = diff.nuevos
    .filter((c) => seleccion.nuevos.has(claveIdentidad(c.zona, c.rack, c.m, c.col)))
    .map((c) => ({
      empresa_id: ctx.empresaId,
      codigo: c.codigo,
      medida_ancho: c.ancho,
      medida_alto: c.alto,
      disponible: true,
      tipo: 'SOBRANTE',
      ubicacion: `MAPA M${c.m}-${c.col}`,
      datos_extra: {
        zona: c.zona,
        rack: c.rack,
        m: c.m,
        col: c.col,
        cell: c.cell,
        fuente,
        creadoEn: ctx.ahoraISO,
        ...(c.comentario ? { comentario: c.comentario } : {}),
      },
    }));

  const updates: PanoUpdateMapa[] = diff.modificados
    .filter((mod) => seleccion.modificados.has(mod.pano.id))
    .map(({ celda, pano }) => ({
      id: pano.id,
      codigo: celda.codigo,
      medida_ancho: celda.ancho ?? pano.medida_ancho,
      medida_alto: celda.alto ?? pano.medida_alto,
      datos_extra: {
        ...(pano.datos_extra ?? {}),
        cell: celda.cell,
        actualizadoEn: ctx.ahoraISO,
        fuente_actualizacion: fuente,
        ...(celda.comentario ? { comentario: celda.comentario } : {}),
      },
    }));

  const bajas: PanoBajaMapa[] = diff.bajas
    .filter((p) => seleccion.bajas.has(p.id))
    .map((p) => ({
      id: p.id,
      datos_extra: {
        ...(p.datos_extra ?? {}),
        baja: true,
        fecha_baja: ctx.ahoraISO,
        motivo_baja: 'no está en el MAPA importado',
        fuente_baja: fuente,
      },
    }));

  return { inserts, updates, bajas, fuente };
}
