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
import type { AdicionalFase0Persistido } from '@/modules/ots/types';
import { esCenefaCuadrada } from './fase2';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import {
  esCategoriaPletina,
  esCategoriaVertical,
  normalizarColorAccesorio,
} from '@/modules/descuentos/reglas-mecanismo';
import { categoriaEfectiva, type TipoCortina } from '@/modules/descuentos/tiposCortina';
import { sistemasDeCategoria } from '@/modules/descuentos/tipos';
import {
  COLORES_BUILTIN,
  colorPorCodigo,
  insumoDeColor,
  nombreDeColor,
  type ColorAccesorio,
} from '@/modules/descuentos/coloresAccesorio';
import {
  esFamiliaDark,
  esFamiliaSoftLightCC,
  familiaOscuridad,
} from '@/modules/descuentos/reglas-oscuridad';
import { colorPesoNormalizado } from '@/modules/descuentos/peso-oscuridad';

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

// ── Tapas de peso DÚO (a presión, SIN tornillos) ─────────────────────
// Cada dúo lleva 2 tapas exteriores del color de accesorios + 2 tapas internas
// (TAP13) por cortina. Van a presión, así que no llevan tornillos TOR02.
export const TAPAS_DUO_POR_COLOR: Record<'BCO' | 'NEG' | 'GRS', string> = {
  BCO: 'TAP12',
  NEG: 'TAP11',
  GRS: 'TAP09',
};
const NOMBRE_TAPA_DUO: Record<string, string> = {
  TAP12: '[TAPA DE PESO DUO] DUO 4 EXTERIOR BLANCO',
  TAP11: '[TAPA DE PESO DUO] DUO 4 EXTERIOR NEGRO',
  TAP09: '[TAPA DE PESO DUO] DUO 4 EXTERIOR GRIS',
};
export const COD_TAPA_DUO_INTERNA = 'TAP13';
export const NOMBRE_TAPA_DUO_INTERNA = '[TAPA DE PESO DUO] DUO INTERNO';
export const TAPAS_DUO_EXTERIOR_POR_PANO = 2;
export const TAPAS_DUO_INTERNA_POR_PANO = 2;

// ── Tapas de la CATEGORÍA B (pedido 2026-08-14) ──────────────────────
// El roller B usa la MISMA tapa en ambos lados (×2 por cortina): TAP18 blanca /
// TAP28-B negra, y va A PRESIÓN — sin los 2 tornillos TOR02 de la línea A
// (aclaración 2026-08-17). El dúo B lleva la exterior única TAP17 (chantilly,
// sirve para blanco y negro); la interna TAP13 se mantiene igual que en la A.
// El gris no existe en la gama B (la selección lo bloquea), así que si llegara
// un color sin tapa B se cae a la tapa de la línea A (que sí lleva tornillos,
// porque ES la tapa de la A).
export const TAPAS_PESO_B_POR_COLOR: Record<string, string> = {
  BCO: 'TAP18',
  NEG: 'TAP28-B',
};
const NOMBRE_TAPA_B: Record<string, string> = {
  TAP18: 'TAPA PESO ROLLER CAT. B (BLANCA)',
  'TAP28-B': 'TAPA PESO ROLLER CAT. B (NEGRO)',
};
export const COD_TAPA_DUO_B = 'TAP17';
export const NOMBRE_TAPA_DUO_B = '[TAPA DE PESO DUO] TAPA DUO CHANTILLY BLANCA - NEGRA';

// ── Tapa de cenefa cuadrada (por color de tapa) ──────────────────────
// A diferencia de las tapas de PESO (que van a bodega), estas se colocan en
// terreno, así que el inventario las lista en la tabla de INSTALACIÓN aunque su
// código sea TAP. Solo NEG/BCO/CAFÉ tienen código propio; gris u otro color sale
// sin código (aún no catalogado).
export const TAPAS_CENEFA_CUADRADA_POR_COLOR: Record<string, { codigo: string; color: string }> = {
  NEG: { codigo: 'TAP32', color: 'NEGRO' },
  NEGRO: { codigo: 'TAP32', color: 'NEGRO' },
  BCO: { codigo: 'TAP33', color: 'BLANCO' },
  BLANCO: { codigo: 'TAP33', color: 'BLANCO' },
  CAFÉ: { codigo: 'TAP34', color: 'CAFÉ' },
  CAFE: { codigo: 'TAP34', color: 'CAFÉ' },
};

/**
 * Insumo de tapa de cenefa cuadrada según el color de tapa (NEG→TAP32,
 * BCO→TAP33, CAFÉ→TAP34). Para colores sin código propio (gris u otro) devuelve
 * solo la descripción, sin código, para no inventar un insumo inexistente.
 */
export function tapaCenefaCuadrada(
  colorTapa: string | null | undefined,
  colores?: readonly ColorAccesorio[],
): { codigo?: string; descripcion: string } {
  const c = (colorTapa || '').trim().toUpperCase();
  const propio = insumoDeColor(colorTapa, 'tapaCuadrada', colores);
  if (propio) {
    return { codigo: propio, descripcion: `TAPA CENEFA CUADRADA ${nombreDeColor(colorTapa, colores)}` };
  }
  const m = TAPAS_CENEFA_CUADRADA_POR_COLOR[c];
  if (m) return { codigo: m.codigo, descripcion: `TAPA CENEFA CUADRADA ${m.color}` };
  return { descripcion: `TAPA CENEFA CUADRADA ${(colorTapa || '').trim()}`.trim() };
}

// ── Tapa de peso SOFT LIGHT / DARK (por color de accesorios) ─────────
// Van a PRESIÓN, SIN tornillos (como las tapas dúo). Solo blanco/negro tienen
// código; soft light no se vende en gris → sin código, con descripción genérica.
// El mismo código de tapa sirve para DARK (mismo peso inferior E24/E44).
export const TAPAS_PESO_OSCURIDAD_POR_COLOR: Record<string, { codigo: string; color: string }> = {
  BCO: { codigo: 'TAP26', color: 'BLANCO' },
  BLANCO: { codigo: 'TAP26', color: 'BLANCO' },
  NEG: { codigo: 'TAP31', color: 'NEGRO' },
  NEGRO: { codigo: 'TAP31', color: 'NEGRO' },
};
export const TAPAS_PESO_OSCURIDAD_POR_PANO = 2;

/**
 * Insumo de tapa de peso de sistemas de oscuridad (Soft Light / Dark) por color
 * de accesorios (BCO→TAP26, NEG→TAP31). Gris u otro color → sin código (no se
 * vende), solo descripción, para no inventar un insumo inexistente.
 */
export function tapaPesoOscuridad(
  colorAcc: string | null | undefined,
  colores?: readonly ColorAccesorio[],
): { codigo?: string; descripcion: string; color: string } {
  const c = (colorAcc || '').trim().toUpperCase();
  const propio = insumoDeColor(colorAcc, 'tapaOscuridad', colores);
  if (propio) {
    const nombre = nombreDeColor(colorAcc, colores);
    return { codigo: propio, descripcion: `TAPA PESO SOFT.LIGHT/DARK - ${nombre}`, color: nombre };
  }
  const m = TAPAS_PESO_OSCURIDAD_POR_COLOR[c];
  if (m) return { codigo: m.codigo, descripcion: `TAPA PESO SOFT.LIGHT/DARK - ${m.color}`, color: m.color };
  return { descripcion: `TAPA PESO SOFT.LIGHT/DARK - ${(colorAcc || '').trim()}`.trim(), color: (colorAcc || '').trim() };
}

