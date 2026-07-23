// Lógica del optimizador de paños (tab "Tela" en legacy).
// Portado parcial: solo Auto-Optimize + cálculo de paños. El "Plan de Corte
// desde Colmena" (4 reglas que matchean contra colmena_panos) sigue en
// legacy — se accede por el botón "Abrir Plan de Corte (legacy)".

import type { CatalogoProductos, Pano } from './types';
import type { VentanaItem } from '@/modules/ots/types';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';
import { tuberiaCodigoCorto } from '@/modules/descuentos/reglas-tuberia';
import { calcularDespiece, contextoDespieceDesdePano } from '@/modules/descuentos/despiece';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { codigoEstructura } from '@/modules/descuentos/codigos-estructura';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import { telaDePano } from './telaPano';
import { esCategoriaPletina, esCategoriaVertical } from '@/modules/descuentos/reglas-mecanismo';
import { familiaOscuridad } from '@/modules/descuentos/reglas-oscuridad';

// ── Helpers ──────────────────────────────────────────────────────────
export function derivarCod(producto: string): string {
  const partes = String(producto || '').trim().toUpperCase().split(/\s+/);
  if (partes.length >= 2) {
    const primeraParte = partes[0];
    const tipoParte = partes[partes.length - 1];
    const tipoLetra = tipoParte[0] || 'X';
    return `${primeraParte}_${tipoLetra}`;
  }
  return partes[0] || 'UNKNOWN';
}

export function obtenerAnchoRollo(
  codInt: string | undefined | null,
  catalogo: CatalogoProductos,
  anchoRolloDefaultM: number = PARAMETROS_CORTE_DEFAULT.anchoRolloDefaultM,
): number {
  if (!codInt) return anchoRolloDefaultM;
  const info = catalogo[codInt];
  if (info && info.anchoRollo) {
    return parseFloat(String(info.anchoRollo)) || anchoRolloDefaultM;
  }
  return anchoRolloDefaultM;
}

/**
 * Regla única del corte invertido (rotado 90°): la cortina + borde no entra
 * a lo ancho del rollo → se corta rotada. La comparten la grilla de
 * cotización, el editor de paños de Fase 2 y la hoja de corte; el flag
 * explícito `pano.invertida` siempre gana sobre esta auto-detección.
 */
export function debeInvertirPano(
  anchoPanoM: number,
  anchoRolloM: number,
  bordeCm: number = PARAMETROS_CORTE_DEFAULT.bordeCm,
): boolean {
  return anchoPanoM > 0 && anchoPanoM + bordeCm / 100 > anchoRolloM;
}

/**
 * Ancho de rollo con la misma prioridad que usa el motor de Fase 0:
 * 1º map global 'ancho_rollo_data' (useAnchoRollo), 2º `anchoRollo` del
 * catálogo, 3º default de corte (2.98 m).
 */
export function resolverAnchoRollo(
  codInt: string | undefined | null,
  anchoRolloMap: Record<string, number>,
  catalogo: CatalogoProductos,
  defaultM: number = PARAMETROS_CORTE_DEFAULT.anchoRolloDefaultM,
): number {
  const ci = (codInt || '').trim();
  const m = anchoRolloMap[ci];
  if (typeof m === 'number' && m > 0) return m;
  return obtenerAnchoRollo(ci, catalogo, defaultM);
}

// ── Tipo de fila del optimizador ─────────────────────────────────────
export type OptimizerRow = {
  rowIdx: number;
  cod: string;
  cant: number;
  producto: string;
  codInt: string;
  tipo: string;
  ancho: number; // metros
  alto: number; // metros
  anchoCm: number;
  altoCm: number;
  extra: number; // extra de alto (m); default 0,25 (parámetro extraAltoCm)
  altoExtra: number;
  /** Reserva "alto máximo a utilizar" (m). Dúo = 2×(alto+0,25); resto = alto+0,25. */
  altoReal: number;
  /** Alto de corte REAL de la tela (m). Dúo = 2×alto+0,30; resto = alto+0,25. */
  altoCorte: number;
  /** ¿Cortina dúo (día/noche)? La tela se duplica. */
  isDuo: boolean;
  /** ¿Cortina VERTICAL? Se corta como un roller (ancho real × alto+extraVertical),
   *  pero su corte NO lleva el descuento de limpieza de borde (−3,5). */
  esVertical?: boolean;
  /**
   * Sistemas de oscuridad (Soft Light / Oscuranti / Dark): ancho de corte REAL de
   * la tela (cm), tomado del despiece (ancho + TELA_ADJ). Reemplaza al ancho−3,5
   * roller en `calcularPanos`. El empaque en paños sigue por ancho nominal.
   */
  anchoCorteTelaCm?: number;
  m2: number;
  anchoRollo: number;
  anchoPano: number;
  numeroPano: number | string;
  junto: string;
  ubicacion: string;
  ventanaId: string | number;
  panoIndex: number;
  pano?: Pano;
  /** Código corto del tubo ("38mm_E02") — mismo origen que Excel/PDF. */
  tuberiaCod?: string;
  /** Sentido/caída de la cortina (INTERNO/EXTERNO) — Fase 0 ventana. */
  sentido?: string;
  /** Dirección de cadena/cierre ("CAD [DERECHA]") — Fase 0 ventana. */
  direccion?: string;
  /** Piezas del despiece (medida de corte + código de estructura) para etiquetas. */
  piezas?: PiezaEtiqueta[];
};

