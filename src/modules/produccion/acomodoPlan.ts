// ─────────────────────────────────────────────────────────────────────
// El acomodo optimizado del Plan de Corte, traducido al dibujo de la pizarra.
//
// El Plan de Corte (planCorte.ts) empaca las piezas en 2D: apila cortinas
// chicas en columnas al lado de las grandes cuando eso baja menos rollo. Este
// módulo traduce ese layout al formato `PanoDibujado` que ya dibuja
// PanosDelRollo, para que el Dimensionado lo muestre al lado de la pizarra
// clásica y el taller VEA cuánta tela ahorra el acomodo.
//
// Los grupos se rotulan R1, R2… (una bajada de rollo por tela) a propósito:
// NO son los paños A, B, C de la hoja de corte ni de las etiquetas. La cuenta
// «qué se corta junto» (panoDeCadaFila) sigue mandando en el papel del taller;
// este dibujo es la propuesta del optimizador, no la orden de corte.
//
// Módulo PURO (sin React ni Supabase).
// ─────────────────────────────────────────────────────────────────────
import type { Plan } from '@/modules/cotizador/planCorte';
import { medidasFicha, secuenciaCortes } from '@/modules/cotizador/planCorte';
import {
  panosFisicos,
  type PanoDibujado,
  type PiezaDibujada,
} from '@/modules/cotizador/layoutPano';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from '@/modules/cotizador/parametrosCorte';
import { libresClasificados, salidasDeRollo } from './salidasCorte';

/**
 * Un `PanoDibujado` por cada bajada de rollo del plan, con las piezas donde
 * el empacador 2D las puso (px/py reales, apiladas incluidas).
 *
 * Las medidas son las del plan: ancho con la limpieza de bordes y alto con el
 * extra del tipo de cortina — por eso una cortina de 180 acá dice 184.
 * Solo los grupos de ROLLO: con la colmena apagada el plan corta todo de
 * rollo nuevo, y este dibujo compara acomodos, no orígenes.
 */
export function panosDelPlan(
  plan: Plan,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  productoDe?: Map<string, string>,
): PanoDibujado[] {
  return plan.rollo.map((g, i) => {
    const puestas = [...g.placed]
      .filter((r) => !r.failed)
      .sort((a, b) => a.py - b.py || a.px - b.px);
    // El acomodo no gira nada: la que va acostada es la que la FICHA trae
    // invertida, y sus medidas se muestran como se vendieron (`medidasFicha`).
    const piezas: PiezaDibujada[] = puestas.map((r) => {
      const m = medidasFicha(r);
      return {
        nombre: r.nombre,
        anchoCm: m.anchoCm,
        altoCorteCm: m.altoCm,
        invertida: r.invertida,
        px: r.px,
        py: r.py,
        pw: r.pw,
        ph: r.ph,
        lamas: null,
      };
    });
    // La franja del costado, con la misma clasificación que registra el
    // «Cerrar el corte» (salidasDeRollo). La faja de abajo no se dibuja: el
    // plan baja el alto justo y ahí suele quedar en cero.
    const tira = salidasDeRollo(g, params).find((s) => s.detalle === 'franja_rollo') ?? null;
    return {
      pano: i + 1,
      letra: `R${i + 1}`,
      codInt: g.codInt,
      producto: productoDe?.get(g.codInt) ?? g.codInt,
      anchoRolloCm: g.anchoCorte,
      altoPanoCm: g.altoCorte,
      piezas,
      cortes: secuenciaCortes(puestas, g.anchoUtil, g.altoUtil),
      colmena: '',
      esVertical: false,
      sobrante: tira
        ? { anchoCm: tira.ancho, altoCm: tira.alto, clase: tira.clase, funcional: tira.funcional }
        : null,
      // En un acomodo apilado la tela libre no es solo la franja del costado:
      // también queda al lado de las bandas más angostas. Todo se cuenta.
      libres: libresClasificados(puestas, g.anchoUtil, g.altoUtil, params),
    };
  });
}

/**
 * Un `PanoDibujado` por cada PAÑO DE COLMENA que el plan consume, con su medida
 * real y las cortinas donde el empacador las puso.
 *
 * El dimensionador tiene que ver el trozo tal como está en el rack —«219×200 en
 * MAPA M1-20»— y no un tiro de rollo de 300 de ancho: la tela ya está cortada y
 * de ella salen estas cortinas y nada más. Se rotulan C1, C2… para no chocar
 * con las letras de «cortar junto» del papel del taller.
 */
