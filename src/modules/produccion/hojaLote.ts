// ─────────────────────────────────────────────────────────────────────
// LOS TIROS DE UN LOTE — cortar la tela de varias OTs de una sola vez.
//
// El lote existe para eso: si dos órdenes usan la misma tela, sus cortinas se
// acomodan en el MISMO tiro y se baja un solo largo del rollo. El problema es
// que después cada estación del taller volvía a calcular por su cuenta, con
// las cortinas de UNA orden: la letra que veía el dimensionador («A», «B») se
// armaba solo con las cortinas de esa OT, así que no describía el tiro que
// físicamente le llegaba a la mesa —que traía también las de la otra—.
//
// Acá se arma la cuenta UNA vez para todo el lote. Se reusa el mismo motor de
// siempre (`filasOptimizadorDeOT` + `empacarBestFit` vía `autoOptimizar`), sin
// tocarlo: se le pasan las filas de todas las OTs juntas y él las empaca por
// tela como ya sabía hacerlo. Cada fila se marca con su OT para que en el tiro
// se vea de quién es cada cortina.
//
// Módulo puro: sin React ni Supabase.
// ─────────────────────────────────────────────────────────────────────
import { autoOptimizar, type OptimizerRow } from '@/modules/cotizador/tela';
import { filasOptimizadorDeOT } from '@/modules/cotizador/filasOptimizador';
import { panoDeCadaFila } from '@/modules/cotizador/hojaCorte';
import { letraPano } from '@/modules/cotizador/letras';
import type { JuntoPieza } from '@/modules/cotizador/calculoGeneral';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from '@/modules/cotizador/parametrosCorte';
import type { CatalogoProductos } from '@/modules/cotizador/types';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import { REGLAS_SELECCION_DEFAULT, type ReglasSeleccion } from '@/modules/descuentos/reglasSeleccion';
import type { OT } from '@/modules/ots/types';

/**
 * Una fila del optimizador que además sabe de qué orden viene. El empacador
 * copia la fila entera cuando le asigna paño (`{ ...r, junto, numeroPano }`),
 * así que estos dos campos sobreviven al empaque sin que haya que tocarlo.
 */
export type FilaLote = OptimizerRow & { otId: string; otNum: string };

/** La misma llave que usa `juntoPorPieza` del cálculo general. */
export const clavePieza = (ventanaId: string | number, panoIndex: number): string =>
  `${ventanaId}_${panoIndex}`;

/**
 * Las filas de TODAS las OTs del lote, empacadas juntas.
 *
 * El empaque corre una sola vez sobre el conjunto: por eso una cortina de la
 * #3213 puede terminar en el mismo tiro que una de la #3215, que es justamente
 * lo que el lote vino a conseguir. Se ignoran las OTs sin ventanas.
 */
export function filasDelLote(
  ots: OT[],
  catalogo: CatalogoProductos,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  formulas?: FormulasFamilias,
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
): FilaLote[] {
  const todas: FilaLote[] = [];
  for (const ot of ots) {
    const otNum = ot.datosGenerales?.ot || String(ot.id);
    const filas = filasOptimizadorDeOT(ot, catalogo, params, formulas, reglas);
    for (const f of filas) todas.push({ ...f, otId: String(ot.id), otNum });
  }
  if (todas.length === 0) return [];
  // `autoOptimizar` ordena por tela y empaca best-fit; el spread de adentro
  // conserva `otId`/`otNum`, que TypeScript pierde de vista pero el objeto no.
  return autoOptimizar(todas) as FilaLote[];
}

/** Una cortina dentro de un tiro. */
export type CortinaDelTiro = {
  otId: string;
  otNum: string;
  piezaId: string;
  ubicacion: string;
  producto: string;
  codInt: string;
  /** Ancho que la cortina ocupa a lo ancho del tiro (cm). */
  anchoCm: number;
  /** Alto de corte de la tela (cm). */
  altoCm: number;
};

/** Un tiro: el trozo de tela que se baja del rollo y se corta de una vez. */
export type TiroLote = {
  /** N.º de paño (1, 2, 3…) — el orden en que se bajan. */
  numero: number;
  /** La letra de CONJUNTO PAÑOS: A, B… Z, AA, BB… */
  letra: string;
  codInt: string;
  esVertical: boolean;
  /** Largo que hay que bajar del rollo (cm): el de la cortina más alta. */
  altoCorteCm: number;
  /** Ancho del rollo (cm). */
  anchoRolloCm: number;
  /** Cuánto del ancho se ocupa (cm). */
  anchoUsadoCm: number;
  cortinas: CortinaDelTiro[];
  /** Las OTs que aportan cortinas a este tiro. */
  otsNum: string[];
};

