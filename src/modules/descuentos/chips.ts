// ─────────────────────────────────────────────────────────────────────
// Puente entre el catálogo de descuentos (modelo de fabricación) y los
// CHIPS del editor de paño de Fase 2 (OPCIONES_MECANISMO / OPCIONES_TUBERIA,
// heredados del legacy). Permite que al elegir modelo se marquen los chips
// y que al clickear un chip de mecanismo se actualice el modelo.
//
// Las reglas de negocio (color→MEC, categoría→MEC) viven en reglas-mecanismo.ts.
// Módulo puro.
// ─────────────────────────────────────────────────────────────────────
import type { ModeloDespiece } from './tipos';
import { categoriaEsDual, elegirModeloPorColor, modelosParaCategoria } from './tipos';
import {
  REGLAS_MECANISMO,
  anchoEnBanda,
  categoriaRequiereMecanismo,
  categoriaTieneReglaAncho,
  colorConBandaAncho,
  esCategoriaPletina,
  esCategoriaVertical,
  esKit45,
  esKitInventarioMec,
  esKitLineaBValido,
  esMecLegacy,
  kitsLineaB,
  mecKit45PorColor,
  mecLineaB,
  mecPorAncho,
  mecPorCategoriaYColor,
  mecRecoloreado,
  normalizarColorAccesorio,
  numeroMecDeChip,
  numeroMecPorColor,
  reglaAnchoAplicable,
  reglaBanda45,
  reglaCategoriaAplicable,
  type ReglasMecanismo,
} from './reglas-mecanismo';
// Binding local (los del bloque `export { … } from` no quedan disponibles en el
// cuerpo del módulo): resincronizarChipsPanos los usa.
import {
  canonizarChipTuberia,
  codigoTuberiaDeChip,
  diametroTuboPorCodigo,
  tuberiaParaPano,
  tuboPorReglaEs45,
  type ReglasTuberia,
} from './reglas-tuberia';
import { REGLAS_SELECCION_DEFAULT, type ReglasSeleccion } from './reglasSeleccion';
import { categoriaEfectiva, type TipoCortina } from './tiposCortina';
// familiaOscuridad: para distinguir soft light con cenefa CUADRADA (kit simple,
// como DARK) del soft light ovalado (kit MEC 39/38). reglas-oscuridad es hoja (sin ciclo).
import {
  esFamiliaSoftLightCC,
  familiaOscuridad,
  familiaOscuridadConDiametro,
} from './reglas-oscuridad';

export {
  REGLAS_MECANISMO,
  categoriaRequiereMecanismo,
  normalizarColorAccesorio,
  numeroMecDeChip,
  numeroMecPorColor,
  mecPorAncho,
  mecPorCategoriaYColor,
  mecRecoloreado,
  reglaAnchoAplicable,
  reglaCategoriaAplicable,
  colorParaBusquedaModelo,
} from './reglas-mecanismo';

export {
  REGLAS_TUBERIA,
  canonizarChipTuberia,
  chipTuberiaDeModelo,
  chipTuberiaPorAncho,
  codigoTuberiaDeChip,
  diametroDesdeChipMecanismo,
  opcionesTuberiaFiltradas,
  tuberiaCorregidaPorMecanismo,
  tuberiaParaPano,
} from './reglas-tuberia';

/** @deprecated Usar REGLAS_MECANISMO.colorAMec */
export const MAPEO_COLOR_MEC = REGLAS_MECANISMO.colorAMec;

export function chipMecanismoPorNumero(
  num: number,
  opciones: readonly string[],
): string | null {
  // Compara por número (robusto a formato cero-padded '[MEC 01]' de los duales).
  return opciones.find((o) => numeroMecDeChip(o) === num) ?? null;
}

// ── Mecanismos duales (producto duo día/noche) ───────────────────────
const NUMS_MEC_DUAL = new Set([1, 2, 3, 4, 19, 20, 24, 25]);
const DUAL_LADO_COLOR_A_MEC: Record<string, number> = {
  'DERECHO|BCO': 1, 'IZQUIERDO|BCO': 2, 'DERECHO|NEG': 3, 'IZQUIERDO|NEG': 4,
  'MIXTO|BCO': 19, 'MIXTO|NEG': 20, 'DERECHO|GRS': 24, 'IZQUIERDO|GRS': 25,
};
const MEC_DUAL_A_LADO_COLOR: Record<number, { lado: string; dualColor: string }> = {
  1: { lado: 'DERECHO', dualColor: 'BCO' }, 2: { lado: 'IZQUIERDO', dualColor: 'BCO' },
  3: { lado: 'DERECHO', dualColor: 'NEG' }, 4: { lado: 'IZQUIERDO', dualColor: 'NEG' },
  19: { lado: 'MIXTO', dualColor: 'BCO' }, 20: { lado: 'MIXTO', dualColor: 'NEG' },
  24: { lado: 'DERECHO', dualColor: 'GRS' }, 25: { lado: 'IZQUIERDO', dualColor: 'GRS' },
};

/** true si el chip es un mecanismo dual ([MEC 01..04, 19, 20, 24, 25]). */
export function esChipDual(chip: string | null | undefined): boolean {
  const n = numeroMecDeChip(chip);
  return n != null && NUMS_MEC_DUAL.has(n);
}

/** Color de accesorios normalizado a BCO/NEG/GRS (o '' si no calza). */
function colorAccCorto(color: string | null | undefined): string {
  const c = normalizarColorAccesorio(color);
  if (c === 'BCO' || c === 'BLANCO') return 'BCO';
  if (c === 'NEG' || c === 'NEGRO') return 'NEG';
  if (c === 'GRS' || c === 'GRIS') return 'GRS';
  return '';
}

