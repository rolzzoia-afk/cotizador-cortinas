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
import { htmlDeEtiquetas } from '@/modules/etiquetas/etiquetaHtml';
import { PLANTILLA_SOBRANTE } from '@/modules/etiquetas/defaults/sobrante';
import type { PlantillaEtiqueta } from '@/modules/etiquetas/plantilla';

// El mínimo de cuerpo se mudó a la plantilla de fábrica; se reexporta porque
// las pruebas y el diálogo del corte lo nombran desde acá.
export { CUERPO_MINIMO_PT } from '@/modules/etiquetas/defaults/sobrante';

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

// ── El documento ─────────────────────────────────────────────────────

/** Los datos de UNA etiqueta, tal como los espera la plantilla. */
export function datosDeEtiqueta(e: EtiquetaSobrante): Record<string, string> {
  const marca = casillaMarcada(e.funcional);
  return {
    codigo: e.codigo,
    ancho: medida(e.anchoCm),
    alto: medida(e.altoCm),
    origen: e.origen,
    ots: lineaOts(e.otsDelLote ?? []),
    fecha: fechaCorta(e.fechaISO),
    serial: e.serial,
    ubicacion: e.ubicacion,
    marca_vertical: marca === 'vertical' ? 'si' : 'no',
    marca_roller: marca === 'roller' ? 'si' : 'no',
    marca_ambas: marca === 'ambas' ? 'si' : 'no',
  };
}

/**
 * Documento listo para `window.print()`: una etiqueta por página.
 *
 * El DISEÑO es la plantilla `sobrante`, que sale de fábrica igual a la etiqueta
 * de siempre y que el dueño puede editar en Admin → Etiquetas. Acá quedó de
 * dónde sale cada dato del retazo.
 */
export function htmlEtiquetasSobrante(
  etiquetas: EtiquetaSobrante[],
  plantilla: PlantillaEtiqueta = PLANTILLA_SOBRANTE,
): string {
  return htmlDeEtiquetas(plantilla, etiquetas.map(datosDeEtiqueta), {
    titulo: 'Etiquetas de sobrante',
  });
}
