// ─────────────────────────────────────────────────────────────────────
// Hoja de Inventario (entrega y recepción de material) — Fase 4.
//
// Réplica de la plantilla Excel "INVENTARIO" que usaba el taller:
//   1. Tabla de cortinas: una fila por paño con mecanismo, tubería,
//      accionamiento, peso de cadena, manillas, ubicación y medidas.
//   2. Consolidado de componentes (desde calcularBOM) con cantidad,
//      adicional editable y total — lo que el bodeguero junta.
//   3. Etiquetas (1 por paño).
//   4. Fecha de instalación.
//
// El estado de entrega (quién entregó, quién recibe, fecha, check por
// ítem) se guarda en datos_generales.inventario de la OT.
// ─────────────────────────────────────────────────────────────────────

import { jsPDF } from 'jspdf';
import type { BomItem, VentanaItem } from '@/modules/ots/types';
import type { Pano } from './types';
import { textoPesoCadenaInventario } from './cadenas';
import { OPCIONES_MECANISMO, OPCIONES_TUBERIA } from './fase2';
import { mecanismoParaPano, tuberiaParaPano } from '@/modules/descuentos/chips';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';

// ── Tipos ────────────────────────────────────────────────────────────

/** Fila de la tabla superior: una cortina (paño) con todo su detalle. */
export type FilaCortina = {
  id: number;
  producto: string;
  tipo: string;
  mecanismo: string;
  tuberia: string;
  adicional: string;
  accionamiento: string;
  pesoCadena: string;
  manillas: string;
  ubicacion: string;
  anchoM: number;
  altoM: number;
};

/** Estado de entrega de un ítem consolidado. */
export type EntregaItem = {
  entregado: boolean;
  fecha?: string; // ISO yyyy-mm-dd
  recibe?: string;
  /** Unidades extra pedidas a mano (columna ADICIONAL del Excel). */
  adicional?: number;
};

/** Se persiste en datos_generales.inventario. */
export type InventarioEstado = {
  entregadoPor?: string;
  entregas: Record<string, EntregaItem>;
};

export const INVENTARIO_VACIO: InventarioEstado = { entregas: {} };

/** Clave estable de un BomItem para indexar el estado de entrega. */
export function claveItem(it: BomItem): string {
  return [it.categoria, it.descripcion, it.especificacion || '', it.color || ''].join('|');
}

/** Clave reservada para la fila de etiquetas. */
export const CLAVE_ETIQUETAS = 'ETIQUETAS|INS 95-1';

// ── Tabla de cortinas ────────────────────────────────────────────────

function fmtAccionamiento(p: Partial<Pano>): string {
  if (p.motorTipo) {
    const lado = p.ladoMotor ? ` (${p.ladoMotor})` : '';
    return `MOTOR ${p.motorTipo}${lado}`;
  }
  const largo = p.largoCadena ? String(p.largoCadena) : '';
  const color = p.colorCadena || '';
  return [largo, color].filter(Boolean).join(' ');
}

export function construirFilasCortinas(ventanas: VentanaItem[]): FilaCortina[] {
  const filas: FilaCortina[] = [];
  let id = 0;
  for (const v of ventanas) {
    const panos = (v.panos || []) as Partial<Pano>[];
    const modelo = v.modelo as ModeloDespiece | null | undefined;
    for (const p of panos) {
      id++;
      const manCant = parseInt(String(p.manillaCant ?? '0')) || 0;
      const mecChip = mecanismoParaPano(
        { ...p, mecanismo: p.mecanismo as string },
        v.color as string,
        modelo,
        OPCIONES_MECANISMO,
        v.categoria as string,
      );
      const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
      const tubChip = tuberiaParaPano(
        anchoM,
        modelo,
        p.tuberia as string,
        OPCIONES_TUBERIA,
        v.categoria as string,
      );
      filas.push({
        id,
        producto: `${v.producto || ''} ${v.color || ''}`.trim(),
        tipo: v.tipo || '',
        mecanismo: [mecChip, p.colorMecanismo].filter(Boolean).join(' '),
        tuberia: tubChip,
        adicional: p.dual ? `DUAL ${p.dualLado || ''}`.trim() : '',
        accionamiento: fmtAccionamiento(p),
        pesoCadena: textoPesoCadenaInventario(p),
        manillas: manCant > 0 ? `${manCant} ${p.manillaColor || ''}`.trim() : '',
        ubicacion: v.ubicacion || '',
        anchoM: anchoM,
        altoM: parseFloat(String(v.alto ?? p.alto ?? 0)) || 0,
      });
    }
  }
  return filas;
}

/** Total de un ítem = cantidad calculada + adicional manual. */
export function totalItem(it: BomItem, estado: InventarioEstado): number {
  const extra = estado.entregas[claveItem(it)]?.adicional || 0;
  return it.cantidad + extra;
}

// ── PDF imprimible (réplica de la plantilla Excel) ──────────────────

type MetaInventario = {
  ot: string;
  cliente: string;
  empresa?: string;
  fechaInstalacion?: string;
};

const GRIS: [number, number, number] = [120, 120, 120];
const AZUL: [number, number, number] = [31, 117, 203];
const VERDE: [number, number, number] = [106, 168, 79];
const NEGRO: [number, number, number] = [0, 0, 0];

function fila(
  doc: jsPDF,
  y: number,
  xs: number[],
  ws: number[],
  vals: string[],
  h = 6,
  opts?: { bold?: boolean; fill?: [number, number, number]; textColor?: [number, number, number]; fontSize?: number },
) {
  doc.setFontSize(opts?.fontSize ?? 7);
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  vals.forEach((v, i) => {
    if (opts?.fill) {
      doc.setFillColor(...opts.fill);
      doc.rect(xs[i], y, ws[i], h, 'FD');
    } else {
      doc.rect(xs[i], y, ws[i], h, 'S');
    }
    const tc = opts?.textColor ?? NEGRO;
    doc.setTextColor(...tc);
    doc.text(String(v ?? ''), xs[i] + 1.2, y + h / 2 + 1.1, { maxWidth: ws[i] - 2.4 });
  });
  doc.setTextColor(0, 0, 0);
  return y + h;
}

