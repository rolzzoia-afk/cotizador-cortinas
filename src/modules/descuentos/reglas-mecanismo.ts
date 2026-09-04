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
// Todo MEC que una regla nombre debe existir en el catálogo `mecanismos`
// (fase2.ts deriva de ahí OPCIONES_MECANISMO); el editor de Admin lo valida.
// Tuberías: ver reglas-tuberia.ts
//
// Estas tablas son los VALORES DE FÁBRICA. Admin → Catálogo técnico puede
// editarlas y guardarlas en configuracion.reglas_seleccion; desde ahí viajan
// por parámetro opcional (ver reglasSeleccion.ts). Sin nada guardado, todas
// las funciones de este módulo usan exactamente estos defaults.
// ─────────────────────────────────────────────────────────────────────

import { categoriaEfectiva, type TipoCortina } from './tiposCortina';
// `reglas-beeblack` es leaf (sin imports): se puede traer acá sin ciclo.
import { esCategoriaBeeblack, esCodigoBeeblack } from './reglas-beeblack';

/**
 * Coincidencia de categoría (case insensitive): exacta, substring o prefijo.
 *
 * `empiezaCon` no es un lujo: la regla del dúo para la cadena es "la categoría
 * EMPIEZA con DUO" — con `includes` se llevaría por delante a PLETINA_DUO_V,
 * que usa la escalera por alto como cualquier roller.
 */
export type MatchCategoria = string | { includes: string } | { empiezaCon: string };

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
 * Regla de la LÍNEA B (gama económica). Es una tabla aparte de `reglasCategoria`
 * porque la línea B no es un tipo de cortina distinto: es la MISMA cortina
 * (roller simple, cenefa ovalada, dúo) fabricada con otro juego de herrajes.
 * Solo hay receta en blanco y negro; un color sin entrada NO cae a los kits de
 * la línea A — queda sin kit y el gate de Fase 2 bloquea la OT.
 */
export type ReglaMecLineaB = {
  /** Nota para quien edita las reglas; no afecta la lógica. */
  descripcion: string;
  categoria: MatchCategoria;
  /** MEC por color de accesorios (claves cortas y largas, como colorAMec). */
  mecPorColor: Record<string, number>;
  /** MEC que el operario puede elegir a mano además del default de su color.
   *  Roller simple blanco: MEC 06 por defecto, MEC 44 como alternativa. */
  kitsManualesPorColor?: Record<string, readonly number[]>;
};

/** Bloque completo de la línea B dentro de las reglas de mecanismo. */
export type ReglasMecanismoLineaB = {
  reglas: readonly ReglaMecLineaB[];
  /** MEC cuyo código de bodega NO es `MEC<nn>` (los de la línea B llevan
   *  sufijo: MEC44-B, MEC45-B). Lo usa el inventario para que la línea calce
   *  con la tabla `insumos`. */
  codigoInsumoPorMec: Record<number, string>;
};

/**
 * Estado de un ítem del catálogo (tubo o mecanismo):
 *  · activo  → se ofrece en el selector de Fase 2.
 *  · oculto  → ya no se ofrece, pero se sigue RESOLVIENDO (OTs viejas que lo
 *              tienen guardado conservan su chip en PDFs e inventario).
 *  · opt_in  → se ofrece solo cuando la OT tiene el tubo E78 activado.
 * Hoy el único opt-in real es el E78, y quien lo pide es la REGLA de banda
 * (`requiereTuboE78`), no el tubo. Si algún día hace falta un segundo toggle,
 * la migración es `datosGenerales.togglesOT?: Record<string, boolean>` leyendo
 * `?? usarTuboE78` para la clave 'E78'.
 */
export type EstadoCatalogo = 'activo' | 'oculto' | 'opt_in';

/** Chip de mecanismo del catálogo editable. */
export type MecanismoCatalogo = {
  /** Chip EXACTO como se guarda en la OT. Debe traer '[MEC n]' salvo VELCRO. */
  chip: string;
  estado: EstadoCatalogo;
};

/**
 * Mecanismos DUAL (producto dúo día/noche con dos rollers en un bracket).
 * NO son editables desde Admin: el chip se deriva de lado × color por lógica
 * (ver DUAL_LADO_COLOR_A_MEC en chips.ts), no de una tabla de datos.
 * Formato cero-padded [MEC 01] para que modeloDesdeChipMecanismo encuentre el
 * modelo ROLLER_DUAL 'MEC_01_DUAL_…' en el catálogo (descuentos_modelo).
 */