/** Chip dual por lado + color. MIXTO no tiene gris → degrada a DERECHO. */
export function chipDualPorLadoColor(
  lado: string | null | undefined,
  color: string | null | undefined,
  opciones: readonly string[],
): string | null {
  const cc = colorAccCorto(color);
  if (!cc) return null;
  let l = (lado || 'DERECHO').toUpperCase();
  if (l === 'MIXTO' && cc === 'GRS') l = 'DERECHO';
  const mec = DUAL_LADO_COLOR_A_MEC[`${l}|${cc}`];
  return mec != null ? chipMecanismoPorNumero(mec, opciones) : null;
}

/** Lado + color implícitos en un chip dual (para rellenar dualLado/dualColor). */
export function ladoColorDesdeChipDual(
  chip: string | null | undefined,
): { lado: string; dualColor: string } | null {
  const n = numeroMecDeChip(chip);
  return n != null ? MEC_DUAL_A_LADO_COLOR[n] ?? null : null;
}

/** Chip de mecanismo que corresponde al modelo: 'MEC_13_…' → '… [MEC 13]'. */
export function chipMecanismoDeModelo(
  modelo: ModeloDespiece,
  opciones: readonly string[],
): string | null {
  const m = modelo.mecanismo.toUpperCase().match(/^MEC_(\d+)/);
  if (!m) return null;
  return opciones.find((o) => o.toUpperCase().includes(`[MEC ${m[1]}]`)) ?? null;
}

/** true si el chip es un MEC legacy del Excel (no inventario 32/33/34). */
export function esMecLegacyInventario(
  chip: string | null | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): boolean {
  const n = numeroMecDeChip(chip);
  return n != null && esMecLegacy(n, reglas);
}

/** Chip default por color de accesorios (BCO→33, GRS→34, NEG→32). */
export function chipMecanismoPorColor(
  color: string | null | undefined,
  opciones: readonly string[],
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): string | null {
  const num = numeroMecPorColor(color, reglas);
  if (num == null) return null;
  return chipMecanismoPorNumero(num, opciones);
}

/** Color de accesorios del paño: mecanismo → peso → cadena → tela → ventana. */
export function colorAccesoriosDePano(
  p: Partial<{
    colorMecanismo?: string | null;
    colorPeso?: string | null;
    colorCadena?: string | null;
    color?: string | null;
  }>,
  ventanaColor?: string | null,
): string {
  return (
    (p.colorMecanismo as string) ||
    (p.colorPeso as string) ||
    (p.colorCadena as string) ||
    (p.color as string) ||
    ventanaColor ||
    ''
  );
}

/**
 * Mecanismo que debe quedar en el paño: reglas de categoría primero,
 * luego inventario por color, reemplazando legacy/vacío.
 */
