// ─────────────────────────────────────────────────────────────────────
// Vista "Colmena de tubería" EN VIVO: agrupa `colmena_tubos` por ubicación
// para dibujar los estantes, igual que la colmena de telas hace con los
// paños del galpón.
//
// Diferencias con la colmena de paños que condicionan este módulo:
//   · La ubicación es `n_colmena`, TEXTO LIBRE ("A4", "A27", "L02", "B1").
//     No hay coordenadas rack/fila/columna, así que no hay grilla física:
//     se dibuja un estante por ubicación, agrupados por sector (la letra).
//   · Los códigos son ~30 (E02, VER63, SML04, E29…), no 4 tipos de tela →
//     el color se decide por FAMILIA de código, no por el código mismo.
//   · `created_at` NO sirve para la antigüedad: el sync completo del
//     optimizador hace DELETE+INSERT de toda la colmena y lo renueva. La
//     fecha real es la del primer evento `ingreso` en `tubos_historial`,
//     que se pasa acá como un mapa por `tubo_raiz_id`.
//
// Lógica pura y testeable: solo AGRUPA y CLASIFICA. El render vive en
// src/pages/historial-tubos/vistas/VistaColmena.tsx.
// ─────────────────────────────────────────────────────────────────────

/** Forma mínima de un tubo de `colmena_tubos` que necesita esta vista. */
export type TuboColmena = {
  id: string;
  n_colmena: string | null;
  cod: string | null;
  medida_cm: number | null;
  serial?: string | null;
  tubo_raiz_id?: string | null;
  created_at?: string | null;
};

/** Familias de código, para colorear el estante y filtrar. */
export type FamiliaTubo =
  | 'TUBO'
  | 'PESO'
  | 'CENEFA'
  | 'PERFIL'
  | 'VERTICAL'
  | 'BEEBLACK'
  | 'OTRO';

/** Códigos E que son PESO (roller, dúo lágrima, interno, oscuridad). */
const PESOS = new Set(['E13', 'E14', 'E15', 'E16', 'E18', 'E19', 'E20', 'E24', 'E44']);
/** Códigos E que son TUBO (por diámetro). E01/E39 son los de la categoría B
 *  (el E39 es además el de 45 mm de toda la línea desde 2026-08-14; el E78 es
 *  su nombre viejo y sigue acá por la colmena y el historial). */
const TUBOS = new Set(['E01', 'E02', 'E05', 'E39', 'E47', 'E65', 'E66', 'E78']);
/** Cenefas: ovaladas E26-E28 y cuadradas E29-E31. */
const CENEFAS = new Set(['E26', 'E27', 'E28', 'E29', 'E30', 'E31']);
/** Perfiles de oscuridad: zócalo E32-E34, separador E41-E43, superior E49/E50/E52. */
const PERFILES = new Set(['E32', 'E33', 'E34', 'E41', 'E42', 'E43', 'E49', 'E50', 'E52']);

/** Normaliza un código: mayúsculas, sin espacios ("e 02" → "E02"). */
export function codigoNormalizado(cod: string | null | undefined): string {
  return String(cod ?? '').toUpperCase().replace(/\s+/g, '');
}

/** Familia de un código de la colmena, para color y filtro. */
export function familiaCod(cod: string | null | undefined): FamiliaTubo {
  const c = codigoNormalizado(cod);
  if (!c) return 'OTRO';
  if (c.startsWith('VER')) return 'VERTICAL';
  if (c.startsWith('SML') || c.startsWith('SLM')) return 'BEEBLACK';
  if (TUBOS.has(c)) return 'TUBO';
  if (PESOS.has(c)) return 'PESO';
  if (CENEFAS.has(c)) return 'CENEFA';
  if (PERFILES.has(c)) return 'PERFIL';
  return 'OTRO';
}

/** Etiqueta legible de cada familia (para leyenda y filtros). */
export const LABEL_FAMILIA: Record<FamiliaTubo, string> = {
  TUBO: 'Tubos',
  PESO: 'Pesos',
  CENEFA: 'Cenefas',
  PERFIL: 'Perfiles',
  VERTICAL: 'Verticales',
  BEEBLACK: 'Bee-black',
  OTRO: 'Otros',
};

// ── Slots reservados del optimizador (public/legacy/optimizador.html) ──
/** Colmenas donde el optimizador deja los PESOS (round-robin). */
export const SLOTS_PESO = ['A27', 'A28', 'A29'];
/** Colmenas de tubos LARGOS (> 300 cm). */
export const SLOTS_LARGO = ['L01', 'L02', 'L03'];
/** Ubicaciones virtuales del optimizador: no son estantes físicos. */
export const POSICIONES_VIRTUALES = ['LIBERADO', 'MESA', 'TUBO NUEVO', 'PESO NUEVO'];

/** Nota del estante cuando el optimizador lo tiene reservado. */
export function notaSlot(colmena: string): string | null {
  const c = colmena.toUpperCase().trim();
  if (SLOTS_PESO.includes(c)) return 'pesos';
  if (SLOTS_LARGO.includes(c)) return 'largos';
  if (POSICIONES_VIRTUALES.includes(c)) return 'virtual';
  return null;
}

// ── Antigüedad ───────────────────────────────────────────────────────
/** Un tubo sin usar por más de N días entra "en alerta" (mismo criterio que telas). */
export const DIAS_ALERTA_TUBO = 90;

/**
 * Mapa `tubo_raiz_id` → fecha del PRIMER ingreso, construido desde los
 * eventos de `tubos_historial`. Es la única fecha confiable: el
 * `created_at` de `colmena_tubos` lo pisa cada sync del optimizador.
 */