export const MECANISMOS_DUAL = [
  'DUAL DERECHO BLANCO [MEC 01]',
  'DUAL IZQUIERDO BLANCO [MEC 02]',
  'DUAL DERECHO NEGRO [MEC 03]',
  'DUAL IZQUIERDO NEGRO [MEC 04]',
  'DUAL MIXTO BLANCO [MEC 19]',
  'DUAL MIXTO NEGRO [MEC 20]',
  'DUAL DERECHO GRIS [MEC 24]',
  'DUAL IZQUIERDO GRIS [MEC 25]',
] as const;

/** Forma completa de las reglas de mecanismo (lo que Admin puede editar). */
export type ReglasMecanismo = {
  categoriasSinMecanismo: readonly string[];
  kitsInventario: readonly number[];
  legacyReemplazar: readonly number[];
  reglasAncho: readonly ReglaMecAncho[];
  colorAMec: Record<string, number>;
  /** Kits REFORZADOS por color (misma familia que colorAMec, otra línea de
   *  bodega). Vive aparte para que un cambio de color de accesorios recoloree
   *  el kit SIN degradar un reforzado a simple — ver `mecRecoloreado`. */
  colorAMecReforzado: Record<string, number>;
  aliasColorModelo: Record<string, string>;
  reglasCategoria: readonly ReglaMecCategoria[];
  /** Catálogo de chips no-duales: los de UI + los ocultos (legacy). */
  mecanismos: readonly MecanismoCatalogo[];
  /** Banda del tubo E78 para la oscuridad 38 mm (SOFT LIGHT y DARK): dentro de
   *  ella el modelo sube a 45 mm. Es un swap de MODELO, no de kit, por eso no
   *  vive en reglasAncho. */
  bandaOscuridadE78: { anchoMinM: number; anchoMaxM: number };
  /** Kit de bodega de cenefa ovalada por color (ver MEC_KIT_OVALADA_POR_COLOR). */
  kitOvaladaPorColor: Record<string, number>;
  /** LÍNEA B (gama económica) — ver ReglasMecanismoLineaB. */
  lineaB: ReglasMecanismoLineaB;
};

