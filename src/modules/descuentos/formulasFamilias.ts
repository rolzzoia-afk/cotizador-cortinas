// ─────────────────────────────────────────────────────────────────────
// Fórmulas de corte editables (Admin → Catálogo técnico).
//
// Los números de las pizarras del taller —cuánto se le descuenta o suma al
// ancho para cortar cada pieza— dejan de estar sueltos en el código y pasan
// a este tipo, que se puede guardar en `configuracion` y editar desde Admin.
//
// REGLA: el DEFAULT es exactamente lo que hoy tiene el código, y los módulos
// de reglas reciben las fórmulas como último parámetro OPCIONAL. Una llamada
// sin parámetros se comporta igual que siempre — por eso los golden de las
// pizarras no cambian. Es el mismo criterio de `parametrosCorte.ts`.
//
// Lo que se edita acá son los NÚMEROS. La ESTRUCTURA (qué piezas tiene cada
// familia, qué variantes existen, qué montajes se ofrecen) sigue en el código.
//
// Módulo puro: sin React ni Supabase.
// ─────────────────────────────────────────────────────────────────────
import {
  FORMULAS_OSCURIDAD_DEFAULT,
  type FormulasOscuridad,
  type ParcheOscuridad,
  type TablaPerfilBase,
  type TernaVariantes,
} from './reglas-oscuridad';
import { FORMULAS_BEEBLACK_DEFAULT, type FormulasBeeblack } from './reglas-beeblack';

/** Cortina vertical: su cálculo son conteos, no descuentos por pieza. */
export type FormulasVertical = {
  /** Un carrito cada N cm de varilla. */
  pasoCarritoCm: number;
  /** Carritos que se suman después del floor (holgura del taller). */
  extraCarrito: number;
  /** Lamas de tela extra que se cortan de repuesto. */
  lamasRepuesto: number;
};

/** Roller y dúo: casi todo sale de la fila del catálogo; queda una constante. */
export type FormulasRoller = {
  /** El peso se corta siempre estos cm menos que el tubo. */
  pesoVsTuboCm: number;
};

/** Cenefas compradas como ADICIONAL (no las del paño). */
export type FormulasAdicionales = {
  /** Cenefa ovalada 38 mm cuando el modelo del catálogo no trae sus descuentos. */
  cenefaOvaladaTuboCm: number;
  cenefaOvaladaCenefaCm: number;
  /** Cenefa cuadrada: ajuste por tapas. */
  cuadradaCon1TapaCm: number;
  cuadradaCon2TapasCm: number;
  cuadradaMuroMuroCm: number;
  /** Soft light legacy (cenefa adicional): tubo/peso desde la cenefa, tela desde el peso. */
  softLightTuboDesdeCenefaCm: number;
  softLightPesoDesdeCenefaCm: number;
  softLightTelaDesdePesoCm: number;
};

export type FormulasFamilias = {
  oscuridad: FormulasOscuridad;
  beeblack: FormulasBeeblack;
  vertical: FormulasVertical;
  roller: FormulasRoller;
  adicionales: FormulasAdicionales;
};

export const FORMULAS_VERTICAL_DEFAULT: FormulasVertical = {
  pasoCarritoCm: 8,
  extraCarrito: 1,
  lamasRepuesto: 2,
};

export const FORMULAS_ROLLER_DEFAULT: FormulasRoller = {
  pesoVsTuboCm: 0.4,
};

export const FORMULAS_ADICIONALES_DEFAULT: FormulasAdicionales = {
  cenefaOvaladaTuboCm: 1.8,
  cenefaOvaladaCenefaCm: 1.5,
  cuadradaCon1TapaCm: 1,
  cuadradaCon2TapasCm: 2,
  cuadradaMuroMuroCm: -0.5,
  softLightTuboDesdeCenefaCm: 1.8,
  softLightPesoDesdeCenefaCm: 5.8,
  softLightTelaDesdePesoCm: 0.2,
};

/** Todo el catálogo de fórmulas tal como está validado en producción. */
export const FORMULAS_DEFAULT: FormulasFamilias = {
  oscuridad: FORMULAS_OSCURIDAD_DEFAULT,
  beeblack: FORMULAS_BEEBLACK_DEFAULT,
  vertical: FORMULAS_VERTICAL_DEFAULT,
  roller: FORMULAS_ROLLER_DEFAULT,
  adicionales: FORMULAS_ADICIONALES_DEFAULT,
};

// ── Normalización ──
// Lo guardado puede venir de una versión anterior (sin una familia, sin un
// campo) o corrupto. Se mezcla SOBRE el default: lo que falte o no sea un
// número usable se completa con el valor de fábrica, así una fórmula a medio
// guardar nunca deja al taller sin medida.

function esNumero(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Mezcla recursiva contra el default. Solo copia números y arrays de números
 * con el mismo largo: cualquier otra cosa (string, null, array corto) se
 * descarta y queda el valor de fábrica.
 */
function mezclar<T>(base: T, crudo: unknown): T {
  if (Array.isArray(base)) {
    if (!Array.isArray(crudo) || crudo.length !== base.length) return base;
    const salida = base.map((v, i) => (esNumero(crudo[i]) ? crudo[i] : v));
    return salida as unknown as T;
  }
  if (esNumero(base)) return (esNumero(crudo) ? crudo : base) as unknown as T;
  if (base && typeof base === 'object') {
    if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return base;
    const fuente = crudo as Record<string, unknown>;
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(base as Record<string, unknown>)) {
      salida[k] = k in fuente ? mezclar(v, fuente[k]) : v;
    }
    return salida as T;
  }
  return base;
}