export const COD_TORNILLO_TAPA = 'TOR02';
export const NOMBRE_TORNILLO_TAPA = 'TORNILLO TAPA PESO ROLLER 4X1/4"';
export const TORNILLOS_TAPA_PESO_POR_PANO = 2;
export const TORNILLOS_CENEFA_OVALADA = 6; // por cenefa ovalada (decisión 2026-07-09: TOR02)

// Tarugos de fijación según el material del muro.
export const COD_TARUGO = 'TAR01';
export const NOMBRE_TARUGO = 'TARUGO VOLCANITA (COLA DE CHANCHO)';
export const COD_TARUGO_CONCRETO = 'TAR03';
export const NOMBRE_TARUGO_CONCRETO = 'TARUGO SA 6 - FISHER (CONCRETO)';

// Suplementos (opcionales, uno por paño).
export const NOMBRE_SUPLEMENTO: Record<string, string> = {
  SUB01: 'SUPLEMENTO DE MADERA 3MM',
  SUB02: 'SUPLEMENTO ACRILICO 1.5CM',
};

/** Color de accesorios normalizado a BCO/NEG/GRS, o null si no aplica (MET, CAFÉ, vacío). */
function colorTapaCorto(color: string | null | undefined): 'BCO' | 'NEG' | 'GRS' | null {
  const c = normalizarColorAccesorio(color);
  if (c === 'BCO' || c === 'BLANCO') return 'BCO';
  if (c === 'NEG' || c === 'NEGRO') return 'NEG';
  if (c === 'GRS' || c === 'GRIS') return 'GRS';
  return null;
}

/**
 * ¿Este color es uno de los cinco de fábrica?
 *
 * Los de fábrica ya tienen su comportamiento histórico decidido pieza por pieza
 * (el metálico, por ejemplo, nunca emitió tapas de peso roller ni sus
 * tornillos). Un color dado de alta en Admin, en cambio, NO puede desaparecer
 * en silencio: si no trae código, la pieza igual se emite con su descripción
 * para que en bodega se vea que falta catalogarla.
 */
function esColorDeFabrica(color: string | null | undefined): boolean {
  return colorPorCodigo(color, COLORES_BUILTIN) != null;
}

/**
 * Tapa de peso roller izquierda y derecha para un color: primero lo que el
 * color declare en el catálogo, luego la tabla de fábrica. `null` = este color
 * no lleva tapas (solo para los colores de fábrica que nunca las llevaron).
 */
function tapasPesoDeColor(
  colorAcc: string | null | undefined,
  colores: readonly ColorAccesorio[] | undefined,
  lineaB = false,
): {
  izq: string;
  der: string;
  nombreIzq: string;
  nombreDer: string;
  color: string;
  /** La tapa va a presión: no lleva los tornillos TOR02 (tapas de la categoría B). */
  aPresion?: boolean;
} | null {
  const cc = colorTapaCorto(colorAcc);
  // Categoría B: una sola tapa (misma en ambos lados), a presión. Overlay del
  // color → tabla B de fábrica; si el color no tiene tapa B, cae a la de la
  // línea A (que sí se atornilla).
  if (lineaB) {
    const codB = insumoDeColor(colorAcc, 'tapaPesoB', colores) ?? (cc ? TAPAS_PESO_B_POR_COLOR[cc] || '' : '');
    if (codB) {
      const nombre = NOMBRE_TAPA_B[codB] || `TAPA PESO ROLLER CAT. B (${cc || colorAcc || ''})`;
      return {
        izq: codB,
        der: codB,
        nombreIzq: nombre,
        nombreDer: nombre,
        color: cc || (colorAcc || '').trim().toUpperCase(),
        aPresion: true,
      };
    }
  }
  const izq = insumoDeColor(colorAcc, 'tapaPesoIzq', colores) ?? (cc ? TAPAS_PESO_POR_COLOR[cc].izq : '');
  const der = insumoDeColor(colorAcc, 'tapaPesoDer', colores) ?? (cc ? TAPAS_PESO_POR_COLOR[cc].der : '');
  const etiqueta = cc || (colorAcc || '').trim().toUpperCase();
  if (!izq && !der) {
    if (esColorDeFabrica(colorAcc) || !etiqueta) return null;
    return {
      izq: '',
      der: '',
      nombreIzq: `TAPA PESO ${etiqueta} ROLLER [IZQUIERDO]`,
      nombreDer: `TAPA PESO ${etiqueta} ROLLER [DERECHO]`,
      color: etiqueta,
    };
  }
  return {
    izq,
    der,
    nombreIzq: NOMBRE_TAPA[izq] || `TAPA PESO ${etiqueta} ROLLER [IZQUIERDO]`,
    nombreDer: NOMBRE_TAPA[der] || `TAPA PESO ${etiqueta} ROLLER [DERECHO]`,
    color: etiqueta,
  };
}

/** Tapa exterior de peso dúo para un color (overlay → tabla → descriptiva). */
function tapaDuoDeColor(
  colorAcc: string | null | undefined,
  colores: readonly ColorAccesorio[] | undefined,
  lineaB = false,
): { codigo: string; descripcion: string; color: string } | null {
  const cc = colorTapaCorto(colorAcc);
  // Dúo categoría B: TAP17 única para blanco y negro (overlay editable).
  if (lineaB) {
    const codB = insumoDeColor(colorAcc, 'tapaDuoB', colores) ?? COD_TAPA_DUO_B;
    return {
      codigo: codB,
      descripcion: codB === COD_TAPA_DUO_B ? NOMBRE_TAPA_DUO_B : NOMBRE_TAPA_DUO[codB] || NOMBRE_TAPA_DUO_B,
      color: cc || (colorAcc || '').trim().toUpperCase(),
    };
  }
  const cod = insumoDeColor(colorAcc, 'tapaDuo', colores) ?? (cc ? TAPAS_DUO_POR_COLOR[cc] : '');
  const etiqueta = cc || (colorAcc || '').trim().toUpperCase();
  if (!cod) {
    if (esColorDeFabrica(colorAcc) || !etiqueta) return null;
    return {
      codigo: '',
      descripcion: `[TAPA DE PESO DUO] DUO 4 EXTERIOR ${etiqueta}`,
      color: etiqueta,
    };
  }
  return {
    codigo: cod,
    descripcion: NOMBRE_TAPA_DUO[cod] || `[TAPA DE PESO DUO] DUO 4 EXTERIOR ${etiqueta}`,
    color: etiqueta,
  };
}

/** ¿La categoría lleva peso inferior con tapas de peso ROLLER (izq+der + tornillos)?
 *  Roller (incl. motorizados), cenefa ovalada, DUAL y la pletina roller
 *  (PLETINA_ROLLER_V, que también tiene barra de peso roller). Excluye DÚO,
 *  pletina dúo, oscuridad, vertical… */
