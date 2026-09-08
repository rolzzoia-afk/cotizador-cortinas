// Tipos compartidos del módulo Bodeguero.

import type { MOTIVOS_DEVOLUCION, AREAS_BODEGA } from './Bodeguero.config';

export type Vista =
  | 'lista'
  | 'despacho'
  | 'scanner'
  | 'firma'
  | 'salida'
  | 'entrada'
  | 'devolucion';

export type MotivoDevolucion = (typeof MOTIVOS_DEVOLUCION)[number];
export type AreaBodega = (typeof AREAS_BODEGA)[number];

export type ScanFase = 'loc' | 'item';
export type ScanEstado = 'esperando' | 'ok' | 'error';

export type Contador = {
  pickeado: number;
  requerido: number;
  estado: 'pendiente' | 'parcial' | 'completo';
};

export type AdHocFase = 'scan' | 'confirm' | 'ok';

export type InsumoAdHoc = {
  cod: string;
  nemotecnico: string | null;
  descriptor_proveedor: string | null;
  stock_mp: number | null;
  stock_liberado: number | null;
  proveedor?: string | null;
};
