// Edge Function: reconocer-articulo
//
// Identificar un insumo o una tela mirándolo con la cámara.
//
//   ping              despierta la función mientras la persona encuadra
//   reconocer         foto → hasta 5 candidatos, en ~2 s
//   juzgar            segunda opinión de Claude, solo si hubo dudas
//   indexar           guardar una foto de referencia (enseñar)
//   reindexar-fichas  indexar en lote las fotos que los artículos ya tenían
//
// La foto de la consulta viaja EN el cuerpo, no subida al bucket: así se evita
// una subida y una descarga, que es la mitad del tiempo que espera la persona.
// El navegador la sube en paralelo y esa copia solo se usa si confirma.
//
// No escribe nada directo: todo pasa por las funciones de la base (`SECURITY
// DEFINER`), que vuelven a comprobar la empresa.
//
// Secrets: VOYAGE_API_KEY (las huellas), ANTHROPIC_API_KEY (la segunda opinión).

import "@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "@anthropic-ai/sdk";
import {
  ANTHROPIC_API_KEY,
  autenticar,
  bandaDe,
  BUCKET,
  corsFor,
  hayDuda,
  jsonResponseWith,
  K_CANDIDATOS,
  MODELO_EMB,
  revisarDataUrl,
  SEGUNDOS_URL,
  VOYAGE_API_KEY,
  type Actor,
} from "./comun.ts";
import { comoVector, embedImagenes, ErrorEmbedding } from "./embeddings.ts";
import { accionIndexar, accionReindexarFichas } from "./indexar.ts";
import { juzgar, type CandidatoJuez } from "./juez.ts";

type FilaParecido = {
  dominio: string;
  cod: string;
  nombre: string;
  foto_url: string | null;
  foto_bucket: string | null;
  foto_path: string | null;
  similitud: number;
  n_fotos: number;
};

type Candidato = FilaParecido & { banda: string; miniatura_url: string | null };

/**
 * Una URL que el navegador pueda mostrar para cada candidato. Las del bucket se
 * firman TODAS JUNTAS (una sola llamada) y las de las fichas ya son públicas.
 */
async function conMiniaturas(actor: Actor, filas: FilaParecido[]): Promise<Candidato[]> {
  const delBucket = filas.filter((f) => f.foto_bucket === BUCKET && f.foto_path);
  const firmadas = new Map<string, string>();
  if (delBucket.length > 0) {
    const { data } = await actor.admin.storage
      .from(BUCKET)
      .createSignedUrls(delBucket.map((f) => f.foto_path as string), SEGUNDOS_URL);
    for (const d of data ?? []) {
      if (d.path && d.signedUrl) firmadas.set(d.path, d.signedUrl);
    }
  }
  return filas.map((f) => ({
    ...f,
    banda: bandaDe(Number(f.similitud)),
    miniatura_url: f.foto_bucket === BUCKET && f.foto_path
      ? firmadas.get(f.foto_path) ?? null
      : f.foto_url ?? (f.foto_path && !f.foto_bucket ? f.foto_path : null),
  }));
}

/** Un artículo que no estaba entre los parecidos, pero cuyo código se leyó. */
async function porCodigo(actor: Actor, dominio: string, cod: string): Promise<FilaParecido | null> {
  const tabla = dominio === "tela" ? "telas_catalogo" : "insumos";
  const campo = dominio === "tela" ? "codigo" : "cod";
  const { data } = await actor.admin
    .from(tabla)
    .select(`${campo}, nemotecnico, foto_url`)
    .eq("empresa_id", actor.empresaId)
    .ilike(campo, cod)
    .limit(1);
  const fila = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) return null;
  return {
    dominio,
    cod: String(fila[campo] ?? cod).toUpperCase(),
    nombre: String(fila.nemotecnico ?? fila[campo] ?? cod),
    foto_url: (fila.foto_url as string) ?? null,
    foto_bucket: null,
    foto_path: null,
    similitud: 0,
    n_fotos: 0,
  };
}

async function accionReconocer(
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ cuerpo: unknown; status?: number }> {
  const revisada = revisarDataUrl(body.imagen_base64);
  if ("error" in revisada) return { cuerpo: { error: revisada.error }, status: revisada.status };

  const dominioPedido = String(body.dominio ?? "").trim();
  const dominio = dominioPedido === "insumo" || dominioPedido === "tela" ? dominioPedido : null;

  const t0 = Date.now();
  const { vectores } = await embedImagenes([revisada.dataUrl], VOYAGE_API_KEY);
  const msEmbedding = Date.now() - t0;

  const t1 = Date.now();
  const { data: filas, error } = await actor.admin.rpc("articulos_parecidos", {
    p_empresa_id: actor.empresaId,
    p_embedding: comoVector(vectores[0]),
    p_dominio: dominio,
    p_k: K_CANDIDATOS,
    p_modelo: MODELO_EMB,
  });
  const msBusqueda = Date.now() - t1;
  if (error) {
    return { cuerpo: { error: `No se pudo buscar el parecido: ${error.message}` }, status: 500 };
  }

  const parecidos = ((filas ?? []) as FilaParecido[]).map((f) => ({
    ...f,
    similitud: Number(f.similitud),
  }));
  const candidatos = await conMiniaturas(actor, parecidos);
  const duda = hayDuda(parecidos.map((p) => p.similitud));
  const sugerido = parecidos[0] && !duda ? parecidos[0].cod : null;

  const { data: id } = await actor.admin.rpc("reconocimiento_registrar", {
    p_empresa_id: actor.empresaId,
    p_dominio: dominio,
    p_embedding: comoVector(vectores[0]),
    // Sin la URL firmada: caduca en una hora y el registro es para siempre.
    p_candidatos: parecidos,
    p_sugerido: sugerido,
    p_modelo: MODELO_EMB,
    p_usuario_id: actor.userId,
    p_email: actor.email,
    p_ms_embedding: msEmbedding,
    p_ms_busqueda: msBusqueda,
    p_ms_total: Date.now() - t0,
  });

  return {
    cuerpo: {
      ok: true,
      reconocimiento_id: id ?? null,
      candidatos,
      sugerido,
      duda,
      ms: { embedding: msEmbedding, busqueda: msBusqueda, total: Date.now() - t0 },
    },
  };
}

