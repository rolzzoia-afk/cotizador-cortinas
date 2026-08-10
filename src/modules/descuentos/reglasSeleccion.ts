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
  textoCategoria,
  type EstadoCatalogo,
  type MatchCategoria,
  type MecanismoCatalogo,
  type ReglaMecAncho,
  type ReglaMecCategoria,
  type ReglaMecLineaB,
  type ReglasMecanismo,
  type ReglasMecanismoLineaB,
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
  LARGOS_CADENA,
  REGLAS_CADENA,
  type CadenaCatalogo,
  type ReglaCadenaCategoria,
  type ReglasCadena,
  type TramoCadenaAlto,
} from './reglas-cadena';
import {
  CAMPOS_ESTRUCTURA_B,
  codigoEstructuraBEfectivo,
} from './codigos-estructura';
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
  /** Cadena de mando: catálogo, escalera por alto y regla de la vertical. */
  cadenas: ReglasCadena;
};

export const REGLAS_SELECCION_DEFAULT: ReglasSeleccion = {
  mecanismo: REGLAS_MECANISMO,
  tuberia: REGLAS_TUBERIA,
  tipos: [],
  colores: COLORES_BUILTIN,
  cadenas: REGLAS_CADENA,
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

/** Categoría de una regla: string exacta, { includes } o { empiezaCon }. */
function matchCategoria(v: unknown): MatchCategoria | null {
  const s = texto(v);
  if (s) return s;
  if (esObjeto(v)) {
    const inc = texto(v.includes);
    if (inc) return { includes: inc };
    const pre = texto(v.empiezaCon);
    if (pre) return { empiezaCon: pre };
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

function saneaReglaLineaB(f: Record<string, unknown>): ReglaMecLineaB | null {
  const categoria = matchCategoria(f.categoria);
  const mecPorColor = mapaNumeros(f.mecPorColor);
  if (!categoria || !mecPorColor) return null;
  const manuales = esObjeto(f.kitsManualesPorColor)
    ? Object.entries(f.kitsManualesPorColor).reduce<Record<string, readonly number[]>>(
        (acc, [k, v]) => {
          const nums = Array.isArray(v)
            ? v.map((x) => numOpt(x)).filter((n): n is number => n != null)
            : [];
          if (k.trim() && nums.length > 0) acc[k.trim().toUpperCase()] = nums;
          return acc;
        },
        {},
      )
    : {};
  return {
    descripcion: texto(f.descripcion),
    categoria,
    mecPorColor,
    ...(Object.keys(manuales).length > 0 ? { kitsManualesPorColor: manuales } : {}),
  };
}

function normalizarLineaB(crudo: unknown): ReglasMecanismoLineaB {
  const d = REGLAS_MECANISMO.lineaB;
  if (!esObjeto(crudo)) return d;
  const codigos = esObjeto(crudo.codigoInsumoPorMec)
    ? Object.entries(crudo.codigoInsumoPorMec).reduce<Record<number, string>>((acc, [k, v]) => {
        const n = numOpt(k);
        const cod = texto(v);
        if (n != null && cod) acc[n] = cod;
        return acc;
      }, {})
    : null;
  return {
    reglas: filas(crudo.reglas, d.reglas, saneaReglaLineaB, 'reglas de línea B'),
    codigoInsumoPorMec: codigos && Object.keys(codigos).length > 0 ? codigos : d.codigoInsumoPorMec,
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

/**
 * Repone en el catálogo GUARDADO las piezas de fábrica que sus propias reglas
 * necesitan y que no están.
 *
 * Por qué hace falta: el catálogo guardado REEMPLAZA al de fábrica (a propósito
 * — el admin puede borrar filas). Entonces, cuando el código estrena un chip o
 * un tubo, las empresas que alguna vez guardaron el catálogo desde Admin se
 * quedan con una regla que apunta a algo que su lista no tiene, y el motor no
 * puede escribir el chip: la cortina sale sin kit y sin tubería, en silencio.
 * Pasó al estrenar la categoría B (los 4 chips CAT.B y el tubo E01).
 *
 * Se reponen SOLO las piezas que una regla nombra, y entran como `oculto`: no
 * cambian lo que se ofrece en Fase 2 ni pisan nada de lo que el admin editó.
 * Si la pieza tampoco existe en fábrica, no se inventa: el validador la
 * reporta como error, que es lo correcto.
 */
function reponerMecanismosDeReglas(m: ReglasMecanismo): readonly MecanismoCatalogo[] {
  const disponibles = new Set(
    opcionesMecanismoResolucion(m)
      .map((c) => numeroMecDeChip(c))
      .filter((n): n is number => n != null),
  );
  const repuestos: MecanismoCatalogo[] = [];
  for (const { mec } of mecsReferenciados(m)) {
    if (disponibles.has(mec)) continue;
    const fabrica = REGLAS_MECANISMO.mecanismos.find((x) => numeroMecDeChip(x.chip) === mec);
    if (!fabrica) continue; // no existe ni en fábrica → lo denuncia el validador
    disponibles.add(mec);
    repuestos.push({ chip: fabrica.chip, estado: 'oculto' });
  }
  return repuestos.length > 0 ? [...m.mecanismos, ...repuestos] : m.mecanismos;
}

/** Igual que `reponerMecanismosDeReglas`, para los códigos de tubo. */
function reponerTubosDeReglas(t: ReglasTuberia): readonly TuboCatalogo[] {
  const disponibles = new Set(t.tubos.map((x) => x.codigo.toUpperCase()));
  const repuestos: TuboCatalogo[] = [];
  for (const cod of codigosTuboReferenciados(t)) {
    const clave = cod.toUpperCase();
    if (!clave || disponibles.has(clave)) continue;
    const fabrica = REGLAS_TUBERIA.tubos.find((x) => x.codigo.toUpperCase() === clave);
    if (!fabrica) continue;
    disponibles.add(clave);
    repuestos.push({ ...fabrica, estado: 'oculto' });
  }
  return repuestos.length > 0 ? [...t.tubos, ...repuestos] : t.tubos;
}

function normalizarMecanismo(crudo: unknown): ReglasMecanismo {
  const d = REGLAS_MECANISMO;
  if (!esObjeto(crudo)) return d;
  const banda = esObjeto(crudo.bandaOscuridadE78) ? crudo.bandaOscuridadE78 : {};
  const saneado: ReglasMecanismo = {
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
    lineaB: normalizarLineaB(crudo.lineaB),
  };
  return { ...saneado, mecanismos: reponerMecanismosDeReglas(saneado) };
}

function normalizarTuberia(crudo: unknown): ReglasTuberia {
  const d = REGLAS_TUBERIA;
  if (!esObjeto(crudo)) return d;
  const e0266 = esObjeto(crudo.reglaE02E66) ? crudo.reglaE02E66 : {};
  const r63 = esObjeto(crudo.regla63) ? crudo.regla63 : {};
  const rB = esObjeto(crudo.reglaLineaB) ? crudo.reglaLineaB : {};
  // Antes de la banda de la categoría B, su tubo era uno solo guardado como
  // texto (`tuboLineaB: 'E01'`). Una configuración de esa época se lee como el
  // tramo delgado de la banda y el resto sale de fábrica.
  const tuboLineaBLegacy = texto(crudo.tuboLineaB).toUpperCase();
  const saneado: ReglasTuberia = {
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
    reglaLineaB: {
      descripcion: texto(rB.descripcion) || d.reglaLineaB.descripcion,
      anchoMaxM: num(rB.anchoMaxM, d.reglaLineaB.anchoMaxM),
      codigoHasta:
        texto(rB.codigoHasta).toUpperCase() || tuboLineaBLegacy || d.reglaLineaB.codigoHasta,
      codigoDesde: texto(rB.codigoDesde).toUpperCase() || d.reglaLineaB.codigoDesde,
      categoriaDesde: matchCategoria(rB.categoriaDesde) ?? d.reglaLineaB.categoriaDesde,
    },
  };
  return { ...saneado, tubos: reponerTubosDeReglas(saneado) };
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

function saneaCadena(f: Record<string, unknown>): CadenaCatalogo | null {
  const codigo = texto(f.codigo).toUpperCase().replace(/\s+/g, '');
  const largo = texto(f.largo);
  if (!codigo || !largo) return null;
  const descripcion = texto(f.descripcion);
  return {
    codigo,
    largo,
    color: texto(f.color).toUpperCase(),
    ...(descripcion ? { descripcion } : {}),
    estado: estado(f.estado),
  };
}

function saneaTramoCadena(f: Record<string, unknown>): TramoCadenaAlto | null {
  const altoMinM = numOpt(f.altoMinM);
  const largo = texto(f.largo);
  if (altoMinM == null || altoMinM <= 0 || !largo) return null;
  return { altoMinM, largo };
}

function saneaReglaCadenaCategoria(f: Record<string, unknown>): ReglaCadenaCategoria | null {
  const categoria = matchCategoria(f.categoria);
  const largo = texto(f.largo);
  if (!categoria || !largo) return null;
  return { descripcion: texto(f.descripcion), categoria, largo };
}

/**
 * Cadenas guardadas. El CATÁLOGO puede quedar vacío (es el estado de fábrica:
 * el largo y el color se derivan del nemotécnico del insumo), pero la escalera
 * por alto no: sin tramos no habría auto-selección para nadie.
 */
function normalizarCadenas(crudo: unknown): ReglasCadena {
  if (!esObjeto(crudo)) return REGLAS_CADENA;
  let cadenas: readonly CadenaCatalogo[] = REGLAS_CADENA.cadenas;
  if (Array.isArray(crudo.cadenas)) {
    const out: CadenaCatalogo[] = [];
    const vistos = new Set<string>();
    for (const fila of crudo.cadenas) {
      const limpia = esObjeto(fila) ? saneaCadena(fila) : null;
      if (!limpia || vistos.has(limpia.codigo)) {
        console.warn('[reglas_seleccion] cadena inválida o repetida descartada');
        continue;
      }
      vistos.add(limpia.codigo);
      out.push(limpia);
    }
    cadenas = out; // lista vacía = estado de fábrica, no un error
  }
  const verticalPorColor = mapaTextos(crudo.verticalPorColor);
  return {
    cadenas,
    tramosAlto: filas(crudo.tramosAlto, REGLAS_CADENA.tramosAlto, saneaTramoCadena, 'tramosAlto'),
    reglasCategoria: Array.isArray(crudo.reglasCategoria)
      ? (crudo.reglasCategoria
          .map((f) => (esObjeto(f) ? saneaReglaCadenaCategoria(f) : null))
          .filter(Boolean) as ReglaCadenaCategoria[])
      : REGLAS_CADENA.reglasCategoria,
    verticalPorColor: verticalPorColor
      ? Object.fromEntries(Object.entries(verticalPorColor).map(([k, v]) => [k, v.toUpperCase()]))
      : REGLAS_CADENA.verticalPorColor,
    verticalDefault:
      texto(crudo.verticalDefault).toUpperCase() || REGLAS_CADENA.verticalDefault,
    verticalLargo: texto(crudo.verticalLargo) || REGLAS_CADENA.verticalLargo,
  };
}

export function normalizarReglasSeleccion(crudo: unknown): ReglasSeleccion {
  if (!esObjeto(crudo)) return REGLAS_SELECCION_DEFAULT;
  return {
    mecanismo: normalizarMecanismo(crudo.mecanismo),
    tuberia: normalizarTuberia(crudo.tuberia),
    tipos: normalizarTipos(crudo.tipos),
    colores: normalizarColores(crudo.colores),
    cadenas: normalizarCadenas(crudo.cadenas),
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
  // Categoría B (gama económica): sus kits también son reglas, y si el chip no
  // está en el catálogo la cortina sale sin mecanismo. Faltaba mirarlos.
  for (const r of m.lineaB.reglas) {
    const donde = `la categoría B «${r.descripcion || r.categoria}»`;
    for (const n of Object.values(r.mecPorColor)) out.push({ mec: n, donde });
    for (const nums of Object.values(r.kitsManualesPorColor ?? {})) {
      for (const n of nums) out.push({ mec: n, donde });
    }
  }
  return out;
}

/** Todos los códigos de tubo que las reglas de tubería nombran. */
function codigosTuboReferenciados(t: ReglasTuberia): string[] {
  return [
    t.reglaE02E66.codigoHasta,
    t.reglaE02E66.codigoDesde,
    t.regla63.codigoHasta,
    t.regla63.codigoDesde,
    ...Object.values(t.codigoPorDiametro),
    ...t.tubos45mm,
    ...t.reglasCategoria.map((rc) => rc.codigo),
    t.reglaLineaB.codigoHasta,
    t.reglaLineaB.codigoDesde,
  ].filter(Boolean);
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
  // `avisarOculto: false` para las reglas que asignan un tubo que NO se ofrece
  // a propósito (la categoría B con el E01): ahí «oculto» es el diseño, no un
  // descuido, y el aviso sería ruido en cada guardado.
  const revisarCodigo = (cod: string, donde: string, avisarOculto = true) => {
    if (!cod) return;
    if (!codigosTubo.has(cod.toUpperCase())) {
      errores.push(`El tubo «${cod}» que usa ${donde} no existe en el catálogo de tuberías.`);
      return;
    }
    const est = estadoDe(cod);
    if (est === 'oculto' && !avisarOculto) {
      // sin aviso: asignación deliberada a un tubo que no se ofrece
    } else if (est === 'oculto') {
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
  revisarCodigo(t.reglaLineaB.codigoHasta, 'la categoría B', false);
  revisarCodigo(t.reglaLineaB.codigoDesde, 'la categoría B sobre el ancho de corte', false);
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

  // ── Categoría B
  if (!(t.reglaLineaB.anchoMaxM > 0)) {
    errores.push('En la categoría B, el ancho de corte entre los dos tubos debe ser mayor que cero.');
  }
  // Un código de bodega declarado para un kit que no existe no rompe nada, pero
  // significa que la línea del inventario nunca va a salir con ese código.
  for (const [clave, cod] of Object.entries(m.lineaB.codigoInsumoPorMec)) {
    const n = Number(clave);
    if (!Number.isFinite(n) || numsDisponibles.has(n)) continue;
    avisos.push(
      `El código de bodega «${cod}» de la categoría B es del MEC ${clave}, que no está en el catálogo de mecanismos.`,
    );
  }
  // Un color con kit de categoría B pero sin ninguno de sus códigos de
  // estructura: el peso y la cenefa saldrían sin código de bodega.
  const coloresBAvisados = new Set<string>();
  for (const rb of m.lineaB.reglas) {
    for (const clave of Object.keys(rb.mecPorColor)) {
      const color = colorPorCodigo(clave, r.colores);
      const nombre = color?.nombre || clave;
      if (coloresBAvisados.has(nombre.toUpperCase())) continue;
      const tieneAlguno = CAMPOS_ESTRUCTURA_B.some(
        (c) => codigoEstructuraBEfectivo(c.campo, nombre, r.colores) !== '',
      );
      if (tieneAlguno) continue;
      coloresBAvisados.add(nombre.toUpperCase());
      avisos.push(
        `La categoría B tiene kit para «${clave}», pero ese color no tiene códigos de estructura de categoría B: el peso y la cenefa saldrían sin código de bodega.`,
      );
    }
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
  for (const rb of m.lineaB.reglas) {
    const donde = `la categoría B «${rb.descripcion || textoCategoria(rb.categoria)}»`;
    mapasDeColor.push({ mapa: rb.mecPorColor, donde });
    if (rb.kitsManualesPorColor) {
      mapasDeColor.push({
        mapa: Object.fromEntries(
          Object.entries(rb.kitsManualesPorColor).map(([k, v]) => [k, v[0] ?? 0]),
        ),
        donde,
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

  // ── Cadenas
  const cad = r.cadenas;
  const largosValidos = new Set<string>(LARGOS_CADENA);
  if (cad.tramosAlto.length === 0) {
    errores.push('La escalera de cadena por alto no puede quedar vacía.');
  }
  const codsCadena = new Set<string>();
  for (const c of cad.cadenas) {
    if (codsCadena.has(c.codigo)) {
      errores.push(`La cadena «${c.codigo}» está repetida en el catálogo.`);
    }
    codsCadena.add(c.codigo);
    if (!largosValidos.has(c.largo)) {
      errores.push(`La cadena «${c.codigo}» tiene un largo desconocido («${c.largo}»).`);
    }
  }
  // Dos cadenas ACTIVAS del mismo largo y color: la auto-selección toma la
  // primera del inventario y la otra nunca se elige sola.
  const parVisto = new Map<string, string>();
  for (const c of cad.cadenas) {
    if (c.estado !== 'activo' || !c.color) continue;
    const llave = `${c.largo}|${c.color}`;
    const previo = parVisto.get(llave);
    if (previo) {
      avisos.push(
        `«${previo}» y «${c.codigo}» son del mismo largo y color: al elegir sola gana la primera del inventario.`,
      );
    } else {
      parVisto.set(llave, c.codigo);
    }
  }
  const altosVistos = new Set<number>();
  for (const t2 of cad.tramosAlto) {
    if (altosVistos.has(t2.altoMinM)) {
      errores.push(`Hay dos tramos de cadena que empiezan en ${String(t2.altoMinM).replace('.', ',')} m.`);
    }
    altosVistos.add(t2.altoMinM);
    if (!largosValidos.has(t2.largo)) {
      errores.push(
        `El tramo desde ${String(t2.altoMinM).replace('.', ',')} m usa un largo desconocido («${t2.largo}»).`,
      );
    }
  }
  for (const rc of cad.reglasCategoria) {
    if (!largosValidos.has(rc.largo)) {
      errores.push(`La regla de cadena «${rc.descripcion || 'por categoría'}» usa un largo desconocido («${rc.largo}»).`);
    }
  }
  if (!cad.verticalDefault) {
    errores.push('La cadena de la vertical no puede quedar sin código por defecto.');
  }
  // Una cadena oculta se sigue resolviendo en OTs viejas, pero si la regla de
  // la vertical la nombra, esa cortina nace con una cadena que Fase 2 no ofrece.
  for (const cod of [cad.verticalDefault, ...Object.values(cad.verticalPorColor)]) {
    if (cod && cad.cadenas.some((c) => c.codigo === cod && c.estado === 'oculto')) {
      avisos.push(`La vertical usa la cadena «${cod}», que está oculta en el catálogo.`);
    }
  }

  return { errores, avisos };
}

export type {
  CadenaCatalogo,
  ColorAccesorio,
  EstadoCatalogo,
  InsumosColor,
  MecanismoCatalogo,
  ReglaCadenaCategoria,
  ReglasCadena,
  TipoCortina,
  TramoCadenaAlto,
  TuboCatalogo,
};
