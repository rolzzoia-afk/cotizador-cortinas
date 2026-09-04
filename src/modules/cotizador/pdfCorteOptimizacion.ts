// ─────────────────────────────────────────────────────────────────────
// PDF de la HOJA DE CORTE / OPTIMIZACIÓN DE TELAS (formulario "pañitos").
//
// Replica en PDF (apaisado, listo para imprimir) el formulario que usa el
// cortador, con todos sus bloques:
//   1. Tabla de corte — una fila por cortina (ancho/alto de corte, n.º de
//      paño, letra "cortar junto") + columnas de colmena (verde) que se
//      llenan cuando la pieza sale de un sobrante.
//   2. "TOTAL PAÑOS" — una fila por paño (cortinas que se cortan juntas);
//      los paños que salen de colmena se marcan en su columna COLMENA.
//   3. Bloque de errores (PAÑO ADICIONAL / MOTIVO: FALLA TELA · ERROR
//      CORTE) — en blanco para llenar a mano.
//   4. "OPTIMIZADOR" — metros de tela por COD_INT (auto) + PASO 1-4 a mano.
//   5. "SELLO PAÑOS".
//
// Acá vive SOLO el dibujo. Qué se corta lo decide `hojaCorte.ts`, que es
// puro y lo comparte con la pantalla del taller. Se re-exporta entero para
// no romper a quien ya importaba desde este archivo.
// ─────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import {
  construirHojaCorte,
  filasCorteVisibles,
  partirHojaCorte,
  textoUbicaciones,
  type FilaCorteCortina,
  type FilaPanoResumen,
  type HojaCorte,
  type OpcionesHojaCorte,
} from './hojaCorte';
import type { PanoColmena } from './planCorte';
import type { OptimizerRow } from './tela';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import type { PiezaColmenaSnap } from './colmenaCorte';
import type { OT } from '@/modules/ots/types';

export * from './hojaCorte';

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

/** Tema visual de una sección de la hoja de corte: clásica o VERTICAL. */
type TemaCorte = {
  titulo: string; // título del encabezado
  banner?: string; // franja de aviso bajo el encabezado (solo vertical)
  colorTitulo: RGB;
  tituloTotalPanos: string;
  tituloSello: string;
};

const C_GREEN_VERT: RGB = [56, 118, 29]; // verde de las verticales (bloque/etiqueta)


/**
 * Genera y descarga UN solo PDF de la hoja de corte para la OT dada. Si la OT
 * tiene cortinas verticales, el mismo PDF trae DOS secciones continuas: la hoja
 * clásica (roller/etc.) y a continuación la "HOJA DE CORTE DE PAÑO VERTICAL",
 * cada una con su encabezado en sus páginas. Solo-vertical o solo-roller → una
 * sección. El taller corta las verticales en mesa aparte, así que ningún paño
 * queda a caballo entre las dos secciones (ver empaque por `esVertical` en tela.ts).
 */
export function generarPdfHojaCorte(
  rows: OptimizerRow[],
  colmenaPanos: PanoColmena[],
  ot: OT,
  meta: MetaCorte,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  piezasSnapshot?: Record<string, PiezaColmenaSnap>,
  opts?: OpcionesHojaCorte,
): void {
  if (!rows || rows.length === 0) {
    throw new Error('No hay paños. Guarda el plan en Tela primero.');
  }
  const hoja = construirHojaCorte(rows, colmenaPanos, ot, params, piezasSnapshot, opts);
  const { principal, vertical } = partirHojaCorte(hoja);

  const doc = new jsPDF('l', 'mm', 'a4'); // 297 × 210
  const hayPrincipal = principal.cortinas.length > 0;
  const hayVertical = vertical.cortinas.length > 0;

  if (hayPrincipal) {
    renderHojaCorte(doc, principal, meta, {
      titulo: 'HOJA DE CORTE PAÑO',
      colorTitulo: [30, 30, 38],
      tituloTotalPanos: 'TOTAL PAÑOS',
      tituloSello: 'SELLO PAÑOS',
    });
  }
  if (hayVertical) {
    // La sección vertical parte en página propia, a continuación de la clásica.
    if (hayPrincipal) doc.addPage();
    renderHojaCorte(doc, vertical, meta, {
      titulo: 'HOJA DE CORTE DE PAÑO VERTICAL',
      banner: 'PAÑOS / COLMENA SOLO PARA CORTINAS VERTICALES',
      colorTitulo: C_GREEN_VERT,
      // El recuadro es de 16 mm: "TOTAL PAÑOS VERTICALES" se trunca. La franja
      // verde de arriba ya deja claro que son verticales, así que va corto.
      tituloTotalPanos: 'TOTAL PAÑOS',
      tituloSello: 'SELLO PAÑOS VERTICALES',
    });
  }
  // Un solo archivo; si la OT es SOLO vertical, el nombre lo dice.
  doc.save(hayPrincipal ? `Corte_OT${meta.ot}.pdf` : `Corte_Vertical_OT${meta.ot}.pdf`);
}

