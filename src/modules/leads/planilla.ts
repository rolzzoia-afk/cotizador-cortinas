// ──────────────────────────────────────────────────────────────────────────
// PLANILLA DE SEGUIMIENTO — el Excel del equipo comercial, fila por fila.
//
// Una fila por cliente/cotización (`leads`). Cada OT con cliente crea la suya
// sola (trigger en la base), así que la planilla parte llena con los datos
// reales. Acá se arma lo que se muestra y lo que se exporta, con las mismas
// columnas y los mismos nombres del Excel.
//
// Módulo puro (sin React ni Supabase).
// ──────────────────────────────────────────────────────────────────────────
import { esCanalReal } from '@/modules/canales/canales';
import { esComunaRM } from '@/modules/cotizador/regiones-chile';
import { infoSeguimiento, MEDIO_EXCEL, MEDIO_LABEL } from './cadencia';
import {
  ESTADO_COTIZACION_EXCEL,
  ESTADO_COTIZACION_LABEL,
  textoEstadoCotizacion,
} from './cotizacionEstado';
import { TIPO_ACTIVIDAD_LABEL } from './historial';
import {
  ESTADOS_LABEL,
  PRIORIDAD_LABEL,
  SEG_RESULTADO_LABEL,
  type EstadoCotizacion,
  type Lead,
  type LeadActividadTipo,
  type LeadEstado,
  type LeadSeguimiento,
} from './types';

// ─── Ticket ────────────────────────────────────────────────────────────────

export type Ticket = 'bajo' | 'medio' | 'alto';

/** Cortes del Excel: bajo hasta $499.999 · medio hasta $999.999 · alto desde $1.000.000. */
export const TICKET_BAJO_MAX = 499_999;
export const TICKET_MEDIO_MAX = 999_999;

export const TICKET_LABEL: Record<Ticket, string> = {
  bajo: 'Ticket bajo',
  medio: 'Ticket medio',
  alto: 'Ticket alto',
};

export const TICKET_EXCEL: Record<Ticket, string> = {
  bajo: 'TICKET BAJO <=$499.999',
  medio: 'TICKET MEDIO $500.000 - $999.999',
  alto: 'TICKET ALTO >=$1.000.000',
};

export function ticketDeMonto(monto: number | null | undefined): Ticket | null {
  if (monto === null || monto === undefined || !Number.isFinite(monto) || monto <= 0) return null;
  if (monto <= TICKET_BAJO_MAX) return 'bajo';
  if (monto <= TICKET_MEDIO_MAX) return 'medio';
  return 'alto';
}

// ─── Fechas como las escribe el Excel ─────────────────────────────────────

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

export const nombreMes = (d: Date): string => MESES[d.getMonth()];
export const nombreDia = (d: Date): string => DIAS[d.getDay()];

/** Semana del mes, de lunes a domingo: la que contiene el día 1 es la 1. */
export function semanaDelMes(d: Date): number {
  const primero = new Date(d.getFullYear(), d.getMonth(), 1);
  const desfase = (primero.getDay() + 6) % 7; // lunes = 0
  return Math.floor((d.getDate() - 1 + desfase) / 7) + 1;
}

const dos = (n: number) => String(n).padStart(2, '0');
export const fechaCorta = (d: Date): string => `${dos(d.getDate())}-${dos(d.getMonth() + 1)}-${d.getFullYear()}`;
/** Clave para agrupar por mes: «2026-09». */
export const claveMes = (d: Date): string => `${d.getFullYear()}-${dos(d.getMonth() + 1)}`;

// ─── N° de cotización ─────────────────────────────────────────────────────

/**
 * «N° COTAP - #3194-G1 - VERTICALES» → «COTAP - #3194-G1». El texto completo
 * (con la descripción) queda para el `title`.
 */
export function numeroCotizacionCorto(texto: string | null | undefined): string {
  const limpio = (texto ?? '').replace(/^\s*N[°º]\s*/i, '').trim();
  if (!limpio) return '';
  const partes = limpio.split(/\s+-\s+/);
  return partes.length >= 3 ? `${partes[0]} - ${partes[1]}` : limpio;
}

