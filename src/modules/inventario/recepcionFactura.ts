// ─────────────────────────────────────────────────────────────────────
// Lo que la app leyó del papel, y a qué corresponde cada línea.
//
// La lectura la hace la función `escanear-factura` (Claude mira el PDF o la
// foto y devuelve un JSON SIN PRECIOS: el esquema no tiene dónde ponerlos).
// El emparejado NO se le pide al modelo: se hace acá, con reglas que se pueden
// probar, en este orden de confianza:
//
//   1. el papel trae NUESTRO código            → «por el código de la orden»
//   2. trae el código del proveedor de la orden → «por el código del proveedor»
//   3. ya se aprendió en una recepción anterior → «aprendido de antes»
//   4. la descripción se parece (≥ 50 %)        → PROPUESTA, hay que mirarla
//   5. nada                                     → «¿cuál?»: lo decide la persona
//
// FLETE, DESPACHO y similares no son inventario: salen marcados para no
// recibirlos.
// ─────────────────────────────────────────────────────────────────────

import {
  normalizarRut,
  pendienteDeLinea,
  type DominioCompra,
  type LineaOrden,
  type OrdenCompra,
} from './compras';
import type { MotivoExclusion, TipoDocumento, Vinculo } from './recepcion';
import { codigoNeutro, esCargo, normalizarCodigo, similitud } from './recepcionTexto';

// ── La lectura (espejo del esquema de `escanear-factura/esquema.ts`) ─

export type TipoLeido = 'factura' | 'guia' | 'boleta' | 'nota_credito' | 'otro';

export type LineaExtraida = {
  posicion: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number | null;
  unidad: string | null;
  unidades_por_paquete: number | null;
  es_cargo: boolean;
};

export type ExtraccionFactura = {
  es_documento: boolean;
  motivo_no_documento: string | null;
  proveedor: { nombre: string | null; rut: string | null };
  documento: {
    tipo: TipoLeido;
    numero: string | null;
    fecha: string | null;
    orden_compra_ref: string | null;
  };
  lineas: LineaExtraida[];
  advertencias: string[];
};

export type CabeceraDocumento = {
  tipo: TipoDocumento;
  numero: string;
  fecha: string;
  rut: string;
  nombre: string;
};

/** La cabecera que se propone, lista para corregir. */
export function cabeceraDesdeExtraccion(
  ext: ExtraccionFactura | null,
  orden: OrdenCompra | null,
): CabeceraDocumento {
  const tipo: TipoDocumento =
    ext?.documento.tipo === 'factura' ? 'factura' : ext?.documento.tipo === 'guia' ? 'guia' : ext ? 'otro' : 'factura';
  return {
    tipo,
    numero: String(ext?.documento.numero ?? '').trim(),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(ext?.documento.fecha ?? '')) ? String(ext?.documento.fecha) : '',
    rut: String(ext?.proveedor.rut ?? orden?.proveedor_rut ?? '').trim(),
    nombre: String(ext?.proveedor.nombre ?? orden?.proveedor_nombre ?? '').trim(),
  };
}

/** Lo que conviene mirar de la cabecera antes de seguir. No bloquea. */
export function avisosDeCabecera(
  cab: CabeceraDocumento,
  ext: ExtraccionFactura | null,
  orden: OrdenCompra | null,
): string[] {
  const avisos: string[] = [];
  if (ext && !ext.es_documento) {
    avisos.push(
      `Esto no parece una factura ni una guía${ext.motivo_no_documento ? `: ${ext.motivo_no_documento}` : ''}.`,
    );
  }
  if (ext?.documento.tipo === 'nota_credito') {
    avisos.push('Es una nota de crédito: no trae mercadería. Revisa con Gerencia antes de recibirla.');
  }
  const rf = normalizarRut(cab.rut);
  const ro = normalizarRut(orden?.proveedor_rut);
  if (orden && rf && ro && rf !== ro) {
    avisos.push(`El RUT del papel (${cab.rut}) no es el de la orden (${orden.proveedor_rut}).`);
  }
  const ref = String(ext?.documento.orden_compra_ref ?? '').replace(/\D/g, '');
  const num = String(orden?.numero ?? '').replace(/\D/g, '');
  if (orden && ref && num && ref !== num) {
    avisos.push(`El papel menciona la orden ${ext?.documento.orden_compra_ref} y estás recibiendo ${orden.numero}.`);
  }
  for (const a of ext?.advertencias ?? []) avisos.push(`La lectura avisa: ${a}`);
  return avisos;
}

// ── Una línea del papel, revisada ────────────────────────────────────

export type LineaRevision = {
  key: string;
  posicion: number;
  codigo: string;
  descripcion: string;
  /** Lo facturado, en la unidad de la orden. `null` = la lectura no la vio. */
  cantidad: number | null;
  unidad: string | null;
  paquete: number | null;
  accion: 'recibir' | 'excluir';
  motivo_exclusion: MotivoExclusion | null;
  orden_linea_id: string | null;
  dominio: DominioCompra | null;
  item_cod: string | null;
  factor: number;
  vinculo: Vinculo | null;
  /** Solo en las propuestas por descripción: cuánto se parecen (0 a 1). */
  confianza: number | null;
  /** Dos líneas del papel apuntan a la misma de la orden. */
  duplicada: boolean;
};

