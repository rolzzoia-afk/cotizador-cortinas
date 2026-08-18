// Edge Function: informe-visita
//
// Recibe { otId, audioPath } desde Fase 2, baja el audio de la visita del
// bucket privado `visitas`, lo transcribe y le pide a Claude que redacte el
// INFORME CLIENTE con esa transcripción más los datos reales de la OT.
//
// El vendedor puede editar el texto después: esto es un borrador que le ahorra
// escribir, no la última palabra.
//
// Secrets: ANTHROPIC_API_KEY (ya existe) y GROQ_API_KEY (nuevo).

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Limpia un secret pegado a mano: espacios de sobra y comillas alrededor.
 * Pegar la llave entre comillas en el Dashboard da exactamente el mismo
 * "Invalid API Key" que una llave equivocada, y es un rato perdido buscando.
 */
function limpiarSecret(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

const ANTHROPIC_API_KEY = limpiarSecret(Deno.env.get("ANTHROPIC_API_KEY"));
const GROQ_API_KEY = limpiarSecret(Deno.env.get("GROQ_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ANTHROPIC_MODEL = "claude-opus-5";
const BUCKET = "visitas";
// Whisper turbo: transcribe ~10 min de audio en decenas de segundos.
const GROQ_MODEL = "whisper-large-v3-turbo";

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

// Con esqueleto: la app ya armó la estructura con los datos REALES de la orden y
// el modelo solo la completa con lo conversado. Los datos duros (tela, códigos,
// colores, caída) no se le piden al modelo justamente para que no pueda
// equivocarlos: el cliente aprueba este texto.
const SYSTEM_PROMPT_ESQUELETO =
  `Completas el INFORME CLIENTE de una visita a terreno de Cortinas Rolzzo (Chile).

Recibes un ESQUELETO ya armado con los datos reales de la orden y la
TRANSCRIPCIÓN de lo que la vendedora habló en la casa. Tu trabajo es devolver el
mismo esqueleto ENRIQUECIDO con lo que se conversó.

Reglas que NO se rompen:
- Respeta la estructura del esqueleto EXACTAMENTE: las mismas secciones, en el
  mismo orden, con la misma numeración y los mismos guiones.
- Las líneas de datos (Tipo de Cortina, Color de Accesorios, Caída) se copian
  TAL CUAL. No cambies ni un código, ni una tela, ni un color, ni un número.
- No inventes medidas, precios, plazos ni compromisos. Si algo no está en el
  esqueleto ni en la transcripción, no lo menciones.
- No agregues secciones de habitaciones que no estén en el esqueleto.

Lo que SÍ agregas, cuando la transcripción lo respalde:
- En la habitación que corresponda, una línea nueva que empiece con
  "Se explicó en visita" contando lo que se conversó de esa ventana (paso de luz
  por instalar dentro del marco, desnivel del muro, un mueble que estorba, etc.).
- En la parte de arriba, si se mencionaron: variaciones de medidas o de precio
  respecto de lo cotizado antes y por qué, o material de techos y muros que
  pueda requerir platinas metálicas u otro anclaje especial.
- Ajusta la introducción de pasos de luz a lo que realmente se explicó.

Formato: texto plano en español neutro de Chile, en segunda persona ("en tu
caso", "te dejo"). Sin markdown, sin negritas, sin encabezados de carta, sin
saludos ni despedidas. Devuelve solo el texto del informe.`;

// Sin esqueleto (llamada antigua o una OT sin ventanas cargadas): prosa libre.
const SYSTEM_PROMPT_LIBRE = `Redactas el INFORME CLIENTE de una visita a terreno de Cortinas Rolzzo (Chile).

Escribes en español neutro de Chile, en segunda persona ("en tu caso", "te dejo"),
con el tono de una vendedora que acaba de estar en la casa del cliente y le resume
por escrito lo que conversaron. Nada de encabezados de carta, firmas ni saludos.

El informe se arma con lo que efectivamente se dijo en la visita y con los datos de
la orden. Cubre, cuando corresponda y SOLO si hay información para ello:
- Variaciones de precio o de medidas respecto de lo cotizado antes, y por qué.
- Pasos de luz: recordar que incluso las blackout dejan luz en laterales y parte
  superior, y que una cortina dividida en varios paños suma un paso de luz al centro
  de entre 4 y 7 cm; si lleva cenefa, que la cenefa reduce el paso de luz superior.
- El color de accesorios que quedó definido.
- Caídas internas o externas, cortes de cornisa, y si cada ventana va dentro o fuera
  del marco.
- El material del techo o muro y si podría requerir platinas metálicas u otro anclaje
  especial, a definir el día de la instalación.

Reglas que no se rompen:
- No inventes medidas, precios, plazos ni compromisos. Si un dato no está en la
  transcripción ni en la orden, no lo menciones.
- No repitas el listado completo de ventanas: el cliente ya lo tiene en la cotización.
- Párrafos cortos, separados por una línea en blanco. Sin viñetas ni markdown.
- Entre 3 y 8 párrafos. Devuelve solo el texto del informe.`;

type PanoOT = Record<string, unknown>;
type VentanaOT = Record<string, unknown> & { panos?: PanoOT[] };

const txt = (v: unknown) => String(v ?? "").trim();

/** Resumen compacto de la OT para que el informe hable de cortinas reales. */
function contextoDeLaOT(
  datosGenerales: Record<string, unknown> | null,
  items: unknown,
): string {
  const dg = datosGenerales ?? {};
  const lineas: string[] = [];
  lineas.push(
    `Cliente: ${txt(dg.cliente) || "(sin nombre)"} · OT ${txt(dg.ot) || "(sin número)"}` +
      (txt(dg.comuna) ? ` · ${txt(dg.comuna)}` : ""),
  );
  const ventanas = Array.isArray(items) ? (items as VentanaOT[]) : [];
  if (ventanas.length === 0) {
    lineas.push("La orden todavía no tiene cortinas cargadas.");
    return lineas.join("\n");
  }
  lineas.push(`Cortinas en la orden: ${ventanas.length}`);
  for (const v of ventanas.slice(0, 40)) {
    const p = (v.panos ?? [])[0] ?? {};
    const medidas = (v.panos ?? [])
      .map((x) => `${txt(x.ancho) || "?"}×${txt(x.alto) || "?"} m`)
      .join(" + ");
    const partes = [
      txt(v.ubicacion) || "(sin ubicación)",
      txt(v.categoria),
      txt(v.producto) || txt(v.codInt),
      medidas,
      txt(p.cenefa) && txt(p.cenefa) !== "No" ? `cenefa ${txt(p.cenefa)}` : "",
      txt(p.colorMecanismo) ? `accesorios ${txt(p.colorMecanismo)}` : "",
      txt(p.motorModelo) ? `motor ${txt(p.motorModelo)}` : "",
      txt(p.materialTipo) ? `material ${txt(p.materialTipo)}` : "",
      txt(p.superficie) ? `a ${txt(p.superficie).toLowerCase()}` : "",
      txt(p.relacionMarco) ? `${txt(p.relacionMarco).toLowerCase()} del marco` : "",
      txt(p.cortes) && txt(p.cortes) !== "Nada" ? `corte ${txt(p.cortes)}` : "",
      txt(p.comentarioFinal) ? `nota: ${txt(p.comentarioFinal)}` : "",
    ].filter(Boolean);
    lineas.push(`- ${partes.join(" · ")}`);
  }
  if (ventanas.length > 40) lineas.push(`… y ${ventanas.length - 40} más.`);
  return lineas.join("\n");
}

async function transcribir(audio: Blob): Promise<string> {
  // Sin llave, Groq responde el MISMO "Invalid API Key" que con una llave mala:
  // se distingue acá para no mandar a revisar lo que no es.
  if (!GROQ_API_KEY) {
    throw new Error(
      "falta el secret GROQ_API_KEY en Supabase " +
        "(Project Settings → Edge Functions → Secrets)",
    );
  }
  const form = new FormData();
  form.append("file", audio, "visita.wav");
  form.append("model", GROQ_MODEL);
  form.append("language", "es");
  form.append("response_format", "text");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
  });
  if (res.status === 401) {
    // Pista SIN revelar la llave: el prefijo (público: toda llave de Groq
    // empieza con "gsk_") y el largo bastan para ver si se pegó otra cosa.
    throw new Error(
      `Groq rechazó la llave. La configurada empieza con "${GROQ_API_KEY.slice(0, 4)}" ` +
        `y mide ${GROQ_API_KEY.length} caracteres; una llave de Groq empieza con "gsk_". ` +
        `Revísala en console.groq.com → API Keys y vuelve a guardar el secret GROQ_API_KEY.`,
    );
  }
  if (!res.ok) throw new Error(`transcripción ${res.status}: ${await res.text()}`);
  return (await res.text()).trim();
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"));
  const jsonResponse = jsonResponseWith(cors);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Falta Authorization Bearer" }, 401);
    }

    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userRes, error: userErr } = await supabaseUserClient.auth.getUser();
    if (userErr || !userRes?.user) return jsonResponse({ error: "JWT inválido" }, 401);

    const { data: perfil, error: perfilErr } = await supabaseAdmin
      .from("perfiles")
      .select("empresa_id")
      .eq("id", userRes.user.id)
      .maybeSingle();
    if (perfilErr) return jsonResponse({ error: `perfil: ${perfilErr.message}` }, 500);
    if (!perfil?.empresa_id) return jsonResponse({ error: "Perfil sin empresa" }, 403);
    const empresaId = String(perfil.empresa_id);

    const body = await req.json().catch(() => ({}));
    const otId = String(body?.otId ?? "").trim();
    const audioPath = String(body?.audioPath ?? "").trim();
    // El esqueleto lo arma el navegador: allá viven los tipos ricos del
    // cotizador (familias, chips, colores heredados) y duplicar esa lógica en
    // Deno sería tener dos versiones de la verdad que se desincronizan.
    const esqueleto = String(body?.esqueleto ?? "").trim();
    if (!otId || !audioPath) return jsonResponse({ error: "Faltan otId y audioPath" }, 400);
    // El audio tiene que ser de esta empresa: el path empieza por su id.
    if (!audioPath.startsWith(`${empresaId}/`)) {
      return jsonResponse({ error: "El audio no pertenece a esta empresa" }, 403);
    }

    const { data: ot, error: otErr } = await supabaseAdmin
      .from("ots")
      .select("datos_generales, items, empresa_id")
      .eq("id", otId)
      .maybeSingle();
    if (otErr) return jsonResponse({ error: `ot: ${otErr.message}` }, 500);
    if (!ot) return jsonResponse({ error: "OT no encontrada" }, 404);
    if (String(ot.empresa_id) !== empresaId) {
      return jsonResponse({ error: "La OT no pertenece a esta empresa" }, 403);
    }

    const { data: audio, error: dlErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(audioPath);
    if (dlErr || !audio) {
      return jsonResponse({ error: `No se pudo leer el audio: ${dlErr?.message ?? ""}` }, 404);
    }

    const transcripcion = await transcribir(audio);
    if (!transcripcion) {
      return jsonResponse(
        { error: "El audio no tiene voz reconocible. Graba de nuevo más cerca del micrófono." },
        422,
      );
    }

    const contexto = contextoDeLaOT(
      (ot.datos_generales ?? null) as Record<string, unknown> | null,
      ot.items,
    );

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    // `fallbacks: "default"` deja que la API reintente en otro modelo si los
    // clasificadores de seguridad rechazan el pedido: un informe de cortinas no
    // debería activarlos, pero un falso positivo dejaría al vendedor sin nada.
    const respuesta = await anthropic.beta.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: esqueleto ? SYSTEM_PROMPT_ESQUELETO : SYSTEM_PROMPT_LIBRE,
      messages: [
        {
          role: "user",
          content: esqueleto
            ? `ESQUELETO DEL INFORME (estructura y datos reales de la orden)\n${esqueleto}\n\n` +
              `DATOS DE LA ORDEN (referencia)\n${contexto}\n\n` +
              `LO QUE SE HABLÓ EN LA VISITA (transcripción automática, puede traer errores de ` +
              `dictado)\n${transcripcion}\n\n` +
              `Devuelve el esqueleto completado con lo conversado.`
            : `DATOS DE LA ORDEN\n${contexto}\n\n` +
              `LO QUE SE HABLÓ EN LA VISITA (transcripción automática, puede traer errores de ` +
              `dictado)\n${transcripcion}\n\n` +
              `Redacta el informe para este cliente.`,
        },
      ],
    });

    if (respuesta.stop_reason === "refusal") {
      return jsonResponse(
        {
          error:
            "El modelo no pudo redactar este informe. Escríbelo a mano o vuelve a intentarlo con otra grabación.",
          transcripcion,
        },
        422,
      );
    }

    const informe = respuesta.content
      .filter((c): c is { type: "text"; text: string } & typeof c => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    return jsonResponse({ transcripcion, informe });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    return jsonResponse({ error: msg }, 500);
  }
});
