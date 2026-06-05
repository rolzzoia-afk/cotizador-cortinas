// Devuelve un texto humano del tipo "hace 3h", "hace 2d" o una fecha
// formateada en es-CL si pasó más de una semana.

export function fechaRelativa(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `hace ${dias}d`;
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}
