// ─────────────────────────────────────────────────────────────────────
// LÍNEA B (gama económica) — resolución del flag por paño.
//
// La categoría comercial de la tela ('A' | 'B') ya venía del catálogo, pero
// solo se usaba para un distintivo y para los términos. Acá pasa a decidir la
// LÍNEA DE FABRICACIÓN de cada cortina: sus kits, tubo, pesos y cenefas.
//
// El flag del paño es tri-estado, igual que `invertida`:
//   · undefined → auto por la tela del catálogo (lo normal)
//   · true/false → el operario lo forzó en la grilla o en el editor de paño
// Así una tela mal catalogada, o una cortina especial, se corrige sin tocar el
// catálogo — y el catálogo sigue mandando en todo lo demás.
//
// Módulo puro. Vive en `cotizador` (no en `descuentos`) porque necesita el
// catálogo de productos; a los resolvers de descuentos el flag les llega ya
// resuelto, como un booleano.
// ─────────────────────────────────────────────────────────────────────
import {
  REGLAS_MECANISMO,
  reglaLineaBAplicable,
  type ReglasMecanismo,
} from '@/modules/descuentos/reglas-mecanismo';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';
import type { CatalogoProductos, Pano, Ventana } from './types';

/**
 * ¿La tela de este código es de gama comercial B?
 *
 * SOLO PARA MOSTRAR. Responde por la tela y nada más: no sabe si el sistema
 * tiene herrajes de categoría B. Para decidir cómo se FABRICA una cortina —qué
 * kit, qué tubo, qué códigos— va `esLineaB`, que además exige la guarda de
 * categoría. Confundirlas hizo que un soft light con tela de gama B se guardara
 * con el tubo E01 (OT 268-3, 2026-08-07); por eso los nombres ya no se parecen.
 */
export function gamaTelaEsB(
  codInt: string | null | undefined,
  catalogo: CatalogoProductos | undefined,
): boolean {
  if (!catalogo) return false;
  const cat = catalogo[(codInt || '').trim()]?.categoria;
  return String(cat || '').trim().toUpperCase() === 'B';
}

/**
 * ¿La línea B existe para esta categoría? Hoy solo hay recetas de roller
 * simple, cenefa ovalada 38 y dúo 38. Una tela de gama B en un sistema de
 * oscuridad, un beeblack o una vertical se fabrica con los herrajes de
 * siempre: la gama de la TELA no cambia la estructura de esos sistemas.
 */
export function categoriaTieneLineaB(
  categoria: string | null | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
): boolean {
  return reglaLineaBAplicable(categoria || '', reglas, tipos) != null;
}

/**
 * Línea efectiva de un paño: lo que el operario forzó, o la categoría de su
 * tela. En las cortinas DUAL cada paño lleva su propia tela (`pano.codInt`), y
 * por eso se consulta primero; en el resto cae a la tela de la ventana.
 *
 * Con `categoria`, además exige que la línea B tenga recetas para ella (ver
 * `categoriaTieneLineaB`). Sin categoría responde solo por la tela — así lo
 * usa la grilla de Fase 1, donde el distintivo A/B es informativo.
 */
export function esLineaB(
  pano: Pick<Pano, 'lineaB' | 'codInt'> | null | undefined,
  ventanaCodInt: string | null | undefined,
  catalogo: CatalogoProductos | undefined,
  categoria?: string | null,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
): boolean {
  const deLaTela =
    typeof pano?.lineaB === 'boolean'
      ? pano.lineaB
      : gamaTelaEsB(pano?.codInt || ventanaCodInt, catalogo);
  if (!deLaTela) return false;
  return categoria === undefined || categoria === null
    ? true
    : categoriaTieneLineaB(categoria, reglas, tipos);
}

/** Línea efectiva de cada paño de una ventana, en el mismo orden que `panos`. */
export function lineaBPorPano(
  ventana: Pick<Ventana, 'codInt' | 'panos' | 'categoria'> | null | undefined,
  catalogo: CatalogoProductos | undefined,
  reglas: ReglasMecanismo = REGLAS_MECANISMO,
  tipos?: readonly TipoCortina[],
): boolean[] {
  return (ventana?.panos || []).map((p) =>
    esLineaB(p, ventana?.codInt, catalogo, ventana?.categoria, reglas, tipos),
  );
}
