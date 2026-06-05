// Constantes compartidas por el Panel de Inteligencia.

export const ESTADOS_ACTIVOS = [
  'cotizacion',
  'medicion',
  'aprobado',
  'produccion',
  'listo',
  'instalacion',
];

export const ESTADOS_PRODUCCION = ['aprobado', 'produccion', 'listo', 'instalacion'];

export const COLORES_ERROR: Record<string, string> = {
  'Error de corte (operario)': '#ef4444',
  'Falla en el tubo': '#f97316',
  'Error del vendedor': '#f59e0b',
  'Error del instalador': '#3b82f6',
  'Medida incorrecta en plano': '#8b5cf6',
  'Material defectuoso': '#22c55e',
  Otro: '#a1a1aa',
};

// Sugerencias rápidas para el diálogo de diagnóstico IA.
export const CHIPS = [
  { emoji: '🎯', label: '¿Qué hacer hoy?', q: '¿Qué OTs están en riesgo y qué debería hacer hoy?' },
  { emoji: '🛒', label: '¿Qué comprar?', q: '¿Qué insumos tengo que comprar esta semana y cuánto?' },
  {
    emoji: '🔍',
    label: 'Revisa mis datos',
    q: '¿Hay algún problema o inconsistencia en mis datos que debería corregir?',
  },
  {
    emoji: '💡',
    label: 'Ideas de mejora',
    q: '¿Qué mejoras le harías a mi sistema de gestión basándote en estos datos?',
  },
  {
    emoji: '📦',
    label: 'Optimizar stock',
    q: '¿Cuáles son los insumos más críticos para la producción actual y cómo optimizo el stock?',
  },
  {
    emoji: '📊',
    label: 'Analizar patrones',
    q: '¿Qué patrones ves en mis movimientos de inventario que debería atender?',
  },
];
