// ─────────────────────────────────────────────────────────────────────
// Colores de perfiles (sistemas de oscuridad) desde adicionales Fase 0.
//
// En la grilla de adicionales, cada perfil lleva:
//   · codInt: P-IZQ / P-DER / SOFTLIZQ / SOFTLDER / …
//   · ubicacion: PERFIL IZQ / PERFIL DEF / PERFIL INF  (tipo de perfil)
//   · colorAcc: CAFÉ, BLANCO, …
//
// El Excel de órdenes usa la columna COLOR PERFIL (optimizador legacy)
// junto a PERFIL (IZQ) INT / PERFIL (DER) INT / PERFIL BASE.
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────
import type { AdicionalFase0Persistido } from '@/modules/ots/types';
import { normalizarUbicacion } from './adicionales-cenefa';

export type TipoPerfilAdicional = 'izq' | 'der' | 'inf';

const CODIGOS_PERFIL_IZQ = new Set(['P-IZQ', 'SOFTLIZQ', 'P IZQ']);
const CODIGOS_PERFIL_DER = new Set(['P-DER', 'SOFTLDER', 'P DEF']);
const CODIGOS_PERFIL_INF = new Set(['P-INF', 'P INF']);

const UBIC_PERFIL_IZQ = new Set(['PERFIL IZQ']);
const UBIC_PERFIL_DER = new Set(['PERFIL DEF', 'PERFIL DER', 'PERFIL DERECHO']);
const UBIC_PERFIL_INF = new Set(['PERFIL INF', 'PERFIL INFERIOR']);

function normalizarCodInt(codInt: string): string {
  return codInt.trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Familia del adicional según codInt (para preferir SOFT vs OSCURANTI). */
function familiaAdicional(codInt: string): 'SOFT' | 'OSCURA' | 'OTRO' {
  const c = normalizarCodInt(codInt);
  if (c === 'SOFTLDER' || c === 'SOFTLIZQ' || c.startsWith('SOFT')) return 'SOFT';
  if (c === 'P-DER' || c === 'P-IZQ' || c === 'P-INF' || c === 'CEN-PRO' || c.startsWith('P-')) {
    return 'OSCURA';
  }
  return 'OTRO';
}

function familiaCategoria(categoria: string | undefined | null): 'SOFT' | 'OSCURA' | 'OTRO' {
  const cat = (categoria || '').trim().toUpperCase();
  if (cat.includes('SOFT_LIGHT')) return 'SOFT';
  if (cat.includes('OSCURANTI') || cat.includes('DARK')) return 'OSCURA';
  return 'OTRO';
}

function tipoPerfilDeAdicional(adic: AdicionalFase0Persistido): TipoPerfilAdicional | null {
  if (!(adic.cantidad > 0) || !adic.codInt?.trim()) return null;
  const cod = normalizarCodInt(adic.codInt);
  const ubic = normalizarUbicacion(adic.ubicacion || '');

  if (CODIGOS_PERFIL_IZQ.has(cod) || UBIC_PERFIL_IZQ.has(ubic)) return 'izq';
  if (CODIGOS_PERFIL_DER.has(cod) || UBIC_PERFIL_DER.has(ubic)) return 'der';
  if (CODIGOS_PERFIL_INF.has(cod) || UBIC_PERFIL_INF.has(ubic)) return 'inf';
  // Inferior oscuranti sin codInt estándar: ubicación PERFIL INF
  if (ubic === 'PERFIL INF') return 'inf';
  return null;
}

function puntajeAdicional(adic: AdicionalFase0Persistido, categoria: string | undefined | null): number {
  const famAdic = familiaAdicional(adic.codInt);
  const famCat = familiaCategoria(categoria);
  if (famCat !== 'OTRO' && famAdic === famCat) return 2;
  if (famAdic !== 'OTRO') return 1;
  return 0;
}

/** Busca el adicional de perfil (izq/der/inf) más acorde a la categoría de la ventana. */
export function buscarAdicionalPerfil(
  tipo: TipoPerfilAdicional,
  adicionales: AdicionalFase0Persistido[] | undefined,
  categoria?: string | null,
): AdicionalFase0Persistido | null {
  if (!adicionales?.length) return null;
  let mejor: AdicionalFase0Persistido | null = null;
  let mejorPuntaje = -1;
  for (const adic of adicionales) {
    if (tipoPerfilDeAdicional(adic) !== tipo) continue;
    const p = puntajeAdicional(adic, categoria);
    if (p > mejorPuntaje) {
      mejor = adic;
      mejorPuntaje = p;
    }
  }
  return mejor;
}

/** Color del perfil desde adicionales Fase 0. */
export function colorPerfilDesdeAdicional(
  tipo: TipoPerfilAdicional,
  adicionales: AdicionalFase0Persistido[] | undefined,
  categoria?: string | null,
): string {
  const adic = buscarAdicionalPerfil(tipo, adicionales, categoria);
  return (adic?.colorAcc || '').trim();
}

/**
 * COLOR PERFIL para una fila del Excel de órdenes.
 * Prioridad: izquierdo → derecho → inferior (columna única del optimizador).
 */
export function colorPerfilFilaExcel(
  adicionales: AdicionalFase0Persistido[] | undefined,
  categoria: string | undefined | null,
  perfilesActivos: { izq?: boolean; der?: boolean; inf?: boolean },
): string {
  if (perfilesActivos.izq) {
    const c = colorPerfilDesdeAdicional('izq', adicionales, categoria);
    if (c) return c;
  }
  if (perfilesActivos.der) {
    const c = colorPerfilDesdeAdicional('der', adicionales, categoria);
    if (c) return c;
  }
  if (perfilesActivos.inf) {
    const c = colorPerfilDesdeAdicional('inf', adicionales, categoria);
    if (c) return c;
  }
  return '';
}
