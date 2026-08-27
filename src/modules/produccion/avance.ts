// ─────────────────────────────────────────────────────────────────────
// El avance del taller y las compuertas entre áreas. Módulo PURO: sin React
// ni Supabase, para poder probar las reglas sin montar nada.
//
// El flujo real del taller no es una fila india:
//
//     Estructura ─┐
//                 ├─→ Armado ──→ Prueba ──→ Lista
//     Paños ──→ Dimensionado ─┘
//
// Estructura y Paños corren EN PARALELO. Dimensionado espera a Paños. Armado
// espera a Estructura Y a Dimensionado. Por eso la sub-etapa no se calcula
// contando áreas listas, sino preguntando por las que de verdad habilitan la
// siguiente.
// ─────────────────────────────────────────────────────────────────────

import { SUB_ETAPA_META } from '@/modules/cotizador/fase4';
import type { SubEtapaProd } from '@/modules/ots/types';
import type { AreaProduccion } from './types';

export type AreasListas = Partial<Record<AreaProduccion, boolean>>;

export type Avance = {
  hechas: number;
  total: number;
  /** 0–100, entero. Sin nada que marcar es 0, no NaN. */
  pct: number;
};

/** Cuántas de las cosas marcables ya están marcadas. */
export function calcularAvance(claves: string[], hechas: Set<string>): Avance {
  const total = claves.length;
  const n = claves.reduce((acc, c) => acc + (hechas.has(c) ? 1 : 0), 0);
  return { hechas: n, total, pct: total === 0 ? 0 : Math.round((n / total) * 100) };
}

/**
 * A qué sub-etapa debería estar la OT según lo que el taller ya cerró.
 * Se lee de abajo hacia arriba: gana lo más avanzado.
 */
export function calcularSubEtapa(listas: AreasListas): SubEtapaProd {
  if (listas.prueba) return 'Lista';
  if (listas.armado) return 'Prueba';
  if (listas.estructura && listas.dimensionado) return 'Armado';
  if (listas.panos) return 'Dimensionado';
  return 'Estructura';
}

/**
 * ¿Corresponde mover la OT? Solo si el objetivo va MÁS ADELANTE que donde
 * está. Una OT no puede retroceder sola: si el jefe la devolvió a Estructura
 * a mano desde el Panel, desmarcar y volver a marcar un área no puede
 * arrastrarla de vuelta hacia adelante sin querer.
 */
export function debeAvanzar(
  actual: SubEtapaProd | null | undefined,
  objetivo: SubEtapaProd,
): boolean {
  if (!actual) return true;
  const a = SUB_ETAPA_META[actual]?.orden;
  const o = SUB_ETAPA_META[objetivo]?.orden;
  if (a == null || o == null) return false;
  return o > a;
}
