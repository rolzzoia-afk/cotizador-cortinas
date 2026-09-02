// ─────────────────────────────────────────────────────────────────────
// Cómo queda dibujado cada paño que baja del rollo: dónde va cada cortina
// dentro del tiro y en qué orden se corta.
//
// Es lo que el dimensionador tiene delante: le entregan un tiro enrollado y
// necesita saber cuántas cortinas salen de ahí, cuáles son y por dónde partir.
// La cuenta de «qué se corta junto» NO se repite acá: viene de
// `panoDeCadaFila` (hojaCorte.ts), la misma que usan la hoja del cortador, el
// Dimensionado y las etiquetas de paño.
//
// Módulo PURO (sin React ni Supabase).
// ─────────────────────────────────────────────────────────────────────
import type { OptimizerRow } from './tela';
import { esFilaInvertida, panoDeCadaFila } from './hojaCorte';
import { letraPano } from './letras';
import { secuenciaCortes, type CorteGuillotina, type Placed } from './planCorte';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';

export type PiezaDibujada = {
  /** Ubicación de la cortina, tal como la rotula la hoja ("PPAL", "DORM 2 P1"). */
  nombre: string;
  /** Ancho de la cortina (cm), la medida que se pide en la ficha. */
  anchoCm: number;
  /** Alto de corte de la tela (cm) — dúo incluido (2×alto + 30). */
  altoCorteCm: number;
  /** Se corta rotada (ocupa el rollo a lo largo). */
  invertida: boolean;
  /** Rectángulo dentro del paño, en cm: x/y desde la esquina, w×h ya rotados. */
  px: number;
  py: number;
  pw: number;
  ph: number;
};

export type PanoDibujado = {
  /** N.º de paño físico (el mismo que numera la hoja de corte). */
  pano: number;
  /** Letra «cortar junto» — la de la etiqueta y el Dimensionado. */
  letra: string;
  codInt: string;
  producto: string;
  /** Ancho del rollo (cm) del que baja este tiro. */
  anchoRolloCm: number;
  /** Alto (cm) que hay que bajar del rollo. */
  altoPanoCm: number;
  /** Las cortinas que salen de este tiro, en el orden en que entraron. */
  piezas: PiezaDibujada[];
  /** El orden en que la mesa lo parte; null si el layout no es cortable. */
  cortes: CorteGuillotina[] | null;
  /** "A-27 · 178X210" si el paño sale de colmena; '' si es rollo nuevo. */
  colmena: string;
  esVertical: boolean;
};

const cm = (n: number) => Math.round(n * 10) / 10;

/** Ancho (cm) que la pieza consume a lo ancho del rollo. */
const anchoConsumidoCm = (r: OptimizerRow): number =>
  typeof r.anchoCorteTelaCm === 'number' ? cm(r.anchoCorteTelaCm) : cm(r.ancho * 100);

/**
 * Arma el dibujo de cada paño a partir de las filas del optimizador.
 *
 * Las cortinas de un mismo paño van una al lado de la otra a lo ancho del
 * rollo, en el orden en que entraron — que es como las acomoda el empacador y
 * como salen en la hoja. La INVERTIDA ocupa el tiro girada: su alto viaja a lo
 * ancho del rollo y su ancho a lo largo.
 *
 * `colmenaDePano` permite marcar los paños que salen de un sobrante (la hoja de
 * corte ya lo sabe); sin él, todos se muestran como rollo nuevo.
 */
export function panosDibujados(
  rows: OptimizerRow[],
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  colmenaDePano?: Map<number, string>,
): PanoDibujado[] {
  const panoDe = panoDeCadaFila(rows, params);
  const porPano = new Map<number, { rows: OptimizerRow[]; idx: number[] }>();
  rows.forEach((r, i) => {
    const p = panoDe[i] ?? 0;
    if (!porPano.has(p)) porPano.set(p, { rows: [], idx: [] });
    porPano.get(p)!.rows.push(r);
    porPano.get(p)!.idx.push(i);
  });

  const out: PanoDibujado[] = [];
  for (const [pano, grupo] of [...porPano.entries()].sort((a, b) => a[0] - b[0])) {
    const ref = grupo.rows[0];
    const anchoRolloCm = cm((Number(ref.anchoRollo) || 0) * 100);
    let x = 0;
    const piezas: PiezaDibujada[] = grupo.rows.map((r) => {
      const inv = esFilaInvertida(r, params);
      const anchoCm = anchoConsumidoCm(r);
      const altoCorteCm = cm((Number(r.altoCorte) || 0) * 100);
      // Girada: el alto de la cortina viaja a lo ancho del rollo.
      const pw = inv ? altoCorteCm : anchoCm;
      const ph = inv ? anchoCm : altoCorteCm;
      const pieza: PiezaDibujada = {
        nombre: String(r.ubicacion || '—'),
        anchoCm,
        altoCorteCm,
        invertida: inv,
        px: x,
        py: 0,
        pw,
        ph,
      };
      x = cm(x + pw);
      return pieza;
    });
    const altoPanoCm = piezas.reduce((m, p) => Math.max(m, p.ph), 0);
    // `secuenciaCortes` habla el idioma del plan de corte (Placed): se le pasa
    // lo mínimo que mira — el rectángulo y el rótulo.
    const comoPlaced = piezas.map(
      (p, i) =>
        ({
          id: String(i),
          nombre: p.nombre,
          codInt: ref.codInt,
          otId: '',
          otNum: '',
          w: p.pw,
          h: p.ph,
          px: p.px,
          py: p.py,
          pw: p.pw,
          ph: p.ph,
          rot: p.invertida,
          failed: false,
        }) satisfies Placed,
    );
    out.push({
      pano,
      letra: letraPano(pano),
      codInt: ref.codInt,
      producto: ref.producto || ref.codInt,
      anchoRolloCm,
      altoPanoCm,
      piezas,
      cortes: secuenciaCortes(comoPlaced, anchoRolloCm, altoPanoCm),
      colmena: colmenaDePano?.get(pano) ?? '',
      esVertical: !!ref.esVertical,
    });
  }
  return out;
}
