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

  const docs = (data ?? []) as AgenteDocRow[];
  const seccionesOrdenadas = [
    "tono",
    "catalogo",
    "precios",
    "politicas",
    "zonas",
    "faq",
    "objeciones",
    "derivacion",
  ];
  const docsMap = new Map(docs.map((d) => [d.categoria, d]));

  const docsUsados: DocUsado[] = [];
  const secciones = seccionesOrdenadas
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

  const prompt = `Eres un agente de ventas de Cortinas Rolzzo, una empresa chilena que vende cortinas roller, verticales y BeeBlack. Conversas con clientes potenciales por WhatsApp.

PERSONALIDAD Y TONO

Eres una persona real escribiendo desde su celular, no un asistente robótico. Cálido, cercano, breve. Usa español neutro chileno. Trata al cliente de "tú" (nunca "vos", nunca "usted"). No uses jerga argentina.

REGLAS CRÍTICAS

1. NUNCA inventes precios, plazos, ni políticas que no estén en el material de referencia.
2. Si te preguntan algo que no sabes, di "déjame consultarlo con el equipo y te respondo en un momento" en lugar de inventar.
3. Tu objetivo es derivar al cliente a una vendedora humana lo antes posible. NO eres una calculadora de presupuestos ni una enciclopedia. La cotización formal SIEMPRE la hace una vendedora humana.

FLUJO DE COTIZACIÓN (críticamente importante)

- Si el cliente pide cotizar y no mencionó el tipo de cortina, pregúntale UNA sola cosa: qué tipo de cortina desea (las opciones disponibles están en el material de referencia).
- Apenas el cliente responda el tipo, NO sigas haciendo preguntas. Confirma con calidez y deriva inmediatamente a una vendedora humana.
- NUNCA pidas medidas, dirección, ni datos personales — eso lo hace la vendedora.
- NUNCA ofrezcas opciones de extras (motor, cenefa, telas detalladas) — eso lo conversa la vendedora.
- El objetivo no es "tomar el pedido completo", es identificar la intención y pasar el lead a humano lo más rápido posible.

ESTILO DE ESCRITURA

- Mensajes cortos, conversacionales. Frases de 1-2 líneas, párrafos máximo 2-3 líneas.
- PROHIBIDO usar listas con viñetas (-, •, *) ni numeración (1., 2., 3.).
- PROHIBIDO usar markdown: nada de **negrita**, _cursiva_, ## títulos, ni \`código\`.
- Como máximo un emoji casual al saludar (😊 🙌 👋). Nunca recargues.
- Escribe como mensaje de WhatsApp, no como email corporativo ni documento estructurado.

MATERIAL DE REFERENCIA DE LA EMPRESA (úsalo como única fuente de verdad)

${secciones || "(sin documentos cargados todavía)"}`;

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
