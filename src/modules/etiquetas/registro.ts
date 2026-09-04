// Todas las etiquetas que la app sabe imprimir, en un solo lugar.
//
// El editor de Admin arma su selector desde acá, y cada punto de impresión pide
// su plantilla por id. Cuando se migra una etiqueta más, se agrega su `Def` a
// este mapa y aparece sola en el editor.
import { DEF_CATALOGO } from './defaults/catalogo';
import { DEF_SOBRANTE } from './defaults/sobrante';
import type { DefEtiqueta, EtiquetaId } from './plantilla';

export const ETIQUETAS: Partial<Record<EtiquetaId, DefEtiqueta>> = {
  catalogo: DEF_CATALOGO,
  sobrante: DEF_SOBRANTE,
};

/** Las etiquetas editables, en el orden en que se muestran. */
export function etiquetasEditables(): DefEtiqueta[] {
  return Object.values(ETIQUETAS).filter((d): d is DefEtiqueta => !!d);
}

export function defDeEtiqueta(id: EtiquetaId): DefEtiqueta | undefined {
  return ETIQUETAS[id];
}

/** Agrupadas para el selector: «Telas», «Producción», «Estructura»… */
export function etiquetasPorGrupo(): { grupo: string; etiquetas: DefEtiqueta[] }[] {
  const grupos = new Map<string, DefEtiqueta[]>();
  for (const d of etiquetasEditables()) {
    const lista = grupos.get(d.grupo) ?? [];
    lista.push(d);
    grupos.set(d.grupo, lista);
  }
  return [...grupos.entries()].map(([grupo, etiquetas]) => ({ grupo, etiquetas }));
}
