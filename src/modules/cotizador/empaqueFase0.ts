// ─────────────────────────────────────────────────────────────────────
// Ancho de EMPAQUE al peor caso — lo que consume la tela cuando todavía no
// sabemos cómo se va a instalar la cortina.
//
// En los sistemas de oscuridad (Soft Light 38/45, Soft Light CC, Oscuranti,
// Dark 38/45) y en el beeblack, la tela NO se corta al ancho nominal: el
// despiece la ajusta según el MONTAJE (interno / semi / externo), que recién se
// elige en Fase 2. En interno la tela sale más ANGOSTA que la medida de la
// ventana; en externo, más ANCHA (soft light: −7,2 vs +7,2 cm).
//
// El Excel manual cotizaba todo como interno, así que cada cortina que después
// salía semi o externa se vendía con menos tela de la que consumía: plata
// perdida. Acá se hace al revés — mientras el montaje no se conozca, el precio
// asume el que MÁS tela gasta. Si en Fase 2 resulta ser interno, se cobró de
// más un poco de tela; si resulta externo, no se regaló nada.
//
// El máximo NO se calcula con constantes copiadas: se le pregunta al despiece
// REAL (cortesOscuridad / medidaComponenteBeeblack) con las fórmulas guardadas
// de la empresa, para que un ajuste editado en el catálogo técnico se refleje
// solo en el precio.
// ─────────────────────────────────────────────────────────────────────
import {
  VARIANTES_OSCURIDAD,
  cortesOscuridad,
  familiaOscuridad,
  formulasOscuridadParaTipo,
  type FamiliaOscuridad,
} from '@/modules/descuentos/reglas-oscuridad';
import {
  VARIANTES_BEEBLACK,
  esCategoriaBeeblack,
  medidaComponenteBeeblack,
} from '@/modules/descuentos/reglas-beeblack';
import { categoriaEfectiva, type TipoCortina } from '@/modules/descuentos/tiposCortina';
import { FORMULAS_DEFAULT, type FormulasFamilias } from '@/modules/descuentos/formulasFamilias';

/** El alto no cambia el ancho de tela en oscuridad; se pasa uno cualquiera > 0
 *  porque `cortesOscuridad` lo exige para los perfiles laterales. */
const ALTO_IRRELEVANTE_CM = 200;

/** Nombre de la pieza de tela en cada despiece. */
const COMPONENTE_TELA_OSCURIDAD = 'Tela (ancho)';

/**
 * Familias de oscuridad posibles para una categoría cuando la CENEFA todavía no
 * está elegida: el soft light cambia de familia según sea ovalada o cuadrada
 * (SOFT_LIGHT_38 → SOFT_LIGHT_CC), y cada una tiene su propia terna de ajustes.
 * El resto de categorías devuelve una sola.
 */
function familiasCandidatas(
  categoria: string | undefined,
  tipos?: readonly TipoCortina[],
): FamiliaOscuridad[] {
  const fams = [
    familiaOscuridad(categoria, undefined, tipos),
    familiaOscuridad(categoria, 'CUADRADA', tipos),
  ].filter((f): f is FamiliaOscuridad => f !== null);
  return [...new Set(fams)];
}

/**
 * Ancho (m) que la cortina consume a lo ancho del rollo en el montaje que MÁS
 * tela gasta. `undefined` = la categoría no tiene diferencia por montaje
 * (roller, dúo, vertical, pletina…): se empaca con el ancho nominal de siempre.
 *
 * El resultado es solo para EMPACAR (cuántos paños salen). Los m² que ve el
 * cliente y el precio unitario siguen calculándose con el ancho nominal de su
 * ventana.
 */
export function anchoEmpaquePeorCasoM(
  categoria: string | undefined,
  anchoM: number,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
  tipos?: readonly TipoCortina[],
): number | undefined {
  if (!(anchoM > 0)) return undefined;
  const anchoCm = anchoM * 100;

  // BEE-BLACK: su tela también depende de la variante (−4,7 / −1 / +2). El
  // cierre "de arriba abajo" (que intercambia ancho y alto) se decide en Fase 2
  // y queda fuera: acá se mide el cierre lateral, que es el normal.
  if (esCategoriaBeeblack(categoriaEfectiva(categoria, tipos))) {
    const anchos = VARIANTES_BEEBLACK.map((v) =>
      medidaComponenteBeeblack(
        v,
        'anchoTela',
        anchoCm,
        ALTO_IRRELEVANTE_CM,
        false,
        undefined,
        formulas.beeblack,
      ),
    );
    const max = Math.max(...anchos);
    return max > 0 ? max / 100 : undefined;
  }

  const familias = familiasCandidatas(categoria, tipos);
  if (familias.length === 0) return undefined;

  let max = 0;
  for (const familia of familias) {
    // Las fórmulas ya parchadas por tipo de cortina propio (`porTipo`): un tipo
    // montado sobre DARK con su propio telaAdj cotiza con el suyo.
    const f = formulasOscuridadParaTipo(formulas.oscuridad, categoria, familia);
    for (const variante of VARIANTES_OSCURIDAD) {
      const cortes = cortesOscuridad(
        familia,
        variante,
        anchoCm,
        ALTO_IRRELEVANTE_CM,
        {},
        {},
        undefined,
        f,
      );
      const tela = cortes.find((c) => c.componente === COMPONENTE_TELA_OSCURIDAD)?.medidaCm ?? 0;
      if (tela > max) max = tela;
    }
  }
  return max > 0 ? max / 100 : undefined;
}
