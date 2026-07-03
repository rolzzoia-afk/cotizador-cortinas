// ─────────────────────────────────────────────────────────────────────
// Motor de precio Fase 0 — parámetros y constantes verificadas del Excel
// "COTIZADOR FINAL" (hoja Formato de Cotización + Cotizador + Optimizador).
//
// Este archivo SOLO contiene los parámetros y precios que se extrajeron y
// verificaron del Excel. El cálculo en sí (geometría, optimización de telas,
// costo por familia y precio/m² combinado) se arma sobre estos valores y
// reutilizando el optimizador existente en `tela.ts`.
//
// NO toca el flujo de producción actual (Fase 1–4). Es la base de Fase 0.
// ─────────────────────────────────────────────────────────────────────

// ── Geometría (Optimizador del Excel) ────────────────────────────────
// A cada cortina se le suma 0,25 m al alto; si es DÚO, el alto se duplica.
// m² = alto_real × ancho.  (Idéntico a buildOptimizerRows en tela.ts)
export const EXTRA_ALTO_M = 0.25;

// ── Márgenes y cargos ─────────────────────────────────────────────────
// Precio de venta de un insumo = VALOR MAXIMO / MARGEN_INSUMO  (margen 35%).
export const MARGEN_INSUMO = 0.65;
// IVA Chile.
export const IVA = 0.19;
// Recargo por pago con tarjeta de crédito (comisión Mercado Pago, incluye
// las 12 cuotas sin interés): +13,8%.
export const RECARGO_TARJETA = 0.138;
// Comisión Flow para tarjeta de crédito nacional: 3,49% + IVA ≈ 4,15%.
// Flow NO ofrece cuotas sin interés (los intereses los pone el banco).
export const RECARGO_TARJETA_FLOW = 0.0415;

// ── Costos fijos (tabla Insumos del Excel, columna VALOR MAXIMO) ──────
// Instalación por cortina.
export const INSTALACION_ROLLER = 17500;
export const INSTALACION_VERTICAL = 40000; // 39.999,99 en el Excel
// Mano de obra por cortina: roller (MAN 01), dúo (MAN 02), vertical (MAN 03).
export const MANO_OBRA_ROLLER = 19500;
export const MANO_OBRA_DUO = 25000;
export const MANO_OBRA_VERTICAL = 62000;
// Traslado: se cobra 1 por cada TIPO de cortina cotizado (roller, dúo, screen, vertical…).
export const TRASLADO = 55000; // 55.000,61 en el Excel
// Publicidad / etiqueta por cortina (incluido en la lista de materiales).
export const PUBLICIDAD = 1400;

