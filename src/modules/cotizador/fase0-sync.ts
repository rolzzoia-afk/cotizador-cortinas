// Mapeo de datos guardados en Fase 0 hacia campos del paño en Fase 2.

// Solo rellena campos vacíos para no pisar ediciones manuales de terreno.

import type { AdicionalFase0Persistido } from '@/modules/ots/types';

import {
  buscarAdicionalCenefaEnUbic,
  candidatosCenefaEnUbic,
  cenefaAdicionalEsDelPano,
  etiquetaConTira,
  tipoCenefaDesdeAdicional,
  tiraCenefaOvalada,
  ubicPanoVentana,
} from '@/modules/descuentos/adicionales-cenefa';
import { esCategoriaBeeblack, normalizarVarianteBeeblack } from '@/modules/descuentos/reglas-beeblack';
import { categoriaEsDual } from '@/modules/descuentos/tipos';
import { chipDualPorLadoColor } from '@/modules/descuentos/chips';
import { normalizarColorAccesorio } from '@/modules/descuentos/reglas-mecanismo';
import {
  codigoMotorDesdeAdicional,
  esAdicionalHubDomotica,
  llevaCenefaOvaladaImplicita,
  manillaDesdeAdicional,
} from './insumosCortina';
import { OPCIONES_MECANISMO_DUAL } from './fase2';
import { esLineaB } from './lineaB';
import type { CatalogoProductos, Pano, Ventana } from './types';

