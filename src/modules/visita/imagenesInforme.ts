// ─────────────────────────────────────────────────────────────────────
// LAS FOTOS DEL INFORME CLIENTE.
//
// El correo que la empresa manda a mano intercala fotos con el texto: después
// de «te dejo una foto referencial:» va la foto de una duo blackout a contraluz,
// y en cada habitación va la ficha de la tela. Para igualarlo sin convertir el
// informe en un editor de texto enriquecido, las fotos viajan DENTRO del texto
// como una línea marcadora:
//
//     Se explican los pasos de luz de las cortinas duo blackout …
//     [foto: https://…/informe-assets/…/duo-1.jpg]
//
// Por qué así y no un editor rico:
//   · El informe sigue siendo un `string` editable en un textarea. La vendedora
//     mueve, duplica o borra una foto como borra cualquier línea.
//   · Nada más de la app cambia: se guarda, se versiona y viaja a la IA igual.
//   · Al copiar, el marcador se convierte en `<img>` y el correo queda idéntico
//     al que se manda hoy.
//
// El marcador lleva la URL COMPLETA (no un id ni un path): así este módulo es
// puro —no depende del bucket ni de Supabase— y el texto plano sigue sirviendo
// si el navegador no deja copiar con formato.
//
// Módulo PURO: sin React, sin Supabase, sin DOM.
// ─────────────────────────────────────────────────────────────────────

/** Bucket PÚBLICO de las fotos del informe (ver sql/20260820_informe_assets.sql). */
export const BUCKET_INFORME = 'informe-assets';

/** Tope de fotos por texto (intro o bloque). El correo real usa 1–2. */
export const MAX_FOTOS_TEXTO = 6;

// Una línea que es SOLO el marcador. Anclado a la línea completa a propósito:
// un `[foto: …]` en medio de una frase es texto que alguien escribió, no una
// foto — y no queremos romperle el párrafo.
const RE_FOTO = /^[ \t]*\[foto:[ \t]*(\S+)[ \t]*\][ \t]*$/i;

/**
 * Si la línea es un marcador de foto, devuelve su URL; si no, `null`.
 */
export function urlDeLineaFoto(linea: string): string | null {
  const m = RE_FOTO.exec(linea);
  return m ? m[1] : null;
}

/** La línea marcadora de una foto, tal como se escribe en el informe. */
export function lineaFoto(url: string): string {
  return `[foto: ${url.trim()}]`;
}

/**
 * ¿Es una URL que se puede meter en un `<img>` de un correo?
 *
 * Solo http(s). El texto del informe lo escribe gente —en Admin y en la ficha de
 * la visita— y termina pegado en un cliente de correo: un `javascript:` o un
 * `data:` con HTML adentro no tiene por qué llegar hasta allá.
 */
export function esUrlFotoSegura(url: string): boolean {
  return /^https?:\/\/[^\s"'<>]+$/i.test(url.trim());
}

const escaparTexto = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escaparAtributo = (s: string): string => escaparTexto(s).replace(/"/g, '&quot;');

// Estilos EN LÍNEA, no clases: el correo se pega en Gmail, que descarta las
// hojas de estilo pero respeta el atributo `style`.
const ESTILO_P = 'margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;';
const ESTILO_IMG = 'max-width:100%;height:auto;border:0;display:block;';

/**
 * El informe como HTML listo para pegar en el correo.
 *
 * Cada bloque separado por una línea en blanco es un `<p>`; los saltos simples
 * quedan como `<br>` para no perder las viñetas de cada habitación. Un marcador
 * de foto se convierte en su `<img>`; si la URL no es http(s), se imprime tal
 * cual como texto en vez de generar una etiqueta rara.
 */
export function informeAHtml(texto: string): string {
  const salida: string[] = [];
  let parrafo: string[] = [];

  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    salida.push(`<p style="${ESTILO_P}">${parrafo.map(escaparTexto).join('<br>')}</p>`);
    parrafo = [];
  };

  for (const linea of String(texto ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const url = urlDeLineaFoto(linea);
    if (url && esUrlFotoSegura(url)) {
      cerrarParrafo();
      salida.push(
        `<p style="${ESTILO_P}"><img src="${escaparAtributo(url)}" alt="" style="${ESTILO_IMG}"></p>`,
      );
      continue;
    }
    if (!linea.trim()) {
      cerrarParrafo();
      continue;
    }
    parrafo.push(linea);
  }
  cerrarParrafo();
  return salida.join('\n');
}

/**
 * El informe en texto plano, para el portapapeles de respaldo y para cualquier
 * lugar que no entienda HTML. El marcador se reduce a su URL desnuda: si el
 * pegado con formato falla, la vendedora igual tiene el link a mano.
 */
export function informeATextoPlano(texto: string): string {
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linea) => {
      const url = urlDeLineaFoto(linea);
      return url && esUrlFotoSegura(url) ? url : linea;
    })
    .join('\n');
}

/** Las URLs de todas las fotos del informe, en orden y sin repetir. */
export function fotosDelInforme(texto: string): string[] {
  const vistas = new Set<string>();
  for (const linea of String(texto ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const url = urlDeLineaFoto(linea);
    if (url && esUrlFotoSegura(url)) vistas.add(url);
  }
  return [...vistas];
}

/**
 * El texto seguido de sus fotos, una por línea. Es como se arma cada intro y
 * cada bloque fijo al componer el esqueleto.
 */
export function textoConFotos(texto: string, fotos: readonly string[] | undefined): string {
  const base = String(texto ?? '').trim();
  const lineas = (fotos ?? []).filter((u) => esUrlFotoSegura(u)).map(lineaFoto);
  return [base, ...lineas].filter(Boolean).join('\n');
}

/**
 * El path dentro del bucket a partir de la URL pública, para poder BORRAR el
 * archivo cuando se quita la foto. Devuelve '' si la URL no es de este bucket
 * (una foto pegada a mano desde otro lado se saca del texto y nada más).
 */
export function pathDeUrlPublica(url: string, bucket = BUCKET_INFORME): string {
  const marca = `/storage/v1/object/public/${bucket}/`;
  const i = String(url ?? '').indexOf(marca);
  if (i < 0) return '';
  try {
    return decodeURIComponent(url.slice(i + marca.length).split('?')[0]);
  } catch {
    return '';
  }
}

/** Normaliza una lista de fotos guardada: solo URLs válidas, sin repetir, con tope. */
export function normalizarFotos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const vistas = new Set<string>();
  for (const v of raw) {
    const url = String(v ?? '').trim();
    if (url && esUrlFotoSegura(url)) vistas.add(url);
    if (vistas.size >= MAX_FOTOS_TEXTO) break;
  }
  return [...vistas];
}
