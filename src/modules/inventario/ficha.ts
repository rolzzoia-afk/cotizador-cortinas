// ─────────────────────────────────────────────────────────────────────
// La ficha de un artículo (lámina 4 del diseño): dónde está el stock, qué
// se consumió en los últimos meses y qué le pasó a ese código.
//
// Puro: recibe las filas ya leídas. Lo que todavía no existe en la base
// (unidad, contenido por unidad, objetivo de compra y el saldo después de
// cada movimiento) llega con el kardex, en la Entrega B; acá no se inventa.
// ─────────────────────────────────────────────────────────────────────

import { tipoMovimientoCanonico } from './badges';
import { etiquetaAlmacen, normalizarAlmacen } from './almacenes';
import type { Insumo } from './helpers';

/**
 * Un movimiento, venga de insumos o de telas. Las dos tablas guardan lo mismo
 * con nombres distintos —la cantidad de una tela se llama `metros`, quien lo
 * hizo es `responsable` en vez de `responsable_entrega`— y la ficha muestra
 * las dos igual.
 */
export type MovimientoFicha = {
  id?: string | null;
  fecha?: string | null;
  tipo?: string | null;
  codigo?: string | null;
  almacen?: string | null;
  cantidad?: number | null;
  metros?: number | null;
  ot?: string | null;
  responsable_entrega?: string | null;
  responsable?: string | null;
  operario?: string | null;
  bitacora?: string | null;
  notas?: string | null;
};

/** La cantidad del movimiento, se llame como se llame en su tabla. */
export function cantidadMovida(m: MovimientoFicha): number {
  return Number(m.cantidad ?? m.metros ?? 0);
}

/** Quién lo hizo. Vacío si no quedó registrado: no se inventa un nombre. */
export function quienMovio(m: MovimientoFicha): string {
  return String(m.responsable_entrega || m.responsable || m.operario || '').trim();
}

/** La nota que dejó, si dejó alguna. */
export function notaDelMovimiento(m: MovimientoFicha): string {
  return String(m.bitacora || m.notas || '').trim();
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export type CamionetaDelArticulo = { id?: string; nombre: string; cantidad: number };

/** Lo que hay de un artículo, repartido por dónde está. */
export type SaldosArticulo = {
  mp: number;
  liberado: number;
  camionetas: CamionetaDelArticulo[];
  enCamionetas: number;
  /** Lo de bodega: es el que se compara contra el mínimo. */
  total: number;
};

export function saldosDeInsumo(
  insumo: Pick<Insumo, 'stock_mp' | 'stock_liberado'>,
  camionetas: CamionetaDelArticulo[] = [],
): SaldosArticulo {
  const mp = insumo.stock_mp || 0;
  const liberado = insumo.stock_liberado || 0;
  // Las camionetas llegan ya elegidas por quien lee la base: son las que
  // llevan este artículo. Una en 0 se muestra igual — significa que lo carga
  // y ahora no le queda, que no es lo mismo que no cargarlo nunca.
  return {
    mp,
    liberado,
    camionetas,
    enCamionetas: camionetas.reduce((s, c) => s + (c.cantidad || 0), 0),
    total: mp + liberado,
  };
}

/**
 * Cuánto falta para llegar al mínimo. `null` cuando nadie definió mínimo:
 * un mínimo en 0 no es «el mínimo es cero», es que no está puesto.
 */
export function faltanParaMinimo(total: number, minimo: number | null | undefined): number | null {
  const m = Number(minimo || 0);
  if (m <= 0) return null;
  return Math.max(0, m - total);
}

// ── Consumo ───────────────────────────────────────────────────────────

export type MesConsumo = {
  /** `2026-04`, para ordenar y para la llave de React. */
  clave: string;
  etiqueta: string;
  salidas: number;
};

function claveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Lo que salió cada mes, del más viejo al más nuevo. Consumo es lo que se
 * fue: salidas y mermas. Un traslado entre almacenes no consume nada, y un
 * ajuste tampoco: corrige lo que ya estaba mal contado.
 */
export function consumoUltimosMeses(
  movimientos: MovimientoFicha[],
  hoy: Date = new Date(),
  meses = 6,
): MesConsumo[] {
  const fila: MesConsumo[] = [];
  const indice = new Map<string, MesConsumo>();
  for (let i = meses - 1; i >= 0; i -= 1) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const m: MesConsumo = { clave: claveMes(d), etiqueta: MESES[d.getMonth()], salidas: 0 };
    fila.push(m);
    indice.set(m.clave, m);
  }

  for (const mov of movimientos) {
    if (!mov.fecha) continue;
    const tipo = tipoMovimientoCanonico(mov.tipo);
    if (tipo !== 'SALIDA' && tipo !== 'MERMA') continue;
    const d = new Date(mov.fecha);
    if (Number.isNaN(d.getTime())) continue;
    const mes = indice.get(claveMes(d));
    if (mes) mes.salidas += Math.abs(cantidadMovida(mov));
  }
  return fila;
}

