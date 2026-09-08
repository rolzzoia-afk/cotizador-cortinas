// ─────────────────────────────────────────────────────────────────────
// Cómo se ve cada cosa del inventario: el rótulo y el color de los badges de
// tipo de movimiento y de estado del artículo (lámina «Piezas y estados»).
//
// Es una traducción, no una decisión: no consulta nada y no calcula saldos.
// Vive aparte de los componentes para poder fijarla con tests — un badge que
// miente sobre el estado del stock manda a alguien a buscar algo que no está.
// ─────────────────────────────────────────────────────────────────────

/** Las variantes que entiende `@/components/ui/badge`. */
export type VarianteBadge =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'accent'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'muted';

export type Badge = { texto: string; variante: VarianteBadge };

// ── Tipo de movimiento ────────────────────────────────────────────────

/** Los tipos del kardex (Entrega B). Los viejos se traducen a estos. */
export type TipoMovimiento =
  | 'INGRESO'
  | 'SALIDA'
  | 'TRASLADO'
  | 'DEVOLUCION'
  | 'AJUSTE'
  | 'MERMA'
  | 'CONTEO'
  | 'CORTE'
  | 'SOBRANTE';

const BADGES_MOVIMIENTO: Record<TipoMovimiento, Badge> = {
  INGRESO: { texto: 'Ingreso', variante: 'success' },
  SALIDA: { texto: 'Salida', variante: 'destructive' },
  TRASLADO: { texto: 'Traslado', variante: 'accent' },
  DEVOLUCION: { texto: 'Devolución', variante: 'success' },
  AJUSTE: { texto: 'Ajuste', variante: 'warning' },
  // La merma es la única en negro sobre claro: no es ni buena ni mala, es
  // material que se perdió y conviene que salte a la vista.
  MERMA: { texto: 'Merma', variante: 'default' },
  CONTEO: { texto: 'Conteo', variante: 'warning' },
  // Corte y sobrante vienen del historial de tubos y paños: se muestran, no se
  // editan, y por eso van apagados.
  CORTE: { texto: 'Corte', variante: 'muted' },
  SOBRANTE: { texto: 'Sobrante', variante: 'muted' },
};

/**
 * Traduce el `tipo` que hay hoy en `movimientos_insumos` y en
 * `movimientos_telas` al tipo del kardex. Devuelve `undefined` si no lo
 * reconoce, para que la pantalla muestre el texto crudo en vez de mentir.
 */
export function tipoMovimientoCanonico(tipo: string | null | undefined): TipoMovimiento | undefined {
  const t = String(tipo ?? '')
    .trim()
    .toUpperCase();
  if (!t) return undefined;
  if (t in BADGES_MOVIMIENTO) return t as TipoMovimiento;
  // Los legacy, uno por uno (son los cuatro que existen en producción).
  if (t === 'NUEVO INGRESO' || t === 'INGRESO NUEVO') return 'INGRESO';
  if (t === 'SALIDA PRODUCCION' || t === 'SALIDA PRODUCCIÓN') return 'SALIDA';
  if (t === 'DEVOLUCIÓN') return 'DEVOLUCION';
  return undefined;
}

/**
 * El badge de un movimiento. Un tipo desconocido se muestra tal cual llegó, en
 * gris: nunca se lo hace pasar por otro.
 */
export function badgeTipoMovimiento(tipo: string | null | undefined): Badge {
  const canonico = tipoMovimientoCanonico(tipo);
  if (canonico) return BADGES_MOVIMIENTO[canonico];
  const crudo = String(tipo ?? '').trim();
  return { texto: crudo || '—', variante: 'muted' };
}

/** ¿Este movimiento SUMA stock? (para contar entradas y salidas del día) */
export function esMovimientoEntrada(tipo: string | null | undefined): boolean {
  const c = tipoMovimientoCanonico(tipo);
  return c === 'INGRESO' || c === 'DEVOLUCION';
}

/** ¿Este movimiento RESTA stock? El ajuste no cuenta: puede ir para cualquier lado. */
export function esMovimientoSalida(tipo: string | null | undefined): boolean {
  const c = tipoMovimientoCanonico(tipo);
  return c === 'SALIDA' || c === 'MERMA';
}

// ── Estado del artículo ───────────────────────────────────────────────

export type EstadoArticulo =
  | 'negativo'
  | 'sin_stock'
  | 'bajo_minimo'
  | 'con_stock'
  | 'sin_minimo'
  | 'descontinuado';

const BADGES_ESTADO: Record<EstadoArticulo, Badge> = {
  negativo: { texto: 'Negativo', variante: 'destructive' },
  sin_stock: { texto: 'Sin stock', variante: 'destructive' },
  bajo_minimo: { texto: 'Bajo mínimo', variante: 'warning' },
  con_stock: { texto: 'Con stock', variante: 'success' },
  sin_minimo: { texto: 'Sin mínimo', variante: 'muted' },
  descontinuado: { texto: 'Descontinuado', variante: 'muted' },
};

/**
 * En qué estado está un artículo. El orden importa y es el mismo que usa
 * `calcularAlertas`: descontinuado gana a todo (ya no se repone), después el
 * saldo negativo, y solo al final se compara contra el mínimo.
 *
 * `minimo` en 0, nulo o ausente significa «nadie definió un mínimo»: no es que
 * el mínimo sea cero. Por eso un artículo así nunca sale «bajo mínimo».
 */
export function estadoArticulo(a: {
  total: number | null | undefined;
  minimo?: number | null;
  status?: string | null;
}): EstadoArticulo {
  const total = Number(a.total ?? 0);
  const minimo = Number(a.minimo ?? 0);
  const status = String(a.status ?? '')
    .trim()
    .toUpperCase();
  if (status === 'DESCONTINUADO') return 'descontinuado';
  if (total < 0) return 'negativo';
  if (total === 0) return 'sin_stock';
  if (minimo > 0) return total < minimo ? 'bajo_minimo' : 'con_stock';
  return 'sin_minimo';
}

export function badgeEstadoArticulo(a: {
  total: number | null | undefined;
  minimo?: number | null;
  status?: string | null;
}): Badge {
  return BADGES_ESTADO[estadoArticulo(a)];
}

/** ¿Este estado pide que alguien haga algo? (alimenta el contador de alertas) */
export function estadoPideAtencion(estado: EstadoArticulo): boolean {
  return estado === 'negativo' || estado === 'sin_stock' || estado === 'bajo_minimo';
}
