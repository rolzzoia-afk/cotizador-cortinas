// ─────────────────────────────────────────────────────────────────────
// REGLAS DE SISTEMAS DE OSCURIDAD — fuente: SISTEMAS OSCURIDAD.xlsx
//
// Cada sistema (Soft Light 38/45, Soft Light con cenefa cuadrada,
// Oscuranti, Dark) tiene 3 variantes de instalación: INTERNO / SEMI /
// EXTERNO. Cada variante define las medidas de corte de sus componentes
// y 6 PERFILES con interruptor ON/OFF (izq/der/inferior, a muro o piso).
//
// Todas las medidas se expresan como AJUSTE NETO sobre el ANCHO (cm) salvo
// los perfiles laterales, que se calculan sobre el ALTO (cm). Los ajustes
// fueron extraídos celda por celda del Excel y validados en los tests
// dorados (reglas-oscuridad.test.ts). Si la planilla cambia, editar SOLO
// las tablas de abajo.
//
// DARK / OSCURANTI / 0,45_1,2mm: sus cortes salen de las pizarras oficiales
// (2026-07-27 y 2026-07-28) y se leen ENCADENADOS — cada pieza se mide sobre la
// ANTERIOR, no sobre el ancho:  pieza frontal → tubo → tela → peso.
// ESCALA (corrección del usuario 2026-07-31): las pizarras anotan "0,3 mm",
// "0,6 mm", "0,2 mm", "0,8 mm", pero esos números son 3 · 6 · 2 · 8 MILÍMETROS,
// o sea DÉCIMAS de cm (0,3 · 0,6 · 0,2 · 0,8 cm). Hasta ese día se los tomaba
// como milímetros literales (0,6 mm = 0,06 cm) y el corte salía ~5 mm largo.
// Cierre independiente: la tabla NETA de SOFT_LIGHT_CC (sacada del xlsx, en
// décimas) cae exacta sobre esta cadena — tubo −6,1 = −0,3 − 5,8 · tela −6,7 =
// tubo − 0,6 · peso −6,5 = tela + 0,2, y lo mismo en SEMI y EXTERNO.
// La cadena se calcula EXACTA (con todos sus decimales) y el recorte a la décima
// por DEFECTO (t1: trunca, nunca redondea hacia arriba — una pieza pasada no
// entra en el vano) es solo de IMPRESIÓN: cada pieza se trunca al emitirse, pero
// el eslabón siguiente parte del valor exacto. Con todos los ajustes ya en
// décimas el truncado casi nunca muerde; queda como red de seguridad.
// DARK_45MM comparte estas tablas hasta que lleguen sus fórmulas propias.
//
// Mapeo a columnas del Excel de órdenes (las reconoce el optimizador
// legacy en COLUMNAS_CORTE):
//   Tubo            → TUBO
//   Peso            → PESO SOFT LIGHT
//   Cenefa Delantera→ CENEFA DELANTERA
//   Cenefa Trasera  → CENEFA TRASERA
//   Perfil izq      → PERFIL (IZQ) INT
//   Perfil der      → PERFIL (DER) INT
//   Perfil inferior → PERFIL BASE
//   Perfil superior → PERFIL SUPERIOR (CENEF.PRO)  [solo OSCURANTI]
//   Tela / Velcro   → '' (viaja por el flujo de telas, no por la estructura)
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────
import { categoriaEfectiva, type TipoCortina } from './tiposCortina';

export type VarianteOscuridad = 'INTERNO' | 'SEMI' | 'EXTERNO';

export type FamiliaOscuridad =
  | 'SOFT_LIGHT_38'
  | 'SOFT_LIGHT_45'
  | 'SOFT_LIGHT_CC' // Soft Light 38 mm con cenefa cuadrada
  | 'SOFT_LIGHT_CC_45' // Soft Light 45 mm (0,45_1,2mm) con cenefa cuadrada
  | 'OSCURANTI'
  | 'DARK' // Dark 38 mm
  | 'DARK_45'; // Dark 0,45_1,2mm (pizarra 2026-07-28)

/** Perforación (anotación de taller) de un perfil: no cambia la medida. */
export type PerforacionPerfil = 'INTERNO' | 'EXTERNO';

/**
 * Montaje del perfil base (inferior) — SOLO soft light INTERNO:
 *   'DENTRO' (default) = entre los perfiles laterales → ancho − 13,3.
 *   'PARED'            = de pared a pared → ancho real completo.
 * No afecta SEMI/EXTERNO ni a Oscuranti/Dark (siguen = cenefa frontal − descuento).
 */
export type MontajeBaseOscuridad = 'DENTRO' | 'PARED';

export type PerfilesOscuridad = {
  /** Superficie (define la MEDIDA): muro = alto+10, piso = alto, marco (dentro del
   *  marco) = alto (sin descuento). Se elige en Fase 2. */
  izqMuro?: boolean;
  izqPiso?: boolean;
  izqMarco?: boolean;
  derMuro?: boolean;
  derPiso?: boolean;
  derMarco?: boolean;
  infMuro?: boolean;
  infPiso?: boolean;
  infMarco?: boolean;
  /**
   * Perfil ACTIVO (lleva perfil izq/der/base), independiente de la superficie.
   * La variante en Fase 1 activa los laterales aunque la superficie (medida)
   * quede pendiente para Fase 2. Retro-compat: un perfil con muro/piso marcado
   * cuenta como activo aunque estas banderas vengan ausentes.
   */
  izqActivo?: boolean;
  derActivo?: boolean;
  infActivo?: boolean;
  /** Perforación INTERNO/EXTERNO por perfil (SEMI puede dejarla sin definir). */
  izqPerf?: PerforacionPerfil;
  derPerf?: PerforacionPerfil;
  infPerf?: PerforacionPerfil;
  /** Montaje del perfil base (soft light INTERNO): 'DENTRO' (default) = ancho − 13,3;
   *  'PARED' = ancho completo. Se elige en Fase 2; sin efecto en otras familias/variantes. */
  infMontaje?: MontajeBaseOscuridad;
  /** Perfiles SEPARADORES (E41/E42/E43) por lado — activación independiente; la
   *  medida sale del perfil del mismo lado salvo override manual (ver sep*Cm). */
  sepIzq?: boolean;
  sepDer?: boolean;
  sepInf?: boolean;
};

