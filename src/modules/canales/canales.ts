// ─────────────────────────────────────────────────────────────────────
// CANAL DE CONTACTO — por dónde nos encontró el cliente.
//
// Vive en `ots.datos_generales.canal` y su lista de opciones sale de
// `kpi_config.canales`, la MISMA que edita el engranaje de /ventas y que ya
// usan Leads (como `leads.fuente`) y el panel KPI. Una sola lista para que un
// canal nuevo —TikTok, por ejemplo— se agregue en un solo lugar y los informes
// no tengan que reconciliar «Referencia» con «Referido» más adelante.
//
// Módulo puro (sin React/Supabase); el hook vive en `hooks.ts`.
// ─────────────────────────────────────────────────────────────────────

/** Canales que no salen de la config pero siempre tienen que estar. */
export const CANALES_FIJOS = ['Web', 'Referido', 'Otro'] as const;

/** Los de fábrica, por si `kpi_config` todavía no existe para la empresa. */
export const CANALES_FALLBACK = ['Instagram', 'WhatsApp', 'Facebook', 'TikTok'] as const;

/** Valor con el que se guardaba antes: es el ORIGEN del registro, no un canal. */
const LEGACY_SIN_CANAL = new Set(['COTIZADOR', 'MANUAL', '']);

export function normalizarCanal(canal: string | null | undefined): string {
  return (canal || '').trim();
}

/**
 * ¿El valor guardado es un canal de verdad? Las OTs viejas traen
 * `canal: 'Cotizador'` —lo escribía la app, no la vendedora— y `'manual'`
 * viene del alta de leads: ninguno de los dos dice por dónde llegó el cliente,
 * así que se muestran como «sin definir» en vez de ensuciar la lista.
 */
export function esCanalReal(canal: string | null | undefined): boolean {
  return !LEGACY_SIN_CANAL.has(normalizarCanal(canal).toUpperCase());
}

/**
 * Opciones del desplegable: los canales configurados + los fijos, sin repetir.
 *
 * `guardado` se agrega al final si no está en la lista, para que abrir una OT
 * vieja no le cambie el canal en silencio (la config pudo haber cambiado desde
 * que se cotizó).
 */
export function opcionesCanal(
  canalesConfig: readonly string[] | null | undefined,
  guardado?: string | null,
): string[] {
  const base = (canalesConfig?.length ? canalesConfig : CANALES_FALLBACK) as readonly string[];
  const out: string[] = [];
  const vistos = new Set<string>();
  const push = (c: string) => {
    const v = normalizarCanal(c);
    if (!v) return;
    const k = v.toUpperCase();
    if (vistos.has(k)) return;
    vistos.add(k);
    out.push(v);
  };
  base.forEach(push);
  CANALES_FIJOS.forEach(push);
  const g = normalizarCanal(guardado);
  if (g && esCanalReal(g)) push(g);
  return out;
}

/**
 * Lo que se guarda desde el desplegable: vacío = sin definir (no se escribe
 * un canal falso solo por llenar la celda).
 */
export function canalParaGuardar(canal: string | null | undefined): string {
  const v = normalizarCanal(canal);
  return esCanalReal(v) ? v : '';
}