export function panosDeColmena(
  plan: Plan,
  _params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  productoDe?: Map<string, string>,
  /**
   * Cómo se rotula cada cortina en el cajón. El plan multi-OT las nombra
   * «OT3215·PPAL» y la pizarra del lote «3215·PPAL»: en la misma pantalla
   * tienen que leerse igual.
   */
  rotulo?: (nombre: string) => string,
): PanoDibujado[] {
  return plan.sobrantes.map((g, i) => {
    const puestas = [...g.placed]
      .filter((r) => !r.failed)
      .sort((a, b) => a.py - b.py || a.px - b.px);
    // También en el rack la única acostada es la que viene invertida de la
    // ficha: el acomodo prueba cada cortina como se vendió y nada más.
    const piezas: PiezaDibujada[] = puestas.map((r) => {
      const m = medidasFicha(r);
      return {
        nombre: rotulo ? rotulo(r.nombre) : r.nombre,
        anchoCm: m.anchoCm,
        altoCorteCm: m.altoCm,
        invertida: r.invertida,
        px: r.px,
        py: r.py,
        pw: r.pw,
        ph: r.ph,
        lamas: null,
      };
    });
    const ubic = g.sobrante.ubicacion || '';
    const medida = `${Math.round(g.sobrante.ancho)}X${Math.round(g.sobrante.alto)}`;
    return {
      pano: i + 1,
      letra: `C${i + 1}`,
      codInt: g.sobrante.cod,
      producto: productoDe?.get(g.sobrante.cod) ?? g.sobrante.cod,
      anchoRolloCm: g.uw,
      altoPanoCm: g.uh,
      piezas,
      cortes: g.cortes,
      colmena: ubic ? `${ubic} · ${medida}` : medida,
      esVertical: false,
      // La franja del costado de un paño no es «lo que sobra del rollo»: sale de
      // `libres`, igual que el resto de los trozos, sin privilegiar ninguno.
      sobrante: null,
      libres: g.libres,
    };
  });
}

/** Cuánto rollo baja cada acomodo, para poner el ahorro delante del taller. */
export type ResumenAcomodo = {
  /** Metros de rollo del acomodo del plan (2D). */
  mPlan: number;
  /** Metros de rollo de los tiros clásicos (una fila por tiro). */
  mClasico: number;
  /** Lo que ahorra el plan (cm); ≤ 0 cuando no hay nada que ganar. */
  ahorroCm: number;
  /** El ahorro como porcentaje del acomodo clásico. */
  pct: number;
  /** Paños físicos —trozos bajados del rollo— de cada acomodo. */
  panosPlan: number;
  panosClasico: number;
  /** Paños que el plan se ahorra; ≤ 0 cuando no baja ninguno. */
  ahorroPanos: number;
};

/**
 * La comparación se lee primero en PAÑOS: producción prefiere bajar menos
 * trozos del rollo, y el metro de tela es lo segundo.
 */
export function resumenAcomodo(
  panosPlan: PanoDibujado[],
  panosClasicos: PanoDibujado[],
): ResumenAcomodo | null {
  if (panosPlan.length === 0 || panosClasicos.length === 0) return null;
  // Los paños de colmena no bajan rollo (misma cuenta del encabezado de la pizarra).
  const cmClasico = panosClasicos.reduce((s, p) => s + (p.colmena ? 0 : p.altoPanoCm), 0);
  const cmPlan = panosPlan.reduce((s, p) => s + p.altoPanoCm, 0);
  if (cmClasico <= 0 || cmPlan <= 0) return null;
  const ahorroCm = Math.round(cmClasico - cmPlan);
  // `panosFisicos` ya salta los de colmena: no bajan rollo.
  const nPlan = panosFisicos(panosPlan);
  const nClasico = panosFisicos(panosClasicos);
  return {
    mPlan: Math.round(cmPlan) / 100,
    mClasico: Math.round(cmClasico) / 100,
    ahorroCm,
    pct: Math.round((ahorroCm / cmClasico) * 100),
    panosPlan: nPlan,
    panosClasico: nClasico,
    ahorroPanos: nClasico - nPlan,
  };
}
