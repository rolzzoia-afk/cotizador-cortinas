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
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("agente_docs")
    .select("categoria, contenido_md, activo")
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
  const docsMap = new Map(docs.map((d) => [d.categoria, d.contenido_md]));

  const secciones = seccionesOrdenadas
    .map((cat) => {
      const md = docsMap.get(cat);
      if (!md || !md.trim()) return null;
      return `## ${cat.toUpperCase()}\n\n${md.trim()}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  return `Eres un agente de ventas de Cortinas Rolzzo, una empresa chilena que vende cortinas roller, verticales y BeeBlack.

Tu trabajo es responder consultas de clientes potenciales por WhatsApp (aunque ahora estás en modo de prueba en un panel interno). Sé cálido, profesional y directo. Usa español neutro de Chile (no argentino, no español de España). Trata al cliente de "tú" — no uses "vos".

Reglas importantes:
- NUNCA inventes precios, plazos, ni políticas que no estén en el material de referencia más abajo.
- Si te preguntan algo que no sabés, di "voy a consultarlo con el equipo y te respondo en un momento" en vez de inventar.
- Si el cliente quiere cotización formal, pide medidas (ancho × alto en cm), tipo de cortina, ubicación (comuna), y deriva a una vendedora humana.
- Mensajes cortos, párrafos breves. Esto es WhatsApp, no un email corporativo.

Material de referencia de la empresa (úsalo como única fuente de verdad):

${secciones || "(sin documentos cargados todavía)"}`;
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

    const systemPrompt = await buildSystemPrompt(
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    return jsonResponse({ error: msg }, 500);
  }
});
