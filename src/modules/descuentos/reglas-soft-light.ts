// ─────────────────────────────────────────────────────────────────────
// REGLAS SOFT LIGHT (38 y 45 mm) — SISTEMAS OSCURIDAD.xlsx
//
// Solo lo usa la cenefa comprada como ADICIONAL (CENF O) en Fase 0: el paño
// se corta con el motor de `reglas-oscuridad.ts`, que es el vigente.
//
// Tres variantes según instalación (`oscuridadVariante`, elegida en Fase 2):
//   38 mm → INTERNO: ancho − 1,2 · SEMI: + 6,6 · EXTERNO: + 13,2
//   45 mm → INTERNO: ancho − 1,5 · SEMI: + 6,6 · EXTERNO: + 13,2
// Luego, para todas:
//   tubo = cenefa − 1.8
//   peso = cenefa − 5.8
//   tela = peso − 0.2
//
// El ajuste de cenefa NO se declara acá: sale de la MISMA tabla que corta el
// paño (`formulas.oscuridad.cenefaAdj`). Antes era una copia y editar una sin
// la otra dejaba la cenefa del adicional desalineada de la del paño para la
// misma ventana. Por el mismo motivo la FAMILIA la resuelve
// `familiaOscuridadConDiametro`, que es la que usa el motor: un soft light 38
// montado sobre tubo de 45 (banda E78) corta como 45.
// ─────────────────────────────────────────────────────────────────────
import { FORMULAS_DEFAULT, type FormulasFamilias } from './formulasFamilias';
import { familiaOscuridadConDiametro } from './reglas-oscuridad';
import type { ModeloDespiece } from './tipos';
import type { TipoCortina } from './tiposCortina';

export type VarianteSoftLight = 'INTERNO' | 'SEMI' | 'EXTERNO';

/** Familias de soft light con cenefa OVALADA (la cuadrada tiene pizarra propia). */
export type FamiliaCenefaSoftLight = 'SOFT_LIGHT_38' | 'SOFT_LIGHT_45';

export type CortesSoftLight38 = {
  tubo: number;
  peso: number;
  tela: number;
};

/** Índice de la variante en las tablas de oscuridad ([INTERNO, SEMI, EXTERNO]). */
const VI: Record<VarianteSoftLight, 0 | 1 | 2> = { INTERNO: 0, SEMI: 1, EXTERNO: 2 };

/** Ajuste sobre el ancho nominal para obtener la medida de cenefa (cm). */
export function ajusteCenefaSoftLight(
  familia: FamiliaCenefaSoftLight,
  variante: VarianteSoftLight,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): number {
  return formulas.oscuridad.cenefaAdj[familia][VI[variante]];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Familia y variante de la cenefa OVALADA de un soft light, o null si la
 * cortina no es soft light. La familia sigue al motor (categoría + diámetro del
 * tubo); la variante se lee EN EL MISMO ORDEN que el despiece del paño
 * (`oscuridadVariante` → `sentido` → tipo_rol del modelo).
 *
 * OJO: desde que la oscuridad cae INTERNO fija (PR #207), `sentido` ya NO trae
 * la variante — esa vive en `oscuridadVariante` (paño o ventana). Leer solo el
 * sentido dejaba la cenefa del adicional siempre en INTERNO mientras el tubo y
 * el peso del mismo paño salían EXTERNO: tubo 230,7 > cenefa 218,1 (OT 3196,
 * lo pilló el dueño 2026-08-20). El `sentido` queda como respaldo para las
 * filas anteriores al cambio, que guardaban la variante ahí.
 */
export function varianteSoftLight(opts: {
  categoria?: string;
  oscuridadVariante?: string | null;
  sentido?: string | null;
  modelo?: ModeloDespiece | null;
  tipos?: readonly TipoCortina[];
}): { familia: FamiliaCenefaSoftLight; variante: VarianteSoftLight } | null {
  // La cenefa del adicional CENF O es ovalada por definición → cenefaTipo null.
  const fam = familiaOscuridadConDiametro(
    opts.categoria,
    null,
    opts.modelo?.diametro_tubo_mm,
    opts.tipos,
  );
  if (fam !== 'SOFT_LIGHT_38' && fam !== 'SOFT_LIGHT_45') return null;
  return {
    familia: fam,
    variante:
      varianteDeTexto(opts.oscuridadVariante) ??
      varianteDeTexto(opts.sentido) ??
      varianteDeTexto(opts.modelo?.tipo_rol) ??
      'INTERNO',
  };
}

function varianteDeTexto(valor: string | null | undefined): VarianteSoftLight | null {
  const s = (valor || '').toUpperCase();
  if (s.includes('INTERNO')) return 'INTERNO';
  if (s.includes('EXTERNO')) return 'EXTERNO';
  if (s.includes('SEMI')) return 'SEMI';
  return null;
}

export function cortesSoftLight38(
  anchoCm: number,
  variante: VarianteSoftLight,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): CortesSoftLight38 {
  const a = formulas.adicionales;
  const cenefa = medidaCenefaSoftLight(anchoCm, 'SOFT_LIGHT_38', variante, formulas);
  const tubo = cenefa - a.softLightTuboDesdeCenefaCm;
  const peso = cenefa - a.softLightPesoDesdeCenefaCm;
  return {
    tubo: r1(tubo),
    peso: r1(peso),
    tela: r1(peso - a.softLightTelaDesdePesoCm),
  };
}

/** Medida de cenefa de un soft light (cm) según familia y variante. */
export function medidaCenefaSoftLight(
  anchoCm: number,
  familia: FamiliaCenefaSoftLight,
  variante: VarianteSoftLight,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): number {
  return r1(anchoCm + ajusteCenefaSoftLight(familia, variante, formulas));
}
