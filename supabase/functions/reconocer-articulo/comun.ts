// Lo compartido por las cuatro acciones de `reconocer-articulo`: secretos,
// CORS, quién llama, y las constantes que deciden cuándo una propuesta es
// segura.
//
// Está copiado de `escanear-factura` a propósito: las funciones de este
// proyecto no comparten carpeta (`_shared`), porque cada una se despliega sola
// y una carpeta común obliga a acordarse de desplegar todo junto.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function limpiarSecret(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

export const VOYAGE_API_KEY = limpiarSecret(Deno.env.get("VOYAGE_API_KEY"));
export const ANTHROPIC_API_KEY = limpiarSecret(Deno.env.get("ANTHROPIC_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Lo que decide qué se le muestra a la persona ─────────────────────
//
// ⚠ ESTOS NÚMEROS SE CALIBRAN, NO SE ADIVINAN. Después de la prueba de
// aceptación hay que mirar la tabla `reconocimientos` (la consulta está al pie
// del SQL) y mover `SEGURO` hasta que la banda «seguro» acierte 9 de cada 10.
export const UMBRAL_SEGURO = 0.80;
export const UMBRAL_POSIBLE = 0.62;
export const UMBRAL_MINIMO = 0.45;
/** Dos candidatos más juntos que esto son un empate: hay que desempatar. */
export const MARGEN_DUDA = 0.04;
export const K_CANDIDATOS = 5;

/** El modelo de las huellas. Cambiarlo obliga a reindexar TODAS las fotos. */
export const MODELO_EMB = "voyage-multimodal-3.5";
export const BUCKET = "reconocimiento";
/** Una foto ya reducida pesa ~150 KB; en base64, ~205 KB. Un techo holgado. */
export const MAX_BASE64 = 1_400_000;
/**
 * Cuántas fotos de ficha se mandan juntas al reindexar.
 *
 * Voyage cobra y limita POR PÍXEL, y una foto de ficha viene del tamaño que la
 * subieron (puede ser de varios millones de píxeles). Una cuenta recién creada
 * acepta poco por minuto: con lotes grandes, la primera llamada ya rebota con
 * 429. Cuatro entra en cualquier límite; el navegador vuelve a llamar enseguida,
 * así que un lote chico no hace más lento el total cuando la cuenta da para más.
 */
export const LOTE_REINDEX = 4;
export const SEGUNDOS_URL = 3600;

const ROLES_RECONOCER = [
  "admin", "superadmin", "bodeguero", "operario", "telas", "produccion", "dimensionado",
];
const ROLES_ENSENAR = ["admin", "superadmin", "bodeguero", "telas"];

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://rolzzo.com,https://www.rolzzo.com,http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsFor(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function jsonResponseWith(cors: Record<string, string>) {
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}

export type Actor = {
  admin: SupabaseClient;
  empresaId: string;
  userId: string;
  email: string | null;
  rol: string;
  esAdmin: boolean;
  puedeEnsenar: boolean;
};

/**
 * Quién llama, con qué empresa y si el módulo está encendido.
 *
 * Devuelve `{ error, status }` en vez de lanzar: cada acción responde con el
 * mensaje en español que corresponde, que es lo que ve la persona.
 */
export async function autenticar(
  req: Request,
): Promise<{ actor: Actor } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { error: "Falta Authorization Bearer", status: 401 };

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return { error: "Sesión inválida", status: 401 };

  const { data: perfil } = await admin
    .from("perfiles")
    .select("empresa_id, rol")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (!perfil?.empresa_id) return { error: "Tu usuario no tiene empresa", status: 403 };

  const rol = String(perfil.rol ?? "");
  if (!ROLES_RECONOCER.includes(rol)) {
    return { error: "Tu rol no puede usar el reconocimiento", status: 403 };
  }
  const empresaId = String(perfil.empresa_id);

  const { data: encendido } = await admin.rpc("inventario_flag", {
    p_empresa_id: empresaId,
    p_flag: "reconocimiento",
  });
  if (encendido !== true) {
    return {
      error: "El reconocimiento por cámara está apagado. Se enciende en Inventario → Configuración.",
      status: 409,
    };
  }

  return {
    actor: {
      admin,
      empresaId,
      userId: userRes.user.id,
      email: userRes.user.email ?? null,
      rol,
      esAdmin: rol === "admin" || rol === "superadmin",
      puedeEnsenar: ROLES_ENSENAR.includes(rol),
    },
  };
}

// ── Imágenes ─────────────────────────────────────────────────────────

const TIPOS_OK = ["image/jpeg", "image/png", "image/webp"];

export type DataUrl = string;

/**
 * Revisa la foto que mandó el navegador. Viaja como data URL en el cuerpo (y no
 * subida al bucket primero) porque así se ahorra una subida Y una descarga: la
 * persona ve los candidatos en la mitad del tiempo. El archivo se sube en
 * paralelo y solo importa si confirma.
 */
export function revisarDataUrl(valor: unknown): { dataUrl: DataUrl } | { error: string; status: number } {
  const s = String(valor ?? "").trim();
  if (!s) return { error: "Falta la foto", status: 400 };
  if (s.length > MAX_BASE64) {
    return { error: "La foto pesa demasiado. Vuelve a sacarla desde la app.", status: 413 };
  }
  const m = /^data:([a-z/+.-]+);base64,/i.exec(s);
  if (!m) return { error: "La foto no llegó en el formato esperado", status: 400 };
  const tipo = m[1].toLowerCase();
  if (/hei[cf]/.test(tipo)) {
    return {
      error: "Esa foto es HEIC y no se puede leer. En el iPhone: Ajustes → Cámara → Formatos → Más compatible.",
      status: 415,
    };
  }
  if (!TIPOS_OK.includes(tipo)) return { error: "Solo se reconocen fotos JPG, PNG o WebP.", status: 415 };
  return { dataUrl: s };
}

/** El tipo y los datos de una data URL, para armar el bloque que ve Claude. */
export function partesDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const i = dataUrl.indexOf(",");
  const cabecera = dataUrl.slice(0, i);
  const mediaType = /^data:([a-z/+.-]+);/i.exec(cabecera)?.[1]?.toLowerCase() ?? "image/jpeg";
  return { mediaType, data: dataUrl.slice(i + 1) };
}

/** La banda que se muestra: verde, amarilla o gris. */
export function bandaDe(similitud: number): "seguro" | "probable" | "dudoso" {
  if (similitud >= UMBRAL_SEGURO) return "seguro";
  if (similitud >= UMBRAL_POSIBLE) return "probable";
  return "dudoso";
}

/**
 * ¿Hace falta una segunda opinión?
 *
 * Dos casos: el mejor candidato no llega a «seguro», o los dos primeros están
 * tan juntos que el parecido no los distingue (dos tamaños del mismo kit, dos
 * beige). Si no hay nada ni medianamente parecido, tampoco sirve preguntar:
 * Claude no tendría entre qué elegir.
 */
export function hayDuda(sims: number[]): boolean {
  const top1 = sims[0] ?? 0;
  if (top1 < UMBRAL_MINIMO) return false;
  if (top1 < UMBRAL_SEGURO) return true;
  const top2 = sims[1] ?? 0;
  return top1 - top2 < MARGEN_DUDA;
}
