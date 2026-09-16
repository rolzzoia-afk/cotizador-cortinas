export type LeadEstado =
  | 'nuevo'
  | 'contactado'
  | 'visita_agendada'
  | 'visita_realizada'
  | 'cotizando'
  | 'cotizado'
  | 'negociacion'
  | 'en_espera'
  | 'ganado'
  | 'perdido_precio'
  | 'perdido_competencia'
  | 'perdido_otro';

// Shape de la tabla `leads` (compartida con Agente IA Playground).
// Las columnas del agente (whatsapp_*, scoring, producto_interes, etc.) las
// puebla la Edge Function; las columnas manuales (email, rut, comentarios)
// las puebla la UI de Fase 1. Ambos flujos coexisten en la misma tabla.
export type Lead = {
  id: string;
  empresa_id: string;
  // Identidad / contacto
  nombre: string | null;
  whatsapp_phone: string | null;
  whatsapp_wa_id: string | null;
  email: string | null;
  rut: string | null;
  comuna: string | null;
  // Captura agente IA
  producto_interes: string | null;
  cantidad_ventanas: number | null;
  tiene_medidas: boolean | null;
  necesita_instalacion: boolean | null;
  urgencia: string | null;
  presupuesto_rango: string | null;
  resumen_para_vendedor: string | null;
  scoring: number | null;
  // Pipeline / asignación
  fuente: string | null;
  estado: LeadEstado;
  motivo_derivacion: string | null;
  asignado_a: string | null;
  asignado_at: string | null;
  tomado_at: string | null;
  // Conversión + tracking
  ot_id: string | null;
  comentarios: string | null;
  ultima_actividad_at: string;
  created_at: string;
  updated_at: string;
  // Motor de seguimientos (Sistema "Menos Ruido, Más Control")
  prioridad: Prioridad;
  detalle_personal: string | null;
  fecha_cotizacion: string | null;
  etapa_seguimiento: number; // 0 = sin cotización; 1/2/3 = etapa pendiente; 4 = ciclo cerrado
  seg1_fecha: string | null;
  seg1_resultado: string | null;
  seg2_fecha: string | null;
  seg2_resultado: string | null;
  seg3_fecha: string | null;
  seg3_resultado: string | null;
  archivado: boolean;
  fecha_archivado: string | null;
  // Metas / dinero
  monto: number | null;        // monto de la venta/cotización en CLP
  fecha_cierre: string | null; // cuándo pasó a 'ganado'
  // Columnas de la planilla de seguimiento (el Excel del equipo comercial)
  instagram: string | null;
  region: string | null;
  anuncio: string | null;       // qué anuncio lo trajo
  mensaje: string | null;       // lo que pidió el cliente
  llamada_por: string | null;   // nombres de las listas del engranaje de /ventas
  cotizado_por: string | null;
  visita_por: string | null;
  numero_cotizacion: string | null; // lo mantiene la OT (otDetallada o numero_ot)
  estado_cotizacion: EstadoCotizacion;
  cotizacion_version: number;   // cuántas veces se envió (1 = enviada, ≥2 = actualizada)
  origen_ot: boolean;           // la fila la creó una OT, no una persona
  ultima_actividad_por: string | null;
  ultima_actividad_tipo: string | null;
};

/** Qué pasa con el DOCUMENTO de la cotización (distinto del estado del cliente). */
export type EstadoCotizacion = 'sin_enviar' | 'enviada' | 'por_actualizar' | 'actualizada';

/** Por dónde se hizo un seguimiento. */
export type Medio = 'llamada' | 'whatsapp' | 'mail' | 'instagram' | 'otro';

export type LeadSeguimiento = {
  id: string;
  lead_id: string;
  empresa_id: string;
  n: number;              // correlativo del cliente: 1, 2, 3, 4…
  etapa: number | null;   // etapa de la cadencia (1-3) o null si fue uno extra
  fecha: string;
  medio: Medio | null;
  resultado: SeguimientoResultado;
  nota: string | null;
  registrado_por: string | null;
  created_at: string;
};

export type Prioridad = 'alta' | 'media' | 'baja';

export const PRIORIDAD_ORDEN: Prioridad[] = ['alta', 'media', 'baja'];

export const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

// Peso para ordenar (alta primero)
export const PRIORIDAD_PESO: Record<Prioridad, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