/**
 * Kits de bodega de cenefa ovalada por color de accesorios (39 blanco · 38
 * negro · 12 gris). Se usan en TODAS las cenefa ovalada, de 38 y de 45 mm
 * (tubo E39): desde 2026-07-15 la ovalada 45 mm ya NO usa los MEC 09/10 legacy
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
   *  · Banda 2,2–3,0 m (2026-07-14, tubo E39): ROL usa los kits 45 mm por color
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
      descripcion: 'Roller simple 2,2–3,0 m → kit 45 mm por color (tubo E39); gris queda manual',
      categoria: 'ROL',
      anchoMinM: 2.2,
      anchoMaxM: 3.0,
      mecPorColor: { BCO: 18, BLANCO: 18, NEG: 23, NEGRO: 23 },
      tubo: 'E39',
      requiereTuboE78: true,
      nota: 'Fijo por ancho 2,2–3,0 m: kit 45 mm por color y tubo E39. Con accesorios grises la elección queda manual.',
    },
    {
      descripcion: 'Dúo manual 38 mm de 2,2–3,0 m → kit ovalada de bodega por color (tubo E39)',
      categoria: 'DUO_MANUAL_38mm',
      anchoMinM: 2.2,
      anchoMaxM: 3.0,
      // El KIT que se muestra/entrega es el ovalada de bodega (39/38/12), igual
      // que en 38 mm; la FILA 45 mm del catálogo sigue siendo MEC_18/23_OVALADA
      // (por eso modeloMecPorColor). Antes se mostraba MEC 18/23 (2026-07-15).
      mecPorColor: MEC_KIT_OVALADA_POR_COLOR,
      modeloMecPorColor: { BCO: 18, BLANCO: 18, GRS: 18, GRIS: 18, NEG: 23, NEGRO: 23 },
      categoriaModelo: 'DUO_MANUAL_45mm',
      tubo: 'E39',
      requiereTuboE78: true,
      nota: 'Fijo por ancho 2,2–3,0 m: kit ovalada de bodega por color y tubo E39.',
    },
    {
      descripcion: 'Cenefa ovalada roller 38 mm de 2,2–3,0 m → fila 45 mm por color (tubo E39); gris queda en 38 mm',
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
      tubo: 'E39',
      requiereTuboE78: true,
      nota: 'Fijo por ancho 2,2–3,0 m (Tubo E39 activado): fila cenefa ovalada 45 mm y tubo E39. Con accesorios grises queda en 38 mm.',
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

  /** Mapeo color accesorios → kit REFORZADO (misma familia, otra línea de
   *  bodega). No hay reforzado gris: un reforzado en GRS se conserva tal cual
   *  en vez de degradarse al kit simple. */
  colorAMecReforzado: {
    BCO: 41,
    BLANCO: 41,
    NEG: 40,
    NEGRO: 40,
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
    // mecanismo). Desde 2026-07-15 el 45 mm (tubo E39) usa el MISMO kit ovalada
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

  /**
   * Catálogo de chips de mecanismo (sin los duales, que son lógica). El ORDEN
   * es el del selector de Fase 2. Los 'oculto' ya no se ofrecen —al guardar,
   * legacyReemplazar los cambia por kits de inventario— pero siguen en la lista
   * de RESOLUCIÓN para que OTs viejas con estos chips guardados (o modelos
   * MEC_XX cuyo color no mapea a kit, p.ej. TRANSPARENTE) sigan mostrando su
   * mecanismo en PDFs e inventario.
   */
  mecanismos: [
    // Inventario bodega (default por color de accesorios — ver colorAMec).
    { chip: 'KIT SIMPLE NEGRO 38MM [MEC 32]', estado: 'activo' },
    { chip: 'KIT SIMPLE BLANCO 38MM [MEC 33]', estado: 'activo' },
    { chip: 'KIT SIMPLE GRIS 38MM [MEC 34]', estado: 'activo' },
    // Kits reforzados (mismo tubo 38 mm; inventario MEC 40/41 - ROLZZO).
    { chip: 'KIT REFORZADO NEGRO 38MM [MEC 40]', estado: 'activo' },
    { chip: 'KIT REFORZADO BLANCO 38MM [MEC 41]', estado: 'activo' },
    // Kits bodega de cenefa ovalada por color (Dúo manual 38 / Soft Light 38 /
    // Roller cenefa ovalada 38). Nemotécnicos de inventario: MECANISMO OVALADO
    // GRIS/NEGRO/BLANCO - ROLZZO.
    { chip: 'OVALADA GRIS [MEC 12]', estado: 'activo' },
    { chip: 'OVALADA NEGRO [MEC 38]', estado: 'activo' },
    { chip: 'OVALADA BLANCO [MEC 39]', estado: 'activo' },
    // Kits 45 mm (tubo E39) — banda 2,2–3,0 m por color y elección manual
    // (2026-07-14; antes eran legacy). MEC 18 DECORELLI · MEC 23 ROLZZO.
    { chip: '0,45mm BCO [MEC 18]', estado: 'activo' },
    { chip: '0,45mm NGR [MEC 23]', estado: 'activo' },
    // Fijo de Oscuranti 63 mm (regla de categoría).
    { chip: '0,63mm BCO [MEC 28]', estado: 'activo' },
    // Pletina (velcro): sin kit de mecanismo. Solo se ofrece en categorías
    // pletina (opcionesMecanismoFiltradas) y NO emite insumo en el inventario.
    { chip: 'VELCRO', estado: 'activo' },
    // Chips MEC legacy del Excel (MEC 18/23 pasaron a la lista de UI 2026-07-14,
    // junto con el tubo E39).
    { chip: 'LZ 38 MERG BCO [MEC 05]', estado: 'oculto' },
    { chip: 'OVALADA NEG [MEC 09]', estado: 'oculto' },
    { chip: 'OVALADA BCO [MEC 10]', estado: 'oculto' },
    { chip: 'LZ50 MERG BCO [MEC 06]', estado: 'oculto' },
    { chip: 'LZ50 SFLX NGR [MEC 11]', estado: 'oculto' },
    { chip: 'LZ50 SFLX GRIS [MEC 13]', estado: 'oculto' },
    { chip: 'LZ50 SFLX BCO [MEC 14]', estado: 'oculto' },
    // LÍNEA B (gama económica). Ocultos: no se ofrecen en una cortina normal;
    // los elige la rama de línea B, que además arma su propio selector.
    // MEC 06 (arriba) es el default del roller simple blanco B.
    { chip: 'LZ50 PEQUEÑO NGR CAT.B [MEC 15]', estado: 'oculto' },
    { chip: 'OVALADA BCO CAT.B [MEC 37]', estado: 'oculto' },
    { chip: 'ROLLER BCO CAT.B [MEC 44]', estado: 'oculto' },
    { chip: 'OVALADA NGR CAT.B [MEC 45]', estado: 'oculto' },
  ] as readonly MecanismoCatalogo[],

  /**
   * Banda del tubo E78 en la oscuridad 38 mm (SOFT LIGHT y DARK): con el toggle
   * de la OT activado, un ancho dentro de la banda sube el MODELO a 45 mm
   * (mismo sistema, tipo_rol "38mm"→"45mm"). Va aparte de reglasAncho porque
   * esas cortinas no traen mecanismo: el swap es por sistema/tipo_rol.
   */
  bandaOscuridadE78: { anchoMinM: 2.2, anchoMaxM: 3.0 },

  /** Kit ovalada de bodega por color — ver MEC_KIT_OVALADA_POR_COLOR. */
  kitOvaladaPorColor: MEC_KIT_OVALADA_POR_COLOR,

  /**
   * LÍNEA B — gama económica (pizarra 2026-08-07). Herrajes propios: kits
   * MEC 06/15/37/44/45, tubo E01, pesos E40/E69-B, cenefas E60/E72-B y, en dúo,
   * peso U E25/E70-B + peso interno E79-B/E71-B.
   *
   * Solo existe receta en BLANCO y NEGRO. Un color sin entrada (gris, café…)
   * NO cae a los kits de la línea A: se queda sin kit y `pendientesFase2`
   * bloquea la OT pidiendo blanco/negro o forzar la línea A.
   *
   * La cenefa ovalada comparte kit entre roller y dúo, igual que en la línea A.
   */
  lineaB: {
    reglas: [
      {
        descripcion: 'Roller simple B — MEC 06 blanco (default) · MEC 15 negro',
        categoria: 'ROL',
        mecPorColor: { BCO: 6, BLANCO: 6, NEG: 15, NEGRO: 15 },
        // El blanco tiene dos herrajes en la pizarra: LZ50 (MEC 06, tubo −3,8)
        // y el kit roller CAT.B (MEC 44, tubo −3,4). El operario elige.
        kitsManualesPorColor: { BCO: [44], BLANCO: [44] },
      },
      {
        descripcion: 'Roller cenefa ovalada 38 B — MEC 37 blanco · MEC 45 negro',
        categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
        mecPorColor: { BCO: 37, BLANCO: 37, NEG: 45, NEGRO: 45 },
      },
      {
        descripcion: 'Dúo cenefa ovalada 38 B — MEC 37 blanco · MEC 45 negro',
        categoria: 'DUO_MANUAL_38mm',
        mecPorColor: { BCO: 37, BLANCO: 37, NEG: 45, NEGRO: 45 },
      },
    ] as readonly ReglaMecLineaB[],

    /** Los kits B de bodega llevan sufijo; el resto es MEC<nn> como siempre. */
    codigoInsumoPorMec: { 44: 'MEC44-B', 45: 'MEC45-B' } as Record<number, string>,
  },
} as const satisfies ReglasMecanismo;

