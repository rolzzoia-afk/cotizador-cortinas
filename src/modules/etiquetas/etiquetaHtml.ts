// ─────────────────────────────────────────────────────────────────────
// EL MOTOR HTML DE ETIQUETAS — dibuja una plantilla y la deja lista para
// `window.print()`.
//
// Antes cada etiqueta HTML tenía su propio generador con las mismas 200 líneas
// de andamiaje (helpers de milímetros, escape, el guion que encoge el texto, el
// `@page`): dos copias que había que mantener en paralelo. Acá el andamiaje es
// UNO y lo que cambia es el dato: la plantilla.
//
// Cada elemento se posiciona en milímetros absolutos porque la etiqueta es un
// plano, no un flujo de texto: así lo impreso calza con la etiquetadora aunque
// el navegador cambie de motor de layout.
//
// Módulo puro: devuelve un string, no toca el DOM.
// ─────────────────────────────────────────────────────────────────────
import {
  interpolar,
  type ColorEtiqueta,
  type ElementoEtiqueta,
  type EstiloTexto,
  type PlantillaEtiqueta,
} from './plantilla';

/** Los datos de UNA etiqueta: slot → texto ya formateado por la app. */
export type DatosEtiqueta = Record<string, string>;

const escapar = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Texto fijo con dos marcas de énfasis: `<b>` para el dato que manda y
 * `<small>` para lo accesorio («SOBRANTE DE: **OT 3189** ·3215 ·3213»).
 *
 * Se escapa TODO primero y recién después se devuelven esas dos marcas, y solo
 * las que venían en la PLANTILLA: los datos se interpolan ya escapados, así una
 * ubicación o un serial con `<b>` adentro no puede cambiar el diseño.
 */
function textoRico(plantilla: string, datos: Record<string, string>): string {
  const conMarcas = escapar(plantilla)
    .replace(/&lt;(\/?)(b|small)&gt;/g, '<$1$2>');
  const escapados: Record<string, string> = {};
  for (const [k, v] of Object.entries(datos)) escapados[k] = escapar(v);
  return interpolar(conMarcas, escapados);
}

/** Dos decimales: las restas de coma flotante ensucian el HTML sin necesidad. */
const mm = (n: number): string => String(Math.round(n * 100) / 100);

const TINTA: Record<ColorEtiqueta, string> = {
  negro: '#000',
  blanco: '#fff',
  // Los rótulos chicos van en gris para que el DATO gane el ojo; más claro que
  // esto la etiquetadora térmica lo entrega lavado.
  gris: '#333',
};

const JUSTIFICADO: Record<EstiloTexto['align'], string> = {
  izquierda: 'flex-start',
  centro: 'center',
  derecha: 'flex-end',
};

const caja = (e: { x: number; y: number; ancho: number; alto: number }): string =>
  `left:${mm(e.x)}mm;top:${mm(e.y)}mm;width:${mm(e.ancho)}mm;height:${mm(e.alto)}mm`;

/**
 * El estilo de un texto, en CSS. Se emite inline y no como clase porque cada
 * elemento es único: agrupar por clase obligaría a inventar nombres y a
 * mantenerlos sincronizados con la plantilla.
 */
export function estiloCss(s: EstiloTexto): string {
  const partes = [
    `font-size:${s.pt}pt`,
    `color:${TINTA[s.color]}`,
    `justify-content:${JUSTIFICADO[s.align]}`,
  ];
  if (s.bold) partes.push('font-weight:bold');
  if (s.fondo) partes.push(`background:${TINTA[s.fondo]}`);
  if (s.interlinea) partes.push(`line-height:${s.interlinea}`);
  if (s.espaciado) partes.push(`letter-spacing:${s.espaciado}pt`);
  if (s.fuente === 'mono') partes.push('font-family:"Courier New", monospace');
  if (s.hScale && s.hScale !== 1) partes.push(`transform:scaleX(${s.hScale});transform-origin:left`);
  if (s.align === 'centro') partes.push('text-align:center');
  return partes.join(';');
}

