// Tipos privados de la pantalla Clientes (LeadsPipeline).

export type Vista = 'planilla' | 'tabla' | 'kanban' | 'metricas' | 'seguimientos' | 'coaching';

/** De dónde salió la fila: una OT (cotización), a mano o el bot. */
export type FiltroOrigen = 'todos' | 'ot' | 'manual' | 'bot';
