// ─────────────────────────────────────────────────────────────────────
// Cenefas declaradas como adicional en Fase 0 (CENF O / CENFO).
// Se vinculan SOLO por UBIC. idéntica a la del adicional (ej. PZA 3-G2).
// Para una cenefa, `cantidad` ES el ancho (m): la ovalada corta por el ancho
// real del paño (cantidad de respaldo) y la cuadrada corta por cantidad*100.
//
// Fórmulas:
//   · Soft Light 38 mm → cenefa = ancho + ajuste (INTERNO: −1,2 → ej. 295,7)
//   · Roller cenefa ovalada → tapa = ancho − dcto_cenefa (ej. −1,5); el tubo
//     va detrás (ancho − dcto_tubo − dcto_cenefa). La tapa es la más ancha.
// ─────────────────────────────────────────────────────────────────────
import type { AdicionalFase0Persistido, VentanaItem } from '@/modules/ots/types';
import { medidaCenefaSoftLight, varianteSoftLight } from './reglas-soft-light';
import { FORMULAS_DEFAULT, type FormulasFamilias } from './formulasFamilias';
import { familiaOscuridad } from './reglas-oscuridad';
import { sistemasDeCategoria, type ModeloDespiece } from './tipos';
import { categoriaEfectiva, type TipoCortina } from './tiposCortina';

const r1 = (n: number) => Math.round(n * 10) / 10;

const CODIGOS_CENEFA_OVALADA = new Set(['CENF O', 'CENFO', 'CENEFA OVALADA']);
const CODIGOS_CENEFA_CUADRADA = new Set(['CENF C', 'CENFC', 'CEN-PRO', 'CEN PRO']);

export type EtiquetaConTira = 'CON TIRA' | 'SIN TIRA';

export type ContextoCenefaAdicional = {
  anchoPanoCm?: number;
  categoria?: string;
  /**
   * Variante de instalación de la oscuridad (INTERNO/SEMI/EXTERNO), tal como
   * la lee el despiece: `pano.oscuridadVariante ?? ventana.oscuridadVariante`.
   * Manda sobre `sentido`, que en oscuridad es la caída fija (INTERNO).
   */
  oscuridadVariante?: string | null;
  sentido?: string | null;
  /** Tipos de cortina propios: una categoría nueva corta como su molde. */
  tipos?: readonly TipoCortina[];
};

