// ─────────────────────────────────────────────────────────────────────
// MOTOR DE DESPIECE (Fase C del plan de descuentos de fabricación).
//
// Convierte la medida nominal vendida (ancho en cm) en las medidas de
// corte de cada componente, según el modelo del catálogo de descuentos.
// Reglas VALIDADAS contra OTs reales (3024/3029/3031) y el dueño
// (2026-06-12), que corrigen al README del Excel:
//   · corte tubo/pletina = ancho − dcto_tubo
//   · corte tela (ancho) = peso − suma_peso_cm   (la tela se cuelga del PESO,
//     0.1 más angosta que el peso = tubo − 0.4 − 0.1; confirmado OT 3074)
//   · peso               = tubo − 0.4  (constante de taller, confirmada en
//     todas las OTs reales; NO usa la columna suma_peso)
//   · cenefa ovalada     = ancho − dcto_tubo − dcto_cenefa
//   · DÚO peso interno   = baseTubo − dcto_tela_cm  (= MISMO ancho que la tela;
//     el peso interno se cose dentro de la tela. Validado con OT 3048.)
//   · DÚO peso U         = baseTubo − peso_u_duo_cm  (validado con OT 3048)
//   · cenefa del./tras.  = ancho − dcto_cenefa_del / dcto_cenefa_tra
// Nota: en DÚO, dcto_tela_cm (0.5) ES el descuento de la tela → fija también el
// ancho del peso interno. En roller la tela usa peso − suma_peso (ver abajo).
//
// `columnaExcel` corresponde a las COLUMNAS_CORTE que el optimizador
// legacy procesa al cargar el Excel de órdenes (multi-corte). La TELA no
// viaja en ese Excel (va por el flujo de telas), por eso va sin columna.
//
// Los sistemas de OSCURIDAD (SOFT_LIGHT*, DARK_ROLLER, OSCURANTI) tienen
// además perfiles que dependen de la INSTALACIÓN (a muro/piso, izq/der)
// y de reglas medida mayor/menor — eso NO está cubierto aún: el despiece
// de esos sistemas se marca `aproximado` y el taller debe revisarlo.
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────
import type { ModeloDespiece } from './tipos';
import {
  aplicarDefaultsPerfiles,
  cortesOscuridad,
  familiaOscuridad,
  familiaOscuridadConDiametro,
  formulasOscuridadParaTipo,
  normalizarMontajeBase,
  normalizarPerforacion,
  normalizarVarianteOscuridad,
  type MedidasPerfilesOscuridad,
  type PerfilesOscuridad,
} from './reglas-oscuridad';
import type { TipoCortina } from './tiposCortina';
import {
  cordonBeeblackCm,
  cortesBeeblack,
  esCategoriaBeeblack,
  esCierreVerticalBeeblack,
  normalizarVarianteBeeblack,
  type MedidasBeeblack,
  type TogglesBeeblack,
  type VarianteBeeblack,
} from './reglas-beeblack';
// Resolutor de color de accesorios (mecanismo → peso → cadena → tela → ventana).
// chips.ts NO importa despiece (solo reglas-mecanismo/tuberia), así que no hay ciclo.
import { colorAccesoriosDePano } from './chips';
import { codigoEstructura } from './codigos-estructura';
import type { ColorAccesorio } from './coloresAccesorio';
// La medida de la cenefa ovalada la comparte con el adicional CENF O de Fase 0:
// una sola fórmula para el Excel de órdenes, la etiqueta y el cálculo general.
// adicionales-cenefa no importa despiece, así que no hay ciclo.
import { medidaCorteCenefaOvaladaRoller } from './adicionales-cenefa';
import { FORMULAS_DEFAULT, type FormulasFamilias } from './formulasFamilias';

