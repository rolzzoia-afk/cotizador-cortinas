// ─────────────────────────────────────────────────────────────────────
// Cadenas: relación entre el insumo de inventario (CAD01, CAD02, …) y la
// cadena que se elige en el cotizador / aparece en el BOM de una OT.
//
// Antes la cadena se elegía como dos campos sueltos (largo + color) que NO
// llevaban el código del inventario, así que la bodega tenía que adivinar
// qué insumo era. Ahora el cotizador elige la cadena REAL del inventario y
// guarda su código en `pano.codCadena`, igual que ya se hace con el
// mecanismo (`LZ50 … [MEC 06]`).
//
// Este módulo es lógica pura (sin React ni Supabase) para poder testearlo.
// ─────────────────────────────────────────────────────────────────────
import { categoriaEfectiva, type TipoCortina } from '@/modules/descuentos/tiposCortina';
import { COLORES_BUILTIN, colorPorCodigo } from '@/modules/descuentos/coloresAccesorio';
import { categoriaCoincide } from '@/modules/descuentos/reglas-mecanismo';
import {
  LARGO_DESCRIPCION,
  REGLAS_CADENA,
  cadenaDeclarada,
  codCadenaVerticalDeColor,
  largoCadenaPorAltoCategoria,
  type ReglasCadena,
} from '@/modules/descuentos/reglas-cadena';

export { LARGO_DESCRIPCION };

/** Forma mínima de un insumo-cadena que necesitamos acá. */
export type CadenaInsumo = {
  cod: string | null;
  nemotecnico: string | null;
  color?: string | null;
  status?: string | null;
};

/**
 * Identifica las cadenas "roller" del inventario: códigos CAD01…CAD16, más
 * cualquiera declarada en el catálogo (una cadena nueva puede no calzar el
 * patrón). Excluye cadenas de cortina vertical (VER..) y otras familias.
 */
export function esCadenaRoller(
  cod: string | null | undefined,
  reglas: ReglasCadena = REGLAS_CADENA,
): boolean {
  const c = (cod || '').trim();
  if (/^CAD\d{2}$/i.test(c)) return true;
  return !!cadenaDeclarada(c, reglas);
}

/**
 * Lista de cadenas roller para mostrar en el selector del cotizador.
 * Opcionalmente excluye las agotadas (por defecto las oculta). Las declaradas
 * como `oculto` en el catálogo tampoco se ofrecen, pero se siguen resolviendo
 * en las OTs que ya las tienen guardadas (ver `derivarLargoColor`).
 */
export function cadenasRoller(
  insumos: CadenaInsumo[],
  opts: { incluirAgotadas?: boolean } = {},
  reglas: ReglasCadena = REGLAS_CADENA,
): CadenaInsumo[] {
  return insumos
    .filter((i) => esCadenaRoller(i.cod, reglas))
    .filter((i) => opts.incluirAgotadas || (i.status || '').toUpperCase() !== 'AGOTADO')
    .filter((i) => opts.incluirAgotadas || cadenaDeclarada(i.cod, reglas)?.estado !== 'oculto')
    .sort((a, b) => (a.cod || '').localeCompare(b.cod || ''));
}

/** Etiqueta para el selector: "CADENA INFINITA 3 METROS [GRIS] · CAD01". */
export function etiquetaCadena(c: CadenaInsumo): string {
  const nombre = (c.nemotecnico || '').trim() || (c.cod || '');
  return c.cod ? `${nombre} · ${c.cod}` : nombre;
}

// ── Resolución de OTs viejas (texto suelto → código CAD) ──────────────

/** Códigos de color del cotizador → palabra de color del inventario. */
const COLOR_COD_A_NOMBRE: Record<string, string> = {
  BCO: 'BLANCO',
  NEG: 'NEGRO',
  GRS: 'GRIS',
  GRI: 'GRIS',
  MET: 'METAL',
};

/** Largo viejo del cotizador → texto que debe aparecer en el nemotécnico. */
const LARGO_A_PALABRA: Record<string, string[]> = {
  '0.75': ['80 CM'],
  '1mts': ['1,2 METRO', '1 METRO'],
  '3mts': ['3 METRO'],
  '4mts': ['4 METRO'],
  ROLLO: ['ROLLO'],
};

