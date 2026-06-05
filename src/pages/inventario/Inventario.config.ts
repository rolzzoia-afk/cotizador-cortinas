// Defaults de los formularios del Inventario.

import type { InsumoForm, MovForm } from './Inventario.types';

export const EMPTY_INSUMO_FORM: InsumoForm = {
  cod: '',
  nemotecnico: '',
  categoria: '',
  sub_categoria: '',
  producto: '',
  proveedor: '',
  compra: '',
  color: '',
  minimo: '0',
  can_x_paquete: '1',
  costo: '0',
  ubicacion: '',
  cod_proveedor: '',
  estado_inventario: 'ACTIVO',
  descriptor_proveedor: '',
  comentarios: '',
  foto_url: '',
  stock_inicial: '0',
};

export const EMPTY_MOV_FORM: MovForm = {
  tipo: 'NUEVO INGRESO',
  codigo: '',
  cantidad: '1',
  almacen: 'MP',
  ot: '',
  responsable_entrega: '',
  recepcion: '',
  bitacora: '',
};
