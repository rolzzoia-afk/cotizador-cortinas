// ─────────────────────────────────────────────────────────────────────
// EL GRUPO DE VENTANAS del dibujo: cuántas cortinas van en ESTE muro
// («2 ventanas», «3 ventanas»…) y en cuál está parado el vendedor.
//
// El grupo NO se adivina: al elegir «N ventanas» el selector estampa en la
// cortina un `muroId` (compartido), el `muroTotal` y su posición, y las
// hermanas lo heredan. Así el muro sobrevive a cualquier navegación — volver a
// la cortina 1 a media cadena, partir por la 2, reabrir una mañana — que era
// justo lo que se perdía cuando el grupo se derivaba de la ubicación y del
// contador de la cadena.
//
// Módulo PURO (sin React ni Supabase).
// ─────────────────────────────────────────────────────────────────────
import type { Ventana } from '../types';

/**
 * Colores de contorno, uno por ventana del grupo. Distintos de los colores de
 * PAÑO (verde/amarillo/azul… de `PANO_COLORS`): en una dual conviven los tabs
 * de paño y estas ventanas, y no pueden hablar el mismo idioma de color.
 */
export const COLORES_VENTANA: readonly string[] = [
  '#38bdf8', // celeste
  '#fb923c', // naranjo
  '#a78bfa', // violeta
  '#f472b6', // rosado
  '#a3e635', // lima
  '#fbbf24', // ámbar
  '#2dd4bf', // turquesa
  '#f87171', // rojo suave
];

export function colorVentana(i: number): string {
  return COLORES_VENTANA[((i % COLORES_VENTANA.length) + COLORES_VENTANA.length) % COLORES_VENTANA.length];
}

export type MiembroGrupo = {
  /** id de la cortina en la OT; `null` = ese lugar del muro está vacío. */
  id: string | number | null;
  /** La que está abierta en el editor ahora. */
  actual: boolean;
};

export type GrupoVentanas = {
  total: number;
  /** Posición de la cortina abierta dentro del muro (0-based). */
  indice: number;
  miembros: MiembroGrupo[];
};

const posValida = (v: Ventana): number | null => {
  const p = v.muroPos;
  return typeof p === 'number' && Number.isInteger(p) && p >= 0 ? p : null;
};

/**
 * Arma el muro de la cortina abierta a partir de lo PERSISTIDO:
 *
 *   · miembros = las cortinas de la OT con el mismo `muroId`, más la abierta
 *     si todavía no se guarda; los lugares sin cortina quedan vacíos (`null`).
 *   · cada una va en su `muroPos`; las que no lo traen (una hermana recién
 *     nacida) toman el primer lugar libre, en su orden de la OT.
 *   · el total es el `muroTotal` mayor que declare el grupo — y crece si hay
 *     más cortinas que lugares (se replicó una extra: el muro la muestra).
 *
 * Sin `muroId` no hay muro: la cortina es individual y el vidrio va limpio.
 */
export function grupoVentanasDe(ventanas: readonly Ventana[], actual: Ventana): GrupoVentanas {
  const muroId = actual.muroId;
  if (!muroId) return { total: 1, indice: 0, miembros: [{ id: actual.id, actual: true }] };

  // Las del muro, con la abierta ocupando su propio lugar (sin duplicarse).
  const delMuro: Ventana[] = [];
  let vistaActual = false;
  for (const v of ventanas) {
    if (v.muroId !== muroId) continue;
    if (String(v.id) === String(actual.id)) {
      delMuro.push(actual);
      vistaActual = true;
    } else {
      delMuro.push(v);
    }
  }
  if (!vistaActual) delMuro.push(actual);

  const total = Math.max(
    1,
    ...delMuro.map((v) => Math.round(v.muroTotal ?? 0)),
    ...delMuro.map((v) => (posValida(v) ?? 0) + 1),
    delMuro.length,
  );

  // Dos pasadas: primero cada una reclama su posición guardada; después las
  // sin posición (o en un lugar ya tomado) llenan los huecos, en orden.
  const slots: (Ventana | null)[] = Array.from({ length: total }, () => null);
  const sinLugar: Ventana[] = [];
  for (const v of delMuro) {
    const p = posValida(v);
    if (p != null && p < total && slots[p] === null) slots[p] = v;
    else sinLugar.push(v);
  }
  for (const v of sinLugar) {
    const libre = slots.findIndex((s) => s === null);
    if (libre >= 0) slots[libre] = v;
  }

  const miembros: MiembroGrupo[] = slots.map((v) => ({
    id: v ? v.id : null,
    actual: !!v && String(v.id) === String(actual.id),
  }));
  const indice = Math.max(0, miembros.findIndex((m) => m.actual));
  return { total, indice, miembros };
}
