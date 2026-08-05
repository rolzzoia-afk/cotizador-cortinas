// ─────────────────────────────────────────────────────────────────────
// REGLAS SOFT LIGHT 38 mm — SISTEMAS OSCURIDAD.xlsx
//
// Solo lo usa la cenefa comprada como ADICIONAL (CENF O) en Fase 0: el paño
// se corta con el motor de `reglas-oscuridad.ts`, que es el vigente.
//
// Tres variantes según instalación (sentido de la cortina en Fase 0):
//   INTERNO → cenefa = ancho − 1.2
//   SEMI    → cenefa = ancho + 6.6
//   EXTERNO → cenefa = ancho + 13.2
// Luego, para todas:
//   tubo = cenefa − 1.8
//   peso = cenefa − 5.8
//   tela = peso − 0.2
//
// El ajuste de cenefa NO se declara acá: sale de la MISMA tabla que corta el
// paño (`formulas.oscuridad.cenefaAdj.SOFT_LIGHT_38`). Antes era una copia y
// editar una sin la otra dejaba la cenefa del adicional desalineada de la del
// paño para la misma ventana.
// ─────────────────────────────────────────────────────────────────────
import { FORMULAS_DEFAULT, type FormulasFamilias } from './formulasFamilias';
import type { ModeloDespiece } from './tipos';

export type VarianteSoftLight = 'INTERNO' | 'SEMI' | 'EXTERNO';

export type CortesSoftLight38 = {
  tubo: number;
  peso: number;
  tela: number;
};

/** Índice de la variante en las tablas de oscuridad ([INTERNO, SEMI, EXTERNO]). */
const VI: Record<VarianteSoftLight, 0 | 1 | 2> = { INTERNO: 0, SEMI: 1, EXTERNO: 2 };

/** Ajuste sobre el ancho nominal para obtener la medida de cenefa (cm). */
export function ajusteCenefaSoftLight38(
  variante: VarianteSoftLight,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): number {
  return formulas.oscuridad.cenefaAdj.SOFT_LIGHT_38[VI[variante]];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function esCategoriaSoftLight38(categoria: string | undefined): boolean {
  return (categoria || '').trim().toUpperCase() === 'SOFT_LIGHT_38MM';
}

/** Variante Soft Light 38 mm: prioriza sentido de la ventana, luego tipo_rol del modelo. */
export function varianteSoftLight38(opts: {
  categoria?: string;
  sentido?: string | null;
  modelo?: ModeloDespiece | null;
}): VarianteSoftLight | null {
  if (!esCategoriaSoftLight38(opts.categoria)) return null;

  const sentido = (opts.sentido || '').toUpperCase();
  if (sentido.includes('INTERNO')) return 'INTERNO';
  if (sentido.includes('EXTERNO')) return 'EXTERNO';
  if (sentido.includes('SEMI')) return 'SEMI';

  const tipo = (opts.modelo?.tipo_rol || '').toUpperCase();
  if (tipo.includes('INTERNO')) return 'INTERNO';
  if (tipo.includes('EXTERNO')) return 'EXTERNO';
  if (tipo.includes('SEMI')) return 'SEMI';

  return 'INTERNO';
}

export function cortesSoftLight38(
  anchoCm: number,
  variante: VarianteSoftLight,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): CortesSoftLight38 {
  const a = formulas.adicionales;
  const cenefa = medidaCenefaSoftLight38(anchoCm, variante, formulas);
  const tubo = cenefa - a.softLightTuboDesdeCenefaCm;
  const peso = cenefa - a.softLightPesoDesdeCenefaCm;
  return {
    tubo: r1(tubo),
    peso: r1(peso),
    tela: r1(peso - a.softLightTelaDesdePesoCm),
  };
}

/** Medida de cenefa Soft Light 38 mm (cm) según variante interno/semi/externo. */
export function medidaCenefaSoftLight38(
  anchoCm: number,
  variante: VarianteSoftLight,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): number {
  return r1(anchoCm + ajusteCenefaSoftLight38(variante, formulas));
}