// ── Precios de insumos (VALOR MAXIMO del Excel) ───────────────────────
// Se usan para la lista de materiales por familia. Precio de venta = valor / 0,65.
// (Mapa completo de 87 insumos extraído del Excel; aquí los de la familia
//  Roller Blackout / Screen / Dúo, que es la primera capa a construir.)
export const INSUMO_VALOR_MAXIMO: Record<string, number> = {
  // Tubos / perfiles
  'E 02': 3729.1625, // Tubo Ø38 (roller, ancho ≤ 2,19 m)
  'E 02-1': 3729.1625, // Tubo (variante standard)
  'E 05': 8958.220833, // Tubo .45 (roller, ancho ≥ 2,191 m)
  'E 15': 4583.235417, // Peso inferior roller (por metro)
  'E 26': 9252.99375, // Perfil superior cenefa dúo (por metro)
  'E 18': 4638.76875, // Peso lágrima dúo (por metro)
  'E 13': 2900.625, // Peso dúo (por metro)
  // Mecanismos
  'MEC 18': 5950, // Mecanismo 0.45 Decorelli (roller)
  'MEC 09': 4069.8, // Mecanismo cenefa ovalada (dúo)
  // Cadenas / topes
  'CAD 03': 1190, // Cadena infinita plástica (roller manual)
  'CAD 02': 1190, // Cadena infinita plástica (dúo manual)
  'CAD 13': 725.9, // Cadena metálica por metro (motor)
  'TOP 03': 59.5, // Tope cadena (roller)
  MER0006: 59.5, // Tope metálico cadena (motor)
  // Pesos / tapas / zunchos
  'PCA 04': 1190, // Peso porta cadena
  'TAP 01 -19': 235.62, // Tapa peso roller (2 por cortina)
  'TAP 09': 314.16, // Tapa peso dúo (2 por cortina)
  'ZUN 06': 238, // Zuncho (por metro, ×2)
  // Dúo varios
  'MIC 01': 416.5, // Mica transparente cenefa (dúo premium/poli, por metro)
  'CIN 02': 71.4, // Cinta doble contacto (dúo premium/poli, por metro)
  'BRA 02': 589.05, // Bracket largo (dúo, ×3 por cortina)
  // Genéricos
  'INS 95': 450, // Etiqueta Rolzzo (por cortina)
  MAT00001: 1300, // Materiales varios
  'PUB 01': 1400, // Publicidad (por cortina)
  // Verticales (lamas / riel) — receta decodificada, pendiente de validar
  'VER 35': 16495.78, // Perfil (riel) cortina vertical, por metro de ancho
  'VER 02': 773.5, // Carro conector 3 vías (por lama)
  'VER 19': 833, // Peso lama vertical (por lama)
  'VER 03': 238, // Lama de sujeción (por lama)
  'VER 04': 95.2, // Espaciador (por lama)
  'VER 05': 238, // Clip sujeción riel
  'VER 06': 714, // Escuadra cortina vertical
  'VER 07': 476, // Sujetador eje 3 vías
  'VER 08': 142.8, // Conductor de cordón
  'VER 09': 785.4, // Unidad de control
  'VER 10': 95.2, // Freno eje 3 vías
  'VER 11': 3570, // Peso cordón vertical
  'VER 15': 202.3, // Cadena inferior vertical (por metro de alto)
  'VER 22': 202.3, // Cordón cortina vertical (por metro de alto)
  'VER 24': 89.25, // Tope cordón
  'VER 29': 142.8, // Guía tope de soga
  'VER 30': 737.8, // Soporte riel
};

// ── Parámetros comerciales configurables por empresa ──────────────────
// Los valores de arriba son los DEFAULTS históricos (Excel Rolzzo).
// Cada empresa puede sobreescribirlos vía tabla `configuracion`
// (clave 'parametros_cotizador'; ver parametros.ts y el panel Admin).
/** Proveedor de pago con tarjeta activo (Mercado Pago = Mercado Libre). */
export type ProveedorTarjeta = 'mercadopago' | 'flow';

export type ParametrosCotizador = {
  iva: number;
  margenInsumo: number;
  /** Comisión Mercado Pago (con 12 cuotas sin interés). */
  recargoTarjeta: number;
  /** Comisión Flow (cuotas con interés del banco). */
  recargoTarjetaFlow: number;
  /** Qué proveedor de tarjeta usa la empresa (afecta recargo y banner). */
  proveedorTarjeta: ProveedorTarjeta;
  instalacionRoller: number;
  instalacionVertical: number;
  manoObraRoller: number;
  manoObraDuo: number;
  manoObraVertical: number;
  traslado: number;
  // ── Instalación gratis por cantidad (regla del Excel, hoja Formato de
  //    Cotización fila INSTALACIÓN) ─────────────────────────────────────
  /** Mínimo de cortinas roller/dúo para que la instalación sea gratis. */
  instalacionGratisMinCortinas: number;
  /** Descuento de instalación en RM al alcanzar el mínimo (0–1; 1 = gratis). */
  instalacionDescuentoRM: number;
  /** Descuento de instalación para región (0–1; editable, 0 = se cobra full). */
  instalacionDescuentoRegion: number;
};

export const PARAMETROS_DEFAULT: ParametrosCotizador = {
  iva: IVA,
  margenInsumo: MARGEN_INSUMO,
  recargoTarjeta: RECARGO_TARJETA,
  recargoTarjetaFlow: RECARGO_TARJETA_FLOW,
  proveedorTarjeta: 'mercadopago',
  instalacionRoller: INSTALACION_ROLLER,
  instalacionVertical: INSTALACION_VERTICAL,
  manoObraRoller: MANO_OBRA_ROLLER,
  manoObraDuo: MANO_OBRA_DUO,
  manoObraVertical: MANO_OBRA_VERTICAL,
  traslado: TRASLADO,
  instalacionGratisMinCortinas: 4,
  instalacionDescuentoRM: 1, // 100% = gratis
  instalacionDescuentoRegion: 0, // 0% = se cobra (editable por empresa)
};

