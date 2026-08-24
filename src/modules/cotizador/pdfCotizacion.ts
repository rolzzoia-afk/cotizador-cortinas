// ─────────────────────────────────────────────────────────────────────
// PDF de la COTIZACIÓN que se manda al cliente (Fase 1 / Fase 3).
//
// Réplica del documento que hasta ahora se sacaba a mano desde la planilla
// Excel (docs/referencias/CATEGORIA B-MATACARLOS COTJS-10427-1.pdf): mismo
// encabezado, misma banda de título, la tabla con DESCUENTO $ —una columna que
// la app no muestra en pantalla—, los términos numerados, el recuadro rojo de
// la categoría B, los datos para transferir y los botones con enlace.
//
// El PDF NO sigue el layout configurable de Admin → Documento: ese ordena el
// documento web. Acá el orden es el del Excel, que es lo que el cliente conoce.
//
// NINGÚN precio se recalcula: `valorUnit`, `descuento` y `total` llegan del
// motor tal cual. Lo único que se deriva es la columna DESCUENTO $, que es
// presentación pura.
//
// Módulo puro: sin React ni Supabase; recibe todo armado en `EntradaPdfCotizacion`.
// ─────────────────────────────────────────────────────────────────────

import { jsPDF } from 'jspdf';
import { formatCLP } from './calculos';
import { FILAS_TOTALES, NOTA_IVA } from './filasTotales';
import { claveTermino } from './terminos';
import {
  LOGO_ROLZZO_RATIO,
  SELLO_CUOTAS,
  SELLO_CUOTAS_RATIO,
  SELLO_TARJETAS,
  SELLO_TARJETAS_RATIO,
} from './logoRolzzo';
import type { DatosEmpresaCotizacion } from './datosEmpresaCotizacion';
import type { TotalesCotizacion, ProveedorTarjeta } from './preciosFase0';

// ── Tipos de entrada ─────────────────────────────────────────────────

export type FilaPdfCortina = {
  cod: string;
  cantidad: number;
  producto: string;
  codInt: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  colorAcc: string;
  /** Metros. */
  ancho: number;
  alto: number;
  valorUnit: number;
  /** Fracción 0–1, como la trae el motor. */
  descuento: number;
  /** El total del motor. No se recalcula. */
  total: number;
};

export type FilaPdfAdicional = {
  cod: string;
  cantidad: number;
  producto: string;
  codInt: string;
  tipo: string;
  descripcion: string;
  ubicacion?: string;
  colorAcc?: string;
  valorUnit: number;
  descuento: number;
  total: number;
  /** La fila de instalación gratis va destacada en rojo, como en el Excel. */
  destacadoRojo?: boolean;
};

export type EntradaPdfCotizacion = {
  /**
   * Folio de la cotización. NO se imprime en la banda del título: sirve para el
   * nombre del archivo y el encabezado de las páginas siguientes.
   */
  numero: string | null;
  /**
   * La línea roja de la banda: el texto libre que la vendedora escribe bajo el
   * título en la planilla («N° COTJS - 07979-5 -1 - VISITA-VERTICALES Y DUAL
   * CON CENEFA CUADRADA»). Vacío = la banda queda solo con el título, como una
   * planilla con esa celda en blanco. NO se rellena con el número de la OT:
   * es una descripción, no un folio.
   */
  otBanda: string;
  /**
   * La celda OT CLIENTE de la cabecera: SOLO el número de la OT, el tecleado o
   * el automático. El detalle va en la banda, no acá. Vacío = «N/A», como en
   * la planilla.
   */
  otCliente: string;
  /** Todas las telas son de categoría B → banda y sello propios de esa gama. */
  soloTelasB: boolean;
  /** Alguna tela es B → se dibuja el recuadro rojo de advertencia. */
  hayTelaB: boolean;
  cliente: {
    nombre: string;
    rut: string;
    mail: string;
    telefono: string;
    direccion: string;
    comuna: string;
  };
  fecha: { dia: number; mes: number; anio2: number };
  cortinas: FilaPdfCortina[];
  adicionales: FilaPdfAdicional[];
  /**
   * Aviso en rojo bajo los adicionales: el envío con cobro en destino no está
   * en el total y el cliente tiene que enterarse. Vacío = no se dibuja.
   */
  avisoEnvio?: string;
  totales: TotalesCotizacion;
  /** La lista FINAL (con el término de la tarjeta ya resuelto). */
  terminos: string[];
  proveedorTarjeta: ProveedorTarjeta;
  empresa: DatosEmpresaCotizacion;
  /** dataURL. null = se dibuja el encabezado tipográfico. */
  logoDataUrl: string | null;
};

// ── Helpers puros (testeables sin dibujar) ───────────────────────────

/**
 * El título de la banda negra. En la planilla es una celda escrita a mano:
 * «COTIZACION» en general y «LINEA PREMIUM [CATEGORIA B]» cuando la cotización
 * es de esa categoría. NO se arma con la gama de las cortinas: eso producía
 * títulos que no existen en ninguna cotización real («LINEA DELUX»).
 */
export function tituloBanda(empresa: DatosEmpresaCotizacion, soloTelasB: boolean): string {
  return soloTelasB ? empresa.banda.tituloCategoriaB : empresa.banda.titulo;
}

/** Medidas como en el Excel: 3 decimales con coma (1,460). */
export function fmtMedida3(m: number): string {
  const n = Number.isFinite(m) ? m : 0;
  return n.toFixed(3).replace('.', ',');
}

