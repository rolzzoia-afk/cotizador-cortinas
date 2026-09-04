// Plan de Corte desde Colmena — algoritmo puro.
// Portado desde public/legacy/index.html (líneas 6794-7083):
//   - mxFit / mxSplit / mxPack (MaxRects BSSF packing 2D guillotine)
//   - _tipoPrio (Regla 3 — prioridad por tipo de sobrante)
//   - extraCmPorTipo (Regla 7 — extra cm al alto según producto)
//   - generarPlanCorte (motor principal: 4 reglas de match + packing + output)

import type { OT, VentanaItem } from '@/modules/ots/types';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import { libresClasificados, type RectLibre } from './libresPano';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import {
  cortesOscuridad,
  familiaOscuridad,
  normalizarVarianteOscuridad,
} from '@/modules/descuentos/reglas-oscuridad';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';

// ── Tipos del plan ───────────────────────────────────────────────────
export type ColmenaPanoRow = {
  id: string;
  codigo: string | null;
  medida_ancho: number | null;
  medida_alto: number | null;
  tipo?: string | null;
  ubicacion?: string | null;
  disponible: boolean;
  ot_asignada: string | null;
  created_at?: string | null;
  datos_extra?: {
    creadoEn?: string;
    ot_origen?: string;
    fuente?: string;
    fecha_origen?: string;
  } | null;
};

export type PanoColmena = {
  _docId: string;
  cod: string;
  ancho: number;
  alto: number;
  ubicacion: string;
  tipo: string;
  creadoEn: string;
};

export type Pieza = {
  id: string;
  nombre: string;
  codInt: string;
  otId: string;
  otNum: string;
  w: number;
  h: number;
  /**
   * La cortina NO se puede girar, ni en colmena ni en el rollo. Hoy son las
   * VERTICALES: su tela se corta en lamas de 8,9 cm que siempre entran a lo
   * ancho del rollo; acostadas, las lamas quedarían atravesadas. La hoja de
   * corte ya lo decía (`esFilaInvertida`), pero la pasada con rotación del
   * rollo las giraba igual.
   */
  noGira?: boolean;
};

export type Placed = Pieza & {
  px: number;
  py: number;
  pw: number;
  ph: number;
  rot: boolean;
  failed: boolean;
};

export type GrupoSobrante = {
  sobrante: PanoColmena;
  placed: Placed[];
  /** 1 = el paño se usó ENTERO (no sobró nada que anotar); 2 = quedó algo. */
  regla: 1 | 2;
  uw: number;
  uh: number;
  /** Lo que queda del paño una vez cortado: qué vuelve al rack y qué se perdió. */
  libres: RectLibre[];
  /** El orden en que la mesa parte el paño; `null` si no es cortable (multieje). */
  cortes: CorteGuillotina[] | null;
  /** Hay piezas propuestas GIRADAS: el operario las autoriza una por una. */
  tieneRotaciones: boolean;
  piezasRotadas: Placed[];
  /** Puntaje con que este paño le ganó a los demás (cm²; menos es mejor). */
  costo: number;
};

export type GrupoRollo = {
  codInt: string;
  placed: Placed[];
  anchoUtil: number;
  altoUtil: number;
  anchoCorte: number;
  altoCorte: number;
  efic: number;
  sobInterno: { ancho: number; alto: number } | null;
  tieneRotaciones: boolean;
  piezasRotadas: Placed[];
  layoutVertical: Placed[] | null;
  altoVertical: number | null;
  eficVertical: number;
  sobInternoV: { ancho: number; alto: number } | null;
  decisiones: Record<string, boolean>;
};

export type GrupoSinStock = { codInt: string; piezas: Pieza[] };

/** Ajustes por corrida del motor (los toma la UI, no la configuración). */
export type OpcionesPlan = {
  /**
   * IDs de pieza cuyo GIRO el operario rechazó. Vuelven a empacarse derechas —
   * en otro paño o en el rollo—, igual que en las tarjetas de rollo.
   */
  sinGiro?: ReadonlySet<string>;
};

export type OTIncluida = { id: string; num: string; cliente: string };

export type Plan = {
  sobrantes: GrupoSobrante[];
  rollo: GrupoRollo[];
  sinStock: GrupoSinStock[];
  otsIncluidas: OTIncluida[];
};

// ── Helpers ──────────────────────────────────────────────────────────
const COLMENA_TIPO_PRIO: Record<string, number> = {
  FALLA: 0,
  'ERROR CORTE': 1,
  CANCELACION: 2,
  SOBRANTE: 3,
};

function tipoPrio(t: string): number {
  return COLMENA_TIPO_PRIO[(t || '').toUpperCase().trim()] ?? 99;
}

// ── Reglas Rolzzo v1.0 (2026-06-26) ──────────────────────────────────
// Medida mínima para que un sobrante se registre como COLMENA reutilizable.
// Por debajo de esto el remanente es MERMA (no entra al inventario activo).
// Defaults históricos; editables en Parámetros de corte (parametrosCorte.ts).
export const COLMENA_MIN_ANCHO = 120; // cm
export const COLMENA_MIN_ALTO = 180; // cm

/** ¿Un remanente (ancho × alto, cm) califica como colmena reutilizable? */
export function esColmena(
  ancho: number,
  alto: number,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): boolean {
  return ancho >= params.colmenaMinAnchoCm && alto >= params.colmenaMinAltoCm;
}