/** Claves de SUPERFICIE de perfil (definen la medida: muro=alto+10, piso/marco=alto). */
export type SuperficiePerfilKey =
  | 'izqMuro'
  | 'izqPiso'
  | 'izqMarco'
  | 'derMuro'
  | 'derPiso'
  | 'derMarco'
  | 'infMuro'
  | 'infPiso'
  | 'infMarco';

/** Claves con override de medida manual: superficies + separadores por lado. */
export type MedidaPerfilKey = SuperficiePerfilKey | 'sepIzq' | 'sepDer' | 'sepInf';

/** Medidas manuales (cm) que sobreescriben la calculada de cada perfil/separador. */
export type MedidasPerfilesOscuridad = Partial<Record<MedidaPerfilKey, number>>;

/** Devuelve el override si es un número válido (> 0); si no, la medida calculada. */
function aplicarOverride(calculada: number, override: number | undefined): number {
  return typeof override === 'number' && Number.isFinite(override) && override > 0
    ? t1(override)
    : calculada;
}

export type CorteOscuridad = {
  componente: string;
  /** Columna del Excel de órdenes ('' = no viaja, va por flujo de telas). */
  columnaExcel: string;
  medidaCm: number;
  /** true si proviene de un perfil con interruptor ON/OFF. */
  perfil?: boolean;
  /** Perforación del perfil (INTERNO/EXTERNO) — anotación de taller. */
  perforacion?: PerforacionPerfil;
  /** Perfil activo pero sin superficie (muro/piso) elegida → medida pendiente (Fase 2). */
  pendienteMedida?: boolean;
};

export const PERFILES_OSCURIDAD: Array<{ key: SuperficiePerfilKey; label: string }> = [
  { key: 'izqMuro', label: 'Perfil izquierdo a Muro' },
  { key: 'izqPiso', label: 'Perfil izquierdo a Piso' },
  { key: 'izqMarco', label: 'Perfil izquierdo dentro del Marco' },
  { key: 'derMuro', label: 'Perfil derecho a Muro' },
  { key: 'derPiso', label: 'Perfil derecho a Piso' },
  { key: 'derMarco', label: 'Perfil derecho dentro del Marco' },
  { key: 'infMuro', label: 'Perfil inferior a Muro' },
  { key: 'infPiso', label: 'Perfil inferior al Piso' },
  { key: 'infMarco', label: 'Perfil inferior dentro del Marco' },
];

export const VARIANTES_OSCURIDAD: VarianteOscuridad[] = ['INTERNO', 'SEMI', 'EXTERNO'];

// Recorte de IMPRESIÓN a 1 decimal, TRUNCANDO (regla del usuario 2026-07-31): "los
// cálculos tienen que ser exactos… los resultados que se imprimen en las hojas son los
// que tienen que mostrar solo un decimal", y ninguna medida puede PASARSE de lo que da
// la fórmula — una pieza que sobra no entra en el vano. Se aplica SOLO al emitir cada
// pieza; la cadena sigue con el exacto. Desde la corrección de escala (todos los
// ajustes son décimas) ya no hay centésimas que recortar: queda como red de seguridad
// y, sobre todo, para absorber el polvo binario (337,49999999999994 → 337,5) vía el
// épsilon, que es más chico que cualquier ajuste real de las pizarras.
const t1 = (n: number) => Math.floor(n * 10 + 1e-7) / 10;

const VI: Record<VarianteOscuridad, number> = { INTERNO: 0, SEMI: 1, EXTERNO: 2 };

/**
 * Familias soft light "de tabla": sus descuentos son NETOS sobre el ancho, en cm
 * con un decimal (SISTEMAS OSCURIDAD.xlsx). No encadenan. La tabla de
 * SOFT_LIGHT_CC es además el testigo que fija la escala de las pizarras: sus
 * netos son exactamente la cadena −0,3 / −5,8 / −0,6 / +0,2 acumulada.
 */
export type FamiliaSoftLightNeta = 'SOFT_LIGHT_38' | 'SOFT_LIGHT_45' | 'SOFT_LIGHT_CC';
/**
 * Familias de PIZARRA: tubo, tela y peso se miden en cadena sobre la medida
 * EXACTA de la pieza anterior (ver TUBO_PASO).
 */
type FamiliaEncadenada = Exclude<FamiliaOscuridad, FamiliaSoftLightNeta>;

