// ─────────────────────────────────────────────────────────────────────
// COMPLETITUD DE FASE 2 — qué le falta a la OT para poder producirse.
//
// Fase 2 (Terreno) es donde se termina de definir cada paño. Si la OT avanza a
// Fase 3/4 con datos a medias, el error aparece tarde y caro: tarugos en 0,
// bracket a muro en una instalación a techo, celdas vacías en el Excel de
// órdenes, "definir F2" impreso en el Cálculo General. Este módulo junta en UNA
// lista todo lo que falta, para bloquear el avance y decir exactamente dónde.
//
// Las reglas NO son nuevas: cada una corresponde a una validación, un chip de
// aviso o un consumidor que ya existe (se anota la fuente en cada bloque).
// Módulo PURO (sin React/Supabase) para poder testearlo.
// ─────────────────────────────────────────────────────────────────────
import { calcularDespiece, contextoDespieceDesdePano } from '@/modules/descuentos/despiece';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import {
  categoriaRequiereMecanismo,
  esCategoriaPletina,
  esCategoriaVertical,
  mecLineaB,
} from '@/modules/descuentos/reglas-mecanismo';
import { esCategoriaBeeblack } from '@/modules/descuentos/reglas-beeblack';
import { familiaOscuridad } from '@/modules/descuentos/reglas-oscuridad';
import { esCenefaCuadrada } from './fase2';
import {
  REGLAS_SELECCION_DEFAULT,
  type ReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccion';
import {
  cenefaCuadradaTapasFijas,
  esCenefaOvalada,
  llevaCenefaCuadradaImplicita,
} from './insumosCortina';
import type { CatalogoProductos, Pano, Ventana } from './types';
import { esLineaB } from './lineaB';

/** Un dato que falta para producir. `panoIdx` null = es de la ventana entera. */
export type PendienteFase2 = {
  ventanaId: string | number;
  ubicacion: string;
  /** Índice del paño (0-based) o null si el pendiente es de la ventana. */
  panoIdx: number | null;
  /** Texto corto para el operador ("elige el material de instalación"). */
  mensaje: string;
};

const txt = (v: unknown): string => String(v ?? '').trim();
const num = (v: unknown): number => parseFloat(String(v ?? 0)) || 0;

// Columnas del Excel de órdenes que son PERFILES con perforación (mismas llaves
// que `PERF_POR_PERFIL` en excel-ordenes.ts). Los separadores se detectan por
// prefijo: llevan medida pero no perforación.
const COLUMNAS_PERFIL = new Set(['PERFIL (IZQ) INT', 'PERFIL (DER) INT', 'PERFIL BASE']);

/**
 * Todo lo que le falta a la OT para pasar a Fase 3, ventana por ventana y paño
 * por paño. Lista vacía = lista para avanzar.
 *
 * A diferencia de `validarVentana` (fase2.ts), que corta en el PRIMER error y
 * solo corre al guardar una ventana, esta recorre TODO: las ventanas creadas en
 * Fase 1 nunca pasan por el editor de Fase 2, así que el gate no puede confiar
 * en que alguien las haya guardado.
 */
export function pendientesFase2(
  ventanas: Ventana[],
  formulas?: FormulasFamilias,
  /** Reglas editadas en Admin: definen qué categorías llevan mecanismo. */
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
  /** Catálogo de telas: resuelve la línea (A/B) de cada paño. Sin él, el chequeo
   *  de línea B no corre (los llamadores que no lo pasan no lo necesitan). */
  catalogo?: CatalogoProductos,
): PendienteFase2[] {
  const out: PendienteFase2[] = [];

  for (const v of ventanas || []) {
    const ubicacion = txt(v.ubicacion) || String(v.id ?? '');
    const add = (mensaje: string, panoIdx: number | null = null) =>
      out.push({ ventanaId: v.id, ubicacion, panoIdx, mensaje });

    // ── Ventana (mismos mínimos que validarVentana) ──
    if (!txt(v.ubicacion)) add('falta la ubicación');
    if (!txt(v.categoria)) add('falta la categoría');
    const panos = (v.panos || []) as Pano[];
    if (panos.length === 0) {
      add('no tiene paños');
      continue;
    }

    const categoria = txt(v.categoria);
    const esBeeblack = esCategoriaBeeblack(categoria);
    const esVertical = esCategoriaVertical(categoria);
    const esPletina = esCategoriaPletina(categoria, reglas.tipos);
    // Sin modelo de fabricación no hay medidas de corte (excel-ordenes.ts avisa
    // lo mismo, pero recién en Fase 4 y cuando el Excel ya salió).
    if (!v.modelo && !esBeeblack) add('falta el modelo de fabricación');
    const requiereMec = !!categoria && categoriaRequiereMecanismo(categoria, reglas.mecanismo);

    panos.forEach((p, i) => {
      const falta = (mensaje: string) => add(mensaje, i);
      const ancho = num(p.ancho);
      const alto = num(p.alto ?? v.alto);
      if (ancho <= 0) falta('falta el ancho');
      if (alto <= 0) falta('falta el alto');

      // Mecanismo: misma condición que validarVentana (categorías que lo llevan).
      if (requiereMec && !txt(p.mecanismo)) falta('falta el mecanismo');
      // CATEGORÍA B: solo existe receta en blanco y negro (roller simple, cenefa
      // ovalada y dúo 38). Sin receta el motor no elige kit ni códigos de
      // bodega, así que la OT no puede seguir: hay que corregir el color o
      // fabricar la cortina en la categoría A.
      if (catalogo && requiereMec && esLineaB(p, v.codInt, catalogo, categoria, reglas.mecanismo, reglas.tipos)) {
        const colorAcc = colorAccesoriosDePano(p, v.color);
        if (mecLineaB(categoria, colorAcc, reglas.mecanismo, reglas.tipos) == null) {
          falta(
            `la categoría B no tiene herrajes para «${txt(colorAcc) || 'sin color'}» en ${categoria || 'este sistema'}: usa accesorios blancos o negros, o pasa la cortina a la categoría A`,
          );
        }
      }
      // Tubería: viaja al Excel de órdenes (columna TUBERIA). La vertical no lleva.
      if (!esVertical && !esBeeblack && !txt(p.tuberia)) falta('falta la tubería');
      // Color de accesorios: define códigos de kit, tapas y peso; además es una
      // columna del Excel de órdenes.
      if (!txt(colorAccesoriosDePano(p, v.color))) falta('falta el color de accesorios');
      // Material de instalación: sin él la OT sale con CERO tarugos y sin aviso
      // (insumosCortina.cantidadTarugos devuelve 0 si no hay material).
      if (!txt(p.materialTipo)) falta('falta el material de instalación');

      // Cadena y peso: solo donde hay mecanismo manual (el motor la reemplaza).
      const llevaMotor = !!txt(p.motorModelo) || !!txt(p.motorTipo) || !!txt(p.ladoMotor);
      if (requiereMec && !llevaMotor && !esVertical) {
        if (!txt(p.codCadena)) falta('falta la cadena');
        if (!txt(p.codPeso)) falta('falta el peso de cadena');
      }
      // Manilla: si se pidió cantidad, hace falta el color para el código.
      if (num(p.manillaCant) > 0 && !txt(p.manillaColor)) falta('falta el color de la manilla');

      // Superficie (techo/pared): decide el bracket de la cenefa (BRA04/BRA05).
      const llevaCenefa =
        esCenefaOvalada(p.cenefa as string, categoria, reglas.tipos) ||
        esCenefaCuadrada(p.cenefa as string) ||
        llevaCenefaCuadradaImplicita(categoria, reglas.tipos);
      if (llevaCenefa && !txt(p.superficie)) falta('falta la superficie (techo/pared)');

      // Cenefa OVALADA: tapa, bracket y tira van al Excel y al inventario.
      if (esCenefaOvalada(p.cenefa as string, categoria, reglas.tipos)) {
        if (!txt(p.colorTapa)) falta('falta el color de tapa de la cenefa');
        if (!txt(p.bracketTipo)) falta('falta el tipo de bracket');
        if (!txt(p.cenefaTira)) falta('falta definir la tira de la cenefa (con/sin)');
      }
      // Cenefa CUADRADA elegible (roller/vertical): tapas + color. En oscuridad
      // las tapas son fijas por sistema, así que no se pregunta.
      if (esCenefaCuadrada(p.cenefa as string) && !cenefaCuadradaTapasFijas(categoria, p.cenefa as string, reglas.tipos)) {
        if (!txt(p.cenefaTapa)) falta('falta el tipo de tapas de la cenefa');
        if (!txt(p.colorTapa)) falta('falta el color de tapa de la cenefa');
      }

      // Dúo: el cierre lo mide el vendedor en terreno (chip ámbar de PanoEditor).
      // La pletina se corta al alto exacto y no lo lleva.
      if (categoria.toUpperCase().includes('DUO') && !esPletina && num(p.cierreAlturaCm) <= 0) {
        falta('falta la altura de cierre del dúo');
      }
      // Motor: modelo y lado (el BOM los necesita para emitir el kit).
      if (llevaMotor) {
        if (!txt(p.motorModelo)) falta('falta el modelo de motor');
        if (!txt(p.ladoMotor)) falta('falta el lado del motor');
      }
      // BEEBLACK: sin variante no hay componentes (todas las medidas salen de
      // ella). La manilla NO se exige: es estructura y el motor la emite sola
      // (manillasActivasBeeblack); la segunda es opt-in.
      if (esBeeblack && !txt(p.beeblackVariante)) falta('falta la variante BEEBLACK');

      // ── Oscuridad: perfiles sin superficie o sin perforación ──
      // Se usa el MISMO despiece que el Excel de órdenes, para que el gate y sus
      // advertencias nunca discrepen (excel-ordenes.ts, bloque de PERF).
      const fam = familiaOscuridad(categoria, p.cenefa as string | undefined, reglas.tipos);
      if (fam && v.modelo && ancho > 0) {
        const ctx = contextoDespieceDesdePano(
          v as Parameters<typeof contextoDespieceDesdePano>[0],
          p as Parameters<typeof contextoDespieceDesdePano>[1],
          { formulas, tipos: reglas.tipos },
        );
        const d = calcularDespiece(v.modelo as ModeloDespiece, ancho * 100, ctx);
        for (const c of d.cortes) {
          const esSeparador = c.columnaExcel.startsWith('SEPARADOR');
          // Mismo criterio de "esto es un perfil" que el Excel de órdenes:
          // las 3 columnas con perforación + los separadores.
          if (!esSeparador && !COLUMNAS_PERFIL.has(c.columnaExcel)) continue;
          if (c.pendienteMedida) {
            falta(
              esSeparador
                ? `${c.componente}: falta la medida`
                : `${c.componente}: falta la instalación (muro/piso/marco)`,
            );
          }
          if (!esSeparador && !c.perforacion) falta(`${c.componente}: falta la perforación (int/ext)`);
        }
      }
    });
  }

  return out;
}

/** Resumen "3 pendientes en 2 ventanas" para el toast del Panel. */
export function resumenPendientes(pendientes: PendienteFase2[]): string {
  const ventanas = new Set(pendientes.map((p) => String(p.ventanaId))).size;
  const n = pendientes.length;
  return `${n} ${n === 1 ? 'dato pendiente' : 'datos pendientes'} en ${ventanas} ${
    ventanas === 1 ? 'ventana' : 'ventanas'
  }`;
}

/** Agrupa los pendientes por ventana, en el orden en que aparecen. */
export function pendientesPorVentana(
  pendientes: PendienteFase2[],
): { ventanaId: string | number; ubicacion: string; items: PendienteFase2[] }[] {
  const mapa = new Map<string, { ventanaId: string | number; ubicacion: string; items: PendienteFase2[] }>();
  for (const p of pendientes) {
    const k = String(p.ventanaId);
    if (!mapa.has(k)) mapa.set(k, { ventanaId: p.ventanaId, ubicacion: p.ubicacion, items: [] });
    mapa.get(k)!.items.push(p);
  }
  return [...mapa.values()];
}
