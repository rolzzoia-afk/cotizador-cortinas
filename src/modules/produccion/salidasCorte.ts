// ─────────────────────────────────────────────────────────────────────
// QUÉ SALE DE UN CORTE — lo que queda del rollo cuando el paño ya se cortó.
//
// Hasta ahora el sobrante no se marcaba: el trozo que sobraba se apoyaba en el
// rack y nadie anotaba si servía o era basura. Si servía, no entraba a ningún
// inventario (y se volvía a cortar rollo nuevo por no saber que estaba); si no
// servía, tampoco quedaba registro de cuánta tela se perdió.
//
// Acá se calcula, para cada rollo del plan, qué rectángulos quedan y a cuál de
// los dos destinos va cada uno:
//   · SOBRANTE → `colmena_panos` (inventario, con etiqueta y ubicación)
//   · MERMA    → `telas_mermas`  (pérdida, con trazabilidad de OT)
//
// El corte de esa decisión es FUNCIONAL: para qué alcanza el trozo. Un
// remanente sirve si da para una roller (100×200) o para una vertical
// (80×250) — medidas del taller, editables en Parámetros de corte. Es una
// pregunta distinta de la del mínimo histórico de colmena (120×180), que
// sigue mandando en el flujo clásico y no se toca acá.
//
// Módulo puro: sin React ni Supabase. Las escrituras las hace el diálogo de
// confirmación del módulo Producción.
// ─────────────────────────────────────────────────────────────────────
import type { GrupoRollo, Plan } from '@/modules/cotizador/planCorte';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from '@/modules/cotizador/parametrosCorte';

/** Para qué alcanza un trozo de tela. */
export type FuncionalSobrante = { roller: boolean; vertical: boolean };

/**
 * Bajo esta medida un rectángulo no es manipulable: ni sobrante ni merma, es
 * recorte de mesa. Anotarlo solo ensuciaría el registro de pérdidas.
 */
export const MIN_REGISTRO_CM = 10;

/**
 * ¿Para qué sirve este trozo? La app lo propone por medidas y el operario lo
 * corrige en el diálogo antes de imprimir la etiqueta: la tela tiene defectos
 * y direcciones que ninguna medida captura.
 */
export function funcionalDeSobrante(
  anchoCm: number,
  altoCm: number,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): FuncionalSobrante {
  return {
    roller: anchoCm >= params.funcionalRollerMinAnchoCm && altoCm >= params.funcionalRollerMinAltoCm,
    vertical:
      anchoCm >= params.funcionalVerticalMinAnchoCm && altoCm >= params.funcionalVerticalMinAltoCm,
  };
}

/** ¿Vale la pena guardarlo? Sirve si alcanza para algo; si no, es merma. */
export function esUtilizableProduccion(
  anchoCm: number,
  altoCm: number,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): boolean {
  const f = funcionalDeSobrante(anchoCm, altoCm, params);
  return f.roller || f.vertical;
}

/** ¿Alguno de los dos usos quedó marcado? (el operario puede desmarcar todo). */
export function sirveParaAlgo(f: FuncionalSobrante): boolean {
  return f.roller || f.vertical;
}

// ── De dónde salió el corte ──────────────────────────────────────────

/**
 * Un corte sale de UNA orden o de un LOTE (varias OTs cortadas juntas en el
 * mismo tiro). En el lote no hay una OT a la que atribuir el retazo: el rollo
 * sirvió a todas, así que el sobrante queda a nombre del lote y la etiqueta
 * lleva la lista de OTs para poder rastrearlo.
 */
export type OrigenCorte =
  | { tipo: 'ot'; numero: string }
  | { tipo: 'lote'; nombre: string; ots: { id: string; numero: string }[] };

/** Cómo se nombra el origen en la etiqueta, la colmena y la merma. */
export function rotuloOrigen(o: OrigenCorte): string {
  return o.tipo === 'ot' ? `OT ${o.numero}` : `LOTE ${o.nombre}`;
}

// ── Qué queda del rollo ──────────────────────────────────────────────

/** Un rectángulo que quedó del corte, ya clasificado. */
export type SalidaCorte = {
  codInt: string;
  /** cm */
  ancho: number;
  /** cm */
  alto: number;
  clase: 'sobrante' | 'merma';
  /** Dónde estaba en el paño: la tira del costado o la faja de abajo. */
  detalle: 'franja_rollo' | 'resto_rollo';
  funcional: FuncionalSobrante;
};

