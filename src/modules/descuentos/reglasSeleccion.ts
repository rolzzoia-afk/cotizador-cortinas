// ─────────────────────────────────────────────────────────────────────
// REGLAS DE SELECCIÓN — agregado editable desde Admin → Catálogo técnico.
//
// Junta las reglas de MECANISMO (reglas-mecanismo.ts) y de TUBERÍA
// (reglas-tuberia.ts) en un solo objeto que se guarda en
// `configuracion.reglas_seleccion` y viaja al motor por PARÁMETRO OPCIONAL con
// default — el patrón del repo (ver parametrosCorte.ts). Sin nada guardado,
// todo usa REGLAS_SELECCION_DEFAULT y el comportamiento es el de fábrica.
//
// Módulo puro (sin Supabase): el store vive en reglasSeleccionStore.ts.
// ─────────────────────────────────────────────────────────────────────
import {
  MECANISMOS_DUAL,
  REGLAS_MECANISMO,
  numeroMecDeChip,
  opcionesMecanismoResolucion,
  opcionesMecanismoUI,
  type EstadoCatalogo,
  type MatchCategoria,
  type MecanismoCatalogo,
  type ReglaMecAncho,
  type ReglaMecCategoria,
  type ReglasMecanismo,
} from './reglas-mecanismo';
import {
  REGLAS_TUBERIA,
  opcionesTuberiaResolucion,
  opcionesTuberiaUI,
  type ReglaTuboCategoria,
  type ReglasTuberia,
  type TuboCatalogo,
} from './reglas-tuberia';
import {
  BASES_PERMITIDAS,
  GRUPO_TIPOS_PROPIOS,
  RE_CATEGORIA,
  validarTipos,
  type TipoCortina,
} from './tiposCortina';
import {
  CAMPOS_MEC,
  CAMPOS_INSUMO_COLOR,
  COLORES_BUILTIN,
  USOS_COLOR,
  colorPorCodigo,
  validarColores,
  type ColorAccesorio,
  type InsumosColor,
  type UsoColor,
} from './coloresAccesorio';

export type ReglasSeleccion = {
  mecanismo: ReglasMecanismo;
  tuberia: ReglasTuberia;
  /** Tipos de cortina propios (Etapa 4). Vacío = solo las categorías nativas. */
  tipos: readonly TipoCortina[];
  /** Colores de accesorios: qué se ofrece en cada selector y, si el color lo
   *  declara, con qué códigos de insumo se fabrica. */
  colores: readonly ColorAccesorio[];
};

export const REGLAS_SELECCION_DEFAULT: ReglasSeleccion = {
  mecanismo: REGLAS_MECANISMO,
  tuberia: REGLAS_TUBERIA,
  tipos: [],
  colores: COLORES_BUILTIN,
};

/** Las cinco listas que consumen el editor de paños y los módulos de cálculo. */
export type OpcionesSeleccion = {
  /** Chips de mecanismo que se OFRECEN (Fase 2). */
  mecanismoUI: readonly string[];
  mecanismoDual: readonly string[];
  /** Todo lo que se puede RESOLVER (incluye ocultos y duales). */
  mecanismoResolucion: readonly string[];
  tuberiaUI: readonly string[];
  tuberiaResolucion: readonly string[];
};

/**
 * Listas derivadas del catálogo. `usarTuboE78` solo abre los ítems marcados
 * 'opt_in' (con los valores de fábrica no hay ninguno, así que no cambia nada).
 */
export function derivarOpciones(
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
  usarTuboE78 = false,
): OpcionesSeleccion {
  return {
    mecanismoUI: opcionesMecanismoUI(reglas.mecanismo, usarTuboE78),
    mecanismoDual: MECANISMOS_DUAL,
    mecanismoResolucion: opcionesMecanismoResolucion(reglas.mecanismo),
    tuberiaUI: opcionesTuberiaUI(reglas.tuberia, usarTuboE78),
    tuberiaResolucion: opcionesTuberiaResolucion(reglas.tuberia),
  };
}

