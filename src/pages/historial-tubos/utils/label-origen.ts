// Convierte (evento, fuente) en un label legible que describe el origen de
// un tubo en su ficha. Usado únicamente por FichaCard.

export function labelOrigen(evento: string, fuente: string | null): string {
  if (evento === 'ingreso') {
    if (fuente === 'carga_inicial') return 'Ingreso por carga inicial';
    if (fuente === 'optimizador_nuevo') return 'Tubo nuevo registrado en el optimizador';
    if (fuente === 'excel') return 'Ingreso desde Excel';
    if (fuente === 'manual') return 'Ingreso manual';
    if (fuente === 'consolidacion_peso' || fuente === 'consolidacion_peso_retroactivo')
      return 'Peso consolidado en su slot';
    return `Ingreso (${fuente ?? 'sin fuente'})`;
  }
  if (evento === 'sobrante') return 'Sobrante de un corte';
  if (evento === 'sobrante_error') return 'Sobrante por error de corte';
  if (evento === 'merma') return 'Merma';
  if (evento === 'restauracion') return 'Restauración (admin)';
  if (evento === 'ajuste') return 'Ajuste (admin)';
  return evento;
}
