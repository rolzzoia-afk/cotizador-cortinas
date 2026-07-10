// ─────────────────────────────────────────────────────────────────────
// PDF "INVENTARIO — ENTREGA Y RECEPCIÓN DE MATERIAL"
//
// Hoja de bodega que se entrega con la OT. Cuatro bloques:
//   1. Detalle por cortina (identidad: producto/tipo/mecanismo/tubería/
//      accionamiento/peso cadena/ubic/medidas, con descripciones completas)
//      — reusa la identidad del Cálculo general (mismo motor de datos).
//   2. INSUMOS: consolidados con cantidad/adicional/total — manillas, tapas de
//      peso, tornillos, brackets, tarugos de vulcanita y kit de motor (códigos
//      DOM). Solo se imprime si la OT lleva algún insumo.
//   3. ETIQUETAS ROLZZO: una fila por código según color de accesorios
//      (blancos/grises → INS 95-1 blanca; resto → INS 95 negra), 1 por paño.
//   4. NOTAS DE TERRENO: lo que el vendedor anotó en Fase 2 (retiro,
//      material de instalación, cortes, suplementos, comentarios) por
//      ubicación — solo se imprime si alguna cortina tiene notas.
//
// Lógica pura salvo `generarPdfInventario`, que dibuja con jsPDF.
// ─────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import type { Ventana, CatalogoProductos } from '@/modules/cotizador/types';
import type { VentanaItem } from '@/modules/ots/types';
import { ubicPanoVentana } from '@/modules/descuentos/adicionales-cenefa';
import { construirCalculoGeneral, type FilaCalculo } from './pdfCalculoGeneral';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import { construirEtiquetas, type EtiquetaLinea } from './inventario';
import { COD_PESO_AUTO, descripcionCadenaInventario, textoPesoCadenaInventario } from './cadenas';
import { esCenefaCuadrada, OPCIONES_MECANISMO_RESOLUCION } from './fase2';
import {
  categoriaRequiereMecanismo,
  mecanismoParaPano,
  numeroMecDeChip,
} from '@/modules/descuentos/chips';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';
import {
  COD_HUB_DOMOTICA,
  NOMBRE_HUB_DOMOTICA,
  insumosDePano,
  insumosMotorDePano,
  panoLlevaDomotica,
} from './insumosCortina';

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
  ubic: string;
  anchoMts: string;
  altoMts: string;
};

export type NotaTerreno = { ubic: string; notas: string };

/** Grupo de la tabla de insumos: producción (taller) o instalación (terreno). */
export type GrupoInsumo = 'PRODUCCION' | 'INSTALACION';

/** Insumo consolidado para la tabla de entrega de material (manillas, tapas de
 *  peso, tornillos, brackets, tarugos, motor…). `codigo` opcional (manillas y
 *  tapas de cenefa no tienen insumo con código). */
export type InsumoConsolidado = {
  id: number;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  grupo: GrupoInsumo;
};

export type Inventario = {
  filas: FilaInventario[];
  /** Insumos consolidados de la OT (manillas + tapas/tornillos/brackets/tarugos/motor). */
  insumos: InsumoConsolidado[];
  /** Etiquetas por código según color de accesorios (blancos → INS 95-1). */
  etiquetas: EtiquetaLinea[];
  /** Notas de terreno de Fase 2, una fila por paño con algo anotado. */
  notas: NotaTerreno[];
};

const mts3 = (n: number) => n.toFixed(3).replace('.', ',');

/**
 * Manillas consolidadas por color desde las filas del Cálculo General.
 * `f.manillas` viene como "9 CAFÉ" → { descripcion: "MANILLA CAFÉ", cantidad: 9 }.
 */
export function consolidarManillas(filas: FilaCalculo[]): { descripcion: string; cantidad: number }[] {
  const acc = new Map<string, number>();
  for (const f of filas) {
    const m = (f.manillas || '').trim();
    if (!m) continue;
    const [, cant, color] = m.match(/^(\d+)\s*(.*)$/) || [];
    const n = parseInt(cant || '', 10);
    if (!n) continue;
    const k = `MANILLA ${(color || '').trim()}`.trim();
    acc.set(k, (acc.get(k) || 0) + n);
  }
  return [...acc.entries()].map(([descripcion, cantidad]) => ({ descripcion, cantidad }));
}