export type ContextoDespiece = {
  categoria?: string;
  sentido?: string | null;
  /** Alto nominal (cm) — necesario para perfiles laterales de oscuridad. */
  altoCm?: number;
  /** Tipo de cenefa del paño ('Cuadrada' activa la familia con cenefa cuadrada). */
  cenefa?: string | null;
  /** Variante de instalación elegida en Fase 2 (INTERNO|SEMI|EXTERNO). */
  oscuridadVariante?: string | null;
  /** Color de accesorios ya resuelto (solo el tubo del soft light 45 mm depende de él). */
  colorAccesorios?: string | null;
  /** Interruptores ON/OFF de perfiles (Fase 2). */
  perfiles?: PerfilesOscuridad;
  /** Medidas manuales (cm) que sobreescriben la calculada de cada perfil. */
  perfilesMedidas?: MedidasPerfilesOscuridad;
  /** VERTICAL: cm que se SUMAN al alto para el corte de tela (params.extraVerticalCm). */
  verticalExtraAltoCm?: number;
  /** VERTICAL: cm que se RESTAN al alto de corte para el alto final de la lama. */
  verticalDctoAltoFinalCm?: number;
  /** BEEBLACK: variante INTERNO | SEMI | EXTERNO. */
  beeblackVariante?: string | null;
  /** BEEBLACK: tipo de instalación (Fase 2). Solo mueve los perfiles laterales:
   *  EXTERNO + FUERA DEL MARCO usa alto + 2 en vez de alto + 1. */
  beeblackInstalacion?: string | null;
  beeblackToggles?: TogglesBeeblack;
  beeblackMedidas?: MedidasBeeblack;
  /** BEEBLACK con cierre DE ARRIBA ABAJO: ancho y alto cambian de papel. */
  beeblackCierreVertical?: boolean;
  /**
   * Fórmulas de corte editadas desde Admin → Catálogo técnico. Sin esto se
   * usan las de fábrica (`FORMULAS_DEFAULT`) y el despiece es el de siempre.
   */
  formulas?: FormulasFamilias;
  /**
   * Tipos de cortina propios creados desde Admin. Sirven para resolver la
   * categoría a su MOLDE y aplicar el parche de números del tipo.
   */
  tipos?: readonly TipoCortina[];
  /**
   * Categoría B (gama económica). Solo se usa para ROTULAR el peso interno con
   * su código real: en la línea A es E13 fijo, y en la B depende del color
   * (E79-B blanco / E71-B negro). Las MEDIDAS no cambian por línea.
   */
  lineaB?: boolean;
  /** Colores de accesorios del catálogo: sus códigos propios pisan las tablas. */
  colores?: readonly ColorAccesorio[];
};

export type CorteDespiece = {
  componente: string;
  /** Columna del Excel de órdenes del optimizador ('' = no viaja en él). */
  columnaExcel: string;
  medidaCm: number;
  /** Oscuridad: perforación del perfil (INTERNO/EXTERNO) — anotación de taller. */
  perforacion?: 'INTERNO' | 'EXTERNO';
  /** Oscuridad: perfil activo sin superficie elegida → medida pendiente (Fase 2). */
  pendienteMedida?: boolean;
};

export type Despiece = {
  cortes: CorteDespiece[];
  /** true en sistemas de oscuridad: faltan reglas de perfiles/instalación. */
  aproximado: boolean;
  notas: string[];
};

const SISTEMAS_OSCURIDAD = ['SOFT_LIGHT', 'SOFT_LIGHT_CENEFA_CUAD', 'DARK_ROLLER', 'OSCURANTI'];

/** Columna del Excel de órdenes para pesos de sistemas de oscuridad (≠ PESO roller). */
export const COLUMNA_PESO_OSCURIDAD = 'PESO SOFT LIGHT';

/** Regla de taller: el peso roller se corta SIEMPRE 0.4 cm menos que el tubo. */
export const PESO_VS_TUBO_CM = 0.4;

// ── VERTICAL (cortinas de lamas) ──
/** Ancho de cada lama vertical (cm): se sacan en dimensionado del corte único. */
export const ANCHO_LAMA_VERTICAL_CM = 8.9;
/** Un carrito cada 8 cm de varilla (la varilla se divide en este paso). */
export const PASO_CARRITO_VERTICAL_CM = 8;
/** Carrito EXTRA que se suma SIEMPRE después del floor (regla del taller 2026-08-03). */
export const EXTRA_CARRITO_VERTICAL = 1;
/** Lamas de TELA extra que se cortan de más, siempre, como repuesto (no se
 *  instalan: la ferretería —peso de lama, sujetador— es 1 por carrito). */
export const LAMAS_REPUESTO_VERTICAL = 2;
/** Default del +cm al alto para el corte de tela (= parametrosCorte.extraVerticalCm). */
export const EXTRA_ALTO_VERTICAL_DEFAULT_CM = 5;
/** Default de los cm que se restan al corte para el alto final de la lama. */
export const DCTO_ALTO_FINAL_VERTICAL_DEFAULT_CM = 13;

const r1 = (n: number) => Math.round(n * 10) / 10;

export type CalculoVertical = {
  /** Corte del perfil cabezal (aluminio) = ancho − dcto_tubo_cm. */
  perfilCabezalCm: number;
  /** Corte de la varilla = perfil cabezal − dcto_perfiles_cm. */
  varillaCm: number;
  /** Carritos: uno cada 8 cm de varilla (floor) MÁS uno de holgura. */
  carritos: number;
  /** Lamas que se instalan = una por carrito. */
  lamas: number;
  /** Lamas EXTRA de tela que se cortan de repuesto (0 si no hay lamas). */
  repuesto: number;
  /** Alto del corte de tela = alto + extra. 0 si no hay alto. */
  altoCorteCm: number;
  /** Alto de la lama ya terminada = alto de corte − descuento. 0 si no hay alto. */
  altoFinalCm: number;
};

