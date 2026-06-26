// PDF de Producción y Etiquetas Brother 62×100mm.
// Portado desde public/legacy/index.html (líneas 5464-6101):
//   - generarPDFProduccion: landscape carta con 7 secciones
//   - validarDatosParaEtiquetas: chequea que cada paño tenga mecanismo/tubería/…
//   - generarEtiquetasPDF: una etiqueta 62×100 por paño + página extra si cenefa=Cuadrada

import { jsPDF } from 'jspdf';
import type { CatalogoProductos, Pano } from './types';
import type { OptimizerRow } from './tela';
import { colorPesoNormalizado } from '@/modules/descuentos/peso-oscuridad';
import { etiquetaConTira } from '@/modules/descuentos/adicionales-cenefa';

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
    const altoCorteCm = (r.altoCm + 25).toFixed(1);
    const m2Val = ((r.anchoCm / 100) * ((r.altoCm + 25) / 100)).toFixed(4);
    return [
      i + 1,
      r.cod || '',
      r.cant || 1,
      r.producto || '',
      r.codInt || '',
      r.tipo || '',
      r.anchoCm.toFixed(1) + ' cm',
      (r.anchoCm - 3.5).toFixed(1) + ' cm',
      r.altoCm.toFixed(1) + ' cm',
      '0.25 m',
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
        anchoRollo: r.anchoRollo || 2.98,
        totalM2: 0,
        panos: 0,
      };
    }
    const altoCorteCm = r.altoCm + 25;
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

