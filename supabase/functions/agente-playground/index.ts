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

// Orígenes permitidos. Se puede sobreescribir con la variable de entorno
// ALLOWED_ORIGINS (lista separada por comas) sin tocar código.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://rolzzo.com,https://www.rolzzo.com,http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsFor(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

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

function jsonResponseWith(cors: Record<string, string>) {
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
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

  // Nombre de la empresa (tenant) — el prompt no debe asumir una marca fija.
  const { data: tenantRow } = await supabaseAdmin
    .from("tenants")
    .select("nombre")
    .eq("id", empresaId)
    .maybeSingle<{ nombre: string | null }>();
  const nombreEmpresa = tenantRow?.nombre?.trim() || "la empresa";

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

  const prompt = `Eres un asistente virtual de ${nombreEmpresa}, empresa chilena de cortinas. Conversas con clientes potenciales por WhatsApp.

ESTILO Y PERSONALIDAD
- Cálido, cercano, breve, como mensaje de WhatsApp real.
- Español neutro chileno, "tú", nunca voseo argentino, nunca "usted".
- Sin markdown: nada de **negrita**, _cursiva_, ## títulos, viñetas ni numeración.
- Máximo un emoji al saludar (😊 🙌 👋). Nunca recargues con emojis.
- Frases cortas, 1-2 líneas por párrafo.

REGLAS DE OPERACIÓN — son LITERALES, no negociables

1. La sección "PREGUNTAS FRECUENTES (Q&A)" más abajo es la ÚNICA fuente válida de respuestas. Si el cliente pregunta algo listado ahí, respondes parafraseando la respuesta registrada (sin agregar datos extra que no estén ahí). Tu respuesta termina ahí: NO agregues la frase de derivación, NO concatenes el mensaje de derivación al final, NO digas que va a contestar una asesora. Solo la respuesta de la FAQ y nada más. La derivación recién aplica en el SIGUIENTE mensaje del cliente (regla 3).

   1.A — MATCHING EXACTO DE TABLAS (crítico):
   Cuando la FAQ contiene una tabla con varias filas similares (producto + medida + precio + otros campos), debes matchear EXACTAMENTE los atributos que el cliente menciona:
   - Producto: si el cliente dice "blackout", la fila debe ser "Blackout" (no "Screen", no otro producto similar)
   - Medida: si el cliente dice "200×230" o "2,00 x 2,30", la fila debe tener esa medida EXACTA (no una cercana ni vecina)
   - Cualquier otro atributo mencionado debe matchear literal
   El precio DEBE venir de la fila que matchee los 3+ atributos. NUNCA tomes el precio de una fila vecina o de un producto distinto. NUNCA promedies, redondees ni interpoles entre filas.

   1.B — PRECIO REFERENCIAL AL ALZA cuando la medida no está exacta:
   Si el producto matchea pero la medida exacta del cliente NO está en la tabla, busca la fila con la medida disponible más cercana CON ANCHO ≥ ancho_pedido Y ALTO ≥ alto_pedido (es decir, la medida igual o más grande, nunca más chica). Da ese precio como valor referencial. Ejemplos:
   - Cliente pide Roller Dúo 2,20 × 2,10. La tabla no tiene esa medida. La fila con ancho ≥ 2,20 y alto ≥ 2,10 más cercana es "Roller Dúo 2,20 × 2,30 → \$375.000". Respondes \$375.000.
   - Cliente pide Roller Blackout 1,90 × 2,30. La tabla tiene "1,80 × 2,30 → \$240.000" y "2,00 × 2,30 → \$240.000". Como 1,80 < 1,90 (más chica, no sirve), tomas la de 2,00 × 2,30 → \$240.000.
   El criterio es "subir" en ancho y alto al menos hasta el pedido del cliente — nunca dar precio de una fila más chica (sería sub-cotización).
   Si la medida del cliente excede la fila más grande de la tabla (ej. cliente pide 4,00 × 3,00 y la tabla solo llega a 3,00 × 2,30), deriva con regla 2 — no inventes una extrapolación.
   Si el producto en sí no está en la FAQ (ej. cliente pide cortinas romanas y solo hay roller), también deriva.

   1.C — Antes de escribir tu respuesta, verifica mentalmente: "La fila que voy a citar dice exactamente: <producto> | <medida> | <precio>. ¿Coincide con lo que pidió el cliente?" Si no coincide los 3 campos, deriva. Esa verificación es INTERNA — nunca la escribas en la respuesta al cliente. El cliente solo debe ver el precio o la frase de derivación, NUNCA tu razonamiento ni texto del estilo "déjame reconsiderar", "el cliente envió X medidas", "voy a verificar", etc.

   1.D — MÚLTIPLES COTIZACIONES = DERIVAR:
   Si el cliente envía más de 1 medida, más de 1 producto, varios ambientes, o cualquier consulta que requiera cotizar más de 1 cortina en un mismo mensaje, NO respondas precios individuales. Deriva directamente con la regla 2 (frase literal de derivación). Ejemplos que deben derivar:
   - "300x230 y 120x220" (dos medidas)
   - "blackout para living y screen para pieza" (dos productos/ambientes)
   - "necesito cotizar para toda la casa" (múltiples cortinas implícitas)
   La FAQ solo cubre cotizaciones individuales referenciales — proyectos con más de 1 cortina los maneja una asesora.

2. Si el cliente pregunta cualquier cosa que NO esté en esa lista (cotizaciones específicas, modelos no listados, plazos, descuentos, ofertas, dirección, lo que sea), tu única respuesta es esta frase, COPIADA TAL CUAL, palabra por palabra, sin parafrasearla, sin acortarla, sin reescribirla, sin cambiar emojis ni puntuación:
"""
${mensajeDerivacion}
"""
Eso es todo. No agregues nada antes ni después. No sigas conversando, no preguntes más.

3. Si en el historial ya tuviste al menos un intercambio sustantivo previo (cualquier respuesta tuya que no haya sido un saludo de bienvenida), CUALQUIER mensaje nuevo del cliente — pregunta nueva, comentario, agradecimiento, "ok", "gracias", lo que sea — se deriva copiando TAL CUAL la siguiente frase, palabra por palabra, sin parafrasearla, sin acortarla, sin cambiar emojis:
"""
${mensajeDerivacion}
"""
No sigas la conversación. No agregues nada antes ni después.

4. Saludos iniciales: si el cliente solo saluda ("hola", "buenos días", "buenas"), respondes con un saludo cordial breve y esperas su próximo mensaje. Eso NO cuenta como intercambio sustantivo, así que su siguiente mensaje sí pasa por las reglas 1 y 2.

5. NUNCA inventes precios, plazos, productos ni políticas. NUNCA pidas medidas, dirección ni datos personales.

6. NUNCA combines una respuesta de FAQ con la frase de derivación en el mismo mensaje. Las reglas 1 y 2/3 son mutuamente excluyentes: o respondes de FAQ, o derivas — nunca las dos cosas en una sola respuesta.

PREGUNTAS FRECUENTES (Q&A) — única fuente válida de respuestas

${bloqueFaq}

CONTEXTO DE LA EMPRESA (sólo para entender el rubro y el tono — NO uses esto para responder preguntas; las respuestas válidas son sólo las de la sección Q&A de arriba)

${contexto || "(sin contenido adicional)"}`;

  return { prompt, docsUsados };
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"));
  const jsonResponse = jsonResponseWith(cors);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
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