/** El promedio de los meses que ya pasaron: el mes en curso va a la mitad. */
export function promedioMensual(consumo: MesConsumo[]): number {
  const cerrados = consumo.slice(0, -1);
  if (cerrados.length === 0) return 0;
  const suma = cerrados.reduce((s, m) => s + m.salidas, 0);
  return Math.round(suma / cerrados.length);
}

/**
 * Para cuántos meses alcanza lo que hay. `null` si no se consumió nada:
 * dividir por cero daría «infinito», que en pantalla se lee como un dato.
 */
export function coberturaMeses(total: number, promedio: number): number | null {
  if (promedio <= 0) return null;
  return Math.round((total / promedio) * 10) / 10;
}

// ── Paños de una tela ─────────────────────────────────────────────────

export type PanoFicha = {
  disponible?: boolean;
  medida_ancho?: number | null;
  medida_alto?: number | null;
  datos_extra?: { baja?: unknown } | null;
};

export type ResumenPanos = {
  disponibles: number;
  usados: number;
  /** Metros cuadrados disponibles. Las medidas vienen en centímetros. */
  m2: number;
};

/**
 * Los retazos de esta tela que quedan en la colmena. Un paño dado de baja no
 * cuenta como disponible ni como usado: dejó de existir.
 */
export function resumenPanos(panos: PanoFicha[]): ResumenPanos {
  let disponibles = 0;
  let usados = 0;
  let cm2 = 0;
  for (const p of panos) {
    if (p.datos_extra?.baja) continue;
    if (p.disponible) {
      disponibles += 1;
      cm2 += (p.medida_ancho || 0) * (p.medida_alto || 0);
    } else {
      usados += 1;
    }
  }
  return { disponibles, usados, m2: Math.round((cm2 / 10000) * 10) / 10 };
}

// ── Movimientos del artículo ──────────────────────────────────────────

function mismoCodigo(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  return n(a) !== '' && n(a) === n(b);
}

/** Lo que le pasó a este código, lo más nuevo primero. */
export function movimientosDeArticulo<T extends MovimientoFicha>(movimientos: T[], cod: string): T[] {
  return movimientos
    .filter((m) => mismoCodigo(m.codigo, cod))
    .slice()
    .sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));
}

/**
 * La frase del movimiento: «Liberado → OT 3221», «— → Materias primas».
 * Es el origen y el destino, que en la tabla vieja viajan en un solo campo:
 * `almacen` es de DÓNDE sale o a dónde entra, según el tipo.
 */
export function descripcionMovimiento(m: MovimientoFicha): string {
  const lugar = etiquetaAlmacen(normalizarAlmacen(m.almacen) ?? m.almacen ?? '');
  const ot = String(m.ot ?? '').trim();
  const tipo = tipoMovimientoCanonico(m.tipo);
  if (tipo === 'SALIDA') return `${lugar} → ${ot ? `OT ${ot}` : 'salida'}`;
  if (tipo === 'INGRESO') return `— → ${lugar}`;
  if (tipo === 'DEVOLUCION') return `${ot ? `OT ${ot}` : 'devolución'} → ${lugar}`;
  if (tipo === 'MERMA') return `${lugar} → merma`;
  if (tipo === 'AJUSTE') return `Ajuste en ${lugar}`;
  // `PEDIDO REPOSICION` no es un movimiento de stock: es un pedido anotado en
  // la misma tabla. No lo reconoce el kardex y por eso llega crudo.
  if (String(m.tipo ?? '').toUpperCase().includes('PEDIDO')) return 'Pedido de reposición';
  return lugar;
}
