// ─────────────────────────────────────────────────────────────────────
// Vista "Colmena" EN VIVO: agrupa los paños de `colmena_panos` para
// dibujar la GRILLA física del galpón tal como está en el Excel
// "COLMENA DE PAÑOS (MAPA)" → bloque "UBICACIÓN: GALPÓN".
//
// La grilla son 7 RACKs (columnas numeradas 1-41) × filas M1..M9. Cada
// paño trae su coordenada en `datos_extra.rack/m/col` (la escribió la
// importación). Un solo paño por celda.
//
// Lógica pura y testeable: solo AGRUPA. El render vive en ColmenaVivaTab.
// ─────────────────────────────────────────────────────────────────────
import type { ColmenaPano } from '@/modules/admin/colmena';

export type TipoTela = 'BK' | 'DU' | 'SC' | 'TR' | 'OTRO';

/** Tipo de tela según el prefijo del código ("BK 07" → 'BK'). */
export function tipoDeCodigo(codigo: string | null | undefined): TipoTela {
  const t = String(codigo ?? '')
    .trim()
    .toUpperCase()
    .split(/\s+/)[0];
  if (t === 'BK' || t === 'DU' || t === 'SC' || t === 'TR') return t;
  return 'OTRO';
}

/** Clave de celda en la grilla (fila M × columna). */
export function claveCelda(fila: number, col: number): string {
  return `${fila}-${col}`;
}

// ── Estado / alerta de antigüedad (Reglas Rolzzo v1.0, sección 6) ─────
export type EstadoColmena = 'activa' | 'alerta' | 'usada' | 'baja';
/** Una colmena disponible sin usar por más de 90 días pasa a "en alerta". */
export const DIAS_ALERTA = 90;

/**
 * Días que un paño lleva en la colmena. Fecha de ingreso = `fecha_origen`
 * (sobrante ROLZZO) → `creadoEn` → `created_at` de BD. `null` si no hay fecha.
 */
export function diasEnColmena(p: ColmenaPano, hoyISO: string): number | null {
  const f = p.datos_extra?.fecha_origen || p.datos_extra?.creadoEn || p.created_at || '';
  if (!f) return null;
  const t0 = Date.parse(f);
  const t1 = Date.parse(hoyISO);
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null;
  return Math.floor((t1 - t0) / 86_400_000);
}

/** Estado de una colmena: baja > usada > alerta (>90 días) > activa. */
export function estadoColmena(
  p: ColmenaPano,
  hoyISO: string,
): { estado: EstadoColmena; dias: number | null } {
  const dias = diasEnColmena(p, hoyISO);
  if (p.datos_extra?.baja) return { estado: 'baja', dias };
  if (!p.disponible) return { estado: 'usada', dias };
  if (dias != null && dias > DIAS_ALERTA) return { estado: 'alerta', dias };
  return { estado: 'activa', dias };
}

/** ¿El paño está en alerta por antigüedad (disponible y >90 días)? */
export function enAlerta(p: ColmenaPano, hoyISO: string): boolean {
  return estadoColmena(p, hoyISO).estado === 'alerta';
}

export type MapaRack = {
  rack: number;
  /** Columnas a dibujar (rango contiguo min..max presente). */
  cols: number[];
  /** Filas M presentes (rango contiguo min..max); se renderizan descendente. */
  filas: number[];
  /** Lookup paño por `claveCelda(fila, col)`. */
  celdas: Map<string, ColmenaPano>;
};

function rango(min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
}

/**
 * Entero de coordenada ≥ 1, o `null`. OJO: `Number(null) === 0` (no NaN), así
 * que un rack/m/col nulo del datos_extra pasaría como 0 y crearía un "Rack 0"
 * fantasma — por eso exigimos ≥ 1 explícitamente.
 */
function coord(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Reconstruye la grilla del galpón (RACK 1-7) desde datos_extra.rack/m/col.
 * Devuelve los racks ordenados, cada uno con su rango de filas/cols y un mapa
 * de celda→paño. Los paños sin coordenada numérica completa (ej. "MAPA F73")
 * se devuelven aparte en `huerfanos` para no esconderlos.
 */
export function agruparMapa(panos: ColmenaPano[]): { racks: MapaRack[]; huerfanos: ColmenaPano[] } {
  const cellsByRack = new Map<number, { fila: number; col: number; pano: ColmenaPano }[]>();
  const huerfanos: ColmenaPano[] = [];
  for (const p of panos) {
    const d = p.datos_extra ?? {};
    const rack = coord(d.rack);
    const fila = coord(d.m);
    const col = coord(d.col);
    if (rack === null || fila === null || col === null) {
      huerfanos.push(p);
      continue;
    }
    const arr = cellsByRack.get(rack) ?? [];
    arr.push({ fila, col, pano: p });
    cellsByRack.set(rack, arr);
  }
  const racks = Array.from(cellsByRack.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rack, cells]) => {
      const cols = rango(
        Math.min(...cells.map((c) => c.col)),
        Math.max(...cells.map((c) => c.col)),
      );
      const filas = rango(
        Math.min(...cells.map((c) => c.fila)),
        Math.max(...cells.map((c) => c.fila)),
      );
      const celdas = new Map<string, ColmenaPano>();
      for (const c of cells) celdas.set(claveCelda(c.fila, c.col), c.pano);
      return { rack, cols, filas, celdas };
    });
  return { racks, huerfanos };
}

