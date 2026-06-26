// ─────────────────────────────────────────────────────────────────────
// Cenefas declaradas como adicional en Fase 0 (CENF O / CENFO).
// Se vinculan SOLO por UBIC. idéntica a la del adicional (ej. PZA 3-G2).
// El corte usa el ancho real del paño; la cantidad del adicional es referencial.
//
// Fórmulas:
//   · Soft Light 38 mm → cenefa = ancho + ajuste (INTERNO: −1,2 → ej. 295,7)
//   · Roller cenefa ovalada → tapa = ancho − dcto_cenefa (ej. −1,5); el tubo
//     va detrás (ancho − dcto_tubo − dcto_cenefa). La tapa es la más ancha.
// ─────────────────────────────────────────────────────────────────────
import type { AdicionalFase0Persistido } from '@/modules/ots/types';
import { medidaCenefaSoftLight38, varianteSoftLight38 } from './reglas-soft-light';
import type { ModeloDespiece } from './tipos';

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Descuentos cenefa ovalada manual 38 mm (catálogo roller). */
const DCTO_CENEFA_OVALADA_38 = { tubo: 1.8, cenefa: 1.5 };

const CODIGOS_CENEFA_OVALADA = new Set(['CENF O', 'CENFO', 'CENEFA OVALADA']);
const CODIGOS_CENEFA_CUADRADA = new Set(['CENF C', 'CENFC', 'CEN-PRO', 'CEN PRO']);

export type EtiquetaConTira = 'CON TIRA' | 'SIN TIRA';

export type ContextoCenefaAdicional = {
  anchoPanoCm?: number;
  categoria?: string;
  sentido?: string | null;
};

