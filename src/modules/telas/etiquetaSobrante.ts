// ─────────────────────────────────────────────────────────────────────
// Etiqueta del SOBRANTE DE TELA (Brother QL-810W, 62 × 62 mm).
//
// Reemplaza el cartel que hasta ahora se llenaba a mano con lápiz rojo sobre
// un formulario fotocopiado. Dos cosas cambian respecto de ese papel:
//
//  · donde decía TIPO (una lista de porcentajes que nadie marcaba) ahora dice
//    FUNCIONAL: para qué alcanza este trozo — VERTICAL, ROLLER o AMBAS — que
//    es lo que el cortador necesita saber de un vistazo en el rack;
//  · la UBICACIÓN va grande abajo, porque es el dato con el que se busca.
//
// El resto de los campos son los mismos del cartel viejo (código, medidas,
// de qué OT salió, fecha y serial), así que quien conoce el papel reconoce la
// etiqueta.
//
// Mismo camino que `etiquetaCatalogo.ts`: HTML dibujado en milímetros
// absolutos y mandado a la impresora con el diálogo del navegador. Lógica
// pura: devuelve el HTML como string, no toca el DOM.
// ─────────────────────────────────────────────────────────────────────
import {
  funcionalDeSobrante,
  type FuncionalSobrante,
} from '@/modules/produccion/salidasCorte';
import {
  PARAMETROS_CORTE_DEFAULT,
  type ParametrosCorte,
} from '@/modules/cotizador/parametrosCorte';

export type EtiquetaSobrante = {
  /** COD_INT de la tela: BK 10, SC-D… */
  codigo: string;
  funcional: FuncionalSobrante;
  anchoCm: number;
  altoCm: number;
  /** 'OT 3189' | 'LOTE Corte 02/09' */
  origen: string;
  /** Las OTs que se cortaron juntas, cuando el sobrante salió de un lote. */
  otsDelLote?: string[];
  fechaISO: string;
  ubicacion: string;
  serial: string;
};

/** Cuántas OTs del lote caben en la línea antes de resumir con «+n». */
export const MAX_OTS_VISIBLES = 4;