export function llevaTapasPeso(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): boolean {
  const c = categoriaEfectiva(categoria, tipos).trim().toUpperCase();
  if (!c) return false;
  if (c === 'PLETINA_ROLLER_V') return true;
  return c === 'ROL' || (c.startsWith('ROL_') && !c.includes('PLETINA'));
}

/** ¿La categoría es dúo (día/noche, doble tela)? Excluye PLETINA_DUO_V. */
export function esCategoriaDuo(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): boolean {
  return categoriaEfectiva(categoria, tipos).trim().toUpperCase().startsWith('DUO');
}

/** ¿Lleva el juego de tapas de peso DÚO (a presión, con tapa interna)? Los dúos
 *  normales y la pletina dúo (PLETINA_DUO_V), que también tiene barra de peso dúo. */
export function llevaTapasDuo(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): boolean {
  return (
    esCategoriaDuo(categoria, tipos) ||
    categoriaEfectiva(categoria, tipos).trim().toUpperCase() === 'PLETINA_DUO_V'
  );
}

/**
 * Tarugo de fijación según el material de instalación: VULCANITA → TAR01;
 * CONCRETO / CERÁMICA (con o sin tilde) → TAR03; MADERA (se atornilla directo),
 * vacío u otro → null (sin tarugo).
 */
export function tarugoDeMaterial(
  materialTipo: string | null | undefined,
): { codigo: string; descripcion: string } | null {
  const m = (materialTipo || '').trim().toUpperCase();
  if (m === 'VULCANITA') return { codigo: COD_TARUGO, descripcion: NOMBRE_TARUGO };
  if (m === 'CONCRETO' || m === 'CERÁMICA' || m === 'CERAMICA') {
    return { codigo: COD_TARUGO_CONCRETO, descripcion: NOMBRE_TARUGO_CONCRETO };
  }
  return null;
}

/**
 * ¿La categoría trae cenefa OVALADA por diseño? El roller de cenefa ovalada y
 * el DÚO: sus sistemas del catálogo se llaman `CENEFA_OVALADA` y
 * `CENEFA_OVALADA_DUO`, y TODAS sus filas traen `dcto_cenefa_cm`, así que el
 * despiece corta la cenefa siempre — la marque alguien en la ficha o no.
 *
 * Se resuelve por SISTEMA y no por el texto de la categoría, que es justo lo
 * que dejaba al dúo afuera: «DUO_MANUAL_38mm» no dice cenefa por ningún lado, y
 * sus cortinas quedaban sin tapa, sin bracket y sin la línea de cenefa en el
 * BOM (2026-08-20). La pletina dúo (velcro) NO entra: su sistema es
 * PLETINA_DUO y no lleva cenefa.
 */
export function llevaCenefaOvaladaImplicita(
  categoria?: string | null,
  tipos?: readonly TipoCortina[],
): boolean {
  return sistemasDeCategoria(categoria ?? '', tipos).some((s) =>
    s.toUpperCase().startsWith('CENEFA_OVALADA'),
  );
}

