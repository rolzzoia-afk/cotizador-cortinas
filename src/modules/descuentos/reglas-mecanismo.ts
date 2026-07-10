// ─────────────────────────────────────────────────────────────────────
// REGLAS DE MECANISMO — Cotizador Fase 2 / Inventario Fase 4
//
// Edita este archivo para cambiar qué mecanismo se pre-selecciona y qué
// opciones aparecen en el editor de paño.
//
// Orden de evaluación:
//   1. categoriasSinMecanismo → oculta el selector (VERTICAL, BEEBLACK)
//   2. reglasCategoria (primera que coincida) → MEC por tipo de cortina
//   3. colorAMec → kits inventario 32/33/34 para rollers estándar
//
// Los chips visibles deben existir en OPCIONES_MECANISMO (fase2.ts).
// Tuberías: ver reglas-tuberia.ts
// ─────────────────────────────────────────────────────────────────────

/** Coincidencia exacta de categoría o substring (case insensitive). */
export type MatchCategoria = string | { includes: string };

export type ReglaMecCategoria = {
  /** Nota para quien edita las reglas; no afecta la lógica. */
  descripcion: string;
  categoria: MatchCategoria;
  /** Número MEC de bodega — debe tener chip en OPCIONES_MECANISMO. */
  mec: number;
  /** Referencia al código de inventario en bodega. */
  codigoInventario?: string;
  /** Si true, aplica siempre (ignora color de accesorios). */
  fijo?: boolean;
  /** Colores que activan la regla. Omitir o vacío = cualquier color. */
  colores?: readonly string[];
};

export const REGLAS_MECANISMO = {
  /** Categorías que NO llevan mecanismo roller. */
  categoriasSinMecanismo: ['VERTICAL', 'BEEBLACK'] as const,

  /** Kits de inventario bodega — visibles en rollers estándar (Fase 2).
   *  32/33/34 simples · 40/41 reforzados (mismo tubo 38 mm). */
  kitsInventario: [32, 33, 34, 40, 41] as const,

  /**
   * MEC del Excel legacy que se reemplazan automáticamente por kits inventario
   * o por la regla de categoría correspondiente.
   */
  legacyReemplazar: [5, 6, 9, 10, 11, 13, 14, 18, 23, 28] as const,

  /**
   * Reglas por ANCHO: fuerzan un MEC según el ancho de la cortina, por encima
   * de la regla de color. Roller simple sobre 3 m usa el kit 63 mm (MEC 28,
   * tubo E65). Se evalúan tras la regla de categoría.
   */
  reglasAncho: [
    { descripcion: 'Roller simple sobre 3,0 m → MEC 28 (fila 63 mm, tubo E65)', categoria: 'ROL', anchoMinM: 3.0, mec: 28 },
  ] as const,

  /** Mapeo color accesorios → MEC inventario (rollers estándar). */
  colorAMec: {
    BCO: 33,
    BLANCO: 33,
    GRS: 34,
    GRIS: 34,
    NEG: 32,
    NEGRO: 32,
  } as const satisfies Record<string, number>,

  /** Alias de color para buscar modelos en el catálogo Excel. */
  aliasColorModelo: {
    BCO: 'BLANCO',
    GRS: 'GRIS',
    NEG: 'NEGRO',
  } as const satisfies Record<string, string>,

  /**
   * Reglas por categoría — se evalúan EN ORDEN; gana la primera que coincida.
   * Agrega filas aquí para nuevos tipos (SOFT_LIGHT_45mm, DARK_38mm, etc.).
   */
  reglasCategoria: [
    {
      descripcion: 'Oscurante 63 mm — siempre MEC 28',
      categoria: { includes: 'OSCURANTI' },
      mec: 28,
      codigoInventario: 'MEC_28_63mm_BLANCO_DERECHO_IZQ',
      fijo: true,
    },
    {
      descripcion: 'Soft light 38 mm con accesorios blancos → MEC 39 ovalada',
      categoria: 'SOFT_LIGHT_38mm',
      mec: 39,
      codigoInventario: 'MEC_39_OVALADA_BLANCO',
      colores: ['BCO', 'BLANCO'],
    },
    // Dúo manual 38 mm (cenefa ovalada): usa el kit ovalada de bodega según
    // color de accesorios, NO el kit simple 32/33/34. Verificado contra el
    // inventario real 2026-07-06: MEC 39 = MECANISMO OVALADO BLANCO - ROLZZO,
    // MEC 38 = OVALADO NEGRO - ROLZZO, MEC 12 = OVALADO GRIS (producto DÚO).
    {
      descripcion: 'Dúo manual 38 mm con accesorios blancos → MEC 39 ovalada',
      categoria: 'DUO_MANUAL_38mm',
      mec: 39,
      codigoInventario: 'MEC_39_OVALADA_BLANCO',
      colores: ['BCO', 'BLANCO'],
    },
    {
      descripcion: 'Dúo manual 38 mm con accesorios negros → MEC 38 ovalada',
      categoria: 'DUO_MANUAL_38mm',
      mec: 38,
      codigoInventario: 'MEC_38_OVALADA_NEGRO',
      colores: ['NEG', 'NEGRO'],
    },
    {
      descripcion: 'Dúo manual 38 mm con accesorios grises → MEC 12 ovalada',
      categoria: 'DUO_MANUAL_38mm',
      mec: 12,
      codigoInventario: 'MEC_12_OVALADA_GRIS',
      colores: ['GRS', 'GRIS'],
    },
    // Roller manual 38 mm con cenefa ovalada: misma familia de kits ovalada
    // que la dúo (confirmado 2026-07-07). Los motorizados no entran (el motor
    // reemplaza al mecanismo) y el 45 mm sigue con kit simple hasta confirmar
    // si bodega tiene kit ovalada de 45 mm.
    {
      descripcion: 'Roller manual cenefa ovalada 38 mm blanco → MEC 39 ovalada',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      mec: 39,
      codigoInventario: 'MEC_39_OVALADA_BLANCO',
      colores: ['BCO', 'BLANCO'],
    },
    {
      descripcion: 'Roller manual cenefa ovalada 38 mm negro → MEC 38 ovalada',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      mec: 38,
      codigoInventario: 'MEC_38_OVALADA_NEGRO',
      colores: ['NEG', 'NEGRO'],
    },
    {
      descripcion: 'Roller manual cenefa ovalada 38 mm gris → MEC 12 ovalada',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      mec: 12,
      codigoInventario: 'MEC_12_OVALADA_GRIS',
      colores: ['GRS', 'GRIS'],
    },
  ] as readonly ReglaMecCategoria[],
} as const;

