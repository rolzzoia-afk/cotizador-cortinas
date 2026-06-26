// ─────────────────────────────────────────────────────────────────────
// PDF de la HOJA DE CORTE / OPTIMIZACIÓN DE TELAS (formulario "pañitos").
//
// Replica en PDF (apaisado, listo para imprimir) el formulario que usa el
// cortador, con todos sus bloques:
//   1. Tabla de corte — una fila por cortina (ancho/alto de corte, n.º de
//      paño, letra "cortar junto") + columnas de colmena (verde) que se
//      llenan cuando la pieza sale de un sobrante.
//   2. "TOTAL PAÑOS" — una fila por paño de rollo (cortinas que se cortan
//      juntas).
//   3. Bloque de errores (PAÑO ADICIONAL / MOTIVO: FALLA TELA · ERROR
//      CORTE) — en blanco para llenar a mano.
//   4. "OPTIMIZADOR" — metros de tela por COD_INT (auto) + PASO 1-4 a mano.
//   5. "SELLO PAÑOS".
//
// Datos: optimizador de paños (tela.ts) + Plan de Corte (planCorte.ts) para
// saber qué pieza sale de qué sobrante de colmena. Lógica pura salvo
// `generarPdfHojaCorte`, que toca el DOM (jsPDF).
// ─────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import type { OptimizerRow } from './tela';
import { generarPlanCorte, type PanoColmena } from './planCorte';
import type { OT } from '@/modules/ots/types';

// ── Modelo de datos (puro, testeable) ────────────────────────────────
export type FilaCorteCortina = {
  cadena: number;
  cant: number;
  codInt: string;
  tipo: string; // corto: DELUX / PREMIUM
  anchoCorteTela: number; // m
  corteAncho35: number; // m (ancho − 3,5 cm)
  alto: number; // m
  altoCorteTela: number; // m (alto + 25 cm)
  pano: number; // n.º de paño (= letra "cortar junto")
  cortarJunto: string; // letra A, B, C… (o "RR" si no cabe ni invertida)
  comentario: string; // "INVERTIDA" / "NO CABE" / ""
  invertida: boolean;
  medidaColmena: string; // "SC 64 (178X200)" si sale de sobrante
  ubicColmena: string; // ubicación del sobrante (ej. "B-42")
};

export type FilaPanoResumen = {
  pano: number;
  tipo: string; // producto completo
  cod: string;
  altoCortePano: number; // m (invertida → ancho de la cortina)
  altoMaxUtilizar: number | ''; // m (vacío en invertidas)
  invertida: boolean;
};

export type MetrosOptimizador = { codInt: string; metros: number };

export type HojaCorte = {
  cortinas: FilaCorteCortina[];
  panos: FilaPanoResumen[];
  totalPanos: number;
  optimizador: MetrosOptimizador[];
};

const pieceId = (otId: string | number, ventanaId: string | number, panoIndex: number) =>
  `${otId}_${ventanaId}_p${panoIndex}`;

/** Limpieza de bordes al ancho (cm) — igual que planCorte (Regla 5). */
const BORDE_CM = 4;

/** Metros (m) desde cm, redondeado a 3 decimales sin ceros sobrantes. */
const aMetros = (cm: number) => parseFloat((cm / 100).toFixed(3));

/** Tipo corto = última palabra del producto ("ROLLER SCREEN PREMIUM" → "PREMIUM"). */
const tipoCorto = (producto: string) => {
  const partes = String(producto || '').trim().toUpperCase().split(/\s+/);
  return partes[partes.length - 1] || '';
};

/**
 * Construye la hoja de corte de UNA OT cruzando el optimizador de paños con
 * el Plan de Corte (para el origen rollo/sobrante de cada pieza).
 */
