// La segunda opinión, SOLO cuando el parecido no alcanza.
//
// El parecido visual no sabe leer. Dos tamaños del mismo kit, un E01 y un E39,
// o dos beige de la misma familia le dan casi el mismo número. Cuando eso pasa
// —el mejor candidato no llega a «seguro», o los dos primeros están empatados—
// se le muestran a Claude la foto y las fotos de los candidatos, y elige. De
// paso lee cualquier código impreso en la etiqueta, que es lo que de verdad
// zanja el empate.
//
// Va en una llamada APARTE (acción `juzgar`) y no dentro de `reconocer`: los
// candidatos tienen que aparecer en pantalla en dos segundos. Esto demora entre
// 5 y 15 s y llega después, reordenando la lista.

import Anthropic from "@anthropic-ai/sdk";
import { encodeBase64 } from "@std/encoding";
import { type Actor, BUCKET, partesDataUrl } from "./comun.ts";

const MODELO = "claude-opus-5";
/** Más de cuatro fotos de referencia encarecen y no mejoran la elección. */
const MAX_CANDIDATOS = 4;

export type CandidatoJuez = {
  dominio: string;
  cod: string;
  nombre: string;
  foto_url?: string | null;
  foto_bucket?: string | null;
  foto_path?: string | null;
};

export type Juicio = {
  eleccion: string | null;
  confianza: "alta" | "media" | "baja";
  codigo_leido: string | null;
  motivo: string;
};

const SISTEMA = `Eres el ayudante de bodega de una fábrica de cortinas (Chile).
Te llega la foto de un artículo que alguien acaba de sacar con el teléfono y las
fotos de los candidatos que el sistema encontró parecidos. Tu trabajo es decir
cuál es, o decir que ninguno.

Reglas:
- Elige SOLO uno de los códigos de la lista, o null. Nunca inventes un código.
- Si en la foto se ve un código impreso, una etiqueta o una marca, léelo y
  ponlo en codigo_leido tal cual está escrito. Eso vale más que el parecido.
- Fíjate en el TAMAÑO relativo, la forma de las piezas y el color exacto: los
  candidatos suelen ser variantes del mismo artículo y la diferencia es chica.
- Si dudas entre dos, elige el que mejor calce y pon confianza "baja". Es peor
  afirmar de más que decir que no estás seguro: la persona confirma después.
- motivo: una frase corta, en español neutro, diciendo en qué te fijaste.`;

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["eleccion", "confianza", "codigo_leido", "motivo"],
  properties: {
    eleccion: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "El código exacto del candidato elegido, o null si ninguno calza.",
    },
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
    codigo_leido: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "El código que se alcanza a leer en la foto, o null.",
    },
    motivo: { type: "string" },
  },
};

type Imagen = { mediaType: string; data: string };

/** La foto de referencia de un candidato, venga del bucket o de su ficha. */
async function cargarImagen(actor: Actor, c: CandidatoJuez): Promise<Imagen | null> {
  try {
    if (c.foto_bucket === BUCKET && c.foto_path) {
      const { data } = await actor.admin.storage.from(BUCKET).download(c.foto_path);
      if (!data) return null;
      const tipo = data.type && data.type.startsWith("image/") ? data.type : "image/jpeg";
      return { mediaType: tipo, data: encodeBase64(new Uint8Array(await data.arrayBuffer())) };
    }
    // Foto de la ficha: es una URL pública del mismo proyecto.
    const url = c.foto_path && !c.foto_bucket ? c.foto_path : c.foto_url;
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "image/jpeg";
    if (!tipo.startsWith("image/") || /hei[cf]/.test(tipo)) return null;
    return { mediaType: tipo.split(";")[0], data: encodeBase64(new Uint8Array(await res.arrayBuffer())) };
  } catch {
    // Una referencia que no se pudo bajar no puede tumbar la consulta: se juzga
    // con las que sí están.
    return null;
  }
}

function validarJuicio(crudo: unknown, codsPermitidos: string[]): Juicio {
  const o = (crudo ?? {}) as Record<string, unknown>;
  const eleccionCruda = typeof o.eleccion === "string" ? o.eleccion.trim().toUpperCase() : "";
  // Un código que no estaba entre los candidatos no se acepta: el modelo no
  // elige fuera de la lista.
  const eleccion = codsPermitidos.includes(eleccionCruda) ? eleccionCruda : null;
  const conf = String(o.confianza ?? "").toLowerCase();
  return {
    eleccion,
    confianza: conf === "alta" || conf === "media" ? (conf as "alta" | "media") : "baja",
    codigo_leido: typeof o.codigo_leido === "string" && o.codigo_leido.trim()
      ? o.codigo_leido.trim()
      : null,
    motivo: typeof o.motivo === "string" ? o.motivo.trim().slice(0, 300) : "",
  };
}

/**
 * Le muestra a Claude la foto y los candidatos. Devuelve `null` cuando no se
 * pudo juzgar (sin referencias, o el modelo se negó): la lista se queda como
 * estaba, que es un resultado perfectamente usable.
 */
export async function juzgar(
  actor: Actor,
  apiKey: string,
  consulta: string,
  candidatos: CandidatoJuez[],
): Promise<Juicio | null> {
  const lista = candidatos.slice(0, MAX_CANDIDATOS);
  if (lista.length === 0) return null;

  const imagenes = await Promise.all(lista.map((c) => cargarImagen(actor, c)));
  const conFoto = lista.filter((_, i) => imagenes[i] !== null);
  if (conFoto.length === 0) return null;

  const q = partesDataUrl(consulta);
  const contenido: unknown[] = [
    { type: "text", text: "FOTO A IDENTIFICAR:" },
    { type: "image", source: { type: "base64", media_type: q.mediaType, data: q.data } },
  ];
  lista.forEach((c, i) => {
    const img = imagenes[i];
    if (!img) return;
    contenido.push({ type: "text", text: `CANDIDATO ${c.cod} — ${c.nombre}:` });
    contenido.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  });
  contenido.push({
    type: "text",
    text: `Códigos entre los que puedes elegir: ${conFoto.map((c) => c.cod).join(", ")}. ` +
      "Responde con el esquema pedido.",
  });

  const anthropic = new Anthropic({ apiKey });
  const pedido = {
    model: MODELO,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    system: SISTEMA,
    messages: [{ role: "user", content: contenido }],
  };

  let respuesta: Anthropic.Message;
  try {
    respuesta = await anthropic.messages.create(
      pedido as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError && /thinking/i.test(e.message)) {
      const { thinking: _sinPensar, ...sinThinking } = pedido;
      respuesta = await anthropic.messages.create(
        sinThinking as unknown as Anthropic.MessageCreateParamsNonStreaming,
      );
    } else {
      throw e;
    }
  }

  if (respuesta.stop_reason === "refusal" || respuesta.stop_reason === "max_tokens") return null;

  const texto = respuesta.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
  try {
    return validarJuicio(JSON.parse(texto), conFoto.map((c) => c.cod));
  } catch {
    return null;
  }
}