function normalizar(s: string | null | undefined): string {
  return (s || '').toUpperCase().trim();
}

/**
 * Resuelve el código CAD a partir del largo + color "viejos" guardados en
 * una OT antigua, buscando contra el inventario real. Best-effort: devuelve
 * el código sólo si hay UNA cadena que calce largo y color; si es ambiguo
 * o no calza, devuelve null (y el sistema sigue con el texto antiguo).
 */
export function resolverCodCadenaLegacy(
  largoCadena: string | number | null | undefined,
  colorCadena: string | null | undefined,
  insumos: CadenaInsumo[],
): string | null {
  const largo = normalizar(String(largoCadena ?? ''));
  const colorCod = normalizar(colorCadena);
  if (!largo) return null;

  const palabras = LARGO_A_PALABRA[largo] || LARGO_A_PALABRA[largo.toLowerCase()];
  // largo puede venir como '3MTS' tras normalizar; probamos también minúsculas
  const palabrasLargo =
    palabras || LARGO_A_PALABRA[String(largoCadena ?? '').trim()] || null;
  if (!palabrasLargo) return null;

  const colorNombre = COLOR_COD_A_NOMBRE[colorCod] || colorCod;

  const candidatas = cadenasRoller(insumos, { incluirAgotadas: true }).filter((c) => {
    const nemo = normalizar(c.nemotecnico);
    const colorOk =
      !colorNombre ||
      normalizar(c.color) === colorNombre ||
      nemo.includes(colorNombre);
    const largoOk = palabrasLargo.some((p) => nemo.includes(p));
    return colorOk && largoOk;
  });

  return candidatas.length === 1 ? (candidatas[0].cod as string) : null;
}

/**
 * Para una línea de BOM de categoría CADENA (no "Peso de cadena"), devuelve
 * el código CAD que le corresponde. Prioriza un código ya presente en la
 * especificación; si no, intenta resolver desde largo (especificación o
 * descripción) + color contra el inventario.
 */
export function resolverCodCadenaBom(
  item: { descripcion?: string; especificacion?: string; color?: string },
  insumos: CadenaInsumo[],
): string | null {
  const desc = normalizar(item.descripcion);
  // "Peso de cadena" no es una cadena: lo dejamos pasar.
  if (desc.includes('PESO')) return null;

  const espec = (item.especificacion || '').trim();
  // ¿La especificación ya es un código CAD? Entonces ya está enlazada.
  if (esCadenaRoller(espec)) return espec.toUpperCase();

  // El largo viejo puede venir en la especificación ("3mts") o pegado a la
  // descripción ("Cadena 3mts").
  const largoDesdeEspec = espec;
  const largoDesdeDesc = (item.descripcion || '').replace(/cadena/i, '').trim();
  const largo = largoDesdeEspec || largoDesdeDesc;

  return resolverCodCadenaLegacy(largo, item.color, insumos);
}

/**
 * Dado un código CAD, deriva el largo y color "viejos" para mantener los
 * campos de display (PDF de producción, hoja de inventario) coherentes
 * cuando el cotizador elige una cadena del inventario.
 */