// ─── Fila ─────────────────────────────────────────────────────────────────

export type CeldaSeguimiento = {
  fecha: string;
  medio: string;
  medioExcel: string;
  respuesta: string;
};

export type FilaPlanilla = {
  id: string;
  otId: string | null;
  fechaIso: string;
  mes: string;
  claveMes: string;
  semana: number;
  fecha: string;
  dia: string;
  nombre: string;
  telefono: string;
  instagram: string;
  mail: string;
  comuna: string;
  region: string;
  canal: string;
  anuncio: string;
  mensaje: string;
  infoAdicional: string;
  estadoCotizacion: EstadoCotizacion;
  estadoCotizacionTexto: string;
  numeroCotizacion: string;
  numeroCotizacionCompleto: string;
  monto: number | null;
  ticket: Ticket | null;
  cotizacionFinal: number | null;
  cantProcesos: number;
  llamada: string;
  cotiza: string;
  visita: string;
  vendedor: string;
  estado: LeadEstado;
  estadoTexto: string;
  potencial: string;
  estadoProceso: string;
  atrasado: boolean;
  /** Qué explica el signo rojo junto al nombre: «Seguimiento 1 atrasado 1 día · tocaba el 15-09-2026». */
  avisoAtraso: string;
  respuesta: string;
  seguimientos: (CeldaSeguimiento | null)[];
  seguimientosExtra: number;
  ultimoCambio: string;
  ultimoCambioQuien: string;
  ultimoCambioFecha: string;
  porActualizar: boolean;
  archivado: boolean;
};

export type ContextoFila = {
  seguimientos: LeadSeguimiento[];
  nombres: Map<string, string>;
  hoy?: Date;
};

function estadoProceso(lead: Lead, hoy: Date): { texto: string; atrasado: boolean; aviso: string } {
  const sinAviso = (texto: string) => ({ texto, atrasado: false, aviso: '' });
  if (lead.archivado) return sinAviso('Archivado sin respuesta');
  if (lead.estado === 'ganado') return sinAviso('Cerrado · ganado');
  if (lead.estado.startsWith('perdido')) return sinAviso('Cerrado · perdido');
  const info = infoSeguimiento(lead, hoy);
  if (info) {
    const dias = Math.abs(info.diasDiff);
    const cuando =
      info.urgencia === 'atrasado'
        ? ` · atrasado ${dias} d`
        : info.urgencia === 'hoy'
          ? ' · hoy'
          : ` · en ${info.diasDiff} d`;
    const atrasado = info.urgencia === 'atrasado';
    return {
      texto: `Seguimiento ${info.etapa} pendiente${cuando}`,
      atrasado,
      aviso: atrasado
        ? `Seguimiento ${info.etapa} atrasado ${dias} ${dias === 1 ? 'día' : 'días'} · tocaba el ${fechaCorta(info.due)}`
        : '',
    };
  }
  if (lead.etapa_seguimiento === 4) return sinAviso('Ciclo cerrado · respondió');
  return sinAviso('');
}

const s = (v: string | null | undefined) => (v ?? '').trim();

