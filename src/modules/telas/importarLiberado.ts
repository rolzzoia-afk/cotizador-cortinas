// ─────────────────────────────────────────────────────────────────────
// Importador de la zona LIBERADO desde el Excel del galpón.
//
// En la MISMA hoja "COLMENA DE PAÑOS (MAPA)", debajo de la grilla GALPÓN, hay
// bloques "UBICACIÓN: LIBERADO RACK #N" (N = 1..4). Cada bloque es una lista
// horizontal de códigos (no la grilla M/rack): un código por celda, filas de
// datos que empiezan 4 renglones bajo el rótulo. Las medidas viven en la NOTA
// (comentario) de la celda, casi siempre en METROS ("3.00 X 2.20") y a veces
// en cm ("236X290"); los dúos traen dos pares ("0.88 X 5.15  1.11 X 5.15").
//
// Un código TACHADO = paño ya usado/salido → NO se importa (queda como celda
// ausente → baja en la reconciliación). El tachado no lo expone la librería
// xlsx, así que se lee del XML crudo: styles.xml da qué fuentes llevan
// <strike/> y qué xf usa cada una; la hoja mapea celda→xf. Se descomprime SOLO
// los 4 archivos necesarios con fflate (bookFiles retendría 250MB del libro
// real por las hojas ROLZZO de 100k filas). Ver `leerTachados`.
//
// GEOMETRÍA (calibrada contra los 132 paños LIBERADO ya cargados — fuente
// COLMENA_LIBERADO_2026-06-26 — leyendo datos_extra.rack/m/col):
//   • rack = N del rótulo "LIBERADO RACK #N"
//   • m    = fila de datos dentro del bloque, 1-based (1ª fila = rótulo + 4)
//   • col  = colIndexXlsx − 1   (B=col1, C=col2, …). La columna A es margen.
// La llave (rack,m,col) es estable ante desplazamientos verticales de la hoja
// (m es relativo al bloque), así que reconcilia con lo ya cargado. Se produce
// un `ParseoMapa` con zona LIBERADO y se reusa `diffMapa`/`planAplicacion`.
//
// NOTA "DU D" / "BK D": la colmena real tiene códigos con letra en vez de
// número (marcador de la planilla). Ya están en BD, así que el detector de
// código los acepta ("XX D") para que reconcilien como sin-cambio y NO se den
// de baja por error.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import { unzipSync } from 'fflate';
import {
  elegirHojaMapa,
  claveIdentidad,
  colLogicaDeColIndex,
  type CeldaMapa,
  type ParseoMapa,
} from '@/modules/telas/importarMapa';

/** Zona de las celdas de estos bloques. */
export const ZONA_LIBERADO = 'LIBERADO';
/** Filas entre el rótulo "UBICACIÓN: LIBERADO RACK #N" y la 1ª fila de datos. */
const OFFSET_PRIMERA_FILA = 4;

