// ─────────────────────────────────────────────────────────────────────
// Puente entre el catálogo de descuentos (modelo de fabricación) y los
// CHIPS del editor de paño de Fase 2 (OPCIONES_MECANISMO / OPCIONES_TUBERIA,
// heredados del legacy). Permite que al elegir modelo se marquen los chips
// y que al clickear un chip de mecanismo se actualice el modelo.
//
// Las reglas de negocio (color→MEC, categoría→MEC) viven en reglas-mecanismo.ts.
// Módulo puro.
// ─────────────────────────────────────────────────────────────────────
import type { ModeloDespiece } from './tipos';
import { elegirModeloPorColor, modelosParaCategoria } from './tipos';
import {
  REGLAS_MECANISMO,
  categoriaRequiereMecanismo,
  categoriaTieneReglaAncho,
  esKitInventarioMec,
  esMecLegacy,
  mecPorAncho,
  mecPorCategoriaYColor,
  normalizarColorAccesorio,
  numeroMecPorColor,
  reglaCategoriaAplicable,
} from './reglas-mecanismo';

export {
  REGLAS_MECANISMO,
  categoriaRequiereMecanismo,
  normalizarColorAccesorio,
  numeroMecPorColor,
  mecPorCategoriaYColor,
  reglaCategoriaAplicable,
  colorParaBusquedaModelo,
} from './reglas-mecanismo';

export {
  REGLAS_TUBERIA,
  canonizarChipTuberia,
  chipTuberiaDeModelo,
  chipTuberiaPorAncho,
  codigoTuberiaDeChip,
  diametroDesdeChipMecanismo,
  opcionesTuberiaFiltradas,
  tuberiaCorregidaPorMecanismo,
  tuberiaParaPano,
} from './reglas-tuberia';

/** @deprecated Usar REGLAS_MECANISMO.colorAMec */
export const MAPEO_COLOR_MEC = REGLAS_MECANISMO.colorAMec;

export function chipMecanismoPorNumero(
  num: number,
  opciones: readonly string[],
): string | null {
  // Compara por número (robusto a formato cero-padded '[MEC 01]' de los duales).
  return opciones.find((o) => numeroMecDeChip(o) === num) ?? null;
}

// ── Mecanismos duales (producto duo día/noche) ───────────────────────
const NUMS_MEC_DUAL = new Set([1, 2, 3, 4, 19, 20, 24, 25]);
const DUAL_LADO_COLOR_A_MEC: Record<string, number> = {
  'DERECHO|BCO': 1, 'IZQUIERDO|BCO': 2, 'DERECHO|NEG': 3, 'IZQUIERDO|NEG': 4,
  'MIXTO|BCO': 19, 'MIXTO|NEG': 20, 'DERECHO|GRS': 24, 'IZQUIERDO|GRS': 25,
};
const MEC_DUAL_A_LADO_COLOR: Record<number, { lado: string; dualColor: string }> = {
  1: { lado: 'DERECHO', dualColor: 'BCO' }, 2: { lado: 'IZQUIERDO', dualColor: 'BCO' },
  3: { lado: 'DERECHO', dualColor: 'NEG' }, 4: { lado: 'IZQUIERDO', dualColor: 'NEG' },
  19: { lado: 'MIXTO', dualColor: 'BCO' }, 20: { lado: 'MIXTO', dualColor: 'NEG' },
  24: { lado: 'DERECHO', dualColor: 'GRS' }, 25: { lado: 'IZQUIERDO', dualColor: 'GRS' },
};

/** true si el chip es un mecanismo dual ([MEC 01..04, 19, 20, 24, 25]). */
export function esChipDual(chip: string | null | undefined): boolean {
  const n = numeroMecDeChip(chip);
  return n != null && NUMS_MEC_DUAL.has(n);
}

/** Color de accesorios normalizado a BCO/NEG/GRS (o '' si no calza). */
function colorAccCorto(color: string | null | undefined): string {
  const c = normalizarColorAccesorio(color);
  if (c === 'BCO' || c === 'BLANCO') return 'BCO';
  if (c === 'NEG' || c === 'NEGRO') return 'NEG';
  if (c === 'GRS' || c === 'GRIS') return 'GRS';
  return '';
}