/** Terna [INTERNO, SEMI, EXTERNO] saneada, o null si no lo es. */
function terna(v: unknown): TernaVariantes | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  return v.every(esNumero) ? ([v[0], v[1], v[2]] as TernaVariantes) : null;
}

function tablaPerfilBase(v: unknown): TablaPerfilBase | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const fuente = v as Record<string, unknown>;
  const salida = {} as TablaPerfilBase;
  for (const variante of ['INTERNO', 'SEMI', 'EXTERNO'] as const) {
    const fila = fuente[variante];
    if (!fila || typeof fila !== 'object') return null;
    const f = fila as Record<string, unknown>;
    if (!esNumero(f.PARED)) return null;
    salida[variante] = {
      DENTRO: esNumero(f.DENTRO) ? f.DENTRO : null,
      PARED: f.PARED,
    };
  }
  return salida;
}

/**
 * Parches por tipo de cortina. Es un mapa ABIERTO (las claves son categorías
 * creadas por el usuario), así que `mezclar` —que solo copia claves conocidas—
 * los descartaría. Se sanean aparte: clave a clave, campo a campo.
 */
function sanearPorTipo(crudo: unknown): Record<string, ParcheOscuridad> {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {};
  const salida: Record<string, ParcheOscuridad> = {};
  for (const [clave, valor] of Object.entries(crudo as Record<string, unknown>)) {
    const cat = clave.trim();
    if (!cat || !valor || typeof valor !== 'object' || Array.isArray(valor)) {
      console.warn(`[formulas_familias] parche de tipo inválido descartado: ${clave}`);
      continue;
    }
    const v = valor as Record<string, unknown>;
    const parche: ParcheOscuridad = {};
    for (const campo of [
      'cenefaAdj',
      'tuboAdj',
      'tuboAdjNegro',
      'pesoAdj',
      'telaAdj',
      'tuboPaso',
      'infDesc',
    ] as const) {
      if (!(campo in v)) continue;
      const t = terna(v[campo]);
      if (t) parche[campo] = t;
      else console.warn(`[formulas_familias] ${cat}.${campo} inválido: se hereda del molde`);
    }
    if ('infBase' in v) {
      const tabla = tablaPerfilBase(v.infBase);
      if (tabla) parche.infBase = tabla;
      else console.warn(`[formulas_familias] ${cat}.infBase inválido: se hereda del molde`);
    }
    if (Object.keys(parche).length === 0) {
      console.warn(`[formulas_familias] el parche de ${cat} quedó vacío: se descarta`);
      continue;
    }
    salida[cat] = parche;
  }
  return salida;
}

/** Completa lo guardado con los valores de fábrica. Nunca lanza. */
export function normalizarFormulas(crudo: unknown): FormulasFamilias {
  const salida = mezclar(FORMULAS_DEFAULT, crudo);
  const porTipo = sanearPorTipo(
    (crudo as { oscuridad?: { porTipo?: unknown } } | null | undefined)?.oscuridad?.porTipo,
  );
  return { ...salida, oscuridad: { ...salida.oscuridad, porTipo } };
}

/** true si las fórmulas son idénticas a las de fábrica (nada que restaurar). */
export function sonDefault(f: FormulasFamilias): boolean {
  return JSON.stringify(f) === JSON.stringify(FORMULAS_DEFAULT);
}

// ── Acceso por ruta ──
// El editor identifica cada número con una ruta ('oscuridad.cenefaAdj.DARK.0')
// para no tener que conocer la forma del objeto en la UI.

/** Lee el número de una ruta. null si la ruta no apunta a un número. */
export function leerCampo(f: FormulasFamilias, ruta: string): number | null {
  let nodo: unknown = f;
  for (const paso of ruta.split('.')) {
    if (nodo === null || typeof nodo !== 'object') return null;
    nodo = (nodo as Record<string, unknown>)[paso];
  }
  return esNumero(nodo) ? nodo : null;
}

/**
 * Devuelve una COPIA con el número de esa ruta cambiado (sin mutar el
 * original: el editor guarda el draft en estado de React).
 */
export function conCampoEditado(
  f: FormulasFamilias,
  ruta: string,
  valor: number,
): FormulasFamilias {
  const pasos = ruta.split('.');
  const copia = JSON.parse(JSON.stringify(f)) as FormulasFamilias;
  let nodo: Record<string, unknown> = copia as unknown as Record<string, unknown>;
  for (const paso of pasos.slice(0, -1)) {
    const siguiente = nodo[paso];
    if (siguiente === null || typeof siguiente !== 'object') return f; // ruta inválida
    nodo = siguiente as Record<string, unknown>;
  }
  const ultimo = pasos[pasos.length - 1];
  if (!(ultimo in nodo)) return f;
  nodo[ultimo] = valor;
  return copia;
}