// Ajuste neto sobre el ANCHO por [INTERNO, SEMI, EXTERNO].
const CENEFA_ADJ: Record<FamiliaOscuridad, [number, number, number]> = {
  SOFT_LIGHT_38: [-1.2, 6.6, 13.2],
  // El 45 mm descuenta 1,5 en INTERNO (no 1,2 como el 38): corrección del dueño
  // 2026-08-10 con la OT 3169 (ancho 281 → cenefa 279,5, que es lo que ya cobraba
  // el Excel de órdenes). Tubo/tela/peso son netos sobre el ancho y no cambian.
  SOFT_LIGHT_45: [-1.5, 6.6, 13.2],
  SOFT_LIGHT_CC: [-0.3, 7.5, 15.8],
  // OSCURANTI: perfil superior = ancho − 0,3 (la pizarra 2026-07-28 lo anota
  // "0,3 mm" = 3 mm). SEMI/EXTERNO suman cm enteros.
  OSCURANTI: [-0.3, 7.5, 15.8],
  // DARK: cenefa cuadrada delantera = ancho − 0,3 (pizarra 2026-07-27).
  DARK: [-0.3, 7.5, 15.8],
  // Sistemas 0,45_1,2mm (pizarras 2026-07-28): mismo encadenado que DARK 38.
  DARK_45: [-0.3, 7.5, 15.8],
  SOFT_LIGHT_CC_45: [-0.3, 7.5, 15.8],
};
const TUBO_ADJ: Record<FamiliaSoftLightNeta, [number, number, number]> = {
  SOFT_LIGHT_38: [-3.0, 4.8, 11.4],
  // Soft light 45 mm (0,45_1,2mm) BLANCO: tubo = cenefa − 3,1 (fórmula usuario 2026-07-24).
  SOFT_LIGHT_45: [-4.3, 3.5, 10.1],
  SOFT_LIGHT_CC: [-6.1, 1.5, 9.4],
};
// Tubo con accesorios NEGROS. Único caso donde el corte de oscuridad depende del
// color: en el 45 mm el tubo es cenefa − 2,9 (en vez de − 3,1 del blanco), o sea
// +0,2 sobre la tabla blanca. La tela se compensa (tubo − 3,1) y queda idéntica.
// El resto de familias/colores usa TUBO_ADJ (fallback en cortesOscuridad).
const TUBO_ADJ_NEGRO: Partial<Record<FamiliaSoftLightNeta, [number, number, number]>> = {
  SOFT_LIGHT_45: [-4.1, 3.7, 10.3],
};
const PESO_ADJ: Record<FamiliaSoftLightNeta, [number, number, number]> = {
  SOFT_LIGHT_38: [-7.0, 0.8, 7.4],
  SOFT_LIGHT_45: [-7.0, 0.8, 7.4],
  SOFT_LIGHT_CC: [-6.5, 1.1, 9.0],
};
const TELA_ADJ: Record<FamiliaSoftLightNeta, [number, number, number]> = {
  SOFT_LIGHT_38: [-7.2, 0.6, 7.2],
  SOFT_LIGHT_45: [-7.2, 0.6, 7.2],
  SOFT_LIGHT_CC: [-6.7, 0.9, 8.8],
};
// ── Cadena de las familias de PIZARRA ──
// Paso del TUBO desde la pieza frontal EXACTA, por [INTERNO, SEMI, EXTERNO]:
//   OSCURANTI      → desde el PERFIL SUPERIOR   − 5,8 / 6 / 6,4 (pizarra 2026-07-28)
//   soft light CC 45 → desde la CENEFA DELANTERA − 5,8 / 6 / 6,4 (pizarra 2026-07-28)
//   DARK y DARK 45 → desde la CENEFA TRASERA    − 4,8 / 5 / 5,4 (pizarras 07-27/28)
const TUBO_PASO: Record<FamiliaEncadenada, [number, number, number]> = {
  OSCURANTI: [5.8, 6, 6.4],
  SOFT_LIGHT_CC_45: [5.8, 6, 6.4],
  DARK: [4.8, 5, 5.4],
  DARK_45: [4.8, 5, 5.4],
};
/** Tela = tubo − 0,6 cm (la pizarra lo anota "0,6 mm", son 6 mm). */
const TELA_PASO_CM = 0.6;
/** Peso = tela + 0,2 cm ("0,2 mm" de la pizarra = 2 mm): el peso se ve 2 mm más largo. */
const PESO_PASO_CM = 0.2;
// Cenefa trasera (solo DARK): cenefa delantera − 1.
const CENEFA_TRASERA_DESC = 1;
// Perfil inferior: cenefa delantera − descuento por familia y variante [INTERNO, SEMI, EXTERNO].
// Hoy solo lo usa DARK: soft light mide sobre el ancho real (INF_SOFTLIGHT_ADJ) y
// oscuranti también, por montaje (INF_OSCURANTI_ADJ).
const INF_DESC: Record<FamiliaOscuridad, [number, number, number]> = {
  SOFT_LIGHT_38: [12.6, 6.3, 12.6],
  SOFT_LIGHT_45: [12.6, 6.3, 12.6],
  SOFT_LIGHT_CC: [12.6, 6.3, 12.6],
  OSCURANTI: [13, 6.3, 12.6],
  DARK: [12.6, 6.3, 12.6],
  // Las familias 0,45_1,2mm miden el base sobre el ANCHO por montaje
  // (INF_45_ADJ); estas entradas no se usan (quedan por completitud del Record).
  DARK_45: [12.6, 6.3, 12.6],
  SOFT_LIGHT_CC_45: [12.6, 6.3, 12.6],
};
// Soft light: el perfil base NO se mide sobre la cenefa sino sobre el ANCHO REAL
// directo, con un ajuste neto por variante y montaje (dentro de los laterales /
// pared a pared). SEMI no tiene montaje "dentro" (DENTRO: null) → siempre pared
// a pared. (INTERNO: −13,3 dentro / +0 pared · EXTERNO: +0,8 dentro (el "0,8 mm"
// de la planilla son 8 mm) / +14 pared · SEMI: +7,5 siempre.)
const INF_SOFTLIGHT_ADJ: Record<VarianteOscuridad, { DENTRO: number | null; PARED: number }> = {
  INTERNO: { DENTRO: -13.3, PARED: 0 },
  SEMI: { DENTRO: null, PARED: 7.5 },
  EXTERNO: { DENTRO: 0.8, PARED: 14 },
};
// Oscuranti: igual que soft light, el perfil base se mide sobre el ANCHO REAL con
// ajuste por variante y montaje (pizarra 2026-07-28). SEMI solo va pared a pared.
//   INTERNO: dentro = ancho − 13,3 · pared = ancho (perforación externa).
//   SEMI:    pared = ancho − 7,5 (perforación siempre externa).
//   EXTERNO: dentro = ancho − 0,8 (la pizarra dice "0,8 MM": son 8 mm) · pared =
//            ancho + 14 (perf. externa).
const INF_OSCURANTI_ADJ: Record<VarianteOscuridad, { DENTRO: number | null; PARED: number }> = {
  INTERNO: { DENTRO: -13.3, PARED: 0 },
  SEMI: { DENTRO: null, PARED: -7.5 },
  EXTERNO: { DENTRO: -0.8, PARED: 14 },
};
// Sistemas 0,45_1,2mm (DARK 45 y soft light cenefa cuadrada 45, pizarras
// 2026-07-28): el perfil base se mide sobre el ANCHO REAL por variante y montaje.
//   INTERNO: dentro = ancho − 13,3 · pared = ancho.
//   SEMI:    solo pared a pared = ancho − 7,5.
//   EXTERNO: dentro = ancho − 0,8 (la pizarra dice "0,8 MM": son 8 mm) · pared = ancho + 14.
// La perforación del base es EXTERNA en las tres variantes (default editable).
const INF_45_ADJ: Record<VarianteOscuridad, { DENTRO: number | null; PARED: number }> = {
  INTERNO: { DENTRO: -13.3, PARED: 0 },
  SEMI: { DENTRO: null, PARED: -7.5 },
  EXTERNO: { DENTRO: -0.8, PARED: 14 },
};
// Perfiles laterales (sobre el ALTO): a muro suma 10, a piso sin ajuste.
const PERFIL_LATERAL_MURO_SUMA = 10;
// Alto de la tira de velcro (DARK): fijo.
const ALTO_TELA_VELCRO_CM = 15;

