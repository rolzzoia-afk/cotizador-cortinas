// ─────────────────────────────────────────────────────────────────────
// REGLAS DE TUBERÍA — Cotizador Fase 2 / Inventario Fase 4 / Optimizador
//
// Edita este archivo para cambiar qué tubo se pre-selecciona según ancho
// y diámetro. Los chips deben existir en OPCIONES_TUBERIA (fase2.ts).
// ─────────────────────────────────────────────────────────────────────
import type { ModeloDespiece } from './tipos';
import { categoriaCoincide, type MatchCategoria } from './reglas-mecanismo';

/**
 * Subconjunto de ModeloDespiece que usan las reglas de tubo. Permite pasar
 * "modelos sintéticos" (p.ej. diámetro derivado del chip de mecanismo)
 * reutilizando las mismas reglas; un ModeloDespiece completo también sirve.
 */
export type ModeloTubo = Pick<ModeloDespiece, 'diametro_tubo_mm' | 'codigos_tubo'>;

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

  /**
   * Tubo 63 mm (roller simple sobre 3 m): hasta 3,0 m → E47; más ancho → E65.
   * OSCURANTI queda fijo en E47 por su regla de categoría (gana antes).
   */
  regla63: {
    descripcion: 'Tubo 63 mm: hasta 3,0 m → E47; más de 3,0 m → E65',
    diametroMm: 63,
    anchoMaxE47M: 3.0,
    codigoHasta: 'E47',
    codigoDesde: 'E65',
  } as const,

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

function codigosTuboModelo(m: ModeloTubo): string[] {
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

export function aplicaReglaE02E66(modelo: ModeloTubo, categoria?: string): boolean {
  if (codigoTuboPorCategoria(categoria || '')) return false;
  return modelo.diametro_tubo_mm === REGLAS_TUBERIA.reglaE02E66.diametroMm;
}

/** Aplica la regla E47/E65 por ancho (63 mm sin regla de categoría, p.ej. OSCURANTI). */
export function aplicaRegla63(modelo: ModeloTubo, categoria?: string): boolean {
  if (codigoTuboPorCategoria(categoria || '')) return false;
  return modelo.diametro_tubo_mm === REGLAS_TUBERIA.regla63.diametroMm;
}

/**
 * Código de tubo (E02, E66, E47…) según categoría, modelo y ancho.
 */
export function codigoTuboPorAncho(
  m: ModeloTubo,
  anchoM: number,
  categoria?: string,
): string {
  const porCat = codigoTuboPorCategoria(categoria || '');
  if (porCat) return porCat;

  const { reglaE02E66, regla63, codigoPorDiametro } = REGLAS_TUBERIA;

  if (m.diametro_tubo_mm === reglaE02E66.diametroMm && anchoM > 0) {
    return anchoM > reglaE02E66.anchoMaxE02M
      ? reglaE02E66.codigoDesde
      : reglaE02E66.codigoHasta;
  }

  if (m.diametro_tubo_mm === regla63.diametroMm && anchoM > 0) {
    return anchoM > regla63.anchoMaxE47M ? regla63.codigoDesde : regla63.codigoHasta;
  }

  const porDiam = codigoPorDiametro[m.diametro_tubo_mm];
  if (porDiam) return porDiam;

  const codes = codigosTuboModelo(m);
  return codes[0] || '';
}

/**
 * Descripción larga del tubo por código, para los chips de Fase 2 y las hojas
 * de Cálculo General / Inventario. El Excel de órdenes y la etiqueta Brother
 * NO la usan (siguen con el código compacto "38mm_E02", ver tuberiaCodigoCorto).
 */
export const DESCRIPCION_TUBERIA: Record<string, string> = {
  E02: 'E02-TUBO 1.2 / Ø 38 mm',
  E66: 'E66 - TUBO (.40mm) - 2.5mm',
  E05: 'E05 - TUBO Ø 45 mm',
  E47: 'E47 - TUBO Ø 63 mm',
  E65: 'E65 - TUBO (.63mm)',
};

/**
 * Descripción larga a partir de un código corto ("38mm_E02"), un chip (viejo
 * "0,38mm [E02] 1,2mm" o nuevo "E02-TUBO…") o un código pelado ("E02").
 * Fallback: devuelve la entrada tal cual (VELCRO, vacío, códigos sin mapa).
 */
export function descripcionTuberia(valor: string | null | undefined): string {
  const s = (valor || '').trim();
  if (!s) return '';
  const m = s.toUpperCase().match(/E\d{2}/);
  return (m && DESCRIPCION_TUBERIA[m[0]]) || s;
}

/**
 * Extrae el código del tubo de un chip. Soporta el formato viejo con
 * corchetes ("0,38mm [E02] 1,2mm") y el nuevo con el código al inicio
 * ("E02-TUBO 1.2 / Ø 38 mm", "E66 - TUBO…"). "VELCRO"/vacío → "".
 */
export function codigoTuberiaDeChip(chip: string | null | undefined): string {
  const s = (chip || '').trim();
  const m = s.match(/\[([^\]]+)\]/);
  if (m) return m[1].trim().toUpperCase();
  const inicio = s.toUpperCase().match(/^(E\d{2})\b/);
  return inicio ? inicio[1] : '';
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
  // Compara por código (robusto a ambos formatos de chip, viejo y nuevo).
  return opciones.find((o) => codigoTuberiaDeChip(o) === up) ?? null;
}

