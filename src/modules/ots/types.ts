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

/** Línea adicional de Fase 0 (motores, cenefas, instalaciones, etc.). */
export type AdicionalFase0Persistido = {
  id?: string;
  codInt: string;
  cantidad: number;
  /** Descuento en porcentaje (0–100), igual que la grilla de Fase 0. */
  descuento: number;
  ubicacion?: string;
  colorAcc?: string;
  /** Cenefa ovalada con tira de aluminio (true → CON TIRA en Excel). */
  conTira?: boolean;
};

export type DatosGenerales = {
  cliente?: string;
  rut?: string;
  mail?: string;
  telefono?: string;
  direccion?: string;
  comuna?: string;
  /** Región de Chile de la dirección del cliente (desplegable de Fase 0). */
  regionNombre?: string;
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
  optimizerRows?: unknown[];
  /** Hoja de inventario Fase 4: estado de entrega por ítem (ver cotizador/inventario). */
  inventario?: import('@/modules/cotizador/inventario').InventarioEstado;
  inventarioFecha?: string | null;
  /** Adicionales de la cotización Fase 0 (no son ventanas/cortinas). */
  adicionalesFase0?: AdicionalFase0Persistido[];
  /** Cotización a región: la instalación no es gratis por 4+ (usa el % de región). */
  region?: boolean;
  /** Descuento de instalación (0–1) para esta OT a región; si falta usa el global. */
  instalacionDescuentoRegion?: number;
  /** Cotización sin instalación (el cliente retira / solo cortina). */
  sinInstalacion?: boolean;
  /** Envío de la cotización: gratis o con cobro en destino (lo paga el cliente al courier). */
  envio?: 'gratis' | 'cobro_destino';
  /** Descuento de colmena al confirmar el corte general (Fase 4) — guard de idempotencia. */
  corteGeneralColmena?: import('@/modules/cotizador/colmenaCorte').CorteGeneralColmena;
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