/**
 * Reparte el texto en trozos que no se cortan por dentro, para que el renglón
 * solo se parta en los espacios. Sin esto «BLACKOUT R1002-8» se corta en el
 * guion y queda «BLACKOUT R1002-» / «8», que se lee como si fueran otro código
 * y otro dato.
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

/** El visto de una casilla marcada. Va como SVG y no como «✓»: la fuente de la
 *  etiquetadora no siempre trae ese carácter y salía un cuadrado vacío. */
const VISTO =
  '<svg class="visto" viewBox="0 0 20 20" aria-hidden="true">' +
  '<polyline points="3,11 8,16 17,4" fill="none" stroke="currentColor" ' +
  'stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * `crudo` es lo que dice el texto (sin escapar) y `html` lo mismo ya listo para
 * el documento. Se piden los dos porque el reparto en palabras del modo
 * «partir» escapa por su cuenta, palabra por palabra.
 */
function bloqueTexto(
  clase: string,
  e: { x: number; y: number; ancho: number; alto: number },
  s: EstiloTexto,
  crudo: string,
  html: string,
): string {
  const marcas = s.encoger ? ` data-encoger data-min="${s.encoger.minPt}"` : '';
  const partido = !!s.encoger?.partir;
  const parte = partido ? ' data-parte' : '';
  // Un texto con saltos de línea (el pie de la etiqueta) se apila: cada
  // renglón entero, uno debajo del otro.
  const apilado = crudo.includes('\n') ? ';flex-direction:column' : '';
  const cuerpo = partido ? porPalabras(crudo) : html.split('\n').join('<br>');
  return `<div class="${clase}" style="${caja(e)};${estiloCss(s)}${apilado}"${marcas}${parte}>${cuerpo}</div>`;
}

/** Un elemento dibujado. */
function bloque(e: ElementoEtiqueta, datos: DatosEtiqueta, logo: string): string {
  if (!e.visible) return '';
  switch (e.tipo) {
    case 'caja': {
      const relleno = e.relleno ? `background:${TINTA[e.relleno]};` : '';
      const borde = e.trazoPt > 0 ? `border:${e.trazoPt}pt solid #000;` : '';
      return `<div class="caja" style="${caja(e)};${borde}${relleno}"></div>`;
    }
    case 'linea': {
      const borde = e.orientacion === 'v' ? 'border-left' : 'border-top';
      const trazo = `${borde}:${e.trazoPt}pt ${e.punteada ? 'dashed' : 'solid'} #000;`;
      return `<div class="linea" style="${caja(e)};${trazo}"></div>`;
    }
    case 'texto':
      return bloqueTexto(
        'texto',
        e,
        e.estilo,
        interpolar(e.texto, datos),
        textoRico(e.texto, datos),
      );
    case 'campo': {
      const valor = datos[e.slot] ?? '';
      return bloqueTexto('campo', e, e.estilo, valor, escapar(valor));
    }
    case 'imagen': {
      const src = e.url || logo;
      if (!src) return '';
      return `<img class="img" src="${src}" alt="" style="${caja(e)}">`;
    }
    case 'qr': {
      const src = e.url || '';
      if (!src) return '';
      return `<img class="img" src="${src}" alt="" style="${caja(e)}">`;
    }
    case 'casilla': {
      const marcada = (datos[e.slot] ?? '').trim().toLowerCase();
      const activa = marcada === 'si' || marcada === 'sí' || marcada === '1' || marcada === 'true';
      // La opción marcada se subraya: en el rack la etiqueta se mira de lejos y
      // el visto solo no siempre se distingue.
      return (
        `<div class="casilla" style="${caja(e)};${estiloCss(e.estilo)}">` +
        `<span class="cuadro">${activa ? VISTO : ''}</span>` +
        `<span class="rotulo${activa ? ' on' : ''}">${escapar(e.rotulo)}</span></div>`
      );
    }
  }
}

/**
 * «Encoger para que quepa». Se MIDE el texto ya dibujado en vez de estimarlo
 * por cantidad de letras: con una fuente proporcional «AZUL OSCURO JASPEADO»
 * ocupa bastante más que «GRIS OSCURO R1002-8» aunque las dos tengan 20
 * caracteres. Corre antes de imprimir.
 *
 * Con `data-parte` va en dos pasadas: primero se intenta en un renglón, y
 * recién cuando encogerlo lo dejaría ilegible se le permite partirse y se sigue
 * encogiendo hasta que quepa también de alto. Así «BLANCO ESTANDAR» sale en una
 * línea grande y no partido en chico, y los descriptores largos de proveedor
 * caben igual en vez de salirse.
 */
