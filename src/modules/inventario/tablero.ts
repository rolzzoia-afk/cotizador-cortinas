// ─────────────────────────────────────────────────────────────────────
// Lo que muestra el tablero del inventario (lámina «Shell y tablero»).
//
// Puro: recibe las filas ya leídas y devuelve los seis números de arriba, la
// tabla de movimientos del día y los atajos que le tocan a cada rol.
// ─────────────────────────────────────────────────────────────────────

import { estadoArticulo, estadoPideAtencion, tipoMovimientoCanonico } from './badges';
import { normalizarAlmacen } from './almacenes';

export type InsumoTablero = {
  cod?: string | null;
  nemotecnico?: string | null;
  stock_mp?: number | null;
  stock_liberado?: number | null;
  minimo?: number | null;
  status?: string | null;
};

export type TelaTablero = {
  codigo?: string | null;
  stock_mp?: number | null;
  stock_liberado?: number | null;
  stock_minimo?: number | null;
};

/**
 * Una fila de `movimientos_insumos` o de `movimientos_telas`. Las dos tablas
 * guardan lo mismo con nombres distintos: la cantidad de una tela se llama
 * `metros`, y el nombre del artículo (`producto`) solo existe en los insumos.
 */
export type MovimientoCrudo = {
  id?: string | null;
  fecha?: string | null;
  tipo?: string | null;
  codigo?: string | null;
  producto?: string | null;
  almacen?: string | null;
  cantidad?: number | null;
  metros?: number | null;
  ot?: string | null;
  responsable_entrega?: string | null;
};

/** La fila normalizada que se dibuja en la tabla del tablero. */
export type FilaMovimiento = {
  id: string;
  hora: string;
  codigo: string;
  nombre: string;
  tipo: string;
  almacen: string;
  cantidad: number;
  unidad: string;
  ot: string;
  dominio: 'insumo' | 'tela';
};

export type KpisTablero = {
  alertas: number;
  alertasSinStock: number;
  alertasBajoMinimo: number;
  movimientosHoy: number;
  entradasHoy: number;
  salidasHoy: number;
  telasBajoMinimo: number;
  telasConStock: number;
  telasTotal: number;
  /** Telas sin mínimo definido: nunca van a avisar. */
  telasSinMinimo: number;
  panosAlerta: number;
  panosTotal: number;
  tubos: number;
};

function total(a: { stock_mp?: number | null; stock_liberado?: number | null }): number {
  return (a.stock_mp || 0) + (a.stock_liberado || 0);
}

export function kpisTablero(datos: {
  insumos: InsumoTablero[];
  telas: TelaTablero[];
  movimientosHoy: MovimientoCrudo[];
  panosTotal: number;
  panosAlerta: number;
  tubos: number;
}): KpisTablero {
  let alertasSinStock = 0;
  let alertasBajoMinimo = 0;
  for (const i of datos.insumos) {
    const estado = estadoArticulo({ total: total(i), minimo: i.minimo, status: i.status });
    if (!estadoPideAtencion(estado)) continue;
    if (estado === 'bajo_minimo') alertasBajoMinimo += 1;
    else alertasSinStock += 1; // sin stock y negativo van juntos: los dos frenan
  }

  let telasBajoMinimo = 0;
  let telasConStock = 0;
  let telasSinMinimo = 0;
  for (const t of datos.telas) {
    const m = t.stock_minimo;
    const saldo = total(t);
    if (saldo > 0) telasConStock += 1;
    if (m == null || Number(m) <= 0) {
      telasSinMinimo += 1;
      continue;
    }
    if (saldo < Number(m)) telasBajoMinimo += 1;
  }

  let entradasHoy = 0;
  let salidasHoy = 0;
  for (const m of datos.movimientosHoy) {
    const c = tipoMovimientoCanonico(m.tipo);
    if (c === 'INGRESO' || c === 'DEVOLUCION') entradasHoy += 1;
    else if (c === 'SALIDA' || c === 'MERMA') salidasHoy += 1;
  }

  return {
    alertas: alertasSinStock + alertasBajoMinimo,
    alertasSinStock,
    alertasBajoMinimo,
    movimientosHoy: datos.movimientosHoy.length,
    entradasHoy,
    salidasHoy,
    telasBajoMinimo,
    telasConStock,
    telasTotal: datos.telas.length,
    telasSinMinimo,
    panosAlerta: datos.panosAlerta,
    panosTotal: datos.panosTotal,
    tubos: datos.tubos,
  };
}