/** Chip dual por lado + color. MIXTO no tiene gris → degrada a DERECHO. */
export function chipDualPorLadoColor(
  lado: string | null | undefined,
  color: string | null | undefined,
  opciones: readonly string[],
): string | null {
  const cc = colorAccCorto(color);
  if (!cc) return null;
  let l = (lado || 'DERECHO').toUpperCase();
  if (l === 'MIXTO' && cc === 'GRS') l = 'DERECHO';
  const mec = DUAL_LADO_COLOR_A_MEC[`${l}|${cc}`];
  return mec != null ? chipMecanismoPorNumero(mec, opciones) : null;
}

/** Lado + color implícitos en un chip dual (para rellenar dualLado/dualColor). */
export function ladoColorDesdeChipDual(
  chip: string | null | undefined,
): { lado: string; dualColor: string } | null {
  const n = numeroMecDeChip(chip);
  return n != null ? MEC_DUAL_A_LADO_COLOR[n] ?? null : null;
}

/** Chip de mecanismo que corresponde al modelo: 'MEC_13_…' → '… [MEC 13]'. */
export function chipMecanismoDeModelo(
  modelo: ModeloDespiece,
  opciones: readonly string[],
): string | null {
  const m = modelo.mecanismo.toUpperCase().match(/^MEC_(\d+)/);
  if (!m) return null;
  return opciones.find((o) => o.toUpperCase().includes(`[MEC ${m[1]}]`)) ?? null;
}

/** Extrae el número MEC de un chip, ej. '… [MEC 33]' → 33. */
export function numeroMecDeChip(chip: string | null | undefined): number | null {
  const m = (chip || '').toUpperCase().match(/\[MEC (\d+)\]/);
  return m ? parseInt(m[1], 10) : null;
}

/** true si el chip es un MEC legacy del Excel (no inventario 32/33/34). */
export function esMecLegacyInventario(chip: string | null | undefined): boolean {
  const n = numeroMecDeChip(chip);
  return n != null && esMecLegacy(n);
}

/** Chip default por color de accesorios (BCO→33, GRS→34, NEG→32). */
export function chipMecanismoPorColor(
  color: string | null | undefined,
  opciones: readonly string[],
): string | null {
  const num = numeroMecPorColor(color);
  if (num == null) return null;
  return chipMecanismoPorNumero(num, opciones);
}

/** Color de accesorios del paño: mecanismo → peso → cadena → tela → ventana. */
export function colorAccesoriosDePano(
  p: Partial<{
    colorMecanismo?: string;
    colorPeso?: string;
    colorCadena?: string;
    color?: string;
  }>,
  ventanaColor?: string | null,
): string {
  return (
    (p.colorMecanismo as string) ||
    (p.colorPeso as string) ||
    (p.colorCadena as string) ||
    (p.color as string) ||
    ventanaColor ||
    ''
  );
}

/**
 * Mecanismo que debe quedar en el paño: reglas de categoría primero,
 * luego inventario por color, reemplazando legacy/vacío.
 */
export function mecanismoParaPano(
  p: Partial<{ mecanismo?: string; dual?: boolean; dualLado?: string; colorMecanismo?: string; colorPeso?: string; colorCadena?: string; color?: string }>,
  ventanaColor: string | undefined,
  modelo: ModeloDespiece | null | undefined,
  opciones: readonly string[],
  categoria?: string,
  anchoM?: number,
): string {
  const colorAcc = colorAccesoriosDePano(p, ventanaColor);

  // Rama dual: usa los chips [MEC 01..25], no los kits por color ni la categoría.
  if (p.dual) {
    const storedDual = ((p.mecanismo as string) || '').trim();
    if (esChipDual(storedDual)) return storedDual;
    const chipDual = chipDualPorLadoColor(p.dualLado, colorAcc, opciones);
    return chipDual || storedDual;
  }

  const mecCat = mecPorCategoriaYColor(categoria || '', colorAcc);
  if (mecCat != null) {
    const chipCat = chipMecanismoPorNumero(mecCat, opciones);
    if (chipCat) {
      const stored = (p.mecanismo as string) || '';
      const trimmed = stored.trim();
      if (!trimmed) return chipCat;
      const nStored = numeroMecDeChip(trimmed);
      if (nStored === mecCat) return trimmed;
      if (nStored != null && esKitInventarioMec(nStored)) return chipCat;
      if (opciones.includes(trimmed)) return trimmed;
      return chipCat;
    }
  }

  // Regla por ancho (roller simple >3 m → MEC 28). Va tras la categoría y antes
  // que el color. MEC 28 es "legacy" en el catálogo, así que forzarlo acá evita
  // que la sincronización lo revierta al kit por color.
  const mecAncho = anchoM != null ? mecPorAncho(categoria || '', anchoM) : null;
  if (mecAncho != null) {
    const chipAncho = chipMecanismoPorNumero(mecAncho, opciones);
    if (chipAncho) {
      const trimmed = ((p.mecanismo as string) || '').trim();
      if (!trimmed) return chipAncho;
      const nStored = numeroMecDeChip(trimmed);
      if (nStored === mecAncho) return trimmed;
      if (nStored != null && esKitInventarioMec(nStored)) return chipAncho;
      if (nStored != null && esMecLegacy(nStored)) return chipAncho;
      if (opciones.includes(trimmed)) return trimmed;
      return chipAncho;
    }
  }

  const porColor = chipMecanismoPorColor(colorAcc, opciones);
  const stored = (p.mecanismo as string) || '';
  const inventario = opcionesInventarioMec(opciones);

  if (porColor) {
    const nStored = numeroMecDeChip(stored.trim());
    if (
      !stored.trim() ||
      nStored == null ||
      esMecLegacy(nStored) ||
      !inventario.includes(stored)
    ) {
      return porColor;
    }
    return stored;
  }

  return chipMecanismoEfectivo(stored, colorAcc, modelo, opciones);
}

