// ─────────────────────────────────────────────────────────────────────
// PDF "INVENTARIO — ENTREGA Y RECEPCIÓN DE MATERIAL"
//
// Hoja de bodega que se entrega con la OT. Tres bloques:
//   1. Detalle por cortina (identidad: producto/tipo/mecanismo/tubería/
//      accionamiento/peso cadena/manillas/ubic/medidas) — reusa la identidad
//      del Cálculo general (mismo motor de datos).
//   2. CORTINAS ROLLER: materiales consolidados (mecanismo, cadena, peso de
//      cadena) con cantidad/total y casilleros de entrega (instalación/
//      producción/estructura, fecha, recibe) para llenar a mano.
//   3. ETIQUETAS ROLZZO: una fila por código según color de accesorios
//      (blancos → INS 95-1 blanca; resto → INS 95 negra), 1 por paño.
//
// Lógica pura salvo `generarPdfInventario`, que dibuja con jsPDF.
// ─────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import type { Ventana, CatalogoProductos } from '@/modules/cotizador/types';
import type { VentanaItem } from '@/modules/ots/types';
import { construirCalculoGeneral, type FilaCalculo } from './pdfCalculoGeneral';
import { construirEtiquetas, type EtiquetaLinea } from './inventario';

type RGB = [number, number, number];

export type FilaInventario = {
  id: number;
  producto: string;
  tipo: string;
  codMecanismo: string;
  tuberia: string;
  adicional: string;
  accionamiento: string;
  pesoCadena: string;
  manillas: string;
  ubic: string;
  anchoMts: string;
  altoMts: string;
};

export type MaterialConsolidado = {
  id: number;
  descripcion: string;
  cantidad: number;
};

export type Inventario = {
  filas: FilaInventario[];
  materiales: MaterialConsolidado[];
  /** Etiquetas por código según color de accesorios (blancos → INS 95-1). */
  etiquetas: EtiquetaLinea[];
};

const mts3 = (n: number) => n.toFixed(3).replace('.', ',');

/** Consolida mecanismo + cadena + peso de cadena por valor único (orden por dimensión). */
function consolidarMateriales(filas: FilaCalculo[]): MaterialConsolidado[] {
  const acc = new Map<string, number>();
  const bump = (s: string) => {
    const k = (s || '').trim();
    if (k) acc.set(k, (acc.get(k) || 0) + 1);
  };
  for (const f of filas) bump(f.codMecanismo);
  for (const f of filas) bump(f.accionamiento);
  for (const f of filas) bump(f.pesoCadena);
  return [...acc.entries()].map(([descripcion, cantidad], i) => ({
    id: i + 1,
    descripcion,
    cantidad,
  }));
}

/** Construye los datos de la hoja INVENTARIO para las ventanas de una OT. */
export function construirInventario(
  ventanas: Ventana[],
  catalogo: CatalogoProductos = {},
): Inventario {
  const { filas } = construirCalculoGeneral(ventanas, catalogo);
  const filasInv: FilaInventario[] = filas.map((f, i) => ({
    id: i + 1,
    producto: f.producto,
    tipo: f.tipoRol,
    codMecanismo: f.codMecanismo,
    tuberia: f.tuberia,
    adicional: '0',
    accionamiento: f.accionamiento,
    pesoCadena: f.pesoCadena,
    manillas: f.manillas || '0',
    ubic: f.ubic,
    anchoMts: mts3(f.anchoMts),
    altoMts: mts3(f.altoMts),
  }));
  return {
    filas: filasInv,
    materiales: consolidarMateriales(filas),
    etiquetas: construirEtiquetas(ventanas as unknown as VentanaItem[]),
  };
}

// ── Render PDF ───────────────────────────────────────────────────────
export type MetaInventario = { ot: string; cliente?: string; empresa?: string };

const C_DARK: RGB = [55, 55, 62];
const C_WHITE: RGB = [255, 255, 255];
const C_LINE: RGB = [150, 150, 158];
const C_GREEN: RGB = [112, 173, 71];
const C_BLUE: RGB = [31, 119, 180];
const C_TEXT: RGB = [25, 25, 30];

type Col = { label: string; w: number; align?: 'l' | 'c' };

function celda(
  doc: jsPDF,
  s: string,
  x: number,
  w: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: RGB; align?: 'l' | 'c' } = {},
) {
  const { bold = false, color = C_TEXT, align = 'l' } = opts;
  let size = opts.size ?? 5.4;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(color[0], color[1], color[2]);
  const maxW = w - 1.4;
  let txt = String(s ?? '');
  doc.setFontSize(size);
  while (size > 3.4 && doc.getTextWidth(txt) > maxW) {
    size -= 0.3;
    doc.setFontSize(size);
  }
  while (txt.length > 1 && doc.getTextWidth(txt) > maxW) txt = txt.slice(0, -1);
  if (align === 'c') doc.text(txt, x + w / 2, y, { align: 'center' });
  else doc.text(txt, x + 0.8, y, { align: 'left' });
}

