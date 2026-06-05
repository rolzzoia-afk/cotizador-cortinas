// Helpers de formato de fecha del Historial de Corte.

export function fmtFechaHora(f: string | null): string {
  if (!f) return 'Fecha desconocida';
  return new Date(f).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtFecha(f: string | null): string {
  if (!f) return '-';
  return new Date(f).toLocaleDateString('es-CL');
}