/**
 * El monto del descuento, la columna que el Excel muestra y la app no.
 * Usa la MISMA guarda de cantidad que el motor al calcular el total
 * (`Math.max(1, cantidad)`), si no una fila en 0 mostraría un descuento que no
 * cuadra con su total.
 */
export function descuentoPesos(valorUnit: number, cantidad: number, dct: number): number {
  return valorUnit * Math.max(1, cantidad) * dct;
}

/**
 * Los datos para transferir, en una sola cadena lista para pegar en el banco.
 * Es lo que se manda por el enlace del recuadro (ver `urlCopiarTransferencia`)
 * y lo que se puede seleccionar del PDF.
 */
export function textoTransferencia(tr: DatosEmpresaCotizacion['transferencia']): string {
  return [
    tr.nombre,
    [tr.tipoCuenta && `Cuenta ${tr.tipoCuenta}`, tr.banco].filter(Boolean).join(' '),
    tr.numero && `N°: ${tr.numero}`,
    tr.rut && `RUT: ${tr.rut}`,
    tr.mail && `Mail: ${tr.mail}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * A dónde lleva tocar el recuadro de los datos bancarios.
 *
 * Un PDF NO puede copiar al portapapeles —ningún visor deja que un PDF toque el
 * portapapeles, menos en el teléfono—, así que se hace lo único que un PDF sí
 * puede: abrir un enlace. Este abre WhatsApp con los datos ya escritos, de donde
 * el cliente los copia (o se los reenvía) sin teclear el número de cuenta.
 * Devuelve '' si no hay ningún dato que mandar.
 */
export function urlCopiarTransferencia(tr: DatosEmpresaCotizacion['transferencia']): string {
  const texto = textoTransferencia(tr);
  return texto ? `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}` : '';
}

/** Nombre del archivo: por folio si lo hay, si no por cliente. */
export function nombreArchivoPdf(numero: string | null, nombreCliente: string): string {
  const limpio = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  const parte = limpio(numero ?? '') || limpio(nombreCliente ?? '');
  return parte ? `Cotizacion-${parte}.pdf` : 'Cotizacion.pdf';
}

// ── Paleta y geometría ───────────────────────────────────────────────

type RGB = [number, number, number];

const NEGRO: RGB = [22, 22, 24];
const BLANCO: RGB = [255, 255, 255];
const AMARILLO: RGB = [255, 214, 0];
const AZUL: RGB = [29, 79, 145]; // el #1d4f91 del banner de cuotas en pantalla
const ROJO: RGB = [226, 32, 40];
const ROJO_SUAVE: RGB = [252, 226, 226];
const TEXTO: RGB = [25, 25, 30];
const GRIS: RGB = [110, 110, 118];
const LINEA: RGB = [140, 140, 148];
const FONDO_SUAVE: RGB = [242, 243, 245];

const MG = 8;
const ANCHO_TABLA = 194;
const PIE_PAGINA = 289;

function set(doc: jsPDF, fn: 'fill' | 'draw' | 'text', c: RGB) {
  if (fn === 'fill') doc.setFillColor(c[0], c[1], c[2]);
  else if (fn === 'draw') doc.setDrawColor(c[0], c[1], c[2]);
  else doc.setTextColor(c[0], c[1], c[2]);
}

/**
 * Texto en una caja, centrado verticalmente, que se achica para caber en una
 * línea (mismo criterio que el resto de los PDF del repo).
 */
function celda(
  doc: jsPDF,
  s: string,
  x: number,
  w: number,
  yTop: number,
  h: number,
  opts: {
    size?: number;
    bold?: boolean;
    color?: RGB;
    align?: 'l' | 'c' | 'r';
    /** Cuántas líneas se permiten antes de truncar (por defecto una). */
    lineas?: number;
  } = {},
) {
  const { bold = false, color = TEXTO, align = 'l' } = opts;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  set(doc, 'text', color);
  const maxW = w - 1.6;
  let size = opts.size ?? 6.6;
  doc.setFontSize(size);
  const txtOriginal = String(s ?? '');

  const dibujar = (t: string, yBase: number) => {
    if (align === 'c') doc.text(t, x + w / 2, yBase, { align: 'center' });
    else if (align === 'r') doc.text(t, x + w - 0.8, yBase, { align: 'right' });
    else doc.text(t, x + 0.8, yBase, { align: 'left' });
  };

  // Con varias líneas permitidas se achica menos antes de partir: es lo que
  // hace legible un rótulo largo como COLOR ACCESORIOS en 16 mm, o la OT
  // detallada del cliente.
  const maxLineas = Math.max(1, opts.lineas ?? 1);
  const minUnaLinea = maxLineas > 1 ? 5.2 : 4.2;
  let txt = txtOriginal;
  while (size > minUnaLinea && doc.getTextWidth(txt) > maxW) {
    size -= 0.2;
    doc.setFontSize(size);
  }
  if (maxLineas > 1 && doc.getTextWidth(txt) > maxW) {
    let lineas = doc.splitTextToSize(txt, maxW) as string[];
    // Si ni partido entra en las líneas permitidas, se sigue achicando: antes
    // se truncaba y la OT del cliente perdía el final.
    while (size > 4 && lineas.length > maxLineas) {
      size -= 0.2;
      doc.setFontSize(size);
      lineas = doc.splitTextToSize(txt, maxW) as string[];
    }
    lineas = lineas.slice(0, maxLineas);
    const lh = size * 0.42;
    const y1 = yTop + h / 2 + size * 0.17 - (lh * (lineas.length - 1)) / 2;
    lineas.forEach((l, i) => {
      let t = l;
      while (t.length > 1 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
      dibujar(t, y1 + i * lh);
    });
    return;
  }
  while (txt.length > 1 && doc.getTextWidth(txt) > maxW) txt = txt.slice(0, -1);
  dibujar(txt, yTop + h / 2 + size * 0.17);
}

/** Un rótulo del pie o del encabezado, con enlace si trae URL. */
function textoConEnlace(
  doc: jsPDF,
  s: string,
  x: number,
  y: number,
  url: string,
  opts: { size?: number; bold?: boolean; color?: RGB } = {},
) {
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size ?? 6.6);
  set(doc, 'text', opts.color ?? TEXTO);
  if (url) doc.textWithLink(s, x, y, { url });
  else doc.text(s, x, y);
}

// ── Tabla de la cotización ───────────────────────────────────────────

type ColPdf = { label: string; w: number; align?: 'l' | 'c' | 'r' };
type CeldaPdf = { txt: string; align?: 'l' | 'c' | 'r'; bold?: boolean; color?: RGB };
type FilaPdf = { celdas: CeldaPdf[]; fondo?: RGB };

/** Las 14 columnas del Excel. Suman los 194 mm del ancho útil. */
const COLS: ColPdf[] = [
  { label: 'COD', w: 15 },
  { label: 'CANT', w: 7, align: 'c' },
  { label: 'PRODUCTO', w: 27 },
  { label: 'COD_INT', w: 11 },
  { label: 'TIPO', w: 13 },
  { label: 'DESCRIPCIÓN', w: 20 },
  { label: 'UBIC.', w: 14 },
  { label: 'COLOR ACCESORIOS', w: 16 },
  { label: 'ANCHO', w: 10, align: 'r' },
  { label: 'ALTO', w: 10, align: 'r' },
  { label: 'VAL. UNIT.', w: 15, align: 'r' },
  { label: 'DCT%', w: 8, align: 'c' },
  // 15 mm y no 13: con menos, el rótulo se partía a mitad de palabra.
  { label: 'DESCUENTO $', w: 15, align: 'r' },
  { label: 'TOTAL', w: 13, align: 'r' },
];

/** Los anchos deben sumar el ancho útil: si no, la tabla se sale de la hoja. */
export const ANCHO_COLUMNAS = COLS.reduce((a, c) => a + c.w, 0);
export const ANCHO_UTIL = ANCHO_TABLA;

/** Los tres bloques que agrupan las columnas en la cabecera. */
const GRUPOS: Array<{ label: string; desde: number; hasta: number }> = [
  { label: 'INFORMACIÓN DEL PRODUCTO', desde: 0, hasta: 7 },
  { label: 'MEDIDAS', desde: 8, hasta: 9 },
  { label: 'PRECIO', desde: 10, hasta: 13 },
];

const ALTO_FILA = 5;
const ALTO_CAB = 4.6;

function anchoDe(desde: number, hasta: number): number {
  return COLS.slice(desde, hasta + 1).reduce((a, c) => a + c.w, 0);
}

/** Cabecera de la tabla (fila de grupos + fila de columnas). Devuelve la y final. */
function cabeceraTabla(doc: jsPDF, y: number): number {
  set(doc, 'fill', NEGRO);
  doc.rect(MG, y, ANCHO_TABLA, ALTO_CAB, 'F');
  let cx = MG;
  for (const g of GRUPOS) {
    const w = anchoDe(g.desde, g.hasta);
    set(doc, 'draw', BLANCO);
    doc.setLineWidth(0.2);
    doc.line(cx, y, cx, y + ALTO_CAB);
    celda(doc, g.label, cx, w, y, ALTO_CAB, { bold: true, color: BLANCO, align: 'c', size: 6.4 });
    cx += w;
  }
  y += ALTO_CAB;

  set(doc, 'fill', NEGRO);
  doc.rect(MG, y, ANCHO_TABLA, ALTO_CAB, 'F');
  cx = MG;
  for (const c of COLS) {
    set(doc, 'draw', LINEA);
    doc.setLineWidth(0.15);
    doc.rect(cx, y, c.w, ALTO_CAB);
    celda(doc, c.label, cx, c.w, y, ALTO_CAB, {
      bold: true,
      color: BLANCO,
      align: 'c',
      size: 5.6,
      lineas: 2,
    });
    cx += c.w;
  }
  return y + ALTO_CAB;
}

function filaTabla(doc: jsPDF, y: number, fila: FilaPdf, indice: number): number {
  const fondo = fila.fondo ?? (indice % 2 === 0 ? FONDO_SUAVE : BLANCO);
  let cx = MG;
  COLS.forEach((c, j) => {
    set(doc, 'fill', fondo);
    doc.rect(cx, y, c.w, ALTO_FILA, 'F');
    set(doc, 'draw', LINEA);
    doc.setLineWidth(0.15);
    doc.rect(cx, y, c.w, ALTO_FILA);
    const cel = fila.celdas[j];
    if (cel) {
      celda(doc, cel.txt, cx, c.w, y, ALTO_FILA, {
        align: cel.align ?? c.align ?? 'l',
        bold: cel.bold,
        color: cel.color,
        size: 6,
      });
    }
    cx += c.w;
  });
  return y + ALTO_FILA;
}

// ── Secciones ────────────────────────────────────────────────────────

type Ctx = EntradaPdfCotizacion & {
  /** Abre página nueva con el encabezado corto y devuelve la y de trabajo. */
  nuevaPagina: () => number;
};

function secEncabezado(doc: jsPDF, e: EntradaPdfCotizacion, y: number): number {
  const enc = e.empresa.encabezado;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  set(doc, 'text', TEXTO);
  doc.text(enc.titulo, MG, y + 3.5);
  doc.setFontSize(6.4);
  doc.text(enc.subtitulo, MG, y + 7);
  if (enc.web) {
    textoConEnlace(doc, enc.web, MG, y + 10.4, /^https?:|^www\./i.test(enc.web) ? (enc.web.startsWith('http') ? enc.web : `https://${enc.web}`) : '', { size: 6.2, bold: true, color: AZUL });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  set(doc, 'text', TEXTO);
  const tel = [enc.telefono && `TELÉFONO: ${enc.telefono}`, enc.rut && `RUT: ${enc.rut}`]
    .filter(Boolean)
    .join(' - ');
  if (tel) doc.text(tel, MG, y + 13.6);
  if (enc.correos) doc.text(enc.correos, MG, y + 16.6);

  // Logo a la derecha (o el encabezado tipográfico si no hay imagen).
  const altoLogo = 15;
  if (e.logoDataUrl) {
    const w = altoLogo * LOGO_ROLZZO_RATIO;
    try {
      doc.addImage(e.logoDataUrl, MG + ANCHO_TABLA - w, y, w, altoLogo);
    } catch {
      /* un logo ilegible no puede tumbar la cotización */
    }
  } else {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(22);
    set(doc, 'text', TEXTO);
    doc.text('Rolzzo', MG + ANCHO_TABLA, y + 10, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    doc.text('CORTINAS ROLLER A LA MEDIDA', MG + ANCHO_TABLA, y + 14, { align: 'right' });
  }
  return y + altoLogo + 3;
}

function secBandaTitulo(doc: jsPDF, e: EntradaPdfCotizacion, y: number): number {
  const alto = 17;
  set(doc, 'fill', NEGRO);
  doc.rect(MG, y, ANCHO_TABLA, alto, 'F');

  // A la derecha, el sello de la planilla. La píldora «12 CUOTAS SIN INTERÉS»
  // es de la categoría B: en una cotización de la A solo van las tarjetas,
  // porque esa gama financia en 6 (ver los términos de cada gama).
  const altoSello = e.soloTelasB ? 11 : 7;
  const ratio = e.soloTelasB ? SELLO_CUOTAS_RATIO : SELLO_TARJETAS_RATIO;
  const wSello = altoSello * ratio;
  const xSello = MG + ANCHO_TABLA - wSello - 3;
  try {
    doc.addImage(
      e.soloTelasB ? SELLO_CUOTAS : SELLO_TARJETAS,
      xSello,
      y + (e.soloTelasB ? (alto - altoSello) / 2 : 3),
      wSello,
      altoSello,
    );
    if (!e.soloTelasB && e.empresa.banda.leyendaTarjetas) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      set(doc, 'text', BLANCO);
      doc.text(e.empresa.banda.leyendaTarjetas, xSello + wSello / 2, y + 3 + altoSello + 2.6, {
        align: 'center',
      });
    }
  } catch {
    /* sin sello el documento igual sirve */
  }

  // El título ocupa el ancho que le deja el sello, centrado en la tabla igual
  // que en la planilla (el sello queda montado sobre el margen derecho).
  const wTitulo = ANCHO_TABLA - 2 * (wSello + 6);
  doc.setFont('helvetica', 'bold');
  set(doc, 'text', BLANCO);
  const titulo = tituloBanda(e.empresa, e.soloTelasB);
  let tam = 19;
  doc.setFontSize(tam);
  while (tam > 9 && doc.getTextWidth(titulo) > wTitulo) {
    tam -= 0.5;
    doc.setFontSize(tam);
  }
  doc.text(titulo, MG + ANCHO_TABLA / 2, y + 9.2, { align: 'center' });

  // Debajo, la OT detallada, como la escribe la vendedora en la planilla.
  const ot = e.otBanda.trim();
  if (ot) {
    set(doc, 'text', ROJO);
    let tamOt = 10;
    doc.setFontSize(tamOt);
    while (tamOt > 5 && doc.getTextWidth(ot) > wTitulo) {
      tamOt -= 0.25;
      doc.setFontSize(tamOt);
    }
    doc.text(ot, MG + ANCHO_TABLA / 2, y + 14.2, { align: 'center' });
  }
  return y + alto + 1.5;
}