export function filaPlanilla(lead: Lead, ctx: ContextoFila): FilaPlanilla {
  const hoy = ctx.hoy ?? new Date();
  const creado = new Date(lead.created_at);
  const segs = [...ctx.seguimientos].sort((a, b) => a.n - b.n);
  const ultimo = segs[segs.length - 1];
  const proceso = estadoProceso(lead, hoy);

  const celda = (seg: LeadSeguimiento | undefined): CeldaSeguimiento | null =>
    seg
      ? {
          fecha: fechaCorta(new Date(seg.fecha)),
          medio: seg.medio ? MEDIO_LABEL[seg.medio] : '',
          medioExcel: seg.medio ? MEDIO_EXCEL[seg.medio] : '',
          respuesta: s(seg.nota) || SEG_RESULTADO_LABEL[seg.resultado] || seg.resultado,
        }
      : null;

  const region = s(lead.region) || (esComunaRM(lead.comuna) ? 'Metropolitana' : '');
  const monto = lead.monto === null || lead.monto === undefined ? null : Number(lead.monto);
  const tipoUltimo = lead.ultima_actividad_tipo as LeadActividadTipo | null;

  return {
    id: lead.id,
    otId: lead.ot_id,
    fechaIso: lead.created_at,
    mes: nombreMes(creado),
    claveMes: claveMes(creado),
    semana: semanaDelMes(creado),
    fecha: fechaCorta(creado),
    dia: nombreDia(creado),
    nombre: s(lead.nombre),
    telefono: s(lead.whatsapp_phone),
    instagram: s(lead.instagram),
    mail: s(lead.email),
    comuna: s(lead.comuna),
    region,
    canal: esCanalReal(lead.fuente) ? s(lead.fuente) : '',
    anuncio: s(lead.anuncio),
    mensaje: s(lead.mensaje),
    infoAdicional: s(lead.comentarios),
    estadoCotizacion: lead.estado_cotizacion,
    estadoCotizacionTexto: textoEstadoCotizacion(lead),
    numeroCotizacion: numeroCotizacionCorto(lead.numero_cotizacion),
    numeroCotizacionCompleto: s(lead.numero_cotizacion),
    monto: monto !== null && Number.isFinite(monto) ? monto : null,
    ticket: ticketDeMonto(monto),
    cotizacionFinal: lead.estado === 'ganado' && monto !== null ? monto : null,
    cantProcesos: lead.cotizacion_version ?? 0,
    llamada: s(lead.llamada_por),
    cotiza: s(lead.cotizado_por),
    visita: s(lead.visita_por),
    vendedor: lead.asignado_a ? ctx.nombres.get(lead.asignado_a) ?? '' : '',
    estado: lead.estado,
    estadoTexto: ESTADOS_LABEL[lead.estado] ?? lead.estado,
    potencial: PRIORIDAD_LABEL[lead.prioridad] ?? '',
    estadoProceso: proceso.texto,
    atrasado: proceso.atrasado,
    avisoAtraso: proceso.aviso,
    respuesta: ultimo ? s(ultimo.nota) || SEG_RESULTADO_LABEL[ultimo.resultado] || '' : '',
    seguimientos: [celda(segs[0]), celda(segs[1]), celda(segs[2])],
    seguimientosExtra: Math.max(0, segs.length - 3),
    ultimoCambio: tipoUltimo ? TIPO_ACTIVIDAD_LABEL[tipoUltimo] ?? tipoUltimo : '',
    ultimoCambioQuien: lead.ultima_actividad_por
      ? ctx.nombres.get(lead.ultima_actividad_por) ?? ''
      : tipoUltimo
        ? 'Sistema'
        : '',
    ultimoCambioFecha: lead.ultima_actividad_at,
    porActualizar: lead.estado_cotizacion === 'por_actualizar',
    archivado: lead.archivado,
  };
}

// ─── Filtros ──────────────────────────────────────────────────────────────

export type FiltrosPlanilla = {
  /** «2026-09» o vacío. */
  mes: string;
  /** «1»…«6» o vacío. */
  semana: string;
  ticket: '' | Ticket;
  /** Nombre en Llamada, Cotiza o Salida a visita. */
  persona: string;
  estadoCotizacion: '' | EstadoCotizacion;
  soloConCotizacion: boolean;
  ocultarArchivados: boolean;
};

export const FILTROS_PLANILLA_VACIOS: FiltrosPlanilla = {
  mes: '',
  semana: '',
  ticket: '',
  persona: '',
  estadoCotizacion: '',
  soloConCotizacion: false,
  ocultarArchivados: false,
};

export function filtrarFilas(filas: FilaPlanilla[], f: FiltrosPlanilla): FilaPlanilla[] {
  return filas.filter((x) => {
    if (f.mes && x.claveMes !== f.mes) return false;
    if (f.semana && String(x.semana) !== f.semana) return false;
    if (f.ticket && x.ticket !== f.ticket) return false;
    if (f.persona && x.llamada !== f.persona && x.cotiza !== f.persona && x.visita !== f.persona) return false;
    if (f.estadoCotizacion && x.estadoCotizacion !== f.estadoCotizacion) return false;
    if (f.soloConCotizacion && !x.otId) return false;
    if (f.ocultarArchivados && x.archivado) return false;
    return true;
  });
}

