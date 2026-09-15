// ─────────────────────────────────────────────────────────────────────
// Qué no calza en una recepción, dicho para Gerencia.
//
// Cada línea tiene tres números, en la unidad de la orden:
//
//   pedido      lo que faltaba de la línea de la orden
//   facturado   lo que dice el papel
//   contado     lo que se contó: bueno + dañado
//
// y de compararlos salen las diferencias. Cada una lleva su gravedad —un
// ERROR hace que la recepción quede «con diferencias»; un AVISO, no— y un
// texto listo para leer, que es lo que Gerencia ve en su bandeja.
//
// Es el ESPEJO de las reglas de `recepcion_confirmar`, que es la que decide el
// resultado con los números. Si alguna vez no coinciden, manda la base: esta
// lista es la explicación, no el veredicto.
// ─────────────────────────────────────────────────────────────────────

import {
  formatearCantidad,
  normalizarRut,
  pendienteDeLinea,
  type EstadoOrden,
  type LineaOrden,
  type OrdenCompra,
} from './compras';
import {
  TEXTO_EXCLUSION,
  unidadesQueEntran,
  type LineaConteo,
  type ResultadoRecepcion,
} from './recepcion';

export type TipoDiferencia =
  | 'facturado_no_pedido'
  | 'facturado_de_mas'
  | 'facturado_de_menos'
  | 'faltante'
  | 'sobrante'
  | 'danado'
  | 'excluida'
  | 'no_identificado'
  | 'rut_distinto'
  | 'sin_orden';

export type Gravedad = 'error' | 'aviso';

export type Diferencia = {
  tipo: TipoDiferencia;
  gravedad: Gravedad;
  /** La línea de la recepción (las agregadas al contar todavía no tienen id). */
  linea_id?: string | null;
  /** La posición en el papel. */
  posicion?: number | null;
  orden_linea_id?: string | null;
  articulo?: string | null;
  esperado?: number | null;
  facturado?: number | null;
  contado?: number | null;
  nota?: string | null;
  fotos?: string[];
  /** Listo para leer: «Línea 3 «RO ROLLER…»: facturados 35, contados 30 (faltan 5).» */
  texto: string;
};