/** Una pieza del despiece para la etiqueta: medida de corte real + su código. */
export type PiezaEtiqueta = {
  componente: string;
  /** Columna del Excel de órdenes ('TUBO', 'PESO', 'CENEFA OVALADA', …). */
  columnaExcel: string;
  medidaCm: number;
  /** Código de inventario (38mm_E02, E13, E18…) o '' si vive en catálogo accesorios. */
  cod: string;
  /** Color de accesorios (identificador cuando no hay código). */
  color: string;
};

/** Calcula las piezas del despiece (medida + código) de una ventana/paño. */
function piezasDespiece(
  v: VentanaItem,
  p: Pano,
  anchoCm: number,
  tuberiaCod: string,
  params: ParametrosCorte,
): PiezaEtiqueta[] {
  const modelo = (v.modelo as ModeloDespiece | null | undefined) ?? null;
  if (!modelo || !(anchoCm > 0)) return [];
  const ctx = contextoDespieceDesdePano(
    {
      categoria: v.categoria as string | undefined,
      sentido: v.sentido as string | null | undefined,
      alto: v.alto as number | string | undefined,
    },
    p as Parameters<typeof contextoDespieceDesdePano>[1],
    {
      verticalExtraAltoCm: params.extraVerticalCm,
      verticalDctoAltoFinalCm: params.dctoAltoFinalVerticalCm,
    },
  );
  const color = colorAccesoriosDePano(p, v.color as string | undefined);
  return calcularDespiece(modelo, anchoCm, ctx).cortes.map((c) => ({
    componente: c.componente,
    columnaExcel: c.columnaExcel,
    medidaCm: c.medidaCm,
    cod: codigoEstructura(c.columnaExcel, color, tuberiaCod),
    color,
  }));
}

