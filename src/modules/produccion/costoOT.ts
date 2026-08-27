// ─────────────────────────────────────────────────────────────────────
// Cuánto costó DE VERDAD una OT.
//
// Cruza lo que se consumió (metros de tela del optimizador, metros de aluminio
// cortados de la colmena, insumos de la hoja de inventario) con lo que cuesta
// cada cosa, y lo compara contra lo que se cobró. Es la única pantalla del
// taller que mira precios, y solo la ve un administrador.
//
// Regla de la casa: acá NO se inventan números. Una tela sin costo cargado
// suma $0 y sale nombrada en la lista de huecos, y cada línea dice de dónde
// salió su precio para poder auditarlo.
// ─────────────────────────────────────────────────────────────────────

import type { CatalogoProductos } from '@/modules/cotizador/types';
import type { MetrosOptimizador } from '@/modules/cotizador/hojaCorte';
import type { InsumoConsolidado } from '@/modules/cotizador/inventarioOT';
import type { PiezaColmenaSnap } from '@/modules/cotizador/colmenaCorte';
import type { InsumoPrecio } from '@/modules/cotizador/reglasPrecios';

/**
 * Largo real de una barra de aluminio, en metros.
 *
 * La bodega guarda lo que cuesta UNA BARRA; el taller consume METROS. Sin este
 * divisor no se puede pasar de lo uno a lo otro. 5,80 es lo que miden las
 * barras que entran a la colmena (los ingresos van entre 578 y 579 cm). Es
 * editable por OT justamente porque hay perfiles que vienen de 5,98.
 */
export const LARGO_BARRA_M = 5.8;

/** Margen sano de una OT. Bajo esto la pantalla lo pinta en rojo. */
export const MARGEN_SANO = 0.2;

/** Lo que se escribe a mano en la pantalla y queda guardado en la OT. */
export type CostoManualOT = {
  manoObra?: number;
  auto?: number;
  tag?: number;
  otros?: number;
  /** Metros de la barra de aluminio (default `LARGO_BARRA_M`). */
  largoBarraM?: number;
  /** Fallas de tela por COD_INT: cuántas y cuántos metros se perdieron. */
  fallasTelas?: Array<{ cod: string; fallas?: number; mts?: number }>;
  nota?: string;
};

/** De dónde salió el precio de una línea. */
export type FuenteCosto = 'bodega' | 'calculo' | null;

export type FilaTelaCosto = {
  codInt: string;
  producto: string;
  /** Metros bajados del rollo (los del optimizador, ya netos de colmena). */
  mts: number;
  /** Paños que salieron de un retazo de colmena, así que no tocaron el rollo. */
  panosColmena: number;
  fallas: number;
  mtsFalla: number;
  /** Metros consumidos en total: los del rollo más los que se perdieron. */
  total: number;
  costoM: number | null;
  /** De dónde salió el $/m: el código mismo o la tela que le fija el precio. */
  origenCosto: 'propio' | 'referencia' | null;
  /** El COD_INT que prestó su costo, cuando `origenCosto` es 'referencia'. */
  refCosto?: string;
  /** Lo que costó la tela que SÍ se convirtió en cortina (sin las fallas). */
  costo: number;
  /** Lo que se perdió por las fallas de esta tela. Va aparte para no cobrarlo dos veces. */
  perdida: number;
};

export type FilaAluminioCosto = {
  cod: string;
  metros: number;
  merma: number;
  costoM: number | null;
  fuente: FuenteCosto;
  /** La cuenta escrita, para poder auditarla en pantalla. */
  detalleFuente: string;
  costo: number;
};

export type FilaInsumoCosto = {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  costoUnit: number | null;
  fuente: FuenteCosto;
  costo: number;
};

/** Lo que la bodega sabe del costo de un código. */
export type CostoBodega = { cod: string; costoIva?: number | null };

/** Metros cortados de un código de aluminio en esta OT. */
export type ConsumoAluminio = { cod: string; metros: number; merma: number };