/**
 * Comparador FIFO: más antiguo primero. `creadoEn` es ISO ('' si no se sabe).
 * Los sin fecha van al final (no se pueden ordenar por antigüedad). Desempata
 * por tipo de sobrante (FALLA/ERROR antes que SOBRANTE intacto).
 */
function ordenFifo(a: PanoColmena, b: PanoColmena): number {
  const fa = a.creadoEn || '';
  const fb = b.creadoEn || '';
  if (fa && fb) {
    if (fa !== fb) return fa < fb ? -1 : 1;
  } else if (fa) return -1;
  else if (fb) return 1;
  return tipoPrio(a.tipo) - tipoPrio(b.tipo);
}

// Regla 7: extra cm al alto según tipo de producto.
// DUO = extraDuoCm (default 30): el corte real del paño dúo es 2×alto+30
// (tela.ts / Excel oficial); con el 10 anterior la reserva quedaba 20 cm más
// corta que la tela necesaria y un sobrante insuficiente podía darse por
// válido. Cada tipo usa LA MISMA clave que su corte real (regla "nunca
// inferior" garantizada por construcción).
export function extraCmPorTipo(
  v: VentanaItem,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): number {
  const prod = (v.producto || '').toUpperCase();
  const tipo = (v.tipo || '').toUpperCase();
  if (prod.includes('DUO')) return params.extraDuoCm;
  if (prod.includes('VERTICAL') || tipo.includes('VERTICAL')) return params.extraVerticalCm;
  return params.extraAltoCm; // Rollers SC, BK y otros
}

// Normaliza fila de colmena_panos (Supabase) al tipo interno usado por el algoritmo
export function rowToPano(row: ColmenaPanoRow): PanoColmena {
  return {
    _docId: row.id,
    cod: (row.codigo || '').toString(),
    ancho: Number(row.medida_ancho) || 0,
    alto: Number(row.medida_alto) || 0,
    ubicacion: (row.ubicacion || '').toString(),
    tipo: (row.tipo || '').toString(),
    // Fecha de ingreso para FIFO: explícita (creadoEn) → fecha de origen del
    // sobrante (ROLZZO) → timestamp de fila en BD. '' si no hay ninguna.
    creadoEn:
      row.datos_extra?.creadoEn ||
      row.datos_extra?.fecha_origen ||
      row.created_at ||
      '',
  };
}

// ── MaxRects BSSF packing ────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number };

function mxFit(item: Pieza, F: Rect[], allowRot = true): Placed | null {
  let bs = Infinity;
  let bF: Rect | null = null;
  let bW = 0;
  let bH = 0;
  let bR = false;
  // Una pieza marcada `noGira` (vertical, o un giro que el operario rechazó) no
  // entra a las ramas rotadas por más que la pasada lo permita.
  const gira = allowRot && !item.noGira;
  for (const fr of F) {
    if (item.w <= fr.w && item.h <= fr.h) {
      const s = Math.min(fr.w - item.w, fr.h - item.h);
      if (s < bs) {
        bs = s;
        bF = fr;
        bW = item.w;
        bH = item.h;
        bR = false;
      }
    }
    if (gira && item.h <= fr.w && item.w <= fr.h) {
      const s = Math.min(fr.w - item.h, fr.h - item.w);
      if (s < bs) {
        bs = s;
        bF = fr;
        bW = item.h;
        bH = item.w;
        bR = true;
      }
    }
  }
  if (!bF) return null;
  return { ...item, px: bF.x, py: bF.y, pw: bW, ph: bH, rot: bR, failed: false };
}

function mxSplit(F: Rect[], p: Placed): Rect[] {
  const out: Rect[] = [];
  for (const fr of F) {
    if (
      p.px >= fr.x + fr.w ||
      p.px + p.pw <= fr.x ||
      p.py >= fr.y + fr.h ||
      p.py + p.ph <= fr.y
    ) {
      out.push(fr);
      continue;
    }
    if (p.px > fr.x) out.push({ x: fr.x, y: fr.y, w: p.px - fr.x, h: fr.h });
    if (p.px + p.pw < fr.x + fr.w)
      out.push({ x: p.px + p.pw, y: fr.y, w: fr.x + fr.w - (p.px + p.pw), h: fr.h });
    if (p.py > fr.y) out.push({ x: fr.x, y: fr.y, w: fr.w, h: p.py - fr.y });
    if (p.py + p.ph < fr.y + fr.h)
      out.push({ x: fr.x, y: p.py + p.ph, w: fr.w, h: fr.y + fr.h - (p.py + p.ph) });
  }
  return out.filter(
    (a, i) =>
      !out.some(
        (b, j) =>
          j !== i &&
          b.x <= a.x &&
          b.y <= a.y &&
          b.x + b.w >= a.x + a.w &&
          b.y + b.h >= a.y + a.h,
      ),
  );
}

function mxPack(items: Pieza[], uw: number, uh: number, allowRot = true): Placed[] {
  let F: Rect[] = [{ x: 0, y: 0, w: uw, h: uh }];
  const placed: Placed[] = [];
  const sorted = [...items].sort((a, b) => b.w * b.h - a.w * a.h);
  for (const item of sorted) {
    const r = mxFit(item, F, allowRot);
    if (r) {
      placed.push(r);
      F = mxSplit(F, r);
    } else {
      placed.push({
        ...item,
        px: -1,
        py: -1,
        pw: item.w,
        ph: item.h,
        rot: false,
        failed: true,
      });
    }
  }
  return placed;
}