// Resultados posibles de un seguimiento
export type SeguimientoResultado =
  | 'no_respondio'
  | 'respondio'
  | 'agendo_visita'
  | 'cerro'
  | 'no_interesado';

export const SEG_RESULTADO_LABEL: Record<SeguimientoResultado, string> = {
  no_respondio: 'No respondió',
  respondio: 'Respondió (sigue interesado)',
  agendo_visita: 'Agendó visita',
  cerro: 'Cerró la venta',
  no_interesado: 'No le interesa',
};

// Un resultado "positivo" detiene el ciclo de seguimientos
export const SEG_RESULTADO_POSITIVO = (r: string): boolean =>
  r === 'respondio' || r === 'agendo_visita' || r === 'cerro';

export type LeadActividadTipo =
  | 'creado'
  | 'cambio_estado'
  | 'comentario'
  | 'asignacion'
  | 'conversion_ot'
  | 'edicion'
  | 'agente_ingreso'
  | 'seguimiento'
  | 'cotizacion';

export type LeadActividad = {
  id: string;
  lead_id: string;
  empresa_id: string;
  tipo: LeadActividadTipo;
  detalle: Record<string, unknown>;
  registrado_por: string | null;
  created_at: string;
};

// Input para crear/editar manualmente desde UI
export type LeadInput = {
  nombre: string;
  whatsapp_phone?: string;
  email?: string;
  rut?: string;
  comuna?: string;
  fuente?: string;
  asignado_a?: string | null;
  estado?: LeadEstado;
  presupuesto_rango?: string;
  comentarios?: string;
  instagram?: string;
  region?: string;
  anuncio?: string;
  mensaje?: string;
  llamada_por?: string;
  cotizado_por?: string;
  visita_por?: string;
  /** Solo se guarda si la fila no tiene OT: con OT, el monto lo manda la OT. */
  monto?: number | null;
};

export const ESTADOS_ORDEN: LeadEstado[] = [
  'nuevo',
  'contactado',
  'visita_agendada',
  'visita_realizada',
  'cotizando',
  'cotizado',
  'negociacion',
  'en_espera',
  'ganado',
  'perdido_precio',
  'perdido_competencia',
  'perdido_otro',
];

export const ESTADOS_LABEL: Record<LeadEstado, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  visita_agendada: 'Visita agendada',
  visita_realizada: 'Visita realizada',
  cotizando: 'Cotizando',
  cotizado: 'Cotizado',
  negociacion: 'Negociación',
  en_espera: 'En espera',
  ganado: 'Ganado',
  perdido_precio: 'Perdido (precio)',
  perdido_competencia: 'Perdido (competencia)',
  perdido_otro: 'Perdido (otro)',
};

export const ESTADOS_TONO: Record<LeadEstado, 'neutral' | 'progress' | 'warn' | 'success' | 'danger'> = {
  nuevo: 'neutral',
  contactado: 'progress',
  visita_agendada: 'progress',
  visita_realizada: 'progress',
  cotizando: 'progress',
  cotizado: 'progress',
  negociacion: 'warn',
  en_espera: 'warn',
  ganado: 'success',
  perdido_precio: 'danger',
  perdido_competencia: 'danger',
  perdido_otro: 'danger',
};

export const ESTADO_ES_PERDIDO = (e: LeadEstado): boolean =>
  e === 'perdido_precio' || e === 'perdido_competencia' || e === 'perdido_otro';

export const ESTADO_ES_TERMINAL = (e: LeadEstado): boolean =>
  e === 'ganado' || ESTADO_ES_PERDIDO(e);

// Un lead viene del bot de WhatsApp si tiene whatsapp_wa_id o scoring.
// Esos campos solo los puebla la Edge Function del agente, nunca el form manual.
export const esLeadDeBot = (l: Pick<Lead, 'whatsapp_wa_id' | 'scoring'>): boolean =>
  !!l.whatsapp_wa_id || l.scoring != null;

// Opciones de presupuesto_rango (texto libre, pero ofrecemos un set sugerido
// alineado con cómo lo captura el agente IA en WhatsApp)
export const PRESUPUESTO_RANGOS: string[] = [
  'Menos de $300.000',
  '$300.000 - $700.000',
  '$700.000 - $1.500.000',
  '$1.500.000 - $3.000.000',
  'Más de $3.000.000',
  'No definido',
];
