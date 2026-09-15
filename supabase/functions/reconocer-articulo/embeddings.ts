// La «huella» de una foto: 1024 números que resumen cómo se ve.
//
// Dos fotos del mismo artículo dan huellas parecidas aunque cambien la luz, el
// ángulo o el fondo; dos artículos distintos dan huellas lejanas. Comparar
// huellas es una resta, y eso lo hace la base en milisegundos — por eso el
// trabajo pesado (mirar la foto) se hace UNA vez, al enseñar, y no en cada
// consulta.
//
// El servicio es Voyage AI. Se eligió por sobre un modelo dentro del navegador
// porque el teléfono de la bodega no tiene que descargar 90 MB ni calcular
// nada, y porque la huella de la foto de referencia y la de la consulta tienen
// que salir del MISMO modelo: si cada teléfono calculara la suya, dejarían de
// compararse entre ellas.
//
// Precio: US$ 0,60 por mil millones de píxeles, con los primeros 150.000
// millones gratis (unas 75.000 fotos). Una foto de 1024 px ≈ 1 M de píxeles.

import { MODELO_EMB } from "./comun.ts";

const ENDPOINT = "https://api.voyageai.com/v1/multimodalembeddings";
/** Una foto de 1024 px tarda ~1 s. Más de esto es que el servicio está caído. */
const TIMEOUT_MS = 20000;
/** Tres intentos: el 429 de una cuenta nueva se pasa solo esperando. */
const INTENTOS = 3;

export type ResultadoEmbedding = { vectores: number[][]; pixeles: number };

export class ErrorEmbedding extends Error {
  status: number;
  /** Cuánto conviene esperar antes de volver a intentar (solo en el 429). */
  esperaMs: number;
  constructor(mensaje: string, status = 502, esperaMs = 0) {
    super(mensaje);
    this.status = status;
    this.esperaMs = esperaMs;
  }
}

/**
 * Cuánto esperar antes del siguiente intento. Voyage manda `retry-after`
 * cuando sabe el número; si no, se espera cada vez más (2 s, 6 s).
 */
function esperaDe(res: Response, intento: number): number {
  const seg = Number(res.headers.get("retry-after") ?? "");
  if (Number.isFinite(seg) && seg > 0) return Math.min(seg * 1000, 30000);
  return 2000 * Math.pow(3, intento);
}

async function pedir(dataUrls: string[], apiKey: string): Promise<Response> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    return await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO_EMB,
        // Una entrada por foto, cada una con un solo contenido: la imagen. Sin
        // texto: el nombre del artículo lo pone la base al juntar, y meterlo acá
        // haría que dos artículos con nombres parecidos se acercaran aunque se
        // vean distinto.
        inputs: dataUrls.map((u) => ({ content: [{ type: "image_base64", image_base64: u }] })),
        truncation: true,
      }),
      signal: control.signal,
    });
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Las huellas de varias fotos en una sola llamada (hasta 1.000 según Voyage;
 * acá se usan de a 25 en el reindexado). Devuelve los vectores EN EL MISMO
 * ORDEN que las fotos.
 */
export async function embedImagenes(dataUrls: string[], apiKey: string): Promise<ResultadoEmbedding> {
  if (!apiKey) {
    throw new ErrorEmbedding(
      "Falta el secret VOYAGE_API_KEY en Supabase: el reconocimiento no está disponible.",
      503,
    );
  }
  if (dataUrls.length === 0) return { vectores: [], pixeles: 0 };

  // Un 429 (demasiadas seguidas) o un 5xx se reintentan esperando cada vez más:
  // una cuenta recién creada de Voyage acepta pocas llamadas por minuto, y el
  // reindexado manda lotes uno atrás del otro.
  let res: Response;
  for (let intento = 0;; intento++) {
    try {
      res = await pedir(dataUrls, apiKey);
    } catch (e) {
      const aborto = e instanceof DOMException && e.name === "AbortError";
      throw new ErrorEmbedding(
        aborto
          ? "El motor de reconocimiento tardó demasiado. Vuelve a intentar."
          : `No se pudo llegar al motor de reconocimiento: ${e instanceof Error ? e.message : String(e)}`,
        504,
      );
    }
    const reintentable = res.status === 429 || res.status >= 500;
    if (!reintentable || intento >= INTENTOS - 1) break;
    await new Promise((r) => setTimeout(r, esperaDe(res, intento)));
  }

  if (!res.ok) {
    const detalle = (await res.text().catch(() => "")).slice(0, 200).trim();
    if (res.status === 401 || res.status === 403) {
      throw new ErrorEmbedding("La llave del motor de reconocimiento no es válida (VOYAGE_API_KEY).", 503);
    }
    if (res.status === 429) {
      // El motivo exacto viaja en el cuerpo (límite por minuto o cupo agotado):
      // se muestra tal cual, porque la solución de cada uno es distinta.
      throw new ErrorEmbedding(
        `El motor de reconocimiento no acepta más fotos por ahora. ${detalle}`.trim(),
        429,
        esperaDe(res, 1),
      );
    }
    throw new ErrorEmbedding(
      `El motor de reconocimiento respondió ${res.status}. ${detalle}`.trim(),
      502,
    );
  }

  const cuerpo = (await res.json().catch(() => null)) as
    | { data?: Array<{ embedding?: number[]; index?: number }>; usage?: { image_pixels?: number } }
    | null;
  const filas = cuerpo?.data ?? [];
  if (filas.length !== dataUrls.length) {
    throw new ErrorEmbedding("El motor de reconocimiento devolvió menos huellas que fotos.", 502);
  }

  // Voyage trae un `index` por fila: se respeta, en vez de confiar en el orden.
  const vectores: number[][] = new Array(dataUrls.length);
  filas.forEach((f, i) => {
    const pos = typeof f.index === "number" ? f.index : i;
    const v = f.embedding;
    if (!Array.isArray(v) || v.length === 0) {
      throw new ErrorEmbedding("El motor de reconocimiento devolvió una huella vacía.", 502);
    }
    vectores[pos] = v;
  });

  return { vectores, pixeles: cuerpo?.usage?.image_pixels ?? 0 };
}

/**
 * Los vectores viajan a Postgres como texto: `[0.1,0.2,…]` es justo el formato
 * de entrada del tipo `vector`. Se recortan a 6 decimales — el parecido no
 * cambia y el cuerpo de la consulta baja a la mitad.
 */
export function comoVector(v: number[]): string {
  return `[${v.map((n) => Number(n.toFixed(6))).join(",")}]`;
}
