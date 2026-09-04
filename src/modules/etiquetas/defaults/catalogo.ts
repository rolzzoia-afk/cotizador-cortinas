// ─────────────────────────────────────────────────────────────────────
// Plantilla de fábrica de la etiqueta del CATÁLOGO DE MUESTRAS
// (Brother QL-810W, 62 × 52 mm).
//
// Es la etiqueta que va pegada en cada muestra de los catálogos que llevan las
// vendedoras. La geometría sale del `.lbx` original (un .lbx es un ZIP con
// `label.xml` adentro): cada coordenada de abajo es la del XML pasada de puntos
// a milímetros (1 pt = 0,352778 mm). El papel declarado es 175,7 × 147,6 pt.
//
// Estos números son el punto de partida: desde Admin → Etiquetas el dueño puede
// mover, agrandar, ocultar o agregar lo que quiera, y lo suyo se guarda encima
// sin tocar este archivo.
// ─────────────────────────────────────────────────────────────────────
import type { DefEtiqueta, EstiloTexto, PlantillaEtiqueta } from '../plantilla';

const HOJA = { ancho: 62, alto: 52 };
const LOGO = { x: 5.05, y: 4.37, ancho: 17.25, alto: 9.88 };
const CAJA_CODIGOS = { x: 31.15, y: 4.37, ancho: 23.28, alto: 4.94 };
const TABLA = { x: 1.52, y: 17.07, ancho: 58.57, alto: 22.58, divX: 29.53, divY: 12.59 };
const PIE = { x: 1.52, y: 40.4, ancho: 58.92, alto: 7.55 };

// Los bordes de la tabla y de sus dos columnas, ya en absoluto: son los que se
// ven impresos, y ninguna letra puede pasarlos.
const COL_IZQ = { x1: TABLA.x, x2: TABLA.x + TABLA.divX };
const COL_DER = { x1: TABLA.x + TABLA.divX, x2: TABLA.x + TABLA.ancho };
const LINEA_MEDIA_Y = TABLA.y + TABLA.divY;
const TABLA_Y2 = TABLA.y + TABLA.alto;

/** Aire entre la última letra y la línea del recuadro. */
const MARGEN_X = 1.2;
const MARGEN_Y = 0.6;

/**
 * Caja de un dato adentro de una columna de la tabla.
 *
 * En el .lbx cada cuadro de texto venía ajustado al ejemplo que tenía adentro
 * —el de TIPO medía 15,95 mm, lo justo para «SCREEN»— y no a la celda que se
 * dibuja. Copiar esos anchos salía mal por los dos lados: «BLACKOUT» se
 * encogía sin necesidad, y el nombre de la tela, cuyo cuadro terminaba 1 mm
 * MÁS AFUERA que la tabla, se salía por el costado en vez de encoger. Acá el
 * ancho lo manda la COLUMNA; del .lbx se conserva dónde empieza cada dato.
 */
const enColumna = (col: { x1: number; x2: number }, x: number, y: number, alto: number) => ({
  x,
  y,
  ancho: col.x2 - MARGEN_X - x,
  alto,
});

/**
 * Cuerpo mínimo al que puede bajar un campo que no calza: más chico que esto ya
 * no se lee en la muestra.
 */
export const CUERPO_MINIMO_PT = 6;

/** Cuerpo fijo del pie, igual que la plantilla original. */
export const PIE_ETIQUETA = ['www.cortinasrolzzo.cl', 'IG: @cortinasrolzzo', '(56) 9 99428383'];

const dato = (pt: number, partir = false): EstiloTexto => ({
  pt,
  bold: true,
  align: 'izquierda',
  color: 'negro',
  encoger: { minPt: CUERPO_MINIMO_PT, partir },
});

