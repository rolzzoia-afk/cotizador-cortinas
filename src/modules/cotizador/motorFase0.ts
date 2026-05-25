// ─────────────────────────────────────────────────────────────────────
// Motor de cálculo Fase 0 — familia Roller Blackout / Screen (manual)
//
// Réplica fiel del Excel "COTIZADOR FINAL" (Optimizador + Cotizador).
// Capa 1: familia Roller Blackout/Screen sin motor. Las demás familias
// (Dúo, Vertical, Soft Light, Dark, Oscuranti) se agregan con el mismo molde.
//
// El precio NO es ancho×alto×precio: es un precio/m² COMBINADO por familia =
// costo total del trabajo (tela optimizada + lista de materiales + mano de
// obra + traslado) ÷ m² totales de la familia. Cada cortina = m² × precio/m²
// + instalación. Ver preciosFase0.ts para los parámetros verificados.
// ─────────────────────────────────────────────────────────────────────

import {
  EXTRA_ALTO_M,
  INSTALACION_ROLLER,
  INSTALACION_VERTICAL,
  MANO_OBRA_ROLLER,
  TRASLADO,
  precioVentaInsumo,
  calcularTotales,
  type TotalesCotizacion,
} from './preciosFase0';
import type { CatalogoProductos } from './types';

export type ItemFase0 = {
  id?: string;
  codInt: string;
  ancho: number; // metros
  alto: number; // metros
  cantidad: number;
  esDuo?: boolean;
  esVertical?: boolean;
  precioMl: number; // precio de venta de la tela por metro lineal (catálogo)
  anchoRollo: number; // ancho del rollo de tela (catálogo)
};

type Pieza = {
  codInt: string;
  ancho: number;
  altoReal: number;
  m2: number;
};

export type ResultadoFamilia = {
  codInt: string;
  piezas: number;
  m2Total: number;
  metrosTela: number;
  costoTela: number;
  costoMateriales: number;
  manoObra: number;
  traslado: number;
  costoTotal: number;
  precioM2: number;
  materiales: Record<string, number>;
};

export type LineaResultado = {
  codInt: string;
  ancho: number;
  alto: number;
  cantidad: number;
  m2: number;
  valorUnit: number; // precio de UNA cortina (m² × precio/m² + instalación)
  total: number; // valorUnit × cantidad
};

export type ResultadoCotizacion = {
  familias: ResultadoFamilia[];
  lineas: LineaResultado[];
  subtotalNeto: number;
  totales: TotalesCotizacion;
};

// Alto real: alto + 0,25 m; si es dúo, se duplica. (Optimizador del Excel)
function altoRealM(alto: number, esDuo: boolean): number {
  const conExtra = alto + EXTRA_ALTO_M;
  return esDuo ? conExtra * 2 : conExtra;
}

// Metros de tela según acomodo de paños: se ordena por alto real desc, se
// acumula ancho hasta llenar el rollo; cada paño aporta su alto máximo.
// (Optimizador del Excel: ALTO A UTILIZAR = MAX por paño; MTS = suma.)
export function metrosTelaPorPanos(piezas: Pieza[], anchoRollo: number): number {
  const ordenadas = [...piezas].sort((a, b) => b.altoReal - a.altoReal);
  const panos: { alto: number; ancho: number }[] = [];
  let acc = 0;
  let curAlto: number | null = null;
  for (const p of ordenadas) {
    const excede = acc + p.ancho > anchoRollo;
    const nuevo = curAlto === null || Math.abs(p.altoReal - curAlto) > 1e-6 || excede;
    if (nuevo) {
      panos.push({ alto: p.altoReal, ancho: p.ancho });
      curAlto = p.altoReal;
      acc = p.ancho;
    } else {
      const last = panos[panos.length - 1];
      last.ancho += p.ancho;
      last.alto = Math.max(last.alto, p.altoReal);
      acc += p.ancho;
    }
  }
  return panos.reduce((s, p) => s + p.alto, 0);
}

// Lista de materiales (BOM) de la familia Blackout/Screen MANUAL.
// Reglas de cantidad decodificadas del Cotizador (filas 115-129).
export function costoMaterialesBKSCR(piezas: Pieza[]): {
  total: number;
  detalle: Record<string, number>;
} {
  const n = piezas.length;
  const sumW = piezas.reduce((s, p) => s + p.ancho, 0);
  const anchoMenor = piezas.filter((p) => p.ancho <= 2.19).reduce((s, p) => s + p.ancho, 0);
  const anchoMayor = piezas.filter((p) => p.ancho >= 2.191).reduce((s, p) => s + p.ancho, 0);

  const d: Record<string, number> = {
    'E 02': precioVentaInsumo('E 02') * anchoMenor, // tubo Ø38 (anchos ≤ 2,19)
    'E 05': precioVentaInsumo('E 05') * anchoMayor, // tubo .45 (anchos ≥ 2,191)
    'E 15': precioVentaInsumo('E 15') * sumW, // peso inferior (por metro)
    'MEC 18': precioVentaInsumo('MEC 18') * n, // mecanismo (1 por cortina)
    'CAD 03': precioVentaInsumo('CAD 03') * n, // cadena (manual)
    'TOP 03': precioVentaInsumo('TOP 03') * n, // tope cadena
    'INS 95': precioVentaInsumo('INS 95') * n, // etiqueta
    'PCA 04': precioVentaInsumo('PCA 04') * n, // peso porta cadena
    'TAP 01 -19': precioVentaInsumo('TAP 01 -19') * 2 * n, // 2 tapas por cortina
    'ZUN 06': precioVentaInsumo('ZUN 06') * 2 * sumW, // zuncho (2× metros)
    'PUB 01': precioVentaInsumo('PUB 01') * n, // publicidad
    MAT00001: precioVentaInsumo('MAT00001') * n, // materiales varios
  };
  const total = Object.values(d).reduce((s, v) => s + v, 0);
  return { total, detalle: d };
}

