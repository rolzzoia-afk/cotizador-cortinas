// ─────────────────────────────────────────────────────────────────────
// La solicitud de reposición: lo que BODEGA le pide a GERENCIA.
//
// Es el primer tramo del circuito de Compras. Acá se arma el pedido —desde
// Alertas, desde el catálogo o desde la ficha de un artículo—, se revisa y se
// manda. Lo que vuelve son órdenes de compra, que viven en `compras.ts`.
//
// Hasta ahora «pedir reposición» escribía una fila en el registro viejo de
// movimientos: una anotación que no movía stock, sin estado y que nadie
// contestaba. Un pedido sin respuesta no es un pedido.
// ─────────────────────────────────────────────────────────────────────

import type { VarianteBadge } from './badges';
import {
  pendienteDeLinea,
  unidadesDeInventario,
  type DominioCompra,
  type OrdenCompra,
} from './compras';

export type EstadoSolicitud =
  | 'borrador'
  | 'enviada'
  | 'en_orden'
  | 'recibida'
  | 'rechazada'
  | 'cancelada';

export type LineaSolicitud = {
  id: string;
  dominio: DominioCompra;
  item_cod: string;
  nombre?: string | null;
  unidad?: string | null;
  cantidad: number;
  /** El saldo en el momento de pedir. Es lo que explica POR QUÉ se pidió. */
  stock_al_pedir?: number | null;
  minimo_al_pedir?: number | null;
  proveedor_sugerido?: string | null;
  motivo?: string | null;
  /** La orden de compra que la recogió, cuando Gerencia ya la emitió. */
  oc_numero?: string | null;
  estado_linea?: string | null;
};

export type Solicitud = {
  id: string;
  numero: string;
  estado: EstadoSolicitud;
  creada_por?: string | null;
  creada_en?: string | null;
  enviada_en?: string | null;
  motivo_rechazo?: string | null;
  /** Por qué no se pudo mandar. Con esto puesto, sigue en borrador. */
  error_envio?: string | null;
  notas?: string | null;
  lineas?: LineaSolicitud[];
};

type Etiqueta = { texto: string; variante: VarianteBadge };

export const ESTADOS_SOLICITUD: Readonly<Record<EstadoSolicitud, Etiqueta>> = {
  borrador: { texto: 'Armando', variante: 'muted' },
  enviada: { texto: 'Con Gerencia', variante: 'accent' },
  en_orden: { texto: 'En una orden', variante: 'success' },
  recibida: { texto: 'Recibida', variante: 'success' },
  rechazada: { texto: 'Rechazada', variante: 'destructive' },
  cancelada: { texto: 'Cancelada', variante: 'muted' },
};

/** La etiqueta de un estado que la base podría traer escrito de otra forma. */
export function etiquetaSolicitud(estado: string | null | undefined): Etiqueta {
  return (
    ESTADOS_SOLICITUD[(estado ?? '') as EstadoSolicitud] ?? {
      texto: estado || '—',
      variante: 'muted',
    }
  );
}

// ── De Alertas al pedido ─────────────────────────────────────────────

/** Lo que Alertas sabe de un artículo cuando alguien lo marca para pedir. */
export type ArticuloParaPedir = {
  dominio: DominioCompra;
  codigo: string;
  nombre?: string | null;
  ahora?: number | null;
  minimo?: number | null;
  cantidad: number;
  proveedor?: string | null;
  /** true = lo disparó el mínimo; false = alguien lo pidió a mano. */
  bajoMinimo?: boolean;
};

/** Lo que viaja a la función de la base. */
export type LineaParaRpc = {
  dominio: DominioCompra;
  item_cod: string;
  cantidad: number;
  nombre?: string;
  unidad?: string;
  stock_al_pedir?: number;
  minimo_al_pedir?: number;
  proveedor_sugerido?: string;
  motivo?: 'bajo_minimo' | 'manual';
};

/**
 * Arma las líneas para pedir. Descarta lo que no tiene cantidad —pedir 0 no es
 * pedir— y junta los repetidos en uno solo con la cantidad más alta: marcar
 * dos veces el mismo artículo es un descuido, no un pedido del doble.
 */