export function normalizarUbicacion(ubic: string): string {
  return ubic.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function esAdicionalCenefaOvalada(codInt: string): boolean {
  const c = codInt.trim().toUpperCase();
  return CODIGOS_CENEFA_OVALADA.has(c) || c.includes('CENEFA OVALADA');
}

export function esAdicionalCenefaCuadrada(codInt: string): boolean {
  const c = codInt.trim().toUpperCase();
  return CODIGOS_CENEFA_CUADRADA.has(c) || c.includes('CENEFA CUAD');
}

export function esAdicionalCenefa(codInt: string): boolean {
  return esAdicionalCenefaOvalada(codInt) || esAdicionalCenefaCuadrada(codInt);
}

// ── Cenefa CUADRADA en roller / vertical (cuadro de la hoja de órdenes) ──
// El TIP. INST sale del "Tapas" del paño (OPCIONES_CENEFA_TAPA, Fase 2).

/** Categoría roller o vertical (única donde aplica el cuadro de cenefa cuadrada). */
export function esRollerOVertical(categoria: string | undefined | null): boolean {
  const c = (categoria || '').toUpperCase();
  return c.startsWith('ROL') || c.includes('VERTICAL');
}

/**
 * Ajuste (cm) al ancho de corte de la cenefa cuadrada según el tipo de
 * instalación: CON 1 TAPA +1 · CON 2 TAPAS +2 · MURO A MURO −0,5.
 * MURO_MURO es la opción base (incluye el legacy SIN_TAPA: son lo mismo).
 */
export function ajusteCenefaCuadradaCm(tipInst: string | undefined): number {
  switch ((tipInst || '').toUpperCase().trim()) {
    case 'CON_1_TAPA':
      return 1;
    case 'CON_2_TAPAS':
      return 2;
    case 'MURO_MURO':
    case 'SIN_TAPA': // legacy → muro a muro
    default:
      return -0.5;
  }
}

/** Ancho de corte estimado de la cenefa cuadrada = ancho inicial + ajuste. */
export function medidaCorteCenefaCuadrada(anchoInicialCm: number, tipInst: string | undefined): number {
  if (!(anchoInicialCm > 0)) return 0;
  return r1(anchoInicialCm + ajusteCenefaCuadradaCm(tipInst));
}

/** Etiqueta de TIP. INST para la hoja de órdenes (vacío/legacy → MURO_MURO). */
export function etiquetaTipInstCenefa(tipInst: string | undefined): string {
  const c = (tipInst || '').toUpperCase().trim();
  return c === 'CON_1_TAPA' || c === 'CON_2_TAPAS' ? c : 'MURO_MURO';
}

/** Tipo de cenefa Fase 2 a partir del codInt del adicional Fase 0. */
export function tipoCenefaDesdeAdicional(codInt: string): 'Ovalada' | 'Cuadrada' | null {
  if (esAdicionalCenefaOvalada(codInt)) return 'Ovalada';
  if (esAdicionalCenefaCuadrada(codInt)) return 'Cuadrada';
  return null;
}

/** UBIC. de un paño (igual que el Excel de órdenes). */
export function ubicPanoVentana(ubicacionVentana: string, panoIndex: number, totalPanos: number): string {
  return `${ubicacionVentana || ''}${totalPanos > 1 ? `-G${panoIndex + 1}` : ''}`.trim();
}

export function etiquetaConTira(val?: boolean | string | null): EtiquetaConTira {
  if (val === true) return 'CON TIRA';
  const s = String(val ?? '').toUpperCase().trim();
  if (s === 'CON TIRA' || s === 'SI' || s === 'SÍ' || s === 'X') return 'CON TIRA';
  return 'SIN TIRA';
}

export function buscarAdicionalCenefaEnUbic(
  ubicFila: string,
  adicionales: AdicionalFase0Persistido[] | undefined,
): AdicionalFase0Persistido | null {
  if (!adicionales?.length) return null;
  const key = normalizarUbicacion(ubicFila);
  if (!key) return null;
  for (const adicional of adicionales) {
    if (!adicional.codInt || !(adicional.cantidad > 0)) continue;
    if (!esAdicionalCenefa(adicional.codInt)) continue;
    if (normalizarUbicacion(adicional.ubicacion || '') === key) return adicional;
  }
  return null;
}

export function ubicacionCoincideConAdicional(ubicFila: string, ubicAdicional: string): boolean {
  const fila = normalizarUbicacion(ubicFila);
  const adic = normalizarUbicacion(ubicAdicional);
  return !!fila && fila === adic;
}

export function buscarAdicionalCenefaOvalada(
  ubicFila: string,
  adicionales: AdicionalFase0Persistido[] | undefined,
): AdicionalFase0Persistido | null {
  if (!adicionales?.length) return null;
  const key = normalizarUbicacion(ubicFila);
  if (!key) return null;
  for (const adicional of adicionales) {
    if (!adicional.codInt || !(adicional.cantidad > 0)) continue;
    if (!esAdicionalCenefaOvalada(adicional.codInt)) continue;
    if (normalizarUbicacion(adicional.ubicacion || '') === key) return adicional;
  }
  return null;
}

function dctosCenefaOvaladaRoller(modelo: ModeloDespiece): { tubo: number; cenefa: number } {
  if (
    (modelo.sistema === 'CENEFA_OVALADA' || modelo.sistema === 'CENEFA_OVALADA_DUO') &&
    modelo.dcto_cenefa_cm > 0
  ) {
    return { tubo: modelo.dcto_tubo_cm, cenefa: modelo.dcto_cenefa_cm };
  }
  return DCTO_CENEFA_OVALADA_38;
}

export function medidaCorteCenefaOvaladaRoller(anchoNominalCm: number, modelo: ModeloDespiece): number | null {
  if (!anchoNominalCm || anchoNominalCm <= 0) return null;
  // La cenefa ovalada (tapa) se corta al ancho menos su propio despeje, NO el del
  // tubo: es la pieza más ancha (igual que el despiece del modelo).
  const { cenefa } = dctosCenefaOvaladaRoller(modelo);
  return r1(anchoNominalCm - cenefa);
}

/** @deprecated alias */
export const medidaCorteCenefaOvalada = medidaCorteCenefaOvaladaRoller;

export function anchoNominalCenefaCorte(
  adicional: AdicionalFase0Persistido,
  anchoPanoCm: number,
): number {
  if (anchoPanoCm > 0) return anchoPanoCm;
  return adicional.cantidad * 100;
}

export function cenefaOvaladaDesdeAdicional(
  adicional: AdicionalFase0Persistido,
  modelo: ModeloDespiece,
  ctx: ContextoCenefaAdicional = {},
): number | null {
  const ancho = anchoNominalCenefaCorte(adicional, ctx.anchoPanoCm ?? 0);
  if (!ancho || ancho <= 0) return null;

  const varianteSl = varianteSoftLight38({
    categoria: ctx.categoria,
    sentido: ctx.sentido,
    modelo,
  });
  if (varianteSl) {
    return medidaCenefaSoftLight38(ancho, varianteSl);
  }
  return medidaCorteCenefaOvaladaRoller(ancho, modelo);
}

export function indexCenefasOvaladasAdicionales(
  adicionales: AdicionalFase0Persistido[] | undefined,
): Map<string, AdicionalFase0Persistido> {
  const map = new Map<string, AdicionalFase0Persistido>();
  if (!adicionales?.length) return map;
  for (const a of adicionales) {
    if (!a.codInt || !(a.cantidad > 0)) continue;
    if (!esAdicionalCenefaOvalada(a.codInt)) continue;
    const key = normalizarUbicacion(a.ubicacion || '');
    if (!key || map.has(key)) continue;
    map.set(key, a);
  }
  return map;
}
