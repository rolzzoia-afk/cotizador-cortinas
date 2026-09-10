// Edge Function: sincronizar-ordenes-compra
//
// Trae desde Rolzzo-Finanzas las órdenes de compra aprobadas y las deja en la
// copia de trabajo de la bodega. Es un PULL: Finanzas no sabe que existimos y
// no tiene que llamar a nadie. Si su proyecto está caído o pausado —es plan
// Free— la bodega sigue viendo su copia y trabajando.
//
// LO QUE SE COPIA ES LISTA BLANCA. Cada campo se toma por nombre, uno por uno.
// Si mañana alguien agrega una columna de precio a la vista, no entra: en
// nuestra copia no hay plata, y por eso la pantalla de Compras se le puede
// mostrar al taller completo sin esconder nada.
//
// LO NUESTRO NO SE PISA. De cada orden se actualizan solo las columnas que
// vienen de Finanzas. `item_cod`, `factor`, `cantidad_recibida` y `estado` los
// escribe la bodega al recibir, y una pasada de sincronización que los tocara
// borraría lo recibido.
//
// Secrets: FINANZAS_URL y FINANZAS_SERVICE_KEY. Se configuran con
// `npx supabase secrets set` y no viven en el repo ni en ningún .env.

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  cabeceraDeOrden,
  camposDePlata,
  leerDeFinanzas,
  leerLineas,
  limpiarSecret,
  lineaDeOrden,
  proveedoresDeOrdenes,
  txt,
  type ConexionFinanzas,
} from './finanzas.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FINANZAS: ConexionFinanzas = {
  url: limpiarSecret(Deno.env.get('FINANZAS_URL')),
  key: limpiarSecret(Deno.env.get('FINANZAS_SERVICE_KEY')),
};

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ??
  'https://rolzzo.com,https://www.rolzzo.com,http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** Los roles del taller que pueden mirar las órdenes. Ventas y cliente, no. */
const ROLES_OK = ['admin', 'superadmin', 'operario', 'bodeguero', 'produccion'];

