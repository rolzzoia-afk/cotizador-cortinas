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

/**
 * Largo interno → texto para las hojas de inventario y los selectores.
 *
 * Las claves son históricas y nombran la cadena por el LARGO DE CAÍDA; bodega
 * las nombra por el largo del lazo, que es el doble: '0.75' es la cadena de
 * 1,6 m (80 cm de caída) y '1mts' la de 1,2 m (60 cm). El texto usa los dos
 * para que nadie tenga que traducir.
 */
export const LARGO_DESCRIPCION: Record<string, string> = {
  '0.75': '1,6 METROS - 80 CM',
  '1mts': '1,2 METROS - 60 CM',
  '1.4mts': '1,4 METROS - 70 CM',
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

/**
 * Regla propia de una categoría. Puede fijar un `largo` sin mirar el alto, o
 * traer su propia escalera (`tramosAlto`), que REEMPLAZA a la general — el dúo
 * necesita más cadena que un roller del mismo alto.
 */
export type ReglaCadenaCategoria = {
  descripcion: string;
  categoria: MatchCategoria;
  largo?: string;
  tramosAlto?: readonly TramoCadenaAlto[];
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
  // ≥2 m → 4 m · ≥1,4 → 3 m · ≥0,8 → 2,4 m · ≥0,5 → 1,2 m · menos → sin auto.
  // El peldaño bajo pedía la de 1,40 m hasta el 2026-08-10; bodega la dio de
  // baja (CAD18/CAD19) y en su lugar va la de 1,2 m.
  tramosAlto: [
    { altoMinM: 2.0, largo: '4mts' },
    { altoMinM: 1.4, largo: '3mts' },
    { altoMinM: 0.8, largo: '2.4mts' },
    { altoMinM: 0.5, largo: '1mts' },
  ],
  // El dúo pide más cadena que un roller del mismo alto: la tela baja y vuelve a
  // subir, así que el lazo tiene que recorrer el doble. Escalera dictada por el
  // dueño el 2026-08-10 (antes: primero una cadena fija de 1,40 m sin mirar el
  // alto — un dúo de 1,93 m salía con 70 cm —, después la escalera del roller).
  reglasCategoria: [
    {
      descripcion: 'Dúo: escalera propia',
      categoria: { empiezaCon: 'DUO' },
      tramosAlto: [
        { altoMinM: 2.1, largo: '4mts' },
        { altoMinM: 1.6, largo: '3mts' },
        { altoMinM: 1.4, largo: '2.4mts' },
        { altoMinM: 0.9, largo: '0.75' },
        { altoMinM: 0.6, largo: '1mts' },
      ],
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

/** Tramo que le toca a un alto: del más alto al más bajo, gana el primero que alcanza. */
function tramoParaAlto(
  altoM: number,
  tramos: readonly TramoCadenaAlto[],
): TramoCadenaAlto | null {
  if (!(altoM > 0)) return null;
  const ordenados = [...tramos].sort((a, b) => b.altoMinM - a.altoMinM);
  return ordenados.find((t) => altoM >= t.altoMinM) ?? null;
}

function motivoTramo(t: TramoCadenaAlto): string {
  return `desde ${String(t.altoMinM).replace('.', ',')} m → ${LARGO_DESCRIPCION[t.largo] || t.largo}`;
}

/** Largo que corresponde a una cortina, o null si la elige el vendedor. */
export function largoCadenaPorAltoCategoria(
  altoM: number,
  categoriaEfectivaNorm: string,
  reglas: ReglasCadena = REGLAS_CADENA,
  coincide: (categoria: string, match: MatchCategoria) => boolean,
): { largo: string; motivo: string } | null {
  for (const r of reglas.reglasCategoria) {
    if (!coincide(categoriaEfectivaNorm, r.categoria)) continue;
    // La escalera de la categoría REEMPLAZA a la general: si ningún tramo llega,
    // la cadena la elige el vendedor (no se cae al peldaño del roller).
    if (r.tramosAlto?.length) {
      const t = tramoParaAlto(altoM, r.tramosAlto);
      if (!t) return null;
      const motivo = motivoTramo(t);
      return { largo: t.largo, motivo: r.descripcion ? `${r.descripcion} — ${motivo}` : motivo };
    }
    if (r.largo) return { largo: r.largo, motivo: r.descripcion || 'regla por categoría' };
  }
  const t = tramoParaAlto(altoM, reglas.tramosAlto);
  return t ? { largo: t.largo, motivo: motivoTramo(t) } : null;
}

/** Código de cadena de una VERTICAL según el color de accesorios (corto: BCO/NEG/GRS). */
export function codCadenaVerticalDeColor(
  colorCorto: string,
  reglas: ReglasCadena = REGLAS_CADENA,
): string {
  return reglas.verticalPorColor[norm(colorCorto)] || reglas.verticalDefault;
}
