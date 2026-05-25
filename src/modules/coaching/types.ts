import type { LeadEstado } from '@/modules/leads/types';

// ─────────────────────────────────────────────────────────────────────
// Coaching: manual de objeciones + tips de venta
// Editable por admin desde la app; las vendedoras solo leen.
// ─────────────────────────────────────────────────────────────────────

export type ObjecionCategoria =
  | 'precio'
  | 'indecision'
  | 'competencia'
  | 'urgencia'
  | 'confianza'
  | 'cierre';

export const CATEGORIA_ORDEN: ObjecionCategoria[] = [
  'precio',
  'indecision',
  'competencia',
  'urgencia',
  'confianza',
  'cierre',
];

export const CATEGORIA_LABEL: Record<ObjecionCategoria, string> = {
  precio: 'Precio',
  indecision: 'Indecisión',
  competencia: 'Competencia',
  urgencia: 'Urgencia / sin apuro',
  confianza: 'Confianza',
  cierre: 'Cierre',
};

// Descripción corta de cada categoría (para encabezados / ayuda)
export const CATEGORIA_DESC: Record<ObjecionCategoria, string> = {
  precio: 'Cuando el precio frena la decisión',
  indecision: 'Cuando dice que lo va a pensar o consultar',
  competencia: 'Cuando compara con otra empresa',
  urgencia: 'Cuando no tiene apuro por avanzar',
  confianza: 'Cuando duda de la calidad o de la empresa',
  cierre: 'Para ayudar a que tome la decisión',
};

export type CoachingObjecion = {
  id: string;
  empresa_id: string;
  categoria: string; // ObjecionCategoria, pero el admin podría crear otras
  objecion: string;
  respuesta: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CoachingTip = {
  id: string;
  empresa_id: string;
  titulo: string;
  contenido: string;
  fuente: string | null;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

// Input para crear/editar (sin campos que pone la BD)
export type ObjecionInput = {
  categoria: string;
  objecion: string;
  respuesta: string;
  orden?: number;
};

export type TipInput = {
  titulo: string;
  contenido: string;
  fuente?: string | null;
  orden?: number;
};

// ─────────────────────────────────────────────────────────────────────
// Mapeo: según el estado del lead, qué categorías de objeción son útiles.
// Esto alimenta el "consejo contextual" que aparece dentro de cada lead.
// ─────────────────────────────────────────────────────────────────────
export const CATEGORIAS_POR_ESTADO: Record<LeadEstado, ObjecionCategoria[]> = {
  nuevo: ['confianza'],
  contactado: ['confianza', 'urgencia'],
  visita_agendada: ['confianza'],
  visita_realizada: ['cierre', 'confianza'],
  cotizando: ['precio'],
  cotizado: ['precio', 'indecision'],
  negociacion: ['precio', 'competencia', 'cierre'],
  en_espera: ['indecision', 'urgencia'],
  ganado: [],
  perdido_precio: ['precio'],
  perdido_competencia: ['competencia'],
  perdido_otro: [],
};

export function categoriasParaEstado(estado: LeadEstado): ObjecionCategoria[] {
  return CATEGORIAS_POR_ESTADO[estado] ?? [];
}

// Etiqueta legible de la categoría aunque venga un valor desconocido
export function labelCategoria(cat: string): string {
  return (CATEGORIA_LABEL as Record<string, string>)[cat] ?? cat;
}
