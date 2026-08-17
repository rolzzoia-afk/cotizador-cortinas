// ─────────────────────────────────────────────────────────────────────
// REGLAS DE PRECIO — la hoja "Cotizador" del Excel, como DATOS editables.
//
// Hasta ahora la lista de materiales de cada familia vivía escrita a mano en
// `motorFase0.ts`: subir el precio de un tubo o corregir una regla obligaba a
// tocar código. Acá esa misma información queda como datos, con los valores de
// fábrica idénticos al hardcode anterior —la prueba de equivalencia
// (`recetasDefault.equivalencia.test.ts`) recorre familias, anchos y cantidades
// comparando contra una copia literal del código viejo.
//
// Módulo PURO: sin React y sin Supabase. La persistencia vive en
// `reglasPreciosStore.ts` (mismo par que reglasSeleccion / reglasSeleccionStore).
// ─────────────────────────────────────────────────────────────────────

import { INSUMO_VALOR_MAXIMO } from './preciosFase0';

// ── Cantidades ────────────────────────────────────────────────────────

/**
 * Tramo de anchos al que se le aplica una línea. Los dos extremos son
 * INCLUSIVOS: `max: 2.19` toma la cortina de 2,19 m exactos.
 *
 * OJO con el hueco 2,19 → 2,191 del tubo roller: una cortina de 2,1905 m no
 * cae en ninguno de los dos tramos y se queda sin tubo. Es fiel al Excel
 * (`SUMIF("<=2,19")` + `SUMIF(">=2,191")`), así que se conserva; el validador
 * lo AVISA para que se note, pero no lo corrige solo.
 */
export type FiltroAncho = { min?: number; max?: number };

/**
 * Cómo se calcula CUÁNTO se necesita de un insumo para una familia.
 *
 * - `porCortina`: cuenta CORTINAS (una fila con cantidad 3 son 3 cortinas) y
 *   multiplica por el factor. Con `filtroAncho` cuenta solo las que entran en
 *   el tramo (así se arma «2 mecanismos por cada cortina de 2,20 m o más»).
 * - `porCortinaCuadrado`: n² × factor. Existe por los materiales varios del
 *   dúo blackout delux/standard, que en el Excel es `n × 2 × n`.
 * - `sumaAnchos`: suma los anchos (metros lineales) × factor, más un fijo
 *   opcional. El fijo existe por el perfil de cenefa del dúo premium, que
 *   suma 20 cm a la familia entera.
 * - `sumaAltos`: suma los altos TAL COMO SE VENDIERON, sin el extra de 0,25 m
 *   y sin duplicar el dúo. Es el único término que usa el alto crudo.
 * - `fijo`: una cantidad constante por familia, sin importar cuántas cortinas.
 * - `lamas`: las lamas de una cortina vertical, `(suma de anchos ÷ 0,8) × 10`.
 *   Los dos números son de la fórmula del Excel y no se parametrizan porque
 *   solo esa receta los usa.
 */
export type CantidadReceta =
  | { tipo: 'porCortina'; factor?: number; filtroAncho?: FiltroAncho }
  | { tipo: 'porCortinaCuadrado'; factor?: number }
  | { tipo: 'sumaAnchos'; factor?: number; masFijoM?: number; filtroAncho?: FiltroAncho }
  | { tipo: 'sumaAltos'; factor?: number }
  | { tipo: 'fijo'; cantidad: number }
  | { tipo: 'lamas'; factor?: number };

/**
 * Una línea de la lista de materiales.
 *
 * `precio: 'venta'` es lo normal: VALOR MAXIMO ÷ margen. `precio: 'costo'` usa
 * el VALOR MAXIMO tal cual, sin margen — pasa con la etiqueta en las gamas
 * standard y en varias familias dúo, y viene así del Excel.
 */
export type LineaReceta = {
  insumo: string;
  precio: 'venta' | 'costo';
  cantidad: CantidadReceta;
};

/** Una línea ya resuelta, para mostrar el desglose del precio. */
export type LineaMaterialDesglose = {
  insumo: string;
  descripcion: string;
  /** La regla contada en castellano, p. ej. «2 por cortina». */
  regla: string;
  precio: 'venta' | 'costo';
  precioUnit: number;
  cantidad: number;
  total: number;
};

export type InsumoPrecio = { descripcion?: string; valorMaximo: number };

/**
 * Cómo se cobra la TELA de una cortina vertical.
 *
 * - `panos`: como el Excel. Cuenta paños enteros (`ceil(ancho ÷ anchoRollo)`),
 *   así que una cortina apenas más ancha que el rollo paga el DOBLE de tela.
 *   Ese salto es el que las vendedoras corregían a mano bajando el 2 a 1.
 * - `lamas`: lo que realmente se consume. Una vertical se corta con el rollo
 *   girado, en PASADAS: cada pasada rinde `floor(anchoRollo ÷ anchoLama)`
 *   lamas, y la cortina usa `ancho ÷ pasoLama` de ellas. Al cobrar la fracción
 *   de pasada, el costo crece parejo con el ancho y no hay escalón.
 *
 * El ancho de rollo va acá y no sale del catálogo a propósito: los códigos de
 * tela vertical tienen cargado el ancho de los rollos de ROLLER (2,45, 2,48,
 * 2,78…), que no es el de la tela vertical real.
 */
