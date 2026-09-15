// Edge Function: enviar-recepcion-finanzas
//
// Le manda a Gerencia una recepción CONTADA: la deja en la bandeja
// `bodega_recepciones` del proyecto Rolzzo-Finanzas, con copia del documento,
// la firma y las fotos en SU bucket privado `bodega-recepciones`. Se manda
// siempre, esté todo bien o con diferencias: el resultado va en la fila.
//
// Body { recepcion_id }. Se puede llamar las veces que haga falta: la bandeja
// es idempotente por el id de la recepción, y un reenvío no pisa lo que
// Gerencia ya marcó.
//
// La marca «enviada» la pone ESTA función, y solo con el acuse de Finanzas en
// la mano. Si Finanzas no contesta (pausado, llave rotada, falta su SQL), la
// recepción queda en «error» con el motivo escrito y se reintenta desde la
// ficha. Nunca se da por enviado algo que no llegó: a diferencia de las
// solicitudes, acá NO hay «destino local».
//
// Secrets: FINANZAS_URL y FINANZAS_SERVICE_KEY (los mismos de la
// sincronización de órdenes).

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { decodeBase64 } from "@std/encoding";
import { armarPayload, clavesDePlata, fotosDeRecepcion, type RutasCopiadas } from "./payload.ts";

