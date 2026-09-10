// ─────────────────────────────────────────────────────────────────────
// La colmena de paños, como se lee en pantalla (lámina «Colmena de paños»).
//
// La grilla y los estantes ya los arma `modules/telas/colmenaViva`. Acá está
// lo que la PANTALLA necesita decir de cada paño: dónde está, de dónde salió,
// para qué alcanza, cuánto lleva ahí y si conviene hacer algo con él.
//
// Nada de esto consulta la base ni pinta nada, así que se puede fijar con
// tests. Importa: un paño mal ubicado en pantalla es un paño que el operario
// no encuentra y termina cortando de un rollo nuevo.
// ─────────────────────────────────────────────────────────────────────

import type { ColmenaPano } from '@/modules/admin/colmena';
import {
  enAlerta,
  tipoDeCodigo,
  zonaDe,
  ZONAS,
  type TipoTela,
} from '@/modules/telas/colmenaViva';

// ── Familias ─────────────────────────────────────────────────────────

/** Cómo se llama cada familia en la leyenda. */
export const FAMILIAS_PANO: Record<TipoTela, string> = {
  BK: 'Blackout',
  DU: 'Dúo',
  SC: 'Screen',
  TR: 'Translúcida',
  OTRO: 'Otra',
};

export function nombreFamiliaPano(codigo: string | null | undefined): string {
  return FAMILIAS_PANO[tipoDeCodigo(codigo)];
}

// ── Ubicación ────────────────────────────────────────────────────────

function entero(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Dónde está el paño, en palabras: «Galpón · R3 · M7 · col 3».
 *
 * Los paños de las zonas de estante (Rolzzo) no tienen coordenada de grilla:
 * ahí el texto libre de `ubicacion` ES la ubicación, y se muestra tal cual.
 */
export function ubicacionTexto(p: ColmenaPano): string {
  const zona = zonaDe(p);
  const label = ZONAS[zona]?.label ?? zona;
  const d = p.datos_extra ?? {};
  const rack = entero(d.rack);
  const fila = entero(d.m);
  const col = entero(d.col);
  if (rack != null && fila != null && col != null) {
    // El galpón rotula sus filas «M7»; el liberado las numera sin letra, así
    // que ahí se dice «fila 3» para que no quede un número suelto.
    const prefijo = ZONAS[zona]?.filaPrefix ?? '';
    const nivel = prefijo ? `${prefijo}${fila}` : `fila ${fila}`;
    return `${label} · R${rack} · ${nivel} · col ${col}`;
  }
  const libre = String(p.ubicacion ?? '').trim();
  return libre ? `${label} · ${libre}` : label;
}

/** «120 × 240», con la medida entera: los sobrantes se miden con huincha. */
export function medidaTexto(
  ancho: number | null | undefined,
  alto: number | null | undefined,
): string {
  if (ancho == null || alto == null) return '—';
  return `${Math.round(ancho)} × ${Math.round(alto)}`;
}

/**
 * El dibujo del paño, a escala, dentro de una caja de `maxPx`. Mantiene la
 * proporción real: un paño ancho y bajo se ve ancho y bajo, que es de lo que
 * se trata el dibujo.
 */
export function cajaAEscala(
  ancho: number | null | undefined,
  alto: number | null | undefined,
  maxPx: number,
): { ancho: number; alto: number } | null {
  const a = Number(ancho ?? 0);
  const h = Number(alto ?? 0);
  if (!(a > 0) || !(h > 0)) return null;
  const escala = maxPx / Math.max(a, h);
  // Un lado nunca baja de 28 px o el rectángulo deja de leerse como tal.
  return { ancho: Math.max(28, Math.round(a * escala)), alto: Math.max(28, Math.round(h * escala)) };
}

// ── De dónde salió ───────────────────────────────────────────────────

/** De dónde vino el paño, en palabras. Lo crudo se guarda para el `title`. */
export function origenTexto(fuente: string | null | undefined): string {
  const f = String(fuente ?? '').trim();
  if (!f) return '—';
  if (f === 'corte_rollo') return 'Sobrante de un corte';
  if (/^IMPORT_/i.test(f)) return 'Importado del Excel';
  if (/^COLMENA_/i.test(f)) return 'Carga inicial de la colmena';
  return f;
}

/** «02-06-2026». Vacío si la fecha no se entiende. */
export function fechaLarga(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ''));
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Para qué alcanza el trozo, como lo dice la etiqueta. */
export function sirveParaTexto(f: { roller: boolean; vertical: boolean }): string[] {
  const out: string[] = [];
  if (f.roller) out.push('Roller');
  if (f.vertical) out.push('Vertical');
  return out;
}