export type TelaVertical = {
  modo: 'panos' | 'lamas';
  /** Ancho de una lama (m). */
  anchoLamaM: number;
  /** Cada cuánto se monta una lama (m). Menor que el ancho: se traslapan. */
  pasoLamaM: number;
  /** Ancho real del rollo de tela vertical (m). */
  anchoRolloVerticalM: number;
};

export type ReglasPrecios = {
  /** VALOR MAXIMO por código de insumo (la hoja Insumos del Excel). */
  insumos: Record<string, InsumoPrecio>;
  /** Lista de materiales por familia. Claves: los 12 COD + VERTICAL + DUO_GENERICO. */
  recetas: Record<string, LineaReceta[]>;
  /** Familia → COD_INT de la tela que fija el precio por metro. */
  arquetipos: Record<string, string>;
  /** Familia vertical → COD_INT del roller equivalente, de donde sale su tela. */
  baseVertical: Record<string, string>;
  /** Regalo por familia (P148 del Excel = Insumos!N95). Hoy 0. */
  regalo: number;
  /** Ancho de rollo cuando ni el catálogo ni la tabla de anchos lo dicen. */
  anchoRolloFallbackM: number;
  /** Cómo se cobra la tela de las cortinas verticales. */
  telaVertical: TelaVertical;
};

// ── Recetas de fábrica ────────────────────────────────────────────────
// Extraídas 1:1 del hardcode de motorFase0.ts. El ORDEN de las líneas importa:
// la suma se hace en este orden para que el total salga bit a bit igual que
// antes y los goldens (cotizaciones reales) no se muevan ni un peso.

const v = (insumo: string, cantidad: CantidadReceta): LineaReceta => ({ insumo, precio: 'venta', cantidad });
const c = (insumo: string, cantidad: CantidadReceta): LineaReceta => ({ insumo, precio: 'costo', cantidad });
const porCortina = (factor?: number, filtroAncho?: FiltroAncho): CantidadReceta => ({ tipo: 'porCortina', factor, filtroAncho });
const sumaAnchos = (factor?: number, extra?: { masFijoM?: number; filtroAncho?: FiltroAncho }): CantidadReceta =>
  ({ tipo: 'sumaAnchos', factor, ...extra });

/** Tubo del roller/dúo gama premium y delux: Ø38 hasta 2,19 m, Ø45 desde 2,191. */
const TUBOS_PD: LineaReceta[] = [
  v('E 02', sumaAnchos(undefined, { filtroAncho: { max: 2.19 } })),
  v('E 05', sumaAnchos(undefined, { filtroAncho: { min: 2.191 } })),
];

/** Roller blackout y screen, gamas premium y delux (las 4 comparten receta). */
const RECETA_ROLLER_PD: LineaReceta[] = [
  ...TUBOS_PD,
  v('E 15', sumaAnchos()),
  v('MEC 18', porCortina()),
  v('CAD 03', porCortina()),
  v('TOP 03', porCortina()),
  v('INS 95', porCortina()),
  v('PCA 04', porCortina()),
  v('TAP 01 -19', porCortina(2)),
  v('ZUN 06', sumaAnchos(2)),
  v('PUB 01', porCortina()),
  v('MAT00001', porCortina()),
];

/**
 * Gama standard: un solo tubo (E 02-1) y sin Ø45, así que una cortina más
 * ancha que el tope no suma tubo. El corte es 2,50 m en blackout y 2,19 m en
 * screen. La etiqueta va a precio de costo.
 */
const recetaRollerStandard = (topeTuboM: number, llevaMateriales: boolean): LineaReceta[] => [
  v('E 02-1', sumaAnchos(undefined, { filtroAncho: { max: topeTuboM } })),
  v('E 15', sumaAnchos()),
  v('MEC 18', porCortina()),
  v('CAD 03', porCortina()),
  v('TOP 03', porCortina()),
  c('INS 95', porCortina()),
  v('PCA 04', porCortina()),
  v('TAP 01 -19', porCortina(2)),
  v('ZUN 06', sumaAnchos(2)),
  v('PUB 01', porCortina()),
  ...(llevaMateriales ? [v('MAT00001', porCortina())] : []),
];

/**
 * Familias dúo. Se diferencian en cuatro cosas: si el perfil de cenefa suma
 * los 20 cm fijos, si llevan mica y cinta, si la etiqueta va a costo, y cómo
 * cuentan los materiales varios.
 */
const recetaDuo = (opts: {
  perfilMasFijo?: boolean;
  micaYCinta?: boolean;
  etiquetaACosto?: boolean;
  materialesVarios: CantidadReceta | null;
}): LineaReceta[] => [
  ...TUBOS_PD,
  v('E 26', sumaAnchos(undefined, opts.perfilMasFijo ? { masFijoM: 0.2 } : undefined)),
  ...(opts.micaYCinta ? [v('MIC 01', sumaAnchos()), v('CIN 02', sumaAnchos())] : []),
  v('E 18', sumaAnchos()),
  v('E 13', sumaAnchos()),
  (opts.etiquetaACosto ? c : v)('INS 95', porCortina()),
  v('MEC 09', porCortina()),
  // Mecanismo extra: 2 por cada cortina de 2,20 m de ancho o más.
  v('MEC 18', porCortina(2, { min: 2.2 })),
  v('CAD 02', porCortina()),
  v('PCA 04', porCortina()),
  v('ZUN 06', sumaAnchos(2)),
  v('TAP 09', porCortina(2)),
  ...(opts.materialesVarios ? [v('MAT00001', opts.materialesVarios)] : []),
  v('BRA 02', porCortina(3)),
  v('PUB 01', porCortina()),
];