export function construirHojaCorte(
  rows: OptimizerRow[],
  colmenaPanos: PanoColmena[],
  ot: OT,
): HojaCorte {
  const plan = generarPlanCorte([ot], colmenaPanos);

  // Sobrante (colmena) que recibió cada pieza, y qué piezas van a rollo.
  const sobranteDe = new Map<string, PanoColmena>();
  for (const g of plan.sobrantes)
    for (const pz of g.placed) if (!pz.failed) sobranteDe.set(pz.id, g.sobrante);
  const enRollo = new Set<string>();
  for (const g of plan.rollo) for (const pz of g.placed) if (!pz.failed) enRollo.add(pz.id);

  // ¿La cortina se corta invertida (rotada)? Manda el flag de Fase 2; si no
  // está definido, se auto-marca cuando el ancho + borde supera el rollo.
  const esInvertida = (r: OptimizerRow) =>
    r.pano?.invertida ?? r.anchoCm + BORDE_CM > r.anchoRollo * 100;

  // Clave de paño por fila:
  //  · invertida → cada una su propio paño (rotada, ocupa el rollo a lo largo)
  //  · "RR" sin invertir (más ancha que el rollo y no rota) → su propio paño
  //  · resto → letra "cortar junto" del optimizador (cortinas lado a lado)
  const claveJunto = (r: OptimizerRow, idx: number) => {
    if (esInvertida(r)) return `INV#${idx}`;
    if (r.junto === 'RR') return `RR#${idx}`;
    return r.junto || `·${idx}`;
  };

  // N.º de paño por clave (orden de aparición): primera clave → 1, etc.
  const juntoNum = new Map<string, number>();
  rows.forEach((r, idx) => {
    const k = claveJunto(r, idx);
    if (!juntoNum.has(k)) juntoNum.set(k, juntoNum.size + 1);
  });
  const letra = (pano: number) =>
    pano >= 1 && pano <= 26 ? String.fromCharCode(64 + pano) : String(pano);

  // ── Bloque 1: una fila por cortina ──
  const cortinas: FilaCorteCortina[] = rows.map((r, idx) => {
    const sob = sobranteDe.get(pieceId(ot.id, r.ventanaId, r.panoIndex));
    const inv = esInvertida(r);
    const noCabe = !inv && r.junto === 'RR'; // más ancha que el rollo y no rota
    const pano = juntoNum.get(claveJunto(r, idx)) ?? 0;
    return {
      cadena: 0,
      cant: 1,
      codInt: r.codInt,
      tipo: tipoCorto(r.producto),
      anchoCorteTela: aMetros(r.anchoCm),
      corteAncho35: aMetros(r.anchoCm - 3.5),
      alto: aMetros(r.altoCm),
      altoCorteTela: aMetros(r.altoCm + 25),
      pano,
      cortarJunto: noCabe ? 'RR' : letra(pano),
      comentario: inv ? 'INVERTIDA' : noCabe ? 'NO CABE' : '',
      invertida: inv,
      medidaColmena: sob ? `${sob.cod} (${Math.round(sob.ancho)}X${Math.round(sob.alto)})` : '',
      ubicColmena: sob ? sob.ubicacion : '',
    };
  });

  // ── Bloque 2: una fila por paño de ROLLO (grupo "cortar junto" con ≥1
  //    pieza que se corta del rollo; los grupos 100% colmena no son paño). ──
  const grupos = new Map<string, { rows: OptimizerRow[]; pano: number }>();
  rows.forEach((r, idx) => {
    const k = claveJunto(r, idx);
    if (!grupos.has(k)) grupos.set(k, { rows: [], pano: juntoNum.get(k) ?? 0 });
    grupos.get(k)!.rows.push(r);
  });
  const panos: FilaPanoResumen[] = [];
  // Metros de rollo por COD_INT: alto de corte (≈2,05) por cada paño de rollo,
  // igual que el manual (las invertidas también cuentan como un paño).
  const metrosRollo = new Map<string, number>();
  for (const { rows: grupo, pano } of grupos.values()) {
    const esRollo = grupo.some((r) => enRollo.has(pieceId(ot.id, r.ventanaId, r.panoIndex)));
    if (!esRollo) continue;
    const ref = grupo[0];
    const inv = esInvertida(ref);
    const altoCorte = Math.max(...grupo.map((g) => aMetros(g.altoCm + 25)));
    const anchoMax = Math.max(...grupo.map((g) => aMetros(g.anchoCm)));
    panos.push({
      pano,
      tipo: ref.producto,
      cod: ref.codInt,
      altoCortePano: inv ? anchoMax : altoCorte, // invertida → ancho consumido
      altoMaxUtilizar: inv ? '' : altoCorte,
      invertida: inv,
    });
    metrosRollo.set(ref.codInt, (metrosRollo.get(ref.codInt) || 0) + altoCorte);
  }
  panos.sort((a, b) => a.pano - b.pano);

  // ── Bloque 4: metros por COD_INT (las piezas de colmena no consumen rollo). ──
  const optimizador: MetrosOptimizador[] = [...metrosRollo.entries()].map(([codInt, metros]) => ({
    codInt,
    metros: parseFloat(metros.toFixed(3)),
  }));

  return { cortinas, panos, totalPanos: panos.length, optimizador };
}

