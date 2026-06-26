// ─────────────────────────────────────────────────────────────────────
// REGLAS DE TUBERÍA — Cotizador Fase 2 / Inventario Fase 4 / Optimizador
//
// Edita este archivo para cambiar qué tubo se pre-selecciona según ancho
// y diámetro. Los chips deben existir en OPCIONES_TUBERIA (fase2.ts).
// ─────────────────────────────────────────────────────────────────────
import type { ModeloDespiece } from './tipos';
import { categoriaCoincide, type MatchCategoria } from './reglas-mecanismo';

export type ReglaE02E66 = {
  descripcion: string;
  diametroMm: number;
  /** Ancho máximo (m) inclusive para usar E02. Por encima → E66. */
  anchoMaxE02M: number;
  codigoHasta: string;
  codigoDesde: string;
};

export type ReglaTuboCategoria = {
  descripcion: string;
  categoria: MatchCategoria;
  codigo: string;
};

export const REGLAS_TUBERIA = {
  /**
   * Tubo 38 mm: hasta anchoMaxE02M → E02; más ancho → E66 (más rígido).
   * Solo aplica a categorías sin regla propia y modelos de 38 mm.
   */
  reglaE02E66: {
    descripcion: 'Tubo 38 mm: hasta 2,2 m → E02; más de 2,2 m → E66',
    diametroMm: 38,
    anchoMaxE02M: 2.2,
    codigoHasta: 'E02',
    codigoDesde: 'E66',
  } as const satisfies ReglaE02E66,

  /** Código de tubo por diámetro cuando no aplica regla de categoría ni E02/E66. */
  codigoPorDiametro: {
    45: 'E05',
    63: 'E47',
  } as Record<number, string>,

  /** Reglas por categoría — tienen prioridad sobre E02/E66 y el diámetro del modelo Excel. */
  reglasCategoria: [
    {
      descripcion: 'Oscurante 63 mm — siempre tubo E47',
      categoria: { includes: 'OSCURANTI' },
      codigo: 'E47',
    },
  ] as const satisfies readonly ReglaTuboCategoria[],
} as const;

function codigosTuboModelo(m: ModeloDespiece): string[] {
  return (m.codigos_tubo || '')
    .split(';')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

export function codigoTuboPorCategoria(categoria: string): string | null {
  for (const regla of REGLAS_TUBERIA.reglasCategoria) {
    if (categoriaCoincide(categoria, regla.categoria)) return regla.codigo;
  }
  return null;
}

export function aplicaReglaE02E66(modelo: ModeloDespiece, categoria?: string): boolean {
  if (codigoTuboPorCategoria(categoria || '')) return false;
  return modelo.diametro_tubo_mm === REGLAS_TUBERIA.reglaE02E66.diametroMm;
}

/**
 * Código de tubo (E02, E66, E47…) según categoría, modelo y ancho.
 */
export function codigoTuboPorAncho(
  m: ModeloDespiece,
  anchoM: number,
  categoria?: string,
): string {
  const porCat = codigoTuboPorCategoria(categoria || '');
  if (porCat) return porCat;

  const { reglaE02E66, codigoPorDiametro } = REGLAS_TUBERIA;

  if (m.diametro_tubo_mm === reglaE02E66.diametroMm && anchoM > 0) {
    return anchoM > reglaE02E66.anchoMaxE02M
      ? reglaE02E66.codigoDesde
      : reglaE02E66.codigoHasta;
  }

  const porDiam = codigoPorDiametro[m.diametro_tubo_mm];
  if (porDiam) return porDiam;

  const codes = codigosTuboModelo(m);
  return codes[0] || '';
}

/** Extrae el código entre corchetes, ej. "0,38mm [E02] 1,2mm" → "E02". */
export function codigoTuberiaDeChip(chip: string | null | undefined): string {
  const m = (chip || '').match(/\[([^\]]+)\]/);
  return m ? m[1].trim().toUpperCase() : '';
}

