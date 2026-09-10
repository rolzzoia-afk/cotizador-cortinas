// ─────────────────────────────────────────────────────────────────────
// Lo que la pantalla del Kardex tiene que decidir: qué fila se muestra, cómo
// se escribe cada cantidad y de dónde a dónde fue cada movimiento.
//
// Todo acá es cuenta pura sobre las filas que ya llegaron. El filtro por fecha,
// dominio y tipo lo hace la base (son 10 mil filas); lo de este archivo es lo
// que se decide con las filas en la mano: la búsqueda, el reparto por almacén,
// el texto de cada celda y el CSV.
// ─────────────────────────────────────────────────────────────────────

import { etiquetaAlmacen } from './almacenes';
import { codigoVisibleDe } from './codigosInsumo';

/** Una fila de `v_kardex_historico`, que junta el libro con lo anterior. */
export type FilaKardexVista = {
  id: string;
  fuente: string;
  /** `false` = viene del historial de tubos o paños: se ve, no se corrige. */
  editable: boolean;
  fecha: string;
  dominio: string;
  item_cod: string;
  item_nombre: string | null;
  tipo: string;
  cantidad: number | null;
  unidad: string | null;
  /** Cuando la cantidad no es un número: un paño mide «106×260». */
  cantidad_texto: string | null;
  origen: string | null;
  destino: string | null;
  saldo_post: number | null;
  ot: string | null;
  referencia: string | null;
  quien: string | null;
  notas: string | null;
  lote_id: string | null;
};

// ── Rango de fechas ───────────────────────────────────────────────────

export type Rango = 'hoy' | '7d' | '30d' | 'todo';

export const RANGOS: ReadonlyArray<{ id: Rango; texto: string }> = [
  { id: 'hoy', texto: 'Hoy' },
  { id: '7d', texto: 'Últimos 7 días' },
  { id: '30d', texto: 'Últimos 30 días' },
  { id: 'todo', texto: 'Todo' },
];

export function textoRango(r: Rango): string {
  return RANGOS.find((x) => x.id === r)?.texto ?? 'Todo';
}

/**
 * Desde qué instante pedir, en ISO. `null` = sin tope.
 *
 * «Hoy» empieza a la medianoche LOCAL, no a las 00:00 UTC: en Chile son tres
 * horas de diferencia y un despacho de las 22:00 aparecería como de mañana.
 */
export function desdeDelRango(r: Rango, ahora: Date = new Date()): string | null {
  if (r === 'todo') return null;
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  if (r === '7d') d.setDate(d.getDate() - 6);
  if (r === '30d') d.setDate(d.getDate() - 29);
  return d.toISOString();
}

// ── Cómo se escribe cada celda ────────────────────────────────────────

/**
 * La cantidad con su unidad: «4 un», «12,40 m», «248 cm».
 *
 * Los metros van con dos decimales porque la tela se corta así; las unidades,
 * enteras. Un paño trae su medida escrita («106×260») y se muestra tal cual.
 */