function secGrillaCliente(doc: jsPDF, e: EntradaPdfCotizacion, y: number): number {
  const filas: Array<[string, string]> = [
    ['NOMBRE:', e.cliente.nombre],
    ['RUT:', e.cliente.rut],
    ['MAIL:', e.cliente.mail],
    ['TELÉFONO:', e.cliente.telefono],
    ['DIRECCIÓN:', [e.cliente.direccion, e.cliente.comuna].filter(Boolean).join(', ')],
  ];
  // El Excel deja estas celdas para llenar a mano en la visita; se respetan
  // vacías para que la vendedora las complete igual que siempre.
  const medio: Array<[string, string]> = [
    ['OT CLIENTE:', e.otCliente.trim() || 'N/A'],
    ['ESTATUS:', ''],
    ['INSTALACIÓN:', ''],
    ['FECHA INST:', ''],
    ['CONTACTO:', e.empresa.contacto.texto],
  ];
  const h = 4.8;
  const wLabelIzq = 22;
  // Los tres bloques de la cabecera, como en el Excel.
  const wIzq = 80;
  const wLabelMed = 20;
  const wMed = 58;
  const xMed = MG + wIzq;
  const xDer = xMed + wMed;
  const wDer = ANCHO_TABLA - wIzq - wMed;

  for (let i = 0; i < 5; i++) {
    const yy = y + i * h;
    // Izquierda
    set(doc, 'fill', FONDO_SUAVE);
    doc.rect(MG, yy, wLabelIzq, h, 'F');
    set(doc, 'draw', LINEA);
    doc.setLineWidth(0.15);
    doc.rect(MG, yy, wLabelIzq, h);
    doc.rect(MG + wLabelIzq, yy, wIzq - wLabelIzq, h);
    celda(doc, filas[i][0], MG, wLabelIzq, yy, h, { bold: true, size: 6.4 });
    celda(doc, filas[i][1], MG + wLabelIzq, wIzq - wLabelIzq, yy, h, { size: 6.4, align: 'c' });
    // Centro
    set(doc, 'fill', FONDO_SUAVE);
    doc.rect(xMed, yy, wLabelMed, h, 'F');
    doc.rect(xMed, yy, wLabelMed, h);
    doc.rect(xMed + wLabelMed, yy, wMed - wLabelMed, h);
    celda(doc, medio[i][0], xMed, wLabelMed, yy, h, { bold: true, size: 6.4 });
    celda(doc, medio[i][1], xMed + wLabelMed, wMed - wLabelMed, yy, h, {
      size: 6.4,
      align: 'c',
    });
  }

  // Derecha: fecha de cotización y la banda de validez.
  set(doc, 'fill', FONDO_SUAVE);
  doc.rect(xDer, y, wDer, h, 'F');
  set(doc, 'draw', LINEA);
  doc.rect(xDer, y, wDer, h);
  celda(doc, 'FECHA COTIZACIÓN', xDer, wDer, y, h, { bold: true, size: 6.4, align: 'c' });
  const wTercio = wDer / 3;
  const cabs = ['DÍA', 'MES', 'AÑO'];
  const vals = [String(e.fecha.dia), String(e.fecha.mes), String(e.fecha.anio2)];
  for (let i = 0; i < 3; i++) {
    set(doc, 'fill', FONDO_SUAVE);
    doc.rect(xDer + i * wTercio, y + h, wTercio, h, 'F');
    doc.rect(xDer + i * wTercio, y + h, wTercio, h);
    celda(doc, cabs[i], xDer + i * wTercio, wTercio, y + h, h, { bold: true, size: 6.2, align: 'c' });
    doc.rect(xDer + i * wTercio, y + h * 2, wTercio, h);
    celda(doc, vals[i], xDer + i * wTercio, wTercio, y + h * 2, h, { size: 6.4, align: 'c' });
  }
  set(doc, 'fill', ROJO);
  doc.rect(xDer, y + h * 3, wDer, h * 2, 'F');
  celda(doc, e.empresa.validez.titulo, xDer, wDer, y + h * 3, h, {
    bold: true,
    color: BLANCO,
    align: 'c',
    size: 6.6,
  });
  celda(doc, e.empresa.validez.detalle, xDer, wDer, y + h * 4, h, {
    color: BLANCO,
    align: 'c',
    size: 5.4,
  });

  return y + h * 5 + 1.5;
}