export function normalizarUbicacion(ubic: string): string {
  return ubic.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function esAdicionalCenefaOvalada(codInt: string): boolean {
  const c = codInt.trim().toUpperCase();
  return CODIGOS_CENEFA_OVALADA.has(c) || c.includes('CENEFA OVALADA');
}

export function esAdicionalCenefaCuadrada(codInt: string): boolean {
  const c = codInt.trim().toUpperCase();
  return CODIGOS_CENEFA_CUADRADA.has(c) || c.includes('CENEFA CUAD');
}

export function esAdicionalCenefa(codInt: string): boolean {
  return esAdicionalCenefaOvalada(codInt) || esAdicionalCenefaCuadrada(codInt);
}

// ── Cenefa CUADRADA en roller / vertical (cuadro de la hoja de órdenes) ──
// El TIP. INST sale del "Tapas" del paño (OPCIONES_CENEFA_TAPA, Fase 2).

/** Categoría roller o vertical (única donde aplica el cuadro de cenefa cuadrada). */
export function esRollerOVertical(
  categoria: string | undefined | null,
  tipos?: readonly TipoCortina[],
): boolean {
  const c = categoriaEfectiva(categoria, tipos).toUpperCase();
  return c.startsWith('ROL') || c.includes('VERTICAL');
}

/**
 * Ajuste (cm) al ancho de corte de la cenefa cuadrada según el tipo de
 * instalación: CON 1 TAPA +1 · CON 2 TAPAS +2 · MURO A MURO −0,5.
 * MURO_MURO es la opción base (incluye el legacy SIN_TAPA: son lo mismo).
 */
export function ajusteCenefaCuadradaCm(
  tipInst: string | undefined,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): number {
  const a = formulas.adicionales;
  switch ((tipInst || '').toUpperCase().trim()) {
    case 'CON_1_TAPA':
      return a.cuadradaCon1TapaCm;
    case 'CON_2_TAPAS':
      return a.cuadradaCon2TapasCm;
    case 'MURO_MURO':
    case 'SIN_TAPA': // legacy → muro a muro
    default:
      return a.cuadradaMuroMuroCm;
  }
}

/** Ancho de corte estimado de la cenefa cuadrada = ancho inicial + ajuste. */
export function medidaCorteCenefaCuadrada(
  anchoInicialCm: number,
  tipInst: string | undefined,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): number {
  if (!(anchoInicialCm > 0)) return 0;
  return r1(anchoInicialCm + ajusteCenefaCuadradaCm(tipInst, formulas));
}

/** Etiqueta de TIP. INST para la hoja de órdenes (vacío/legacy → MURO_MURO). */
export function etiquetaTipInstCenefa(tipInst: string | undefined): string {
  const c = (tipInst || '').toUpperCase().trim();
  return c === 'CON_1_TAPA' || c === 'CON_2_TAPAS' ? c : 'MURO_MURO';
}

/** Tipo de cenefa Fase 2 a partir del codInt del adicional Fase 0. */
export function tipoCenefaDesdeAdicional(codInt: string): 'Ovalada' | 'Cuadrada' | null {
  if (esAdicionalCenefaOvalada(codInt)) return 'Ovalada';
  if (esAdicionalCenefaCuadrada(codInt)) return 'Cuadrada';
  return null;
}

/** UBIC. de un paño (igual que el Excel de órdenes). */
export function ubicPanoVentana(ubicacionVentana: string, panoIndex: number, totalPanos: number): string {
  return `${ubicacionVentana || ''}${totalPanos > 1 ? `-G${panoIndex + 1}` : ''}`.trim();
}

export function etiquetaConTira(val?: boolean | string | null): EtiquetaConTira {
  if (val === true) return 'CON TIRA';
  const s = String(val ?? '').toUpperCase().trim();
  if (s === 'CON TIRA' || s === 'SI' || s === 'SÍ' || s === 'X') return 'CON TIRA';
  return 'SIN TIRA';
}

/**
 * Tira efectiva de una cenefa OVALADA. Regla (2026-07-20): el default —cuando
 * el paño no trae dato— es CON TIRA (antes era SIN TIRA). Solo un 'SIN TIRA'
 * explícito la deja sin tira. `adicionalConTira` (flag del adicional del Excel)
 * es el respaldo cuando el paño no define nada. Usar en TODA lectura de la tira
 * ovalada (UI, Excel de órdenes, cálculo general, etiquetas, precio).
 *
 * CATEGORÍA B (2026-08-14): sus cenefas van SIEMPRE sin tira — gana incluso a
 * un 'CON TIRA' guardado en el paño («todas automáticamente», sin excepciones).
 */
export function tiraCenefaOvalada(
  cenefaTira?: boolean | string | null,
  adicionalConTira?: boolean | null,
  lineaB?: boolean,
): EtiquetaConTira {
  if (lineaB) return 'SIN TIRA';
  if (String(cenefaTira ?? '').trim() !== '') return etiquetaConTira(cenefaTira);
  if (adicionalConTira != null) return etiquetaConTira(adicionalConTira);
  return 'CON TIRA';
}

export function buscarAdicionalCenefaEnUbic(
  ubicFila: string,
  adicionales: AdicionalFase0Persistido[] | undefined,
): AdicionalFase0Persistido | null {
  if (!adicionales?.length) return null;
  const key = normalizarUbicacion(ubicFila);
  if (!key) return null;
  for (const adicional of adicionales) {
    if (!adicional.codInt || !(adicional.cantidad > 0)) continue;
    if (!esAdicionalCenefa(adicional.codInt)) continue;
    if (normalizarUbicacion(adicional.ubicacion || '') === key) return adicional;
  }
  return null;
}

export function ubicacionCoincideConAdicional(ubicFila: string, ubicAdicional: string): boolean {
  const fila = normalizarUbicacion(ubicFila);
  const adic = normalizarUbicacion(ubicAdicional);
  return !!fila && fila === adic;
}

/**
 * Ancho (cm) de la cenefa CUADRADA tal como se VENDIÓ en Fase 1: la cantidad
 * del adicional CENF C es el ancho en metros (×100). Es lo que imprime la
 * etiqueta y lo que el Excel de órdenes pone como ANCHO INICIAL; el ancho de la
 * cortina NO sirve, porque la cenefa se vende aparte y puede ser más ancha
 * (tapa los soportes) o más angosta.
 *
 * La UBIC. de la fila viene con sufijo de paño (" P2" en el optimizador,
 * "-G2" en el Excel) y la del adicional suele ser la general ("LIVING"), así
 * que se acepta igual, misma base o prefijo. Si varias cenefas calzan (dos
 * cortinas con cuadrada en la misma UBIC.) gana la de cantidad más parecida al
 * ancho del paño, el mismo desempate que `cortinaDeLaCenefa`. Sin adicional
 * que calce devuelve null y quien llama decide el respaldo.
 */
export function buscarCenefaCuadradaDeclarada(
  ubicFila: string,
  anchoPanoM: number,
  adicionales: AdicionalFase0Persistido[] | undefined,
): AdicionalFase0Persistido | null {
  if (!adicionales?.length) return null;
  const key = normalizarUbicacion(ubicFila);
  if (!key) return null;
  const base = key.replace(/(?:\s+P|-G)\d+$/, '');
  let mejor: { rango: number; dist: number; adic: AdicionalFase0Persistido } | null = null;
  for (const a of adicionales) {
    if (!a.codInt || !(a.cantidad > 0) || !esAdicionalCenefaCuadrada(a.codInt)) continue;
    const ubic = normalizarUbicacion(a.ubicacion || '');
    if (!ubic) continue;
    const rango = ubic === key ? 0 : ubic === base ? 1 : ubic.startsWith(base) || base.startsWith(ubic) ? 2 : -1;
    if (rango < 0) continue;
    const dist = anchoPanoM > 0 ? Math.abs(a.cantidad - anchoPanoM) : 0;
    if (!mejor || rango < mejor.rango || (rango === mejor.rango && dist < mejor.dist - 1e-9)) {
      mejor = { rango, dist, adic: a };
    }
  }
  return mejor ? mejor.adic : null;
}

export function anchoCenefaCuadradaDeclaradoCm(
  ubicFila: string,
  anchoPanoM: number,
  adicionales: AdicionalFase0Persistido[] | undefined,
): number | null {
  const adic = buscarCenefaCuadradaDeclarada(ubicFila, anchoPanoM, adicionales);
  return adic ? r1(adic.cantidad * 100) : null;
}

/**
 * COLOR de la cenefa cuadrada tal como se VENDIÓ (columna COLOR ACCESORIOS del
 * adicional CENF C). Es el mismo criterio que el ancho: manda lo comprado, no el
 * color de la cortina — la cenefa se vende aparte y suele ir en otro color.
 * Devuelve '' sin adicional que calce y quien llama decide el respaldo.
 */
export function colorCenefaCuadradaDeclarado(
  ubicFila: string,
  anchoPanoM: number,
  adicionales: AdicionalFase0Persistido[] | undefined,
): string {
  return (buscarCenefaCuadradaDeclarada(ubicFila, anchoPanoM, adicionales)?.colorAcc || '').trim();
}

// ── A qué CORTINA le toca la cenefa ──────────────────────────────────────
// La UBIC. no identifica una cortina: el sufijo -G1/-G2 solo separa los paños
// DENTRO de una ventana, así que dos cortinas escritas "PPAL" comparten clave.
// Cuando eso pasa hay que mirar la CATEGORÍA (regla del dueño 2026-08-10): si
// una de las cortinas lleva cenefa por diseño y las otras no, la cenefa es de
// esa. En la OT 3169 un soft light y dos roller compartían PPAL, y la única
// cenefa comprada terminó marcada en las tres.

/** Una cortina que compite por la cenefa de una UBIC. compartida. */
export type CandidatoCenefa = {
  /** Ventana a la que pertenece; lo usa quien llama para reconocer al ganador. */
  ventanaId: string;
  /** Índice del paño dentro de su ventana. */
  panoIndex: number;
  categoria?: string | null;
  /** Ancho vendido en METROS: la misma unidad que `cantidad` del adicional. */
  anchoM: number;
  /** Cenefa ya elegida en el paño, si la hay. */
  cenefaPano?: string | null;
  /** `sistema` del modelo de fabricación (CENEFA_OVALADA, CENEFA_OVALADA_DUO…). */
  sistemaModelo?: string | null;
};

/** Forma mínima de una ventana para armar candidatos (Ventana y VentanaItem calzan). */
type VentanaConPanos = {
  id?: string | number;
  ubicacion?: string | null;
  categoria?: string | null;
  modelo?: { sistema?: string } | null;
  panos?: ReadonlyArray<{ ancho?: number | string; cenefa?: unknown }> | null;
};

/**
 * ¿Esta cortina lleva cenefa POR DISEÑO? El soft light ovalado y todo sistema
 * «cenefa ovalada» (incluido el dúo, cuyo `sistema` es CENEFA_OVALADA_DUO
 * aunque su categoría no lo diga) traen la ovalada puesta; DARK, oscuranti y el
 * soft light con cenefa cuadrada traen la cuadrada. En un roller simple la
 * cenefa es opcional y la elige quien vende, así que no dice nada.
 */
export function llevaCenefaPorCategoria(
  tipo: 'Ovalada' | 'Cuadrada',
  cortina: { categoria?: string | null; cenefaPano?: string | null; sistemaModelo?: string | null },
  tipos?: readonly TipoCortina[],
): boolean {
  // La cenefa del paño entra en el cálculo de la familia: un soft light al que
  // le eligieron cuadrada deja de ser candidato a la ovalada, y al revés.
  const fam = familiaOscuridad(cortina.categoria, cortina.cenefaPano, tipos);
  const esSoftLightOvalado = fam === 'SOFT_LIGHT_38' || fam === 'SOFT_LIGHT_45';
  if (tipo === 'Ovalada') {
    if (esSoftLightOvalado) return true;
    if ((cortina.sistemaModelo || '').toUpperCase().includes('CENEFA_OVALADA')) return true;
    return categoriaEfectiva(cortina.categoria, tipos).toUpperCase().includes('CENEFA_OVALADA');
  }
  // Cuadrada: cualquier sistema de oscuridad que no sea el soft light ovalado.
  return !!fam && !esSoftLightOvalado;
}

/** Cortinas de la cotización que caen en la MISMA UBIC. que `ubic`. */
export function candidatosCenefaEnUbic(
  ubic: string,
  ventanas: readonly VentanaConPanos[] | undefined,
): CandidatoCenefa[] {
  const key = normalizarUbicacion(ubic);
  if (!key || !ventanas?.length) return [];
  const out: CandidatoCenefa[] = [];
  for (const v of ventanas) {
    const panos = v.panos || [];
    const total = panos.length;
    panos.forEach((p, i) => {
      if (normalizarUbicacion(ubicPanoVentana(v.ubicacion || '', i, total)) !== key) return;
      out.push({
        ventanaId: String(v.id ?? ''),
        panoIndex: i,
        categoria: v.categoria,
        anchoM: parseFloat(String(p.ancho ?? 0)) || 0,
        cenefaPano: typeof p.cenefa === 'string' ? p.cenefa : null,
        sistemaModelo: v.modelo?.sistema ?? null,
      });
    });
  }
  return out;
}

/**
 * De todas las cortinas que comparten una UBIC., ¿a cuál le toca esta cenefa?
 * Gana la que la lleva por CATEGORÍA; entre iguales desempata el ancho más
 * parecido a la cantidad del adicional (que ES el ancho en metros). Con una
 * sola cortina en la ubicación devuelve esa, como siempre.
 */
export function cortinaDeLaCenefa(
  candidatos: readonly CandidatoCenefa[],
  adicional: { cantidad?: number },
  tipo: 'Ovalada' | 'Cuadrada',
  tipos?: readonly TipoCortina[],
): CandidatoCenefa | null {
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];

  const porCategoria = candidatos.filter((c) => llevaCenefaPorCategoria(tipo, c, tipos));
  const finalistas = porCategoria.length > 0 ? porCategoria : candidatos;
  if (finalistas.length === 1) return finalistas[0];

  const objetivo = Number(adicional.cantidad) || 0;
  if (!(objetivo > 0)) return finalistas[0];
  // Empate exacto → la primera, para que el resultado no dependa del orden de
  // recorrido cuando dos cortinas iguales comparten ubicación.
  return finalistas.reduce((mejor, c) =>
    Math.abs(c.anchoM - objetivo) < Math.abs(mejor.anchoM - objetivo) - 1e-9 ? c : mejor,
  );
}

