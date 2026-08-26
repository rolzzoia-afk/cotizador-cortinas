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
import { categoriaEfectiva, type TipoCortina } from './tiposCortina';

export type TipoPerfilAdicional = 'izq' | 'der' | 'inf';

const CODIGOS_PERFIL_IZQ = new Set(['P-IZQ', 'SOFTLIZQ', 'P IZQ']);
const CODIGOS_PERFIL_DER = new Set(['P-DER', 'SOFTLDER', 'P DEF']);
const CODIGOS_PERFIL_INF = new Set(['P-INF', 'P INF']);

// Adicionales que cubren TODOS los perfiles de una cortina en vez de un lado:
// «SISTEMA DARK ROLLER» (DARK) y «PERFIL ADICIONAL» (P-ADI). Se venden por
// VENTANA —una fila por ubicación, cada una con su color— así que no se pueden
// resolver por codInt como los P-IZQ/P-DER/P-INF: hay que calzar la UBIC.
const CODIGOS_PERFIL_SISTEMA = new Set(['DARK', 'P-ADI', 'P ADI']);

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

function familiaCategoria(
  categoria: string | undefined | null,
  tipos?: readonly TipoCortina[],
): 'SOFT' | 'OSCURA' | 'OTRO' {
  const cat = categoriaEfectiva(categoria, tipos).trim().toUpperCase();
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

function puntajeAdicional(
  adic: AdicionalFase0Persistido,
  categoria: string | undefined | null,
  tipos?: readonly TipoCortina[],
): number {
  const famAdic = familiaAdicional(adic.codInt);
  const famCat = familiaCategoria(categoria, tipos);
  if (famCat !== 'OTRO' && famAdic === famCat) return 2;
  if (famAdic !== 'OTRO') return 1;
  return 0;
}

/** Busca el adicional de perfil (izq/der/inf) más acorde a la categoría de la ventana. */
export function buscarAdicionalPerfil(
  tipo: TipoPerfilAdicional,
  adicionales: AdicionalFase0Persistido[] | undefined,
  categoria?: string | null,
  tipos?: readonly TipoCortina[],
): AdicionalFase0Persistido | null {
  if (!adicionales?.length) return null;
  let mejor: AdicionalFase0Persistido | null = null;
  let mejorPuntaje = -1;
  for (const adic of adicionales) {
    if (tipoPerfilDeAdicional(adic) !== tipo) continue;
    const p = puntajeAdicional(adic, categoria, tipos);
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
  tipos?: readonly TipoCortina[],
): string {
  const adic = buscarAdicionalPerfil(tipo, adicionales, categoria, tipos);
  return (adic?.colorAcc || '').trim();
}

export function esAdicionalPerfilSistema(codInt: string): boolean {
  return CODIGOS_PERFIL_SISTEMA.has(normalizarCodInt(codInt));
}

/**
 * ¿El adicional es un perfil, por lado o de sistema? Los perfiles se CORTAN de
 * la barra: salen en la hoja de estructura con su medida, no como una pieza que
 * la bodega retira de un rack.
 */
export function esAdicionalPerfil(codInt: string): boolean {
  const c = normalizarCodInt(codInt);
  return (
    CODIGOS_PERFIL_IZQ.has(c) ||
    CODIGOS_PERFIL_DER.has(c) ||
    CODIGOS_PERFIL_INF.has(c) ||
    CODIGOS_PERFIL_SISTEMA.has(c)
  );
}

/**
 * Color de los perfiles declarado en un adicional de SISTEMA (DARK / P-ADI)
 * para la fila de `ubicFila`.
 *
 * La UBIC. de la fila puede traer sufijo de paño (" P2" en el optimizador,
 * "-G2" en el Excel) y la del adicional suele ser la general, así que se acepta
 * igual, misma base o prefijo — mismo criterio que `anchoCenefaCuadradaDeclaradoCm`.
 * Un adicional SIN ubicación vale para toda la OT, pero pierde contra cualquiera
 * que sí calce.
 *
 * Sin ubicación en la fila (la vista de Fase 2 no la conoce) solo responde si
 * TODOS los adicionales de sistema traen el mismo color: con dos colores
 * distintos y nada que los desempate es mejor no contestar que contestar mal.
 */
export function colorPerfilSistemaDesdeAdicional(
  adicionales: AdicionalFase0Persistido[] | undefined,
  ubicFila?: string,
): string {
  if (!adicionales?.length) return '';
  const candidatos = adicionales.filter(
    (a) =>
      !!a.codInt &&
      a.cantidad > 0 &&
      esAdicionalPerfilSistema(a.codInt) &&
      !!(a.colorAcc || '').trim(),
  );
  if (!candidatos.length) return '';

  const key = normalizarUbicacion(ubicFila || '');
  const base = key.replace(/(?:\s+P|-G)\d+$/, '');
  let mejor: { rango: number; color: string } | null = null;
  for (const a of candidatos) {
    const ubic = normalizarUbicacion(a.ubicacion || '');
    let rango: number;
    if (!ubic) rango = 3;
    else if (!key) continue;
    else if (ubic === key) rango = 0;
    else if (base && ubic === base) rango = 1;
    else if (base && (ubic.startsWith(base) || base.startsWith(ubic))) rango = 2;
    else continue;
    if (!mejor || rango < mejor.rango) mejor = { rango, color: (a.colorAcc as string).trim() };
  }
  if (mejor) return mejor.color;

  if (key) return '';
  const colores = new Set(candidatos.map((a) => (a.colorAcc as string).trim().toUpperCase()));
  return colores.size === 1 ? (candidatos[0].colorAcc as string).trim() : '';
}

/**
 * COLOR PERFIL para una fila del Excel de órdenes.
 * Prioridad: izquierdo → derecho → inferior (columna única del optimizador).
 */
export function colorPerfilFilaExcel(
  adicionales: AdicionalFase0Persistido[] | undefined,
  categoria: string | undefined | null,
  perfilesActivos: { izq?: boolean; der?: boolean; inf?: boolean },
  tipos?: readonly TipoCortina[],
): string {
  if (perfilesActivos.izq) {
    const c = colorPerfilDesdeAdicional('izq', adicionales, categoria, tipos);
    if (c) return c;
  }
  if (perfilesActivos.der) {
    const c = colorPerfilDesdeAdicional('der', adicionales, categoria, tipos);
    if (c) return c;
  }
  if (perfilesActivos.inf) {
    const c = colorPerfilDesdeAdicional('inf', adicionales, categoria, tipos);
    if (c) return c;
  }
  return '';
}