/** ¿La cenefa del paño es ovalada? (chip 'Ovalada' o categoría que la implica). */
export function esCenefaOvalada(
  cenefa: string | null | undefined,
  categoria?: string,
  tipos?: readonly TipoCortina[],
): boolean {
  if ((cenefa || '').trim().toUpperCase() === 'OVALADA') return true;
  if (llevaCenefaOvaladaImplicita(categoria, tipos)) return true;
  // Respaldo por nombre: una categoría que se llama «cenefa ovalada» pero que
  // todavía no tiene fila en el catálogo igual la lleva.
  return categoriaEfectiva(categoria, tipos).toUpperCase().includes('CENEFA_OVALADA');
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
 * DARK y OSCURANTI llevan cenefa cuadrada SIEMPRE (implícita): su `p.cenefa` viene
 * vacío/'No' porque la cenefa cuadrada es parte fija del sistema, no un adicional
 * elegible. Sirve para engancharla a los mismos insumos de cenefa cuadrada del
 * roller (tapas TAP32/33/34, brackets BRA04/05, tarugos).
 */
export function llevaCenefaCuadradaImplicita(
  categoria?: string | null,
  tipos?: readonly TipoCortina[],
): boolean {
  const fam = familiaOscuridad(categoria, undefined, tipos);
  return !!fam && (esFamiliaDark(fam) || fam === 'OSCURANTI');
}

/**
 * ¿La cenefa cuadrada de este paño lleva tapas FIJAS (2 por cortina, color de
 * accesorios), como un sistema de oscuridad? true para DARK y OSCURANTI (cenefa
 * implícita) y para SOFT LIGHT con cenefa CUADRADA (38 y 45 mm). En
 * cambio, la cenefa cuadrada de un ROLLER/VERTICAL sigue la política del selector
 * `cenefaTapa`.
 */
export function cenefaCuadradaTapasFijas(
  categoria?: string | null,
  cenefa?: string | null,
  tipos?: readonly TipoCortina[],
): boolean {
  const fam = familiaOscuridad(categoria, cenefa, tipos);
  return !!fam && (esFamiliaDark(fam) || esFamiliaSoftLightCC(fam) || fam === 'OSCURANTI');
}

/**
 * Bracket que corresponde a la cenefa del paño:
 *  - Ovalada → BRA01 (corto) / BRA02 (largo) según `bracketTipo` (default CORTO).
 *  - Cuadrada a techo → BRA04 · a muro → BRA05 · 'Cuadrada' legacy → según superficie.
 *  - DARK (cenefa cuadrada implícita) → BRA04/BRA05 según la superficie del paño.
 *  - Sin cenefa → null.
 */
export function bracketDeCenefa(
  cenefa: string | null | undefined,
  bracketTipo: string | null | undefined,
  superficie?: string | null,
  categoria?: string,
  tipos?: readonly TipoCortina[],
): { codigo: string; descripcion: string } | null {
  if (esCenefaOvalada(cenefa, categoria, tipos)) {
    return (bracketTipo || 'CORTO').toUpperCase() === 'LARGO'
      ? { codigo: 'BRA02', descripcion: 'BRACKET LARGO' }
      : { codigo: 'BRA01', descripcion: 'BRACKET CORTO' };
  }
  if (esCenefaCuadrada(cenefa) || llevaCenefaCuadradaImplicita(categoria, tipos)) {
    const c = (cenefa || '').trim().toUpperCase();
    const sup = (superficie || '').toUpperCase();
    // 'a muro' explícito manda; si no, techo cuando la superficie es TECHO
    // ('Cuadrada' legacy y DARK implícita se deciden por la superficie del paño).
    const aTecho = c.includes('TECHO') || (!c.includes('MURO') && sup === 'TECHO');
    return aTecho
      ? { codigo: 'BRA04', descripcion: 'BRACKET L CENEFA CUADRADA TECHO' }
      : { codigo: 'BRA05', descripcion: 'BRACKET L CENEFA CUADRADA MURO' };
  }
  return null;
}

/**
 * Cantidad de tarugos del paño (código según `tarugoDeMaterial`). Solo si el
 * material lleva tarugo (vulcanita/concreto/cerámica; madera no): roller sin
 * cenefa → 4; cenefa ovalada → 1/bracket a techo, 2/bracket a muro; cenefa
 * cuadrada → 1/bracket.
 */
export function cantidadTarugos(
  p: Partial<Pano>,
  categoria: string | null | undefined,
  anchoM: number,
  tipos?: readonly TipoCortina[],
): number {
  if (!tarugoDeMaterial(p.materialTipo)) return 0;
  const brackets = cantidadBrackets(anchoM);
  if (esCenefaOvalada(p.cenefa, categoria || undefined, tipos)) {
    const aTecho = (p.superficie || '').toUpperCase() === 'TECHO';
    return brackets * (aTecho ? 1 : 2);
  }
  if (esCenefaCuadrada(p.cenefa) || llevaCenefaCuadradaImplicita(categoria, tipos))
    return brackets * 1;
  // Vertical (lamas): se fija con brackets al muro, 1 tarugo por bracket según
  // la superficie (igual criterio que el roller, pero por cantidad de brackets).
  if (esCategoriaVertical(categoria)) return brackets;
  // Pletina (velcro): se pega, sin tarugos/fijaciones (aunque lleve tapas de peso).
  if (esCategoriaPletina(categoria, tipos)) return 0;
  // Roller o dúo sin cenefa: 4 tarugos (se instalan con brackets al muro). El
  // dúo no lleva tapas peso roller, pero igual se fija con tarugos.
  return llevaTapasPeso(categoria, tipos) || esCategoriaDuo(categoria, tipos) ? 4 : 0;
}

/**
 * Cantidad auto de suplementos: con cenefa (ovalada o cuadrada) → 1 por bracket;
 * roller sin cenefa → 2. El usuario puede sobrescribir con `suplementoCant`.
 */
export function cantidadSuplementosAuto(
  p: Partial<Pano>,
  categoria: string | null | undefined,
  anchoM: number,
): number {
  if (esCenefaOvalada(p.cenefa, categoria || undefined) || esCenefaCuadrada(p.cenefa)) {
    return cantidadBrackets(anchoM);
  }
  return 2;
}

/**
 * Insumos de instalación del paño (tapas de peso, tornillos, brackets, tarugos).
 * Los del motor van aparte en `insumosMotorDePano`.
 */
export function insumosDePano(
  p: Partial<Pano>,
  ctx: {
    categoria?: string;
    ventanaColor?: string | null;
    anchoM: number;
    /**
     * Dual: en el 2º+ paño se omiten las fijaciones que son 1 juego por cortina
     * (brackets, tarugos, suplementos) — el dual cuelga de UN solo bracket. Las
     * tapas de peso y sus tornillos SÍ van por paño (una barra de peso por tela).
     */
    omitirFijaciones?: boolean;
    /** Tipos de cortina propios, para resolver la categoría a su molde. */
    tipos?: readonly TipoCortina[];
    /** Catálogo de colores: sus códigos propios ganan sobre las tablas de acá. */
    colores?: readonly ColorAccesorio[];
    /** Categoría B (gama económica): cambia las tapas de peso (TAP18/TAP28-B ×2
     *  en roller, a presión y SIN tornillos TOR02; TAP17 exterior en dúo — la
     *  interna TAP13 no cambia). */
    lineaB?: boolean;
  },
): InsumoCortina[] {
  const out: InsumoCortina[] = [];
  const { categoria, ventanaColor, anchoM, omitirFijaciones, tipos, colores, lineaB } = ctx;
  const colorAcc = colorAccesoriosDePano(p, ventanaColor);

  // Tapas de peso + sus tornillos (solo roller, por color de accesorios).
  if (llevaTapasPeso(categoria, tipos)) {
    const tapas = tapasPesoDeColor(colorAcc, colores, lineaB);
    if (tapas) {
      out.push({ codigo: tapas.izq, descripcion: tapas.nombreIzq, color: tapas.color, cantidad: 1 });
      out.push({ codigo: tapas.der, descripcion: tapas.nombreDer, color: tapas.color, cantidad: 1 });
      // Categoría B: la tapa (TAP18 / TAP28-B) va A PRESIÓN, sin tornillos
      // (decisión 2026-08-17). Se atornillan solo las tapas de la línea A.
      if (!tapas.aPresion) {
        out.push({
          codigo: COD_TORNILLO_TAPA,
          descripcion: NOMBRE_TORNILLO_TAPA,
          color: '',
          cantidad: TORNILLOS_TAPA_PESO_POR_PANO,
        });
      }
    }
  } else if (familiaOscuridad(categoria, p.cenefa, tipos)) {
    // Soft Light / Dark: 2 tapas de peso a PRESIÓN, SIN tornillos (TAP26 blanco /
    // TAP31 negro). Gris no se vende → item sin código, solo descripción.
    const tapa = tapaPesoOscuridad(colorAcc, colores);
    out.push({
      codigo: tapa.codigo ?? '',
      descripcion: tapa.descripcion,
      color: tapa.color,
      cantidad: TAPAS_PESO_OSCURIDAD_POR_PANO,
    });
  } else if (llevaTapasDuo(categoria, tipos)) {
    // Dúo (y pletina dúo): tapas a presión, SIN tornillos. 2 exteriores por color + 2 internas (TAP13).
    const ext = tapaDuoDeColor(colorAcc, colores, lineaB);
    if (ext) {
      out.push({
        codigo: ext.codigo,
        descripcion: ext.descripcion,
        color: ext.color,
        cantidad: TAPAS_DUO_EXTERIOR_POR_PANO,
      });
    }
    out.push({
      codigo: COD_TAPA_DUO_INTERNA,
      descripcion: NOMBRE_TAPA_DUO_INTERNA,
      color: '',
      cantidad: TAPAS_DUO_INTERNA_POR_PANO,
    });
  }

  // Tornillos de la cenefa ovalada (6 por cenefa).
  if (esCenefaOvalada(p.cenefa, categoria, tipos)) {
    out.push({
      codigo: COD_TORNILLO_TAPA,
      descripcion: NOMBRE_TORNILLO_TAPA,
      color: '',
      cantidad: TORNILLOS_CENEFA_OVALADA,
    });
  }

  // Brackets (por cenefa; cantidad por ancho). Fijación por cortina: en dual
  // el 2º paño no las emite (un solo bracket dual sostiene ambos rollers).
  const bracket = omitirFijaciones
    ? null
    : bracketDeCenefa(p.cenefa, p.bracketTipo, p.superficie, categoria, tipos);
  if (bracket) {
    out.push({ ...bracket, color: '', cantidad: cantidadBrackets(anchoM) });
  }

  // Tarugos según material (vulcanita/concreto/cerámica; madera no lleva). Igual
  // que los brackets: 1 juego por cortina (el 2º paño dual no los emite).
  const tarugo = omitirFijaciones ? null : tarugoDeMaterial(p.materialTipo);
  const tarugos = omitirFijaciones ? 0 : cantidadTarugos(p, categoria, anchoM, tipos);
  if (tarugo && tarugos > 0) {
    out.push({ codigo: tarugo.codigo, descripcion: tarugo.descripcion, color: '', cantidad: tarugos });
  }

  // Suplementos (opcional; cantidad auto por roller/cenefa, override manual).
  // También 1 juego por cortina (el 2º paño dual no los emite).
  if (p.suplementoTipo && !omitirFijaciones) {
    const override = Number(p.suplementoCant);
    const cant = override > 0 ? override : cantidadSuplementosAuto(p, categoria, anchoM);
    out.push({
      codigo: p.suplementoTipo,
      descripcion: NOMBRE_SUPLEMENTO[p.suplementoTipo] || p.suplementoTipo,
      color: '',
      cantidad: cant,
    });
  }

  return out;
}

// ── Kits de cortina por sistema (VERTICAL, BEEBLACK) ─────────────────
/** Pieza del kit propio de un sistema, con su cuadro de destino en la hoja de
 *  inventario. `calcular` = la cantidad se define midiendo (cordón de la
 *  vertical, tira magnética del beeblack): la hoja imprime "CALCULAR" en vez
 *  del número. */
export type InsumoKitCortina = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  /** Cuadro de la hoja de inventario: PRODUCCIÓN (lo que se monta sobre la tela
   *  o arma el sistema), ESTRUCTURA (ferretería del sistema) o INSTALACIÓN
   *  (terreno: brackets, cadena inferior, tapas de esquinero). */
  grupo: 'PRODUCCION' | 'ESTRUCTURA' | 'INSTALACION';
  /** true → cantidad a calcular midiendo; se imprime "CALCULAR". */
  calcular?: boolean;
};