/**
 * Normaliza un chip guardado a su texto canónico actual sin cambiar el código:
 * "0,38mm [E02] 1,2mm" → "E02-TUBO 1.2 / Ø 38 mm". Es SOLO de formato (no
 * depende de modelo ni ancho), así que migra el chip de una OT vieja apenas se
 * abre en Fase 2, aunque la ventana no tenga categoría/modelo/ancho todavía.
 * VELCRO y códigos sin chip base (E53 retirado) se devuelven tal cual.
 */
export function canonizarChipTuberia(
  stored: string | null | undefined,
  opciones: readonly string[],
): string {
  const trimmed = (stored || '').trim();
  if (!trimmed) return trimmed;
  return chipTuberiaPorCodigo(codigoTuberiaDeChip(trimmed), opciones) || trimmed;
}

/** Chip de tubería según diámetro del modelo (sin regla de ancho). */
export function chipTuberiaDeModelo(
  modelo: ModeloTubo,
  opciones: readonly string[],
  categoria?: string,
): string | null {
  if (modelo.diametro_tubo_mm <= 0) {
    return opciones.find((o) => o.toUpperCase() === 'VELCRO') ?? null;
  }
  const codigo = codigoTuboPorAncho(modelo, 0, categoria) ||
    REGLAS_TUBERIA.codigoPorDiametro[modelo.diametro_tubo_mm];
  const chip = codigo ? chipTuberiaPorCodigo(codigo, opciones) : null;
  if (chip) return chip;
  // El código del modelo (codigos_tubo[0], p.ej. E01) puede no ser un chip
  // seleccionable → cae al primer tubo estándar de ese diámetro.
  for (const c of codigosTuberiaCompatibles(modelo.diametro_tubo_mm)) {
    const alt = chipTuberiaPorCodigo(c, opciones);
    if (alt) return alt;
  }
  return null;
}

/**
 * Chip de tubería según categoría, ANCHO (regla E02/E66) y diámetro.
 */
export function chipTuberiaPorAncho(
  modelo: ModeloTubo,
  anchoM: number,
  opciones: readonly string[],
  categoria?: string,
): string | null {
  const code = codigoTuboPorAncho(modelo, anchoM, categoria);
  const chip = chipTuberiaPorCodigo(code, opciones);
  if (chip) return chip;
  return chipTuberiaDeModelo(modelo, opciones, categoria);
}

