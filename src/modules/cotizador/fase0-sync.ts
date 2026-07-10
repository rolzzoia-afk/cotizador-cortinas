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
import type { CatalogoProductos, Pano, Ventana } from './types';



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

    const tipoTela = tipoTelaDesdeVentana(ventana, catalogo);

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


