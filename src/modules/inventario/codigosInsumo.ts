// ─────────────────────────────────────────────────────────────────────
// El código de un insumo: su forma, su familia y cómo se ve.
//
// Dos ideas que conviene no mezclar:
//
//   · La LLAVE (`insumos.cod`) es `MEC32`. Está escrita en el kardex, en la
//     colmena, en las OTs, en el optimizador, en los QR pegados en el galpón
//     y en los Excel de las vendedoras. No cambia nunca. Cuando un código
//     está mal, se da de alta uno nuevo y el viejo queda DESCONTINUADO —el
//     método del E78→E39—, jamás se renombra el catálogo entero.
//
//   · El CÓDIGO VISIBLE es `MEC32-BCO`: la llave más el color, para lo que
//     se lee y se imprime. Se calcula, no se guarda. Así el taller distingue
//     de un vistazo las tres cadenas de 3 metros (CAD01 gris, CAD04 negra,
//     CAD06 blanca) sin tener que saberse los números de memoria.
//
// Módulo PURO: sin React y sin Supabase. La regla de forma de acá es la misma
// que el CHECK `insumos_cod_forma` de la base (sql/20260910_insumos_01_…):
// si una cambia, la otra también.
// ─────────────────────────────────────────────────────────────────────

/** 1 a 4 letras · 2 o 3 dígitos · opcionalmente «-B» o «-1». */
export const RE_CODIGO_INSUMO = /^[A-Z]{1,4}[0-9]{2,3}(-[A-Z0-9]{1,2})?$/;

export type PartesCodigo = {
  prefijo: string;
  numero: number;
  /** Cuántos dígitos trae ESTE código (no los de su familia). */
  digitos: number;
  sufijo: string | null;
};

export type FamiliaInsumo = {
  id?: string;
  prefijo: string;
  nombre: string;
  categoria: string | null;
  sub_categoria: string | null;
  digitos: number;
  siguiente: number;
  activo: boolean;
  descripcion: string | null;
};

/**
 * Los sufijos que existen y qué significan.
 *
 * `-1` está congelado a propósito: significaba dos cosas distintas —«esta
 * unidad está dañada» (DOM01-1) y «la otra mitad del par» (INS20-1 HEMBRA)—.
 * Lo primero es un estado y vive en el kardex; lo segundo es otro artículo y
 * lleva su propio correlativo. Los que ya existen se dejan como están.
 */
export const SUFIJOS: ReadonlyArray<{
  sufijo: string;
  nombre: string;
  vigente: boolean;
  nota: string;
}> = [
  {
    sufijo: 'B',
    nombre: 'Categoría B',
    vigente: true,
    nota: 'La gama económica: MEC44-B, E69-B, TAP28-B.',
  },
  {
    sufijo: '1',
    nombre: 'Variante o unidad dañada',
    vigente: false,
    nota: 'Ya no se usa: lo dañado es un estado del kardex y una variante es otro artículo.',
  },
];

// ── Color ────────────────────────────────────────────────────────────

/**
 * Del color escrito en la ficha a las tres letras del código visible. Es el
 * mismo vocabulario que usa el cotizador en sus chips y en el asistente de
 * colores, para no tener dos diccionarios que se contradigan.
 *
 * Lo que no está acá NO inventa abreviatura: un artículo azul o beige se
 * muestra sin sufijo, porque un `-AZ` que nadie definió se lee como un código
 * distinto. La pantalla de Configuración muestra cuáles quedaron fuera.
 */
export const ABREVIATURAS_COLOR: Readonly<Record<string, string>> = {
  BLANCO: 'BCO',
  BLANCA: 'BCO',
  BCO: 'BCO',
  NEGRO: 'NEG',
  NEGRA: 'NEG',
  NEG: 'NEG',
  GRIS: 'GRS',
  GRS: 'GRS',
  METAL: 'MET',
  METALICO: 'MET',
  METALICA: 'MET',
  MET: 'MET',
  ALUMINIO: 'ALU',
  ALU: 'ALU',
  CAFE: 'CAFE',
  MADERA: 'CAFE',
  TRANSPARENTE: 'TRA',
  TRANSP: 'TRA',
  TRA: 'TRA',
};

/** Sin tildes: «Café», «CAFE» y «CAFÉ» son el mismo color. */
function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Las letras del color para el código visible; `null` si no corresponde. */
export function abreviaturaColor(color: unknown): string | null {
  const c = sinTildes(String(color ?? '').trim().toUpperCase());
  if (!c || c === 'N/A' || c === 'NA') return null;
  return ABREVIATURAS_COLOR[c] ?? null;
}

// ── Forma del código ─────────────────────────────────────────────────

/**
 * Deja el código como se guarda: mayúsculas y SIN espacios. El espacio es la
 * confusión más cara del sistema —«MEC 18» en las recetas de precios, «DOM 47»
 * en el catálogo de productos, «MEC18» en insumos son tres cosas distintas—,
 * así que del lado del insumo simplemente no existe.
 */
