// Plan de Corte desde Colmena — algoritmo puro.
// Portado desde public/legacy/index.html (líneas 6794-7083):
//   - mxFit / mxSplit / mxPack (MaxRects BSSF packing 2D guillotine)
//   - _tipoPrio (Regla 3 — prioridad por tipo de sobrante)
//   - extraCmPorTipo (Regla 7 — extra cm al alto según producto)
//   - generarPlanCorte (motor principal: 4 reglas de match + packing + output)

import type { OT, VentanaItem } from '@/modules/ots/types';

// ── Tipos del plan ───────────────────────────────────────────────────
export type ColmenaPanoRow = {
  id: string;
  codigo: string | null;
  medida_ancho: number | null;
  medida_alto: number | null;
  tipo?: string | null;
  ubicacion?: string | null;
  disponible: boolean;
  ot_asignada: string | null;
  datos_extra?: { creadoEn?: string; ot_origen?: string; fuente?: string } | null;
};

export type PanoColmena = {
  _docId: string;
  cod: string;
  ancho: number;
  alto: number;
  ubicacion: string;
  tipo: string;
  creadoEn: string;
};

export type Pieza = {
  id: string;
  nombre: string;
  codInt: string;
  otId: string;
  otNum: string;
  w: number;
  h: number;
};

export type Placed = Pieza & {
  px: number;
  py: number;
  pw: number;
  ph: number;
  rot: boolean;
  failed: boolean;
};

export type GrupoSobrante = {
  sobrante: PanoColmena;
  placed: Placed[];
  regla: 1 | 2;
  sobranteAncho: { cod: string; ancho: number; alto: number } | null;
  uw: number;
  uh: number;
};

export type GrupoRollo = {
  codInt: string;
  placed: Placed[];
  anchoUtil: number;
  altoUtil: number;
  anchoCorte: number;
  altoCorte: number;
  efic: number;
  sobInterno: { ancho: number; alto: number } | null;
  tieneRotaciones: boolean;
  piezasRotadas: Placed[];
  layoutVertical: Placed[] | null;
  altoVertical: number | null;
  eficVertical: number;
  sobInternoV: { ancho: number; alto: number } | null;
  decisiones: Record<string, boolean>;
};

export type GrupoSinStock = { codInt: string; piezas: Pieza[] };

export type OTIncluida = { id: string; num: string; cliente: string };

export type Plan = {
  sobrantes: GrupoSobrante[];
  rollo: GrupoRollo[];
  sinStock: GrupoSinStock[];
  otsIncluidas: OTIncluida[];
};

// ── Helpers ──────────────────────────────────────────────────────────
const COLMENA_TIPO_PRIO: Record<string, number> = {
  FALLA: 0,
  'ERROR CORTE': 1,
  CANCELACION: 2,
  SOBRANTE: 3,
};

function tipoPrio(t: string): number {
  return COLMENA_TIPO_PRIO[(t || '').toUpperCase().trim()] ?? 99;
}

// Regla 7: extra cm al alto según tipo de producto
export function extraCmPorTipo(v: VentanaItem): number {
  const prod = (v.producto || '').toUpperCase();
  const tipo = (v.tipo || '').toUpperCase();
  if (prod.includes('DUO')) return 10;
  if (prod.includes('VERTICAL') || tipo.includes('VERTICAL')) return 5;
  return 25; // Rollers SC, BK y otros
}

// Normaliza fila de colmena_panos (Supabase) al tipo interno usado por el algoritmo
export function rowToPano(row: ColmenaPanoRow): PanoColmena {
  return {
    _docId: row.id,
    cod: (row.codigo || '').toString(),
    ancho: Number(row.medida_ancho) || 0,
    alto: Number(row.medida_alto) || 0,
    ubicacion: (row.ubicacion || '').toString(),
    tipo: (row.tipo || '').toString(),
    creadoEn: row.datos_extra?.creadoEn || '',
  };
}

// ── MaxRects BSSF packing ────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number };

