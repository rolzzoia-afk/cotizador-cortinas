// ─────────────────────────────────────────────────────────────────────
// REGLAS BEEBLACK — pizarra 2026-07-29 (reemplaza beeblack.xlsx)
//
// Cierre horizontal con lamas (no roller ni oscuridad clásica). Tres variantes
// de instalación, cada una con su tabla de ajustes sobre las medidas REALES:
//   · INTERNO  → dentro del marco
//   · SEMI     → techo a muro
//   · EXTERNO  → techo a muro | fuera del marco
//
// | Pieza                  | INTERNO | SEMI  | EXTERNO |
// |------------------------|---------|-------|---------|
// | Perfil superior/inferior (ancho) | −5,7 | −2    | +1  |
// | Perfil lateral izq/der (alto)    | −5,7 | −2    | +1  |
// | Manilla (alto)                   | −5   | −1,3  | +1,7|
// | Alto de tela                     | −3,2 | −0,05 | +3,5|  ← SEMI es −0,5 MM
// | Ancho de tela                    | −4,7 | −1    | +2  |
// | Lamas = ancho real / divisor + 10 (entero HACIA ARRIBA) | /1,5 | /1,55 | /1,55 |
//
// El TIPO DE INSTALACIÓN (pizarra 2026-07-30) va pegado a la variante y solo
// mueve los PERFILES LATERALES: EXTERNO admite "techo a muro" (alto + 1) o
// "fuera del marco" (alto + 2); INTERNO y SEMI tienen una sola instalación
// posible. Se elige en Fase 2, junto a la variante.
//
// La TELA (ancho/alto) y las LAMAS no viajan al Excel de ESTRUCTURA: la tela del
// beeblack es un acordeón y las lamas indican dónde cortar el ancho, así que son
// dato de la mesa de tela (Cálculo General / Dimensionado), igual que el alto de
// tela de los sistemas de oscuridad.
//
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────

export type VarianteBeeblack = 'INTERNO' | 'SEMI' | 'EXTERNO';

/** Tipos de instalación REALES (pizarra 2026-07-30). Los 5 valores que trae la
 *  planilla de cotización (PISO_TECHO_PERFIL_*) no se usan. */
export type InstalacionBeeblack = 'DENTRO_DEL_MARCO' | 'TECHO_A_MURO' | 'FUERA_DEL_MARCO';

export type TogglesBeeblack = {
  /** Manillas: SIEMPRE opt-in en Fase 2 (hasta 2: un beeblack puede llevar
   *  screen + blackout, una manilla por tela). */
  manillaIzq?: boolean;
  manillaDer?: boolean;
  /** Perfiles SEPARADORES (E41/E42/E43) por lado — opt-in, como en oscuridad. */
  sepIzq?: boolean;
  sepDer?: boolean;
  sepSup?: boolean;
  sepInf?: boolean;
};

/** Medidas manuales (cm) que sobreescriben la calculada. */
export type MedidasBeeblack = {
  perfilSupAncho?: number;
  perfilInfAncho?: number;
  perfilLatIzq?: number;
  perfilLatDer?: number;
  manillaIzq?: number;
  manillaDer?: number;
  anchoTela?: number;
  altoTela?: number;
  totalLamas?: number;
  sepIzq?: number;
  sepDer?: number;
  sepSup?: number;
  sepInf?: number;
};

export type CorteBeeblack = {
  componente: string;
  columnaExcel: string;
  medidaCm: number;
  /** true si proviene de un toggle ON/OFF. */
  toggle?: boolean;
};

export const VARIANTES_BEEBLACK: VarianteBeeblack[] = ['INTERNO', 'SEMI', 'EXTERNO'];

/** Instalaciones posibles por variante. La primera es el default. */
export const INSTALACIONES_BEEBLACK: Record<VarianteBeeblack, InstalacionBeeblack[]> = {
  INTERNO: ['DENTRO_DEL_MARCO'],
  SEMI: ['TECHO_A_MURO'],
  EXTERNO: ['TECHO_A_MURO', 'FUERA_DEL_MARCO'],
};