export function normalizarCodigoInsumo(cod: unknown): string {
  return String(cod ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** Prefijo, número y sufijo de un código; `null` si no tiene la forma. */
export function partesDeCodigo(cod: unknown): PartesCodigo | null {
  const c = normalizarCodigoInsumo(cod);
  if (!RE_CODIGO_INSUMO.test(c)) return null;
  const m = c.match(/^([A-Z]{1,4})([0-9]{2,3})(?:-([A-Z0-9]{1,2}))?$/);
  if (!m) return null;
  return {
    prefijo: m[1],
    numero: parseInt(m[2], 10),
    digitos: m[2].length,
    sufijo: m[3] ?? null,
  };
}

/** Qué tiene de malo este código, o `null` si está bien. */
export function validarFormaCodigo(cod: unknown): string | null {
  const c = normalizarCodigoInsumo(cod);
  if (!c) return 'Escribe un código.';
  if (!RE_CODIGO_INSUMO.test(c)) {
    return 'De 1 a 4 letras, 2 o 3 números y, si corresponde, «-B». Por ejemplo MEC46 o MEC44-B.';
  }
  return null;
}

/** Arma un código a partir de sus partes. */
export function formatearCodigo(
  prefijo: string,
  numero: number,
  digitos: number,
  sufijo?: string | null,
): string {
  const p = normalizarCodigoInsumo(prefijo);
  const n = String(Math.max(0, Math.trunc(numero))).padStart(Math.max(1, digitos), '0');
  const s = sufijo ? `-${normalizarCodigoInsumo(sufijo)}` : '';
  return `${p}${n}${s}`;
}

/**
 * Orden natural: INS99 antes que INS100. Ordenar como texto los pone al revés
 * y la tabla del catálogo queda ilegible justo en las familias más grandes.
 * Un código sin forma reconocible se va al final, pero no se pierde.
 */
export function compararCodigos(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const pa = partesDeCodigo(a);
  const pb = partesDeCodigo(b);
  if (!pa && !pb) return normalizarCodigoInsumo(a).localeCompare(normalizarCodigoInsumo(b), 'es');
  if (!pa) return 1;
  if (!pb) return -1;
  if (pa.prefijo !== pb.prefijo) return pa.prefijo.localeCompare(pb.prefijo, 'es');
  if (pa.numero !== pb.numero) return pa.numero - pb.numero;
  // Sin sufijo primero: MEC44 antes que MEC44-B.
  if (pa.sufijo === pb.sufijo) return 0;
  if (!pa.sufijo) return -1;
  if (!pb.sufijo) return 1;
  return pa.sufijo.localeCompare(pb.sufijo, 'es');
}

// ── Familias y propuesta de código ───────────────────────────────────

/**
 * El próximo código libre de una familia. Es el espejo en TypeScript de la
 * función `insumo_crear` de la base: sirve para mostrar la propuesta mientras
 * se llena el formulario, pero el número que vale es el que asigna la base.
 *
 * Los huecos NO se reutilizan: un hueco es un código dado de baja, y sus
 * etiquetas y su historial pueden seguir vivos en el galpón.
 */
export function proponerCodigo(
  familia: Pick<FamiliaInsumo, 'prefijo' | 'digitos' | 'siguiente'>,
  existentes: Iterable<string> = [],
): { cod: string; siguiente: number } {
  const ocupados = new Set<string>();
  for (const c of existentes) ocupados.add(normalizarCodigoInsumo(c));

  const prefijo = normalizarCodigoInsumo(familia.prefijo);
  const digitos = Math.max(1, familia.digitos || 2);
  let n = Math.max(1, familia.siguiente || 1);
  while (ocupados.has(formatearCodigo(prefijo, n, digitos))) n += 1;

  return { cod: formatearCodigo(prefijo, n, digitos), siguiente: n + 1 };
}

/** A qué familia pertenece un código. */
export function familiaDeCodigo(
  cod: unknown,
  familias: readonly FamiliaInsumo[],
): FamiliaInsumo | null {
  const partes = partesDeCodigo(cod);
  if (!partes) return null;
  return familias.find((f) => normalizarCodigoInsumo(f.prefijo) === partes.prefijo) ?? null;
}

// ── Lo que se ve ─────────────────────────────────────────────────────

/**
 * El código como se muestra y se imprime: la llave más el color.
 *
 * El color va SIEMPRE al final, incluso después del «-B»: `MEC44-B-BCO`. Así
 * la parte que identifica al artículo se lee igual en todas partes y el color
 * es siempre lo último.
 */
export function codigoVisible(cod: unknown, color: unknown): string {
  const base = normalizarCodigoInsumo(cod);
  if (!base) return '';
  const abrev = abreviaturaColor(color);
  return abrev ? `${base}-${abrev}` : base;
}

/**
 * El color de cada código, para las pantallas que solo guardan la llave.
 *
 * El kardex anota `item_cod` y nada más, y la hoja de la OT arma sus líneas
 * desde el cotizador, que no conoce la ficha del artículo. Las dos necesitan
 * este mapa para poder mostrar el código visible.
 */
export function mapaColoresPorCodigo(
  filas: Iterable<{ cod?: string | null; color?: string | null }>,
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const f of filas) {
    const cod = normalizarCodigoInsumo(f?.cod);
    const color = String(f?.color ?? '').trim();
    if (cod && color) mapa.set(cod, color);
  }
  return mapa;
}

/** El código visible buscando el color en el mapa. Sin color, la llave sola. */
export function codigoVisibleDe(cod: unknown, colores?: Map<string, string> | null): string {
  const base = normalizarCodigoInsumo(cod);
  if (!base) return '';
  return codigoVisible(base, colores?.get(base));
}

/**
 * Parte una línea de material en su código y el resto del texto.
 *
 * La hoja de inventario de la OT y la de bodega escriben cada material como
 * «[CAD01] CADENA INFINITA 3 METROS», con el código pegado ADENTRO del texto:
 * ese texto lo arma el cotizador, que no tiene la ficha del artículo. En vez
 * de pasarle el catálogo a todo el motor de la OT —un parámetro más en una
 * cadena de ocho, para pegar tres letras—, la línea se parte acá, al momento
 * de mostrarla.
 *
 * `codigo` viene ya en su forma visible. Si la línea no empieza con un código
 * entre corchetes —las manillas y las tapas de cenefa no tienen insumo—,
 * `codigo` es `null` y `resto` es la línea entera.
 */
export function partirLineaConCodigo(
  texto: unknown,
  colores?: Map<string, string> | null,
): { codigo: string | null; resto: string } {
  const t = String(texto ?? '');
  const m = t.match(/^\[([^\]]+)\]\s*/);
  if (!m) return { codigo: null, resto: t };
  const visible = codigoVisibleDe(m[1], colores);
  if (!visible) return { codigo: null, resto: t };
  return { codigo: visible, resto: t.slice(m[0].length) };
}

