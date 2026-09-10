// ─────────────────────────────────────────────────────────────────────
// Registrar un movimiento de insumo: qué fila se guarda y en cuánto queda el
// stock. Es la cuenta que hoy vive suelta en la pantalla de Insumos, sacada
// acá para que la ficha del artículo haga EXACTAMENTE lo mismo.
//
// OJO: esto es el comportamiento de HOY, con sus defectos a la vista —
// escribe en dos pasos sin transacción y recorta los negativos a cero. La
// Entrega B lo reemplaza por una función de la base (`inventario_registrar`)
// detrás del interruptor `kardexRpc`; hasta entonces, una sola copia de la
// cuenta es mejor que dos que se van separando.
// ─────────────────────────────────────────────────────────────────────

import { esEntrada, MESES, type Insumo } from './helpers';

export type EntradaMovimiento = {
  tipo: string;
  codigo: string;
  /** Lo que escribió la persona: puede venir como texto del formulario. */
  cantidad: string | number;
  almacen: 'MP' | 'LIBERADO';
  ot?: string;
  responsable_entrega?: string;
  recepcion?: string;
  bitacora?: string;
};

/** La columna de stock que toca ese almacén. */
export function columnaDelAlmacen(almacen: 'MP' | 'LIBERADO'): 'stock_mp' | 'stock_liberado' {
  return almacen === 'MP' ? 'stock_mp' : 'stock_liberado';
}

export function cantidadDe(entrada: Pick<EntradaMovimiento, 'cantidad'>): number {
  return parseInt(String(entrada.cantidad), 10) || 0;
}

/**
 * El motivo por el que NO se puede guardar, en palabras. `null` = se puede.
 */
export function problemaDelMovimiento(entrada: EntradaMovimiento): string | null {
  if (!String(entrada.codigo || '').trim()) return 'Selecciona un insumo';
  if (cantidadDe(entrada) <= 0) return 'La cantidad debe ser mayor a 0';
  return null;
}

export type StockDespues = {
  campo: 'stock_mp' | 'stock_liberado';
  /** El valor que se va a guardar. */
  valor: number;
  /** El valor real de la cuenta, antes de recortarlo. */
  sinRecortar: number;
  /** `true` cuando la cuenta daba negativo y se guardó 0 igual. */
  recortado: boolean;
};

/**
 * En cuánto queda el almacén después del movimiento.
 *
 * El sistema NUNCA guarda un stock negativo acá: si sacan más de lo que hay,
 * queda en cero y la diferencia se pierde sin dejar rastro. Se devuelve
 * `recortado` para poder avisarlo en pantalla en vez de que pase callado.
 */
export function stockDespues(
  insumo: Pick<Insumo, 'stock_mp' | 'stock_liberado'>,
  entrada: EntradaMovimiento,
): StockDespues {
  const campo = columnaDelAlmacen(entrada.almacen);
  const antes = (insumo[campo] || 0) as number;
  const cantidad = cantidadDe(entrada);
  const sinRecortar = antes + (esEntrada(entrada.tipo) ? cantidad : -cantidad);
  return {
    campo,
    valor: Math.max(0, sinRecortar),
    sinRecortar,
    recortado: sinRecortar < 0,
  };
}

export type FilaMovimientoInsumo = {
  empresa_id: string;
  fecha: string;
  mes: string;
  tipo: string;
  codigo: string;
  producto: string;
  almacen: string;
  cantidad: number;
  ot: string | null;
  responsable_entrega: string | null;
  recepcion: string | null;
  bitacora: string | null;
};

/** La fila tal como se guarda en `movimientos_insumos`. */
export function filaMovimiento(
  entrada: EntradaMovimiento,
  insumo: Insumo | undefined,
  empresaId: string,
  ahora: Date = new Date(),
): FilaMovimientoInsumo {
  return {
    empresa_id: empresaId,
    fecha: ahora.toISOString(),
    mes: MESES[ahora.getMonth()],
    tipo: entrada.tipo,
    codigo: entrada.codigo,
    producto: insumo ? insumo.nemotecnico || insumo.descriptor_proveedor || '' : '',
    almacen: entrada.almacen,
    cantidad: cantidadDe(entrada),
    ot: (entrada.ot || '').trim() || null,
    responsable_entrega: entrada.responsable_entrega || null,
    recepcion: entrada.recepcion || null,
    bitacora: (entrada.bitacora || '').trim() || null,
  };
}
