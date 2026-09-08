// Helper de formato de fecha del módulo Telas.

export function fmtFechaHora(f: string | null): string {
  if (!f) return '—';
  return new Date(f).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
