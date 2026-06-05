// Tipos de dominio compartidos por el Panel de Inteligencia.
// Son los shapes que vuelven de Supabase para los 6 datasets que alimenta
// useInteligenciaData().

export type OT = {
  id: string | number;
  estado: string | null;
  datos_generales: Record<string, unknown> | null;
  items: unknown[] | null;
  fecha_creacion: string | null;
  fecha_modificacion: string | null;
  total: number | null;
};

export type Insumo = {
  cod: string | null;
  nemotecnico: string | null;
  stock_mp: number | null;
  stock_liberado: number | null;
  minimo: number | null;
  categoria: string | null;
  sub_categoria: string | null;
  ubicacion: string | null;
  stock_total: number;
  unidad?: string;
};

export type Mov = {
  id?: string | number;
  tipo: string | null;
  cantidad: number | null;
  fecha: string | null;
  codigo: string | null;
  producto: string | null;
  ot: string | null;
  almacen: string | null;
  responsable_entrega: string | null;
  bitacora: string | null;
};

export type Rack = {
  rack: string;
  fila: string | number;
  columna: string | number;
  codigo_insumo: string | null;
  almacen: string | null;
};

export type ErrorCorte = {
  motivo: string | null;
  created_at: string;
  ot: string | null;
  cod_original: string | null;
  medida_cm: number | null;
  reemplazo_cod: string | null;
  reemplazo_colmena: string | null;
  registrado_por: string | null;
};
