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
import { debeInvertirPano, type OptimizerRow } from './tela';
import { generarPlanCorte, type PanoColmena } from './planCorte';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import type { PiezaColmenaSnap } from './colmenaCorte';
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
  altoCorteTela: number; // m — corte real (dúo: 2×alto+0,30; resto: alto+0,25)
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

/**
 * Filas de la tabla de corte que se imprimen: solo las que salen de colmena
 * (medidaColmena) o van invertidas. Las cortinas de rollo normal no se muestran
 * (el taller solo necesita esta tabla para esos dos casos especiales).
 */
export function filasCorteVisibles(cortinas: FilaCorteCortina[]): FilaCorteCortina[] {
  return cortinas.filter((f) => f.invertida || f.medidaColmena !== '');
}

export type MetrosOptimizador = { codInt: string; metros: number };

export type HojaCorte = {
  cortinas: FilaCorteCortina[];
  panos: FilaPanoResumen[];
  totalPanos: number;
  optimizador: MetrosOptimizador[];
};

const pieceId = (otId: string | number, ventanaId: string | number, panoIndex: number) =>
  `${otId}_${ventanaId}_p${panoIndex}`;

/** Metros (m) desde cm, redondeado a 3 decimales sin ceros sobrantes. */
const aMetros = (cm: number) => parseFloat((cm / 100).toFixed(3));

