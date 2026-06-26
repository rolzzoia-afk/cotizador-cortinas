// ─────────────────────────────────────────────────────────────────────
// REGLAS BEEBLACK — fuente: beeblack.xlsx
//
// Cierre horizontal con lamas (no roller ni oscuridad clásica).
// Dos variantes: INTERNO (sentido INTERNO) y EXTERNO_SEMI (EXTERNO/SEMI).
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────

export type VarianteBeeblack = 'INTERNO' | 'EXTERNO_SEMI';

export type TogglesBeeblack = {
  manillaIzq?: boolean;
  manillaDer?: boolean;
  /** +3 cm lado izquierdo del ancho (EXTERNO_SEMI). */
  extraAnchoIzq?: boolean;
  extraAnchoDer?: boolean;
  /** +3 cm extremo superior del alto (EXTERNO_SEMI). */
  extraAltoSup?: boolean;
  extraAltoInf?: boolean;
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
};

export type CorteBeeblack = {
  componente: string;
  columnaExcel: string;
  medidaCm: number;
  /** true si proviene de un toggle ON/OFF. */
  toggle?: boolean;
};

export const VARIANTES_BEEBLACK: VarianteBeeblack[] = ['INTERNO', 'EXTERNO_SEMI'];

export const TOGGLES_BEEBLACK_INTERNO: Array<{ key: keyof TogglesBeeblack; label: string }> = [
  { key: 'manillaIzq', label: 'Manilla izquierda' },
  { key: 'manillaDer', label: 'Manilla derecha' },
];

export const TOGGLES_BEEBLACK_EXTERNO: Array<{ key: keyof TogglesBeeblack; label: string }> = [
  { key: 'extraAnchoIzq', label: 'Extra ancho izquierdo (+3 cm)' },
  { key: 'extraAnchoDer', label: 'Extra ancho derecho (+3 cm)' },
  { key: 'extraAltoSup', label: 'Extra alto superior (+3 cm)' },
  { key: 'extraAltoInf', label: 'Extra alto inferior (+3 cm)' },
  { key: 'manillaIzq', label: 'Manilla izquierda' },
  { key: 'manillaDer', label: 'Manilla derecha' },
];

/** Constantes extraídas del Excel beeblack.xlsx. */
export const CONST_BEEBLACK = {
  holguraCm: 0.7,
  perfilCm: 5,
  manillaCm: 4.3,
  anchoTelaCm: 4,
  altoTelaCm: 2.5,
  lamasDivisor: 1.5,
  lamasExtraCm: 10,
  extraLadoCm: 3,
  manillaExternoSumaCm: 6,
} as const;

const r1 = (n: number) => Math.round(n * 10) / 10;

function aplicarOverride(calculada: number, override: number | undefined): number {
  return typeof override === 'number' && Number.isFinite(override) && override > 0
    ? r1(override)
    : calculada;
}

export function esCategoriaBeeblack(categoria: string | undefined | null): boolean {
  return (categoria || '').toUpperCase().includes('BEEBLACK');
}

/** Mapea sentido Fase 0 → variante BEEBLACK. */
export function normalizarVarianteBeeblack(
  sentido: string | undefined | null,
  fallback: VarianteBeeblack = 'INTERNO',
): VarianteBeeblack {
  const s = (sentido || '').toUpperCase();
  if (s.includes('INTERNO')) return 'INTERNO';
  if (s.includes('EXTERNO') || s.includes('SEMI')) return 'EXTERNO_SEMI';
  return fallback;
}

type MedidasCalculadas = {
  perfilSupAncho: number;
  perfilInfAncho: number;
  perfilLatIzq: number;
  perfilLatDer: number;
  holguraManilla: number;
  anchoTela: number;
  altoTela: number;
  totalLamas: number;
};

