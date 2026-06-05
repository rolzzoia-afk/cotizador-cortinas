// Motivos de error de corte y su mapeo de colores.

export const MOTIVOS = [
  'Error de corte (operario)',
  'Falla en el tubo',
  'Error del vendedor',
  'Error del instalador',
  'Medida incorrecta en plano',
  'Material defectuoso',
  'Otro',
];

export const MOTIVO_COLOR: Record<string, string> = {
  'Error de corte (operario)': '#ef4444',
  'Falla en el tubo': '#f97316',
  'Error del vendedor': '#f59e0b',
  'Error del instalador': '#3b82f6',
  'Medida incorrecta en plano': '#8b5cf6',
  'Material defectuoso': '#22c55e',
  Otro: '#a1a1aa',
};
