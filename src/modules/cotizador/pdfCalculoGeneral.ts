// ─────────────────────────────────────────────────────────────────────
// PDF de la hoja CÁLCULO GENERAL / DIMENSIONADO.
//
// Acá vive SOLO el dibujo: cuánto mide cada columna, dónde parte una página
// y cómo se encoge un rótulo largo. Qué dice cada celda lo decide
// `calculoGeneral.ts`, que es puro y lo comparte con la pantalla del taller.
// Se re-exporta entero para no romper a quien ya importaba desde acá.
// ─────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import {
  aplicarVariante,
  COLUMNA_COD_VELCRO,
  construirCalculoGeneral,
  seccionesDeHoja,
  textoDespiece,
  textoIdentidad,
  VARIANTE_CALCULO_GENERAL,
  VARIANTE_DIMENSIONADO,
  type ColumnaCalculo,
  type JuntoPieza,
  type RGB,
  type VarianteHojaCalculo,
} from './calculoGeneral';
import type { Ventana, CatalogoProductos } from '@/modules/cotizador/types';
import type { ReglasSeleccion } from '@/modules/descuentos/reglasSeleccion';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';

export * from './calculoGeneral';

// ── Render PDF ───────────────────────────────────────────────────────
export type MetaCalculo = { ot: string; cliente?: string };

const C_DARK: RGB = [60, 60, 66];
const C_WHITE: RGB = [255, 255, 255];
const C_LINE: RGB = [150, 150, 158];

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
 * Envuelve una etiqueta en varias líneas que caben en `maxW`, quebrando por
 * espacios y por "/". `medir(s)` da el ancho del texto (mm). Se usa para las
 * cabeceras: mantienen el tamaño fijo (como "TUBERIA") y bajan de línea en vez
 * de encogerse. Puro y testeable (medidor inyectable).
 */
