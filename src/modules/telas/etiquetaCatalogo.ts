// ─────────────────────────────────────────────────────────────────────
// Etiqueta del CATÁLOGO DE MUESTRAS de telas (Brother QL-810W, 62 × 52 mm).
//
// Es la etiqueta que va pegada en cada muestra de los catálogos que llevan
// las vendedoras. Hasta ahora se imprimía desde P-touch Editor con la
// plantilla `FORMATO_ ETIQUETAS_ CATALOGO.lbx` y un Excel mantenido a mano;
// acá se dibuja en HTML y se manda a la impresora con el diálogo del
// navegador, así una tela recién creada sale con su etiqueta sin salir de la
// app.
//
// La geometría sale de ese .lbx (un .lbx es un ZIP con `label.xml` adentro):
// cada coordenada de abajo es la del XML pasada de puntos a milímetros
// (1 pt = 0,352778 mm). El papel declarado es 175,7 × 147,6 pt = 62 × 52 mm.
// Si hay que retocar el diseño, la referencia sigue siendo ese archivo.
//
// Los 5 datos variables son los mismos campos que la plantilla combinaba
// desde el Excel: CODIGOS, TIPO, DESCRIPCION, ANCHO y CALIDAD.
//
// NO confundir con `exportEtiquetasPtouch.ts`: esa es la etiqueta de
// INVENTARIO (con QR y ubicación de rack) y se sigue imprimiendo por P-touch.
//
// Lógica pura: devuelve el HTML como string, no toca el DOM.
// ─────────────────────────────────────────────────────────────────────
import type { Tela } from '@/pages/telas/Telas.types';

/** Los 5 campos que la plantilla combinaba desde el Excel. */
export type EtiquetaCatalogo = {
  codigos: string;
  tipo: string;
  descripcion: string;
  ancho: string;
  calidad: string;
};

/**
 * El catálogo guarda la familia en dos letras; la etiqueta la escribe
 * completa, como en el Excel de marketing (BK → BLACKOUT).
 */
export const TIPO_LARGO: Record<string, string> = {
  BK: 'BLACKOUT',
  DU: 'DUO',
  SC: 'SCREEN',
};

/** Una familia que no esté en la tabla se imprime tal cual vino. */
export function tipoLargo(tipo: string | null | undefined): string {
  const t = String(tipo ?? '')
    .trim()
    .toUpperCase();
  return TIPO_LARGO[t] ?? t;
}

/**
 * El ancho va con coma (es-CL) y sin decimales de relleno: 2,5 · 2,97 · 3.
 * La etiqueta no lleva unidad, igual que la plantilla.
 */
export function formatearAncho(ancho: number | null | undefined): string {
  if (ancho === null || ancho === undefined || !Number.isFinite(ancho)) return '';
  return String(ancho).replace('.', ',');
}

/**
 * El nombre que va en el recuadro «TELA:». Sale del descriptor, que es como
 * se llama la tela para la clienta, pero el campo es opcional y hoy 81 de las
 * 214 del catálogo lo tienen vacío: esas etiquetas salían con el recuadro en
 * blanco. En ese caso se cae al nemotécnico, que nunca falta y es el nombre
 * con el que se pide la tela al proveedor.
 */
export function nombreDeTela(tela: Tela): string {
  return (tela.descriptor || '').trim() || (tela.nemotecnico || '').trim();
}

/** Datos de etiqueta de UNA tela del catálogo. */
export function datosEtiquetaCatalogo(tela: Tela): EtiquetaCatalogo {
  return {
    codigos: (tela.codigo || '').trim(),
    tipo: tipoLargo(tela.tipo),
    descripcion: nombreDeTela(tela),
    ancho: formatearAncho(tela.ancho),
    calidad: (tela.calidad || '').trim().toUpperCase(),
  };
}

/**
 * Varias telas en UNA etiqueta: es el caso «BK 11 / BK 12» del catálogo
 * viejo, dos códigos que comparten la misma muestra física. Los códigos se
 * unen en el orden en que se seleccionaron y el resto de los datos sale de
 * la primera, que es la que manda.
 */
export function combinarEtiquetas(telas: Tela[]): EtiquetaCatalogo {
  const base = datosEtiquetaCatalogo(telas[0]);
  return {
    ...base,
    codigos: telas
      .map((t) => (t.codigo || '').trim())
      .filter(Boolean)
      .join(' / '),
  };
}