export type EntradaCostoOT = {
  /** Metros de tela por COD_INT (de `construirHojaCorte().optimizador`). */
  optimizador: MetrosOptimizador[];
  catalogo: CatalogoProductos;
  /**
   * El COD_INT de la tela que le fija el PRECIO a este código (su arquetipo de
   * familia), o '' si se cobra con el suyo. El costo hereda por el mismo camino
   * que el precio: media docena de códigos se cotizan con el precio de su
   * arquetipo, y si el costo no siguiera esa ruta saldrían «sin costo» para
   * siempre por más veces que se importe el Excel.
   */
  telaReferencia?: (codInt: string) => string;
  /** Piezas que salieron de colmena (snapshot del corte general de Fase 4). */
  colmena?: Record<string, PiezaColmenaSnap>;
  aluminio: ConsumoAluminio[];
  insumos: InsumoConsolidado[];
  /** La tabla de precios del cálculo (`reglasPrecios.insumos`). */
  precioCalculo: Record<string, InsumoPrecio>;
  /** Costos de bodega por código (`insumos.costo_iva`). */
  bodega: CostoBodega[];
  /** Lo cobrado al cliente, con IVA (`ots.total`). */
  totalConIva: number;
  iva: number;
  manual?: CostoManualOT;
};

export type CostoOT = {
  telas: FilaTelaCosto[];
  aluminio: FilaAluminioCosto[];
  insumos: FilaInsumoCosto[];
  totalTelas: number;
  totalAluminio: number;
  totalInsumos: number;
  manoObra: number;
  auto: number;
  tag: number;
  otros: number;
  /** Lo que costó la OT sin contar las fallas. */
  costoTotal: number;
  /** Costo total con las fallas incluidas: la plata que salió de verdad. */
  costoConFallas: number;
  /** Lo cobrado sin IVA. */
  neto: number;
  ganancia: number;
  perdidaFallas: number;
  gananciaReal: number;
  /** Margen sobre el neto (0–1); `null` si la OT no tiene total cargado. */
  margen: number | null;
  /** Códigos sin costo en ninguna parte: la pantalla los nombra. */
  telasSinCosto: string[];
  aluminioSinCosto: string[];
  insumosSinCosto: string[];
};

/** Sin espacios, puntos ni guiones: así calzan «E 02» del cálculo y «E02» de la bodega. */
export const claveCosto = (cod: string | undefined | null) =>
  String(cod ?? '').toUpperCase().replace(/[\s.\-]/g, '');

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Índice código-normalizado → costo, quedándose con el primero que traiga valor. */
function indiceBodega(filas: CostoBodega[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of filas) {
    const k = claveCosto(f.cod);
    const v = num(f.costoIva);
    if (!k || !(v > 0) || out.has(k)) continue;
    out.set(k, v);
  }
  return out;
}

function indiceCalculo(tabla: Record<string, InsumoPrecio>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [cod, p] of Object.entries(tabla)) {
    const k = claveCosto(cod);
    const v = num(p?.valorMaximo);
    if (!k || !(v > 0) || out.has(k)) continue;
    out.set(k, v);
  }
  return out;
}

const clp = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CL');

/**
 * Cuánto cuesta un METRO de un perfil de aluminio.
 *
 * La bodega manda: su `costo_iva` es lo que se pagó por la barra, y dividido
 * por el largo de la barra da el metro. El cálculo es el respaldo, y su número
 * ya viene por metro — pero es un valor MÁXIMO (viene acolchado para cotizar),
 * así que solo se usa cuando la bodega no sabe nada del código.
 *
 * Ojo: el `costo_iva` de bodega NO se divide por `can_x_paquete`. Es el costo
 * de UNA unidad, no del paquete: TOP03 vale 60,00 con paquete de 100 y el
 * cálculo lo cobra a 59,50; dividir daría 0,60.
 */
