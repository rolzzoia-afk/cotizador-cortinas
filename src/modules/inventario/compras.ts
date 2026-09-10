// ─────────────────────────────────────────────────────────────────────
// Compras: la solicitud de bodega y las órdenes que aprueba Gerencia
// (lámina «Compras»).
//
// El circuito:
//
//   Inventario ve los faltantes  →  levanta una SOLICITUD  →  Gerencia la
//   recibe en Finanzas  →  emite y aprueba la ORDEN  →  la bodega la ve en
//   espera  →  llega la mercadería  →  la recibe pieza por pieza
//
// Las órdenes NACEN EN OTRO SISTEMA. Acá vive lo que la bodega mira: los
// estados, cómo se encuentra la orden que corresponde al papel que llegó, y
// cuánto falta de cada línea. Nada de esto toca la base: es todo cuentas sobre
// lo que ya se leyó.
//
// SIN MONTOS, a propósito: en la copia de las órdenes no hay plata, así que
// esta pantalla se le puede mostrar al taller completo.
// ─────────────────────────────────────────────────────────────────────

import type { VarianteBadge } from './badges';

// ── Los tipos ────────────────────────────────────────────────────────

export type DominioCompra = 'insumo' | 'tela';

export type EstadoOrden =
  | 'en_espera'
  | 'recibida_parcial'
  | 'recibida'
  | 'cerrada'
  | 'anulada';

export type EstadoLineaOrden =
  | 'pendiente'
  | 'parcial'
  | 'completa'
  | 'faltante_aceptado'
  | 'cancelada';

export type LineaOrden = {
  id: string;
  posicion: number;
  codigo_interno?: string | null;
  codigo_proveedor?: string | null;
  descripcion?: string | null;
  cantidad_pedida: number;
  unidad?: string | null;
  dominio?: DominioCompra | null;
  item_cod?: string | null;
  factor: number;
  vinculo?: string | null;
  cantidad_recibida: number;
  estado_linea: EstadoLineaOrden;
  conflicto?: string | null;
  nota?: string | null;
};

export type OrdenCompra = {
  id: string;
  numero: string;
  estado: EstadoOrden;
  estado_finanzas?: string | null;
  anulada?: boolean;
  aprobada_en?: string | null;
  aprobada_por?: string | null;
  fecha_emision?: string | null;
  fecha_esperada?: string | null;
  proveedor_rut?: string | null;
  proveedor_nombre?: string | null;
  solicitado_por?: string | null;
  solicitud_ref?: string | null;
  guia?: string | null;
  factura_folio?: string | null;
  factura_tipo?: string | null;
  comentarios?: string | null;
  conflicto?: string | null;
  cerrada_motivo?: string | null;
  lineas?: LineaOrden[];
};

export type ProveedorCompra = {
  id: string;
  rut: string;
  razon_social: string;
  nombre?: string | null;
  alias: string[];
  activo: boolean;
};

// ── Cómo se llama cada estado en pantalla ────────────────────────────

type Etiqueta = { texto: string; variante: VarianteBadge };

export const ESTADOS_ORDEN: Readonly<Record<EstadoOrden, Etiqueta>> = {
  en_espera: { texto: 'En espera', variante: 'accent' },
  recibida_parcial: { texto: 'Llegó en parte', variante: 'warning' },
  recibida: { texto: 'Recibida', variante: 'success' },
  cerrada: { texto: 'Cerrada', variante: 'muted' },
  anulada: { texto: 'Anulada', variante: 'destructive' },
};

export const ESTADOS_LINEA_ORDEN: Readonly<Record<EstadoLineaOrden, Etiqueta>> = {
  pendiente: { texto: 'Pendiente', variante: 'muted' },
  parcial: { texto: 'Llegó en parte', variante: 'warning' },
  completa: { texto: 'Completa', variante: 'success' },
  faltante_aceptado: { texto: 'Faltante aceptado', variante: 'muted' },
  cancelada: { texto: 'Cancelada', variante: 'muted' },
};

/** La etiqueta de un estado que puede venir de la base escrito de otra forma. */
export function etiquetaOrden(estado: string | null | undefined): Etiqueta {
  return ESTADOS_ORDEN[(estado ?? '') as EstadoOrden] ?? { texto: estado || '—', variante: 'muted' };
}

// ── Normalizar lo que se escribe de dos maneras ──────────────────────

