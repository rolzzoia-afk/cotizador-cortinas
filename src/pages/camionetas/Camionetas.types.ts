// Tipos compartidos del módulo Camionetas.

export type Camioneta = {
  id: string;
  nombre: string;
  patente: string | null;
  instalador: string | null;
  activa: boolean;
};

export type Insumo = {
  id: string;
  nemotecnico: string | null;
  cod: string | null;
  stock_total: number | null;
};

export type StockItem = {
  id: string;
  camioneta_id: string;
  insumo_id: string;
  cantidad: number;
  insumos?: { nemotecnico: string | null; cod: string | null } | null;
};

export type Movimiento = {
  id: string;
  tipo:
    | 'carga'
    | 'uso'
    | 'swap_salida'
    | 'swap_entrada'
    | 'devolucion'
    | 'defectuoso';
  cantidad: number;
  motivo: string | null;
  registrado_por: string | null;
  created_at: string;
  insumo_id: string;
  insumos?: { nemotecnico: string | null; cod: string | null } | null;
};

export type Vista = 'main' | 'detalle' | 'carga' | 'swap' | 'devolucion' | 'historial';

export type EstadoDev = 'ok' | 'defectuoso' | 'queda';
