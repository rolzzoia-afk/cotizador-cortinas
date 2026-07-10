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

/** Forma mínima de un insumo-cadena que necesitamos acá. */
export type CadenaInsumo = {
  cod: string | null;
  nemotecnico: string | null;
  color?: string | null;
  status?: string | null;
};

/**
 * Identifica las cadenas "roller" del inventario: códigos CAD01…CAD16.
 * Excluye cadenas de cortina vertical (VER..) y cualquier otra familia.
 */
export function esCadenaRoller(cod: string | null | undefined): boolean {
  return /^CAD\d{2}$/i.test((cod || '').trim());
}

/**
 * Lista de cadenas roller para mostrar en el selector del cotizador.
 * Opcionalmente excluye las agotadas (por defecto las oculta).
 */
export function cadenasRoller(
  insumos: CadenaInsumo[],
  opts: { incluirAgotadas?: boolean } = {},
): CadenaInsumo[] {
  return insumos
    .filter((i) => esCadenaRoller(i.cod))
    .filter((i) => opts.incluirAgotadas || (i.status || '').toUpperCase() !== 'AGOTADO')
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
): { largoCadena: string; colorCadena: string } {
  const c = insumos.find((i) => normalizar(i.cod) === normalizar(cod));
  if (!c) return { largoCadena: '', colorCadena: '' };
  const nemo = normalizar(c.nemotecnico);

  let largoCadena = '';
  // '2.4' / '1.4' van PRIMERO: "2.4 METROS" también contiene "4 METRO", y
  // "1,40 MTS" (cadena dúo/corta) no dice "METRO" y caería sin largo.
  if (nemo.includes('2.4') || nemo.includes('2,4')) largoCadena = '2.4mts';
  else if (nemo.includes('1.4') || nemo.includes('1,4')) largoCadena = '1.4mts';
  else if (nemo.includes('3 METRO')) largoCadena = '3mts';
  else if (nemo.includes('4 METRO')) largoCadena = '4mts';
  else if (nemo.includes('1,2 METRO') || nemo.includes('1 METRO')) largoCadena = '1mts';
  else if (nemo.includes('80 CM')) largoCadena = '0.75';
  else if (nemo.includes('ROLLO')) largoCadena = 'ROLLO';

  const colorNombre = normalizar(c.color) || '';
  const colorCadena =
    colorNombre === 'BLANCO'
      ? 'BCO'
      : colorNombre === 'NEGRO'
        ? 'NEG'
        : colorNombre === 'GRIS'
          ? 'GRS'
          : colorNombre === 'METAL'
            ? 'MET'
            : '';

  return { largoCadena, colorCadena };
}

/** Color de accesorios normalizado a BCO/NEG/GRS, o '' si no aplica (MET/CAFÉ). */
function colorCadenaCorto(color: string | null | undefined): string {
  const c = normalizar(color);
  if (c === 'BCO' || c === 'BLANCO' || c === 'BLANCA') return 'BCO';
  if (c === 'NEG' || c === 'NEGRO' || c === 'NEGRA') return 'NEG';
  if (c === 'GRS' || c === 'GRI' || c === 'GRIS' || c === 'GRISE' || c === 'GRISES') return 'GRS';
  return '';
}

/** Cadena del inventario que calza un largo ('4mts'…) y color (BCO/NEG/GRS). */
function codCadenaPorLargoColor(
  largo: string,
  colorCod: string,
  insumos: CadenaInsumo[],
): string | null {
  const match = cadenasRoller(insumos).find((c) => {
    const d = derivarLargoColor(c.cod as string, insumos);
    return d.largoCadena === largo && d.colorCadena === colorCod;
  });
  return match ? (match.cod as string) : null;
}

/**
 * Cadena a auto-seleccionar según el ALTO y el color de accesorios. Dúo → 1,40 m
 * (CAD17/18/19). Roller por alto: ≥2 m → 4 m · ≥1,4 m → 3 m · ≥0,8 m → 2,4 m ·
 * ≥0,5 m → 1,4 m · <0,5 m → sin auto. Color MET/CAFÉ → null (lo elige el vendedor).
 * Devuelve el cod CAD que calza largo+color en el inventario, o null.
 */
export function codCadenaAutoPorAlto(
  altoM: number,
  colorAcc: string | null | undefined,
  categoria: string | null | undefined,
  insumos: CadenaInsumo[],
): string | null {
  const colorCod = colorCadenaCorto(colorAcc);
  if (!colorCod || !(altoM > 0)) return null;
  const esDuo = normalizar(categoria).startsWith('DUO');
  let largo: string;
  if (esDuo) largo = '1.4mts';
  else if (altoM >= 2.0) largo = '4mts';
  else if (altoM >= 1.4) largo = '3mts';
  else if (altoM >= 0.8) largo = '2.4mts';
  else if (altoM >= 0.5) largo = '1.4mts';
  else return null;
  return codCadenaPorLargoColor(largo, colorCod, insumos);
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

/** Largo del cotizador → texto largo para la hoja de inventario (Fase 4). */
const LARGO_DESCRIPCION: Record<string, string> = {
  '0.75': '80 CM',
  '1mts': '1,2 METROS',
  '2.4mts': '2,4 METROS',
  '3mts': '3 METROS',
  '4mts': '4 METROS',
  ROLLO: 'ROLLO',
};

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
