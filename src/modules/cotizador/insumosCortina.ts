// ─────────────────────────────────────────────────────────────────────
// INSUMOS DE CORTINA — reglas puras para tapas de peso, tornillos, brackets,
// tarugos de vulcanita y kits de motor. Fuente ÚNICA que consumen el BOM de
// Fase 4 (bom.ts → orden_materiales) y el PDF de inventario (pdfInventario.ts).
//
// Todos los códigos calzan con la tabla Supabase `insumos` (van en la
// especificación del BomItem para que el bodeguero enlace stock).
// Módulo puro (sin React/Supabase).
// ─────────────────────────────────────────────────────────────────────
import type { Pano, Ventana } from './types';
import { esCenefaCuadrada } from './fase2';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { normalizarColorAccesorio } from '@/modules/descuentos/reglas-mecanismo';

export type InsumoCortina = {
  /** Código del insumo (TAP01, TOR02, BRA01, TAR01, DOM38…), sin corchetes. */
  codigo: string;
  descripcion: string;
  color: string;
  cantidad: number;
};

// ── Tapas de peso (por color de accesorios y lado) ───────────────────
// Solo cortinas roller. Cada paño lleva 1 tapa izquierda + 1 derecha del
// color de accesorios, más 2 tornillos TOR02.
export const TAPAS_PESO_POR_COLOR: Record<
  'BCO' | 'NEG' | 'GRS',
  { izq: string; der: string }
> = {
  BCO: { izq: 'TAP19', der: 'TAP01' },
  NEG: { izq: 'TAP04', der: 'TAP05' },
  GRS: { izq: 'TAP20', der: 'TAP10' },
};

const NOMBRE_TAPA: Record<string, string> = {
  TAP01: 'TAPA PESO BLANCO ROLLER [DERECHO]',
  TAP19: 'TAPA PESO BLANCO ROLLER [IZQUIERDO]',
  TAP04: 'TAPA PESO NEGRO ROLLER [IZQUIERDA]',
  TAP05: 'TAPA PESO NEGRO ROLLER [DERECHA]',
  TAP10: 'TAPA PESO GRIS ROLLER [DERECHO]',
  TAP20: 'TAPA PESO GRIS ROLLER [IZQUIERDO]',
};

export const COD_TORNILLO_TAPA = 'TOR02';
export const NOMBRE_TORNILLO_TAPA = 'TORNILLO TAPA PESO ROLLER 4X1/4"';
export const TORNILLOS_TAPA_PESO_POR_PANO = 2;
export const TORNILLOS_CENEFA_OVALADA = 6; // por cenefa ovalada (decisión 2026-07-09: TOR02)

export const COD_TARUGO = 'TAR01';
export const NOMBRE_TARUGO = 'TARUGO VOLCANITA (COLA DE CHANCHO)';

/** Color de accesorios normalizado a BCO/NEG/GRS, o null si no aplica (MET, CAFÉ, vacío). */
function colorTapaCorto(color: string | null | undefined): 'BCO' | 'NEG' | 'GRS' | null {
  const c = normalizarColorAccesorio(color);
  if (c === 'BCO' || c === 'BLANCO') return 'BCO';
  if (c === 'NEG' || c === 'NEGRO') return 'NEG';
  if (c === 'GRS' || c === 'GRIS') return 'GRS';
  return null;
}

/** ¿La categoría lleva peso inferior con tapas de peso? Solo roller (incluye
 *  motorizados y cenefa ovalada; excluye DUAL, PLETINA, DÚO, oscuridad, vertical…). */
export function llevaTapasPeso(categoria: string | null | undefined): boolean {
  const c = (categoria || '').trim().toUpperCase();
  if (!c) return false;
  return c === 'ROL' || (c.startsWith('ROL_') && !c.includes('DUAL') && !c.includes('PLETINA'));
}

/** ¿La cenefa del paño es ovalada? (chip 'Ovalada' o categoría que la implica). */
function esCenefaOvalada(cenefa: string | null | undefined, categoria?: string): boolean {
  if ((cenefa || '').trim().toUpperCase() === 'OVALADA') return true;
  return (categoria || '').toUpperCase().includes('CENEFA_OVALADA');
}

/**
 * Cantidad de brackets según el ancho: hasta 1,00 m → 2; sobre 1 m se suma
 * 1 por cada 60 cm iniciados. Se calcula en CM ENTEROS para evitar que los
 * flotantes de metros (1,6 − 1 = 0,600…01) redondeen de más.
 */
export function cantidadBrackets(anchoM: number): number {
  const anchoCm = Math.round((anchoM || 0) * 100);
  return 2 + Math.ceil(Math.max(0, anchoCm - 100) / 60);
}

