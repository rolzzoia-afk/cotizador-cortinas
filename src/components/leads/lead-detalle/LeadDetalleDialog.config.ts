// Sub-motivos sugeridos para cada estado "perdido" del lead.

export const MOTIVOS_PERDIDA: Record<string, string[]> = {
  perdido_precio: ['Muy caro vs presupuesto', 'No quería pagar IVA', 'Pidió descuento que no podía dar'],
  perdido_competencia: ['Eligió otra empresa', 'Ya tenía proveedor', 'Compró en retail (Falabella, Sodimac)'],
  perdido_otro: ['No respondió más', 'Cancelado por cliente', 'Datos inválidos', 'Otro motivo'],
};
