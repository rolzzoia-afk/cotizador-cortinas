// ─────────────────────────────────────────────────────────────────────
// El catálogo de telas, como lo mira alguien de bodega (lámina «Telas»).
//
// Acá vive lo que se puede decidir sin la pantalla: cómo se lee cada saldo,
// cómo se llama cada familia, qué se filtra y qué se ordena. Nada consulta la
// base ni pinta nada, así que se puede fijar con tests — y conviene, porque
// una tela que se esconde detrás de un filtro es una tela que alguien va a
// salir a comprar teniéndola en el rack.
//
// Dos cosas que la tabla NO inventa:
//   · el ancho de rollo, cuando falta, se avisa (no se asume 2,98 en silencio);
//   · los rollos equivalentes solo se muestran si la tela declara cuántos
//     metros trae su rollo. El metro es la verdad; el rollo es una forma de
//     mirar.
// ─────────────────────────────────────────────────────────────────────

import { normalizarAlmacen } from './almacenes';
import { estadoArticulo, type EstadoArticulo } from './badges';

/** Lo que la tabla necesita saber de una tela. */
export type TelaCatalogo = {
  codigo: string;
  tipo?: string | null;
  grupo?: string | null;
  nemotecnico?: string | null;
  descriptor?: string | null;
  proveedor?: string | null;
  cod_ext?: string | null;
  posicion?: string | null;
  almacen?: string | null;
  estado?: string | null;
  status_stock?: string | null;
  ancho?: number | null;
  metros_rollo?: number | null;
  stock_minimo?: number | null;
  stock_mp?: number | null;
  stock_liberado?: number | null;
};

// ── Nombres ──────────────────────────────────────────────────────────

/**
 * La familia de la tela. En la base es la columna `tipo` (BK, DU, SC); la
 * columna que se llama `grupo` guarda el COLOR («BLANCO», «MARENGO»), así que
 * las dos no pueden compartir nombre en pantalla sin confundir a alguien.
 */
export const FAMILIAS_TELA: Record<string, string> = {
  BK: 'Blackout',
  DU: 'Dúo',
  SC: 'Screen',
  TR: 'Translúcida',
  VE: 'Vertical',
  BEE: 'Bee-black',
};

/** Un tipo que no está en la tabla se muestra tal cual: nunca se lo renombra. */
export function nombreFamilia(tipo: string | null | undefined): string {
  const t = String(tipo ?? '')
    .trim()
    .toUpperCase();
  if (!t) return '—';
  return FAMILIAS_TELA[t] ?? t;
}

/** Cómo se llama la tela en la lista. El nemotécnico es el nombre de la casa. */
export function descripcionTela(t: TelaCatalogo): string {
  const nemo = String(t.nemotecnico ?? '').trim();
  if (nemo) return nemo;
  const desc = String(t.descriptor ?? '').trim();
  return desc || '—';
}

// ── Saldos ───────────────────────────────────────────────────────────

/**
 * El saldo en metros. Se suma de las dos bodegas en vez de leer `stock_total`
 * porque esa columna se escribió a mano durante años y hay filas donde no
 * cuadra; las dos que se suman acá son las que mueve el kardex.
 */
export function saldoTela(t: TelaCatalogo): number {
  return Number(t.stock_mp ?? 0) + Number(t.stock_liberado ?? 0);
}

/** Metros con dos decimales y coma, como se escriben en Chile. */
export function textoMetros(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Rollos equivalentes. Se calculan al mostrar y no se guardan en ninguna
 * parte: si la tela no declara los metros de su rollo, se dice que no se sabe
 * en vez de suponer un largo.
 */
export function textoRollos(total: number, metrosRollo: number | null | undefined): string {
  const largo = Number(metrosRollo ?? 0);
  if (!(largo > 0)) return '—';
  if (total <= 0) return '—';
  const rollos = total / largo;
  if (rollos < 1) return '< 1';
  return `≈ ${Math.round(rollos).toLocaleString('es-CL')}`;
}

/**
 * Cuánto del mínimo está cubierto, de 0 a 100. La barra de la tabla contesta
 * «¿le falta?», que es la pregunta de bodega; una tela sin mínimo definido no
 * tiene barra, porque no hay contra qué compararla.
 */
export function avanceMinimo(
  total: number,
  minimo: number | null | undefined,
): number | null {
  const m = Number(minimo ?? 0);
  if (!(m > 0)) return null;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((total / m) * 100));
}

/** El estado del artículo, con el vocabulario compartido del módulo. */
export function estadoTela(t: TelaCatalogo): EstadoArticulo {
  return estadoArticulo({
    total: saldoTela(t),
    minimo: t.stock_minimo,
    // `estado` es lo que se decidió del código; `status_stock` es un rótulo
    // viejo que a veces también dice DESCONTINUADO.
    status: String(t.estado ?? '').trim().toUpperCase() === 'DESCONTINUADO'
      ? 'DESCONTINUADO'
      : t.status_stock,
  });
}

/** ¿Esta tela tiene declarado el ancho de su rollo? */
export function tieneAncho(t: TelaCatalogo): boolean {
  return Number(t.ancho ?? 0) > 0;
}

// ── Filtros ──────────────────────────────────────────────────────────

export type FiltrosTelas = {
  busqueda: string;
  /** Código de familia (`tipo`): BK, DU, SC… */
  familia: string;
  /** El color, que en la base se llama `grupo`. */
  color: string;
  /** Código canónico de almacén: MP, LIB. */
  almacen: string;
  proveedor: string;
  soloBajoMinimo: boolean;
};