export function mecanismoParaPano(
  p: Partial<{ mecanismo?: string; dual?: boolean; dualLado?: string; colorMecanismo?: string; colorPeso?: string; colorCadena?: string; color?: string; cenefa?: string; tubo45Manual?: boolean }>,
  ventanaColor: string | undefined,
  modelo: ModeloDespiece | null | undefined,
  opciones: readonly string[],
  categoria?: string,
  anchoM?: number,
  usarTuboE78 = false,
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
  lineaB = false,
): string {
  const rm = reglas.mecanismo;
  const colorAcc = colorAccesoriosDePano(p, ventanaColor);
  // La cortina es de 45 cuando lo pide el interruptor de la OT, cuando este
  // paño lo pidió a mano (`Pano.tubo45Manual`) o cuando la REGLA DE TUBERÍA ya
  // le asigna un tubo Ø45 a este ancho (desde 2026-08-20 la banda 38 mm >2,2 m
  // nombra al E39, porque el E66 se descontinuó). En los tres casos el kit
  // sigue al tubo: un kit de 38 no calza en un Ø45.
  const tuboAutoEs45 = anchoM != null && tuboPorReglaEs45(anchoM, categoria, reglas.tuberia);
  const banda45 = usarTuboE78 || !!p.tubo45Manual || tuboAutoEs45;

  // Pletina (velcro): mecanismo fijo VELCRO. No lleva kit de mecanismo por color
  // ni por categoría (y en el inventario NO se emite insumo — ver bom/pdfInventario).
  if (esCategoriaPletina(categoria, reglas.tipos)) return 'VELCRO';

  // VERTICAL: su estructura es perfil cabezal + varilla + carritos, no un kit
  // de mecanismo roller. Sin esta guarda, ahora que la categoría tiene modelo,
  // caería en el kit por color y aparecería en el BOM/inventario.
  if (esCategoriaVertical(categoria)) return '';

  // Rama dual: usa los chips [MEC 01..25], no los kits por color ni la categoría.
  // El chip guardado se RECOLOREA al color de accesorios conservando el lado
  // (igual que el kit simple y la cadena); si el color no tiene chip dual
  // (MET/CAFÉ: los 8 duales solo existen en BCO/NEG/GRS) se conserva el guardado.
  if (p.dual) {
    const storedDual = ((p.mecanismo as string) || '').trim();
    if (esChipDual(storedDual)) {
      const lado = ladoColorDesdeChipDual(storedDual)?.lado ?? p.dualLado;
      return chipDualPorLadoColor(lado, colorAcc, opciones) || storedDual;
    }
    const chipDual = chipDualPorLadoColor(p.dualLado, colorAcc, opciones);
    return chipDual || storedDual;
  }

  // LÍNEA B (gama económica): juego de herrajes propio. Va ANTES de la regla
  // por ancho y de la de categoría porque la línea B no participa de las bandas
  // (45 mm / 63 mm): su tubo es E01 en todo ancho y el ancho máximo lo acota la
  // fila del catálogo. Retornar acá también evita el reemplazo de MEC legacy,
  // así el MEC 06 de una cortina B se conserva mientras que en una cortina A
  // (lineaB=false) sigue migrando al kit por color, como siempre.
  if (lineaB) {
    const numB = mecLineaB(categoria || '', colorAcc, rm, reglas.tipos);
    if (numB != null) {
      const trimmed = ((p.mecanismo as string) || '').trim();
      const nStored = numeroMecDeChip(trimmed);
      // Kit B elegido a mano y válido para esta categoría y color (el roller
      // simple blanco admite MEC 06 o MEC 44): se respeta. Al cambiar el color
      // deja de ser válido y cae al default del color nuevo = recoloreo.
      if (nStored != null && esKitLineaBValido(categoria || '', colorAcc, nStored, rm, reglas.tipos)) {
        return trimmed;
      }
      return chipMecanismoPorNumero(numB, opciones) || trimmed;
    }
    // Color sin receta B (gris, café…): NO caer a los kits de la línea A —
    // serían herrajes de otra línea. Se deja lo guardado y `pendientesFase2`
    // bloquea la OT pidiendo blanco/negro o forzar la línea A.
    return ((p.mecanismo as string) || '').trim();
  }

  // Regla por ancho (>3 m → MEC 28 · banda 2,2–3,0 → kit 45 por color). Va
  // ANTES que la de categoría: el dúo manual 38 tiene regla de categoría
  // (kit ovalada 38) que la banda debe poder pisar. MEC 28 es "legacy" en el
  // catálogo, así que forzarlo acá evita que la sync lo revierta al kit color.
  const mecAncho =
    anchoM != null ? mecPorAncho(categoria || '', anchoM, colorAcc, banda45, rm) : null;
  if (mecAncho != null) {
    const chipAncho = chipMecanismoPorNumero(mecAncho, opciones);
    if (chipAncho) {
      const trimmed = ((p.mecanismo as string) || '').trim();
      if (!trimmed) return chipAncho;
      const nStored = numeroMecDeChip(trimmed);
      if (nStored === mecAncho) return trimmed;
      if (nStored != null && esKitInventarioMec(nStored, rm)) return chipAncho;
      if (nStored != null && esMecLegacy(nStored, rm)) return chipAncho;
      if (opciones.includes(trimmed)) return trimmed;
      return chipAncho;
    } else {
      // El MEC de la regla no tiene chip en la lista: la regla se ignora en
      // silencio y decide la de categoría/color. El editor de Admin lo valida
      // como ERROR, así que esto solo pasa con datos viejos o corruptos.
      console.warn(
        `[reglas] el MEC ${mecAncho} de la regla por ancho no tiene chip: se ignora la regla`,
      );
    }
  }

  // DARK sobre tubería 0,45 (familia DARK_45): kit COMPLETO de 45 mm por color —
  // MEC 18 blanco, MEC 23 el resto (no existe kit 45 café ni gris; el usuario los
  // manda al negro). El DARK no usa NADA de la armadura de cenefa ovalada, así que
  // este kit entero es el que baja al inventario (regla del usuario 2026-07-31).
  // El DARK de 38 mm conserva el kit simple por color. Un kit elegido a mano se
  // respeta salvo que sea otro kit de inventario: ahí manda el que corresponde,
  // igual que en las demás reglas (así se corrigen las OT guardadas con MEC 32).
  const famDiam = familiaOscuridadConDiametro(
    categoria,
    p.cenefa,
    modelo?.diametro_tubo_mm,
    reglas.tipos,
  );
  if (famDiam === 'DARK_45') {
    const chip45 = chipMecanismoPorNumero(mecKit45PorColor(colorAcc), opciones);
    if (chip45) {
      const trimmed = ((p.mecanismo as string) || '').trim();
      if (!trimmed) return chip45;
      const nStored = numeroMecDeChip(trimmed);
      if (nStored === numeroMecDeChip(chip45)) return trimmed;
      if (nStored != null && esKitInventarioMec(nStored, rm)) return chip45;
      if (opciones.includes(trimmed)) return trimmed;
      return chip45;
    }
  }

  // Soft light con cenefa CUADRADA (familias SOFT_LIGHT_CC / _CC_45): usa el kit
  // SIMPLE por color (MEC 33/32/34), igual que DARK — NO el kit ovalada MEC 39/38
  // de la regla de categoría del soft light. Saltamos la regla de categoría para
  // que caiga al fallback por color. El soft light OVALADO conserva su kit ovalada.
  const famCC = familiaOscuridad(categoria, p.cenefa, reglas.tipos);
  const esSoftLightCC = !!famCC && esFamiliaSoftLightCC(famCC);
  const mecCat = esSoftLightCC ? null : mecPorCategoriaYColor(categoria || '', colorAcc, rm);
  if (mecCat != null) {
    const chipCat = chipMecanismoPorNumero(mecCat, opciones);
    if (chipCat) {
      const stored = (p.mecanismo as string) || '';
      const trimmed = stored.trim();
      if (!trimmed) return chipCat;
      const nStored = numeroMecDeChip(trimmed);
      if (nStored === mecCat) return trimmed;
      if (nStored != null && esKitInventarioMec(nStored, rm)) return chipCat;
      if (opciones.includes(trimmed)) return trimmed;
      return chipCat;
    } else {
      console.warn(
        `[reglas] el MEC ${mecCat} de la regla por categoría no tiene chip: se ignora la regla`,
      );
    }
  }

  // El kit sigue al DIÁMETRO del tubo: con el modelo en 45 mm, o con la regla
  // de tubería asignando un Ø45 a este ancho, el roller simple lleva el kit de
  // 45 por color — un kit de 38 no calza en ese tubo. Antes solo lo hacía la
  // banda con el interruptor de la OT; con él apagado, la cortina quedaba con
  // E39 y kit de 38 (OT 3195, 2026-08-21). Solo donde el kit sale de la familia
  // por color: la ovalada y el dúo usan su kit ovalada en 38 y 45 (regla de
  // categoría, arriba) y la oscuridad tiene su propio 45 (DARK_45, arriba).
  // Un 45 elegido a mano en un color SIN regla de banda (gris) se respeta, como
  // siempre; en blanco/negro se recolorea como hace la banda.
  if (!famCC && (modelo?.diametro_tubo_mm === 45 || tuboAutoEs45)) {
    const chip45 = chipMecanismoPorNumero(mecKit45PorColor(colorAcc), opciones);
    if (chip45) {
      const trimmed = ((p.mecanismo as string) || '').trim();
      const nStored = numeroMecDeChip(trimmed);
      if (esKit45(nStored) && !colorConBandaAncho(categoria || '', colorAcc, rm)) return trimmed;
      return chip45;
    }
  }

  const porColor = chipMecanismoPorColor(colorAcc, opciones, rm);
  const stored = (p.mecanismo as string) || '';
  const inventario = opcionesInventarioMec(opciones, rm);

  if (porColor) {
    const nStored = numeroMecDeChip(stored.trim());
    if (
      !stored.trim() ||
      nStored == null ||
      esMecLegacy(nStored, rm) ||
      !inventario.includes(stored)
    ) {
      return porColor;
    }
    // El kit guardado sigue al COLOR de accesorios conservando su familia: un
    // simple blanco pasa a simple negro y un reforzado blanco a reforzado negro
    // (no se degrada a simple). Es lo mismo que hace la cadena, que conserva el
    // largo y cambia el color. Sin esto, cambiar el color en Fase 1 o Fase 2
    // dejaba el kit del color viejo hasta que alguien tocara el chip a mano.
    const nRecolor = mecRecoloreado(nStored, colorAcc, rm);
    if (nRecolor != null) {
      const chipRecolor = chipMecanismoPorNumero(nRecolor, opciones);
      if (chipRecolor) return chipRecolor;
    }
    // Kit 45 mm puesto por la banda 2,2–3,0 m: al salir de la banda vuelve al
    // kit por color — solo para colores CON regla de banda; sin regla (gris en
    // ROL) el kit 45 fue elección manual y se respeta.
    // Guarda de coherencia: si el MODELO guardado sigue en 45 mm (una OT con E78
    // planificado que aún NO se re-guardó con el flag apagado), NO bajar el kit
    // — el trío modelo+kit+tubo debe revertir JUNTO. Fase 2/Fase 0 revierten el
    // modelo primero (a 38 mm) y ahí sí baja el kit; mientras el modelo siga en
    // 45 mm, el BOM/inventario muestra kit 45 + E78 coherentes.
    if (
      nStored != null &&
      esMecDeBanda(nStored, rm) &&
      colorConBandaAncho(categoria || '', colorAcc, rm) &&
      !(modelo && modelo.diametro_tubo_mm === 45)
    ) {
      return porColor;
    }
    return stored;
  }

  return chipMecanismoEfectivo(stored, colorAcc, modelo, opciones, rm);
}

