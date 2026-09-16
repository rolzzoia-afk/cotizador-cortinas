// ──────────────────────────────────────────────────────────────────────────
// Historial de un cliente en palabras: QUÉ cambió y QUIÉN lo cambió.
//
// Cada entrada de `leads_actividad` trae su `detalle` (jsonb) y
// `registrado_por`. Acá se traduce a una línea que se pueda leer sin saber
// cómo está guardado: «Cotización: Enviada → Por actualizar · por Génesis».
//
// Módulo puro (sin React ni Supabase).
// ──────────────────────────────────────────────────────────────────────────
import { formatCLP } from '@/lib/formatters';
import { MEDIO_LABEL } from './cadencia';
import { ESTADO_COTIZACION_LABEL } from './cotizacionEstado';
import {
  ESTADOS_LABEL,
  PRIORIDAD_LABEL,
  SEG_RESULTADO_LABEL,
  type EstadoCotizacion,
  type LeadActividad,
  type LeadActividadTipo,
  type LeadEstado,
  type Medio,
  type Prioridad,
} from './types';

export const TIPO_ACTIVIDAD_LABEL: Record<LeadActividadTipo, string> = {
  creado: 'Creación',
  cambio_estado: 'Estado del cliente',
  comentario: 'Comentario',
  asignacion: 'Asignación',
  conversion_ot: 'Unido a una OT',
  edicion: 'Edición',
  agente_ingreso: 'Agente IA',
  seguimiento: 'Seguimiento',
  cotizacion: 'Estado de la cotización',
};

/** Nombre de cada campo editable, como lo lee el equipo. */
export const CAMPO_LABEL: Record<string, string> = {
  nombre: 'Nombre',
  whatsapp_phone: 'Teléfono',
  email: 'Mail',
  rut: 'RUT',
  comuna: 'Comuna',
  region: 'Región',
  instagram: 'Instagram',
  fuente: 'Canal',
  anuncio: 'Anuncio',
  mensaje: 'Mensaje',
  comentarios: 'Información adicional',
  llamada_por: 'Llamada',
  cotizado_por: 'Cotiza',
  visita_por: 'Salida a visita',
  presupuesto_rango: 'Presupuesto',
  prioridad: 'Potencial',
  detalle_personal: 'Conector',
  monto: 'Monto',
};

export type LineaHistorial = {
  titulo: string;
  /** Líneas de detalle (una por campo editado, la nota, el motivo…). */
  detalle: string[];
  /** «Génesis», «Sistema» o «Carga inicial». */
  quien: string;
  /** El cambio lo originó una OT (el Panel o el cotizador). */
  desdeOt: boolean;
};

export type FiltroHistorial = 'todo' | 'cotizacion' | 'seguimientos' | 'cambios';

const txt = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

function valorCampo(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (campo === 'monto') {
    const n = Number(v);
    return Number.isFinite(n) ? formatCLP(n) : String(v);
  }
  if (campo === 'prioridad') return PRIORIDAD_LABEL[v as Prioridad] ?? String(v);
  return String(v);
}

const labelEstado = (e: unknown) => ESTADOS_LABEL[e as LeadEstado] ?? txt(e);
const labelCotizacion = (e: unknown) => ESTADO_COTIZACION_LABEL[e as EstadoCotizacion] ?? txt(e);

/** Quién hizo el cambio. Sin usuario: la carga inicial o el sistema. */
export function quienDe(act: Pick<LeadActividad, 'registrado_por' | 'detalle'>, nombres: Map<string, string>): string {
  if (act.registrado_por) return nombres.get(act.registrado_por) ?? 'Alguien del equipo';
  const det = (act.detalle ?? {}) as Record<string, unknown>;
  if (det.relleno === true) return 'Carga inicial';
  if (det.accion === 'archivado_auto') return 'Automático';
  return 'Sistema';
}