// ── Derivaciones del catálogo de mecanismos ──────────────────────────
// fase2.ts re-exporta estas listas con sus nombres históricos
// (OPCIONES_MECANISMO, CHIPS_MECANISMO_LEGACY, OPCIONES_MECANISMO_RESOLUCION).

/** Chips que se OFRECEN en Fase 2 (activos + opt-in si la OT lo habilitó). */
export function opcionesMecanismoUI(
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  usarTuboE78 = false,
): readonly string[] {
  return reglas.mecanismos
    .filter((m) => m.estado === 'activo' || (m.estado === 'opt_in' && usarTuboE78))
    .map((m) => m.chip);
}

/** Chips que ya no se ofrecen pero se siguen resolviendo (legacy guardados). */
export function chipsMecanismoOcultos(
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): readonly string[] {
  return reglas.mecanismos.filter((m) => m.estado === 'oculto').map((m) => m.chip);
}

/**
 * Lista completa para RESOLVER mecanismos: todo lo del catálogo (incluidos los
 * ocultos y los opt-in) + los duales. Los contextos de CÁLCULO (BOM, inventario,
 * PDFs) usan SIEMPRE esta, nunca la de UI: un chip retirado tiene que seguir
 * resolviendo las OTs que lo guardaron.
 */
export function opcionesMecanismoResolucion(
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): readonly string[] {
  const ofrecidos = reglas.mecanismos
    .filter((m) => m.estado !== 'oculto')
    .map((m) => m.chip);
  return [...ofrecidos, ...MECANISMOS_DUAL, ...chipsMecanismoOcultos(reglas)];
}