export function derivarLargoColor(
  cod: string,
  insumos: CadenaInsumo[],
  reglas: ReglasCadena = REGLAS_CADENA,
): { largoCadena: string; colorCadena: string } {
  // El catálogo manda sobre la adivinanza del nemotécnico. Se consulta incluso
  // si la cadena está oculta: una OT vieja que la tenga se sigue resolviendo.
  const decl = cadenaDeclarada(cod, reglas);
  if (decl?.largo && decl.color) {
    return { largoCadena: decl.largo, colorCadena: colorCadenaCorto(decl.color) || decl.color };
  }
  const c = insumos.find((i) => normalizar(i.cod) === normalizar(cod));
  if (!c) return { largoCadena: decl?.largo || '', colorCadena: decl?.color || '' };
  const nemo = normalizar(c.nemotecnico);

  let largoCadena = '';
  // '2.4' / '1.6' / '1.4' van PRIMERO: "2.4 METROS" también contiene "4 METRO",
  // y "1,40 MTS" (la cadena corta legacy) no dice "METRO" y caería sin largo.
  // La de 1,6 m se nombra por su caída ("80 CM") desde siempre; se la reconoce
  // por las dos formas para no depender de cómo la escriba bodega.
  if (nemo.includes('2.4') || nemo.includes('2,4')) largoCadena = '2.4mts';
  else if (nemo.includes('1.6') || nemo.includes('1,6')) largoCadena = '0.75';
  else if (nemo.includes('1.4') || nemo.includes('1,4')) largoCadena = '1.4mts';
  else if (nemo.includes('3 METRO')) largoCadena = '3mts';
  else if (nemo.includes('4 METRO')) largoCadena = '4mts';
  else if (nemo.includes('1,2 METRO') || nemo.includes('1 METRO')) largoCadena = '1mts';
  else if (nemo.includes('80 CM')) largoCadena = '0.75';
  else if (nemo.includes('ROLLO')) largoCadena = 'ROLLO';

  if (decl?.largo) largoCadena = decl.largo;

  const colorNombre = normalizar(decl?.color || c.color) || '';
  const colorCadena =
    colorNombre === 'BLANCO'
      ? 'BCO'
      : colorNombre === 'NEGRO'
        ? 'NEG'
        : colorNombre === 'GRIS'
          ? 'GRS'
          : colorNombre === 'METAL'
            ? 'MET'
            : // Cadena de un color que no es de fábrica: se devuelve su propio
              // nombre en vez de ''. Sin esto, el par código↔color no cerraba y
              // Fase 2 veía un "cambio de color" falso en cada sincronización,
              // rehaciendo la cadena una y otra vez.
              colorNombre;

  return { largoCadena, colorCadena };
}

/** Color de accesorios normalizado a BCO/NEG/GRS. Los colores de fábrica que no
 *  tienen cadena propia (metálico, café) devuelven '' y no auto-seleccionan: la
 *  elige el vendedor. Un color dado de alta en Admin devuelve su nombre, para
 *  buscar en el inventario la cadena de ese color si existe. */
export function colorCadenaCorto(color: string | null | undefined): string {
  const c = normalizar(color);
  if (c === 'BCO' || c === 'BLANCO' || c === 'BLANCA') return 'BCO';
  if (c === 'NEG' || c === 'NEGRO' || c === 'NEGRA') return 'NEG';
  if (c === 'GRS' || c === 'GRI' || c === 'GRIS' || c === 'GRISE' || c === 'GRISES') return 'GRS';
  return colorPorCodigo(c, COLORES_BUILTIN) ? '' : c;
}

/** Cadena del inventario que calza un largo ('4mts'…) y color (BCO/NEG/GRS). */
export function codCadenaPorLargoColor(
  largo: string,
  colorCod: string,
  insumos: CadenaInsumo[],
  reglas: ReglasCadena = REGLAS_CADENA,
): string | null {
  const match = cadenasRoller(insumos, {}, reglas).find((c) => {
    const d = derivarLargoColor(c.cod as string, insumos, reglas);
    return d.largoCadena === largo && d.colorCadena === colorCod;
  });
  return match ? (match.cod as string) : null;
}

/**
 * Largo y motivo que le corresponden a una cortina, sin mirar el inventario.
 * Separado de `codCadenaAutoPorAlto` para que el banco de pruebas pueda decir
 * POR QUÉ se eligió esa cadena (mismo criterio que `explicarKit`).
 */
export function largoCadenaAuto(
  altoM: number,
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
  reglas: ReglasCadena = REGLAS_CADENA,
): { largo: string; motivo: string } | null {
  const cat = normalizar(categoriaEfectiva(categoria, tipos));
  return largoCadenaPorAltoCategoria(altoM, cat, reglas, categoriaCoincide);
}

/**
 * Cadena a auto-seleccionar según el ALTO y el color de accesorios, con la
 * escalera y las reglas por categoría del catálogo. De fábrica:
 *   · roller y demás → ≥2 m → 4 m · ≥1,4 → 3 m · ≥0,8 → 2,4 m · ≥0,5 → 1,2 m
 *   · dúo (escalera propia) → ≥2,1 → 4 m · ≥1,6 → 3 m · ≥1,4 → 2,4 m ·
 *     ≥0,9 → 1,6 m · ≥0,6 → 1,2 m
 * Por debajo del último peldaño no hay auto: la elige el vendedor.
 * Color MET/CAFÉ → null (lo elige el vendedor). Devuelve el cod CAD que calza
 * largo+color en el inventario, o null.
 */