export function envolverEtiqueta(
  medir: (s: string) => number,
  label: string,
  maxW: number,
): string[] {
  const tokens = label
    .split(/\s+/)
    .flatMap((w) => {
      const partes = w.split('/');
      return partes.map((p, i) => (i < partes.length - 1 ? `${p}/` : p));
    })
    .filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const t of tokens) {
    const sep = !cur || cur.endsWith('/') ? '' : ' ';
    const probe = `${cur}${sep}${t}`;
    if (!cur || medir(probe) <= maxW) cur = probe;
    else {
      lines.push(cur);
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [label];
}

/**
 * Cabecera de columna a tamaño FIJO (9, el de "TUBERIA"), envuelta en varias
 * líneas si no cabe — para que todas las cabeceras luzcan igual, en vez de que
 * `celda` encoja las etiquetas largas.
 */
function celdaCabecera(doc: jsPDF, label: string, x: number, w: number, yTop: number, h: number) {
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
  const maxW = w - 1.4;
  let size = 9;
  doc.setFontSize(size);
  let lines = envolverEtiqueta((s) => doc.getTextWidth(s), label, maxW);
  // Palabra sola que no cabe (ej. "ACCESORIOS"/"COD_IN" en columnas angostas):
  // achica la fuente de la cabecera hasta que entre — nunca recorta.
  while (size > 6 && lines.some((ln) => doc.getTextWidth(ln) > maxW)) {
    size -= 0.5;
    doc.setFontSize(size);
    lines = envolverEtiqueta((s) => doc.getTextWidth(s), label, maxW);
  }
  const lineH = size * 0.39;
  let y = yTop + (h - lines.length * lineH) / 2 + size * 0.28;
  for (const ln of lines) {
    doc.text(ln, x + w / 2, y, { align: 'center' });
    y += lineH;
  }
}

/** Columnas numéricas propias del beeblack (con sufijo (ANCHO)/(ALTO)). */
const COLS_NUM_BEEBLACK = new Set([
  'PERFIL SUPERIOR (ANCHO)',
  'PERFIL INFERIOR (ANCHO)',
  'PERFIL LATERAL IZQ (ALTO)',
  'PERFIL LATERAL DER (ALTO)',
  'MANILLA IZQ (ALTO)',
  'MANILLA DER (ALTO)',
]);

/** Peso (ancho relativo) de cada columna: texto largo más ancho. */
export function pesoColumna(key: string, esDespiece: boolean): number {
  if (key === 'ALTO MESA DE CORTE') return 1.6; // etiqueta larga
  if (key.startsWith('CENEFA OVALADA')) return 1.55; // etiqueta larga (con/sin tira)
  // Columnas de oscuridad con contenido largo: se ensanchan para que el texto
  // entre completo ("283,6 INT" / "260 EXT / 250 EXT" / "EXTERNO").
  if (key === 'PERFIL LATERAL') return 1.95;
  if (key === 'PERFIL BASE') return 1.75;
  if (key === 'TIPO SOFT LIGHT') return 1.8;
  // Lleva dos códigos ("BK 13 / BK 81"), no un número.
  if (key === COLUMNA_COD_VELCRO) return 1.9;
  // BEEBLACK: su banda repartía todo a partes iguales, así que la variante
  // ("INTERNO — DENTRO DEL MARCO") se recortaba mientras las columnas de
  // números cortos sobraban de ancho. La variante se lleva lo que devuelven
  // las numéricas, y el total de la banda queda como estaba: así la identidad
  // (PRODUCTO, DESCRIPCIÓN) no pierde milímetros.
  if (key === 'TIPO DE BEEBLACK') return 2.8;
  if (key === 'ANCHO TELA' || key === 'TOTAL LAMAS') return 0.95;
  // ALTO TELA la comparten soft light / oscuranti / dark: ahí también es un
  // número corto, así que angostarla no les quita nada.
  if (key === 'ALTO TELA') return 0.95;
  // Perfiles y manillas del beeblack (exclusivos: los de oscuridad son
  // "PERFIL SUPERIOR"/"PERFIL LATERAL", sin sufijo) — números de 5 caracteres.
  if (COLS_NUM_BEEBLACK.has(key)) return 1.0;
  if (esDespiece) return 1.15;
  switch (key) {
    case 'codMecanismo':
      return 2.6;
    case 'producto':
      return 2.4;
    case 'descripcion':
      return 1.9;
    case 'accionamiento':
    case 'pesoCadena':
    case 'suplementos':
      return 1.8;
    case 'ubic':
    case 'cadena':
      return 1.7;
    case 'tuberia':
      return 2.4; // descripción larga del tubo ("E02-TUBO 1.2 / Ø 38 mm")
    case 'colorAcc':
      return 1.1; // angosta: valores cortos (BLANCO/NEGRO); la cabecera se achica si hace falta
    case 'armado':
    case 'manillas':
      return 1.1;
    case 'conjunto':
      return 1.6; // la letra sola es corta, pero oscuranti agrega " (INVERTIDA)"
    case 'codInt':
      // Estaba calibrada para "SC 02" y el beeblack trae "BEE-SC02": se ensancha
      // lo justo para que entre sin recortar (y encoge la fuente antes, ver render).
      return 0.95;
    case 'codSec':
      return 0.9;
    case 'cant':
      return 0.6;
    case 'anchoMts':
    case 'altoMts':
      return 0.8; // "2,500": más angostas que una numérica de despiece
    default:
      return 1.0; // numéricas
  }
}


/** Genera y descarga el PDF CALCULO GENERAL de la OT. */
export function generarPdfCalculoGeneral(
  ventanas: Ventana[],
  catalogo: CatalogoProductos,
  meta: MetaCalculo,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  usarTuboE78 = false,
  formulas?: FormulasFamilias,
  reglas?: ReglasSeleccion,
): void {
  renderHojaCalculo(
    ventanas,
    catalogo,
    meta,
    params,
    VARIANTE_CALCULO_GENERAL,
    undefined,
    usarTuboE78,
    formulas,
    reglas,
  );
}

/** Genera y descarga el PDF DIMENSIONADO (cálculo general solo-tela). */
export function generarPdfDimensionado(
  ventanas: Ventana[],
  catalogo: CatalogoProductos,
  meta: MetaCalculo,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  juntoPorPieza?: Map<string, JuntoPieza>,
  usarTuboE78 = false,
  formulas?: FormulasFamilias,
  reglas?: ReglasSeleccion,
): void {
  renderHojaCalculo(
    ventanas,
    catalogo,
    meta,
    params,
    VARIANTE_DIMENSIONADO,
    juntoPorPieza,
    usarTuboE78,
    formulas,
    reglas,
  );
}

function renderHojaCalculo(
  ventanas: Ventana[],
  catalogo: CatalogoProductos,
  meta: MetaCalculo,
  params: ParametrosCorte,
  variante: VarianteHojaCalculo,
  juntoPorPieza?: Map<string, JuntoPieza>,
  usarTuboE78 = false,
  formulas?: FormulasFamilias,
  reglas?: ReglasSeleccion,
): void {
  if (!ventanas || ventanas.length === 0) {
    throw new Error('No hay ventanas en la OT.');
  }
  const data = construirCalculoGeneral(ventanas, catalogo, params, juntoPorPieza, {
    altoMesaCorteDuo: variante.altoMesaCorteDuo,
    usarTuboE78,
    formulas,
    reglas,
  });
  if (data.filas.length === 0) throw new Error('No hay cortinas para calcular.');
  const { identidad, bloques } = aplicarVariante(data, variante);

  // Identidad + (Dimensionado) CONJUNTO PAÑOS: columnas comunes a TODAS las
  // secciones, con anchos GLOBALES para que queden alineadas verticalmente.
  const identCols: ColumnaCalculo[] = variante.conjuntoPanos
    ? [...identidad, { key: 'conjunto', label: 'CONJUNTO PAÑOS' }]
    : identidad;

  // Una SECCIÓN por sistema presente (orden fijo, verticales al final), con SUS
  // filas y SOLO sus columnas de despiece. Un bloque sin columnas (despiece
  // vacío o filtrado por la variante) igual arma su sección: sus filas se
  // muestran solo con identidad.
  const secciones = seccionesDeHoja(data, bloques);

  // A3 apaisado (420 × 297).
  const doc = new jsPDF('l', 'mm', 'a3');
  const PW = 420;
  const PH = 297;
  const M = 6;
  const usable = PW - M * 2;
  const BOTTOM = PH - M;

  // Anchos de IDENTIDAD globales: ocupan la fracción que deja libre la sección
  // con MÁS despiece; el resto ("área de despiece") lo reparte cada sección
  // entre SUS columnas, llenándola completa. Así la identidad queda alineada
  // entre secciones y cada banda ocupa todo el ancho útil.
  const identPesos = identCols.map((c) => pesoColumna(String(c.key), false));
  const sumIdent = identPesos.reduce((a, b) => a + b, 0) || 1;
  const despiecePeso = (columnas: ColumnaCalculo[]) =>
    columnas.reduce((s, c) => s + pesoColumna(c.key, true), 0);
  const despieceMax = Math.max(0.001, ...secciones.map((sec) => despiecePeso(sec.columnas)));
  const identTotal = (usable * sumIdent) / (sumIdent + despieceMax);
  const identWidths = identPesos.map((p) => (identTotal * p) / sumIdent);
  const despieceArea = usable - identTotal;
  const despX0 = M + identTotal;
  const identXs: number[] = [];
  {
    let ax = M;
    for (const w of identWidths) {
      identXs.push(ax);
      ax += w;
    }
  }

  const bannerH = 9;
  const superH = 8;
  const headH = 15; // cabeceras largas se envuelven a 2-3 líneas
  const rowH = 11;
  const SIZE_TEXTO = 8.5; // identidad (texto) — tamaño fijo, uniforme
  const SIZE_NUM = 12; // despiece (números / variante) — tamaño fijo, uniforme
  const VERDE: RGB = [112, 173, 71];
  const VERDE_TXT: RGB = [22, 46, 20];

  let y = M;
  let pagina = 0;

  // Celda a tamaño FIJO: lo que no cabe se recorta con "…". Con `minSize` primero
  // ENCOGE la fuente (hasta minSize) para tratar de que quepa entero — útil para
  // tokens largos ("240 INT / 240 EXT") que no deben perder dato por elipsis.
  const celdaFija = (
    txt: string,
    x: number,
    w: number,
    yText: number,
    size: number,
    o: { bold?: boolean; color?: RGB; minSize?: number } = {},
  ) => {
    if (!txt) return;
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    const c = o.color ?? [25, 25, 30];
    doc.setTextColor(c[0], c[1], c[2]);
    const maxW = w - 1.4;
    let fSize = size;
    doc.setFontSize(fSize);
    if (o.minSize) {
      while (fSize > o.minSize && doc.getTextWidth(txt) > maxW) {
        fSize -= 0.5;
        doc.setFontSize(fSize);
      }
    }
    let t = txt;
    if (doc.getTextWidth(t) > maxW) {
      while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
      t += '…';
    }
    doc.text(t, x + w / 2, yText, { align: 'center' });
  };

  const encabezado = () => {
    pagina += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 38);
    doc.text(variante.titulo, M, y + 5);
    // Número de OT grande y destacado. Encoge para no pisar la fecha: las OT con
    // nombre ("OT #DARK-OSCURANTI") no caben a 24 pt en el hueco hasta M + 130.
    const textoOT = `OT ${meta.ot}`;
    const anchoOT = M + 130 - (M + 62) - 4; // hueco menos un aire de 4 mm
    doc.setFontSize(24);
    const medido = doc.getTextWidth(textoOT);
    if (medido > anchoOT) {
      doc.setFontSize(Math.max(9, (24 * anchoOT) / medido));
    }
    doc.text(textoOT, M + 62, y + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('FECHA OT: ___/___/____      RESPONSABLE OT: __________', M + 130, y + 5);
    if (meta.cliente) doc.text(meta.cliente, PW - M, y + 5, { align: 'right' });
    doc.setFontSize(7);
    doc.text(`Página ${pagina}`, PW - M, y + 9, { align: 'right' });
    y += 10;
  };

  encabezado();

  for (const sec of secciones) {
    // Reparte el área de despiece entre las columnas de ESTA sección.
    const despPesos = sec.columnas.map((c) => pesoColumna(c.key, true));
    const sumDesp = despPesos.reduce((a, b) => a + b, 0) || 1;
    const despWidths = despPesos.map((p) => (despieceArea * p) / sumDesp);
    const despWtot = despWidths.reduce((a, b) => a + b, 0);
    const despXs: number[] = [];
    {
      let ax = despX0;
      for (const w of despWidths) {
        despXs.push(ax);
        ax += w;
      }
    }

    // Banner + súper-cabecera + cabeceras de columna de la sección (se repiten
    // al saltar de página dentro de la sección).
    const cabecerasSeccion = () => {
      rect(doc, M, y, usable, bannerH, [22, 22, 26]);
      celdaFija(sec.sistema.label, M, usable, y + 6.2, 15, { bold: true, color: C_WHITE });
      y += bannerH;
      if (despWtot > 0) {
        rect(doc, despX0, y, despWtot, superH, sec.sistema.color);
        celdaFija(sec.sistema.label, despX0, despWtot, y + 5.4, 9, { bold: true, color: C_WHITE });
      }
      y += superH;
      identCols.forEach((c, i) => {
        rect(doc, identXs[i], y, identWidths[i], headH, C_DARK);
        celdaCabecera(doc, c.label, identXs[i], identWidths[i], y, headH);
      });
      sec.columnas.forEach((c, j) => {
        // La cabecera de TIPO DE SOFT.LIGHT va del color del sistema (como sus
        // vecinas); solo las CELDAS de esa columna llevan el verde de resalte.
        rect(doc, despXs[j], y, despWidths[j], headH, sec.sistema.color);
        celdaCabecera(doc, c.label, despXs[j], despWidths[j], y, headH);
      });
      y += headH;
    };

    // Una sección nueva que ni siquiera cabe con 1 fila salta de página antes.
    if (y + bannerH + superH + headH + rowH > BOTTOM) {
      doc.addPage();
      y = M;
      encabezado();
    }
    cabecerasSeccion();

    for (const f of sec.filas) {
      if (y + rowH > BOTTOM) {
        doc.addPage();
        y = M;
        encabezado();
        cabecerasSeccion();
      }
      // Identidad (texto de tamaño uniforme).
      identCols.forEach((c, i) => {
        rect(doc, identXs[i], y, identWidths[i], rowH);
        // El texto de la celda lo decide el modelo: es la única regla que el
        // papel y la pantalla del taller no pueden contradecirse.
        const val = textoIdentidad(f, c.key);
        // El conjunto puede llevar el sufijo "(INVERTIDA)" y el codInt del
        // beeblack es largo ("BEE-SC02"): encogen antes que recortarse, para no
        // perder el final del texto.
        celdaFija(
          val,
          identXs[i],
          identWidths[i],
          y + 7.4,
          SIZE_TEXTO,
          c.key === 'conjunto' || c.key === 'codInt' ? { minSize: 6 } : undefined,
        );
      });
      // Despiece (números de tamaño uniforme; TIPO DE SOFT.LIGHT en verde).
      sec.columnas.forEach((c, j) => {
        const esTipo = c.key === 'TIPO SOFT LIGHT';
        const esNum = typeof f.despiece.get(c.key) === 'number';
        const val = textoDespiece(f, c.key);
        rect(doc, despXs[j], y, despWidths[j], rowH, esTipo && val ? VERDE : undefined);
        // Los números quedan a SIZE_NUM; los tokens string (perfiles "240 INT /
        // 240 EXT", TIPO) encogen hasta 6,5 antes de recortar para no perder dato.
        celdaFija(
          val,
          despXs[j],
          despWidths[j],
          y + 7.4,
          SIZE_NUM,
          {
            ...(esTipo && val ? { bold: true, color: VERDE_TXT } : {}),
            ...(esNum ? {} : { minSize: 6.5 }),
          },
        );
      });
      y += rowH;
    }
    y += 2.5; // separación entre secciones
  }

  doc.save(`${variante.archivo}_OT${meta.ot}.pdf`);
}