// ═════════════════════════════════════════════════════════════════════
// ETIQUETAS BROTHER QL-810W (62×100mm, una por paño)
// ═════════════════════════════════════════════════════════════════════
export function generarEtiquetasPDF(
  rows: OptimizerRow[],
  meta: MetaPDF,
  catalogo: CatalogoProductos,
): void {
  if (!rows || rows.length === 0) {
    throw new Error('No hay filas para imprimir. Guarda el plan en Tela primero.');
  }

  // Etiqueta 62mm × 100mm Brother QL-810W
  const PW = 62;
  const PH = 100;
  const L = 2;
  const tW = PW - L * 2;
  const halfW = tW / 2;
  const doc = new jsPDF('p', 'mm', [PW, PH]);
  let first = true;

  rows.forEach((row) => {
    if (!first) doc.addPage([PW, PH]);
    first = false;

    const p = row.pano || EMPTY_PANO;
    const anchoCm = row.anchoCm || 0;
    const altoCm = row.altoCm || 0;
    // Medidas sin sufijo "cm" y con coma decimal es-CL (172,0 → "172").
    const fmt = (n: number) => {
      const s = n.toFixed(1);
      return (s.endsWith('.0') ? s.slice(0, -2) : s).replace('.', ',');
    };
    // Piezas del despiece (medida de corte real + código de estructura), mismo
    // origen que el optimizador. Reemplaza las restas hardcodeadas ancho−3.8/−4.2.
    const piezas = row.piezas || [];
    const piezaPorCol = (col: string) => piezas.find((x) => x.columnaExcel === col);
    // Código corto para la celda: tubo "38mm_E02" → "E02"; si no hay código,
    // cae al color como identificador. Devuelve "" si no existe la pieza.
    const celdaPieza = (col: string): string => {
      const pz = piezaPorCol(col);
      if (!pz) return '';
      const med = fmt(pz.medidaCm);
      const codCorto = pz.cod.includes('_') ? pz.cod.split('_').pop() || pz.cod : pz.cod;
      const etq = codCorto || (pz.color ? String(pz.color).toUpperCase().substring(0, 6) : '');
      // Primero la medida, después el código (ej. "153,2 / E02").
      return etq ? `${med} / ${etq}` : med;
    };
    // Fallback al cálculo viejo solo si no hay modelo (sin piezas).
    const tuboCm = celdaPieza('TUBO') || fmt(anchoCm - 3.8);
    const pesoCm = celdaPieza('PESO') || fmt(anchoCm - 4.2);
    const cefOvCm = celdaPieza('CENEFA OVALADA');
    const pesoUCm = celdaPieza('PESO U');
    const pesoIntCm = celdaPieza('PESO INTERNO');
    const pletina = piezaPorCol('PLETINA')
      ? celdaPieza('PLETINA')
      : p.cenefa === 'Cuadrada'
        ? fmt(anchoCm + 1)
        : 'NO';
    const tipoTela = p.tipoTela || '—';
    const telaDesc = catalogo[row.codInt]?.descripcion || '';
    const telaFullName = telaDesc
      ? `${row.codInt} / ${telaDesc}`.toUpperCase()
      : (row.producto || tipoTela).toUpperCase();
    // Código de tubo: mismo origen que Excel/PDF (deriva del modelo aunque el
    // chip del paño venga vacío) → ya no sale "—".
    const tuberia = row.tuberiaCod || '—';
    // Color de accesorios con nombre completo (NEG → NEGRO, BCO → BLANCO…).
    const colorAcc = colorPesoNormalizado(p.colorMecanismo || p.color) || '—';
    const ubicacion = row.ubicacion || '—';
    // CAIDA = tipo interno/externo (Fase 2 armado · Fase 0 sentido).
    const caidaTipo = String(p.armado || row.sentido || '—').toUpperCase();
    // CAD. = lado de cadena de Fase 0. Quita el prefijo "CAD" redundante (la
    // etiqueta ya dice "CAD.:") → "CAD [IZQUIERDA]" se muestra como "IZQUIERDA".
    const cadDireccion = (() => {
      const raw = String(row.direccion || '—').trim();
      const m = raw.match(/\[([^\]]+)\]/); // contenido entre corchetes
      const limpio = (m ? m[1] : raw.replace(/^CAD\s*/i, '')).trim();
      return limpio || '—';
    })();
    // Largo de la cadena para mostrar junto al lado: "IZQUIERDA 4 mts".
    // El valor guardado puede traer su propia unidad ("4mts", "1,5"): extraemos
    // solo el número y normalizamos a una sola "mts" (no "4mts mts").
    const largoCad = (() => {
      const raw = String(p.largoCadena ?? '').trim();
      if (!raw) return '';
      const num = parseFloat(raw.replace(',', '.'));
      return Number.isFinite(num) && num > 0 ? `${String(num).replace('.', ',')} mts` : raw;
    })();
    const cadTexto = largoCad ? `${cadDireccion} ${largoCad}` : cadDireccion;

    // SECCIÓN 1: HEADER ───────────────────────────────────────────────
    doc.setTextColor(20, 20, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('UBICACIÓN:', L, 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(String(meta.ot), PW - L, 11, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(String(ubicacion).substring(0, 20), L, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(String(meta.cliente).toUpperCase().substring(0, 22), PW - L, 15, { align: 'right' });
    doc.setDrawColor(160, 160, 170);
    doc.setLineWidth(0.2);
    doc.line(L, 17, PW - L, 17);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('TUBO:', L, 22);
    doc.text('TELA:', PW / 2 + 1, 22);

    // Código del tubo (ej. "38mm_E02"), no la medida en cm (esa va en ROLLER).
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(String(tuberia).substring(0, 18), L, 26.5);
    doc.setFont('helvetica', 'italic');
    doc.text(telaFullName.substring(0, 24), PW / 2 + 1, 26.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('COLOR ACC:', PW / 2 + 1, 30.5);
    doc.setFont('helvetica', 'normal');
    doc.text(String(colorAcc), PW / 2 + 19, 30.5);

    // SECCIÓN 2: TABLA ROLLER | DUO/CENEFA ────────────────────────────
    const tY = 34;
    const hdrH = 6;
    const rowH = 7.5;
    const tH = hdrH + rowH * 3;

    doc.setDrawColor(50, 50, 60);
    doc.setLineWidth(0.5);
    doc.rect(L, tY, tW, tH);
    doc.setLineWidth(0.4);
    doc.line(L + halfW, tY, L + halfW, tY + tH);

    doc.setFillColor(35, 35, 45);
    doc.rect(L, tY, halfW, hdrH, 'F');
    doc.rect(L + halfW, tY, halfW, hdrH, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('ROLLER', L + halfW / 2, tY + 4.2, { align: 'center' });
    doc.text('DUO/CENEFA', L + halfW + halfW / 2, tY + 4.2, { align: 'center' });

    doc.setTextColor(20, 20, 30);
    doc.setDrawColor(120, 120, 130);
    doc.setLineWidth(0.25);
    doc.line(L, tY + hdrH, PW - L, tY + hdrH);
    doc.line(L, tY + hdrH + rowH, PW - L, tY + hdrH + rowH);
    doc.line(L, tY + hdrH + rowH * 2, PW - L, tY + hdrH + rowH * 2);

    doc.setFontSize(6.5);
    // Valores alineados a la derecha de cada media-celda (más espacio para "[cod] medida").
    const lxL = L + 1;
    const rxL = L + halfW - 1;
    const lxR = L + halfW + 1;
    const rxR = PW - L - 1;
    const celda = (label: string, value: string, lx: number, rx: number, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, lx, y);
      if (value) {
        doc.setFont('helvetica', 'normal');
        doc.text(value, rx, y, { align: 'right' });
      }
    };

    let ry = tY + hdrH + 5;
    celda('TUBO:', tuboCm, lxL, rxL, ry);
    celda('CEF.OV.:', cefOvCm, lxR, rxR, ry);

    ry += rowH;
    celda('PESO:', pesoCm, lxL, rxL, ry);
    celda('PESO U.:', pesoUCm, lxR, rxR, ry);

    ry += rowH;
    celda('PLATINA:', pletina, lxL, rxL, ry);
    // Cenefa ovalada sin peso interno (no-dúo): la fila muestra CON/SIN TIRA.
    if (cefOvCm && !pesoIntCm) {
      celda('TIRA:', etiquetaConTira(p.cenefaTira), lxR, rxR, ry);
    } else {
      celda('PESO INT:', pesoIntCm, lxR, rxR, ry);
    }

    // SECCIÓN 3: BARRA "INFORMACION TERRENO" ──────────────────────────
    const infoY = tY + tH + 2;
    doc.setFillColor(35, 35, 45);
    doc.rect(L, infoY, tW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('INFORMACION TERRENO', L + tW / 2, infoY + 5, { align: 'center' });

    // SECCIÓN 4: DATOS TERRENO ────────────────────────────────────────
    const dtY = infoY + 7;
    const dtH = 16;
    const dtRH = dtH / 2;

    doc.setDrawColor(50, 50, 60);
    doc.setLineWidth(0.5);
    doc.rect(L, dtY, tW, dtH);
    doc.setLineWidth(0.4);
    doc.line(L + halfW, dtY, L + halfW, dtY + dtH);
    doc.setDrawColor(120, 120, 130);
    doc.setLineWidth(0.25);
    doc.line(L, dtY + dtRH, PW - L, dtY + dtRH);

    doc.setTextColor(20, 20, 30);
    doc.setFontSize(6.5);
    let dy = dtY + dtRH - 2;
    doc.setFont('helvetica', 'bold');
    doc.text('ANCHO:', L + 1, dy);
    doc.setFont('helvetica', 'normal');
    doc.text(fmt(anchoCm), L + 15, dy);
    doc.setFont('helvetica', 'bold');
    doc.text('CAIDA:', L + halfW + 1, dy);
    doc.setFont('helvetica', 'normal');
    doc.text(caidaTipo, L + halfW + 13, dy);

    dy += dtRH;
    doc.setFont('helvetica', 'bold');
    doc.text('ALTO:', L + 1, dy);
    doc.setFont('helvetica', 'normal');
    doc.text(fmt(altoCm), L + 12, dy);
    doc.setFont('helvetica', 'bold');
    doc.text('CAD.:', L + halfW + 1, dy);
    doc.setFont('helvetica', 'normal');
    doc.text(String(cadTexto).substring(0, 18), L + halfW + 9, dy);

    // FOOTER ───────────────────────────────────────────────────────────
    const footY = dtY + dtH + 3;
    doc.setDrawColor(160, 160, 170);
    doc.setLineWidth(0.3);
    doc.line(L, footY, PW - L, footY);
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 130);
    doc.setFont('helvetica', 'normal');
    doc.text('ROLZZO — ' + meta.ot, PW / 2, footY + 3.5, { align: 'center' });

    // ETIQUETA EXTRA — CENEFA CUADRADA ────────────────────────────────
    if (p.cenefa === 'Cuadrada') {
      const CW = 62;
      const CH = 72;
      doc.addPage([CW, CH]);

      const cL = 3;
      const cR = CW - cL;
      const mid = CW / 2;
      const pletinaCm = (anchoCm + 1).toFixed(2).replace('.', ',');
      const tipoInstal = p.instalacion || '—';
      const colorCenefa = p.color || colorAcc || '—';
      const tapaLabels: Record<string, string> = {
        SIN_TAPA: 'MURO A MURO', // legacy → muro a muro
        CON_1_TAPA: 'CON 1 TAPA',
        CON_2_TAPAS: 'CON 2 TAPAS',
        MURO_MURO: 'MURO A MURO',
      };
      const tapaTexto = (p.cenefaTapa && tapaLabels[p.cenefaTapa]) || 'MURO A MURO';

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([1.5, 1.2], 0);
      doc.rect(1, 1, CW - 2, CH - 2);
      doc.setLineDashPattern([], 0);

      doc.setTextColor(20, 20, 20);
      doc.setFont('times', 'bolditalic');
      doc.setFontSize(15);
      doc.text(meta.empresa || 'Rolzzo', cL, 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(String(meta.ot), cR, 12, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(90, 90, 90);
      doc.text('CORTINAS ROLLER A LA MEDIDA', cL, 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(40, 40, 40);
      doc.text(String(meta.cliente).toUpperCase().substring(0, 20), cR, 17, { align: 'right' });

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.25);
      doc.line(cL, 19, cR, 19);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 30, 30);
      doc.text('UBICACIÓN:', cL, 25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(String(ubicacion).substring(0, 22), cL + 2, 32);

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.2);
      doc.line(cL, 34, cR, 34);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 30, 30);
      doc.text('TIPO INSTALAC:', cL, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(String(tipoInstal).substring(0, 22), cL + 2, 45);

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.2);
      doc.line(cL, 47, cR, 47);

      doc.setFillColor(35, 35, 45);
      doc.rect(cL, 47, CW - cL * 2, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(tapaTexto, CW / 2, 53.5, { align: 'center' });

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.2);
      doc.line(cL, 56, cR, 56);

      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('ANCHO:', cL, 63);
      doc.setFont('helvetica', 'normal');
      doc.text(pletinaCm, cL + 17, 63);
      doc.setFont('helvetica', 'bold');
      doc.text('COLOR ACC:', mid + 1, 63);
      doc.setFont('helvetica', 'normal');
      doc.text(String(colorCenefa), mid + 21, 63);

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.2);
      doc.line(cL, 66, cR, 66);
    }
  });

  doc.save(`Etiquetas_${meta.ot}.pdf`);
}