function corsFor(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponseWith(cors: Record<string, string>) {
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"));
  const jsonResponse = jsonResponseWith(cors);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  let empresaId = "";
  let email = "";
  let syncId: string | null = null;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (!FINANZAS.url || !FINANZAS.key) {
      return jsonResponse(
        {
          error:
            "Faltan los secretos FINANZAS_URL y FINANZAS_SERVICE_KEY. Se configuran con «npx supabase secrets set».",
        },
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
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return jsonResponse({ error: "Sesión inválida" }, 401);
    email = userRes.user.email ?? "";

    const { data: perfil, error: perfilErr } = await admin
      .from("perfiles")
      .select("empresa_id, rol")
      .eq("id", userRes.user.id)
      .maybeSingle();
    if (perfilErr) return jsonResponse({ error: `perfil: ${perfilErr.message}` }, 500);
    if (!perfil?.empresa_id) return jsonResponse({ error: "Tu usuario no tiene empresa" }, 403);
    if (!ROLES_OK.includes(String(perfil.rol))) {
      return jsonResponse({ error: "Tu rol no puede ver las órdenes de compra" }, 403);
    }
    empresaId = String(perfil.empresa_id);

    // El interruptor manda también acá: apagado, no se habla con Finanzas.
    const { data: encendido } = await admin.rpc("inventario_flag", {
      p_empresa_id: empresaId,
      p_flag: "compras",
    });
    if (encendido !== true) {
      return jsonResponse(
        { error: "El módulo de Compras está apagado. Se enciende en Inventario → Configuración." },
        409,
      );
    }

    const body = await req.json().catch(() => ({}));
    // Con `probar` se ve lo que llegaría SIN escribir nada. Es para el primer
    // día: confirmar que el contrato calza antes de meter datos.
    const soloProbar = body?.modo === "probar";

    // ── Leer de Finanzas ────────────────────────────────────────────────────
    const ordenes = await leerDeFinanzas(FINANZAS, "v_bodega_ordenes", {
      select: "*",
      order: "aprobada_en.desc",
    });

    const lineas = await leerLineas(FINANZAS, ordenes.map((o) => String(o.id)));

    if (soloProbar) {
      return jsonResponse({
        ok: true,
        modo: "probar",
        ordenes: ordenes.length,
        lineas: lineas.length,
        con_solicitud: ordenes.filter((o) => txt(o.solicitud_ref) !== null).length,
        // Una muestra, para mirar a ojo que los campos calcen.
        muestra: ordenes.slice(0, 3).map((o) => cabeceraDeOrden(o, empresaId)),
        muestra_lineas: lineas.slice(0, 5),
        // Si el contrato dejó pasar una columna de plata, mejor verlo acá que
        // descubrirla después en la pantalla de todo el taller.
        campos_de_mas: camposDePlata(ordenes),
      });
    }

    // ── Escribir la copia ───────────────────────────────────────────────────
    const { data: sync } = await admin
      .from("ordenes_compra_sync")
      .insert({ empresa_id: empresaId, ejecutada_por: email })
      .select("id")
      .single();
    syncId = sync?.id ?? null;

    // Proveedores: se conocen por RUT, que es lo único que los dos sistemas
    // escriben igual.
    const proveedores = proveedoresDeOrdenes(ordenes, empresaId);
    if (proveedores.length > 0) {
      const { error } = await admin
        .from("proveedores")
        .upsert(proveedores, { onConflict: "empresa_id,rut", ignoreDuplicates: false });
      // Un proveedor que no se pudo guardar no frena la sincronización: la
      // orden se copia igual y el nombre queda en la propia orden.
      if (error) console.warn("[compras] proveedores:", error.message);
    }

    const { data: antes } = await admin
      .from("ordenes_compra")
      .select("finanzas_id")
      .eq("empresa_id", empresaId);
    const conocidas = new Set((antes ?? []).map((o) => String(o.finanzas_id)));

    const cabeceras = ordenes.map((o) => cabeceraDeOrden(o, empresaId));
    const { data: guardadas, error: errOrd } = await admin
      .from("ordenes_compra")
      .upsert(cabeceras, { onConflict: "empresa_id,finanzas_id" })
      .select("id, finanzas_id, estado, anulada");
    if (errOrd) throw new Error(`guardando órdenes: ${errOrd.message}`);

    const idPorFinanzas = new Map(
      (guardadas ?? []).map((o) => [String(o.finanzas_id), String(o.id)]),
    );

    const filasLinea = lineas
      .map((l) => {
        const ordenId = idPorFinanzas.get(String(l.orden_id));
        return ordenId ? lineaDeOrden(l, ordenId, empresaId) : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (filasLinea.length > 0) {
      const { error: errLin } = await admin
        .from("ordenes_compra_lineas")
        .upsert(filasLinea, { onConflict: "orden_id,finanzas_linea_id" });
      if (errLin) throw new Error(`guardando líneas: ${errLin.message}`);
    }

    // Una orden anulada en Finanzas: si no se recibió nada, se marca anulada;
    // si YA llegó algo, se deja como está y se marca el conflicto para que lo
    // mire un administrador. Borrarla perdería lo que entró al stock.
    const anuladas = (guardadas ?? []).filter((o) => o.anulada === true);
    for (const o of anuladas) {
      const { data: recibido } = await admin
        .from("ordenes_compra_lineas")
        .select("id")
        .eq("orden_id", o.id)
        .gt("cantidad_recibida", 0)
        .limit(1);
      if ((recibido ?? []).length > 0) {
        await admin
          .from("ordenes_compra")
          .update({ conflicto: "anulada_con_recepcion" })
          .eq("id", o.id);
      } else if (o.estado !== "anulada") {
        await admin.from("ordenes_compra").update({ estado: "anulada" }).eq("id", o.id);
      }
    }

    // Vincular lo que se pueda por el código interno.
    const { data: vinculadas } = await admin.rpc("oc_autovincular", { p_empresa: empresaId });

    // La vuelta de las solicitudes. Finanzas no lleva estado de los pedidos de
    // bodega —su módulo «Solicitudes» es de personal y nómina—, así que lo
    // único que vuelve es el «SOL-0007» que Gerencia escribe en las notas de la
    // orden. Con eso basta para saber que el pedido se recogió; un pedido
    // RECHAZADO no vuelve por ningún lado y lo cierra un administrador desde la
    // pantalla de Solicitudes.
    let solicitudesTocadas = 0;
    for (const o of ordenes) {
      const ref = txt(o.solicitud_ref);
      if (!ref) continue;
      const { data: sol } = await admin
        .from("solicitudes_reposicion")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("numero", ref)
        .maybeSingle();
      if (!sol) continue;
      await admin
        .from("ordenes_compra")
        .update({ solicitud_id: sol.id })
        .eq("empresa_id", empresaId)
        .eq("finanzas_id", String(o.id));
      await admin
        .from("solicitudes_reposicion")
        .update({ estado: "en_orden" })
        .eq("id", sol.id)
        .eq("estado", "enviada");
      solicitudesTocadas++;
    }

    const nuevas = cabeceras.filter((c) => !conocidas.has(c.finanzas_id)).length;
    const resumen = {
      ok: true,
      nuevas,
      actualizadas: cabeceras.length - nuevas,
      lineas: filasLinea.length,
      vinculadas: Number(vinculadas ?? 0),
      solicitudes: solicitudesTocadas,
      anuladas: anuladas.length,
    };

    if (syncId) {
      await admin
        .from("ordenes_compra_sync")
        .update({
          fin: new Date().toISOString(),
          ok: true,
          nuevas: resumen.nuevas,
          actualizadas: resumen.actualizadas,
          lineas: resumen.lineas,
          vinculadas: resumen.vinculadas,
        })
        .eq("id", syncId);
    }

    return jsonResponse(resumen);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // El error queda escrito: si Finanzas lleva dos días caído, alguien tiene
    // que poder verlo desde la pantalla y no desde la consola del navegador.
    if (syncId) {
      await admin
        .from("ordenes_compra_sync")
        .update({ fin: new Date().toISOString(), ok: false, error: msg })
        .eq("id", syncId);
    } else if (empresaId) {
      await admin.from("ordenes_compra_sync").insert({
        empresa_id: empresaId,
        fin: new Date().toISOString(),
        ok: false,
        error: msg,
        ejecutada_por: email,
      });
    }
    return jsonResponse({ error: msg }, 502);
  }
});