/**
 * Tubos auto-asignados por las reglas de ANCHO (38 mm: E02/E66 · 63 mm: E47/E65)
 * que una regla de CATEGORÍA debe poder pisar. P.ej. una cortina que venía de
 * roller >3 m (E65) y pasa a OSCURANTI —siempre E47— tiene que perder el E65.
 * Sin E65 en el set, ese tubo guardado sobrevivía y OSCURANTI quedaba en E65.
 */
const TUBOS_AUTO_POR_ANCHO = new Set(['E02', 'E66', 'E65']);

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

  if (!(stored || '').trim()) return esperado;
  // Migra un chip viejo guardado ("0,38mm [E02] 1,2mm") a su texto canónico
  // actual ("E02-TUBO…") sin cambiar el código. VELCRO/E53 (sin chip base) quedan.
  const trimmed = canonizarChipTuberia(stored, opciones);

  const codCat = codigoTuboPorCategoria(categoria || '');
  if (codCat) {
    const cs = codigoTuberiaDeChip(trimmed);
    if (!cs || TUBOS_AUTO_POR_ANCHO.has(cs)) return esperado;
    return trimmed;
  }

  if (aplicaReglaE02E66(modelo, categoria) || aplicaRegla63(modelo, categoria)) {
    // Ajuste fino por ancho: E02↔E66 (38 mm) y E47↔E65 (63 mm).
    const codEsp = codigoTuberiaDeChip(esperado);
    const codStored = codigoTuberiaDeChip(trimmed);
    if (codStored !== codEsp) return esperado;
  }

  return trimmed;
}

// ── Cascada mecanismo → tubería (Fase 2) ─────────────────────────────
// La compatibilidad es por DIÁMETRO: el chip de mecanismo lo codifica en su
// etiqueta ("…38MM", "0,63mm…", OVALADA = 38 mm) y el modelo de despiece en
// diametro_tubo_mm. No existe (ni hace falta) una tabla mecanismo→tubo.

/** Códigos de tubo compatibles con un diámetro: 38→[E02,E66], 45→[E05], 63→[E47]. */
export function codigosTuberiaCompatibles(diametroMm: number): string[] {
  const { reglaE02E66, regla63, codigoPorDiametro } = REGLAS_TUBERIA;
  if (diametroMm === reglaE02E66.diametroMm) {
    return [reglaE02E66.codigoHasta, reglaE02E66.codigoDesde];
  }
  if (diametroMm === regla63.diametroMm) {
    return [regla63.codigoHasta, regla63.codigoDesde];
  }
  const cod = codigoPorDiametro[diametroMm];
  return cod ? [cod] : [];
}

/**
 * Diámetro de tubo (mm) implícito en la etiqueta de un chip de MECANISMO:
 * "…38MM [MEC 32]"→38 · "0,63mm BCO [MEC 28]"→63 · "0,45mm [MEC 18]"→45 ·
 * OVALADA→38 · LZ90/LZ50→38 (el 50 de "LZ50" es el modelo, NO un diámetro).
 * Si no se reconoce o el número no tiene regla de tubo → null.
 */
export function diametroDesdeChipMecanismo(chip: string | null | undefined): number | null {
  const s = (chip || '').trim().toUpperCase();
  if (!s) return null;
  const valido = (d: number) => (codigosTuberiaCompatibles(d).length > 0 ? d : null);
  // "0,63MM" / "0.45MM" — formato de las opciones de tubería en el chip.
  const conComa = s.match(/0[.,](\d{2})\s*MM/);
  if (conComa) return valido(parseInt(conComa[1], 10));
  // "38MM" pegado o con espacio (kits simples).
  const directo = s.match(/(\d{2})\s*MM/);
  if (directo) return valido(parseInt(directo[1], 10));
  // Ovaladas (nuevas y legacy), kits LZ y duales: siempre tubo de 38 mm.
  if (s.includes('OVALADA')) return valido(38);
  if (s.includes('LZ')) return valido(38);
  if (s.includes('DUAL')) return valido(38);
  return null;
}

