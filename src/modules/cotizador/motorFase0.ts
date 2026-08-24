
// ─────────────────────────────────────────────────────────────────────
// Motor de cálculo Fase 0 — réplica fiel del Excel "COTIZADOR FINAL".
//
// Cubre las 12 familias roller (Blackout, Screen, Dúo Blackout, Dúo Poliéster
// en Premium / Delux / Standard). Cada familia tiene su propia lista de
// materiales decodificada del Cotizador del Excel.
//
// Validado al peso contra cotizaciones reales:
//   - Dúo Blackout Delux  (Guillermo): exacto
//   - Dúo Blackout Premium (Jorge):    exacto
//   - Dúo Poliéster Premium (Francisco): ~1,7% (precio de tela poliéster a confirmar)
//
// El precio NO es ancho×alto×precio: es un precio/m² COMBINADO por familia =
// (tela optimizada + materiales + mano de obra + traslado) ÷ m² totales.
// Cada cortina = m² × precio/m² + instalación.
// ─────────────────────────────────────────────────────────────────────

import {
  EXTRA_ALTO_M,
  MARGEN_INSUMO,
  PARAMETROS_DEFAULT,
  calcularTotales,
  recargoTarjetaEfectivo,
  type ParametrosCotizador,
  type TotalesCotizacion,
} from './preciosFase0';
import {
  PASO_LAMA_M,
  REGLAS_PRECIOS_DEFAULT,
  SUFIJO_RECETA_B,
  SUFIJO_RECETA_INV,
  explicarCantidad,
  insumosDeSistema,
  lamasPorPasada,
  recetaBEsExacta,
  recetaInvEsExacta,
  resolverReceta,
  resolverRecetaB,
  resolverRecetaInv,
  sistemaCategoriaB,
  sistemaDeFila,
  sistemaInvertida,
  type CantidadReceta,
  type FiltroAncho,
  type LineaMaterialDesglose,
  type LineaReceta,
  type ReglasPrecios,
  type SistemaPrecio,
  type TelaVertical,
} from './reglasPrecios';
import type { CatalogoProductos } from './types';
import { letraPano } from './letras';

export type FilaFase0 = {
  codInt: string;
  ancho: number;
  alto: number;
  cantidad: number;
  descuento?: number; // 0-1 (ej. 0.20 = 20% off)
  /**
   * Ancho (m) que la pieza consume a lo ancho del rollo, cuando NO es el
   * nominal: en los sistemas de oscuridad y en el beeblack la tela se corta a
   * otra medida según el montaje (interno/semi/externo), que se elige recién en
   * Fase 2. Fase 1 manda acá el PEOR caso (`anchoEmpaquePeorCasoM` en
   * empaqueFase0.ts) para no cotizar menos tela de la que se va a gastar.
   * Solo afecta el EMPAQUE de paños; los m² y el precio unitario de la línea
   * siguen saliendo del ancho nominal de la ventana.
   */
  anchoEmpaqueM?: number;
  /**
   * Corte INVERTIDO (la pieza se rota 90° en el rollo): el alto real va A LO
   * ANCHO del rollo y el ancho de la cortina corre a lo largo — es lo que de
   * verdad se corta (`debeInvertirPano` en tela.ts, forzado o automático
   * cuando la cortina no entra en el rollo). Se cobra como el Excel
   * «COTIZADOR PARA CORTINAS MAYORES A 3,00 MTS» (dueño, 2026-08-21): cada
   * invertida gasta su propio tiro de rollo, de ancho + extra (el mismo 0,25
   * que lleva un alto), y las familias roller premium/delux pasan al sistema
   * INVERTIDA (tubo 63 mm E 47 + kit MEC 28, mano de obra y traslado propios,
   * en un panel aparte `cod|INV`). Los m² de la línea siguen saliendo de las
   * medidas vendidas. Una fila B invertida sigue siendo B.
   */
  invertida?: boolean;
  /**
   * Categoría B (gama económica): lo que muestra el distintivo A/B de la
   * grilla, forzado a mano o por la gama de la tela. Una fila B se cotiza con
   * el sistema CATEGORÍA B (`reglas.sistemas.categoriaB`): su receta, sus
   * precios de insumo, su mano de obra y su tela de referencia tecleada, en un
   * panel APARTE del de la A aunque sea la misma tela. Antes no llegaba al
   * motor y marcar B no movía un peso (dueño, 2026-08-21).
   */
  lineaB?: boolean;
  /**
   * A qué VENTANA pertenece esta fila. Solo lo usa la fila de instalación: el
   * Excel cuenta ventanas instaladas, no paños, así que un dual (dos telas en
   * la misma ventana, un solo bracket) se instala una vez. Sin este dato se
   * cuentan las piezas, como venía haciéndose.
   */
  ventanaId?: string;
};

/**
 * Sufijos de la CLAVE de un panel de precios: `cod|B` (categoría B), `cod|INV`
 * (corte invertido) o `cod|B|INV` (las dos). Coinciden con los de las recetas
 * (`BLACKOUT_D|B`, `BLACKOUT_D|INV`), pero un panel `cod|B|INV` usa la receta
 * B: la copia B del Excel no tiene panel de invertidas.
 */
export const SUFIJO_PANEL_B = SUFIJO_RECETA_B;
export const SUFIJO_PANEL_INV = SUFIJO_RECETA_INV;

export type LineaResultado = {
  codInt: string;
  cod: string;
  /** Panel del que salió el precio: `cod`, `cod|B`, `cod|INV` o `cod|B|INV`. */
  clave: string;
  lineaB: boolean;
  /** La tela se cobra cortada rotada (panel `…|INV`). */
  invertida: boolean;
  ancho: number;
  alto: number;
  cantidad: number;
  m2: number;
  valorUnit: number;
  descuento: number;
  total: number; // valorUnit × cantidad × (1 − descuento)
  /** Precio por m² combinado de su familia (lo que multiplica a los m²). */
  precioM2: number;
  /** Instalación incluida dentro del valorUnit. */
  instalacionEmbebida: number;
};

// Adicionales (cenefas, motores, instalaciones extra, controles, routers...).
// Se cobran a precio fijo del catálogo × cantidad, no entran en el blended
// de las familias de cortinas.
export type AdicionalFase0 = {
  codInt: string;
  cantidad: number;
  descuento?: number;
};