function calcularMedidas(
  variante: VarianteBeeblack,
  anchoCm: number,
  altoCm: number,
  toggles: TogglesBeeblack,
): MedidasCalculadas {
  const C = CONST_BEEBLACK;
  const extraAncho =
    (toggles.extraAnchoIzq ? C.extraLadoCm : 0) + (toggles.extraAnchoDer ? C.extraLadoCm : 0);
  const extraAlto =
    (toggles.extraAltoSup ? C.extraLadoCm : 0) + (toggles.extraAltoInf ? C.extraLadoCm : 0);

  if (variante === 'INTERNO') {
    const holguraAncho = anchoCm - C.holguraCm;
    const holguraAlto = altoCm - C.holguraCm;
    const anchoTela = holguraAncho - C.anchoTelaCm;
    return {
      perfilSupAncho: r1(holguraAncho - C.perfilCm),
      perfilInfAncho: r1(holguraAncho - C.perfilCm),
      perfilLatIzq: r1(holguraAlto - C.perfilCm),
      perfilLatDer: r1(holguraAlto - C.perfilCm),
      holguraManilla: r1(altoCm - C.holguraCm),
      anchoTela: r1(anchoTela),
      altoTela: r1(holguraAlto - C.altoTelaCm),
      totalLamas: r1(anchoTela / C.lamasDivisor + C.lamasExtraCm),
    };
  }

  const baseAncho = anchoCm + extraAncho;
  const baseAlto = altoCm + extraAlto;
  const holguraAncho = baseAncho - C.holguraCm;
  const holguraAlto = baseAlto - C.holguraCm;
  const anchoTela = holguraAncho - C.anchoTelaCm;
  return {
    perfilSupAncho: r1(baseAncho - C.perfilCm),
    perfilInfAncho: r1(baseAncho - C.perfilCm),
    perfilLatIzq: r1(baseAlto - C.perfilCm),
    perfilLatDer: r1(baseAlto - C.perfilCm),
    holguraManilla: r1(altoCm + C.manillaExternoSumaCm),
    anchoTela: r1(anchoTela),
    altoTela: r1(holguraAlto - C.altoTelaCm),
    totalLamas: r1(anchoTela / C.lamasDivisor + C.lamasExtraCm),
  };
}

/** Medida calculada de un componente (preview UI). */
export function medidaComponenteBeeblack(
  variante: VarianteBeeblack,
  componente: keyof MedidasCalculadas | 'manillaIzq' | 'manillaDer',
  anchoCm: number,
  altoCm: number,
  toggles: TogglesBeeblack = {},
): number {
  const m = calcularMedidas(variante, anchoCm, altoCm, toggles);
  if (componente === 'manillaIzq' || componente === 'manillaDer') {
    return r1(m.holguraManilla - CONST_BEEBLACK.manillaCm);
  }
  return m[componente as keyof MedidasCalculadas];
}

/** Cortes BEEBLACK para despiece y Excel de órdenes. */
export function cortesBeeblack(
  variante: VarianteBeeblack,
  anchoCm: number,
  altoCm: number,
  toggles: TogglesBeeblack = {},
  overrides: MedidasBeeblack = {},
): CorteBeeblack[] {
  if (!anchoCm || anchoCm <= 0 || !altoCm || altoCm <= 0) return [];

  const m = calcularMedidas(variante, anchoCm, altoCm, toggles);
  const cortes: CorteBeeblack[] = [
    {
      componente: 'Perfil superior (ancho)',
      columnaExcel: 'PERFIL SUPERIOR (ANCHO)',
      medidaCm: aplicarOverride(m.perfilSupAncho, overrides.perfilSupAncho),
    },
    {
      componente: 'Perfil inferior (ancho)',
      columnaExcel: 'PERFIL INFERIOR (ANCHO)',
      medidaCm: aplicarOverride(m.perfilInfAncho, overrides.perfilInfAncho),
    },
    {
      componente: 'Perfil lateral izq (alto)',
      columnaExcel: 'PERFIL LATERAL IZQ (ALTO)',
      medidaCm: aplicarOverride(m.perfilLatIzq, overrides.perfilLatIzq),
    },
    {
      componente: 'Perfil lateral der (alto)',
      columnaExcel: 'PERFIL LATERAL DER (ALTO)',
      medidaCm: aplicarOverride(m.perfilLatDer, overrides.perfilLatDer),
    },
    {
      componente: 'Ancho tela',
      columnaExcel: 'ANCHO TELA',
      medidaCm: aplicarOverride(m.anchoTela, overrides.anchoTela),
    },
    {
      componente: 'Alto tela',
      columnaExcel: 'ALTO TELA',
      medidaCm: aplicarOverride(m.altoTela, overrides.altoTela),
    },
    {
      componente: 'Total lamas corte',
      columnaExcel: 'TOTAL LAMAS CORTE',
      medidaCm: aplicarOverride(m.totalLamas, overrides.totalLamas),
    },
  ];

  const manillaCalc = r1(m.holguraManilla - CONST_BEEBLACK.manillaCm);
  if (toggles.manillaIzq) {
    cortes.push({
      componente: 'Manilla izq (alto)',
      columnaExcel: 'MANILLA IZQ (ALTO)',
      medidaCm: aplicarOverride(manillaCalc, overrides.manillaIzq),
      toggle: true,
    });
  }
  if (toggles.manillaDer) {
    cortes.push({
      componente: 'Manilla der (alto)',
      columnaExcel: 'MANILLA DER (ALTO)',
      medidaCm: aplicarOverride(manillaCalc, overrides.manillaDer),
      toggle: true,
    });
  }

  return cortes;
}
