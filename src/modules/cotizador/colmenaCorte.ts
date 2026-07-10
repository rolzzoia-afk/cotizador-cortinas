// ─────────────────────────────────────────────────────────────────────
// Descuento de la colmena al confirmar el CORTE GENERAL (Fase 4).
//
// El corte general usa los paños (sobrantes) de la colmena. Al confirmarlo,
// cada paño usado se ACTUALIZA EN SU MISMA UBICACIÓN:
//   - si queda un retazo usable → el paño se achica a la medida del retazo
//     (un solo rectángulo, el de mayor área) y sigue disponible.
//   - si no queda retazo → el paño se marca como Usado (lo hace la capa UI).
//
// Lógica pura y testeable: acá solo se CALCULAN las deducciones a partir del
// Plan de Corte (planCorte.ts). La escritura a Supabase la hace Fase 4.
// ─────────────────────────────────────────────────────────────────────
import { esColmena } from './planCorte';
import type { GrupoSobrante, Plan } from './planCorte';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';

/**
 * Retazo único sugerido tras cortar las piezas en un sobrante: el rectángulo
 * de MAYOR ÁREA entre la banda de alto (ancho del paño × alto sobrante) y la
 * tira de ancho (`grupo.sobranteAncho`). Reglas Rolzzo v1.0: un retazo solo
 * "sobrevive" como colmena si cumple el mínimo 120×180; si no, devuelve `null`
 * (el paño se marca Usado y el remanente queda como merma — ver `mermaSobrante`).
 */
export function retazoSugerido(
  grupo: GrupoSobrante,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): { ancho: number; alto: number } | null {
  const placed = grupo.placed.filter((r) => !r.failed);
  const maxY = placed.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
  const altoResto = Math.round(grupo.sobrante.alto - (maxY + params.margenRolloCm * 2));
  const cands: { ancho: number; alto: number }[] = [];
  // Banda de alto (ancho del paño × alto restante): colmena solo si 120×180.
  if (esColmena(grupo.sobrante.ancho, altoResto, params))
    cands.push({ ancho: grupo.sobrante.ancho, alto: altoResto });
  // Tira de ancho: planCorte ya la dejó presente solo si cumple 120×180.
  if (grupo.sobranteAncho) {
    cands.push({ ancho: grupo.sobranteAncho.ancho, alto: grupo.sobranteAncho.alto });
  }
  if (cands.length === 0) return null;
  return cands.reduce((a, b) => (b.ancho * b.alto > a.ancho * a.alto ? b : a));
}

/**
 * Remanente que NO califica como colmena → MERMA. Es el rectángulo de mayor
 * área (banda de alto o tira de ancho) cuando ninguno llega a 120×180. `null`
 * si el corte no deja remanente con medida útil o si ya sobrevivió como retazo.
 */
export function mermaSobrante(
  grupo: GrupoSobrante,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): { ancho: number; alto: number } | null {
  if (retazoSugerido(grupo, params)) return null; // sobrevivió como colmena, no es merma
  const placed = grupo.placed.filter((r) => !r.failed);
  const maxY = placed.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
  const altoResto = Math.round(grupo.sobrante.alto - (maxY + params.margenRolloCm * 2));
  const cands: { ancho: number; alto: number }[] = [];
  if (altoResto > 0) cands.push({ ancho: grupo.sobrante.ancho, alto: altoResto });
  const anchoResto = Math.round(grupo.uw - grupo.placed.reduce((s, r) => s + (r.failed ? 0 : r.pw), 0));
  if (anchoResto > 0) cands.push({ ancho: anchoResto, alto: Math.round(grupo.sobrante.alto) });
  if (cands.length === 0) return null;
  return cands.reduce((a, b) => (b.ancho * b.alto > a.ancho * a.alto ? b : a));
}

/** Una deducción concreta a aplicar sobre una fila de `colmena_panos`. */
export type DeduccionColmena = {
  docId: string;
  cod: string;
  ubicacion: string;
  /** Medidas originales del paño (cm), para mostrar/auditar. */
  ancho: number;
  alto: number;
  /** 'retazo' → achicar a (nuevoAncho × nuevoAlto); 'usado' → marcar no disponible. */
  accion: 'retazo' | 'usado';
  nuevoAncho?: number;
  nuevoAlto?: number;
  /** Remanente que NO califica como colmena (120×180) → merma a registrar. */
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
};

/** Construye el mapa pieza→sobrante desde un plan (para persistir al confirmar). */
export function piezasColmenaSnapshot(plan: Plan): Record<string, PiezaColmenaSnap> {
  const out: Record<string, PiezaColmenaSnap> = {};
  for (const g of plan.sobrantes) {
    for (const pz of g.placed) {
      if (pz.failed) continue;
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
 * cada sobrante de colmena efectivamente usado (`plan.sobrantes`).
 */
export function deduccionesColmena(
  plan: Plan,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): DeduccionColmena[] {
  // OJO: usar los MISMOS params con que se generó el plan; con otros, el
  // retazo calculado no calza con el layout.
  return plan.sobrantes.map((g: GrupoSobrante) => {
    const base = {
      docId: g.sobrante._docId,
      cod: g.sobrante.cod,
      ubicacion: g.sobrante.ubicacion || '',
      ancho: g.sobrante.ancho,
      alto: g.sobrante.alto,
    };
    const retazo = retazoSugerido(g, params);
    return retazo
      ? { ...base, accion: 'retazo' as const, nuevoAncho: retazo.ancho, nuevoAlto: retazo.alto, merma: null }
      : { ...base, accion: 'usado' as const, merma: mermaSobrante(g, params) };
  });
}