export type Aprendida = {
  proveedor_rut: string;
  clave_tipo: 'codigo' | 'descripcion';
  clave: string;
  dominio: DominioCompra;
  item_cod: string;
  factor: number | null;
};

/** Umbral para PROPONER por descripción. Nunca se confirma solo. */
export const UMBRAL_DESCRIPCION = 0.5;

export function lineaBase(l: LineaExtraida, i: number): LineaRevision {
  return {
    key: `f${i}`,
    posicion: l.posicion > 0 ? l.posicion : i + 1,
    codigo: String(l.codigo ?? '').trim(),
    descripcion: String(l.descripcion ?? '').trim(),
    cantidad: Number.isFinite(Number(l.cantidad)) && l.cantidad != null ? Number(l.cantidad) : null,
    unidad: l.unidad ?? null,
    paquete: l.unidades_por_paquete ?? null,
    accion: 'recibir',
    motivo_exclusion: null,
    orden_linea_id: null,
    dominio: null,
    item_cod: null,
    factor: 1,
    vinculo: null,
    confianza: null,
    duplicada: false,
  };
}

/** Lo aprendido de este proveedor que calza con la línea del papel. */
export function buscarAprendida(l: LineaExtraida, aprendidas: Aprendida[], rut: string | null | undefined): Aprendida | null {
  const r = normalizarRut(rut);
  if (!r) return null;
  const delProveedor = aprendidas.filter((a) => normalizarRut(a.proveedor_rut) === r);
  if (!codigoNeutro(l.codigo)) {
    const c = String(l.codigo ?? '').trim().toUpperCase();
    const hit = delProveedor.find((a) => a.clave_tipo === 'codigo' && a.clave.trim().toUpperCase() === c);
    if (hit) return hit;
  }
  const d = normalizarCodigo(l.descripcion);
  if (!d) return null;
  return delProveedor.find((a) => a.clave_tipo === 'descripcion' && normalizarCodigo(a.clave) === d) ?? null;
}

function apuntarAOrden(r: LineaRevision, ol: LineaOrden, vinculo: Vinculo, confianza: number | null = null): LineaRevision {
  return {
    ...r,
    orden_linea_id: ol.id,
    dominio: ol.dominio ?? null,
    item_cod: ol.item_cod ?? null,
    factor: ol.factor || 1,
    vinculo,
    confianza,
  };
}

/** Marca las líneas del papel que van a la misma línea de la orden. */
export function marcarDuplicadas(lineas: LineaRevision[]): LineaRevision[] {
  const cuenta = new Map<string, number>();
  for (const l of lineas) {
    if (l.accion === 'recibir' && l.orden_linea_id) {
      cuenta.set(l.orden_linea_id, (cuenta.get(l.orden_linea_id) ?? 0) + 1);
    }
  }
  return lineas.map((l) => ({
    ...l,
    duplicada: l.accion === 'recibir' && !!l.orden_linea_id && (cuenta.get(l.orden_linea_id) ?? 0) > 1,
  }));
}

/**
 * Empareja cada línea del papel con una línea de la orden. Primero se
 * resuelve todo lo que calza por código (seguro); recién después se proponen
 * las parecidas por descripción, prefiriendo las líneas de la orden que nadie
 * tomó todavía.
 */
