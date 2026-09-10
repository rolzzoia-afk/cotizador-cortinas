// ─────────────────────────────────────────────────────────────────────
// Las listas del formulario de un insumo, y las familias de código.
//
// `validadores_insumos` es lo que los desplegables ofrecen. Hasta el SQL 02
// tenía 8 subcategorías mientras los datos usaban 40: por eso todo lo nuevo
// caía en MATERIALES, que ya no significaba nada. La regla que se sigue acá es
// que la lista NUNCA puede quedar más corta que los datos —si una fila dice
// «TORNILLERIA», el desplegable tiene que ofrecer «TORNILLERIA»—, y la
// pantalla de Configuración lo comprueba a la vista.
//
// Módulo PURO: sin React y sin Supabase.
// ─────────────────────────────────────────────────────────────────────

import { ABREVIATURAS_COLOR, type FamiliaInsumo } from './codigosInsumo';
import type { Validador } from './helpers';

/** Los campos que la pantalla de Configuración deja editar, en su orden. */
export const CAMPOS_VALIDADOR: ReadonlyArray<{
  campo: string;
  titulo: string;
  hint: string;
}> = [
  {
    campo: 'CATEGORIA',
    titulo: 'Categoría',
    hint: 'El cajón grande: insumo, herramienta, uniforme, EPP.',
  },
  {
    campo: 'SUB_CATEGORIA',
    titulo: 'Subcategoría',
    hint: 'Qué es la pieza. Es lo que agrupa los informes y lo que más se llena mal.',
  },
  {
    campo: 'COLOR',
    titulo: 'Color',
    hint: 'De acá sale el sufijo del código visible: BLANCO da «MEC32-BCO».',
  },
  { campo: 'PRODUCTO', titulo: 'Producto', hint: 'En qué cortina se usa.' },
  { campo: 'PROVEEDOR', titulo: 'Proveedor', hint: 'A quién se le compra.' },
  { campo: 'COMPRA', titulo: 'Compra', hint: 'Nacional o importación.' },
  { campo: 'ESTADO', titulo: 'Estado', hint: 'Activo o descontinuado.' },
  { campo: 'UBICACION', titulo: 'Ubicación', hint: 'En qué local está.' },
  { campo: 'RESPONSABLE', titulo: 'Responsable', hint: 'Quién lo tiene a cargo.' },
  { campo: 'ALMACEN', titulo: 'Almacén', hint: 'Materias primas o liberado.' },
];