// ── Helpers de normalización ─────────────────────────────────────────

/** Extrae el número MEC de un chip, ej. '… [MEC 33]' → 33. Vive acá (leaf puro)
 *  para que el validador de reglas pueda usarlo sin depender de chips.ts. */
export function numeroMecDeChip(chip: string | null | undefined): number | null {
  const m = (chip || '').toUpperCase().match(/\[MEC (\d+)\]/);
  return m ? parseInt(m[1], 10) : null;
}

/** Kits que TRAEN la cadena incorporada: no se les asigna cadena aparte (ni
 *  código, ni largo, ni línea en el BOM/inventario). Hoy solo el MEC 06
 *  (LZ50 blanco del roller simple categoría B) — confirmado 2026-08-14.
 *  El peso de cadena SÍ va (la cadena del kit no trae el suyo). */
export const KITS_CON_CADENA_INCORPORADA: ReadonlySet<number> = new Set([6]);

/** ¿El chip de mecanismo del paño es un kit con cadena incorporada? */
export function kitTraeCadenaIncorporada(chipMecanismo: string | null | undefined): boolean {
  const n = numeroMecDeChip(chipMecanismo);
  return n !== null && KITS_CON_CADENA_INCORPORADA.has(n);
}

/**
 * Plurales, femeninos y erratas que las vendedoras teclean en la columna COLOR
 * ACCESORIOS de Fase 1 («NEGROS», «BLANCAS», «GRISE»). Nombran el mismo color,
 * así que se pliegan al nombre de fábrica ANTES de cualquier comparación; sin
 * esto «NEGROS» no calzaba con ninguna regla y el kit, la cadena, el peso y las
 * tapas salían del color por defecto (blanco). Solo los cinco colores de
 * fábrica: un color dado de alta en Admin pasa tal cual.
 */
const VARIANTES_COLOR_ACCESORIO: Readonly<Record<string, string>> = {
  NEGROS: 'NEGRO',
  NEGRA: 'NEGRO',
  NEGRAS: 'NEGRO',
  BLANCOS: 'BLANCO',
  BLANCA: 'BLANCO',
  BLANCAS: 'BLANCO',
  GRISES: 'GRIS',
  GRISE: 'GRIS',
  CAFE: 'CAFÉ',
  CAFES: 'CAFÉ',
  CAFÉS: 'CAFÉ',
};

/**
 * Color de accesorios listo para comparar: mayúsculas, sin espacios y con las
 * variantes tecleadas plegadas a su nombre de fábrica (ver
 * `VARIANTES_COLOR_ACCESORIO`). Las formas corta y larga («NEG»/«NEGRO») se
 * conservan tal cual: las tablas de reglas nombran las dos.
 */
export function normalizarColorAccesorio(color: string | null | undefined): string {
  const c = (color || '').toUpperCase().trim();
  return VARIANTES_COLOR_ACCESORIO[c] ?? c;
}

function normalizarCategoria(categoria: string): string {
  return (categoria || '').trim().toUpperCase();
}

export function categoriaCoincide(categoria: string, match: MatchCategoria): boolean {
  const c = normalizarCategoria(categoria);
  if (typeof match === 'string') return c === match.toUpperCase();
  if ('empiezaCon' in match) return c.startsWith(match.empiezaCon.toUpperCase());
  return c.includes(match.includes.toUpperCase());
}

/** La categoría de una regla en palabras, para el editor de Admin. */
export function textoCategoria(match: MatchCategoria): string {
  if (typeof match === 'string') return match;
  if ('empiezaCon' in match) return match.empiezaCon;
  return match.includes;
}