const cm = (m: number): number => Math.round(m * 100);

/** El ancho que la cortina ocupa a lo ancho del tiro (igual que `anchoEmpaque`). */
const anchoOcupadoCm = (r: OptimizerRow): number =>
  typeof r.anchoCorteTelaCm === 'number' ? Math.round(r.anchoCorteTelaCm) : cm(r.ancho);

/**
 * Los tiros del lote, en el orden en que se bajan del rollo. Cada uno dice qué
 * cortinas trae y de qué orden es cada una: es lo que el dimensionador tiene
 * adelante cuando le llega la tela cortada.
 */
export function tirosDelLote(
  filas: FilaLote[],
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): TiroLote[] {
  if (filas.length === 0) return [];
  // La MISMA cuenta de «qué se corta junto» que usan la hoja de corte, el
  // Dimensionado y las etiquetas: si acá se contara distinto, el taller vería
  // dos verdades.
  const panoDe = panoDeCadaFila(filas, params);

  const porPano = new Map<number, TiroLote>();
  filas.forEach((r, i) => {
    const n = panoDe[i];
    let tiro = porPano.get(n);
    if (!tiro) {
      tiro = {
        numero: n,
        letra: letraPano(n),
        codInt: r.codInt,
        esVertical: !!r.esVertical,
        altoCorteCm: 0,
        anchoRolloCm: cm(r.anchoRollo),
        anchoUsadoCm: 0,
        cortinas: [],
        otsNum: [],
      };
      porPano.set(n, tiro);
    }
    const anchoCm = anchoOcupadoCm(r);
    const altoCm = cm(r.altoCorte);
    tiro.cortinas.push({
      otId: r.otId,
      otNum: r.otNum,
      piezaId: clavePieza(r.ventanaId, r.panoIndex),
      ubicacion: r.ubicacion,
      producto: r.producto,
      codInt: r.codInt,
      anchoCm,
      altoCm,
    });
    // El tiro se baja al alto de la cortina MÁS ALTA: las más bajas viajan en
    // el ancho que sobra, sin gastar un centímetro más de rollo.
    tiro.altoCorteCm = Math.max(tiro.altoCorteCm, altoCm);
    tiro.anchoUsadoCm += anchoCm;
    if (!tiro.otsNum.includes(r.otNum)) tiro.otsNum.push(r.otNum);
  });

  return [...porPano.values()].sort((a, b) => a.numero - b.numero);
}

/** ¿Este tiro mezcla cortinas de más de una orden? */
export function esTiroCompartido(t: TiroLote): boolean {
  return t.otsNum.length > 1;
}

/**
 * Las letras del lote, repartidas por orden.
 *
 * El cálculo general de cada OT recibe su propio mapa `${ventanaId}_${panoIndex}`
 * → letra. Se arma uno POR ORDEN (y no uno global) porque dos OTs distintas
 * pueden traer ventanas con el mismo id y las llaves se pisarían.
 */
export function juntoPorOT(
  filas: FilaLote[],
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): Map<string, Map<string, JuntoPieza>> {
  const panoDe = panoDeCadaFila(filas, params);
  const porOT = new Map<string, Map<string, JuntoPieza>>();
  filas.forEach((r, i) => {
    let mapa = porOT.get(r.otId);
    if (!mapa) {
      mapa = new Map<string, JuntoPieza>();
      porOT.set(r.otId, mapa);
    }
    mapa.set(clavePieza(r.ventanaId, r.panoIndex), {
      letra: letraPano(panoDe[i]),
      // La inversión la sigue decidiendo la fila, no el lote.
      invertida: false,
    });
  });
  return porOT;
}

/** Resumen para el encabezado: cuántos tiros, cuántos compartidos y metros. */
export function resumenTiros(tiros: TiroLote[]): {
  tiros: number;
  compartidos: number;
  cortinas: number;
  metros: number;
} {
  return {
    tiros: tiros.length,
    compartidos: tiros.filter(esTiroCompartido).length,
    cortinas: tiros.reduce((s, t) => s + t.cortinas.length, 0),
    metros: Math.round(tiros.reduce((s, t) => s + t.altoCorteCm, 0)) / 100,
  };
}