/**
 * Opciones de tubería visibles según mecanismo/modelo/categoría (cascada
 * mecanismo→tubería del editor de paños). Prioridad: regla de categoría
 * (OSCURANTI→E47) → diámetro del chip de mecanismo → diámetro del modelo
 * (pletina→VELCRO) → sin datos: todas. La tubería guardada SIEMPRE se
 * conserva (escape para OTs viejas, incluso chips retirados de la lista).
 * Fail-open: ante cualquier hueco de datos devuelve todas las opciones,
 * nunca deja al operario sin alternativas.
 */
export function opcionesTuberiaFiltradas(
  opciones: readonly string[],
  ctx: {
    mecanismoChip?: string | null;
    modelo?: ModeloTubo | null;
    categoria?: string;
    tuberiaActual?: string | null;
  },
): readonly string[] {
  const stored = (ctx.tuberiaActual || '').trim();
  const conStored = (base: (string | null)[]): readonly string[] => {
    const out = base.filter((c): c is string => !!c);
    if (!stored || out.includes(stored)) return out;
    // Dedup por CÓDIGO: una OT vieja con "0,38mm [E02] 1,2mm" no debe mostrar
    // dos chips E02 junto al nuevo "E02-TUBO…". El stored sin código (VELCRO)
    // o con un código sin chip base (E53 retirado) sí se conserva como escape.
    const codStored = codigoTuberiaDeChip(stored);
    if (codStored && out.some((o) => codigoTuberiaDeChip(o) === codStored)) return out;
    out.push(stored);
    return out;
  };

  // 1. Regla por categoría (gana sobre el mecanismo, igual que en codigoTuboPorAncho).
  const codCat = codigoTuboPorCategoria(ctx.categoria || '');
  if (codCat) {
    const chip = chipTuberiaPorCodigo(codCat, opciones);
    return chip ? conStored([chip]) : [...opciones];
  }

  // 2. Diámetro: chip de mecanismo primero, si no el modelo.
  let d = diametroDesdeChipMecanismo(ctx.mecanismoChip);
  if (d == null && ctx.modelo) {
    if (ctx.modelo.diametro_tubo_mm <= 0) {
      // Pletina/velcro (verticales): sin tubo redondo.
      const chip = chipTuberiaDeModelo(ctx.modelo, opciones, ctx.categoria);
      return chip ? conStored([chip]) : [...opciones];
    }
    d = ctx.modelo.diametro_tubo_mm;
  }
  if (d == null) return [...opciones];

  // 3. Diámetro → chips compatibles.
  const codes = codigosTuberiaCompatibles(d);
  if (codes.length === 0) return [...opciones];
  const chips = codes.map((c) => chipTuberiaPorCodigo(c, opciones)).filter(Boolean);
  if (chips.length === 0) return [...opciones];
  return conStored(chips as string[]);
}

/**
 * Chip de tubería que debe quedar en el paño al CAMBIAR el mecanismo, o null
 * si la actual ya es compatible (o no hay datos para decidir). El ajuste
 * fino E02↔E66 por ancho dentro de 38 mm lo sigue haciendo tuberiaParaPano
 * en la sincronización/guardado — acá solo se corrige la incompatibilidad.
 */
export function tuberiaCorregidaPorMecanismo(
  mecanismoChip: string,
  tuberiaActual: string | null | undefined,
  anchoM: number,
  opciones: readonly string[],
  categoria?: string,
): string | null {
  const codCat = codigoTuboPorCategoria(categoria || '');
  const d = diametroDesdeChipMecanismo(mecanismoChip);
  if (!codCat && d == null) return null;

  const compatibles = codCat ? [codCat] : codigosTuberiaCompatibles(d!);
  if (compatibles.length === 0) return null;

  const actual = codigoTuberiaDeChip(tuberiaActual);
  if (actual && compatibles.includes(actual)) return null;

  // Modelo sintético con el diámetro derivado: reutiliza la regla 2,2 m
  // (38→E02/E66 por ancho) y codigoPorDiametro sin duplicar lógica.
  return chipTuberiaPorAncho(
    { diametro_tubo_mm: d ?? 0, codigos_tubo: '' },
    anchoM,
    opciones,
    categoria,
  );
}
