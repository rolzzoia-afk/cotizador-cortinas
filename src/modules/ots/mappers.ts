import type { DatosGenerales, OT, OTEstado, OTRow, SubEtapaProd } from './types';

// Idéntico a rowToOT() de legacy (líneas 60-74).
export function rowToOT(row: OTRow): OT {
  const dg = (row.datos_generales || {}) as DatosGenerales;
  return {
    id: row.id,
    estado: (row.estado || 'cotizacion') as OTEstado,
    subEtapa: (dg.subEtapa as SubEtapaProd | null) ?? null,
    datosGenerales: dg,
    storeVentanas: row.items || [],
    cotizacionCount: dg.cotizacionCount || 0,
    fechaCreacion: row.fecha_creacion,
    fechaModificacion: row.fecha_modificacion,
    notas: dg.notas || '',
    totalConIva: row.total || 0,
  };
}

// Idéntico a otToRow() de legacy (líneas 76-93).
export function otToRow(ot: OT, empresaId: string): OTRow {
  const dg: DatosGenerales = { ...(ot.datosGenerales || {}) };
  dg.subEtapa = ot.subEtapa ?? null;
  dg.notas = ot.notas || '';
  dg.cotizacionCount = ot.cotizacionCount || 0;
  return {
    id: ot.id,
    empresa_id: empresaId,
    numero_ot: dg.ot || 'OT',
    estado: ot.estado || 'cotizacion',
    datos_generales: dg,
    items: ot.storeVentanas || [],
    total: ot.totalConIva || 0,
    fecha_modificacion: ot.fechaModificacion || new Date().toISOString(),
    fecha_creacion: ot.fechaCreacion || new Date().toISOString(),
    fecha_entrega: dg.fechaEntrega || null,
  };
}