export function codCadenaAutoPorAlto(
  altoM: number,
  colorAcc: string | null | undefined,
  categoria: string | null | undefined,
  insumos: CadenaInsumo[],
  tipos?: readonly TipoCortina[],
  reglas: ReglasCadena = REGLAS_CADENA,
): string | null {
  const colorCod = colorCadenaCorto(colorAcc);
  if (!colorCod || !(altoM > 0)) return null;
  const elegido = largoCadenaAuto(altoM, categoria, tipos, reglas);
  if (!elegido) return null;
  return codCadenaPorLargoColor(elegido.largo, colorCod, insumos, reglas);
}

// ── Cadena de la VERTICAL ─────────────────────────────────────────────
// Regla del usuario (2026-08-03): la cortina vertical SÍ lleva cadena de
// roller, pero SIEMPRE la de 3 metros — el alto no la cambia, a diferencia del
// roller (`codCadenaAutoPorAlto`). El color lo definen los accesorios: negro →
// CAD04, cualquier otro → CAD06. No hay verticales con accesorios grises, así
// que un 'GRS' heredado cae a la blanca (mismo criterio que el kit VER, donde
// gris usa el set blanco).

/** Cadena de 3 m blanca / negra: los dos únicos códigos que usa la vertical. */
export const COD_CADENA_VERTICAL_BLANCO = 'CAD06';
export const COD_CADENA_VERTICAL_NEGRO = 'CAD04';
/** Largo de la cadena de la vertical, para los campos de display. */
export const LARGO_CADENA_VERTICAL = '3mts';

/** Código de cadena de una VERTICAL según el color de accesorios. */
export function codCadenaVertical(
  colorAcc: string | null | undefined,
  reglas: ReglasCadena = REGLAS_CADENA,
): string {
  return codCadenaVerticalDeColor(colorCadenaCorto(colorAcc), reglas);
}

/** Color corto (BCO/NEG) que acompaña a la cadena de la vertical. */
export function colorCadenaVertical(
  colorAcc: string | null | undefined,
  reglas: ReglasCadena = REGLAS_CADENA,
): string {
  const corto = colorCadenaCorto(colorAcc);
  // El color acompaña al código: si ese color tiene cadena propia declarada, se
  // conserva; si cae al default (la blanca), el color de display es el blanco.
  return reglas.verticalPorColor[normalizar(corto)] ? corto : 'BCO';
}

// ─────────────────────────────────────────────────────────────────────
// Peso de cadena: por ahora solo se ofrecen dos pesos del inventario.
// (PCA01 = PESO HUEVO PORTA CADENA BLANCO, PCA04 = PESO PORTA CADENA
// TRANSPARENTE / CUADRADA 7.5 CM). Mismo patrón que las cadenas: el código
// del insumo se guarda en pano.codPeso y enlaza al stock.
// ─────────────────────────────────────────────────────────────────────

/** Códigos de peso que se ofrecen en el cotizador (en este orden). */
export const PESOS_SELECCIONABLES = ['PCA01', 'PCA04'] as const;

/** Peso de cadena que se auto-selecciona en Fase 2 (transparente cuadrado). */
export const COD_PESO_AUTO = 'PCA04';

/**
 * Peso de cadena automático según la gama: la categoría B lleva SIEMPRE el
 * PCA01 (huevo blanco), sea con accesorios blancos o negros — pedido
 * 2026-08-14; la gama A sigue con el PCA04 transparente. El selector manual
 * del paño permite cambiarlo después.
 */
export function codPesoAuto(lineaB: boolean | undefined): string {
  return lineaB ? 'PCA01' : COD_PESO_AUTO;
}

/** ¿Es un peso ofrecible en el selector? */
export function esPesoSeleccionable(cod: string | null | undefined): boolean {
  const c = (cod || '').toUpperCase().trim();
  return (PESOS_SELECCIONABLES as readonly string[]).includes(c);
}

