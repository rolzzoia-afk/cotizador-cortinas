// ─────────────────────────────────────────────────────────────────────
// Comparar lo que dice un papel con lo que dice el catálogo o la orden.
//
// Normalizar (sin acentos, sin puntuación, colores sin género) y medir cuánto
// se parecen dos descripciones. Lo usan el emparejado con la orden
// (`recepcionFactura.ts`) y el del catálogo (`recepcionCatalogo.ts`).
// ─────────────────────────────────────────────────────────────────────

import type { LineaExtraida } from './recepcionFactura';

// ── Normalizar texto y códigos ───────────────────────────────────────

/** Mayúsculas, sin acentos, sin puntuación. Los decimales se conservan: «3.0 CM». */
export function normalizarTexto(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^A-Z0-9.%]+/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    // «60CM» y «60 CM» son lo mismo: la medida y su unidad, separadas.
    .replace(/(\d)(CM|MM|MTS|MTR|MT|M|KG|GR|UN|UND|MTRS)\b/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** El código como lo compara la base (`compras_cod_norm`): mayúsculas y sin espacios. */
export function normalizarCodigo(c: unknown): string {
  return String(c ?? '')
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Un código que no identifica nada: «N/A», «-», «S/C», o un número que Excel
 * convirtió en «1,10E+11». Espejo de `compras_codigo_neutro` de la base.
 */
export function codigoNeutro(c: unknown): boolean {
  const s = String(c ?? '').trim();
  if (!s) return true;
  if (/^(N\/?A|-+|S\/?C|0+|SIN C[OÓ]DIGO)$/i.test(s)) return true;
  return /^\d+([.,]\d+)?E\+\d+$/i.test(s);
}

const STOP = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'CON', 'PARA', 'POR', 'EN', 'X', 'UN', 'UNA']);

// Los colores tienen género: «cadena NEGRA» y «cadena NEGRO» son la misma.
const COLOR_CANONICO: Record<string, string> = {
  NEGRA: 'NEGRO', BLANCA: 'BLANCO', ROJA: 'ROJO', AMARILLA: 'AMARILLO', DORADA: 'DORADO',
  PLATEADA: 'PLATA', PLATEADO: 'PLATA', CAFE: 'CAFE', GRISES: 'GRIS',
};
const COLORES = new Set([
  'NEGRO', 'BLANCO', 'GRIS', 'BEIGE', 'CAFE', 'MARFIL', 'PLATA', 'AZUL', 'ROJO', 'VERDE', 'CREMA',
  'CRUDO', 'TABACO', 'IVORY', 'GRAFITO', 'CHOCOLATE', 'ARENA', 'PERLA', 'LINO', 'NATURAL', 'DORADO',
  'BRONCE', 'CHAMPAGNE', 'HUMO', 'OLIVA', 'VISON', 'AMARILLO', 'STONE', 'TITANIO',
]);

export function tokens(s: unknown): string[] {
  return normalizarTexto(s)
    .split(' ')
    .map((t) => COLOR_CANONICO[t] ?? t)
    .filter((t) => t && !STOP.has(t) && (t.length >= 2 || /\d/.test(t)));
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let comun = 0;
  for (const t of A) if (B.has(t)) comun++;
  return comun / (A.size + B.size - comun);
}

/** Las medidas del texto, en cm: «60CM», «3.0 MTS», «150 MTS». */
function medidas(s: string): Set<string> {
  const out = new Set<string>();
  const re = /(\d+(?:\.\d+)?)\s?(CM|MM|MTS|MTR|MT|M|METROS)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalizarTexto(s)))) {
    const n = Number(m[1]);
    const u = m[2];
    const cm = u === 'MM' ? n / 10 : u === 'CM' ? n : n * 100;
    out.add(String(Math.round(cm * 10) / 10));
  }
  return out;
}

function colores(ts: string[]): Set<string> {
  return new Set(ts.filter((t) => COLORES.has(t)));
}

const hayCruce = (a: Set<string>, b: Set<string>) => [...a].some((x) => b.has(x));

/**
 * Cuánto se parecen dos descripciones, de 0 a 1. Jaccard de palabras, con dos
 * correcciones que importan en este rubro: si los dos nombran un COLOR y no es
 * el mismo, o una MEDIDA y no es la misma, casi seguro son artículos
 * distintos aunque compartan todo lo demás («cadena negra 60 cm» contra
 * «cadena blanca 60 cm»).
 */
export function similitud(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  let s = jaccard(ta, tb);
  const ca = colores(ta);
  const cb = colores(tb);
  if (ca.size > 0 && cb.size > 0 && !hayCruce(ca, cb)) s *= 0.4;
  const ma = medidas(a);
  const mb = medidas(b);
  if (ma.size > 0 && mb.size > 0 && !hayCruce(ma, mb)) s *= 0.6;
  return Math.round(s * 1000) / 1000;
}

const PALABRAS_TELA = /\b(ROLLER|BLACK ?OUT|SCREEN|SUNSCREEN|DUO|DUAL|ZEBRA|TELA|TRASLUCID[AO]|DIM ?OUT|SOFT ?LIGHT|POLIESTER)\b/;
const PALABRAS_NO_TELA = /\b(CINTA|CADENA|TUBO|SOPORTE|MECANISMO|TAPA|PESO|CONTRAPESO|TORNILLO|TARUGO|RIEL|PERFIL|CENEFA|MOTOR|CONTROL|ZOCALO|TOPE|CARRO|UNION|KIT|SEPARADOR|PLATINA|GUIA|ADHESIVO|VELCRO|ACCESORIO)\b/;

/** ¿La línea del papel habla de una tela? Sirve para buscar primero entre las telas. */
export function pareceTela(descripcion: unknown): boolean {
  const t = normalizarTexto(descripcion);
  return PALABRAS_TELA.test(t) && !PALABRAS_NO_TELA.test(t);
}

const CARGOS = /\b(FLETE|DESPACHO|ENVIO|TRANSPORTE|EMBALAJE|SERVICIO|RECARGO|SEGURO)\b/;

/** FLETE, DESPACHO, EMBALAJE…: se cobran pero no entran a la bodega. */
export function esCargo(l: Pick<LineaExtraida, 'descripcion' | 'es_cargo'>): boolean {
  return l.es_cargo === true || CARGOS.test(normalizarTexto(l.descripcion));
}
