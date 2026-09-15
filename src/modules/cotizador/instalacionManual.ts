// ─────────────────────────────────────────────────────────────────────
// EL DESCUENTO DE INSTALACIÓN QUE SE ESCRIBE A MANO, TRAMO POR TRAMO.
//
// La instalación no es una sola fila: cada sistema se instala distinto y cobra
// lo suyo (roller $17.500, beeblack $35.000), así que la cotización muestra una
// fila POR SISTEMA y cada una se negocia por separado — dueño, 2026-09-14:
// «una cosa es beeblack y otra roller». Se puede regalar la instalación de las
// roller y cobrar entera la del beeblack.
//
// Acá vive SOLO el estado de esos porcentajes escritos a mano, en PORCENTAJE
// (0–100, que es lo que se teclea). El motor los recibe como fracción 0–1.
//
// La llave de un tramo es su CÓDIGO de instalación (`INST` la roller, `INST-BB`
// el beeblack), no el nombre del sistema: el nombre se puede cambiar en Admin y
// un descuento guardado dejaría de aplicarse en silencio.
//
// COMPATIBILIDAD: una cotización guardada antes de esto trae UN solo número
// (`instalacionDescuentoManual: 0.5`). Ese número vale para todos los tramos y
// se mantiene tal cual hasta que alguien toque una fila; ahí recién se abre en
// un valor por tramo. Así una OT vieja se reabre mostrando lo mismo que mostró
// cuando se guardó.
//
// Módulo PURO, sin dependencias: lo usa la página y lo prueba vitest.
// ─────────────────────────────────────────────────────────────────────

/**
 * Lo que la pantalla tiene escrito a mano, en %:
 *   · un número  = el mismo % para todos los tramos (cotización vieja);
 *   · un objeto  = un % por código de tramo (`INST`, `INST-BB`);
 *   · `null`     = nada a mano, manda la regla automática.
 */
export type DctInstalacionManual = number | Record<string, number>;

/** El % válido de un descuento: entre 0 y 100. */
export function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/** Los códigos siempre en mayúsculas y sin espacios: `inst-bb` es `INST-BB`. */
function normCodigo(c: string): string {
  return c.trim().toUpperCase();
}

/**
 * Un número suelto vale para TODOS los tramos presentes: al tocar una fila se
 * abre en un valor por tramo, y los demás conservan lo que ya mostraban.
 */
function expandir(
  estado: DctInstalacionManual | null,
  codigos: readonly string[],
): Record<string, number> {
  if (estado == null) return {};
  if (typeof estado === 'number') {
    return Object.fromEntries(codigos.map((c) => [normCodigo(c), clampPct(estado)]));
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(estado)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[normCodigo(k)] = clampPct(v);
  }
  return out;
}

/** El % escrito a mano para ESTE tramo, o `null` si manda la regla automática. */
export function dctManualDeTramo(
  estado: DctInstalacionManual | null,
  codigo: string,
): number | null {
  if (estado == null) return null;
  if (typeof estado === 'number') return clampPct(estado);
  // La búsqueda normaliza los DOS lados: lo guardado por una versión anterior
  // (o tecleado a mano en la base) puede venir en minúsculas.
  const v = expandir(estado, [])[normCodigo(codigo)];
  return typeof v === 'number' ? v : null;
}

/** Escribir un % en la fila de un tramo. `codigos` son los tramos que hay hoy. */
export function conDctManual(
  estado: DctInstalacionManual | null,
  codigo: string,
  pct: number,
  codigos: readonly string[],
): Record<string, number> {
  return { ...expandir(estado, codigos), [normCodigo(codigo)]: clampPct(pct) };
}

/**
 * El botón «auto» de una fila: ese tramo vuelve a la regla automática. Cuando
 * no queda ningún tramo escrito a mano, el estado entero vuelve a `null` (si
 * no, una cotización sin nada a mano se guardaría con un objeto vacío).
 */
export function sinDctManual(
  estado: DctInstalacionManual | null,
  codigo: string,
  codigos: readonly string[],
): Record<string, number> | null {
  const resto = expandir(estado, codigos);
  delete resto[normCodigo(codigo)];
  return Object.keys(resto).length > 0 ? resto : null;
}

/**
 * Lo que se le manda al motor y lo que se guarda en la OT: fracciones 0–1.
 * Un número sigue siendo un número (no se abre en tramos hasta que alguien
 * toque una fila), y sin nada a mano va `null`.
 */
export function dctManualParaMotor(
  estado: DctInstalacionManual | null,
): number | Record<string, number> | null {
  if (estado == null) return null;
  if (typeof estado === 'number') return clampPct(estado) / 100;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(estado)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[normCodigo(k)] = clampPct(v) / 100;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Lo guardado en la OT (fracciones 0–1) → el estado de la pantalla (%).
 * Tolera basura: una OT vieja no trae el campo, y una a medio guardar podría
 * traer cualquier cosa.
 */
export function dctManualFromPersist(raw: unknown): DctInstalacionManual | null {
  const aPct = (v: number) => clampPct(Math.round(v * 1000) / 10);
  if (typeof raw === 'number' && Number.isFinite(raw)) return aPct(raw);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[normCodigo(k)] = aPct(v);
    }
    return Object.keys(out).length > 0 ? out : null;
  }
  return null;
}
