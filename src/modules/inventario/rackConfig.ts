// Configuración física de los racks de insumos, extraída del Excel.
// Cada rack define sus columnas (letras) y filas (1..N).
// `almacen === 'LIBERADO'` es la bodega de cortes; 'MATERIAS_PRIMAS' es la cerrada.

export type RackDef = {
  nombre: string;
  filas: number;
  columnas: string[];
};

export const RACKS_LIBERADO: RackDef[] = [
  { nombre: 'RACK 1-A', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'RACK 2-B', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'RACK 3-C', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'MOVIL LIB-1 FRENTE', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'V'] },
  { nombre: 'MOVIL LIB-1 DETRAS', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U'] },
  { nombre: 'MOVIL LIB-2 FRENTE', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'V'] },
  { nombre: 'MOVIL LIB-2 DETRAS', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U'] },
  { nombre: 'PARED 1', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'PARED 2', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  {
    nombre: 'PARED 3',
    filas: 10,
    columnas: ['Q', 'R', 'S', 'T', 'U', 'V', 'Q2', 'R2', 'S2', 'V2'],
  },
  { nombre: 'RACK 10', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
];

export const RACKS_MATERIAS_PRIMAS: RackDef[] = [
  { nombre: 'DETRAS ENT. FRONTAL', filas: 10, columnas: ['Q', 'R', 'S', 'T'] },
  { nombre: 'PARTE ADELANTE', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'RACK 1', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'RACK 2', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'MOVIL 1', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'MOVIL 2', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'PARED FONDO', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'RACK 3', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'RACK 4', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'RACK 7-A', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
  { nombre: 'RACK 7-B', filas: 10, columnas: ['Q', 'R', 'S', 'T', 'U', 'V'] },
];

export type AlmacenRack = 'LIBERADO' | 'MATERIAS_PRIMAS';

export function getRacks(almacen: AlmacenRack): RackDef[] {
  return almacen === 'LIBERADO' ? RACKS_LIBERADO : RACKS_MATERIAS_PRIMAS;
}