/**
 * Todos los números de las pizarras de oscuridad, en un solo objeto para que
 * se puedan editar desde Admin (`formulasFamilias.ts`). Las funciones de este
 * archivo lo reciben como último parámetro opcional: sin pasarlo, se usan
 * estos valores y el comportamiento es el de siempre.
 *
 * Lo que NO entra acá es la ESTRUCTURA: qué familias existen, cuáles encadenan
 * y cuáles cortan neto, o que SEMI no tenga montaje "dentro" (el `null` de las
 * tablas INF_*). Eso es física del sistema, no un número a calibrar.
 */
export type FormulasOscuridad = {
  cenefaAdj: Record<FamiliaOscuridad, [number, number, number]>;
  tuboAdj: Record<FamiliaSoftLightNeta, [number, number, number]>;
  tuboAdjNegro: Partial<Record<FamiliaSoftLightNeta, [number, number, number]>>;
  pesoAdj: Record<FamiliaSoftLightNeta, [number, number, number]>;
  telaAdj: Record<FamiliaSoftLightNeta, [number, number, number]>;
  tuboPaso: Record<FamiliaEncadenada, [number, number, number]>;
  telaPasoCm: number;
  pesoPasoCm: number;
  cenefaTraseraDesc: number;
  infDesc: Record<FamiliaOscuridad, [number, number, number]>;
  /** Ajuste del perfil base por variante: [dentro, pared]. `null` = solo pared. */
  infSoftlight: Record<VarianteOscuridad, { DENTRO: number | null; PARED: number }>;
  infOscuranti: Record<VarianteOscuridad, { DENTRO: number | null; PARED: number }>;
  inf45: Record<VarianteOscuridad, { DENTRO: number | null; PARED: number }>;
  /** Perfil lateral a muro = alto + esto (piso y marco van al alto exacto). */
  perfilLateralMuroSuma: number;
  /** Alto de la tela de velcro (DARK): medida fija, no depende de la ventana. */
  altoTelaVelcroCm: number;
  /** Los sistemas de oscuridad cortan la tela con este extra sobre el alto. */
  altoTelaExtraCm: number;
  /**
   * Números PROPIOS de los tipos de cortina creados desde Admin, por categoría.
   * Mapa ABIERTO (a diferencia del resto, que son tablas cerradas por familia):
   * un tipo montado sobre DARK usa la mecánica de DARK con estos números.
   */
  porTipo: Record<string, ParcheOscuridad>;
};

/** Terna de una tabla de oscuridad: [INTERNO, SEMI, EXTERNO]. */
export type TernaVariantes = [number, number, number];

/** Tabla del perfil base por variante: [dentro, pared]; `null` = solo pared. */
export type TablaPerfilBase = Record<VarianteOscuridad, { DENTRO: number | null; PARED: number }>;

/**
 * Números propios de un TIPO de cortina montado sobre una familia de oscuridad.
 * Cada clave presente PISA la fila de la familia base; las ausentes se heredan.
 * No incluye los escalares compartidos (paso de tela, paso de peso, cenefa
 * trasera, velcro): esos son física del encadenado, no calibración por sistema.
 */
export type ParcheOscuridad = {
  cenefaAdj?: TernaVariantes;
  /** Solo si el molde es soft light (corte neto). */
  tuboAdj?: TernaVariantes;
  tuboAdjNegro?: TernaVariantes;
  pesoAdj?: TernaVariantes;
  telaAdj?: TernaVariantes;
  /** Solo si el molde encadena (dark, oscuranti, soft light con cenefa cuadrada 45). */
  tuboPaso?: TernaVariantes;
  infDesc?: TernaVariantes;
  /** Pisa la tabla de perfil base que lea el molde (softlight / oscuranti / 45). */
  infBase?: TablaPerfilBase;
};

export const FORMULAS_OSCURIDAD_DEFAULT: FormulasOscuridad = {
  cenefaAdj: CENEFA_ADJ,
  tuboAdj: TUBO_ADJ,
  tuboAdjNegro: TUBO_ADJ_NEGRO,
  pesoAdj: PESO_ADJ,
  telaAdj: TELA_ADJ,
  tuboPaso: TUBO_PASO,
  telaPasoCm: TELA_PASO_CM,
  pesoPasoCm: PESO_PASO_CM,
  cenefaTraseraDesc: CENEFA_TRASERA_DESC,
  infDesc: INF_DESC,
  infSoftlight: INF_SOFTLIGHT_ADJ,
  infOscuranti: INF_OSCURANTI_ADJ,
  inf45: INF_45_ADJ,
  perfilLateralMuroSuma: PERFIL_LATERAL_MURO_SUMA,
  altoTelaVelcroCm: ALTO_TELA_VELCRO_CM,
  altoTelaExtraCm: 25,
  porTipo: {},
};

/**
 * Fórmulas de oscuridad con la familia BASE pisada por el parche del tipo.
 *
 * Es lo que permite que un tipo creado desde Admin tenga números propios sin
 * abrir el union de familias: el motor sigue recibiendo una familia conocida
 * (la del molde) y una tabla ya parchada. El parcheo es POR LLAMADA, así que en
 * una misma orden pueden convivir un DARK nativo y un tipo montado sobre DARK
 * sin contaminarse.
 *
 * Sin parche devuelve el MISMO objeto (identidad), para no copiar en cada paño.
 */
export function formulasOscuridadParaTipo(
  f: FormulasOscuridad,
  categoria: string | null | undefined,
  familia: FamiliaOscuridad,
): FormulasOscuridad {
  const clave = (categoria || '').trim();
  const parche = clave ? f.porTipo?.[clave] : undefined;
  if (!parche) return f;

  const out: FormulasOscuridad = { ...f };
  const pisar = <K extends keyof FormulasOscuridad>(
    campo: K,
    valor: TernaVariantes | undefined,
  ) => {
    if (!valor) return;
    // La tabla es por familia: se clona y se reemplaza SOLO la fila del molde.
    out[campo] = { ...(f[campo] as object), [familia]: valor } as FormulasOscuridad[K];
  };

  pisar('cenefaAdj', parche.cenefaAdj);
  pisar('infDesc', parche.infDesc);
  if (esFamiliaSoftLight(familia)) {
    pisar('tuboAdj', parche.tuboAdj);
    pisar('tuboAdjNegro', parche.tuboAdjNegro);
    pisar('pesoAdj', parche.pesoAdj);
    pisar('telaAdj', parche.telaAdj);
  } else {
    pisar('tuboPaso', parche.tuboPaso);
  }
  if (parche.infBase) {
    // Cada molde lee una tabla distinta de perfil base; se pisa la que use.
    if (esFamiliaSoftLight(familia)) out.infSoftlight = parche.infBase;
    else if (familia === 'OSCURANTI') out.infOscuranti = parche.infBase;
    else if (esFamilia45(familia)) out.inf45 = parche.infBase;
  }
  return out;
}