/** Número de celda a cm. Heurística: < 20 se interpreta en metros (×100). */
function aCm(s: string): number | null {
  const n = parseFloat(String(s).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const cm = n < 20 ? n * 100 : n;
  return Math.round(cm * 10) / 10;
}

/** Referencia A1 de una celda 0-based (fila, col) → "C43". */
function refA1(filaIdx0: number, colIdx0: number): string {
  return XLSX.utils.encode_cell({ r: filaIdx0, c: colIdx0 });
}

/**
 * Detecta un código de paño LIBERADO. Acepta el formato estándar "XX 07" y el
 * especial "XX D" (marcador de la planilla, ya presente en BD). Devuelve el
 * código normalizado o null si la celda no es un código (rótulos, vacíos).
 */
export function parsearCodigoLiberado(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const mNum = s.match(/^([A-Za-z]{2,3})\s*0*(\d{1,3})\b/);
  if (mNum) return `${mNum[1].toUpperCase()} ${mNum[2].padStart(2, '0')}`;
  const mLetra = s.match(/^([A-Za-z]{2,3})\s+([A-Za-z])$/); // "DU D"
  if (mLetra) return `${mLetra[1].toUpperCase()} ${mLetra[2].toUpperCase()}`;
  return null;
}

/**
 * Parsea la NOTA de una celda LIBERADO → medidas. Toma el texto tras el último
 * ")" (después de la fecha del comentario) para evitar que los números del
 * ID/fecha se cuelen, y extrae los pares "A x B". Primer par = ancho×alto (en
 * metros o cm). Dos o más pares = dúo → complejo (se conserva la nota completa).
 */
export function parsearNotaLiberado(texto: unknown): {
  ancho: number | null;
  alto: number | null;
  comentario: string | null;
  complejo: boolean;
} {
  const s = String(texto ?? '').replace(/\r/g, '');
  if (!s.trim()) return { ancho: null, alto: null, comentario: null, complejo: false };
  const tail = s.includes(')') ? s.slice(s.lastIndexOf(')') + 1) : s;
  const pares = [...tail.matchAll(/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/g)];
  if (pares.length === 0) return { ancho: null, alto: null, comentario: null, complejo: false };
  const complejo = pares.length > 1;
  return {
    ancho: aCm(pares[0][1]),
    alto: aCm(pares[0][2]),
    comentario: complejo ? s.trim() : null,
    complejo,
  };
}

// ── Lectura del tachado (XML crudo) ──────────────────────────────────
/** Decodifica bytes UTF-8 a texto. */
function dec(u8: Uint8Array | undefined): string {
  return u8 ? new TextDecoder().decode(u8) : '';
}

/**
 * Dado el styles.xml y el XML de una hoja, devuelve el set de referencias A1
 * cuyas celdas usan una fuente tachada (<strike/>). PURA (testeable con XML a
 * mano). Mapea fuente→índice, xf→fontId y celda(s="N")→xf.
 */
export function parsearTachados(stylesXml: string, worksheetXml: string): Set<string> {
  const struck = new Set<string>();
  const fontsBlock = stylesXml.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/)?.[1] ?? '';
  const fontStrike = [...fontsBlock.matchAll(/<font>([\s\S]*?)<\/font>|<font\/>/g)].map((m) =>
    /<strike\b/.test(m[0]),
  );
  const xfsBlock = stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
  const xfFont = [...xfsBlock.matchAll(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g)].map((m) => {
    const f = m[0].match(/fontId="(\d+)"/);
    return f ? Number(f[1]) : 0;
  });
  for (const m of worksheetXml.matchAll(/<c r="([A-Z]+\d+)"(?:[^>]*\bs="(\d+)")?/g)) {
    const s = m[2] ? Number(m[2]) : 0;
    if (fontStrike[xfFont[s] ?? 0]) struck.add(m[1]);
  }
  return struck;
}

/**
 * Set de celdas tachadas de una hoja, leído del .xlsx/.xlsm crudo. Descomprime
 * SOLO los archivos necesarios con fflate (styles.xml + workbook.xml + rels +
 * el XML de la hoja) — nunca las hojas gigantes. Ante cualquier fallo (no es un
 * zip, falta un archivo, hoja inexistente) devuelve un set vacío: degradación
 * segura (nada se toma como usado, mejor no borrar de más).
 */