// Construye las filas del optimizador desde las ventanas de la OT.
export function buildOptimizerRows(
  ventanas: VentanaItem[],
  catalogo: CatalogoProductos,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): OptimizerRow[] {
  const rows: OptimizerRow[] = [];
  let rowIdx = 0;
  for (const v of ventanas) {
    const panos = v.panos || [];
    if (panos.length === 0) continue;
    panos.forEach((p, pi) => {
      rowIdx++;
      const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
      const altoM = parseFloat(String(v.alto ?? p.alto ?? 0)) || 0;
      const anchoCm = anchoM * 100;
      const altoCm = altoM * 100;
      const extra = params.extraAltoCm / 100;
      const altoExtra = altoM + extra;
      // Tela por paño: en dual cada paño trae SU tela; si no, la de la ventana.
      const tela = telaDePano(v, p as unknown as { codInt?: string; producto?: string });
      const isDuo = !!(tela.producto && tela.producto.toUpperCase().includes('DUO'));
      // Dúo (día/noche): la tela baja y vuelve a subir → se corta al doble.
      //  · altoReal  = reserva "alto máximo a utilizar" = 2×(alto+extraAlto)
      //  · altoCorte = corte real de la tela            = 2×alto + extraDuo
      // En roller simple ambas valen alto+extraAlto. Defaults 0,25/0,30
      // (validado con OT 266-16 dúo); editables en Parámetros de corte.
      // PLETINA (velcro): la tela se corta al ALTO EXACTO (roller = alto;
      // dúo = 2×alto), SIN los extras de roller/dúo normales (Excel manual).
      // VERTICAL: se corta COMO UN ROLLER (la tela NO se invierte). La pieza es
      // el ancho real × (alto + extraVertical), y de ahí se dimensionan después
      // las lamas de 8,9 cm. La RESERVA sigue siendo la del roller (alto + 25),
      // igual que la planilla manual (OT 2923: alto 2,34 → corte 2,39, real 2,59).
      const esPletina = esCategoriaPletina(v.categoria);
      const esVertical = esCategoriaVertical(v.categoria);
      const altoReal = esPletina
        ? (isDuo ? altoM * 2 : altoM)
        : (isDuo ? altoExtra * 2 : altoExtra);
      const altoCorte = esVertical
        ? altoM + params.extraVerticalCm / 100
        : esPletina
          ? (isDuo ? altoM * 2 : altoM)
          : (isDuo ? altoM * 2 + params.extraDuoCm / 100 : altoExtra);
      const m2 = parseFloat((altoReal * anchoM).toFixed(4));
      const anchoRollo = obtenerAnchoRollo(tela.codInt, catalogo, params.anchoRolloDefaultM);
      const cod = derivarCod(tela.producto || '');
      const panoLabel = panos.length > 1 ? ` P${pi + 1}` : '';
      const tuberiaCod = tuberiaCodigoCorto(
        (v.modelo as ModeloDespiece | null | undefined) ?? null,
        String(p.tuberia || ''),
        anchoM,
        v.categoria,
      );
      const piezas = piezasDespiece(v, p as unknown as Pano, anchoCm, tuberiaCod, params);
      // Oscuridad: la tela se corta al ancho REAL del despiece (ancho + TELA_ADJ),
      // no al ancho−3,5 del roller. El empaque en paños sigue por ancho nominal.
      const anchoCorteTelaCm = familiaOscuridad(v.categoria, p.cenefa as string | null | undefined)
        ? piezas.find((pz) => pz.componente === 'Tela (ancho)')?.medidaCm
        : undefined;
      rows.push({
        rowIdx,
        cod,
        cant: 1,
        producto: tela.producto || '',
        codInt: tela.codInt || '',
        tipo: v.tipo || '',
        ancho: anchoM,
        alto: altoM,
        anchoCm,
        altoCm,
        extra,
        altoExtra,
        altoReal,
        altoCorte,
        isDuo,
        esVertical,
        anchoCorteTelaCm,
        m2,
        anchoRollo,
        anchoPano: anchoM,
        numeroPano: '',
        junto: '',
        ubicacion: (v.ubicacion || '') + panoLabel,
        ventanaId: v.id,
        panoIndex: pi,
        pano: p as unknown as Pano,
        tuberiaCod,
        sentido: String(v.sentido ?? ''),
        direccion: String(v.direccion ?? ''),
        piezas,
      });
    });
  }
  return rows;
}

// Restaura los campos editables (anchoPano, numeroPano, junto) desde un plan
// guardado, si tiene la misma cantidad de filas. Si no, devuelve `rows` intacta.
export function restorePlanGuardado(
  rows: OptimizerRow[],
  guardadas: unknown[] | undefined,
): OptimizerRow[] {
  if (!Array.isArray(guardadas) || guardadas.length !== rows.length) return rows;
  return rows.map((r, i) => {
    const g = guardadas[i] as Partial<OptimizerRow> | undefined;
    if (!g) return r;
    return {
      ...r,
      anchoPano: g.anchoPano ?? r.anchoPano,
      numeroPano: g.numeroPano ?? r.numeroPano,
      junto: g.junto ?? r.junto,
    };
  });
}

// ── Empaquetado best-fit por ancho ───────────────────────────────────
// Cada paño es un contenedor de ancho = ancho del rollo. Para CADA cortina
// buscamos el paño del mismo COD_INT MÁS LLENO donde todavía entre a lo ancho;
// si no entra en ninguno, abrimos uno nuevo. Best-fit minimiza la cantidad de
// paños (= metros de tela) mejor que el next-fit anterior, que solo miraba el
// último paño abierto (p.ej. anchos 1,5/1,5/1,0/1,0 en rollo 2,98: next-fit da
// 3 paños; best-fit da 2). El alto no restringe el agrupado: el paño se corta
// al alto mayor y las cortinas más bajas viajan en el ancho sobrante del mismo
// tiro (0 metros extra). Las cortinas más anchas que el rollo abren su propio
// paño (con su letra) y nadie las comparte; en el taller se cortan rotadas.
type PanoBin = {
  codInt: string;
  esVertical: boolean; // vertical y roller de la misma tela NO comparten paño
  usado: number; // ancho acumulado (m)
  anchoRollo: number;
  junto: string;
  numeroPano: number;
};

const EPS = 1e-9;