// ── Empaque GUILLOTINA (las mesas de hoy) ────────────────────────────
//
// La mesa corta de punta a punta y la otra dirección se consigue GIRANDO el
// paño (recorrido del taller, 2026-09-01), así que un layout solo sirve si se
// puede ir partiendo en dos, una y otra vez. MaxRects no garantiza eso: acomoda
// piezas "a caballo" que ninguna cuchilla separa de una pasada — medido sobre
// 122 OTs reales, el 4 % de sus layouts es imposible de cortar y el resto no
// dice en qué orden hacerlo.
//
// Acá los libres son DISJUNTOS y cada pieza parte su sobrante con UN corte
// recto, así que el árbol de cortes existe por construcción y
// `secuenciaCortes` lo reconstruye para el papel del cortador.

/** Cómo se parte el sobrante después de acomodar una pieza. */
type ReglaSplit = 'ejeCorto' | 'sobraCorta';

/**
 * Parte el libre `fr` tras poner una pieza de w×h en su esquina, con UN corte.
 * Devuelve los dos pedazos (sin los de área cero), siempre disjuntos.
 */
function partirLibre(fr: Rect, w: number, h: number, regla: ReglaSplit): Rect[] {
  const restW = fr.w - w;
  const restH = fr.h - h;
  // Corte transversal (línea horizontal): arriba queda la franja de la pieza
  // con su sobrante al lado; abajo, el resto a todo el ancho.
  const transversal = regla === 'ejeCorto' ? fr.w < fr.h : restW < restH;
  const pedazos = transversal
    ? [
        { x: fr.x + w, y: fr.y, w: restW, h },
        { x: fr.x, y: fr.y + h, w: fr.w, h: restH },
      ]
    : [
        { x: fr.x + w, y: fr.y, w: restW, h: fr.h },
        { x: fr.x, y: fr.y + h, w, h: restH },
      ];
  return pedazos.filter((r) => r.w > 0 && r.h > 0);
}

/** Mejor libre para la pieza: el de menor lado corto sobrante (BSSF). */
function guillotinaFit(
  item: Pieza,
  F: Rect[],
  allowRot: boolean,
): { fr: Rect; w: number; h: number; rot: boolean } | null {
  let mejor: { fr: Rect; w: number; h: number; rot: boolean } | null = null;
  let mejorSobra = Infinity;
  const gira = allowRot && !item.noGira;
  for (const fr of F) {
    if (item.w <= fr.w && item.h <= fr.h) {
      const s = Math.min(fr.w - item.w, fr.h - item.h);
      if (s < mejorSobra) {
        mejorSobra = s;
        mejor = { fr, w: item.w, h: item.h, rot: false };
      }
    }
    if (gira && item.h <= fr.w && item.w <= fr.h) {
      const s = Math.min(fr.w - item.h, fr.h - item.w);
      if (s < mejorSobra) {
        mejorSobra = s;
        mejor = { fr, w: item.h, h: item.w, rot: true };
      }
    }
  }
  return mejor;
}

function guillotinaVariante(
  items: Pieza[],
  uw: number,
  uh: number,
  allowRot: boolean,
  orden: (a: Pieza, b: Pieza) => number,
  regla: ReglaSplit,
): Placed[] {
  let F: Rect[] = [{ x: 0, y: 0, w: uw, h: uh }];
  const placed: Placed[] = [];
  for (const item of [...items].sort(orden)) {
    const best = guillotinaFit(item, F, allowRot);
    if (!best) {
      placed.push({ ...item, px: -1, py: -1, pw: item.w, ph: item.h, rot: false, failed: true });
      continue;
    }
    placed.push({
      ...item,
      px: best.fr.x,
      py: best.fr.y,
      pw: best.w,
      ph: best.h,
      rot: best.rot,
      failed: false,
    });
    F = F.filter((r) => r !== best.fr).concat(partirLibre(best.fr, best.w, best.h, regla));
  }
  return placed;
}

/**
 * Cuántos paños FÍSICOS baja este acomodo: uno, más una costura por cada
 * borde de pieza que cruza el rollo de lado a lado sin que otra pieza lo
 * atraviese. Cada costura es un corte transversal completo — un trozo que se
 * baja del rollo—, y eso es lo que la mesa cuenta como paño y lo que
 * producción quiere cortar menos veces.
 */
export function bandasDeLayout(placed: readonly Placed[]): number {
  const puestas = placed.filter((r) => !r.failed);
  if (puestas.length === 0) return 0;
  const usedH = puestas.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
  const costuras = new Set<number>();
  for (const p of puestas) {
    const y = p.py + p.ph;
    if (y <= 1e-9 || y >= usedH - 1e-9) continue;
    if (puestas.some((q) => q.py < y - 1e-9 && q.py + q.ph > y + 1e-9)) continue;
    costuras.add(Math.round(y * 100) / 100);
  }
  return 1 + costuras.size;
}

// Órdenes de entrada que se prueban. Ninguna gana siempre: con cortinas altas
// y angostas el orden por ALTO arma bandas limpias, y con piezas parejas el de
// ÁREA aprovecha mejor los rincones. Probarlas todas y quedarse con la que baja
// menos rollo recupera parte de lo que cuesta la restricción de guillotina.
const ORDENES_GUILLOTINA: ((a: Pieza, b: Pieza) => number)[] = [
  (a, b) => b.w * b.h - a.w * a.h,
  (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h),
  (a, b) => b.h - a.h || b.w - a.w,
  (a, b) => b.w - a.w || b.h - a.h,
];
const REGLAS_SPLIT: ReglaSplit[] = ['sobraCorta', 'ejeCorto'];

