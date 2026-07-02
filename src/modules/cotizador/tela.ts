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
): number {
  if (!codInt) return 2.98;
  const info = catalogo[codInt];
  if (info && info.anchoRollo) {
    return parseFloat(String(info.anchoRollo)) || 2.98;
  }
  return 2.98;
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
  extra: number; // siempre 0.25 (m)
  altoExtra: number;
  /** Reserva "alto máximo a utilizar" (m). Dúo = 2×(alto+0,25); resto = alto+0,25. */
  altoReal: number;
  /** Alto de corte REAL de la tela (m). Dúo = 2×alto+0,30; resto = alto+0,25. */
  altoCorte: number;
  /** ¿Cortina dúo (día/noche)? La tela se duplica. */
  isDuo: boolean;
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
): PiezaEtiqueta[] {
  const modelo = (v.modelo as ModeloDespiece | null | undefined) ?? null;
  if (!modelo || !(anchoCm > 0)) return [];
  const ctx = contextoDespieceDesdePano(
    { categoria: v.categoria as string | undefined, sentido: v.sentido as string | null | undefined },
    p as Parameters<typeof contextoDespieceDesdePano>[1],
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
      const extra = 0.25;
      const altoExtra = altoM + extra;
      const isDuo = !!(v.producto && v.producto.toUpperCase().includes('DUO'));
      // Dúo (día/noche): la tela baja y vuelve a subir → se corta al doble.
      //  · altoReal  = reserva "alto máximo a utilizar" = 2×(alto+0,25)
      //  · altoCorte = corte real de la tela            = 2×alto + 0,30
      // En roller simple ambas valen alto+0,25. (Validado con OT 266-16 dúo.)
      const altoReal = isDuo ? altoExtra * 2 : altoExtra;
      const altoCorte = isDuo ? altoM * 2 + 0.3 : altoExtra;
      const m2 = parseFloat((altoReal * anchoM).toFixed(4));
      const anchoRollo = obtenerAnchoRollo(v.codInt, catalogo);
      const cod = derivarCod(v.producto || '');
      const panoLabel = panos.length > 1 ? ` P${pi + 1}` : '';
      const tuberiaCod = tuberiaCodigoCorto(
        (v.modelo as ModeloDespiece | null | undefined) ?? null,
        String(p.tuberia || ''),
        anchoM,
        v.categoria,
      );
      rows.push({
        rowIdx,
        cod,
        cant: 1,
        producto: v.producto || '',
        codInt: v.codInt || '',
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
        piezas: piezasDespiece(v, p as unknown as Pano, anchoCm, tuberiaCod),
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
// tiro (0 metros extra). Las cortinas más anchas que el rollo van solas ("RR").
type PanoBin = {
  codInt: string;
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
    if (r.ancho > r.anchoRollo) {
      // Más ancha que el rollo → su propio paño, marca "RR".
      panoNum++;
      return { ...r, junto: 'RR', numeroPano: panoNum, anchoPano: r.ancho };
    }
    // Best-fit: paño del mismo COD_INT con MENOR espacio libre donde todavía entre.
    let mejor: PanoBin | null = null;
    for (const b of bins) {
      if (b.codInt !== r.codInt) continue;
      if (b.anchoRollo - b.usado + EPS < r.ancho) continue; // no entra
      if (!mejor || b.usado > mejor.usado) mejor = b;
    }
    if (!mejor) {
      panoNum++;
      juntoCode = juntoCode >= 90 ? 65 : juntoCode + 1;
      mejor = {
        codInt: r.codInt,
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

export function calcularPanos(rows: OptimizerRow[]): {
  panos: PanoCalculado[];
  totalM2: number;
  totalPanos: number;
} {
  const panos: PanoCalculado[] = [];
  let totalM2 = 0;
  let idx = 0;
  for (const r of rows) {
    idx++;
    const anchoCorteCm = parseFloat((r.anchoCm - 3.5).toFixed(1));
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