function xsDesde(mg: number, ws: number[]): number[] {
  const xs: number[] = [];
  let acc = mg;
  for (const w of ws) {
    xs.push(acc);
    acc += w;
  }
  return xs;
}

export function generarPDFInventario(
  filasCortinas: FilaCortina[],
  items: BomItem[],
  etiquetasCant: number,
  meta: MetaInventario,
  estado: InventarioEstado,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const mg = 8;
  const pageW = doc.internal.pageSize.getWidth();
  let y = 10;

  // Encabezado
  doc.setFillColor(220, 220, 220);
  doc.rect(mg, y, pageW - mg * 2, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('INVENTARIO', mg + 2, y + 6);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('[ ENTREGA Y RECEPCIÓN DE MATERIAL ]', mg + 2, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`OT  ${meta.ot}`, pageW - mg - 2, y + 6, { align: 'right' });
  doc.setFontSize(7);
  doc.text(`Cliente: ${meta.cliente}`, pageW - mg - 2, y + 10, { align: 'right' });
  y += 15;

  // ── Tabla 1: cortinas ──
  const ws1 = [8, 42, 12, 48, 28, 20, 32, 28, 18, 26, 14, 14];
  const xs1 = xsDesde(mg, ws1);
  y = fila(doc, y, xs1, ws1, ['ID', 'PRODUCTO', 'TIPO', 'COD MECANISMO', 'TUBERÍA', 'ADICIONAL', 'ACCIONAMIENTO', 'PESO CADENA', 'MANILLAS', 'UBIC.', 'ANCHO', 'ALTO'], 6, {
    bold: true,
    fill: [40, 40, 40],
    textColor: [255, 255, 255],
    fontSize: 6.5,
  });
  for (const f of filasCortinas) {
    y = fila(doc, y, xs1, ws1, [
      String(f.id),
      f.producto,
      f.tipo,
      f.mecanismo,
      f.tuberia,
      f.adicional,
      f.accionamiento,
      f.pesoCadena,
      f.manillas,
      f.ubicacion,
      f.anchoM.toFixed(3),
      f.altoM.toFixed(3),
    ]);
  }
  y += 6;

  // ── Tabla 2: componentes consolidados ──
  doc.setFillColor(...AZUL);
  doc.rect(mg, y, 120, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('COMPONENTES', mg + 2, y + 5.5);
  doc.setFillColor(...GRIS);
  doc.rect(mg + 120, y, 100, 8, 'F');
  doc.setFontSize(7);
  doc.text(`ENTREGADO POR: ${estado.entregadoPor || ''}`, mg + 122, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 8;

  const ws2 = [60, 22, 22, 22, 50, 24, 50];
  const xs2 = xsDesde(mg, ws2);
  y = fila(doc, y, xs2, ws2, ['DESCRIPCIÓN', 'CANTIDAD', 'ADICIONAL', 'TOTAL', 'ENTREGADO', 'FECHA', 'RECIBE'], 6, {
    bold: true,
    fill: [40, 40, 40],
    textColor: [255, 255, 255],
    fontSize: 6.5,
  });
  for (const it of items) {
    const ent = estado.entregas[claveItem(it)];
    const desc = [it.descripcion, it.especificacion, it.color].filter(Boolean).join(' · ');
    y = fila(doc, y, xs2, ws2, [
      desc,
      String(it.cantidad),
      ent?.adicional ? String(ent.adicional) : '',
      String(totalItem(it, estado)),
      ent?.entregado ? '✓ SÍ' : '',
      ent?.fecha || '',
      ent?.recibe || '',
    ]);
    if (y > 185) {
      doc.addPage();
      y = 12;
    }
  }
  y += 6;

  // ── Tabla 3: etiquetas ──
  const empresa = (meta.empresa || 'ROLZZO').toUpperCase();
  doc.setFillColor(...VERDE);
  doc.rect(mg, y, 120, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`ETIQUETAS ${empresa}`, mg + 2, y + 5.5);
  doc.setTextColor(0, 0, 0);
  y += 8;
  const ws3 = [24, 70, 26, 50, 24, 56];
  const xs3 = xsDesde(mg, ws3);
  y = fila(doc, y, xs3, ws3, ['COD', 'DESCRIPCIÓN', 'CANTIDAD', 'ENTREGADO', 'FECHA', 'RECIBE'], 6, {
    bold: true,
    fill: [40, 40, 40],
    textColor: [255, 255, 255],
    fontSize: 6.5,
  });
  const entEtq = estado.entregas[CLAVE_ETIQUETAS];
  y = fila(doc, y, xs3, ws3, [
    'INS 95-1',
    `ETIQUETAS DE CORTINAS (${empresa})`,
    String(etiquetasCant),
    entEtq?.entregado ? '✓ SÍ' : '',
    entEtq?.fecha || '',
    entEtq?.recibe || '',
  ]);
  y += 10;

  // ── Fecha de instalación ──
  if (meta.fechaInstalacion) {
    doc.setLineWidth(0.8);
    doc.rect(pageW / 2 - 55, y, 110, 14, 'S');
    doc.setLineWidth(0.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`FECHA DE INSTALACIÓN: ${meta.fechaInstalacion}`, pageW / 2, y + 9, {
      align: 'center',
    });
  }

  doc.save(`Inventario_OT_${meta.ot}.pdf`);
}
