// Tipos compartidos del módulo Telas.

export type Tela = {
  id: string;
  codigo: string;
  tipo: string | null;
  grupo: string | null;
  nemotecnico: string | null;
  proveedor: string | null;
  cod_ext: string | null;
  descriptor: string | null;
  ancho: number | null;
  calidad: string | null;
  status_stock: string | null;
  stock_minimo: number | null;
  stock_total: number | null;
  stock_mp: number | null;
  stock_liberado: number | null;
  posicion: string | null;
  almacen: string | null;
  estado: string | null;
  proveedor_codigo: string | null;
  responsable: string | null;
  observaciones: string | null;
  foto_url: string | null;
};

export type Slot = { posicion: string; codigo: string; almacen: string | null };

export type Movimiento = {
  id: string;
  codigo: string;
  tipo: string;
  metros: number | null;
  almacen: string | null;
  ot: string | null;
  responsable: string | null;
  operario: string | null;
  notas: string | null;
  fecha: string;
};

export type Falla = {
  id: string;
  codigo: string | null;
  tipo: string | null;
  grupo: string | null;
  proveedor: string | null;
  nemotecnico: string | null;
  ancho: number | null;
  alto: number | null;
  tipo_falla: string | null;
  metraje: number | null;
  fecha_reporte: string | null;
  responsable: string | null;
  informado: string | null;
  observaciones: string | null;
  solucion: string | null;
  fecha_resolucion: string | null;
  resuelto: string | null;
};

export type Validador = { campo: string; valor: string; orden: number | null };
export type ValidadoresMap = Record<string, string[]>;

export type ColmenaEntry = {
  codigo: string;
  tipo: string | null;
  nemotecnico: string | null;
  almacen: string | null;
  id: string | null;
};
export type Colmena = Record<string, ColmenaEntry>;

export type Tab = 'catalogo' | 'rack' | 'movimientos' | 'fallas' | 'mermas';
export type SortDir = 'asc' | 'desc';

// Merma de tela (Reglas Rolzzo): sobrante que no llega a colmena (120×180) o
// colmena dada de baja. La escribe Fase 4 (corte general) y "dar de baja".
export type Merma = {
  id: string;
  codigo: string | null;
  medida_ancho: number | null;
  medida_alto: number | null;
  motivo: string | null;
  ot_origen: string | null;
  colmena_origen_id: string | null;
  fecha: string | null;
  created_at: string | null;
};
export type MovTipo = 'INGRESO' | 'SALIDA' | 'TRASLADO' | 'AJUSTE';
