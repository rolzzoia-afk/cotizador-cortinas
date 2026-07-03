// Categoría comercial de tela ('A' | 'B') por código del catálogo (planilla
// TELAS DEPURADAS). Fase 0 muestra un distintivo con las categorías presentes
// en la cotización (manual o importada desde Excel).
import type { CatalogoProductos } from './types';

/**
 * Categorías de tela presentes entre los COD_INT dados, ordenadas (A antes
 * que B). Los códigos sin categoría en el catálogo se ignoran.
 */
export function categoriasTela(
  codInts: Array<string | undefined>,
  catalogo: CatalogoProductos,
): string[] {
  const set = new Set<string>();
  for (const ci of codInts) {
    const cat = catalogo[(ci || '').trim()]?.categoria;
    if (cat) set.add(String(cat).trim().toUpperCase());
  }
  return [...set].sort();
}