export const LABEL_INSTALACION_BEEBLACK: Record<InstalacionBeeblack, string> = {
  DENTRO_DEL_MARCO: 'Dentro del marco',
  TECHO_A_MURO: 'Techo a muro',
  FUERA_DEL_MARCO: 'Fuera del marco',
};

export function instalacionDefaultBeeblack(variante: VarianteBeeblack): InstalacionBeeblack {
  return INSTALACIONES_BEEBLACK[variante][0];
}

/**
 * Canoniza el tipo de instalación CONTRA su variante: un valor vacío, legacy de
 * la planilla (PISO_TECHO_PERFIL_MEDIO…) o que no corresponde a la variante cae
 * al default de esa variante. Así INTERNO y SEMI nunca quedan con una
 * instalación que no existe para ellos.
 */
export function normalizarInstalacionBeeblack(
  valor: string | undefined | null,
  variante: VarianteBeeblack,
): InstalacionBeeblack {
  const v = (valor || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z]+/g, '_');
  const posibles = INSTALACIONES_BEEBLACK[variante];
  return posibles.find((i) => i === v) ?? instalacionDefaultBeeblack(variante);
}

/** Manillas y separadores: todos opt-in, iguales en las 3 variantes. */
export const TOGGLES_BEEBLACK: Array<{ key: keyof TogglesBeeblack; label: string }> = [
  { key: 'manillaIzq', label: 'Manilla izquierda' },
  { key: 'manillaDer', label: 'Manilla derecha' },
];

/** Ajustes en cm sobre la medida REAL, por variante (pizarra 2026-07-29). */
export const AJUSTES_BEEBLACK: Record<
  VarianteBeeblack,
  { perfilAncho: number; perfilLateral: number; manilla: number; anchoTela: number; altoTela: number; lamasDivisor: number }
> = {
  INTERNO: { perfilAncho: -5.7, perfilLateral: -5.7, manilla: -5, anchoTela: -4.7, altoTela: -3.2, lamasDivisor: 1.5 },
  SEMI: { perfilAncho: -2, perfilLateral: -2, manilla: -1.3, anchoTela: -1, altoTela: -0.05, lamasDivisor: 1.55 },
  EXTERNO: { perfilAncho: 1, perfilLateral: 1, manilla: 1.7, anchoTela: 2, altoTela: 3.5, lamasDivisor: 1.55 },
};

/** Ajuste del PERFIL LATERAL cuando la instalación manda sobre la variante.
 *  Único caso de la pizarra: EXTERNO + FUERA DEL MARCO → alto + 2 (no + 1). */
const PERFIL_LATERAL_POR_INSTALACION: Partial<Record<InstalacionBeeblack, number>> = {
  FUERA_DEL_MARCO: 2,
};

/** Lamas: ancho real / divisor + 10, redondeado HACIA ARRIBA a entero. */
export const LAMAS_EXTRA = 10;

/** Redondeo a 1 decimal (regla del usuario 2026-07-31): ninguna medida de corte lleva
 *  más de un decimal. El −0,5 mm del alto de tela SEMI queda en la tabla pero se
 *  redondea al salir (130 → 130), que es como se corta en la mesa. */
const r1 = (n: number) => Math.round(n * 10) / 10;

function aplicarOverride(calculada: number, override: number | undefined): number {
  return typeof override === 'number' && Number.isFinite(override) && override > 0
    ? r1(override)
    : calculada;
}

export function esCategoriaBeeblack(categoria: string | undefined | null): boolean {
  return (categoria || '').toUpperCase().includes('BEEBLACK');
}

/** Mapea sentido de Fase 1 (o la variante guardada) → variante BEEBLACK.
 *  `EXTERNO_SEMI` es el valor LEGACY de los paños guardados antes de la pizarra
 *  2026-07-29, cuando semi y externo compartían fórmula: cae a EXTERNO. */