// Clave de ubicación para el match de motor: sin espacios ni separadores, así
// "LIVING IZQ.G1" del adicional calza con "LIVING IZQ-G1" de la ventana (el
// vendedor a veces escribe punto donde va guion). Más laxa que
// `normalizarUbicacion` (cenefas), a propósito.
const claveUbicMotor = (u: string | undefined): string =>
  (u || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Modelo de motor (DOM38/DOM41) de un adicional de Fase 0 cuya ubicación calza
 * con la del paño; null si ninguno. Match ESTRICTO por ubicación (solo la
 * cortina que coincide se motoriza), robusto a separadores.
 */
export function motorAdicionalParaUbic(
  ubic: string,
  adicionales: AdicionalFase0Persistido[] | undefined,
): string | null {
  const key = claveUbicMotor(ubic);
  if (!key || !adicionales?.length) return null;
  for (const a of adicionales) {
    if (!(a.cantidad > 0)) continue;
    const modelo = codigoMotorDesdeAdicional(a.codInt);
    if (modelo && claveUbicMotor(a.ubicacion) === key) return modelo;
  }
  return null;
}

/** ¿La OT trae el hub de domótica (DOM43) entre sus adicionales de Fase 0? */
export function otTraeHubDomotica(adicionales: AdicionalFase0Persistido[] | undefined): boolean {
  return !!adicionales?.some((a) => a.cantidad > 0 && esAdicionalHubDomotica(a.codInt));
}

/**
 * Manilla (cantidad + color) de los adicionales de Fase 0 cuya ubicación calza
 * con la del paño. La cantidad del adicional va COMPLETA a su cortina; si la
 * fila lista varias ubicaciones separadas por coma, se reparte parejo entre
 * ellas (redondeo, mínimo 1). Filas de manilla a la misma ubicación se suman;
 * el color es el del primer código que calce (el paño lleva UN solo color).
 * Match por ubicación robusto a separadores (claveUbicMotor). null si ninguno.
 */
export function manillasAdicionalesParaUbic(
  ubic: string,
  adicionales: AdicionalFase0Persistido[] | undefined,
): { cantidad: number; color: string } | null {
  const key = claveUbicMotor(ubic);
  if (!key || !adicionales?.length) return null;
  let cantidad = 0;
  let color = '';
  for (const a of adicionales) {
    if (!(a.cantidad > 0)) continue;
    const man = manillaDesdeAdicional(a.codInt);
    if (!man) continue;
    const tokens = String(a.ubicacion || '')
      .split(',')
      .map((t) => claveUbicMotor(t))
      .filter(Boolean);
    if (!tokens.includes(key)) continue;
    cantidad += tokens.length > 1 ? Math.max(1, Math.round(a.cantidad / tokens.length)) : a.cantidad;
    if (!color) color = man.color;
  }
  return cantidad > 0 ? { cantidad, color } : null;
}



export function armadoDesdeSentido(sentido: string | undefined | null): string {

  const s = (sentido || '').toUpperCase();

  if (s.includes('EXTERNO')) return 'Externo';

  if (s.includes('INTERNO')) return 'Interno';

  return '';

}



/** COD del catálogo o COD_INT → SCR | BK | DU. */

export function tipoTelaDesdeProducto(

  codProducto: string | undefined | null,

  codInt?: string | null,

): string {

  const cod = (codProducto || '').toUpperCase().trim();

  if (cod.startsWith('DUOBK') || cod.startsWith('DUOPOLI') || cod.includes('DUO')) return 'DU';

  if (cod.startsWith('BLACKOUT') || cod.startsWith('BK')) return 'BK';

  if (cod.startsWith('SCREEN') || cod.startsWith('SC')) return 'SCR';



  const ci = (codInt || '').trim().toUpperCase();

  // BEEBLACK: el mosquitero (BEE-SC) hace de screen —va al vidrio— y el
  // blackout (BEE-BK) por dentro, igual que en las roller duales.
  if (ci.startsWith('BEE-SC')) return 'SCR';

  if (ci.startsWith('BEE-BK')) return 'BK';

  if (ci.startsWith('BK')) return 'BK';

  if (ci.startsWith('DU') || ci.includes('DUO')) return 'DU';

  if (ci.startsWith('SC')) return 'SCR';

  return '';

}



export function tipoTelaDesdeVentana(

  ventana: Pick<Ventana, 'codInt'>,

  catalogo?: CatalogoProductos,

): string {

  const prod = catalogo?.[ventana.codInt?.trim() || ''];

  return tipoTelaDesdeProducto(prod?.cod, ventana.codInt);

}



export function cierreDesdeDireccion(direccion: string | undefined | null): string {

  const d = (direccion || '').toUpperCase();

  if (d.includes('VERTICAL')) return 'Vertical';

  if (d.includes('MEDIO')) return 'Medio';

  if (d.includes('IZQUIERDA') || d.includes('IZQUIERDO')) return 'Izquierda';

  if (d.includes('DERECHA') || d.includes('DERECHO')) return 'Derecha';

  return '';

}

/**
 * Lado del mecanismo dual (DERECHO/IZQUIERDO) desde la dirección de cadena de
 * Fase 0. Default DERECHO (el MIXTO solo se marca a mano en Fase 2).
 */
export function dualLadoDesdeDireccion(direccion: string | undefined | null): string {
  const d = (direccion || '').toUpperCase();
  if (d.includes('IZQUIERDA') || d.includes('IZQUIERDO')) return 'IZQUIERDO';
  return 'DERECHO';
}

/** Recíproco de armadoDesdeSentido: 'Interno'/'Externo' → 'INTERNO'/'EXTERNO'. */
export function sentidoDesdeArmado(armado: string | undefined | null): string {
  const a = (armado || '').toUpperCase();
  if (a.includes('EXTERNO')) return 'EXTERNO';
  if (a.includes('INTERNO')) return 'INTERNO';
  return '';
}

/**
 * Recíproco (aproximado) de cierreDesdeDireccion: 'Izquierda'/'Derecha'/'Medio'
 * → una de las opciones de DIRECCIONES. Es lossy (no distingue CAD de CIERRE;
 * 'Vertical' no tiene destino) — es metadato editable en la cotización, no
 * afecta el precio.
 */
export function direccionDesdeCierre(cierreVert: string | undefined | null): string {
  const c = (cierreVert || '').toUpperCase();
  if (c.includes('IZQUIERDA') || c.includes('IZQUIERDO')) return 'CAD [IZQUIERDA]';
  if (c.includes('DERECHA') || c.includes('DERECHO')) return 'CAD [DERECHA]';
  if (c.includes('MEDIO')) return 'CIERRE [MEDIO]';
  return '';
}

/**
 * La DIRECC. CAD/CIERRE de la cotización, puesta al día con el cierre que el
 * vendedor eligió en Fase 2.
 *
 * Antes la dirección solo se derivaba cuando venía VACÍA de Fase 0: corregir el
 * lado en terreno dejaba la cotización final con el lado viejo. Ahora el cierre
 * de Fase 2 manda, pero SIN perder lo que el mapeo simple no distingue: si la
 * dirección venía como CIERRE [.], se actualiza el lado conservando el prefijo
 * (el recíproco ciego la volvería CAD [.]).
 *
 * No se toca: una dirección en otro formato (el CIERRE del beeblack:
 * IZQUIERDA-DERECHA…), un cierre vacío, o el legacy «Vertical» (sin destino).
 */
export function sincronizarDireccionConCierre(
  direccion: string | undefined | null,
  cierreVert: string | undefined | null,
): string {
  const dir = (direccion || '').trim();
  const c = (cierreVert || '').toUpperCase();
  if (!c || c.includes('VERTICAL')) return dir;
  if (!dir) return direccionDesdeCierre(cierreVert);
  const d = dir.toUpperCase();
  if (d.startsWith('CAD')) {
    if (c.includes('MEDIO')) return 'CIERRE [MEDIO]';
    return c.includes('IZQUIERDA') ? 'CAD [IZQUIERDA]' : 'CAD [DERECHA]';
  }
  if (d.startsWith('CIERRE')) {
    if (c.includes('MEDIO')) return 'CIERRE [MEDIO]';
    return c.includes('IZQUIERDA') ? 'CIERRE [IZQUIERDO]' : 'CIERRE [DERECHO]';
  }
  return dir;
}



/** Normaliza color de accesorios de Fase 0 al código corto de Fase 2. Acepta
 *  lo que teclea la vendedora en la grilla («NEGROS», «blancas»): el plegado de
 *  plurales y femeninos vive en `normalizarColorAccesorio`. */

export function colorAccesorioCorto(color: string | undefined | null): string {

  const c = normalizarColorAccesorio(color);

  if (!c) return '';

  if (c === 'BLANCO' || c === 'BCO') return 'BCO';

  if (c === 'GRIS' || c === 'GRS') return 'GRS';

  if (c === 'NEGRO' || c === 'NEG') return 'NEG';

  if (c === 'MET' || c === 'CROMADO' || c === 'METAL') return 'MET';

  if (c === 'CAFÉ' || c === 'CAFE') return 'CAFÉ';

  return c;

}



type VentanaFase0 = Ventana & { direccion?: string };



export type OpcionesEnriquecerFase0 = {

  adicionalesFase0?: AdicionalFase0Persistido[];

  panoIndex?: number;

  totalPanos?: number;

  /**
   * Todas las cortinas de la cotización. Sirve para decidir a CUÁL le toca una
   * cenefa cuando varias comparten la misma UBIC. (la ubicación no identifica
   * una cortina). Sin esto se conserva el comportamiento histórico: la cenefa
   * de la ubicación es de este paño.
   */
  ventanasOT?: readonly VentanaFase0[];

};



/** Rellena campos del paño desde la ventana de Fase 0 si aún están vacíos. */

export function enriquecerPanoDesdeFase0(

  pano: Pano,

  ventana: VentanaFase0,

  catalogo?: CatalogoProductos,

  opts?: OpcionesEnriquecerFase0,

): Pano {

  const patch: Partial<Pano> = {};



  if (!pano.armado) {

    const armado = armadoDesdeSentido(ventana.sentido);

    if (armado) patch.armado = armado;

  }



  if (!pano.tipoTela) {

    // Dual: cada paño tiene su propia tela (pano.codInt); si no, la de la ventana.

    const tipoTela = pano.codInt

      ? tipoTelaDesdeProducto(catalogo?.[pano.codInt.trim()]?.cod, pano.codInt)

      : tipoTelaDesdeVentana(ventana, catalogo);

    if (tipoTela) patch.tipoTela = tipoTela;

  }



  if (!pano.cierreVert) {

    const cierre = cierreDesdeDireccion(ventana.direccion);

    if (cierre) patch.cierreVert = cierre;

  }



  const colorAcc = colorAccesorioCorto(pano.color || ventana.color);

  if (colorAcc) {

    if (!pano.colorPeso) patch.colorPeso = colorAcc;

    if (!pano.colorCadena) patch.colorCadena = colorAcc;

    if (!pano.colorMecanismo) patch.colorMecanismo = colorAcc;

  }



  // Dual (roller doble tela): flag + lado desde la dirección de Fase 0 + color +

  // chip de mecanismo dual por lado+color + orden de telas por defecto (SCR al

  // vidrio). Solo rellena vacíos (no pisa lo elegido a mano en Fase 2). Con color

  // MET/CAFÉ no hay chip dual → el mecanismo queda vacío (se completa en Fase 2).

  if (categoriaEsDual(ventana.categoria)) {

    if (!pano.dual) patch.dual = true;

    const lado = pano.dualLado || dualLadoDesdeDireccion(ventana.direccion);

    if (!pano.dualLado) patch.dualLado = lado;

    if (!pano.dualColor && colorAcc) patch.dualColor = colorAcc;

    if (!pano.mecanismo) {

      const chip = chipDualPorLadoColor(lado, colorAcc, OPCIONES_MECANISMO_DUAL);

      if (chip) patch.mecanismo = chip;

    }

    if (!pano.ordenDobleOpcion) {

      patch.ordenDoble = true;

      patch.ordenDobleOpcion = 'SCR_VID_BK';

    }

  }



  const panoIndex = opts?.panoIndex ?? 0;

  const totalPanos = opts?.totalPanos ?? ventana.panos?.length ?? 1;

  const ubic = ubicPanoVentana(ventana.ubicacion || '', panoIndex, totalPanos);

  const adicCenefa = buscarAdicionalCenefaEnUbic(ubic, opts?.adicionalesFase0);

  // …pero solo si esa cenefa es de ESTA cortina. Con varias cortinas en la misma
  // UBIC. la que la lleva por categoría se la queda (OT 3169: un soft light y dos
  // roller en PPAL, y la única cenefa comprada quedaba marcada en las tres).
  const esMiCenefa =
    !!adicCenefa &&
    cenefaAdicionalEsDelPano(
      adicCenefa,
      { ventanaId: String(ventana.id ?? ''), panoIndex },
      candidatosCenefaEnUbic(ubic, opts?.ventanasOT),
    );

  if (adicCenefa && esMiCenefa) {

    if (!pano.cenefa || pano.cenefa === 'No') {

      const tipo = tipoCenefaDesdeAdicional(adicCenefa.codInt);

      if (tipo) patch.cenefa = tipo;

    }

    if (!pano.cenefaTira) {

      // La OVALADA arranca CON TIRA (regla 2026-07-20): solo un dato explícito
      // del adicional la deja sin tira. Antes se escribía SIN TIRA cuando el
      // adicional no traía el flag —el caso de una cenefa cargada a mano en
      // Fase 1, que no tiene ese interruptor— y ese dato quedaba GUARDADO en el
      // paño, así que la pantalla, la etiqueta y el Excel de órdenes la pedían
      // sin tira. La cuadrada no lleva tira y sigue como estaba.
      // CATEGORÍA B (2026-08-14): sus cenefas van SIEMPRE sin tira.

      const tipoCenefa = patch.cenefa ?? pano.cenefa;

      const lineaB = esLineaB(pano, ventana.codInt, catalogo, ventana.categoria);

      patch.cenefaTira =

        lineaB

          ? 'SIN TIRA'

          : tipoCenefa === 'Ovalada'

            ? tiraCenefaOvalada(null, adicCenefa.conTira)

            : etiquetaConTira(adicCenefa.conTira);

    }

    if (patch.cenefa === 'Ovalada' || pano.cenefa === 'Ovalada') {

      const colorTapa = colorAccesorioCorto(adicCenefa.colorAcc);

      if (colorTapa && !pano.colorTapa) patch.colorTapa = colorTapa;

    }

  }

  // Cenefa que trae el SISTEMA (el dúo, el roller de cenefa ovalada): no hay
  // adicional que la marque —va dentro del precio de la familia— así que se
  // pone acá, con su tira por default. Sin esto la cortina llegaba a Fase 2 sin
  // cenefa: nadie le pedía tapa ni bracket y el BOM no los emitía (2026-08-20).
  if (llevaCenefaOvaladaImplicita(ventana.categoria) && !patch.cenefa && (!pano.cenefa || pano.cenefa === 'No')) {
    patch.cenefa = 'Ovalada';
  }
  if (
    (patch.cenefa === 'Ovalada' || pano.cenefa === 'Ovalada') &&
    !patch.cenefaTira &&
    !String(pano.cenefaTira ?? '').trim() &&
    llevaCenefaOvaladaImplicita(ventana.categoria)
  ) {
    // La ovalada va CON TIRA por default; la categoría B, siempre sin.
    patch.cenefaTira = esLineaB(pano, ventana.codInt, catalogo, ventana.categoria)
      ? 'SIN TIRA'
      : 'CON TIRA';
  }

  // Motor: si la cotización trae un adicional-motor (DOM38/DOM41) en la MISMA
  // ubicación del paño, precargar el modelo. Con motorModelo, la sección Motor
  // de Fase 2 aparece y Fase 4/inventario emiten el kit (y dejan de emitir la
  // cadena manual). Domótica si la OT trae el hub DOM43. Solo si el paño no
  // tiene ya un motor elegido en terreno (no pisa ediciones manuales).
  if (!pano.motorModelo && !pano.motorTipo) {
    const modeloMotor = motorAdicionalParaUbic(ubic, opts?.adicionalesFase0);
    if (modeloMotor) {
      patch.motorModelo = modeloMotor;
      if (!pano.motorDomotica && otTraeHubDomotica(opts?.adicionalesFase0)) {
        patch.motorDomotica = true;
      }
    }
  }

  // Manilla: si la OT trae adicionales de manilla (HER47/48/49) en la ubicación
  // del paño, precargar cantidad + color (el código manda sobre colorAcc). Solo
  // si el paño no tiene ya una manilla puesta en terreno (no pisa lo manual).
  if (!pano.manillaCant) {
    const man = manillasAdicionalesParaUbic(ubic, opts?.adicionalesFase0);
    if (man) {
      patch.manillaCant = man.cantidad;
      if (!pano.manillaColor) patch.manillaColor = man.color;
    }
  }

  // BEEBLACK: Fase 1 precarga la variante desde el sentido (interno → INTERNO,
  // externo → EXTERNO); el SEMI y cualquier corrección se eligen en Fase 2, igual
  // que en los sistemas de oscuridad. La MANILLA no se precarga acá a propósito:
  // es estructura y su default vive en el MOTOR (manillasActivasBeeblack), así
  // que un paño sin decisión igual la corta. La segunda manilla (screen +
  // blackout) sigue siendo opt-in en Fase 2.
  // El TIPO DE INSTALACIÓN no se precarga: sus valores no viajan desde la
  // cotización y el motor lo resuelve al default de la variante hasta que se
  // elija en Fase 2.
  if (esCategoriaBeeblack(ventana.categoria) && !pano.beeblackVariante) {
    patch.beeblackVariante = normalizarVarianteBeeblack(ventana.sentido, 'INTERNO');
  }

  return Object.keys(patch).length > 0 ? { ...pano, ...patch } : pano;

}



export function enriquecerVentanaDesdeFase0(

  ventana: VentanaFase0,

  catalogo?: CatalogoProductos,

  adicionalesFase0?: AdicionalFase0Persistido[],

  /** Todas las cortinas de la cotización (ver `OpcionesEnriquecerFase0.ventanasOT`). */
  ventanasOT?: readonly VentanaFase0[],

): VentanaFase0 {

  const panos = ventana.panos?.length ? ventana.panos : [{ ancho: '', alto: '', color: '' } as Pano];

  const totalPanos = panos.length;

  return {

    ...ventana,

    panos: panos.map((p, i) =>

      enriquecerPanoDesdeFase0(p, ventana, catalogo, {

        adicionalesFase0,

        panoIndex: i,

        totalPanos,

        ventanasOT,

      }),

    ),

  };

}