const FAMILIAS_SOFT_LIGHT: FamiliaOscuridad[] = ['SOFT_LIGHT_38', 'SOFT_LIGHT_45', 'SOFT_LIGHT_CC'];
/**
 * ¿Es un sistema soft light de los que miden el base con INF_SOFTLIGHT_ADJ
 * (38/45 ovalada + cenefa cuadrada 38)? El soft light cenefa cuadrada de 45
 * tiene su propia tabla (INF_45_ADJ), así que NO entra acá. Son también las
 * familias que cortan con descuento NETO sobre el ancho (no encadenan).
 */
export function esFamiliaSoftLight(familia: FamiliaOscuridad): familia is FamiliaSoftLightNeta {
  return FAMILIAS_SOFT_LIGHT.includes(familia);
}
const FAMILIAS_45: FamiliaOscuridad[] = ['DARK_45', 'SOFT_LIGHT_CC_45'];
/** ¿Sistema 0,45_1,2mm (DARK 45 / soft light cenefa cuadrada 45)? */
export function esFamilia45(familia: FamiliaOscuridad): boolean {
  return FAMILIAS_45.includes(familia);
}
const FAMILIAS_DARK: FamiliaOscuridad[] = ['DARK', 'DARK_45'];
/** ¿Sistema DARK (38 o 45)? Lleva cenefa trasera y tira de velcro. */
export function esFamiliaDark(familia: FamiliaOscuridad): boolean {
  return FAMILIAS_DARK.includes(familia);
}
const FAMILIAS_CC: FamiliaOscuridad[] = ['SOFT_LIGHT_CC', 'SOFT_LIGHT_CC_45'];
/** ¿Soft light con cenefa CUADRADA (38 o 45)? */
export function esFamiliaSoftLightCC(familia: FamiliaOscuridad): boolean {
  return FAMILIAS_CC.includes(familia);
}
/** ¿Los accesorios del paño son negros? (Elige la tabla de tubo del 45 mm.) */
export function esColorAccesoriosNegro(valor: string | null | undefined): boolean {
  return (valor || '').trim().toUpperCase().startsWith('NEG');
}
const CON_CENEFA_DELANTERA: FamiliaOscuridad[] = [
  'SOFT_LIGHT_CC', 'SOFT_LIGHT_CC_45', 'OSCURANTI', 'DARK', 'DARK_45',
];

export function esFamiliaConCenefaCuadrada(familia: FamiliaOscuridad): boolean {
  return CON_CENEFA_DELANTERA.includes(familia);
}

function descPerfilInferior(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  f: FormulasOscuridad = FORMULAS_OSCURIDAD_DEFAULT,
): number {
  return f.infDesc[familia][VI[variante]];
}

/** Deriva la familia de oscuridad desde la categoría del cotizador + tipo de cenefa del paño. */
export function familiaOscuridad(
  categoria: string | undefined | null,
  cenefaTipo?: string | null,
  tipos?: readonly TipoCortina[],
): FamiliaOscuridad | null {
  // Un tipo de cortina propio se despieza con la mecánica de su molde.
  const cat = categoriaEfectiva(categoria, tipos).trim().toUpperCase();
  // Prefijo: cubre 'Cuadrada a muro' / 'a techo' y el 'Cuadrada' legacy.
  const esCuadrada = (cenefaTipo || '').trim().toUpperCase().startsWith('CUADRADA');
  if (cat === 'SOFT_LIGHT_38MM') return esCuadrada ? 'SOFT_LIGHT_CC' : 'SOFT_LIGHT_38';
  // El soft light 45 con cenefa CUADRADA tiene pizarra propia (0,45_1,2mm).
  if (cat === 'SOFT_LIGHT_45MM') return esCuadrada ? 'SOFT_LIGHT_CC_45' : 'SOFT_LIGHT_45';
  if (cat === 'DARK_38MM') return 'DARK';
  if (cat === 'DARK_45MM') return 'DARK_45';
  if (cat === 'OSCURANTI_63MM') return 'OSCURANTI';
  return null;
}

/**
 * Familia de oscuridad EFECTIVA según el diámetro de tubo ya resuelto: un soft
 * light 38 mm montado sobre tubo de 45 mm (banda 2,2–3,0 m con el toggle E78 de
 * la OT) usa el corte de tubo de 45 mm. El único descuento que difiere entre
 * SOFT_LIGHT_38 y _45 es el TUBO (cenefa/tela/peso/perfiles son idénticos), así
 * que el diámetro del modelo/tubo es el único lever. El resto de familias (CC,
 * DARK, OSCURANTI, soft light 45 nativo) se devuelven sin tocar.
 */
export function familiaOscuridadConDiametro(
  categoria: string | undefined | null,
  cenefaTipo: string | undefined | null,
  diametroTuboMm?: number | null,
  tipos?: readonly TipoCortina[],
): FamiliaOscuridad | null {
  const fam = familiaOscuridad(categoria, cenefaTipo, tipos);
  return fam === 'SOFT_LIGHT_38' && diametroTuboMm === 45 ? 'SOFT_LIGHT_45' : fam;
}

/** Normaliza el texto de perforación de un perfil ('INTERNO'|'EXTERNO'|undefined). */
export function normalizarPerforacion(
  valor: string | undefined | null,
): PerforacionPerfil | undefined {
  const v = (valor || '').trim().toUpperCase();
  if (v.includes('EXTERNO') || v === 'EXT') return 'EXTERNO';
  if (v.includes('INTERNO') || v === 'INT') return 'INTERNO';
  return undefined;
}

/** Normaliza el montaje del perfil base ('PARED'|'DENTRO'|undefined = default DENTRO). */
export function normalizarMontajeBase(
  valor: string | undefined | null,
): MontajeBaseOscuridad | undefined {
  const v = (valor || '').trim().toUpperCase();
  if (v.startsWith('PARED')) return 'PARED';
  if (v.startsWith('DENTRO')) return 'DENTRO';
  return undefined;
}

