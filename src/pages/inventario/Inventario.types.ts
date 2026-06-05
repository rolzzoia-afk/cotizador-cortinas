// Tipos compartidos del módulo Inventario.

import type { Insumo } from '@/modules/inventario/helpers';

export type Tab = 'catalogo' | 'movimientos' | 'alertas' | 'rack';
export type SortCol = keyof Insumo;
export type SortDir = 'asc' | 'desc';
export type ValidadoresMap = Record<string, string[]>;
export type MovTipo = 'NUEVO INGRESO' | 'SALIDA PRODUCCION' | 'AJUSTE' | 'DEVOLUCION';

export type InsumoForm = {
  cod: string;
  nemotecnico: string;
  categoria: string;
  sub_categoria: string;
  producto: string;
  proveedor: string;
  compra: string;
  color: string;
  minimo: string;
  can_x_paquete: string;
  costo: string;
  ubicacion: string;
  cod_proveedor: string;
  estado_inventario: string;
  descriptor_proveedor: string;
  comentarios: string;
  foto_url: string;
  stock_inicial: string;
};

export type MovForm = {
  tipo: MovTipo;
  codigo: string;
  cantidad: string;
  almacen: 'MP' | 'LIBERADO';
  ot: string;
  responsable_entrega: string;
  recepcion: string;
  bitacora: string;
};