/** Cortina vertical: la receta no depende de la gama, es una sola. */
const RECETA_VERTICAL: LineaReceta[] = [
  v('VER 35', sumaAnchos()),
  v('VER 02', { tipo: 'lamas' }),
  v('VER 19', { tipo: 'lamas' }),
  v('VER 03', { tipo: 'lamas' }),
  v('VER 04', { tipo: 'lamas' }),
  v('VER 05', { tipo: 'fijo', cantidad: 4 }),
  v('VER 06', porCortina(3)),
  v('VER 07', porCortina()),
  v('VER 08', porCortina()),
  v('VER 09', porCortina()),
  v('VER 10', porCortina()),
  v('VER 11', porCortina(2)),
  v('VER 15', { tipo: 'sumaAltos', factor: 2 }),
  v('VER 22', { tipo: 'sumaAltos', factor: 5 }),
  v('VER 24', porCortina()),
  v('VER 30', porCortina()),
  v('CAD 02', porCortina()),
  v('VER 29', porCortina()),
  v('MAT00001', porCortina()),
];

/** Clave de la receta que se usa para una vertical, sea de la gama que sea. */
export const RECETA_VERTICAL_KEY = 'VERTICAL';
/**
 * Clave de respaldo para un dúo cuyo COD no está en el catálogo de recetas.
 * Reproduce lo que hacía el código viejo con un dúo desconocido: perfil sin
 * los 20 cm, sin mica ni cinta, etiqueta a precio de venta y sin materiales
 * varios.
 */
export const RECETA_DUO_GENERICO_KEY = 'DUO_GENERICO';

export const RECETAS_DEFAULT: Record<string, LineaReceta[]> = {
  BLACKOUT_P: RECETA_ROLLER_PD,
  BLACKOUT_D: RECETA_ROLLER_PD,
  BLACKOUT_S: recetaRollerStandard(2.5, true),
  SCREEN_P: RECETA_ROLLER_PD,
  SCREEN_D: RECETA_ROLLER_PD,
  // El screen standard es la única familia que no lleva materiales varios.
  SCREEN_S: recetaRollerStandard(2.19, false),
  DUOBK_P: recetaDuo({ perfilMasFijo: true, micaYCinta: true, materialesVarios: porCortina() }),
  DUOBK_D: recetaDuo({ etiquetaACosto: true, materialesVarios: { tipo: 'porCortinaCuadrado', factor: 2 } }),
  DUOBK_S: recetaDuo({ etiquetaACosto: true, materialesVarios: { tipo: 'porCortinaCuadrado', factor: 2 } }),
  DUOPOLI_P: recetaDuo({ micaYCinta: true, etiquetaACosto: true, materialesVarios: porCortina(2) }),
  DUOPOLI_D: recetaDuo({ micaYCinta: true, etiquetaACosto: true, materialesVarios: porCortina(2) }),
  DUOPOLI_S: recetaDuo({ micaYCinta: true, etiquetaACosto: true, materialesVarios: porCortina(2) }),
  [RECETA_VERTICAL_KEY]: RECETA_VERTICAL,
  [RECETA_DUO_GENERICO_KEY]: recetaDuo({ materialesVarios: null }),
};

/** Las 12 familias reales, en el orden en que se muestran en el Admin. */
export const FAMILIAS_CON_RECETA = [
  'BLACKOUT_P', 'BLACKOUT_D', 'BLACKOUT_S',
  'SCREEN_P', 'SCREEN_D', 'SCREEN_S',
  'DUOBK_P', 'DUOBK_D', 'DUOBK_S',
  'DUOPOLI_P', 'DUOPOLI_D', 'DUOPOLI_S',
] as const;