export function emparejarConOrden(
  extraidas: LineaExtraida[],
  orden: OrdenCompra,
  aprendidas: Aprendida[] = [],
  rutFactura?: string | null,
): LineaRevision[] {
  const candidatas = (orden.lineas ?? []).filter((l) => l.estado_linea !== 'cancelada');
  const tomadas = new Set<string>();
  const rut = rutFactura || orden.proveedor_rut;

  const primera = extraidas.map((x, i) => {
    const r = lineaBase(x, i);
    if (esCargo(x)) return { ...r, accion: 'excluir' as const, motivo_exclusion: 'no_inventario' as const };
    if (!codigoNeutro(x.codigo)) {
      const c = normalizarCodigo(x.codigo);
      const interno = candidatas.find(
        (l) => (l.codigo_interno && normalizarCodigo(l.codigo_interno) === c) || (l.item_cod && normalizarCodigo(l.item_cod) === c),
      );
      if (interno) {
        tomadas.add(interno.id);
        return apuntarAOrden(r, interno, 'interno');
      }
      const prov = candidatas.find((l) => l.codigo_proveedor && normalizarCodigo(l.codigo_proveedor) === c);
      if (prov) {
        tomadas.add(prov.id);
        return apuntarAOrden(r, prov, 'codigo');
      }
    }
    const ap = buscarAprendida(x, aprendidas, rut);
    if (ap) {
      const enOrden = candidatas.find((l) => l.item_cod && normalizarCodigo(l.item_cod) === normalizarCodigo(ap.item_cod));
      if (enOrden) {
        tomadas.add(enOrden.id);
        return apuntarAOrden(r, enOrden, 'aprendida');
      }
      // Se sabe qué artículo es, pero la orden no lo trae: entra como
      // «facturado y no pedido».
      return { ...r, dominio: ap.dominio, item_cod: ap.item_cod, factor: ap.factor || 1, vinculo: 'aprendida' as const };
    }
    return r;
  });

  const segunda = primera.map((r, i) => {
    if (r.accion === 'excluir' || r.orden_linea_id || r.item_cod) return r;
    const x = extraidas[i];
    // La descripción sola, y también con los códigos: el proveedor a veces
    // escribe su código dentro de la descripción, y a veces no. Meter siempre
    // los códigos diluiría el parecido de las que no lo traen.
    const conCodigo = `${x.descripcion} ${codigoNeutro(x.codigo) ? '' : (x.codigo ?? '')}`;
    let mejor: { l: LineaOrden; s: number; libre: boolean } | null = null;
    for (const l of candidatas) {
      const s = Math.max(
        similitud(x.descripcion, l.descripcion ?? ''),
        similitud(conCodigo, `${l.descripcion ?? ''} ${l.codigo_proveedor ?? ''} ${l.codigo_interno ?? ''}`),
      );
      const libre = !tomadas.has(l.id);
      if (s < UMBRAL_DESCRIPCION) continue;
      if (!mejor || (libre && !mejor.libre) || (libre === mejor.libre && s > mejor.s)) mejor = { l, s, libre };
    }
    if (!mejor) return r;
    tomadas.add(mejor.l.id);
    return apuntarAOrden(r, mejor.l, 'descripcion', mejor.s);
  });

  return marcarDuplicadas(segunda);
}

/**
 * Sin lectura automática: una línea por cada línea pendiente de la orden, con
 * lo que falta como propuesta. Quien revisa la corrige con el papel en la mano.
 */
export function lineasDesdeOrden(orden: OrdenCompra): LineaRevision[] {
  return (orden.lineas ?? [])
    .filter((l) => (l.estado_linea === 'pendiente' || l.estado_linea === 'parcial') && pendienteDeLinea(l) > 0)
    .map((l, i) =>
      apuntarAOrden(
        {
          ...lineaBase(
            { posicion: i + 1, codigo: l.codigo_proveedor ?? l.codigo_interno ?? null, descripcion: l.descripcion ?? '', cantidad: pendienteDeLinea(l), unidad: l.unidad ?? null, unidades_por_paquete: null, es_cargo: false },
            i,
          ),
          key: `o${i}`,
        },
        l,
        // «interno» y no «manual»: nadie eligió nada, y lo manual se aprende
        // como código del proveedor.
        'interno',
      ),
    );
}

// ── Antes de guardar ─────────────────────────────────────────────────

/** Lo que impide guardar la revisión. Vacío = se puede. */
export function problemasDeRevision(lineas: LineaRevision[], orden: OrdenCompra | null): string[] {
  if (lineas.length === 0) return ['El documento no tiene ninguna línea. Agrega al menos una.'];
  const porId = new Map((orden?.lineas ?? []).map((l) => [l.id, l]));
  const fuera: string[] = [];
  for (const l of lineas) {
    if (l.accion === 'excluir') continue;
    const nombre = `Línea ${l.posicion}${l.descripcion ? ` «${l.descripcion.slice(0, 40)}»` : ''}`;
    if (l.orden_linea_id) {
      const ol = porId.get(l.orden_linea_id);
      if (!ol) fuera.push(`${nombre}: la línea de la orden ya no existe. Vuelve a elegirla.`);
      else if (!ol.item_cod || !ol.dominio) {
        fuera.push(`${nombre}: la línea ${ol.posicion} de la orden no tiene artículo. Vincúlala en la ficha de la orden.`);
      }
    } else if (!l.item_cod || !l.dominio) {
      fuera.push(`${nombre}: elige a qué corresponde, o márcala como que no se recibe.`);
    }
    if (l.cantidad == null || !(l.cantidad > 0)) fuera.push(`${nombre}: falta la cantidad facturada.`);
  }
  return fuera;
}

/** Lo que viaja a `recepcion_abrir`. */
export function lineasParaAbrir(lineas: LineaRevision[]): Array<Record<string, unknown>> {
  return lineas.map((l) => ({
    posicion: l.posicion,
    codigo: l.codigo || null,
    descripcion: l.descripcion || null,
    cantidad: l.cantidad,
    unidad: l.unidad,
    paquete: l.paquete,
    accion: l.accion,
    motivo_exclusion: l.accion === 'excluir' ? l.motivo_exclusion : null,
    orden_linea_id: l.accion === 'recibir' ? l.orden_linea_id : null,
    dominio: l.accion === 'recibir' && !l.orden_linea_id ? l.dominio : null,
    item_cod: l.accion === 'recibir' && !l.orden_linea_id ? l.item_cod : null,
    factor: l.factor,
    vinculo: l.accion === 'recibir' ? l.vinculo : null,
  }));
}
