// ─────────────────────────────────────────────────────────────────────
// Con qué se eligen los TÉRMINOS de una cotización.
//
// El dueño (2026-09-07): «ya agregué los términos y condiciones de Beeblack,
// sin embargo al ser solo beeblack deberían salir solo los de ese producto y
// no los de roller». Y las dos reglas que puso: beeblack + roller categoría A
// → los dos; categoría A + categoría B → los dos.
//
// Por qué no salía: los términos se eligen con dos listas —las categorías de
// PRODUCTO y las gamas de TELA—, y en una Fase 1 nueva las filas no tienen
// categoría de producto (la columna está oculta y se llena recién en Fase 2),
// así que el grupo con `categorias: ['BEEBLACK']` no aplicaba nunca. Encima
// las telas BEE-* están catalogadas con gama 'A', así que salían los términos
// de la roller A.
//
// Acá se arregla lo uno y lo otro:
//   · una fila beeblack se reconoce por su CÓDIGO (`BEE-…`) aunque no tenga
//     categoría, y aporta la categoría de producto BEEBLACK;
//   · la gama de tela se mira SOLO en las cortinas que no son beeblack, así
//     que una cotización solo-beeblack no arrastra los términos de la roller A
//     y una mixta sí (que es lo que pidió el dueño).
//
// Módulo puro: sin React ni catálogo propio, se testea directo.
// ─────────────────────────────────────────────────────────────────────
import { esCategoriaBeeblack, esCodigoBeeblack } from '@/modules/descuentos/reglas-beeblack';
import { categoriasTela } from './categoriaTela';
import { categoriasDeVentanas } from './terminos';
import type { CatalogoProductos } from './types';

/** La categoría de producto con que se rotula el beeblack en los grupos. */
export const CATEGORIA_BEEBLACK = 'BEEBLACK';

/** Una fila de la cotización, con lo poco que hace falta para elegir términos. */
export type FilaParaTerminos = { codInt?: string; categoria?: string | null };

/** ¿Esta fila es un beeblack? Por categoría si la tiene, si no por el código. */
export function filaEsBeeblack(f: FilaParaTerminos): boolean {
  return esCategoriaBeeblack(f.categoria) || esCodigoBeeblack(f.codInt);
}

/**
 * Las dos listas con las que `terminosParaCotizacion` decide qué grupos
 * aplican: categorías de PRODUCTO y gamas de TELA.
 */
export function categoriasParaTerminos(
  filas: FilaParaTerminos[],
  catalogo: CatalogoProductos,
): { catsProducto: string[]; catsTela: string[] } {
  const beeblack = filas.filter(filaEsBeeblack);
  const catsProducto = categoriasDeVentanas(filas.map((f) => ({ categoria: f.categoria })));
  if (beeblack.length && !catsProducto.includes(CATEGORIA_BEEBLACK)) {
    catsProducto.push(CATEGORIA_BEEBLACK);
    catsProducto.sort();
  }
  // La gama de tela se lee en las cortinas que NO son beeblack: el beeblack
  // trae sus propios términos y su tela figura como 'A' en el catálogo solo
  // porque hay que ponerle algo.
  const catsTela = categoriasTela(
    filas.filter((f) => !filaEsBeeblack(f)).map((f) => f.codInt),
    catalogo,
  );
  return { catsProducto, catsTela };
}
