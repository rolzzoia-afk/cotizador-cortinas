// Edge Function: escanear-factura
//
// Lee el papel que llegó con la mercadería —factura, guía o boleta, en PDF o
// foto— y devuelve lo que la bodega necesita para contar: el proveedor, el
// número, la fecha y las líneas con código, descripción y cantidad. SIN
// PRECIOS: el esquema de la respuesta no tiene dónde ponerlos.
//
// Recibe { path } de un archivo que el navegador YA subió al bucket privado
// `docs-recepciones`. No escribe nada: lo leído vuelve a la pantalla, una
// persona lo revisa y recién ahí se guarda con `recepcion_abrir`. Una lectura
// que se equivoca no alcanza a tocar la base.
//
// El emparejado con la orden NO se le pide al modelo (se hace en el navegador,
// con reglas que se pueden probar): así no puede inventar líneas que la orden
// traía y el papel no.
//
// Secrets: ANTHROPIC_API_KEY (la misma del informe de visita).

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "@anthropic-ai/sdk";
// Base64 del estándar de Deno: `btoa(String.fromCharCode(...bytes))` revienta
// la pila con un PDF de pocos MB.
import { encodeBase64 } from "@std/encoding";
import { ESQUEMA, SISTEMA, validarExtraccion } from "./esquema.ts";

function limpiarSecret(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

const ANTHROPIC_API_KEY = limpiarSecret(Deno.env.get("ANTHROPIC_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Opus 5 con esfuerzo medio: 10 a 30 segundos por papel. Si molesta, bajar a
// "claude-sonnet-5" es cambiar esta línea.
const MODELO = "claude-opus-5";
const BUCKET = "docs-recepciones";
const MAX_BYTES = 10 * 1024 * 1024;
const ROLES_OK = ["admin", "superadmin", "operario", "bodeguero"];

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://rolzzo.com,https://www.rolzzo.com,http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsFor(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponseWith(cors: Record<string, string>) {
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}

const IMAGENES: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Qué es el archivo: por el tipo que guardó el bucket, o por la extensión. */
function tipoDeArchivo(blob: Blob, path: string): "pdf" | "heic" | keyof typeof IMAGENES | null {
  const t = (blob.type || "").toLowerCase();
  const ext = (path.split(".").pop() ?? "").toLowerCase();
  if (t === "application/pdf" || ext === "pdf") return "pdf";
  if (/image\/hei[cf]/.test(t) || ext === "heic" || ext === "heif") return "heic";
  if (IMAGENES[t]) return t as keyof typeof IMAGENES;
  if (IMAGENES[ext]) return ext as keyof typeof IMAGENES;
  return null;
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"));
  const jsonResponse = jsonResponseWith(cors);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  try {
    if (!ANTHROPIC_API_KEY) {
      return jsonResponse(
        { error: "Falta el secret ANTHROPIC_API_KEY en Supabase: la lectura automática no está disponible." },
        503,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Falta Authorization Bearer" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return jsonResponse({ error: "Sesión inválida" }, 401);

    const { data: perfil } = await admin
      .from("perfiles")
      .select("empresa_id, rol")
      .eq("id", userRes.user.id)
      .maybeSingle();
    if (!perfil?.empresa_id) return jsonResponse({ error: "Tu usuario no tiene empresa" }, 403);
    if (!ROLES_OK.includes(String(perfil.rol))) {
      return jsonResponse({ error: "Tu rol no puede recibir mercadería" }, 403);
    }
    const empresaId = String(perfil.empresa_id);

    const { data: encendido } = await admin.rpc("inventario_flag", {
      p_empresa_id: empresaId,
      p_flag: "compras",
    });
    if (encendido !== true) {
      return jsonResponse({ error: "El módulo de Compras está apagado" }, 409);
    }

    const body = await req.json().catch(() => ({}));
    const path = String(body?.path ?? "").trim();
    if (!path) return jsonResponse({ error: "Falta path" }, 400);
    // El archivo tiene que ser de esta empresa: el path empieza por su id.
    if (!path.startsWith(`${empresaId}/`)) {
      return jsonResponse({ error: "El documento no pertenece a esta empresa" }, 403);
    }

    const { data: archivo, error: dlErr } = await admin.storage.from(BUCKET).download(path);
    if (dlErr || !archivo) {
      return jsonResponse({ error: `No se pudo leer el documento subido: ${dlErr?.message ?? ""}` }, 404);
    }
    if (archivo.size > MAX_BYTES) {
      return jsonResponse({ error: "El documento pesa más de 10 MB: súbelo en una foto más liviana." }, 413);
    }

    const tipo = tipoDeArchivo(archivo, path);
    if (tipo === "heic") {
      return jsonResponse(
        {
          error:
            "Este archivo es HEIC y no se puede leer. Saca la foto en JPG (iPhone: Ajustes → Cámara → " +
            "Formatos → Más compatible) o súbela como PDF. La foto quedó guardada como respaldo.",
        },
        415,
      );
    }
    if (!tipo) {
      return jsonResponse({ error: "Solo se leen PDF o fotos (JPG, PNG o WebP)." }, 415);
    }

    const data = encodeBase64(new Uint8Array(await archivo.arrayBuffer()));
    const bloqueArchivo = tipo === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: IMAGENES[tipo], data } };

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const pedido = {
      model: MODELO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      system: SISTEMA,
      messages: [
        {
          role: "user",
          content: [bloqueArchivo, { type: "text", text: "Extrae los datos de este documento." }],
        },
      ],
    };

    let respuesta: Anthropic.Message;
    try {
      respuesta = await anthropic.messages.create(
        pedido as unknown as Anthropic.MessageCreateParamsNonStreaming,
      );
    } catch (e) {
      // Si la API no acepta pensar y responder con esquema a la vez, se lee
      // igual sin pensar: una lectura algo menos cuidadosa es mejor que nada.
      if (e instanceof Anthropic.BadRequestError && /thinking/i.test(e.message)) {
        const { thinking: _sinPensar, ...sinThinking } = pedido;
        respuesta = await anthropic.messages.create(
          sinThinking as unknown as Anthropic.MessageCreateParamsNonStreaming,
        );
      } else {
        throw e;
      }
    }

    if (respuesta.stop_reason === "refusal") {
      return jsonResponse({ error: "La lectura automática no pudo leer este documento. Sigue sin ella." }, 422);
    }
    if (respuesta.stop_reason === "max_tokens") {
      return jsonResponse(
        { error: "El documento es demasiado largo para leerlo de una vez. Sigue sin lectura automática." },
        422,
      );
    }

    const texto = respuesta.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();
    let crudo: unknown;
    try {
      crudo = JSON.parse(texto);
    } catch {
      return jsonResponse({ error: "La lectura devolvió algo que no se entiende. Vuelve a intentar." }, 502);
    }

    return jsonResponse({
      ok: true,
      extraccion: validarExtraccion(crudo),
      modelo: respuesta.model,
      usage: respuesta.usage,
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      return jsonResponse(
        {
          error: `La lectura automática no respondió (${e.status ?? "sin estado"}). ` +
            "Vuelve a intentar o sigue sin lectura automática.",
        },
        502,
      );
    }
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