/** La misma línea con el código cambiado por su forma visible, como texto. */
export function lineaConCodigoVisible(texto: unknown, colores?: Map<string, string> | null): string {
  const { codigo, resto } = partirLineaConCodigo(texto, colores);
  return codigo ? `[${codigo}] ${resto}` : resto;
}

/** Lo mínimo que hace falta para buscar un artículo. */
export type ArticuloBuscable = {
  cod?: string | null;
  color?: string | null;
  nemotecnico?: string | null;
  descriptor_proveedor?: string | null;
};

/**
 * ¿Este artículo calza con lo que se escribió en el buscador?
 *
 * Busca por la llave, por el código visible y por el nombre. El código se
 * compara sin espacios para que «MEC 32» encuentre a MEC32: la gente lo
 * escribe con espacio porque así lo ve en las recetas y en el catálogo de
 * productos.
 */
export function coincideBusquedaInsumo(articulo: ArticuloBuscable, busqueda: string): boolean {
  const q = String(busqueda ?? '').trim().toUpperCase();
  if (!q) return true;
  const qCod = normalizarCodigoInsumo(q);

  const cod = normalizarCodigoInsumo(articulo.cod);
  if (qCod && cod.includes(qCod)) return true;
  if (qCod && codigoVisible(articulo.cod, articulo.color).includes(qCod)) return true;

  const texto = [articulo.nemotecnico, articulo.descriptor_proveedor, articulo.color]
    .map((t) => String(t ?? '').toUpperCase())
    .join(' | ');
  return texto.includes(q);
}

// ── Errores del alta ─────────────────────────────────────────────────

/**
 * Los errores de `insumo_crear` en castellano. Sin esto, el UNIQUE de la base
 * llega crudo a la pantalla («duplicate key value violates unique constraint»)
 * y nadie entiende que el código ya estaba tomado.
 */
export function mensajeErrorAlta(code?: string, mensaje?: string): string {
  switch (code) {
    case 'IN010':
      return 'No hay sesión activa. Vuelve a entrar.';
    case 'IN011':
      return 'Esa familia de códigos no existe. Créala en Inventario → Configuración.';
    case 'IN012':
      return 'El código no tiene la forma esperada: de 1 a 4 letras, 2 o 3 números y, si corresponde, «-B».';
    case 'IN013':
      return 'Ese código ya existe. Si lo escribiste a mano, elige otro; si lo propuso el sistema, vuelve a intentar.';
    case 'IN014':
      return 'Solo un administrador puede elegir el código a mano.';
    case 'IN015':
      return 'Esa unidad no existe. Las unidades se administran en Inventario → Configuración.';
    case '23505':
      return 'Ese código ya existe. Si lo propuso el sistema, vuelve a intentar.';
    case '42501':
      return 'Tu usuario no tiene permiso para dar de alta artículos.';
    case 'PGRST202':
    case 'PGRST205':
    case '42P01':
    case '42883':
      return 'Falta correr la migración sql/20260910_insumos_01_familias.sql para dar de alta artículos.';
    default:
      return mensaje ? `No se pudo crear el artículo: ${mensaje}` : 'No se pudo crear el artículo.';
  }
}
