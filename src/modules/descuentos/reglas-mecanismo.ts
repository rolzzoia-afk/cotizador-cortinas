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

/** Regla por ANCHO: fuerza mecanismo (y de paso el tubo) según el ancho. */
export type ReglaMecAncho = {
  /** Nota para quien edita las reglas; no afecta la lógica. */
  descripcion: string;
  categoria: string;
  /** Ancho mínimo (m) ESTRICTO: la regla aplica si ancho > anchoMinM. */
  anchoMinM: number;
  /** Ancho máximo (m) INCLUSIVE; sin tope si se omite. */
  anchoMaxM?: number;
  /** MEC fijo (ignora el color de accesorios). */
  mec?: number;
  /** MEC por color de accesorios (claves cortas y largas, como colorAMec).
   *  Un color SIN entrada (p.ej. gris en ROL) deja la elección manual. */
  mecPorColor?: Record<string, number>;
  /** MEC con que se busca la FILA del catálogo destino cuando difiere del kit
   *  mostrado. Dúo banda: el kit de bodega es el ovalada 39/38/12 (mecPorColor)
   *  pero la fila 45 mm del catálogo es MEC_18/23_OVALADA. Si se omite, la fila
   *  se busca con mecPorColor. */
  modeloMecPorColor?: Record<string, number>;
  /** Categoría cuyas filas del catálogo traen el modelo destino (cruce de
   *  catálogo, p.ej. DUO_MANUAL_38mm → filas de DUO_MANUAL_45mm). */
  categoriaModelo?: string;
  /** Código de tubo que la regla fija (filtro y nota de la UI). */
  tubo: string;
  /** Si true, la regla SOLO aplica cuando la OT tiene el tubo E78 activado
   *  (flag `usarTuboE78`). Con el flag apagado (default) la banda 2,2–3,0 m no
   *  sube a 45 mm y la cortina queda en 38 mm → tubo E66. La regla >3 m (MEC 28/
   *  E65) NO lo lleva: es estructural, no depende del E78. */
  requiereTuboE78?: boolean;
  /** Nota que ve el operario en Fase 2 cuando la regla está activa. */
  nota: string;
};

/**
 * Kits de bodega de cenefa ovalada por color de accesorios (39 blanco · 38
 * negro · 12 gris). Se usan en TODAS las cenefa ovalada, de 38 y de 45 mm
 * (tubo E78): desde 2026-07-15 la ovalada 45 mm ya NO usa los MEC 09/10 legacy
 * del Excel, sino este mismo kit que las roller y dúo 38 mm. Compartido por las
 * reglas de categoría (45 mm) y la banda dúo, y por el inventario (líneas de
 * tapas). Un color sin entrada (transparente, café…) deja el mecanismo manual.
 */
export const MEC_KIT_OVALADA_POR_COLOR: Record<string, number> = {
  BCO: 39,
  BLANCO: 39,
  NEG: 38,
  NEGRO: 38,
  GRS: 12,
  GRIS: 12,
};

