// ─────────────────────────────────────────────────────────────────────
// QUÉ SE VA A CARGAR: cuántas ventanas, o qué ventana especial.
//
// En terreno el vendedor mira el muro antes de medir nada. Ahí ya sabe dos
// cosas que la app le preguntaba tarde y mal: cuántas cortinas van en esa
// ventana, y si la ventana es recta o va en ángulo. Esta pantalla es lo
// primero del flujo guiado.
//
// Las dos ramas significan cosas DISTINTAS y no hay que confundirlas:
//
//   ESTÁNDAR «3 ventanas» → 3 CORTINAS SEPARADAS en la misma ubicación. Cada
//   una tiene su tubo, su mecanismo y su medida; se cargan una tras otra
//   copiando la ficha de la primera (`ventanaHermana`).
//
//   ESPECIAL «bow window» → UNA cortina cuyos paños son las caras del ángulo.
//   Es un solo sistema, y por eso lleva el rótulo pegado: el taller tiene que
//   saber que esos 3 paños arman una sola ventana.
//
// Módulo PURO (sin React ni Supabase).
// ─────────────────────────────────────────────────────────────────────
import { ajustarPanos } from '../fase2';
import { replicarConfiguracion } from './replicar';
import type { FormaVentana, Ventana } from '../types';

export type FormaVentanaDef = {
  id: FormaVentana;
  /** Cómo se lee en la tarjeta del selector. */
  etiqueta: string;
  /** Cómo se rotula en badges, informe y dimensionado (va en mayúsculas). */
  rotulo: string;
  /** Caras del ángulo = paños de la cortina. */
  panos: number;
};

/**
 * Las formas del mockup. Si aparece una ventana que no calza en ninguna, la
 * nota del selector manda tomarla como ventana individual — mejor una cortina
 * recta bien medida que una forma inventada que nadie sabe fabricar.
 *
 * La «ventana en U» se eliminó el 2026-08-19 por orden del dueño: es lo mismo
 * que un bow window (tres caras) y tener dos nombres para lo mismo confundía.
 */
export const FORMAS_VENTANA: readonly FormaVentanaDef[] = [
  { id: 'bow', etiqueta: 'Bow window', rotulo: 'BOW WINDOW', panos: 3 },
  { id: 'ele', etiqueta: 'Ventana en L', rotulo: 'VENTANA EN L', panos: 2 },
  { id: 'triangular', etiqueta: 'Triangular', rotulo: 'TRIANGULAR', panos: 1 },
] as const;

/** Hasta acá llegan las tarjetas; de 5 en adelante se escribe la cantidad. */
export const MAX_TARJETAS_ESTANDAR = 4;

/** Tope de cortinas que el selector deja crear de una sentada. */
export const MAX_VENTANAS_ESTANDAR = 12;

export function formaDef(id: FormaVentana | null | undefined): FormaVentanaDef | null {
  return FORMAS_VENTANA.find((f) => f.id === id) ?? null;
}

/**
 * El rótulo del modelo especial, o '' si la ventana es recta.
 *
 * Único punto de verdad: lo usan el badge del panel, el chip del wizard, el
 * informe del cliente y la columna UBIC del dimensionado. Si mañana cambia el
 * texto, cambia en los cuatro lugares a la vez.
 */
export function rotuloForma(v: Pick<Ventana, 'formaVentana'> | null | undefined): string {
  return formaDef(v?.formaVentana)?.rotulo ?? '';
}

export type SeleccionVentanas =
  | { tipo: 'estandar'; cantidad: number }
  | { tipo: 'especial'; forma: FormaVentana };

export type ResultadoSeleccion = {
  /** La primera cortina, lista para abrir en el wizard. */
  ventana: Ventana;
  /** Cuántas hermanas quedan por cargar después de guardar esta. */
  hermanasPendientes: number;
};

/**
 * Aplica lo elegido sobre la cortina en blanco que creó la página.
 *
 * Las hermanas NO se crean acá: se van creando al guardar cada una, para no
 * dejar fichas vacías en la OT si el vendedor abandona a mitad de camino.
 */
export function aplicarSeleccion(base: Ventana, sel: SeleccionVentanas): ResultadoSeleccion {
  if (sel.tipo === 'especial') {
    const def = formaDef(sel.forma);
    if (!def) return { ventana: base, hermanasPendientes: 0 };
    return {
      ventana: { ...base, formaVentana: def.id, panos: ajustarPanos(base.panos ?? [], def.panos) },
      hermanasPendientes: 0,
    };
  }
  const n = Math.min(MAX_VENTANAS_ESTANDAR, Math.max(1, Math.round(sel.cantidad || 1)));
  if (n <= 1) return { ventana: base, hermanasPendientes: 0 };
  // «N ventanas» nace como un MURO persistido: aunque el vendedor navegue
  // entre las cortinas a media carga (o vuelva mañana), el dibujo sabe que
  // son N y cuál falta. La primera parte en la posición 0.
  return {
    ventana: { ...base, muroId: crypto.randomUUID(), muroTotal: n, muroPos: 0 },
    hermanasPendientes: n - 1,
  };
}

/**
 * Otra cortina igual a esta: la ficha completa del origen y las medidas en
 * blanco, que es justo lo que falta por medir.
 *
 * La usan los dos caminos que crean una cortina «a continuación» — la cadena de
 * «N ventanas» y el botón «Replicar información» del resumen —, así que copia
 * TODO lo que hace a la cortina idéntica: la cantidad de paños y la forma
 * incluidas. Un ventanal de 2 paños replicado como cortina de 1 paño no es la
 * misma cortina.
 *
 * La ubicación se asigna aparte a propósito. `replicarConfiguracion` no la
 * copia —para el caso general de replicar entre ventanas distintas eso sería un
 * error— pero acá la cortina nueva va en la MISMA ventana, así que llega
 * prellenada y el vendedor la ajusta si quiere («Living izq» / «Living der»).
 */
export function ventanaHermana(origen: Ventana): Ventana {
  const destino: Ventana = {
    ...origen,
    id: crypto.randomUUID(),
    // Nace suelta: el conjunto son cortinas invertidas que se cortan juntas,
    // algo que se decide después y no se hereda.
    grupoId: null,
    grupoOrden: 0,
    // El MURO sí se hereda (es otra cortina del mismo muro), pero SIN posición:
    // el dibujo la acomoda en el primer lugar libre, y quien necesite una
    // posición exacta la asigna después.
    muroPos: undefined,
    alto: 0,
    precio: 0,
    subtotal: undefined,
    // Paños en blanco, tantos como el origen: `replicarConfiguracion` copia la
    // ficha de cada uno y respeta la cantidad del destino.
    panos: ajustarPanos([], Math.max(1, origen.panos?.length ?? 1)),
  };
  return {
    ...replicarConfiguracion(origen, destino),
    ubicacion: origen.ubicacion,
    // Es UNA cortina. Si el origen trae un multiplicador comercial («3 iguales
    // acá»), heredarlo multiplicaría lo que se cobra: se pidieron N ventanas,
    // no N por cada una.
    cantidad: 1,
  };
}
