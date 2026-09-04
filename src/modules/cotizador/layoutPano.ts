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
import { ANCHO_LAMA_VERTICAL_CM } from '@/modules/descuentos/despiece';
import {
  esUtilizableProduccion,
  funcionalDeSobrante,
  libresClasificados,
  MIN_REGISTRO_CM,
  type FuncionalSobrante,
  type RectLibre,
} from '@/modules/produccion/salidasCorte';

/**
 * Cómo se corta una vertical: en tiras. La tela es una sola, pero de ella
 * salen N lamas de 8,9 cm, y el dimensionador tiene que verlo así o corta el
 * paño como si fuera una roller.
 *
 * Los números salen del despiece (que ya viaja en la fila); sin modelo —una OT
 * que no pasó por Fase 2— no hay conteo y el dibujo raya igual, sin cifras.
 */
export type LamasDibujadas = {
  /** Lamas que se montan (una por carrito). */
  total: number;
  /** Lamas extra que se cortan aparte, para reponer. */
  repuesto: number;
  /** Ancho de corte de cada lama (cm). */
  anchoLamaCm: number;
  /** Alto de la lama ya terminada (corte − descuento), null sin despiece. */
  altoFinalCm: number | null;
};

/**
 * Lo que queda del tiro después de sacar las cortinas: la franja del costado.
 *
 * Se calcula con el ancho ÚTIL (el nominal menos los dos márgenes), que es el
 * mismo criterio del motor y de `salidasDeRollo` — si acá se usara el ancho
 * nominal, la pizarra prometería un par de centímetros que no existen.
 */
export type SobranteDibujado = {
  anchoCm: number;
  altoCm: number;
  clase: 'sobrante' | 'merma';
  funcional: FuncionalSobrante;
};

export type PiezaDibujada = {
  /** Ubicación de la cortina, tal como la rotula la hoja ("PPAL", "DORM 2 P1"). */
  nombre: string;
  /** Ancho de la cortina (cm), la medida que se pide en la ficha. */
  anchoCm: number;
  /** Alto de corte de la tela (cm) — dúo incluido (2×alto + 30). */
  altoCorteCm: number;
  /**
   * INVERTIDA de la ficha: la cortina se vendió así (o el ancho no entraba en
   * el rollo). Viene de Fase 2 y se ve en la columna INVERTIDA de Fase 1.
   */
  invertida: boolean;
  /**
   * GIRADA por el ACOMODO: la acostó el empacador para que entrara en este
   * paño. NO figura en la ficha —quien la busque en Fase 1 no la va a
   * encontrar— y el giro se autoriza pieza por pieza en el Plan de Corte.
   * Se dibuja aparte de `invertida` justamente para no confundirlas.
   */
  girada?: boolean;
  /** Rectángulo dentro del paño, en cm: x/y desde la esquina, w×h ya rotados. */
  px: number;
  py: number;
  pw: number;
  ph: number;
  /** Las lamas en que se parte, si es vertical; null en cualquier roller. */
  lamas: LamasDibujadas | null;
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
  /**
   * La franja que queda al costado del tiro, ya clasificada. `null` cuando no
   * queda nada manipulable (menos de 10 cm) o cuando el paño sale de colmena
   * —ese trozo ya estaba cortado y su ancho no es el del rollo—.
   */
  sobrante: SobranteDibujado | null;
  /**
   * TODO lo que no es cortina dentro del tiro: la franja del costado, los
   * huecos bajo una cortina más corta y los que quedan al lado de una banda
   * angosta. Nada queda sin contar — la tela que no se usa es merma.
   */
  libres: RectLibre[];
};

const cm = (n: number) => Math.round(n * 10) / 10;

/** Ancho (cm) que la pieza consume a lo ancho del rollo. */
const anchoConsumidoCm = (r: OptimizerRow): number =>
  typeof r.anchoCorteTelaCm === 'number' ? cm(r.anchoCorteTelaCm) : cm(r.ancho * 100);