export function textoActividad(act: LeadActividad, nombres: Map<string, string>): LineaHistorial {
  const det = (act.detalle ?? {}) as Record<string, unknown>;
  const desdeOt = det.origen === 'ot';
  const detalle: string[] = [];
  let titulo: string;

  switch (act.tipo) {
    case 'creado':
      titulo = desdeOt ? `Fila creada desde la OT ${txt(det.numero_ot)}`.trim() : 'Cliente creado';
      if (det.fuente) detalle.push(`Canal: ${txt(det.fuente)}`);
      break;
    case 'agente_ingreso':
      titulo = 'Ingresado por el agente IA';
      break;
    case 'cambio_estado':
      titulo = `Estado: ${labelEstado(det.de)} → ${labelEstado(det.a)}`;
      if (det.motivo) detalle.push(`Motivo: ${txt(det.motivo)}`);
      if (det.comentario) detalle.push(txt(det.comentario));
      if (desdeOt && det.numero_ot) detalle.push(`Al mover la OT ${txt(det.numero_ot)} en el Panel`);
      break;
    case 'comentario':
      titulo = txt(det.texto) || 'Comentario';
      break;
    case 'asignacion': {
      const a = det.a ? nombres.get(txt(det.a)) ?? 'otra persona' : null;
      titulo = a ? `Asignado a ${a}` : 'Quedó sin vendedora asignada';
      if (det.de) detalle.push(`Antes: ${nombres.get(txt(det.de)) ?? 'otra persona'}`);
      break;
    }
    case 'conversion_ot':
      titulo = det.numero_ot ? `Unido a la OT ${txt(det.numero_ot)}` : 'Unido a una OT';
      if (det.via === 'telefono') detalle.push('Por el mismo teléfono');
      break;
    case 'edicion': {
      const campos = (det.campos ?? {}) as Record<string, { de?: unknown; a?: unknown }>;
      const claves = Object.keys(campos);
      titulo =
        claves.length === 1
          ? `Editó ${(CAMPO_LABEL[claves[0]] ?? claves[0]).toLowerCase()}`
          : `Editó ${claves.length} datos`;
      for (const k of claves) {
        detalle.push(`${CAMPO_LABEL[k] ?? k}: ${valorCampo(k, campos[k]?.de)} → ${valorCampo(k, campos[k]?.a)}`);
      }
      break;
    }
    case 'seguimiento': {
      if (det.accion === 'archivado_auto') {
        titulo = 'Archivado por falta de respuesta (día +8)';
        break;
      }
      const n = det.n ?? det.etapa;
      const resultado = SEG_RESULTADO_LABEL[det.resultado as keyof typeof SEG_RESULTADO_LABEL] ?? txt(det.resultado);
      const medio = det.medio ? MEDIO_LABEL[det.medio as Medio] ?? txt(det.medio) : '';
      titulo = `Seguimiento${n ? ` ${txt(n)}` : ''}${medio ? ` por ${medio}` : ''}: ${resultado}`;
      if (det.nota) detalle.push(txt(det.nota));
      break;
    }
    case 'cotizacion': {
      titulo = `Cotización: ${labelCotizacion(det.de)} → ${labelCotizacion(det.a)}`;
      const version = Number(det.version);
      if ((det.a === 'enviada' || det.a === 'actualizada') && version > 0) {
        titulo += ` (v${version})`;
      }
      if (det.nota) detalle.push(txt(det.nota));
      if (det.estado_de && det.estado_a) {
        detalle.push(`El cliente pasó de ${labelEstado(det.estado_de)} a ${labelEstado(det.estado_a)}`);
      }
      if (desdeOt) detalle.push('Al pasar la OT a «Esperando confirmación» en el Panel');
      break;
    }
    default:
      titulo = TIPO_ACTIVIDAD_LABEL[act.tipo] ?? act.tipo;
  }

  return { titulo, detalle, quien: quienDe(act, nombres), desdeOt };
}

export function filtrarActividad(acts: LeadActividad[], filtro: FiltroHistorial): LeadActividad[] {
  if (filtro === 'todo') return acts;
  if (filtro === 'cotizacion') return acts.filter((a) => a.tipo === 'cotizacion' || a.tipo === 'conversion_ot');
  if (filtro === 'seguimientos') return acts.filter((a) => a.tipo === 'seguimiento' || a.tipo === 'comentario');
  return acts.filter((a) => a.tipo === 'edicion' || a.tipo === 'asignacion' || a.tipo === 'cambio_estado');
}