// Descripciones de los insumos (venían como comentarios en preciosFase0.ts).
const DESCRIPCIONES: Record<string, string> = {
  'E 02': 'Tubo Ø38 (roller, hasta 2,19 m)',
  'E 02-1': 'Tubo (variante standard)',
  'E 05': 'Tubo Ø45 (roller, desde 2,191 m)',
  'E 15': 'Peso inferior roller (por metro)',
  'E 26': 'Perfil superior cenefa dúo (por metro)',
  'E 18': 'Peso lágrima dúo (por metro)',
  'E 13': 'Peso dúo (por metro)',
  'MEC 18': 'Mecanismo 0.45 Decorelli (roller)',
  'MEC 09': 'Mecanismo cenefa ovalada (dúo)',
  'CAD 03': 'Cadena infinita plástica (roller manual)',
  'CAD 02': 'Cadena infinita plástica (dúo manual)',
  'CAD 13': 'Cadena metálica por metro (motor)',
  'TOP 03': 'Tope cadena (roller)',
  MER0006: 'Tope metálico cadena (motor)',
  'PCA 04': 'Peso porta cadena',
  'TAP 01 -19': 'Tapa peso roller (2 por cortina)',
  'TAP 09': 'Tapa peso dúo (2 por cortina)',
  'ZUN 06': 'Zuncho (por metro, ×2)',
  'MIC 01': 'Mica transparente cenefa (dúo)',
  'CIN 02': 'Cinta doble contacto (dúo)',
  'BRA 02': 'Bracket largo (dúo, ×3 por cortina)',
  'INS 95': 'Etiqueta Rolzzo (por cortina)',
  MAT00001: 'Materiales varios',
  'PUB 01': 'Publicidad (por cortina)',
  'VER 35': 'Perfil (riel) cortina vertical, por metro',
  'VER 02': 'Carro conector 3 vías (por lama)',
  'VER 19': 'Peso lama vertical (por lama)',
  'VER 03': 'Lama de sujeción (por lama)',
  'VER 04': 'Espaciador (por lama)',
  'VER 05': 'Clip sujeción riel',
  'VER 06': 'Escuadra cortina vertical',
  'VER 07': 'Sujetador eje 3 vías',
  'VER 08': 'Conductor de cordón',
  'VER 09': 'Unidad de control',
  'VER 10': 'Freno eje 3 vías',
  'VER 11': 'Peso cordón vertical',
  'VER 15': 'Cadena inferior vertical (por metro de alto)',
  'VER 22': 'Cordón cortina vertical (por metro de alto)',
  'VER 24': 'Tope cordón',
  'VER 29': 'Guía tope de soga',
  'VER 30': 'Soporte riel',
  // Variantes de color o proveedor del mismo material (ver GRUPOS_INSUMO).
  FABR0002: 'Peso inferior — riel ranurado blanco',
  'E 22': 'Peso inferior — riel roller de terraza',
  'E 14': 'Peso inferior roller/dúo — negro',
  'E 16': 'Peso inferior roller/dúo — gris',
  'E 19': 'Peso lágrima dúo — blanco',
  'E 20': 'Peso lágrima dúo — gris',
  'E 27': 'Perfil superior cenefa ovalada — blanco',
  'E 28': 'Perfil superior cenefa ovalada — gris',
  FABR0003: 'Tapa riel peso (riel ranurado)',
  'TAP 04-05': 'Tapa peso roller — negro',
  'TAP 10-20': 'Tapa peso roller — gris',
  'TAP 10': 'Tapa peso dúo 4 exterior — blanco',
  'TAP 11': 'Tapa peso dúo 4 exterior — negro',
  'TOP 02': 'Tope cadena roller — blanco',
  'PCA 01': 'Peso porta cadena — huevo blanco',
  'PCA 02': 'Peso porta cadena — ovalado blanco',
  'PCA 05': 'Peso porta cadena — negro 9,5 cm',
  'PCA 06': 'Peso porta cadena — gris 9,5 cm',
  'ZUN 01': 'Zuncho gris 9 mm',
  'ZUN 02': 'Zuncho gris 12 mm',
  'ZUN 03': 'Zuncho azul 7 mm',
  'ZUN 04': 'Zuncho transparente 11 mm',
  'ZUN 08': 'Zuncho azul 8,7 mm',
  'MEC 05': 'Mecanismo LZ90 — blanco',
  'MEC 06': 'Mecanismo LZ50 — blanco, con cadena',
  'MEC 11': 'Kit simple 40/45 — negro (sin cadena)',
  'MEC 13': 'Kit simple 40/45 — gris (sin cadena)',
  'MEC 14': 'Kit simple 40/45 — blanco (sin cadena)',
  'MEC 10': 'Mecanismo cenefa ovalada — blanco',
  'MEC 12': 'Mecanismo cenefa ovalada — gris',
  'CAD 05': 'Cadena infinita 4 m — blanca',
  'BRA 01': 'Bracket corto',
  'VER 01': 'Kit cabezal vertical 25 mm con eje, tira 5,8 m',
  'VER 28': 'Carritos vertical',
  'VER 33': 'Carro guía vertical',
  'VER 14': 'Peso lama vertical — variante',
  'VER 18': 'Peso lama vertical — variante',
  // Materiales que no comparten grupo con ninguno de los de arriba.
  'TAP 13': 'Tapa peso dúo interior (dúo 2 a 5)',
  MER0014: 'Conector para cadena roller',
};

/**
 * Los grupos de la hoja Insumos del Excel.
 *
 * Ahí el VALOR MAXIMO de un insumo no es un dato suyo: es el MÁXIMO de su
 * grupo, así que todas las variantes de color o de proveedor de un mismo
 * material cobran igual. La clave es el código que usan las recetas y la lista
 * son sus alternativas, que existen para poder cambiar una por otra sin tener
 * que inventar el precio.
 */
export const GRUPOS_INSUMO: Record<string, string[]> = {
  'E 15': ['FABR0002', 'E 22', 'E 14', 'E 16'],
  'E 18': ['E 19', 'E 20'],
  'E 26': ['E 27', 'E 28'],
  'TAP 01 -19': ['FABR0003', 'TAP 04-05', 'TAP 10-20'],
  'TAP 09': ['TAP 10', 'TAP 11'],
  'TOP 03': ['TOP 02'],
  'PCA 04': ['PCA 01', 'PCA 02', 'PCA 05', 'PCA 06'],
  'ZUN 06': ['ZUN 01', 'ZUN 02', 'ZUN 03', 'ZUN 04', 'ZUN 08'],
  'MEC 18': ['MEC 05', 'MEC 06', 'MEC 11', 'MEC 13', 'MEC 14'],
  'MEC 09': ['MEC 10', 'MEC 12'],
  'CAD 02': ['CAD 05'],
  'BRA 02': ['BRA 01'],
  'VER 35': ['VER 01'],
  'VER 02': ['VER 28', 'VER 33'],
  'VER 19': ['VER 14', 'VER 18'],
};

/**
 * Materiales de la hoja Insumos que ninguna receta usa todavía y que tampoco
 * comparten grupo con los de arriba, así que traen su propio precio.
 */
const INSUMOS_SUELTOS: Record<string, number> = {
  'TAP 13': 142.8,
  MER0014: 59.5,
};