export const TITULOS_DIFERENCIA: Readonly<Record<TipoDiferencia, string>> = {
  facturado_no_pedido: 'Facturado y no pedido',
  facturado_de_mas: 'Facturado de más',
  facturado_de_menos: 'Entrega parcial',
  faltante: 'Faltante',
  sobrante: 'Sobrante',
  danado: 'Dañado',
  excluida: 'No es inventario',
  no_identificado: 'No identificado',
  rut_distinto: 'RUT distinto',
  sin_orden: 'Sin orden de compra',
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const f = (n: number) => formatearCantidad(r3(n));

/** El nombre corto de una línea del papel, para los textos. */
function nombreLinea(l: LineaConteo): string {
  const base = String(l.fact_descripcion || l.fact_codigo || l.item_cod || '').trim();
  const corto = base.length > 60 ? `${base.slice(0, 57)}…` : base;
  if (l.origen === 'manual') return `${l.item_cod ?? 'Artículo'}${corto && corto !== l.item_cod ? ` «${corto}»` : ''}`;
  return corto ? `Línea ${l.posicion} «${corto}»` : `Línea ${l.posicion}`;
}

function articuloDeOrden(ol: LineaOrden): string {
  return `${ol.item_cod || ol.codigo_interno || ol.descripcion || 'Artículo'} (línea ${ol.posicion} de la orden)`;
}

/**
 * Todas las diferencias de una recepción, en el orden en que se leen: primero
 * lo del papel entero, después cada línea del papel, y al final lo que la
 * orden esperaba y el papel no trajo.
 *
 * `orden` es la orden como estaba AL ABRIR el conteo: lo que faltaba de cada
 * línea se mide antes de sumar lo de esta recepción.
 */
export function diferenciasDeRecepcion(
  lineas: LineaConteo[],
  orden: OrdenCompra | null,
  ruts: { rutFactura?: string | null; rutOrden?: string | null } = {},
): Diferencia[] {
  const difs: Diferencia[] = [];

  if (!orden) {
    difs.push({
      tipo: 'sin_orden',
      gravedad: 'error',
      texto: 'Se recibió sin orden de compra: la ingresó un administrador.',
    });
  }

  const rf = normalizarRut(ruts.rutFactura);
  const ro = normalizarRut(ruts.rutOrden ?? orden?.proveedor_rut);
  if (orden && rf && ro && rf !== ro) {
    difs.push({
      tipo: 'rut_distinto',
      gravedad: 'error',
      texto: `El RUT del documento (${ruts.rutFactura}) no es el de la orden (${ruts.rutOrden ?? orden.proveedor_rut}).`,
    });
  }

  const ordenadas = [...lineas].sort((a, b) => a.posicion - b.posicion);

  // ── Línea por línea del papel ──
  for (const l of ordenadas) {
    const base = {
      linea_id: l.nueva ? null : l.id,
      posicion: l.posicion,
      orden_linea_id: l.orden_linea_id,
      articulo: l.item_cod,
      nota: l.nota?.trim() || null,
      fotos: l.fotos.length > 0 ? l.fotos : undefined,
    };
    if (l.accion === 'excluir') {
      if (l.motivo_exclusion === 'no_identificado') {
        difs.push({
          ...base,
          tipo: 'no_identificado',
          gravedad: 'error',
          facturado: l.fact_cantidad,
          texto: `${nombreLinea(l)}: no se pudo identificar qué es; no entró al stock.`,
        });
      } else {
        difs.push({
          ...base,
          tipo: 'excluida',
          gravedad: 'aviso',
          facturado: l.fact_cantidad,
          texto: `${nombreLinea(l)}: ${TEXTO_EXCLUSION[l.motivo_exclusion ?? 'otro'].toLowerCase()}.`,
        });
      }
      continue;
    }

    const fact = r3(num(l.fact_cantidad));
    const buena = r3(num(l.cantidad_buena));
    const danada = r3(num(l.cantidad_danada));
    const contado = r3(buena + danada);

    if (orden && !l.orden_linea_id) {
      difs.push({
        ...base,
        tipo: 'facturado_no_pedido',
        gravedad: 'error',
        facturado: fact,
        contado,
        texto: `${nombreLinea(l)}: se recibió como ${l.item_cod ?? '—'} y la orden no lo pide.`,
      });
    }

    if (l.origen === 'manual') {
      if (contado > 0) {
        difs.push({
          ...base,
          tipo: 'sobrante',
          gravedad: 'error',
          facturado: 0,
          contado,
          texto: `${nombreLinea(l)}: llegaron ${f(contado)} que no están en el documento.`,
        });
      }
    } else if (contado < fact) {
      difs.push({
        ...base,
        tipo: 'faltante',
        gravedad: 'error',
        facturado: fact,
        contado,
        texto: `${nombreLinea(l)}: facturados ${f(fact)}, contados ${f(contado)} (faltan ${f(fact - contado)}).`,
      });
    } else if (contado > fact) {
      difs.push({
        ...base,
        tipo: 'sobrante',
        gravedad: 'error',
        facturado: fact,
        contado,
        texto: `${nombreLinea(l)}: facturados ${f(fact)}, contados ${f(contado)} (sobran ${f(contado - fact)}).`,
      });
    }

    if (danada > 0) {
      difs.push({
        ...base,
        tipo: 'danado',
        gravedad: 'error',
        facturado: fact,
        contado,
        texto: `${nombreLinea(l)}: ${f(danada)} ${
          danada === 1 ? 'llegó dañado y no entró al stock' : 'llegaron dañados y no entraron al stock'
        }.`,
      });
    }
  }

  // ── Lo facturado contra lo que faltaba de la orden ──
  if (orden) {
    const facturadoPorLinea = new Map<string, number>();
    for (const l of lineas) {
      if (l.accion !== 'recibir' || l.origen !== 'factura' || !l.orden_linea_id) continue;
      facturadoPorLinea.set(
        l.orden_linea_id,
        r3((facturadoPorLinea.get(l.orden_linea_id) ?? 0) + num(l.fact_cantidad)),
      );
    }
    for (const ol of [...(orden.lineas ?? [])].sort((a, b) => a.posicion - b.posicion)) {
      const pedido = pendienteDeLinea(ol);
      const facturado = facturadoPorLinea.get(ol.id);
      const abierta = ol.estado_linea === 'pendiente' || ol.estado_linea === 'parcial';
      const base = { orden_linea_id: ol.id, articulo: ol.item_cod ?? ol.codigo_interno ?? null, esperado: pedido };
      if (facturado != null && facturado > pedido) {
        difs.push({
          ...base,
          tipo: 'facturado_de_mas',
          gravedad: 'error',
          facturado,
          texto: `${articuloDeOrden(ol)}: se facturaron ${f(facturado)} y faltaban ${f(pedido)}.`,
        });
      } else if (abierta && pedido > 0 && (facturado ?? 0) < pedido) {
        difs.push({
          ...base,
          tipo: 'facturado_de_menos',
          gravedad: 'aviso',
          facturado: facturado ?? 0,
          texto:
            facturado == null
              ? `${articuloDeOrden(ol)}: no viene en este documento; siguen faltando ${f(pedido)}.`
              : `${articuloDeOrden(ol)}: se facturaron ${f(facturado)} de ${f(pedido)} que faltaban (entrega parcial).`,
        });
      }
    }
  }

  return difs;
}

/** Espejo de cómo decide la base el resultado. */
export function resultadoDeDiferencias(difs: Diferencia[], hayOrden: boolean): ResultadoRecepcion {
  if (!hayOrden) return 'sin_orden';
  return difs.some((d) => d.gravedad === 'error') ? 'con_diferencias' : 'ok';
}

export type ResumenConteo = {
  /** Líneas con algo contado. */
  lineas: number;
  /** Lo que entra al stock, por dominio: unidades en insumos, metros en telas. */
  unidadesInsumo: number;
  metrosTela: number;
  conDanados: number;
  errores: number;
  avisos: number;
  /** Cómo queda la orden después de confirmar. `null` sin orden. */
  estadoOrden: EstadoOrden | null;
};

/**
 * Lo que va a pasar al confirmar, dicho antes. Solo lo BUENO descuenta lo que
 * falta de la orden: una línea que llegó dañada sigue abierta.
 */
export function resumenConteo(
  lineas: LineaConteo[],
  orden: OrdenCompra | null,
  difs: Diferencia[] = [],
): ResumenConteo {
  let n = 0;
  let unidadesInsumo = 0;
  let metrosTela = 0;
  let conDanados = 0;
  const buenaPorLinea = new Map<string, number>();

  for (const l of lineas) {
    if (l.accion !== 'recibir') continue;
    const buena = num(l.cantidad_buena);
    const danada = num(l.cantidad_danada);
    if (buena > 0 || danada > 0) n++;
    if (danada > 0) conDanados++;
    const u = unidadesQueEntran(l);
    if (l.dominio === 'tela') metrosTela += u;
    else unidadesInsumo += u;
    if (l.orden_linea_id) {
      buenaPorLinea.set(l.orden_linea_id, (buenaPorLinea.get(l.orden_linea_id) ?? 0) + buena);
    }
  }

  let estadoOrden: EstadoOrden | null = null;
  if (orden) {
    let abiertas = 0;
    let conAlgo = 0;
    for (const ol of orden.lineas ?? []) {
      const recibida = r3(num(ol.cantidad_recibida) + (buenaPorLinea.get(ol.id) ?? 0));
      const sigueAbierta =
        (ol.estado_linea === 'pendiente' || ol.estado_linea === 'parcial') &&
        recibida < num(ol.cantidad_pedida);
      if (sigueAbierta) abiertas++;
      if (recibida > 0) conAlgo++;
    }
    estadoOrden = abiertas === 0 ? 'recibida' : conAlgo > 0 ? 'recibida_parcial' : orden.estado;
  }

  return {
    lineas: n,
    unidadesInsumo: r3(unidadesInsumo),
    metrosTela: r3(metrosTela),
    conDanados,
    errores: difs.filter((d) => d.gravedad === 'error').length,
    avisos: difs.filter((d) => d.gravedad === 'aviso').length,
    estadoOrden,
  };
}
