// ─────────────────────────────────────────────────────────────────────
// REPLICAR LA CONFIGURACIÓN de una cortina en otras.
//
// En una casa las cortinas suelen ser todas iguales salvo la medida: misma
// tela, mismo color de accesorios, mismo mecanismo, misma cenefa. Cargar eso
// ventana por ventana es el trabajo tonto del terreno.
//
// Lo que NO se copia nunca: la identidad de la ventana destino (su id, su
// ubicación, su conjunto) y las MEDIDAS de cada paño — que son justamente lo
// que se fue a medir. Todo lo demás de la ficha viaja.
// ─────────────────────────────────────────────────────────────────────
import { ajustarPanos } from '../fase2';
import type { Pano, Ventana } from '../types';

/** Campos del paño que pertenecen a ESA cortina y no se replican. */
const CAMPOS_PROPIOS_DEL_PANO = [
  'ancho',
  'alto',
  'cierreAlturaCm',
  'comentarioFinal',
  // Girar el paño depende del ancho de ESA cortina y de su conjunto: lo fuerza
  // `juntarVentanas` en los miembros y si no, lo decide el optimizador solo. Un
  // `true` heredado gana sobre esa decisión y corta rotada una cortina que no
  // lo necesita, gastando tela de más.
  'invertida',
  // Medidas de terreno de los sistemas con perfiles: son de esa ventana.
  'perfilIzqMuroCm',
  'perfilIzqPisoCm',
  'perfilIzqMarcoCm',
  'perfilDerMuroCm',
  'perfilDerPisoCm',
  'perfilDerMarcoCm',
  'perfilInfMuroCm',
  'perfilInfPisoCm',
  'perfilInfMarcoCm',
  'separadorIzqCm',
  'separadorDerCm',
  'separadorInfCm',
  'separadorSupCm',
  'beeblackPerfilSupAnchoCm',
  'beeblackPerfilInfAnchoCm',
  'beeblackPerfilLatIzqCm',
  'beeblackPerfilLatDerCm',
  'beeblackManillaIzqCm',
  'beeblackManillaDerCm',
  'beeblackAnchoTelaCm',
  'beeblackAltoTelaCm',
  'beeblackTotalLamasCm',
] as const satisfies readonly (keyof Pano)[];

/** Campos de la ventana que identifican a ESA cortina y no se replican. */
const CAMPOS_PROPIOS_DE_LA_VENTANA = [
  'id',
  'ubicacion',
  'grupoId',
  'grupoOrden',
  'alto',
  'precio',
  'subtotal',
  'panos',
  // La forma es de la ventana física, no de la ficha: replicar una bow window
  // en cortinas rectas les estamparía «BOW WINDOW» en el informe y el corte.
  'formaVentana',
  // El muro es geografía de ESA cortina: replicar la ficha de una cortina de
  // «2 ventanas» sobre otra suelta no puede arrastrarla a ese muro.
  'muroId',
  'muroTotal',
  'muroPos',
] as const satisfies readonly (keyof Ventana)[];

/** La ficha de un paño sin lo que es propio de su ventana. */
function fichaDelPano(p: Pano): Partial<Pano> {
  const out: Record<string, unknown> = { ...p };
  for (const k of CAMPOS_PROPIOS_DEL_PANO) delete out[k];
  return out as Partial<Pano>;
}

/**
 * Copia la configuración de `origen` sobre `destino`, conservando la identidad
 * y las medidas del destino.
 *
 * Los paños se emparejan por posición. Si el destino tiene menos paños que el
 * origen, se completan con la ficha del origen (medidas en blanco: hay que
 * medirlas); si tiene más, los de sobra conservan la ficha del ÚLTIMO paño del
 * origen, que es lo que uno esperaría de "todas iguales".
 */
export function replicarConfiguracion(origen: Ventana, destino: Ventana): Ventana {
  const propiosVentana: Record<string, unknown> = {};
  for (const k of CAMPOS_PROPIOS_DE_LA_VENTANA) propiosVentana[k] = destino[k];

  const nPanos = Math.max(1, destino.panos?.length || 1);
  const panosDestino = ajustarPanos(destino.panos ?? [], nPanos);
  const panos = panosDestino.map((pd, i) => {
    const po = origen.panos?.[Math.min(i, (origen.panos?.length ?? 1) - 1)];
    if (!po) return pd;
    const propios: Record<string, unknown> = {};
    for (const k of CAMPOS_PROPIOS_DEL_PANO) propios[k] = pd[k];
    return { ...pd, ...fichaDelPano(po), ...propios } as Pano;
  });

  return { ...destino, ...origen, ...propiosVentana, panos } as Ventana;
}

/** Aplica la replicación a varias ventanas de la OT de una sola vez. */
export function replicarEnVentanas(
  ventanas: Ventana[],
  origen: Ventana,
  idsDestino: ReadonlyArray<string | number>,
): Ventana[] {
  const destinos = new Set(idsDestino.map(String));
  return ventanas.map((v) =>
    destinos.has(String(v.id)) && String(v.id) !== String(origen.id)
      ? replicarConfiguracion(origen, v)
      : v,
  );
}