/**
 * Código corto del tubo para Excel de órdenes / PDF / etiqueta:
 * "38mm_E02" (respeta el chip elegido a mano; si no, regla por ancho).
 * Para pletinas (sin diámetro) devuelve el sistema. Único origen del código
 * de tubo en toda la app.
 */
export function tuberiaCodigoCorto(
  modelo: ModeloDespiece | null | undefined,
  tuberiaChip: string | null | undefined,
  anchoM: number,
  categoria?: string,
): string {
  const codChip = codigoTuberiaDeChip(tuberiaChip);
  if (modelo && modelo.diametro_tubo_mm > 0) {
    const cod = codChip || codigoTuboPorAncho(modelo, anchoM, categoria);
    return cod ? `${modelo.diametro_tubo_mm}mm_${cod}` : `${modelo.diametro_tubo_mm}mm`;
  }
  if (codChip) return codChip;
  return modelo ? modelo.sistema : '';
}

export function chipTuberiaPorCodigo(
  codigo: string,
  opciones: readonly string[],
): string | null {
  if (!codigo) return null;
  const up = codigo.toUpperCase();
  return opciones.find((o) => o.toUpperCase().includes(`[${up}]`)) ?? null;
}

/** Chip de tubería según diámetro del modelo (sin regla de ancho). */
export function chipTuberiaDeModelo(
  modelo: ModeloDespiece,
  opciones: readonly string[],
  categoria?: string,
): string | null {
  if (modelo.diametro_tubo_mm <= 0) {
    return opciones.find((o) => o.toUpperCase() === 'VELCRO') ?? null;
  }
  const codigo = codigoTuboPorAncho(modelo, 0, categoria) ||
    REGLAS_TUBERIA.codigoPorDiametro[modelo.diametro_tubo_mm];
  if (codigo) {
    const chip = chipTuberiaPorCodigo(codigo, opciones);
    if (chip) return chip;
  }
  const prefijo = `0,${modelo.diametro_tubo_mm}mm`;
  return opciones.find((o) => o.startsWith(prefijo)) ?? null;
}

/**
 * Chip de tubería según categoría, ANCHO (regla E02/E66) y diámetro.
 */
export function chipTuberiaPorAncho(
  modelo: ModeloDespiece,
  anchoM: number,
  opciones: readonly string[],
  categoria?: string,
): string | null {
  const code = codigoTuboPorAncho(modelo, anchoM, categoria);
  const chip = chipTuberiaPorCodigo(code, opciones);
  if (chip) return chip;
  return chipTuberiaDeModelo(modelo, opciones, categoria);
}

/** Tubos 38 mm mal asignados por la regla E02/E66 en categorías especiales. */
const TUBOS_38MM_ERRONEOS = new Set(['E02', 'E66']);

/**
 * Tubería que debe quedar en el paño: pre-selecciona según reglas;
 * corrige defaults erróneos; respeta elección manual distinta.
 */
export function tuberiaParaPano(
  anchoM: number,
  modelo: ModeloDespiece | null | undefined,
  stored: string | null | undefined,
  opciones: readonly string[],
  categoria?: string,
): string {
  if (!modelo || anchoM <= 0) return (stored || '').trim();

  const esperado = chipTuberiaPorAncho(modelo, anchoM, opciones, categoria);
  if (!esperado) return (stored || '').trim();

  const trimmed = (stored || '').trim();
  if (!trimmed) return esperado;

  const codCat = codigoTuboPorCategoria(categoria || '');
  if (codCat) {
    const cs = codigoTuberiaDeChip(trimmed);
    if (!cs || TUBOS_38MM_ERRONEOS.has(cs)) return esperado;
    return trimmed;
  }

  if (aplicaReglaE02E66(modelo, categoria)) {
    const codEsp = codigoTuberiaDeChip(esperado);
    const codStored = codigoTuberiaDeChip(trimmed);
    if (codStored !== codEsp) return esperado;
  }

  return trimmed;
}
