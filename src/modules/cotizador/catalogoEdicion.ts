// ─────────────────────────────────────────────────────────────────────
// Edición del catálogo del cotizador (Fase 0): crear, editar y eliminar
// códigos (COD_INT) con todos sus campos. Módulo PURO (transformaciones
// sobre el catálogo y el mapa de ancho de rollo); la persistencia vive en
// el diálogo (guardarCatalogoProductos / guardarAnchoRollo).
// ─────────────────────────────────────────────────────────────────────
import type { CatalogoProductos, Producto } from './types';

/** Normaliza un COD_INT: trim, colapsa espacios, mayúsculas (claves tipo "BK 13"). */
export const normCod = (s: unknown): string =>
  String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

export type EdicionResultado = {
  catalogo: CatalogoProductos;
  anchoRollo: Record<string, number>;
};

/**
 * Crea o actualiza un código. Si `codIntOriginal` difiere del nuevo (rename),
 * mueve la clave en el catálogo y en el mapa de ancho de rollo. Hace merge
 * sobre el producto previo (preserva campos no editados como colorGrupo).
 * No muta los originales.
 */
export function guardarProductoEnCatalogo(
  catalogo: CatalogoProductos,
  anchoActual: Record<string, number>,
  codIntOriginal: string | null,
  codIntNuevo: string,
  cambios: Producto,
  anchoRolloM: number | null,
): EdicionResultado {
  const nuevoCat: CatalogoProductos = { ...catalogo };
  const nuevoAncho: Record<string, number> = { ...anchoActual };
  const keyNueva = normCod(codIntNuevo);
  const keyOriginal = codIntOriginal ? codIntOriginal : null;

  const prev = keyOriginal ? nuevoCat[keyOriginal] : undefined;
  if (keyOriginal && keyOriginal !== keyNueva) {
    delete nuevoCat[keyOriginal];
    if (keyOriginal in nuevoAncho) {
      // el ancho viejo migra a la clave nueva salvo que venga un valor nuevo
      if (anchoRolloM == null) nuevoAncho[keyNueva] = nuevoAncho[keyOriginal];
      delete nuevoAncho[keyOriginal];
    }
  }

  nuevoCat[keyNueva] = { ...(prev ?? {}), ...cambios };
  if (anchoRolloM != null && anchoRolloM > 0) {
    nuevoAncho[keyNueva] = anchoRolloM;
    nuevoCat[keyNueva].anchoRollo = anchoRolloM;
  }
  return { catalogo: nuevoCat, anchoRollo: nuevoAncho };
}

/** Elimina un código del catálogo y del mapa de ancho de rollo (no muta). */
export function eliminarProductoDeCatalogo(
  catalogo: CatalogoProductos,
  anchoActual: Record<string, number>,
  codInt: string,
): EdicionResultado {
  const nuevoCat: CatalogoProductos = { ...catalogo };
  const nuevoAncho: Record<string, number> = { ...anchoActual };
  delete nuevoCat[codInt];
  delete nuevoAncho[codInt];
  return { catalogo: nuevoCat, anchoRollo: nuevoAncho };
}

/** Familias (COD) distintas del catálogo, orden alfabético — para el datalist. */
export function familiasDelCatalogo(catalogo: CatalogoProductos): string[] {
  return [...new Set(Object.values(catalogo).map((p) => (p.cod || '').trim()).filter(Boolean))].sort();
}

/** Tipos distintos del catálogo, orden alfabético — para el datalist. */
export function tiposDelCatalogo(catalogo: CatalogoProductos): string[] {
  return [...new Set(Object.values(catalogo).map((p) => (p.tipo || '').trim()).filter(Boolean))].sort();
}