/** ¿Esta cenefa le corresponde a ESTE paño? (false si es de una cortina vecina). */
export function cenefaAdicionalEsDelPano(
  adicional: { cantidad?: number; codInt?: string },
  pano: { ventanaId: string; panoIndex: number },
  candidatos: readonly CandidatoCenefa[],
  tipos?: readonly TipoCortina[],
): boolean {
  // Sin candidatos (quien llama no pasó las ventanas) no se cambia nada: el
  // comportamiento histórico es "la cenefa de la UBIC. es mía".
  if (candidatos.length === 0) return true;
  const tipo = adicional.codInt ? tipoCenefaDesdeAdicional(adicional.codInt) : null;
  if (!tipo) return true;
  const gana = cortinaDeLaCenefa(candidatos, adicional, tipo, tipos);
  if (!gana) return true;
  return gana.ventanaId === pano.ventanaId && gana.panoIndex === pano.panoIndex;
}

// ── Mapeo FORWARD paño → adicional de cenefa ─────────────────────────────
// Al reconciliar la cotización, cada paño con cenefa genera un adicional
// cobrable (Ovalada → CENF O, Cuadrada → CENF C), vinculado por UBIC. a su
// cortina. Se marcan origen:'pano' para regenerarse en cada apertura sin
// acumularse; la dedup contra manuales evita cobrar dos veces la misma.