/**
 * Chip efectivo para producción/inventario: el mapeo color→inventario (32/33/34)
 * gana sobre chips legacy del Excel (MEC 05, 06, 14…) guardados por error.
 */
export function chipMecanismoEfectivo(
  stored: string | null | undefined,
  colorAccesorios: string | null | undefined,
  modelo: ModeloDespiece | null | undefined,
  opciones: readonly string[],
): string {
  const porColor = chipMecanismoPorColor(colorAccesorios, opciones);
  const trimmed = (stored || '').trim();
  if (porColor) {
    const nStored = numeroMecDeChip(trimmed);
    if (!trimmed || (nStored != null && esMecLegacy(nStored))) {
      return porColor;
    }
    return trimmed;
  }
  if (trimmed) return trimmed;
  if (modelo) {
    const delModelo = chipMecanismoDeModelo(modelo, opciones);
    if (delModelo) return delModelo;
  }
  return '';
}

/**
 * Resuelve el chip de mecanismo para un paño: inventario por color primero,
 * luego valor guardado, luego modelo de despiece Excel.
 */
export function chipMecanismoParaPano(
  modelo: ModeloDespiece | null | undefined,
  colorAccesorios: string | null | undefined,
  opciones: readonly string[],
  stored?: string | null,
): string | null {
  const efectivo = chipMecanismoEfectivo(stored, colorAccesorios, modelo, opciones);
  return efectivo || null;
}

/** Chips de inventario bodega (kitsInventario) siempre disponibles en Fase 2. */
export function opcionesInventarioMec(opcionesBase: readonly string[]): string[] {
  return opcionesBase.filter((o) => {
    const n = numeroMecDeChip(o);
    return n != null && esKitInventarioMec(n);
  });
}

/**
 * Opciones de mecanismo visibles según categoría y color de accesorios.
 * Consulta REGLAS_MECANISMO.reglasCategoria y kitsInventario.
 */
export function opcionesMecanismoFiltradas(
  modelos: ModeloDespiece[],
  categoria: string,
  colorAccesorios: string | null | undefined,
  opcionesBase: readonly string[],
  mecanismoActual?: string,
): readonly string[] {
  if (!categoriaRequiereMecanismo(categoria)) return [];

  const regla = reglaCategoriaAplicable(categoria, colorAccesorios);
  if (regla) {
    const opts = [...opcionesBase];
    if (
      mecanismoActual &&
      opcionesBase.includes(mecanismoActual) &&
      !opts.includes(mecanismoActual)
    ) {
      opts.push(mecanismoActual);
    }
    return opts;
  }

  const inventario = opcionesInventarioMec(opcionesBase);

  if (inventario.length > 0) {
    const opts = [...inventario];
    if (
      mecanismoActual &&
      !opts.includes(mecanismoActual) &&
      opcionesBase.includes(mecanismoActual) &&
      !esMecLegacyInventario(mecanismoActual)
    ) {
      opts.push(mecanismoActual);
    }
    return opts;
  }

  const chipColor = chipMecanismoPorColor(colorAccesorios, opcionesBase);
  if (chipColor) return [chipColor];

  const candidatos = modelosParaCategoria(modelos, categoria);
  const chipsCategoria = [
    ...new Set(
      candidatos
        .map((m) => chipMecanismoDeModelo(m, opcionesBase))
        .filter((c): c is string => !!c),
    ),
  ];
  if (chipsCategoria.length > 0) {
    if (mecanismoActual && !chipsCategoria.includes(mecanismoActual) && opcionesBase.includes(mecanismoActual)) {
      return [...chipsCategoria, mecanismoActual];
    }
    return chipsCategoria;
  }

  if (mecanismoActual && opcionesBase.includes(mecanismoActual)) return [mecanismoActual];
  return opcionesBase;
}

