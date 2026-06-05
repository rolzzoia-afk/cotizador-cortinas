// Helpers puros del Panel KPI Ventas.

export function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function slugify(str: string): string {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function iniciales(nombre: string): string {
  return (nombre || '?')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function colorPct(pct: number, meta: number): string {
  if (pct >= meta) return '#22c55e';
  if (pct >= meta * 0.7) return '#f59e0b';
  return '#ef4444';
}