function limpiarSecret(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

/** La base de Finanzas venga como venga pegada (con o sin `/rest/v1`). */
function urlBaseFinanzas(v: string): string {
  return v.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "").replace(/\/+$/, "");
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FINANZAS_URL = urlBaseFinanzas(limpiarSecret(Deno.env.get("FINANZAS_URL")));
const FINANZAS_KEY = limpiarSecret(Deno.env.get("FINANZAS_SERVICE_KEY"));

const BUCKET_NUESTRO = "docs-recepciones";
const BUCKET_FINANZAS = "bodega-recepciones";
const ROLES_OK = ["admin", "superadmin", "operario", "bodeguero"];
const SQL_FINANZAS = "sql/finanzas/20260911_bodega_recepciones.sql";

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

/** Un error de NUESTRO lado: se muestra tal cual, no como si fuera de Finanzas. */
class ErrorPropio extends Error {}

/** El error de Finanzas dicho de forma que la bodega sepa qué hacer. */
function motivoFinanzas(e: unknown): string {
  if (e instanceof ErrorPropio) return e.message;
  const err = e as { message?: string; code?: string; status?: number; statusCode?: string | number } | null;
  const msg = String(err?.message ?? e ?? "");
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  if (err?.code === "PGRST202" || /bucket not found|bodega_registrar_recepcion|bodega_recepciones/i.test(msg)) {
    return `Finanzas todavía no tiene la bandeja: falta correr ${SQL_FINANZAS} en el proyecto de Finanzas.`;
  }
  if (status === 401 || status === 403 || /invalid api key|jwt|unauthorized|signature/i.test(msg)) {
    return "La llave de Finanzas no sirve o fue rotada (secret FINANZAS_SERVICE_KEY).";
  }
  if (/fetch failed|failed to fetch|network|timed out|ECONN|dns/i.test(msg)) {
    return "Finanzas no contesta (¿el proyecto está pausado?). Vuelve a intentar más tarde.";
  }
  return `Finanzas respondió: ${msg.slice(0, 300) || "error sin detalle"}`;
}

function extension(path: string | null | undefined, mime: string | null | undefined): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(String(path ?? ""));
  if (m) return m[1].toLowerCase();
  return mime === "application/pdf" ? "pdf" : "jpg";
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"));
  const jsonResponse = jsonResponseWith(cors);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let recepcionId = "";

  const marcarError = async (motivo: string) => {
    if (!recepcionId) return;
    await admin
      .from("recepciones")
      .update({ envio_finanzas: "error", envio_finanzas_detalle: motivo })
      .eq("id", recepcionId);
  };

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Falta Authorization Bearer" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return jsonResponse({ error: "Sesión inválida" }, 401);

    const { data: perfil } = await admin
      .from("perfiles")
      .select("empresa_id, rol")
      .eq("id", userRes.user.id)
      .maybeSingle();
    if (!perfil?.empresa_id) return jsonResponse({ error: "Tu usuario no tiene empresa" }, 403);
    if (!ROLES_OK.includes(String(perfil.rol))) {
      return jsonResponse({ error: "Tu rol no puede mandar recepciones a Gerencia" }, 403);
    }
    const empresaId = String(perfil.empresa_id);

    const { data: encendido } = await admin.rpc("inventario_flag", {
      p_empresa_id: empresaId,
      p_flag: "compras",
    });
    if (encendido !== true) return jsonResponse({ error: "El módulo de Compras está apagado" }, 409);

    const body = await req.json().catch(() => ({}));
    recepcionId = String(body?.recepcion_id ?? "").trim();
    if (!recepcionId) return jsonResponse({ error: "Falta recepcion_id" }, 400);

    // ── Lo que hay que mandar ────────────────────────────────────────────
    const { data: rec, error: errRec } = await admin
      .from("recepciones")
      .select("*")
      .eq("id", recepcionId)
      .maybeSingle();
    if (errRec) return jsonResponse({ error: errRec.message }, 500);
    if (!rec || String(rec.empresa_id) !== empresaId) {
      recepcionId = "";
      return jsonResponse({ error: "Esa recepción no existe o no es de tu empresa" }, 404);
    }
    if (rec.estado !== "contada") {
      // No se marca error: todavía no hay nada que mandar.
      recepcionId = "";
      return jsonResponse({ error: `${rec.numero} todavía no está contada: se manda a Gerencia al firmar.` }, 409);
    }

    if (!FINANZAS_URL || !FINANZAS_KEY) {
      const motivo = "Faltan los secrets FINANZAS_URL y FINANZAS_SERVICE_KEY en Supabase.";
      await marcarError(motivo);
      return jsonResponse({ error: motivo }, 503);
    }

    const { data: lineas } = await admin
      .from("recepciones_lineas")
      .select("*")
      .eq("recepcion_id", recepcionId)
      .order("posicion");

    let orden: { numero: string; finanzas_id: string | null } | null = null;
    let lineasOrden: Record<string, unknown>[] = [];
    if (rec.orden_id) {
      const { data: oc } = await admin
        .from("ordenes_compra")
        .select("numero, finanzas_id")
        .eq("id", rec.orden_id)
        .maybeSingle();
      if (oc) orden = { numero: String(oc.numero), finanzas_id: oc.finanzas_id ? String(oc.finanzas_id) : null };
      const { data: ol } = await admin
        .from("ordenes_compra_lineas")
        .select("id, posicion, codigo_interno, codigo_proveedor, descripcion, cantidad_pedida")
        .eq("orden_id", rec.orden_id);
      lineasOrden = ol ?? [];
    }

    await admin
      .from("recepciones")
      .update({ envio_finanzas_intentos: Number(rec.envio_finanzas_intentos ?? 0) + 1 })
      .eq("id", recepcionId);

    // ── Copiar los archivos al bucket de Finanzas ────────────────────────
    // Gerencia no depende de que la bodega esté arriba para ver la factura.
    const fin = createClient(FINANZAS_URL, FINANZAS_KEY, { auth: { persistSession: false } });
    const subir = async (destino: string, contenido: Blob | Uint8Array, tipo: string) => {
      const { error } = await fin.storage.from(BUCKET_FINANZAS).upload(destino, contenido, {
        upsert: true,
        contentType: tipo,
      });
      if (error) throw error;
      return destino;
    };
    const copiar = async (origen: string, destino: string) => {
      const { data: blob, error } = await admin.storage.from(BUCKET_NUESTRO).download(origen);
      if (error || !blob) throw new ErrorPropio(`No se pudo leer ${origen} de la bodega: ${error?.message ?? ""}`);
      return await subir(destino, blob, blob.type || "application/octet-stream");
    };

    const rutas: RutasCopiadas = { documento: null, firma: null, fotos: new Map() };
    rutas.documento = await copiar(
      String(rec.doc_path),
      `${recepcionId}/documento.${extension(rec.doc_path, rec.doc_mime)}`,
    );
    const firma = String(rec.firma_png ?? "");
    if (firma.startsWith("data:image/png;base64,")) {
      rutas.firma = await subir(
        `${recepcionId}/firma.png`,
        decodeBase64(firma.slice("data:image/png;base64,".length)),
        "image/png",
      );
    }
    let n = 0;
    for (const foto of fotosDeRecepcion(rec, lineas ?? [])) {
      n++;
      rutas.fotos.set(foto, await copiar(foto, `${recepcionId}/fotos/${n}.${extension(foto, null)}`));
    }

    // ── A la bandeja ─────────────────────────────────────────────────────
    const payload = armarPayload({ rec, lineas: lineas ?? [], orden, lineasOrden, rutas });
    const plata = clavesDePlata(payload);
    if (plata.length > 0) throw new ErrorPropio(`El envío traía campos de plata (${plata.join(", ")}): no se manda.`);

    const { data: acuse, error: errRpc } = await fin.rpc("bodega_registrar_recepcion", { p: payload });
    if (errRpc) throw errRpc;

    await admin
      .from("recepciones")
      .update({
        envio_finanzas: "enviada",
        envio_finanzas_en: new Date().toISOString(),
        envio_finanzas_detalle: null,
      })
      .eq("id", recepcionId);

    return jsonResponse({
      ok: true,
      numero: rec.numero,
      veces_recibida: (acuse as Record<string, unknown> | null)?.veces_recibida ?? null,
    });
  } catch (e) {
    const motivo = motivoFinanzas(e);
    await marcarError(motivo);
    return jsonResponse({ error: motivo }, 502);
  }
});