/** ¿El color de accesorios de la vertical es negro? Cualquier otro color
 *  (incl. gris) usa el set blanco: no hay vertical gris catalogada. */
function verticalEsNegro(colorAcc: string | null | undefined): boolean {
  const c = normalizarColorAccesorio(colorAcc);
  return c === 'NEG' || c === 'NEGRO';
}

/**
 * Insumos VER de una cortina VERTICAL (códigos de la lámina "ACCESORIOS
 * BLANCOS / NEGROS", validados contra la tabla `insumos`). El set es por color
 * de accesorios: blanco (o cualquier color que no sea negro, incl. gris) vs.
 * negro. Cantidades: 1 (peso cordón, kit, peso cadena), = `carritos` (carrito,
 * peso lama, sujetador), `cantidadBrackets` (bracket) y "CALCULAR" (cordón y
 * cadena inferior, que se miden en terreno — igual que el Excel de taller).
 * Cuadros de inventario: PRODUCCIÓN = lo que se monta sobre la tela (peso lama +
 * sujetador); ESTRUCTURA = la ferretería del sistema (peso cordón, carritos,
 * cordón, kit, peso cadena); INSTALACIÓN = terreno (bracket + cadena inferior).
 * En negro el peso del cordón es VER64 (mismo producto que el peso de cadena →
 * consolida a [VER64] ×2). Los tarugos salen aparte por `insumosDePano` (TAR).
 */
export function insumosVerticalDePano(ctx: {
  colorAcc?: string | null;
  anchoM: number;
  carritos: number;
}): InsumoKitCortina[] {
  const negro = verticalEsNegro(ctx.colorAcc);
  const carritos = Math.max(0, Math.round(ctx.carritos) || 0);
  const brackets = cantidadBrackets(ctx.anchoM);
  // Peso del cordón: en negro es el MISMO producto que el peso de cadena (VER64),
  // así que en inventario/BOM consolida a una sola línea [VER64] ×2.
  const pesoCordon = negro
    ? { codigo: 'VER64', descripcion: 'PESO CORDON VERTICAL NEGRO' }
    : { codigo: 'VER37', descripcion: 'PESO CORDON VERTICAL VERTILUX' };
  const cordon = negro
    ? { codigo: 'VER59', descripcion: 'CORDÓN DE 2.2mm COLOR: NEGRO' }
    : { codigo: 'VER43', descripcion: 'CORDON BLANCO VERTICAL VERTILUX' };
  const sujetador = negro
    ? { codigo: 'VER56', descripcion: 'SUJETADOR DE LAMAS TRANSPARENTE' }
    : { codigo: 'VER45', descripcion: 'SUJETADOR DE LAMAS VERTILUX' };
  const pesoCadena = negro
    ? { codigo: 'VER64', descripcion: 'PESO CADENA VERTICAL NEGRO' }
    : { codigo: 'VER52', descripcion: 'PESO CADENA VERTICAL VERTILUX' };
  const cadenaInferior = negro
    ? { codigo: 'VER58', descripcion: 'CADENA INFERIOR PARA VERTICAL NEGRO' }
    : { codigo: 'VER39', descripcion: 'CADENA DE PESO VERTICAL VERTILUX' };

  // Imanes (VER55): las verticales de más de 3 m de ancho llevan 2 carritos con
  // imán extra para que las lamas no se abran. Se SUMAN a los carritos normales.
  const imanes: InsumoKitCortina[] =
    ctx.anchoM > 3
      ? [
          {
            codigo: 'VER55',
            descripcion: 'CARRITO PARA CORTINAS GRANDES (IMANES)',
            cantidad: 2,
            grupo: 'ESTRUCTURA',
          },
        ]
      : [];

  return [
    // PRODUCCIÓN (taller): lo que se monta sobre la tela.
    { codigo: 'VER41', descripcion: 'PESO LAMA VERTICAL VERTILUX', cantidad: carritos, grupo: 'PRODUCCION' },
    { ...sujetador, cantidad: carritos, grupo: 'PRODUCCION' },
    // ESTRUCTURA (taller): la ferretería del sistema de lamas.
    { ...pesoCordon, cantidad: 1, grupo: 'ESTRUCTURA' },
    { codigo: 'VER40', descripcion: 'CARRITO VERTICAL VERTILUX', cantidad: carritos, grupo: 'ESTRUCTURA' },
    ...imanes,
    { ...cordon, cantidad: 0, grupo: 'ESTRUCTURA', calcular: true },
    { codigo: 'VER50', descripcion: 'KIT DE VERTICAL NUEVO VERTILUX', cantidad: 1, grupo: 'ESTRUCTURA' },
    { ...pesoCadena, cantidad: 1, grupo: 'ESTRUCTURA' },
    // INSTALACIÓN (terreno): se cuelga y se cierra.
    { codigo: 'VER38', descripcion: 'BRACKET VERTICAL VERTILUX', cantidad: brackets, grupo: 'INSTALACION' },
    { ...cadenaInferior, cantidad: 0, grupo: 'INSTALACION', calcular: true },
  ];
}

// ── BEEBLACK (cierre horizontal con lamas) — kit SML ─────────────────
// Lista del usuario (2026-07-31). TODO el kit va al cuadro de PRODUCCIÓN salvo
// la TAPA DE ESQUINERO, que se coloca en terreno (INSTALACIÓN). El color sale de
// los ACCESORIOS de la cortina; el café comparte el carro inferior (SML46 "gris
// oscuro") y el carro de nylon (SML26) con el negro, pero tiene su propio
// esquinero (SML18) y su tapa (SML49).
//
// La BARRA de la manilla NO está acá: se cobra como accesorio en Fase 1 y se
// corta por la hoja de estructura. De la manilla, el kit solo lleva sus carros
// inferiores (SML45/46) y su felpa magnética (SML34).

