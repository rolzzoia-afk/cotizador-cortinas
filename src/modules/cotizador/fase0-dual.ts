// ─────────────────────────────────────────────────────────────────────
// Emparejado de filas DUAL al importar en Fase 1.
//
// Una cortina dual (roller doble tela) se declara en el Excel como DOS filas
// con la misma UBIC (mismo ancho/alto, COD SEC=ROL_DUAL, distinto COD_INT — una
// por tela). Este módulo agrupa esas filas de a dos por ubicación y ordena la
// SCREEN primero (paño[0] = tela al vidrio por defecto). No es un error duro si
// el par está incompleto o hay medidas distintas: emite avisos y deja lo mejor
// posible (una dual de una sola tela se completa a mano en Fase 2).
//
// Módulo puro (sin React, sin catálogo): el tipo de tela lo resuelve el caller.
// ─────────────────────────────────────────────────────────────────────
import { categoriaEsDual } from '@/modules/descuentos/tipos';

export type FilaEmparejable = {
  categoria: string;
  ubicacion: string;
  codInt: string;
  ancho: number;
  alto: number;
};

export type ResultadoEmparejado<T> = {
  /** Grupos de filas: cada dual = par (o singleton si el par está incompleto);
   *  las no-dual quedan como grupo de 1, en el orden de entrada. */
  grupos: T[][];
  avisos: string[];
};

const normUbic = (u: string): string => (u || '').toUpperCase().trim().replace(/\s+/g, ' ');

/**
 * Agrupa las filas dual por ubicación y ordena cada par con la SCREEN primero.
 * `tipoTelaDe(codInt)` devuelve 'SCR' | 'BK' | 'DU' | '' para decidir el orden.
 */
export function emparejarDualesFase0<T extends FilaEmparejable>(
  filas: T[],
  tipoTelaDe: (fila: T) => string,
): ResultadoEmparejado<T> {
  const grupos: T[][] = [];
  const avisos: string[] = [];

  // Índice de los grupos dual por ubicación, para juntar filas no contiguas.
  const dualPorUbic = new Map<string, T[]>();

  for (const f of filas) {
    if (!categoriaEsDual(f.categoria)) {
      grupos.push([f]);
      continue;
    }
    const key = normUbic(f.ubicacion);
    const acc = dualPorUbic.get(key);
    if (acc) {
      acc.push(f);
    } else {
      const nuevo = [f];
      dualPorUbic.set(key, nuevo);
      grupos.push(nuevo); // se conserva la referencia; se ordena/valida al final
    }
  }

  // Ordena y valida cada grupo dual (los singletons no-dual quedan intactos).
  for (const g of grupos) {
    if (g.length < 2 || !categoriaEsDual(g[0].categoria)) {
      if (categoriaEsDual(g[0].categoria) && g.length === 1) {
        avisos.push(
          `Dual "${g[0].ubicacion}" tiene una sola tela: se importa como dual de 1 paño (completá la segunda en Fase 2).`,
        );
      }
      continue;
    }
    // SCREEN al vidrio por defecto: la SCR va primero. Si ninguna es SCR (BK+BK)
    // se conserva el orden del Excel.
    g.sort((a, b) => rankTela(tipoTelaDe(a)) - rankTela(tipoTelaDe(b)));

    if (g.length > 2) {
      avisos.push(
        `Ubicación "${g[0].ubicacion}" tiene ${g.length} telas dual: se toman las 2 primeras; el resto queda como paños extra.`,
      );
    }
    const [a, b] = g;
    if (a.ancho !== b.ancho || a.alto !== b.alto) {
      avisos.push(
        `Dual "${a.ubicacion}": las dos telas tienen medidas distintas (${a.ancho}×${a.alto} vs ${b.ancho}×${b.alto}). Revisá el Excel.`,
      );
    }
  }

  return { grupos, avisos };
}

/** SCR = 0 (al vidrio), el resto conserva orden estable. */
function rankTela(tipo: string): number {
  return tipo === 'SCR' ? 0 : 1;
}