/** true si el número MEC es de los que fuerza alguna banda por ancho+color. */
function esMecDeBanda(num: number, reglas: ReglasMecanismo = REGLAS_MECANISMO): boolean {
  return reglas.reglasAncho.some(
    (r) => r.mecPorColor && Object.values(r.mecPorColor).includes(num),
  );
}

/**
 * Chip efectivo para producción/inventario: el mapeo color→inventario (32/33/34)
 * gana sobre chips legacy del Excel (MEC 05, 06, 14…) guardados por error.
 */
export function chipMecanismoEfectivo(
  stored: string | null | undefined,
  colorAccesorios: string | null | undefined,
  modelo: ModeloDespiece | null | undefined,
  opciones: readonly string[],
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): string {
  const porColor = chipMecanismoPorColor(colorAccesorios, opciones, reglas);
  const trimmed = (stored || '').trim();
  if (porColor) {
    const nStored = numeroMecDeChip(trimmed);
    if (!trimmed || (nStored != null && esMecLegacy(nStored, reglas))) {
      return porColor;
    }
    return trimmed;
  }
  if (trimmed) return trimmed;
  if (modelo) {
    const delModelo = chipMecanismoDeModelo(modelo, opciones);
    if (delModelo) return delModelo;
  }
  return '';
}

/**
 * Resuelve el chip de mecanismo para un paño: inventario por color primero,
 * luego valor guardado, luego modelo de despiece Excel.
 */
export function chipMecanismoParaPano(
  modelo: ModeloDespiece | null | undefined,
  colorAccesorios: string | null | undefined,
  opciones: readonly string[],
  stored?: string | null,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): string | null {
  const efectivo = chipMecanismoEfectivo(stored, colorAccesorios, modelo, opciones, reglas);
  return efectivo || null;
}

/** Chips de inventario bodega (kitsInventario) siempre disponibles en Fase 2. */
export function opcionesInventarioMec(
  opcionesBase: readonly string[],
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): string[] {
  return opcionesBase.filter((o) => {
    const n = numeroMecDeChip(o);
    return n != null && esKitInventarioMec(n, reglas);
  });
}

/**
 * Opciones de mecanismo visibles según categoría y color de accesorios.
 * Consulta REGLAS_MECANISMO.reglasCategoria y kitsInventario.
 */
