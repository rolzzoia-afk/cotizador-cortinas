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
// Recargo por pago con tarjeta de crédito (comisión MercadoPago): +13,8%.
export const RECARGO_TARJETA = 0.138;

// ── Costos fijos (tabla Insumos del Excel, columna VALOR MAXIMO) ──────
// Instalación por cortina.
export const INSTALACION_ROLLER = 17500;
export const INSTALACION_VERTICAL = 40000; // 39.999,99 en el Excel
// Mano de obra por cortina roller.
export const MANO_OBRA_ROLLER = 19500;
// Traslado: se cobra 1 por cada TIPO de cortina cotizado (roller, dúo, screen, vertical…).
export const TRASLADO = 55000; // 55.000,61 en el Excel
// Publicidad / etiqueta por cortina (incluido en la lista de materiales).
export const PUBLICIDAD = 1400;

// ── Precios de insumos (VALOR MAXIMO del Excel) ───────────────────────
// Se usan para la lista de materiales por familia. Precio de venta = valor / 0,65.
// (Mapa completo de 87 insumos extraído del Excel; aquí los de la familia
//  Roller Blackout / Screen / Dúo, que es la primera capa a construir.)
export const INSUMO_VALOR_MAXIMO: Record<string, number> = {
  'E 02': 3729.16, // Tubo 1.2 / Ø38 mm  (cortinas de ancho ≤ 2,19 m)
  'E 05': 8958.22, // Tubo .45 esp 1.2   (cortinas de ancho ≥ 2,191 m)
  'E 15': 4583.24, // Peso inferior roller/dúo (por metro)
  'TAP 01 -19': 235.62, // Tapa peso (2 por cortina)
  'TOP 03': 59.5, // Tope cadena
  MER0006: 59.5, // Tope metálico cadena
  'PCA 04': 1190, // Peso porta cadena
  'ZUN 06': 238, // Zuncho (por metro, ×2)
  'INS 95': 450, // Etiqueta Rolzzo (por cortina)
  MAT00001: 1300, // Materiales varios (por cortina)
  'MEC 18': 5950, // Mecanismo 0.45 Decorelli
  'CAD 03': 1190, // Cadena infinita plástica (cortina manual)
  'CAD 13': 725.9, // Cadena metálica por metro
  'PUB 01': 1400, // Publicidad
};

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
export function calcularTotales(subtotalNeto: number): TotalesCotizacion {
  const ivaTransferencia = subtotalNeto * IVA;
  const totalTransferencia = subtotalNeto + ivaTransferencia;
  const subtotalTarjeta = subtotalNeto * (1 + RECARGO_TARJETA);
  const ivaTarjeta = subtotalTarjeta * IVA;
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
export function precioVentaInsumo(codInt: string): number {
  const v = INSUMO_VALOR_MAXIMO[codInt];
  return v ? v / MARGEN_INSUMO : 0;
}
