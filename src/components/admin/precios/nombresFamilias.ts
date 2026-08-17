// Nombre legible de cada receta, para no obligar a leer DUOPOLI_S en pantalla.
// Lo comparten la lista de materiales y la de precios de insumo.
import {
  RECETA_DUO_GENERICO_KEY,
  RECETA_VERTICAL_KEY,
} from '@/modules/cotizador/reglasPrecios';

export const NOMBRE_FAMILIA: Record<string, string> = {
  BLACKOUT_P: 'Blackout premium',
  BLACKOUT_D: 'Blackout delux',
  BLACKOUT_S: 'Blackout standard',
  SCREEN_P: 'Screen premium',
  SCREEN_D: 'Screen delux',
  SCREEN_S: 'Screen standard',
  DUOBK_P: 'Dúo blackout premium',
  DUOBK_D: 'Dúo blackout delux',
  DUOBK_S: 'Dúo blackout standard',
  DUOPOLI_P: 'Dúo poliéster premium',
  DUOPOLI_D: 'Dúo poliéster delux',
  DUOPOLI_S: 'Dúo poliéster standard',
  BEE_BK: 'Beeblack blackout',
  BEE_MOSQ: 'Beeblack mosquitero',
  BEE_TRAS: 'Beeblack traslúcida',
  [RECETA_VERTICAL_KEY]: 'Cortinas verticales',
  [RECETA_DUO_GENERICO_KEY]: 'Dúo sin receta propia (respaldo)',
};

/** El nombre legible, o la clave tal cual si es una familia agregada a mano. */
export const nombreFamilia = (clave: string): string => NOMBRE_FAMILIA[clave] ?? clave;