// ── Render PDF ───────────────────────────────────────────────────────
export type MetaCorte = { ot: string; cliente: string; empresa?: string };

const num = (v: number) => String(parseFloat(v.toFixed(3))).replace('.', ',');

type RGB = [number, number, number];
const C_DARK: RGB = [60, 60, 66];
const C_GREEN: RGB = [112, 173, 71];
const C_BLUE: RGB = [142, 169, 219];
const C_WHITE: RGB = [255, 255, 255];
const C_LINE: RGB = [140, 140, 148];
// Paleta de fondo por paño (para agrupar visualmente "cortar junto").
const PALETA: RGB[] = [
  [217, 217, 217],
  [252, 228, 214],
  [226, 239, 218],
  [221, 235, 247],
  [255, 242, 204],
  [237, 237, 237],
];

/** Dibuja texto centrado dentro de una celda, recortado al ancho. */
function celdaTexto(
  doc: jsPDF,
  s: string,
  x: number,
  w: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: RGB; align?: 'center' | 'left' } = {},
) {
  const { size = 6, bold = false, color = [20, 20, 25], align = 'center' } = opts;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  const tx = align === 'left' ? x + 1 : x + w / 2;
  doc.text(s, tx, y, { align: align === 'left' ? 'left' : 'center', maxWidth: w - 1.5 });
}

function rect(doc: jsPDF, x: number, y: number, w: number, h: number, fill?: RGB) {
  if (fill) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(x, y, w, h, 'F');
  }
  doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
}

/**
 * Genera y descarga (abre el diálogo de impresión) el PDF de la hoja de
 * corte para la OT dada.
 */