/**
 * Empaque cortable por la mesa: mismo contrato que `mxPack` (un `Placed` por
 * pieza, con `failed` cuando no entró), probando varias heurísticas y quedándose
 * con la que gasta menos rollo.
 */
export function guillotinaPack(
  items: Pieza[],
  uw: number,
  uh: number,
  allowRot = true,
): Placed[] {
  let mejor: Placed[] | null = null;
  let mejorAlto = Infinity;
  let mejorBandas = Infinity;
  for (const orden of ORDENES_GUILLOTINA) {
    for (const regla of REGLAS_SPLIT) {
      const pl = guillotinaVariante(items, uw, uh, allowRot, orden, regla);
      if (pl.some((r) => r.failed)) continue;
      const alto = pl.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
      const bandas = bandasDeLayout(pl);
      // Menos rollo primero; a igual rollo, MENOS PAÑOS. Producción prefiere
      // bajar menos trozos del rollo (2026-09-03), y este desempate no cuesta
      // un centímetro de tela: antes, entre dos acomodos del mismo alto, se
      // quedaba con el primero que apareciera.
      if (alto < mejorAlto || (alto === mejorAlto && bandas < mejorBandas)) {
        mejorAlto = alto;
        mejorBandas = bandas;
        mejor = pl;
      }
    }
  }
  // Ninguna variante ubicó todo: se devuelve una con sus `failed` para que el
  // binary search siga subiendo el alto, igual que hace MaxRects.
  return (
    mejor ??
    guillotinaVariante(items, uw, uh, allowRot, ORDENES_GUILLOTINA[0], REGLAS_SPLIT[0])
  );
}

// ── Empaque PARCIAL: acomodar lo que se pueda dentro de un paño ──────
//
// Distinto del rollo: el rollo es infinito a lo largo y la pregunta es «¿hasta
// dónde bajo?». Un paño de colmena tiene las dos medidas fijas, así que la
// pregunta es «¿cuántas de estas cortinas caben, y qué queda?». Se prueban las
// mismas heurísticas que en el rollo y gana la que deja el paño mejor
// aprovechado; las que no entran quedan `failed` y se buscan otro paño.

/** Lo que un paño ofrece para un conjunto de piezas. */
export type AcomodoPano = {
  placed: Placed[];
  /** Cuántas piezas entraron. */
  n: number;
  libres: RectLibre[];
  /** cm² de tela que se pierde (los libres que no sirven para otra cortina). */
  mermaCm2: number;
  /** Trozos que vuelven al rack: cada uno es un paño MÁS en la colmena. */
  sobrantesUtiles: number;
  /** Área libre total (cm²), para desempatar. */
  libreCm2: number;
  /** Puntaje: merma + penalidad por cada paño nuevo. Menos es mejor. */
  costo: number;
};

function evaluarAcomodo(
  placed: Placed[],
  uw: number,
  uh: number,
  params: ParametrosCorte,
): AcomodoPano {
  const puestas = placed.filter((p) => !p.failed);
  const libres = libresClasificados(puestas, uw, uh, params);
  let mermaCm2 = 0;
  let libreCm2 = 0;
  let sobrantesUtiles = 0;
  for (const r of libres) {
    const area = r.anchoCm * r.altoCm;
    libreCm2 += area;
    if (r.clase === 'sobrante') sobrantesUtiles++;
    else mermaCm2 += area;
  }
  return {
    placed,
    n: puestas.length,
    libres,
    mermaCm2,
    sobrantesUtiles,
    libreCm2,
    costo: mermaCm2 + sobrantesUtiles * params.colmenaPenalidadNuevoPanoCm2,
  };
}

/**
 * Acomoda dentro de un paño de `uw × uh` todas las piezas que quepan.
 *
 * En `guillotina` prueba las mismas 4 órdenes × 2 reglas de partición que el
 * rollo y se queda con el acomodo de MENOR costo: primero el que mete más
 * cortinas (un paño que resuelve dos ventanas vale más que uno que resuelve
 * una), después el de menor puntaje. En `multieje` usa MaxRects, igual que el
 * rollo con la CNC.
 */
export function empacarEnPano(
  items: Pieza[],
  uw: number,
  uh: number,
  allowRot: boolean,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): AcomodoPano {
  if (params.modoCorte === 'multieje') {
    return evaluarAcomodo(mxPack(items, uw, uh, allowRot), uw, uh, params);
  }
  let mejor: AcomodoPano | null = null;
  for (const orden of ORDENES_GUILLOTINA) {
    for (const regla of REGLAS_SPLIT) {
      const cand = evaluarAcomodo(
        guillotinaVariante(items, uw, uh, allowRot, orden, regla),
        uw,
        uh,
        params,
      );
      if (!mejor) {
        mejor = cand;
        continue;
      }
      // Más cortinas resueltas manda; a igualdad, el puntaje; después, menos
      // trozos sueltos y menos tela ociosa.
      const gana =
        cand.n > mejor.n ||
        (cand.n === mejor.n &&
          (cand.costo < mejor.costo ||
            (cand.costo === mejor.costo &&
              (cand.sobrantesUtiles < mejor.sobrantesUtiles ||
                (cand.sobrantesUtiles === mejor.sobrantesUtiles && cand.libreCm2 < mejor.libreCm2)))));
      if (gana) mejor = cand;
    }
  }
  return mejor ?? evaluarAcomodo([], uw, uh, params);
}

// ── Secuencia de cortes ──────────────────────────────────────────────

