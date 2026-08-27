// ─────────────────────────────────────────────────────────────────────
// El picking de bodega: los insumos de una OT repartidos como los prepara el
// bodeguero, en tres columnas por ÁREA de destino.
//
// Los insumos y sus cantidades son EXACTAMENTE los de la hoja de inventario
// que hoy se imprime (`construirInventario`): acá no se recalcula nada, solo
// se reordena para preparar bolsas.
//
// El grupo del PDF y la columna de la pantalla no son lo mismo: en el papel
// «INSUMOS» (tapas, topes, tornillos, zunchos) va en su propia tabla, pero el
// bodeguero los mete en la MISMA bolsa que lo de producción, porque todo eso
// se usa montando la cortina sobre la tela.
//
// Esta pantalla es PREPARACIÓN, no despacho: no descuenta stock ni pide firma.
// Eso sigue siendo el flujo del Bodeguero.
// ─────────────────────────────────────────────────────────────────────

import type { GrupoInsumo, InsumoConsolidado } from '@/modules/cotizador/inventarioOT';
import { CLAVE_FIN, CLAVE_INICIO, CLAVE_RACK } from './constants';

export type ColumnaBodega = 'ARMADO' | 'ESTRUCTURA' | 'INSTALACION';

export const COLUMNAS_BODEGA: Array<{ key: ColumnaBodega; label: string; ayuda: string }> = [
  { key: 'ARMADO', label: 'Armado', ayuda: 'Lo que se monta sobre la tela' },
  { key: 'ESTRUCTURA', label: 'Estructura', ayuda: 'Ferretería del sistema' },
  { key: 'INSTALACION', label: 'Instalación', ayuda: 'Lo que se lleva a terreno' },
];

/** La tabla del PDF a la que va cada insumo → la columna de la bolsa. */
export function columnaDeGrupo(grupo: GrupoInsumo): ColumnaBodega {
  if (grupo === 'ESTRUCTURA') return 'ESTRUCTURA';
  if (grupo === 'INSTALACION') return 'INSTALACION';
  // PRODUCCION e INSUMOS comparten bolsa.
  return 'ARMADO';
}

export type SeccionBodega = 'Mecanismo' | 'Cadenas' | 'Motor' | 'Insumos';

const ORDEN_SECCIONES: SeccionBodega[] = ['Mecanismo', 'Cadenas', 'Motor', 'Insumos'];

/**
 * Sub-sección dentro de la columna, por el prefijo del código. Es la misma
 * separación que el bodeguero hace con las manos: los kits por un lado, las
 * cadenas por otro, el motor aparte y la ferretería suelta al final.
 */
export function seccionDeInsumo(codigo?: string): SeccionBodega {
  const c = (codigo || '').toUpperCase().replace(/\s+/g, '');
  if (c.startsWith('MEC')) return 'Mecanismo';
  if (c.startsWith('CAD')) return 'Cadenas';
  if (c.startsWith('DOM')) return 'Motor';
  return 'Insumos';
}

/**
 * Clave de la marca. Va con la columna adelante porque el mismo código puede
 * ir en dos bolsas distintas (un tornillo de armado y otro de instalación) y
 * marcar uno no puede dar el otro por preparado.
 */
export function claveCheckBodega(
  columna: ColumnaBodega,
  insumo: { codigo?: string; descripcion: string },
): string {
  return `${columna}|${(insumo.codigo || insumo.descripcion || '').trim()}`;
}

export type SeccionConItems = { seccion: SeccionBodega; items: InsumoConsolidado[] };
export type ColumnaConItems = {
  columna: ColumnaBodega;
  label: string;
  ayuda: string;
  secciones: SeccionConItems[];
  /** Cuántos insumos hay que juntar en esta bolsa. */
  total: number;
};

/** Reparte los insumos de la OT en las tres columnas, con sus sub-secciones. */
export function agruparParaBodega(insumos: InsumoConsolidado[]): ColumnaConItems[] {
  return COLUMNAS_BODEGA.map(({ key, label, ayuda }) => {
    const propios = insumos.filter((i) => columnaDeGrupo(i.grupo) === key);
    const secciones: SeccionConItems[] = ORDEN_SECCIONES.map((seccion) => ({
      seccion,
      items: propios.filter((i) => seccionDeInsumo(i.codigo) === seccion),
    })).filter((s) => s.items.length > 0);
    return { columna: key, label, ayuda, secciones, total: propios.length };
  });
}

export type EstadoColumna = 'EMPEZAR' | 'EN PROCESO' | 'COMPLETADO';

export function estadoColumna(total: number, hechos: number): EstadoColumna {
  if (total > 0 && hechos >= total) return 'COMPLETADO';
  return hechos > 0 ? 'EN PROCESO' : 'EMPEZAR';
}

// ── Sentinels de la columna (viven en la misma tabla de marcas) ──────

export const claveInicio = (c: ColumnaBodega) => `${CLAVE_INICIO}|${c}`;
export const claveFin = (c: ColumnaBodega) => `${CLAVE_FIN}|${c}`;
export const claveRack = (c: ColumnaBodega) => `${CLAVE_RACK}|${c}`;

/**
 * Minutos entre el primer OK y el «Finalizar». Sin fin, cuenta hasta `ahora`
 * —el bodeguero quiere ver el reloj corriendo—. Se redondea hacia arriba: una
 * bolsa que tomó 40 segundos no se prepara en «0 min».
 */
export function duracionMin(
  inicio: string | undefined,
  fin: string | undefined,
  ahora: number,
): number | null {
  if (!inicio) return null;
  const t0 = Date.parse(inicio);
  if (Number.isNaN(t0)) return null;
  const t1 = fin ? Date.parse(fin) : ahora;
  if (Number.isNaN(t1) || t1 < t0) return null;
  return Math.max(1, Math.ceil((t1 - t0) / 60000));
}

/** Contenido del QR de la etiqueta de la bolsa. ASCII, como el resto de bodega. */
export function qrBolsa(ot: string, columna: ColumnaBodega): string {
  const ascii = (s: string) =>
    String(s ?? '')
      .trim()
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\s+/g, '');
  return `BOLSA:${ascii(ot)}|${ascii(columna)}`;
}
