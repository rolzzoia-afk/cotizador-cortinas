// ─────────────────────────────────────────────────────────────────────
// LOS PARCHES DEL WIZARD — qué se escribe al elegir cada cosa.
//
// Varios controles del wizard no escriben UN campo: el color de accesorios
// pinta tres piezas, la variante del beeblack reajusta su instalación, la
// cadena arrastra largo y color… Esa lógica vivía suelta dentro de los
// `onChange` de `PasoWizard.tsx`, así que solo existía si alguien HACÍA CLIC.
//
// Acá queda en funciones puras, para que el asistente de voz escriba
// EXACTAMENTE lo mismo que el dedo. Ninguna de estas funciones aplica cascadas
// del sistema (mecanismo por color, kit por tubería, …): esas siguen viviendo
// en `actualizarPano` de la página, que es quien recibe el parche.
// ─────────────────────────────────────────────────────────────────────
import {
  normalizarInstalacionBeeblack,
  normalizarVarianteBeeblack,
} from '@/modules/descuentos/reglas-beeblack';
import {
  derivarLargoColor,
  esCadenaMetalica,
  patchCadenaMetalica,
  type CadenaInsumo,
} from '../cadenas';
import { tipoTelaDesdeProducto } from '../fase0-sync';
import type { ReglasCadena } from '@/modules/descuentos/reglasSeleccion';
import type { CatalogoProductos, Pano, Ventana } from '../types';

/** Parche que toca la ventana y/o el paño (la tela, por ejemplo, toca las dos). */
export type ParcheMixto = { pano?: Partial<Pano>; ventana?: Partial<Ventana> };

/**
 * El color de accesorios es UN control que pinta las TRES piezas: mecanismo,
 * cadena y peso. Así lo hace la ficha clásica y así lo lee `colorAccesoriosDePano`.
 */
export function parcheColorAccesorios(v: string): Partial<Pano> {
  return { colorMecanismo: v, colorCadena: v, colorPeso: v };
}

/**
 * Variante del beeblack (INTERNO/SEMI/EXTERNO). Cada variante tiene su propia
 * lista de instalaciones, así que la instalación se reajusta sola: dejarla en
 * una que la variante nueva no admite emite componentes que no existen.
 */
export function parcheVarianteBeeblack(v: string, instalacionActual?: string): Partial<Pano> {
  const nueva = normalizarVarianteBeeblack(v, 'INTERNO');
  return {
    beeblackVariante: nueva,
    beeblackInstalacion: normalizarInstalacionBeeblack(instalacionActual, nueva),
  };
}

/**
 * CADENA ↔ MOTOR. Pasar a motor limpia la cadena (el kit ya no la lleva) y
 * viceversa. El modelo por defecto depende de la cenefa: la OVALADA no admite
 * el DOM41 (no cabe), así que ahí el default es el DOM38.
 */
export function parcheAcciona(
  v: 'CADENA' | 'MOTOR' | string,
  opts: { motorModelo?: string; cenefaOvalada?: boolean } = {},
): Partial<Pano> {
  if (v === 'MOTOR') {
    return {
      motorModelo: opts.motorModelo || (opts.cenefaOvalada ? 'DOM38' : 'DOM41'),
      codCadena: '',
      largoCadena: '',
      colorCadena: '',
      // Sin cadena no hay cadena metálica que cobrar ni que cortar.
      cadenaMetalica: false,
    };
  }
  return { motorModelo: '', motorTipo: '', ladoMotor: '' };
}

/**
 * Elegir una cadena arrastra su largo y su color, que salen del catálogo (o del
 * nemotécnico, como último recurso). Sin código = sin cadena: se limpian los tres.
 */
export function parcheCadena(
  cod: string,
  cadenas: CadenaInsumo[],
  reglas?: ReglasCadena,
): Partial<Pano> {
  if (!cod) return { codCadena: '', largoCadena: '', colorCadena: '', cadenaMetalica: false };
  // Elegir la metálica enciende el flag (y elegir otra lo apaga): así el precio
  // de Fase 1 y lo que corta el taller dicen lo mismo.
  if (esCadenaMetalica(cod)) return { cadenaMetalica: true, ...patchCadenaMetalica() };
  const { largoCadena, colorCadena } = derivarLargoColor(cod, cadenas, reglas);
  return { codCadena: cod, largoCadena, colorCadena, cadenaMetalica: false };
}

/**
 * Tipo de cenefa. La OVALADA nace CON TIRA salvo en categoría B, que va siempre
 * SIN TIRA (decisión de producto: las cenefas de la gama económica no la llevan).
 */
export function parcheCenefaTipo(v: string, opts: { lineaB?: boolean } = {}): Partial<Pano> {
  return {
    cenefa: v,
    cenefaTira: !opts.lineaB && v === 'Ovalada' ? 'CON TIRA' : 'SIN TIRA',
  };
}

/** La etiqueta de la ovalada propia del soft light: elegirla es NO marcar cenefa. */
export const CENEFA_OVALADA_SISTEMA = 'Ovalada (del sistema)';

/**
 * Cenefa del SOFT LIGHT. Su ovalada viene con el sistema (no se marca en la
 * ficha: el despiece la corta igual), así que elegirla equivale a dejar el campo
 * vacío; la CUADRADA sí se escribe (pasa a familia CC).
 */
export function parcheCenefaSoftLight(v: string): Partial<Pano> {
  return { cenefa: v === CENEFA_OVALADA_SISTEMA ? '' : v };
}

/**
 * La tela. En DUAL cada rollo lleva la suya (va al paño); en el resto es de la
 * ventana y el paño solo se queda con el tipo (SCR/BK/DU), que es lo que cambia
 * el dibujo.
 */
export function parcheTela(
  sel: { codInt: string; producto: string; tipo?: string; descripcion?: string },
  catalogo: CatalogoProductos,
  esDual: boolean,
): ParcheMixto {
  const tipoTela = tipoTelaDesdeProducto(catalogo[sel.codInt]?.cod, sel.codInt);
  if (esDual) {
    return {
      pano: {
        codInt: sel.codInt,
        producto: sel.producto,
        descripcion: sel.descripcion,
        tipoTela,
      },
    };
  }
  return {
    ventana: {
      codInt: sel.codInt,
      producto: sel.producto,
      tipo: sel.tipo,
      descripcion: sel.descripcion,
    },
    pano: { tipoTela },
  };
}