/**
 * Grupo de un insumo: PRODUCCIÓN (se arma en el taller) = tapas, tornillos de
 * tapas (TOR02), cadenas (CAD), peso de cadena (PCA) y mecanismos de cenefa
 * ovalada. INSTALACIÓN (terreno) = todo lo demás: brackets, tarugos, suplementos,
 * motor (DOM), manillas y los mecanismos simples/reforzados/dual/63 mm.
 */
function grupoInsumo(codigo: string | undefined, descripcion: string): GrupoInsumo {
  const c = (codigo || '').toUpperCase();
  const d = descripcion.toUpperCase();
  if (c.startsWith('TAP')) return 'PRODUCCION';
  if (c === 'TOR02') return 'PRODUCCION';
  if (c.startsWith('CAD') || c.startsWith('PCA')) return 'PRODUCCION';
  if (c.startsWith('MEC')) return d.includes('OVALADA') ? 'PRODUCCION' : 'INSTALACION';
  if (!c && d.includes('TAPA CENEFA CUADRADA')) return 'PRODUCCION';
  return 'INSTALACION';
}

/**
 * Todos los insumos de la OT consolidados para la hoja de inventario, ya
 * clasificados en PRODUCCIÓN / INSTALACIÓN: manillas (por color), tapas de peso,
 * tornillos, brackets, tarugos, suplementos, mecanismos, cadenas, peso de cadena
 * y el kit de motor (códigos DOM). La domótica agrega 1× DOM43 por OT.
 */
export function consolidarInsumos(ventanas: Ventana[], filas: FilaCalculo[]): InsumoConsolidado[] {
  const acc = new Map<string, { codigo?: string; descripcion: string; cantidad: number; grupo: GrupoInsumo }>();
  const bump = (codigo: string | undefined, descripcion: string, cantidad: number) => {
    const key = codigo || descripcion;
    const prev = acc.get(key);
    if (prev) prev.cantidad += cantidad;
    else acc.set(key, { codigo, descripcion, cantidad, grupo: grupoInsumo(codigo, descripcion) });
  };
  let llevaDomotica = false;
  for (const v of ventanas) {
    const modelo = (v.modelo as ModeloDespiece | null | undefined) ?? null;
    for (const p of v.panos || []) {
      const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
      const tieneMotor = !!(p.motorModelo || p.motorTipo) || (v.categoria || '').toUpperCase().includes('MOTOR');

      // Mecanismo + cadena + peso (producción): solo roller manual con mecanismo.
      if (!tieneMotor && categoriaRequiereMecanismo(v.categoria)) {
        const chip = mecanismoParaPano(p, v.color, modelo, OPCIONES_MECANISMO_RESOLUCION, v.categoria, anchoM);
        const num = numeroMecDeChip(chip);
        if (chip && num != null) {
          const cod = `MEC${String(num).padStart(2, '0')}`;
          bump(cod, `[${cod}] ${chip}`, 1);
        }
        if (p.codCadena) bump(p.codCadena.toUpperCase(), descripcionCadenaInventario(p), 1);
        // El peso de cadena es fijo (PCA04, transparente) para toda cortina de
        // cadena: se emite SIEMPRE, aunque el paño no lo tenga guardado — igual
        // que el mecanismo, que se resuelve en vivo. Si en Fase 2 se eligió otro
        // peso, se respeta.
        const cp = (p.codPeso || COD_PESO_AUTO).replace(/\s+/g, '').toUpperCase();
        bump(cp, `[${cp}] ${textoPesoCadenaInventario({ codPeso: cp })}`.trim(), 1);
      }

      for (const ins of insumosDePano(p, { categoria: v.categoria, ventanaColor: v.color, anchoM })) {
        bump(ins.codigo, `[${ins.codigo}] ${ins.descripcion}`, ins.cantidad);
      }
      const motorInsumos = insumosMotorDePano(p, v.categoria);
      if (motorInsumos.length > 0) {
        for (const ins of motorInsumos) {
          bump(ins.codigo, `[${ins.codigo}] ${ins.descripcion}`, ins.cantidad);
        }
      } else if (p.motorModelo || p.motorTipo) {
        // Motor legacy o 'CABLE' futuro (sin código DOM): línea genérica, para que
        // el motor no se pierda de la hoja de entrega (el BOM también lo lista así).
        const etiqueta = (p.motorTipo || (p.motorModelo === 'CABLE' ? 'CON CABLE' : '')).trim();
        bump(undefined, etiqueta ? `MOTOR ${etiqueta}` : 'MOTOR', 1);
      }
      if (panoLlevaDomotica(p)) llevaDomotica = true;
      // Tapa de cenefa cuadrada (sin código de insumo): 1 o 2 según cenefaTapa.
      if (esCenefaCuadrada(p.cenefa)) {
        const n = p.cenefaTapa === 'CON_2_TAPAS' ? 2 : p.cenefaTapa === 'CON_1_TAPA' ? 1 : 0;
        if (n > 0) bump(undefined, `TAPA CENEFA CUADRADA ${p.colorTapa || ''}`.trim(), n);
      }
    }
  }
  if (llevaDomotica) bump(COD_HUB_DOMOTICA, `[${COD_HUB_DOMOTICA}] ${NOMBRE_HUB_DOMOTICA}`, 1);

  const out: InsumoConsolidado[] = [];
  let id = 0;
  // Manillas primero (instalación), luego el resto de insumos ya clasificados.
  for (const m of consolidarManillas(filas)) {
    out.push({ id: ++id, descripcion: m.descripcion, cantidad: m.cantidad, grupo: 'INSTALACION' });
  }
  for (const it of acc.values()) {
    out.push({ id: ++id, codigo: it.codigo, descripcion: it.descripcion, cantidad: it.cantidad, grupo: it.grupo });
  }
  return out;
}