/**
 * ¿La cenefa de esta cortina YA está dentro del precio de su sistema?
 *
 * El DÚO sí: las seis recetas de familia (las DUOBK y las DUOPOLI) incluyen el
 * perfil de cenefa **E 26** y su mecanismo MEC 09, así que derivar además un
 * CENF O la cobraría DOS veces. El roller de cenefa ovalada NO: su receta es la
 * del roller simple —sin perfil de cenefa— y la cenefa se cobra con el adicional.
 *
 * Una línea CENF O escrita a mano se respeta igual: esto solo apaga el cobro
 * AUTOMÁTICO (2026-08-20, confirmado por el dueño).
 */
export function cenefaIncluidaEnElPrecio(
  categoria?: string | null,
  tipos?: readonly TipoCortina[],
): boolean {
  return sistemasDeCategoria(categoria ?? '', tipos).some(
    (s) => s.toUpperCase() === 'CENEFA_OVALADA_DUO',
  );
}

/** Deriva los adicionales de cenefa cobrables desde los paños de las ventanas. */
export function derivarAdicionalesCenefaDesdeVentanas(
  ventanas: VentanaItem[],
  tipos?: readonly TipoCortina[],
): AdicionalFase0Persistido[] {
  const out: AdicionalFase0Persistido[] = [];
  for (const v of ventanas) {
    // La cenefa que ya va en el precio del sistema no se cobra aparte.
    if (cenefaIncluidaEnElPrecio(v.categoria, tipos)) continue;
    const panos = v.panos || [];
    const total = panos.length;
    panos.forEach((p, i) => {
      const cenefa = String(p.cenefa ?? '');
      // Cuadrada matchea por prefijo: 'Cuadrada a muro' / 'a techo' y el
      // 'Cuadrada' legacy generan el mismo adicional CENF C.
      const esCuadrada = cenefa.trim().toUpperCase().startsWith('CUADRADA');
      const codInt = cenefa === 'Ovalada' ? 'CENF O' : esCuadrada ? 'CENF C' : '';
      if (!codInt) return;
      out.push({
        codInt,
        // Para una cenefa, `cantidad` ES el ancho (m) del paño: define el corte
        // (anchoNominalCenefaCorte = cantidad*100) y el precio. Antes tomaba
        // v.cantidad (unidades de la ventana) y perdía el ancho al reabrir la OT.
        cantidad: parseFloat(String(p.ancho)) || Number(v.cantidad) || 1,
        descuento: 0,
        ubicacion: ubicPanoVentana(v.ubicacion || '', i, total),
        colorAcc: String(p.colorTapa || p.color || ''),
        // La tira solo aplica a la ovalada. Default CON TIRA (ver tiraCenefaOvalada).
        conTira:
          cenefa === 'Ovalada'
            ? tiraCenefaOvalada(p.cenefaTira as string | undefined) === 'CON TIRA'
            : undefined,
        origen: 'pano',
      });
    });
  }
  return out;
}