/**
 * El RUT sin puntos ni guion. Es la llave con la que se cruzan Finanzas y
 * nosotros: el nombre lo escribe cada uno a su manera, el RUT no.
 * Espejo exacto de `compras_rut_norm` de la base.
 */
export function normalizarRut(rut: unknown): string {
  return String(rut ?? '')
    .toUpperCase()
    .replace(/[^0-9K]/g, '');
}

/**
 * El número de orden en su forma canónica: `1016`, `oc 1016`, `OC-1016` y
 * `oc1016` son la misma. Se compara así porque nadie escribe el guion cuando
 * busca con el papel en la mano.
 */
export function normalizarNumeroOC(valor: unknown): string {
  const s = String(valor ?? '')
    .toUpperCase()
    .replace(/[\s.\-_]/g, '');
  const m = s.match(/^(?:OC)?0*(\d+)$/);
  return m ? m[1] : s;
}

// ── Encontrar la orden del documento que llegó ───────────────────────

/**
 * Cuánto calza una orden con lo que se escribió en el buscador. Más alto es
 * mejor; 0 es «no calza».
 *
 * El orden de prioridad no es caprichoso: es el orden en que el bodeguero
 * tiene los datos a mano cuando llega el camión. La GUÍA está impresa en el
 * papel y es la única que identifica el envío sin ambigüedad, así que gana.
 * Después el número de orden, el RUT (que está en toda factura) y recién ahí
 * el nombre del proveedor, que se escribe de mil formas.
 */
export function puntuarOrdenParaDocumento(orden: OrdenCompra, busqueda: string): number {
  const q = String(busqueda ?? '').trim();
  if (!q) return 0;
  const qLower = q.toLowerCase();

  const guia = String(orden.guia ?? '').trim();
  if (guia && guia.toLowerCase() === qLower) return 100;

  // El folio de la factura vale lo mismo que la guía: los dos vienen impresos
  // en el papel que el bodeguero tiene en la mano. Solo está cuando Finanzas
  // alcanzó a cargar el documento.
  const folio = String(orden.factura_folio ?? '').trim();
  if (folio && folio.toLowerCase() === qLower) return 100;

  const nq = normalizarNumeroOC(q);
  if (nq && normalizarNumeroOC(orden.numero) === nq) return 90;

  const rq = normalizarRut(q);
  // Un RUT tiene al menos 7 caracteres: sin esto, buscar «12» calzaría con
  // cualquier proveedor cuyo RUT empiece con 12.
  if (rq.length >= 7 && normalizarRut(orden.proveedor_rut) === rq) return 80;

  if (guia && guia.toLowerCase().includes(qLower)) return 70;
  if (folio && folio.toLowerCase().includes(qLower)) return 70;

  const nombre = String(orden.proveedor_nombre ?? '').toLowerCase();
  if (nombre && nombre.includes(qLower)) return 60;

  if (normalizarNumeroOC(orden.numero).includes(nq) && nq.length >= 2) return 50;

  for (const l of orden.lineas ?? []) {
    const cod = String(l.item_cod ?? l.codigo_interno ?? '').toLowerCase();
    if (cod && cod === qLower) return 45;
    const prov = String(l.codigo_proveedor ?? '').toLowerCase();
    if (prov && prov === qLower) return 44;
  }
  for (const l of orden.lineas ?? []) {
    const desc = String(l.descripcion ?? '').toLowerCase();
    if (desc && desc.includes(qLower)) return 30;
    const cod = String(l.item_cod ?? l.codigo_interno ?? '').toLowerCase();
    if (cod && cod.includes(qLower)) return 25;
  }
  return 0;
}

/** Las órdenes que calzan, la que más calza primero. */
export function buscarOrdenes(ordenes: OrdenCompra[], busqueda: string): OrdenCompra[] {
  const q = String(busqueda ?? '').trim();
  if (!q) return ordenes;
  return ordenes
    .map((o) => ({ o, p: puntuarOrdenParaDocumento(o, q) }))
    .filter((x) => x.p > 0)
    .sort(
      (a, b) =>
        b.p - a.p ||
        // A igual puntaje manda la que todavía espera, y entre esas la más
        // vieja: es la que lleva más tiempo trabada.
        pesoEstadoOrden(a.o.estado) - pesoEstadoOrden(b.o.estado) ||
        String(a.o.aprobada_en ?? '').localeCompare(String(b.o.aprobada_en ?? '')),
    )
    .map((x) => x.o);
}

