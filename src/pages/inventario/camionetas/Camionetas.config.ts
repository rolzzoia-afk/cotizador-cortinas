// Labels y colores de los tipos de movimiento de camioneta.

import type { Movimiento } from './Camionetas.types';

export const TIPO_LABEL: Record<Movimiento['tipo'], string> = {
  carga: 'Carga',
  uso: 'Uso en obra',
  swap_salida: 'Swap — salida',
  swap_entrada: 'Swap — entrada',
  devolucion: 'Devolución',
  defectuoso: 'Defectuoso',
};

export const TIPO_BADGE: Record<
  Movimiento['tipo'],
  'info' | 'success' | 'warning' | 'secondary' | 'destructive'
> = {
  carga: 'info',
  uso: 'success',
  swap_salida: 'warning',
  swap_entrada: 'warning',
  devolucion: 'secondary',
  defectuoso: 'destructive',
};