function celdasDeCortina(f: FilaPdfCortina): CeldaPdf[] {
  const dct = f.descuento > 0 ? `${Math.round(f.descuento * 100)}%` : '';
  return [
    { txt: f.cod },
    { txt: String(f.cantidad) },
    { txt: f.producto },
    { txt: f.codInt },
    { txt: f.tipo },
    { txt: f.descripcion },
    { txt: f.ubicacion },
    { txt: f.colorAcc },
    { txt: fmtMedida3(f.ancho) },
    { txt: fmtMedida3(f.alto) },
    { txt: formatCLP(f.valorUnit) },
    { txt: dct, bold: true, color: ROJO },
    { txt: f.descuento > 0 ? formatCLP(descuentoPesos(f.valorUnit, f.cantidad, f.descuento)) : '' },
    { txt: f.total > 0 ? formatCLP(f.total) : '$ -', bold: true },
  ];
}

function celdasDeAdicional(a: FilaPdfAdicional): CeldaPdf[] {
  const rojo = a.destacadoRojo ? ROJO : undefined;
  const dct = a.descuento > 0 ? `${Math.round(a.descuento * 100)}%` : '';
  return [
    { txt: a.cod, color: rojo, bold: !!rojo },
    { txt: String(a.cantidad), color: rojo, bold: !!rojo },
    { txt: a.producto, color: rojo, bold: !!rojo },
    { txt: a.codInt, color: rojo, bold: !!rojo },
    { txt: a.tipo, color: rojo, bold: !!rojo },
    { txt: a.descripcion, color: rojo, bold: !!rojo },
    { txt: a.ubicacion ?? '', color: rojo },
    { txt: a.colorAcc ?? '', color: rojo },
    { txt: '' },
    { txt: '' },
    { txt: formatCLP(a.valorUnit), color: rojo },
    { txt: dct, bold: true, color: ROJO },
    {
      txt: a.descuento > 0 ? formatCLP(descuentoPesos(a.valorUnit, a.cantidad, a.descuento)) : '',
      color: rojo,
    },
    { txt: a.total > 0 ? formatCLP(a.total) : '$ -', bold: true, color: rojo },
  ];
}

