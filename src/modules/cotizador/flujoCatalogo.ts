// ─────────────────────────────────────────────────────────────────────
// EL FLUJO DE UNA TELA: qué le pasa a un producto del catálogo cuando se
// cotiza. Responde las dos preguntas que uno se hace al dar de alta un código
// nuevo: ¿entra como cortina o como adicional de precio fijo?, y ¿con qué
// receta y a qué precio por metro se va a cobrar?
//
// Es lo que la app YA hace (`cotizarFase0`); acá solo se lee para mostrarlo.
// Módulo PURO: sin React y sin Supabase.
// ─────────────────────────────────────────────────────────────────────

import { precioMlPorCod } from './motorFase0';
import {
  REGLAS_PRECIOS_DEFAULT,
  claveReceta,
  type ReglasPrecios,
} from './reglasPrecios';
import type { CatalogoProductos, Producto } from './types';

/**
 * Los cuatro tipos que Fase 0 considera CORTINA (se miden, se optimizan por
 * paños y se cobran por m²). Cualquier otro tipo entra como adicional: precio
 * fijo × cantidad, sin materiales ni tela.
 */
export const TIPOS_CORTINA = ['PREMIUM', 'DELUX', 'STANDARD', 'BASIC'] as const;

export const esCortinaTipo = (tipo: string | undefined): boolean =>
  TIPOS_CORTINA.includes(
    String(tipo ?? '').toUpperCase().trim() as (typeof TIPOS_CORTINA)[number],
  );

/**
 * De dónde salió el precio por metro de la familia, en el orden que usa el
 * motor: la tela base del roller equivalente (verticales), la tela de
 * referencia de la familia, o —si no hay ninguna— la tela MÁS CARA de la
 * familia. Este último caso es el riesgoso: basta que entre un código ajeno con
 * ese mismo COD para que suba el precio de todas.
 */
export type OrigenPrecio = 'baseVertical' | 'arquetipo' | 'maxFamilia';

export type FlujoProducto = {
  entra: 'cortina' | 'adicional';
  /** La familia (COD) con la que se agrupa y se cobra. */
  cod: string;
  esVertical: boolean;
  esDuo: boolean;
  /** Receta con la que se calculan sus materiales (null si entra como adicional). */
  recetaKey: string | null;
  /** false = la familia no tiene receta propia y usa una de respaldo. */
  recetaPropia: boolean;
  /** COD_INT de la tela que fija el $/m ('' si el catálogo no tiene ninguna). */
  telaReferencia: string;
  precioMl: number;
  origenPrecio: OrigenPrecio;
};

// El motor deduce vertical y dúo así (motorFase0.ts, dentro de cotizarFase0).
// Se replica acá para poder mostrarlo sin cotizar; el test lo mantiene alineado.
const esDuoDe = (cod: string, nombre: string): boolean =>
  cod.startsWith('DUO') || nombre.includes('DUO');
const esVerticalDe = (cod: string, nombre: string): boolean =>
  /(_V_|-V$|-V-)/.test(cod) || nombre.includes('VERTICAL');

/** Qué le pasa a este producto cuando alguien lo cotiza. */
export function flujoDeProducto(
  producto: Producto,
  codInt: string,
  catalogo: CatalogoProductos,
  reglas: ReglasPrecios = REGLAS_PRECIOS_DEFAULT,
): FlujoProducto {
  // Igual que el motor: si el producto no declara familia, su propio COD_INT
  // hace de familia.
  const cod = producto.cod || codInt;
  const nombre = (producto.producto || '').toUpperCase();
  const esDuo = esDuoDe(cod, nombre);
  const esVertical = esVerticalDe(cod, nombre);
  const entra = esCortinaTipo(producto.tipo) ? 'cortina' : 'adicional';

  const { precio, arquetipo } = precioMlPorCod(cod, catalogo, reglas);
  const origenPrecio: OrigenPrecio = reglas.baseVertical[cod]
    ? 'baseVertical'
    : reglas.arquetipos[cod] && arquetipo === reglas.arquetipos[cod]
      ? 'arquetipo'
      : 'maxFamilia';

  const clave = entra === 'cortina' ? claveReceta(cod, esVertical, reglas.recetas) : null;

  return {
    entra,
    cod,
    esVertical,
    esDuo,
    recetaKey: clave,
    recetaPropia: clave === cod,
    telaReferencia: arquetipo,
    precioMl: precio,
    origenPrecio,
  };
}

