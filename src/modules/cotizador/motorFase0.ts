
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
  explicarCantidad,
  insumosParaFamilia,
  lamasPorPasada,
  resolverReceta,
  sistemaDeFamilia,
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
   * A qué VENTANA pertenece esta fila. Solo lo usa la fila de instalación: el
   * Excel cuenta ventanas instaladas, no paños, así que un dual (dos telas en
   * la misma ventana, un solo bracket) se instala una vez. Sin este dato se
   * cuentan las piezas, como venía haciéndose.
   */
  ventanaId?: string;
};

export type LineaResultado = {
  codInt: string;
  cod: string;
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
  piezas: number;
  m2Total: number;
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
  (f?.min === undefined || ancho >= f.min) && (f?.max === undefined || ancho <= f.max);

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

/** Pieza que entra al empaque. `anchoEmpaque` (peor caso de oscuridad) manda
 *  sobre el nominal cuando viene; ver `FilaFase0.anchoEmpaqueM`. */
type PiezaEmpaque = { ancho: number; altoReal: number; anchoEmpaque?: number };

/** Lo que la pieza ocupa a lo ancho del rollo. */
const anchoOcupado = (p: PiezaEmpaque) =>
  typeof p.anchoEmpaque === 'number' && p.anchoEmpaque > 0 ? p.anchoEmpaque : p.ancho;

/**
 * Arma los paños. Es la parte del cálculo que hace que dos cortinas angostas
 * de la misma tela compartan tiro y la de menor alto viaje gratis.
 */
export function empacarPanos(piezas: PiezaEmpaque[], anchoRollo: number): PanoPrecio[] {
  const ordenadas = piezas
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => anchoOcupado(a) - anchoOcupado(b));
  const panos: PanoPrecio[] = [];
  let acc = 0;
  for (const p of ordenadas) {
    const ocupa = anchoOcupado(p);
    const excede = acc + ocupa > anchoRollo;
    if (panos.length === 0 || excede) {
      panos.push({ letra: '', alto: p.altoReal, ancho: ocupa, cortinas: [p.i] });
      acc = ocupa;
    } else {
      const last = panos[panos.length - 1];
      last.ancho += ocupa;
      last.alto = Math.max(last.alto, p.altoReal);
      last.cortinas.push(p.i);
      acc += ocupa;
    }
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
export type MotivoPrecioMl = 'base' | 'arquetipo' | 'maximo' | 'sinPrecio';

export function precioMlPorCod(
  cod: string,
  catalogo: CatalogoProductos,
  reglas: ReglasPrecios,
): { precio: number; arquetipo: string; motivo: MotivoPrecioMl } {
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
  };
  type Grupo = {
    cod: string;
    esDuo: boolean;
    esVertical: boolean;
    anchoRollo: number;
    precioMl: number;
    arquetipo: string;
    piezas: Pieza[];
    /** Sistema con reglas propias (beeblack), si esta familia va con uno. */
    sistema?: SistemaPrecio;
  };
  const grupos = new Map<string, Grupo>();
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

  // Resolver cada fila a su COD (familia) y agrupar.
  const codDeFila: (string | null)[] = validas.map((f) => {
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
    const sistema = sistemaDeFamilia(cod, reglas.sistemas);
    const altoReal = altoRealM(f.alto, esDuo, extraAltoDe(sistema));
    const pieza: Pieza = {
      ancho: f.ancho,
      alto: f.alto,
      altoReal,
      m2: altoReal * f.ancho,
      anchoEmpaque: f.anchoEmpaqueM,
    };
    let g = grupos.get(cod);
    if (!g) {
      const tela = precioMlPorCod(cod, catalogo, reglas);
      if (tela.motivo === 'sinPrecio') {
        avisar({
          tipo: 'tela',
          codigo: cod,
          mensaje:
            `La familia «${cod}» no tiene ninguna tela con precio en el catálogo: ` +
            'su tela se cotiza en $0. Revisa Admin → Precios → Tela de referencia.',
        });
      }
      g = {
        cod,
        esDuo,
        esVertical,
        sistema,
        // Ancho de rollo de respaldo (2,45 histórico del Excel de precios, ≠
        // 2,98 del corte de tela): último recurso, en producción
        // ancho_rollo_data o el catálogo resuelven antes. `||` y no `??`: un
        // ancho guardado en 0 tiene que caer al respaldo, si no cada pieza se
        // va a un paño propio y la tela se cobra de más.
        anchoRollo: anchoRolloMap[f.codInt] || Number(prod.anchoRollo) || reglas.anchoRolloFallbackM,
        precioMl: tela.precio,
        arquetipo: tela.arquetipo,
        piezas: [],
      };
      grupos.set(cod, g);
    }
    for (let i = 0; i < Math.max(1, f.cantidad); i++) g.piezas.push({ ...pieza });
    return cod;
  });

  // Por familia: precio/m² combinado.
  const familias: ResultadoFamilia[] = [];
  const pm2PorCod = new Map<string, number>();
  for (const [cod, g] of grupos) {
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
    const materiales = materialesFamilia(
      resolverReceta(cod, g.esVertical, reglas.recetas),
      g.piezas,
      insumosParaFamilia(cod, reglas),
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
    pm2PorCod.set(cod, precioM2);
    familias.push({
      cod,
      piezas: g.piezas.length,
      m2Total,
      metrosTela,
      precioMl: g.precioMl,
      costoTela,
      costoMateriales: materiales.total,
      manoObra,
      traslado,
      costoTotal,
      precioM2,
      exacto: recetaEsExacta(cod),
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
    const cod = codDeFila[i];
    const g = cod ? grupos.get(cod) : undefined;
    const esDuo = g?.esDuo ?? false;
    const altoReal = altoRealM(f.alto, esDuo, extraAltoDe(g?.sistema));
    const m2 = altoReal * f.ancho;
    const precioM2 = cod ? pm2PorCod.get(cod) ?? 0 : 0;
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
    const clave = g.sistema?.nombre ?? 'Roller';
    const precioUnit = g.sistema?.instalacionLinea ?? params.instalacionRoller;
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
  const descInstal = sinInstalacion
    ? 1
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
    gratis: !sinInstalacion && totalInstal === 0 && (region || alcanzaMinimo),
    region,
    sinInstalacion,
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