function secTabla(doc: jsPDF, ctx: Ctx, y: number): number {
  y = cabeceraTabla(doc, y);
  let i = 0;
  for (const f of ctx.cortinas) {
    if (y + ALTO_FILA > PIE_PAGINA) y = cabeceraTabla(doc, ctx.nuevaPagina());
    y = filaTabla(doc, y, { celdas: celdasDeCortina(f) }, i++);
  }

  if (ctx.adicionales.length) {
    if (y + ALTO_FILA * 2 > PIE_PAGINA) y = cabeceraTabla(doc, ctx.nuevaPagina());
    set(doc, 'fill', NEGRO);
    doc.rect(MG, y, ANCHO_TABLA, ALTO_CAB, 'F');
    celda(doc, 'ADICIONALES', MG, ANCHO_TABLA, y, ALTO_CAB, {
      bold: true,
      color: BLANCO,
      align: 'c',
      size: 6.2,
    });
    y += ALTO_CAB;
    for (const a of ctx.adicionales) {
      if (y + ALTO_FILA > PIE_PAGINA) y = cabeceraTabla(doc, ctx.nuevaPagina());
      y = filaTabla(
        doc,
        y,
        { celdas: celdasDeAdicional(a), fondo: a.destacadoRojo ? ROJO_SUAVE : undefined },
        i++,
      );
    }
  }

  // El envío con cobro en destino no suma al total: sin este aviso el cliente
  // cree que el flete está incluido.
  const aviso = (ctx.avisoEnvio ?? '').trim();
  if (aviso) {
    if (y + ALTO_FILA > PIE_PAGINA) y = cabeceraTabla(doc, ctx.nuevaPagina());
    set(doc, 'fill', ROJO_SUAVE);
    doc.rect(MG, y, ANCHO_TABLA, ALTO_FILA, 'F');
    set(doc, 'draw', LINEA);
    doc.setLineWidth(0.15);
    doc.rect(MG, y, ANCHO_TABLA, ALTO_FILA);
    celda(doc, aviso, MG, ANCHO_TABLA, y, ALTO_FILA, {
      bold: true,
      color: ROJO,
      align: 'c',
      size: 6.4,
    });
    y += ALTO_FILA;
  }
  return y + 2;
}