export type AdicionalResultado = {
  codInt: string;
  producto: string;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
  descuento: number;
  total: number;
};

export type ResultadoFamilia = {
  cod: string;
  /** `cod`, `cod|B`, `cod|INV` o `cod|B|INV`: la A, la B y la invertida de una misma tela son paneles distintos. */
  clave: string;
  lineaB: boolean;
  /** Panel de tela cortada rotada: ancho + extra a lo largo del rollo, un tiro por cortina. */
  invertida: boolean;
  /** Cotizado con el sistema INVERTIDA: tubo 63 mm + MEC 28, mano de obra y traslado propios. */
  sistemaInvertida: boolean;
  /**
   * Cortinas con las que se calculó la TARIFA: TODAS las de la familia,
   * configuradas como este panel (como si todas fueran B, o invertidas, o
   * ninguna). Los paños y los materiales de abajo son de esas piezas.
   */
  piezas: number;
  m2Total: number;
  /** Cuántas de esas cortinas se cobran de verdad con este panel, y sus m². */
  piezasCobradas: number;
  m2Cobrados: number;
  metrosTela: number;
  precioMl: number;
  costoTela: number;
  costoMateriales: number;
  manoObra: number;
  traslado: number;
  costoTotal: number;
  precioM2: number;
  exacto: boolean; // true si la receta de la familia está decodificada y validada
  // ── Desglose (lo que muestra el panel de precios del Admin) ──
  /** COD_INT de la tela que fijó el precio por metro. */
  arquetipoCodInt: string;
  /** Paños de tela y qué cortinas comparte cada uno (vacío en verticales). */
  panos: PanoPrecio[];
  /** Lista de materiales resuelta, línea por línea. */
  materiales: LineaMaterialDesglose[];
  /** Regalo incluido en el costo de la familia. */
  regalo: number;
  /** Solo verticales cobradas por lamas: de dónde salen los metros de tela. */
  lamas?: { total: number; porPasada: number; minimoUnaPasada: boolean };
  /** Nombre del sistema con reglas propias que cotizó esta familia (beeblack). */
  sistema?: string;
};

// Línea de instalación (regla "4+ cortinas roller = gratis" del Excel, hoja
// Formato de Cotización fila INSTALACIÓN). La instalación por cortina ya va
// EMBEBIDA en el VAL. UNIT de cada línea (precio/m² + instalación); esta línea
// replica la fila del Excel: cantidad = nº de cortinas roller/dúo, precio =
// instalación por cortina, con descuento 100% (gratis) al llegar al mínimo en
// RM, o el % de región (editable). Total 0 → no altera el subtotal (RM 4+).
/** Un tramo de la fila de instalación: las cortinas que se instalan al mismo precio. */
export type ParteInstalacion = {
  /** Nombre del sistema, o 'Roller' para las que van con las reglas normales. */
  sistema: string;
  cantidad: number;
  precioUnit: number;
  total: number;
};

export type InstalacionResultado = {
  cantidad: number; // nº de cortinas roller/dúo instalables
  precioUnit: number; // instalación por cortina
  descuento: number; // 0-1 aplicado a la línea
  total: number; // cantidad × precioUnit × (1 − descuento)
  gratis: boolean; // descuento >= 1
  region: boolean; // si se cotizó como región
  sinInstalacion: boolean; // true = cliente retira / solo cortina (sin instalación)
  /** El % lo puso la vendedora a mano y le ganó a la regla automática. */
  descuentoManual: boolean;
  /** Desglose cuando conviven sistemas que cobran distinto (roller + beeblack). */
  partes: ParteInstalacion[];
};

/** Algo que la cotización no pudo resolver y que cambia lo que se cobra. */
export type AvisoCotizacion = {
  /** `catalogo` = la tela no existe · `tela` = no se pudo fijar el $/m. */
  tipo: 'catalogo' | 'tela';
  /** COD_INT de la fila (tipo `catalogo`) o COD de la familia (tipo `tela`). */
  codigo: string;
  mensaje: string;
};

/**
 * Por qué la fila de instalación vale lo que vale, para el recuadro de totales.
 * El texto viejo decía «bajo el mínimo» siempre, incluso en una cotización de
 * región con más cortinas que el mínimo, y le contaba eso al cliente.
 */
export function textoInstalacion(i: InstalacionResultado, minGratis: number): string {
  const n = `${i.cantidad} ${i.cantidad === 1 ? 'cortina' : 'cortinas'}`;
  if (i.sinInstalacion) return `${n}, sin instalación`;
  if (i.descuentoManual) {
    const pct = Math.round(i.descuento * 100);
    return pct >= 100 ? `${n}, sin costo` : `${n}, ${pct} % de descuento`;
  }
  if (i.region) {
    const pct = Math.round(i.descuento * 100);
    return pct >= 100 ? `${n}, región: sin costo` : `${n}, región: ${pct} % de descuento`;
  }
  if (i.cantidad >= minGratis) return `${n}, ${minGratis} o más: sin costo`;
  return `${n}, bajo el mínimo de ${minGratis}`;
}

export type ResultadoCotizacion = {
  familias: ResultadoFamilia[];
  lineas: LineaResultado[];
  adicionales: AdicionalResultado[];
  instalacion: InstalacionResultado;
  subtotalNeto: number;
  totales: TotalesCotizacion;
  /**
   * Lo que quedó sin resolver. Vacío en una cotización sana. La UI los muestra
   * para que nadie mande un documento con una línea en $0 sin enterarse.
   */
  avisos: AvisoCotizacion[];
};

// ── Lista de materiales ───────────────────────────────────────────────
// La receta de cada familia y los precios de insumo son DATOS
// (`reglasPrecios.ts`), editables desde el Admin. Viajan como parámetro para
// que una cotización vieja se pueda recalcular con los precios de SU época:
// los goldens de este motor son cotizaciones reales y dejarían de calzar cada
// vez que sube un insumo. Por defecto, las reglas de fábrica.

/** Piezas de una familia, tal como se vendieron (alto SIN el extra de tela). */
type PiezaMaterial = { ancho: number; alto: number };

const enTramo = (ancho: number, f?: FiltroAncho): boolean =>
  (f?.min === undefined || ancho >= f.min) &&
  (f?.max === undefined || ancho <= f.max) &&
  (f?.mayorQue === undefined || ancho > f.mayorQue) &&
  (f?.menorQue === undefined || ancho < f.menorQue);

