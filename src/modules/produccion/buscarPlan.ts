// ─────────────────────────────────────────────────────────────────────
// Encontrar el plan de corte de una OT.
//
// El número de OT dentro de un plan lo escribió una persona en el Excel del
// optimizador, así que en la base conviven «#3197», «3197», «OT 3182»,
// «3006-G1» y hasta «3054- SERV» en dos líneas. La OT de la app, en cambio,
// es limpia: `ots.numero_ot`.
//
// Reglas:
//   · `-G1` es un GRUPO dentro de la OT (lo pone el optimizador para no
//     mezclar tubos grises con blancos en una misma ubicación): se ignora.
//   · `-B`, `-1`, `-C` NO se tocan: son OTs distintas de verdad («3187-B» es
//     la versión categoría B, con su propia ficha).
// ─────────────────────────────────────────────────────────────────────

/** Deja el número de OT comparable: sin `#`, sin «OT », sin el grupo `-G#`. */
export function normalizarNumeroOT(raw: string | null | undefined): string {
  let s = String(raw ?? '')
    .trim()
    .toUpperCase();
  s = s.replace(/^#\s*/, '');
  s = s.replace(/^OT\s+/, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/-G\d+$/, '');
  return s;
}

/** El número «pelado» del principio, para el rescate por aproximación. */
function numeroBase(s: string): string {
  return (/^(\d+)/.exec(normalizarNumeroOT(s))?.[1] ?? '').trim();
}

export type PlanBuscable = { ots: string[] };

/**
 * El plan de esta OT. Primero busca calce exacto; recién si no hay ninguno
 * se conforma con que empiecen por el mismo número, para rescatar las celdas
 * sucias («3054- SERV»). Quien lo muestre TIENE que rotular qué OT trae el
 * plan encontrado: en el segundo intento puede no ser la que se pidió.
 */
export function elegirPlanDeOT<T extends PlanBuscable>(planes: T[], numero: string): T | null {
  const buscado = normalizarNumeroOT(numero);
  if (!buscado) return null;

  const exacto = planes.find((p) => p.ots.some((ot) => normalizarNumeroOT(ot) === buscado));
  if (exacto) return exacto;

  const base = numeroBase(buscado);
  if (!base) return null;
  return planes.find((p) => p.ots.some((ot) => numeroBase(ot) === base)) ?? null;
}

/** ¿Este plan es exactamente el de esa OT? (sin el rescate por aproximación) */
export function planCubreOT(plan: PlanBuscable, numero: string): boolean {
  const buscado = normalizarNumeroOT(numero);
  return !!buscado && plan.ots.some((ot) => normalizarNumeroOT(ot) === buscado);
}
