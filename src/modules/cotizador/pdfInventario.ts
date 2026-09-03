// ─────────────────────────────────────────────────────────────────────
// PDF de la HOJA DE INVENTARIO de la OT (entrega de material de bodega).
//
// Acá vive SOLO el dibujo. Qué insumo lleva cada cortina, en qué cantidad y
// a qué grupo pertenece lo decide `inventarioOT.ts`, que es puro y lo
// comparte con la pantalla de bodega del taller. Se re-exporta entero para
// no romper a quien ya importaba desde acá.
// ─────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import {
  construirInventario,
  type InsumoConsolidado,
  type RGB,
} from './inventarioOT';
import type { Ventana, CatalogoProductos } from '@/modules/cotizador/types';
import type { AdicionalFase0Persistido } from '@/modules/ots/types';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import type { CadenaInsumo } from './cadenas';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import { REGLAS_SELECCION_DEFAULT, type ReglasSeleccion } from '@/modules/descuentos/reglasSeleccion';

export * from './inventarioOT';

// ── Render PDF ───────────────────────────────────────────────────────
export type MetaInventario = { ot: string; cliente?: string; empresa?: string };

const C_DARK: RGB = [55, 55, 62];
const C_WHITE: RGB = [255, 255, 255];
const C_LINE: RGB = [150, 150, 158];
const C_GREEN: RGB = [112, 173, 71];
const C_BLUE: RGB = [31, 119, 180];
const C_TEXT: RGB = [25, 25, 30];

type Col = { label: string; w: number; align?: 'l' | 'c' };

/**
 * Texto dentro de una celda, centrado verticalmente. Achica la fuente hasta
 * 8 pt para que quepa en UNA línea; si aún no entra, parte en DOS líneas en
 * vez de seguir encogiendo — así los textos largos (KIT SIMPLE…, UBIC.)
 * quedan del mismo porte que el resto de la tabla. Con `wrap: false`
 * (cabeceras) mantiene el comportamiento de una línea con mínimo 4 pt.
 */