/** Familias cuyos LATERALES son parte física del sistema (siempre presentes). */
const CON_LATERALES_SIEMPRE: FamiliaOscuridad[] = [
  'SOFT_LIGHT_38', 'SOFT_LIGHT_45', 'SOFT_LIGHT_CC', 'SOFT_LIGHT_CC_45',
  'DARK', 'DARK_45', 'OSCURANTI',
];

/**
 * Aplica los defaults de perfiles que impone la VARIANTE (asignada en Fase 1):
 * en soft light / dark los dos LATERALES van siempre activos y su perforación
 * (INTERNO/EXTERNO) sale de la variante (SEMI = sin definir). Los flags que el
 * paño ya trae (Fase 2) mandan; solo se rellenan los que están sin definir. El
 * perfil base (inferior) NO se activa por defecto (se elige en Fase 2), pero en
 * los sistemas INTERNOS su perforación nace EXTERNA (pizarra 2026-07-27) — esto
 * aplica a TODA familia de oscuridad. En oscuranti nace EXTERNA en las tres
 * variantes (pizarra 2026-07-28: pared a pared int/ext externa, semi "siempre
 * externa"); en todos los casos es un default editable en Fase 2.
 */
export function aplicarDefaultsPerfiles(
  base: PerfilesOscuridad,
  familia: FamiliaOscuridad | null,
  variante: VarianteOscuridad,
): PerfilesOscuridad {
  if (!familia) return base;
  // Perfil BASE de un sistema INTERNO → perforación EXTERNA por defecto (editable).
  // En oscuranti y en los 0,45_1,2mm nace EXTERNA en las tres variantes.
  const infPerfDefault: PerforacionPerfil | undefined =
    variante === 'INTERNO' || familia === 'OSCURANTI' || esFamilia45(familia)
      ? 'EXTERNO'
      : undefined;
  // Los laterales solo se auto-activan (con su perforación por variante) en las
  // familias cuyos laterales son parte física del sistema.
  if (!CON_LATERALES_SIEMPRE.includes(familia)) {
    return { ...base, infPerf: base.infPerf ?? infPerfDefault };
  }
  const perfVariante: PerforacionPerfil | undefined =
    variante === 'INTERNO' ? 'INTERNO' : variante === 'EXTERNO' ? 'EXTERNO' : undefined;
  return {
    ...base,
    izqActivo: base.izqActivo ?? true,
    derActivo: base.derActivo ?? true,
    izqPerf: base.izqPerf ?? perfVariante,
    derPerf: base.derPerf ?? perfVariante,
    infPerf: base.infPerf ?? infPerfDefault,
  };
}

/** Normaliza el texto de variante (acepta sentido Fase 0 / selección Fase 2). */
export function normalizarVarianteOscuridad(
  valor: string | undefined | null,
  fallback: VarianteOscuridad = 'INTERNO',
): VarianteOscuridad {
  const v = (valor || '').trim().toUpperCase();
  if (v.includes('SEMI')) return 'SEMI';
  if (v.includes('EXTERNO')) return 'EXTERNO';
  if (v.includes('INTERNO')) return 'INTERNO';
  return fallback;
}

/** Medida de cenefa frontal (delantera) del sistema — base para el perfil inferior. */
export function cenefaFrontOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  anchoCm: number,
  f: FormulasOscuridad = FORMULAS_OSCURIDAD_DEFAULT,
): number {
  return t1(anchoCm + f.cenefaAdj[familia][VI[variante]]);
}

/**
 * Medida (cm) del perfil BASE (inferior). En soft light se mide sobre el ANCHO
 * REAL directo con un ajuste por variante y montaje (ver INF_SOFTLIGHT_ADJ):
 *   INTERNO: dentro = ancho − 13,3 · pared = ancho.
 *   EXTERNO: dentro = ancho + 0,08 · pared = ancho + 14.
 *   SEMI:    siempre pared a pared = ancho + 7,5 (no tiene "dentro").
 * Oscuranti también va sobre el ancho real, con su propia tabla (INF_OSCURANTI_ADJ),
 * y los 0,45_1,2mm (DARK 45 / soft light CC 45) con INF_45_ADJ.
 * Dark 38 = cenefa frontal − descuento de variante.
 */
export function medidaPerfilBaseOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  anchoCm: number,
  montaje?: MontajeBaseOscuridad,
  f: FormulasOscuridad = FORMULAS_OSCURIDAD_DEFAULT,
): number {
  const adjAncho = esFamiliaSoftLight(familia)
    ? f.infSoftlight[variante]
    : familia === 'OSCURANTI'
      ? f.infOscuranti[variante]
      : esFamilia45(familia)
        ? f.inf45[variante]
        : null;
  if (adjAncho) {
    // SEMI (DENTRO null) → siempre pared a pared; INTERNO/EXTERNO default DENTRO.
    const delta = adjAncho.DENTRO === null || montaje === 'PARED' ? adjAncho.PARED : adjAncho.DENTRO;
    return t1(anchoCm + delta);
  }
  // DARK 38: cenefa frontal − descuento. Se mide sobre la cenefa EXACTA (no la
  // impresa) y se trunca una sola vez, como el resto de la cadena.
  const cenefaExacta = anchoCm + f.cenefaAdj[familia][VI[variante]];
  return t1(cenefaExacta - descPerfilInferior(familia, variante, f));
}

/**
 * ¿Se ofrece el selector Dentro/Pared del perfil base? Soft light, oscuranti y
 * los 0,45_1,2mm, salvo en SEMI (que solo va pared a pared en todas ellas).
 */
export function montajeBaseDisponible(
  familia: FamiliaOscuridad | null,
  variante: VarianteOscuridad,
): boolean {
  if (!familia) return false;
  if (esFamiliaSoftLight(familia)) return INF_SOFTLIGHT_ADJ[variante].DENTRO !== null;
  if (familia === 'OSCURANTI') return INF_OSCURANTI_ADJ[variante].DENTRO !== null;
  if (esFamilia45(familia)) return INF_45_ADJ[variante].DENTRO !== null;
  return false;
}