const escapar = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Geometría del .lbx, en mm. El nombre de cada constante es el del objeto en
// `label.xml` para poder cruzarlas con el original.
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
const enColumna = (
  col: { x1: number; x2: number },
  x: number,
  y: number,
  alto: number,
): Caja => ({ x, y, ancho: col.x2 - MARGEN_X - x, alto });

type Caja = { x: number; y: number; ancho: number; alto: number };

const CODIGOS: Caja = { x: 31.15, y: 9.31, ancho: HOJA.ancho - 1.5 - 31.15, alto: 4.94 };
const TIPO = enColumna(COL_IZQ, 3.6, 18.49, 4.45);
const ROTULO_TELA = enColumna(COL_DER, 31.86, 18.49, 4.94);
const CALIDAD = enColumna(COL_IZQ, 3.32, 23.53, 4.45);
// El nombre de la tela es el único dato largo de verdad (hay descriptores de
// 46 caracteres en el catálogo), así que se lleva todo lo que le queda a su
// celda hasta la línea del medio.
const DESCRIPCION = enColumna(COL_DER, 31.86, 22.9, LINEA_MEDIA_Y - MARGEN_Y - 22.9);
const ROTULO_ANCHO = enColumna(COL_IZQ, 2.22, 31.89, 4.94);
const ANCHO = enColumna(COL_DER, 33.27, 29.78, TABLA_Y2 - MARGEN_Y - 29.78);

/** Cuerpo fijo del pie, igual que la plantilla. */
export const PIE_ETIQUETA = ['www.cortinasrolzzo.cl', 'IG: @cortinasrolzzo', '(56) 9 99428383'];

/**
 * Cuerpo mínimo al que puede bajar un campo que no calza: más chico que esto
 * ya no se lee en la muestra.
 */
export const CUERPO_MINIMO_PT = 6;

/**
 * Hasta acá encoge un nombre largo sin partirlo. Más abajo se lee mejor en
 * dos renglones que en uno diminuto.
 */
export const PISO_UNA_LINEA_PT = 8;

/** Dos decimales: las restas de coma flotante ensucian el HTML sin necesidad. */
const mm = (n: number): string => String(Math.round(n * 100) / 100);

const caja = (c: Caja): string =>
  `left:${mm(c.x)}mm;top:${mm(c.y)}mm;width:${mm(c.ancho)}mm;height:${mm(c.alto)}mm`;

/**
 * Reparte el texto en trozos que no se cortan por dentro, para que el renglón
 * solo se parta en los espacios. Sin esto «BLACKOUT R1002-8» se corta en el
 * guion y queda «BLACKOUT R1002-» / «8», que se lee como si fueran otro
 * código y otro dato.
 */
const porPalabras = (texto: string): string => {
  const palabras = texto
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `<span class="p">${escapar(p)}</span>`)
    .join(' ');
  // Todo junto en un envoltorio: si las palabras colgaran directo del div, el
  // navegador las tomaría como items flex sueltos y se comería los espacios
  // que las separan («BLANCO ESTANDAR» salía «BLANCOESTANDAR»).
  return `<span class="txt">${palabras}</span>`;
};

/**
 * Campo con dato de la tela: encoge si se pasa de su recuadro. Con `parte`
 * además puede repartirse en dos renglones cuando encoger ya no alcanza.
 */
const campo = (clase: string, c: Caja, texto: string, parte = false): string =>
  `<div class="${clase}" style="${caja(c)}"${parte ? ' data-parte' : ''} data-encoger>` +
  `${parte ? porPalabras(texto) : escapar(texto)}</div>`;

function bloqueEtiqueta(e: EtiquetaCatalogo, logo: string): string {
  return `<div class="etiqueta">
  <img class="logo" src="${logo}" alt="Rolzzo" style="${caja(LOGO)}">
  <div class="cajaCodigos" style="${caja(CAJA_CODIGOS)}">CÓDIGOS</div>
  ${campo('codigos', CODIGOS, e.codigos)}
  <div class="tabla" style="${caja(TABLA)}">
    <div class="divV" style="left:${mm(TABLA.divX)}mm"></div>
    <div class="divH" style="top:${mm(TABLA.divY)}mm"></div>
  </div>
  ${campo('tipo', TIPO, e.tipo)}
  <div class="rotuloTela" style="${caja(ROTULO_TELA)}">TELA:</div>
  ${campo('calidad', CALIDAD, e.calidad)}
  ${campo('descripcion', DESCRIPCION, e.descripcion, true)}
  <div class="rotuloAncho" style="${caja(ROTULO_ANCHO)}">Ancho máximo:</div>
  ${campo('ancho', ANCHO, e.ancho)}
  <div class="pie" style="${caja(PIE)}">${PIE_ETIQUETA.map(escapar).join('<br>')}</div>
</div>`;
}