const insumosDeFabrica = (): Record<string, InsumoPrecio> => {
  const out: Record<string, InsumoPrecio> = {};
  for (const [cod, valorMaximo] of Object.entries(INSUMO_VALOR_MAXIMO)) {
    out[cod] = { valorMaximo, descripcion: DESCRIPCIONES[cod] };
  }
  // Las variantes heredan el precio de su grupo, que es lo que hace el Excel.
  for (const [representante, variantes] of Object.entries(GRUPOS_INSUMO)) {
    const valorMaximo = INSUMO_VALOR_MAXIMO[representante];
    if (valorMaximo === undefined) continue;
    for (const cod of variantes) out[cod] = { valorMaximo, descripcion: DESCRIPCIONES[cod] };
  }
  for (const [cod, valorMaximo] of Object.entries(INSUMOS_SUELTOS)) {
    out[cod] = { valorMaximo, descripcion: DESCRIPCIONES[cod] };
  }
  return out;
};

/** Con qué otros códigos comparte precio este insumo en el Excel. */
export function grupoDelInsumo(cod: string): string[] {
  if (GRUPOS_INSUMO[cod]) return [cod, ...GRUPOS_INSUMO[cod]];
  for (const [representante, variantes] of Object.entries(GRUPOS_INSUMO)) {
    if (variantes.includes(cod)) return [representante, ...variantes];
  }
  return [];
}

/** Familia → COD_INT de la tela cuyo precio por metro se cobra. */
export const ARQUETIPOS_DEFAULT: Record<string, string> = {
  BLACKOUT_P: 'BK-P', BLACKOUT_D: 'BK-D', BLACKOUT_S: 'BK-S',
  SCREEN_P: 'SC-P', SCREEN_D: 'SC-D', SCREEN_S: 'SC-S',
  DUOBK_P: 'DB-P', DUOBK_D: 'DB-D', DUOBK_S: 'DB-S',
  DUOPOLI_P: 'DUOP-P', DUOPOLI_D: 'DUOP-D', DUOPOLI_S: 'DUOP-S',
};

/** Vertical → COD_INT del roller equivalente (de ahí sale su precio de tela). */
export const BASE_VERTICAL_DEFAULT: Record<string, string> = {
  BLACKOUT_V_P: 'BK-P', BLACKOUT_V_D: 'BK-D', BLACKOUT_V_S: 'BK-S',
  SCREEN_V_P: 'SC-P', SCREEN_V_D: 'SC-D', SCREEN_V_S: 'SC-S',
};

/**
 * Vertical → su PROPIO código de tela. Acompaña al cobro por lamas: si se pasa
 * a cobrar el consumo real, tiene sentido que también cobre su propia tela y
 * no la del roller.
 */
export const BASE_VERTICAL_PROPIA: Record<string, string> = {
  BLACKOUT_V_P: 'BK-V-P', BLACKOUT_V_D: 'BK-V-D', BLACKOUT_V_S: 'BK-V-S',
  SCREEN_V_P: 'SC-V-P', SCREEN_V_D: 'SC-V-D', SCREEN_V_S: 'SC-V-S',
};

/**
 * Como el Excel: paños enteros. La lama de 8,9 cm se monta cada 8 cm y el rollo
 * de tela vertical mide 2,95 m (el ancho que traen los códigos verticales del
 * catálogo es el del roller, por eso no se usa).
 */
export const TELA_VERTICAL_DEFAULT: TelaVertical = {
  modo: 'panos',
  anchoLamaM: 0.089,
  pasoLamaM: 0.08,
  anchoRolloVerticalM: 2.95,
};

export const REGLAS_PRECIOS_DEFAULT: ReglasPrecios = {
  insumos: insumosDeFabrica(),
  recetas: RECETAS_DEFAULT,
  arquetipos: ARQUETIPOS_DEFAULT,
  baseVertical: BASE_VERTICAL_DEFAULT,
  regalo: 0,
  // 2,45 es el respaldo histórico del Excel de precios (≠ 2,98 del corte de
  // tela): último recurso cuando ni el catálogo ni la tabla de anchos lo dicen.
  anchoRolloFallbackM: 2.45,
  telaVertical: TELA_VERTICAL_DEFAULT,
};

/** Cuántas lamas rinde una pasada del rollo (se desprecia la orilla sobrante). */
export function lamasPorPasada(t: TelaVertical): number {
  return Math.max(1, Math.floor(t.anchoRolloVerticalM / t.anchoLamaM));
}

/** Las mismas reglas de fábrica con otros VALOR MAXIMO (para recalcular cotizaciones viejas). */
export function conValoresMaximos(overrides: Record<string, number>): ReglasPrecios {
  const insumos: Record<string, InsumoPrecio> = {};
  for (const [cod, ins] of Object.entries(REGLAS_PRECIOS_DEFAULT.insumos)) {
    insumos[cod] = { ...ins, valorMaximo: overrides[cod] ?? ins.valorMaximo };
  }
  for (const [cod, valorMaximo] of Object.entries(overrides)) {
    if (!insumos[cod]) insumos[cod] = { valorMaximo };
  }
  return { ...REGLAS_PRECIOS_DEFAULT, insumos };
}

// ── Qué receta le toca a una familia ──────────────────────────────────

/**
 * QUÉ receta le toca a una familia. Si su COD no está en el catálogo, cae en la
 * que le corresponde por parecido, igual que hacía el código viejo con un COD
 * desconocido: las verticales a la receta vertical, los dúos al dúo genérico
 * y el resto al roller de su gama.
 *
 * Está separada de `resolverReceta` porque el Admin necesita mostrar el NOMBRE
 * de la receta con que se cobra cada tela, no solo sus líneas.
 */