/** Medida (cm) de UN perfil individual, esté ON u OFF (para mostrar en la UI). */
export function medidaPerfilOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  key: SuperficiePerfilKey,
  anchoCm: number,
  altoCm: number,
  infMontaje?: MontajeBaseOscuridad,
  f: FormulasOscuridad = FORMULAS_OSCURIDAD_DEFAULT,
): number {
  if (key === 'izqMuro' || key === 'derMuro') return t1(altoCm + f.perfilLateralMuroSuma);
  // piso y marco (dentro del marco) = alto real, sin descuento.
  if (key === 'izqPiso' || key === 'derPiso' || key === 'izqMarco' || key === 'derMarco') return t1(altoCm);
  // inferior (muro/piso/marco): soft light INTERNO usa montaje; resto = cenefa − descuento.
  return medidaPerfilBaseOscuridad(familia, variante, anchoCm, infMontaje, f);
}

/**
 * Calcula los cortes de un sistema de oscuridad.
 * @param familia   sistema (ver familiaOscuridad)
 * @param variante  INTERNO | SEMI | EXTERNO
 * @param anchoCm   ancho nominal (cm)
 * @param altoCm    alto nominal (cm) — necesario para perfiles laterales
 * @param perfiles  interruptores ON/OFF
 * @param medidas   overrides manuales de medida por perfil
 * @param colorAccesorios color de accesorios (solo el TUBO del 45 mm difiere: negro = cenefa − 2,9)
 */