/**
 * «Encoger para que quepa», igual que la plantilla. Se MIDE el texto ya
 * dibujado en vez de estimarlo por cantidad de letras: con una fuente
 * proporcional «AZUL OSCURO JASPEADO» ocupa bastante más que «GRIS OSCURO
 * R1002-8» aunque las dos tengan 20 caracteres. Corre antes de imprimir.
 *
 * El nombre de la tela (`data-parte`) va en dos pasadas: primero se intenta
 * en un renglón, y recién cuando encogerlo lo dejaría ilegible se le permite
 * partirse y se sigue encogiendo hasta que quepa también de alto. Así
 * «BLANCO ESTANDAR» sale en una línea grande y no partido en chico, y los
 * descriptores largos de proveedor caben igual en vez de salirse.
 */
const GUION_AJUSTE = `
function ajustar() {
  document.querySelectorAll('[data-encoger]').forEach(function (el) {
    var pt = parseFloat(getComputedStyle(el).fontSize) * 72 / 96;
    var parte = el.hasAttribute('data-parte');
    var piso = parte ? ${PISO_UNA_LINEA_PT} : ${CUERPO_MINIMO_PT};
    while (pt > piso && el.scrollWidth > el.clientWidth) {
      pt -= 0.25;
      el.style.fontSize = pt + 'pt';
    }
    if (!parte || el.scrollWidth <= el.clientWidth) return;
    el.style.whiteSpace = 'normal';
    while (pt > ${CUERPO_MINIMO_PT} &&
      (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)) {
      pt -= 0.25;
      el.style.fontSize = pt + 'pt';
    }
  });
}`;

/**
 * Documento completo listo para `window.print()`: una etiqueta por página de
 * 62 × 52 mm. Cada elemento va posicionado en milímetros absolutos porque la
 * etiqueta es un plano, no un flujo de texto: así lo impreso calza con el
 * .lbx aunque el navegador cambie de motor de layout.
 */
export function htmlEtiquetasCatalogo(etiquetas: EtiquetaCatalogo[], logo: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Etiquetas de catálogo</title>
<style>
@page { size: ${HOJA.ancho}mm ${HOJA.alto}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.etiqueta {
  position: relative; width: ${HOJA.ancho}mm; height: ${HOJA.alto}mm;
  overflow: hidden; background: #fff; color: #000;
  font-family: Arial, Helvetica, sans-serif; page-break-after: always;
  /* Sin esto el navegador descarta los fondos al imprimir y la banda negra de
     CÓDIGOS sale en blanco. Se hereda a toda la etiqueta. */
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.etiqueta:last-child { page-break-after: auto; }
/* Una sola línea, como la plantilla: el texto largo encoge (ver ajustar()),
   nunca se parte en dos ni se sale del recuadro. */
.etiqueta > div { position: absolute; display: flex; align-items: center; white-space: nowrap; }
[data-encoger] { overflow: hidden; }
.logo { position: absolute; object-fit: contain; }
.cajaCodigos {
  background: #000; color: #fff; font-size: 12.2pt; font-weight: bold;
  justify-content: center;
}
.codigos { font-weight: bold; }
.tabla { border: 0.5pt solid #000; display: block !important; }
.tabla .divV { position: absolute; top: 0; bottom: 0; border-left: 0.5pt solid #000; }
.tabla .divH { position: absolute; left: 0; right: 0; border-top: 0.5pt solid #000; }
.tipo, .calidad { font-size: 11pt; font-weight: bold; }
.rotuloTela, .descripcion, .ancho { font-size: 10pt; font-weight: bold; }
/* Renglones pegados: si el nombre termina partido en dos, los dos tienen que
   caber entre la línea de arriba y la del medio. Cada palabra va entera. */
.descripcion { line-height: 1.1; }
.descripcion .p { white-space: nowrap; }
.rotuloAncho { font-size: 11.3pt; }
.pie {
  font-size: 6.3pt; line-height: 1.25; text-align: center;
  justify-content: center; flex-direction: column;
}
@media screen {
  body { background: #e5e7eb; padding: 8mm; }
  .etiqueta { outline: 1px solid #9ca3af; margin: 0 auto 6mm; }
}
</style></head>
<body>
${etiquetas.map((e) => bloqueEtiqueta(e, logo)).join('\n')}
<script>${GUION_AJUSTE}
window.onload = () => { ajustar(); setTimeout(() => { window.print(); window.close(); }, 250); };</script>
</body></html>`;
}
