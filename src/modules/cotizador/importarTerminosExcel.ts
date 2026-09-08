// ─────────────────────────────────────────────────────────────────────
// Leer los TÉRMINOS Y CONDICIONES desde la planilla de cotización (.xlsm).
//
// El dueño (2026-09-07): «acá los términos y condiciones ojalá poder subir el
// excel y que se carguen automático para no estar uno a uno». Son ~27 párrafos
// largos y hoy hay que pegarlos de a uno.
//
// En la planilla viven en la hoja «Formato de Cotizacion», bajo el rótulo
// «TÉRMINOS Y CONDICIONES GENERALES:». Cada término ocupa una fila: el número
// («1.», «2.»…) en la misma columna del rótulo y el texto en la de al lado.
// Las rarezas que trae el archivo real y que este parser tiene que aguantar:
//   · la numeración NO es correlativa (en el de ALBERTO falta el 8);
//   · un término trae el texto más a la derecha (col 5, no col 2) porque su
//     celda está combinada de otra forma;
//   · varios repiten el mismo texto en dos columnas (celdas combinadas);
//   · a la derecha, en las columnas 15-17, está el recuadro de totales, que NO
//     es un término;
//   · la lista termina en «NUESTROS PROYECTOS Y PRODUCTOS».
//
// Módulo puro: recibe el workbook ya leído (`XLSX.read`), no toca el disco ni
// la red, y se testea con hojas armadas a mano.
// ─────────────────────────────────────────────────────────────────────
import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';
import { claveTermino } from './terminos';

/** El rótulo que abre la lista en la planilla. */
const RE_ANCLA = /T[ÉE]RMINOS\s+Y\s+CONDICIONES/i;

/** «1.», «12», «27.» — el número con el que la planilla enumera cada término. */
const RE_NUMERO = /^\d{1,3}\.?$/;

/**
 * Hasta cuántas columnas a la derecha del número se busca el texto. Ocho
 * alcanza para la celda combinada que cae en la col 5 y deja fuera el recuadro
 * de totales (col 15 en adelante), que si no entraría como término.
 */
const COLUMNAS_A_LA_DERECHA = 8;

export type TerminosImportados = {
  /** Hoja de la que se leyeron (para mostrarlo en la vista previa). */
  hoja: string;
  /** Fila del rótulo, 1-indexada como la ve el usuario en Excel. */
  filaAncla: number;
  terminos: string[];
};

const texto = (x: unknown): string =>
  typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '';

/** ¿Esta celda es el número de un término? (número o «12.» como texto) */
function esNumeroDeTermino(celda: unknown): boolean {
  if (typeof celda === 'number') return Number.isFinite(celda);
  return RE_NUMERO.test(String(celda ?? '').trim());
}

/**
 * Los términos de una planilla de cotización, o `null` si no tiene el rótulo.
 *
 * Se recorren TODAS las hojas: la plantilla se llama «Formato de Cotizacion»,
 * pero cada vendedora renombra su copia y no vale la pena fallar por eso.
 */
export function parsearTerminosExcel(wb: WorkBook): TerminosImportados | null {
  for (const hoja of wb.SheetNames) {
    const ws = wb.Sheets[hoja];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    for (let fila = 0; fila < aoa.length; fila++) {
      const cols = aoa[fila] ?? [];
      const col = cols.findIndex((c) => typeof c === 'string' && RE_ANCLA.test(c));
      if (col < 0) continue;
      const terminos = leerDesde(aoa, fila + 1, col);
      if (terminos.length) return { hoja, filaAncla: fila + 1, terminos };
    }
  }
  return null;
}

/** Lee hacia abajo mientras la columna del rótulo traiga el número de un término. */
function leerDesde(aoa: unknown[][], desde: number, col: number): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  for (let fila = desde; fila < aoa.length; fila++) {
    const cols = aoa[fila] ?? [];
    // La lista se corta en la primera fila que ya no numera nada: en la
    // planilla real es «NUESTROS PROYECTOS Y PRODUCTOS».
    if (!esNumeroDeTermino(cols[col])) break;
    const t = primerTexto(cols, col);
    if (!t) continue;
    const k = claveTermino(t);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    out.push(t);
  }
  return out;
}

/** El texto del término: la primera celda con letras a la derecha del número. */
function primerTexto(cols: unknown[], col: number): string {
  for (let j = col + 1; j <= col + COLUMNAS_A_LA_DERECHA; j++) {
    const t = texto(cols[j]);
    // Una celda con solo dígitos o signos no es el texto: es otra parte de la
    // numeración o un resto de la celda combinada.
    if (t && /[a-záéíóúñ]/i.test(t)) return t;
  }
  return '';
}
