// ─────────────────────────────────────────────────────────────────────
// REGLAS SOFT LIGHT 38 mm — SISTEMAS OSCURIDAD.xlsx
//
// Tres variantes según instalación (sentido de la cortina en Fase 0):
//   INTERNO → cenefa = ancho − 1.2
//   SEMI    → cenefa = ancho + 6.6
//   EXTERNO → cenefa = ancho + 13.2
// Luego, para todas:
//   tubo = cenefa − 1.8
//   peso = cenefa − 5.8
//   tela = peso − 0.2
// ─────────────────────────────────────────────────────────────────────
import type { ModeloDespiece } from './tipos';

export type VarianteSoftLight = 'INTERNO' | 'SEMI' | 'EXTERNO';

export type CortesSoftLight38 = {
  tubo: number;
  peso: number;
  tela: number;
};

const DCTO_TUBO_DESDE_CENEFA = 1.8;
const DCTO_PESO_DESDE_CENEFA = 5.8;
const DCTO_TELA_DESDE_PESO = 0.2;

/** Ajuste sobre el ancho nominal para obtener la medida de cenefa (cm). */
export const SOFT_LIGHT_38_AJUSTE_CENEFA: Record<VarianteSoftLight, number> = {
  INTERNO: -1.2,
  SEMI: 6.6,
  EXTERNO: 13.2,
};

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

export function cortesSoftLight38(anchoCm: number, variante: VarianteSoftLight): CortesSoftLight38 {
  const cenefa = medidaCenefaSoftLight38(anchoCm, variante);
  const tubo = cenefa - DCTO_TUBO_DESDE_CENEFA;
  const peso = cenefa - DCTO_PESO_DESDE_CENEFA;
  return {
    tubo: r1(tubo),
    peso: r1(peso),
    tela: r1(peso - DCTO_TELA_DESDE_PESO),
  };
}

/** Medida de cenefa Soft Light 38 mm (cm) según variante interno/semi/externo. */
export function medidaCenefaSoftLight38(anchoCm: number, variante: VarianteSoftLight): number {
  return r1(anchoCm + SOFT_LIGHT_38_AJUSTE_CENEFA[variante]);
}