function empacarBestFit(orden: OptimizerRow[]): OptimizerRow[] {
  const bins: PanoBin[] = [];
  let juntoCode = 64;
  let panoNum = 0;
  return orden.map((r) => {
    // Best-fit: paño del mismo COD_INT (y mismo tipo vertical/roller) con MENOR
    // espacio libre donde todavía entre. Una cortina más ancha que el rollo no
    // cabe en ningún paño → abre el suyo (con su propia letra) y nadie más lo
    // comparte (se corta rotada). Vertical y roller de la MISMA tela nunca
    // comparten paño: van en hojas de corte separadas (se cortan en mesas
    // distintas), así que ningún paño queda a caballo entre las dos hojas.
    let mejor: PanoBin | null = null;
    for (const b of bins) {
      if (b.codInt !== r.codInt || b.esVertical !== !!r.esVertical) continue;
      if (b.anchoRollo - b.usado + EPS < r.ancho) continue; // no entra
      if (!mejor || b.usado > mejor.usado) mejor = b;
    }
    if (!mejor) {
      panoNum++;
      juntoCode = juntoCode >= 90 ? 65 : juntoCode + 1;
      mejor = {
        codInt: r.codInt,
        esVertical: !!r.esVertical,
        usado: 0,
        anchoRollo: r.anchoRollo,
        junto: String.fromCharCode(juntoCode),
        numeroPano: panoNum,
      };
      bins.push(mejor);
    }
    mejor.usado += r.ancho;
    return { ...r, junto: mejor.junto, numeroPano: mejor.numeroPano, anchoPano: mejor.usado };
  });
}

// Auto-asigna anchoPano + numeroPano + junto SIN reordenar las filas (best-fit
// sobre el orden de entrada). Útil al cargar por primera vez sin plan guardado.
export function asignarJuntoEnOrden(rows: OptimizerRow[]): OptimizerRow[] {
  return empacarBestFit(rows);
}

// Auto-Optimize: ordena por (codInt asc, altoReal desc) y empaca best-fit. El
// orden alto-desc hace que las cortinas altas abran los paños y las más bajas
// rellenen el ancho sobrante → minimiza los metros de tela. Al final reagrupa
// las filas por paño para que queden contiguas en la tabla / hoja de corte.
export function autoOptimizar(rows: OptimizerRow[]): OptimizerRow[] {
  const ordenadas = [...rows].sort((a, b) => {
    if (a.codInt !== b.codInt) return a.codInt.localeCompare(b.codInt);
    return b.altoReal - a.altoReal;
  });
  const empacadas = empacarBestFit(ordenadas);
  return empacadas.sort((a, b) => Number(a.numeroPano) - Number(b.numeroPano));
}

// ── Cálculo de paños (display derivado del optimizador) ──────────────
export type PanoCalculado = {
  idx: number;
  cod: string;
  cant: number;
  producto: string;
  codInt: string;
  tipo: string;
  anchoCorteCm: number; // ancho - 3.5cm
  altoCorteCm: number; // corte real: dúo = 2×alto+30cm; resto = alto+25cm
  altoCm: number;
  altoExtra: number;
  altoReal: number;
  m2: number;
  anchoPano: number;
  numeroPano: number | string;
  junto: string;
};

export function calcularPanos(
  rows: OptimizerRow[],
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): {
  panos: PanoCalculado[];
  totalM2: number;
  totalPanos: number;
} {
  const panos: PanoCalculado[] = [];
  let totalM2 = 0;
  let idx = 0;
  for (const r of rows) {
    idx++;
    // VERTICAL: la tela se corta al ancho REAL, sin el descuento de limpieza de
    // borde (la lama sale del paño completo; planilla manual OT 2923).
    // OSCURIDAD (Soft Light/Oscuranti/Dark): ancho de corte del despiece
    // (ancho + TELA_ADJ), no el ancho−3,5 del roller.
    const anchoCorteCm = r.esVertical
      ? parseFloat(r.anchoCm.toFixed(1))
      : typeof r.anchoCorteTelaCm === 'number'
        ? parseFloat(r.anchoCorteTelaCm.toFixed(1))
        : parseFloat((r.anchoCm - params.descAnchoCorteCm).toFixed(1));
    const altoCorteCm = parseFloat((r.altoCorte * 100).toFixed(1)); // dúo: 2×alto+30
    const m2Val = (r.anchoCm / 100) * (altoCorteCm / 100);
    totalM2 += m2Val;
    panos.push({
      idx,
      cod: r.cod,
      cant: r.cant,
      producto: r.producto,
      codInt: r.codInt,
      tipo: r.tipo,
      anchoCorteCm,
      altoCorteCm,
      altoCm: r.altoCm,
      altoExtra: r.altoExtra,
      altoReal: r.altoReal,
      m2: parseFloat(m2Val.toFixed(4)),
      anchoPano: r.anchoPano,
      numeroPano: r.numeroPano,
      junto: r.junto,
    });
  }
  return { panos, totalM2, totalPanos: rows.length };
}