export type AvisosCatalogo = {
  /**
   * Familias de cortina que se cobran con la tela más cara de su grupo, sin
   * tela de referencia declarada. Ahí una tela nueva puede subirle el precio a
   * toda la familia (fue lo que pasó con los códigos BEE-*).
   */
  familiasSinReferencia: { cod: string; telas: number; telaMasCara: string }[];
  /** Telas de cortina sin ancho de rollo: cotizan con el ancho de respaldo. */
  telasSinAncho: string[];
  /** Telas de referencia que apuntan a un COD_INT que no está o vale 0. */
  referenciasRotas: { cod: string; codInt: string }[];
  /**
   * Familias que solo se distinguen por mayúsculas (BLACKOUT_p vs BLACKOUT_P).
   * El Excel las trata como una sola; acá se cobran por separado, y la de la
   * minúscula termina con receta de respaldo y sin tela de referencia.
   */
  familiasCasiIguales: { familias: string[] }[];
  /** Productos sin tipo: entran a la cotización como adicional de precio fijo. */
  productosSinTipo: string[];
};

/**
 * Lo que conviene mirar del catálogo antes de que sorprenda en una cotización.
 * Solo recorre las telas que entran como cortina: un adicional no tiene tela.
 */
export function avisosCatalogo(
  catalogo: CatalogoProductos,
  anchoRollo: Record<string, number>,
  reglas: ReglasPrecios = REGLAS_PRECIOS_DEFAULT,
): AvisosCatalogo {
  const familiasSinReferencia: AvisosCatalogo['familiasSinReferencia'] = [];
  const telasSinAncho: string[] = [];
  const referenciasRotas: AvisosCatalogo['referenciasRotas'] = [];
  const productosSinTipo: string[] = [];
  const vistas = new Set<string>();
  /** Familias agrupadas por su nombre en mayúsculas, para detectar duplicados. */
  const porNombreNormalizado = new Map<string, Set<string>>();

  for (const [codInt, p] of Object.entries(catalogo)) {
    if (!p) continue;
    const familia = (p.cod || '').trim();
    if (familia) {
      const k = familia.toUpperCase();
      const previas = porNombreNormalizado.get(k) ?? new Set<string>();
      previas.add(familia);
      porNombreNormalizado.set(k, previas);
    }
    if (!String(p.tipo ?? '').trim()) productosSinTipo.push(codInt);

    if (!esCortinaTipo(p.tipo)) continue;
    const f = flujoDeProducto(p, codInt, catalogo, reglas);

    if (!(Number(anchoRollo[codInt]) > 0) && !(Number(p.anchoRollo) > 0)) {
      telasSinAncho.push(codInt);
    }

    if (vistas.has(f.cod)) continue;
    vistas.add(f.cod);

    // Una vertical sin su roller equivalente en el catálogo cotiza la tela a $0
    // y no cae al máximo: el motor no tiene respaldo para ese caso.
    if (f.origenPrecio === 'baseVertical' && !(f.precioMl > 0)) {
      referenciasRotas.push({ cod: f.cod, codInt: f.telaReferencia });
      continue;
    }

    if (f.origenPrecio === 'maxFamilia') {
      const declarada = reglas.arquetipos[f.cod];
      if (declarada) {
        // Hay tela de referencia declarada, pero el catálogo no la tiene (o vale 0)
        // y por eso cayó al máximo.
        referenciasRotas.push({ cod: f.cod, codInt: declarada });
      } else {
        const telas = Object.values(catalogo).filter(
          (q) => q && (q.cod || '') === f.cod && esCortinaTipo(q.tipo),
        ).length;
        familiasSinReferencia.push({ cod: f.cod, telas, telaMasCara: f.telaReferencia });
      }
    }
  }

  const familiasCasiIguales = [...porNombreNormalizado.values()]
    .filter((s) => s.size > 1)
    .map((s) => ({ familias: [...s].sort((a, b) => a.localeCompare(b, 'es')) }));

  return {
    familiasSinReferencia: familiasSinReferencia.sort((a, b) => a.cod.localeCompare(b.cod, 'es')),
    telasSinAncho: telasSinAncho.sort((a, b) => a.localeCompare(b, 'es')),
    referenciasRotas: referenciasRotas.sort((a, b) => a.cod.localeCompare(b.cod, 'es')),
    familiasCasiIguales,
    productosSinTipo: productosSinTipo.sort((a, b) => a.localeCompare(b, 'es')),
  };
}