export function claveReceta(
  cod: string,
  esVertical: boolean,
  recetas: Record<string, LineaReceta[]> = RECETAS_DEFAULT,
): string {
  if (esVertical) return RECETA_VERTICAL_KEY;
  if (recetas[cod]) return cod;
  const esDuo = cod.startsWith('DUOBK') || cod.startsWith('DUOPOLI') || cod.startsWith('DUO');
  if (esDuo) return RECETA_DUO_GENERICO_KEY;
  const gamaS = cod.endsWith('_S');
  const esScreen = cod.startsWith('SCREEN');
  return gamaS ? (esScreen ? 'SCREEN_S' : 'BLACKOUT_S') : 'BLACKOUT_P';
}

/**
 * Receta de una familia, con la cascada de `claveReceta`. Si la clave elegida
 * tampoco está en las recetas recibidas (p.ej. alguien borró la familia de
 * respaldo), se usa la de fábrica antes que dejar la cortina sin materiales.
 */
export function resolverReceta(
  cod: string,
  esVertical: boolean,
  recetas: Record<string, LineaReceta[]> = RECETAS_DEFAULT,
): LineaReceta[] {
  const clave = claveReceta(cod, esVertical, recetas);
  return recetas[clave] ?? RECETAS_DEFAULT[clave];
}

// ── Normalización ─────────────────────────────────────────────────────

const numeroFinito = (x: unknown, porDefecto: number): number =>
  typeof x === 'number' && Number.isFinite(x) ? x : porDefecto;

function saneaFiltro(crudo: unknown): FiltroAncho | undefined {
  if (!crudo || typeof crudo !== 'object') return undefined;
  const o = crudo as Record<string, unknown>;
  const f: FiltroAncho = {};
  if (typeof o.min === 'number' && Number.isFinite(o.min)) f.min = o.min;
  if (typeof o.max === 'number' && Number.isFinite(o.max)) f.max = o.max;
  return f.min === undefined && f.max === undefined ? undefined : f;
}

function saneaCantidad(crudo: unknown): CantidadReceta | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const o = crudo as Record<string, unknown>;
  const factor = typeof o.factor === 'number' && Number.isFinite(o.factor) ? o.factor : undefined;
  switch (o.tipo) {
    case 'porCortina':
      return { tipo: 'porCortina', factor, filtroAncho: saneaFiltro(o.filtroAncho) };
    case 'porCortinaCuadrado':
      return { tipo: 'porCortinaCuadrado', factor };
    case 'sumaAnchos': {
      const masFijoM = typeof o.masFijoM === 'number' && Number.isFinite(o.masFijoM) ? o.masFijoM : undefined;
      return { tipo: 'sumaAnchos', factor, masFijoM, filtroAncho: saneaFiltro(o.filtroAncho) };
    }
    case 'sumaAltos':
      return { tipo: 'sumaAltos', factor };
    case 'fijo':
      return { tipo: 'fijo', cantidad: numeroFinito(o.cantidad, 0) };
    case 'lamas':
      return { tipo: 'lamas', factor };
    default:
      return null;
  }
}

function saneaReceta(crudo: unknown): LineaReceta[] | null {
  if (!Array.isArray(crudo)) return null;
  const lineas: LineaReceta[] = [];
  for (const l of crudo) {
    if (!l || typeof l !== 'object') continue;
    const o = l as Record<string, unknown>;
    const insumo = String(o.insumo ?? '').trim();
    if (!insumo) continue;
    const cantidad = saneaCantidad(o.cantidad);
    if (!cantidad) continue;
    lineas.push({ insumo, precio: o.precio === 'costo' ? 'costo' : 'venta', cantidad });
  }
  return lineas;
}

function saneaMapaTexto(crudo: unknown, porDefecto: Record<string, string>): Record<string, string> {
  const out = { ...porDefecto };
  if (crudo && typeof crudo === 'object') {
    for (const [k, val] of Object.entries(crudo as Record<string, unknown>)) {
      const s = String(val ?? '').trim();
      if (s) out[k] = s;
    }
  }
  return out;
}

/**
 * Mezcla lo guardado con los valores de fábrica.
 *
 * Cuidado con el patrón: una receta guardada REEMPLAZA a la de fábrica de esa
 * familia (no se fusionan línea a línea, porque quitar una línea tiene que ser
 * posible). La consecuencia es que un arreglo de receta hecho en el código NO
 * le llega a una empresa que ya guardó la suya: hay que avisarle. Es el mismo
 * comportamiento del catálogo técnico, y por eso —igual que allá— se reponen
 * los insumos de fábrica que una receta vigente nombre y que el guardado no
 * traiga, para que ninguna línea quede sin precio.
 */