export function opcionesMecanismoFiltradas(
  modelos: ModeloDespiece[],
  categoria: string,
  colorAccesorios: string | null | undefined,
  opcionesBase: readonly string[],
  mecanismoActual?: string,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
  lineaB = false,
  /** Chips de RESOLUCIÓN (incluyen los ocultos): los kits B están ocultos, así
   *  que no llegan por `opcionesBase`. Sin esto el selector B saldría vacío. */
  opcionesResolucion?: readonly string[],
): readonly string[] {
  if (!categoriaRequiereMecanismo(categoria, reglas)) return [];

  // Pletina (velcro): la única opción de mecanismo es VELCRO.
  if (esCategoriaPletina(categoria, tipos)) return ['VELCRO'];

  // LÍNEA B: solo sus propios kits (default del color + alternativas). Un color
  // sin receta deja la lista vacía y el gate de Fase 2 lo explica.
  if (lineaB) {
    const desde = opcionesResolucion ?? opcionesBase;
    return kitsLineaB(categoria, colorAccesorios, reglas, tipos)
      .map((n) => chipMecanismoPorNumero(n, desde))
      .filter((c): c is string => !!c);
  }

  const regla = reglaCategoriaAplicable(categoria, colorAccesorios, reglas);
  if (regla) {
    const opts = [...opcionesBase];
    if (
      mecanismoActual &&
      opcionesBase.includes(mecanismoActual) &&
      !opts.includes(mecanismoActual)
    ) {
      opts.push(mecanismoActual);
    }
    return opts;
  }

  const inventario = opcionesInventarioMec(opcionesBase, reglas);

  if (inventario.length > 0) {
    const opts = [...inventario];
    if (
      mecanismoActual &&
      !opts.includes(mecanismoActual) &&
      opcionesBase.includes(mecanismoActual) &&
      !esMecLegacyInventario(mecanismoActual, reglas)
    ) {
      opts.push(mecanismoActual);
    }
    return opts;
  }

  const chipColor = chipMecanismoPorColor(colorAccesorios, opcionesBase, reglas);
  if (chipColor) return [chipColor];

  const candidatos = modelosParaCategoria(modelos, categoria, tipos);
  const chipsCategoria = [
    ...new Set(
      candidatos
        .map((m) => chipMecanismoDeModelo(m, opcionesBase))
        .filter((c): c is string => !!c),
    ),
  ];
  if (chipsCategoria.length > 0) {
    if (mecanismoActual && !chipsCategoria.includes(mecanismoActual) && opcionesBase.includes(mecanismoActual)) {
      return [...chipsCategoria, mecanismoActual];
    }
    return chipsCategoria;
  }

  if (mecanismoActual && opcionesBase.includes(mecanismoActual)) return [mecanismoActual];
  return opcionesBase;
}

/** Modelo del catálogo cuyo mecanismo es 'MEC_<num>_…' (o cero-padded 'MEC_0N_…'). */
export function modeloDesdeNumeroMec(
  candidatos: ModeloDespiece[],
  num: number,
): ModeloDespiece | null {
  return candidatos.find((c) => mecanismoCoincideNumero(c.mecanismo, num)) ?? null;
}

/** Modelo del catálogo que corresponde a un chip: '… [MEC 13]' → 'MEC_13_…'. */
export function modeloDesdeChipMecanismo(
  candidatos: ModeloDespiece[],
  chip: string,
): ModeloDespiece | null {
  const m = chip.toUpperCase().match(/\[MEC (\d+)\]/);
  if (!m) return null;
  return modeloDesdeNumeroMec(candidatos, parseInt(m[1], 10)); // '[MEC 01]' → 1
}

/**
 * Oscuridad 38 mm (SOFT LIGHT y DARK): la banda 2,2–3,0 m con el toggle E78 de la
 * OT sube al MISMO sistema en 45 mm (tubo E78); fuera de banda / toggle off vuelve
 * a 38 mm. Estos modelos no traen mecanismo, así que se desambiguan por sistema +
 * tipo_rol (mismo variante INTERNO/SEMI/EXTERNO, solo cambia el "38mm"↔"45mm").
 * Devuelve el modelo actual si no hay fila destino. Nota: en soft light el swap a
 * 45 mm además cambia el CORTE del tubo (familiaOscuridadConDiametro remapea
 * SOFT_LIGHT_38→_45); DARK comparte tablas 38/45, así que solo cambia el tubo/kit.
 */
function modeloOscuridad38PorBandaE78(
  modelos: ModeloDespiece[],
  anchoM: number,
  modeloActual: ModeloDespiece | null,
  usarTuboE78: boolean,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
): ModeloDespiece | null {
  if (!modeloActual) return modeloActual;
  const banda = reglas.bandaOscuridadE78;
  const enBanda = usarTuboE78 && anchoM > banda.anchoMinM && anchoM <= banda.anchoMaxM;
  const objetivoDiam = enBanda ? 45 : 38;
  if (modeloActual.diametro_tubo_mm === objetivoDiam) return modeloActual;
  const tipoObjetivo = modeloActual.tipo_rol.replace(enBanda ? '38mm' : '45mm', enBanda ? '45mm' : '38mm');
  const encontrado = modelos.find(
    (m) => m.sistema === modeloActual.sistema && m.tipo_rol === tipoObjetivo,
  );
  return encontrado ?? modeloActual;
}

/**
 * Modelo efectivo de la VENTANA según el ANCHO.
 *  · Roller simple sobre 3 m sube a la fila 63 mm (MEC 28, tubo E65).
 *  · Banda 2,2–3,0 m: ROL sube al kit 45 mm por color (DECORELLI/ROLZZO) y el
 *    dúo manual 38 a la fila ovalada 45 de su color (tubo E78). Gris en ROL no
 *    tiene regla → no se toca (elección manual).
 *  · Al salir del rango vuelve al 38 mm por color. Un 45 mm elegido a mano en
 *    un color SIN regla de banda (gris ROL) NO se revierte.
 * El resto de categorías —incluidas OSCURANTI y las ovaladas, legítimamente de
 * 63 mm— se devuelven sin tocar. Es la contraparte "al abrir/sincronizar" de la
 * cascada mecanismo→modelo que corre al editar (aplicarCascadaMecanismo).
 * El modelo es por ventana, así que se decide con el ancho de referencia (el
 * paño más ancho). Para paños dual NO se aplica (mantienen su modelo dual 38 mm).
 */
