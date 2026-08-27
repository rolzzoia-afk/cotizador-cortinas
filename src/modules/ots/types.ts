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
  /**
   * Origen del adicional: 'manual' (agregado a mano/Excel) o 'pano' (derivado
   * automáticamente de una cenefa de paño al reconciliar la cotización). Los
   * 'pano' se regeneran en cada apertura, así que no se acumulan.
   */
  origen?: 'manual' | 'pano';
  /**
   * Solo en una línea que NACIÓ derivada de un paño y se editó a mano (por eso
   * pasó a 'manual'): la ubicación que tenía como derivada. Es lo que permite
   * que siga tapando a su gemela cuando se vuelve a abrir la OT, aunque le
   * hayan cambiado la ubicación — si no, la cenefa se cobraría dos veces.
   */
  ubicacionDerivada?: string;
  /**
   * TIPO escrito a mano para esta línea (ej. «ACCESORIO CENEFA OVALADA») en vez
   * del que trae el catálogo. Es SOLO el rótulo que se lee en la grilla y en el
   * PDF del cliente: el precio lo sigue decidiendo el catálogo por `codInt`, y
   * el motor ni siquiera recibe este campo.
   */
  tipo?: string;
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
  /**
   * La OT DETALLADA que sale bajo el título del PDF del cliente («N° COTJS -
   * 07979-5 -1 - VISITA-VERTICALES Y DUAL CON CENEFA CUADRADA»): texto libre
   * de la planilla, distinto del número `ot` con el que se crea la OT.
   */
  otDetallada?: string;
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
  /**
   * Descuento de instalación (0–1) puesto A MANO en su fila de ADICIONALES.
   * Le gana a la regla automática (gratis por cantidad / región).
   * `null`/ausente = manda la regla.
   */
  instalacionDescuentoManual?: number | null;
  /**
   * TIPO escrito a mano para la fila de INSTALACIÓN. Solo cambia el rótulo que
   * se lee en la grilla y en el PDF: la cantidad y el cobro los sigue
   * calculando el motor.
   */
  instalacionTipo?: string;
  /** Cotización sin instalación (el cliente retira / solo cortina). */
  sinInstalacion?: boolean;
  /** Envío de la cotización: gratis o con cobro en destino (lo paga el cliente al courier). */
  envio?: 'gratis' | 'cobro_destino';
  /**
   * Con qué se paga la tarjeta en ESTA cotización. `null`/ausente = el
   * proveedor global de Admin. Cambia el recargo, los términos de las cuotas,
   * el sello y la banda del pie: las cuotas sin interés son de Mercadopago.
   */
  proveedorTarjeta?: 'mercadopago' | 'flow' | null;
  /** Texto de la banda de validez del PDF para esta cotización ('' = el de la empresa). */
  validezTexto?: string;
  /** La banda de validez va amarilla con texto rojo (descuento a plazo corto). */
  validezAmarilla?: boolean;
  /** Habilita el tubo E78 (kit 45 mm) para la banda 2,2–3,0 m de esta OT.
   *  Default (ausente/false): el rango usa tubo E66 (38 mm) con kit normal;
   *  true: ROL/dúo/cenefa ovalada 38 mm del rango suben a fila 45 mm + E78. */
  usarTuboE78?: boolean;
  /** Descuento de colmena al confirmar el corte general (Fase 4) — guard de idempotencia. */
  corteGeneralColmena?: import('@/modules/cotizador/colmenaCorte').CorteGeneralColmena;
  /** Lo que quedó de la visita a terreno: video, informe, checklist y firma. */
  visita?: VisitaTerreno;
  /**
   * Lo que se escribe a mano en «Costo total» (Producción, solo administrador):
   * mano de obra, auto, TAG y las fallas de tela. El resto de esa pantalla se
   * calcula solo. Lo edita ÚNICAMENTE esa pantalla.
   */
  costosOT?: import('@/modules/produccion/costoOT').CostoManualOT;
};

/** Respuesta a una pregunta del resumen de visita. `null` = todavía sin contestar. */
export type RespuestaChecklistVisita = { respuesta: boolean | null; notas?: string };

/** Foto de la visita: path en el bucket privado + la nota que le puso el vendedor. */
export type FotoVisita = { path: string; nota?: string; subidaEl?: string };

/**
 * Dónde estaba el teléfono cuando el cliente firmó.
 *
 * Es un RESPALDO: si más adelante el cliente discute la visita, queda la firma
 * y el lugar donde se dio. No se usa para validar nada ni bloquea la firma.
 */
export type GeoFirma = {
  lat: number;
  lng: number;
  /** Radio de incertidumbre que informa el navegador (m). */
  precisionM?: number;
  capturadaEl: string;
};

/**
 * La visita a terreno, tal como queda registrada en la OT.
 *
 * El video, las fotos y la firma viven en el bucket privado `visitas` (paths,
 * no URLs: el bucket no es público y se abre con URL firmada). El informe lo
 * redacta la IA a partir de la transcripción, pero queda EDITABLE: lo que vale
 * es lo que el vendedor deja escrito.
 */
export type VisitaTerreno = {
  videoPath?: string;
  /** Audio extraído del video (wav mono 16 kHz): permite regenerar sin resubir. */
  audioPath?: string;
  /** Fotos de respaldo de la visita (no entran al informe ni a la cotización). */
  fotos?: FotoVisita[];
  transcripcion?: string;
  informe?: string;
  informeGeneradoEl?: string;
  firmaPath?: string;
  firmadoEl?: string;
  firmanteNombre?: string;
  /** Dónde se firmó. Ausente cuando el teléfono no la entregó (ver `firmaGeoMotivo`). */
  firmaGeo?: GeoFirma;
  /** Por qué NO hay ubicación (permiso denegado, sin señal…). También es constancia. */
  firmaGeoMotivo?: string;
  /** id de la pregunta → respuesta. Una pregunta borrada en Admin no borra su respuesta. */
  checklist?: Record<string, RespuestaChecklistVisita>;
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
    /** DCT% (0–100) de la línea en la cotización; el descuento es por paño. */
    descuento?: number;
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