export function normalizarReglasPrecios(crudo: unknown): ReglasPrecios {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;

  const insumos: Record<string, InsumoPrecio> = {};
  if (o.insumos && typeof o.insumos === 'object') {
    for (const [cod, val] of Object.entries(o.insumos as Record<string, unknown>)) {
      const codLimpio = cod.trim();
      if (!codLimpio) continue;
      if (typeof val === 'number') {
        if (Number.isFinite(val)) insumos[codLimpio] = { valorMaximo: val, descripcion: DESCRIPCIONES[codLimpio] };
        continue;
      }
      if (!val || typeof val !== 'object') continue;
      const iv = val as Record<string, unknown>;
      if (typeof iv.valorMaximo !== 'number' || !Number.isFinite(iv.valorMaximo)) continue;
      const descripcion = typeof iv.descripcion === 'string' ? iv.descripcion : DESCRIPCIONES[codLimpio];
      insumos[codLimpio] = { valorMaximo: iv.valorMaximo, descripcion };
    }
  }
  const usarInsumosGuardados = Object.keys(insumos).length > 0;
  const insumosFinal = usarInsumosGuardados ? insumos : insumosDeFabrica();

  const recetas: Record<string, LineaReceta[]> = { ...RECETAS_DEFAULT };
  if (o.recetas && typeof o.recetas === 'object') {
    for (const [fam, val] of Object.entries(o.recetas as Record<string, unknown>)) {
      const limpia = saneaReceta(val);
      if (limpia) recetas[fam.trim()] = limpia;
    }
  }

  // Reponer los insumos de fábrica que alguna receta vigente nombre y que el
  // guardado no traiga: si no, esa línea se cobraría a $0 en silencio.
  if (usarInsumosGuardados) {
    const fabrica = insumosDeFabrica();
    for (const lineas of Object.values(recetas)) {
      for (const l of lineas) {
        if (!insumosFinal[l.insumo] && fabrica[l.insumo]) insumosFinal[l.insumo] = fabrica[l.insumo];
      }
    }
  }

  const anchoRollo = numeroFinito(o.anchoRolloFallbackM, REGLAS_PRECIOS_DEFAULT.anchoRolloFallbackM);
  return {
    insumos: insumosFinal,
    recetas,
    arquetipos: saneaMapaTexto(o.arquetipos, ARQUETIPOS_DEFAULT),
    baseVertical: saneaMapaTexto(o.baseVertical, BASE_VERTICAL_DEFAULT),
    regalo: Math.max(0, numeroFinito(o.regalo, 0)),
    anchoRolloFallbackM: anchoRollo > 0 ? anchoRollo : REGLAS_PRECIOS_DEFAULT.anchoRolloFallbackM,
    telaVertical: saneaTelaVertical(o.telaVertical),
  };
}

/** Lo guardado antes de que existiera el cobro por lamas queda en modo paños. */
function saneaTelaVertical(crudo: unknown): TelaVertical {
  const d = TELA_VERTICAL_DEFAULT;
  if (!crudo || typeof crudo !== 'object') return d;
  const o = crudo as Record<string, unknown>;
  const positivo = (x: unknown, porDefecto: number) => {
    const n = numeroFinito(x, porDefecto);
    return n > 0 ? n : porDefecto;
  };
  return {
    modo: o.modo === 'lamas' ? 'lamas' : 'panos',
    anchoLamaM: positivo(o.anchoLamaM, d.anchoLamaM),
    pasoLamaM: positivo(o.pasoLamaM, d.pasoLamaM),
    anchoRolloVerticalM: positivo(o.anchoRolloVerticalM, d.anchoRolloVerticalM),
  };
}

export function sonReglasPreciosDefault(reglas: ReglasPrecios): boolean {
  return JSON.stringify(reglas) === JSON.stringify(REGLAS_PRECIOS_DEFAULT);
}

// ── Validación ────────────────────────────────────────────────────────

export type ResultadoValidacionPrecios = { errores: string[]; avisos: string[] };

/**
 * Revisa las reglas antes de guardarlas. Los errores impiden guardar (dejarían
 * cortinas cobradas a $0 o cuentas imposibles); los avisos solo se muestran.
 */
