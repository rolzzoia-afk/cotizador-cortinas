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
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';
import { esCategoriaBeeblack, esCodigoBeeblack } from '@/modules/descuentos/reglas-beeblack';

/**
 * ¿Los paños de esta ventana llevan UNA TELA CADA UNO (en vez de compartir la
 * de la ventana)?
 *
 * Pasa en el roller dual y en el BEEBLACK DOBLE — blackout + mosquitero en la
 * misma ubicación, que la planilla marca DOBLE y llega como 2 filas. En el
 * beeblack esa marca no se persiste, así que se deduce del grupo: una ventana
 * beeblack con más de un paño ES el doble.
 *
 * Sin `nFilas` responde "¿PUEDE llevar tela por paño?", que es lo que necesita
 * el espejo de campos al editar una celda (ahí todavía no se sabe el grupo, y
 * en un beeblack simple no hay hermanos a los que replicar nada).
 */
export function esGrupoDobleTela(
  categoria: string,
  nFilas?: number,
  tipos?: readonly TipoCortina[],
): boolean {
  if (categoriaEsDual(categoria, tipos)) return true;
  return esCategoriaBeeblack(categoria) && (nFilas === undefined || nFilas > 1);
}

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
 *
 * `esDual` permite sumar otros casos de doble tela con el mismo patrón: el
 * BEEBLACK marcado DOBLE en la planilla (blackout + mosquitero en la misma
 * ubicación) usa exactamente esta lógica. Por defecto, solo las categorías dual.
 */