const clasificar = (
  codInt: string,
  ancho: number,
  alto: number,
  detalle: SalidaCorte['detalle'],
  params: ParametrosCorte,
): SalidaCorte | null => {
  const a = Math.round(ancho);
  const h = Math.round(alto);
  if (a < MIN_REGISTRO_CM || h < MIN_REGISTRO_CM) return null;
  const funcional = funcionalDeSobrante(a, h, params);
  return {
    codInt,
    ancho: a,
    alto: h,
    clase: sirveParaAlgo(funcional) ? 'sobrante' : 'merma',
    detalle,
    funcional,
  };
};

/**
 * Los rectángulos que quedan tras cortar un paño de rollo nuevo.
 *
 * La geometría se recalcula acá y no se toma de `grupo.sobInterno`, que el
 * motor deja en `null` cuando el trozo no llega al mínimo histórico de colmena
 * (120×180): justo los casos que este módulo necesita ver para anotarlos como
 * merma. El motor no se toca.
 *
 * Los dos rectángulos se cortan en el orden en que los haría la mesa —primero
 * la faja de abajo de punta a punta, después la tira del costado— así no se
 * cuentan dos veces la esquina que comparten.
 */
export function salidasDeRollo(
  grupo: GrupoRollo,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): SalidaCorte[] {
  const puestas = grupo.placed.filter((r) => !r.failed);
  if (puestas.length === 0) return [];

  const maxX = puestas.reduce((m, r) => Math.max(m, r.px + r.pw), 0);
  const maxY = puestas.reduce((m, r) => Math.max(m, r.py + r.ph), 0);

  // Faja de abajo: todo el ancho del paño por lo que sobró de largo. Suele ser
  // 0 —el motor baja exactamente lo que necesita— y aparece cuando el operario
  // corta de más o cuando se rechaza una inversión y se cae al layout vertical.
  const altoResto = Math.round(grupo.altoCorte - (maxY + params.margenRolloCm * 2));
  const faja = clasificar(grupo.codInt, grupo.anchoCorte, altoResto, 'resto_rollo', params);

  // Tira del costado: lo que quedó a la derecha de la última pieza, por el
  // largo que sigue en pie después de sacar la faja.
  const altoTira = Math.round(grupo.altoCorte - Math.max(0, altoResto));
  const tira = clasificar(grupo.codInt, grupo.anchoUtil - maxX, altoTira, 'franja_rollo', params);

  return [faja, tira].filter((s): s is SalidaCorte => s !== null);
}

/** Todo lo que sale del plan: un rollo puede dejar dos trozos, o ninguno. */
export function salidasDelPlan(
  plan: Plan,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): SalidaCorte[] {
  return plan.rollo.flatMap((g) => salidasDeRollo(g, params));
}

// ── Serial ───────────────────────────────────────────────────────────

