// Lógica del optimizador de paños (tab "Tela" en legacy).
// Portado parcial: solo Auto-Optimize + cálculo de paños. El "Plan de Corte
// desde Colmena" (4 reglas que matchean contra colmena_panos) sigue en
// legacy — se accede por el botón "Abrir Plan de Corte (legacy)".

import type { CatalogoProductos } from './types';
import type { VentanaItem } from '@/modules/ots/types';

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
  altoReal: number;
  m2: number;
  anchoRollo: number;
  anchoPano: number;
  numeroPano: number | string;
  junto: string;
  ubicacion: string;
  ventanaId: string | number;
  panoIndex: number;
};

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
      const isDuo = v.producto && v.producto.toUpperCase().includes('DUO');
      const altoReal = isDuo ? altoExtra * 2 : altoExtra;
      const m2 = parseFloat((altoReal * anchoM).toFixed(4));
      const anchoRollo = obtenerAnchoRollo(v.codInt, catalogo);
      const cod = derivarCod(v.producto || '');
      const panoLabel = panos.length > 1 ? ` P${pi + 1}` : '';
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
        m2,
        anchoRollo,
        anchoPano: anchoM,
        numeroPano: '',
        junto: '',
        ubicacion: (v.ubicacion || '') + panoLabel,
        ventanaId: v.id,
        panoIndex: pi,
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

// Auto-asigna anchoPano + numeroPano + junto SIN reordenar las filas.
// Útil cuando se carga la primera vez y no hay plan guardado.
export function asignarJuntoEnOrden(rows: OptimizerRow[]): OptimizerRow[] {
  let jCode = 64;
  let curCodInt: string | null = null;
  let curAlto = -1;
  let accW = 0;
  return rows.map((r) => {
    const exceeds = accW + r.ancho > r.anchoRollo;
    const newGroup =
      r.codInt !== curCodInt || Math.abs(r.altoReal - curAlto) > 0.0001 || exceeds;
    if (newGroup) {
      jCode++;
      if (jCode > 90) jCode = 65;
      curCodInt = r.codInt;
      curAlto = r.altoReal;
      accW = r.ancho;
    } else {
      accW += r.ancho;
    }
    return {
      ...r,
      junto: r.ancho > r.anchoRollo ? 'RR' : String.fromCharCode(jCode),
      anchoPano: accW,
    };
  });
}

// Auto-Optimize: reordena por (codInt asc, altoReal desc) y reasigna grupos.
// Idéntico al algoritmo legacy de autoOptimizarCorte().
export function autoOptimizar(rows: OptimizerRow[]): OptimizerRow[] {
  const ordenadas = [...rows].sort((a, b) => {
    if (a.codInt !== b.codInt) return a.codInt.localeCompare(b.codInt);
    return b.altoReal - a.altoReal;
  });

  let panoNum = 0;
  let juntoCode = 64;
  let curCodInt: string | null = null;
  let curAlto = -1;
  let accW = 0;

  return ordenadas.map((r) => {
    const exceeds = accW + r.ancho > r.anchoRollo;
    const newGroup =
      r.codInt !== curCodInt || Math.abs(r.altoReal - curAlto) > 0.0001 || exceeds;
    if (newGroup) {
      panoNum++;
      juntoCode++;
      if (juntoCode > 90) juntoCode = 65;
      curCodInt = r.codInt;
      curAlto = r.altoReal;
      accW = r.ancho;
    } else {
      accW += r.ancho;
    }
    const oversize = r.ancho > r.anchoRollo;
    return {
      ...r,
      numeroPano: panoNum,
      junto: oversize ? 'RR' : String.fromCharCode(juntoCode),
      anchoPano: accW,
    };
  });
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
  altoCorteCm: number; // alto + 25cm
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
    const altoCorteCm = parseFloat((r.altoCm + 25).toFixed(1));
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