export function costoMetroAluminio(
  cod: string,
  bodega: Map<string, number>,
  calculo: Map<string, number>,
  largoBarraM: number,
): { costoM: number | null; fuente: FuenteCosto; detalleFuente: string } {
  const k = claveCosto(cod);
  const barra = bodega.get(k);
  if (barra && largoBarraM > 0) {
    return {
      costoM: barra / largoBarraM,
      fuente: 'bodega',
      detalleFuente: `${clp(barra)} la barra ÷ ${largoBarraM.toLocaleString('es-CL')} m`,
    };
  }
  const porMetro = calculo.get(k);
  if (porMetro) {
    return { costoM: porMetro, fuente: 'calculo', detalleFuente: `${clp(porMetro)}/m del cálculo` };
  }
  return { costoM: null, fuente: null, detalleFuente: 'sin costo cargado' };
}

/** Cuánto cuesta UNA unidad de un insumo (tapa, kit, cadena, motor). */
export function costoUnitarioInsumo(
  cod: string | undefined,
  bodega: Map<string, number>,
  calculo: Map<string, number>,
): { costoUnit: number | null; fuente: FuenteCosto } {
  const k = claveCosto(cod);
  if (!k) return { costoUnit: null, fuente: null };
  const b = bodega.get(k);
  if (b) return { costoUnit: b, fuente: 'bodega' };
  const c = calculo.get(k);
  if (c) return { costoUnit: c, fuente: 'calculo' };
  return { costoUnit: null, fuente: null };
}

/**
 * Cuánto cuesta un METRO de una tela.
 *
 * Primero el costo del propio código; si no tiene, el de la tela que le fija
 * el precio (su arquetipo de familia). Es la misma cascada con la que se cobra:
 * «BK 73» se vende al precio de «BK-D», así que también cuesta lo que «BK-D».
 */
export function costoMetroTela(
  codInt: string,
  catalogo: CatalogoProductos,
  telaReferencia?: (codInt: string) => string,
): { costoM: number | null; origenCosto: 'propio' | 'referencia' | null; refCosto?: string } {
  const propio = num(catalogo[codInt]?.costo);
  if (propio > 0) return { costoM: propio, origenCosto: 'propio' };
  const ref = telaReferencia?.(codInt)?.trim();
  if (ref && ref !== codInt) {
    const heredado = num(catalogo[ref]?.costo);
    if (heredado > 0) return { costoM: heredado, origenCosto: 'referencia', refCosto: ref };
  }
  return { costoM: null, origenCosto: null };
}

/** Cuántos paños de cada COD_INT salieron de un retazo de colmena. */
export function panosDeColmena(
  colmena: Record<string, PiezaColmenaSnap> | undefined,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of Object.values(colmena || {})) {
    const k = claveCosto(p?.cod);
    if (!k) continue;
    out.set(k, (out.get(k) || 0) + 1);
  }
  return out;
}