/** Lista de pesos para el selector, en el orden de PESOS_SELECCIONABLES. */
export function pesosSeleccionables(insumos: CadenaInsumo[]): CadenaInsumo[] {
  const orden = (cod: string | null) =>
    PESOS_SELECCIONABLES.indexOf((cod || '').toUpperCase().trim() as (typeof PESOS_SELECCIONABLES)[number]);
  return insumos
    .filter((i) => esPesoSeleccionable(i.cod))
    .sort((a, b) => orden(a.cod) - orden(b.cod));
}

/** Etiquetas conocidas cuando no hay catálogo de insumos cargado (Fase 4). */
const PESO_COD_ETIQUETAS: Record<string, string> = {
  PCA01: 'PESO HUEVO PORTA CADENA BLANCO',
  PCA04: 'PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM',
};

/** Color intrínseco del peso de cadena por código de insumo (no el color de accesorios). */
const PESO_COD_COLOR: Record<string, string> = {
  PCA01: 'BLANCO',
  PCA04: 'TRANSPARENTE',
};

/**
 * Color del peso de cadena. El peso tiene color PROPIO según su insumo
 * (PCA01→BLANCO, PCA04→TRANSPARENTE), independiente del color de accesorios
 * de la cortina. Cae a `colorPeso` (normalizado) en OTs viejas sin código.
 */
export function colorPesoCadena(
  p: Partial<{ codPeso?: string; colorPeso?: string }>,
): string {
  const cod = (p.codPeso || '').trim().toUpperCase().replace(/\s+/g, '');
  if (cod && PESO_COD_COLOR[cod]) return PESO_COD_COLOR[cod];
  const cp = (p.colorPeso || '').trim();
  if (!cp) return '';
  const norm = cp.toUpperCase();
  if (norm === 'BCO') return 'BLANCO';
  if (norm === 'NEG') return 'NEGRO';
  if (norm === 'GRS' || norm === 'GRI') return 'GRIS';
  if (norm === 'MET') return 'METAL';
  return cp;
}

/**
 * Texto para la columna PESO CADENA del inventario (Fase 4).
 * Prioriza el insumo elegido en Fase 2 (`codPeso`); cae a `colorPeso` en OTs viejas.
 */
export function textoPesoCadenaInventario(
  p: Partial<{ codPeso?: string; colorPeso?: string }>,
  insumos?: CadenaInsumo[],
): string {
  // Sin espacios: "PCA 04" y "PCA04" son el mismo insumo del stock.
  const cod = (p.codPeso || '').trim().toUpperCase().replace(/\s+/g, '');
  if (cod) {
    const ins = insumos?.find((i) => normalizar(i.cod).replace(/\s+/g, '') === cod);
    if (ins?.nemotecnico?.trim()) return ins.nemotecnico.trim();
    if (ins?.color?.trim()) return ins.color.trim();
    return PESO_COD_ETIQUETAS[cod] || cod;
  }

  const cp = (p.colorPeso || '').trim();
  if (!cp) return '';

  const norm = cp.toUpperCase();
  if (norm === 'BCO') return 'BLANCO';
  if (norm === 'NEG') return 'NEGRO';
  if (norm === 'GRS' || norm === 'GRI') return 'GRIS';
  if (norm === 'MET') return 'METAL';
  return cp;
}

/**
 * Descripción larga de la cadena para la columna ACCIONAMIENTO del inventario:
 * "[CAD05] CADENA INFINITA 4 METROS GRIS". Sin `codCadena` (OT vieja o motor)
 * cae al texto de `largoCadena` tal cual, para no inventar un código.
 */
export function descripcionCadenaInventario(
  p: Partial<{ codCadena?: string; largoCadena?: string | number; colorCadena?: string }>,
): string {
  const cod = (p.codCadena || '').trim().toUpperCase().replace(/\s+/g, '');
  const largo = String(p.largoCadena ?? '').trim();
  if (!cod) return largo;
  const palabra = LARGO_DESCRIPCION[largo] || largo;
  const colorCod = normalizar(p.colorCadena);
  const color = COLOR_COD_A_NOMBRE[colorCod] || colorCod;
  const cuerpo = palabra.toUpperCase() === 'ROLLO' ? 'CADENA ROLLO' : `CADENA INFINITA ${palabra}`;
  return `[${cod}] ${[cuerpo, color].filter(Boolean).join(' ')}`.trim();
}