/** Los números de las lamas, si el despiece de la fila los trae. */
function lamasDeFila(r: OptimizerRow): LamasDibujadas | null {
  if (!r.esVertical) return null;
  const piezas = r.piezas;
  if (!piezas || piezas.length === 0) return null;
  const medida = (columna: string): number | undefined =>
    piezas.find((p) => p.columnaExcel === columna)?.medidaCm;
  const total = medida('LAMAS');
  if (!total || total <= 0) return null;
  const altoFinal = medida('ALTO FINAL LAMA');
  return {
    total: Math.round(total),
    repuesto: Math.round(medida('REPUESTO') ?? 0),
    anchoLamaCm: ANCHO_LAMA_VERTICAL_CM,
    altoFinalCm: altoFinal && altoFinal > 0 ? cm(altoFinal) : null,
  };
}

/** La franja del costado: ancho útil del rollo menos lo que ocupan las piezas. */
function sobranteDelTiro(
  anchoRolloCm: number,
  usadoCm: number,
  altoPanoCm: number,
  params: ParametrosCorte,
): SobranteDibujado | null {
  const anchoCm = Math.round(anchoRolloCm - params.margenRolloCm * 2 - usadoCm);
  const altoCm = Math.round(altoPanoCm);
  if (anchoCm < MIN_REGISTRO_CM || altoCm < MIN_REGISTRO_CM) return null;
  return {
    anchoCm,
    altoCm,
    clase: esUtilizableProduccion(anchoCm, altoCm, params) ? 'sobrante' : 'merma',
    funcional: funcionalDeSobrante(anchoCm, altoCm, params),
  };
}

/**
 * Arma el dibujo de cada paño a partir de las filas del optimizador.
 *
 * Las cortinas de un mismo paño van una al lado de la otra a lo ancho del
 * rollo, en el orden en que entraron — que es como las acomoda el empacador y
 * como salen en la hoja. La INVERTIDA ocupa el tiro girada: su alto viaja a lo
 * ancho del rollo y su ancho a lo largo.
 *
 * `esDeColmena` marca las cortinas que salen de un paño del rack: NO se dibujan
 * acá (su trozo real lo dibuja `panosDeColmena`, con la medida del paño) y
 * tampoco arman tiro. Antes se marcaba el paño ENTERO cuando una sola de sus
 * cortinas venía de colmena, y su compañera de rollo desaparecía del dibujo.
 */
export function panosDibujados(
  rows: OptimizerRow[],
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  esDeColmena?: (idx: number) => boolean,
): PanoDibujado[] {
  const panoDe = panoDeCadaFila(rows, params, esDeColmena);
  const porPano = new Map<number, { rows: OptimizerRow[]; idx: number[] }>();
  rows.forEach((r, i) => {
    const p = panoDe[i] ?? 0;
    if (p === 0 && esDeColmena) return; // sale del rack, no del rollo
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
        lamas: lamasDeFila(r),
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
      colmena: '',
      esVertical: !!ref.esVertical,
      sobrante: sobranteDelTiro(anchoRolloCm, x, altoPanoCm, params),
      libres: libresClasificados(
        piezas,
        anchoRolloCm - params.margenRolloCm * 2,
        altoPanoCm,
        params,
      ),
    });
  }
  return out;
}

/**
 * Cuántos paños FÍSICOS —trozos que se bajan del rollo— hay en estos dibujos.
 *
 * Un tiro clásico es un paño. Una bajada del plan 2D puede ser varios: cada
 * corte transversal de lado a lado separa un trozo del rollo, y ESO es lo que
 * el taller cuenta como paño (y lo que quiere cortar menos veces). Contar las
 * bajadas por tela como paños hacía ver «6» donde la mesa corta 17.
 *
 * Los paños de COLMENA no cuentan: ya están cortados y el rollo no se toca.
 */
export function panosFisicos(panos: readonly PanoDibujado[]): number {
  let n = 0;
  for (const p of panos) {
    if (p.colmena) continue;
    const cortes = p.cortes ?? [];
    // La región más ancha es la raíz (el rollo entero): un transversal que la
    // cruza completa baja un paño; uno dentro de una columna no.
    const anchoRaiz = cortes.reduce((m, c) => Math.max(m, c.region.w), 0);
    const bandas = cortes.filter(
      (c) => c.eje === 'transversal' && c.region.x <= 0.5 && c.region.w >= anchoRaiz - 0.5,
    ).length;
    n += 1 + bandas;
  }
  return n;
}