/**
 * Fórmulas de taller de la cortina VERTICAL (validadas con el dueño 2026-07-21).
 * Los dos descuentos de aluminio salen del catálogo (`descuentos_modelo`, fila
 * sistema='VERTICAL'): `dcto_tubo_cm` es el del perfil cabezal y
 * `dcto_perfiles_cm` el de la varilla, que se encadena al perfil (NO al ancho).
 * Los cm de la tela son parámetros de corte editables, no del catálogo.
 */
export function calculoVertical(
  modelo: Pick<ModeloDespiece, 'dcto_tubo_cm' | 'dcto_perfiles_cm'>,
  anchoCm: number,
  altoCm: number,
  opts?: {
    extraAltoCm?: number;
    dctoAltoFinalCm?: number;
    /** Paso, carrito extra y repuesto editados en Admin. */
    formulas?: FormulasFamilias['vertical'];
  },
): CalculoVertical {
  const extra = opts?.extraAltoCm ?? EXTRA_ALTO_VERTICAL_DEFAULT_CM;
  const dctoFinal = opts?.dctoAltoFinalCm ?? DCTO_ALTO_FINAL_VERTICAL_DEFAULT_CM;
  const fv = opts?.formulas ?? FORMULAS_DEFAULT.vertical;
  const perfilCabezalCm = r1(anchoCm - modelo.dcto_tubo_cm);
  const varillaCm = r1(perfilCabezalCm - modelo.dcto_perfiles_cm);
  // Los que entran en la varilla (floor) más uno de holgura: el taller siempre
  // monta un carrito extra, incluso cuando la división da exacta.
  const carritos =
    varillaCm > 0 && fv.pasoCarritoCm > 0
      ? Math.floor(varillaCm / fv.pasoCarritoCm) + fv.extraCarrito
      : 0;
  // Una lama por carrito (igual que el peso de lama y el sujetador de bodega);
  // el repuesto es tela EXTRA que se corta aparte, no va montada.
  const lamas = carritos;
  const repuesto = lamas > 0 ? fv.lamasRepuesto : 0;
  const altoCorteCm = altoCm > 0 ? r1(altoCm + extra) : 0;
  const altoFinalCm = altoCorteCm > 0 ? r1(altoCorteCm - dctoFinal) : 0;
  return { perfilCabezalCm, varillaCm, carritos, lamas, repuesto, altoCorteCm, altoFinalCm };
}

function columnaPesoExcel(modelo: ModeloDespiece): string {
  return SISTEMAS_OSCURIDAD.includes(modelo.sistema) ? COLUMNA_PESO_OSCURIDAD : 'PESO';
}

/**
 * Rótulo del peso interno de un dúo, CON su código de bodega. En la línea A es
 * E13 fijo; en la B depende del color (E79-B blanco / E71-B negro, editable por
 * color en el catálogo técnico). Antes decía "(E13)" siempre y una cortina de
 * categoría B salía con el código equivocado en la hoja de estructura.
 */
function rotuloPesoInterno(ctx?: ContextoDespiece): string {
  const cod = codigoEstructura(
    'PESO INTERNO',
    ctx?.colorAccesorios ?? '',
    '',
    ctx?.colores,
    !!ctx?.lineaB,
  );
  return cod ? `Peso interno (${cod})` : 'Peso interno';
}

/**
 * Calcula el despiece de UNA cortina.
 * @param modelo  fila del catálogo de descuentos (snapshot)
 * @param anchoCm ancho nominal vendido, en cm
 * @param ctx     categoría y sentido de la ventana (Soft Light 38 mm)
 */