/** Claves de parámetros con valor numérico (todas menos proveedorTarjeta). */
export type ClaveNumericaParametros = {
  [K in keyof ParametrosCotizador]: ParametrosCotizador[K] extends number ? K : never;
}[keyof ParametrosCotizador];

const CLAVES_NUMERICAS = (
  Object.keys(PARAMETROS_DEFAULT) as (keyof ParametrosCotizador)[]
).filter((k): k is ClaveNumericaParametros => typeof PARAMETROS_DEFAULT[k] === 'number');

/** Mezcla lo guardado con los defaults, ignorando valores no numéricos. */
export function normalizarParametros(raw: unknown): ParametrosCotizador {
  const out: ParametrosCotizador = { ...PARAMETROS_DEFAULT };
  if (raw && typeof raw === 'object') {
    for (const k of CLAVES_NUMERICAS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    // Proveedor de tarjeta: string acotado; cualquier otra cosa → default.
    const prov = (raw as Record<string, unknown>).proveedorTarjeta;
    out.proveedorTarjeta = prov === 'flow' ? 'flow' : 'mercadopago';
  }
  // margenInsumo = 0 dividiría por cero.
  if (out.margenInsumo <= 0) out.margenInsumo = PARAMETROS_DEFAULT.margenInsumo;
  // Descuentos de instalación acotados a [0,1]; mínimo de cortinas entero ≥ 0.
  out.instalacionDescuentoRM = Math.min(1, Math.max(0, out.instalacionDescuentoRM));
  out.instalacionDescuentoRegion = Math.min(1, Math.max(0, out.instalacionDescuentoRegion));
  out.instalacionGratisMinCortinas = Math.max(0, Math.round(out.instalacionGratisMinCortinas));
  return out;
}

/** Recargo de tarjeta vigente según el proveedor activo de la empresa. */
export function recargoTarjetaEfectivo(p: ParametrosCotizador): number {
  return p.proveedorTarjeta === 'flow' ? p.recargoTarjetaFlow : p.recargoTarjeta;
}

// ── Tipo de resultado del motor de precio ─────────────────────────────
export type LineaPrecio = {
  codInt: string;
  ancho: number; // m
  alto: number; // m
  cantidad: number;
  m2: number; // alto_real × ancho
  precioUnit: number; // m² × precio/m² combinado + instalación
  total: number; // precioUnit × cantidad − descuento
};

export type TotalesCotizacion = {
  subtotalNeto: number; // suma de líneas (sin IVA)
  ivaTransferencia: number;
  totalTransferencia: number; // subtotal + IVA
  subtotalTarjeta: number; // subtotal × 1,138
  ivaTarjeta: number;
  totalTarjeta: number;
  abono50: number; // 50% para iniciar fabricación
};

// Totales finales a partir del subtotal neto (suma de líneas).
// `opts` permite usar el IVA/recargo configurados por empresa
// (módulo parametros.ts); sin opts se usan los defaults históricos.
export function calcularTotales(
  subtotalNeto: number,
  opts?: { iva?: number; recargoTarjeta?: number },
): TotalesCotizacion {
  const iva = opts?.iva ?? IVA;
  const recargo = opts?.recargoTarjeta ?? RECARGO_TARJETA;
  const ivaTransferencia = subtotalNeto * iva;
  const totalTransferencia = subtotalNeto + ivaTransferencia;
  const subtotalTarjeta = subtotalNeto * (1 + recargo);
  const ivaTarjeta = subtotalTarjeta * iva;
  const totalTarjeta = subtotalTarjeta + ivaTarjeta;
  return {
    subtotalNeto,
    ivaTransferencia,
    totalTransferencia,
    subtotalTarjeta,
    ivaTarjeta,
    totalTarjeta,
    abono50: totalTransferencia / 2,
  };
}

// Precio de venta de un insumo a partir de su VALOR MAXIMO.
export function precioVentaInsumo(codInt: string, margenInsumo: number = MARGEN_INSUMO): number {
  const v = INSUMO_VALOR_MAXIMO[codInt];
  return v ? v / margenInsumo : 0;
}