/**
 * Descarta los derivados que ya están cubiertos por una línea MANUAL, contando
 * por CUPO: una cenefa escrita a mano tapa UNA cortina, no todas las de esa
 * ubicación. Antes la pregunta era «¿hay alguna manual acá?» y con tres cortinas
 * en la misma UBIC. se cobraba una sola (OT 3169).
 */
export function filtrarDerivadosPorCupoManual(
  derivados: readonly AdicionalFase0Persistido[],
  manuales: readonly AdicionalFase0Persistido[],
): AdicionalFase0Persistido[] {
  const clave = (ubic: string, tipo: 'Ovalada' | 'Cuadrada') =>
    `${tipo}|${normalizarUbicacion(ubic || '')}`;
  const cupo = new Map<string, number>();
  for (const m of manuales) {
    const tipo = m.codInt ? tipoCenefaDesdeAdicional(m.codInt) : null;
    if (!tipo) continue;
    // Una cenefa que nació del paño y se editó a mano sigue ocupando el cupo de
    // SU paño: se la busca por la ubicación que tenía cuando era derivada, o
    // renombrarla haría reaparecer la gemela y se cobraría dos veces.
    const k = clave(m.ubicacionDerivada ?? m.ubicacion ?? '', tipo);
    cupo.set(k, (cupo.get(k) ?? 0) + 1);
  }
  const out: AdicionalFase0Persistido[] = [];
  for (const d of derivados) {
    const tipo = d.codInt ? tipoCenefaDesdeAdicional(d.codInt) : null;
    if (!tipo) {
      out.push(d);
      continue;
    }
    const k = clave(d.ubicacion ?? '', tipo);
    const restante = cupo.get(k) ?? 0;
    if (restante > 0) {
      cupo.set(k, restante - 1);
      continue;
    }
    out.push(d);
  }
  return out;
}

