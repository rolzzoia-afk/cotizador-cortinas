// ─────────────────────────────────────────────────────────────────────
// EL ASISTENTE «NUEVA CATEGORÍA»: dar de alta una familia de telas y sus
// productos de una sola vez, como se hace en el Excel maestro.
//
// Qué es una «categoría» acá: una FAMILIA de telas (el `cod` del producto:
// BLACKOUT_D, SCREEN_P…) que se fabrica y se cobra como una existente. Igual
// que en el Excel, el nombre de la categoría + la gama arman el código de
// familia: LINO premium → `LINO_P`, delux → `LINO_D`. Un sistema físico nuevo
// —otro beeblack— no se hace desde acá: eso es desarrollo.
//
// Este módulo es PURO: arma y valida el borrador. La escritura (catálogo,
// reglas de precio y pastilla) vive en `nuevaCategoriaAplicar.ts` y el pegado
// desde Excel en `nuevaCategoriaPegado.ts`.
// ─────────────────────────────────────────────────────────────────────
import { esCortinaTipo, TIPOS_CORTINA } from './flujoCatalogo';
import {
  RECETA_DUO_GENERICO_KEY,
  RECETA_VERTICAL_KEY,
  sistemaDeFamilia,
  type ReglasPrecios,
} from './reglasPrecios';
import type { ChipCustom } from './chipsCustom';
import type { CatalogoProductos } from './types';

/** Cómo se fabrica y se cobra la familia nueva. */
export type TipoCategoria = 'roller' | 'duo' | 'vertical' | 'accesorio';

/**
 * El sufijo de familia de cada gama, como en el Excel. BASIC comparte el `_S`
 * de STANDARD: ninguna familia de fábrica tiene una gama basic propia, y es lo
 * que ya hace el motor cuando no encuentra receta (`claveReceta`).
 */
export const SUFIJO_GAMA: Record<string, string> = {
  PREMIUM: '_P',
  DELUX: '_D',
  STANDARD: '_S',
  BASIC: '_S',
};

/** La familia de todo lo que no es cortina (es la que usan hoy los accesorios). */
export const COD_ACCESORIO = 'ACCESORIO';

export type FilaProductoNueva = {
  id: string;
  /** Nombre comercial. Se sugiere solo mientras `productoAuto` siga en true. */
  producto: string;
  productoAuto: boolean;
  codInt: string;
  tipo: string;
  descripcion: string;
  /** 'AAAA-MM-DD'. */
  fechaAlta: string;
  proveedor: string;
  descuentoPct: number;
  costo: number;
  gananciaPct: number;
  precio: number;
  /** El precio se escribió a mano y deja de seguir al costo. */
  precioManual: boolean;
  anchoRolloM: number;
  gama: '' | 'A' | 'B';
  /** Esta es la tela de REFERENCIA de su familia: la que le fija el $/m. */
  referencia: boolean;
  /** COD escrito a mano (solo con el candado abierto en la grilla). */
  codManual?: string;
};

export type PastillaElegida =
  | { modo: 'nueva'; label: string; hex: string }
  | { modo: 'existente'; id: string };

export type BorradorCategoria = {
  nombre: string;
  tipo: TipoCategoria;
  /** Raíz del código de familia: LINO → LINO_P / LINO_D. */
  baseCod: string;
  pastilla: PastillaElegida;
  categoriaFabricacion: string;
  /** Familia nueva → familia que le presta la receta. */
  moldes: Record<string, string>;
  /** Familia vertical nueva → COD_INT del que sale el precio de su tela. */
  baseVerticalDe: Record<string, string>;
  filas: FilaProductoNueva[];
  /** Modo «agregar productos a una familia que ya existe»: no toca las reglas. */
  familiaExistente?: string;
};