/** Sin tildes, sin espacios ni símbolos: el serial se teclea y se lee en voz alta. */
const clave = (s: string, largo: number): string =>
  s
    .normalize('NFD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, largo);

/** ddmmaa — como se escribe la fecha a mano en el taller. */
function ddmmaa(fechaISO: string): string {
  const d = new Date(fechaISO);
  if (Number.isNaN(d.getTime())) return '000000';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${p(d.getFullYear() % 100)}`;
}

/**
 * El código que identifica al sobrante en el rack: origen + fecha + número.
 * `OT3189-020926-S1`. No es un correlativo global (no hace falta una tabla
 * para eso): el origen y el día ya lo hacen único, y el guard de confirmación
 * impide registrar dos veces el mismo corte.
 */
export function serialSobrante(origen: OrigenCorte, n: number, fechaISO: string): string {
  const raiz = origen.tipo === 'ot' ? `OT${clave(origen.numero, 10)}` : `L${clave(origen.nombre, 10)}`;
  return `${raiz}-${ddmmaa(fechaISO)}-S${n}`;
}

/** Prefijo común de los seriales de un corte: sirve para detectar repeticiones. */
export function prefijoSerial(origen: OrigenCorte, fechaISO: string): string {
  return serialSobrante(origen, 0, fechaISO).replace(/S0$/, '');
}

// ── Presentación ─────────────────────────────────────────────────────

/** El largo del primer corte, en metros y con coma: «4,52 m». */
export function metrosPrimerCorte(altoCorteCm: number): string {
  const m = Math.round(altoCorteCm) / 100;
  return `${m.toFixed(2).replace('.', ',')} m`;
}

// ── Payloads para la BD ──────────────────────────────────────────────

/** Lo que el operario dejó listo en el diálogo, para una salida utilizable. */
export type FilaSobranteEditada = SalidaCorte & {
  ubicacion: string;
  serial: string;
};

/** `datos_extra` de un sobrante nacido de un corte del módulo Producción. */
export type DatosExtraSobrante = {
  fuente: 'corte_rollo';
  zona: 'CORTE';
  ot_origen: string;
  creadoEn: string;
  serial: string;
  funcional: FuncionalSobrante;
  origen_detalle: SalidaCorte['detalle'];
  lote?: string;
  ots_lote?: { id: string; numero: string }[];
};

export type FilaColmenaSobrante = {
  empresa_id: string;
  codigo: string;
  medida_ancho: number;
  medida_alto: number;
  ubicacion: string;
  tipo: string;
  disponible: boolean;
  ot_asignada: string | null;
  datos_extra: DatosExtraSobrante;
};

/** Las filas de `colmena_panos` de un corte confirmado. */
export function filasColmenaDeCorte(
  filas: FilaSobranteEditada[],
  empresaId: string,
  origen: OrigenCorte,
  nowISO: string,
): FilaColmenaSobrante[] {
  const ot_origen = rotuloOrigen(origen);
  return filas.map((f) => ({
    empresa_id: empresaId,
    codigo: f.codInt,
    medida_ancho: f.ancho,
    medida_alto: f.alto,
    ubicacion: f.ubicacion.trim().toUpperCase(),
    tipo: 'SOBRANTE',
    disponible: true,
    ot_asignada: null,
    datos_extra: {
      fuente: 'corte_rollo',
      zona: 'CORTE',
      ot_origen,
      creadoEn: nowISO,
      serial: f.serial,
      funcional: f.funcional,
      origen_detalle: f.detalle,
      ...(origen.tipo === 'lote' ? { lote: origen.nombre, ots_lote: origen.ots } : {}),
    },
  }));
}

export type FilaMermaCorte = {
  empresa_id: string;
  codigo: string;
  medida_ancho: number;
  medida_alto: number;
  motivo: string;
  ot_origen: string;
  colmena_origen_id: string | null;
  fecha: string;
};

/**
 * Las filas de `telas_mermas`: la tela que se perdió en este corte. Estrena el
 * motivo `sobrante_rollo`, que estaba documentado desde el SQL de mermas y
 * nunca se había escrito porque nadie registraba el rollo nuevo.
 */
export function filasMermasDeCorte(
  salidas: SalidaCorte[],
  empresaId: string,
  origen: OrigenCorte,
  nowISO: string,
): FilaMermaCorte[] {
  const ot_origen = rotuloOrigen(origen);
  return salidas
    .filter((s) => s.clase === 'merma')
    .map((s) => ({
      empresa_id: empresaId,
      codigo: s.codInt,
      medida_ancho: s.ancho,
      medida_alto: s.alto,
      motivo: 'sobrante_rollo',
      ot_origen,
      colmena_origen_id: null,
      fecha: nowISO,
    }));
}

/** Lo que se estampa en cada OT del plan: guard de idempotencia + rastro. */
export type StampCorteProduccion = {
  confirmadoEn: string;
  panos: never[];
  piezas: Record<string, never>;
  fuente: 'produccion';
  lote?: string;
  salidas: { seriales: string[]; mermas: number };
};

/**
 * El sello que apaga el badge «Tela sin cortar» de la cola y bloquea una
 * segunda confirmación. `panos` va vacío a propósito: con la colmena apagada
 * este corte no descuenta nada, solo registra lo que salió.
 */
export function stampCorteProduccion(
  origen: OrigenCorte,
  nowISO: string,
  seriales: string[],
  nMermas: number,
): StampCorteProduccion {
  return {
    confirmadoEn: nowISO,
    panos: [],
    piezas: {},
    fuente: 'produccion',
    ...(origen.tipo === 'lote' ? { lote: origen.nombre } : {}),
    salidas: { seriales, mermas: nMermas },
  };
}