const PESO_ESTADO_ORDEN: Record<EstadoOrden, number> = {
  en_espera: 0,
  recibida_parcial: 1,
  recibida: 2,
  cerrada: 3,
  anulada: 4,
};

function pesoEstadoOrden(estado: string | null | undefined): number {
  return PESO_ESTADO_ORDEN[(estado ?? '') as EstadoOrden] ?? 9;
}

// ── Filtros y orden de la lista ──────────────────────────────────────

export type FiltroOrdenes = 'abiertas' | 'en_espera' | 'parciales' | 'cerradas' | 'todas';

export const FILTROS_ORDENES: ReadonlyArray<{ id: FiltroOrdenes; texto: string }> = [
  { id: 'abiertas', texto: 'Abiertas' },
  { id: 'en_espera', texto: 'En espera' },
  { id: 'parciales', texto: 'Llegaron en parte' },
  { id: 'cerradas', texto: 'Terminadas' },
  { id: 'todas', texto: 'Todas' },
];

export function filtrarOrdenes(
  ordenes: OrdenCompra[],
  filtro: FiltroOrdenes,
  busqueda = '',
  proveedorRut: string | null = null,
): OrdenCompra[] {
  const porRut = proveedorRut ? normalizarRut(proveedorRut) : null;
  const base = ordenes.filter((o) => {
    if (porRut && normalizarRut(o.proveedor_rut) !== porRut) return false;
    switch (filtro) {
      case 'en_espera':
        return o.estado === 'en_espera';
      case 'parciales':
        return o.estado === 'recibida_parcial';
      case 'cerradas':
        return o.estado === 'recibida' || o.estado === 'cerrada' || o.estado === 'anulada';
      case 'abiertas':
        return o.estado === 'en_espera' || o.estado === 'recibida_parcial';
      default:
        return true;
    }
  });
  return buscarOrdenes(base, busqueda);
}

/** Sin búsqueda: primero lo que espera, y dentro de eso lo más antiguo. */
export function ordenarOrdenes(ordenes: OrdenCompra[]): OrdenCompra[] {
  return [...ordenes].sort(
    (a, b) =>
      pesoEstadoOrden(a.estado) - pesoEstadoOrden(b.estado) ||
      String(b.aprobada_en ?? '').localeCompare(String(a.aprobada_en ?? '')) ||
      normalizarNumeroOC(b.numero).localeCompare(normalizarNumeroOC(a.numero), 'es', {
        numeric: true,
      }),
  );
}

// ── Cuánto falta ─────────────────────────────────────────────────────

export type ProgresoOrden = {
  lineas: number;
  completas: number;
  pendientes: number;
  /** 0 a 1. Cuenta líneas, no unidades: es lo que se ve en la tabla. */
  fraccion: number;
  /** Líneas que todavía nadie emparejó con un artículo del catálogo. */
  sinVincular: number;
  conConflicto: number;
};

export function progresoDeOrden(orden: OrdenCompra): ProgresoOrden {
  const lineas = orden.lineas ?? [];
  let completas = 0;
  let pendientes = 0;
  let sinVincular = 0;
  let conConflicto = 0;
  for (const l of lineas) {
    if (l.estado_linea === 'completa' || l.estado_linea === 'faltante_aceptado') completas++;
    else if (l.estado_linea !== 'cancelada') pendientes++;
    if (!l.item_cod) sinVincular++;
    if (l.conflicto) conConflicto++;
  }
  return {
    lineas: lineas.length,
    completas,
    pendientes,
    fraccion: lineas.length > 0 ? completas / lineas.length : 0,
    sinVincular,
    conConflicto,
  };
}

/**
 * Los códigos de la orden, para distinguirla de un vistazo.
 *
 * Hace falta porque un proveedor tiene varias órdenes abiertas a la vez y se
 * parecen: cuatro de JOSE MORENO, dos del mismo día, con los mismos artículos.
 * «3 líneas» no dice cuál es cuál, y recibir contra la equivocada deja una
 * orden abierta para siempre y la otra con material de más.
 *
 * Se muestra el artículo nuestro cuando la línea está vinculada, y si no, el
 * código que venía en la orden.
 */
