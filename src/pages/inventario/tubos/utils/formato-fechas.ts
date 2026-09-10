// Helpers de formateo de fechas en es-CL para Historial de Tubos.

export function formatFechaHora(d: string | null): string {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMes(d: string): string {
  const x = new Date(d);
  return x.toLocaleDateString('es-CL', { month: '2-digit', year: 'numeric' });
}