export function lineasParaSolicitud(articulos: ArticuloParaPedir[]): LineaParaRpc[] {
  const porClave = new Map<string, LineaParaRpc>();
  for (const a of articulos) {
    const cod = String(a.codigo ?? '').trim().toUpperCase();
    const cant = Number(a.cantidad ?? 0);
    if (!cod || !(cant > 0)) continue;
    const clave = `${a.dominio}|${cod}`;
    const linea: LineaParaRpc = {
      dominio: a.dominio,
      item_cod: cod,
      cantidad: Math.round(cant * 1000) / 1000,
      unidad: a.dominio === 'tela' ? 'm' : 'un',
      motivo: a.bajoMinimo ? 'bajo_minimo' : 'manual',
    };
    if (a.nombre) linea.nombre = String(a.nombre);
    if (a.ahora != null && Number.isFinite(Number(a.ahora))) linea.stock_al_pedir = Number(a.ahora);
    if (a.minimo != null && Number.isFinite(Number(a.minimo))) {
      linea.minimo_al_pedir = Number(a.minimo);
    }
    if (a.proveedor) linea.proveedor_sugerido = String(a.proveedor).trim();

    const previa = porClave.get(clave);
    porClave.set(clave, previa && previa.cantidad >= linea.cantidad ? previa : linea);
  }
  return [...porClave.values()];
}

/**
 * Los artículos que se marcaron pero no tienen «dejar en» definido, así que no
 * hay de dónde sacar cuánto pedir. Se avisa en vez de inventar un número que
 * alguien terminaría comprando.
 */
export function sinCantidadParaPedir(articulos: ArticuloParaPedir[]): string[] {
  return articulos.filter((a) => !(Number(a.cantidad) > 0)).map((a) => String(a.codigo));
}

/**
 * Cómo queda repartido el pedido por proveedor. Gerencia va a emitir una orden
 * por cada uno, así que verlo antes de mandar evita la sorpresa de recibir
 * tres órdenes de una sola solicitud.
 */
export function agruparPorProveedor(
  lineas: LineaSolicitud[],
): Array<{ proveedor: string; lineas: LineaSolicitud[] }> {
  const grupos = new Map<string, LineaSolicitud[]>();
  for (const l of lineas) {
    const p = String(l.proveedor_sugerido ?? '').trim() || 'Sin proveedor anotado';
    const g = grupos.get(p);
    if (g) g.push(l);
    else grupos.set(p, [l]);
  }
  return [...grupos.entries()]
    .map(([proveedor, ls]) => ({ proveedor, lineas: ls }))
    .sort(
      (a, b) => b.lineas.length - a.lineas.length || a.proveedor.localeCompare(b.proveedor, 'es'),
    );
}

// ── Qué viene en camino ──────────────────────────────────────────────

/**
 * Cuántas unidades de cada artículo están comprometidas en órdenes que todavía
 * no llegaron. Es lo que evita volver a pedir algo que ya viene: sin esto,
 * Alertas sigue mostrando el artículo bajo el mínimo hasta que el camión
 * descarga, y alguien lo pide de nuevo.
 *
 * Se cuenta en unidades NUESTRAS (`pendiente × factor`), que es como se compara
 * con el stock. La llave es `dominio|CÓDIGO`: el mismo código puede ser un
 * insumo y una tela.
 */
export function enCamino(ordenes: OrdenCompra[]): Map<string, number> {
  const total = new Map<string, number>();
  for (const o of ordenes) {
    if (o.estado !== 'en_espera' && o.estado !== 'recibida_parcial') continue;
    for (const l of o.lineas ?? []) {
      if (!l.item_cod) continue;
      if (l.estado_linea === 'cancelada' || l.estado_linea === 'faltante_aceptado') continue;
      const falta = unidadesDeInventario(pendienteDeLinea(l), l.factor);
      if (!(falta > 0)) continue;
      const clave = `${l.dominio ?? 'insumo'}|${String(l.item_cod).toUpperCase()}`;
      total.set(clave, (total.get(clave) ?? 0) + falta);
    }
  }
  return total;
}