export const FILTROS_TELAS_VACIOS: FiltrosTelas = {
  busqueda: '',
  familia: '',
  color: '',
  almacen: '',
  proveedor: '',
  soloBajoMinimo: false,
};

function limpio(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

export function filtrarTelas<T extends TelaCatalogo>(telas: T[], f: FiltrosTelas): T[] {
  const q = limpio(f.busqueda);
  return telas.filter((t) => {
    if (q) {
      const campos = [
        t.codigo,
        t.nemotecnico,
        t.descriptor,
        t.proveedor,
        t.cod_ext,
        t.grupo,
        t.posicion,
      ];
      if (!campos.some((c) => limpio(c).includes(q))) return false;
    }
    if (f.familia && String(t.tipo ?? '').trim().toUpperCase() !== f.familia) return false;
    if (f.color && String(t.grupo ?? '').trim().toUpperCase() !== f.color) return false;
    if (f.almacen && normalizarAlmacen(t.almacen) !== f.almacen) return false;
    if (f.proveedor && String(t.proveedor ?? '').trim() !== f.proveedor) return false;
    if (f.soloBajoMinimo) {
      const e = estadoTela(t);
      // «Bajo mínimo» incluye lo que ya se acabó: las dos cosas obligan a
      // comprar. Lo descontinuado no, que justamente ya no se repone.
      if (e !== 'bajo_minimo' && e !== 'sin_stock' && e !== 'negativo') return false;
    }
    return true;
  });
}

// ── Orden ────────────────────────────────────────────────────────────

export type ColumnaTelas =
  | 'codigo'
  | 'descripcion'
  | 'familia'
  | 'ancho'
  | 'mp'
  | 'liberado'
  | 'total'
  | 'estado';

export type SentidoOrden = 'asc' | 'desc';

const ORDEN_ESTADOS: Record<EstadoArticulo, number> = {
  negativo: 0,
  sin_stock: 1,
  bajo_minimo: 2,
  con_stock: 3,
  sin_minimo: 4,
  descontinuado: 5,
};

/** El valor por el que se ordena. Los números se comparan como números. */
function clave(t: TelaCatalogo, col: ColumnaTelas): string | number {
  switch (col) {
    case 'descripcion':
      return descripcionTela(t).toLowerCase();
    case 'familia':
      return nombreFamilia(t.tipo).toLowerCase();
    case 'ancho':
      return Number(t.ancho ?? -1);
    case 'mp':
      return Number(t.stock_mp ?? 0);
    case 'liberado':
      return Number(t.stock_liberado ?? 0);
    case 'total':
      return saldoTela(t);
    case 'estado':
      return ORDEN_ESTADOS[estadoTela(t)];
    default:
      return String(t.codigo ?? '').toLowerCase();
  }
}

export function ordenarTelas<T extends TelaCatalogo>(
  telas: T[],
  col: ColumnaTelas,
  dir: SentidoOrden,
): T[] {
  const signo = dir === 'asc' ? 1 : -1;
  return [...telas].sort((a, b) => {
    const va = clave(a, col);
    const vb = clave(b, col);
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va !== vb) return (va - vb) * signo;
    } else if (va !== vb) {
      return String(va).localeCompare(String(vb), 'es') * signo;
    }
    // Empate: el código manda, para que la lista no baile entre renders.
    return String(a.codigo).localeCompare(String(b.codigo), 'es');
  });
}

// ── Resumen y opciones ───────────────────────────────────────────────

export type ResumenTelas = {
  total: number;
  conStock: number;
  bajoMinimo: number;
  sinAncho: number;
};

export function resumenTelas(telas: TelaCatalogo[]): ResumenTelas {
  let conStock = 0;
  let bajoMinimo = 0;
  let sinAncho = 0;
  for (const t of telas) {
    if (saldoTela(t) > 0) conStock++;
    if (estadoTela(t) === 'bajo_minimo') bajoMinimo++;
    if (!tieneAncho(t)) sinAncho++;
  }
  return { total: telas.length, conStock, bajoMinimo, sinAncho };
}

export type OpcionesTelas = {
  familias: Array<{ id: string; texto: string }>;
  colores: string[];
  almacenes: string[];
  proveedores: string[];
};

/**
 * Lo que ofrecen los desplegables. Solo lo que existe de verdad en la lista:
 * un filtro que no devuelve nada es una pregunta perdida.
 */
export function opcionesTelas(telas: TelaCatalogo[]): OpcionesTelas {
  const familias = new Set<string>();
  const colores = new Set<string>();
  const almacenes = new Set<string>();
  const proveedores = new Set<string>();
  for (const t of telas) {
    const fam = String(t.tipo ?? '').trim().toUpperCase();
    if (fam) familias.add(fam);
    const col = String(t.grupo ?? '').trim().toUpperCase();
    if (col) colores.add(col);
    const alm = normalizarAlmacen(t.almacen);
    if (alm) almacenes.add(alm);
    const prov = String(t.proveedor ?? '').trim();
    if (prov) proveedores.add(prov);
  }
  return {
    familias: [...familias]
      .map((id) => ({ id, texto: nombreFamilia(id) }))
      .sort((a, b) => a.texto.localeCompare(b.texto, 'es')),
    colores: [...colores].sort((a, b) => a.localeCompare(b, 'es')),
    almacenes: [...almacenes].sort(),
    proveedores: [...proveedores].sort((a, b) => a.localeCompare(b, 'es')),
  };
}