function celda(
  doc: jsPDF,
  s: string,
  x: number,
  w: number,
  yTop: number,
  h: number,
  opts: { size?: number; bold?: boolean; color?: RGB; align?: 'l' | 'c'; wrap?: boolean } = {},
) {
  const { bold = false, color = C_TEXT, align = 'l', wrap = true } = opts;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(color[0], color[1], color[2]);
  const maxW = w - 1.4;
  const txt = String(s ?? '');

  const dibujar = (t: string, yBase: number) => {
    if (align === 'c') doc.text(t, x + w / 2, yBase, { align: 'center' });
    else doc.text(t, x + 0.8, yBase, { align: 'left' });
  };

  let size = opts.size ?? 11;
  doc.setFontSize(size);
  // 7 pt como piso de UNA línea (antes 8): las columnas ya están dimensionadas
  // para que todo entre a 8 pt, así que este medio punto extra es solo la red
  // para una descripción excepcionalmente larga — cortar en dos líneas ahora
  // desbordaría la fila, que es más baja.
  const minUnaLinea = wrap ? 7 : 4;
  while (size > minUnaLinea && doc.getTextWidth(txt) > maxW) {
    size -= 0.3;
    doc.setFontSize(size);
  }
  if (!wrap || doc.getTextWidth(txt) <= maxW) {
    let t = txt;
    while (t.length > 1 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
    dibujar(t, yTop + h / 2 + size * 0.17);
    return;
  }

  // Dos líneas (achicando un poco más solo si ni así entra).
  let lineas = doc.splitTextToSize(txt, maxW) as string[];
  while (size > 5.5 && lineas.length > 2) {
    size -= 0.3;
    doc.setFontSize(size);
    lineas = doc.splitTextToSize(txt, maxW) as string[];
  }
  lineas = lineas.slice(0, 2);
  const lh = size * 0.42;
  const y1 = yTop + h / 2 + size * 0.17 - lh / 2;
  dibujar(lineas[0], y1);
  if (lineas[1]) {
    let t2 = lineas[1];
    while (t2.length > 1 && doc.getTextWidth(t2) > maxW) t2 = t2.slice(0, -1);
    dibujar(t2, y1 + lh);
  }
}

/** Salto de página de una tabla: límite inferior + qué dibujar en la nueva página. */
type SaltoTabla = { bottom: number; onBreak: () => number };

/**
 * Dibuja una tabla (header oscuro + filas). Devuelve la y final. Si recibe
 * `salto`, corta en el límite inferior y sigue en página nueva repitiendo
 * la cabecera.
 */
function tabla(
  doc: jsPDF,
  x: number,
  yStart: number,
  cols: Col[],
  rows: string[][],
  opts: { headFill?: RGB; rowH?: number; headH?: number; greenCol?: number; salto?: SaltoTabla } = {},
): number {
  const headFill = opts.headFill ?? C_DARK;
  const rowH = opts.rowH ?? 6;
  // Cabecera compacta: el rótulo va en 8,5 pt (≈2,1 mm de altura de mayúscula),
  // así que 7 mm dejan ~2,4 mm de aire arriba y abajo.
  const headH = opts.headH ?? 7;
  const totalW = cols.reduce((a, c) => a + c.w, 0);

  const cabecera = (yy: number): number => {
    doc.setFillColor(headFill[0], headFill[1], headFill[2]);
    doc.rect(x, yy, totalW, headH, 'F');
    let cx = x;
    for (const c of cols) {
      doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
      doc.setLineWidth(0.2);
      doc.rect(cx, yy, c.w, headH);
      celda(doc, c.label, cx, c.w, yy, headH, {
        bold: true,
        color: C_WHITE,
        align: 'c',
        size: 8.5,
        wrap: false,
      });
      cx += c.w;
    }
    return yy + headH;
  };

  let y = cabecera(yStart);

  // Filas
  for (let i = 0; i < rows.length; i++) {
    if (opts.salto && y + rowH > opts.salto.bottom) {
      y = cabecera(opts.salto.onBreak());
    }
    const row = rows[i];
    const bg: RGB = i % 2 === 0 ? [245, 246, 248] : C_WHITE;
    let cx = x;
    cols.forEach((c, j) => {
      const fill = opts.greenCol === j ? C_GREEN : bg;
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.rect(cx, y, c.w, rowH, 'F');
      doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
      doc.setLineWidth(0.2);
      doc.rect(cx, y, c.w, rowH);
      const val = row[j] ?? '';
      celda(doc, val, cx, c.w, y, rowH, {
        align: c.align ?? 'l',
        bold: opts.greenCol === j,
        color: opts.greenCol === j ? C_WHITE : C_TEXT,
      });
      cx += c.w;
    });
    y += rowH;
  }
  return y;
}

/** Genera y descarga el PDF de la hoja INVENTARIO de una OT. */
export function generarPdfInventario(
  ventanas: Ventana[],
  catalogo: CatalogoProductos,
  meta: MetaInventario,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  cadenas: CadenaInsumo[] = [],
  usarTuboE78 = false,
  adicionalesFase0?: AdicionalFase0Persistido[],
  formulas?: FormulasFamilias,
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
): void {
  const data = construirInventario(
    ventanas,
    catalogo,
    params,
    cadenas,
    usarTuboE78,
    adicionalesFase0,
    formulas,
    reglas,
  );
  if (data.filas.length === 0) {
    throw new Error('No hay cortinas en la OT.');
  }

  const doc = new jsPDF('l', 'mm', 'a4'); // 297 × 210
  const W = doc.internal.pageSize.getWidth();
  const mg = 8;
  const usable = W - mg * 2;
  // Ancho de las TABLAS (los títulos de bloque usan el mismo para no desalinearse).
  // Dimensionado para que NINGUNA celda parta en dos líneas: la descripción más
  // larga del catálogo ([PCA04] PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM)
  // mide 92,8 mm a 8 pt, así que DESCRIPCIÓN necesita ≥ 95 mm. Con una sola línea
  // por fila el alto baja a 6 mm, que es lo que realmente comprime la hoja.
  const tablaW = Math.min(usable, 261);

  // ── Encabezado (se repite en cada página) ──────────────────────────
  let pagina = 0;
  const encabezado = (): number => {
    pagina++;
    doc.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('INVENTARIO', mg, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 118);
    doc.text('[ ENTREGA Y RECEPCIÓN DE MATERIAL ]', mg, 18);

    doc.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`OT  ${meta.ot}`, W - mg, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Cliente: ${(meta.cliente || '—').toUpperCase()}`, W - mg, 18, { align: 'right' });
    doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
    doc.setLineWidth(0.3);
    doc.line(mg, 21, W - mg, 21);
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 158);
    doc.text(`Página ${pagina}`, W - mg, 24.5, { align: 'right' });
    return 26;
  };
  let y = encabezado();

  // OTs largas: las tablas cortan al llegar al borde y siguen en página
  // nueva; los títulos de bloque saltan junto con su cabecera y ≥1 fila.
  const BOTTOM = doc.internal.pageSize.getHeight() - mg;
  const salto: SaltoTabla = {
    bottom: BOTTOM,
    onBreak: () => {
      doc.addPage();
      return encabezado();
    },
  };

  // ── INSUMOS: tres tablas (INSUMOS / PRODUCCIÓN / INSTALACIÓN) consolidadas.
  // La antigua tabla "detalle por cortina" se eliminó (pedido #20). Cada tabla
  // se imprime solo si tiene filas; el título salta con su cabecera y ≥1 fila.
  const titH = 7;
  const bloqueInsumos = (titulo: string, items: InsumoConsolidado[]) => {
    if (items.length === 0) return;
    y += 3;
    if (y + titH + 13 > BOTTOM) y = salto.onBreak();
    doc.setFillColor(C_BLUE[0], C_BLUE[1], C_BLUE[2]);
    doc.rect(mg, y, tablaW, titH, 'F');
    doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(titulo, mg + 2, y + titH / 2 + 2);
    doc.setFontSize(8.5);
    doc.text('ENTREGADO POR:', mg + tablaW * 0.5, y + titH / 2 + 2);
    y += titH;

    // Anchos en mm reales (suman tablaW, así que sc2 = 1). Cada uno está tomado
    // del texto más largo que puede recibir a 8 pt: DESCRIPCIÓN 92,8 + margen;
    // CANTIDAD/TOTAL 14,5 ("4 PIVOTES") + margen; ADICIONAL por su cabecera
    // (16,1 a 8,5 pt). El resto son casillas de firma.
    const w2 = [8, 96, 17, 18, 17, 24, 24, 21, 36];
    const sum2 = w2.reduce((a, b) => a + b, 0);
    const sc2 = tablaW / sum2;
    const cols2: Col[] = [
      { label: 'ID', align: 'c' },
      { label: 'DESCRIPCIÓN' },
      { label: 'CANTIDAD', align: 'c' },
      { label: 'ADICIONAL', align: 'c' },
      { label: 'TOTAL', align: 'c' },
      { label: 'INSTALACIÓN', align: 'c' },
      { label: 'PRODUCCIÓN', align: 'c' },
      { label: 'FECHA', align: 'c' },
      { label: 'PERSONA QUE RECIBE' },
    ].map((c, i) => ({ ...c, w: w2[i] * sc2 }) as Col);
    // Con cantidad 0 + unidad se muestra SOLO la unidad ("CALCULAR": el cordón y
    // la cadena inferior de la vertical se miden en terreno, sin número fijo).
    // Los metros llevan decimales (la cadena metálica se corta a 4,6 m): con
    // coma, como se escribe acá.
    const cantTxt = (m: InsumoConsolidado) => {
      const n = m.cantidad.toLocaleString('es-CL', { maximumFractionDigits: 2 });
      return m.unidad ? (m.cantidad === 0 ? m.unidad : `${n} ${m.unidad}`) : n;
    };
    const rows2 = items.map((m, i) => [
      String(i + 1),
      m.descripcion,
      cantTxt(m),
      '',
      cantTxt(m),
      '',
      '',
      '',
      '',
    ]);
    y = tabla(doc, mg, y, cols2, rows2, { rowH: 6, greenCol: 4, salto });
  };
  bloqueInsumos('INSUMOS', data.insumos.filter((m) => m.grupo === 'INSUMOS'));
  bloqueInsumos('INSUMOS DE PRODUCCIÓN', data.insumos.filter((m) => m.grupo === 'PRODUCCION'));
  bloqueInsumos('INSUMOS ESTRUCTURA', data.insumos.filter((m) => m.grupo === 'ESTRUCTURA'));
  bloqueInsumos('INSUMOS DE INSTALACIÓN', data.insumos.filter((m) => m.grupo === 'INSTALACION'));

  // ── BLOQUE 3: ETIQUETAS ROLZZO ─────────────────────────────────────
  y += 3;
  if (y + titH + 13 > BOTTOM) y = salto.onBreak();
  doc.setFillColor(C_GREEN[0], C_GREEN[1], C_GREEN[2]);
  doc.rect(mg, y, tablaW, titH, 'F');
  doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ETIQUETAS ROLZZO', mg + 2, y + titH / 2 + 2);
  doc.setFontSize(8.5);
  doc.text('ENTREGADO', mg + tablaW * 0.5, y + titH / 2 + 2);
  y += titH;

  // DESCRIPCIÓN alineada con la de las tablas de insumos (96 mm): la etiqueta
  // ("ETIQUETAS DE CORTINAS BLANCAS (ROLZZO)", 63,5 mm) entra holgada en UNA línea.
  const w3 = [18, 96, 17, 34, 34, 62];
  const sum3 = w3.reduce((a, b) => a + b, 0);
  const sc3 = tablaW / sum3;
  const cols3: Col[] = [
    { label: 'COD', align: 'c' },
    { label: 'DESCRIPCIÓN' },
    { label: 'CANTIDAD', align: 'c' },
    { label: 'INSTALACION', align: 'c' },
    { label: 'PRODUCCION', align: 'c' },
    { label: 'PERSONA QUE RECIBE' },
  ].map((c, i) => ({ ...c, w: w3[i] * sc3 }) as Col);
  const rows3 = data.etiquetas.map((e) => [
    e.cod,
    `ETIQUETAS DE CORTINAS ${e.color === 'BLANCA' ? 'BLANCAS' : 'NEGRAS'} (ROLZZO)`,
    String(e.cantidad),
    '',
    '',
    '',
  ]);
  y = tabla(doc, mg, y, cols3, rows3, { rowH: 6, greenCol: 2, salto });

  // ── BLOQUE 3: NOTAS DE TERRENO (solo si alguien anotó algo en Fase 2) ─
  if (data.notas.length > 0) {
    y += 3;
    if (y + titH + 16 > BOTTOM) y = salto.onBreak();
    doc.setFillColor(C_DARK[0], C_DARK[1], C_DARK[2]);
    doc.rect(mg, y, tablaW, titH, 'F');
    doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('NOTAS DE TERRENO', mg + 2, y + titH / 2 + 2);
    doc.setFontSize(8.5);
    doc.text('ANOTADO EN FASE 2', mg + tablaW * 0.5, y + titH / 2 + 2);
    y += titH;

    const w4 = [55, 206];
    const sum4 = w4.reduce((a, b) => a + b, 0);
    const sc4 = tablaW / sum4;
    const cols4: Col[] = [
      { label: 'UBICACIÓN' },
      { label: 'NOTAS' },
    ].map((c, i) => ({ ...c, w: w4[i] * sc4 }) as Col);
    const rows4 = data.notas.map((n) => [n.ubic, n.notas]);
    // NOTAS conserva la fila alta: es texto libre del vendedor, sin largo acotado,
    // así que es la única tabla donde el corte en dos líneas es esperable.
    y = tabla(doc, mg, y, cols4, rows4, { rowH: 8.5, salto });
  }

  doc.save(`Inventario_${meta.ot}.pdf`);
}