export function mapaPrimerIngreso(
  eventos: Array<{ tubo_raiz_id: string | null; created_at: string | null }>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of eventos) {
    const id = e.tubo_raiz_id;
    const f = e.created_at;
    if (!id || !f) continue;
    const previo = m.get(id);
    if (!previo || Date.parse(f) < Date.parse(previo)) m.set(id, f);
  }
  return m;
}

/** Días que el tubo lleva en la colmena; `null` si no hay evento de ingreso. */
export function diasEnColmena(
  t: TuboColmena,
  ingresos: Map<string, string>,
  hoyISO: string,
): number | null {
  const f = (t.tubo_raiz_id && ingresos.get(t.tubo_raiz_id)) || null;
  if (!f) return null;
  const t0 = Date.parse(f);
  const t1 = Date.parse(hoyISO);
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null;
  return Math.floor((t1 - t0) / 86_400_000);
}

/** ¿El tubo está en alerta por antigüedad? */
export function enAlerta(
  t: TuboColmena,
  ingresos: Map<string, string>,
  hoyISO: string,
  diasAlerta: number = DIAS_ALERTA_TUBO,
): boolean {
  const d = diasEnColmena(t, ingresos, hoyISO);
  return d != null && d > diasAlerta;
}

// ── Agrupación por ubicación ─────────────────────────────────────────
export type EstanteTubos = {
  /** `n_colmena` tal cual está en BD (no se normaliza: "A4" ≠ "A04"). */
  colmena: string;
  tubos: TuboColmena[];
  /** Familia más frecuente del estante (decide su color). */
  familiaDominante: FamiliaTubo;
  /** Metros lineales acumulados. */
  metros: number;
  /** 'pesos' | 'largos' | 'virtual' si el optimizador lo reserva. */
  nota: string | null;
};

export type SectorTubos = {
  /** Letra inicial de la ubicación: 'A', 'B', 'L'… o '?' si no empieza con letra. */
  sector: string;
  estantes: EstanteTubos[];
  total: number;
};

/** Sector de una ubicación: su prefijo de letras ("A27" → "A", "L02" → "L"). */
export function sectorDeColmena(colmena: string): string {
  const m = colmena.trim().toUpperCase().match(/^([A-Z]+)/);
  return m ? m[1] : '?';
}

/**
 * Orden natural de ubicaciones: A4 < A27 < A51 < B1 < L02. Se usa
 * `localeCompare` numérico —igual que la tabla "por colmena" de Ojo de
 * Dios— en vez de rellenar con ceros, porque en BD conviven "A4" y "L02"
 * y normalizar rompería el calce con los datos.
 */
export function compararColmenas(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

/** Familia más frecuente de una lista de tubos (empate → la primera). */
export function familiaDominante(tubos: TuboColmena[]): FamiliaTubo {
  const conteo = new Map<FamiliaTubo, number>();
  for (const t of tubos) {
    const f = familiaCod(t.cod);
    conteo.set(f, (conteo.get(f) ?? 0) + 1);
  }
  let mejor: FamiliaTubo = 'OTRO';
  let max = -1;
  for (const [f, n] of conteo) {
    if (n > max) {
      max = n;
      mejor = f;
    }
  }
  return mejor;
}

/**
 * Agrupa los tubos por ubicación y sector. Los que no traen `n_colmena`
 * caen a un sector '?' con la etiqueta "SIN UBICACIÓN": nunca se esconde
 * stock (mismo criterio que los huérfanos de la colmena de paños).
 */
export function agruparPorColmena(tubos: TuboColmena[]): SectorTubos[] {
  const porColmena = new Map<string, TuboColmena[]>();
  for (const t of tubos) {
    const key = String(t.n_colmena ?? '').trim() || 'SIN UBICACIÓN';
    const lista = porColmena.get(key);
    if (lista) lista.push(t);
    else porColmena.set(key, [t]);
  }

  const porSector = new Map<string, EstanteTubos[]>();
  for (const [colmena, lista] of porColmena) {
    const estante: EstanteTubos = {
      colmena,
      tubos: lista,
      familiaDominante: familiaDominante(lista),
      metros: lista.reduce((s, t) => s + (Number(t.medida_cm) || 0), 0) / 100,
      nota: notaSlot(colmena),
    };
    const sector = colmena === 'SIN UBICACIÓN' ? '?' : sectorDeColmena(colmena);
    const arr = porSector.get(sector);
    if (arr) arr.push(estante);
    else porSector.set(sector, [estante]);
  }

  return [...porSector.entries()]
    .map(([sector, estantes]) => ({
      sector,
      estantes: estantes.sort((a, b) => compararColmenas(a.colmena, b.colmena)),
      total: estantes.reduce((s, e) => s + e.tubos.length, 0),
    }))
    .sort((a, b) => {
      // El sector '?' (sin ubicación) siempre al final.
      if (a.sector === '?') return 1;
      if (b.sector === '?') return -1;
      return a.sector.localeCompare(b.sector, 'es');
    });
}

/** ¿El tubo calza con la búsqueda? (código, ubicación o medida). */
export function coincideBusqueda(t: TuboColmena, q: string): boolean {
  const s = q.trim().toUpperCase();
  if (!s) return false;
  return (
    codigoNormalizado(t.cod).includes(s.replace(/\s+/g, '')) ||
    String(t.n_colmena ?? '').toUpperCase().includes(s) ||
    String(t.medida_cm ?? '').includes(s)
  );
}