/** Deja el valor como se guarda: mayúsculas y sin espacios de más. */
export function normalizarValorValidador(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Las opciones de cada desplegable, ya filtradas.
 *
 * Un valor DESACTIVADO deja de ofrecerse para lo nuevo pero no se borra: los
 * artículos que ya lo tienen lo conservan, y por eso la pantalla los sigue
 * mostrando. Borrarlo dejaría filas apuntando a un valor que el formulario no
 * conoce, que es exactamente el problema que arrastraba el módulo.
 */
export function mapaDeValidadores(filas: Validador[] | null | undefined): Record<string, string[]> {
  const mapa: Record<string, string[]> = {};
  for (const v of filas || []) {
    if (v.activo === false) continue;
    const campo = String(v.campo ?? '').trim();
    const valor = String(v.valor ?? '').trim();
    if (!campo || !valor) continue;
    const lista = (mapa[campo] ||= []);
    if (!lista.includes(valor)) lista.push(valor);
  }
  return mapa;
}

/**
 * Los valores que los ARTÍCULOS usan y el formulario no ofrece.
 *
 * Es el hueco que creó todo el desorden, así que la pantalla lo muestra en
 * rojo con un botón para agregarlos de una vez.
 */
export function valoresHuerfanos(
  campo: string,
  enUso: Iterable<string | null | undefined>,
  filas: Validador[] | null | undefined,
): string[] {
  const conocidos = new Set(
    (filas || [])
      .filter((v) => String(v.campo ?? '').trim() === campo)
      .map((v) => normalizarValorValidador(v.valor)),
  );
  const fuera = new Set<string>();
  for (const bruto of enUso) {
    const v = normalizarValorValidador(bruto);
    if (v && !conocidos.has(v)) fuera.add(v);
  }
  return [...fuera].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Mensaje si el valor no se puede agregar; `null` si está bien. */
export function problemaValorNuevo(
  valor: unknown,
  campo: string,
  filas: Validador[] | null | undefined,
): string | null {
  const v = normalizarValorValidador(valor);
  if (!v) return 'Escribe un valor.';
  if (v.length > 60) return 'El valor es demasiado largo.';
  const repetido = (filas || []).some(
    (f) => String(f.campo ?? '').trim() === campo && normalizarValorValidador(f.valor) === v,
  );
  if (repetido) return `«${v}» ya está en la lista.`;
  return null;
}

// ── Colores sin abreviatura ──────────────────────────────────────────

/**
 * Los colores del catálogo que NO tienen tres letras, y por eso salen sin
 * sufijo en el código visible.
 *
 * No se inventa una abreviatura: un «-AZ» que nadie definió se lee como otro
 * código. La pantalla los lista para que alguien decida si vale la pena
 * agregarlos al diccionario o si da lo mismo que se vean sin color.
 */
export function coloresSinAbreviatura(colores: Iterable<string | null | undefined>): string[] {
  const fuera = new Set<string>();
  for (const bruto of colores) {
    const c = normalizarValorValidador(bruto);
    if (!c || c === 'N/A' || c === 'NA') continue;
    const sinTildes = c.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!ABREVIATURAS_COLOR[sinTildes]) fuera.add(c);
  }
  return [...fuera].sort((a, b) => a.localeCompare(b, 'es'));
}

// ── Familias de código ───────────────────────────────────────────────

/** 1 a 4 letras, nada más: el prefijo es la primera parte del código. */
export const RE_PREFIJO_FAMILIA = /^[A-Z]{1,4}$/;

/** El correlativo más alto que ya usa cada prefijo. */
export function maximoPorPrefijo(codigos: Iterable<string | null | undefined>): Map<string, number> {
  const max = new Map<string, number>();
  for (const bruto of codigos) {
    const c = String(bruto ?? '')
      .trim()
      .toUpperCase();
    const m = c.match(/^([A-Z]{1,4})([0-9]+)/);
    if (!m) continue;
    const n = parseInt(m[2], 10);
    if (!Number.isFinite(n)) continue;
    const actual = max.get(m[1]);
    if (actual === undefined || n > actual) max.set(m[1], n);
  }
  return max;
}

/** Mensaje si el prefijo no sirve para una familia NUEVA; `null` si está bien. */
export function problemaPrefijoNuevo(
  prefijo: unknown,
  familias: FamiliaInsumo[] | null | undefined,
): string | null {
  const p = String(prefijo ?? '')
    .trim()
    .toUpperCase();
  if (!p) return 'Escribe un prefijo.';
  if (!RE_PREFIJO_FAMILIA.test(p)) return 'El prefijo son 1 a 4 letras, sin números ni espacios.';
  if ((familias || []).some((f) => f.prefijo === p)) return `La familia ${p} ya existe.`;
  return null;
}

/**
 * Lo que hay que advertir antes de guardar una familia. Nada de esto impide
 * guardar: son avisos, porque quien administra puede tener una razón.
 */
export function avisosDeFamilia(
  familia: Pick<FamiliaInsumo, 'prefijo' | 'siguiente' | 'digitos' | 'activo'>,
  maximoUsado: number | undefined,
): string[] {
  const avisos: string[] = [];
  const siguiente = Number(familia.siguiente);

  if (!Number.isFinite(siguiente) || siguiente < 1) {
    avisos.push('El próximo número tiene que ser 1 o más.');
  } else if (maximoUsado !== undefined && siguiente <= maximoUsado) {
    // No es un error: la base salta los códigos ocupados al dar de alta. Pero
    // conviene decirlo, porque el próximo código no va a ser el que se ve.
    avisos.push(
      `${familia.prefijo}${siguiente} ya existe o quedó atrás (el más alto es ${maximoUsado}). ` +
        'Al dar de alta, la base va a saltar hasta el primero libre.',
    );
  }

  if (familia.digitos !== 2 && familia.digitos !== 3) {
    avisos.push('Los dígitos son 2 o 3.');
  } else if (familia.digitos === 2 && maximoUsado !== undefined && maximoUsado > 99) {
    avisos.push(
      `${familia.prefijo} ya pasó de 99, así que sus códigos nuevos necesitan 3 dígitos.`,
    );
  }

  if (!familia.activo) {
    avisos.push('Desactivada: deja de ofrecerse en el alta. Los artículos que ya tiene no cambian.');
  }

  return avisos;
}

/** Familias ordenadas como se leen: las activas primero, luego por prefijo. */
export function ordenarFamilias(familias: FamiliaInsumo[]): FamiliaInsumo[] {
  return [...familias].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return a.prefijo.localeCompare(b.prefijo, 'es');
  });
}