/** Render de UNA sección de la hoja de corte (clásica o vertical, según `tema`)
 *  sobre el doc compartido, empezando en la página actual. No guarda. */
function renderHojaCorte(doc: jsPDF, hoja: HojaCorte, meta: MetaCorte, tema: TemaCorte): void {
  const W = 297;
  const M = 6;
  const BOTTOM = 210 - M; // límite inferior útil de la página
  let y = M;

  // ── Encabezado (se repite en cada página; numeración continua del doc) ──
  const encabezado = () => {
    const pagina = doc.getNumberOfPages();
    y = M;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(tema.colorTitulo[0], tema.colorTitulo[1], tema.colorTitulo[2]);
    doc.text(`${tema.titulo} — OT ${meta.ot}`, M, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 25);
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
    // Franja de aviso (solo hoja vertical): repite en cada página que estos
    // paños/colmenas son EXCLUSIVAMENTE para cortinas verticales.
    if (tema.banner) {
      rect(doc, M, y, W - 2 * M, 6.5, C_GREEN_VERT);
      celdaTexto(doc, tema.banner, M, W - 2 * M, y + 4.6, { size: 9.5, bold: true, color: C_WHITE });
      y += 9;
    }
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
          // Las columnas de medida van formateadas; '' (vertical sin −3,5) se
          // deja en blanco en vez de pasarlo por `num`.
          if (c.key === 'anchoCorteTela' || c.key === 'corteAncho35' || c.key === 'alto' || c.key === 'altoCorteTela')
            val = raw === '' ? '' : num(raw as number);
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
  // cols2 debe caber en el tramo [M+totalW+1 .. t3x) = 23..162 = 139 mm, si no
  // la última columna (COLMENA) queda tapada por la tabla de errores (cols3).
  //
  // UBICACIÓN se hizo lugar sin achicar ninguna columna CON DATOS: la frontera
  // t3x se corrió 12 mm a la derecha (el bloque de errores es todo para llenar
  // a mano, escribir en 129 mm en vez de 141 da lo mismo) y COLMENA bajó de 22
  // a 14, que acá siempre sale en blanco —los paños de colmena no entran a
  // esta tabla, ver `construirHojaCorte`— y es solo para anotarla a mano.
  const cols2 = [
    { label: 'PAÑOS', w: 11, k: 'pano' as const },
    { label: 'TIPO', w: 34, k: 'tipo' as const },
    { label: 'COD', w: 15, k: 'cod' as const },
    { label: 'ALTO CORTE PAÑO', w: 22, k: 'altoCortePano' as const },
    { label: 'ALTO MÁXIMO A UTILIZAR', w: 23, k: 'altoMaxUtilizar' as const },
    { label: 'UBICACIÓN', w: 20, k: 'ubicaciones' as const },
    { label: 'COLMENA', w: 14, k: 'colmena' as const },
  ];
  // cols3 debe caber en [t3x .. W−M] = 162..291 = 129 mm.
  const cols3 = [
    { label: 'PAÑO ADICIONAL', w: 20 },
    { label: 'MTS PAÑO ADIC.', w: 16 },
    { label: 'COD. SERIAL', w: 32 },
    { label: 'MOTIVO', w: 36 },
    { label: 'RESPONSABLE DE ERROR', w: 24 },
  ];
  const t3x = 162;
  const rowH23 = 11.5;
  // Un paño puede servir a varias ubicaciones y todas tienen que salir: la
  // celda las parte en varias líneas y la FILA CRECE hasta que quepan (bloque
  // de errores incluido, si no las dos tablas se desalinean).
  //
  // La letra se achica primero hasta que la PALABRA más larga entre entera —el
  // mismo criterio que las cabeceras—: si no, jsPDF corta a mitad de palabra y
  // «DORMITORIO» sale como «DORMITORI / O».
  const SIZE_UBIC = 8.5;
  const wUbic = cols2.find((c) => c.k === 'ubicaciones')!.w;
  const altoLinea = (size: number) => size * 0.353 * 1.4;
  const ubicDe = (p: FilaPanoResumen): { lineas: string[]; size: number } => {
    const texto = textoUbicaciones(p.ubicaciones);
    if (!texto) return { lineas: [], size: SIZE_UBIC };
    const maxW = wUbic - 2;
    doc.setFont('helvetica', 'bold');
    let size = SIZE_UBIC;
    doc.setFontSize(size);
    const palabraMax = () => Math.max(...texto.split(/\s+/).map((w) => doc.getTextWidth(w)));
    while (size > 5 && palabraMax() > maxW) {
      size -= 0.3;
      doc.setFontSize(size);
    }
    return { lineas: doc.splitTextToSize(texto, maxW) as string[], size };
  };
  const altoFila = (lineas: number, size: number) =>
    Math.max(rowH23, 3.4 + lineas * altoLinea(size));
  let y23Box = 0; // borde inferior del recuadro TOTAL PAÑOS (por página)
  const cabecera23 = () => {
    rect(doc, M, y, totalW, 12, C_DARK);
    celdaTexto(doc, tema.tituloTotalPanos, M, totalW, y + 7.6, { size: 6.5, bold: true, color: C_WHITE, fit: 'shrink' });
    rect(doc, M, y + 12, totalW, 18);
    celdaTexto(doc, String(hoja.totalPanos), M, totalW, y + 24.4, { size: 26, bold: true, fit: 'shrink' });
    y23Box = y + 30;
    // Rótulo centrado en la celda de 12 mm: achica la fuente hasta que la
    // palabra más larga entre (evita cortarla, p. ej. "PAÑOS") y decide 1 o 2
    // líneas por el ANCHO real del texto, no por su cantidad de caracteres.
    const rotulo = (label: string, tx: number, w: number) => {
      const maxW = w - 1.5;
      doc.setFont('helvetica', 'bold');
      let sz = 8;
      doc.setFontSize(sz);
      const palabraMax = () => Math.max(...label.split(/\s+/).map((p) => doc.getTextWidth(p)));
      while (sz > 5 && palabraMax() > maxW) {
        sz -= 0.3;
        doc.setFontSize(sz);
      }
      const unaLinea = doc.getTextWidth(label) <= maxW;
      celdaTexto(doc, label, tx, w, y + (unaLinea ? 7.6 : 4.4), { size: sz, bold: true, color: C_WHITE });
    };
    let tx = M + totalW + 1;
    for (const c of cols2) {
      rect(doc, tx, y, c.w, 12, C_DARK);
      rotulo(c.label, tx, c.w);
      tx += c.w;
    }
    tx = t3x;
    for (const c of cols3) {
      rect(doc, tx, y, c.w, 12, C_DARK);
      rotulo(c.label, tx, c.w);
      tx += c.w;
    }
    y += 12;
  };
  // TOTAL PAÑOS parte en página nueva salvo que la tabla de corte se haya
  // omitido (sin colmena ni invertidas): entonces empieza en la página 1.
  if (visibles.length > 0) nuevaPagina();
  cabecera23();
  for (const p of hoja.panos) {
    const ubic = ubicDe(p);
    const hFila = altoFila(ubic.lineas.length, ubic.size);
    if (y + hFila > BOTTOM) {
      nuevaPagina();
      cabecera23();
    }
    // Centro vertical de la fila: con una fila alta, los números y los
    // círculos del motivo tienen que bajar con ella, no quedarse arriba.
    // (Con el alto de siempre, 11,5, da exactamente las posiciones previas.)
    const cy = y + hFila / 2;
    const fill = PALETA[(p.pano - 1 + PALETA.length) % PALETA.length] || PALETA[0];
    // Fila bloque 2 (resumen del paño)
    let tx = M + totalW + 1;
    for (const c of cols2) {
      rect(doc, tx, y, c.w, hFila, fill);
      if (c.k === 'ubicaciones') {
        // Las ubicaciones ya vienen partidas al ancho de la celda: se apilan
        // centradas en la fila.
        const hL = altoLinea(ubic.size);
        let uy = cy - (ubic.lineas.length * hL) / 2 + hL - hL * 0.26;
        for (const linea of ubic.lineas) {
          celdaTexto(doc, linea, tx, c.w, uy, { size: ubic.size, bold: true, fit: 'shrink' });
          uy += hL;
        }
        tx += c.w;
        continue;
      }
      let val = '';
      if (c.k === 'colmena') val = p.colmena;
      else if (c.k === 'altoCortePano') val = num(p.altoCortePano);
      else if (c.k === 'altoMaxUtilizar') val = p.altoMaxUtilizar === '' ? '' : num(p.altoMaxUtilizar);
      else val = String(p[c.k] ?? '');
      if (val)
        celdaTexto(doc, val, tx, c.w, cy + 2.05, {
          size: c.k === 'colmena' ? 9 : 12,
          align: c.k === 'tipo' ? 'left' : 'center',
          fit: 'shrink',
        });
      tx += c.w;
    }
    // Fila bloque 3 (errores, para llenar a mano)
    tx = t3x;
    for (const c of cols3) {
      rect(doc, tx, y, c.w, hFila);
      if (c.label === 'MOTIVO') {
        // Dos opciones con su círculo (radio) para marcar a mano, apiladas
        // para que el rótulo salga grande.
        doc.setDrawColor(90, 90, 100);
        doc.setLineWidth(0.25);
        doc.circle(tx + 3, cy - 2.35, 1.3);
        celdaTexto(doc, 'FALLA TELA', tx + 5.2, 30, cy - 1.15, { size: 8, align: 'left', fit: 'shrink' });
        doc.circle(tx + 3, cy + 2.45, 1.3);
        celdaTexto(doc, 'ERROR CORTE', tx + 5.2, 30, cy + 3.65, { size: 8, align: 'left', fit: 'shrink' });
      }
      tx += c.w;
    }
    y += hFila;
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
  doc.text(tema.tituloSello, 230, yAbajo + 23, { align: 'center' });
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
  const filas = hoja.optimizador.length ? hoja.optimizador : [{ codInt: '', metros: 0, esVertical: false }];
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
