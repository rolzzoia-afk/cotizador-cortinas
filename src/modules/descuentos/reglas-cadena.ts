// ─────────────────────────────────────────────────────────────────────
// REGLAS DE CADENA — qué cadena de mando se auto-selecciona y con qué criterio.
//
// La cadena de mando es el accesorio CAD del inventario (la que sube y baja la
// cortina). No confundir con la "cadena" de las fórmulas de oscuridad, que es
// el encadenado de cortes (frontal → tubo → tela → peso).
//
// Estas tablas son los VALORES DE FÁBRICA. Admin → Catálogo técnico puede
// editarlas y guardarlas en configuracion.reglas_seleccion; desde ahí viajan
// por parámetro opcional (ver reglasSeleccion.ts). Sin nada guardado, todas las
// funciones de cadenas.ts usan exactamente estos defaults.
//
// El CATÁLOGO (`cadenas`) nace vacío a propósito: el largo y el color de cada
// código se venían adivinando del texto del nemotécnico del insumo, y eso se
// conserva como fallback. Declarar una cadena acá es un OVERLAY que manda sobre
// esa adivinanza — mismo contrato que los códigos de insumo por color.
// ─────────────────────────────────────────────────────────────────────
import type { EstadoCatalogo, MatchCategoria } from './reglas-mecanismo';

/** Largos que entiende el cotizador (clave interna, no texto de pantalla). */
export const LARGOS_CADENA = [
  '0.75',
  '1mts',
  '1.4mts',
  '2.4mts',
  '3mts',
  '4mts',
  'ROLLO',
] as const;

export type LargoCadena = (typeof LARGOS_CADENA)[number];

/** Largo interno → texto para las hojas de inventario y los selectores. */
export const LARGO_DESCRIPCION: Record<string, string> = {
  '0.75': '80 CM',
  '1mts': '1,2 METROS',
  '1.4mts': '1,4 METROS',
  '2.4mts': '2,4 METROS',
  '3mts': '3 METROS',
  '4mts': '4 METROS',
  ROLLO: 'ROLLO',
};

/**
 * Cadena declarada en el catálogo. Solo hace falta declarar las que el texto
 * del nemotécnico no deja adivinar (o las nuevas). `oculto` la saca de los
 * selectores de Fase 2, pero se sigue resolviendo en las OTs que ya la tienen.
 */
export type CadenaCatalogo = {
  /** Código de bodega (CAD05…), único. */
  codigo: string;
  /** Largo interno (clave de LARGOS_CADENA). */
  largo: string;
  /** Color corto de accesorios: BCO / NEG / GRS, o el nombre de un color propio. */
  color: string;
  /** Texto libre para quien edita; si está vacío se usa el nemotécnico del insumo. */
  descripcion?: string;
  estado: EstadoCatalogo;
};

/** Un tramo de la escalera: desde este alto (inclusive) se usa este largo. */
export type TramoCadenaAlto = {
  altoMinM: number;
  largo: string;
};

/** Categoría que fija el largo sin mirar el alto (el dúo). */
export type ReglaCadenaCategoria = {
  descripcion: string;
  categoria: MatchCategoria;
  largo: string;
};

export type ReglasCadena = {
  /** Overlay sobre el nemotécnico. Vacío = todo se deriva del texto (fábrica). */
  cadenas: readonly CadenaCatalogo[];
  /** Escalera por alto. Se evalúa del tramo más alto al más bajo. */
  tramosAlto: readonly TramoCadenaAlto[];
  /** Largo fijo por categoría; gana sobre la escalera. */
  reglasCategoria: readonly ReglaCadenaCategoria[];
  /** VERTICAL: cadena fija por color de accesorios (no mira el alto). */
  verticalPorColor: Record<string, string>;
  verticalDefault: string;
  verticalLargo: string;
};

export const REGLAS_CADENA: ReglasCadena = {
  cadenas: [],
  // ≥2 m → 4 m · ≥1,4 → 3 m · ≥0,8 → 2,4 m · ≥0,5 → 1,4 m · menos → sin auto.
  tramosAlto: [
    { altoMinM: 2.0, largo: '4mts' },
    { altoMinM: 1.4, largo: '3mts' },
    { altoMinM: 0.8, largo: '2.4mts' },
    { altoMinM: 0.5, largo: '1.4mts' },
  ],
  reglasCategoria: [
    {
      descripcion: 'Dúo: cadena corta de 1,40 m, sin importar el alto',
      categoria: { empiezaCon: 'DUO' },
      largo: '1.4mts',
    },
  ],
  // La vertical lleva SIEMPRE la de 3 m; solo el color la cambia. No hay
  // verticales con accesorios grises, así que un GRS heredado cae a la blanca
  // (mismo criterio que su kit VER).
  verticalPorColor: { NEG: 'CAD04', NEGRO: 'CAD04' },
  verticalDefault: 'CAD06',
  verticalLargo: '3mts',
};

const norm = (s: string | null | undefined): string => (s || '').trim().toUpperCase();

/** Declaración de un código en el catálogo (incluye ocultas: las OTs viejas se resuelven). */
export function cadenaDeclarada(
  cod: string | null | undefined,
  reglas: ReglasCadena = REGLAS_CADENA,
): CadenaCatalogo | null {
  const c = norm(cod).replace(/\s+/g, '');
  if (!c) return null;
  return reglas.cadenas.find((x) => norm(x.codigo).replace(/\s+/g, '') === c) ?? null;
}

/** ¿El código está declarado como oculto? (sale de los selectores de Fase 2). */
export function cadenaOculta(
  cod: string | null | undefined,
  reglas: ReglasCadena = REGLAS_CADENA,
): boolean {
  return cadenaDeclarada(cod, reglas)?.estado === 'oculto';
}

/** Largo que corresponde a una cortina, o null si la elige el vendedor. */
export function largoCadenaPorAltoCategoria(
  altoM: number,
  categoriaEfectivaNorm: string,
  reglas: ReglasCadena = REGLAS_CADENA,
  coincide: (categoria: string, match: MatchCategoria) => boolean,
): { largo: string; motivo: string } | null {
  for (const r of reglas.reglasCategoria) {
    if (coincide(categoriaEfectivaNorm, r.categoria)) {
      return { largo: r.largo, motivo: r.descripcion || 'regla por categoría' };
    }
  }
  if (!(altoM > 0)) return null;
  // Del tramo más alto al más bajo: gana el primero que el alto alcanza.
  const ordenados = [...reglas.tramosAlto].sort((a, b) => b.altoMinM - a.altoMinM);
  for (const t of ordenados) {
    if (altoM >= t.altoMinM) {
      return {
        largo: t.largo,
        motivo: `desde ${String(t.altoMinM).replace('.', ',')} m → ${LARGO_DESCRIPCION[t.largo] || t.largo}`,
      };
    }
  }
  return null;
}

/** Código de cadena de una VERTICAL según el color de accesorios (corto: BCO/NEG/GRS). */
export function codCadenaVerticalDeColor(
  colorCorto: string,
  reglas: ReglasCadena = REGLAS_CADENA,
): string {
  return reglas.verticalPorColor[norm(colorCorto)] || reglas.verticalDefault;
}