/**
 * Cuánto se necesita de un insumo, según su regla.
 *
 * `pasoLamaM` es cada cuánto se monta una lama: gobierna los carritos, los
 * pesos y los espaciadores de una vertical. Es el MISMO número con el que se
 * cobra la tela por lamas (`metrosTelaVerticalPorLamas`); antes acá estaba
 * clavado en `÷ 0,8 × 10` (= ÷ 0,08), así que editar el paso en Admin movía la
 * tela y dejaba la ferretería contada con el paso viejo.
 */
function cantidadDeLinea(
  q: CantidadReceta,
  piezas: PiezaMaterial[],
  pasoLamaM: number = PASO_LAMA_M,
): number {
  switch (q.tipo) {
    case 'porCortina':
      return piezas.filter((p) => enTramo(p.ancho, q.filtroAncho)).length * (q.factor ?? 1);
    case 'porCortinaCuadrado':
      return piezas.length * piezas.length * (q.factor ?? 1);
    case 'sumaAnchos': {
      const suma = piezas
        .filter((p) => enTramo(p.ancho, q.filtroAncho))
        .reduce((s, p) => s + p.ancho, 0);
      return (suma + (q.masFijoM ?? 0)) * (q.factor ?? 1);
    }
    case 'sumaAltos':
      return piezas.reduce((s, p) => s + p.alto, 0) * (q.factor ?? 1);
    case 'fijo':
      return q.cantidad;
    case 'lamas': {
      const paso = pasoLamaM > 0 ? pasoLamaM : PASO_LAMA_M;
      return (piezas.reduce((s, p) => s + p.ancho, 0) / paso) * (q.factor ?? 1);
    }
  }
}

/**
 * Resuelve la lista de materiales de una familia: cuánto de cada insumo y a
 * qué precio. Devuelve las líneas además del total porque el desglose del
 * Admin muestra exactamente esta tabla (es el panel de colores del Excel).
 *
 * Las líneas se suman EN EL ORDEN de la receta: así el total sale igual al del
 * cálculo anterior hasta el último decimal.
 */
export function materialesFamilia(
  receta: LineaReceta[],
  piezas: PiezaMaterial[],
  insumos: ReglasPrecios['insumos'],
  margenInsumo: number = MARGEN_INSUMO,
  /** Paso de lama vigente: solo lo usan las líneas de tipo `lamas` (verticales). */
  pasoLamaM: number = PASO_LAMA_M,
): { lineas: LineaMaterialDesglose[]; total: number } {
  const lineas: LineaMaterialDesglose[] = [];
  let total = 0;
  for (const l of receta) {
    const ins = insumos[l.insumo];
    const valorMaximo = ins?.valorMaximo ?? 0;
    const precioUnit = l.precio === 'costo' ? valorMaximo : valorMaximo / margenInsumo;
    const cantidad = cantidadDeLinea(l.cantidad, piezas, pasoLamaM);
    const sub = precioUnit * cantidad;
    total += sub;
    lineas.push({
      insumo: l.insumo,
      descripcion: ins?.descripcion ?? '',
      regla: explicarCantidad(l.cantidad, pasoLamaM),
      precio: l.precio,
      precioUnit,
      cantidad,
      total: sub,
      ...(l.nota ? { nota: l.nota } : {}),
    });
  }
  return { lineas, total };
}

// Alto real: alto + extra (default 0,25 m); si es dúo, se duplica
// (Optimizador del Excel). El extra vigente por empresa viene de
// params.extraAltoCm — cambiarlo cambia los metros de tela y el precio,
// igual que la celda del Excel.
function altoRealM(alto: number, esDuo: boolean, extraAltoM: number = EXTRA_ALTO_M): number {
  const conExtra = alto + extraAltoM;
  return esDuo ? conExtra * 2 : conExtra;
}

// Metros de tela (paños roller): se ordena por ancho ascendente y se
// acumulan los anchos en un mismo paño hasta llenar el rollo; al exceder
// se abre un paño nuevo. El alto del paño = MAX alto real de sus cortinas.
// MTS = suma de los altos de paño.
//
// Validado al peso contra cotizaciones reales (Guillermo, Jorge, Francisco,
// Felipe-SCREEN_P, Felipe-BLACKOUT_D). El bug previo (exigir mismo alto para
// agrupar) hacía que MTS quedara sobreestimado en cortinas con alturas casi
// iguales y anchos chicos, inflando el precio.
/** Un paño de tela: qué cortinas se cortan de él y cuánto mide. */
export type PanoPrecio = {
  /** Letra con la que el Excel rotula el paño (A, B, C…). */
  letra: string;
  /** Alto que manda: el mayor de las cortinas que comparten el paño. */
  alto: number;
  /** Ancho ocupado del rollo. */
  ancho: number;
  /** Índices de las cortinas de la familia que salen de este paño. */
  cortinas: number[];
};

/** Pieza que entra al empaque. `anchoEmpaque` (peor caso de oscuridad, o el
 *  alto real de una pieza invertida) manda sobre el nominal cuando viene; ver
 *  `FilaFase0.anchoEmpaqueM`. `largoRollo` es lo que la pieza consume A LO
 *  LARGO del rollo cuando no es su alto real (pieza invertida: su ancho). */
type PiezaEmpaque = {
  ancho: number;
  altoReal: number;
  anchoEmpaque?: number;
  largoRollo?: number;
};

/** Lo que la pieza ocupa a lo ancho del rollo. */
const anchoOcupado = (p: PiezaEmpaque) =>
  typeof p.anchoEmpaque === 'number' && p.anchoEmpaque > 0 ? p.anchoEmpaque : p.ancho;

/** Lo que la pieza consume a lo largo del rollo (los metros que se cobran). */
const largoOcupado = (p: PiezaEmpaque) =>
  typeof p.largoRollo === 'number' && p.largoRollo > 0 ? p.largoRollo : p.altoReal;

/** ¿La pieza va rotada en el rollo (consume su ancho a lo largo)? */
const esInvertida = (p: PiezaEmpaque) => typeof p.largoRollo === 'number' && p.largoRollo > 0;

