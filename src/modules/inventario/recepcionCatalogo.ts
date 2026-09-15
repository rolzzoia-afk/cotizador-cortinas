// ─────────────────────────────────────────────────────────────────────
// Recibir SIN orden de compra (solo un administrador): cada línea del papel
// contra el catálogo entero, con las mismas reglas que contra la orden —
// código nuestro, código del proveedor, lo aprendido y, al final, la
// descripción parecida como PROPUESTA.
// ─────────────────────────────────────────────────────────────────────

import type { DominioCompra } from './compras';
import {
  buscarAprendida,
  lineaBase,
  marcarDuplicadas,
  UMBRAL_DESCRIPCION,
  type Aprendida,
  type LineaExtraida,
  type LineaRevision,
} from './recepcionFactura';
import { codigoNeutro, esCargo, normalizarCodigo, pareceTela, similitud } from './recepcionTexto';

export type ArticuloCatalogo = {
  dominio: DominioCompra;
  cod: string;
  nombre: string;
  cod_proveedor?: string | null;
  descriptor_proveedor?: string | null;
  can_x_paquete?: number | null;
};

/** El factor que se propone: el contenido del paquete, si calza con el del catálogo. */
function factorPropuesto(x: LineaExtraida, a: ArticuloCatalogo): number {
  const p = Number(x.unidades_por_paquete);
  const c = Number(a.can_x_paquete);
  return p > 1 && c > 1 && p === c ? c : 1;
}

/** Los artículos del catálogo que más se parecen a un texto, el mejor primero. */
export function candidatosCatalogo(
  texto: string,
  catalogo: ArticuloCatalogo[],
  max = 6,
  dominioPreferido?: DominioCompra | null,
): Array<{ articulo: ArticuloCatalogo; puntaje: number }> {
  const q = texto.trim();
  if (!q) return [];
  const c = normalizarCodigo(q);
  return catalogo
    .map((a) => {
      let s = 0;
      if (normalizarCodigo(a.cod) === c) s = 1.5;
      else if (a.cod_proveedor && normalizarCodigo(a.cod_proveedor) === c) s = 1.4;
      else if (c.length >= 2 && normalizarCodigo(a.cod).includes(c)) s = 1.1;
      else s = Math.max(similitud(q, a.nombre), a.descriptor_proveedor ? similitud(q, a.descriptor_proveedor) : 0);
      if (s > 0 && dominioPreferido && a.dominio === dominioPreferido) s += 0.1;
      return { articulo: a, puntaje: Math.round(s * 1000) / 1000 };
    })
    .filter((x) => x.puntaje >= 0.3)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, max);
}

/**
 * Sin orden (solo admin): cada línea del papel contra el catálogo entero, con
 * las mismas reglas. Las parecidas quedan como propuesta.
 */
export function emparejarConCatalogo(
  extraidas: LineaExtraida[],
  catalogo: ArticuloCatalogo[],
  aprendidas: Aprendida[] = [],
  rutFactura?: string | null,
): LineaRevision[] {
  return marcarDuplicadas(
    extraidas.map((x, i) => {
      const r = lineaBase(x, i);
      if (esCargo(x)) return { ...r, accion: 'excluir' as const, motivo_exclusion: 'no_inventario' as const };
      if (!codigoNeutro(x.codigo)) {
        const c = normalizarCodigo(x.codigo);
        const interno = catalogo.find((a) => normalizarCodigo(a.cod) === c);
        if (interno) {
          return { ...r, dominio: interno.dominio, item_cod: interno.cod, factor: factorPropuesto(x, interno), vinculo: 'interno' as const };
        }
        const prov = catalogo.find((a) => a.cod_proveedor && normalizarCodigo(a.cod_proveedor) === c);
        if (prov) {
          return { ...r, dominio: prov.dominio, item_cod: prov.cod, factor: factorPropuesto(x, prov), vinculo: 'codigo' as const };
        }
      }
      const ap = buscarAprendida(x, aprendidas, rutFactura);
      if (ap) return { ...r, dominio: ap.dominio, item_cod: ap.item_cod, factor: ap.factor || 1, vinculo: 'aprendida' as const };
      const [mejor] = candidatosCatalogo(x.descripcion, catalogo, 1, pareceTela(x.descripcion) ? 'tela' : 'insumo');
      if (mejor && mejor.puntaje >= UMBRAL_DESCRIPCION) {
        return {
          ...r,
          dominio: mejor.articulo.dominio,
          item_cod: mejor.articulo.cod,
          factor: factorPropuesto(x, mejor.articulo),
          vinculo: 'descripcion' as const,
          confianza: Math.min(1, mejor.puntaje),
        };
      }
      return r;
    }),
  );
}