/** Redondea metros a 3 decimales sin ceros sobrantes. */
const redM = (m: number) => parseFloat(m.toFixed(3));

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
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  /** Snapshot pieza→sobrante (post-confirmación): muestra el origen colmena aun
   *  cuando el sobrante ya se consumió y el plan vivo no lo re-asigna. */
  piezasSnapshot?: Record<string, PiezaColmenaSnap>,
): HojaCorte {
  const plan = generarPlanCorte([ot], colmenaPanos, params);

  // Sobrante (colmena) que recibió cada pieza, y qué piezas van a rollo.
  const sobranteDe = new Map<string, PanoColmena>();
  for (const g of plan.sobrantes)
    for (const pz of g.placed) if (!pz.failed) sobranteDe.set(pz.id, g.sobrante);
  const enRollo = new Set<string>();
  for (const g of plan.rollo) for (const pz of g.placed) if (!pz.failed) enRollo.add(pz.id);

  // ¿La cortina se corta invertida (rotada)? Manda el flag de Fase 2; si no
  // está definido, se auto-marca cuando el ancho + borde supera el rollo.
  const esInvertida = (r: OptimizerRow) =>
    r.pano?.invertida ?? debeInvertirPano(r.anchoCm / 100, r.anchoRollo, params.bordeCm);

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
    const pid = pieceId(ot.id, r.ventanaId, r.panoIndex);
    const sob = sobranteDe.get(pid);
    // Si el plan vivo no la asigna (sobrante ya consumido), cae al snapshot.
    const snap = !sob ? piezasSnapshot?.[pid] : undefined;
    const inv = esInvertida(r);
    const noCabe = !inv && r.junto === 'RR'; // más ancha que el rollo y no rota
    const pano = juntoNum.get(claveJunto(r, idx)) ?? 0;
    const colmena = sob
      ? { cod: sob.cod, ancho: sob.ancho, alto: sob.alto, ubic: sob.ubicacion || '' }
      : snap ?? null;
    return {
      cadena: 0,
      cant: 1,
      codInt: r.codInt,
      tipo: tipoCorto(r.producto),
      anchoCorteTela: aMetros(r.anchoCm),
      corteAncho35: aMetros(r.anchoCm - params.descAnchoCorteCm),
      alto: aMetros(r.altoCm),
      altoCorteTela: redM(r.altoCorte), // dúo: 2×alto+0,30; resto: alto+0,25
      pano,
      cortarJunto: noCabe ? 'RR' : letra(pano),
      comentario: inv ? 'INVERTIDA' : noCabe ? 'NO CABE' : '',
      invertida: inv,
      medidaColmena: colmena ? `${colmena.cod} (${Math.round(colmena.ancho)}X${Math.round(colmena.alto)})` : '',
      ubicColmena: colmena ? colmena.ubic : '',
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
    // Corte real del paño (dúo = 2×alto+0,30) vs. reserva "alto máximo a utilizar"
    // (dúo = 2×(alto+0,25)). En roller simple ambas coinciden.
    const corteReal = Math.max(...grupo.map((g) => redM(g.altoCorte)));
    const altoMax = Math.max(...grupo.map((g) => redM(g.altoReal)));
    const anchoMax = Math.max(...grupo.map((g) => aMetros(g.anchoCm)));
    panos.push({
      pano,
      tipo: ref.producto,
      cod: ref.codInt,
      altoCortePano: inv ? anchoMax : corteReal, // invertida → ancho consumido
      altoMaxUtilizar: inv ? '' : altoMax,
      invertida: inv,
    });
    // Metros a reservar = alto máximo a utilizar (invertida: el corte consumido).
    metrosRollo.set(ref.codInt, (metrosRollo.get(ref.codInt) || 0) + (inv ? corteReal : altoMax));
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

/**
 * Dibuja texto dentro de una celda. `fit: 'wrap'` (cabeceras) parte en dos
 * líneas si no cabe; `fit: 'shrink'` (datos) mantiene UNA línea achicando la
 * fuente hasta que entre — así letras y números salen al tamaño máximo y
 * solo los textos largos se reducen.
 */
function celdaTexto(
  doc: jsPDF,
  s: string,
  x: number,
  w: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: RGB; align?: 'center' | 'left'; fit?: 'wrap' | 'shrink' } = {},
) {
  const { size = 6, bold = false, color = [20, 20, 25], align = 'center', fit = 'wrap' } = opts;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(color[0], color[1], color[2]);
  const maxW = w - 1.5;
  const tx = align === 'left' ? x + 1 : x + w / 2;
  const alignOpt = align === 'left' ? ('left' as const) : ('center' as const);
  if (fit === 'shrink') {
    let sz = size;
    doc.setFontSize(sz);
    let txt = s;
    while (sz > 4.5 && doc.getTextWidth(txt) > maxW) {
      sz -= 0.3;
      doc.setFontSize(sz);
    }
    while (txt.length > 1 && doc.getTextWidth(txt) > maxW) txt = txt.slice(0, -1);
    doc.text(txt, tx, y, { align: alignOpt });
    return;
  }
  doc.setFontSize(size);
  doc.text(s, tx, y, { align: alignOpt, maxWidth: maxW });
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
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  piezasSnapshot?: Record<string, PiezaColmenaSnap>,
): void {
  if (!rows || rows.length === 0) {
    throw new Error('No hay paños. Guarda el plan en Tela primero.');
  }
  const hoja = construirHojaCorte(rows, colmenaPanos, ot, params, piezasSnapshot);

  const doc = new jsPDF('l', 'mm', 'a4'); // 297 × 210
  const W = 297;
  const M = 6;
  const BOTTOM = 210 - M; // límite inferior útil de la página
  let y = M;
  let pagina = 0;

  // ── Encabezado (se repite en cada página) ──
  const encabezado = () => {
    pagina++;
    y = M;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 38);
    doc.text(`HOJA DE CORTE — OT ${meta.ot}`, M, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(meta.cliente || '', M, y + 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(150, 150, 158);
    doc.text(meta.empresa || `Página ${pagina}`, W - M, y + 5, { align: 'right' });
    if (meta.empresa) {
      doc.setFontSize(7);
      doc.text(`Página ${pagina}`, W - M, y + 9, { align: 'right' });
    }
    y += 13;
  };
  // Cotizaciones largas: cuando una tabla no cabe, sigue en una página nueva
  // repitiendo su cabecera (antes se dibujaba de corrido y se cortaba).
  const nuevaPagina = () => {
    doc.addPage();
    encabezado();
  };
  encabezado();

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
    { key: 'medidaColmena', label: 'MEDIDA COLMENA', w: 28, head: C_GREEN },
    { key: 'serial', label: 'COD. SERIAL', w: 16, head: C_GREEN },
    { key: 'ubicColmena', label: 'UBICACIÓN COLMENA', w: 22, head: C_GREEN },
    { key: 'serial', label: 'SOBRANTE / COLMENA', w: 16, head: C_BLUE },
    { key: 'serial', label: 'AUTORIZACIÓN OPTIM.', w: 21, head: C_BLUE },
  ];

  // La tabla ocupa TODO el ancho útil: los anchos base se escalan
  // proporcionalmente para darle aire a la letra más grande.
  const anchoUtil = W - 2 * M;
  const sumaW = cols.reduce((s, c) => s + c.w, 0);
  for (const c of cols) c.w = (c.w * anchoUtil) / sumaW;

  const x0 = M;
  const headH = 14;
  // Rótulo de cabecera: achica la fuente hasta que la palabra más larga
  // quepa en la columna (el wrap de jsPDF parte palabras a la mitad) y
  // centra verticalmente cuando queda en una sola línea.
  const rotuloCabecera = (label: string, cx: number, w: number, color: RGB) => {
    const maxW = w - 1.5;
    doc.setFont('helvetica', 'bold');
    let sz = 8.5;
    doc.setFontSize(sz);
    const palabraMax = () =>
      Math.max(...label.split(/\s+/).map((p) => doc.getTextWidth(p)));
    while (sz > 5 && palabraMax() > maxW) {
      sz -= 0.3;
      doc.setFontSize(sz);
    }
    const unaLinea = doc.getTextWidth(label) <= maxW;
    celdaTexto(doc, label, cx, w, y + (unaLinea ? 8.8 : 5), { size: sz, bold: true, color });
  };
  const cabeceraTabla = () => {
    let cx = x0;
    for (const c of cols) {
      rect(doc, cx, y, c.w, headH, c.head);
      const txtColor: RGB = c.head === C_BLUE ? [30, 30, 40] : C_WHITE;
      rotuloCabecera(c.label, cx, c.w, txtColor);
      cx += c.w;
    }
    y += headH;
  };
  // BLOQUE 1 solo con las cortinas que salen de colmena o van invertidas. Si
  // ninguna califica, se omite toda la tabla (el resto de bloques sigue igual).
  const visibles = filasCorteVisibles(hoja.cortinas);
  if (visibles.length > 0) {
    cabeceraTabla();

    // Filas de datos (color por paño)
    const rowH = 12.5;
    for (const fila of visibles) {
      if (y + rowH > BOTTOM) {
        nuevaPagina();
        cabeceraTabla();
      }
      const fill = PALETA[(fila.pano - 1 + PALETA.length) % PALETA.length] || PALETA[0];
      let cx = x0;
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
          celdaTexto(doc, val, cx, c.w, y + 8.5, { size: c.key === 'comentario' ? 10 : 13, bold, fit: 'shrink' });
        }
        cx += c.w;
      }
      y += rowH;
    }
  }

  // ── BLOQUE 2 (izq): TOTAL PAÑOS ── y ── BLOQUE 3 (der): errores ──
  // Comparten filas (una por paño): se dibujan en paralelo, con salto de
  // página conjunto repitiendo ambas cabeceras.
  // Layout fijo pedido por el taller: la primera página es SOLO la tabla de
  // corte; TOTAL PAÑOS/errores parten siempre en página nueva aunque sobre
  // espacio.
  const totalW = 16;
  const cols2 = [
    { label: 'PAÑOS', w: 12, k: 'pano' as const },
    { label: 'TIPO', w: 48, k: 'tipo' as const },
    { label: 'COD', w: 16, k: 'cod' as const },
    { label: 'ALTO CORTE PAÑO', w: 24, k: 'altoCortePano' as const },
    { label: 'ALTO MÁXIMO A UTILIZAR', w: 26, k: 'altoMaxUtilizar' as const },
    { label: 'COLMENA', w: 18, k: 'colmena' as const },
  ];
  const cols3 = [
    { label: 'PAÑO ADICIONAL', w: 26 },
    { label: 'MTS PAÑO ADIC.', w: 20 },
    { label: 'COD TELA', w: 18 },
    { label: 'MOTIVO', w: 38 },
    { label: 'RESPONSABLE DE ERROR', w: 28 },
  ];
  const t3x = 150;
  const rowH23 = 11.5;
  let y23Box = 0; // borde inferior del recuadro TOTAL PAÑOS (por página)
  const cabecera23 = () => {
    rect(doc, M, y, totalW, 12, C_DARK);
    celdaTexto(doc, 'TOTAL PAÑOS', M, totalW, y + 7.6, { size: 6.5, bold: true, color: C_WHITE, fit: 'shrink' });
    rect(doc, M, y + 12, totalW, 18);
    celdaTexto(doc, String(hoja.totalPanos), M, totalW, y + 24.4, { size: 26, bold: true, fit: 'shrink' });
    y23Box = y + 30;
    let tx = M + totalW + 1;
    for (const c of cols2) {
      rect(doc, tx, y, c.w, 12, C_DARK);
      celdaTexto(doc, c.label, tx, c.w, y + (c.label.length > 14 ? 4.4 : 7.6), {
        size: 8,
        bold: true,
        color: C_WHITE,
      });
      tx += c.w;
    }
    tx = t3x;
    for (const c of cols3) {
      rect(doc, tx, y, c.w, 12, C_DARK);
      celdaTexto(doc, c.label, tx, c.w, y + (c.label.length > 14 ? 4.4 : 7.6), {
        size: 8,
        bold: true,
        color: C_WHITE,
      });
      tx += c.w;
    }
    y += 12;
  };
  // TOTAL PAÑOS parte en página nueva salvo que la tabla de corte se haya
  // omitido (sin colmena ni invertidas): entonces empieza en la página 1.
  if (visibles.length > 0) nuevaPagina();
  cabecera23();
  for (const p of hoja.panos) {
    if (y + rowH23 > BOTTOM) {
      nuevaPagina();
      cabecera23();
    }
    const fill = PALETA[(p.pano - 1 + PALETA.length) % PALETA.length] || PALETA[0];
    // Fila bloque 2 (resumen del paño)
    let tx = M + totalW + 1;
    for (const c of cols2) {
      rect(doc, tx, y, c.w, rowH23, fill);
      let val = '';
      if (c.k === 'colmena') val = '';
      else if (c.k === 'altoCortePano') val = num(p.altoCortePano);
      else if (c.k === 'altoMaxUtilizar') val = p.altoMaxUtilizar === '' ? '' : num(p.altoMaxUtilizar);
      else val = String(p[c.k] ?? '');
      if (val) celdaTexto(doc, val, tx, c.w, y + 7.8, { size: 12, align: c.k === 'tipo' ? 'left' : 'center', fit: 'shrink' });
      tx += c.w;
    }
    // Fila bloque 3 (errores, para llenar a mano)
    tx = t3x;
    for (const c of cols3) {
      rect(doc, tx, y, c.w, rowH23);
      if (c.label === 'MOTIVO') {
        // Dos opciones con su círculo (radio) para marcar a mano, apiladas
        // para que el rótulo salga grande.
        doc.setDrawColor(90, 90, 100);
        doc.setLineWidth(0.25);
        doc.circle(tx + 3, y + 3.4, 1.3);
        celdaTexto(doc, 'FALLA TELA', tx + 5.2, 30, y + 4.6, { size: 8, align: 'left', fit: 'shrink' });
        doc.circle(tx + 3, y + 8.2, 1.3);
        celdaTexto(doc, 'ERROR CORTE', tx + 5.2, 30, y + 9.4, { size: 8, align: 'left', fit: 'shrink' });
      }
      tx += c.w;
    }
    y += rowH23;
  }
  // No pisar el recuadro grande TOTAL PAÑOS cuando hay pocas filas.
  y = Math.max(y, y23Box);

  // ── BLOQUE 4: OPTIMIZADOR + SELLO (se mueve entero a otra página si no cabe) ──
  const hOpt = 14 + Math.max(1, hoja.optimizador.length) * 11.5;
  y += 6;
  if (y + Math.max(hOpt, 40) > BOTTOM) nuevaPagina();
  const yAbajo = y;
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
    rect(doc, tx, y, c.w, 14, C_DARK);
    celdaTexto(doc, c.label, tx, c.w, y + (c.label.length > 16 ? 5 : 8.8), {
      size: 8,
      bold: true,
      color: C_WHITE,
    });
    tx += c.w;
  }
  let ry = y + 14;
  const rowH = 11.5;
  const filas = hoja.optimizador.length ? hoja.optimizador : [{ codInt: '', metros: 0 }];
  for (const f of filas) {
    tx = x;
    for (const c of cols) {
      rect(doc, tx, ry, c.w, rowH);
      if (c.label === 'COD_INT' && f.codInt) celdaTexto(doc, f.codInt, tx, c.w, ry + 7.8, { size: 12, bold: true, fit: 'shrink' });
      else if (c.label === 'OPTIMIZADOR' && f.codInt) celdaTexto(doc, num(f.metros), tx, c.w, ry + 7.8, { size: 12, fit: 'shrink' });
      tx += c.w;
    }
    ry += rowH;
  }
}