// ── Zonas ────────────────────────────────────────────────────────────
// Cada zona física es una colmena independiente. `modo` define cómo se dibuja:
//   'grid'  → grilla M×col, UN paño por celda (galpón, liberado).
//   'slots' → estantes A/B/VR, VARIAS telas por estante (rolzzo).
// `filaPrefix`/`filaDesc` solo aplican al modo grilla (galpón: M9→M1).
export type ZonaConfig = {
  label: string;
  filaPrefix: string;
  filaDesc: boolean;
  modo: 'grid' | 'slots';
};
export const ZONAS: Record<string, ZonaConfig> = {
  GALPON: { label: 'Galpón', filaPrefix: 'M', filaDesc: true, modo: 'grid' },
  LIBERADO: { label: 'Liberado', filaPrefix: '', filaDesc: false, modo: 'grid' },
  ROLZZO: { label: 'Galpón (ROLZZO)', filaPrefix: '', filaDesc: false, modo: 'slots' },
};
const ORDEN_ZONA = ['GALPON', 'LIBERADO', 'ROLZZO'];

export function zonaDe(p: ColmenaPano): string {
  const z = p.datos_extra?.zona;
  return typeof z === 'string' && z ? z : 'GALPON';
}

export type ZonaGrid = { zona: string; modo: 'grid'; racks: MapaRack[]; huerfanos: ColmenaPano[] };
export type ZonaSlots = {
  zona: string;
  modo: 'slots';
  sectores: SectorSlots[];
  huerfanos: ColmenaPano[];
};
export type ZonaAgrupada = ZonaGrid | ZonaSlots;

/**
 * Agrupa los paños por zona. Cada zona se arma según su `modo`:
 * 'grid' → grilla de racks (agruparMapa); 'slots' → estantes multi-tela (agruparSlots).
 */
export function agruparPorZona(panos: ColmenaPano[]): ZonaAgrupada[] {
  const by = new Map<string, ColmenaPano[]>();
  for (const p of panos) {
    const z = zonaDe(p);
    by.set(z, [...(by.get(z) ?? []), p]);
  }
  return Array.from(by.entries())
    .sort(
      (a, b) =>
        (ORDEN_ZONA.indexOf(a[0]) + 1 || 99) - (ORDEN_ZONA.indexOf(b[0]) + 1 || 99) ||
        a[0].localeCompare(b[0]),
    )
    .map(([zona, ps]): ZonaAgrupada => {
      if ((ZONAS[zona]?.modo ?? 'grid') === 'slots') {
        const { sectores, huerfanos } = agruparSlots(ps);
        return { zona, modo: 'slots', sectores, huerfanos };
      }
      const { racks, huerfanos } = agruparMapa(ps);
      return { zona, modo: 'grid', racks, huerfanos };
    });
}

// ── Estantes multi-tela (zona 'slots', ej. ROLZZO) ───────────────────
// Las ubicaciones tipo "A-19"/"B-59"/"VR-11" son estantes; cada uno puede
// tener VARIAS telas. Se agrupan por sector (A/B/VR) y por estante.
export type SlotGalpon = { slot: string; pref: string; num: number; panos: ColmenaPano[] };
export type SectorSlots = { pref: string; slots: SlotGalpon[] };
const ORDEN_SECTOR = ['A', 'B', 'VR'];

/** Parsea "A-19"/"VR - 5" → { pref:'A', num:19, slot:'A19' }; null si no calza. */
export function slotGalpon(
  ubicacion: string | null | undefined,
): { pref: string; num: number; slot: string } | null {
  const m = String(ubicacion ?? '')
    .toUpperCase()
    .match(/^\s*([A-Z]+)\s*-?\s*(\d+)/);
  if (!m) return null;
  const num = parseInt(m[2], 10);
  if (!Number.isFinite(num)) return null;
  return { pref: m[1], num, slot: `${m[1]}${String(num).padStart(2, '0')}` };
}

/** Tipo dominante (más frecuente) entre una lista de paños — para colorear el estante. */
export function tipoDominante(panos: ColmenaPano[]): TipoTela {
  const cuenta = new Map<TipoTela, number>();
  for (const p of panos) {
    const t = tipoDeCodigo(p.codigo);
    cuenta.set(t, (cuenta.get(t) ?? 0) + 1);
  }
  let mejor: TipoTela = 'OTRO';
  let max = -1;
  for (const [t, n] of cuenta) {
    if (n > max) {
      max = n;
      mejor = t;
    }
  }
  return mejor;
}

/**
 * Agrupa por sector (A/B/VR) y estante, juntando TODAS las telas de cada estante.
 * Los paños sin ubicación parseable van a `huerfanos`.
 */
export function agruparSlots(panos: ColmenaPano[]): {
  sectores: SectorSlots[];
  huerfanos: ColmenaPano[];
} {
  const byPref = new Map<string, Map<string, SlotGalpon>>();
  const huerfanos: ColmenaPano[] = [];
  for (const p of panos) {
    const s = slotGalpon(p.ubicacion);
    if (!s) {
      huerfanos.push(p);
      continue;
    }
    let slots = byPref.get(s.pref);
    if (!slots) {
      slots = new Map();
      byPref.set(s.pref, slots);
    }
    let cell = slots.get(s.slot);
    if (!cell) {
      cell = { slot: s.slot, pref: s.pref, num: s.num, panos: [] };
      slots.set(s.slot, cell);
    }
    cell.panos.push(p);
  }
  const sectores = Array.from(byPref.entries())
    .sort(
      (a, b) =>
        (ORDEN_SECTOR.indexOf(a[0]) + 1 || 99) - (ORDEN_SECTOR.indexOf(b[0]) + 1 || 99) ||
        a[0].localeCompare(b[0]),
    )
    .map(([pref, slots]) => ({
      pref,
      slots: Array.from(slots.values()).sort((x, y) => x.num - y.num),
    }));
  return { sectores, huerfanos };
}