/** Texto de la categoría con su modo ("contiene «DUO»"), para columnas informativas. */
export function textoCategoriaConModo(match: MatchCategoria): string {
  if (typeof match === 'string') return match;
  if ('empiezaCon' in match) return `empieza con «${match.empiezaCon}»`;
  return `contiene «${match.includes}»`;
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
export function esCategoriaPletina(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): boolean {
  return categoriaEfectiva(categoria, tipos).toUpperCase().includes('PLETINA');
}

/** ¿La categoría es VERTICAL (cortina de lamas)? Sin tubo ni mecanismo roller:
 *  su estructura es perfil cabezal + varilla + carritos. Leaf puro, igual que
 *  `esCategoriaPletina`, para usarse desde el cotizador sin ciclos de import. */
export function esCategoriaVertical(categoria: string | null | undefined): boolean {
  return (categoria || '').trim().toUpperCase() === 'VERTICAL';
}

/**
 * ¿La categoría lleva CADENA DE ROLLER (cadena + peso de cadena)?
 *
 * No la llevan tres sistemas, cada uno por su motivo:
 *   · VERTICAL — tiene la suya (CAD04/CAD06 de 3 m + peso VER), por otro camino.
 *   · BEEBLACK — corre de lado con manilla, no con cadena.
 *   · PLETINA (velcro) — es un paño FIJO pegado con velcro: no sube ni baja,
 *     así que no hay cadena, ni peso de cadena, ni lado de accionamiento.
 *
 * Una categoría VACÍA devuelve `true` a propósito: una fila sin ventana asociada
 * es un roller normal. Por eso el gate es por nombre y no por
 * `categoriaRequiereMecanismo` (que da false para categoría vacía) — si no,
 * cualquier paño con `colorPeso` (que `fase0-sync` rellena a TODOS) emitía un
 * "Peso de cadena · BCO" sin código.
 */
export function categoriaLlevaCadenaRoller(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): boolean {
  return (
    !esCategoriaVertical(categoria) &&
    !esCategoriaBeeblack(categoria) &&
    !esCategoriaPletina(categoria, tipos)
  );
}

/**
 * ¿La categoría lleva CADENA DE MANDO, sea roller o vertical?
 *
 * Es el gate del botón «cadena metálica» de Fase 1 y del checkbox de Fase 2:
 * las verticales también se accionan con cadena (la suya, CAD04/CAD06), así que
 * entran; las que no llevan ninguna quedan fuera — beeblack (manilla), pletina
 * (paño fijo) y las categorías vendidas con MOTOR, donde la cadena se suprime.
 */
export function categoriaLlevaCadenaMando(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): boolean {
  const c = categoriaEfectiva(categoria, tipos).toUpperCase();
  if (c.includes('MOTOR')) return false;
  return categoriaLlevaCadenaRoller(categoria, tipos) || esCategoriaVertical(categoria);
}

/** Lo mínimo que hay que saber de una fila para decidir si lleva cadena de mando. */
export type FilaCadenaLike = {
  categoria?: string | null;
  /** COD_INT de la tela («BEE-BK», «SC 65»). */
  codInt?: string | null;
  /** COD de familia del catálogo («BEE_BK», «BEE_MOSQ»). */
  cod?: string | null;
};

/**
 * El gate del botón «cadena metálica» POR FILA.
 *
 * En Fase 1 la fila nace sin categoría (la columna CATEGORÍA solo se dibuja en
 * Fase 3), y `categoriaLlevaCadenaMando('')` devuelve `true` a propósito —una
 * fila sin ventana es un roller normal—, así que un beeblack quedaba con el
 * botón vivo. El CÓDIGO es lo único que hay ahí, y es además por donde el motor
 * reconoce el sistema (`sistemaDeFamilia`, FAMILIAS_BEEBLACK): por eso manda.
 */
export function filaLlevaCadenaMando(
  f: FilaCadenaLike,
  tipos?: readonly TipoCortina[],
): boolean {
  if (esCodigoBeeblack(f.codInt) || esCodigoBeeblack(f.cod)) return false;
  return categoriaLlevaCadenaMando(f.categoria, tipos);
}

export function categoriaRequiereMecanismo(
  categoria: string,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): boolean {
  const c = normalizarCategoria(categoria);
  if (!c) return false;
  return !reglas.categoriasSinMecanismo.some((sin) => c === sin.toUpperCase());
}

export function numeroMecPorColor(
  color: string | null | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): number | null {
  const norm = normalizarColorAccesorio(color);
  return reglas.colorAMec[norm] ?? null;
}

export function esKitInventarioMec(
  num: number,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): boolean {
  return reglas.kitsInventario.includes(num);
}

/**
 * Kits de 45 mm del roller simple: MEC 18 (DECORELLI blanco) y MEC 23 (ROLZZO
 * negro). Son los ÚNICOS que calzan en un tubo Ø45 (E39/E05): un kit de 38 no
 * entra en ese tubo. No existe kit 45 gris ni café: van al negro (decisión del
 * usuario 2026-07-31 para el DARK 45, y la misma acá).
 */
export const MECS_KIT_45: readonly number[] = [18, 23];

export function esKit45(num: number | null | undefined): boolean {
  return num != null && MECS_KIT_45.includes(num);
}

/** Kit de 45 mm por color de accesorios: blanco → MEC 18, el resto → MEC 23. */
export function mecKit45PorColor(color: string | null | undefined): number {
  return normalizarColorAccesorio(color).startsWith('B') ? 18 : 23;
}

/**
 * El MISMO kit en otro color de accesorios, o null si no corresponde cambiarlo.
 *
 * Al cambiar el color en Fase 1 o Fase 2 el kit debe seguir al color igual que
 * la cadena, pero conservando la FAMILIA: un reforzado blanco pasa a reforzado
 * negro, no al kit simple. Cada familia es un mapa color → MEC; si el kit
 * guardado no pertenece a ninguna (kits 45 mm, ovalada, duales) o la familia no
 * tiene ese color (no existe reforzado gris), devuelve null = conservar.
 *
 * Los kits 45 mm (18/23) quedan FUERA a propósito: dentro de la banda 2,2–3,0 m
 * ya los recolorea la regla por ancho (`mecPorColor`), y fuera de la banda un
 * kit 45 es elección manual (gris) que se respeta.
 */
export function mecRecoloreado(
  num: number,
  color: string | null | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): number | null {
  const norm = normalizarColorAccesorio(color);
  for (const familia of [reglas.colorAMec, reglas.colorAMecReforzado]) {
    if (!Object.values(familia).includes(num)) continue;
    const destino = familia[norm];
    return destino != null && destino !== num ? destino : null;
  }
  return null;
}

export function esMecLegacy(
  num: number,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): boolean {
  return reglas.legacyReemplazar.includes(num);
}

// ── LÍNEA B ────────────────────────────────────────────────────────────

/** Primera regla de línea B que aplica a la categoría dada (con tipos propios). */
export function reglaLineaBAplicable(
  categoria: string,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
): ReglaMecLineaB | null {
  const efectiva = categoriaEfectiva(categoria, tipos);
  for (const regla of reglas.lineaB.reglas) {
    if (categoriaCoincide(efectiva, regla.categoria)) return regla;
  }
  return null;
}

/**
 * Kit de la línea B para esta categoría y color, o null si no hay receta.
 * `null` es una respuesta legítima y significativa: la línea B solo existe en
 * blanco y negro, y quien llama NO debe caer a los kits de la línea A (el gate
 * de Fase 2 bloquea la OT hasta que se corrija el color o se fuerce la línea A).
 */
export function mecLineaB(
  categoria: string,
  color: string | null | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
): number | null {
  const regla = reglaLineaBAplicable(categoria, reglas, tipos);
  if (!regla) return null;
  return regla.mecPorColor[normalizarColorAccesorio(color)] ?? null;
}

/** Kits de línea B que el operario puede elegir para esta categoría y color:
 *  el default primero, luego las alternativas de la pizarra. */
export function kitsLineaB(
  categoria: string,
  color: string | null | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
): readonly number[] {
  const regla = reglaLineaBAplicable(categoria, reglas, tipos);
  if (!regla) return [];
  const norm = normalizarColorAccesorio(color);
  const def = regla.mecPorColor[norm];
  if (def == null) return [];
  const manuales = regla.kitsManualesPorColor?.[norm] ?? [];
  return [def, ...manuales.filter((n) => n !== def)];
}

/** ¿Este MEC es una elección válida de línea B para esta categoría y color? */
export function esKitLineaBValido(
  categoria: string,
  color: string | null | undefined,
  num: number,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
): boolean {
  return kitsLineaB(categoria, color, reglas, tipos).includes(num);
}

/**
 * Código de bodega del kit. Los de la línea B llevan sufijo (MEC44-B, MEC45-B);
 * el resto es MEC<nn> con cero a la izquierda, como siempre. Sin esto la línea
 * del inventario no calzaría con la tabla `insumos`.
 */
export function codigoInsumoMec(
  num: number,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): string {
  return reglas.lineaB.codigoInsumoPorMec[num] ?? `MEC${String(num).padStart(2, '0')}`;
}

/** Primera regla de categoría que aplica para la ventana y color dados. */
export function reglaCategoriaAplicable(
  categoria: string,
  color: string | null | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): ReglaMecCategoria | null {
  for (const regla of reglas.reglasCategoria) {
    if (!categoriaCoincide(categoria, regla.categoria)) continue;
    if (regla.fijo || colorCoincide(color, regla.colores)) return regla;
  }
  return null;
}

/** Número MEC según regla de categoría, o null si no hay regla aplicable. */
export function mecPorCategoriaYColor(
  categoria: string,
  color: string | null | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): number | null {
  return reglaCategoriaAplicable(categoria, color, reglas)?.mec ?? null;
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
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): { regla: ReglaMecAncho; mec: number } | null {
  const c = normalizarCategoria(categoria);
  for (const r of reglas.reglasAncho) {
    if (c !== r.categoria.toUpperCase()) continue;
    // Las reglas de banda 2,2–3,0 m (tubo E39) solo aplican si la OT lo activó.
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
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): number | null {
  return reglaAnchoAplicable(categoria, anchoM, color, usarTuboE78, reglas)?.mec ?? null;
}

/**
 * true si el color tiene regla de banda por color en la categoría (blanco/negro
 * en ROL; todos en dúo manual). Decide si un modelo 45 mm se REVIERTE a 38 al
 * salir de la banda: con regla = fue automático y vuelve; sin regla (gris ROL)
 * = fue elección manual y se respeta.
 */
export function colorConBandaAncho(
  categoria: string,
  color?: string | null,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): boolean {
  const c = normalizarCategoria(categoria);
  const col = normalizarColorAccesorio(color);
  return reglas.reglasAncho.some(
    (r) => c === r.categoria.toUpperCase() && r.mecPorColor?.[col] != null,
  );
}

/**
 * La regla de banda de 45 mm de la categoría (la que pide el interruptor de la
 * OT), si la tiene. Sirve para entrar a la banda por otro camino —el 45 pedido
 * a mano en la cortina, o la regla de tubería que ya asigna un Ø45— y para
 * el color sin fila en la regla (gris en el roller simple).
 */
export function reglaBanda45(
  categoria: string,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): ReglaMecAncho | null {
  const c = normalizarCategoria(categoria);
  return reglas.reglasAncho.find((r) => r.requiereTuboE78 && c === r.categoria.toUpperCase()) ?? null;
}

/** ¿El ancho cae dentro de la banda de la regla? (>mín estricto, ≤máx). */
export function anchoEnBanda(anchoM: number, regla: ReglaMecAncho): boolean {
  return anchoM > regla.anchoMinM && (regla.anchoMaxM == null || anchoM <= regla.anchoMaxM);
}

/**
 * true si la categoría tiene una regla por ANCHO (p.ej. ROL sube a 63 mm sobre
 * 3 m). Sirve para saber cuándo hay que VOLVER a 38 mm al bajar de ese ancho —
 * OSCURANTI y las ovaladas, que también son 63 mm, no tienen regla → no se tocan.
 */
export function categoriaTieneReglaAncho(
  categoria: string,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): boolean {
  const c = normalizarCategoria(categoria);
  return reglas.reglasAncho.some((r) => c === r.categoria.toUpperCase());
}

/** true si la categoría tiene una regla fija (ignora color al forzar MEC). */
export function mecEsFijoPorCategoria(
  categoria: string,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): boolean {
  return reglas.reglasCategoria.some(
    (r) => r.fijo && categoriaCoincide(categoria, r.categoria),
  );
}

export function colorParaBusquedaModelo(
  color: string | null | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): string[] {
  const norm = normalizarColorAccesorio(color);
  if (!norm) return [];
  const aliases = [norm];
  const alias = reglas.aliasColorModelo[norm];
  if (alias) aliases.push(alias);
  return aliases;
}