/**
 * Arma los paños. Es la parte del cálculo que hace que dos cortinas angostas
 * de la misma tela compartan tiro y la de menor alto viaje gratis.
 *
 * Las piezas INVERTIDAS no comparten tiro: cada una es su propio paño, como el
 * Optimizador del Excel de cortinas mayores a 3,00 m, que suma `ancho + 0,25`
 * por cortina sin mirar si dos cabrían a lo ancho del rollo (dueño,
 * 2026-08-21: los precios tienen que calzar con esa planilla).
 */
export function empacarPanos(piezas: PiezaEmpaque[], anchoRollo: number): PanoPrecio[] {
  const indexadas = piezas.map((p, i) => ({ ...p, i }));
  const ordenadas = indexadas
    .filter((p) => !esInvertida(p))
    .sort((a, b) => anchoOcupado(a) - anchoOcupado(b));
  const panos: PanoPrecio[] = [];
  let acc = 0;
  for (const p of ordenadas) {
    const ocupa = anchoOcupado(p);
    const largo = largoOcupado(p);
    const excede = acc + ocupa > anchoRollo;
    if (panos.length === 0 || excede) {
      panos.push({ letra: '', alto: largo, ancho: ocupa, cortinas: [p.i] });
      acc = ocupa;
    } else {
      const last = panos[panos.length - 1];
      last.ancho += ocupa;
      last.alto = Math.max(last.alto, largo);
      last.cortinas.push(p.i);
      acc += ocupa;
    }
  }
  for (const p of indexadas.filter(esInvertida)) {
    panos.push({ letra: '', alto: largoOcupado(p), ancho: anchoOcupado(p), cortinas: [p.i] });
  }
  // Letras A…Z, AA, BB…: con >26 paños el fromCharCode de antes
  // imprimía basura ('[', '\'…) en el desglose del probador.
  return panos.map((p, i) => ({ ...p, letra: letraPano(i + 1) }));
}

/** Metros de tela de una familia roller/dúo: la suma de los altos de paño. */
export function metrosTelaPorPanos(piezas: PiezaEmpaque[], anchoRollo: number): number {
  return empacarPanos(piezas, anchoRollo).reduce((s, p) => s + p.alto, 0);
}

/**
 * ¿Esta familia tiene una receta propia, decodificada del Excel y validada
 * contra cotizaciones reales? Las que no, se cotizan con una receta de
 * respaldo, y el desglose lo dice.
 *
 * Beeblack: su receta salió de la copia beeblack del Excel y calza al peso con
 * la cotización COTAP-8003 (la copia canónica desde el 2026-08-19; la de
 * COTJS-10384 tiene rota la celda del riel y su golden pasa SU receta).
 * Verticales: las 6 comparten la receta VERTICAL,
 * que calza fórmula por fórmula con la hoja «Cotizador Verticales».
 *
 * Antes esto devolvía seis campos (isDuo, isScreen, gama…) de los que solo se
 * usaba `exacto`: eran restos del cálculo hardcodeado, y el motor deduce dúo y
 * vertical por otra vía —que además mira el NOMBRE del producto, no solo el
 * COD—, así que tenerlos acá invitaba a usar la deducción equivocada.
 */
function recetaEsExacta(cod: string): boolean {
  return (
    /^(BLACKOUT|SCREEN|DUOBK|DUOPOLI)_(P|D|S)$/.test(cod) ||
    /^(BLACKOUT|SCREEN)_V_(P|D|S)$/.test(cod) ||
    /^BEE_(BK|MOSQ|TRAS)$/.test(cod)
  );
}

// ── VERTICALES ────────────────────────────────────────────────────────
// Metros de tela vertical: cada cortina usa altoReal × nº de paños, donde
// nº de paños = redondear hacia arriba (ancho / ancho de rollo).
export function metrosTelaVertical(
  piezas: { ancho: number; altoReal: number }[],
  anchoRollo: number,
): number {
  return piezas.reduce(
    (s, p) => s + p.altoReal * Math.max(1, Math.ceil(p.ancho / anchoRollo)),
    0,
  );
}

/**
 * Metros de tela vertical cobrando lo que de verdad se consume.
 *
 * Una vertical no se corta como un paño: el rollo se gira y se hacen PASADAS
 * de las que salen tiras de 8,9 cm. Cada pasada rinde `lamasPorPasada` lamas y
 * baja `altoReal` metros de rollo, así que una cortina que usa la mitad de una
 * pasada paga media pasada. Contar pasadas enteras (lo que hace el Excel) hace
 * que una cortina apenas más ancha pague el doble, y el sobrante de la segunda
 * pasada igual se guarda y se usa en la cortina siguiente.
 *
 * Las lamas se cuentan con la misma regla que usa la receta para carritos y
 * pesos: `ancho ÷ paso`.
 *
 * Con `minimoUnaPasada` el piso es una pasada por cortina: nadie paga menos
 * tela de la que paga hoy, y el escalón del doble desaparece igual.
 */
export function metrosTelaVerticalPorLamas(
  piezas: { ancho: number; altoReal: number }[],
  telaVertical: TelaVertical,
): number {
  const porPasada = lamasPorPasada(telaVertical);
  const piso = telaVertical.minimoUnaPasada ? 1 : 0;
  return piezas.reduce((s, p) => {
    const pasadas = lamasDeCortina(p.ancho, telaVertical) / porPasada;
    return s + Math.max(piso, pasadas) * p.altoReal;
  }, 0);
}

/** Cuántas lamas lleva una cortina de este ancho. */
export const lamasDeCortina = (ancho: number, telaVertical: TelaVertical): number =>
  ancho / (telaVertical.pasoLamaM > 0 ? telaVertical.pasoLamaM : PASO_LAMA_M);