const GUION_AJUSTE = (pisoUnaLinea: number) => `
function ajustar() {
  document.querySelectorAll('[data-encoger]').forEach(function (el) {
    var pt = parseFloat(getComputedStyle(el).fontSize) * 72 / 96;
    var min = parseFloat(el.getAttribute('data-min')) || 6;
    var parte = el.hasAttribute('data-parte');
    var piso = parte ? ${pisoUnaLinea} : min;
    while (pt > piso && el.scrollWidth > el.clientWidth) {
      pt -= 0.25;
      el.style.fontSize = pt + 'pt';
    }
    if (!parte || el.scrollWidth <= el.clientWidth) return;
    el.style.whiteSpace = 'normal';
    while (pt > min &&
      (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)) {
      pt -= 0.25;
      el.style.fontSize = pt + 'pt';
    }
  });
}`;

/**
 * Hasta acá encoge un texto largo sin partirlo. Más abajo se lee mejor en dos
 * renglones que en uno diminuto.
 */
export const PISO_UNA_LINEA_PT = 8;

export type OpcionesHtml = {
  /** Título de la ventana de impresión. */
  titulo?: string;
  /** Imagen por defecto de los elementos `imagen` sin url propia. */
  logo?: string;
  /** CSS extra de la etiqueta (por si una necesita algo muy suyo). */
  cssExtra?: string;
};

/**
 * Documento completo: una etiqueta por página del tamaño de la plantilla.
 */
export function htmlDeEtiquetas(
  plantilla: PlantillaEtiqueta,
  datos: DatosEtiqueta[],
  opts: OpcionesHtml = {},
): string {
  const { ancho, alto } = plantilla.hoja;
  const logo = opts.logo ?? '';
  const cuerpo = datos
    .map(
      (d) =>
        `<div class="etiqueta">\n  ${plantilla.elementos
          .map((e) => bloque(e, d, logo))
          .filter(Boolean)
          .join('\n  ')}\n</div>`,
    )
    .join('\n');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${escapar(opts.titulo ?? 'Etiquetas')}</title>
<style>
@page { size: ${ancho}mm ${alto}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.etiqueta {
  position: relative; width: ${ancho}mm; height: ${alto}mm;
  overflow: hidden; background: #fff; color: #000;
  font-family: Arial, Helvetica, sans-serif; page-break-after: always;
  /* Sin esto el navegador descarta los fondos al imprimir y las bandas negras
     salen en blanco. Se hereda a toda la etiqueta. */
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.etiqueta:last-child { page-break-after: auto; }
/* Una sola línea por defecto: el texto largo encoge (ver ajustar()), nunca se
   parte en dos ni se sale del recuadro. */
.etiqueta > div { position: absolute; display: flex; align-items: center; white-space: nowrap; }
[data-encoger] { overflow: hidden; }
.img { position: absolute; object-fit: contain; }
.caja, .linea { display: block !important; }
[data-parte] { line-height: 1.1; }
[data-parte] .p { white-space: nowrap; }
.casilla { gap: 1.1mm; justify-content: center; }
.casilla .cuadro {
  display: inline-flex; align-items: center; justify-content: center;
  width: 4.6mm; height: 4.6mm; border: 0.8pt solid #000; color: #000; flex: none;
}
.casilla .visto { width: 4mm; height: 4mm; }
.casilla .rotulo.on { text-decoration: underline; }
small { font-size: 0.75em; color: #333; }
b { font-size: 1.15em; }
@media screen {
  body { background: #e5e7eb; padding: 8mm; }
  .etiqueta { outline: 1px solid #9ca3af; margin: 0 auto 6mm; }
}
${opts.cssExtra ?? ''}
</style></head>
<body>
${cuerpo}
<script>${GUION_AJUSTE(PISO_UNA_LINEA_PT)}
window.onload = () => { ajustar(); setTimeout(() => { window.print(); window.close(); }, 250); };</script>
</body></html>`;
}