export function modeloPorAncho(
  modelos: ModeloDespiece[],
  categoria: string,
  anchoM: number,
  modeloActual: ModeloDespiece | null,
  color: string | null | undefined,
  usarTuboE78 = false,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
  lineaB = false,
  /** Algún paño de la ventana pidió 45 mm a mano (`Pano.tubo45Manual`). */
  tubo45Manual = false,
  /** Reglas de tubería vigentes: si a este ancho le asignan un tubo Ø45 (E66
   *  descontinuado → E39), la cortina es de 45 aunque nadie lo pida. */
  reglasTuberia?: ReglasTuberia,
): ModeloDespiece | null {
  // LÍNEA B: no participa de las bandas por ancho (su tubo es E01 siempre). Su
  // fila se elige por el número del kit B; el ancho máximo lo acota la fila.
  if (lineaB) {
    const numB = mecLineaB(categoria || '', color, reglas, tipos);
    if (numB == null) return modeloActual;
    const cands = modelosParaCategoria(modelos, categoria, tipos, true);
    const nStored = modeloActual ? numeroMecDeModelo(modeloActual) : null;
    // Kit B alternativo ya elegido (MEC 44 en el simple blanco): conservar su fila.
    const buscado =
      nStored != null && esKitLineaBValido(categoria || '', color, nStored, reglas, tipos)
        ? nStored
        : numB;
    const delMec = cands.filter((c) => mecanismoCoincideNumero(c.mecanismo, buscado));
    return delMec[0] ?? modeloActual;
  }

  // Oscuridad 38 mm (soft light y DARK) tiene su propia banda E78 (swap 38↔45 mm
  // por sistema/tipo_rol, no por mecanismo): va antes de la maquinaria roller
  // basada en número MEC. DARK usa el mismo mecanismo que soft light (E78 por OT).
  // La cortina es de 45 cuando lo pide el interruptor de la OT, cuando un paño
  // lo pidió a mano (`Pano.tubo45Manual`) o cuando la REGLA DE TUBERÍA le
  // asigna un tubo Ø45 a este ancho (desde 2026-08-20 la banda 38 mm >2,2 m
  // nombra al E39 porque el E66 se descontinuó): un kit de 38 no calza en ese
  // tubo, así que la fila de despiece sigue al tubo. Si el E66 vuelve desde
  // Admin, todo vuelve solo a 38. El 45 a mano no aplica a la oscuridad (su 45
  // es una categoría propia que se elige en Fase 1); el de la regla, sí.
  const tuboAutoEs45 = !!reglasTuberia && tuboPorReglaEs45(anchoM, categoria, reglasTuberia);
  const catTrim = categoriaEfectiva(categoria, tipos).trim();
  if (catTrim === 'SOFT_LIGHT_38mm' || catTrim === 'DARK_38mm') {
    return modeloOscuridad38PorBandaE78(modelos, anchoM, modeloActual, usarTuboE78 || tuboAutoEs45, reglas);
  }
  const abre45 = usarTuboE78 || tubo45Manual || tuboAutoEs45;
  const aplicada = reglaAnchoAplicable(categoria || '', anchoM, color, abre45, reglas);
  if (aplicada) {
    // La fila destino puede vivir en otra categoría (dúo 38 → filas MANUAL_45)
    // y el número MEC puede repetirse por color (MEC 18 ovalada blanco Y gris):
    // filtra por número y desambigua por color. El kit MOSTRADO (aplicada.mec)
    // puede diferir del MEC de la fila del catálogo (dúo banda: kit ovalada
    // 39/38/12 pero filas MEC_18/23_OVALADA) → usa modeloMecPorColor si existe.
    const mecFila =
      aplicada.regla.modeloMecPorColor?.[normalizarColorAccesorio(color)] ?? aplicada.mec;
    const cands = modelosParaCategoria(modelos, aplicada.regla.categoriaModelo ?? categoria, tipos);
    const delMec = cands.filter((c) => mecanismoCoincideNumero(c.mecanismo, mecFila));
    const up = delMec.length > 0 ? elegirModeloPorColor(delMec, color) : null;
    if (up) return up;
    // Catálogo sin la fila forzada: no dejar colgado un modelo de otra banda.
    if (modeloActual && modeloActual.diametro_tubo_mm !== 38) {
      return modeloBase38PorColor(modelos, categoria, color, tipos) ?? modeloActual;
    }
    return modeloActual;
  }
  // El color no tiene fila en la regla de banda (gris en el roller simple) pero
  // el tubo ES de Ø45 —lo pidió el paño a mano o lo asigna la regla de
  // tubería—: igual hay que fabricar en 45 → la fila del kit 45 por color
  // (MEC 23: no hay kit 45 gris, va al negro como en el DARK 45). Solo si esa
  // fila existe en el catálogo; si no (ovalada roller gris, sin fila 45), se
  // queda en 38. Con el interruptor de la OT a secas el gris sigue MANUAL
  // (decisión de 2026-07-15): ahí el tubo de 38 todavía es una opción.
  if (tubo45Manual || tuboAutoEs45) {
    const banda = reglaBanda45(categoria || '', reglas);
    if (banda && anchoEnBanda(anchoM, banda)) {
      const cands = modelosParaCategoria(modelos, banda.categoriaModelo ?? categoria, tipos);
      const delMec = cands.filter((c) => mecanismoCoincideNumero(c.mecanismo, mecKit45PorColor(color)));
      const up = delMec.length > 0 ? elegirModeloPorColor(delMec, color) : null;
      if (up) return up;
    }
  }
  // Sin banda vigente: si el modelo quedó forzado por ancho (63 mm, o 45 mm en
  // un color CON regla de banda), volver al 38 mm por color. El 45 pedido a
  // mano o asignado por la regla de tubería no fue la banda de la OT: se
  // respeta, igual que el gris.
  if (categoriaTieneReglaAncho(categoria, reglas) && modeloActual) {
    const forzado =
      modeloActual.diametro_tubo_mm === 63 ||
      (modeloActual.diametro_tubo_mm === 45 &&
        !abre45 &&
        colorConBandaAncho(categoria, color, reglas));
    if (forzado) return modeloBase38PorColor(modelos, categoria, color, tipos) ?? modeloActual;
  }
  return modeloActual;
}