// Precio de tela (CLP/m) por familia:
// - Vertical: precio del COD_INT base del roller equivalente (regla del Excel).
// - Roller / dúo: precio del ARQUETIPO de la familia (SC-P, BK-D…). El Excel
//   usa ese valor fijo por gama, no el MAX; el MAX se inflaba con códigos
//   sueltos o BEEBLACK mal etiquetados (ej. SCREEN_P a 48.415 vs arquetipo
//   31.582), sobreprecio que se veía sobre todo en SCREEN.
// - Beeblack: arquetipo vacío A PROPÓSITO → el MAX de la familia, que es el
//   `MAXIFS` literal del Excel.
//
// Si la tela de referencia no está en el catálogo o vale 0, se cae al MÁXIMO de
// la familia. Antes la rama vertical retornaba 0 y la familia terminaba
// cobrando la primera tela que hubiera creado el grupo, así que el precio
// dependía del ORDEN de las filas de la cotización; y con un `baseVertical`
// roto la tela salía gratis. Ahora hay un solo respaldo para todos, que además
// es el que la pantalla del Admin viene prometiendo.
//
// El Excel redondea al peso (ej. 41.868 en vez de 41.867,69) → Math.round.
// Devuelve QUÉ tela fijó el precio y POR QUÉ, que es lo que muestra el
// desglose. Exportada para que el Admin muestre el $/m con que se cobra cada
// familia sin repetir esta cascada (si divergiera, mostraría un precio que no
// es el que cobra la app).

/** De dónde salió el $/m de una familia. */
export type MotivoPrecioMl = 'base' | 'arquetipo' | 'maximo' | 'sistema' | 'sinPrecio';

export function precioMlPorCod(
  cod: string,
  catalogo: CatalogoProductos,
  reglas: ReglasPrecios,
  /** El sistema con que se cotiza el grupo: su tela tecleada por familia manda. */
  sistema?: SistemaPrecio,
): { precio: number; arquetipo: string; motivo: MotivoPrecioMl } {
  // La celda «PRECIO REAL» tecleada del panel (categoría B): gana sobre todo.
  const tecleado = sistema?.telaPorFamilia?.[cod];
  if (typeof tecleado === 'number' && tecleado > 0) {
    return { precio: Math.round(tecleado), arquetipo: '', motivo: 'sistema' };
  }
  const baseV = reglas.baseVertical[cod];
  if (baseV) {
    const pBase = Number(catalogo[baseV]?.precio) || 0;
    if (pBase > 0) return { precio: Math.round(pBase), arquetipo: baseV, motivo: 'base' };
  }
  const arq = reglas.arquetipos[cod];
  if (arq) {
    const pArq = Number(catalogo[arq]?.precio) || 0;
    if (pArq > 0) return { precio: Math.round(pArq), arquetipo: arq, motivo: 'arquetipo' };
  }
  let max = 0;
  let codIntMax = '';
  for (const k of Object.keys(catalogo)) {
    const p = catalogo[k];
    if (p && p.cod === cod) {
      const precio = Number(p.precio) || 0;
      if (precio > max) { max = precio; codIntMax = k; }
    }
  }
  return {
    precio: Math.round(max),
    arquetipo: codIntMax,
    motivo: max > 0 ? 'maximo' : 'sinPrecio',
  };
}