function horaDe(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Junta los movimientos de insumos y de telas en una sola lista, la más
 * reciente primero. Es la vista previa del kardex que llega en la Entrega B.
 */
export function movimientosDelDia(
  insumos: MovimientoCrudo[],
  telas: MovimientoCrudo[],
  limite = 8,
): FilaMovimiento[] {
  const filas: FilaMovimiento[] = [];
  const agregar = (m: MovimientoCrudo, dominio: 'insumo' | 'tela') => {
    filas.push({
      id: String(m.id ?? `${dominio}-${m.codigo}-${m.fecha}`),
      hora: horaDe(m.fecha),
      codigo: String(m.codigo ?? '').trim() || '—',
      nombre: String(m.producto ?? '').trim(),
      tipo: String(m.tipo ?? ''),
      almacen: normalizarAlmacen(m.almacen) ?? String(m.almacen ?? '').trim(),
      cantidad: Number(m.cantidad ?? m.metros ?? 0),
      unidad: dominio === 'tela' ? 'm' : '',
      ot: String(m.ot ?? '').trim(),
      dominio,
    });
  };
  for (const m of insumos) agregar(m, 'insumo');
  for (const m of telas) agregar(m, 'tela');

  // Se ordena por la hora ya formateada: las dos fuentes traen la fecha en el
  // mismo campo, así que basta comparar el texto HH:MM al revés.
  return filas.sort((a, b) => b.hora.localeCompare(a.hora)).slice(0, limite);
}

// ── Atajos ────────────────────────────────────────────────────────────

export type Atajo = {
  id: string;
  texto: string;
  /** Ruta interna, o `externa` si sale del módulo. */
  ruta: string;
  icono: 'QrCode' | 'Plus' | 'Layers' | 'AlignJustify' | 'ShoppingCart';
  roles: readonly string[];
};

const ATAJOS: readonly Atajo[] = [
  {
    id: 'despachar',
    texto: 'Escanear QR y despachar',
    ruta: '/inventario/despacho',
    icono: 'QrCode',
    roles: ['bodeguero', 'operario'],
  },
  {
    id: 'ingreso',
    texto: 'Ingreso rápido a bodega',
    ruta: '/inventario/insumos',
    icono: 'Plus',
    roles: ['bodeguero', 'operario'],
  },
  {
    id: 'tela',
    texto: 'Descontar metros de tela',
    ruta: '/inventario/telas',
    icono: 'Layers',
    roles: ['bodeguero', 'produccion', 'dimensionado', 'telas', 'operario', 'ventas'],
  },
  {
    id: 'optimizador',
    texto: 'Abrir optimizador de tubos',
    ruta: '/optimizador',
    icono: 'AlignJustify',
    roles: ['produccion', 'operario'],
  },
  {
    // El camino corto para el mesón: llegó el camión, hay que encontrar la
    // orden. Solo aparece con el módulo encendido — lo filtra `atajosPorRol`.
    id: 'compras',
    texto: 'Recibir mercadería',
    ruta: '/inventario/compras',
    icono: 'ShoppingCart',
    roles: ['bodeguero', 'operario'],
  },
];

/**
 * Los atajos que le sirven a este rol. El admin los ve todos.
 *
 * `comprasEncendido` saca el de recibir mercadería cuando el módulo está
 * apagado: un atajo que lleva a una pantalla que dice «esto todavía no opera»
 * es peor que no tenerlo.
 */
export function atajosPorRol(
  rol: string | null | undefined,
  comprasEncendido = false,
): Atajo[] {
  const r = (rol || '').toLowerCase().trim();
  const disponibles = ATAJOS.filter((a) => a.id !== 'compras' || comprasEncendido);
  if (r === 'admin' || r === 'superadmin') return disponibles;
  if (!r) return [];
  return disponibles.filter((a) => a.roles.includes(r));
}
