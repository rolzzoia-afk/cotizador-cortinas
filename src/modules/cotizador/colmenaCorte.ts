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
import type { GrupoSobrante, Plan } from './planCorte';

// Mismos umbrales que el Plan de Corte / la tarjeta de colmena.
const MARGEN = 1;
const MIN_CM = 30;

/**
 * Retazo único sugerido tras cortar las piezas en un sobrante: el rectángulo
 * de MAYOR ÁREA entre la banda de alto (ancho del paño × alto sobrante) y la
 * tira de ancho (`grupo.sobranteAncho`). `null` si no queda nada usable.
 */
export function retazoSugerido(grupo: GrupoSobrante): { ancho: number; alto: number } | null {
  const placed = grupo.placed.filter((r) => !r.failed);
  const maxY = placed.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
  const altoResto = Math.round(grupo.sobrante.alto - (maxY + MARGEN * 2));
  const cands: { ancho: number; alto: number }[] = [];
  if (altoResto >= MIN_CM) cands.push({ ancho: grupo.sobrante.ancho, alto: altoResto });
  if (grupo.sobranteAncho) {
    cands.push({ ancho: grupo.sobranteAncho.ancho, alto: grupo.sobranteAncho.alto });
  }
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
  /** Se completa en la capa UI si la escritura falló. */
  error?: string;
};

/** Snapshot persistido en la OT como guard de idempotencia del corte general. */
export type CorteGeneralColmena = {
  confirmadoEn: string;
  panos: DeduccionColmena[];
};

/**
 * Calcula la lista de deducciones a la colmena para un Plan de Corte: una por
 * cada sobrante de colmena efectivamente usado (`plan.sobrantes`).
 */
export function deduccionesColmena(plan: Plan): DeduccionColmena[] {
  return plan.sobrantes.map((g: GrupoSobrante) => {
    const base = {
      docId: g.sobrante._docId,
      cod: g.sobrante.cod,
      ubicacion: g.sobrante.ubicacion || '',
      ancho: g.sobrante.ancho,
      alto: g.sobrante.alto,
    };
    const retazo = retazoSugerido(g);
    return retazo
      ? { ...base, accion: 'retazo' as const, nuevoAncho: retazo.ancho, nuevoAlto: retazo.alto }
      : { ...base, accion: 'usado' as const };
  });
}
