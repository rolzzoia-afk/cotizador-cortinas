// ─────────────────────────────────────────────────────────────────────
// LA FOTO DE LA TELA que va en el informe de visita — de dónde sale.
//
// Hay dos lugares donde una tela puede tener foto, y los dos valen:
//   1. La FICHA del catálogo de productos (Admin → Precios → Catálogo de
//      productos, al editar el código): la lámina con nombre, gama y ancho.
//      Es la que el correo COTIZACIÓN FINAL pega en cada habitación.
//   2. La foto del inventario de telas (Telas → Catálogo → «Foto de la tela»,
//      `telas_catalogo.foto_url`): la que el vendedor le saca al rollo.
// La ficha manda; si el código no tiene, se usa la del inventario. Antes solo
// contaba la ficha y subir la foto en Telas no cambiaba nada en el informe —
// que es justo lo que el dueño esperaba que pasara (2026-08-21).
//
// Este archivo es puro (sin Supabase): la carga vive en fotosTelasStore.ts.
// ─────────────────────────────────────────────────────────────────────
import type { CatalogoProductos } from '@/modules/cotizador/types';

/** Foto por código del inventario de telas, con la clave ya normalizada. */
export type FotosTelas = Record<string, string>;

/**
 * Clave con la que se comparan los códigos: «bk 24», «BK  24» y «BK 24» son
 * la misma tela. Misma normalización que el COD_INT del catálogo de productos.
 */
export const claveTela = (s: unknown): string =>
  String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Arma el mapa código → foto a partir de las filas del inventario de telas. */
export function mapaFotosTelas(
  filas: ReadonlyArray<{ codigo: string | null; foto_url: string | null }>,
): FotosTelas {
  const out: FotosTelas = {};
  for (const f of filas) {
    const k = claveTela(f.codigo);
    const url = String(f.foto_url ?? '').trim();
    // La primera fila con foto gana: un código repetido en el inventario no
    // pisa la foto que ya se eligió.
    if (k && url && !out[k]) out[k] = url;
  }
  return out;
}

/**
 * La cortina VERTICAL de una tela usa el código de su roller con el sufijo
 * «-V» (SC 93-V es la vertical de SC 93): es la MISMA tela, así que si la
 * vertical no tiene foto propia vale la de su tela base.
 */
export const claveTelaBase = (s: unknown): string => claveTela(s).replace(/-V$/, '');

/**
 * La función `fotoDeTela` que consume `esqueletoInforme`: ficha del catálogo
 * primero, foto del inventario de respaldo; si el código exacto no tiene
 * ninguna y es una vertical («-V»), las de su tela base. `undefined` si no hay
 * nada (esa habitación va sin imagen; nunca se inventa una).
 */
export function resolverFotoTela(
  catalogo: CatalogoProductos,
  fotosTelas: FotosTelas = {},
): (codInt: string) => string | undefined {
  const buscar = (clave: string): string | undefined =>
    (catalogo[clave]?.foto || fotosTelas[clave]) || undefined;
  return (codInt) => {
    const exacta = (catalogo[codInt.trim()] ?? catalogo[claveTela(codInt)])?.foto;
    if (exacta) return exacta;
    const clave = claveTela(codInt);
    const deInventario = fotosTelas[clave];
    if (deInventario) return deInventario;
    const base = claveTelaBase(codInt);
    return base !== clave ? buscar(base) : undefined;
  };
}