/**
 * Bracket que corresponde a la cenefa del paño:
 *  - Ovalada → BRA01 (corto) / BRA02 (largo) según `bracketTipo` (default CORTO).
 *  - Cuadrada a techo → BRA04 · a muro → BRA05 · 'Cuadrada' legacy → según superficie.
 *  - Sin cenefa → null.
 */
export function bracketDeCenefa(
  cenefa: string | null | undefined,
  bracketTipo: string | null | undefined,
  superficie?: string | null,
  categoria?: string,
): { codigo: string; descripcion: string } | null {
  if (esCenefaOvalada(cenefa, categoria)) {
    return (bracketTipo || 'CORTO').toUpperCase() === 'LARGO'
      ? { codigo: 'BRA02', descripcion: 'BRACKET LARGO' }
      : { codigo: 'BRA01', descripcion: 'BRACKET CORTO' };
  }
  if (esCenefaCuadrada(cenefa)) {
    const c = (cenefa || '').trim().toUpperCase();
    // Variantes nuevas explícitas; el 'Cuadrada' legacy cae a muro salvo techo.
    const aTecho = c.includes('TECHO') || (c === 'CUADRADA' && (superficie || '').toUpperCase() === 'TECHO');
    return aTecho
      ? { codigo: 'BRA04', descripcion: 'BRACKET L CENEFA CUADRADA TECHO' }
      : { codigo: 'BRA05', descripcion: 'BRACKET L CENEFA CUADRADA MURO' };
  }
  return null;
}

/**
 * Tarugos de vulcanita (TAR01) del paño. Solo si el material de instalación es
 * VULCANITA: roller sin cenefa → 4; cenefa ovalada → 1/bracket a techo, 2/bracket
 * a muro; cenefa cuadrada → 1/bracket.
 */
export function cantidadTarugos(
  p: Partial<Pano>,
  categoria: string | null | undefined,
  anchoM: number,
): number {
  if ((p.materialTipo || '').trim().toUpperCase() !== 'VULCANITA') return 0;
  const brackets = cantidadBrackets(anchoM);
  if (esCenefaOvalada(p.cenefa, categoria || undefined)) {
    const aTecho = (p.superficie || '').toUpperCase() === 'TECHO';
    return brackets * (aTecho ? 1 : 2);
  }
  if (esCenefaCuadrada(p.cenefa)) return brackets * 1;
  // Roller sin cenefa: 4 tarugos.
  return llevaTapasPeso(categoria) ? 4 : 0;
}

/**
 * Insumos de instalación del paño (tapas de peso, tornillos, brackets, tarugos).
 * Los del motor van aparte en `insumosMotorDePano`.
 */
export function insumosDePano(
  p: Partial<Pano>,
  ctx: { categoria?: string; ventanaColor?: string | null; anchoM: number },
): InsumoCortina[] {
  const out: InsumoCortina[] = [];
  const { categoria, ventanaColor, anchoM } = ctx;

  // Tapas de peso + sus tornillos (solo roller, por color de accesorios).
  if (llevaTapasPeso(categoria)) {
    const cc = colorTapaCorto(colorAccesoriosDePano(p, ventanaColor));
    if (cc) {
      const { izq, der } = TAPAS_PESO_POR_COLOR[cc];
      out.push({ codigo: izq, descripcion: NOMBRE_TAPA[izq], color: cc, cantidad: 1 });
      out.push({ codigo: der, descripcion: NOMBRE_TAPA[der], color: cc, cantidad: 1 });
      out.push({
        codigo: COD_TORNILLO_TAPA,
        descripcion: NOMBRE_TORNILLO_TAPA,
        color: '',
        cantidad: TORNILLOS_TAPA_PESO_POR_PANO,
      });
    }
  }

  // Tornillos de la cenefa ovalada (6 por cenefa).
  if (esCenefaOvalada(p.cenefa, categoria)) {
    out.push({
      codigo: COD_TORNILLO_TAPA,
      descripcion: NOMBRE_TORNILLO_TAPA,
      color: '',
      cantidad: TORNILLOS_CENEFA_OVALADA,
    });
  }

  // Brackets (por cenefa; cantidad por ancho).
  const bracket = bracketDeCenefa(p.cenefa, p.bracketTipo, p.superficie, categoria);
  if (bracket) {
    out.push({ ...bracket, color: '', cantidad: cantidadBrackets(anchoM) });
  }

  // Tarugos de vulcanita.
  const tarugos = cantidadTarugos(p, categoria, anchoM);
  if (tarugos > 0) {
    out.push({ codigo: COD_TARUGO, descripcion: NOMBRE_TARUGO, color: '', cantidad: tarugos });
  }

  return out;
}

