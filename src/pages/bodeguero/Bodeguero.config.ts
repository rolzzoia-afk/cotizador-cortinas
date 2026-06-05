// Constantes del módulo Bodeguero.

export const MOTIVOS_DEVOLUCION = [
  'Error de picking',
  'Material defectuoso',
  'No se usó',
  'Otro',
] as const;

export const AREAS_BODEGA = [
  'estructura',
  'dimensionado',
  'armado',
  'oficina',
  'panos',
  'pruebas',
  'general',
] as const;

export const AREA_LABEL: Record<(typeof AREAS_BODEGA)[number], string> = {
  estructura: 'Estructura',
  dimensionado: 'Dimensionado',
  armado: 'Armado',
  oficina: 'Oficina',
  panos: 'Paños',
  pruebas: 'Pruebas',
  general: 'General',
};

export const ESTADOS_BODEGUERO = ['produccion', 'lista', 'pendiente_firma'];

// Cooldowns del scanner QR (ms).
export const SCAN_COOLDOWN_OK = 1800;
export const SCAN_COOLDOWN_ERR = 1400;

export const MESES_A = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
];

// Clave de localStorage para recordar el nombre del bodeguero.
export const NOMBRE_KEY = 'rolzzo_bodeguero_nombre';