export function textoCantidad(f: Pick<FilaKardexVista, 'cantidad' | 'unidad' | 'cantidad_texto'>): string {
  if (f.cantidad_texto) return f.cantidad_texto;
  if (f.cantidad == null) return '—';
  const u = (f.unidad || '').toLowerCase();
  const decimales = u === 'm' || u === 'm2' ? 2 : 0;
  const n = Number(f.cantidad).toLocaleString('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  return f.unidad ? `${n} ${f.unidad}` : n;
}

export function textoSaldo(f: Pick<FilaKardexVista, 'saldo_post' | 'unidad'>): string {
  if (f.saldo_post == null) return '—';
  const u = (f.unidad || '').toLowerCase();
  const decimales = u === 'm' || u === 'm2' ? 2 : 0;
  return Number(f.saldo_post).toLocaleString('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * De dónde salió y a dónde fue, en palabras.
 *
 * Una salida no tiene almacén de destino: se fue a una OT, y eso es lo que se
 * muestra, porque «Liberado → —» no le dice nada a nadie.
 */
export function origenDestino(f: FilaKardexVista): { desde: string; hacia: string | null } {
  const desde = f.origen ? etiquetaAlmacen(f.origen) : null;
  let hacia = f.destino ? etiquetaAlmacen(f.destino) : null;
  if (!hacia && f.ot) hacia = `OT ${f.ot}`;
  // Un ajuste no viene ni va: pasa en un solo almacén.
  if (desde && !hacia) return { desde, hacia: null };
  return { desde: desde ?? '—', hacia };
}

// ── Filtros que se resuelven con las filas en la mano ─────────────────

export type FiltrosVista = {
  /** Los tres chips de arriba. Ninguno encendido = no se muestra nada. */
  insumos: boolean;
  telas: boolean;
  camionetas: boolean;
  busqueda: string;
  almacen: string;
  usuario: string;
};

export const FILTROS_VACIOS: FiltrosVista = {
  insumos: true,
  telas: true,
  camionetas: true,
  busqueda: '',
  almacen: '',
  usuario: '',
};

function tocaCamioneta(f: FilaKardexVista): boolean {
  return (f.origen || '').startsWith('CAM-') || (f.destino || '').startsWith('CAM-');
}

export function filtrarFilas(filas: FilaKardexVista[], f: FiltrosVista): FilaKardexVista[] {
  const q = f.busqueda.trim().toUpperCase();
  return filas.filter((x) => {
    // Camionetas es un chip aparte porque no es un dominio: es POR DÓNDE pasó.
    // Un traslado a la camioneta es de insumos y de camionetas a la vez.
    const esCam = tocaCamioneta(x);
    const permitido = esCam
      ? f.camionetas || (x.dominio === 'insumo' ? f.insumos : f.telas)
      : x.dominio === 'tela'
        ? f.telas
        : f.insumos;
    if (!permitido) return false;
    if (esCam && !f.camionetas && !f.insumos && !f.telas) return false;

    if (f.almacen && x.origen !== f.almacen && x.destino !== f.almacen) return false;
    if (f.usuario && (x.quien || '') !== f.usuario) return false;
    if (!q) return true;
    return (
      x.item_cod.toUpperCase().includes(q) ||
      (x.item_nombre || '').toUpperCase().includes(q) ||
      (x.ot || '').toUpperCase().includes(q) ||
      (x.referencia || '').toUpperCase().includes(q)
    );
  });
}

/** Los almacenes que aparecen de verdad en lo que se está mirando. */
export function almacenesPresentes(filas: FilaKardexVista[]): string[] {
  const s = new Set<string>();
  for (const f of filas) {
    if (f.origen) s.add(f.origen);
    if (f.destino) s.add(f.destino);
  }
  return [...s].sort();
}

/** Las personas que aparecen de verdad en lo que se está mirando. */
export function usuariosPresentes(filas: FilaKardexVista[]): string[] {
  const s = new Set<string>();
  for (const f of filas) if (f.quien) s.add(f.quien);
  return [...s].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Cuántos OTROS movimientos salieron en el mismo gesto.
 *
 * Es lo que deja ver que un despacho de nueve materiales fue UNA operación y no
 * nueve sueltas — que es justo lo que el kardex vino a arreglar.
 */
export function companerosDeLote(filas: FilaKardexVista[], fila: FilaKardexVista): number {
  if (!fila.lote_id) return 0;
  return filas.filter((f) => f.lote_id === fila.lote_id && f.id !== fila.id).length;
}

// ── Exportar ──────────────────────────────────────────────────────────

const COLUMNAS_CSV = [
  'Fecha',
  'Artículo',
  // El código visible va en su PROPIA columna y no reemplaza al anterior: el
  // «Artículo» es la llave con la que se vuelve a importar y con la que se
  // cruza contra cualquier otra planilla. Pisarla rompería eso.
  'Código visible',
  'Nombre',
  'Tipo',
  'Origen',
  'Destino',
  'Cantidad',
  'Unidad',
  'Saldo después',
  'OT',
  'Referencia',
  'Quién',
  'Origen del dato',
] as const;

function celda(v: unknown): string {
  const s = v == null ? '' : String(v);
  // Excel en es-CL separa con `;`, así que ese es el que hay que escapar.
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * El CSV que se baja. Separador `;` y BOM, que es lo que Excel en español
 * abre sin preguntar nada: con coma parte todo en una sola columna.
 */
export function csvDeKardex(
  filas: FilaKardexVista[],
  /** `MEC32 → BLANCO`. Sin mapa, la columna del visible sale igual a la llave. */
  colores?: Map<string, string> | null,
): string {
  const lineas = [COLUMNAS_CSV.join(';')];
  for (const f of filas) {
    lineas.push(
      [
        f.fecha,
        f.item_cod,
        f.dominio === 'insumo' ? codigoVisibleDe(f.item_cod, colores) : f.item_cod,
        f.item_nombre,
        f.tipo,
        f.origen ? etiquetaAlmacen(f.origen) : '',
        f.destino ? etiquetaAlmacen(f.destino) : '',
        f.cantidad_texto ?? f.cantidad ?? '',
        f.unidad,
        f.saldo_post ?? '',
        f.ot,
        f.referencia,
        f.quien,
        f.fuente,
      ]
        .map(celda)
        .join(';'),
    );
  }
  return `﻿${lineas.join('\r\n')}\r\n`;
}
