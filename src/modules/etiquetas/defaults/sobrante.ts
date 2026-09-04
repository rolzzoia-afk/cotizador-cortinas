// ─────────────────────────────────────────────────────────────────────
// Plantilla de fábrica de la etiqueta del SOBRANTE DE TELA
// (Brother QL-810W, 62 × 62 mm).
//
// Reemplaza el cartel que se llenaba a mano con lápiz sobre un formulario
// fotocopiado. Dos cosas cambian respecto de ese papel:
//
//  · donde decía TIPO (una lista de porcentajes que nadie marcaba) ahora dice
//    FUNCIONAL PARA: para qué alcanza este trozo —VERTICAL, ROLLER o AMBAS—,
//    que es lo que el cortador necesita saber de un vistazo en el rack;
//  · la UBICACIÓN va grande abajo, porque es el dato con el que se busca.
//
// El resto son los mismos campos del cartel viejo (código, medidas, de qué OT
// salió, fecha y serial), así que quien conoce el papel reconoce la etiqueta.
// ─────────────────────────────────────────────────────────────────────
import type { DefEtiqueta, EstiloTexto, PlantillaEtiqueta } from '../plantilla';

// El papel es el rollo continuo de 62 mm; el alto lo define este diseño.
const HOJA = { ancho: 62, alto: 62 };
const MARGEN = 1.5;
const ANCHO_UTIL = HOJA.ancho - MARGEN * 2; // 59

const BANDA_COD = { x: MARGEN, y: MARGEN, ancho: ANCHO_UTIL, alto: 8 };
const ROTULO_FUNC = { x: MARGEN, y: 10.3, ancho: ANCHO_UTIL, alto: 3.2 };
const FUNCIONAL = { x: MARGEN, y: 13.8, ancho: ANCHO_UTIL, alto: 8.5 };
const TABLA_MED = { x: MARGEN, y: 23.8, ancho: ANCHO_UTIL, alto: 10.5 };
const ORIGEN = { x: MARGEN, y: 35.4, ancho: ANCHO_UTIL, alto: 6.2 };
const FECHA = { x: MARGEN, y: 42.2, ancho: 27, alto: 5.2 };
const SERIAL = { x: 30, y: 42.2, ancho: HOJA.ancho - MARGEN - 30, alto: 5.2 };
const UBICACION = { x: MARGEN, y: 48.3, ancho: ANCHO_UTIL, alto: 12.2 };

/** Ancho de cada una de las tres casillas de FUNCIONAL. */
const CELDA_FUNC = ANCHO_UTIL / 3;
/** Divisor de la tabla ANCHO | ALTO. */
const DIV_MED = ANCHO_UTIL / 2;

/**
 * Cuerpo mínimo al que puede bajar un dato: más chico no se lee a un metro del
 * rack, que es desde donde se mira la etiqueta.
 */
export const CUERPO_MINIMO_PT = 5.5;

const encoge = (pt: number, bold = true): EstiloTexto => ({
  pt,
  bold,
  align: 'izquierda',
  color: 'negro',
  encoger: { minPt: CUERPO_MINIMO_PT },
});

/** Rótulo chico: gris y espaciado, para que el DATO se lleve el ojo. */
const rotulo = (pt: number, espaciado: number): EstiloTexto => ({
  pt,
  bold: true,
  align: 'izquierda',
  color: 'gris',
  espaciado,
});

const casilla = (i: number, slot: string, rot: string) => ({
  id: `func_${slot}`,
  tipo: 'casilla' as const,
  visible: true,
  x: FUNCIONAL.x + CELDA_FUNC * i,
  y: FUNCIONAL.y,
  ancho: CELDA_FUNC,
  alto: FUNCIONAL.alto,
  slot,
  rotulo: rot,
  estilo: { pt: 6.6, bold: true, align: 'centro' as const, color: 'negro' as const },
});

