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
import { modelosParaCategoria } from './tipos';
import {
  REGLAS_MECANISMO,
  categoriaRequiereMecanismo,
  esKitInventarioMec,
  esMecLegacy,
  mecPorCategoriaYColor,
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
  chipTuberiaDeModelo,
  chipTuberiaPorAncho,
  codigoTuberiaDeChip,
  tuberiaParaPano,
} from './reglas-tuberia';

/** @deprecated Usar REGLAS_MECANISMO.colorAMec */
export const MAPEO_COLOR_MEC = REGLAS_MECANISMO.colorAMec;

export function chipMecanismoPorNumero(
  num: number,
  opciones: readonly string[],
): string | null {
  return opciones.find((o) => o.toUpperCase().includes(`[MEC ${num}]`)) ?? null;
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
  p: Partial<{ mecanismo?: string; colorMecanismo?: string; colorPeso?: string; colorCadena?: string; color?: string }>,
  ventanaColor: string | undefined,
  modelo: ModeloDespiece | null | undefined,
  opciones: readonly string[],
  categoria?: string,
): string {
  const colorAcc = colorAccesoriosDePano(p, ventanaColor);
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

/** Modelo del catálogo que corresponde a un chip: '… [MEC 13]' → 'MEC_13_…'. */
export function modeloDesdeChipMecanismo(
  candidatos: ModeloDespiece[],
  chip: string,
): ModeloDespiece | null {
  const m = chip.toUpperCase().match(/\[MEC (\d+)\]/);
  if (!m) return null;
  return (
    candidatos.find((c) => {
      const mc = c.mecanismo.toUpperCase();
      return mc.startsWith(`MEC_${m[1]}_`) || mc === `MEC_${m[1]}`;
    }) ?? null
  );
}
