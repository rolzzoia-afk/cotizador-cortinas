// ─────────────────────────────────────────────────────────────────────
// Códigos de inventario BEEBLACK por componente y color.
// Tabla extensible — completar cuando se definan los códigos E**.
// Formato Excel: "E24 [BLANCO]" (mismo patrón que peso oscuridad).
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────

import { colorPesoNormalizado } from './peso-oscuridad';

export type ComponenteBeeblackCodigo =
  | 'PERFIL_SUPERIOR_ANCHO'
  | 'PERFIL_INFERIOR_ANCHO'
  | 'PERFIL_LATERAL_IZQ'
  | 'PERFIL_LATERAL_DER'
  | 'MANILLA'
  | 'ANCHO_TELA'
  | 'ALTO_TELA'
  | 'LAMAS';

/** Código inventario por componente × color. Vacío = pendiente de definir. */
const CODIGOS_BEEBLACK: Partial<Record<ComponenteBeeblackCodigo, Record<string, string>>> = {
  // Ejemplo extensible cuando el taller entregue códigos:
  // MANILLA: { BLANCO: 'E99', NEGRO: 'E100' },
};

/** Código de inventario para un componente BEEBLACK y color dado. */
export function codigoBeeblack(
  componente: ComponenteBeeblackCodigo,
  color: string | undefined | null,
): string {
  const colorNorm = colorPesoNormalizado(color);
  if (!colorNorm) return '';
  return CODIGOS_BEEBLACK[componente]?.[colorNorm] || '';
}

/** Valor columna CODIGO/COLOR del Excel: "E99 [BLANCO]" o solo color si falta código. */
export function codigoColorBeeblackExcel(
  componente: ComponenteBeeblackCodigo,
  color: string | undefined | null,
): string {
  const colorNorm = colorPesoNormalizado(color);
  if (!colorNorm) return '';
  const cod = codigoBeeblack(componente, colorNorm);
  return cod ? `${cod} [${colorNorm}]` : colorNorm;
}
