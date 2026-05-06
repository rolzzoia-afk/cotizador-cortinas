// Edge Function: agente-playground
// Recibe { message, history? } desde el panel admin, arma un system prompt
// con los agente_docs de la empresa del usuario autenticado, y devuelve la
// respuesta de Claude. Solo accesible para perfiles con rol 'admin'.

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMsg = { role: "user" | "assistant"; content: string };

type AgenteDocRow = {
  categoria: string;
  contenido_md: string;
  activo: boolean;
  version: number;
  updated_at: string;
};

type DocUsado = {
  categoria: string;
  version: number;
  updated_at: string;
  caracteres: number;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const MENSAJE_DERIVACION_DEFAULT =
  "Te derivo con una de nuestras vendedoras para que te ayude mejor con eso 🙌";

async function buildSystemPrompt(
  supabaseAdmin: ReturnType<typeof createClient>,
  empresaId: string,
): Promise<{ prompt: string; docsUsados: DocUsado[] }> {
  const { data, error } = await supabaseAdmin
    .from("agente_docs")
    .select("categoria, contenido_md, activo, version, updated_at")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("categoria");

  if (error) throw new Error(`agente_docs: ${error.message}`);

  // Frase de derivación configurable desde /admin → Agente IA → mensaje_fallback.
  // Si la jefa no la setea, usamos el default. Misma frase para "fuera de FAQ"
  // y "tras intercambio sustantivo" — un solo punto de edición.
  const { data: configRow } = await supabaseAdmin
    .from("empresa_agente_config")
    .select("mensaje_fallback")
    .eq("empresa_id", empresaId)
    .maybeSingle<{ mensaje_fallback: string | null }>();
  const mensajeDerivacion =
    (configRow?.mensaje_fallback?.trim()) || MENSAJE_DERIVACION_DEFAULT;

  const docs = (data ?? []) as AgenteDocRow[];
  const docsMap = new Map(docs.map((d) => [d.categoria, d]));

  const docsUsados: DocUsado[] = [];

  // FAQ se trata aparte: es la única fuente válida de respuestas.
  const docFaq = docsMap.get("faq");
  let bloqueFaq = "(la jefa todavía no cargó preguntas frecuentes)";
  if (docFaq && docFaq.contenido_md.trim()) {
    docsUsados.push({
      categoria: "faq",
      version: docFaq.version,
      updated_at: docFaq.updated_at,
      caracteres: docFaq.contenido_md.trim().length,
    });
    bloqueFaq = docFaq.contenido_md.trim();
  }

  // Las demás secciones son contexto secundario para tono/personalidad,
  // NO fuente de respuestas. Se incluyen para que el modelo entienda el
  // rubro pero el prompt deja claro que no debe usarlas para responder.
  const contextoOrdenado = [
    "tono",
    "catalogo",
    "precios",
    "politicas",
    "zonas",
    "objeciones",
    "derivacion",
  ];
  const contexto = contextoOrdenado
    .map((cat) => {
      const doc = docsMap.get(cat);
      if (!doc || !doc.contenido_md.trim()) return null;
      docsUsados.push({
        categoria: cat,
        version: doc.version,
        updated_at: doc.updated_at,
        caracteres: doc.contenido_md.trim().length,
      });
      return `## ${cat.toUpperCase()}\n\n${doc.contenido_md.trim()}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  const prompt = `Eres un asistente virtual de Cortinas Rolzzo, empresa chilena de cortinas. Conversas con clientes potenciales por WhatsApp.

ESTILO Y PERSONALIDAD
- Cálido, cercano, breve, como mensaje de WhatsApp real.
- Español neutro chileno, "tú", nunca voseo argentino, nunca "usted".
- Sin markdown: nada de **negrita**, _cursiva_, ## títulos, viñetas ni numeración.
- Máximo un emoji al saludar (😊 🙌 👋). Nunca recargues con emojis.
- Frases cortas, 1-2 líneas por párrafo.

REGLAS DE OPERACIÓN — son LITERALES, no negociables

1. La sección "PREGUNTAS FRECUENTES (Q&A)" más abajo es la ÚNICA fuente válida de respuestas. Si el cliente pregunta algo listado ahí, respondes parafraseando la respuesta registrada (sin agregar datos extra que no estén ahí).

2. Si el cliente pregunta cualquier cosa que NO esté en esa lista (cotizaciones específicas, modelos no listados, plazos, descuentos, ofertas, dirección, lo que sea), respondes EXACTAMENTE:
"${mensajeDerivacion}"
y nada más. No sigas conversando, no preguntes más.

3. Si en el historial ya tuviste al menos un intercambio sustantivo previo (cualquier respuesta tuya que no haya sido un saludo de bienvenida), CUALQUIER mensaje nuevo del cliente — pregunta nueva, comentario, agradecimiento, "ok", "gracias", lo que sea — se deriva con:
"${mensajeDerivacion}"
No sigas la conversación.

4. Saludos iniciales: si el cliente solo saluda ("hola", "buenos días", "buenas"), respondes con un saludo cordial breve y esperas su próximo mensaje. Eso NO cuenta como intercambio sustantivo, así que su siguiente mensaje sí pasa por las reglas 1 y 2.

5. NUNCA inventes precios, plazos, productos ni políticas. NUNCA pidas medidas, dirección ni datos personales.

PREGUNTAS FRECUENTES (Q&A) — única fuente válida de respuestas

${bloqueFaq}

CONTEXTO DE LA EMPRESA (sólo para entender el rubro y el tono — NO uses esto para responder preguntas; las respuestas válidas son sólo las de la sección Q&A de arriba)

${contexto || "(sin contenido adicional)"}`;

  return { prompt, docsUsados };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Falta Authorization Bearer" }, 401);
    }

    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userRes, error: userErr } = await supabaseUserClient.auth
      .getUser();
    if (userErr || !userRes?.user) {
      return jsonResponse({ error: "JWT inválido" }, 401);
    }
    const userId = userRes.user.id;

    const { data: perfil, error: perfilErr } = await supabaseAdmin
      .from("perfiles")
      .select("empresa_id, rol")
      .eq("id", userId)
      .maybeSingle();

    if (perfilErr) {
      return jsonResponse(
        { error: `perfil lookup: ${perfilErr.message}` },
        500,
      );
    }
    if (!perfil) {
      return jsonResponse({ error: "Perfil no encontrado" }, 403);
    }
    if (perfil.rol !== "admin" && perfil.rol !== "superadmin") {
      return jsonResponse(
        { error: "Solo admins pueden usar el playground" },
        403,
      );
    }

    const body = await req.json().catch(() => ({}));
    const message: string = (body?.message ?? "").toString();
    const history: ChatMsg[] = Array.isArray(body?.history) ? body.history : [];

    if (!message.trim()) {
      return jsonResponse({ error: "message vacío" }, 400);
    }

    const { prompt: systemPrompt, docsUsados } = await buildSystemPrompt(
      supabaseAdmin,
      perfil.empresa_id as string,
    );

    const messagesForClaude = [
      ...history
        .filter((m) => m && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({ role: m.role, content: String(m.content ?? "") })),
      { role: "user" as const, content: message },
    ];

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messagesForClaude,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return jsonResponse(
        { error: `anthropic ${anthropicRes.status}: ${errText}` },
        502,
      );
    }

    const data = await anthropicRes.json();
    const reply: string = (data?.content ?? [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join("\n")
      .trim();

    return jsonResponse({
      reply,
      usage: data?.usage ?? null,
      model: ANTHROPIC_MODEL,
      docs_usados: docsUsados,
      system_prompt_chars: systemPrompt.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    return jsonResponse({ error: msg }, 500);
  }
});