export function cortesOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  anchoCm: number,
  altoCm: number,
  perfiles: PerfilesOscuridad = {},
  medidas: MedidasPerfilesOscuridad = {},
  colorAccesorios?: string | null,
  f: FormulasOscuridad = FORMULAS_OSCURIDAD_DEFAULT,
): CorteOscuridad[] {
  const cortes: CorteOscuridad[] = [];
  if (!anchoCm || anchoCm <= 0) return cortes;
  const vi = VI[variante];
  const conCenefaCuad = CON_CENEFA_DELANTERA.includes(familia);
  // La cadena viaja EXACTA (*Exacto) y solo se trunca al EMITIR cada pieza: si
  // el siguiente eslabón partiera del valor impreso, el recorte se acumularía
  // (oscuranti INT 330 daba tela 324,0 cuando la fórmula da 324,11 — 1,1 mm de
  // menos, más que el truncado de una sola pieza).
  const cenefaExacta = anchoCm + f.cenefaAdj[familia][vi];
  const cenefaFront = t1(cenefaExacta);
  // Cenefa trasera (solo DARK): se mide sobre la DELANTERA exacta, y es la pieza
  // desde la que arranca el tubo.
  const traseraExacta = cenefaExacta - f.cenefaTraseraDesc;
  const cenefaTrasera = t1(traseraExacta);

  if (conCenefaCuad) {
    // Oscuranti: su pieza frontal ES el PERFIL SUPERIOR (rectangular 50×25,
    // E50/E49/E52) y va SIEMPRE — NO lleva además la cenefa cuadrada
    // (E29/E30/E31), o el optimizador cortaría las dos para la misma ventana
    // (corrección 2026-07-30). Soft light CC y DARK son al revés: cenefa
    // cuadrada delantera y nada de perfil superior. Distinto del SEPARADOR
    // superior/laterales, que son opcionales y salen del común E41/E42/E43.
    if (familia === 'OSCURANTI') {
      cortes.push({
        componente: 'Perfil superior',
        columnaExcel: 'PERFIL SUPERIOR (CENEF.PRO)',
        medidaCm: cenefaFront,
      });
    } else {
      cortes.push({ componente: 'Cenefa Delantera', columnaExcel: 'CENEFA DELANTERA', medidaCm: cenefaFront });
    }
    if (esFamiliaDark(familia)) {
      cortes.push({
        componente: 'Cenefa Trasera',
        columnaExcel: 'CENEFA TRASERA',
        medidaCm: cenefaTrasera,
      });
      cortes.push({ componente: 'Ancho Tela Velcro', columnaExcel: '', medidaCm: cenefaFront });
      cortes.push({ componente: 'Alto Tela Velcro', columnaExcel: '', medidaCm: f.altoTelaVelcroCm });
    }
  } else {
    // Soft Light "normal": la cenefa frontal la corta el taller y SIEMPRE viaja
    // al Excel de órdenes (columna CENEFA OVALADA, código E26/27/28 por color).
    // Un adicional CENF O, si existe, sobreescribe esta medida en excel-ordenes.
    cortes.push({ componente: 'Cenefa', columnaExcel: 'CENEFA OVALADA', medidaCm: cenefaFront });
  }

  // ── Tubo · Tela · Peso ──
  // Soft light "de tabla": descuento NETO sobre el ancho. En el 45 mm con
  // accesorios negros el tubo usa la tabla NEGRA (cenefa − 2,9); el resto de
  // familias/colores cae al fallback blanco.
  // Familias de PIZARRA: la cadena arranca de la pieza frontal
  // EXACTA —la cenefa trasera en DARK, la delantera/perfil superior en el resto—
  // y cada eslabón parte del valor exacto del anterior, no del impreso.
  let tubo: number;
  let tela: number;
  let peso: number;
  if (esFamiliaSoftLight(familia)) {
    const tuboAdj =
      (esColorAccesoriosNegro(colorAccesorios) ? f.tuboAdjNegro[familia] : undefined) ?? f.tuboAdj[familia];
    tubo = t1(anchoCm + tuboAdj[vi]);
    tela = t1(anchoCm + f.telaAdj[familia][vi]);
    peso = t1(anchoCm + f.pesoAdj[familia][vi]);
  } else {
    const tuboExacto =
      (esFamiliaDark(familia) ? traseraExacta : cenefaExacta) - f.tuboPaso[familia][vi];
    const telaExacta = tuboExacto - f.telaPasoCm;
    const pesoExacto = telaExacta + f.pesoPasoCm;
    tubo = t1(tuboExacto);
    tela = t1(telaExacta);
    peso = t1(pesoExacto);
  }
  cortes.push({ componente: 'Tubo', columnaExcel: 'TUBO', medidaCm: tubo });
  cortes.push({ componente: 'Tela (ancho)', columnaExcel: '', medidaCm: tela });
  cortes.push({ componente: 'Peso', columnaExcel: 'PESO SOFT LIGHT', medidaCm: peso });

  // ── Perfiles (activos) ──
  // La MEDIDA depende de la superficie (muro = alto+10; piso y marco = alto); la
  // PERFORACIÓN (INT/EXT) es una anotación de taller aparte. Un perfil puede
  // estar ACTIVO (asignado en Fase 1) con la superficie/medida pendiente para
  // Fase 2. Retro-compat: muro/piso/marco marcado implica activo.
  const altoOk = altoCm > 0;
  const lateralMuro = t1(altoCm + f.perfilLateralMuroSuma);
  const lateralPiso = t1(altoCm);
  // Soft light INTERNO: ancho − 13,3 (dentro de laterales) o ancho (pared a pared);
  // resto de variantes/familias = cenefa frontal − descuento de variante.
  const inferior = medidaPerfilBaseOscuridad(familia, variante, anchoCm, perfiles.infMontaje, f);

  type PerfilEff = { medida: number; superficie: 'muro' | 'piso' | 'marco' | null; pendiente: boolean };
  // Medida efectiva de un lateral (muro = alto+10; piso/marco = alto), respetando
  // el override manual. pendiente = sin superficie ni override (o sin alto).
  const medidaLateralEff = (
    muro: boolean | undefined,
    piso: boolean | undefined,
    marco: boolean | undefined,
    override: number | undefined,
  ): PerfilEff => {
    const superficie = muro ? 'muro' : piso ? 'piso' : marco ? 'marco' : null;
    const overrideOk = typeof override === 'number' && Number.isFinite(override) && override > 0;
    const pendiente = !altoOk || (superficie === null && !overrideOk);
    const base = superficie === 'muro' ? lateralMuro : lateralPiso; // piso/marco = alto
    return { medida: pendiente ? 0 : aplicarOverride(base, override), superficie, pendiente };
  };

  // Un lateral: elige superficie (muro gana, luego piso, luego marco), aplica
  // override y anota perforación. Devuelve su medida efectiva (para el separador).
  const emitLateral = (
    activo: boolean | undefined,
    muro: boolean | undefined,
    piso: boolean | undefined,
    marco: boolean | undefined,
    columna: string,
    lado: 'izquierdo' | 'derecho',
    override: number | undefined,
    perf: PerforacionPerfil | undefined,
  ): PerfilEff => {
    const eff = medidaLateralEff(muro, piso, marco, override);
    if (!(activo || muro || piso || marco) || !altoOk) return eff;
    const nombre =
      eff.superficie === 'piso'
        ? `Perfil ${lado} a Piso`
        : eff.superficie === 'marco'
          ? `Perfil ${lado} dentro del Marco`
          : eff.superficie === 'muro'
            ? `Perfil ${lado} a Muro`
            : `Perfil ${lado}`;
    cortes.push({
      componente: nombre,
      columnaExcel: columna,
      medidaCm: eff.medida,
      perfil: true,
      perforacion: perf,
      pendienteMedida: eff.pendiente,
    });
    return eff;
  };
  const effIzq = emitLateral(perfiles.izqActivo, perfiles.izqMuro, perfiles.izqPiso, perfiles.izqMarco, 'PERFIL (IZQ) INT', 'izquierdo', perfiles.izqMuro ? medidas.izqMuro : perfiles.izqPiso ? medidas.izqPiso : medidas.izqMarco, perfiles.izqPerf);
  const effDer = emitLateral(perfiles.derActivo, perfiles.derMuro, perfiles.derPiso, perfiles.derMarco, 'PERFIL (DER) INT', 'derecho', perfiles.derMuro ? medidas.derMuro : perfiles.derPiso ? medidas.derPiso : medidas.derMarco, perfiles.derPerf);

  // Inferior (perfil base): sobre la cenefa frontal (muro/piso/marco miden igual).
  const infActivo = perfiles.infActivo || perfiles.infMuro || perfiles.infPiso || perfiles.infMarco;
  const infOverride = perfiles.infMuro ? medidas.infMuro : perfiles.infPiso ? medidas.infPiso : medidas.infMarco;
  const infOverrideOk = typeof infOverride === 'number' && Number.isFinite(infOverride) && infOverride > 0;
  const infSuperficie: PerfilEff['superficie'] = perfiles.infMuro ? 'muro' : perfiles.infPiso ? 'piso' : perfiles.infMarco ? 'marco' : null;
  const infPendiente = infSuperficie === null && !infOverrideOk;
  const effInf: PerfilEff = {
    medida: infPendiente ? 0 : aplicarOverride(inferior, infOverride),
    superficie: infSuperficie,
    pendiente: infPendiente,
  };
  if (infActivo) {
    const nombre =
      infSuperficie === 'piso'
        ? 'Perfil inferior al Piso'
        : infSuperficie === 'marco'
          ? 'Perfil inferior dentro del Marco'
          : infSuperficie === 'muro'
            ? 'Perfil inferior a Muro'
            : 'Perfil inferior';
    // Soft light SEMI: el perfil base SIEMPRE va con perforación EXTERNA (no se elige).
    const infPerf =
      esFamiliaSoftLight(familia) && variante === 'SEMI' ? 'EXTERNO' : perfiles.infPerf;
    cortes.push({
      componente: nombre,
      columnaExcel: 'PERFIL BASE',
      medidaCm: effInf.medida,
      perfil: true,
      perforacion: infPerf,
      pendienteMedida: effInf.pendiente,
    });
  }

  // ── Separadores (E41/E42/E43) ──
  // Perfil independiente que comparte la MEDIDA del perfil del mismo lado (incl.
  // su override); un override propio del separador manda. Sin medida derivable →
  // pendiente (Fase 2). No lleva perforación. Aplica a toda familia de oscuridad.
  const emitSeparador = (
    activo: boolean | undefined,
    columna: string,
    nombre: string,
    overrideSep: number | undefined,
    fallback: PerfilEff,
  ) => {
    if (!activo) return;
    const overrideOk = typeof overrideSep === 'number' && Number.isFinite(overrideSep) && overrideSep > 0;
    const pendienteMedida = overrideOk ? false : fallback.pendiente;
    cortes.push({
      componente: nombre,
      columnaExcel: columna,
      medidaCm: pendienteMedida ? 0 : overrideOk ? t1(overrideSep as number) : fallback.medida,
      perfil: true,
      pendienteMedida,
    });
  };
  emitSeparador(perfiles.sepIzq, 'SEPARADOR (IZQ)', 'Separador izquierdo', medidas.sepIzq, effIzq);
  emitSeparador(perfiles.sepDer, 'SEPARADOR (DER)', 'Separador derecho', medidas.sepDer, effDer);
  emitSeparador(perfiles.sepInf, 'SEPARADOR BASE', 'Separador base', medidas.sepInf, effInf);

  return cortes;
}
