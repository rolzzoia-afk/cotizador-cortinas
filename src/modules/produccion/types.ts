// Tipos del módulo Producción (el taller en pantalla).

export type AreaProduccion =
  | 'estructura'
  | 'panos'
  | 'dimensionado'
  | 'armado'
  | 'prueba'
  | 'bodega';

/** Una marca del taller. Una fila por cosa hecha, nunca un blob por OT. */
export type CheckProduccion = {
  id: string;
  empresa_id: string;
  ot: string;
  area: AreaProduccion;
  /** Contexto de la clave (en Estructura, el plan_id). '' si no aplica. */
  ref: string;
  clave: string;
  hecho: boolean;
  nota: string | null;
  hecho_por: string | null;
  hecho_por_id: string | null;
  hecho_en: string;
};

/** El botón de emergencia: deja un recado para el encargado de producción. */
export type AvisoProduccion = {
  id: string;
  empresa_id: string;
  ot: string;
  area: AreaProduccion | 'general';
  mensaje: string;
  creado_por: string | null;
  creado_por_id: string | null;
  creado_en: string;
  atendido: boolean;
  atendido_por: string | null;
  atendido_en: string | null;
};