/** Modelo del catálogo cuyo mecanismo es 'MEC_<num>_…' (o cero-padded 'MEC_0N_…'). */
export function modeloDesdeNumeroMec(
  candidatos: ModeloDespiece[],
  num: number,
): ModeloDespiece | null {
  return (
    candidatos.find((c) => {
      const mc = c.mecanismo.toUpperCase();
      return mc.startsWith(`MEC_${num}_`) || mc === `MEC_${num}` ||
        mc.startsWith(`MEC_0${num}_`) || mc === `MEC_0${num}`;
    }) ?? null
  );
}

/** Modelo del catálogo que corresponde a un chip: '… [MEC 13]' → 'MEC_13_…'. */
export function modeloDesdeChipMecanismo(
  candidatos: ModeloDespiece[],
  chip: string,
): ModeloDespiece | null {
  const m = chip.toUpperCase().match(/\[MEC (\d+)\]/);
  if (!m) return null;
  return modeloDesdeNumeroMec(candidatos, parseInt(m[1], 10)); // '[MEC 01]' → 1
}

/**
 * Modelo efectivo de la VENTANA según el ANCHO. Roller simple sobre 3 m sube a
 * la fila 63 mm (MEC 28, tubo E65); al bajar de 3 m vuelve al 38 mm por color.
 * El resto de categorías —incluidas OSCURANTI y las ovaladas, legítimamente de
 * 63 mm— se devuelven sin tocar. Es la contraparte "al abrir/sincronizar" de la
 * cascada mecanismo→modelo que corre al editar (aplicarCascadaMecanismo): sin
 * esto, una OT de >3 m abierta queda con el modelo de 38 mm y la tubería E66.
 * El modelo es por ventana, así que se decide con el ancho de referencia (el
 * paño más ancho). Para paños dual NO se aplica (mantienen su modelo dual 38 mm).
 */
export function modeloPorAncho(
  modelos: ModeloDespiece[],
  categoria: string,
  anchoM: number,
  modeloActual: ModeloDespiece | null,
  color: string | null | undefined,
): ModeloDespiece | null {
  const mecA = mecPorAncho(categoria || '', anchoM);
  if (mecA != null) {
    const up = modeloDesdeNumeroMec(modelosParaCategoria(modelos, categoria), mecA);
    return up ?? modeloActual;
  }
  // Sin regla de ancho vigente: si el modelo quedó en la fila 63 mm forzada por
  // ancho y la categoría sí tiene esa regla (ROL), volver al 38 mm por color.
  if (categoriaTieneReglaAncho(categoria) && modeloActual && modeloActual.diametro_tubo_mm === 63) {
    return modeloSimple38PorColor(modelos, categoria, color) ?? modeloActual;
  }
  return modeloActual;
}

/**
 * Modelo roller simple 38 mm por color de accesorios. Se usa al bajar de 3 m
 * (volver del kit 63 mm) o al desactivar el dual: hay que filtrar por diámetro
 * 38, porque elegirModeloPorColor sin filtro podría matchear el 63 mm (su
 * mecanismo también contiene el color "BLANCO").
 */
export function modeloSimple38PorColor(
  modelos: ModeloDespiece[],
  categoria: string,
  color: string | null | undefined,
): ModeloDespiece | null {
  const cands = modelosParaCategoria(modelos, categoria).filter(
    (m) => m.diametro_tubo_mm === 38 && m.sistema === 'ROLLER_SIMPLE',
  );
  return elegirModeloPorColor(cands, color);
}