export function normalizarVarianteBeeblack(
  sentido: string | undefined | null,
  fallback: VarianteBeeblack = 'INTERNO',
): VarianteBeeblack {
  const s = (sentido || '').toUpperCase();
  if (s.includes('INTERNO')) return 'INTERNO';
  if (s.includes('EXTERNO')) return 'EXTERNO'; // incluye el legacy EXTERNO_SEMI
  if (s.includes('SEMI')) return 'SEMI';
  return fallback;
}

/**
 * ¿El beeblack cierra DE ARRIBA ABAJO? Su planilla ofrece tres cierres:
 * IZQUIERDA-DERECHA, DERECHA-IZQUIERDA (el acordeón corre de lado, caso normal)
 * y DE ARRIBA ABAJO, donde la cortina va girada 90°: las lamas se cuentan sobre
 * el ALTO y el corte de tela intercambia ancho y alto (decisión 2026-07-30).
 */
export function esCierreVerticalBeeblack(direccion: string | undefined | null): boolean {
  return (direccion || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .includes('ARRIBA');
}

type MedidasCalculadas = {
  perfilSupAncho: number;
  perfilInfAncho: number;
  perfilLatIzq: number;
  perfilLatDer: number;
  manilla: number;
  anchoTela: number;
  altoTela: number;
  totalLamas: number;
};

function calcularMedidas(
  variante: VarianteBeeblack,
  anchoCm: number,
  altoCm: number,
  cierreVertical = false,
  instalacion?: string | null,
): MedidasCalculadas {
  const a = AJUSTES_BEEBLACK[variante];
  // La instalación se canoniza contra la variante: solo puede mover el lateral
  // si es una instalación posible para esa variante (FUERA DEL MARCO ⇒ EXTERNO).
  const inst = normalizarInstalacionBeeblack(instalacion, variante);
  const ajusteLateral = PERFIL_LATERAL_POR_INSTALACION[inst] ?? a.perfilLateral;
  // Cierre de arriba abajo: la cortina va girada 90°, así que ancho y alto
  // intercambian su papel en TODAS las fórmulas de la pizarra (se cortan las
  // mismas 4 barras, y las lamas y la tela salen sobre el alto real).
  const anchoBase = cierreVertical ? altoCm : anchoCm;
  const altoBase = cierreVertical ? anchoCm : altoCm;
  const perfilAncho = r1(anchoBase + a.perfilAncho);
  const perfilLateral = r1(altoBase + ajusteLateral);
  return {
    perfilSupAncho: perfilAncho,
    perfilInfAncho: perfilAncho,
    perfilLatIzq: perfilLateral,
    perfilLatDer: perfilLateral,
    manilla: r1(altoBase + a.manilla),
    anchoTela: r1(anchoBase + a.anchoTela),
    altoTela: r1(altoBase + a.altoTela),
    // Cantidad de pliegues del acordeón (unidades, no cm): siempre hacia arriba.
    totalLamas: Math.ceil(anchoBase / a.lamasDivisor + LAMAS_EXTRA),
  };
}

/** Medida calculada de un componente (preview de la UI). */
export function medidaComponenteBeeblack(
  variante: VarianteBeeblack,
  componente: keyof MedidasCalculadas | 'manillaIzq' | 'manillaDer',
  anchoCm: number,
  altoCm: number,
  cierreVertical = false,
  instalacion?: string | null,
): number {
  const m = calcularMedidas(variante, anchoCm, altoCm, cierreVertical, instalacion);
  if (componente === 'manillaIzq' || componente === 'manillaDer') return m.manilla;
  return m[componente as keyof MedidasCalculadas];
}

/** Cortes BEEBLACK para despiece, Excel de órdenes y mesa de tela. */
export function cortesBeeblack(
  variante: VarianteBeeblack,
  anchoCm: number,
  altoCm: number,
  toggles: TogglesBeeblack = {},
  overrides: MedidasBeeblack = {},
  cierreVertical = false,
  instalacion?: string | null,
): CorteBeeblack[] {
  if (!anchoCm || anchoCm <= 0 || !altoCm || altoCm <= 0) return [];

  const m = calcularMedidas(variante, anchoCm, altoCm, cierreVertical, instalacion);
  const perfilSup = aplicarOverride(m.perfilSupAncho, overrides.perfilSupAncho);
  const perfilInf = aplicarOverride(m.perfilInfAncho, overrides.perfilInfAncho);
  const perfilIzq = aplicarOverride(m.perfilLatIzq, overrides.perfilLatIzq);
  const perfilDer = aplicarOverride(m.perfilLatDer, overrides.perfilLatDer);

  const cortes: CorteBeeblack[] = [
    { componente: 'Perfil superior (ancho)', columnaExcel: 'PERFIL SUPERIOR (ANCHO)', medidaCm: perfilSup },
    { componente: 'Perfil inferior (ancho)', columnaExcel: 'PERFIL INFERIOR (ANCHO)', medidaCm: perfilInf },
    { componente: 'Perfil lateral izq (alto)', columnaExcel: 'PERFIL LATERAL IZQ (ALTO)', medidaCm: perfilIzq },
    { componente: 'Perfil lateral der (alto)', columnaExcel: 'PERFIL LATERAL DER (ALTO)', medidaCm: perfilDer },
    // Tela y lamas: columnaExcel '' → NO viajan al Excel de estructura, solo al
    // Cálculo General / Dimensionado y a la mesa de corte (ver tela.ts).
    { componente: 'Ancho tela', columnaExcel: '', medidaCm: aplicarOverride(m.anchoTela, overrides.anchoTela) },
    { componente: 'Alto tela', columnaExcel: '', medidaCm: aplicarOverride(m.altoTela, overrides.altoTela) },
    { componente: 'Total lamas', columnaExcel: '', medidaCm: aplicarOverride(m.totalLamas, overrides.totalLamas) },
  ];

  const manilla = r1(m.manilla);
  if (toggles.manillaIzq) {
    cortes.push({
      componente: 'Manilla izq (alto)',
      columnaExcel: 'MANILLA IZQ (ALTO)',
      medidaCm: aplicarOverride(manilla, overrides.manillaIzq),
      toggle: true,
    });
  }
  if (toggles.manillaDer) {
    cortes.push({
      componente: 'Manilla der (alto)',
      columnaExcel: 'MANILLA DER (ALTO)',
      medidaCm: aplicarOverride(manilla, overrides.manillaDer),
      toggle: true,
    });
  }

  // ── Separadores (E41/E42/E43) ──
  // Mismo criterio que los sistemas de oscuridad: perfil independiente opt-in que
  // hereda la MEDIDA del perfil del mismo lado (laterales → alto; superior e
  // inferior → ancho), salvo override propio.
  const emitSeparador = (
    activo: boolean | undefined,
    columna: string,
    nombre: string,
    override: number | undefined,
    heredada: number,
  ) => {
    if (!activo) return;
    cortes.push({
      componente: nombre,
      columnaExcel: columna,
      medidaCm: aplicarOverride(heredada, override),
      toggle: true,
    });
  };
  emitSeparador(toggles.sepIzq, 'SEPARADOR (IZQ)', 'Separador izquierdo', overrides.sepIzq, perfilIzq);
  emitSeparador(toggles.sepDer, 'SEPARADOR (DER)', 'Separador derecho', overrides.sepDer, perfilDer);
  emitSeparador(toggles.sepSup, 'SEPARADOR SUPERIOR', 'Separador superior', overrides.sepSup, perfilSup);
  emitSeparador(toggles.sepInf, 'SEPARADOR BASE', 'Separador base', overrides.sepInf, perfilInf);

  return cortes;
}