export function resumenContenido(orden: OrdenCompra, max = 3): string {
  const codigos = (orden.lineas ?? [])
    .filter((l) => l.estado_linea !== 'cancelada')
    .map((l) => String(l.item_cod ?? l.codigo_interno ?? '').trim())
    .filter((c) => c !== '');
  if (codigos.length === 0) return '';
  const visibles = codigos.slice(0, max);
  const resto = codigos.length - visibles.length;
  return resto > 0 ? `${visibles.join(' · ')} +${resto}` : visibles.join(' · ');
}

/** Lo que falta de una línea, en la unidad de la orden. Nunca negativo. */
export function pendienteDeLinea(l: LineaOrden): number {
  const falta = Number(l.cantidad_pedida ?? 0) - Number(l.cantidad_recibida ?? 0);
  return falta > 0 ? Math.round(falta * 1000) / 1000 : 0;
}

/**
 * Cuántas unidades NUESTRAS trae una cantidad de la orden. La orden habla en
 * cajas o rollos; el kardex, en unidades del catálogo.
 */
export function unidadesDeInventario(cantidadOrden: number, factor: number): number {
  const f = Number(factor) > 0 ? Number(factor) : 1;
  return Math.round(Number(cantidadOrden ?? 0) * f * 1000) / 1000;
}

/**
 * El cálculo a la vista: «5 cajas × 50 = 250 un». Con factor 1 no se muestra
 * la multiplicación, que sería ruido.
 */
export function textoConversion(
  cantidadOrden: number,
  factor: number,
  unidadOrden?: string | null,
  unidadItem = 'un',
): string {
  const total = unidadesDeInventario(cantidadOrden, factor);
  const cant = formatearCantidad(cantidadOrden);
  if (!(Number(factor) > 1)) return `${cant} ${unidadOrden || unidadItem}`;
  return `${cant} ${unidadOrden || 'x'} × ${formatearCantidad(factor)} = ${formatearCantidad(total)} ${unidadItem}`;
}

export function formatearCantidad(valor: number): string {
  const n = Number(valor ?? 0);
  return Number.isInteger(n)
    ? n.toLocaleString('es-CL')
    : n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
}

/** Días desde que Gerencia la aprobó. `null` si no se sabe cuándo fue. */
export function diasEnEspera(orden: OrdenCompra, ahora: Date = new Date()): number | null {
  const t = Date.parse(String(orden.aprobada_en ?? ''));
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((ahora.getTime() - t) / 86_400_000));
}

/**
 * «Se esperaba hace 3 días» cuando Finanzas guarda la fecha comprometida.
 * Sin fecha no se inventa una: se dice cuánto lleva esperando.
 */
export function textoEspera(orden: OrdenCompra, ahora: Date = new Date()): string {
  const esperada = Date.parse(String(orden.fecha_esperada ?? ''));
  if (!Number.isNaN(esperada)) {
    const dias = Math.floor((ahora.getTime() - esperada) / 86_400_000);
    if (dias > 0) return `Atrasada ${dias} día${dias === 1 ? '' : 's'}`;
    if (dias === 0) return 'Se espera hoy';
    return `Se espera en ${-dias} día${dias === -1 ? '' : 's'}`;
  }
  const d = diasEnEspera(orden, ahora);
  if (d == null) return '—';
  if (d === 0) return 'Aprobada hoy';
  return `Aprobada hace ${d} día${d === 1 ? '' : 's'}`;
}

// ── El resumen de arriba ─────────────────────────────────────────────

export type ResumenCompras = {
  enEspera: number;
  parciales: number;
  sinVincular: number;
  conConflicto: number;
  lineasPendientes: number;
};

export function resumenOrdenes(ordenes: OrdenCompra[]): ResumenCompras {
  let enEspera = 0;
  let parciales = 0;
  let sinVincular = 0;
  let conConflicto = 0;
  let lineasPendientes = 0;
  for (const o of ordenes) {
    if (o.estado === 'en_espera') enEspera++;
    if (o.estado === 'recibida_parcial') parciales++;
    if (o.conflicto) conConflicto++;
    // Lo que falta vincular solo importa en las órdenes que todavía esperan:
    // en una cerrada ya no se va a recibir nada.
    if (o.estado === 'en_espera' || o.estado === 'recibida_parcial') {
      const p = progresoDeOrden(o);
      sinVincular += p.sinVincular;
      lineasPendientes += p.pendientes;
    }
  }
  return { enEspera, parciales, sinVincular, conConflicto, lineasPendientes };
}