export const REGLAS_MECANISMO = {
  /** Categorías que NO llevan mecanismo roller. */
  categoriasSinMecanismo: ['VERTICAL', 'BEEBLACK'] as const,

  /** Kits de inventario bodega — visibles en rollers estándar (Fase 2).
   *  32/33/34 simples · 40/41 reforzados (mismo tubo 38 mm) ·
   *  18/23 kits 45 mm (DECORELLI/ROLZZO, tubo E78 — banda 2,2–3,0 m). */
  kitsInventario: [32, 33, 34, 40, 41, 18, 23] as const,

  /**
   * MEC del Excel legacy que se reemplazan automáticamente por kits inventario
   * o por la regla de categoría correspondiente. (18/23 salieron de la lista
   * 2026-07-14: los kits 45 mm volvieron a ser de primera línea con el tubo E78.)
   */
  legacyReemplazar: [5, 6, 9, 10, 11, 13, 14, 28] as const,

  /**
   * Reglas por ANCHO: fuerzan un MEC según el ancho de la cortina, por encima
   * de la regla de color Y de la de categoría. Se evalúan EN ORDEN; gana la
   * primera cuyo rango y color calcen.
   *  · Roller simple sobre 3 m → kit 63 mm (MEC 28, tubo E65).
   *  · Banda 2,2–3,0 m (2026-07-14, tubo E78): ROL usa los kits 45 mm por color
   *    (blanco MEC 18 DECORELLI · negro MEC 23 ROLZZO; GRIS queda manual porque
   *    no hay kit 45 gris). El dúo manual pasa a los kits ovalada 45 del
   *    catálogo dúo (blanco/gris MEC 18 · negro MEC 23).
   */
  reglasAncho: [
    {
      descripcion: 'Roller simple sobre 3,0 m → MEC 28 (fila 63 mm, tubo E65)',
      categoria: 'ROL',
      anchoMinM: 3.0,
      mec: 28,
      tubo: 'E65',
      nota: 'Fijo por ancho >3 m: mecanismo y tubo de 63 mm (MEC 28 · E65). Un kit de 38 mm no aguanta esa luz.',
    },
    {
      descripcion: 'Roller simple 2,2–3,0 m → kit 45 mm por color (tubo E78); gris queda manual',
      categoria: 'ROL',
      anchoMinM: 2.2,
      anchoMaxM: 3.0,
      mecPorColor: { BCO: 18, BLANCO: 18, NEG: 23, NEGRO: 23 },
      tubo: 'E78',
      requiereTuboE78: true,
      nota: 'Fijo por ancho 2,2–3,0 m: kit 45 mm por color y tubo E78. Con accesorios grises la elección queda manual.',
    },
    {
      descripcion: 'Dúo manual 38 mm de 2,2–3,0 m → kit ovalada de bodega por color (tubo E78)',
      categoria: 'DUO_MANUAL_38mm',
      anchoMinM: 2.2,
      anchoMaxM: 3.0,
      // El KIT que se muestra/entrega es el ovalada de bodega (39/38/12), igual
      // que en 38 mm; la FILA 45 mm del catálogo sigue siendo MEC_18/23_OVALADA
      // (por eso modeloMecPorColor). Antes se mostraba MEC 18/23 (2026-07-15).
      mecPorColor: MEC_KIT_OVALADA_POR_COLOR,
      modeloMecPorColor: { BCO: 18, BLANCO: 18, GRS: 18, GRIS: 18, NEG: 23, NEGRO: 23 },
      categoriaModelo: 'DUO_MANUAL_45mm',
      tubo: 'E78',
      requiereTuboE78: true,
      nota: 'Fijo por ancho 2,2–3,0 m: kit ovalada de bodega por color y tubo E78.',
    },
    {
      descripcion: 'Cenefa ovalada roller 38 mm de 2,2–3,0 m → fila 45 mm por color (tubo E78); gris queda en 38 mm',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      anchoMinM: 2.2,
      anchoMaxM: 3.0,
      // Igual que el dúo banda: el KIT mostrado/entregado es el ovalada de bodega
      // (39 blanco / 38 negro), pero la FILA 45 mm del catálogo ovalada roller es
      // MEC_10_OVALADA_BLANCO / MEC_09_OVALADA_NEGRO (verificado en descuentos_modelo).
      // Gris NO tiene entrada → no sube: queda en 38 mm/E66 con su kit ovalada gris.
      mecPorColor: { BCO: 39, BLANCO: 39, NEG: 38, NEGRO: 38 },
      modeloMecPorColor: { BCO: 10, BLANCO: 10, NEG: 9, NEGRO: 9 },
      categoriaModelo: 'ROL_MANUAL_CENEFA_OVALADA_45mm',
      tubo: 'E78',
      requiereTuboE78: true,
      nota: 'Fijo por ancho 2,2–3,0 m (Tubo E78 activado): fila cenefa ovalada 45 mm y tubo E78. Con accesorios grises queda en 38 mm.',
    },
  ] as readonly ReglaMecAncho[],

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
    // Soft light lleva cenefa ovalada → mismos kits ovalada de bodega que la dúo
    // (MEC 39 blanco / MEC 38 negro). Soft light no se vende en gris. Antes el
    // negro caía al kit simple 32/34; ahora usa el ovalada como el resto.
    {
      descripcion: 'Soft light 38 mm con accesorios negros → MEC 38 ovalada',
      categoria: 'SOFT_LIGHT_38mm',
      mec: 38,
      codigoInventario: 'MEC_38_OVALADA_NEGRO',
      colores: ['NEG', 'NEGRO'],
    },
    {
      descripcion: 'Soft light 45 mm con accesorios blancos → MEC 39 ovalada',
      categoria: 'SOFT_LIGHT_45mm',
      mec: 39,
      codigoInventario: 'MEC_39_OVALADA_BLANCO',
      colores: ['BCO', 'BLANCO'],
    },
    {
      descripcion: 'Soft light 45 mm con accesorios negros → MEC 38 ovalada',
      categoria: 'SOFT_LIGHT_45mm',
      mec: 38,
      codigoInventario: 'MEC_38_OVALADA_NEGRO',
      colores: ['NEG', 'NEGRO'],
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
    // Dúo manual 45 mm (tubo E78, banda 2,2–3,0 m elegida directamente o cortina
    // 45 mm nativa): mismo kit ovalada de bodega que la de 38 mm — 2026-07-15 ya
    // NO usa MEC 09/10 legacy ni el kit simple 32/33/34.
    {
      descripcion: 'Dúo manual 45 mm con accesorios blancos → MEC 39 ovalada',
      categoria: 'DUO_MANUAL_45mm',
      mec: 39,
      codigoInventario: 'MEC_39_OVALADA_BLANCO',
      colores: ['BCO', 'BLANCO'],
    },
    {
      descripcion: 'Dúo manual 45 mm con accesorios negros → MEC 38 ovalada',
      categoria: 'DUO_MANUAL_45mm',
      mec: 38,
      codigoInventario: 'MEC_38_OVALADA_NEGRO',
      colores: ['NEG', 'NEGRO'],
    },
    {
      descripcion: 'Dúo manual 45 mm con accesorios grises → MEC 12 ovalada',
      categoria: 'DUO_MANUAL_45mm',
      mec: 12,
      codigoInventario: 'MEC_12_OVALADA_GRIS',
      colores: ['GRS', 'GRIS'],
    },
    // Roller manual con cenefa ovalada: misma familia de kits ovalada que la dúo
    // (confirmado 2026-07-07). Los motorizados no entran (el motor reemplaza al
    // mecanismo). Desde 2026-07-15 el 45 mm (tubo E78) usa el MISMO kit ovalada
    // de bodega que el 38 mm — antes caía al kit simple 32/33/34.
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
    {
      descripcion: 'Roller manual cenefa ovalada 45 mm blanco → MEC 39 ovalada',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_45mm',
      mec: 39,
      codigoInventario: 'MEC_39_OVALADA_BLANCO',
      colores: ['BCO', 'BLANCO'],
    },
    {
      descripcion: 'Roller manual cenefa ovalada 45 mm negro → MEC 38 ovalada',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_45mm',
      mec: 38,
      codigoInventario: 'MEC_38_OVALADA_NEGRO',
      colores: ['NEG', 'NEGRO'],
    },
    {
      descripcion: 'Roller manual cenefa ovalada 45 mm gris → MEC 12 ovalada',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_45mm',
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

/** ¿La categoría es pletina (velcro, sin tubo)? PLETINA_ROLLER_V / PLETINA_DUO_V.
 *  Vive acá (leaf puro) para poder usarse tanto en chips.ts como en el cotizador
 *  (insumosCortina, tela, excel-ordenes…) sin ciclos de import. */
export function esCategoriaPletina(categoria: string | null | undefined): boolean {
  return (categoria || '').toUpperCase().includes('PLETINA');
}

/** ¿La categoría es VERTICAL (cortina de lamas)? Sin tubo ni mecanismo roller:
 *  su estructura es perfil cabezal + varilla + carritos. Leaf puro, igual que
 *  `esCategoriaPletina`, para usarse desde el cotizador sin ciclos de import. */
export function esCategoriaVertical(categoria: string | null | undefined): boolean {
  return (categoria || '').trim().toUpperCase() === 'VERTICAL';
}

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

/**
 * Regla de ANCHO que aplica para la categoría/ancho/color, con su MEC ya
 * resuelto, o null. Un color sin entrada en mecPorColor (gris en ROL) NO
 * activa la regla: la elección queda manual.
 */
export function reglaAnchoAplicable(
  categoria: string,
  anchoM: number,
  color?: string | null,
  usarTuboE78 = false,
): { regla: ReglaMecAncho; mec: number } | null {
  const c = normalizarCategoria(categoria);
  for (const r of REGLAS_MECANISMO.reglasAncho) {
    if (c !== r.categoria.toUpperCase()) continue;
    // Las reglas de banda 2,2–3,0 m (tubo E78) solo aplican si la OT lo activó.
    if (r.requiereTuboE78 && !usarTuboE78) continue;
    if (!(anchoM > r.anchoMinM)) continue;
    if (r.anchoMaxM != null && anchoM > r.anchoMaxM) continue;
    if (r.mec != null) return { regla: r, mec: r.mec };
    const mc = r.mecPorColor?.[normalizarColorAccesorio(color)];
    if (mc != null) return { regla: r, mec: mc };
  }
  return null;
}

/** Número MEC forzado por ANCHO (>3 m → MEC 28 · banda 2,2–3,0 → kit 45), o null. */
export function mecPorAncho(
  categoria: string,
  anchoM: number,
  color?: string | null,
  usarTuboE78 = false,
): number | null {
  return reglaAnchoAplicable(categoria, anchoM, color, usarTuboE78)?.mec ?? null;
}

/**
 * true si el color tiene regla de banda por color en la categoría (blanco/negro
 * en ROL; todos en dúo manual). Decide si un modelo 45 mm se REVIERTE a 38 al
 * salir de la banda: con regla = fue automático y vuelve; sin regla (gris ROL)
 * = fue elección manual y se respeta.
 */
export function colorConBandaAncho(categoria: string, color?: string | null): boolean {
  const c = normalizarCategoria(categoria);
  const col = normalizarColorAccesorio(color);
  return REGLAS_MECANISMO.reglasAncho.some(
    (r) => c === r.categoria.toUpperCase() && r.mecPorColor?.[col] != null,
  );
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