export function calcularCostoOT(e: EntradaCostoOT): CostoOT {
  const manual = e.manual || {};
  const largoBarraM = num(manual.largoBarraM) > 0 ? num(manual.largoBarraM) : LARGO_BARRA_M;
  const bodega = indiceBodega(e.bodega || []);
  const calculo = indiceCalculo(e.precioCalculo || {});
  const colmena = panosDeColmena(e.colmena);

  // ── Telas ──────────────────────────────────────────────────────────
  const fallasPorCod = new Map<string, { fallas: number; mts: number }>();
  for (const f of manual.fallasTelas || []) {
    const k = claveCosto(f.cod);
    if (!k) continue;
    const prev = fallasPorCod.get(k) || { fallas: 0, mts: 0 };
    fallasPorCod.set(k, { fallas: prev.fallas + num(f.fallas), mts: prev.mts + num(f.mts) });
  }

  const telas: FilaTelaCosto[] = [];
  const telasSinCosto: string[] = [];
  const vistas = new Set<string>();
  const filaTela = (codInt: string, mts: number) => {
    const k = claveCosto(codInt);
    vistas.add(k);
    const falla = fallasPorCod.get(k) || { fallas: 0, mts: 0 };
    const total = mts + falla.mts;
    const { costoM, origenCosto, refCosto } = costoMetroTela(codInt, e.catalogo, e.telaReferencia);
    if (costoM == null) telasSinCosto.push(codInt);
    telas.push({
      codInt,
      producto: e.catalogo[codInt]?.producto || codInt,
      mts,
      panosColmena: colmena.get(k) || 0,
      fallas: falla.fallas,
      mtsFalla: falla.mts,
      total,
      costoM,
      origenCosto,
      ...(refCosto ? { refCosto } : {}),
      // Los metros de falla NO entran acá: son la «pérdida», y sumarlos en los
      // dos lados descontaría el mismo desastre dos veces de la ganancia.
      costo: costoM != null ? mts * costoM : 0,
      perdida: costoM != null ? falla.mts * costoM : 0,
    });
  };
  for (const o of e.optimizador || []) filaTela(o.codInt, num(o.metros));
  // Una falla anotada en una tela que el optimizador no muestra igual se cobra:
  // lo tecleado no puede desaparecer de la cuenta sin decir nada.
  for (const f of manual.fallasTelas || []) {
    const k = claveCosto(f.cod);
    if (!k || vistas.has(k)) continue;
    filaTela(String(f.cod).trim(), 0);
  }

  // ── Aluminio ───────────────────────────────────────────────────────
  const aluminio: FilaAluminioCosto[] = [];
  const aluminioSinCosto: string[] = [];
  for (const a of e.aluminio || []) {
    const { costoM, fuente, detalleFuente } = costoMetroAluminio(a.cod, bodega, calculo, largoBarraM);
    if (costoM == null) aluminioSinCosto.push(a.cod);
    // La merma se cortó de la misma barra, así que también se pagó.
    const metros = num(a.metros);
    const merma = num(a.merma);
    aluminio.push({
      cod: a.cod,
      metros,
      merma,
      costoM,
      fuente,
      detalleFuente,
      costo: costoM != null ? (metros + merma) * costoM : 0,
    });
  }

  // ── Insumos ────────────────────────────────────────────────────────
  const insumos: FilaInsumoCosto[] = [];
  const insumosSinCosto: string[] = [];
  for (const i of e.insumos || []) {
    const { costoUnit, fuente } = costoUnitarioInsumo(i.codigo, bodega, calculo);
    if (costoUnit == null) insumosSinCosto.push(i.codigo || i.descripcion);
    const cantidad = num(i.cantidad);
    insumos.push({
      codigo: i.codigo,
      descripcion: i.descripcion,
      cantidad,
      costoUnit,
      fuente,
      costo: costoUnit != null ? cantidad * costoUnit : 0,
    });
  }

  const suma = (ns: number[]) => ns.reduce((s, n) => s + n, 0);
  const totalTelas = suma(telas.map((t) => t.costo));
  const totalAluminio = suma(aluminio.map((a) => a.costo));
  const totalInsumos = suma(insumos.map((i) => i.costo));
  const manoObra = num(manual.manoObra);
  const auto = num(manual.auto);
  const tag = num(manual.tag);
  const otros = num(manual.otros);
  const costoTotal = totalTelas + totalAluminio + totalInsumos + manoObra + auto + tag + otros;

  const iva = num(e.iva);
  const neto = num(e.totalConIva) / (1 + (iva > 0 ? iva : 0));
  const ganancia = neto - costoTotal;
  const perdidaFallas = suma(telas.map((t) => t.perdida));
  const gananciaReal = ganancia - perdidaFallas;
  const costoConFallas = costoTotal + perdidaFallas;

  return {
    telas,
    aluminio,
    insumos,
    totalTelas,
    totalAluminio,
    totalInsumos,
    manoObra,
    auto,
    tag,
    otros,
    costoTotal,
    costoConFallas,
    neto,
    ganancia,
    perdidaFallas,
    gananciaReal,
    margen: neto > 0 ? gananciaReal / neto : null,
    telasSinCosto,
    aluminioSinCosto,
    insumosSinCosto,
  };
}
