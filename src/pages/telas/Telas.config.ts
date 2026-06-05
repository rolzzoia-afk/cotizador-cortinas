// Defaults de los formularios del módulo Telas.

import type { Tela } from './Telas.types';

export const EMPTY_TELA: Omit<Tela, 'id'> = {
  codigo: '',
  tipo: 'BK',
  grupo: null,
  nemotecnico: null,
  proveedor: null,
  cod_ext: null,
  descriptor: null,
  ancho: null,
  calidad: null,
  status_stock: null,
  stock_minimo: null,
  stock_total: null,
  stock_mp: null,
  stock_liberado: null,
  posicion: null,
  almacen: 'LIBERADO',
  estado: 'ACTIVO',
  proveedor_codigo: null,
  responsable: null,
  observaciones: null,
  foto_url: null,
};
