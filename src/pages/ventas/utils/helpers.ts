// Helpers puros del Panel KPI Ventas.

import type { Periodo } from '../Ventas.types';

/** Fecha local en formato ISO (yyyy-mm-dd). No usa toISOString() porque en
 *  Chile (UTC-3/-4) después de las ~20:00 devolvería el día siguiente. */
export function fechaISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function hoyISO(): string {
  return fechaISO(new Date());
}

export type RangoPeriodo = {
  /** Primer día del rango (inclusivo), yyyy-mm-dd. */
  desde: string;
  /** Último día del rango (inclusivo) = la fecha seleccionada. */
  hasta: string;
  /** Cantidad de días del rango (>= 1). Se usa para escalar metas diarias. */
  dias: number;
};

/** Rango de fechas que alimenta las tarjetas según el botón Hoy/Semana/Mes.
 *  - 'dia': solo la fecha seleccionada.
 *  - 'semana': desde el LUNES de esa semana hasta la fecha seleccionada.
 *  - 'mes': desde el 1° del mes hasta la fecha seleccionada.
 *  Nunca incluye días futuros: el rango se corta en la fecha activa. */
export function rangoPeriodo(fechaISOStr: string, periodo: Periodo): RangoPeriodo {
  if (periodo === 'dia') return { desde: fechaISOStr, hasta: fechaISOStr, dias: 1 };

  // Mediodía para que los cambios de horario de verano no corran el día.
  const ref = new Date(fechaISOStr + 'T12:00:00');
  const inicio = new Date(ref);

  if (periodo === 'semana') {
    // getDay(): 0 = domingo … 6 = sábado. La semana empieza el lunes.
    const diaSemana = ref.getDay();
    const retroceso = diaSemana === 0 ? 6 : diaSemana - 1;
    inicio.setDate(inicio.getDate() - retroceso);
  } else {
    inicio.setDate(1);
  }

  const desde = fechaISO(inicio);
  const dias = Math.round((ref.getTime() - inicio.getTime()) / 86_400_000) + 1;
  return { desde, hasta: fechaISOStr, dias };
}

/** Días del rango en orden cronológico (para el gráfico de evolución). */
export function diasDelRango(rango: RangoPeriodo): string[] {
  const fechas: string[] = [];
  const d = new Date(rango.desde + 'T12:00:00');
  for (let i = 0; i < rango.dias; i++) {
    fechas.push(fechaISO(d));
    d.setDate(d.getDate() + 1);
  }
  return fechas;
}

/** Suma los valores por clave. Todas las métricas del panel son conteos
 *  aditivos, así que el total del período es la suma de los días. */
export function sumarRegistros(
  rows: { clave: string; valor: number | string | null }[],
): Record<string, number> {
  const map: Record<string, number> = {};
  rows.forEach((r) => {
    map[r.clave] = (map[r.clave] || 0) + (Number(r.valor) || 0);
  });
  return map;
}

export function slugify(str: string): string {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export type PuntoHistorial = {
  label: string;
  Mensajes: number;
  Llamadas: number;
  Cierres: number;
};

/** Serie día a día del rango para el gráfico de evolución. Los días sin
 *  registros aparecen igual, en cero, para que la línea no se corte. */
export function construirHistorial(
  filas: { fecha: string; clave: string; valor: number }[],
  rango: RangoPeriodo,
  canales: string[],
  vendedoras: string[],
): PuntoHistorial[] {
  const porFecha: Record<string, Record<string, number>> = {};
  filas.forEach((r) => {
    (porFecha[r.fecha] ||= {})[r.clave] = Number(r.valor) || 0;
  });
  return diasDelRango(rango).map((f) => {
    const dia = porFecha[f] || {};
    return {
      label: new Date(f + 'T12:00:00').toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'short',
      }),
      Mensajes: canales.reduce((s, c) => s + (dia['canal_' + slugify(c)] || 0), 0),
      Llamadas: vendedoras.reduce((s, v) => s + (dia['ll_llamadas_' + slugify(v)] || 0), 0),
      Cierres: dia['cierre_cerradas'] || 0,
    };
  });
}

/** Textos de las secciones según el período activo (es-CL neutro). */
export function textoPeriodo(periodo: Periodo): {
  /** "hoy" / "en la semana" / "en el mes" */
  sufijo: string;
  /** "del día" / "de la semana" / "del mes" */
  delLapso: string;
  /** "diarias" / "semanales" / "mensuales" */
  adjetivo: string;
  /** "DIARIO" / "SEMANA" / "MES" */
  chip: string;
} {
  if (periodo === 'semana')
    return { sufijo: 'en la semana', delLapso: 'de la semana', adjetivo: 'semanales', chip: 'SEMANA' };
  if (periodo === 'mes')
    return { sufijo: 'en el mes', delLapso: 'del mes', adjetivo: 'mensuales', chip: 'MES' };
  return { sufijo: 'hoy', delLapso: 'del día', adjetivo: 'diarias', chip: 'DIARIO' };
}

export function iniciales(nombre: string): string {
  return (nombre || '?')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function colorPct(pct: number, meta: number): string {
  if (pct >= meta) return '#22c55e';
  if (pct >= meta * 0.7) return '#f59e0b';
  return '#ef4444';
}