function mxFit(item: Pieza, F: Rect[], allowRot = true): Placed | null {
  let bs = Infinity;
  let bF: Rect | null = null;
  let bW = 0;
  let bH = 0;
  let bR = false;
  for (const fr of F) {
    if (item.w <= fr.w && item.h <= fr.h) {
      const s = Math.min(fr.w - item.w, fr.h - item.h);
      if (s < bs) {
        bs = s;
        bF = fr;
        bW = item.w;
        bH = item.h;
        bR = false;
      }
    }
    if (allowRot && item.h <= fr.w && item.w <= fr.h) {
      const s = Math.min(fr.w - item.h, fr.h - item.w);
      if (s < bs) {
        bs = s;
        bF = fr;
        bW = item.h;
        bH = item.w;
        bR = true;
      }
    }
  }
  if (!bF) return null;
  return { ...item, px: bF.x, py: bF.y, pw: bW, ph: bH, rot: bR, failed: false };
}

function mxSplit(F: Rect[], p: Placed): Rect[] {
  const out: Rect[] = [];
  for (const fr of F) {
    if (
      p.px >= fr.x + fr.w ||
      p.px + p.pw <= fr.x ||
      p.py >= fr.y + fr.h ||
      p.py + p.ph <= fr.y
    ) {
      out.push(fr);
      continue;
    }
    if (p.px > fr.x) out.push({ x: fr.x, y: fr.y, w: p.px - fr.x, h: fr.h });
    if (p.px + p.pw < fr.x + fr.w)
      out.push({ x: p.px + p.pw, y: fr.y, w: fr.x + fr.w - (p.px + p.pw), h: fr.h });
    if (p.py > fr.y) out.push({ x: fr.x, y: fr.y, w: fr.w, h: p.py - fr.y });
    if (p.py + p.ph < fr.y + fr.h)
      out.push({ x: fr.x, y: p.py + p.ph, w: fr.w, h: fr.y + fr.h - (p.py + p.ph) });
  }
  return out.filter(
    (a, i) =>
      !out.some(
        (b, j) =>
          j !== i &&
          b.x <= a.x &&
          b.y <= a.y &&
          b.x + b.w >= a.x + a.w &&
          b.y + b.h >= a.y + a.h,
      ),
  );
}

function mxPack(items: Pieza[], uw: number, uh: number, allowRot = true): Placed[] {
  let F: Rect[] = [{ x: 0, y: 0, w: uw, h: uh }];
  const placed: Placed[] = [];
  const sorted = [...items].sort((a, b) => b.w * b.h - a.w * a.h);
  for (const item of sorted) {
    const r = mxFit(item, F, allowRot);
    if (r) {
      placed.push(r);
      F = mxSplit(F, r);
    } else {
      placed.push({
        ...item,
        px: -1,
        py: -1,
        pw: item.w,
        ph: item.h,
        rot: false,
        failed: true,
      });
    }
  }
  return placed;
}