/** El recuadro de totales. Devuelve la y a la que llega. */
function secTotales(doc: jsPDF, e: EntradaPdfCotizacion, y: number): number {
  const w = 72;
  const x = MG + ANCHO_TABLA - w;
  const h = 6;
  let yy = y;
  for (const f of FILAS_TOTALES) {
    if (f.separadorAntes) {
      set(doc, 'draw', LINEA);
      doc.setLineWidth(0.2);
      doc.line(x, yy, x + w, yy);
    }
    if (f.fuerte) {
      set(doc, 'fill', NEGRO);
      doc.rect(x, yy, w, h, 'F');
    }
    celda(doc, f.label, x + 1, w - 2, yy, h, {
      bold: true,
      size: f.fuerte ? 7.6 : 7,
      color: f.fuerte ? BLANCO : TEXTO,
    });
    celda(doc, formatCLP(f.valor(e.totales)), x + 1, w - 2, yy, h, {
      bold: true,
      align: 'r',
      size: f.fuerte ? 8.6 : 7.6,
      color: f.fuerte ? BLANCO : TEXTO,
    });
    yy += h;
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  set(doc, 'text', GRIS);
  doc.text(NOTA_IVA, x + w, yy + 3, { align: 'right' });
  return yy + 5;
}

/**
 * Los términos numerados. Van a la IZQUIERDA del recuadro de totales mientras
 * este dure (como en el Excel) y después ocupan el ancho completo.
 */
function secTerminos(doc: jsPDF, ctx: Ctx, y: number, yFinTotales: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  set(doc, 'text', TEXTO);
  doc.text('TÉRMINOS Y CONDICIONES GENERALES:', MG, y + 3);
  let yy = y + 5.5;

  const size = 5.9;
  const alturaLinea = 2.35;
  const xNum = MG + 2;
  const xTxt = MG + 9;
  const anchoAngosto = ANCHO_TABLA - 78 - 9;
  const anchoAncho = ANCHO_TABLA - 9;

  // El chip «VER EJEMPLO» del Excel acompaña al término de las ondas de la
  // tela. Se busca por «ONDA» porque la categoría A y la B lo redactan distinto
  // (zuncho y corchete sobre 2 m vs. corte en "V" sobre 1,90 m).
  const idxEjemplo = ctx.terminos.findIndex((t) => claveTermino(t).includes('ONDA'));

  ctx.terminos.forEach((t, i) => {
    const ancho = yy < yFinTotales ? anchoAngosto : anchoAncho;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const lineas = doc.splitTextToSize(t, ancho) as string[];
    const alto = lineas.length * alturaLinea;
    if (yy + alto > PIE_PAGINA) yy = ctx.nuevaPagina();
    doc.setFont('helvetica', 'bold');
    set(doc, 'text', TEXTO);
    doc.text(`${i + 1}.`, xNum, yy + 2);
    doc.setFont('helvetica', 'normal');
    lineas.forEach((l, j) => doc.text(l, xTxt, yy + 2 + j * alturaLinea));
    if (i === idxEjemplo && ctx.empresa.urlEjemploOnda) {
      // Va pegado al final del término, no en una columna fija: con el ancho
      // completo un x calculado sobre el margen derecho se salía de la hoja.
      const wChip = 22;
      const hChip = 4;
      doc.setFontSize(size);
      const anchoUltima = doc.getTextWidth(lineas[lineas.length - 1] ?? '');
      const xChip = Math.min(
        xTxt + anchoUltima + 3,
        MG + ANCHO_TABLA - wChip,
      );
      const yChip = yy + (lineas.length - 1) * alturaLinea - 0.6;
      set(doc, 'fill', FONDO_SUAVE);
      set(doc, 'draw', LINEA);
      doc.setLineWidth(0.2);
      doc.roundedRect(xChip, yChip, wChip, hChip, 0.8, 0.8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.6);
      set(doc, 'text', TEXTO);
      doc.text('VER EJEMPLO', xChip + wChip / 2, yChip + 2.7, { align: 'center' });
      doc.link(xChip, yChip, wChip, hChip, { url: ctx.empresa.urlEjemploOnda });
    }
    yy += alto + 0.3;
  });
  return yy + 1.5;
}

function secImportante(doc: jsPDF, e: EntradaPdfCotizacion, y: number): number {
  const cx = MG + ANCHO_TABLA / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  set(doc, 'text', TEXTO);
  doc.text('IMPORTANTE', cx, y + 4, { align: 'center' });
  // Helvetica no trae el signo de advertencia: se dibuja, UNO solo y a la
  // izquierda del rótulo. Ojo: en PDF el texto se pinta con el color de
  // RELLENO, así que el relleno se fija JUSTO antes del triángulo — dibujarlo
  // después de un texto oscuro lo dejaba negro.
  const dx = -16;
  set(doc, 'fill', AMARILLO);
  doc.triangle(cx + dx, y + 0.8, cx + dx - 2.6, y + 5, cx + dx + 2.6, y + 5, 'F');
  doc.setFontSize(4.6);
  set(doc, 'text', TEXTO);
  doc.text('!', cx + dx, y + 4.2, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  set(doc, 'text', TEXTO);
  doc.text('Favor revisar antes de aprobar cualquier cotización', cx, y + 7.8, { align: 'center' });
  void e;
  return y + 10;
}

function secBloqueB(doc: jsPDF, e: EntradaPdfCotizacion, y: number): number {
  if (!e.hayTelaB) return y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const lineas = doc.splitTextToSize(e.empresa.bloqueCategoriaB.texto, ANCHO_TABLA - 12) as string[];
  const alto = lineas.length * 3 + 5;
  set(doc, 'fill', ROJO);
  doc.rect(MG, y, ANCHO_TABLA, alto, 'F');
  set(doc, 'text', BLANCO);
  lineas.forEach((l, i) =>
    doc.text(l, MG + ANCHO_TABLA / 2, y + 4 + i * 3, { align: 'center' }),
  );
  return y + alto + 2;
}

function secPie(doc: jsPDF, e: EntradaPdfCotizacion, y: number): number {
  const alto = 34;
  const tr = e.empresa.transferencia;

  // Izquierda: datos para transferir.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  set(doc, 'text', TEXTO);
  doc.text(tr.titulo, MG, y + 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  const intro = doc.splitTextToSize(tr.intro, 74) as string[];
  intro.forEach((l, i) => doc.text(l, MG, y + 6.4 + i * 2.4));
  let yy = y + 6.4 + intro.length * 2.4 + 1;
  const campos: Array<[string, string]> = [
    ['Nombre:', tr.nombre],
    ['Tipo de cuenta:', tr.tipoCuenta],
    ['Banco:', tr.banco],
    ['RUT:', tr.rut],
    ['N°:', tr.numero],
    ['Mail:', tr.mail],
  ];
  doc.setFontSize(6);
  for (const [k, v] of campos) {
    doc.setFont('helvetica', 'bold');
    doc.text(k, MG, yy);
    const wk = doc.getTextWidth(k);
    doc.setFont('helvetica', 'normal');
    doc.text(v, MG + wk + 1, yy);
    yy += 2.7;
  }

  // Tocar el recuadro abre WhatsApp con los datos escritos: es la única forma
  // que tiene un PDF de entregar el número de cuenta sin que el cliente lo
  // teclee (copiar al portapapeles no se puede desde un PDF).
  const urlCopiar = urlCopiarTransferencia(tr);
  if (urlCopiar) {
    const wCaja = 78;
    const yCaja = y + 0.5;
    const hCaja = yy - yCaja - 1;
    set(doc, 'draw', LINEA);
    doc.setLineWidth(0.2);
    doc.roundedRect(MG - 1.5, yCaja, wCaja, hCaja, 1, 1);
    doc.link(MG - 1.5, yCaja, wCaja, hCaja, { url: urlCopiar });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.4);
    set(doc, 'text', AZUL);
    // Sin símbolos raros: helvetica en jsPDF codifica WinAnsi y un carácter
    // fuera de esa tabla sale como basura.
    doc.textWithLink('> TOCA ESTE RECUADRO PARA COPIAR LOS DATOS', MG, yy + 1.6, {
      url: urlCopiar,
    });
    yy += 3;
  }

  // Centro: el mismo sello que la banda, para que el pie no prometa 12 cuotas
  // en una cotización que en sus términos financia en 6.
  const xCentro = MG + 82;
  const altoSello = e.soloTelasB ? 22 : 12;
  const wSello = altoSello * (e.soloTelasB ? SELLO_CUOTAS_RATIO : SELLO_TARJETAS_RATIO);
  try {
    doc.addImage(
      e.soloTelasB ? SELLO_CUOTAS : SELLO_TARJETAS,
      xCentro + (52 - wSello) / 2,
      y + 3 + (e.soloTelasB ? 0 : 5),
      wSello,
      altoSello,
    );
  } catch {
    /* sin sello, el pie igual queda completo */
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  set(doc, 'text', GRIS);
  doc.text(
    e.proveedorTarjeta === 'flow'
      ? `${e.empresa.banda.leyendaTarjetas} (Flow)`
      : e.empresa.banda.leyendaTarjetas,
    xCentro + 26,
    y + 3 + (e.soloTelasB ? 22 : 17) + 3,
    { align: 'center' },
  );

  // Derecha: los botones con enlace.
  const xBoton = MG + 138;
  const wChip = 24;
  const hChip = 6.5;
  const xChip = MG + ANCHO_TABLA - wChip;
  // Lo que le queda al rótulo antes del botón: el de «VISITA AL SHOWROOM» se
  // montaba encima cuando se dibujaba a tamaño fijo.
  const wRotulo = xChip - xBoton - 2;
  e.empresa.botones.forEach((b, i) => {
    const yb = y + i * 11;
    celda(doc, `> ${b.etiqueta}`, xBoton, wRotulo, yb, 4.6, { bold: true, size: 6.8 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    set(doc, 'text', GRIS);
    const nota = doc.splitTextToSize(b.nota, wRotulo) as string[];
    nota.slice(0, 2).forEach((l, j) => doc.text(l, xBoton, yb + 6 + j * 2.2));
    set(doc, 'fill', NEGRO);
    doc.roundedRect(xChip, yb, wChip, hChip, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    set(doc, 'text', BLANCO);
    doc.text(b.accion, xChip + wChip / 2, yb + 4.2, { align: 'center' });
    if (b.url) doc.link(xChip, yb, wChip, hChip, { url: b.url });
  });

  return y + alto + 1;
}

function secBandaFinal(doc: jsPDF, e: EntradaPdfCotizacion, y: number): number {
  const alto = 7;
  set(doc, 'fill', ROJO);
  doc.rect(MG, y, ANCHO_TABLA, alto, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  set(doc, 'text', BLANCO);
  doc.text(e.empresa.bandaFinal.titulo, MG + ANCHO_TABLA / 2, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  set(doc, 'text', TEXTO);
  const nota = doc.splitTextToSize(e.empresa.bandaFinal.nota, ANCHO_TABLA - 6) as string[];
  nota.forEach((l, i) =>
    doc.text(l, MG + ANCHO_TABLA / 2, y + alto + 2.4 + i * 2.2, { align: 'center' }),
  );
  return y + alto + 2.4 + nota.length * 2.2;
}

/**
 * Lo que mide el cierre del documento con ESTE texto: se calcula midiendo el
 * envoltorio real del bloque B y de la nota final, para no mandar a una página
 * nueva un cierre que cabía por un par de milímetros.
 */
function altoCierre(doc: jsPDF, e: EntradaPdfCotizacion): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const lineasB = e.hayTelaB
    ? (doc.splitTextToSize(e.empresa.bloqueCategoriaB.texto, ANCHO_TABLA - 12) as string[]).length
    : 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  const lineasNota = (doc.splitTextToSize(e.empresa.bandaFinal.nota, ANCHO_TABLA - 6) as string[])
    .length;
  const altoB = e.hayTelaB ? lineasB * 3 + 5 + 2 : 0;
  return 10 + altoB + 35 + (7 + 2.4 + lineasNota * 2.2);
}

// ── Entrada pública ──────────────────────────────────────────────────

/** Arma el PDF de la cotización y lo descarga. */
export function generarPdfCotizacion(entrada: EntradaPdfCotizacion): void {
  const doc = new jsPDF('p', 'mm', 'a4'); // 210 × 297

  const encabezadoCorto = (): number => {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    set(doc, 'text', TEXTO);
    const titulo = tituloBanda(entrada.empresa, entrada.soloTelasB);
    doc.text(entrada.numero ? `${titulo} — ${entrada.numero}` : titulo, MG, MG + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    set(doc, 'text', GRIS);
    doc.text(`Página ${doc.getNumberOfPages()}`, MG + ANCHO_TABLA, MG + 3, { align: 'right' });
    set(doc, 'draw', LINEA);
    doc.setLineWidth(0.2);
    doc.line(MG, MG + 5, MG + ANCHO_TABLA, MG + 5);
    return MG + 7;
  };

  const ctx: Ctx = { ...entrada, nuevaPagina: encabezadoCorto };

  let y = MG;
  y = secEncabezado(doc, entrada, y);
  y = secBandaTitulo(doc, entrada, y);
  y = secGrillaCliente(doc, entrada, y);
  y = secTabla(doc, ctx, y);

  const yAntesTotales = y;
  const yFinTotales = secTotales(doc, entrada, yAntesTotales);
  y = secTerminos(doc, ctx, yAntesTotales, yFinTotales);
  if (y < yFinTotales) y = yFinTotales;

  // El cierre (importante + bloque B + pie + banda) va junto: si no cabe
  // entero, se pasa a la página siguiente en vez de partirse. El alto se MIDE
  // —no se estima— porque el bloque B y la nota final envuelven según su texto,
  // y una estimación de más mandaba a la página 2 un cierre que sí cabía.
  if (y + altoCierre(doc, entrada) > PIE_PAGINA) y = ctx.nuevaPagina();
  y = secImportante(doc, entrada, y);
  y = secBloqueB(doc, entrada, y);
  y = secPie(doc, entrada, y);
  secBandaFinal(doc, entrada, y);

  doc.save(nombreArchivoPdf(entrada.numero, entrada.cliente.nombre));
}