export const PLANTILLA_CATALOGO: PlantillaEtiqueta = {
  version: 1,
  hoja: HOJA,
  elementos: [
    { id: 'logo', tipo: 'imagen', visible: true, ...LOGO },
    {
      id: 'banda_codigos',
      tipo: 'texto',
      visible: true,
      ...CAJA_CODIGOS,
      texto: 'CÓDIGOS',
      estilo: { pt: 12.2, bold: true, align: 'centro', color: 'blanco', fondo: 'negro' },
    },
    {
      id: 'codigos',
      tipo: 'campo',
      visible: true,
      x: 31.15,
      y: 9.31,
      ancho: HOJA.ancho - 1.5 - 31.15,
      alto: 4.94,
      slot: 'codigos',
      // 12 pt, no 12,2: el diseño anterior no le daba tamaño y heredaba el del
      // navegador (16 px = 12 pt exactos). Acá queda explícito, que además lo
      // vuelve independiente de la configuración del equipo que imprime.
      estilo: dato(12),
    },
    { id: 'tabla', tipo: 'caja', visible: true, ...TABLA, trazoPt: 0.5 },
    {
      id: 'tabla_div_v',
      tipo: 'linea',
      visible: true,
      orientacion: 'v',
      x: TABLA.x + TABLA.divX,
      y: TABLA.y,
      ancho: 0,
      alto: TABLA.alto,
      trazoPt: 0.5,
    },
    {
      id: 'tabla_div_h',
      tipo: 'linea',
      visible: true,
      orientacion: 'h',
      x: TABLA.x,
      y: LINEA_MEDIA_Y,
      ancho: TABLA.ancho,
      alto: 0,
      trazoPt: 0.5,
    },
    {
      id: 'tipo',
      tipo: 'campo',
      visible: true,
      ...enColumna(COL_IZQ, 3.6, 18.49, 4.45),
      slot: 'tipo',
      estilo: dato(11),
    },
    {
      id: 'rotulo_tela',
      tipo: 'texto',
      visible: true,
      ...enColumna(COL_DER, 31.86, 18.49, 4.94),
      texto: 'TELA:',
      estilo: { pt: 10, bold: true, align: 'izquierda', color: 'negro' },
    },
    {
      id: 'calidad',
      tipo: 'campo',
      visible: true,
      ...enColumna(COL_IZQ, 3.32, 23.53, 4.45),
      slot: 'calidad',
      estilo: dato(11),
    },
    // El nombre de la tela es el único dato largo de verdad (hay descriptores
    // de 46 caracteres en el catálogo), así que se lleva todo lo que le queda a
    // su celda hasta la línea del medio.
    {
      id: 'descripcion',
      tipo: 'campo',
      visible: true,
      ...enColumna(COL_DER, 31.86, 22.9, LINEA_MEDIA_Y - MARGEN_Y - 22.9),
      slot: 'descripcion',
      estilo: dato(10, true),
    },
    {
      id: 'rotulo_ancho',
      tipo: 'texto',
      visible: true,
      ...enColumna(COL_IZQ, 2.22, 31.89, 4.94),
      texto: 'Ancho máximo:',
      estilo: { pt: 11.3, bold: false, align: 'izquierda', color: 'negro' },
    },
    {
      id: 'ancho',
      tipo: 'campo',
      visible: true,
      ...enColumna(COL_DER, 33.27, 29.78, TABLA_Y2 - MARGEN_Y - 29.78),
      slot: 'ancho',
      estilo: dato(10),
    },
    {
      id: 'pie',
      tipo: 'texto',
      visible: true,
      ...PIE,
      texto: PIE_ETIQUETA.join('\n'),
      estilo: {
        pt: 6.3,
        bold: false,
        align: 'centro',
        color: 'negro',
        interlinea: 1.25,
      },
    },
  ],
};

export const DEF_CATALOGO: DefEtiqueta = {
  id: 'catalogo',
  label: 'Catálogo de muestras',
  grupo: 'Telas',
  motor: 'html',
  plantillaDefault: PLANTILLA_CATALOGO,
  slots: {
    codigos: { label: 'Códigos de la tela', ejemplo: 'BK 11 / BK 12' },
    tipo: { label: 'Familia (BLACKOUT / SCREEN / DUO)', ejemplo: 'BLACKOUT' },
    descripcion: { label: 'Nombre de la tela', ejemplo: 'BLANCO ESTANDAR' },
    ancho: { label: 'Ancho máximo (m)', ejemplo: '2,5' },
    calidad: { label: 'Calidad', ejemplo: 'PREMIUM' },
  },
  ayuda: 'Se imprime desde Telas → Catálogo, en la QL-810W con papel de 62 mm.',
};