type ColorKitBeeblack = 'BLANCO' | 'NEGRO' | 'CAFÉ';

/** Color del kit BEEBLACK. Gris o cualquier color no catalogado usa el set
 *  blanco (no hay beeblack gris). */
function colorKitBeeblack(colorAcc: string | null | undefined): ColorKitBeeblack {
  const c = colorPesoNormalizado(colorAcc);
  if (c === 'NEGRO') return 'NEGRO';
  if (c === 'CAFÉ') return 'CAFÉ';
  return 'BLANCO';
}

/**
 * ¿La cortina BEEBLACK es DOBLE (screen + blackout)? Son 2 telas sobre UNA
 * estructura: su kit va ×2 salvo los esquineros y sus tapas. El flag `dual` lo
 * pone Fase 1 (2 filas con la misma UBIC marcadas DOBLE) o Fase 2 a mano.
 */
export function beeblackEsDoble(p: Partial<Pano>, totalPanos?: number): boolean {
  return !!p.dual || (totalPanos ?? 1) > 1;
}

/**
 * Kit SML de UNA cortina BEEBLACK (no por paño: en el doble se emite una vez,
 * con las cantidades ya duplicadas). Los ESQUINEROS y sus TAPAS pertenecen a la
 * estructura —una sola por cortina— así que no se duplican; el resto sí, porque
 * es ferretería de cada tela. La tira magnética del riel (SML33) y la felpa de
 * la manilla (SML34) van "CALCULAR": se miden en el taller.
 */
