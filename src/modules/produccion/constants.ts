import type { SubEtapaProd } from '@/modules/ots/types';
import type { AreaProduccion } from './types';

/**
 * Claves reservadas dentro de `produccion_checks`. Viven en la MISMA tabla que
 * las marcas normales —un hook, un canal de realtime, una política de RLS— y
 * se distinguen por el nombre: ninguna pieza real se llama así.
 */
export const CLAVE_AREA = '__area__';

/** Prefijos de los sentinels con grupo (bodega): `__inicio__|ARMADO`. */
export const CLAVE_INICIO = '__inicio__';
export const CLAVE_FIN = '__fin__';
export const CLAVE_RACK = '__rack__';

/**
 * Las áreas del taller y la sub-etapa que le corresponde a la OT cuando esa
 * área queda lista. Bodega no mueve la sub-etapa: prepara materiales, no
 * fabrica.
 */
export const AREAS_PRODUCCION: Array<{
  key: AreaProduccion;
  label: string;
  /** Sub-etapa a la que llega la OT al cerrar esta área. null = no la mueve. */
  subEtapa: SubEtapaProd | null;
}> = [
  { key: 'estructura', label: 'Estructura', subEtapa: 'Armado' },
  { key: 'panos', label: 'Corte de paños', subEtapa: 'Dimensionado' },
  { key: 'dimensionado', label: 'Dimensionado', subEtapa: 'Armado' },
  { key: 'armado', label: 'Armado', subEtapa: 'Prueba' },
  { key: 'prueba', label: 'Prueba', subEtapa: 'Lista' },
  { key: 'bodega', label: 'Inventario', subEtapa: null },
];

export const LABEL_AREA: Record<AreaProduccion, string> = AREAS_PRODUCCION.reduce(
  (acc, a) => ({ ...acc, [a.key]: a.label }),
  {} as Record<AreaProduccion, string>,
);
