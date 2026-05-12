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

export type Lead = {
  id: string;
  empresa_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  rut: string | null;
  canal: string | null;
  ubicacion: string | null;
  vendedora_id: string | null;
  estado: LeadEstado;
  motivo_perdida: string | null;
  valor_estimado: number | null;
  comentarios: string | null;
  ot_id: string | null;
  ultima_actividad_at: string;
  created_at: string;
  updated_at: string;
};

export type LeadActividadTipo =
  | 'creado'
  | 'cambio_estado'
  | 'comentario'
  | 'asignacion'
  | 'conversion_ot'
  | 'edicion';

export type LeadActividad = {
  id: string;
  lead_id: string;
  empresa_id: string;
  tipo: LeadActividadTipo;
  detalle: Record<string, unknown>;
  registrado_por: string | null;
  created_at: string;
};

export type LeadInput = {
  nombre: string;
  telefono?: string;
  email?: string;
  rut?: string;
  canal?: string;
  ubicacion?: string;
  vendedora_id?: string | null;
  estado?: LeadEstado;
  valor_estimado?: number | null;
  comentarios?: string;
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

// Mapa visual de estado → semántica (color HSL via Tailwind tokens del theme)
// neutral: nuevo flows | progress: en curso | success: ganado | danger: perdido
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