export type CorteGuillotina = {
  /** Orden de ejecución, 1..n. */
  n: number;
  /** `transversal` = la cuchilla cruza el ancho; `longitudinal` = a lo largo. */
  eje: 'transversal' | 'longitudinal';
  /** Medida (cm) desde el borde de la pieza que se tiene en la mesa. */
  posicionCm: number;
  /** Trozo de tela que se está partiendo (para ubicarse en el dibujo). */
  region: { x: number; y: number; w: number; h: number };
  /** Qué queda a cada lado del corte. */
  deja: [string, string];
  /** El corte va en el otro sentido que el anterior: hay que girar el paño. */
  girar: boolean;
};

const rotuloPiezas = (piezas: Placed[]): string => {
  const nombres = piezas.map((p) => p.nombre);
  if (nombres.length <= 2) return nombres.join(' + ');
  return `${nombres.slice(0, 2).join(' + ')} +${nombres.length - 2} más`;
};

type CorteCrudo = Omit<CorteGuillotina, 'n' | 'girar'>;

/**
 * Parte la región en dos, una y otra vez, hasta dejar cada cortina sola.
 * Devuelve null si en algún nivel NINGÚN corte de punta a punta separa las
 * piezas — o sea, si el layout no es cortable por la mesa.
 */
function cortesDeRegion(
  region: { x: number; y: number; w: number; h: number },
  piezas: Placed[],
  presupuesto: { n: number },
): CorteCrudo[] | null {
  if (piezas.length <= 1) return [];
  if (presupuesto.n-- <= 0) return null;

  const candidatos = (
    ejeInicio: (p: Placed) => number,
    ejeFin: (p: Placed) => number,
    desde: number,
    largo: number,
  ) =>
    [...new Set(piezas.map((p) => ejeFin(p)))]
      .filter((v) => v > desde && v < desde + largo)
      .sort((a, b) => a - b)
      .filter((v) => !piezas.some((p) => ejeInicio(p) < v && ejeFin(p) > v));

  // El transversal primero: es el corte natural del rollo (separa una banda).
  for (const y of candidatos((p) => p.py, (p) => p.py + p.ph, region.y, region.h)) {
    const arriba = piezas.filter((p) => p.py + p.ph <= y);
    const abajo = piezas.filter((p) => p.py >= y);
    if (!arriba.length || !abajo.length) continue;
    const a = cortesDeRegion({ ...region, h: y - region.y }, arriba, presupuesto);
    if (!a) continue;
    const b = cortesDeRegion(
      { x: region.x, y, w: region.w, h: region.y + region.h - y },
      abajo,
      presupuesto,
    );
    if (!b) continue;
    return [
      {
        eje: 'transversal',
        posicionCm: Math.round(y - region.y),
        region,
        deja: [rotuloPiezas(arriba), rotuloPiezas(abajo)],
      },
      ...a,
      ...b,
    ];
  }

  for (const x of candidatos((p) => p.px, (p) => p.px + p.pw, region.x, region.w)) {
    const izq = piezas.filter((p) => p.px + p.pw <= x);
    const der = piezas.filter((p) => p.px >= x);
    if (!izq.length || !der.length) continue;
    const a = cortesDeRegion({ ...region, w: x - region.x }, izq, presupuesto);
    if (!a) continue;
    const b = cortesDeRegion(
      { x, y: region.y, w: region.x + region.w - x, h: region.h },
      der,
      presupuesto,
    );
    if (!b) continue;
    return [
      {
        eje: 'longitudinal',
        posicionCm: Math.round(x - region.x),
        region,
        deja: [rotuloPiezas(izq), rotuloPiezas(der)],
      },
      ...a,
      ...b,
    ];
  }

  return null;
}

/**
 * El orden en que la mesa corta un paño: cada paso parte en dos lo que el
 * cortador tiene delante. `null` = el layout NO se puede cortar de punta a
 * punta (solo pasa en modo multieje, con la cortadora CNC).
 */
export function secuenciaCortes(
  piezas: Placed[],
  uw: number,
  uh: number,
): CorteGuillotina[] | null {
  const utiles = piezas.filter((p) => !p.failed);
  if (utiles.length === 0) return [];
  const crudos = cortesDeRegion({ x: 0, y: 0, w: uw, h: uh }, utiles, { n: 5000 });
  if (!crudos) return null;
  let anterior: CorteGuillotina['eje'] | null = null;
  return crudos.map((c, i) => {
    const girar = anterior !== null && c.eje !== anterior;
    anterior = c.eje;
    return { ...c, n: i + 1, girar };
  });
}

/** ¿La mesa puede ejecutar este layout de punta a punta? */
export function esLayoutGuillotina(piezas: Placed[], uw: number, uh: number): boolean {
  return secuenciaCortes(piezas, uw, uh) !== null;
}

