// ─────────────────────────────────────────────────────────────────────
// Descuento de la colmena al confirmar el corte (Fase 4 y el taller).
//
// Un paño que se corta se CONSUME: sale del rack, se marca usado y lo que
// queda de él se anota como cualquier otro corte —los trozos que sirven vuelven
// al rack con etiqueta y ubicación nuevas, y el resto es merma con trazabilidad
// al paño de origen.
//
// Antes el paño se "achicaba en su lugar" al mayor rectángulo que quedara: el
// rack decía que en A-27 había un paño de 130×230 que en realidad estaba en la
// mesa hecho tres pedazos, y los otros dos trozos no existían para nadie.
//
// Lógica pura y testeable: acá solo se CALCULAN las deducciones a partir del
// Plan de Corte (planCorte.ts). Las escrituras las hacen Fase 4 y el diálogo de
// cierre del módulo Producción.
// ─────────────────────────────────────────────────────────────────────
import type { GrupoSobrante, Plan } from './planCorte';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import type { SalidaCorte } from '@/modules/produccion/salidasCorte';
import { MIN_REGISTRO_CM } from './libresPano';

/**
 * Lo que queda de un paño de colmena una vez cortado, con el mismo formato que
 * lo que deja un rollo: así el diálogo de cierre los lista juntos, les pone
 * ubicación y les imprime la misma etiqueta.
 *
 * Se descartan las hilachas de menos de 10 cm (`MIN_REGISTRO_CM`): son recorte
 * de mesa, no tela que alguien vaya a guardar ni pérdida que valga anotar.
 */
export function salidasDeColmena(
  grupo: GrupoSobrante,
  _params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): SalidaCorte[] {
  const origen = {
    docId: grupo.sobrante._docId,
    ubicacion: grupo.sobrante.ubicacion || '',
    cod: grupo.sobrante.cod,
    ancho: grupo.sobrante.ancho,
    alto: grupo.sobrante.alto,
  };
  return grupo.libres
    .filter((r) => r.anchoCm >= MIN_REGISTRO_CM && r.altoCm >= MIN_REGISTRO_CM)
    .map((r) => ({
      codInt: grupo.sobrante.cod,
      ancho: r.anchoCm,
      alto: r.altoCm,
      clase: r.clase,
      detalle: 'resto_colmena' as const,
      funcional: r.funcional,
      colmenaOrigen: origen,
    }));
}

/** El trozo más grande que vuelve al rack (para la tarjeta del plan). */
export function retazoSugerido(
  grupo: GrupoSobrante,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): { ancho: number; alto: number } | null {
  const utiles = salidasDeColmena(grupo, params).filter((s) => s.clase === 'sobrante');
  if (utiles.length === 0) return null;
  const mayor = utiles.reduce((a, b) => (b.ancho * b.alto > a.ancho * a.alto ? b : a));
  return { ancho: mayor.ancho, alto: mayor.alto };
}

/** La pérdida más grande del paño (para la tarjeta del plan). */
export function mermaSobrante(
  grupo: GrupoSobrante,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): { ancho: number; alto: number } | null {
  const mermas = salidasDeColmena(grupo, params).filter((s) => s.clase === 'merma');
  if (mermas.length === 0) return null;
  const mayor = mermas.reduce((a, b) => (b.ancho * b.alto > a.ancho * a.alto ? b : a));
  return { ancho: mayor.ancho, alto: mayor.alto };
}

/** Una deducción concreta a aplicar sobre una fila de `colmena_panos`. */
export type DeduccionColmena = {
  docId: string;
  cod: string;
  ubicacion: string;
  /** Medidas originales del paño (cm), para mostrar/auditar. */
  ancho: number;
  alto: number;
  /**
   * Siempre `'usado'`: el paño sale del rack entero. Lo que queda vuelve como
   * paños NUEVOS (ver `salidas`). Se conserva el campo —y el valor `'retazo'`
   * en el tipo— porque las OTs ya confirmadas lo tienen guardado en su sello.
   */
  accion: 'retazo' | 'usado';
  nuevoAncho?: number;
  nuevoAlto?: number;
  /** Lo que dejó el corte de este paño: trozos para el rack y merma. */
  salidas?: SalidaCorte[];
  /** Compatibilidad con los sellos viejos (una sola merma por paño). */
  merma?: { ancho: number; alto: number } | null;
  /** Se completa en la capa UI si la escritura falló. */
  error?: string;
};

/** Origen de colmena de una pieza (para reconstruir la hoja de corte). */
export type PiezaColmenaSnap = { cod: string; ancho: number; alto: number; ubic: string };

/** Snapshot persistido en la OT como guard de idempotencia del corte general. */
export type CorteGeneralColmena = {
  confirmadoEn: string;
  panos: DeduccionColmena[];
  /**
   * Pieza (pieceId) → sobrante usado. Permite que la hoja de corte siga
   * mostrando el origen de colmena DESPUÉS de confirmar (cuando el sobrante ya
   * quedó disponible=false y el plan vivo no lo re-asigna).
   */
  piezas?: Record<string, PiezaColmenaSnap>;
  /**
   * Quién confirmó el corte. 'fase4' es el corte general clásico; 'produccion'
   * es el del módulo del taller. Ausente en las OTs confirmadas antes de que
   * existiera el módulo → 'fase4'.
   */
  fuente?: 'fase4' | 'produccion';
  /** Nombre del lote, cuando el corte se hizo con varias OTs juntas. */
  lote?: string;
  /** Qué dejó el corte: los seriales que se etiquetaron y cuánta merma se anotó. */
  salidas?: { seriales: string[]; mermas: number };
};

/**
 * Construye el mapa pieza→sobrante desde un plan (para persistir al confirmar).
 *
 * `otId` filtra las piezas de UNA orden: en un lote cada OT guarda su propio
 * sello y `costoOT` cuenta los paños de colmena por orden — sin el filtro, cada
 * OT del lote se atribuiría los paños de todas.
 */
export function piezasColmenaSnapshot(
  plan: Plan,
  otId?: string,
): Record<string, PiezaColmenaSnap> {
  const out: Record<string, PiezaColmenaSnap> = {};
  for (const g of plan.sobrantes) {
    for (const pz of g.placed) {
      if (pz.failed) continue;
      if (otId !== undefined && pz.otId !== String(otId)) continue;
      out[pz.id] = {
        cod: g.sobrante.cod,
        ancho: g.sobrante.ancho,
        alto: g.sobrante.alto,
        ubic: g.sobrante.ubicacion || '',
      };
    }
  }
  return out;
}

/**
 * Calcula la lista de deducciones a la colmena para un Plan de Corte: una por
 * cada paño efectivamente usado (`plan.sobrantes`). Todas son `'usado'` — el
 * paño se consume— y traen lo que dejó el corte en `salidas`.
 */
export function deduccionesColmena(
  plan: Plan,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): DeduccionColmena[] {
  // OJO: usar los MISMOS params con que se generó el plan; con otros, las
  // salidas calculadas no calzan con el layout.
  return plan.sobrantes.map((g: GrupoSobrante) => ({
    docId: g.sobrante._docId,
    cod: g.sobrante.cod,
    ubicacion: g.sobrante.ubicacion || '',
    ancho: g.sobrante.ancho,
    alto: g.sobrante.alto,
    accion: 'usado' as const,
    salidas: salidasDeColmena(g, params),
    merma: mermaSobrante(g, params),
  }));
}