export function insumosBeeblackDeCortina(
  colorAcc: string | null | undefined,
  doble = false,
  cordonCm = 0,
): InsumoKitCortina[] {
  const color = colorKitBeeblack(colorAcc);
  const oscuro = color !== 'BLANCO';
  const porTela = (n: number) => (doble ? n * 2 : n);

  const carroManilla = oscuro
    ? { codigo: 'SML46', descripcion: 'CARRO INFERIOR PERFIL MANILLA [GRIS OSCURO]' }
    : { codigo: 'SML45', descripcion: 'CARRO INFERIOR PERFIL MANILLA [BLANCO]' };
  const esquinero =
    color === 'CAFÉ'
      ? { codigo: 'SML18', descripcion: 'ESQUINERO GRANDE [CAFÉ]' }
      : color === 'NEGRO'
        ? { codigo: 'SML17', descripcion: 'ESQUINERO GRANDE [NEGRO]' }
        : { codigo: 'SML16', descripcion: 'ESQUINERO GRANDE [BLANCO]' };
  const carroNylon = oscuro
    ? { codigo: 'SML26', descripcion: 'CARRO TRANSPORTADOR GUÍA DE NYLON [NEGRO]' }
    : { codigo: 'SML25', descripcion: 'CARRO TRANSPORTADOR GUÍA DE NYLON [BLANCO]' };
  const tapaEsquinero =
    color === 'CAFÉ'
      ? { codigo: 'SML49', descripcion: 'TAPA ESQUINERO BASIC - CAFÉ' }
      : color === 'NEGRO'
        ? { codigo: 'SML48', descripcion: 'TAPA ESQUINERO BASIC - NEGRO' }
        : { codigo: 'SML47', descripcion: 'TAPA ESQUINERO BASIC - BLANCO' };
  // Cordón: se corta del rollo por METRO, así que la cantidad son los cm que
  // pide la fórmula (perfil superior + lateral + 30). Va por ESTRUCTURA: el
  // doble tiene un solo recorrido de cordón, por eso no pasa por `porTela`.
  const cordon = oscuro
    ? { codigo: 'SML37', descripcion: 'CORDON NEGRO' }
    : { codigo: 'SML36', descripcion: 'CORDON BLANCO REFORZADO (2500M)' };

  return [
    // PRODUCCIÓN (taller): todo el armado del cierre.
    { ...carroManilla, cantidad: porTela(2), grupo: 'PRODUCCION' },
    { ...esquinero, cantidad: 4, grupo: 'PRODUCCION' },
    { ...carroNylon, cantidad: porTela(2), grupo: 'PRODUCCION' },
    { codigo: 'SML33', descripcion: 'TIRA MAGNÉTICA DEL RIEL LATERAL', cantidad: 0, grupo: 'PRODUCCION', calcular: true },
    { codigo: 'SML34', descripcion: 'ZUNCHO MAGNÉTICO - FELPA TIRA MAGNÉTICA PARA MANILLA', cantidad: 0, grupo: 'PRODUCCION', calcular: true },
    { codigo: 'SML32', descripcion: 'TAPA DE COBRE', cantidad: porTela(4), grupo: 'PRODUCCION' },
    { codigo: 'SML31', descripcion: 'CLIP DE ALAMBRE DE ALEACION', cantidad: porTela(4), grupo: 'PRODUCCION' },
    { codigo: 'SML35', descripcion: 'RODILLO GUIA DE CUERDA', cantidad: porTela(4), grupo: 'PRODUCCION' },
    // Sin medidas (Fase 2 incompleta) sale CALCULAR en vez de un 0 engañoso.
    {
      ...cordon,
      descripcion: `${cordon.descripcion} (CM)`,
      cantidad: cordonCm > 0 ? cordonCm : 0,
      grupo: 'PRODUCCION',
      ...(cordonCm > 0 ? {} : { calcular: true }),
    },
    // INSTALACIÓN (terreno): la tapa que cubre cada esquinero.
    { ...tapaEsquinero, cantidad: 4, grupo: 'INSTALACION' },
  ];
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
// Cable de carga del DOM38 (Tronic Plus a batería): código DOM34.
export const COD_CABLE_MOTOR = 'DOM34';
export const NOMBRE_CABLE_MOTOR = 'CABLE DE CARGA';
export const COD_ENCHUFE_MOTOR = 'DOM04';
export const NOMBRE_ENCHUFE_MOTOR = 'ENCHUFE PARA HUB USB';
export const COD_HUB_DOMOTICA = 'DOM43';
export const NOMBRE_HUB_DOMOTICA = 'BRIGDE HUB DOMOTICA';
// Router de la casa: acompaña SIEMPRE al hub de domótica, 1 por OT (no por cortina).
export const COD_ROUTER_DOMOTICA = 'DOM05';
export const NOMBRE_ROUTER_DOMOTICA = 'ROUTER';

// ── Cargador/hub del motor (opcional, tabla INSTALACIÓN) ─────────────
// NO todos los motores llevan hub: el kit NO agrega cargador por defecto. El
// vendedor lo elige en Fase 2 (`motorCargador`): DOM43 (hub domótica, típico
// del DOM38), DOM03 (HUB USB, típico del DOM41) o DOM33 (enchufe adaptador
// motor grande). 'NINGUNO' (o sin elección) = el motor va sin hub/cargador.
export const COD_CARGADOR_MOTOR = 'DOM03';
export const NOMBRE_CARGADOR_MOTOR = 'HUB USB [1 QR]';
export const COD_CARGADOR_MOTOR_ALT = 'DOM33';
export const NOMBRE_CARGADOR_MOTOR_ALT = 'ENCHUFE ADAPTADOR MOTOR GRANDE';
export const COD_CARGADOR_NINGUNO = 'NINGUNO';

/**
 * Cargador/hub del motor del paño según la elección de Fase 2 (`motorCargador`).
 * Sin elección (o 'NINGUNO') → null: el motor no lleva hub ni cargador.
 */
export function cargadorMotorDePano(
  p: Partial<Pano>,
): { codigo: string; descripcion: string } | null {
  const elegido = (p.motorCargador || '').toUpperCase();
  if (elegido === COD_CARGADOR_MOTOR_ALT) return { codigo: COD_CARGADOR_MOTOR_ALT, descripcion: NOMBRE_CARGADOR_MOTOR_ALT }; // DOM33
  if (elegido === COD_HUB_DOMOTICA) return { codigo: COD_HUB_DOMOTICA, descripcion: NOMBRE_HUB_DOMOTICA }; // DOM43
  if (elegido === COD_CARGADOR_MOTOR) return { codigo: COD_CARGADOR_MOTOR, descripcion: NOMBRE_CARGADOR_MOTOR }; // DOM03
  return null; // 'NINGUNO' o sin elección → sin hub/cargador
}

/** ¿El paño lleva un motor con código DOM (no 'CABLE' futuro ni vacío)? */
export function panoTieneMotorDom(p: Partial<Pano>): boolean {
  return !!MOTORES[(p.motorModelo || '').toUpperCase()];
}

/**
 * ¿El código es el de la UNIDAD de motor (DOM38/DOM41), no el control/cable/
 * enchufe/hub del kit? Se usa para clasificar el inventario: el motor de una
 * cortina con cenefa ovalada va a PRODUCCIÓN; el resto del kit, a INSTALACIÓN.
 */
export function esCodigoMotor(codigo: string | undefined): boolean {
  return !!codigo && Object.prototype.hasOwnProperty.call(MOTORES, codigo.toUpperCase());
}

/**
 * Modelo de motor (DOM38/DOM41) a partir del código de un adicional de Fase 0.
 * El catálogo de Fase 0 usa el código con espacio ("DOM 38"); acá se normaliza
 * sin espacios y se valida contra los motores conocidos. Devuelve el modelo
 * canónico (llave de MOTORES) o null si el adicional no es una unidad de motor
 * (control DOM39, hub DOM43, router DOM05, etc. → null).
 */
export function codigoMotorDesdeAdicional(codInt: string | undefined): string | null {
  const c = (codInt || '').replace(/\s+/g, '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(MOTORES, c) ? c : null;
}

/** ¿El adicional es el hub de domótica (DOM43), con o sin espacio en el código? */
export function esAdicionalHubDomotica(codInt: string | undefined): boolean {
  return (codInt || '').replace(/\s+/g, '').toUpperCase() === COD_HUB_DOMOTICA;
}

// ── Manillas planas (herraje de bodega G-U.CL) ───────────────────────
// El código manda sobre el colorAcc del adicional (que suele venir vacío).
export const MANILLAS: Record<string, { color: string; nombre: string }> = {
  HER47: { color: 'NEG', nombre: 'MANILLA PLANA NEGRO' },
  HER48: { color: 'BCO', nombre: 'MANILLA PLANA BLANCA' },
  HER49: { color: 'CAFÉ', nombre: 'MANILLA PLANA CAFE' },
};

/**
 * Manilla (código canónico + color) desde el código de un adicional de Fase 0.
 * Normaliza 'HER 48'→'HER48' (mismo estilo que codigoMotorDesdeAdicional).
 * null si el adicional no es una manilla plana conocida.
 */
export function manillaDesdeAdicional(codInt: string | undefined): { codigo: string; color: string } | null {
  const c = (codInt || '').replace(/\s+/g, '').toUpperCase();
  const m = MANILLAS[c];
  return m ? { codigo: c, color: m.color } : null;
}

/**
 * Código de bodega (HER47/48/49) para un color de manilla del paño. Tolera el
 * código corto ('NEG'/'BCO'/'CAFÉ') y el nombre largo (NEGRO/BLANCO/CAFE).
 * '' si el color no calza con ninguna manilla.
 */
export function codigoManillaPorColor(
  color: string | undefined,
  colores?: readonly ColorAccesorio[],
): string {
  const propio = insumoDeColor(color, 'manilla', colores);
  if (propio) return propio;
  const c = (color || '').toUpperCase().trim();
  if (c === 'NEG' || c === 'NEGRO') return 'HER47';
  if (c === 'BCO' || c === 'BLANCO' || c === 'BLANCA') return 'HER48';
  if (c === 'CAFÉ' || c === 'CAFE') return 'HER49';
  return '';
}

/**
 * Kit de motor del paño. Lo ÚNICO automático es la unidad de motor y, con el
 * DOM38 (Tronic Plus a batería), su cable de carga DOM34 — regla del taller
 * "DOM38 = DOM34"; el DOM41 no lo lleva. Los CONTROLES (DOM39/DOM42) y la
 * DOMÓTICA se activan en FASE 2: control por la cantidad del paño
 * (motorControlAdicCant) y hub/router por su toggle. El hub/cargador es
 * OPCIONAL (elección del vendedor en Fase 2): si se elige un hub (DOM43/DOM03)
 * va acompañado de su enchufe DOM04; con DOM33 o sin elección no va ni hub ni
 * DOM04. Vacío si es 'CABLE' o no hay motor.
 * F15: la cenefa ovalada NO admite DOM41 → cae a DOM38. La regla vive acá (en la
 * derivación del BOM), no solo en la UI, para que una OT importada o cargada sin
 * re-editar la cenefa tampoco emita el kit DOM41 prohibido.
 */
export function insumosMotorDePano(
  p: Partial<Pano>,
  categoria?: string,
  tipos?: readonly TipoCortina[],
): InsumoCortina[] {
  let modelo = (p.motorModelo || '').toUpperCase();
  if (modelo === 'DOM41' && esCenefaOvalada(p.cenefa, categoria, tipos)) modelo = 'DOM38';
  const m = MOTORES[modelo];
  if (!m) return [];
  const out: InsumoCortina[] = [
    { codigo: m.motor, descripcion: m.nombre, color: '', cantidad: 1 },
  ];
  // Cable de carga (DOM34): solo el Tronic Plus a batería (DOM38).
  if (modelo === 'DOM38') {
    out.push({ codigo: COD_CABLE_MOTOR, descripcion: NOMBRE_CABLE_MOTOR, color: '', cantidad: 1 });
  }
  // Hub/cargador opcional (elección Fase 2). El enchufe DOM04 alimenta al hub:
  // va SOLO cuando el cargador elegido es un hub (DOM43/DOM03), no con DOM33.
  const cargador = cargadorMotorDePano(p);
  if (cargador) {
    const esHub = cargador.codigo === COD_HUB_DOMOTICA || cargador.codigo === COD_CARGADOR_MOTOR;
    if (esHub) {
      out.push({ codigo: COD_ENCHUFE_MOTOR, descripcion: NOMBRE_ENCHUFE_MOTOR, color: '', cantidad: 1 });
    }
    out.push({ codigo: cargador.codigo, descripcion: cargador.descripcion, color: '', cantidad: 1 });
  }
  // Controles del paño (DOM39 del DOM38 · DOM42 del DOM41): NO son automáticos,
  // salen solo de la cantidad que se pide en Fase 2.
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
 * Motores, controles y domótica COBRADOS en la cotización (adicionales de Fase 0)
 * que faltan en el inventario respecto de lo ya emitido por los paños. Cuenta por
 * código, SIN filtrar por ubicación: todo lo cobrado debe salir, calce o no con un
 * paño (3 motores en una ubicación con un solo paño → faltan 2).
 *
 * Reglas del taller cerradas el 2026-07-30:
 *  1. Unidad de motor (DOM38/DOM41) por la cantidad vendida.
 *  2. **DOM38 = DOM34**: el Tronic Plus viene SIN cable, así que va uno por CADA
 *     unidad de motor (el kit por paño ya puso el suyo; acá salen los del top-up).
 *  3. **Controles** (DOM39/DOM42) por la cantidad VENDIDA, nunca uno por motor.
 *  4. **Hub DOM43** por la cantidad vendida, y cada hub arrastra su router DOM05
 *     y su adaptador DOM33 (antes el hub y el router eran "1 por OT" fijo).
 *
 * @param emitidosPorCodigo lo ya emitido por los paños. La UNIDAD de motor va por
 *   el código ORIGINAL del paño (`p.motorModelo`), para no descontar de más cuando
 *   el kit remapea el modelo (DOM41→DOM38 en cenefa ovalada); el resto del kit
 *   (cable, controles, hub, router, adaptador) por su propio código.
 */
export function faltantesDomoticaInventario(
  adicionales: AdicionalFase0Persistido[] | undefined,
  emitidosPorCodigo: Record<string, number>,
): InsumoCortina[] {
  const out: InsumoCortina[] = [];
  if (!adicionales?.length) return out;
  const cobrado: Record<string, number> = {};
  for (const a of adicionales) {
    const cod = (a.codInt || '').replace(/\s+/g, '').toUpperCase();
    const cant = Math.round(Number(a.cantidad) || 0);
    if (!cod || cant <= 0) continue;
    cobrado[cod] = (cobrado[cod] || 0) + cant;
  }
  // Lo que falta de un código para llegar al total requerido.
  const faltan = (cod: string, total: number) => total - (emitidosPorCodigo[cod] || 0);
  const push = (cod: string, descripcion: string, cant: number) => {
    if (cant > 0) out.push({ codigo: cod, descripcion, color: '', cantidad: cant });
  };

  // 1 + 2. Unidades de motor cobradas que no salieron por ningún paño, con su cable.
  let cablesFaltantes = 0;
  for (const cod of Object.keys(MOTORES)) {
    const n = faltan(cod, cobrado[cod] || 0);
    if (n <= 0) continue;
    push(cod, MOTORES[cod].nombre, n);
    if (cod === 'DOM38') cablesFaltantes += n;
  }
  push(COD_CABLE_MOTOR, NOMBRE_CABLE_MOTOR, cablesFaltantes);

  // 3. Controles por cantidad vendida.
  for (const cod of Object.keys(NOMBRE_CONTROL)) {
    push(cod, NOMBRE_CONTROL[cod], faltan(cod, cobrado[cod] || 0));
  }

  // 4. Hubs vendidos: cada uno arrastra router (DOM05) y adaptador (DOM33).
  const hubs = cobrado[COD_HUB_DOMOTICA] || 0;
  if (hubs > 0) {
    push(COD_HUB_DOMOTICA, NOMBRE_HUB_DOMOTICA, faltan(COD_HUB_DOMOTICA, hubs));
    push(COD_ROUTER_DOMOTICA, NOMBRE_ROUTER_DOMOTICA, faltan(COD_ROUTER_DOMOTICA, hubs));
    push(COD_CARGADOR_MOTOR_ALT, NOMBRE_CARGADOR_MOTOR_ALT, faltan(COD_CARGADOR_MOTOR_ALT, hubs));
  }
  return out;
}

/**
 * Manillas planas COBRADAS en Fase 1 que no salieron por ningún paño.
 *
 * Espejo de `faltantesDomoticaInventario`, y por el mismo motivo: la manilla
 * llega al paño por `manillaCant`, que se precarga cruzando la UBICACIÓN del
 * adicional con la del paño. Ese cruce falla cuando la ventana tiene varios
 * paños (un beeblack doble es "LIVING-G1"/"LIVING-G2" contra el "LIVING" del
 * adicional), y entonces la manilla cobrada no aparecía en ninguna hoja. Con
 * este top-up sale igual, sin importar la ubicación.
 *
 * @param emitidasPorCodigo lo ya emitido por los paños, por código HER.
 */
export function faltantesManillasInventario(
  adicionales: AdicionalFase0Persistido[] | undefined,
  emitidasPorCodigo: Record<string, number>,
): InsumoCortina[] {
  const out: InsumoCortina[] = [];
  if (!adicionales?.length) return out;
  const cobrado: Record<string, number> = {};
  for (const a of adicionales) {
    const man = manillaDesdeAdicional(a.codInt);
    const cant = Math.round(Number(a.cantidad) || 0);
    if (!man || cant <= 0) continue;
    cobrado[man.codigo] = (cobrado[man.codigo] || 0) + cant;
  }
  for (const cod of Object.keys(cobrado)) {
    const faltan = cobrado[cod] - (emitidasPorCodigo[cod] || 0);
    if (faltan > 0) {
      out.push({ codigo: cod, descripcion: MANILLAS[cod].nombre, color: MANILLAS[cod].color, cantidad: faltan });
    }
  }
  return out;
}

/**
 * Registra en el acumulador de "ya emitido" una línea del kit de motor de un paño.
 * La unidad de motor se cuenta por el código ORIGINAL del paño (el kit pudo
 * remapear DOM41→DOM38 en cenefa ovalada) y el resto por su propio código.
 */
export function registrarKitEmitido(
  emitidos: Record<string, number>,
  ins: InsumoCortina,
  motorModeloOriginal: string | undefined,
): void {
  const clave = esCodigoMotor(ins.codigo)
    ? (motorModeloOriginal || '').toUpperCase()
    : ins.codigo.toUpperCase();
  if (clave) emitidos[clave] = (emitidos[clave] || 0) + ins.cantidad;
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

/**
 * ¿Alguna cortina de la OT lleva domótica? Solo marca el flag de la cortina; el
 * hub, el router y el adaptador salen de lo VENDIDO en Fase 1 (ver
 * `faltantesDomoticaInventario`), no de este gate.
 */
export function otLlevaDomotica(ventanas: Ventana[]): boolean {
  return ventanas.some((v) => (v.panos || []).some(panoLlevaDomotica));
}