/** Meses con filas, del más nuevo al más viejo: [{ valor: '2026-09', texto: 'SEP 2026' }]. */
export function mesesDisponibles(filas: FilaPlanilla[]): { valor: string; texto: string }[] {
  const vistos = new Map<string, string>();
  for (const x of filas) {
    if (!vistos.has(x.claveMes)) vistos.set(x.claveMes, `${x.mes} ${x.claveMes.slice(0, 4)}`);
  }
  return [...vistos.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([valor, texto]) => ({ valor, texto }));
}

export type TotalesPlanilla = { filas: number; cotizado: number; ganado: number; porActualizar: number };

export function totalesPlanilla(filas: FilaPlanilla[]): TotalesPlanilla {
  return filas.reduce<TotalesPlanilla>(
    (t, x) => ({
      filas: t.filas + 1,
      cotizado: t.cotizado + (x.monto ?? 0),
      ganado: t.ganado + (x.cotizacionFinal ?? 0),
      porActualizar: t.porActualizar + (x.porActualizar ? 1 : 0),
    }),
    { filas: 0, cotizado: 0, ganado: 0, porActualizar: 0 },
  );
}

// ─── Exportar con los encabezados del Excel ───────────────────────────────

export const ENCABEZADOS_EXCEL = [
  'MES', 'N° DE SEMANA', 'FECHA', 'DÍA', 'NOMBRE DE CLIENTE', 'TELÉFONO', 'INSTAGRAM',
  'ESTADO COTIZACIÓN', 'COMUNA', 'REGIÓN', 'TIPO DE COTIZACIÓN', 'MAIL', 'MENSAJE', 'CANAL',
  'LLAMADA', 'INFORMACIÓN ADICIONAL', 'QUÉ ANUNCIO VIENE', 'ESTADO', 'RESPUESTA DEL CLIENTE',
  'PERSONA QUE COTIZA', 'CANT. DE PROCESOS', 'ESTADO DEL PROCESO', 'POTENCIAL', 'MONTO COTIZADO',
  'N° DE COTIZACIÓN', 'SALIDA VISITA', 'VENDEDOR', 'COTIZACIÓN FINAL',
  ...[1, 2, 3].flatMap((n) => [
    `SEGUIMIENTO ${n}`, `FECHA DE SEGUIMIENTO ${n}`, `TIPO DE SEGUIMIENTO ${n}`, `RESPUESTA DE SEGUIMIENTO ${n}`,
  ]),
  'ÚLTIMO CAMBIO',
] as const;

export function aoaPlanilla(filas: FilaPlanilla[]): (string | number)[][] {
  const cuerpo = filas.map((x) => [
    x.mes, `SEMANA ${x.semana}`, x.fecha, x.dia, x.nombre, x.telefono, x.instagram,
    ESTADO_COTIZACION_EXCEL[x.estadoCotizacion] ?? ESTADO_COTIZACION_LABEL[x.estadoCotizacion],
    x.comuna, x.region, x.ticket ? TICKET_EXCEL[x.ticket] : '', x.mail, x.mensaje, x.canal,
    x.llamada, x.infoAdicional, x.anuncio, x.estadoTexto, x.respuesta,
    x.cotiza, x.cantProcesos, x.estadoProceso, x.potencial, x.monto ?? '',
    x.numeroCotizacionCompleto, x.visita, x.vendedor, x.cotizacionFinal ?? '',
    ...x.seguimientos.flatMap((c) => (c ? ['SI', c.fecha, c.medioExcel, c.respuesta] : ['', '', '', ''])),
    [x.ultimoCambio, x.ultimoCambioQuien].filter(Boolean).join(' · '),
  ]);
  return [[...ENCABEZADOS_EXCEL], ...cuerpo];
}