/** Dibuja una tabla (header oscuro + filas). Devuelve la y final. */
function tabla(
  doc: jsPDF,
  x: number,
  yStart: number,
  cols: Col[],
  rows: string[][],
  opts: { headFill?: RGB; rowH?: number; headH?: number; greenCol?: number } = {},
): number {
  const headFill = opts.headFill ?? C_DARK;
  const rowH = opts.rowH ?? 6;
  const headH = opts.headH ?? 7;
  const totalW = cols.reduce((a, c) => a + c.w, 0);
  let y = yStart;

  // Header
  doc.setFillColor(headFill[0], headFill[1], headFill[2]);
  doc.rect(x, y, totalW, headH, 'F');
  let cx = x;
  for (const c of cols) {
    doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
    doc.setLineWidth(0.2);
    doc.rect(cx, y, c.w, headH);
    celda(doc, c.label, cx, c.w, y + headH / 2 + 1.4, {
      bold: true,
      color: C_WHITE,
      align: 'c',
      size: 5.2,
    });
    cx += c.w;
  }
  y += headH;

  // Filas
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const bg: RGB = i % 2 === 0 ? [245, 246, 248] : C_WHITE;
    cx = x;
    cols.forEach((c, j) => {
      const fill = opts.greenCol === j ? C_GREEN : bg;
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.rect(cx, y, c.w, rowH, 'F');
      doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
      doc.setLineWidth(0.2);
      doc.rect(cx, y, c.w, rowH);
      const val = row[j] ?? '';
      celda(doc, val, cx, c.w, y + rowH / 2 + 1.3, {
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
): void {
  const data = construirInventario(ventanas, catalogo);
  if (data.filas.length === 0) {
    throw new Error('No hay cortinas en la OT.');
  }

  const doc = new jsPDF('l', 'mm', 'a4'); // 297 × 210
  const W = doc.internal.pageSize.getWidth();
  const mg = 8;
  const usable = W - mg * 2;

  // ── Encabezado ─────────────────────────────────────────────────────
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

  let y = 26;

  // ── BLOQUE 1: detalle por cortina ──────────────────────────────────
  const w1 = [6, 26, 28, 30, 20, 16, 24, 24, 16, 22, 14, 14, 27];
  const sum1 = w1.reduce((a, b) => a + b, 0);
  const sc1 = usable / sum1;
  const cols1: Col[] = [
    { label: 'ID', align: 'c' },
    { label: 'PRODUCTO' },
    { label: 'TIPO' },
    { label: 'COD MECANISMO' },
    { label: 'TUBERIA' },
    { label: 'ADICIONAL', align: 'c' },
    { label: 'ACCIONAMIENTO' },
    { label: 'PESO CADENA' },
    { label: 'MANILLAS', align: 'c' },
    { label: 'UBIC.' },
    { label: 'ANCHO mts', align: 'c' },
    { label: 'ALTO mts', align: 'c' },
    { label: 'PERSONA QUE RECIBE' },
  ].map((c, i) => ({ ...c, w: w1[i] * sc1 }) as Col);
  const rows1 = data.filas.map((f) => [
    String(f.id),
    f.producto,
    f.tipo,
    f.codMecanismo,
    f.tuberia,
    f.adicional,
    f.accionamiento,
    f.pesoCadena,
    f.manillas,
    f.ubic,
    f.anchoMts,
    f.altoMts,
    '',
  ]);
  y = tabla(doc, mg, y, cols1, rows1, { rowH: 6.5 });

  // ── BLOQUE 2: CORTINAS ROLLER (consolidado + entrega) ──────────────
  y += 7;
  const titH = 8;
  doc.setFillColor(C_BLUE[0], C_BLUE[1], C_BLUE[2]);
  doc.rect(mg, y, usable, titH, 'F');
  doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CORTINAS ROLLER', mg + 2, y + titH / 2 + 2);
  doc.setFontSize(6.5);
  doc.text('ENTREGADO POR:', mg + usable * 0.5, y + titH / 2 + 2);
  y += titH;

  const w2 = [6, 50, 16, 16, 14, 22, 22, 22, 20, 22];
  const sum2 = w2.reduce((a, b) => a + b, 0);
  const sc2 = usable / sum2;
  const cols2: Col[] = [
    { label: 'ID', align: 'c' },
    { label: 'DESCRIPCIÓN' },
    { label: 'CANTIDAD', align: 'c' },
    { label: 'ADICIONAL', align: 'c' },
    { label: 'TOTAL', align: 'c' },
    { label: 'INSTALACIÓN', align: 'c' },
    { label: 'PRODUCCIÓN', align: 'c' },
    { label: 'ESTRUCTURA', align: 'c' },
    { label: 'FECHA', align: 'c' },
    { label: 'RECIBE', align: 'c' },
  ].map((c, i) => ({ ...c, w: w2[i] * sc2 }) as Col);
  const rows2 = data.materiales.map((m) => [
    String(m.id),
    m.descripcion,
    String(m.cantidad),
    '',
    String(m.cantidad),
    '',
    '',
    '',
    '',
    '',
  ]);
  y = tabla(doc, mg, y, cols2, rows2, { rowH: 7, greenCol: 4 });

  // ── BLOQUE 3: ETIQUETAS ROLZZO ─────────────────────────────────────
  y += 7;
  doc.setFillColor(C_GREEN[0], C_GREEN[1], C_GREEN[2]);
  doc.rect(mg, y, usable, titH, 'F');
  doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ETIQUETAS ROLZZO', mg + 2, y + titH / 2 + 2);
  doc.setFontSize(6.5);
  doc.text('ENTREGADO', mg + usable * 0.5, y + titH / 2 + 2);
  y += titH;

  const w3 = [16, 40, 16, 24, 24, 60];
  const sum3 = w3.reduce((a, b) => a + b, 0);
  const sc3 = usable / sum3;
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
  y = tabla(doc, mg, y, cols3, rows3, { rowH: 7, greenCol: 2 });

  doc.save(`Inventario_${meta.ot}.pdf`);
}