export function generarPdfHojaCorte(
  rows: OptimizerRow[],
  colmenaPanos: PanoColmena[],
  ot: OT,
  meta: MetaCorte,
): void {
  if (!rows || rows.length === 0) {
    throw new Error('No hay paños. Guarda el plan en Tela primero.');
  }
  const hoja = construirHojaCorte(rows, colmenaPanos, ot);

  const doc = new jsPDF('l', 'mm', 'a4'); // 297 × 210
  const W = 297;
  const M = 6;
  let y = M;

  // ── Encabezado ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 38);
  doc.text(`HOJA DE CORTE — OT ${meta.ot}`, M, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(meta.cliente || '', M, y + 9);
  // Marca de agua "Página 1"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(150, 150, 158);
  doc.text(meta.empresa || 'Página 1', W - M, y + 5, { align: 'right' });
  y += 13;

  // ── BLOQUE 1: tabla de corte ──
  const cols: { key: keyof FilaCorteCortina | 'serial'; label: string; w: number; head: RGB }[] = [
    { key: 'cadena', label: 'CADENA', w: 11, head: C_DARK },
    { key: 'cant', label: 'CANT', w: 9, head: C_DARK },
    { key: 'codInt', label: 'COD INT', w: 14, head: C_DARK },
    { key: 'tipo', label: 'TIPO', w: 15, head: C_DARK },
    { key: 'anchoCorteTela', label: 'ANCHO CORTE TELA', w: 21, head: C_DARK },
    { key: 'corteAncho35', label: 'CORTE ANCHO -3,5', w: 21, head: C_DARK },
    { key: 'alto', label: 'ALTO', w: 11, head: C_DARK },
    { key: 'altoCorteTela', label: 'ALTO CORTE TELA', w: 18, head: C_DARK },
    { key: 'pano', label: 'PAÑO', w: 10, head: C_DARK },
    { key: 'cortarJunto', label: 'CORTAR JUNTO', w: 14, head: C_DARK },
    { key: 'comentario', label: 'COMENTARIO', w: 18, head: C_DARK },
    { key: 'medidaColmena', label: 'MEDIDA COLMENA', w: 26, head: C_GREEN },
    { key: 'serial', label: 'COD. SERIAL', w: 16, head: C_GREEN },
    { key: 'ubicColmena', label: 'UBICACIÓN COLMENA', w: 22, head: C_GREEN },
    { key: 'serial', label: 'SOBRANTE / COLMENA', w: 16, head: C_BLUE },
    { key: 'serial', label: 'AUTORIZACIÓN OPTIM.', w: 21, head: C_BLUE },
  ];

  const x0 = M;
  const headH = 9;
  // Cabecera
  let cx = x0;
  for (const c of cols) {
    rect(doc, cx, y, c.w, headH, c.head);
    const txtColor: RGB = c.head === C_BLUE ? [30, 30, 40] : C_WHITE;
    celdaTexto(doc, c.label, cx, c.w, y + (c.label.length > 14 ? 3.4 : 5.4), {
      size: 4.6,
      bold: true,
      color: txtColor,
    });
    cx += c.w;
  }
  y += headH;

  // Filas de datos (color por paño)
  const rowH = 6;
  for (const fila of hoja.cortinas) {
    const fill = PALETA[(fila.pano - 1 + PALETA.length) % PALETA.length] || PALETA[0];
    cx = x0;
    for (const c of cols) {
      rect(doc, cx, y, c.w, rowH, fill);
      let val = '';
      if (c.key === 'serial') val = '';
      else {
        const raw = fila[c.key as keyof FilaCorteCortina];
        if (c.key === 'anchoCorteTela' || c.key === 'corteAncho35' || c.key === 'alto' || c.key === 'altoCorteTela')
          val = num(raw as number);
        else val = raw === 0 ? '0' : String(raw ?? '');
      }
      if (val) {
        const bold = c.key === 'cortarJunto' || c.key === 'pano' || c.key === 'comentario';
        celdaTexto(doc, val, cx, c.w, y + 4, { size: c.key === 'comentario' ? 4.8 : 5.4, bold });
      }
      cx += c.w;
    }
    y += rowH;
  }

  y += 5;
  const yBloques = y;

  // ── BLOQUE 2 (izq): TOTAL PAÑOS ── y ── BLOQUE 3 (der): errores ──
  // Ambas tablas dibujan solo las filas usadas (una por paño), no 10 fijas.
  const t2x = M;
  const yTot = drawTotalPanos(doc, t2x, yBloques, hoja);
  const t3x = 150;
  const yErr = drawErrores(doc, t3x, yBloques, hoja.panos.length);

  // ── BLOQUE 4: OPTIMIZADOR + SELLO, ubicados debajo de lo anterior ──
  // (antes en y=150 fijo, lo que solapaba cuando había muchas filas).
  const yAbajo = Math.max(yTot, yErr) + 6;
  drawOptimizador(doc, M, yAbajo, hoja);

  // ── SELLO PAÑOS (abajo der) ──
  doc.setDrawColor(120, 120, 130);
  doc.setLineWidth(0.5);
  doc.roundedRect(180, yAbajo, 100, 40, 4, 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(150, 150, 158);
  doc.text('SELLO PAÑOS', 230, yAbajo + 23, { align: 'center' });

  const nombre = `Corte_OT${meta.ot}.pdf`;
  doc.save(nombre);
}

function drawTotalPanos(doc: jsPDF, x: number, y: number, hoja: HojaCorte) {
  // Recuadro grande TOTAL PAÑOS + tabla
  const totalW = 16;
  rect(doc, x, y, totalW, 8, C_DARK);
  celdaTexto(doc, 'TOTAL PAÑOS', x, totalW, y + 5, { size: 4.4, bold: true, color: C_WHITE });
  rect(doc, x, y + 8, totalW, 16);
  celdaTexto(doc, String(hoja.totalPanos), x, totalW, y + 18, { size: 16, bold: true });

  const cols = [
    { label: 'PAÑOS', w: 12, k: 'pano' as const },
    { label: 'TIPO', w: 48, k: 'tipo' as const },
    { label: 'COD', w: 16, k: 'cod' as const },
    { label: 'ALTO CORTE PAÑO', w: 24, k: 'altoCortePano' as const },
    { label: 'ALTO MÁXIMO A UTILIZAR', w: 26, k: 'altoMaxUtilizar' as const },
    { label: 'COLMENA', w: 18, k: 'colmena' as const },
  ];
  let tx = x + totalW + 1;
  const headY = y;
  for (const c of cols) {
    rect(doc, tx, headY, c.w, 8, C_DARK);
    celdaTexto(doc, c.label, tx, c.w, headY + (c.label.length > 14 ? 3.4 : 5), {
      size: 4.4,
      bold: true,
      color: C_WHITE,
    });
    tx += c.w;
  }
  let ry = headY + 8;
  const rowH = 5.5;
  for (const p of hoja.panos) {
    tx = x + totalW + 1;
    const fill = PALETA[(p.pano - 1 + PALETA.length) % PALETA.length] || PALETA[0];
    for (const c of cols) {
      rect(doc, tx, ry, c.w, rowH, fill);
      let val = '';
      if (c.k === 'colmena') val = '';
      else if (c.k === 'altoCortePano') val = num(p.altoCortePano);
      else if (c.k === 'altoMaxUtilizar') val = p.altoMaxUtilizar === '' ? '' : num(p.altoMaxUtilizar);
      else val = String(p[c.k] ?? '');
      if (val) celdaTexto(doc, val, tx, c.w, ry + 3.8, { size: 5, align: c.k === 'tipo' ? 'left' : 'center' });
      tx += c.w;
    }
    ry += rowH;
  }
  return ry; // y final (para ubicar lo de abajo dinámicamente)
}

function drawErrores(doc: jsPDF, x: number, y: number, filas: number) {
  const cols = [
    { label: 'PAÑO ADICIONAL', w: 26 },
    { label: 'MTS PAÑO ADIC.', w: 20 },
    { label: 'COD TELA', w: 18 },
    { label: 'MOTIVO', w: 38 },
    { label: 'RESPONSABLE DE ERROR', w: 28 },
  ];
  let tx = x;
  for (const c of cols) {
    rect(doc, tx, y, c.w, 8, C_DARK);
    celdaTexto(doc, c.label, tx, c.w, y + (c.label.length > 14 ? 3.4 : 5), {
      size: 4.4,
      bold: true,
      color: C_WHITE,
    });
    tx += c.w;
  }
  let ry = y + 8;
  const rowH = 5.5;
  for (let i = 0; i < filas; i++) {
    tx = x;
    for (const c of cols) {
      rect(doc, tx, ry, c.w, rowH);
      if (c.label === 'MOTIVO') {
        // Dos opciones con su círculo (radio) para marcar a mano.
        doc.setDrawColor(90, 90, 100);
        doc.setLineWidth(0.2);
        doc.circle(tx + 2.5, ry + rowH / 2, 1);
        celdaTexto(doc, 'FALLA TELA', tx + 4, 17, ry + 3.6, { size: 4.2, align: 'left' });
        doc.circle(tx + 21, ry + rowH / 2, 1);
        celdaTexto(doc, 'ERROR CORTE', tx + 22.5, 16, ry + 3.6, { size: 4.2, align: 'left' });
      }
      tx += c.w;
    }
    ry += rowH;
  }
  return ry; // y final
}

function drawOptimizador(doc: jsPDF, x: number, y: number, hoja: HojaCorte) {
  const cols = [
    { label: 'COD_INT', w: 18 },
    { label: 'OPTIMIZADOR', w: 22 },
    { label: 'PASO 1: CANT P. INICIAL', w: 24 },
    { label: 'PASO 2: CANT P. OPTIMIZADA', w: 24 },
    { label: 'PASO 3: FINAL REVISIÓN P. REAL', w: 26 },
    { label: 'PASO 4: VERIFICADO', w: 22 },
  ];
  let tx = x;
  for (const c of cols) {
    rect(doc, tx, y, c.w, 9, C_DARK);
    celdaTexto(doc, c.label, tx, c.w, y + (c.label.length > 16 ? 3.2 : 5.4), {
      size: 4.2,
      bold: true,
      color: C_WHITE,
    });
    tx += c.w;
  }
  let ry = y + 9;
  const rowH = 6;
  const filas = hoja.optimizador.length ? hoja.optimizador : [{ codInt: '', metros: 0 }];
  for (const f of filas) {
    tx = x;
    for (const c of cols) {
      rect(doc, tx, ry, c.w, rowH);
      if (c.label === 'COD_INT' && f.codInt) celdaTexto(doc, f.codInt, tx, c.w, ry + 4, { size: 5.4, bold: true });
      else if (c.label === 'OPTIMIZADOR' && f.codInt) celdaTexto(doc, num(f.metros), tx, c.w, ry + 4, { size: 5.4 });
      tx += c.w;
    }
    ry += rowH;
  }
}