/**
 * Lo que debe cambiar en el paño cuando el vendedor elige un TUBO a mano en
 * Fase 2: el kit sigue al diámetro del tubo, y la cortina queda marcada (o
 * desmarcada) como «45 pedido a mano» (`Pano.tubo45Manual`).
 *
 *  · Ø45 (E39/E05): en el roller simple el kit pasa al de 45 por color (un kit
 *    de 38 no calza en ese tubo); en la ovalada y el dúo el kit ovalada sirve en
 *    los dos diámetros y no cambia — solo queda la marca, que cruza el modelo a
 *    la fila de 45.
 *  · Ø38 (E02/E66): se apaga la marca y un kit de 45 vuelve al kit por color.
 *  · Ø63 (E47/E65): el kit es el de 63 mm (MEC 28), como la regla de >3 m.
 *
 * `null` cuando el tubo no dice nada del kit: VELCRO/vacío, dual (kit propio),
 * pletina, vertical, categoría B (su banda es otra) y oscuridad (su 45 es una
 * categoría propia en Fase 1). `mecanismo` null = conservar el actual.
 */
export function kitPorTuboElegido(
  p: Partial<{ mecanismo?: string; dual?: boolean; colorMecanismo?: string; colorPeso?: string; colorCadena?: string; color?: string; cenefa?: string }>,
  ventanaColor: string | undefined,
  categoria: string | undefined,
  chipTuberia: string,
  opciones: readonly string[],
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
  lineaB = false,
): { mecanismo: string | null; tubo45Manual: boolean } | null {
  if (p.dual || lineaB) return null;
  if (esCategoriaPletina(categoria, reglas.tipos) || esCategoriaVertical(categoria)) return null;
  if (familiaOscuridad(categoria, p.cenefa, reglas.tipos)) return null;
  const diam = diametroTuboPorCodigo(codigoTuberiaDeChip(chipTuberia), reglas.tuberia);
  if (diam == null) return null;

  const rm = reglas.mecanismo;
  const colorAcc = colorAccesoriosDePano(p, ventanaColor);
  const actual = ((p.mecanismo as string) || '').trim();
  const nActual = numeroMecDeChip(actual);
  // Kit propio de la categoría (ovalada / dúo): sirve en 38 y 45, no se toca.
  const kitDeCategoria = mecPorCategoriaYColor(categoria || '', colorAcc, rm) != null;

  if (diam === 45) {
    if (kitDeCategoria) return { mecanismo: null, tubo45Manual: true };
    const chip45 = chipMecanismoPorNumero(mecKit45PorColor(colorAcc), opciones);
    // Un 45 ya elegido en un color sin regla de banda (gris) se respeta.
    const conservar = esKit45(nActual) && !colorConBandaAncho(categoria || '', colorAcc, rm);
    return { mecanismo: conservar ? null : chip45, tubo45Manual: true };
  }
  if (diam === 63) {
    return { mecanismo: chipMecanismoPorNumero(28, opciones), tubo45Manual: false };
  }
  // Ø38: baja el kit de 45 (o el de 63) al kit por color; el resto se conserva.
  const bajar = esKit45(nActual) || nActual === 28;
  return {
    mecanismo: bajar && !kitDeCategoria ? chipMecanismoPorColor(colorAcc, opciones, rm) : null,
    tubo45Manual: false,
  };
}

/**
 * Modelo de fabricación para una ventana NUEVA (Fase 0 al guardar/importar y
 * Fase 2 al abrir sin modelo): default por color + regla por ANCHO (banda
 * 2,2–3,0 m → kit 45/E78 por color; >3 m → 63 mm/E65). El dual mantiene su
 * modelo ROLLER_DUAL (no lleva regla por ancho). Sin esto, una cortina importada
 * nace en 38 mm y solo se corrige al abrirla a mano en Fase 2.
 */
export function modeloVentanaPorAncho(
  modelos: ModeloDespiece[],
  categoria: string,
  color: string | null | undefined,
  anchoM: number,
  usarTuboE78 = false,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
  lineaB = false,
  /** Reglas de tubería vigentes (ver `modeloPorAncho`). */
  reglasTuberia?: ReglasTuberia,
): ModeloDespiece | null {
  // El filtro por línea impide que una cortina A caiga en una fila B (o al
  // revés) solo porque su mecanismo contiene el color buscado.
  const cands = modelosParaCategoria(modelos, categoria, tipos, lineaB);
  const base = elegirModeloPorColor(cands, color);
  if (categoriaEsDual(categoria, tipos)) return base;
  return modeloPorAncho(
    modelos, categoria, anchoM, base, color, usarTuboE78, reglas, tipos, lineaB, false, reglasTuberia,
  );
}