// ── Motor principal ────────────────────────────────────────────────
export function generarPlanCorte(
  ots: OT[],
  colmenaPanos: PanoColmena[],
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  formulas?: FormulasFamilias,
  tipos?: readonly TipoCortina[],
  opciones?: OpcionesPlan,
): Plan {
  const MARGEN = params.margenRolloCm; // margen por lado (default 1 cm)
  const BORDE = params.bordeCm; // limpieza de bordes al ancho (Regla 5, default 4 cm)
  const ROLL_W_UTIL = params.anchoRolloPlanCm - MARGEN * 2;
  const multiOT = ots.length > 1;

  // Con qué empacador se acomodan las piezas en el rollo. Las mesas de hoy
  // cortan de punta a punta (guillotina); la cortadora CNC acepta cualquier
  // acomodo y ahí sí conviene MaxRects, que aprovecha algo más la tela.
  const empacar = params.modoCorte === 'multieje' ? mxPack : guillotinaPack;

  // Colmena apagada en los parámetros de corte: el plan corta TODO de rollo
  // nuevo. Se vacía la lista acá —una sola vez, en el motor— porque este es el
  // único camino por el que pasan el plan de la UI, el Excel de corte, el PDF,
  // las etiquetas de paños y el descuento de inventario al confirmar el corte:
  // sin piezas de origen colmena, ninguno de esos la toca.
  const colmena = params.usarColmenaPanos === false ? [] : colmenaPanos;

  // Ancho real que una pieza necesita de un SOBRANTE: al reusar tela ya cortada
  // NO se aplica el margen de corte limpio del rollo (BORDE), basta el ancho
  // nominal de la cortina. Así una cortina de 144 cm entra en un sobrante de
  // 146 (antes 144+4=148 lo rechazaba). El corte del rollo conserva su BORDE.
  const anchoSob = (w: number) => w - BORDE;

  // El giro dentro de un paño se PROPONE y el operario lo autoriza pieza por
  // pieza, igual que en el rollo. Las verticales quedan fuera por su cuenta
  // (`Pieza.noGira`), esté el interruptor como esté.
  const permiteGiroColmena = params.colmenaPermiteGiro !== false;

  // ── 1. Armar la lista de piezas desde todas las ventanas ──────────
  const piezas: Pieza[] = [];

  ots.forEach((otItem) => {
    const ventanas = otItem.storeVentanas || [];
    const otNum = otItem.datosGenerales?.ot || String(otItem.id);

    ventanas.forEach((v) => {
      if (!v.panos || v.panos.length === 0) return;
      const extraCm = extraCmPorTipo(v, params); // Regla 7
      const isDuo = (v.producto || '').toUpperCase().includes('DUO');
      // La vertical nunca se acuesta: su tela se corta en lamas de 8,9 cm que
      // van a lo ancho del rollo. Mismo criterio que `esFilaInvertida`.
      const esVertical =
        (v.producto || '').toUpperCase().includes('VERTICAL') ||
        (v.tipo || '').toUpperCase().includes('VERTICAL');

      v.panos.forEach((p, pi) => {
        const altoFuente = parseFloat(String(p.alto ?? v.alto ?? 0)) || 0;
        const altoBase = Math.round(altoFuente * 100) + extraCm;
        const altoCm = isDuo ? Math.round(altoFuente * 100) * 2 + extraCm : altoBase;
        const anchoNominalCm = Math.round(parseFloat(String(p.ancho)) * 100);
        // OSCURIDAD (Soft Light / Oscuranti / Dark): la tela se corta al ancho REAL
        // del despiece (ancho + TELA_ADJ), no al nominal. En EXTERNO el corte es
        // MÁS ancho que el nominal, así que el sobrante debe alcanzar ese ancho.
        const familiaOsc = familiaOscuridad(v.categoria, p.cenefa as string | null | undefined, tipos);
        const anchoCorteOsc = familiaOsc
          ? cortesOscuridad(
              familiaOsc,
              normalizarVarianteOscuridad(
                (p.oscuridadVariante as string | undefined) ??
                  (v.oscuridadVariante as string | undefined) ??
                  (v.sentido as string | undefined),
              ),
              anchoNominalCm,
              0,
              {},
              {},
              undefined,
              formulas?.oscuridad,
            ).find((c) => c.componente === 'Tela (ancho)')?.medidaCm
          : undefined;
        const anchoCm = Math.round(anchoCorteOsc ?? anchoNominalCm) + BORDE;
        if (!anchoCm || !altoCm) return;
        const panoSuffix = v.panos!.length > 1 ? ` P${pi + 1}` : '';
        const label = multiOT
          ? `OT${otNum}·${v.ubicacion}${panoSuffix}`
          : `${v.ubicacion}${panoSuffix}`;
        piezas.push({
          id: `${otItem.id}_${v.id}_p${pi}`,
          nombre: label,
          // Dual: cada paño matchea la colmena con SU tela; si no, la de la ventana.
          codInt: ((p.codInt as string) || v.codInt || '').toUpperCase().trim(),
          otId: String(otItem.id),
          otNum,
          w: anchoCm,
          h: altoCm,
          noGira: esVertical,
        });
      });
    });
  });

  const plan: Plan = {
    sobrantes: [],
    rollo: [],
    sinStock: [],
    otsIncluidas: ots.map((o) => ({
      id: String(o.id),
      num: o.datosGenerales?.ot || '—',
      cliente: o.datosGenerales?.cliente || '—',
    })),
  };

  if (piezas.length === 0) return plan;

  // ── 2. Agrupar por COD_INT ────────────────────────────────────────
  const porCod: Record<string, Pieza[]> = {};
  piezas.forEach((p) => {
    if (!porCod[p.codInt]) porCod[p.codInt] = [];
    porCod[p.codInt].push(p);
  });

  const porAltura = (arr: Pieza[]): Pieza[] =>
    [...arr].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

  // ── 3. Por cada codInt: matchear contra colmena (reglas 1-4) + packing ──
  Object.entries(porCod).forEach(([codInt, grupo]) => {
    const sinCubrir: (Pieza | null)[] = [...grupo];

    // Orden FIFO (más antigua primero), desempatando por tipo de sobrante
    // (FALLA/ERROR antes que SOBRANTE). Reglas Rolzzo v1.0: cuando hay 2+
    // colmenas que coinciden EXACTO (código + medida), se usa la más antigua
    // (Regla 1 abajo toma la primera del orden). En el best-fit (Regla 2) la
    // antigüedad solo desempata cuando sobra y tipo son idénticos: la decide
    // la optimización (minimizar colmena), no la fecha.
    // Una pieza SIN código (ventana a medio llenar) no puede tomar los paños
    // que tampoco lo tienen: `colmena_panos.codigo` viene null en varias filas
    // viejas y '' === '' las hacía calzar con cualquier tela.
    const disponiblesOrdenados = codInt
      ? colmena.filter((s) => s.cod.toUpperCase().trim() === codInt).sort(ordenFifo)
      : [];

    const usadosEnPlan = new Set<string>();

    // ── Colmena: cada paño se aprovecha EN DOS DIMENSIONES ─────────────
    //
    // Antes había dos reglas separadas: un match exacto (que casi nunca
    // disparaba, porque el ancho de la pieza traía el BORDE del rollo) y un
    // ajuste que ponía las cortinas en UNA fila, rechazaba todo paño más alto
    // que la cortina + 30 cm y elegía por ancho sobrante. Resultado: dos
    // cortinas de 2,90×0,95 no entraban en un paño de 300×250 —donde caben
    // apiladas de sobra— y una cortina que solo entraba girada se iba al rollo.
    //
    // Ahora, en cada ronda, se prueba el conjunto pendiente contra TODOS los
    // paños libres del código y gana el de menor `costo`:
    //
    //     costo = merma (cm²) + n.º de trozos que vuelven al rack × penalidad
    //
    // La penalidad (`colmenaPenalidadNuevoPanoCm2`, ≈ un paño mínimo de roller)
    // es la regla n.º 1 del dueño puesta en números: entre gastar el paño JUSTO
    // y partir uno GRANDE dejando otro paño en el rack, gana el justo aunque
    // deje más merma. Un calce exacto cuesta 0 y gana solo, así que la vieja
    // Regla 1 sale gratis; entre dos paños empatados sigue mandando el FIFO.
    for (;;) {
      const pendientes = sinCubrir
        .map((p, i) => ({ p, i }))
        .filter((c): c is { p: Pieza; i: number } => c.p !== null);
      if (pendientes.length === 0) break;

      // Piezas tal como se cortan de un paño: al reusar tela ya cortada NO se
      // aplica la limpieza de bordes del rollo (basta el ancho nominal), y una
      // pieza cuyo giro el operario rechazó vuelve a entrar como `noGira`.
      const items = pendientes.map(({ p }) => ({
        ...p,
        w: Math.max(1, anchoSob(p.w)),
        noGira: p.noGira || opciones?.sinGiro?.has(p.id) === true,
      }));

      let mejor: { sob: PanoColmena; acomodo: AcomodoPano } | null = null;
      for (const sob of disponiblesOrdenados) {
        if (usadosEnPlan.has(sob._docId)) continue;
        if (!(sob.ancho > 0) || !(sob.alto > 0)) continue;
        const acomodo = empacarEnPano(items, sob.ancho, sob.alto, permiteGiroColmena, params);
        if (acomodo.n === 0) continue;
        if (!mejor) {
          mejor = { sob, acomodo };
          continue;
        }
        const a = acomodo;
        const b = mejor.acomodo;
        // Menor puntaje; después menos trozos sueltos, menos tela ociosa y —ya
        // empatado todo— el paño más antiguo (`disponiblesOrdenados` viene en
        // orden FIFO, así que basta con NO reemplazar en el empate).
        const gana =
          a.costo < b.costo ||
          (a.costo === b.costo &&
            (a.sobrantesUtiles < b.sobrantesUtiles ||
              (a.sobrantesUtiles === b.sobrantesUtiles &&
                (a.libreCm2 < b.libreCm2 ||
                  (a.libreCm2 === b.libreCm2 && tipoPrio(sob.tipo) < tipoPrio(mejor.sob.tipo))))));
        if (gana) mejor = { sob, acomodo };
      }
      if (!mejor) break;

      usadosEnPlan.add(mejor.sob._docId);
      const puestas = mejor.acomodo.placed.filter((pz) => !pz.failed);
      for (const pz of puestas) {
        const idx = pendientes.find((c) => c.p.id === pz.id)?.i;
        if (idx !== undefined) sinCubrir[idx] = null;
      }
      const piezasRotadas = puestas.filter((pz) => pz.rot);

      plan.sobrantes.push({
        sobrante: mejor.sob,
        placed: puestas,
        // El paño se usó ENTERO cuando no queda NADA que anotar (ni merma ni
        // trozo para el rack): es el calce exacto de siempre.
        regla: mejor.acomodo.libres.length === 0 ? 1 : 2,
        uw: mejor.sob.ancho,
        uh: mejor.sob.alto,
        libres: mejor.acomodo.libres,
        cortes: secuenciaCortes(puestas, mejor.sob.ancho, mejor.sob.alto),
        tieneRotaciones: piezasRotadas.length > 0,
        piezasRotadas,
        costo: mejor.acomodo.costo,
      });
    }

    const restantes = sinCubrir.filter((p): p is Pieza => p !== null);

    // ── 4. Piezas que no matchearon → packing desde rollo ────────
    if (restantes.length) {
      // Un giro que el operario ya rechazó no se vuelve a proponer, ni acá ni
      // en la colmena: la pieza entra derecha o no entra.
      const piezasOrd = porAltura(
        opciones?.sinGiro?.size
          ? restantes.map((p) => (opciones.sinGiro!.has(p.id) ? { ...p, noGira: true } : p))
          : restantes,
      );
      const maxH = piezasOrd.reduce((s, p) => s + Math.max(p.w, p.h), 0) + 50;
      const minH = Math.max(...piezasOrd.map((p) => Math.min(p.w, p.h)));

      // Pasada A: sin rotación (binary search sobre el alto)
      let loA = minH;
      let hiA = maxH;
      let plA: Placed[] | null = null;
      let hA = maxH;
      for (let i = 0; i < 18; i++) {
        const mid = Math.floor((loA + hiA) / 2);
        const pl = empacar(
          piezasOrd.map((p) => ({ ...p })),
          ROLL_W_UTIL,
          mid,
          false,
        );
        if (pl.every((r) => !r.failed)) {
          const usedH = pl.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
          if (usedH < hA) {
            hA = usedH;
            plA = pl;
          }
          hiA = mid;
        } else {
          loA = mid + 1;
        }
      }

      // Pasada B: con rotación (solo fallback si A falla)
      let loB = minH;
      let hiB = maxH;
      let plB: Placed[] | null = null;
      let hB = maxH;
      for (let i = 0; i < 18; i++) {
        const mid = Math.floor((loB + hiB) / 2);
        const pl = empacar(
          piezasOrd.map((p) => ({ ...p })),
          ROLL_W_UTIL,
          mid,
          true,
        );
        if (pl.every((r) => !r.failed)) {
          const usedH = pl.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
          if (usedH < hB) {
            hB = usedH;
            plB = pl;
          }
          hiB = mid;
        } else {
          loB = mid + 1;
        }
      }

      // Elegir layout: antes se prefería SIEMPRE la Pasada A (sin rotación)
      // y la B solo era fallback. Ahora, si rotar ahorra tela de forma
      // relevante (las telas lisas se pueden rotar), se PROPONE el layout
      // rotado — el operario lo autoriza pieza por pieza en la UI (flujo
      // 'rotacion-pendiente' ya existente) y puede volver al layout
      // vertical si la tela tiene diseño/dirección.
      const AHORRO_MIN_CM = params.ahorroMinRotacionCm; // proponer rotación solo si ahorra ≥ esto
      const rotarConviene = plA !== null && plB !== null && hB + AHORRO_MIN_CM <= hA;
      const bestPl = rotarConviene ? plB : plA || plB;
      const bestH = rotarConviene ? hB : plA ? hA : hB;

      if (bestPl) {
        const altoCorte = bestH + MARGEN * 2;
        const efic = Math.round(
          (bestPl.reduce((s, r) => s + r.pw * r.ph, 0) / (ROLL_W_UTIL * bestH)) * 100,
        );
        const maxX = bestPl.reduce((m, r) => Math.max(m, r.px + r.pw), 0);
        const anchoFranja = Math.round(ROLL_W_UTIL - maxX);
        const altoFranja = Math.round(altoCorte);
        const sobInterno = esColmena(anchoFranja, altoFranja, params)
          ? { ancho: anchoFranja, alto: altoFranja }
          : null;

        const piezasRotadas = bestPl.filter((r) => r.rot && !r.failed);
        const tieneRotaciones = (rotarConviene || !plA) && piezasRotadas.length > 0;

        const altoVertical = plA ? hA + MARGEN * 2 : null;
        const eficVertical = plA
          ? Math.round(
              (plA.reduce((s, r) => s + r.pw * r.ph, 0) / (ROLL_W_UTIL * hA)) * 100,
            )
          : 0;
        const maxXv = plA ? plA.reduce((m, r) => Math.max(m, r.px + r.pw), 0) : 0;
        const anchoFranjaV = Math.round(ROLL_W_UTIL - maxXv);
        const altoFranjaV = altoVertical ? Math.round(altoVertical) : 0;
        const sobInternoV =
          plA && altoVertical && esColmena(anchoFranjaV, altoFranjaV, params)
            ? { ancho: anchoFranjaV, alto: altoFranjaV }
            : null;

        plan.rollo.push({
          codInt,
          placed: bestPl,
          anchoUtil: ROLL_W_UTIL,
          altoUtil: bestH,
          anchoCorte: params.anchoRolloPlanCm,
          altoCorte,
          efic,
          sobInterno,
          tieneRotaciones,
          piezasRotadas,
          layoutVertical: plA,
          altoVertical,
          eficVertical,
          sobInternoV,
          decisiones: {},
        });
      } else {
        plan.sinStock.push({ codInt, piezas: restantes });
      }
    }
  });

  return plan;
}

// ── Estadísticas de resumen ─────────────────────────────────────────
export function resumenPlan(plan: Plan): {
  totalPiezas: number;
  desdeSobrante: number;
  desdeRollo: number;
  sinStock: number;
} {
  const desdeSobrante = plan.sobrantes.reduce(
    (s, g) => s + g.placed.filter((r) => !r.failed).length,
    0,
  );
  const desdeRollo = plan.rollo.reduce(
    (s, g) => s + g.placed.filter((r) => !r.failed).length,
    0,
  );
  const sinStock = plan.sinStock.reduce((s, g) => s + g.piezas.length, 0);
  return {
    totalPiezas: desdeSobrante + desdeRollo + sinStock,
    desdeSobrante,
    desdeRollo,
    sinStock,
  };
}
