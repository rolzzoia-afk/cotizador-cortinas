// ─────────────────────────────────────────────────────────────────────
// Motor de cálculo Fase 0 — réplica fiel del Excel "COTIZADOR FINAL".
//
// Cubre las 12 familias roller (Blackout, Screen, Dúo Blackout, Dúo Poliéster
// en Premium / Delux / Standard). Cada familia tiene su propia lista de
// materiales decodificada del Cotizador del Excel.
//
// Validado al peso contra cotizaciones reales:
//   - Dúo Blackout Delux  (Guillermo): exacto
//   - Dúo Blackout Premium (Jorge):    exacto
//   - Dúo Poliéster Premium (Francisco): ~1,7% (precio de tela poliéster a confirmar)
//
// El precio NO es ancho×alto×precio: es un precio/m² COMBINADO por familia =
// (tela optimizada + materiales + mano de obra + traslado) ÷ m² totales.
// Cada cortina = m² × precio/m² + instalación.
// ─────────────────────────────────────────────────────────────────────

import {
  EXTRA_ALTO_M,
  INSTALACION_ROLLER,
  INSTALACION_VERTICAL,
  MANO_OBRA_ROLLER,
  MANO_OBRA_DUO,
  TRASLADO,
  INSUMO_VALOR_MAXIMO,
  calcularTotales,
  type TotalesCotizacion,
} from './preciosFase0';
import type { CatalogoProductos } from './types';

export type FilaFase0 = { codInt: string; ancho: number; alto: number; cantidad: number };

export type LineaResultado = {
  codInt: string;
  cod: string;
  ancho: number;
  alto: number;
  cantidad: number;
  m2: number;
  valorUnit: number;
  total: number;
};

export type ResultadoFamilia = {
  cod: string;
  piezas: number;
  m2Total: number;
  metrosTela: number;
  precioMl: number;
  costoTela: number;
  costoMateriales: number;
  manoObra: number;
  traslado: number;
  costoTotal: number;
  precioM2: number;
  exacto: boolean; // true si la receta de la familia está decodificada y validada
};

export type ResultadoCotizacion = {
  familias: ResultadoFamilia[];
  lineas: LineaResultado[];
  subtotalNeto: number;
  totales: TotalesCotizacion;
};

// ── Helpers de precio de insumo ───────────────────────────────────────
const pv = (c: string): number => (INSUMO_VALOR_MAXIMO[c] ?? 0) / 0.65; // precio venta = valor / 0,65
const raw = (c: string): number => INSUMO_VALOR_MAXIMO[c] ?? 0;

// Alto real: alto + 0,25 m; si es dúo, se duplica (Optimizador del Excel).
function altoRealM(alto: number, esDuo: boolean): number {
  const conExtra = alto + EXTRA_ALTO_M;
  return esDuo ? conExtra * 2 : conExtra;
}