// ── Helpers de normalización ─────────────────────────────────────────

export function normalizarColorAccesorio(color: string | null | undefined): string {
  const c = (color || '').toUpperCase().trim();
  if (c === 'GRISE') return 'GRIS';
  return c;
}

function normalizarCategoria(categoria: string): string {
  return (categoria || '').trim().toUpperCase();
}

export function categoriaCoincide(categoria: string, match: MatchCategoria): boolean {
  const c = normalizarCategoria(categoria);
  if (typeof match === 'string') return c === match.toUpperCase();
  return c.includes(match.includes.toUpperCase());
}

export function colorCoincide(
  color: string | null | undefined,
  colores?: readonly string[],
): boolean {
  if (!colores || colores.length === 0) return true;
  const norm = normalizarColorAccesorio(color);
  return colores.some((x) => normalizarColorAccesorio(x) === norm);
}

// ── Evaluación de reglas ───────────────────────────────────────────────

export function categoriaRequiereMecanismo(categoria: string): boolean {
  const c = normalizarCategoria(categoria);
  if (!c) return false;
  return !REGLAS_MECANISMO.categoriasSinMecanismo.some(
    (sin) => c === sin.toUpperCase(),
  );
}

export function numeroMecPorColor(color: string | null | undefined): number | null {
  const norm = normalizarColorAccesorio(color);
  return REGLAS_MECANISMO.colorAMec[norm as keyof typeof REGLAS_MECANISMO.colorAMec] ?? null;
}

export function esKitInventarioMec(num: number): boolean {
  return (REGLAS_MECANISMO.kitsInventario as readonly number[]).includes(num);
}

export function esMecLegacy(num: number): boolean {
  return (REGLAS_MECANISMO.legacyReemplazar as readonly number[]).includes(num);
}

/** Primera regla de categoría que aplica para la ventana y color dados. */
export function reglaCategoriaAplicable(
  categoria: string,
  color: string | null | undefined,
): (typeof REGLAS_MECANISMO.reglasCategoria)[number] | null {
  for (const regla of REGLAS_MECANISMO.reglasCategoria) {
    if (!categoriaCoincide(categoria, regla.categoria)) continue;
    if (regla.fijo || colorCoincide(color, regla.colores)) return regla;
  }
  return null;
}

/** Número MEC según regla de categoría, o null si no hay regla aplicable. */
export function mecPorCategoriaYColor(
  categoria: string,
  color: string | null | undefined,
): number | null {
  return reglaCategoriaAplicable(categoria, color)?.mec ?? null;
}

/** Número MEC forzado por ANCHO (roller simple >3 m → MEC 28), o null. */
export function mecPorAncho(categoria: string, anchoM: number): number | null {
  const c = normalizarCategoria(categoria);
  for (const r of REGLAS_MECANISMO.reglasAncho) {
    if (c === r.categoria.toUpperCase() && anchoM > r.anchoMinM) return r.mec;
  }
  return null;
}

/**
 * true si la categoría tiene una regla por ANCHO (p.ej. ROL sube a 63 mm sobre
 * 3 m). Sirve para saber cuándo hay que VOLVER a 38 mm al bajar de ese ancho —
 * OSCURANTI y las ovaladas, que también son 63 mm, no tienen regla → no se tocan.
 */
export function categoriaTieneReglaAncho(categoria: string): boolean {
  const c = normalizarCategoria(categoria);
  return REGLAS_MECANISMO.reglasAncho.some((r) => c === r.categoria.toUpperCase());
}

/** true si la categoría tiene una regla fija (ignora color al forzar MEC). */
export function mecEsFijoPorCategoria(categoria: string): boolean {
  return REGLAS_MECANISMO.reglasCategoria.some(
    (r) => r.fijo && categoriaCoincide(categoria, r.categoria),
  );
}

export function colorParaBusquedaModelo(color: string | null | undefined): string[] {
  const norm = normalizarColorAccesorio(color);
  if (!norm) return [];
  const aliases = [norm];
  const alias =
    REGLAS_MECANISMO.aliasColorModelo[
      norm as keyof typeof REGLAS_MECANISMO.aliasColorModelo
    ];
  if (alias) aliases.push(alias);
  return aliases;
}