export function validarReglasPrecios(reglas: ReglasPrecios): ResultadoValidacionPrecios {
  const errores: string[] = [];
  const avisos: string[] = [];

  for (const [cod, ins] of Object.entries(reglas.insumos)) {
    if (!Number.isFinite(ins.valorMaximo) || ins.valorMaximo <= 0) {
      errores.push(`El insumo «${cod}» tiene un valor inválido: tiene que ser mayor que cero.`);
    }
  }

  const usados = new Set<string>();
  for (const [fam, lineas] of Object.entries(reglas.recetas)) {
    if (!lineas.length) {
      errores.push(`La familia «${fam}» se quedó sin materiales: agrega al menos una línea o restaura la de fábrica.`);
      continue;
    }
    lineas.forEach((l, i) => {
      usados.add(l.insumo);
      const dónde = `«${fam}», línea ${i + 1} (${l.insumo})`;
      if (!reglas.insumos[l.insumo]) {
        errores.push(`${dónde}: ese insumo no está en la lista de precios, así que se cobraría $0.`);
      }
      const q = l.cantidad;
      if (q.tipo === 'fijo') {
        if (!Number.isFinite(q.cantidad) || q.cantidad < 0) errores.push(`${dónde}: la cantidad fija tiene que ser un número de cero para arriba.`);
      } else if ('factor' in q && q.factor !== undefined && (!Number.isFinite(q.factor) || q.factor < 0)) {
        errores.push(`${dónde}: el factor tiene que ser un número de cero para arriba.`);
      }
      if (q.tipo === 'sumaAnchos' && q.masFijoM !== undefined && !Number.isFinite(q.masFijoM)) {
        errores.push(`${dónde}: los metros fijos que se suman no son un número.`);
      }
      const filtro = 'filtroAncho' in q ? q.filtroAncho : undefined;
      if (filtro?.min !== undefined && filtro?.max !== undefined && filtro.min > filtro.max) {
        errores.push(`${dónde}: el tramo de anchos está al revés (desde ${filtro.min} hasta ${filtro.max}).`);
      }
    });

    // Hueco entre tramos: dos líneas del mismo insumo-tipo que no se tocan.
    const topes = lineas
      .map((l) => ('filtroAncho' in l.cantidad ? l.cantidad.filtroAncho : undefined))
      .filter((f): f is FiltroAncho => !!f);
    for (const a of topes) {
      if (a.max === undefined) continue;
      for (const b of topes) {
        if (b.min === undefined) continue;
        const hueco = b.min - a.max;
        if (hueco > 0 && hueco < 0.05) {
          avisos.push(
            `«${fam}»: entre ${a.max} m y ${b.min} m queda un hueco — una cortina de ese ancho exacto no suma ese material. Es como está en el Excel; se avisa por las dudas.`,
          );
        }
      }
    }
  }

  // Solo se avisa por los que alguien dio de alta a mano: la lista de fábrica
  // trae a propósito las variantes de color de cada material, que están ahí
  // para poder cambiarlas por la que usa la receta, no para usarse todas.
  for (const cod of Object.keys(reglas.insumos)) {
    if (!usados.has(cod) && !REGLAS_PRECIOS_DEFAULT.insumos[cod]) {
      avisos.push(`El insumo «${cod}» tiene precio pero ninguna familia lo usa.`);
    }
  }

  // En el Excel las variantes de un mismo material comparten precio por
  // construcción (el VALOR MAXIMO es el máximo del grupo). Acá se pueden
  // separar, pero conviene que se note.
  for (const [representante, variantes] of Object.entries(GRUPOS_INSUMO)) {
    const base = reglas.insumos[representante]?.valorMaximo;
    if (base === undefined) continue;
    const distintas = variantes.filter(
      (c) => reglas.insumos[c] && reglas.insumos[c].valorMaximo !== base,
    );
    if (distintas.length) {
      avisos.push(
        `«${representante}» y ${distintas.map((c) => `«${c}»`).join(', ')} son el mismo material en el Excel y ahí cobran igual, pero acá tienen precios distintos.`,
      );
    }
  }

  for (const [fam, codInt] of Object.entries(reglas.arquetipos)) {
    if (!codInt.trim()) errores.push(`La familia «${fam}» se quedó sin tela de referencia.`);
  }
  if (!(reglas.anchoRolloFallbackM > 0)) {
    errores.push('El ancho de rollo de respaldo tiene que ser mayor que cero.');
  }

  const tv = reglas.telaVertical;
  if (!(tv.anchoLamaM > 0)) {
    errores.push('El ancho de la lama vertical tiene que ser mayor que cero.');
  }
  if (!(tv.pasoLamaM > 0)) {
    errores.push('La separación entre lamas verticales tiene que ser mayor que cero.');
  }
  if (tv.anchoLamaM > 0 && tv.anchoRolloVerticalM < tv.anchoLamaM) {
    errores.push(
      `El rollo de tela vertical (${tv.anchoRolloVerticalM} m) es más angosto que una lama (${tv.anchoLamaM} m): no saldría ninguna.`,
    );
  }
  if (tv.pasoLamaM > tv.anchoLamaM) {
    avisos.push(
      'Las lamas verticales se montan más separadas que su propio ancho, así que quedarían huecos entre ellas. Normalmente se traslapan.',
    );
  }
  if (!Number.isFinite(reglas.regalo) || reglas.regalo < 0) {
    errores.push('El regalo tiene que ser un monto de cero para arriba.');
  }

  return { errores, avisos: [...new Set(avisos)] };
}

// ── Explicación en castellano ─────────────────────────────────────────

const nMetros = (x: number) => `${String(x).replace('.', ',')} m`;

function tramoEnPalabras(f?: FiltroAncho): string {
  if (!f) return '';
  if (f.min !== undefined && f.max !== undefined) return ` de entre ${nMetros(f.min)} y ${nMetros(f.max)} de ancho`;
  if (f.max !== undefined) return ` de hasta ${nMetros(f.max)} de ancho`;
  if (f.min !== undefined) return ` de ${nMetros(f.min)} de ancho o más`;
  return '';
}

/** La regla de cantidad contada en castellano, para mostrarla al lado del número. */
export function explicarCantidad(q: CantidadReceta): string {
  const f = q.tipo === 'fijo' ? undefined : q.factor;
  const veces = f === undefined || f === 1 ? '' : ` × ${String(f).replace('.', ',')}`;
  switch (q.tipo) {
    case 'porCortina': {
      const tramo = tramoEnPalabras(q.filtroAncho);
      const cuantos = f === undefined || f === 1 ? '1' : String(f).replace('.', ',');
      return `${cuantos} por cada cortina${tramo}`;
    }
    case 'porCortinaCuadrado':
      return `cantidad de cortinas al cuadrado${veces}`;
    case 'sumaAnchos': {
      const tramo = tramoEnPalabras(q.filtroAncho);
      const base = `suma de los anchos de las cortinas${tramo}`;
      const fijo = q.masFijoM ? `, más ${nMetros(q.masFijoM)} fijos` : '';
      return `${base}${veces}${fijo}`;
    }
    case 'sumaAltos':
      return `suma de los altos vendidos${veces}`;
    case 'fijo':
      return `${String(q.cantidad).replace('.', ',')} por familia, sin importar cuántas cortinas`;
    case 'lamas':
      return `lamas de la cortina: suma de anchos ÷ 0,8 × 10${veces}`;
  }
}