export const PLANTILLA_SOBRANTE: PlantillaEtiqueta = {
  version: 1,
  hoja: HOJA,
  elementos: [
    {
      id: 'banda_codigo',
      tipo: 'campo',
      visible: true,
      ...BANDA_COD,
      slot: 'codigo',
      estilo: {
        pt: 17,
        bold: true,
        align: 'centro',
        color: 'blanco',
        fondo: 'negro',
        espaciado: 0.3,
        encoger: { minPt: CUERPO_MINIMO_PT },
      },
    },
    {
      id: 'rotulo_funcional',
      tipo: 'texto',
      visible: true,
      ...ROTULO_FUNC,
      texto: 'FUNCIONAL PARA:',
      estilo: rotulo(6.5, 0.4),
    },
    { id: 'marco_funcional', tipo: 'caja', visible: true, ...FUNCIONAL, trazoPt: 0.6 },
    {
      id: 'func_div_1',
      tipo: 'linea',
      visible: true,
      orientacion: 'v',
      x: FUNCIONAL.x + CELDA_FUNC,
      y: FUNCIONAL.y,
      ancho: 0,
      alto: FUNCIONAL.alto,
      trazoPt: 0.6,
    },
    {
      id: 'func_div_2',
      tipo: 'linea',
      visible: true,
      orientacion: 'v',
      x: FUNCIONAL.x + CELDA_FUNC * 2,
      y: FUNCIONAL.y,
      ancho: 0,
      alto: FUNCIONAL.alto,
      trazoPt: 0.6,
    },
    casilla(0, 'marca_vertical', 'VERTICAL'),
    casilla(1, 'marca_roller', 'ROLLER'),
    casilla(2, 'marca_ambas', 'AMBAS'),

    { id: 'marco_medidas', tipo: 'caja', visible: true, ...TABLA_MED, trazoPt: 0.6 },
    {
      id: 'medidas_div',
      tipo: 'linea',
      visible: true,
      orientacion: 'v',
      x: TABLA_MED.x + DIV_MED,
      y: TABLA_MED.y,
      ancho: 0,
      alto: TABLA_MED.alto,
      trazoPt: 0.6,
    },
    {
      id: 'rotulo_ancho',
      tipo: 'texto',
      visible: true,
      x: TABLA_MED.x + 1.4,
      y: TABLA_MED.y + 0.8,
      ancho: DIV_MED - 2,
      alto: 3,
      texto: 'ANCHO',
      estilo: rotulo(6.3, 0.3),
    },
    {
      id: 'ancho',
      tipo: 'campo',
      visible: true,
      x: TABLA_MED.x + 1.4,
      y: TABLA_MED.y + 3.6,
      ancho: DIV_MED - 2.8,
      alto: 6,
      slot: 'ancho',
      estilo: encoge(15),
    },
    {
      id: 'rotulo_alto',
      tipo: 'texto',
      visible: true,
      x: TABLA_MED.x + DIV_MED + 1.4,
      y: TABLA_MED.y + 0.8,
      ancho: DIV_MED - 2,
      alto: 3,
      texto: 'ALTO',
      estilo: rotulo(6.3, 0.3),
    },
    {
      id: 'alto',
      tipo: 'campo',
      visible: true,
      x: TABLA_MED.x + DIV_MED + 1.4,
      y: TABLA_MED.y + 3.6,
      ancho: DIV_MED - 2.8,
      alto: 6,
      slot: 'alto',
      estilo: encoge(15),
    },

    {
      id: 'origen',
      tipo: 'texto',
      visible: true,
      ...ORIGEN,
      texto: 'SOBRANTE DE: <b>{origen}</b> <small>{ots}</small>',
      estilo: encoge(8.2, false),
    },
    {
      id: 'fecha',
      tipo: 'texto',
      visible: true,
      ...FECHA,
      texto: 'FECHA: <b>{fecha}</b>',
      estilo: encoge(7.2, false),
    },
    {
      id: 'serial',
      tipo: 'campo',
      visible: true,
      ...SERIAL,
      slot: 'serial',
      estilo: {
        pt: 6.8,
        bold: false,
        align: 'derecha',
        color: 'negro',
        fuente: 'mono',
        encoger: { minPt: CUERPO_MINIMO_PT },
      },
    },

    { id: 'marco_ubicacion', tipo: 'caja', visible: true, ...UBICACION, trazoPt: 1 },
    {
      id: 'rotulo_ubicacion',
      tipo: 'texto',
      visible: true,
      x: UBICACION.x + 1.6,
      y: UBICACION.y + 0.8,
      ancho: UBICACION.ancho - 3.2,
      alto: 3.2,
      texto: 'UBICACIÓN ASIGNADA',
      estilo: rotulo(6.3, 0.4),
    },
    {
      id: 'ubicacion',
      tipo: 'campo',
      visible: true,
      x: UBICACION.x + 1.6,
      y: UBICACION.y + 4,
      ancho: UBICACION.ancho - 3.2,
      alto: 7.4,
      slot: 'ubicacion',
      estilo: encoge(19),
    },
  ],
};

export const DEF_SOBRANTE: DefEtiqueta = {
  id: 'sobrante',
  label: 'Sobrante de tela',
  grupo: 'Producción',
  motor: 'html',
  plantillaDefault: PLANTILLA_SOBRANTE,
  slots: {
    codigo: { label: 'Código de la tela', ejemplo: 'SC 96' },
    ancho: { label: 'Ancho (cm)', ejemplo: '102' },
    alto: { label: 'Alto (cm)', ejemplo: '170' },
    origen: { label: 'De qué OT o lote salió', ejemplo: 'OT 3187-B' },
    ots: { label: 'OTs del lote', ejemplo: '' },
    fecha: { label: 'Fecha del corte', ejemplo: '26-08-26' },
    serial: { label: 'Serial', ejemplo: 'OT3187B-260826-S1' },
    ubicacion: { label: 'Ubicación en el rack', ejemplo: 'A-54' },
    marca_vertical: { label: 'Sirve para vertical', ejemplo: 'no' },
    marca_roller: { label: 'Sirve para roller', ejemplo: 'si' },
    marca_ambas: { label: 'Sirve para las dos', ejemplo: 'no' },
  },
  ayuda:
    'Sale al cerrar el corte en Producción y se reimprime desde Telas → Colmena. QL-810W, 62 mm.',
};
