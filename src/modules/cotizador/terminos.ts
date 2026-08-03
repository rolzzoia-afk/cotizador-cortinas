// ─────────────────────────────────────────────────────────────────────
// TÉRMINOS Y CONDICIONES de la cotización (Fase 1 / Fase 3).
//
// En el Excel manual los términos cambian según lo que se esté cotizando:
// hay condiciones generales, otras que solo aplican a una gama de tela
// ("GAMA PREMIUM Y DELUX: garantía 5 años…", "GAMA ESTÁNDAR: ancho máximo
// 2,50 m…") y otras a un producto puntual ("DARK ROLLER se instala entre 18 y
// 25 días hábiles").
//
// Modelo: el admin define GRUPOS. Cada grupo tiene un nombre, sus términos y
// a QUÉ aplica: siempre, a ciertas categorías de tela (A/B) y/o a ciertas
// categorías de producto (BEEBLACK, DARK_38mm…). Al cotizar se juntan los
// grupos que apliquen y se listan sus términos SIN REPETIR: un mismo término
// escrito en dos grupos sale una sola vez.
//
// Módulo puro: sin React ni Supabase (se testea directo).
// ─────────────────────────────────────────────────────────────────────

/** Un grupo de términos y a qué cotizaciones aplica. */
export type GrupoTerminos = {
  id: string;
  nombre: string;
  /** Aplica a toda cotización, sin importar qué se cotice. */
  siempre?: boolean;
  /** Categorías de TELA a las que aplica ('A' | 'B'). Vacío = no filtra por tela. */
  telas?: string[];
  /** Categorías de PRODUCTO a las que aplica (BEEBLACK, DARK_38mm…). Vacío = no filtra. */
  categorias?: string[];
  /** Los términos, uno por línea/ítem. */
  terminos: string[];
};

export type ConfigTerminos = { grupos: GrupoTerminos[] };

/** Texto legal que traía la app cableado, como grupo "General" por defecto. */
export const TERMINOS_DEFAULT: ConfigTerminos = {
  grupos: [
    {
      id: 'general',
      nombre: 'General',
      siempre: true,
      terminos: [
        'Cotización válida por 5 días.',
        'Pago: 50% para iniciar la fabricación y 50% al finalizar la instalación.',
        'Primera visita sin costo previa cotización (RM en AVN).',
        'Las cortinas se fabrican a medida; una vez confeccionadas no hay devolución de dinero.',
        'Verificar stock de la tela antes de pagar.',
      ],
    },
  ],
};

/** Normaliza para comparar/deduplicar: sin acentos, sin espacios de más, sin puntuación final. */
export function claveTermino(t: string): string {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[.;:,\s]+$/, '')
    .trim();
}

/** Normaliza una categoría de producto para comparar (mayúsculas, sin espacios). */
function normCat(c: string | null | undefined): string {
  return String(c ?? '').trim().toUpperCase();
}

/**
 * Sanea lo que viene de la BD: descarta grupos sin forma válida, recorta
 * términos vacíos y garantiza los arrays. Si no queda nada, devuelve el default
 * (la cotización nunca debe quedarse sin condiciones).
 */
export function normalizarTerminos(raw: unknown): ConfigTerminos {
  const gruposRaw = (raw as ConfigTerminos | null)?.grupos;
  if (!Array.isArray(gruposRaw)) return TERMINOS_DEFAULT;
  const grupos: GrupoTerminos[] = [];
  for (const g of gruposRaw) {
    if (!g || typeof g !== 'object') continue;
    const terminos = Array.isArray(g.terminos)
      ? g.terminos.map((t) => String(t ?? '').trim()).filter(Boolean)
      : [];
    const id = String(g.id ?? '').trim();
    if (!id) continue;
    grupos.push({
      id,
      nombre: String(g.nombre ?? '').trim() || id,
      siempre: g.siempre === true,
      telas: Array.isArray(g.telas) ? g.telas.map((t) => String(t).trim().toUpperCase()).filter(Boolean) : [],
      categorias: Array.isArray(g.categorias)
        ? g.categorias.map(normCat).filter(Boolean)
        : [],
      terminos,
    });
  }
  return grupos.length ? { grupos } : TERMINOS_DEFAULT;
}

/** Categorías de PRODUCTO presentes en las ventanas de la OT (set ordenado). */
export function categoriasDeVentanas(
  ventanas: Array<{ categoria?: string | null }> | null | undefined,
): string[] {
  const set = new Set<string>();
  for (const v of ventanas ?? []) {
    const c = normCat(v?.categoria);
    if (c) set.add(c);
  }
  return [...set].sort();
}

/** ¿Este grupo aplica a lo que se está cotizando? */
export function grupoAplica(
  g: GrupoTerminos,
  catsProducto: string[],
  catsTela: string[],
): boolean {
  if (g.siempre) return true;
  const cats = (g.categorias ?? []).map(normCat).filter(Boolean);
  const telas = (g.telas ?? []).map((t) => String(t).trim().toUpperCase()).filter(Boolean);
  // Un grupo sin `siempre` y sin ninguna asignación no aplica a nada: es un
  // grupo a medio configurar, no un comodín silencioso.
  if (!cats.length && !telas.length) return false;
  const porCat = cats.some((c) => catsProducto.map(normCat).includes(c));
  const porTela = telas.some((t) => catsTela.map((x) => String(x).toUpperCase()).includes(t));
  return porCat || porTela;
}

/**
 * Términos que corresponden a la cotización: une los grupos que aplican, en el
 * orden en que están definidos, y descarta los repetidos (comparando el texto
 * normalizado). Devuelve el texto ORIGINAL del primero que apareció.
 */
export function terminosParaCotizacion(
  config: ConfigTerminos,
  catsProducto: string[],
  catsTela: string[],
): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const g of config.grupos) {
    if (!grupoAplica(g, catsProducto, catsTela)) continue;
    for (const t of g.terminos) {
      const k = claveTermino(t);
      if (!k || vistos.has(k)) continue;
      vistos.add(k);
      out.push(t.trim());
    }
  }
  return out;
}
