// ─────────────────────────────────────────────────────────────────────
// El recorrido de UN tubo (lámina «Tubos de aluminio», panel «De dónde
// viene»).
//
// Los tubos no llevan kardex de cantidades: cada pieza tiene su propia
// historia —ingreso, corte, sobrante, merma— en `tubos_historial`. Esto la
// traduce a una línea de tiempo que se pueda leer sin saber el esquema.
//
// Regla que se respeta acá: NO se recalcula lo que la base no dice. En un
// corte, `medida_cm` es lo que medía antes y `medida_resultado_cm` lo que
// quedó, pero la resta NO es el largo cortado —parte se fue en merma—, así
// que el largo del corte solo se muestra si viene escrito en la nota del
// optimizador. Un número inventado en una ficha de trazabilidad es peor que
// no tener el número.
// ─────────────────────────────────────────────────────────────────────

import { codigoNormalizado } from './colmenaTubos';

/** Lo que la línea de tiempo necesita de un evento de `tubos_historial`. */
export type EventoTubo = {
  id: string;
  evento: string;
  cod?: string | null;
  n_colmena?: string | null;
  medida_cm?: number | null;
  medida_resultado_cm?: number | null;
  ot?: string | null;
  notas?: string | null;
  fuente?: string | null;
  registrado_por?: string | null;
  created_at: string;
};

export type TonoEvento = 'ingreso' | 'corte' | 'sobrante' | 'merma' | 'salida' | 'otro';

const EVENTOS: Record<string, { texto: string; tono: TonoEvento }> = {
  ingreso: { texto: 'Ingreso', tono: 'ingreso' },
  corte: { texto: 'Corte', tono: 'corte' },
  sobrante: { texto: 'Sobrante', tono: 'sobrante' },
  merma: { texto: 'Merma', tono: 'merma' },
  eliminado: { texto: 'Salió de la colmena', tono: 'salida' },
  ajuste: { texto: 'Ajuste de medida', tono: 'otro' },
  restauracion: { texto: 'Restaurado', tono: 'otro' },
  error_reemplazo: { texto: 'Error de corte · reemplazo', tono: 'merma' },
};

/** De dónde vino el registro, en palabras. */
export function nombreFuente(fuente: string | null | undefined): string {
  const f = String(fuente ?? '').trim();
  if (!f) return '';
  if (f === 'optimizador' || f === 'optimizador_nuevo') return 'optimizador de corte';
  if (f === 'carga_inicial') return 'carga inicial del taller';
  if (f === 'excel') return 'carga desde Excel';
  if (f === 'ingreso_retroactivo_auto') return 'ingreso retroactivo automático';
  if (/^recovery_/i.test(f) || /^restauracion/i.test(f)) return 'recuperación manual';
  if (/^backfill_/i.test(f)) return 'carga masiva';
  return f;
}

/** Centímetros como se leen en el taller: coma y un decimal, sin ceros de más. */
export function cm(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/** «14-05-2026». Vacío si la fecha no se entiende. */
export function fechaCorta(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ''));
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export type PasoRecorrido = {
  id: string;
  tono: TonoEvento;
  /** «Corte · OT 3054» */
  titulo: string;
  /** «154,2 → 0 cm», o «154,2 cm» cuando el evento no cambió el largo. */
  medidas: string | null;
  /** «22-07-2026 · optimizador de corte» */
  detalle: string;
  /** La frase que escribió quien registró el evento, tal cual. */
  nota: string | null;
  /** El último paso, el que dice en qué está el tubo hoy. */
  esHoy?: boolean;
};

function titulo(e: EventoTubo): string {
  const base = EVENTOS[e.evento]?.texto ?? e.evento;
  const ot = String(e.ot ?? '').trim();
  if (e.evento === 'sobrante') {
    const donde = String(e.n_colmena ?? '').trim();
    return donde ? `${base} · vuelve a ${donde}` : base;
  }
  return ot ? `${base} · OT ${ot}` : base;
}

function medidas(e: EventoTubo): string | null {
  const antes = e.medida_cm;
  const despues = e.medida_resultado_cm;
  if (antes == null && despues == null) return null;
  if (antes == null) return `${cm(despues)} cm`;
  if (despues == null || Number(antes) === Number(despues)) return `${cm(antes)} cm`;
  return `${cm(antes)} → ${cm(despues)} cm`;
}

/** Un evento de la base, listo para dibujar. */
export function pasoDeEvento(e: EventoTubo): PasoRecorrido {
  const fuente = nombreFuente(e.fuente);
  const fecha = fechaCorta(e.created_at);
  return {
    id: e.id,
    tono: EVENTOS[e.evento]?.tono ?? 'otro',
    titulo: titulo(e),
    medidas: medidas(e),
    detalle: [fecha, fuente].filter(Boolean).join(' · '),
    nota: String(e.notas ?? '').trim() || null,
  };
}

/**
 * La línea de tiempo completa: los eventos en el orden en que se
 * registraron, más un paso final que dice en qué está el tubo hoy.
 *
 * Se ordena por `created_at` y no se reordena por lo que «debería» haber
 * pasado: si un ingreso retroactivo quedó después de un sobrante, eso ES lo
 * que dice el registro, y esconderlo taparía justamente el desorden que
 * alguien puede necesitar ver.
 */
export function recorridoDeTubo(
  eventos: EventoTubo[],
  estado: { enColmena: boolean; dias: number | null; colmena?: string | null },
): PasoRecorrido[] {
  const pasos = [...eventos]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map(pasoDeEvento);

  if (!estado.enColmena) {
    return pasos;
  }
  pasos.push({
    id: 'hoy',
    tono: 'otro',
    titulo: 'Hoy · esperando el próximo corte',
    medidas: null,
    detalle:
      estado.dias != null
        ? `${estado.dias} día${estado.dias === 1 ? '' : 's'} en el estante`
        : 'sin fecha de ingreso registrada',
    nota: null,
    esHoy: true,
  });
  return pasos;
}

// ── La regla del gris y el blanco ────────────────────────────────────
//
// El optimizador no combina el tubo BLANCO con los GRISES dentro de una
// misma ubicación: son el mismo perfil en dos colores y mezclarlos hace que
// una cortina salga con el tubo del color equivocado. Acá solo se AVISA —el
// que decide sigue siendo el optimizador—, pero un estante mezclado es algo
// que alguien tiene que ir a mirar al galpón.

const BLANCOS = new Set(['E03']);
const GRISES = new Set(['E01', 'E02', 'E39', 'E66', 'E78']);

export function esTuboBlanco(cod: string | null | undefined): boolean {
  return BLANCOS.has(codigoNormalizado(cod));
}

export function esTuboGris(cod: string | null | undefined): boolean {
  return GRISES.has(codigoNormalizado(cod));
}

/** ¿Este estante tiene tubo blanco y gris a la vez? */
export function mezclaGrisYBlanco(tubos: Array<{ cod?: string | null }>): boolean {
  let blanco = false;
  let gris = false;
  for (const t of tubos) {
    if (esTuboBlanco(t.cod)) blanco = true;
    else if (esTuboGris(t.cod)) gris = true;
    if (blanco && gris) return true;
  }
  return false;
}