// ── Cálculo principal ─────────────────────────────────────────────────
export function cotizarFase0(
  filas: FilaFase0[],
  catalogo: CatalogoProductos,
  anchoRolloMap: Record<string, number>,
  adicionales: AdicionalFase0[] = [],
  params: ParametrosCotizador = PARAMETROS_DEFAULT,
  region = false,
  sinInstalacion = false,
  reglas: ReglasPrecios = REGLAS_PRECIOS_DEFAULT,
  /**
   * El % de descuento de la instalación puesto a mano (0–1), que le gana a la
   * regla automática (gratis por cantidad / región). `null` = la regla manda.
   * Existe porque la instalación es una línea más de ADICIONALES y la
   * vendedora la negocia como cualquier otra, sobre todo a región.
   */
  descuentoInstalacionManual: number | null = null,
): ResultadoCotizacion {
  const validas = filas.filter((f) => f.codInt && f.ancho > 0 && f.alto > 0);

  // `anchoEmpaque` solo viaja al empaque de paños: `m2` (y con él el precio de
  // la línea) se calcula SIEMPRE con el ancho nominal de la ventana.
  type Pieza = {
    ancho: number;
    alto: number;
    altoReal: number;
    m2: number;
    anchoEmpaque?: number;
    largoRollo?: number;
  };
  /**
   * Lo que deciden los botones de la grilla para una fila: categoría B y corte
   * invertido. Con eso se elige el sistema (familia > B > invertida) y la CLAVE
   * del panel: `cod`, `cod|B`, `cod|INV` o `cod|B|INV`.
   */
  type Config = {
    clave: string;
    lineaB: boolean;
    /** La tela se corta rotada (ancho + extra a lo largo del rollo, un tiro por cortina). */
    invertida: boolean;
    /** Cotizada con el sistema INVERTIDA: tubo 63 mm + MEC 28, mano de obra y traslado propios. */
    sistemaInv: boolean;
    sistema?: SistemaPrecio;
  };
  type FilaResuelta = {
    f: FilaFase0;
    cod: string;
    esDuo: boolean;
    esVertical: boolean;
    anchoRollo: number;
    config: Config;
  };
  type Grupo = {
    cod: string;
    /** `cod`, `cod|B`, `cod|INV` o `cod|B|INV`: paneles distintos de una misma tela. */
    clave: string;
    lineaB: boolean;
    invertida: boolean;
    sistemaInv: boolean;
    esDuo: boolean;
    esVertical: boolean;
    anchoRollo: number;
    precioMl: number;
    arquetipo: string;
    /** TODAS las cortinas de la familia, configuradas como este panel. */
    piezas: Pieza[];
    /** Cuántas de esas piezas se cobran de verdad con este panel, y sus m². */
    piezasCobradas: number;
    m2Cobrados: number;
    /** Sistema con reglas propias (beeblack, categoría B, invertida), si el panel va con uno. */
    sistema?: SistemaPrecio;
  };
  const avisos: AvisoCotizacion[] = [];
  const avisado = new Set<string>();
  const avisar = (a: AvisoCotizacion) => {
    const k = `${a.tipo}|${a.codigo}`;
    if (avisado.has(k)) return;
    avisado.add(k);
    avisos.push(a);
  };

  /** Metros que se suman al alto vendido: el sistema manda sobre el parámetro. */
  const extraAltoDe = (sis?: SistemaPrecio) => sis?.extraAltoM ?? params.extraAltoCm / 100;

  // La categoría B es un sistema que se elige POR FILA, no por familia: la
  // misma tela va al panel A o al panel B según el distintivo de la grilla.
  // Un beeblack marcado B sigue siendo beeblack (no tiene categoría B).
  // Una invertida de familia roller premium/delux va al panel INVERTIDA
  // (tubo 63 mm, mano de obra y traslado propios); la de otras familias (y la
  // B invertida, que sigue siendo B) conserva su receta y solo gasta la tela a
  // lo largo del rollo, en un panel propio `cod|INV` / `cod|B|INV`.
  const configDe = (cod: string, lineaB: boolean, invertida: boolean): Config => {
    const sistema = sistemaDeFila(cod, lineaB, reglas.sistemas, invertida);
    const enB = lineaB && !!sistema && sistema === sistemaCategoriaB(reglas.sistemas);
    const sistemaInv = invertida && !!sistema && sistema === sistemaInvertida(reglas.sistemas);
    return {
      clave: `${cod}${enB ? SUFIJO_PANEL_B : ''}${invertida ? SUFIJO_PANEL_INV : ''}`,
      lineaB: enB,
      invertida,
      sistemaInv,
      sistema,
    };
  };

  // ── 1. Cada fila → su familia y su configuración ─────────────────────
  const resueltas: (FilaResuelta | null)[] = validas.map((f) => {
    const prod = catalogo[f.codInt];
    if (!prod) {
      // Sin producto no hay familia, ni receta, ni precio: la línea vale 0 y se
      // avisa. Antes caía igual en la rama final de instalación y esa cortina
      // fantasma se cobraba a $17.500.
      avisar({
        tipo: 'catalogo',
        codigo: f.codInt,
        mensaje: `«${f.codInt}» no está en el catálogo de productos: esa cortina se cotiza en $0.`,
      });
      return null;
    }
    const cod = prod.cod || f.codInt;
    const nombre = (prod.producto || '').toUpperCase();
    const esDuo = cod.startsWith('DUO') || nombre.includes('DUO');
    const esVertical = /(_V_|-V$|-V-)/.test(cod) || nombre.includes('VERTICAL');
    // Las VERTICALES no entran a la categoría B: la copia B del Excel no trae
    // ninguna (ni receta, ni mano de obra, ni instalación de vertical), así que
    // se cotizan con las reglas de siempre aunque su tela sea de gama B. Y se
    // cobran por lamas/pasadas: no se invierten.
    return {
      f,
      cod,
      esDuo,
      esVertical,
      // Ancho de rollo de respaldo (2,45 histórico del Excel de precios, ≠
      // 2,98 del corte de tela): último recurso, en producción
      // ancho_rollo_data o el catálogo resuelven antes. `||` y no `??`: un
      // ancho guardado en 0 tiene que caer al respaldo, si no cada pieza se
      // va a un paño propio y la tela se cobra de más.
      anchoRollo: anchoRolloMap[f.codInt] || Number(prod.anchoRollo) || reglas.anchoRolloFallbackM,
      config: configDe(cod, !!f.lineaB && !esVertical, !!f.invertida && !esVertical),
    };
  });
  /** Clave del panel de cada fila válida (null = sin producto). */
  const codDeFila: (string | null)[] = resueltas.map((r) => r?.config.clave ?? null);

  // ── 2. Paneles ────────────────────────────────────────────────────────
  // Por familia, un panel por configuración presente, y CADA panel se arma con
  // TODAS las cortinas de la familia configuradas como él: la fila B se cobra a
  // la tarifa que tendría la familia si todas fueran B (la copia B del Excel
  // cotiza el libro entero como B), la invertida como si todas fueran
  // invertidas (la planilla de cortinas mayores solo tiene invertidas), y las
  // demás como si ninguna estuviera marcada. Así marcar o invertir una cortina
  // mueve SOLO su precio —antes sacaba la pieza del panel de las otras, que
  // se repartían la tela y el traslado entre menos metros y se movían todas
  // (dueño, 2026-08-21)—, el traslado nunca se cobra dos veces y una
  // cotización toda-A, toda-B o toda-invertida da exactamente lo de siempre.
  const porFamilia = new Map<string, FilaResuelta[]>();
  for (const r of resueltas) {
    if (!r) continue;
    const lista = porFamilia.get(r.cod);
    if (lista) lista.push(r);
    else porFamilia.set(r.cod, [r]);
  }
  const grupos = new Map<string, Grupo>();
  for (const [cod, filasFam] of porFamilia) {
    const configs = new Map<string, Config>();
    for (const r of filasFam) if (!configs.has(r.config.clave)) configs.set(r.config.clave, r.config);
    // Dúo/vertical y ancho de rollo son de la familia: los de su primera fila.
    const { esDuo, esVertical, anchoRollo } = filasFam[0];
    for (const [clave, c] of configs) {
      const tela = precioMlPorCod(cod, catalogo, reglas, c.sistema);
      if (tela.motivo === 'sinPrecio') {
        avisar({
          tipo: 'tela',
          codigo: cod,
          mensaje:
            `La familia «${cod}» no tiene ninguna tela con precio en el catálogo: ` +
            'su tela se cotiza en $0. Revisa Admin → Precios → Tela de referencia.',
        });
      }
      const extraAlto = extraAltoDe(c.sistema);
      const piezas: Pieza[] = [];
      let piezasCobradas = 0;
      let m2Cobrados = 0;
      for (const r of filasFam) {
        const altoReal = altoRealM(r.f.alto, esDuo, extraAlto);
        // Pieza INVERTIDA (rotada 90°): el alto real ocupa el ancho del rollo y
        // lo que se consume a lo largo es el ancho de la cortina (o su peor caso
        // de oscuridad) MÁS el extra, igual que un alto (Optimizador del Excel
        // de cortinas mayores: `ALTO A UTILIZAR = ancho + 0,25`). Los m² no
        // cambian: la cortina vendida es la misma.
        const pieza: Pieza = {
          ancho: r.f.ancho,
          alto: r.f.alto,
          altoReal,
          m2: altoReal * r.f.ancho,
          anchoEmpaque: c.invertida ? altoReal : r.f.anchoEmpaqueM,
          largoRollo: c.invertida ? (r.f.anchoEmpaqueM ?? r.f.ancho) + extraAlto : undefined,
        };
        const n = Math.max(1, r.f.cantidad);
        for (let i = 0; i < n; i++) piezas.push({ ...pieza });
        if (r.config.clave === clave) {
          piezasCobradas += n;
          m2Cobrados += pieza.m2 * n;
        }
      }
      grupos.set(clave, {
        cod,
        clave,
        lineaB: c.lineaB,
        invertida: c.invertida,
        sistemaInv: c.sistemaInv,
        esDuo,
        esVertical,
        sistema: c.sistema,
        anchoRollo,
        precioMl: tela.precio,
        arquetipo: tela.arquetipo,
        piezas,
        piezasCobradas,
        m2Cobrados,
      });
    }
  }

  // Por panel: precio/m² combinado.
  const familias: ResultadoFamilia[] = [];
  const pm2PorCod = new Map<string, number>();
  for (const [clave, g] of grupos) {
    const cod = g.cod;
    const m2Total = g.piezas.reduce((s, p) => s + p.m2, 0);
    const n = g.piezas.length;
    const panos = g.esVertical ? [] : empacarPanos(g.piezas, g.anchoRollo);
    // La vertical por lamas usa el ancho de rollo de las reglas, NO el del
    // catálogo: los códigos de tela vertical tienen cargado el ancho del rollo
    // de roller (2,45/2,48/2,78…), que no es el de la tela vertical.
    const porLamas = g.esVertical && reglas.telaVertical.modo === 'lamas';
    const metrosTela = !g.esVertical
      ? // Los paños ya están armados: sumar sus altos es `metrosTelaPorPanos`
        // sin volver a empacar.
        panos.reduce((s, p) => s + p.alto, 0)
      : porLamas
        ? metrosTelaVerticalPorLamas(g.piezas, reglas.telaVertical)
        : metrosTelaVertical(g.piezas, g.anchoRollo);
    const costoTela = g.precioMl * metrosTela;
    // Un sistema propio (beeblack) trae su tabla de precios y su margen: los
    // suyos ganan sobre los globales, y lo que no define cae al roller.
    // La categoría B tiene su receta (`BLACKOUT_P|B`…) y su tabla de insumos,
    // la invertida la suya (`BLACKOUT_D|INV`); el resto, la de su familia con
    // los precios del sistema si lo tiene.
    const materiales = materialesFamilia(
      g.lineaB
        ? resolverRecetaB(cod, g.esVertical, reglas.recetas)
        : g.sistemaInv
          ? resolverRecetaInv(cod, g.esVertical, reglas.recetas)
          : resolverReceta(cod, g.esVertical, reglas.recetas),
      g.piezas,
      insumosDeSistema(g.sistema, reglas),
      g.sistema?.margenInsumo ?? params.margenInsumo,
      reglas.telaVertical.pasoLamaM,
    );
    const manoObra =
      (g.sistema
        ? g.sistema.manoObra
        : g.esVertical
          ? params.manoObraVertical
          : g.esDuo
            ? params.manoObraDuo
            : params.manoObraRoller) * n;
    const traslado = g.sistema?.traslado ?? params.traslado;
    const costoTotal = costoTela + materiales.total + manoObra + reglas.regalo + traslado;
    const precioM2 = m2Total > 0 ? costoTotal / m2Total : 0;
    pm2PorCod.set(clave, precioM2);
    familias.push({
      cod,
      clave,
      lineaB: g.lineaB,
      invertida: g.invertida,
      sistemaInvertida: g.sistemaInv,
      piezas: g.piezas.length,
      m2Total,
      piezasCobradas: g.piezasCobradas,
      m2Cobrados: g.m2Cobrados,
      metrosTela,
      precioMl: g.precioMl,
      costoTela,
      costoMateriales: materiales.total,
      manoObra,
      traslado,
      costoTotal,
      precioM2,
      exacto: g.lineaB
        ? recetaBEsExacta(cod)
        : g.sistemaInv
          ? recetaInvEsExacta(cod)
          : recetaEsExacta(cod),
      arquetipoCodInt: g.arquetipo,
      panos,
      materiales: materiales.lineas,
      regalo: reglas.regalo,
      ...(g.sistema ? { sistema: g.sistema.nombre } : {}),
      ...(porLamas
        ? {
            lamas: {
              total: g.piezas.reduce((s, p) => s + lamasDeCortina(p.ancho, reglas.telaVertical), 0),
              porPasada: lamasPorPasada(reglas.telaVertical),
              minimoUnaPasada: reglas.telaVertical.minimoUnaPasada,
            },
          }
        : {}),
    });
  }

  // Preciar cada línea de entrada (aplicando descuento por línea si lo hay).
  const lineas: LineaResultado[] = validas.map((f, i) => {
    const clave = codDeFila[i];
    const g = clave ? grupos.get(clave) : undefined;
    const cod = g?.cod ?? null;
    const esDuo = g?.esDuo ?? false;
    const altoReal = altoRealM(f.alto, esDuo, extraAltoDe(g?.sistema));
    const m2 = altoReal * f.ancho;
    const precioM2 = clave ? pm2PorCod.get(clave) ?? 0 : 0;
    // Sin instalación: el cliente retira / solo cortina → VAL. UNIT = precio del
    // producto (m² × precio/m²), sin el cargo de instalación embebido.
    // El beeblack embebe un valor distinto del que cobra la fila de abajo
    // (41.650 vs 35.000): es así en el Excel, ver `SistemaPrecio`.
    // Sin `g` la tela no existe en el catálogo: la línea vale 0 entera (ya se
    // avisó arriba). Antes caía en la rama roller y cobraba $17.500 de
    // instalación por una cortina que no se podía ni fabricar.
    const instalacion =
      sinInstalacion || !g
        ? 0
        : g.sistema
          ? g.sistema.instalacionEmbebida
          : g.esVertical
            ? params.instalacionVertical
            : params.instalacionRoller;
    const valorUnit = m2 * precioM2 + instalacion;
    const cant = Math.max(1, f.cantidad);
    const descuento = Math.max(0, Math.min(1, f.descuento ?? 0));
    return {
      codInt: f.codInt,
      cod: cod ?? '',
      clave: clave ?? '',
      lineaB: g?.lineaB ?? false,
      invertida: g?.invertida ?? false,
      ancho: f.ancho,
      alto: f.alto,
      cantidad: f.cantidad,
      m2,
      valorUnit,
      descuento,
      total: valorUnit * cant * (1 - descuento),
      precioM2,
      instalacionEmbebida: instalacion,
    };
  });

  // Adicionales: precio fijo del catálogo × cantidad − descuento.
  const adicionalesRes: AdicionalResultado[] = adicionales
    .filter((a) => a.codInt && a.cantidad > 0)
    .map((a) => {
      const prod = catalogo[a.codInt];
      const precioUnit = Number(prod?.precio) || 0;
      const descuento = Math.max(0, Math.min(1, a.descuento ?? 0));
      return {
        codInt: a.codInt,
        producto: prod?.producto ?? '',
        descripcion: prod?.descripcion ?? '',
        cantidad: a.cantidad,
        precioUnit,
        descuento,
        total: precioUnit * a.cantidad * (1 - descuento),
      };
    });

  // Instalación (regla 4+ gratis / región editable). Cuenta las cortinas
  // roller/dúo (no verticales); la instalación de cada una ya está embebida en
  // su VAL. UNIT, así que esta línea replica la fila INSTALACIÓN del Excel:
  //   • RM y nº ≥ mínimo → descuento RM (default 100% → total 0, no suma).
  //   • RM y nº < mínimo → sin descuento (se cobra la instalación aparte).
  //   • Región           → descuento de región (editable por empresa).
  // Las cortinas instalables se cuentan por SISTEMA: el beeblack se cobra a
  // otro precio que el roller (35.000 vs 17.500), así que la fila lleva un
  // tramo por cada uno. El MÍNIMO para que salga gratis se mira sobre el
  // total, como el `SUM(F25:F32)` del Excel, que suma todas las filas.
  // Se cuenta por VENTANA cuando las filas la declaran (`ventanaId`): un dual
  // son dos telas en la misma ventana y se instala UNA vez, que es como lo
  // cuenta el Excel. Las filas sin `ventanaId` cuentan por pieza, como siempre.
  const porSistema = new Map<string, { cantidad: number; precioUnit: number }>();
  const ventanasVistas = new Set<string>();
  let nInstalables = 0;
  const sumar = (clave: string, precioUnit: number, cuantas: number) => {
    nInstalables += cuantas;
    const prev = porSistema.get(clave);
    if (prev) prev.cantidad += cuantas;
    else porSistema.set(clave, { cantidad: cuantas, precioUnit });
  };
  validas.forEach((f, i) => {
    const cod = codDeFila[i];
    const g = cod ? grupos.get(cod) : undefined;
    if (!g || g.esVertical) return;
    const precioUnit = g.sistema?.instalacionLinea ?? params.instalacionRoller;
    // La categoría B se instala como una roller: si cobra lo mismo, va en el
    // mismo tramo (la fila INSTALACIÓN del Excel no las separa).
    const clave =
      g.lineaB && precioUnit === params.instalacionRoller
        ? 'Roller'
        : (g.sistema?.nombre ?? 'Roller');
    if (f.ventanaId) {
      if (ventanasVistas.has(f.ventanaId)) return;
      ventanasVistas.add(f.ventanaId);
      sumar(clave, precioUnit, 1);
      return;
    }
    sumar(clave, precioUnit, Math.max(1, f.cantidad));
  });
  const minGratis = params.instalacionGratisMinCortinas ?? PARAMETROS_DEFAULT.instalacionGratisMinCortinas;
  const descRM = params.instalacionDescuentoRM ?? PARAMETROS_DEFAULT.instalacionDescuentoRM;
  const descRegion = params.instalacionDescuentoRegion ?? PARAMETROS_DEFAULT.instalacionDescuentoRegion;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  // Esta línea replica la fila INSTALACIÓN del Excel:
  //   • RM con nº ≥ mínimo → descuento RM (default 100% → total 0, "GRATIS").
  //   • RM bajo el mínimo  → SE COBRA `instalacionRoller × n` (término #1 de la
  //     cotización: "3 o menos, valor instalación $17.500 c/u + IVA").
  //   • Región             → cobra la instalación con el % editable de región.
  //   • Sin instalación    → 0 (y ya se quitó del VAL. UNIT arriba).
  // El mínimo NO se comparaba (2026-08-11): se aplicaba el 100% de RM siempre,
  // así que una cotización de 1, 2 o 3 cortinas regalaba la instalación y el
  // parámetro editable del Admin no hacía nada. Verificado contra la copia
  // COTAP-83447, que con 2 cortinas la cobra.
  const alcanzaMinimo = nInstalables >= minGratis;
  // El % a mano le gana a la regla: la instalación se negocia como cualquier
  // otro adicional. «Sin instalación» no: ahí no hay nada que cobrar.
  const hayManual = !sinInstalacion && descuentoInstalacionManual != null;
  const descInstal = sinInstalacion
    ? 1
    : hayManual
      ? clamp01(descuentoInstalacionManual as number)
      : region
        ? clamp01(descRegion)
        : alcanzaMinimo
          ? clamp01(descRM)
          : 0;
  const partes: ParteInstalacion[] =
    sinInstalacion || nInstalables === 0
      ? []
      : [...porSistema].map(([sistema, p]) => ({
          sistema,
          cantidad: p.cantidad,
          precioUnit: p.precioUnit,
          total: p.precioUnit * p.cantidad * (1 - descInstal),
        }));
  const totalInstal = partes.reduce((s, p) => s + p.total, 0);
  const instalacion: InstalacionResultado = {
    cantidad: nInstalables,
    // El precio por cortina solo tiene sentido con un sistema en juego; con
    // varios manda el desglose de `partes`.
    precioUnit: partes.length === 1 ? partes[0].precioUnit : params.instalacionRoller,
    descuento: descInstal,
    total: totalInstal,
    partes,
    // "GRATIS" sólo si no se cobra extra y (es región 100% off o llega al mínimo
    // de cortinas en RM).
    gratis: !sinInstalacion && totalInstal === 0 && (region || alcanzaMinimo || hayManual),
    region,
    sinInstalacion,
    descuentoManual: hayManual,
  };

  const subtotalCortinas = lineas.reduce((s, l) => s + l.total, 0);
  const subtotalAdicionales = adicionalesRes.reduce((s, a) => s + a.total, 0);
  const subtotalNeto = subtotalCortinas + subtotalAdicionales + instalacion.total;
  return {
    familias,
    lineas,
    adicionales: adicionalesRes,
    instalacion,
    subtotalNeto,
    totales: calcularTotales(subtotalNeto, {
      iva: params.iva,
      recargoTarjeta: recargoTarjetaEfectivo(params),
      abonoInicial: params.abonoInicial,
    }),
    avisos,
  };
}
