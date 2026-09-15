// Enseñar: guardar la huella de una foto de referencia.
//
// Dos caminos:
//   indexar           una foto que la persona acaba de sacar y que el navegador
//                     ya subió al bucket. Corre en segundo plano mientras ella
//                     sigue con la toma siguiente.
//   reindexar-fichas  el atajo para partir: muchos artículos YA tienen una foto
//                     (`foto_url`). Se indexan en lotes, sin volver a subir
//                     nada y sin que nadie tenga que fotografiar de nuevo.

import { encodeBase64 } from "@std/encoding";
import { type Actor, BUCKET, LOTE_REINDEX, MODELO_EMB } from "./comun.ts";
import { comoVector, embedImagenes, ErrorEmbedding } from "./embeddings.ts";

type Respuesta = { cuerpo: unknown; status?: number };

const DOMINIOS = ["insumo", "tela"];

/** Una foto de referencia recién sacada. */
export async function accionIndexar(
  actor: Actor,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Respuesta> {
  if (!actor.puedeEnsenar) {
    return { cuerpo: { error: "Tu rol no puede enseñar artículos" }, status: 403 };
  }
  const dominio = String(body.dominio ?? "").trim();
  const cod = String(body.cod ?? "").trim().toUpperCase();
  const path = String(body.path ?? "").trim();
  const pathMin = String(body.path_min ?? "").trim();
  const angulo = String(body.angulo ?? "libre").trim();

  if (!DOMINIOS.includes(dominio)) return { cuerpo: { error: "Dominio inválido" }, status: 400 };
  if (!cod) return { cuerpo: { error: "Falta el código del artículo" }, status: 400 };
  if (!path) return { cuerpo: { error: "Falta la foto" }, status: 400 };
  if (!path.startsWith(`${actor.empresaId}/`)) {
    return { cuerpo: { error: "Esa foto no pertenece a esta empresa" }, status: 403 };
  }

  const { data: archivo, error: dlErr } = await actor.admin.storage.from(BUCKET).download(path);
  if (dlErr || !archivo) {
    return { cuerpo: { error: `No se pudo leer la foto subida: ${dlErr?.message ?? ""}` }, status: 404 };
  }
  const tipo = archivo.type && archivo.type.startsWith("image/") ? archivo.type : "image/jpeg";
  const dataUrl = `data:${tipo};base64,${encodeBase64(new Uint8Array(await archivo.arrayBuffer()))}`;

  const { vectores } = await embedImagenes([dataUrl], apiKey);
  const { data: id, error } = await actor.admin.rpc("articulo_foto_indexar", {
    p_empresa_id: actor.empresaId,
    p_dominio: dominio,
    p_cod: cod,
    p_bucket: BUCKET,
    p_path: path,
    p_path_min: pathMin || null,
    p_angulo: angulo,
    p_origen: "enrolamiento",
    p_embedding: comoVector(vectores[0]),
    p_modelo: MODELO_EMB,
    p_usuario_id: actor.userId,
    p_email: actor.email,
  });
  if (error) return { cuerpo: { error: `No se pudo guardar la foto: ${error.message}` }, status: 500 };

  return { cuerpo: { ok: true, foto_id: id } };
}

type FilaArticulo = { cod: string; foto_url: string };

/** Los artículos con foto de ficha que todavía no están indexados. */
async function pendientesDeFicha(actor: Actor, dominio: string): Promise<FilaArticulo[]> {
  const tabla = dominio === "tela" ? "telas_catalogo" : "insumos";
  const campo = dominio === "tela" ? "codigo" : "cod";

  const [{ data: articulos }, { data: yaIndexadas }] = await Promise.all([
    actor.admin
      .from(tabla)
      .select(`${campo}, foto_url`)
      .eq("empresa_id", actor.empresaId)
      .not("foto_url", "is", null),
    actor.admin
      .from("articulo_fotos")
      .select("path")
      .eq("empresa_id", actor.empresaId)
      .eq("dominio", dominio)
      .eq("origen", "ficha"),
  ]);

  const hechas = new Set((yaIndexadas ?? []).map((f) => String((f as { path: string }).path)));
  const out: FilaArticulo[] = [];
  const vistos = new Set<string>();
  for (const a of (articulos ?? []) as Array<Record<string, unknown>>) {
    const cod = String(a[campo] ?? "").trim().toUpperCase();
    const url = String(a.foto_url ?? "").trim();
    // Un mismo código repetido en el catálogo se indexa una vez.
    if (!cod || !url || hechas.has(url) || vistos.has(url)) continue;
    vistos.add(url);
    out.push({ cod, foto_url: url });
  }
  return out;
}

/**
 * Indexa de a `LOTE_REINDEX` las fotos que los artículos ya tenían. El
 * navegador vuelve a llamar mientras `pendientes` sea mayor que cero: así la
 * pantalla muestra avance y ninguna llamada se pasa del tiempo máximo.
 *
 * `saltar` es cuántas fotos rotas ya se dieron por perdidas. Una foto que no se
 * puede bajar no deja rastro —no hay dónde anotar «esta falló»— así que sin
 * esto volvería a salir primera en la tanda siguiente y el reindexado se
 * quedaría pegado en ella para siempre. El navegador lleva la cuenta.
 */
export async function accionReindexarFichas(
  actor: Actor,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Respuesta> {
  if (!actor.esAdmin) {
    return { cuerpo: { error: "Solo un administrador puede indexar el catálogo" }, status: 403 };
  }
  const dominio = String(body.dominio ?? "").trim();
  if (!DOMINIOS.includes(dominio)) return { cuerpo: { error: "Dominio inválido" }, status: 400 };
  const saltar = Math.max(0, Math.trunc(Number(body.saltar ?? 0)) || 0);

  const pendientes = await pendientesDeFicha(actor, dominio);
  const lote = pendientes.slice(saltar, saltar + LOTE_REINDEX);
  if (lote.length === 0) {
    return { cuerpo: { ok: true, indexadas: 0, pendientes: 0, errores: [] } };
  }
  /** Las que quedan después de esta tanda, sin contar las ya descartadas. */
  const restantes = Math.max(0, pendientes.length - saltar - lote.length);

  const errores: Array<{ cod: string; motivo: string }> = [];
  const listas: Array<{ cod: string; url: string; dataUrl: string }> = [];

  await Promise.all(
    lote.map(async (a) => {
      try {
        const res = await fetch(a.foto_url);
        if (!res.ok) throw new Error(`la foto responde ${res.status}`);
        const tipo = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
        if (!tipo.startsWith("image/") || /hei[cf]/.test(tipo)) throw new Error("formato no soportado");
        const bytes = new Uint8Array(await res.arrayBuffer());
        // 8 MB de foto de ficha es más de lo que Voyage necesita y de lo que
        // conviene mandar; esas se enseñan a mano desde la ficha.
        if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("la foto pesa demasiado");
        listas.push({ cod: a.cod, url: a.foto_url, dataUrl: `data:${tipo};base64,${encodeBase64(bytes)}` });
      } catch (e) {
        errores.push({ cod: a.cod, motivo: e instanceof Error ? e.message : String(e) });
      }
    }),
  );

  if (listas.length === 0) {
    return { cuerpo: { ok: true, indexadas: 0, pendientes: restantes, errores } };
  }

  let vectores: number[][];
  try {
    ({ vectores } = await embedImagenes(listas.map((l) => l.dataUrl), apiKey));
  } catch (e) {
    const err = e instanceof ErrorEmbedding ? e : null;
    // Un límite por minuto NO es un fracaso: no se indexó nada, pero las fotos
    // siguen ahí. Se responde «espera tanto y vuelve a llamar» en vez de un
    // error, para que el reindexado se pause solo y siga después en vez de
    // cortarse a la mitad.
    if (err?.status === 429) {
      return {
        cuerpo: {
          ok: true,
          indexadas: 0,
          // Esta tanda no se hizo: sigue pendiente, junto con las que faltaban.
          pendientes: Math.max(0, pendientes.length - saltar),
          errores: [],
          esperar_ms: err.esperaMs || 20000,
          motivo: err.message,
        },
      };
    }
    return {
      cuerpo: { error: err?.message ?? (e instanceof Error ? e.message : String(e)) },
      status: err?.status ?? 502,
    };
  }

  let indexadas = 0;
  for (let i = 0; i < listas.length; i++) {
    const { error } = await actor.admin.rpc("articulo_foto_indexar", {
      p_empresa_id: actor.empresaId,
      p_dominio: dominio,
      p_cod: listas[i].cod,
      // Sin bucket: `path` es la URL pública de la ficha, que ya existe.
      p_bucket: null,
      p_path: listas[i].url,
      p_path_min: null,
      p_angulo: "libre",
      p_origen: "ficha",
      p_embedding: comoVector(vectores[i]),
      p_modelo: MODELO_EMB,
      p_usuario_id: actor.userId,
      p_email: actor.email,
    });
    if (error) errores.push({ cod: listas[i].cod, motivo: error.message });
    else indexadas++;
  }

  return { cuerpo: { ok: true, indexadas, pendientes: restantes, errores } };
}