export function leerTachados(bytes: ArrayBuffer | Uint8Array, nombreHoja: string): Set<string> {
  try {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const meta = unzipSync(u8, {
      filter: (f) =>
        f.name === 'xl/workbook.xml' ||
        f.name === 'xl/_rels/workbook.xml.rels' ||
        f.name === 'xl/styles.xml',
    });
    const wbXml = dec(meta['xl/workbook.xml']);
    const relsXml = dec(meta['xl/_rels/workbook.xml.rels']);
    const stylesXml = dec(meta['xl/styles.xml']);
    if (!wbXml || !relsXml || !stylesXml) return new Set();

    const sheet = [...wbXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].find(
      (m) => m[1] === nombreHoja,
    );
    if (!sheet) return new Set();
    const rel = [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].find(
      (m) => m[1] === sheet[2],
    );
    if (!rel) return new Set();
    let target = rel[2].replace(/^\//, '');
    if (!target.startsWith('xl/')) target = `xl/${target}`;

    const ws = unzipSync(u8, { filter: (f) => f.name === target });
    const wsXml = dec(ws[target]);
    if (!wsXml) return new Set();
    return parsearTachados(stylesXml, wsXml);
  } catch {
    return new Set();
  }
}

// ── Parseo de los bloques LIBERADO ───────────────────────────────────
const RE_LIB_HEADER = /UBICACIÓN:\s*LIBERADO\s*RACK\s*#?\s*(\d+)/i;
const RE_TITULO = /UBICACIÓN|COLMENA DE PAÑOS|COLMENA DE DUOS/i;

/**
 * Parsea los bloques "LIBERADO RACK #N" de la hoja del MAPA → celdas con
 * coordenadas (rack, m, col) y zona LIBERADO. Salta los códigos tachados
 * (usados) según `opts.tachados` (calcularlo con `leerTachados` sobre los bytes
 * del archivo). Si no se pasa, no salta ninguno. Devuelve un `ParseoMapa`
 * reutilizable por `diffMapa`.
 */
export function parsearLiberadoExcel(
  wb: WorkBook,
  opts?: { tachados?: Set<string> },
): ParseoMapa {
  const advertencias: string[] = [];
  const { hoja, rows } = elegirHojaMapa(wb);
  const ws = wb.Sheets[hoja] as Record<string, { c?: { t?: string }[] } | undefined>;
  const tachados = opts?.tachados ?? new Set<string>();

  // Rótulos de bloque LIBERADO + todas las filas "título" (para acotar cada bloque).
  const headers: { row: number; rack: number }[] = [];
  const titulos: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (const c of rows[i] || []) {
      const v = String(c ?? '');
      if (RE_TITULO.test(v)) titulos.push(i);
      const mm = v.match(RE_LIB_HEADER);
      if (mm) headers.push({ row: i, rack: Number(mm[1]) });
    }
  }
  const titulosOrd = Array.from(new Set(titulos)).sort((a, b) => a - b);

  const celdas: CeldaMapa[] = [];
  const vistos = new Set<string>();
  let ilegibles = 0;
  for (const h of headers) {
    const primera = h.row + OFFSET_PRIMERA_FILA;
    const fin = titulosOrd.find((t) => t > h.row) ?? rows.length;
    for (let r = primera; r < fin; r++) {
      const fila = rows[r] || [];
      for (let j = 0; j < fila.length; j++) {
        const val = fila[j];
        if (val === '' || val == null) continue;
        const col = colLogicaDeColIndex(j + 1); // (j+1) − 1 = j ; col 0 = margen (A)
        if (col < 1) continue;
        const addr = refA1(r, j);
        if (tachados.has(addr)) continue; // paño usado → no se importa
        const codigo = parsearCodigoLiberado(val);
        if (!codigo) {
          if (String(val).trim()) ilegibles++;
          continue;
        }
        const m = r - primera + 1;
        const clave = claveIdentidad(ZONA_LIBERADO, h.rack, m, col);
        if (vistos.has(clave)) {
          advertencias.push(
            `Coordenada duplicada LIBERADO R${h.rack}·m${m}·col${col} (celda ${addr}): se ignora la repetición.`,
          );
          continue;
        }
        vistos.add(clave);
        const notaTxt = (ws?.[addr]?.c ?? []).map((x) => x.t ?? '').join('\n');
        const nota = parsearNotaLiberado(notaTxt);
        celdas.push({
          zona: ZONA_LIBERADO,
          rack: h.rack,
          m,
          col,
          cell: addr,
          codigo,
          ancho: nota.ancho,
          alto: nota.alto,
          comentario: nota.comentario,
          raw: String(val).replace(/\s+/g, ' ').trim(),
        });
      }
    }
  }
  if (ilegibles > 0) {
    advertencias.push(`${ilegibles} celda(s) ilegibles en LIBERADO (sin código reconocible): se omiten.`);
  }

  return { celdas, zonas: celdas.length ? [ZONA_LIBERADO] : [], hoja, advertencias };
}