// ── Normalización de lo guardado ─────────────────────────────────────
// A diferencia de las fórmulas (formulasFamilias.ts), acá los arrays son de
// LARGO VARIABLE: el admin puede agregar y borrar reglas. Por eso un array
// guardado válido REEMPLAZA al default entero en vez de mezclarse por índice.
// Una fila corrupta se descarta; si al sanear no queda ninguna, vuelve el
// default (nunca dejar al cotizador sin catálogo).

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, def: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : def;
}

function numOpt(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function estado(v: unknown): EstadoCatalogo {
  return v === 'oculto' || v === 'opt_in' || v === 'activo' ? v : 'activo';
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}

/** Record<string, number> saneado (colorAMec, mecPorColor, kitOvalada…). */
function mapaNumeros(v: unknown): Record<string, number> | null {
  if (!esObjeto(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    const n = numOpt(val);
    if (k.trim() && n != null) out[k.trim().toUpperCase()] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function mapaTextos(v: unknown): Record<string, string> | null {
  if (!esObjeto(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    const s = texto(val);
    if (k.trim() && s) out[k.trim().toUpperCase()] = s;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Claves numéricas: el JSON las devuelve como string ("45"), hay que re-numerar. */
function mapaPorDiametro(v: unknown): Record<number, string> | null {
  if (!esObjeto(v)) return null;
  const out: Record<number, string> = {};
  for (const [k, val] of Object.entries(v)) {
    const d = Number(k);
    const cod = texto(val).toUpperCase();
    if (Number.isFinite(d) && d > 0 && cod) out[d] = cod;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Categoría de una regla: string exacta o { includes } (substring). */
function matchCategoria(v: unknown): MatchCategoria | null {
  const s = texto(v);
  if (s) return s;
  if (esObjeto(v)) {
    const inc = texto(v.includes);
    if (inc) return { includes: inc };
  }
  return null;
}

/**
 * Sanea un array de filas. Si el valor no es un array, o ninguna fila sobrevive,
 * devuelve el default (el catálogo nunca queda vacío).
 */
function filas<T>(
  v: unknown,
  def: readonly T[],
  sanear: (fila: Record<string, unknown>) => T | null,
  etiqueta: string,
): readonly T[] {
  if (!Array.isArray(v)) return def;
  const out: T[] = [];
  for (const fila of v) {
    const limpia = esObjeto(fila) ? sanear(fila) : null;
    if (limpia) out.push(limpia);
    else console.warn(`[reglas_seleccion] fila inválida descartada en ${etiqueta}`);
  }
  if (out.length === 0) {
    console.warn(`[reglas_seleccion] ${etiqueta} quedó vacío: se usan los valores de fábrica`);
    return def;
  }
  return out;
}

function listaTextos(v: unknown, def: readonly string[]): readonly string[] {
  if (!Array.isArray(v)) return def;
  const out = v.map((x) => texto(x).toUpperCase()).filter(Boolean);
  return out.length > 0 ? out : def;
}

function listaNumeros(v: unknown, def: readonly number[]): readonly number[] {
  if (!Array.isArray(v)) return def;
  const out = v.map((x) => numOpt(x)).filter((n): n is number => n != null);
  // Una lista vacía es legítima acá (p.ej. dejar de reemplazar legacy).
  return out;
}

function saneaMecanismo(f: Record<string, unknown>): MecanismoCatalogo | null {
  const chip = texto(f.chip);
  return chip ? { chip, estado: estado(f.estado) } : null;
}

function saneaReglaAncho(f: Record<string, unknown>): ReglaMecAncho | null {
  const categoria = texto(f.categoria);
  const tubo = texto(f.tubo).toUpperCase();
  const anchoMinM = numOpt(f.anchoMinM);
  if (!categoria || !tubo || anchoMinM == null) return null;
  const mec = numOpt(f.mec);
  const mecPorColor = mapaNumeros(f.mecPorColor);
  // Una regla que no resuelve ningún MEC no haría nada.
  if (mec == null && !mecPorColor) return null;
  const anchoMaxM = numOpt(f.anchoMaxM);
  const modeloMecPorColor = mapaNumeros(f.modeloMecPorColor);
  const categoriaModelo = texto(f.categoriaModelo);
  return {
    descripcion: texto(f.descripcion),
    categoria,
    anchoMinM,
    ...(anchoMaxM != null ? { anchoMaxM } : {}),
    ...(mec != null ? { mec } : {}),
    ...(mecPorColor ? { mecPorColor } : {}),
    ...(modeloMecPorColor ? { modeloMecPorColor } : {}),
    ...(categoriaModelo ? { categoriaModelo } : {}),
    tubo,
    ...(f.requiereTuboE78 === true ? { requiereTuboE78: true } : {}),
    nota: texto(f.nota),
  };
}

function saneaReglaCategoriaMec(f: Record<string, unknown>): ReglaMecCategoria | null {
  const categoria = matchCategoria(f.categoria);
  const mec = numOpt(f.mec);
  if (!categoria || mec == null) return null;
  const codigoInventario = texto(f.codigoInventario);
  const colores = Array.isArray(f.colores)
    ? f.colores.map((c) => texto(c).toUpperCase()).filter(Boolean)
    : null;
  return {
    descripcion: texto(f.descripcion),
    categoria,
    mec,
    ...(codigoInventario ? { codigoInventario } : {}),
    ...(f.fijo === true ? { fijo: true } : {}),
    ...(colores && colores.length > 0 ? { colores } : {}),
  };
}

function saneaTubo(f: Record<string, unknown>): TuboCatalogo | null {
  const codigo = texto(f.codigo).toUpperCase();
  const descripcion = texto(f.descripcion);
  const diametroMm = numOpt(f.diametroMm);
  if (!codigo || !descripcion || diametroMm == null) return null;
  return {
    codigo,
    descripcion,
    diametroMm,
    espesorMm: numOpt(f.espesorMm),
    estado: estado(f.estado),
    autoPorAncho: bool(f.autoPorAncho, true),
  };
}

function saneaReglaCategoriaTubo(f: Record<string, unknown>): ReglaTuboCategoria | null {
  const categoria = matchCategoria(f.categoria);
  const codigo = texto(f.codigo).toUpperCase();
  if (!categoria || !codigo) return null;
  return { descripcion: texto(f.descripcion), categoria, codigo };
}

function normalizarMecanismo(crudo: unknown): ReglasMecanismo {
  const d = REGLAS_MECANISMO;
  if (!esObjeto(crudo)) return d;
  const banda = esObjeto(crudo.bandaOscuridadE78) ? crudo.bandaOscuridadE78 : {};
  return {
    categoriasSinMecanismo: listaTextos(crudo.categoriasSinMecanismo, d.categoriasSinMecanismo),
    kitsInventario: Array.isArray(crudo.kitsInventario)
      ? listaNumeros(crudo.kitsInventario, d.kitsInventario)
      : d.kitsInventario,
    legacyReemplazar: Array.isArray(crudo.legacyReemplazar)
      ? listaNumeros(crudo.legacyReemplazar, d.legacyReemplazar)
      : d.legacyReemplazar,
    reglasAncho: filas(crudo.reglasAncho, d.reglasAncho, saneaReglaAncho, 'reglasAncho'),
    colorAMec: mapaNumeros(crudo.colorAMec) ?? d.colorAMec,
    colorAMecReforzado: mapaNumeros(crudo.colorAMecReforzado) ?? d.colorAMecReforzado,
    aliasColorModelo: mapaTextos(crudo.aliasColorModelo) ?? d.aliasColorModelo,
    reglasCategoria: filas(
      crudo.reglasCategoria,
      d.reglasCategoria,
      saneaReglaCategoriaMec,
      'reglasCategoria (mecanismo)',
    ),
    mecanismos: filas(crudo.mecanismos, d.mecanismos, saneaMecanismo, 'mecanismos'),
    bandaOscuridadE78: {
      anchoMinM: num(banda.anchoMinM, d.bandaOscuridadE78.anchoMinM),
      anchoMaxM: num(banda.anchoMaxM, d.bandaOscuridadE78.anchoMaxM),
    },
    kitOvaladaPorColor: mapaNumeros(crudo.kitOvaladaPorColor) ?? d.kitOvaladaPorColor,
  };
}

function normalizarTuberia(crudo: unknown): ReglasTuberia {
  const d = REGLAS_TUBERIA;
  if (!esObjeto(crudo)) return d;
  const e0266 = esObjeto(crudo.reglaE02E66) ? crudo.reglaE02E66 : {};
  const r63 = esObjeto(crudo.regla63) ? crudo.regla63 : {};
  return {
    reglaE02E66: {
      descripcion: texto(e0266.descripcion) || d.reglaE02E66.descripcion,
      diametroMm: num(e0266.diametroMm, d.reglaE02E66.diametroMm),
      anchoMaxE02M: num(e0266.anchoMaxE02M, d.reglaE02E66.anchoMaxE02M),
      codigoHasta: texto(e0266.codigoHasta).toUpperCase() || d.reglaE02E66.codigoHasta,
      codigoDesde: texto(e0266.codigoDesde).toUpperCase() || d.reglaE02E66.codigoDesde,
    },
    regla63: {
      descripcion: texto(r63.descripcion) || d.regla63.descripcion,
      diametroMm: num(r63.diametroMm, d.regla63.diametroMm),
      anchoMaxE47M: num(r63.anchoMaxE47M, d.regla63.anchoMaxE47M),
      codigoHasta: texto(r63.codigoHasta).toUpperCase() || d.regla63.codigoHasta,
      codigoDesde: texto(r63.codigoDesde).toUpperCase() || d.regla63.codigoDesde,
    },
    codigoPorDiametro: mapaPorDiametro(crudo.codigoPorDiametro) ?? d.codigoPorDiametro,
    tubos45mm: listaTextos(crudo.tubos45mm, d.tubos45mm),
    reglasCategoria: filas(
      crudo.reglasCategoria,
      d.reglasCategoria,
      saneaReglaCategoriaTubo,
      'reglasCategoria (tubería)',
    ),
    tubos: filas(crudo.tubos, d.tubos, saneaTubo, 'tubos'),
  };
}

function saneaTipo(f: Record<string, unknown>): TipoCortina | null {
  const categoria = texto(f.categoria);
  const base = texto(f.base);
  // Sin categoría o con un molde que no existe, el tipo no se puede resolver:
  // se descarta antes de que llegue al motor.
  if (!categoria || !RE_CATEGORIA.test(categoria)) return null;
  if (!BASES_PERMITIDAS.some((b) => b.toUpperCase() === base.toUpperCase())) return null;
  const sistemas = Array.isArray(f.sistemas)
    ? f.sistemas.map((s) => texto(s)).filter(Boolean)
    : null;
  const tipoIncluye = texto(f.tipoIncluye);
  const notas = texto(f.notas);
  return {
    categoria,
    nombre: texto(f.nombre) || categoria,
    grupo: texto(f.grupo) || GRUPO_TIPOS_PROPIOS,
    base,
    ...(sistemas && sistemas.length > 0 ? { sistemas } : {}),
    ...(tipoIncluye ? { tipoIncluye } : {}),
    activo: bool(f.activo, true),
    ...(notas ? { notas } : {}),
  };
}

/**
 * Tipos guardados. A diferencia de los catálogos de tubos y mecanismos, acá
 * la lista VACÍA es el estado normal (no hay tipos propios), así que nunca cae
 * al default.
 */
function normalizarTipos(crudo: unknown): readonly TipoCortina[] {
  if (!Array.isArray(crudo)) return [];
  const out: TipoCortina[] = [];
  for (const fila of crudo) {
    const limpia = esObjeto(fila) ? saneaTipo(fila) : null;
    if (limpia) out.push(limpia);
    else console.warn('[reglas_seleccion] tipo de cortina inválido descartado');
  }
  return out;
}

function saneaInsumosColor(crudo: unknown): InsumosColor | null {
  if (!esObjeto(crudo)) return null;
  const out: Record<string, string | number> = {};
  for (const { campo } of CAMPOS_INSUMO_COLOR) {
    const valor = crudo[campo];
    if (CAMPOS_MEC.has(campo)) {
      const n = numOpt(valor);
      if (n != null) out[campo] = n;
    } else {
      const t = texto(valor).toUpperCase();
      if (t) out[campo] = t;
    }
  }
  return Object.keys(out).length > 0 ? (out as InsumosColor) : null;
}

function saneaColor(f: Record<string, unknown>): ColorAccesorio | null {
  const codigo = texto(f.codigo).toUpperCase();
  if (!codigo) return null;
  const usosCrudos = esObjeto(f.usos) ? f.usos : {};
  const usos = {} as Record<UsoColor, boolean>;
  for (const u of USOS_COLOR) usos[u] = usosCrudos[u] === true;
  const insumos = saneaInsumosColor(f.insumos);
  return {
    codigo,
    nombre: texto(f.nombre).toUpperCase() || codigo,
    usos,
    ...(insumos ? { insumos } : {}),
  };
}

/**
 * Colores guardados. Como los catálogos de tubos y mecanismos (y a diferencia
 * de los tipos de cortina), quedarse sin ninguno dejaría los selectores de
 * Fase 2 vacíos: si al sanear no sobrevive ninguno, vuelven los de fábrica.
 */
function normalizarColores(crudo: unknown): readonly ColorAccesorio[] {
  if (!Array.isArray(crudo)) return COLORES_BUILTIN;
  const out: ColorAccesorio[] = [];
  const vistos = new Set<string>();
  for (const fila of crudo) {
    const limpia = esObjeto(fila) ? saneaColor(fila) : null;
    if (!limpia || vistos.has(limpia.codigo)) {
      console.warn('[reglas_seleccion] color de accesorios inválido o repetido descartado');
      continue;
    }
    vistos.add(limpia.codigo);
    out.push(limpia);
  }
  return out.length > 0 ? out : COLORES_BUILTIN;
}

export function normalizarReglasSeleccion(crudo: unknown): ReglasSeleccion {
  if (!esObjeto(crudo)) return REGLAS_SELECCION_DEFAULT;
  return {
    mecanismo: normalizarMecanismo(crudo.mecanismo),
    tuberia: normalizarTuberia(crudo.tuberia),
    tipos: normalizarTipos(crudo.tipos),
    colores: normalizarColores(crudo.colores),
  };
}

/** true si las reglas son exactamente las de fábrica. */
export function sonReglasDefault(r: ReglasSeleccion): boolean {
  return JSON.stringify(r) === JSON.stringify(REGLAS_SELECCION_DEFAULT);
}

// ── Validación ───────────────────────────────────────────────────────
// Los ERRORES bloquean el guardado: dejarían al cotizador resolviendo a un
// chip o un tubo que no existe (hoy eso falla en silencio — chips.ts cae a la
// regla siguiente sin avisar). Los AVISOS son configuraciones raras pero
// legítimas, y solo piden confirmación.

export type ResultadoValidacion = { errores: string[]; avisos: string[] };

/** Todos los números MEC que las reglas nombran, con dónde aparecen. */
function mecsReferenciados(m: ReglasMecanismo): Array<{ mec: number; donde: string }> {
  const out: Array<{ mec: number; donde: string }> = [];
  for (const r of m.reglasAncho) {
    const donde = `la regla por ancho «${r.descripcion || r.categoria}»`;
    if (r.mec != null) out.push({ mec: r.mec, donde });
    for (const n of Object.values(r.mecPorColor ?? {})) out.push({ mec: n, donde });
  }
  for (const r of m.reglasCategoria) {
    out.push({ mec: r.mec, donde: `la regla «${r.descripcion || r.mec}»` });
  }
  for (const n of Object.values(m.colorAMec)) {
    out.push({ mec: n, donde: 'el mapa de color → kit' });
  }
  for (const n of Object.values(m.colorAMecReforzado)) {
    out.push({ mec: n, donde: 'el mapa de color → kit reforzado' });
  }
  for (const n of Object.values(m.kitOvaladaPorColor)) {
    out.push({ mec: n, donde: 'el kit ovalada por color' });
  }
  return out;
}

export function validarReglasSeleccion(r: ReglasSeleccion): ResultadoValidacion {
  const errores: string[] = [];
  const avisos: string[] = [];
  const { mecanismo: m, tuberia: t } = r;

  // ── Catálogos vacíos: el cotizador se quedaría sin nada que ofrecer.
  if (m.mecanismos.length === 0) {
    errores.push('El catálogo de mecanismos no puede quedar vacío.');
  }
  if (t.tubos.length === 0) {
    errores.push('El catálogo de tuberías no puede quedar vacío.');
  }

  // ── Catálogo de mecanismos
  const chipsResolucion = opcionesMecanismoResolucion(m);
  const numsDisponibles = new Set(
    chipsResolucion.map((c) => numeroMecDeChip(c)).filter((n): n is number => n != null),
  );
  const chipsVistos = new Set<string>();
  const numsVistos = new Map<number, string>();
  for (const item of m.mecanismos) {
    const chip = item.chip.trim();
    if (chipsVistos.has(chip.toUpperCase())) {
      errores.push(`El mecanismo «${chip}» está repetido en el catálogo.`);
    }
    chipsVistos.add(chip.toUpperCase());
    const n = numeroMecDeChip(chip);
    if (n == null) {
      if (chip.toUpperCase() !== 'VELCRO') {
        errores.push(`El mecanismo «${chip}» no tiene número: debe terminar en «[MEC n]».`);
      }
      continue;
    }
    const previo = numsVistos.get(n);
    if (previo) {
      avisos.push(`El MEC ${n} aparece en dos chips («${previo}» y «${chip}»): al resolver gana el primero.`);
    } else {
      numsVistos.set(n, chip);
    }
  }

  // ── MEC referenciados por reglas (la trampa histórica: fallaba en silencio)
  for (const { mec, donde } of mecsReferenciados(m)) {
    if (!numsDisponibles.has(mec)) {
      errores.push(`El MEC ${mec} que usa ${donde} no existe en el catálogo de mecanismos.`);
    }
  }

  // ── Catálogo de tuberías
  const codigosTubo = new Set(t.tubos.map((x) => x.codigo.toUpperCase()));
  const codigosVistos = new Set<string>();
  for (const tubo of t.tubos) {
    const cod = tubo.codigo.toUpperCase();
    if (codigosVistos.has(cod)) errores.push(`El tubo «${cod}» está repetido en el catálogo.`);
    codigosVistos.add(cod);
    if (tubo.diametroMm <= 0) {
      errores.push(`El tubo «${cod}» necesita un diámetro mayor que cero.`);
    }
  }

  const estadoDe = (cod: string) =>
    t.tubos.find((x) => x.codigo.toUpperCase() === cod.toUpperCase())?.estado;
  const revisarCodigo = (cod: string, donde: string) => {
    if (!cod) return;
    if (!codigosTubo.has(cod.toUpperCase())) {
      errores.push(`El tubo «${cod}» que usa ${donde} no existe en el catálogo de tuberías.`);
      return;
    }
    const est = estadoDe(cod);
    if (est === 'oculto') {
      avisos.push(`${donde} asigna el tubo «${cod}», que está oculto: se sigue calculando, pero ya no se ofrece.`);
    } else if (est === 'opt_in') {
      avisos.push(`${donde} asigna el tubo «${cod}», que solo aparece con el tubo E78 activado en la OT.`);
    }
  };

  revisarCodigo(t.reglaE02E66.codigoHasta, 'la regla de 38 mm');
  revisarCodigo(t.reglaE02E66.codigoDesde, 'la regla de 38 mm');
  revisarCodigo(t.regla63.codigoHasta, 'la regla de 63 mm');
  revisarCodigo(t.regla63.codigoDesde, 'la regla de 63 mm');
  for (const [diam, cod] of Object.entries(t.codigoPorDiametro)) {
    revisarCodigo(cod, `el tubo por defecto de ${diam} mm`);
  }
  for (const cod of t.tubos45mm) revisarCodigo(cod, 'la lista de tubos de 45 mm');
  for (const rc of t.reglasCategoria) {
    revisarCodigo(rc.codigo, `la regla «${rc.descripcion || rc.codigo}»`);
  }
  for (const ra of m.reglasAncho) {
    revisarCodigo(ra.tubo, `la regla por ancho «${ra.descripcion || ra.categoria}»`);
  }

  // ── Rangos de las reglas por ancho
  for (const ra of m.reglasAncho) {
    const etiqueta = ra.descripcion || ra.categoria;
    if (ra.anchoMaxM != null && ra.anchoMaxM <= ra.anchoMinM) {
      errores.push(`En «${etiqueta}», el ancho máximo (${ra.anchoMaxM}) debe ser mayor que el mínimo (${ra.anchoMinM}).`);
    }
  }
  for (let i = 0; i < m.reglasAncho.length; i++) {
    for (let j = i + 1; j < m.reglasAncho.length; j++) {
      const a = m.reglasAncho[i];
      const b = m.reglasAncho[j];
      if (a.categoria.toUpperCase() !== b.categoria.toUpperCase()) continue;
      if (!!a.requiereTuboE78 !== !!b.requiereTuboE78) continue;
      const finA = a.anchoMaxM ?? Infinity;
      const finB = b.anchoMaxM ?? Infinity;
      if (a.anchoMinM < finB && b.anchoMinM < finA) {
        avisos.push(`Las reglas «${a.descripcion || a.categoria}» y «${b.descripcion || b.categoria}» se superponen: gana la primera de la lista.`);
      }
    }
  }

  if (m.bandaOscuridadE78.anchoMaxM <= m.bandaOscuridadE78.anchoMinM) {
    errores.push('En la banda del tubo E78 de oscuridad, el ancho máximo debe ser mayor que el mínimo.');
  }

  // ── Tipos de cortina propios
  const vt = validarTipos(r.tipos);
  errores.push(...vt.errores);
  avisos.push(...vt.avisos);

  // Una regla escrita para un tipo que se desactivó: sigue calculando las OTs
  // viejas, pero conviene saber que ya no se ofrece.
  const inactivos = r.tipos.filter((t) => !t.activo).map((t) => t.categoria.toUpperCase());
  if (inactivos.length > 0) {
    const nombra = (cat: string) => inactivos.includes(cat.trim().toUpperCase());
    for (const ra of m.reglasAncho) {
      if (nombra(ra.categoria)) {
        avisos.push(
          `La regla por ancho «${ra.descripcion || ra.categoria}» es de «${ra.categoria}», un tipo desactivado.`,
        );
      }
    }
    for (const rc of [...m.reglasCategoria, ...t.reglasCategoria]) {
      if (typeof rc.categoria === 'string' && nombra(rc.categoria)) {
        avisos.push(
          `La regla «${rc.descripcion || rc.categoria}» es de «${rc.categoria}», un tipo desactivado.`,
        );
      }
    }
  }

  // ── Colores de accesorios
  const vc = validarColores(r.colores);
  errores.push(...vc.errores);
  avisos.push(...vc.avisos);

  // Un mapa que nombra un color fuera del catálogo no rompe (la regla se
  // ignora y el operario elige a mano), pero casi siempre es un error de tipeo.
  const mapasDeColor: Array<{ mapa: Record<string, number>; donde: string }> = [
    { mapa: m.colorAMec, donde: 'el mapa de color → kit' },
    { mapa: m.colorAMecReforzado, donde: 'el mapa de color → kit reforzado' },
    { mapa: m.kitOvaladaPorColor, donde: 'el kit ovalada por color' },
  ];
  for (const ra of m.reglasAncho) {
    if (ra.mecPorColor) {
      mapasDeColor.push({
        mapa: ra.mecPorColor,
        donde: `la regla por ancho «${ra.descripcion || ra.categoria}»`,
      });
    }
  }
  const avisados = new Set<string>();
  for (const { mapa, donde } of mapasDeColor) {
    for (const clave of Object.keys(mapa)) {
      if (colorPorCodigo(clave, r.colores)) continue;
      const llave = `${clave}|${donde}`;
      if (avisados.has(llave)) continue;
      avisados.add(llave);
      avisos.push(`${donde} nombra el color «${clave}», que no está en el catálogo de colores.`);
    }
  }

  return { errores, avisos };
}

export type {
  ColorAccesorio,
  EstadoCatalogo,
  InsumosColor,
  MecanismoCatalogo,
  TipoCortina,
  TuboCatalogo,
};
