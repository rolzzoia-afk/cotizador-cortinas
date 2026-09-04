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
// El DISEÑO vive en `@/modules/etiquetas/defaults/catalogo` y se edita desde
// Admin → Etiquetas; acá quedó solo de dónde sale cada dato de la tela.
//
// Los 5 datos variables son los mismos campos que la plantilla combinaba
// desde el Excel: CODIGOS, TIPO, DESCRIPCION, ANCHO y CALIDAD.
//
// NO confundir con `exportEtiquetasPtouch.ts`: esa es la etiqueta de
// INVENTARIO (con QR y ubicación de rack) y se sigue imprimiendo por P-touch.
//
// Lógica pura: devuelve el HTML como string, no toca el DOM.
// ─────────────────────────────────────────────────────────────────────
import { htmlDeEtiquetas } from '@/modules/etiquetas/etiquetaHtml';
import { PLANTILLA_CATALOGO } from '@/modules/etiquetas/defaults/catalogo';
import type { PlantillaEtiqueta } from '@/modules/etiquetas/plantilla';
import type { Tela } from '@/pages/telas/Telas.types';

// Los textos fijos y el mínimo de cuerpo se mudaron a la plantilla de fábrica;
// se reexportan porque varias pantallas y pruebas los nombran desde acá.
export { CUERPO_MINIMO_PT, PIE_ETIQUETA } from '@/modules/etiquetas/defaults/catalogo';
export { PISO_UNA_LINEA_PT } from '@/modules/etiquetas/etiquetaHtml';

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

/**
 * Documento completo listo para `window.print()`: una etiqueta por página de
 * 62 × 52 mm, dibujado por el motor de plantillas.
 *
 * El DISEÑO ya no vive acá: es la plantilla `catalogo`, que sale de fábrica
 * calcada del .lbx y que el dueño puede editar en Admin → Etiquetas (mover un
 * cuadro, agrandar una letra, cambiar el logo). Lo que sigue viviendo acá es de
 * dónde salen los DATOS de cada tela, que es harina de otro costal.
 */
export function htmlEtiquetasCatalogo(
  etiquetas: EtiquetaCatalogo[],
  logo: string,
  plantilla: PlantillaEtiqueta = PLANTILLA_CATALOGO,
): string {
  return htmlDeEtiquetas(
    plantilla,
    etiquetas.map((e) => ({ ...e })),
    { titulo: 'Etiquetas de catálogo', logo },
  );
}