// Metros de tela: ordenar por alto real desc, acumular ancho hasta llenar el
// rollo; cada paño aporta su alto máximo. MTS = suma de altos de paño.
export function metrosTelaPorPanos(
  piezas: { ancho: number; altoReal: number }[],
  anchoRollo: number,
): number {
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

// Contexto de cantidades para la lista de materiales.
type Ctx = {
  n: number;
  sw: number; // suma de anchos
  wle219: number; // suma de anchos ≤ 2,19
  wge2191: number; // suma de anchos ≥ 2,191
  wle250: number; // suma de anchos ≤ 2,50
  cge220: number; // cantidad de cortinas con ancho ≥ 2,20
};

// Clasificación de familia a partir del COD (BLACKOUT_P, DUOBK_D, etc.)
function clasificar(cod: string) {
  const isDuoBk = cod.startsWith('DUOBK');
  const isDuoPoli = cod.startsWith('DUOPOLI');
  const isDuo = isDuoBk || isDuoPoli || cod.startsWith('DUO');
  const isScreen = cod.startsWith('SCREEN');
  const gama = cod.endsWith('_D') ? 'D' : cod.endsWith('_S') ? 'S' : 'P';
  // ¿Es una familia con receta exacta decodificada?
  const exacto =
    /^(BLACKOUT|SCREEN|DUOBK|DUOPOLI)_(P|D|S)$/.test(cod);
  return { isDuoBk, isDuoPoli, isDuo, isScreen, gama, exacto };
}

// Lista de materiales (costo) por familia. Decodificado del Cotizador del Excel.
function costoMateriales(cod: string, ctx: Ctx): number {
  const { isDuo, isDuoPoli, isScreen, gama } = clasificar(cod);
  const { n, sw, wle219, wge2191, wle250, cge220 } = ctx;
  let m = 0;

  if (!isDuo) {
    // ── Roller Blackout / Screen ──
    if (gama === 'S') {
      m += pv('E 02-1') * (isScreen ? wle219 : wle250);
    } else {
      m += pv('E 02') * wle219 + pv('E 05') * wge2191;
    }
    m += pv('E 15') * sw; // peso inferior
    m += pv('MEC 18') * n; // mecanismo (1 por cortina)
    m += pv('CAD 03') * n; // cadena
    m += pv('TOP 03') * n; // tope
    m += (gama === 'S' ? raw('INS 95') : pv('INS 95')) * n; // etiqueta
    m += pv('PCA 04') * n; // peso porta cadena
    m += pv('TAP 01 -19') * n * 2; // 2 tapas por cortina
    m += pv('ZUN 06') * sw * 2; // zuncho
    m += pv('PUB 01') * n; // publicidad
    if (!(isScreen && gama === 'S')) m += pv('MAT00001') * n; // SCREEN_S no lleva
    return m;
  }

  // ── Dúo Blackout / Dúo Poliéster ──
  m += pv('E 02') * wle219 + pv('E 05') * wge2191;
  const e26 = sw + (cod === 'DUOBK_P' ? 0.2 : 0);
  m += pv('E 26') * e26; // perfil superior cenefa
  if (cod === 'DUOBK_P' || isDuoPoli) {
    m += pv('MIC 01') * sw; // mica
    m += pv('CIN 02') * sw; // cinta doble contacto
  }
  m += pv('E 18') * sw; // peso lágrima
  m += pv('E 13') * sw; // peso dúo
  const insRaw = cod === 'DUOBK_D' || cod === 'DUOBK_S' || isDuoPoli;
  m += (insRaw ? raw('INS 95') : pv('INS 95')) * n; // etiqueta
  m += pv('MEC 09') * n; // mecanismo cenefa ovalada
  m += pv('MEC 18') * cge220 * 2; // mecanismo extra para anchos ≥ 2,20
  m += pv('CAD 02') * n; // cadena
  m += pv('PCA 04') * n; // peso porta cadena
  m += pv('ZUN 06') * sw * 2; // zuncho
  m += pv('TAP 09') * n * 2; // 2 tapas dúo por cortina
  // Materiales varios: cada familia dúo lo calcula distinto
  if (cod === 'DUOBK_P') m += pv('MAT00001') * n;
  else if (cod === 'DUOBK_D' || cod === 'DUOBK_S') m += pv('MAT00001') * n * 2 * n;
  else if (isDuoPoli) m += pv('MAT00001') * 2 * n;
  m += pv('BRA 02') * n * 3; // brackets (×3 por cortina)
  m += pv('PUB 01') * n; // publicidad
  return m;
}

// NOTA: la receta de materiales para VERTICALES está decodificada en el Excel
// (insumos VER xx, mano de obra MAN 03, instalación INSTVER), pero un cálculo
// de prueba dio valores implausibles, así que NO se activa hasta validar con
// una cotización vertical real. Por ahora las verticales no se cotizan acá.

// Precio de tela por familia = MAX precio de venta entre los productos del
// catálogo que comparten ese COD (igual que MAXIFS del Excel).
function precioMlPorCod(cod: string, catalogo: CatalogoProductos): number {
  let max = 0;
  for (const k of Object.keys(catalogo)) {
    const p = catalogo[k];
    if (p && p.cod === cod) {
      const precio = Number(p.precio) || 0;
      if (precio > max) max = precio;
    }
  }
  return max;
}

// ── Cálculo principal ─────────────────────────────────────────────────
export function cotizarFase0(
  filas: FilaFase0[],
  catalogo: CatalogoProductos,
  anchoRolloMap: Record<string, number>,
): ResultadoCotizacion {
  const validas = filas.filter((f) => f.codInt && f.ancho > 0 && f.alto > 0);

  type Pieza = { ancho: number; altoReal: number; m2: number };
  type Grupo = {
    cod: string;
    esDuo: boolean;
    esVertical: boolean;
    anchoRollo: number;
    precioMl: number;
    piezas: Pieza[];
  };
  const grupos = new Map<string, Grupo>();

  // Resolver cada fila a su COD (familia) y agrupar.
  const codDeFila: (string | null)[] = validas.map((f) => {
    const prod = catalogo[f.codInt];
    if (!prod) return null;
    const cod = prod.cod || f.codInt;
    const nombre = (prod.producto || '').toUpperCase();
    const esDuo = cod.startsWith('DUO') || nombre.includes('DUO');
    const esVertical = /(_V_|-V$|-V-)/.test(cod) || nombre.includes('VERTICAL');
    const altoReal = altoRealM(f.alto, esDuo);
    const pieza: Pieza = { ancho: f.ancho, altoReal, m2: altoReal * f.ancho };
    let g = grupos.get(cod);
    if (!g) {
      g = {
        cod,
        esDuo,
        esVertical,
        anchoRollo: anchoRolloMap[f.codInt] ?? (Number(prod.anchoRollo) || 2.45),
        precioMl: precioMlPorCod(cod, catalogo) || Number(prod.precio) || 0,
        piezas: [],
      };
      grupos.set(cod, g);
    }
    for (let i = 0; i < Math.max(1, f.cantidad); i++) g.piezas.push({ ...pieza });
    return cod;
  });

  // Por familia: precio/m² combinado.
  const familias: ResultadoFamilia[] = [];
  const pm2PorCod = new Map<string, number>();
  for (const [cod, g] of grupos) {
    const m2Total = g.piezas.reduce((s, p) => s + p.m2, 0);
    const n = g.piezas.length;
    const sw = g.piezas.reduce((s, p) => s + p.ancho, 0);
    const ctx: Ctx = {
      n,
      sw,
      wle219: g.piezas.filter((p) => p.ancho <= 2.19).reduce((s, p) => s + p.ancho, 0),
      wge2191: g.piezas.filter((p) => p.ancho >= 2.191).reduce((s, p) => s + p.ancho, 0),
      wle250: g.piezas.filter((p) => p.ancho <= 2.5).reduce((s, p) => s + p.ancho, 0),
      cge220: g.piezas.filter((p) => p.ancho >= 2.2).length,
    };
    const metrosTela = metrosTelaPorPanos(g.piezas, g.anchoRollo);
    const costoTela = g.precioMl * metrosTela;
    const costoMat = costoMateriales(cod, ctx);
    const manoObra = (g.esDuo ? MANO_OBRA_DUO : MANO_OBRA_ROLLER) * n;
    const traslado = TRASLADO;
    const costoTotal = costoTela + costoMat + manoObra + traslado;
    const precioM2 = m2Total > 0 ? costoTotal / m2Total : 0;
    pm2PorCod.set(cod, precioM2);
    familias.push({
      cod,
      piezas: g.piezas.length,
      m2Total,
      metrosTela,
      precioMl: g.precioMl,
      costoTela,
      costoMateriales: costoMat,
      manoObra,
      traslado,
      costoTotal,
      precioM2,
      exacto: clasificar(cod).exacto,
    });
  }

  // Preciar cada línea de entrada.
  const lineas: LineaResultado[] = validas.map((f, i) => {
    const cod = codDeFila[i];
    const g = cod ? grupos.get(cod) : undefined;
    const esDuo = g?.esDuo ?? false;
    const altoReal = altoRealM(f.alto, esDuo);
    const m2 = altoReal * f.ancho;
    const precioM2 = cod ? pm2PorCod.get(cod) ?? 0 : 0;
    const instalacion = g?.esVertical ? INSTALACION_VERTICAL : INSTALACION_ROLLER;
    const valorUnit = m2 * precioM2 + instalacion;
    return {
      codInt: f.codInt,
      cod: cod ?? '',
      ancho: f.ancho,
      alto: f.alto,
      cantidad: f.cantidad,
      m2,
      valorUnit,
      total: valorUnit * Math.max(1, f.cantidad),
    };
  });

  const subtotalNeto = lineas.reduce((s, l) => s + l.total, 0);
  return { familias, lineas, subtotalNeto, totales: calcularTotales(subtotalNeto) };
}
