// Tipos del dominio OT (Orden de Trabajo).
// Portados desde public/legacy/index.html (rowToOT/otToRow, líneas 60-93).

export type OTEstado =
  | 'cotizacion'
  | 'esperando'
  | 'terreno'
  | 'aprobada'
  | 'produccion'
  | 'lista'
  | 'instalada'
  | 'archivada';

export type SubEtapaProd =
  | 'Estructura'
  | 'Paños'
  | 'Dimensionado'
  | 'Armado'
  | 'Prueba'
  | 'Lista';

export type HistorialEstado = {
  de: OTEstado;
  a: OTEstado;
  fecha: string;
};

export type PostInstalacion = {
  checks: boolean[];
  encuesta: string[];
  observaciones: string;
};

export type BomItem = {
  categoria: string;
  descripcion: string;
  especificacion?: string;
  color?: string;
  cantidad: number;
  unidad: string;
};

export type DatosGenerales = {
  cliente?: string;
  rut?: string;
  mail?: string;
  telefono?: string;
  direccion?: string;
  comuna?: string;
  ot?: string;
  canal?: string;
  fecha?: string;
  notas?: string;
  cotizacionCount?: number;
  subEtapa?: SubEtapaProd | null;
  fechaEntrega?: string | null;
  postInstalacion?: PostInstalacion;
  historialEstados?: HistorialEstado[];
  bom?: BomItem[];
  bomFecha?: string | null;
};

// Estructura mínima de una ventana/ítem dentro de OT.items. El cotizador
// define tipos más ricos (cotizador/types), pero acá mantenemos la forma
// compatible con el legacy: un objeto con id + medidas + paños + datos del
// producto cotizado. Los fields exactos están en @/modules/cotizador/types.
export type VentanaItem = {
  id: string | number;
  ubicacion?: string;
  codInt?: string;
  producto?: string;
  tipo?: string;
  descripcion?: string;
  color?: string;
  alto?: number;
  precio?: number;
  cantidad?: number;
  subtotal?: number;
  fase?: string;
  categoria?: string;
  grupoId?: string | null;
  grupoOrden?: number;
  panos?: Array<{
    ancho: number | string;
    alto: number | string;
    color?: string;
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
};

export type OT = {
  id: string;
  estado: OTEstado;
  subEtapa: SubEtapaProd | null;
  datosGenerales: DatosGenerales;
  storeVentanas: VentanaItem[];
  cotizacionCount: number;
  fechaCreacion: string;
  fechaModificacion: string;
  notas: string;
  totalConIva: number;
};

// Row de Supabase (tabla `ots`)
export type OTRow = {
  id: string;
  empresa_id: string;
  numero_ot: string;
  estado: string;
  datos_generales: DatosGenerales;
  items: VentanaItem[];
  total: number;
  fecha_modificacion: string;
  fecha_creacion: string;
  fecha_entrega: string | null;
};