export function calcularDespiece(
  modelo: ModeloDespiece,
  anchoCm: number,
  ctx?: ContextoDespiece,
): Despiece {
  const cortes: CorteDespiece[] = [];
  const notas: string[] = [];
  if (!anchoCm || anchoCm <= 0) return { cortes, aproximado: false, notas: ['Sin ancho.'] };
  // Fórmulas editadas en Admin, o las de fábrica si la OT se calcula sin ellas.
  const f = ctx?.formulas ?? FORMULAS_DEFAULT;

  // ── BEEBLACK: cierre horizontal con lamas ──
  if (esCategoriaBeeblack(ctx?.categoria)) {
    const variante = normalizarVarianteBeeblack(
      ctx?.beeblackVariante ?? ctx?.sentido,
      'INTERNO',
    ) as VarianteBeeblack;
    const altoCm = ctx?.altoCm ?? 0;
    const cortesBb = cortesBeeblack(
      variante,
      anchoCm,
      altoCm,
      ctx?.beeblackToggles ?? {},
      ctx?.beeblackMedidas ?? {},
      !!ctx?.beeblackCierreVertical,
      ctx?.beeblackInstalacion,
      f.beeblack,
    );
    for (const c of cortesBb) {
      cortes.push({ componente: c.componente, columnaExcel: c.columnaExcel, medidaCm: c.medidaCm });
    }
    return { cortes, aproximado: false, notas };
  }

  // ── Sistemas de oscuridad: motor dedicado con fórmulas del Excel ──
  // (Soft Light 38/45, Soft Light con cenefa cuadrada, Oscuranti, Dark).
  // El diámetro del modelo manda: un soft light 38 mm sobre tubo 45 mm (banda
  // E78) usa el corte de tubo de 45 mm (cenefa/tela/peso no cambian).
  const familia = familiaOscuridadConDiametro(
    ctx?.categoria,
    ctx?.cenefa,
    modelo.diametro_tubo_mm,
    ctx?.tipos,
  );
  if (familia) {
    const variante = normalizarVarianteOscuridad(
      ctx?.oscuridadVariante ?? ctx?.sentido,
      'INTERNO',
    );
    const altoCm = ctx?.altoCm ?? 0;
    // Un tipo de cortina propio corta con la mecánica de su molde y sus
    // propios números (si el admin se los cambió).
    const fOsc = formulasOscuridadParaTipo(f.oscuridad, ctx?.categoria, familia);
    const cortesOsc = cortesOscuridad(
      familia,
      variante,
      anchoCm,
      altoCm,
      ctx?.perfiles ?? {},
      ctx?.perfilesMedidas ?? {},
      ctx?.colorAccesorios,
      fOsc,
    );
    for (const c of cortesOsc) {
      cortes.push({
        componente: c.componente,
        columnaExcel: c.columnaExcel,
        medidaCm: c.medidaCm,
        perforacion: c.perforacion,
        pendienteMedida: c.pendienteMedida,
      });
    }
    // ALTO de corte de la tela (reserva roller = alto + 25): lo usa la mesa de
    // dimensionado (Cálculo General, que lee el `componente`). NO viaja al Excel
    // de órdenes: esa hoja es de ESTRUCTURA y la tela no es una pieza de metal
    // (`columnaExcel: ''`, igual que el ancho de tela y el velcro de DARK).
    if (altoCm > 0) {
      cortes.push({
        componente: 'Alto tela',
        columnaExcel: '',
        medidaCm: r1(altoCm + f.oscuridad.altoTelaExtraCm),
      });
    }
    if (modelo.notas) notas.push(modelo.notas);
    return { cortes, aproximado: false, notas };
  }

  const esDuo = modelo.sistema === 'CENEFA_OVALADA_DUO' || modelo.sistema === 'PLETINA_DUO';
  const conTubo = modelo.diametro_tubo_mm > 0;

  // ── PLETINA (velcro, sin tubo): cada corte se descuenta DIRECTO del ancho
  //    (NO encadena tubo − 0.4 − suma como el roller/dúo con tubo; en la pletina
  //    el peso es MÁS ancho que la pletina). Fórmulas validadas con el Excel
  //    manual (ancho 80 → roller 79,2/79,2/79,3 · dúo 79,2/79,4/79,2). ──
  if (modelo.sistema === 'PLETINA_ROLLER' || modelo.sistema === 'PLETINA_DUO') {
    if (esDuo) {
      // La "tela y pletina" es la pieza combinada más ancha (col propia del Excel).
      cortes.push({
        componente: 'Tela y pletina',
        columnaExcel: 'TELA Y PLETINA',
        medidaCm: r1(anchoCm - modelo.dcto_tubo_cm),
      });
      if (modelo.peso_u_duo_cm > 0) {
        cortes.push({
          componente: 'Peso U (lágrima)',
          columnaExcel: 'PESO U',
          medidaCm: r1(anchoCm - modelo.peso_u_duo_cm),
        });
      }
      if (modelo.peso_interno_duo_cm > 0) {
        cortes.push({
          componente: rotuloPesoInterno(ctx),
          columnaExcel: 'PESO INTERNO',
          medidaCm: r1(anchoCm - modelo.peso_interno_duo_cm),
        });
      }
    } else {
      cortes.push({
        componente: 'Pletina',
        columnaExcel: 'PLETINA',
        medidaCm: r1(anchoCm - modelo.dcto_tubo_cm),
      });
      // Tela referencial (viaja por el flujo de telas / cálculo, no al Excel).
      if (modelo.dcto_tela_cm > 0) {
        cortes.push({
          componente: 'Tela (ancho)',
          columnaExcel: '',
          medidaCm: r1(anchoCm - modelo.dcto_tela_cm),
        });
      }
      if (modelo.suma_peso_cm > 0) {
        cortes.push({
          componente: 'Peso',
          columnaExcel: 'PESO',
          medidaCm: r1(anchoCm - modelo.suma_peso_cm),
        });
      }
    }
    if (modelo.notas) notas.push(modelo.notas);
    return { cortes, aproximado: false, notas };
  }

  // ── VERTICAL (lamas): el aluminio se encadena (ancho → perfil cabezal →
  //    varilla) y la varilla define cuántos carritos/lamas salen. La TELA se
  //    corta como la de un roller: una sola pieza de ancho real × (alto + extra),
  //    y de ahí se dimensionan después las lamas de 8,9 cm — por eso no hay un
  //    corte por lama. Validado con la planilla manual OT 2923. ──
  if (modelo.sistema === 'VERTICAL') {
    const cv = calculoVertical(modelo, anchoCm, ctx?.altoCm ?? 0, {
      extraAltoCm: ctx?.verticalExtraAltoCm,
      dctoAltoFinalCm: ctx?.verticalDctoAltoFinalCm,
      formulas: f.vertical,
    });
    cortes.push({
      componente: 'Perfil cabezal',
      columnaExcel: 'PERFIL CABEZAL',
      medidaCm: cv.perfilCabezalCm,
    });
    cortes.push({ componente: 'Varilla', columnaExcel: 'VARILLA', medidaCm: cv.varillaCm });
    // Carritos y lamas son CANTIDADES, no medidas (mismo patrón que el
    // 'TOTAL LAMAS CORTE' de beeblack: viajan por `medidaCm` a su columna).
    // El nombre del componente debe coincidir con la columna: el Cálculo
    // General arma sus columnas con `componente`, el Excel con `columnaExcel`.
    cortes.push({ componente: 'Carritos', columnaExcel: 'CARRITOS', medidaCm: cv.carritos });
    cortes.push({ componente: 'Lamas', columnaExcel: 'LAMAS', medidaCm: cv.lamas });
    cortes.push({ componente: 'Repuesto', columnaExcel: 'REPUESTO', medidaCm: cv.repuesto });
    if (cv.altoCorteCm > 0) {
      // Alto de corte de la tela (alto real + extra). `columnaExcel` se mantiene
      // como id interno; el guard vertical del Excel de órdenes igual lo bloquea.
      cortes.push({ componente: 'Alto de corte', columnaExcel: 'ALTO TELA', medidaCm: cv.altoCorteCm });
      // Alto final de la lama (corte − dcto). La etiqueta Brother la busca por
      // `columnaExcel: 'ALTO FINAL LAMA'`, así que ese id NO cambia.
      cortes.push({
        componente: 'Alto final',
        columnaExcel: 'ALTO FINAL LAMA',
        medidaCm: cv.altoFinalCm,
      });
    }
    if (modelo.notas) notas.push(modelo.notas);
    return { cortes, aproximado: false, notas };
  }

  // Cenefa ovalada elegida en el paño (Fase 2) sobre un modelo que no la trae en
  // sus descuentos: mismo criterio que el adicional CENF O de Fase 0.
  const cenefaOvaladaDelPano = String(ctx?.cenefa ?? '').trim().toUpperCase() === 'OVALADA';

  // En cenefa ovalada la TAPA (cenefa) es la pieza más ancha = ancho − dcto_cenefa,
  // y el TUBO va detrás, deducido por tubo + cenefa. (Antes el tubo restaba solo
  // dcto_tubo y la cenefa restaba ambos → quedaban invertidos vs. el manual.)
  const tieneCenefaOvalada = modelo.dcto_cenefa_cm > 0;
  const baseTubo =
    anchoCm - modelo.dcto_tubo_cm - (tieneCenefaOvalada ? modelo.dcto_cenefa_cm : 0);

  {
    // Tubo o pletina (en pletinas el dcto_tubo aplica a la pletina)
    if (modelo.dcto_tubo_cm > 0 || conTubo) {
      cortes.push({
        componente: conTubo ? 'Tubo' : 'Pletina',
        columnaExcel: conTubo ? 'TUBO' : 'PLETINA',
        medidaCm: r1(baseTubo),
      });
    }

    // Tela (ancho) = PESO − suma_peso_cm. La tela se cuelga del PESO (no del
    // tubo): queda 0.1 más angosta que el peso (= tubo − 0.4 − 0.1). Regla del
    // taller confirmada con OT 3074 (roller) y la cenefa ovalada. Referencial:
    // viaja por el flujo de telas, no por el Excel de órdenes.
    if (modelo.suma_peso_cm > 0) {
      const refTela = baseTubo - f.roller.pesoVsTuboCm; // = peso
      cortes.push({
        componente: 'Tela (ancho)',
        columnaExcel: '',
        medidaCm: r1(refTela - modelo.suma_peso_cm),
      });
    }

    // Pesos DÚO (validados con OT real 3048, ovalada 38 mm):
    //   · Peso interno (E13) → se corta al MISMO ancho que la tela = baseTubo −
    //     dcto_tela_cm. El peso interno se cose dentro de la bolsa de la tela,
    //     por eso va exactamente del ancho de la tela (regla "peso interno = tela"
    //     confirmada por el dueño). `peso_interno_duo_cm` solo marca que el modelo
    //     LLEVA peso interno; la medida la da dcto_tela_cm.
    //   · Peso U (lágrima)   = baseTubo − peso_u_duo_cm.
    if (esDuo) {
      // Tela dúo: en dúo NO corre la regla peso − suma_peso (suma_peso_cm=0);
      // el ancho de la tela lo fija dcto_tela_cm sobre el tubo. Referencial
      // (etiqueta/hoja cálculo): viaja por el flujo de telas, no por el Excel.
      if (modelo.dcto_tela_cm > 0) {
        cortes.push({
          componente: 'Tela (ancho)',
          columnaExcel: '',
          medidaCm: r1(baseTubo - modelo.dcto_tela_cm),
        });
      }
      if (modelo.peso_interno_duo_cm > 0) {
        cortes.push({
          componente: rotuloPesoInterno(ctx),
          columnaExcel: 'PESO INTERNO',
          medidaCm: r1(baseTubo - modelo.dcto_tela_cm),
        });
      }
      if (modelo.peso_u_duo_cm > 0) {
        cortes.push({
          componente: 'Peso U (lágrima)',
          columnaExcel: 'PESO U',
          medidaCm: r1(baseTubo - modelo.peso_u_duo_cm),
        });
      }
    } else if (conTubo || modelo.dcto_tubo_cm > 0) {
      // Regla de taller validada con OTs reales: peso = tubo − 0.4 SIEMPRE.
      cortes.push({
        componente: 'Peso',
        columnaExcel: columnaPesoExcel(modelo),
        medidaCm: r1(baseTubo - f.roller.pesoVsTuboCm),
      });
    }
  }

  // Cenefa ovalada: la TAPA cubre el ancho con su propio despeje = ancho − dcto_cenefa
  // (es la pieza más ancha; el tubo va detrás, ya deducido tubo + cenefa en baseTubo).
  //
  // También se emite cuando la cenefa la eligió el VENDEDOR en el paño y el
  // modelo no la trae en sus descuentos (roller simple, dual, pletina roller:
  // `dcto_cenefa_cm` = 0). Antes de esto la medida existía solo en el Excel de
  // órdenes —que la saca del adicional CENF O de Fase 0— y la etiqueta de
  // estructura salía con "CEF. OV.: N/A" en cortinas que sí la llevan (OT 3169).
  // La medida sale de la MISMA función que usa el Excel, así que ambos caminos
  // no pueden divergir. El TUBO no cambia: su gate sigue mirando el modelo.
  if (modelo.dcto_cenefa_cm > 0) {
    cortes.push({
      componente: 'Cenefa ovalada',
      columnaExcel: 'CENEFA OVALADA',
      medidaCm: r1(anchoCm - modelo.dcto_cenefa_cm),
    });
  } else if (cenefaOvaladaDelPano) {
    const medida = medidaCorteCenefaOvaladaRoller(anchoCm, modelo, f);
    if (medida != null) {
      cortes.push({ componente: 'Cenefa ovalada', columnaExcel: 'CENEFA OVALADA', medidaCm: medida });
    }
  }

  // Cenefas delantera/trasera (sistemas de oscuridad / cenefa cuadrada)
  if (modelo.dcto_cenefa_del_cm > 0) {
    cortes.push({
      componente: 'Cenefa delantera',
      columnaExcel: 'CENEFA DELANTERA',
      medidaCm: r1(anchoCm - modelo.dcto_cenefa_del_cm),
    });
  }
  if (modelo.dcto_cenefa_tra_cm > 0) {
    cortes.push({
      componente: 'Cenefa trasera',
      columnaExcel: 'CENEFA TRASERA',
      medidaCm: r1(anchoCm - modelo.dcto_cenefa_tra_cm),
    });
  }

  const aproximado = SISTEMAS_OSCURIDAD.includes(modelo.sistema);
  if (aproximado) {
    notas.push(
      'Sistema de oscuridad: los PERFILES dependen de la instalación (muro/piso, izq/der) y no se calculan aún — revisar manualmente.',
    );
  }
  if (modelo.notas) notas.push(modelo.notas);

  return { cortes, aproximado, notas };
}