/**
 * Notas de terreno anotadas en Fase 2, por paño. Concatena con rótulos solo
 * los campos con contenido real ('Nada' y 'N/A' cuentan como vacío). Si nadie
 * anotó nada, devuelve [] y el bloque no se imprime.
 */
export function notasTerreno(ventanas: Ventana[]): NotaTerreno[] {
  const out: NotaTerreno[] = [];
  for (const v of ventanas) {
    const panos = v.panos || [];
    panos.forEach((p, i) => {
      const partes: string[] = [];
      const retiro = Number(p.retiro) || 0;
      if (retiro > 0) partes.push(`Retiro: ${retiro}`);
      const material = [p.superficie, p.materialTipo].filter(Boolean).join(' / ');
      if (material) partes.push(`Material: ${material}`);
      if (p.cortes && p.cortes !== 'Nada') partes.push(`Cortes: ${p.cortes}`);
      if (p.verVideo) partes.push('Ver video de terreno');
      if (p.relacionMarco && p.relacionMarco !== 'N/A') partes.push(`Marco: ${p.relacionMarco}`);
      if (p.cotizarConSin) partes.push(`Cotizar con y sin: ${p.cotizarConSin}`);
      if (p.suplementos) partes.push(`Suplementos: ${p.suplementos}`);
      // Campo legado (hoy el dúo usa cierreAlturaCm): se imprime si venía escrito.
      if (p.alturaCierre) partes.push(`Cerrada a altura de: ${p.alturaCierre}`);
      if (p.comentarioFinal) partes.push(`Nota: ${p.comentarioFinal}`);
      if (partes.length === 0) return;
      out.push({
        ubic: ubicPanoVentana(v.ubicacion || '', i, panos.length),
        notas: partes.join(' · '),
      });
    });
  }
  return out;
}