/** ¿Ya hay un adicional de cenefa MANUAL (mismo tipo) en esa ubicación? */
export function existeCenefaManualEnUbic(
  manuales: AdicionalFase0Persistido[],
  tipo: 'Ovalada' | 'Cuadrada',
  ubic: string,
): boolean {
  const key = normalizarUbicacion(ubic);
  if (!key) return false;
  return manuales.some(
    (a) =>
      !!a.codInt &&
      tipoCenefaDesdeAdicional(a.codInt) === tipo &&
      normalizarUbicacion(a.ubicacion || '') === key,
  );
}

export function buscarAdicionalCenefaOvalada(
  ubicFila: string,
  adicionales: AdicionalFase0Persistido[] | undefined,
): AdicionalFase0Persistido | null {
  if (!adicionales?.length) return null;
  const key = normalizarUbicacion(ubicFila);
  if (!key) return null;
  for (const adicional of adicionales) {
    if (!adicional.codInt || !(adicional.cantidad > 0)) continue;
    if (!esAdicionalCenefaOvalada(adicional.codInt)) continue;
    if (normalizarUbicacion(adicional.ubicacion || '') === key) return adicional;
  }
  return null;
}

function dctosCenefaOvaladaRoller(
  modelo: ModeloDespiece,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): { tubo: number; cenefa: number } {
  if (
    (modelo.sistema === 'CENEFA_OVALADA' || modelo.sistema === 'CENEFA_OVALADA_DUO') &&
    modelo.dcto_cenefa_cm > 0
  ) {
    return { tubo: modelo.dcto_tubo_cm, cenefa: modelo.dcto_cenefa_cm };
  }
  return {
    tubo: formulas.adicionales.cenefaOvaladaTuboCm,
    cenefa: formulas.adicionales.cenefaOvaladaCenefaCm,
  };
}