const escapar = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** dd-mm-aa, como se escribía a mano en el cartel viejo. */
export function fechaCorta(fechaISO: string): string {
  const d = new Date(fechaISO);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${p(d.getFullYear() % 100)}`;
}

/**
 * La medida se escribe entera: los sobrantes se miden con huincha al
 * centímetro y un «97,5» en la etiqueta invita a discutir medio centímetro.
 */
export function medida(cm: number): string {
  return `${Math.round(cm)} cm`;
}

/** Los tres cuadros de la etiqueta, más «ninguno» (que manda el trozo a merma). */
export type MarcaFuncional = 'vertical' | 'roller' | 'ambas' | 'nada';

/**
 * Cuál de los tres cuadros se marca. Si sirve para las dos cosas se marca
 * AMBAS y no los otros dos: tres marcas en una fila de tres es ruido, y el
 * cortador que ve AMBAS ya sabe que puede usarlo para lo que sea.
 */
export function casillaMarcada(f: FuncionalSobrante): 'vertical' | 'roller' | 'ambas' | null {
  if (f.roller && f.vertical) return 'ambas';
  if (f.roller) return 'roller';
  if (f.vertical) return 'vertical';
  return null;
}

/** La vuelta: lo que el operario marcó en el diálogo, hecho dato. */
export function funcionalDeMarca(m: MarcaFuncional): FuncionalSobrante {
  return { roller: m === 'roller' || m === 'ambas', vertical: m === 'vertical' || m === 'ambas' };
}

/** Lo que la app propone marcar para unas medidas dadas. */
export function marcaDeFuncional(f: FuncionalSobrante): MarcaFuncional {
  return casillaMarcada(f) ?? 'nada';
}

/** La línea de OTs del lote, resumida si son muchas. */
export function lineaOts(ots: string[]): string {
  if (ots.length === 0) return '';
  const visibles = ots.slice(0, MAX_OTS_VISIBLES).map((o) => `OT ${o}`);
  const resto = ots.length - visibles.length;
  return visibles.join(' · ') + (resto > 0 ? ` +${resto}` : '');
}

/**
 * Etiqueta de un paño que YA está en la colmena (reimpresión desde la vista
 * Colmena). Los paños viejos —los que entraron por el import del galpón o por
 * el flujo clásico— no tienen `funcional` guardado: en ese caso se recalcula
 * de las medidas, que es exactamente lo que la app propondría hoy.
 */
export function etiquetaDesdePano(
  pano: {
    codigo?: string | null;
    medida_ancho?: number | null;
    medida_alto?: number | null;
    ubicacion?: string | null;
    created_at?: string | null;
    datos_extra?: {
      creadoEn?: string;
      fecha_origen?: string;
      ot_origen?: string;
      serial?: string;
      funcional?: FuncionalSobrante;
      ots_lote?: { id: string; numero: string }[];
    } | null;
  },
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): EtiquetaSobrante {
  const ancho = pano.medida_ancho ?? 0;
  const alto = pano.medida_alto ?? 0;
  const dx = pano.datos_extra || {};
  return {
    codigo: (pano.codigo || '').trim(),
    funcional: dx.funcional ?? funcionalDeSobrante(ancho, alto, params),
    anchoCm: ancho,
    altoCm: alto,
    origen: (dx.ot_origen || '').trim(),
    otsDelLote: dx.ots_lote?.map((o) => o.numero),
    fechaISO: dx.creadoEn || dx.fecha_origen || pano.created_at || '',
    ubicacion: (pano.ubicacion || '').trim(),
    serial: (dx.serial || '').trim(),
  };
}

// ── Geometría (mm) ───────────────────────────────────────────────────
// El papel es el rollo continuo de 62 mm; el alto lo define este diseño.
const HOJA = { ancho: 62, alto: 62 };
const MARGEN = 1.5;
const ANCHO_UTIL = HOJA.ancho - MARGEN * 2; // 59

type Caja = { x: number; y: number; ancho: number; alto: number };

const BANDA_COD: Caja = { x: MARGEN, y: MARGEN, ancho: ANCHO_UTIL, alto: 8 };
const ROTULO_FUNC: Caja = { x: MARGEN, y: 10.3, ancho: ANCHO_UTIL, alto: 3.2 };
const FUNCIONAL: Caja = { x: MARGEN, y: 13.8, ancho: ANCHO_UTIL, alto: 8.5 };
const TABLA_MED: Caja = { x: MARGEN, y: 23.8, ancho: ANCHO_UTIL, alto: 10.5 };
const ORIGEN: Caja = { x: MARGEN, y: 35.4, ancho: ANCHO_UTIL, alto: 6.2 };
const FECHA: Caja = { x: MARGEN, y: 42.2, ancho: 27, alto: 5.2 };
const SERIAL: Caja = { x: 30, y: 42.2, ancho: HOJA.ancho - MARGEN - 30, alto: 5.2 };
const UBICACION: Caja = { x: MARGEN, y: 48.3, ancho: ANCHO_UTIL, alto: 12.2 };

/** Ancho de cada una de las tres casillas de FUNCIONAL. */
const CELDA_FUNC = ANCHO_UTIL / 3;
/** Divisor de la tabla ANCHO | ALTO. */
const DIV_MED = ANCHO_UTIL / 2;

/** Dos decimales: las restas de coma flotante ensucian el HTML sin necesidad. */
const mm = (n: number): string => String(Math.round(n * 100) / 100);

const caja = (c: Caja): string =>
  `left:${mm(c.x)}mm;top:${mm(c.y)}mm;width:${mm(c.ancho)}mm;height:${mm(c.alto)}mm`;

/**
 * El visto de la casilla va como SVG y no como carácter: el ✓ depende de que
 * la fuente instalada lo tenga y en una impresora de etiquetas eso se
 * descubre tarde, con la etiqueta ya pegada al rollo.
 */
const VISTO =
  '<svg class="visto" viewBox="0 0 20 20" aria-hidden="true">' +
  '<polyline points="3,11 8,16 17,4" fill="none" stroke="currentColor" ' +
  'stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function casilla(rotulo: string, i: number, marcada: boolean): string {
  const x = FUNCIONAL.x + CELDA_FUNC * i;
  const c: Caja = { x, y: FUNCIONAL.y, ancho: CELDA_FUNC, alto: FUNCIONAL.alto };
  return `<div class="celdaFunc" style="${caja(c)}">
    <span class="cuadro">${marcada ? VISTO : ''}</span>
    <span class="rotFunc${marcada ? ' on' : ''}">${escapar(rotulo)}</span>
  </div>`;
}

function bloqueEtiqueta(e: EtiquetaSobrante): string {
  const marcada = casillaMarcada(e.funcional);
  const ots = lineaOts(e.otsDelLote ?? []);
  return `<div class="etiqueta">
  <div class="bandaCod" style="${caja(BANDA_COD)}" data-encoger>${escapar(e.codigo)}</div>
  <div class="rotuloFunc" style="${caja(ROTULO_FUNC)}">FUNCIONAL PARA:</div>
  <div class="marcoFunc" style="${caja(FUNCIONAL)}">
    <div class="divF" style="left:${mm(CELDA_FUNC)}mm"></div>
    <div class="divF" style="left:${mm(CELDA_FUNC * 2)}mm"></div>
  </div>
  ${casilla('VERTICAL', 0, marcada === 'vertical')}
  ${casilla('ROLLER', 1, marcada === 'roller')}
  ${casilla('AMBAS', 2, marcada === 'ambas')}
  <div class="tablaMed" style="${caja(TABLA_MED)}">
    <div class="divM" style="left:${mm(DIV_MED)}mm"></div>
  </div>
  <div class="rotMed" style="${caja({ x: TABLA_MED.x + 1.4, y: TABLA_MED.y + 0.8, ancho: DIV_MED - 2, alto: 3 })}">ANCHO</div>
  <div class="valMed" style="${caja({ x: TABLA_MED.x + 1.4, y: TABLA_MED.y + 3.6, ancho: DIV_MED - 2.8, alto: 6 })}" data-encoger>${escapar(medida(e.anchoCm))}</div>
  <div class="rotMed" style="${caja({ x: TABLA_MED.x + DIV_MED + 1.4, y: TABLA_MED.y + 0.8, ancho: DIV_MED - 2, alto: 3 })}">ALTO</div>
  <div class="valMed" style="${caja({ x: TABLA_MED.x + DIV_MED + 1.4, y: TABLA_MED.y + 3.6, ancho: DIV_MED - 2.8, alto: 6 })}" data-encoger>${escapar(medida(e.altoCm))}</div>
  <div class="origen" style="${caja(ORIGEN)}" data-encoger>SOBRANTE DE: <b>${escapar(e.origen)}</b>${
    ots ? `<span class="ots">${escapar(ots)}</span>` : ''
  }</div>
  <div class="pieDato" style="${caja(FECHA)}" data-encoger>FECHA: <b>${escapar(fechaCorta(e.fechaISO))}</b></div>
  <div class="pieDato serial" style="${caja(SERIAL)}" data-encoger>${escapar(e.serial)}</div>
  <div class="marcoUbic" style="${caja(UBICACION)}"></div>
  <div class="rotUbic" style="${caja({ x: UBICACION.x + 1.6, y: UBICACION.y + 0.8, ancho: UBICACION.ancho - 3.2, alto: 3.2 })}">UBICACIÓN ASIGNADA</div>
  <div class="valUbic" style="${caja({ x: UBICACION.x + 1.6, y: UBICACION.y + 4, ancho: UBICACION.ancho - 3.2, alto: 7.4 })}" data-encoger>${escapar(e.ubicacion)}</div>
</div>`;
}

/**
 * Cuerpo mínimo al que puede bajar un dato: más chico no se lee a un metro
 * del rack, que es desde donde se mira la etiqueta.
 */
export const CUERPO_MINIMO_PT = 5.5;

/**
 * «Encoger para que quepa»: se MIDE el texto ya dibujado. Un serial de lote
 * largo o una ubicación como «RACK 3 · M2 · COL 4» no pueden salirse del
 * recuadro ni empujar el resto del diseño.
 */
const GUION_AJUSTE = `
function ajustar() {
  document.querySelectorAll('[data-encoger]').forEach(function (el) {
    var pt = parseFloat(getComputedStyle(el).fontSize) * 72 / 96;
    while (pt > ${CUERPO_MINIMO_PT} && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)) {
      pt -= 0.25;
      el.style.fontSize = pt + 'pt';
    }
  });
}`;

/**
 * Documento listo para `window.print()`: una etiqueta por página de
 * 62 × 62 mm. Cada elemento va en milímetros absolutos porque la etiqueta es
 * un plano, no un flujo de texto.
 */
export function htmlEtiquetasSobrante(etiquetas: EtiquetaSobrante[]): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Etiquetas de sobrante</title>
<style>
@page { size: ${HOJA.ancho}mm ${HOJA.alto}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.etiqueta {
  position: relative; width: ${HOJA.ancho}mm; height: ${HOJA.alto}mm;
  overflow: hidden; background: #fff; color: #000;
  font-family: Arial, Helvetica, sans-serif; page-break-after: always;
  /* Sin esto el navegador descarta los fondos al imprimir y la banda del
     código sale en blanco sobre blanco. */
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.etiqueta:last-child { page-break-after: auto; }
.etiqueta > div { position: absolute; display: flex; align-items: center; white-space: nowrap; }
[data-encoger] { overflow: hidden; }

.bandaCod {
  background: #000; color: #fff; font-size: 17pt; font-weight: bold;
  justify-content: center; letter-spacing: 0.3pt;
}
.rotuloFunc { font-size: 6.5pt; font-weight: bold; letter-spacing: 0.4pt; color: #333; }

/* Las tres casillas: el marco se dibuja una vez y las celdas van encima. */
.marcoFunc { border: 0.6pt solid #000; display: block !important; }
.marcoFunc .divF { position: absolute; top: 0; bottom: 0; border-left: 0.6pt solid #000; }
.celdaFunc { justify-content: center; gap: 1.1mm; }
.cuadro {
  display: inline-flex; align-items: center; justify-content: center;
  width: 4.6mm; height: 4.6mm; border: 0.8pt solid #000; color: #000;
}
.visto { width: 4mm; height: 4mm; }
.rotFunc { font-size: 6.6pt; font-weight: bold; }
/* La opción marcada se lee primero: el resto queda como referencia. */
.rotFunc.on { text-decoration: underline; }

.tablaMed { border: 0.6pt solid #000; display: block !important; }
.tablaMed .divM { position: absolute; top: 0; bottom: 0; border-left: 0.6pt solid #000; }
.rotMed { font-size: 6.3pt; font-weight: bold; color: #333; letter-spacing: 0.3pt; }
.valMed { font-size: 15pt; font-weight: bold; }

.origen { font-size: 8.2pt; gap: 1mm; }
.origen b { font-size: 9.5pt; }
.origen .ots { font-size: 6.2pt; color: #333; }
.pieDato { font-size: 7.2pt; gap: 0.8mm; }
.serial { font-family: "Courier New", monospace; font-size: 6.8pt; justify-content: flex-end; }

.marcoUbic { border: 1pt solid #000; display: block !important; }
.rotUbic { font-size: 6.3pt; font-weight: bold; color: #333; letter-spacing: 0.4pt; }
.valUbic { font-size: 19pt; font-weight: bold; }

@media screen {
  body { background: #e5e7eb; padding: 8mm; }
  .etiqueta { outline: 1px solid #9ca3af; margin: 0 auto 6mm; }
}
</style></head>
<body>
${etiquetas.map(bloqueEtiqueta).join('\n')}
<script>${GUION_AJUSTE}
window.onload = () => { ajustar(); setTimeout(() => { window.print(); window.close(); }, 250); };</script>
</body></html>`;
}