/**
 * Re-sincroniza los chips de MECANISMO y TUBERÍA de los paños de una ventana
 * con su modelo/categoría/ancho/color actuales — la contraparte pura de
 * `sincronizarChips` (Fase 2) para usar al re-guardar en Fase 1. Al cambiar el
 * flag `usarTuboE78` de la OT baja los kits/tubos de banda automáticos (MEC 18/23
 * → kit por color, E78 → E66) y respeta las elecciones manuales (E05, gris). El
 * `modelo` debe venir YA recalculado por ancho (modeloPorAncho con el flag), así
 * la tubería derivada del diámetro coincide con el kit. Muta los paños in situ.
 *
 * La ventana DUAL solo recolorea su chip (el lado se conserva): no lleva regla
 * por ancho ni tubería derivada del modelo, así que nada más le aplica.
 */
export function resincronizarChipsPanos(
  panos: Array<Record<string, unknown>>,
  ventanaColor: string | undefined,
  modelo: ModeloDespiece | null | undefined,
  categoria: string | undefined,
  opcionesMec: readonly string[],
  opcionesTub: readonly string[],
  usarTuboE78 = false,
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
  /** Línea B efectiva por paño (mismo índice que `panos`). El llamador la
   *  calcula con el catálogo de telas; ausente = toda la ventana es línea A. */
  lineaBPorPano?: readonly boolean[],
): void {
  const esB = (i: number) => lineaBPorPano?.[i] ?? false;
  // Igual que `sincronizarChips` en Fase 2: la categoría ROL_DUAL implica dual
  // aunque el paño todavía no traiga el flag (lo pone Fase 2 al abrirla).
  const esDual =
    categoriaEsDual(categoria || '', reglas.tipos) || panos.some((p) => !!p.dual);

  // Dual: el kit es UNO por ventana (un solo bracket), así que se resuelve del
  // primer paño y se espeja — igual que hace Fase 2 al tocar el lado o el color.
  // El lado/color derivados acompañan al chip (los leen el editor y el Excel).
  if (esDual) {
    const ref = panos[0];
    if (!ref) return;
    const mec = mecanismoParaPano(
      { ...(ref as Parameters<typeof mecanismoParaPano>[0]), dual: true },
      ventanaColor,
      modelo,
      opcionesMec,
      categoria,
      parseFloat(String(ref.ancho ?? 0)) || 0,
      usarTuboE78,
      reglas,
      esB(0),
    );
    if (!mec) return;
    const lc = ladoColorDesdeChipDual(mec);
    for (const p of panos) {
      p.mecanismo = mec;
      if (lc) {
        p.dualLado = lc.lado;
        p.dualColor = lc.dualColor;
      }
    }
    return;
  }

  panos.forEach((p, i) => {
    const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
    const b = esB(i);
    const mec = mecanismoParaPano(
      p as Parameters<typeof mecanismoParaPano>[0],
      ventanaColor,
      modelo,
      opcionesMec,
      categoria,
      anchoM,
      usarTuboE78,
      reglas,
      b,
    );
    if (mec) p.mecanismo = mec;
    // La línea B fija su tubo aunque todavía no haya modelo (no depende de él).
    if (b || (modelo && anchoM > 0)) {
      p.tuberia = canonizarChipTuberia(
        tuberiaParaPano(
          anchoM,
          modelo,
          (p.tuberia as string) || '',
          opcionesTub,
          categoria,
          reglas.tuberia,
          b,
        ),
        opcionesTub,
      );
    }
  });
}

/** Número MEC de la fila del catálogo ('MEC_44_LZ50_B_BLANCO' → 44). */
function numeroMecDeModelo(m: ModeloDespiece): number | null {
  const match = (m.mecanismo || '').toUpperCase().match(/^MEC_0?(\d+)(?:_|$)/);
  return match ? parseInt(match[1], 10) : null;
}

/** true si el mecanismo del catálogo es 'MEC_<num>_…' (o cero-padded). */
function mecanismoCoincideNumero(mecanismo: string, num: number): boolean {
  const mc = mecanismo.toUpperCase();
  return (
    mc.startsWith(`MEC_${num}_`) || mc === `MEC_${num}` ||
    mc.startsWith(`MEC_0${num}_`) || mc === `MEC_0${num}`
  );
}

/**
 * Modelo 38 mm de la propia categoría, por color. Es la vuelta genérica al
 * salir de una regla de ancho: ROL → roller simple 38; dúo manual → fila
 * MANUAL_38 ovalada de su color.
 */
export function modeloBase38PorColor(
  modelos: ModeloDespiece[],
  categoria: string,
  color: string | null | undefined,
  tipos?: readonly TipoCortina[],
  lineaB?: boolean,
): ModeloDespiece | null {
  const cands = modelosParaCategoria(modelos, categoria, tipos, lineaB).filter(
    (m) => m.diametro_tubo_mm === 38,
  );
  return elegirModeloPorColor(cands, color);
}

/**
 * Modelo roller simple 38 mm por color de accesorios. Se usa al bajar de 3 m
 * (volver del kit 63 mm) o al desactivar el dual: hay que filtrar por diámetro
 * 38, porque elegirModeloPorColor sin filtro podría matchear el 63 mm (su
 * mecanismo también contiene el color "BLANCO").
 */
export function modeloSimple38PorColor(
  modelos: ModeloDespiece[],
  categoria: string,
  color: string | null | undefined,
): ModeloDespiece | null {
  const cands = modelosParaCategoria(modelos, categoria).filter(
    (m) => m.diametro_tubo_mm === 38 && m.sistema === 'ROLLER_SIMPLE',
  );
  return elegirModeloPorColor(cands, color);
}