export function emparejarDualesFase0<T extends FilaEmparejable>(
  filas: T[],
  tipoTelaDe: (fila: T) => string,
  esDual: (fila: T) => boolean = (f) => categoriaEsDual(f.categoria),
): ResultadoEmparejado<T> {
  const grupos: T[][] = [];
  const avisos: string[] = [];

  // Índice de los grupos dual por ubicación, para juntar filas no contiguas.
  const dualPorUbic = new Map<string, T[]>();

  for (const f of filas) {
    if (!esDual(f)) {
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
    if (g.length < 2 || !esDual(g[0])) {
      if (esDual(g[0]) && g.length === 1) {
        avisos.push(
          `Dual "${g[0].ubicacion}" tiene una sola tela: se importa como dual de 1 paño (completar la segunda en Fase 2).`,
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
        `Dual "${a.ubicacion}": las dos telas tienen medidas distintas (${a.ancho}×${a.alto} vs ${b.ancho}×${b.alto}). Revisar el Excel.`,
      );
    }
  }

  return { grupos, avisos };
}

/** SCR = 0 (al vidrio), el resto conserva orden estable. */
function rankTela(tipo: string): number {
  return tipo === 'SCR' ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────
// UNIR / SEPARAR a mano en la grilla de Fase 1
//
// El emparejado de arriba lo dispara la columna DOBLE de la planilla. Cuando la
// cotización se escribe a mano no hay planilla, así que las dos telas de un
// beeblack quedaban como DOS cortinas: cada una pagaba su propio riel y la
// segunda salía más cara que la primera, cosa que en la OT real nunca pasa.
//
// Estos helpers son lo que hay detrás de los botones Unir / Separar /
// Intercambiar. Por ahora SOLO beeblack: el roller dual no tiene receta `|2T`,
// así que unir dos de sus filas duplicaría el kit en vez de ahorrarlo.
// ─────────────────────────────────────────────────────────────────────

/** Una fila de la grilla que puede pertenecer a una ventana de varios paños. */
export type FilaAgrupable = FilaEmparejable & {
  id: string;
  vid?: string;
  panoIndex?: number;
};

/**
 * ¿Esta fila es un beeblack? En Fase 1 la fila puede no tener categoría
 * todavía, y entonces manda su código (`BEE-BK05`).
 */
export function esFilaBeeblack(f: Pick<FilaEmparejable, 'categoria' | 'codInt'>): boolean {
  return esCategoriaBeeblack(f.categoria) || esCodigoBeeblack(f.codInt);
}

const sinGrupo = <T extends FilaAgrupable>(f: T): T => ({
  ...f,
  vid: undefined,
  panoIndex: undefined,
});

/**
 * Con qué otra fila se puede unir esta, o `null` si no hay ninguna.
 *
 * Tiene que ser otro beeblack suelto, de la misma ubicación y las mismas
 * medidas: son dos telas sobre UN riel, así que si miden distinto no son la
 * misma cortina. Se busca primero hacia abajo y después hacia arriba, para que
 * el botón aparezca en las DOS filas del par y dé lo mismo en cuál se pulse.
 */
export function candidataParaUnir<T extends FilaAgrupable>(filas: T[], id: string): T | null {
  const i = filas.findIndex((f) => f.id === id);
  if (i < 0) return null;
  const f = filas[i];
  if (f.vid || !esFilaBeeblack(f)) return null;
  const calza = (o: T) =>
    !o.vid &&
    esFilaBeeblack(o) &&
    normUbic(o.ubicacion) === normUbic(f.ubicacion) &&
    o.ancho === f.ancho &&
    o.alto === f.alto;
  for (let k = i + 1; k < filas.length; k++) if (calza(filas[k])) return filas[k];
  for (let k = i - 1; k >= 0; k--) if (calza(filas[k])) return filas[k];
  return null;
}

/**
 * Une dos filas en UNA cortina de dos telas: mismo `vid`, `panoIndex` 0 y 1, y
 * las deja ADYACENTES en el lugar de la primera de las dos.
 *
 * El orden importa y no es cosmético: el paño 0 es la tela al vidrio y es la
 * que paga el riel; la 1 va al panel `…|2T`, sin él. Se pone primero la SCREEN
 * (el mosquitero), como en el emparejado de la planilla; si ninguna lo es
 * —blackout + traslúcida, el caso de la OT ANDREA— manda `idA`, que es la fila
 * desde la que se pulsó el botón.
 */
export function unirFilas<T extends FilaAgrupable>(
  filas: T[],
  idA: string,
  idB: string,
  tipoTelaDe: (f: T) => string,
): T[] {
  if (idA === idB) return filas;
  const a = filas.find((f) => f.id === idA);
  const b = filas.find((f) => f.id === idB);
  if (!a || !b) return filas;

  const primero = rankTela(tipoTelaDe(b)) < rankTela(tipoTelaDe(a)) ? b : a;
  const segundo = primero === a ? b : a;
  const vid = crypto.randomUUID();
  const par = [
    { ...primero, vid, panoIndex: 0 },
    { ...segundo, vid, panoIndex: 1 },
  ];
  // La posición de la PRIMERA de las dos en la grilla. Como es la más temprana,
  // todo lo que va antes queda intacto al sacarlas.
  const pos = Math.min(filas.indexOf(a), filas.indexOf(b));
  const resto = filas.filter((f) => f.id !== a.id && f.id !== b.id);
  return [...resto.slice(0, pos), ...par, ...resto.slice(pos)];
}

/** Deshace el grupo: las dos vuelven a ser cortinas sueltas, cada una completa. */
export function separarGrupo<T extends FilaAgrupable>(filas: T[], vid: string): T[] {
  if (!vid) return filas;
  return filas.map((f) => (f.vid === vid ? sinGrupo(f) : f));
}

/**
 * Cambia cuál de las dos telas es la primera. No es un detalle de presentación:
 * decide cuál va al vidrio y cuál paga el riel.
 */
export function intercambiarPanos<T extends FilaAgrupable>(filas: T[], vid: string): T[] {
  if (!vid) return filas;
  const idx: number[] = [];
  filas.forEach((f, i) => {
    if (f.vid === vid) idx.push(i);
  });
  if (idx.length !== 2) return filas;
  const [i, j] = idx;
  const out = [...filas];
  out[i] = { ...filas[j], panoIndex: 0 };
  out[j] = { ...filas[i], panoIndex: 1 };
  return out;
}

/**
 * Saca una fila de la grilla dejando el grupo coherente.
 *
 * Si la que se va deja a su hermana sola, la hermana VUELVE a ser una cortina
 * suelta. Sin esto quedaba con `panoIndex: 1` y seguía cotizando como segunda
 * tela —sin riel— de una primera que ya no existe: una cortina a mitad de
 * precio que nadie iba a notar hasta el taller.
 */
export function quitarDeGrupo<T extends FilaAgrupable>(filas: T[], id: string): T[] {
  const vid = filas.find((f) => f.id === id)?.vid;
  const resto = filas.filter((f) => f.id !== id);
  if (!vid) return resto;
  if (resto.filter((f) => f.vid === vid).length < 2) {
    return resto.map((f) => (f.vid === vid ? sinGrupo(f) : f));
  }
  // Quedan dos o más: se renumeran para que no quede un hueco en `panoIndex`.
  let n = 0;
  return resto.map((f) => (f.vid === vid ? { ...f, panoIndex: n++ } : f));
}
