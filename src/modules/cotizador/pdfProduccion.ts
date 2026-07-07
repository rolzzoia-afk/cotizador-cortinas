// PDF de Producción (landscape carta con 7 secciones) + validación de
// datos para etiquetas. Portado desde public/legacy/index.html (5464-6101).
// Las etiquetas Brother viven en pdfEtiquetasBrother.ts (formato oficial
// de las plantillas P-touch de docs/referencias).

import { jsPDF } from 'jspdf';
import type { CatalogoProductos, Pano } from './types';
import type { OptimizerRow } from './tela';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';

const EMPTY_PANO: Partial<Pano> = {};

type Color3 = [number, number, number];

type MetaPDF = {
  ot: string;
  cliente: string;
  fecha: string;
  /** Nombre de la empresa (tenant) para encabezados; default 'Rolzzo'. */
  empresa?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────
function tblSection(
  doc: jsPDF,
  state: { y: number; mg: number },
  title: string,
  color: Color3,
  headers: string[],
  widths: number[],
  rows: (string | number)[][],
  fontSize = 7,
) {
  const totalW = widths.reduce((a, b) => a + b, 0);
  const mg = state.mg;

  state.y += 8;
  if (state.y > 175) {
    doc.addPage();
    state.y = 15;
  }

  // Section title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...color);
  doc.text(title, mg, state.y);
  state.y += 6;

  // Header bar
  doc.setFillColor(...color);
  doc.rect(mg, state.y, totalW, 6, 'F');
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  let cx = mg;
  headers.forEach((h, i) => {
    doc.text(String(h).substring(0, Math.floor(widths[i] / 1.7)), cx + 1.5, state.y + 4.2);
    cx += widths[i];
  });
  state.y += 6;

  // Data rows
  doc.setFont('helvetica', 'normal');
  rows.forEach((row, idx) => {
    if (state.y > 188) {
      doc.addPage();
      state.y = 15;
    }
    const bg: Color3 = idx % 2 === 0 ? [248, 248, 252] : [255, 255, 255];
    doc.setFillColor(...bg);
    doc.setTextColor(30, 30, 40);
    doc.rect(mg, state.y, totalW, 5.5, 'F');
    cx = mg;
    row.forEach((cell, i) => {
      if (i < widths.length) {
        const maxCh = Math.max(4, Math.floor(widths[i] / 1.7));
        doc.setFontSize(fontSize);
        doc.text(
          String(cell === null || cell === undefined ? '' : cell).substring(0, maxCh),
          cx + 1.5,
          state.y + 3.9,
        );
        cx += widths[i];
      }
    });
    state.y += 5.5;
  });
}

// ═════════════════════════════════════════════════════════════════════
// PDF DE PRODUCCIÓN (landscape carta, 7 secciones)
// ═════════════════════════════════════════════════════════════════════
export function generarPDFProduccion(
  rows: OptimizerRow[],
  meta: MetaPDF,
  catalogo: CatalogoProductos,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): void {
  if (!rows || rows.length === 0) {
    throw new Error('No hay filas para generar el PDF. Guarda el plan en Tela primero.');
  }

  const doc = new jsPDF('l', 'mm', 'letter');
  const W = doc.internal.pageSize.getWidth(); // 279mm
  const state = { y: 15, mg: 12 };

  // ─── Page header ───────────────────────────────────────────────────
  doc.setFillColor(30, 30, 40);
  doc.rect(0, 0, W, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('ORDEN DE PRODUCCIÓN — ROLZZO', state.mg, 14);
  doc.setFontSize(9);
  doc.setTextColor(150, 160, 180);
  doc.text(
    `OT: ${meta.ot}  |  Cliente: ${meta.cliente}  |  Fecha: ${meta.fecha}`,
    W - state.mg,
    14,
    { align: 'right' },
  );
  state.y = 24;

  // 1. CÁLCULO DE PAÑOS ───────────────────────────────────────────────
  const panoData = rows.map((r, i) => {
    // altoCorte viene de la fila (param-aware; dúo = 2×alto+extraDuo).
    const altoCorteCm = (r.altoCorte * 100).toFixed(1);
    const m2Val = ((r.anchoCm / 100) * r.altoCorte).toFixed(4);
    return [
      i + 1,
      r.cod || '',
      r.cant || 1,
      r.producto || '',
      r.codInt || '',
      r.tipo || '',
      r.anchoCm.toFixed(1) + ' cm',
      (r.anchoCm - params.descAnchoCorteCm).toFixed(1) + ' cm',
      r.altoCm.toFixed(1) + ' cm',
      r.extra.toFixed(2) + ' m',
      altoCorteCm + ' cm',
      r.altoReal.toFixed(4) + ' m',
      m2Val,
      r.numeroPano || '—',
      r.junto || '—',
    ];
  });
  tblSection(
    doc,
    state,
    'CÁLCULO DE PAÑOS',
    [168, 85, 247],
    ['#','COD','Q','PRODUCTO','COD_INT','TIPO','ANCHO CORTE','CORTE -3.5','ALTO','EXTRA','ALTO CORTE','ALTO REAL','M²','PAÑO#','JUNTO'],
    [8, 18, 7, 42, 18, 18, 22, 22, 18, 14, 22, 22, 18, 13, 13],
    panoData,
    6.5,
  );

  // 2. ETIQUETAS TUBERÍA ──────────────────────────────────────────────
  const tuberiaData = rows.map((r) => {
    const p = r.pano || EMPTY_PANO;
    return [
      meta.ot,
      meta.cliente,
      r.ubicacion || '',
      r.anchoCm.toFixed(1),
      r.altoCm.toFixed(1),
      `CAD [${String(p.cierreVert || '?').toUpperCase()}]`,
      r.codInt || '',
      p.tuberia || '—',
      (r.anchoCm - 4.2).toFixed(1) + ' cm',
      p.colorMecanismo || p.color || '—',
    ];
  });
  tblSection(
    doc,
    state,
    'ETIQUETAS TUBERÍA',
    [59, 130, 246],
    ['OT','CLIENTE','UBIC.','ANCHO','ALTO','CADENA','COD_INT','TUBERÍA','PESO','COLOR'],
    [12, 35, 28, 16, 16, 26, 18, 20, 20, 25],
    tuberiaData,
  );

  // 3. ETIQUETAS ROLLER ───────────────────────────────────────────────
  const rollerData = rows.map((r) => {
    const p = r.pano || EMPTY_PANO;
    const telaDesc = catalogo[r.codInt]?.descripcion || '';
    const telaLabel = telaDesc ? `${r.codInt} / ${telaDesc}` : r.codInt;
    return [
      meta.ot,
      meta.cliente,
      r.ubicacion || '',
      `CAD [${String(p.cierreVert || '?').toUpperCase()}]`,
      p.armado || '—',
      r.anchoCm.toFixed(1) + ' cm',
      r.altoCm.toFixed(1) + ' cm',
      telaLabel,
      p.separador ? 'SÍ' : 'NO',
      p.mecanismo || '—',
      p.colorMecanismo || '—',
    ];
  });
  tblSection(
    doc,
    state,
    'ETIQUETAS ROLLER',
    [34, 197, 94],
    ['OT','CLIENTE','UBIC.','CADENA','ARMADO','ANCHO','ALTO','COD TELA','SEPAR.','MECANISMO','COLOR'],
    [12, 30, 28, 26, 16, 18, 18, 45, 14, 28, 22],
    rollerData,
    6.5,
  );

  // 4. ETIQUETAS TELAS (agrupado por codInt + junto) ──────────────────
  type Grupo = { producto: string; codInt: string; junto: string; maxAltoReal: number };
  const telaGroups: Record<string, Grupo> = {};
  rows.forEach((r) => {
    const key = (r.codInt || '') + '|' + (r.junto || '—');
    if (!telaGroups[key]) {
      telaGroups[key] = {
        producto: r.producto,
        codInt: r.codInt,
        junto: r.junto || '—',
        maxAltoReal: r.altoReal,
      };
    } else if (r.altoReal > telaGroups[key].maxAltoReal) {
      telaGroups[key].maxAltoReal = r.altoReal;
    }
  });
  const telaData = Object.values(telaGroups).map((g) => [
    meta.ot,
    meta.cliente,
    g.producto || '',
    g.codInt || '',
    g.maxAltoReal.toFixed(2) + ' m',
    g.junto,
  ]);
  tblSection(
    doc,
    state,
    'ETIQUETAS TELAS',
    [99, 102, 241],
    ['OT','CLIENTE','PRODUCTO','COD_INT','ALTO CORTE','JUNTO'],
    [12, 35, 55, 22, 26, 14],
    telaData,
  );

  // 5. ETIQUETAS CENEFA CUADRADA ──────────────────────────────────────
  const cenefaRows = rows.filter((r) => String(r.pano?.cenefa || '').toLowerCase() === 'cuadrada');
  if (cenefaRows.length > 0) {
    const cenefaData = cenefaRows.map((r) => {
      const p = r.pano || EMPTY_PANO;
      return [
        meta.ot,
        meta.cliente,
        r.ubicacion || '',
        (r.anchoCm + 1).toFixed(1),
        p.colorMecanismo || p.color || '—',
        p.armado || '—',
      ];
    });
    tblSection(
      doc,
      state,
      'ETIQUETAS CENEFA CUADRADA',
      [206, 17, 38],
      ['OT','CLIENTE','UBICACIÓN','PLETINA','COLOR','TIPO INSTALAC'],
      [12, 40, 40, 22, 30, 40],
      cenefaData,
    );
  }

  // 6. RESUMEN DE TELA (metros por código) ────────────────────────────
  type ResumenTela = { producto: string; anchoRollo: number; totalM2: number; panos: number };
  const resumenTela: Record<string, ResumenTela> = {};
  rows.forEach((r) => {
    const codKey = r.codInt || '?';
    if (!resumenTela[codKey]) {
      resumenTela[codKey] = {
        producto: r.producto || '',
        anchoRollo: r.anchoRollo || params.anchoRolloDefaultM,
        totalM2: 0,
        panos: 0,
      };
    }
    const altoCorteCm = r.altoCorte * 100; // dúo: 2×alto+30; resto: alto+25
    resumenTela[codKey].totalM2 += (r.anchoCm / 100) * (altoCorteCm / 100);
    resumenTela[codKey].panos++;
  });
  const resumenData = Object.entries(resumenTela).map(([cod, v]) => [
    cod,
    v.producto,
    v.panos,
    v.anchoRollo.toFixed(2) + ' m',
    v.totalM2.toFixed(4) + ' m²',
  ]);
  tblSection(
    doc,
    state,
    'RESUMEN DE TELA (metros por código)',
    [80, 80, 100],
    ['COD_INT','PRODUCTO','PAÑOS','ANCHO ROLLO','TOTAL M²'],
    [20, 70, 16, 28, 28],
    resumenData,
  );

  // 7. INVENTARIO DE MATERIALES (Paso 24) ─────────────────────────────
  const invData = rows.map((r, i) => {
    const p = r.pano || EMPTY_PANO;
    const mecLabel = String(p.mecanismo || '—').replace(/\[|\]/g, '').substring(0, 20);
    const tubLabel = String(p.tuberia || '—').replace(/\[|\]/g, '').substring(0, 14);
    const manilla =
      (p.manillaCant ?? 0) > 0 ? `${p.manillaCant}x ${p.manillaColor || ''}` : '—';
    return [
      i + 1,
      r.producto || '',
      r.tipo || '',
      mecLabel,
      tubLabel,
      p.colorMecanismo || '—',
      p.cierreVert ? String(p.cierreVert).toUpperCase() : '—',
      p.largoCadena ? p.largoCadena + ' m' : '—',
      manilla,
      r.ubicacion || '',
      r.anchoCm.toFixed(1),
      r.altoCm.toFixed(1),
    ];
  });
  tblSection(
    doc,
    state,
    'INVENTARIO DE MATERIALES (Paso 24)',
    [245, 158, 11],
    ['#','PRODUCTO','TIPO','MECANISMO','TUBERÍA','COLOR','CAD DIR','LARGO CAD','MANILLA','UBIC','ANCHO','ALTO'],
    [8, 38, 16, 36, 28, 18, 16, 20, 20, 26, 16, 16],
    invData,
    6,
  );

  doc.save(`Produccion_${meta.ot}_${meta.fecha}.pdf`);
}

// ═════════════════════════════════════════════════════════════════════
// VALIDACIÓN ANTES DE ETIQUETAS
// ═════════════════════════════════════════════════════════════════════
export function validarDatosParaEtiquetas(rows: OptimizerRow[]): string[] {
  const missingFields: string[] = [];
  rows.forEach((row, idx) => {
    const panoNum = idx + 1;
    const p = row.pano || EMPTY_PANO;
    const loc = row.ubicacion || '';
    if (!p.mecanismo) missingFields.push(`Paño ${panoNum} (${loc}): Falta MECANISMO`);
    if (!p.tuberia) missingFields.push(`Paño ${panoNum} (${loc}): Falta TUBERÍA`);
    if (!p.cierreVert) missingFields.push(`Paño ${panoNum} (${loc}): Falta CIERRE VERTICAL`);
    if (!p.largoCadena && !p.motorTipo) {
      missingFields.push(`Paño ${panoNum} (${loc}): Falta LARGO CADENA (o marcar MOTOR)`);
    }
    if (!p.armado) missingFields.push(`Paño ${panoNum} (${loc}): Falta ARMADO (Interno/Externo)`);
    if (!p.colorMecanismo) missingFields.push(`Paño ${panoNum} (${loc}): Falta COLOR MECANISMO`);
    if (!p.colorPeso) missingFields.push(`Paño ${panoNum} (${loc}): Falta COLOR PESO`);
    if (!p.instalacion) {
      missingFields.push(`Paño ${panoNum} (${loc}): Falta TIPO INSTALACIÓN`);
    }
  });
  return missingFields;
}