// ── Motor principal ────────────────────────────────────────────────
export function generarPlanCorte(
  ots: OT[],
  colmenaPanos: PanoColmena[],
): Plan {
  const MARGEN = 1; // 1 cm de margen por lado
  const BORDE = 4; // 4 cm de limpieza de bordes al ancho (Regla 5)
  const ROLL_W_UTIL = 300 - MARGEN * 2;
  const MIN_SOB = 30;
  const multiOT = ots.length > 1;

  // ── 1. Armar la lista de piezas desde todas las ventanas ──────────
  const piezas: Pieza[] = [];

  ots.forEach((otItem) => {
    const ventanas = otItem.storeVentanas || [];
    const otNum = otItem.datosGenerales?.ot || String(otItem.id);

    ventanas.forEach((v) => {
      if (!v.panos || v.panos.length === 0) return;
      const extraCm = extraCmPorTipo(v); // Regla 7
      const isDuo = (v.producto || '').toUpperCase().includes('DUO');

      v.panos.forEach((p, pi) => {
        const altoFuente = parseFloat(String(p.alto ?? v.alto ?? 0)) || 0;
        const altoBase = Math.round(altoFuente * 100) + extraCm;
        const altoCm = isDuo ? Math.round(altoFuente * 100) * 2 + extraCm : altoBase;
        const anchoCm = Math.round(parseFloat(String(p.ancho)) * 100) + BORDE;
        if (!anchoCm || !altoCm) return;
        const panoSuffix = v.panos!.length > 1 ? ` P${pi + 1}` : '';
        const label = multiOT
          ? `OT${otNum}·${v.ubicacion}${panoSuffix}`
          : `${v.ubicacion}${panoSuffix}`;
        piezas.push({
          id: `${otItem.id}_${v.id}_p${pi}`,
          nombre: label,
          codInt: (v.codInt || '').toUpperCase().trim(),
          otId: String(otItem.id),
          otNum,
          w: anchoCm,
          h: altoCm,
        });
      });
    });
  });

  const plan: Plan = {
    sobrantes: [],
    rollo: [],
    sinStock: [],
    otsIncluidas: ots.map((o) => ({
      id: String(o.id),
      num: o.datosGenerales?.ot || '—',
      cliente: o.datosGenerales?.cliente || '—',
    })),
  };

  if (piezas.length === 0) return plan;

  // ── 2. Agrupar por COD_INT ────────────────────────────────────────
  const porCod: Record<string, Pieza[]> = {};
  piezas.forEach((p) => {
    if (!porCod[p.codInt]) porCod[p.codInt] = [];
    porCod[p.codInt].push(p);
  });

  const porAltura = (arr: Pieza[]): Pieza[] =>
    [...arr].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

  // ── 3. Por cada codInt: matchear contra colmena (reglas 1-4) + packing ──
  Object.entries(porCod).forEach(([codInt, grupo]) => {
    const sinCubrir: (Pieza | null)[] = [...grupo];

    // Reglas 3+4: ordenar sobrantes por prioridad de tipo → FIFO por creadoEn
    const disponiblesOrdenados = colmenaPanos
      .filter((s) => s.cod.toUpperCase().trim() === codInt)
      .sort((a, b) => {
        const dp = tipoPrio(a.tipo) - tipoPrio(b.tipo);
        if (dp !== 0) return dp;
        const da = a.creadoEn ? new Date(a.creadoEn).getTime() : 0;
        const db = b.creadoEn ? new Date(b.creadoEn).getTime() : 0;
        return da - db;
      });

    const usadosEnPlan = new Set<string>();

    sinCubrir.forEach((pieza, idx) => {
      if (!pieza) return;

      // Regla 1: cod + ancho exacto + alto exacto
      let match: PanoColmena | undefined = disponiblesOrdenados.find(
        (s) => !usadosEnPlan.has(s._docId) && s.ancho === pieza.w && s.alto === pieza.h,
      );
      let regla: 1 | 2 = 1;

      // Regla 2: cod + ancho >= req + alto en [req, req+10]
      if (!match) {
        match = disponiblesOrdenados.find(
          (s) =>
            !usadosEnPlan.has(s._docId) &&
            s.ancho >= pieza.w &&
            s.alto >= pieza.h &&
            s.alto <= pieza.h + 10,
        );
        regla = 2;
      }

      if (match) {
        usadosEnPlan.add(match._docId);
        const anchoExceso = match.ancho - pieza.w;
        const sobranteAncho =
          regla === 2 && anchoExceso >= MIN_SOB
            ? {
                cod: codInt,
                ancho: Math.round(anchoExceso),
                alto: Math.round(match.alto),
              }
            : null;

        const placed: Placed[] = [
          {
            ...pieza,
            px: 0,
            py: 0,
            pw: pieza.w,
            ph: pieza.h,
            rot: false,
            failed: false,
          },
        ];

        plan.sobrantes.push({
          sobrante: match,
          placed,
          regla,
          sobranteAncho,
          uw: match.ancho,
          uh: match.alto,
        });
        sinCubrir[idx] = null;
      }
    });

    const restantes = sinCubrir.filter((p): p is Pieza => p !== null);

    // ── 4. Piezas que no matchearon → packing desde rollo ────────
    if (restantes.length) {
      const piezasOrd = porAltura(restantes);
      const maxH = piezasOrd.reduce((s, p) => s + Math.max(p.w, p.h), 0) + 50;
      const minH = Math.max(...piezasOrd.map((p) => Math.min(p.w, p.h)));

      // Pasada A: sin rotación (binary search sobre el alto)
      let loA = minH;
      let hiA = maxH;
      let plA: Placed[] | null = null;
      let hA = maxH;
      for (let i = 0; i < 18; i++) {
        const mid = Math.floor((loA + hiA) / 2);
        const pl = mxPack(
          piezasOrd.map((p) => ({ ...p })),
          ROLL_W_UTIL,
          mid,
          false,
        );
        if (pl.every((r) => !r.failed)) {
          const usedH = pl.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
          if (usedH < hA) {
            hA = usedH;
            plA = pl;
          }
          hiA = mid;
        } else {
          loA = mid + 1;
        }
      }

      // Pasada B: con rotación (solo fallback si A falla)
      let loB = minH;
      let hiB = maxH;
      let plB: Placed[] | null = null;
      let hB = maxH;
      for (let i = 0; i < 18; i++) {
        const mid = Math.floor((loB + hiB) / 2);
        const pl = mxPack(
          piezasOrd.map((p) => ({ ...p })),
          ROLL_W_UTIL,
          mid,
          true,
        );
        if (pl.every((r) => !r.failed)) {
          const usedH = pl.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
          if (usedH < hB) {
            hB = usedH;
            plB = pl;
          }
          hiB = mid;
        } else {
          loB = mid + 1;
        }
      }

      // Preferir siempre Pasada A (sin rotación)
      const bestPl = plA || plB;
      const bestH = plA ? hA : hB;

      if (bestPl) {
        const altoCorte = bestH + MARGEN * 2;
        const efic = Math.round(
          (bestPl.reduce((s, r) => s + r.pw * r.ph, 0) / (ROLL_W_UTIL * bestH)) * 100,
        );
        const maxX = bestPl.reduce((m, r) => Math.max(m, r.px + r.pw), 0);
        const anchoFranja = ROLL_W_UTIL - maxX;
        const sobInterno =
          anchoFranja >= MIN_SOB
            ? { ancho: Math.round(anchoFranja), alto: Math.round(altoCorte) }
            : null;

        const piezasRotadas = bestPl.filter((r) => r.rot && !r.failed);
        const tieneRotaciones = !plA && piezasRotadas.length > 0;

        const altoVertical = plA ? hA + MARGEN * 2 : null;
        const eficVertical = plA
          ? Math.round(
              (plA.reduce((s, r) => s + r.pw * r.ph, 0) / (ROLL_W_UTIL * hA)) * 100,
            )
          : 0;
        const maxXv = plA ? plA.reduce((m, r) => Math.max(m, r.px + r.pw), 0) : 0;
        const sobInternoV =
          plA && ROLL_W_UTIL - maxXv >= MIN_SOB && altoVertical
            ? { ancho: Math.round(ROLL_W_UTIL - maxXv), alto: Math.round(altoVertical) }
            : null;

        plan.rollo.push({
          codInt,
          placed: bestPl,
          anchoUtil: ROLL_W_UTIL,
          altoUtil: bestH,
          anchoCorte: 300,
          altoCorte,
          efic,
          sobInterno,
          tieneRotaciones,
          piezasRotadas,
          layoutVertical: plA,
          altoVertical,
          eficVertical,
          sobInternoV,
          decisiones: {},
        });
      } else {
        plan.sinStock.push({ codInt, piezas: restantes });
      }
    }
  });

  return plan;
}

// ── Estadísticas de resumen ─────────────────────────────────────────
export function resumenPlan(plan: Plan): {
  totalPiezas: number;
  desdeSobrante: number;
  desdeRollo: number;
  sinStock: number;
} {
  const desdeSobrante = plan.sobrantes.reduce(
    (s, g) => s + g.placed.filter((r) => !r.failed).length,
    0,
  );
  const desdeRollo = plan.rollo.reduce(
    (s, g) => s + g.placed.filter((r) => !r.failed).length,
    0,
  );
  const sinStock = plan.sinStock.reduce((s, g) => s + g.piezas.length, 0);
  return {
    totalPiezas: desdeSobrante + desdeRollo + sinStock,
    desdeSobrante,
    desdeRollo,
    sinStock,
  };
}