export type ContextoCategoria = {
  catalogo: CatalogoProductos;
  anchoRollo: Record<string, number>;
  reglas: ReglasPrecios;
  chips: readonly ChipCustom[];
  parametros: { iva: number; margenInsumo: number };
  /** Las categorías de fabricación vigentes (`categoriasParaSelect`). */
  categoriasSelect: readonly string[];
  /** Hoy en 'AAAA-MM-DD' (lo pone quien llama: acá no se mira el reloj). */
  hoy: string;
};

const N = (s: string | undefined) => (s || '').trim().toUpperCase();

let seq = 0;
/** Id local de una fila de la grilla. No se guarda en ningún lado. */
export const idFilaNueva = (): string => `fila-${(seq++).toString(36)}-${Date.now().toString(36)}`;

/** El nombre, hecho código: sin tildes, en mayúsculas y sin nada raro. */
export function slugBase(nombre: string): string {
  return (nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

/**
 * La raíz del código que se propone. Un dúo lleva DUO adelante porque el motor
 * decide que una cortina es dúo por ahí (`cod.startsWith('DUO')`): sin eso se
 * cobraría una sola tela.
 */
export function baseCodSugerido(nombre: string, tipo: TipoCategoria): string {
  const slug = slugBase(nombre);
  if (!slug) return '';
  if (tipo === 'duo' && !slug.startsWith('DUO')) return `DUO${slug}`.slice(0, 24);
  return slug;
}

/** Las dos letras con que se propone el código de la tela de referencia (LINO → LN). */
export function siglaBase(base: string): string {
  const s = N(base).replace(/[^A-Z]/g, '');
  if (!s) return 'XX';
  const sinVocales = s.slice(1).replace(/[AEIOU]/g, '');
  return `${s[0]}${sinVocales[0] ?? s[1] ?? s[0]}`;
}

/** La familia (`Producto.cod`) que le toca a una fila. */
export function codFamilia(b: BorradorCategoria, fila: FilaProductoNueva): string {
  const aMano = N(fila.codManual);
  if (aMano) return aMano;
  if (b.familiaExistente) return b.familiaExistente;
  // Lo que no es cortina no tiene familia propia: se cobra a precio fijo y va
  // con todos los demás accesorios.
  if (b.tipo === 'accesorio' || !esCortinaTipo(fila.tipo)) return COD_ACCESORIO;
  const sufijo = SUFIJO_GAMA[N(fila.tipo)] ?? '_S';
  const base = N(b.baseCod);
  return b.tipo === 'vertical' ? `${base}_V${sufijo}` : `${base}${sufijo}`;
}

/** Las familias de cortina que va a crear este borrador, sin repetir. */
export function familiasDelBorrador(b: BorradorCategoria): string[] {
  if (b.familiaExistente || b.tipo === 'accesorio') return [];
  const out: string[] = [];
  for (const f of b.filas) {
    if (!esCortinaTipo(f.tipo)) continue;
    const cod = codFamilia(b, f);
    if (cod !== COD_ACCESORIO && !out.includes(cod)) out.push(cod);
  }
  return out;
}

/**
 * El nombre comercial que se propone. Sigue la convención de la que dependen el
 * motor (dúo y vertical se deducen del nombre) y las etiquetas del taller, que
 * imprimen la PRIMERA palabra como tipo de cortina.
 */
export function nombreProductoSugerido(b: BorradorCategoria, tipoFila: string): string {
  const nombre = N(b.nombre) || N(b.baseCod);
  if (!nombre) return '';
  const gama = esCortinaTipo(tipoFila) ? ` ${N(tipoFila)}` : '';
  if (b.tipo === 'accesorio') return nombre;
  if (b.tipo === 'duo') return `DUO ${nombre}${gama}`;
  if (b.tipo === 'vertical') return `CORTINA VERTICAL ${nombre}${gama}`;
  return `ROLLER ${nombre}${gama}`;
}

/**
 * El precio de venta del Excel: costo ÷ ganancia × (1 + IVA). La «ganancia
 * 65 %» de la planilla es un DIVISOR (el margen de la casa), no un recargo.
 */
export function precioDesdeCosto(costo: number, ganancia: number, iva: number): number {
  if (!(costo > 0) || !(ganancia > 0)) return 0;
  return Math.round((costo / ganancia) * (1 + iva));
}

/** Una fila en blanco, con lo que se puede adivinar ya puesto. */
export function filaNueva(
  b: BorradorCategoria,
  ctx: ContextoCategoria,
  tipo: string = TIPOS_CORTINA[0],
): FilaProductoNueva {
  return {
    id: idFilaNueva(),
    producto: nombreProductoSugerido(b, tipo),
    productoAuto: true,
    codInt: '',
    tipo,
    descripcion: '',
    fechaAlta: ctx.hoy,
    proveedor: '',
    descuentoPct: 0,
    costo: 0,
    gananciaPct: Math.round(ctx.parametros.margenInsumo * 100),
    precio: 0,
    precioManual: false,
    anchoRolloM: 0,
    gama: '',
    referencia: false,
  };
}

/**
 * Deja la fila coherente después de tocarla: el precio sigue al costo mientras
 * nadie lo escriba a mano, y el nombre sigue al tipo mientras sea el sugerido.
 */
export function recalcularFila(
  fila: FilaProductoNueva,
  b: BorradorCategoria,
  ctx: ContextoCategoria,
): FilaProductoNueva {
  const precio = fila.precioManual
    ? fila.precio
    : precioDesdeCosto(fila.costo, fila.gananciaPct / 100, ctx.parametros.iva);
  const producto = fila.productoAuto ? nombreProductoSugerido(b, fila.tipo) : fila.producto;
  return { ...fila, precio, producto };
}

/**
 * La fila de REFERENCIA de una gama: el «COLOR POR DEFINIR» del Excel, la tela
 * cuyo precio cobra toda la familia. Sin ella la familia se cobra con la tela
 * más cara que alguien venda, que sube sola cuando entra una cara.
 */
export function filaDeReferencia(
  b: BorradorCategoria,
  ctx: ContextoCategoria,
  tipo: string,
): FilaProductoNueva {
  const sufijo = (SUFIJO_GAMA[N(tipo)] ?? '_S').replace('_', '');
  return {
    ...filaNueva(b, ctx, tipo),
    codInt: `${siglaBase(b.baseCod)}-${sufijo}`,
    descripcion: 'COLOR POR DEFINIR',
    referencia: true,
  };
}

/**
 * Las familias que pueden prestar su receta. Se dejan afuera las recetas de
 * respaldo (vertical y dúo genérico), las variantes (`|B`, `|INV`…) y las que
 * tienen sistema propio: copiar la receta del beeblack sin su sistema daría una
 * cortina a medio cobrar.
 */
export function moldesDisponibles(reglas: ReglasPrecios, tipo: TipoCategoria): string[] {
  if (tipo === 'vertical' || tipo === 'accesorio') return [];
  const duo = tipo === 'duo';
  return Object.keys(reglas.recetas)
    .filter(
      (k) =>
        !k.includes('|') &&
        k !== RECETA_VERTICAL_KEY &&
        k !== RECETA_DUO_GENERICO_KEY &&
        !sistemaDeFamilia(k, reglas.sistemas) &&
        k.startsWith('DUO') === duo,
    )
    .sort((a, b) => a.localeCompare(b, 'es'));
}

/** El molde que se propone: el blackout de la misma gama (el dúo, su DUOBK). */
export function moldeSugerido(cod: string, tipo: TipoCategoria): string {
  const gama = /_(P|D|S)$/.exec(N(cod))?.[1] ?? 'P';
  return tipo === 'duo' ? `DUOBK_${gama}` : `BLACKOUT_${gama}`;
}

/** Las variantes de receta que tiene un molde y hay que copiar con él. */
export function variantesDeMolde(reglas: ReglasPrecios, molde: string): string[] {
  return Object.keys(reglas.recetas)
    .filter((k) => k.startsWith(`${molde}|`))
    .map((k) => k.slice(molde.length));
}