/** Modelo vacío para calcularDespiece cuando la categoría no usa catálogo (BEEBLACK). */
export const MODELO_DESPIECE_STUB: import('./tipos').ModeloDespiece = {
  sistema: 'STUB',
  tipo_rol: 'STUB',
  mecanismo: '',
  codigos_tubo: '',
  diametro_tubo_mm: 0,
  dcto_tubo_cm: 0,
  dcto_tela_cm: 0,
  suma_peso_cm: 0,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 99,
  activo: true,
  notas: '',
};

/** Construye el contexto de despiece desde ventana + paño (Fase 2 / Excel). */
export function contextoDespieceDesdePano(
  v: { categoria?: string; sentido?: string | null; alto?: number | string; oscuridadVariante?: string | null; color?: string | null; direccion?: string | null },
  p: {
    alto?: number | string;
    cenefa?: string | null;
    oscuridadVariante?: string | null;
    color?: string | null;
    colorMecanismo?: string | null;
    colorPeso?: string | null;
    colorCadena?: string | null;
    perfilIzqMuro?: boolean;
    perfilIzqPiso?: boolean;
    perfilIzqMarco?: boolean;
    perfilDerMuro?: boolean;
    perfilDerPiso?: boolean;
    perfilDerMarco?: boolean;
    perfilInfMuro?: boolean;
    perfilInfPiso?: boolean;
    perfilInfMarco?: boolean;
    perfilIzqActivo?: boolean;
    perfilDerActivo?: boolean;
    perfilInfActivo?: boolean;
    perfilIzqPerf?: string;
    perfilDerPerf?: string;
    perfilInfPerf?: string;
    perfilInfMontaje?: string;
    perfilIzqMuroCm?: number;
    perfilIzqPisoCm?: number;
    perfilIzqMarcoCm?: number;
    perfilDerMuroCm?: number;
    perfilDerPisoCm?: number;
    perfilDerMarcoCm?: number;
    perfilInfMuroCm?: number;
    perfilInfPisoCm?: number;
    perfilInfMarcoCm?: number;
    separadorIzq?: boolean;
    separadorDer?: boolean;
    separadorInf?: boolean;
    separadorSup?: boolean;
    separadorIzqCm?: number;
    separadorDerCm?: number;
    separadorInfCm?: number;
    separadorSupCm?: number;
    beeblackVariante?: string | null;
    beeblackInstalacion?: string | null;
    beeblackManillaIzq?: boolean;
    beeblackManillaDer?: boolean;
    beeblackPerfilSupAnchoCm?: number;
    beeblackPerfilInfAnchoCm?: number;
    beeblackPerfilLatIzqCm?: number;
    beeblackPerfilLatDerCm?: number;
    beeblackManillaIzqCm?: number;
    beeblackManillaDerCm?: number;
    beeblackAnchoTelaCm?: number;
    beeblackAltoTelaCm?: number;
    beeblackTotalLamasCm?: number;
  },
  /** Parámetros de corte y fórmulas editables que el despiece necesita. */
  extras?: {
    verticalExtraAltoCm?: number;
    verticalDctoAltoFinalCm?: number;
    formulas?: FormulasFamilias;
    tipos?: readonly TipoCortina[];
    /** Categoría B: solo rotula el peso interno con su código (E79-B/E71-B). */
    lineaB?: boolean;
    /** Colores del catálogo, para el overlay de códigos por color. */
    colores?: readonly ColorAccesorio[];
  },
): ContextoDespiece {
  // El alto suele vivir en la VENTANA, no en el paño (igual que en tela.ts):
  // sin este fallback, vertical y oscuridad quedaban con altoCm = 0.
  const altoCm = (parseFloat(String(p.alto ?? v.alto ?? 0)) || 0) * 100;
  // Variante (Fase 1) y familia: para auto-activar los laterales con su
  // perforación (soft light / dark). Prioridad paño → ventana → sentido.
  const oscuridadVariante = p.oscuridadVariante ?? v.oscuridadVariante ?? v.sentido;
  const familiaOsc = familiaOscuridad(v.categoria, p.cenefa, extras?.tipos);
  const perfilesBase: PerfilesOscuridad = {
    izqMuro: p.perfilIzqMuro,
    izqPiso: p.perfilIzqPiso,
    izqMarco: p.perfilIzqMarco,
    derMuro: p.perfilDerMuro,
    derPiso: p.perfilDerPiso,
    derMarco: p.perfilDerMarco,
    infMuro: p.perfilInfMuro,
    infPiso: p.perfilInfPiso,
    infMarco: p.perfilInfMarco,
    izqActivo: p.perfilIzqActivo,
    derActivo: p.perfilDerActivo,
    infActivo: p.perfilInfActivo,
    izqPerf: normalizarPerforacion(p.perfilIzqPerf),
    derPerf: normalizarPerforacion(p.perfilDerPerf),
    infPerf: normalizarPerforacion(p.perfilInfPerf),
    infMontaje: normalizarMontajeBase(p.perfilInfMontaje),
    sepIzq: p.separadorIzq,
    sepDer: p.separadorDer,
    sepInf: p.separadorInf,
  };
  return {
    categoria: v.categoria,
    sentido: v.sentido,
    altoCm,
    verticalExtraAltoCm: extras?.verticalExtraAltoCm,
    verticalDctoAltoFinalCm: extras?.verticalDctoAltoFinalCm,
    formulas: extras?.formulas,
    tipos: extras?.tipos,
    lineaB: extras?.lineaB,
    colores: extras?.colores,
    cenefa: p.cenefa,
    oscuridadVariante,
    // Color de accesorios (mecanismo → peso → cadena → tela → ventana): solo el
    // tubo del soft light 45 mm lo usa (negro = cenefa − 2,9).
    colorAccesorios: colorAccesoriosDePano(p, v.color),
    perfiles: aplicarDefaultsPerfiles(
      perfilesBase,
      familiaOsc,
      normalizarVarianteOscuridad(oscuridadVariante),
    ),
    perfilesMedidas: {
      izqMuro: p.perfilIzqMuroCm,
      izqPiso: p.perfilIzqPisoCm,
      izqMarco: p.perfilIzqMarcoCm,
      derMuro: p.perfilDerMuroCm,
      derPiso: p.perfilDerPisoCm,
      derMarco: p.perfilDerMarcoCm,
      infMuro: p.perfilInfMuroCm,
      infPiso: p.perfilInfPisoCm,
      infMarco: p.perfilInfMarcoCm,
      sepIzq: p.separadorIzqCm,
      sepDer: p.separadorDerCm,
      sepInf: p.separadorInfCm,
    },
    beeblackVariante: p.beeblackVariante,
    // Instalación elegida en Fase 2 — el motor la canoniza contra la variante.
    beeblackInstalacion: p.beeblackInstalacion,
    // El cierre viene de la cotización (columna CIERRE de la planilla beeblack).
    beeblackCierreVertical: esCierreVerticalBeeblack(v.direccion),
    beeblackToggles: {
      manillaIzq: p.beeblackManillaIzq,
      manillaDer: p.beeblackManillaDer,
      // Separadores: mismos campos del paño que usa la oscuridad (+ el superior).
      sepIzq: p.separadorIzq,
      sepDer: p.separadorDer,
      sepSup: p.separadorSup,
      sepInf: p.separadorInf,
    },
    beeblackMedidas: {
      perfilSupAncho: p.beeblackPerfilSupAnchoCm,
      perfilInfAncho: p.beeblackPerfilInfAnchoCm,
      perfilLatIzq: p.beeblackPerfilLatIzqCm,
      perfilLatDer: p.beeblackPerfilLatDerCm,
      manillaIzq: p.beeblackManillaIzqCm,
      manillaDer: p.beeblackManillaDerCm,
      anchoTela: p.beeblackAnchoTelaCm,
      altoTela: p.beeblackAltoTelaCm,
      totalLamas: p.beeblackTotalLamasCm,
      sepIzq: p.separadorIzqCm,
      sepDer: p.separadorDerCm,
      sepSup: p.separadorSupCm,
      sepInf: p.separadorInfCm,
    },
  };
}

/**
 * Cm de cordón que consume un BEEBLACK (SML36/SML37), resueltos desde la
 * ventana y el paño igual que el resto del despiece: variante, cierre e
 * instalación salen del mismo contexto, así el cordón nunca se desfasa de los
 * perfiles con los que se calcula.
 */
export function cordonBeeblackDePano(
  v: Parameters<typeof contextoDespieceDesdePano>[0],
  p: Parameters<typeof contextoDespieceDesdePano>[1] & { ancho?: number | string },
  formulas?: FormulasFamilias,
): number {
  if (!esCategoriaBeeblack(v.categoria)) return 0;
  const ctx = contextoDespieceDesdePano(v, p, { formulas });
  const anchoCm = (parseFloat(String(p.ancho ?? 0)) || 0) * 100;
  const variante = normalizarVarianteBeeblack(
    ctx.beeblackVariante ?? ctx.sentido,
    'INTERNO',
  ) as VarianteBeeblack;
  return cordonBeeblackCm(
    variante,
    anchoCm,
    ctx.altoCm ?? 0,
    !!ctx.beeblackCierreVertical,
    ctx.beeblackInstalacion,
    (formulas ?? FORMULAS_DEFAULT).beeblack,
  );
}
