// Regiones de Chile (16) para el desplegable de "Región" en Fase 0, y helpers
// para vincular comuna → región. La instalación gratis por 4+ cortinas aplica
// sólo en la Región Metropolitana; el resto son "región" (instalación con % editable).
import { COMUNAS_SANTIAGO } from './comunas';

export const REGION_METROPOLITANA = 'Región Metropolitana de Santiago';

// Orden geográfico norte → sur (nombres de uso común).
export const REGIONES_CHILE = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  REGION_METROPOLITANA,
  "Libertador General Bernardo O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén del General Carlos Ibáñez del Campo',
  'Magallanes y de la Antártica Chilena',
] as const;

/** ¿El texto corresponde a la Región Metropolitana? (tolerante a variantes). */
export const esRegionMetropolitana = (r: string | null | undefined): boolean =>
  (r || '').toLowerCase().includes('metropolitana');

const SET_RM = new Set(COMUNAS_SANTIAGO.map((c) => c.trim().toLowerCase()));
/** ¿La comuna pertenece a la Región Metropolitana? */
export const esComunaRM = (comuna: string | null | undefined): boolean =>
  SET_RM.has((comuna || '').trim().toLowerCase());
