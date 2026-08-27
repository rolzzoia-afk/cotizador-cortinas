// ─────────────────────────────────────────────────────────────────────
// Qué se marca en la hoja de corte de paños.
//
// La unidad de trabajo NO es la cortina: es el PAÑO. La cortadora baja un
// trozo de tela del rollo y de ahí salen todas las cortinas que van «cortadas
// juntas». Por eso la casilla va en la tabla TOTAL PAÑOS, que es la que el
// taller cuenta.
//
// La clave del check es el `pieceId` de la PRIMERA pieza del paño, no su
// número: el número es un ordinal que se recalcula con el plan, mientras que
// la pieza es una cortina de verdad de esta OT. Si mañana el plan reagrupa,
// la marca sigue a su pieza en vez de quedar pegada a un «paño 3» que ya no
// es el mismo.
// ─────────────────────────────────────────────────────────────────────

import { pieceId } from '@/modules/cotizador/hojaCorte';

type CortinaConPano = { pano: number };
type FilaConPieza = { ventanaId: string | number; panoIndex: number };

/**
 * Clave de check por número de paño. `cortinas` y `rows` van 1:1 (la hoja de
 * corte arma una fila de cortina por fila del optimizador).
 */
export function clavesDePano(
  cortinas: CortinaConPano[],
  rows: FilaConPieza[],
  otId: string,
): Map<number, string> {
  const mapa = new Map<number, string>();
  cortinas.forEach((c, i) => {
    const r = rows[i];
    if (!r || mapa.has(c.pano)) return;
    mapa.set(c.pano, pieceId(otId, r.ventanaId, r.panoIndex));
  });
  return mapa;
}

/**
 * Las claves de los paños de una sección, en orden. Un paño sin pieza
 * conocida se salta: mejor no contarlo que inventarle una clave que después
 * no calce con nada.
 */
export function clavesDeSeccion(
  panos: Array<{ pano: number }>,
  claves: Map<number, string>,
): string[] {
  const fuera: string[] = [];
  for (const p of panos) {
    const k = claves.get(p.pano);
    if (k) fuera.push(k);
  }
  return fuera;
}