export function medidaCorteCenefaOvaladaRoller(
  anchoNominalCm: number,
  modelo: ModeloDespiece,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): number | null {
  if (!anchoNominalCm || anchoNominalCm <= 0) return null;
  // La cenefa ovalada (tapa) se corta al ancho menos su propio despeje, NO el del
  // tubo: es la pieza más ancha (igual que el despiece del modelo).
  const { cenefa } = dctosCenefaOvaladaRoller(modelo, formulas);
  return r1(anchoNominalCm - cenefa);
}

/** @deprecated alias */
export const medidaCorteCenefaOvalada = medidaCorteCenefaOvaladaRoller;

export function anchoNominalCenefaCorte(
  adicional: AdicionalFase0Persistido,
  anchoPanoCm: number,
): number {
  if (anchoPanoCm > 0) return anchoPanoCm;
  return adicional.cantidad * 100;
}

export function cenefaOvaladaDesdeAdicional(
  adicional: AdicionalFase0Persistido,
  modelo: ModeloDespiece,
  ctx: ContextoCenefaAdicional = {},
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): number | null {
  const ancho = anchoNominalCenefaCorte(adicional, ctx.anchoPanoCm ?? 0);
  if (!ancho || ancho <= 0) return null;

  // Soft light (38 y 45): su cenefa la fija la tabla de oscuridad, la misma que
  // corta el paño. Antes solo se reconocía el 38 y el 45 caía al despeje del
  // roller (−1,5), que en SEMI/EXTERNO no tiene nada que ver con su pizarra.
  const sl = varianteSoftLight({
    categoria: ctx.categoria,
    oscuridadVariante: ctx.oscuridadVariante,
    sentido: ctx.sentido,
    modelo,
    tipos: ctx.tipos,
  });
  if (sl) {
    return medidaCenefaSoftLight(ancho, sl.familia, sl.variante, formulas);
  }
  return medidaCorteCenefaOvaladaRoller(ancho, modelo, formulas);
}

export function indexCenefasOvaladasAdicionales(
  adicionales: AdicionalFase0Persistido[] | undefined,
): Map<string, AdicionalFase0Persistido> {
  const map = new Map<string, AdicionalFase0Persistido>();
  if (!adicionales?.length) return map;
  for (const a of adicionales) {
    if (!a.codInt || !(a.cantidad > 0)) continue;
    if (!esAdicionalCenefaOvalada(a.codInt)) continue;
    const key = normalizarUbicacion(a.ubicacion || '');
    if (!key || map.has(key)) continue;
    map.set(key, a);
  }
  return map;
}