// Cálculo principal para una cotización compuesta solo de roller BK/SCR.
// Agrupa por codInt (producto), calcula precio/m² combinado y precia cada línea.
export function calcularRollerBKSCR(items: ItemFase0[]): ResultadoCotizacion {
  // 1. Expandir a piezas físicas (cantidad → N piezas) y agrupar por codInt.
  const porCod = new Map<string, { item: ItemFase0; piezas: Pieza[] }>();
  for (const it of items) {
    const altoReal = altoRealM(it.alto, !!it.esDuo);
    const piezaBase: Pieza = {
      codInt: it.codInt,
      ancho: it.ancho,
      altoReal,
      m2: altoReal * it.ancho,
    };
    const g = porCod.get(it.codInt) ?? { item: it, piezas: [] };
    for (let i = 0; i < Math.max(1, it.cantidad); i++) g.piezas.push({ ...piezaBase });
    porCod.set(it.codInt, g);
  }

  // 2. Por familia (codInt): precio/m² combinado.
  const familias: ResultadoFamilia[] = [];
  const precioM2PorCod = new Map<string, number>();
  for (const [codInt, g] of porCod) {
    const m2Total = g.piezas.reduce((s, p) => s + p.m2, 0);
    const metrosTela = metrosTelaPorPanos(g.piezas, g.item.anchoRollo);
    const costoTela = g.item.precioMl * metrosTela;
    const { total: costoMateriales, detalle } = costoMaterialesBKSCR(g.piezas);
    const manoObra = MANO_OBRA_ROLLER * g.piezas.length;
    const traslado = TRASLADO; // 1 por familia
    const costoTotal = costoTela + costoMateriales + manoObra + traslado;
    const precioM2 = m2Total > 0 ? costoTotal / m2Total : 0;
    precioM2PorCod.set(codInt, precioM2);
    familias.push({
      codInt,
      piezas: g.piezas.length,
      m2Total,
      metrosTela,
      costoTela,
      costoMateriales,
      manoObra,
      traslado,
      costoTotal,
      precioM2,
      materiales: detalle,
    });
  }

  // 3. Preciar cada línea de entrada (valor unitario de UNA cortina).
  const lineas: LineaResultado[] = items.map((it) => {
    const altoReal = altoRealM(it.alto, !!it.esDuo);
    const m2 = altoReal * it.ancho;
    const precioM2 = precioM2PorCod.get(it.codInt) ?? 0;
    const instalacion = it.esVertical ? INSTALACION_VERTICAL : INSTALACION_ROLLER;
    const valorUnit = m2 * precioM2 + instalacion;
    return {
      codInt: it.codInt,
      ancho: it.ancho,
      alto: it.alto,
      cantidad: it.cantidad,
      m2,
      valorUnit,
      total: valorUnit * Math.max(1, it.cantidad),
    };
  });

  const subtotalNeto = lineas.reduce((s, l) => s + l.total, 0);
  return { familias, lineas, subtotalNeto, totales: calcularTotales(subtotalNeto) };
}

// ── Puente catálogo → motor ───────────────────────────────────────────
// Construye los ItemFase0 desde las filas de la pantalla + el catálogo
// (precio/ml) + el mapa de ancho de rollo (config 'ancho_rollo_data').
export type FilaFase0 = { codInt: string; ancho: number; alto: number; cantidad: number };

export function construirItemsFase0(
  filas: FilaFase0[],
  catalogo: CatalogoProductos,
  anchoRolloMap: Record<string, number>,
): ItemFase0[] {
  return filas
    .filter((f) => f.codInt && f.ancho > 0 && f.alto > 0)
    .map((f) => {
      const prod = catalogo[f.codInt];
      const nombre = (prod?.producto || '').toUpperCase();
      return {
        codInt: f.codInt,
        ancho: f.ancho,
        alto: f.alto,
        cantidad: f.cantidad > 0 ? f.cantidad : 1,
        esDuo: nombre.includes('DUO'),
        esVertical: nombre.includes('VERTICAL') || f.codInt.toUpperCase().includes('-V'),
        precioMl: Number(prod?.precio) || 0,
        anchoRollo: anchoRolloMap[f.codInt] ?? (Number(prod?.anchoRollo) || 2.45),
      };
    });
}

export function cotizarFase0(
  filas: FilaFase0[],
  catalogo: CatalogoProductos,
  anchoRolloMap: Record<string, number>,
): ResultadoCotizacion {
  return calcularRollerBKSCR(construirItemsFase0(filas, catalogo, anchoRolloMap));
}