/**
 * El consejo del panel. Solo aparece cuando hay algo que decidir: un paño de
 * hace una semana no necesita que nadie opine.
 */
export function consejoDelPano(a: {
  estado: 'activa' | 'alerta' | 'usada' | 'baja';
  dias: number | null;
  familia: string;
}): string | null {
  if (a.estado === 'baja') {
    return 'Este paño está dado de baja: quedó registrado como merma y no entra en ningún corte.';
  }
  if (a.estado === 'usada') {
    return 'Este paño ya se usó. Sigue en el mapa para poder rastrear de dónde salió lo que se cortó.';
  }
  if (a.estado === 'alerta') {
    const cuanto = a.dias != null ? `Lleva ${a.dias} días` : 'Lleva mucho tiempo';
    return `${cuanto} sin usarse. Conviene ofrecerlo en la próxima cotización de ${a.familia.toLowerCase()} o darlo de baja.`;
  }
  return null;
}

// ── Buscar una medida ────────────────────────────────────────────────

export type MedidaPedida = { ancho: number; alto: number };

/**
 * ¿De este paño sale una pieza de `pedida`?
 *
 * SIN girar: la tela tiene diseño y no se acuesta sola (es la misma regla del
 * optimizador). Un paño de 240 × 120 no sirve para una pieza de 120 × 240
 * aunque los números sean los mismos.
 */
export function cabeEnPano(p: ColmenaPano, pedida: MedidaPedida): boolean {
  const a = Number(p.medida_ancho ?? 0);
  const h = Number(p.medida_alto ?? 0);
  return a >= pedida.ancho && h >= pedida.alto;
}

/** Cuánta tela sobra si se corta `pedida` de este paño, en cm². Para ordenar. */
export function desperdicioCm2(p: ColmenaPano, pedida: MedidaPedida): number {
  const a = Number(p.medida_ancho ?? 0);
  const h = Number(p.medida_alto ?? 0);
  return a * h - pedida.ancho * pedida.alto;
}

/**
 * Los paños disponibles de los que sale la pieza, del que menos desperdicia
 * al que más: cortar de un retazo justo es lo que mantiene la colmena chica.
 */
export function panosQueCaben(
  panos: ColmenaPano[],
  pedida: MedidaPedida,
  codigo?: string,
): ColmenaPano[] {
  const cod = String(codigo ?? '').trim().toUpperCase();
  return panos
    .filter((p) => p.disponible && !p.datos_extra?.baja)
    .filter((p) => !cod || String(p.codigo ?? '').trim().toUpperCase() === cod)
    .filter((p) => cabeEnPano(p, pedida))
    .sort((a, b) => desperdicioCm2(a, pedida) - desperdicioCm2(b, pedida));
}

// ── Las pestañas ─────────────────────────────────────────────────────

export type ResumenZona = {
  zona: string;
  label: string;
  /** Paños disponibles, que es lo que se puede usar. */
  disponibles: number;
  /** Los que llevan más de los días de alerta sin usarse. */
  alerta: number;
  modo: 'grid' | 'slots';
};

const ORDEN_ZONA = ['GALPON', 'LIBERADO', 'ROLZZO', 'CORTE'];

/**
 * Una pestaña por zona física. Cada zona es una colmena independiente: se
 * cuentan por separado porque mezclarlas escondería que el galpón está vacío
 * mientras Rolzzo rebalsa.
 */
export function resumenZonas(
  panos: ColmenaPano[],
  hoyISO: string,
  diasAlerta?: number,
): ResumenZona[] {
  const por = new Map<string, ColmenaPano[]>();
  for (const p of panos) {
    const z = zonaDe(p);
    por.set(z, [...(por.get(z) ?? []), p]);
  }
  return [...por.entries()]
    .sort(
      (a, b) =>
        (ORDEN_ZONA.indexOf(a[0]) + 1 || 99) - (ORDEN_ZONA.indexOf(b[0]) + 1 || 99) ||
        a[0].localeCompare(b[0]),
    )
    .map(([zona, ps]) => ({
      zona,
      label: ZONAS[zona]?.label ?? zona,
      modo: ZONAS[zona]?.modo ?? 'grid',
      disponibles: ps.filter((p) => p.disponible && !p.datos_extra?.baja).length,
      alerta: ps.filter((p) => enAlerta(p, hoyISO, diasAlerta)).length,
    }));
}