/** Construye los datos de la hoja INVENTARIO para las ventanas de una OT. */
export function construirInventario(
  ventanas: Ventana[],
  catalogo: CatalogoProductos = {},
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): Inventario {
  const { filas } = construirCalculoGeneral(ventanas, catalogo, params);
  const filasInv: FilaInventario[] = filas.map((f, i) => ({
    id: i + 1,
    producto: f.producto,
    tipo: f.tipoRol,
    codMecanismo: f.codMecanismo,
    // f.tuberia ya llega con la descripción larga desde el Cálculo General.
    tuberia: f.tuberia,
    adicional: '0',
    // Descripción larga de la cadena ("[CAD05] CADENA INFINITA 4 METROS GRIS").
    accionamiento: f.codCadena ? descripcionCadenaInventario(f) : f.accionamiento,
    // Peso de cadena SOLO si se eligió un insumo en Fase 2 (codPeso). Sin peso
    // la celda queda vacía (antes mostraba el color de accesorios, ej. "GRIS").
    pesoCadena: f.codPeso
      ? `[${f.codPeso.replace(/\s+/g, '').toUpperCase()}] ${textoPesoCadenaInventario({ codPeso: f.codPeso })}`.trim()
      : '',
    ubic: f.ubic,
    anchoMts: mts3(f.anchoMts),
    altoMts: mts3(f.altoMts),
  }));
  return {
    filas: filasInv,
    insumos: consolidarInsumos(ventanas, filas),
    etiquetas: construirEtiquetas(ventanas as unknown as VentanaItem[]),
    notas: notasTerreno(ventanas),
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
  const minUnaLinea = wrap ? 8 : 4;
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
  const headH = opts.headH ?? 11;
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
): void {
  const data = construirInventario(ventanas, catalogo, params);
  if (data.filas.length === 0) {
    throw new Error('No hay cortinas en la OT.');
  }

  const doc = new jsPDF('l', 'mm', 'a4'); // 297 × 210
  const W = doc.internal.pageSize.getWidth();
  const mg = 8;
  const usable = W - mg * 2;

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

  // ── INSUMOS: dos tablas (PRODUCCIÓN / INSTALACIÓN) consolidadas + entrega.
  // La antigua tabla "detalle por cortina" se eliminó (pedido #20). Cada tabla
  // se imprime solo si tiene filas; el título salta con su cabecera y ≥1 fila.
  const titH = 9;
  const bloqueInsumos = (titulo: string, items: InsumoConsolidado[]) => {
    if (items.length === 0) return;
    y += 7;
    if (y + titH + 22 > BOTTOM) y = salto.onBreak();
    doc.setFillColor(C_BLUE[0], C_BLUE[1], C_BLUE[2]);
    doc.rect(mg, y, usable, titH, 'F');
    doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(titulo, mg + 2, y + titH / 2 + 2);
    doc.setFontSize(8.5);
    doc.text('ENTREGADO POR:', mg + usable * 0.5, y + titH / 2 + 2);
    y += titH;

    const w2 = [8, 70, 20, 20, 18, 28, 28, 28, 30];
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
      { label: 'FECHA', align: 'c' },
      { label: 'PERSONA QUE RECIBE' },
    ].map((c, i) => ({ ...c, w: w2[i] * sc2 }) as Col);
    const rows2 = items.map((m, i) => [
      String(i + 1),
      m.descripcion,
      String(m.cantidad),
      '',
      String(m.cantidad),
      '',
      '',
      '',
      '',
    ]);
    y = tabla(doc, mg, y, cols2, rows2, { rowH: 11.5, greenCol: 4, salto });
  };
  bloqueInsumos('INSUMOS DE PRODUCCIÓN', data.insumos.filter((m) => m.grupo === 'PRODUCCION'));
  bloqueInsumos('INSUMOS DE INSTALACIÓN', data.insumos.filter((m) => m.grupo === 'INSTALACION'));

  // ── BLOQUE 3: ETIQUETAS ROLZZO ─────────────────────────────────────
  y += 7;
  if (y + titH + 22 > BOTTOM) y = salto.onBreak();
  doc.setFillColor(C_GREEN[0], C_GREEN[1], C_GREEN[2]);
  doc.rect(mg, y, usable, titH, 'F');
  doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ETIQUETAS ROLZZO', mg + 2, y + titH / 2 + 2);
  doc.setFontSize(8.5);
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
  y = tabla(doc, mg, y, cols3, rows3, { rowH: 11.5, greenCol: 2, salto });

  // ── BLOQUE 3: NOTAS DE TERRENO (solo si alguien anotó algo en Fase 2) ─
  if (data.notas.length > 0) {
    y += 7;
    if (y + titH + 22 > BOTTOM) y = salto.onBreak();
    doc.setFillColor(C_DARK[0], C_DARK[1], C_DARK[2]);
    doc.rect(mg, y, usable, titH, 'F');
    doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('NOTAS DE TERRENO', mg + 2, y + titH / 2 + 2);
    doc.setFontSize(8.5);
    doc.text('ANOTADO EN FASE 2', mg + usable * 0.5, y + titH / 2 + 2);
    y += titH;

    const w4 = [55, 226];
    const sum4 = w4.reduce((a, b) => a + b, 0);
    const sc4 = usable / sum4;
    const cols4: Col[] = [
      { label: 'UBICACIÓN' },
      { label: 'NOTAS' },
    ].map((c, i) => ({ ...c, w: w4[i] * sc4 }) as Col);
    const rows4 = data.notas.map((n) => [n.ubic, n.notas]);
    y = tabla(doc, mg, y, cols4, rows4, { rowH: 11.5, salto });
  }

  doc.save(`Inventario_${meta.ot}.pdf`);
}
