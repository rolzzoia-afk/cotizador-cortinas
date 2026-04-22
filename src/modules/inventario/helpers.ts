// Lógica pura para inventario de insumos.
// Portado desde public/legacy/inventario.html (getStockTotal + calcularAlertas).

export type Insumo = {
  id: string;
  empresa_id?: string | null;
  cod: string | null;
  nemotecnico: string | null;
  descriptor_proveedor: string | null;
  categoria: string | null;
  sub_categoria: string | null;
  proveedor: string | null;
  producto: string | null;
  compra: string | null;
  cod_proveedor: string | null;
  color: string | null;
  minimo: number | null;
  can_x_paquete: number | null;
  costo: number | null;
  costo_iva: number | null;
  ubicacion: string | null;
  stock_mp: number | null;
  stock_liberado: number | null;
  stock_total: number | null;
  estado_inventario: string | null;
  status: string | null;
  foto_url: string | null;
  comentarios: string | null;
};

export type Movimiento = {
  id: string;
  empresa_id?: string | null;
  fecha: string | null;
  mes: string | null;
  tipo: string;
  codigo: string | null;
  producto: string | null;
  almacen: string | null;
  cantidad: number | null;
  ot: string | null;
  responsable_entrega: string | null;
  recepcion: string | null;
  bitacora: string | null;
};

export type UbicacionRack = {
  id: string;
  empresa_id?: string | null;
  rack: string;
  fila: number | string;
  columna: string;
  codigo_insumo: string | null;
  almacen: string | null;
};

export type Validador = {
  id?: string;
  empresa_id?: string | null;
  campo: string;
  valor: string;
  orden: number | null;
};

export type Alerta = {
  tipo: 'SIN_STOCK' | 'STOCK_BAJO';
  codigo: string;
  nombre: string;
  severity: 'danger' | 'warning';
};

export function getStockTotal(i: Insumo): number {
  if (typeof i.stock_total === 'number' && i.stock_total !== 0) return i.stock_total;
  return (i.stock_mp || 0) + (i.stock_liberado || 0);
}

export function calcularAlertas(insumos: Insumo[]): Alerta[] {
  const alertas: Alerta[] = [];
  for (const ins of insumos) {
    const st = getStockTotal(ins);
    const nombre = ins.nemotecnico || ins.descriptor_proveedor || '';
    const codigo = ins.cod || '';
    if (st <= 0 && ins.status !== 'DESCONTINUADO') {
      alertas.push({ tipo: 'SIN_STOCK', codigo, nombre, severity: 'danger' });
    } else if ((ins.minimo || 0) > 0 && st < (ins.minimo || 0)) {
      alertas.push({ tipo: 'STOCK_BAJO', codigo, nombre, severity: 'warning' });
    }
  }
  return alertas;
}

const MESES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
];

export function mesActual(): string {
  return MESES[new Date().getMonth()];
}

export function formatFecha(f: string | null): string {
  if (!f) return '—';
  const d = new Date(f);
  return `${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatCLP(n: number | null | undefined): string {
  const v = Number(n || 0);
  return v.toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

export function esEntrada(tipo: string): boolean {
  return tipo === 'NUEVO INGRESO' || tipo === 'DEVOLUCION';
}

export function esAjuste(tipo: string): boolean {
  return tipo === 'AJUSTE';
}

export type EstadoFiltro =
  | ''
  | 'con_stock'
  | 'sin_stock'
  | 'bajo_minimo'
  | 'sin_minimo'
  | 'sin_ubicacion';

export function filtrarCatalogo(
  insumos: Insumo[],
  opts: {
    busqueda: string;
    categoria: string;
    subCategoria: string;
    estado: EstadoFiltro;
  },
): Insumo[] {
  const { busqueda, categoria, subCategoria, estado } = opts;
  const q = busqueda.trim().toUpperCase();
  return insumos.filter((i) => {
    if (q) {
      const hit =
        (i.cod || '').toUpperCase().includes(q) ||
        (i.nemotecnico || '').toUpperCase().includes(q) ||
        (i.color || '').toUpperCase().includes(q) ||
        (i.descriptor_proveedor || '').toUpperCase().includes(q);
      if (!hit) return false;
    }
    if (categoria && i.categoria !== categoria) return false;
    if (subCategoria && i.sub_categoria !== subCategoria) return false;
    if (estado === 'con_stock' && !(getStockTotal(i) > 0)) return false;
    if (estado === 'sin_stock' && !(getStockTotal(i) <= 0)) return false;
    if (estado === 'bajo_minimo') {
      if (!((i.minimo || 0) > 0 && getStockTotal(i) < (i.minimo || 0))) return false;
    }
    if (estado === 'sin_minimo' && (i.minimo || 0) > 0) return false;
    if (estado === 'sin_ubicacion' && (i.ubicacion || '').trim() !== '') return false;
    return true;
  });
}