async function accionJuzgar(
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ cuerpo: unknown; status?: number }> {
  if (!ANTHROPIC_API_KEY) {
    return { cuerpo: { error: "Falta el secret ANTHROPIC_API_KEY: no hay segunda opinión." }, status: 503 };
  }
  const id = String(body.reconocimiento_id ?? "").trim();
  if (!id) return { cuerpo: { error: "Falta la consulta" }, status: 400 };
  const revisada = revisarDataUrl(body.imagen_base64);
  if ("error" in revisada) return { cuerpo: { error: revisada.error }, status: revisada.status };

  const { data: fila } = await actor.admin
    .from("reconocimientos")
    .select("id, empresa_id, dominio, candidatos")
    .eq("id", id)
    .maybeSingle();
  if (!fila) return { cuerpo: { error: "Esa consulta no existe" }, status: 404 };
  if (String(fila.empresa_id) !== actor.empresaId) {
    return { cuerpo: { error: "Esa consulta no es de tu empresa" }, status: 403 };
  }

  const guardados = (fila.candidatos ?? []) as FilaParecido[];
  if (guardados.length === 0) return { cuerpo: { ok: true, candidatos: [], juez: null } };

  const t0 = Date.now();
  const juicio = await juzgar(
    actor,
    ANTHROPIC_API_KEY,
    revisada.dataUrl,
    guardados as unknown as CandidatoJuez[],
  );
  const msJuez = Date.now() - t0;
  if (!juicio) {
    return { cuerpo: { ok: true, candidatos: await conMiniaturas(actor, guardados), juez: null } };
  }

  // El código leído en la etiqueta manda sobre el parecido: si existe y no
  // estaba en la lista, entra primero.
  let ordenados = [...guardados];
  const leido = (juicio.codigo_leido ?? "").trim().toUpperCase();
  if (leido && !ordenados.some((c) => c.cod.toUpperCase() === leido)) {
    const extra = await porCodigo(actor, String(fila.dominio ?? "insumo"), leido);
    if (extra) ordenados = [extra, ...ordenados];
  }
  if (juicio.eleccion) {
    const i = ordenados.findIndex((c) => c.cod.toUpperCase() === juicio.eleccion);
    if (i > 0) ordenados = [ordenados[i], ...ordenados.filter((_, j) => j !== i)];
  }

  await actor.admin.rpc("reconocimiento_juez", {
    p_id: id,
    p_eleccion: juicio.eleccion,
    p_codigo_leido: juicio.codigo_leido,
    p_confianza: juicio.confianza,
    p_candidatos: ordenados,
    p_ms_juez: msJuez,
  });

  return {
    cuerpo: {
      ok: true,
      candidatos: await conMiniaturas(actor, ordenados),
      juez: juicio,
      ms: { juez: msJuez },
    },
  };
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"));
  const jsonResponse = jsonResponseWith(cors);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  try {
    if (!VOYAGE_API_KEY) {
      return jsonResponse(
        { error: "Falta el secret VOYAGE_API_KEY en Supabase: el reconocimiento no está disponible." },
        503,
      );
    }

    const auth = await autenticar(req);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
    const { actor } = auth;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const accion = String(body.accion ?? "reconocer").trim();

    // Despertar la función mientras la persona encuadra: la primera llamada de
    // verdad se ahorra el arranque en frío.
    if (accion === "ping") return jsonResponse({ ok: true });

    const r = accion === "reconocer"
      ? await accionReconocer(actor, body)
      : accion === "juzgar"
      ? await accionJuzgar(actor, body)
      : accion === "indexar"
      ? await accionIndexar(actor, VOYAGE_API_KEY, body)
      : accion === "reindexar-fichas"
      ? await accionReindexarFichas(actor, VOYAGE_API_KEY, body)
      : { cuerpo: { error: `Acción desconocida: ${accion}` }, status: 400 };

    return jsonResponse(r.cuerpo, r.status ?? 200);
  } catch (e) {
    if (e instanceof ErrorEmbedding) return jsonResponse({ error: e.message }, e.status);
    if (e instanceof Anthropic.APIError) {
      return jsonResponse(
        { error: `La segunda opinión no respondió (${e.status ?? "sin estado"}). Elige de la lista.` },
        502,
      );
    }
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
