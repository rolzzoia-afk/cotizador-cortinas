// Edge Function: enviar-solicitud-finanzas
//
// Manda a Gerencia lo que bodega pidió.
//
// HOY EL PEDIDO SE QUEDA ACÁ. El módulo «Solicitudes» de Rolzzo-Finanzas es de
// personal y nómina: no tiene productos ni cantidades, así que no sirve de
// bandeja. Mientras nadie agregue una pantalla de pedidos en ese sistema,
// «enviar» significa **dejarla lista para Gerencia en Compras → Solicitudes**,
// que es donde la abre. Se marca enviada y se devuelve `destino: 'local'`.
//
// SI ALGÚN DÍA FINANZAS TIENE DÓNDE RECIBIRLA, esta función ya sabe usarlo: si
// existe `bodega_crear_solicitud` allá, la llama y guarda el identificador que
// devuelve. Esa función es idempotente por el número de la solicitud, así que
// reintentar tras un error de red que en realidad había funcionado devuelve el
// mismo identificador en vez de crear un pedido duplicado.
//
// LO QUE NUNCA PASA es marcarla enviada tras un fallo REAL de Finanzas —caído,
// llave vencida—: ahí queda en borrador con el error a la vista y un botón para
// reintentar. Darla por enviada solo porque se intentó dejaría a bodega
// esperando una orden que nadie recibió, y eso no se descubre hasta que falta
// el material.
//
// Secrets: FINANZAS_URL y FINANZAS_SERVICE_KEY (opcionales mientras el destino
// sea local).

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function limpiarSecret(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FINANZAS_URL = limpiarSecret(Deno.env.get("FINANZAS_URL"));
const FINANZAS_KEY = limpiarSecret(Deno.env.get("FINANZAS_SERVICE_KEY"));

/** Lo que se le dice a la bodega cuando el pedido se queda en nuestro sistema. */
const AVISO_LOCAL =
  "Gerencia la abre en Compras → Solicitudes y arma la orden de compra en Finanzas.";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://rolzzo.com,https://www.rolzzo.com,http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const ROLES_OK = ["admin", "superadmin", "operario", "bodeguero"];

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

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"));
  const jsonResponse = jsonResponseWith(cors);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Falta Authorization Bearer" }, 401);
    }
    // OJO: las funciones `solicitud_*` de la base comprueban la sesión con
    // `auth.uid()`, así que se llaman CON ESTE cliente —el de la persona— y no
    // con el de servicio, donde no hay sesión y devolverían CO001.
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
      return jsonResponse({ error: "Tu rol no puede enviar solicitudes" }, 403);
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
    const solicitudId = String(body?.solicitud_id ?? "").trim();
    if (!solicitudId) return jsonResponse({ error: "Falta solicitud_id" }, 400);

    // ── Armar el pedido con lo que hay guardado ─────────────────────────────
    const { data: sol, error: errSol } = await admin
      .from("solicitudes_reposicion")
      .select("id, numero, estado, notas, creada_por, empresa_id")
      .eq("id", solicitudId)
      .maybeSingle();
    if (errSol) return jsonResponse({ error: errSol.message }, 500);
    if (!sol) return jsonResponse({ error: "Esa solicitud no existe" }, 404);
    if (String(sol.empresa_id) !== empresaId) {
      return jsonResponse({ error: "Esa solicitud no es de tu empresa" }, 403);
    }
    if (sol.estado !== "borrador") {
      return jsonResponse(
        { error: `La solicitud ya está ${sol.estado}: no se manda dos veces` },
        409,
      );
    }

    const { data: lineas } = await admin
      .from("solicitudes_reposicion_lineas")
      .select("dominio, item_cod, nombre, unidad, cantidad, stock_al_pedir, minimo_al_pedir, proveedor_sugerido, motivo")
      .eq("solicitud_id", solicitudId)
      .order("orden");

    if (!lineas || lineas.length === 0) {
      return jsonResponse({ error: "La solicitud no tiene líneas" }, 400);
    }

    const payload = {
      ref: sol.numero,
      creada_por: sol.creada_por,
      notas: sol.notas,
      lineas: lineas.map((l) => ({
        codigo_interno: l.item_cod,
        nombre: l.nombre,
        cantidad: Number(l.cantidad),
        unidad: l.unidad ?? (l.dominio === "tela" ? "m" : "un"),
        proveedor_sugerido: l.proveedor_sugerido,
        stock_actual: l.stock_al_pedir,
        minimo: l.minimo_al_pedir,
        motivo: l.motivo,
      })),
    };

    // ── Mandarlo ────────────────────────────────────────────────────────────
    //
    // Sin bandeja del otro lado, «enviada» quiere decir lista para que Gerencia
    // la abra acá. La marca la pone la función de la base, que vuelve a
    // comprobar sesión, empresa y rol.
    const marcarLocal = async (motivo: string) => {
      const { error } = await userClient.rpc("solicitud_marcar_enviada", {
        p_solicitud_id: solicitudId,
        p_finanzas_id: "local",
      });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({
        ok: true,
        numero: sol.numero,
        lineas: lineas.length,
        estado: "enviada",
        destino: "local",
        aviso: motivo,
      });
    };

    if (!FINANZAS_URL || !FINANZAS_KEY) return await marcarLocal(AVISO_LOCAL);

    let finanzasId = "";
    try {
      const res = await fetch(
        `${FINANZAS_URL.replace(/\/$/, "")}/rest/v1/rpc/bodega_crear_solicitud`,
        {
          method: "POST",
          headers: {
            apikey: FINANZAS_KEY,
            Authorization: `Bearer ${FINANZAS_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_solicitud: payload }),
        },
      );
      if (!res.ok) {
        const cuerpo = await res.text();
        if (res.status === 404) {
          // Finanzas todavía no tiene dónde recibir pedidos de bodega, que es
          // lo esperable hoy. No es un error: la solicitud queda lista acá.
          return await marcarLocal(AVISO_LOCAL);
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error("La llave de Finanzas no sirve o fue rotada.");
        }
        throw new Error(`Finanzas respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
      }
      const devuelto = await res.json();
      finanzasId = String(devuelto ?? "").replace(/^"|"$/g, "").trim();
      if (!finanzasId) throw new Error("Finanzas no devolvió el identificador de la solicitud");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Queda en borrador, con el motivo escrito y listo para reintentar.
      await userClient.rpc("solicitud_marcar_enviada", {
        p_solicitud_id: solicitudId,
        p_finanzas_id: "",
        p_error: msg,
      });
      return jsonResponse({ error: msg }, 502);
    }

    // Con el identificador en la mano, recién ahora es «enviada». La marca la
    // pone la función de la base, que vuelve a comprobar sesión, empresa y rol.
    const { data: marcada, error: errMarca } = await userClient.rpc("solicitud_marcar_enviada", {
      p_solicitud_id: solicitudId,
      p_finanzas_id: finanzasId,
    });
    if (errMarca) return jsonResponse({ error: errMarca.message }, 500);

    return jsonResponse({
      ok: true,
      numero: sol.numero,
      finanzas_id: finanzasId,
      lineas: lineas.length,
      estado: (marcada as Record<string, unknown> | null)?.estado ?? "enviada",
      destino: "finanzas",
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
