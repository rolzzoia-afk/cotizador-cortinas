// Mapeo de datos guardados en Fase 0 hacia campos del paño en Fase 2.

// Solo rellena campos vacíos para no pisar ediciones manuales de terreno.

import type { AdicionalFase0Persistido } from '@/modules/ots/types';

import {
  buscarAdicionalCenefaEnUbic,
  etiquetaConTira,
  tipoCenefaDesdeAdicional,
  ubicPanoVentana,
} from '@/modules/descuentos/adicionales-cenefa';
import { esCategoriaBeeblack, normalizarVarianteBeeblack } from '@/modules/descuentos/reglas-beeblack';
import { categoriaEsDual } from '@/modules/descuentos/tipos';
import { chipDualPorLadoColor } from '@/modules/descuentos/chips';
import { codigoMotorDesdeAdicional, esAdicionalHubDomotica, manillaDesdeAdicional } from './insumosCortina';
import { OPCIONES_MECANISMO_DUAL } from './fase2';
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



/** Normaliza color de accesorios de Fase 0 al código corto de Fase 2. */

export function colorAccesorioCorto(color: string | undefined | null): string {

  const c = (color || '').toUpperCase().trim();

  if (!c) return '';

  if (c === 'BLANCO' || c === 'BCO') return 'BCO';

  if (c === 'GRIS' || c === 'GRS' || c === 'GRISE') return 'GRS';

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

  if (adicCenefa) {

    if (!pano.cenefa || pano.cenefa === 'No') {

      const tipo = tipoCenefaDesdeAdicional(adicCenefa.codInt);

      if (tipo) patch.cenefa = tipo;

    }

    if (!pano.cenefaTira) {

      patch.cenefaTira = etiquetaConTira(adicCenefa.conTira);

    }

    if (patch.cenefa === 'Ovalada' || pano.cenefa === 'Ovalada') {

      const colorTapa = colorAccesorioCorto(adicCenefa.colorAcc);

      if (colorTapa && !pano.colorTapa) patch.colorTapa = colorTapa;

    }

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

  if (esCategoriaBeeblack(ventana.categoria)) {
    const variante =
      pano.beeblackVariante || normalizarVarianteBeeblack(ventana.sentido, 'INTERNO');
    if (!pano.beeblackVariante) {
      patch.beeblackVariante = variante;
    }
    if (variante === 'INTERNO') {
      if (pano.beeblackManillaIzq === undefined) patch.beeblackManillaIzq = true;
      if (pano.beeblackManillaDer === undefined) patch.beeblackManillaDer = true;
    }
  }

  return Object.keys(patch).length > 0 ? { ...pano, ...patch } : pano;

}



export function enriquecerVentanaDesdeFase0(

  ventana: VentanaFase0,

  catalogo?: CatalogoProductos,

  adicionalesFase0?: AdicionalFase0Persistido[],

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

      }),

    ),

  };

}