// ── Motor (kits DOM) ─────────────────────────────────────────────────
export const MOTORES: Record<string, { motor: string; control: string; nombre: string }> = {
  DOM38: { motor: 'DOM38', control: 'DOM39', nombre: 'MOTOR TRONIC PLUS 1.5 BATERIA TURBO' },
  DOM41: { motor: 'DOM41', control: 'DOM42', nombre: 'MOTOR INALÁMBRICO TUBO 38 MM [MERYGATE]' },
};
const NOMBRE_CONTROL: Record<string, string> = {
  DOM39: 'CONTROL REMOTO BIDIRECCIONAL',
  DOM42: 'CONTROL REMOTO LIVORNO 15 CH [MERYGATE]',
};
export const COD_CABLE_MOTOR = 'DOM40';
export const NOMBRE_CABLE_MOTOR = 'CABLE TIPO C 1 MTS';
export const COD_ENCHUFE_MOTOR = 'DOM04';
export const NOMBRE_ENCHUFE_MOTOR = 'ENCHUFE PARA HUB USB';
export const COD_HUB_DOMOTICA = 'DOM43';
export const NOMBRE_HUB_DOMOTICA = 'BRIGDE HUB DOMOTICA';

/** ¿El paño lleva un motor con código DOM (no 'CABLE' futuro ni vacío)? */
export function panoTieneMotorDom(p: Partial<Pano>): boolean {
  return !!MOTORES[(p.motorModelo || '').toUpperCase()];
}

/**
 * Kit de motor del paño: motor + control + cable DOM40 + enchufe DOM04, más los
 * controles y hubs adicionales. Vacío si el modelo es 'CABLE' (futuro) o no hay motor.
 * F15: la cenefa ovalada NO admite DOM41 → cae a DOM38. La regla vive acá (en la
 * derivación del BOM), no solo en la UI, para que una OT importada o cargada sin
 * re-editar la cenefa tampoco emita el kit DOM41 prohibido.
 */
export function insumosMotorDePano(p: Partial<Pano>, categoria?: string): InsumoCortina[] {
  let modelo = (p.motorModelo || '').toUpperCase();
  if (modelo === 'DOM41' && esCenefaOvalada(p.cenefa, categoria)) modelo = 'DOM38';
  const m = MOTORES[modelo];
  if (!m) return [];
  const out: InsumoCortina[] = [
    { codigo: m.motor, descripcion: m.nombre, color: '', cantidad: 1 },
    { codigo: m.control, descripcion: NOMBRE_CONTROL[m.control], color: '', cantidad: 1 },
    { codigo: COD_CABLE_MOTOR, descripcion: NOMBRE_CABLE_MOTOR, color: '', cantidad: 1 },
    { codigo: COD_ENCHUFE_MOTOR, descripcion: NOMBRE_ENCHUFE_MOTOR, color: '', cantidad: 1 },
  ];
  // Controles adicionales (mismo código que el control del kit).
  const ctrlAdic = Number(p.motorControlAdicCant) || (p.motorControlAdic ? 1 : 0);
  if (ctrlAdic > 0) {
    out.push({ codigo: m.control, descripcion: NOMBRE_CONTROL[m.control], color: '', cantidad: ctrlAdic });
  }
  // Hubs USB adicionales (DOM43).
  const hub = Number(p.motorHubUsbCant) || (p.motorHubUsb ? 1 : 0);
  if (hub > 0) {
    out.push({ codigo: COD_HUB_DOMOTICA, descripcion: NOMBRE_HUB_DOMOTICA, color: '', cantidad: hub });
  }
  return out;
}

/**
 * ¿El paño lleva domótica? El flag nuevo `motorDomotica`, o el único valor legacy
 * de `motorTipo` que la implica ('CON DOMÓTICA'). NO se usa `.includes('DOM')`:
 * el otro valor legacy 'INALAMB. SIN DOMO' contiene la subcadena 'DOMO' y daría
 * un falso positivo (agregaría un DOM43 fantasma a una cortina SIN domótica).
 */
export function panoLlevaDomotica(p: Partial<Pano>): boolean {
  return !!p.motorDomotica || (p.motorTipo || '').trim().toUpperCase() === 'CON DOMÓTICA';
}

/** ¿Alguna cortina de la OT lleva domótica? (agrega 1× DOM43 por OT). */
export function otLlevaDomotica(ventanas: Ventana[]): boolean {
  return ventanas.some((v) => (v.panos || []).some(panoLlevaDomotica));
}
