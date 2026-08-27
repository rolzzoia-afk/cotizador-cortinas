// ─────────────────────────────────────────────────────────────────────
// El MODELO de la hoja CÁLCULO GENERAL: qué cortina es cada fila, con qué
// medidas se arma y qué columnas de despiece tiene su sistema.
//
// Vivía dentro de `pdfCalculoGeneral.ts`, que lo dibujaba derecho en un PDF.
// La pantalla del taller (/produccion → Dimensionado y Armado) muestra la
// MISMA hoja, y arrastrar jsPDF —400 KB— hasta una tablet del galpón solo
// para leer una tabla no tiene sentido. Es un traslado literal: si esto
// cambia, cambia la hoja que el taller tiene en la mano.
//
// Módulo PURO: sin jsPDF ni DOM.
// ─────────────────────────────────────────────────────────────────────
import type { Ventana } from '@/modules/cotizador/types';
import type { CatalogoProductos, Pano } from '@/modules/cotizador/types';
import { esLineaB } from './lineaB';
import {
  calcularDespiece,
  contextoDespieceDesdePano,
  MODELO_DESPIECE_STUB,
} from '@/modules/descuentos/despiece';
import {
  esFamiliaDark,
  familiaOscuridad,
  normalizarVarianteOscuridad,
} from '@/modules/descuentos/reglas-oscuridad';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';
import {
  esCategoriaBeeblack,
  LABEL_INSTALACION_BEEBLACK,
  normalizarInstalacionBeeblack,
  normalizarVarianteBeeblack,
} from '@/modules/descuentos/reglas-beeblack';
import {
  categoriaLlevaCadenaRoller,
  esCategoriaPletina,
  esCategoriaVertical,
} from '@/modules/descuentos/reglas-mecanismo';
import { descripcionTuberia, tuberiaCodigoCorto } from '@/modules/descuentos/reglas-tuberia';
import { tiraCenefaOvalada, ubicPanoVentana } from '@/modules/descuentos/adicionales-cenefa';
import { mecanismoParaPano } from '@/modules/descuentos/chips';
import { opcionesMecanismoResolucion } from '@/modules/descuentos/reglas-mecanismo';
import {
  REGLAS_SELECCION_DEFAULT,
  type ReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccion';
import { colorPesoCadena } from './cadenas';
import { rotuloForma } from './wizard/selectorVentanas';
import { telaDePano } from './telaPano';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';

export type RGB = [number, number, number];

export type BloqueSistema = { key: string; label: string; color: RGB };

export const BLOQUES: Record<string, BloqueSistema> = {
  ROLLER: { key: 'ROLLER', label: 'ROLLER SCREEN O BLACKOUT', color: [112, 48, 160] },
  SOFT: { key: 'SOFT', label: 'SOFT LIGHT', color: [31, 78, 121] },
  OSCU: { key: 'OSCU', label: 'OSCURANTI', color: [192, 80, 77] },
  DARK: { key: 'DARK', label: 'DARK', color: [55, 55, 60] },
  VELCRO: { key: 'VELCRO', label: 'VELCRO DARK', color: [99, 99, 110] },
  BEEBLACK: { key: 'BEEBLACK', label: 'BEEBLACK', color: [51, 63, 80] },
  VERTICAL: { key: 'VERTICAL', label: 'VERTICAL', color: [56, 118, 29] },
};

// ── El velcro del DARK: cuadro propio ────────────────────────────────
//
// La tira de velcro NO es una medida más de la cortina: es un corte de OTRA
// tela, con su propio código y su propio rollo. Dentro del bloque DARK, entre
// TELA y ALTO TELA, se leía como si saliera del mismo paño.

export const COLUMNA_COD_VELCRO = 'COD. VELCRO';

/** Las columnas del cuadro de velcro, en el orden en que se leen. */
export const COLUMNAS_VELCRO: readonly string[] = [
  COLUMNA_COD_VELCRO,
  'ANCHO TELA VELCRO',
  'ALTO TELA VELCRO',
];

/**
 * De qué tela se corta la tira de velcro del DARK: blackout NEGRO. Son dos
 * códigos del mismo negro —BK 13 (delux) y BK 81 (premium)—, así que la hoja
 * nombra los dos y el taller usa el rollo que tenga.
 */
export const COD_TELA_VELCRO_DARK = 'BK 13 / BK 81';

/** Orden fijo de las secciones de la hoja. */
export const ORDEN_BLOQUES: readonly string[] = [
  'ROLLER',
  'SOFT',
  'OSCU',
  'DARK',
  'VELCRO',
  'BEEBLACK',
  'VERTICAL',
];

function bloqueDe(
  categoria: string | undefined,
  cenefaTipo: string | undefined,
  tipos?: readonly TipoCortina[],
): BloqueSistema {
  if (esCategoriaVertical(categoria)) return BLOQUES.VERTICAL;
  if (esCategoriaBeeblack(categoria)) return BLOQUES.BEEBLACK;
  const fam = familiaOscuridad(categoria, cenefaTipo, tipos);
  if (fam === 'OSCURANTI') return BLOQUES.OSCU;
  if (fam && esFamiliaDark(fam)) return BLOQUES.DARK; // 38 y 45
  if (fam) return BLOQUES.SOFT; // SOFT_LIGHT_38/45/CC/CC_45
  return BLOQUES.ROLLER;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: number) => String(parseFloat(v.toFixed(2))).replace('.', ',');

/** ¿La celda tiene dato? (vacío, 0 o undefined = sin dato → se oculta). */
function conDato(v: string | number | undefined): boolean {
  return v !== undefined && v !== '' && v !== 0;
}

export type FilaCalculo = {
  /**
   * Identidad de la pieza (`${ventanaId}_${panoIndex}`) — el mismo formato que
   * usa `juntoPorPieza`. No se imprime: la usa la pantalla del taller para
   * marcar la fila como hecha sin depender de su posición en la tabla.
   */
  piezaId: string;
  codSec: string;
  tuberia: string;
  /** tipo_rol del modelo (ROL_MANUAL_CENEFA_OV…) — columna TIPO del inventario. */
  tipoRol: string;
  codMecanismo: string;
  accionamiento: string;
  pesoCadena: string;
  // Campos crudos de cadena/peso: el inventario (Fase 4) compone con ellos su
  // descripción larga; el Cálculo General usa las versiones compactas de arriba.
  codCadena: string;
  largoCadena: string;
  colorCadena: string;
  codPeso: string;
  suplementos: string;
  manillas: string;
  /** Letra de "cortar junto" (A/B/RR…) para la columna CONJUNTO PAÑOS del
   *  Dimensionado. En oscuranti se le suma " (INVERTIDA)" si el paño se corta girado. */
  conjunto: string;
  cant: number;
  producto: string;
  codInt: string;
  descripcion: string;
  ubic: string;
  colorAcc: string;
  cadena: string;
  armado: string;
  anchoMts: number;
  altoMts: number;
  anchoCorteCm: number;
  altoRollerCm: number;
  altoDuoCm: number;
  bloque: string; // key del BloqueSistema
  despiece: Map<string, number | string>; // componente → medida/valor
};

export type ColumnaCalculo = {
  key: string;
  label: string;
  /** Bloque al que pertenece (undefined = columna de identidad). */
  bloque?: BloqueSistema;
};

export type CalculoGeneral = {
  filas: FilaCalculo[];
  /** Columnas de identidad visibles (con datos). */
  identidad: ColumnaCalculo[];
  /** Bloques de sistema presentes, con sus columnas (con datos). */
  bloques: { sistema: BloqueSistema; columnas: ColumnaCalculo[] }[];
};

// Columnas de identidad que SÍ importan (orden y etiquetas según la hoja
// manual); se ocultan las que quedan sin datos. Las demás columnas que el
// motor calcula (codSec, codMecanismo, accionamiento, pesoCadena, suplementos,
// manillas, ancho corte / alto roller / alto duo) se siguen computando en
// FilaCalculo —las usa el INVENTARIO— pero NO se muestran en el Cálculo general.
const IDENTIDAD: { key: keyof FilaCalculo; label: string }[] = [
  { key: 'tuberia', label: 'TUBERIA' },
  { key: 'cant', label: 'CANT' },
  { key: 'producto', label: 'PRODUCTO' },
  { key: 'codInt', label: 'COD_IN' },
  { key: 'descripcion', label: 'DESCRIPCIÓN' },
  { key: 'ubic', label: 'UBIC.' },
  { key: 'colorAcc', label: 'COLOR ACCESORIOS' },
  { key: 'cadena', label: 'CADENA/CIERRE' },
  { key: 'armado', label: 'ARMADO' },
  { key: 'anchoMts', label: 'ANCHO REAL' },
  { key: 'altoMts', label: 'ALTO REAL' },
];

const NUM_IDENTIDAD = new Set<keyof FilaCalculo>(['anchoMts', 'altoMts']);

/** Paño físico de la hoja de corte: su letra y si se corta girado 90°. */
export type JuntoPieza = { letra: string; invertida: boolean };

/** Construye los datos de la hoja CALCULO GENERAL para las ventanas de una OT. */
export function construirCalculoGeneral(
  ventanas: Ventana[],
  catalogo: CatalogoProductos = {},
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  /** Letras de "cortar junto" por pieza (`${ventanaId}_${panoIndex}` → letra). */
  juntoPorPieza?: Map<string, JuntoPieza>,
  /** Dimensionado: en filas dúo reemplaza la columna ALTO por ALTO MESA DE CORTE.
   *  usarTuboE78: habilita la banda 2,2–3,0 m (kit 45 mm/E78) para esta OT. */
  opts?: {
    altoMesaCorteDuo?: boolean;
    usarTuboE78?: boolean;
    formulas?: FormulasFamilias;
    /** Reglas de tubería/mecanismo editadas en Admin (sin esto, las de fábrica). */
    reglas?: ReglasSeleccion;
  },
): CalculoGeneral {
  const reglas = opts?.reglas ?? REGLAS_SELECCION_DEFAULT;
  const opcMec = opcionesMecanismoResolucion(reglas.mecanismo);
  const filas: FilaCalculo[] = [];

  for (const v of ventanas) {
    const panos = v.panos || [];
    // Bow window / en L / en U / triangular: el rótulo acompaña a la ubicación
    // en todas las filas de la ventana (ver la columna UBIC más abajo).
    const rotuloVentana = rotuloForma(v) ? `(${rotuloForma(v)})` : '';
    panos.forEach((p, i) => {
      const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
      const altoM = parseFloat(String(p.alto ?? v.alto ?? 0)) || 0;
      const anchoCm = anchoM * 100;
      const altoCm = altoM * 100;
      const esBee = esCategoriaBeeblack(v.categoria);
      const bloque = bloqueDe(v.categoria, p.cenefa as string, reglas.tipos);

      const famOscFila = familiaOscuridad(v.categoria, p.cenefa as string | undefined, reglas.tipos);
      const despiece = new Map<string, number | string>();
      if (anchoCm > 0 && (v.modelo || esBee)) {
        const ctx = contextoDespieceDesdePano(v, p, {
          verticalExtraAltoCm: params.extraVerticalCm,
          verticalDctoAltoFinalCm: params.dctoAltoFinalVerticalCm,
          formulas: opts?.formulas,
          tipos: reglas.tipos,
          // El PESO INTERNO se rotula con el código de SU línea (E13 en la A;
          // E79-B/E71-B por color en la B).
          lineaB: esLineaB(p, v.codInt as string | undefined, catalogo, v.categoria, reglas.mecanismo, reglas.tipos),
          colores: reglas.colores,
        });
        const modelo = v.modelo ?? MODELO_DESPIECE_STUB;
        const d = calcularDespiece(modelo, anchoCm, ctx);
        // Oscuridad: los dos perfiles laterales van juntos en UNA columna PERFIL
        // LATERAL (medida + perforación, "210 INT / 200 EXT"); el inferior en
        // PERFIL BASE. Se acumulan aquí porque son cortes separados.
        const perfLateral: string[] = [];
        for (const c of d.cortes) {
          // Token de perfil: medida (o "definir F2" si falta) + perforación INT/EXT.
          const perfTag =
            c.perforacion === 'INTERNO' ? ' INT' : c.perforacion === 'EXTERNO' ? ' EXT' : '';
          if (/^Perfil (izquierdo|derecho)/.test(c.componente)) {
            const med = c.pendienteMedida ? 'definir F2' : num(c.medidaCm);
            perfLateral.push(`${med}${perfTag}`.trim());
            continue;
          }
          // Oscuridad: el perfil inferior se muestra como PERFIL BASE. El
          // 'Perfil inferior (ancho)' de BEEBLACK NO entra aquí: tiene columna
          // propia, igual que el superior y los laterales.
          if (/^Perfil inferior/.test(c.componente) && !esBee) {
            const med = c.pendienteMedida ? 'definir F2' : num(c.medidaCm);
            despiece.set('PERFIL BASE', `${med}${perfTag}`.trim());
            continue;
          }
          if (c.medidaCm <= 0) continue;
          let comp = c.componente.toUpperCase();
          // La CENEFA OVALADA se separa en dos columnas según la tira de aluminio
          // del paño: "CENEFA OVALADA (CON TIRA)" / "(SIN TIRA)". La medida de
          // corte es la misma; solo cambia la etiqueta. Cada paño llena una.
          if (comp === 'CENEFA OVALADA') {
            const filaB = esLineaB(p, v.codInt as string | undefined, catalogo, v.categoria, reglas.mecanismo, reglas.tipos);
            comp = `CENEFA OVALADA (${tiraCenefaOvalada(p.cenefaTira as string | undefined, undefined, filaB)})`;
          }
          // Oscuridad: "TELA (ANCHO)" se muestra como TELA (como la planilla manual).
          if (comp === 'TELA (ANCHO)' && famOscFila) comp = 'TELA';
          despiece.set(comp, c.medidaCm);
        }
        if (perfLateral.length > 0) {
          // Si izq y der miden/perforan igual, no repetir el token.
          const uniq = perfLateral.every((t) => t === perfLateral[0]) ? [perfLateral[0]] : perfLateral;
          despiece.set('PERFIL LATERAL', uniq.join(' / '));
        }
        // El velcro sale de OTRO rollo: se rotula con su código para que la
        // mesa sepa de qué tela cortar la tira.
        if (COLUMNAS_VELCRO.some((c) => c !== COLUMNA_COD_VELCRO && conDato(despiece.get(c)))) {
          despiece.set(COLUMNA_COD_VELCRO, COD_TELA_VELCRO_DARK);
        }
      }
      // Soft light: cada fila muestra SU tipo (variante INTERNO/SEMI/EXTERNO) en
      // una columna propia, al final del bloque. Independiente de la caída (ARMADO).
      if (bloque.key === 'SOFT') {
        despiece.set(
          'TIPO SOFT LIGHT',
          normalizarVarianteOscuridad(
            (p as { oscuridadVariante?: string }).oscuridadVariante ??
              (v as { oscuridadVariante?: string }).oscuridadVariante ??
              (v.sentido as string),
            'INTERNO',
          ),
        );
      }
      // BEEBLACK: la variante manda todas las medidas (INTERNO/SEMI/EXTERNO), así
      // que se imprime en su propia columna igual que el TIPO DE SOFT.LIGHT.
      if (esBee) {
        const varianteBee = normalizarVarianteBeeblack(
          (p as { beeblackVariante?: string }).beeblackVariante ?? (v.sentido as string),
          'INTERNO',
        );
        // El tipo de instalación va pegado a la variante y mueve los laterales
        // (EXTERNO + fuera del marco = alto + 2), así que se imprime con ella.
        const instalacionBee = normalizarInstalacionBeeblack(
          (p as { beeblackInstalacion?: string }).beeblackInstalacion,
          varianteBee,
        );
        despiece.set(
          'TIPO DE BEEBLACK',
          `${varianteBee} — ${LABEL_INSTALACION_BEEBLACK[instalacionBee].toUpperCase()}`,
        );
      }
      // Dúo: se detecta SOLO por producto, igual que el corte real (tela.ts
      // `isDuo`). NO por categoría: hay familias "DUO_MOTOR_*"/"DUO_MANUAL_*" que
      // quedan aplicadas a un roller simple (screen con motor), y ahí la tela se
      // corta simple — el dimensionado debe coincidir con el corte, no con la
      // etiqueta de la categoría.
      // Tela por paño: en dual cada paño trae SU tela; si no, la de la ventana.
      const tela = telaDePano(v, p as { codInt?: string; producto?: string; descripcion?: string });
      const esDuoFila = (tela.producto || '').toUpperCase().includes('DUO');
      const cierreCm = parseFloat(String(p.cierreAlturaCm ?? ''));
      if (esDuoFila && cierreCm > 0) despiece.set('CIERRE DE ALTURA', r1(cierreCm));
      // Columna ALTO del Excel manual: alto de CORTE de la tela del sistema
      // (dúo = 2×alto + extraDuo; resto = alto + extraAlto). Va al final del
      // bloque, igual que en la hoja manual.
      // Pletina/velcro: la tela se corta a la medida EXACTA (no lleva la vuelta
      // del tubo del roller ni el doblez extra del dúo). El ALTO MESA DE CORTE
      // del dúo sí conserva el +extraMesaDuo (=10, la mitad del alto doblado).
      // VERTICAL: el alto de corte NO es alto+25 sino alto+extraVertical, y ya
      // viene del despiece como ALTO DE CORTE (junto con ALTO FINAL), así que
      // la columna ALTO genérica se omite para no mostrar una medida falsa.
      // BEEBLACK: su tela NO lleva el +25 del roller — se corta a la medida de
      // su pizarra, que ya viaja como ALTO TELA (alto ± ajuste de variante).
      // `altoRollerCm` también alimenta la reserva de tela del inventario, así
      // que tomarlo de ahí evita pedir 25 cm de más por cortina.
      const esVerticalFila = esCategoriaVertical(v.categoria);
      const esPletinaFila = esCategoriaPletina(v.categoria, reglas.tipos);
      const altoTelaBbCm = esBee ? Number(despiece.get('ALTO TELA')) || 0 : 0;
      const altoRollerCm = esVerticalFila
        ? r1(altoCm + params.extraVerticalCm)
        : esBee && altoTelaBbCm > 0
          ? altoTelaBbCm
          : r1(altoCm + (esPletinaFila ? 0 : params.extraAltoCm));
      const altoDuoCm = r1(altoCm * 2 + (esPletinaFila ? 0 : params.extraDuoCm));
      // Oscuridad: el alto de la tela ya viaja como columna ALTO TELA (alto+25)
      // desde el despiece; la columna ALTO genérica se omite para no duplicarla.
      // El beeblack va por lo mismo: su ALTO TELA es la medida buena y la
      // columna ALTO solo confundía al taller.
      if (altoCm > 0 && !esVerticalFila && !famOscFila && !esBee) {
        if (opts?.altoMesaCorteDuo && esDuoFila) {
          // Dimensionado: la tela dúo se corta DOBLADA en la mesa, así que en vez
          // del ALTO se muestra ALTO MESA DE CORTE = alto + extraMesaDuo (la mitad
          // del alto de tela), igual que la hoja dúo del Excel manual.
          despiece.set('ALTO MESA DE CORTE', r1(altoCm + params.extraMesaDuoCm));
        } else {
          despiece.set('ALTO', esDuoFila ? altoDuoCm : altoRollerCm);
        }
      }

      // Cadena y peso solo en los sistemas que llevan cadena de roller. Una OT
      // vieja puede traerlos guardados en un paño de PLETINA (velcro) —el paño va
      // pegado, no sube ni baja—: si igual se imprimieran, el taller buscaría una
      // cadena que la hoja de inventario ya no pide.
      const llevaCadena = categoriaLlevaCadenaRoller(v.categoria, reglas.tipos);
      const codCadena = llevaCadena ? (p.codCadena as string) || '' : '';
      const largoCadena = llevaCadena ? String(p.largoCadena ?? '') : '';
      const codPeso = llevaCadena ? (p.codPeso as string) || '' : '';
      // Color PROPIO del peso de cadena (PCA04→TRANSPARENTE), no el de accesorios.
      const colorPeso = llevaCadena ? colorPesoCadena(p) : '';
      const manillaCant = Number(p.manillaCant) || 0;
      // COD MECANISMO = el kit que entrega bodega, resuelto con el MISMO motor
      // que la hoja de Fase 4 (regla de categoría → kit inventario por color
      // 32/33/34, pisando los MEC legacy del modelo Excel como MEC_05/MEC_10).
      // Si no resuelve a un chip, cae al id del modelo (comportamiento previo).
      const lineaB = esLineaB(
        p as Pano,
        v.codInt as string | undefined,
        catalogo,
        v.categoria,
        reglas.mecanismo,
        reglas.tipos,
      );
      const mecChip = mecanismoParaPano(
        { ...p, mecanismo: p.mecanismo as string },
        v.color as string,
        v.modelo,
        opcMec,
        v.categoria,
        anchoM,
        opts?.usarTuboE78 ?? false,
        reglas,
        lineaB,
      );
      const codMecanismo =
        [mecChip, (p.colorMecanismo as string) || ''].filter(Boolean).join(' ') ||
        (v.modelo?.mecanismo as string) ||
        (p.mecanismo as string) ||
        '';

      filas.push({
        piezaId: `${v.id}_${i}`,
        codSec: v.categoria || '',
        // Descripción larga del tubo ("E02-TUBO 1.2 / Ø 38 mm"). El código
        // compacto sigue en tuberiaCodigoCorto para Excel/etiqueta/tela.
        tuberia: esBee
          ? ''
          : descripcionTuberia(
              tuberiaCodigoCorto(
                v.modelo,
                String(p.tuberia || ''),
                anchoM,
                v.categoria,
                reglas.tuberia,
                lineaB,
              ),
              reglas.tuberia,
            ),
        tipoRol: (v.modelo?.tipo_rol as string) || '',
        codMecanismo,
        accionamiento: codCadena
          ? `[${codCadena}] ${largoCadena}`.trim()
          : largoCadena,
        pesoCadena: codPeso ? `[${codPeso}] ${colorPeso}`.trim() : colorPeso,
        codCadena,
        largoCadena,
        colorCadena: String(p.colorCadena ?? ''),
        codPeso,
        suplementos: (p.suplementos as string) || '',
        manillas: manillaCant > 0 ? `${manillaCant} ${(p.manillaColor as string) || ''}`.trim() : '',
        // OSCURANTI: el taller necesita ver que el paño va girado, porque su corte
        // consume el ancho REAL (mayor que el nominal) y se invierte más seguido.
        conjunto: (() => {
          const j = juntoPorPieza?.get(`${v.id}_${i}`);
          if (!j) return '';
          return famOscFila === 'OSCURANTI' && j.invertida ? `${j.letra} (INVERTIDA)` : j.letra;
        })(),
        cant: 1,
        producto: tela.producto || '',
        codInt: tela.codInt || '',
        descripcion: catalogo[tela.codInt]?.descripcion || tela.descripcion || '',
        // Ventana en ángulo: el taller tiene que ver que estos paños arman UNA
        // sola ventana, no cortinas sueltas que se instalan por separado.
        ubic: [ubicPanoVentana(v.ubicacion || '', i, panos.length), rotuloVentana]
          .filter(Boolean)
          .join(' '),
        colorAcc: (p.color as string) || v.color || '',
        cadena: (v.direccion as string) || '',
        armado: (p.armado as string) || (v.sentido as string) || '',
        anchoMts: r1(anchoM * 1000) / 1000,
        altoMts: r1(altoM * 1000) / 1000,
        anchoCorteCm: r1(anchoCm),
        altoRollerCm,
        // Corte real del paño dúo (2×alto+extraDuo), alineado con tela.ts y el Excel.
        altoDuoCm,
        bloque: bloque.key,
        despiece,
      });
    });
  }

  // Columnas de identidad con datos.
  const identidad: ColumnaCalculo[] = IDENTIDAD.filter((c) =>
    filas.some((f) => conDato(f[c.key] as string | number)),
  ).map((c) => ({ key: c.key, label: c.label }));

  // Bloques de sistema presentes, en orden fijo, con sus columnas de despiece
  // (solo las que tienen datos en alguna cortina de ese sistema).
  const bloques: { sistema: BloqueSistema; columnas: ColumnaCalculo[] }[] = [];
  for (const bk of ORDEN_BLOQUES) {
    const sistema = BLOQUES[bk];
    const filasBloque = filasDeBloque(filas, bk);
    if (filasBloque.length === 0) continue;
    // Columnas = componentes con datos, en orden de aparición. El cuadro del
    // velcro lleva las suyas en orden fijo; las demás secciones las excluyen,
    // porque ya viven en ese cuadro.
    const cols: string[] = [];
    if (bk === BLOQUES.VELCRO.key) {
      cols.push(...COLUMNAS_VELCRO.filter((c) => filasBloque.some((g) => conDato(g.despiece.get(c)))));
    } else {
      for (const f of filasBloque) {
        for (const col of f.despiece.keys()) {
          if (COLUMNAS_VELCRO.includes(col)) continue;
          if (!cols.includes(col) && filasBloque.some((g) => conDato(g.despiece.get(col)))) {
            cols.push(col);
          }
        }
      }
    }
    if (cols.length === 0) continue;
    // Al final del bloque (como en la hoja manual): primero ALTO MESA DE CORTE
    // (dúo del Dimensionado), luego ALTO TELA (oscuridad), ALTO y, cerrando el
    // bloque soft light, el TIPO DE SOFT.LIGHT (variante por fila).
    for (const colFin of ['ALTO MESA DE CORTE', 'ALTO TELA', 'ALTO', 'TIPO SOFT LIGHT', 'TIPO DE BEEBLACK']) {
      const idx = cols.indexOf(colFin);
      if (idx >= 0) {
        cols.splice(idx, 1);
        cols.push(colFin);
      }
    }
    bloques.push({
      sistema,
      columnas: cols.map((col) => ({
        key: col,
        label: col === 'TIPO SOFT LIGHT' ? 'TIPO DE SOFT.LIGHT' : col,
        bloque: sistema,
      })),
    });
  }

  return { filas, identidad, bloques };
}

/**
 * El texto de una celda de IDENTIDAD, tal como sale en el papel: ancho y
 * alto reales con 3 decimales (son medidas de levantamiento) y un 0 que se
 * deja en blanco en vez de imprimirse.
 */
export function textoIdentidad(f: FilaCalculo, key: string): string {
  const raw = f[key as keyof FilaCalculo];
  if (NUM_IDENTIDAD.has(key as keyof FilaCalculo)) {
    return (raw as number).toFixed(3).replace('.', ',');
  }
  return raw === 0 ? '' : String(raw ?? '');
}

/** El texto de una celda de DESPIECE: los números a 2 decimales con coma. */
export function textoDespiece(f: FilaCalculo, key: string): string {
  const raw = f.despiece.get(key);
  return typeof raw === 'number' ? num(raw) : String(raw ?? '');
}

/** Variante de la hoja: mismo motor, distinto título y columnas visibles. */
export type VarianteHojaCalculo = {
  titulo: string;
  archivo: string;
  /** Columnas de identidad que se OMITEN (keys de FilaCalculo). */
  sinIdentidad?: ReadonlySet<string>;
  /** Componentes de despiece que se OMITEN (por label del bloque). */
  sinDespiece?: (label: string) => boolean;
  /** Agrega al final la columna CONJUNTO PAÑOS (letras de cortar junto). */
  conjuntoPanos?: boolean;
  /** En filas dúo, reemplaza la columna ALTO por ALTO MESA DE CORTE (tela doblada). */
  altoMesaCorteDuo?: boolean;
};

export const VARIANTE_CALCULO_GENERAL: VarianteHojaCalculo = {
  titulo: 'CÁLCULO GENERAL',
  archivo: 'CalculoGeneral',
};

/**
 * DIMENSIONADO: la hoja del cálculo general reducida a lo que usa la mesa de
 * dimensionado de tela — identidad de la cortina + medidas de corte de tela.
 * Fuera: tubería, color accesorios, cadena/cierre, armado, medidas de
 * levantamiento (ANCHO/ALTO mts), los cortes de metal (TUBO y PESO*, más el
 * PERFIL CABEZAL / VARILLA / CARRITOS de la vertical) y la CENEFA OVALADA
 * (no se dimensiona en esta mesa).
 */
// Metal y ferretería de la vertical: no se dimensionan en la mesa de tela.
// LAMAS, REPUESTO y ALTO DE CORTE sí quedan (la mesa corta la pieza con el
// alto de corte); el ALTO FINAL de la lama es dato del Cálculo General.
const SIN_DIMENSIONADO_VERTICAL = new Set([
  'PERFIL CABEZAL',
  'VARILLA',
  'CARRITOS',
  'ALTO FINAL',
]);

// Piezas de TALLER de los sistemas de oscuridad (Soft Light / Oscuranti / Dark):
// la cenefa (ovalada o cuadrada DEL/TRA, aluminio) y los perfiles los corta el
// taller, no la mesa de tela. La mesa solo ve TELA + ALTO TELA (+ el VELCRO de
// DARK, que sí es tela: ancho/alto tela velcro quedan en el Dimensionado).
// Los SEPARADORES (izq/der/base/superior, opcionales) también son aluminio: se
// filtran por prefijo en `sinDespiece`. El PERFIL SUPERIOR (rectangular 50×25 de
// oscuranti) igual: es perfil de taller, no tela.
const SIN_DIMENSIONADO_OSCURIDAD = new Set([
  'CENEFA', 'CENEFA DELANTERA', 'CENEFA TRASERA',
  'PERFIL LATERAL', 'PERFIL BASE', 'PERFIL SUPERIOR', 'TIPO DE SOFT.LIGHT',
]);

// BEEBLACK: la mesa de tela solo ve el paño de acordeón (ancho/alto de tela) y
// las LAMAS, que indican dónde cortar el ancho. Perfiles y manillas son aluminio
// de taller; los separadores ya se filtran por prefijo en `sinDespiece`.
const SIN_DIMENSIONADO_BEEBLACK = new Set([
  'PERFIL SUPERIOR (ANCHO)',
  'PERFIL INFERIOR (ANCHO)',
  'PERFIL LATERAL IZQ (ALTO)',
  'PERFIL LATERAL DER (ALTO)',
  'MANILLA IZQ (ALTO)',
  'MANILLA DER (ALTO)',
]);

export const VARIANTE_DIMENSIONADO: VarianteHojaCalculo = {
  titulo: 'DIMENSIONADO',
  archivo: 'Dimensionado',
  sinIdentidad: new Set(['tuberia', 'colorAcc', 'cadena', 'armado', 'anchoMts', 'altoMts']),
  sinDespiece: (label) =>
    label === 'TUBO' || label === 'PESO' || label.startsWith('PESO ') ||
    label.startsWith('CENEFA OVALADA') || // incluye "(CON/SIN TIRA)"
    label.startsWith('SEPARADOR') || // SUPERIOR / IZQUIERDO / DERECHO / BASE
    SIN_DIMENSIONADO_VERTICAL.has(label) ||
    SIN_DIMENSIONADO_OSCURIDAD.has(label) ||
    SIN_DIMENSIONADO_BEEBLACK.has(label),
  conjuntoPanos: true,
  altoMesaCorteDuo: true,
};

/** Aplica la variante a las columnas (puro, para test). */
export function aplicarVariante(
  data: CalculoGeneral,
  variante: VarianteHojaCalculo,
): Pick<CalculoGeneral, 'identidad' | 'bloques'> {
  const identidad = data.identidad.filter((c) => !variante.sinIdentidad?.has(c.key));
  const bloques = data.bloques
    .map((b) => ({
      ...b,
      columnas: b.columnas.filter((c) => !variante.sinDespiece?.(c.label)),
    }))
    .filter((b) => b.columnas.length > 0);
  return { identidad, bloques };
}

/**
 * Las filas que van en la sección de un bloque.
 *
 * Casi siempre son las de ese sistema. El VELCRO es la excepción: no es un
 * sistema sino un corte aparte de las cortinas DARK, así que sus filas son las
 * que traen medida de velcro, vengan del bloque que vengan.
 */
export function filasDeBloque(filas: FilaCalculo[], bloqueKey: string): FilaCalculo[] {
  if (bloqueKey === BLOQUES.VELCRO.key) {
    return filas.filter((f) =>
      COLUMNAS_VELCRO.some((c) => c !== COLUMNA_COD_VELCRO && conDato(f.despiece.get(c))),
    );
  }
  return filas.filter((f) => f.bloque === bloqueKey);
}

/**
 * Columnas de identidad que NO se muestran en el cuadro del velcro.
 *
 * El COD_IN es el código de la tela de la CORTINA. Al lado de COD. VELCRO se
 * leía como si la tira se cortara de esa tela, que es justo lo que este cuadro
 * viene a desmentir. Sigue estando en la sección de arriba, que es la de la
 * cortina.
 */
const SIN_IDENTIDAD_VELCRO = new Set(['codInt']);

export type SeccionHoja = {
  sistema: BloqueSistema;
  /** Las columnas de identidad de ESTA sección (el velcro muestra menos). */
  identidad: ColumnaCalculo[];
  columnas: ColumnaCalculo[];
  filas: FilaCalculo[];
};

/**
 * Las secciones que se dibujan, en orden fijo. Lo usan el PDF y la pantalla:
 * si cada uno armara su lista, un cambio acá saldría en un papel y no en el
 * otro.
 *
 * Un bloque de SISTEMA con filas arma su sección aunque se haya quedado sin
 * columnas —se ve solo la identidad, como en la hoja manual—. El del VELCRO no:
 * sin sus columnas no dice nada que la sección DARK no diga ya.
 */
export function seccionesDeHoja(
  data: Pick<CalculoGeneral, 'filas'>,
  bloques: { sistema: BloqueSistema; columnas: ColumnaCalculo[] }[],
  identidad: ColumnaCalculo[] = [],
): SeccionHoja[] {
  const cols = new Map(bloques.map((b) => [b.sistema.key, b.columnas]));
  const out: SeccionHoja[] = [];
  for (const bk of ORDEN_BLOQUES) {
    const filas = filasDeBloque(data.filas, bk);
    if (filas.length === 0) continue;
    const columnas = cols.get(bk) ?? [];
    if (bk === BLOQUES.VELCRO.key && columnas.length === 0) continue;
    out.push({
      sistema: BLOQUES[bk],
      identidad:
        bk === BLOQUES.VELCRO.key
          ? identidad.filter((c) => !SIN_IDENTIDAD_VELCRO.has(c.key))
          : identidad,
      columnas,
      filas,
    });
  }
  return out;
}
