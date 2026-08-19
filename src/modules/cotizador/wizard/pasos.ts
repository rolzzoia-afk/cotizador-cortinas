// ─────────────────────────────────────────────────────────────────────
// LOS PASOS DEL WIZARD DE TERRENO — parte pura.
//
// La vista interactiva de Fase 2 parte la ficha del paño en pasos cortos, cada
// uno atado a una pieza del dibujo: al completar el paso, la pieza termina de
// armarse. Este módulo dice qué pasos aplican, qué campos pide cada uno y
// cuánto lleva avanzado, sin tocar React.
//
// Los campos que se piden son —a propósito— los MISMOS que `pendientesFase2`
// exige para dejar avanzar la OT, más un par que el gate no mira pero que en
// terreno hay que preguntar igual (superficie, corte, posición de cadena). El
// wizard nunca pide MENOS que el gate: si se completan todos los pasos, la
// ventana no puede quedar bloqueando el paso a Fase 3.
// ─────────────────────────────────────────────────────────────────────
import {
  REGLAS_SELECCION_DEFAULT,
  type ReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccion';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import {
  categoriaLlevaCadenaRoller,
  categoriaRequiereMecanismo,
  kitTraeCadenaIncorporada,
} from '@/modules/descuentos/reglas-mecanismo';
import {
  cenefaCuadradaTapasFijas,
  esCenefaOvalada,
  llevaCenefaCuadradaImplicita,
} from '../insumosCortina';
import { esCenefaCuadrada } from '../fase2';
import { esLineaB } from '../lineaB';
import type { CatalogoProductos, Pano, Ventana } from '../types';
import { panoLlevaMotor, PIEZAS_VIZ, type PiezaViz, type VarianteViz } from './cortinaViz';

export type IdPaso =
  | 'medidas'
  | 'soportes'
  | 'tubo'
  | 'mecanismo'
  | 'accionamiento'
  | 'tela'
  | 'peso'
  | 'terreno'
  | 'cenefa'
  | 'resumen';

/** Un dato que el paso tiene que dejar resuelto. */
export type CampoPaso = { etiqueta: string; ok: boolean };

export type CtxPaso = {
  ventana: Ventana;
  pano: Pano;
  panoIdx: number;
  variante: VarianteViz;
  reglas?: ReglasSeleccion;
  catalogo?: CatalogoProductos;
};

export type PasoWizard = {
  id: IdPaso;
  titulo: string;
  /** Una línea que explica para qué sirve el paso, en el idioma del taller. */
  ayuda: string;
  /** Pieza del dibujo que arma este paso (null = no arma ninguna). */
  pieza: PiezaViz | null;
  aplica: (ctx: CtxPaso) => boolean;
  campos: (ctx: CtxPaso) => CampoPaso[];
};

const txt = (v: unknown): string => String(v ?? '').trim();
const num = (v: unknown): number => parseFloat(String(v ?? 0)) || 0;
const reglasDe = (ctx: CtxPaso): ReglasSeleccion => ctx.reglas ?? REGLAS_SELECCION_DEFAULT;

/** La tela vive en el paño solo en dual; en el resto es de la ventana. */
export function codTelaDePaso(ctx: CtxPaso): string {
  return ctx.variante === 'dual'
    ? txt(ctx.pano.codInt) || txt(ctx.ventana.codInt)
    : txt(ctx.ventana.codInt);
}

function requiereMecanismo(ctx: CtxPaso): boolean {
  const c = txt(ctx.ventana.categoria);
  return !!c && categoriaRequiereMecanismo(c, reglasDe(ctx).mecanismo);
}

/**
 * ¿Hay algo que preguntar sobre el accionamiento? La PLETINA (velcro) tiene
 * mecanismo —VELCRO— pero es un paño PEGADO: no sube ni baja, así que no lleva
 * cadena, ni peso de cadena, ni lado de mando.
 */
function requiereAccionamiento(ctx: CtxPaso): boolean {
  return (
    requiereMecanismo(ctx) &&
    categoriaLlevaCadenaRoller(txt(ctx.ventana.categoria), reglasDe(ctx).tipos)
  );
}

function esDuo(ctx: CtxPaso): boolean {
  return ctx.variante === 'duo';
}

/** ¿Esta cortina lleva cenefa ovalada (por elección o porque la categoría la impone)? */
function cenefaOvalada(ctx: CtxPaso): boolean {
  return esCenefaOvalada(
    ctx.pano.cenefa as string,
    txt(ctx.ventana.categoria),
    reglasDe(ctx).tipos,
  );
}

export const PASOS_WIZARD: readonly PasoWizard[] = [
  {
    id: 'medidas',
    titulo: 'Ventana y medidas',
    ayuda: 'Dónde va la cortina, de qué sistema es y cuánto mide.',
    pieza: null,
    aplica: () => true,
    campos: (ctx) => [
      { etiqueta: 'ubicación', ok: !!txt(ctx.ventana.ubicacion) },
      { etiqueta: 'tipo de cortina', ok: !!txt(ctx.ventana.categoria) },
      { etiqueta: 'modelo de fabricación', ok: !!ctx.ventana.modelo },
      { etiqueta: 'ancho', ok: num(ctx.pano.ancho) > 0 },
      { etiqueta: 'alto', ok: num(ctx.pano.alto ?? ctx.ventana.alto) > 0 },
    ],
  },
  {
    id: 'soportes',
    titulo: 'Soportes e instalación',
    ayuda: 'El color de los accesorios y sobre qué se atornilla la cortina.',
    pieza: 'soportes',
    aplica: () => true,
    campos: (ctx) => [
      {
        etiqueta: 'color de accesorios',
        ok: !!txt(colorAccesoriosDePano(ctx.pano, ctx.ventana.color)),
      },
      { etiqueta: 'material (tarugos)', ok: !!txt(ctx.pano.materialTipo) },
      { etiqueta: 'superficie', ok: !!txt(ctx.pano.superficie) },
      { etiqueta: 'respecto del marco', ok: !!txt(ctx.pano.relacionMarco) },
    ],
  },
  {
    id: 'tubo',
    titulo: 'Tubo',
    ayuda: 'El tubo sobre el que se enrolla la tela. Lo acota el ancho de la cortina.',
    pieza: 'tubo',
    aplica: () => true,
    campos: (ctx) => [{ etiqueta: 'tubería', ok: !!txt(ctx.pano.tuberia) }],
  },
  {
    id: 'mecanismo',
    titulo: 'Mecanismo',
    ayuda: 'El kit que hace girar el tubo. Sale del color de accesorios y del ancho.',
    pieza: 'mecanismo',
    aplica: (ctx) => requiereMecanismo(ctx),
    campos: (ctx) => [{ etiqueta: 'mecanismo', ok: !!txt(ctx.pano.mecanismo) }],
  },
  {
    id: 'accionamiento',
    titulo: 'Cadena o motor',
    ayuda: 'Cómo se sube y se baja la cortina, y por qué lado queda el mando.',
    pieza: 'accionamiento',
    aplica: (ctx) => requiereAccionamiento(ctx),
    campos: (ctx) => {
      if (panoLlevaMotor(ctx.pano)) {
        return [
          { etiqueta: 'modelo de motor', ok: !!txt(ctx.pano.motorModelo) },
          { etiqueta: 'lado del motor', ok: !!txt(ctx.pano.ladoMotor) },
        ];
      }
      return [
        {
          etiqueta: 'cadena',
          // El MEC 06 trae la cadena incorporada: ahí no se elige ninguna.
          ok: !!txt(ctx.pano.codCadena) || kitTraeCadenaIncorporada(ctx.pano.mecanismo),
        },
        { etiqueta: 'peso de cadena', ok: !!txt(ctx.pano.codPeso) },
        { etiqueta: 'posición de la cadena', ok: !!txt(ctx.pano.cierreVert) },
      ];
    },
  },
  {
    id: 'tela',
    titulo: 'Tela',
    ayuda: 'La tela que se ve. En dual, cada paño lleva la suya.',
    pieza: 'tela',
    aplica: () => true,
    campos: (ctx) => [
      { etiqueta: 'tela', ok: !!codTelaDePaso(ctx) },
      { etiqueta: 'tipo de tela', ok: !!txt(ctx.pano.tipoTela) },
    ],
  },
  {
    id: 'peso',
    titulo: 'Peso inferior y manilla',
    ayuda: 'La barra que tensa la tela abajo. Su código sale del color de accesorios.',
    pieza: 'peso',
    aplica: () => true,
    campos: (ctx) => {
      const campos: CampoPaso[] = [];
      // La manilla es opcional: solo si se pidió alguna hace falta su color.
      if (num(ctx.pano.manillaCant) > 0) {
        campos.push({ etiqueta: 'color de la manilla', ok: !!txt(ctx.pano.manillaColor) });
      }
      if (esDuo(ctx)) {
        campos.push({ etiqueta: 'altura de cierre', ok: num(ctx.pano.cierreAlturaCm) > 0 });
      }
      return campos;
    },
  },
  {
    id: 'terreno',
    titulo: 'Terreno',
    ayuda: 'Lo que hay que resolver en la instalación: cortes, suplementos y avisos.',
    pieza: 'despliegue',
    aplica: () => true,
    campos: (ctx) => [{ etiqueta: 'corte', ok: !!txt(ctx.pano.cortes) }],
  },
  {
    id: 'cenefa',
    titulo: 'Cenefa',
    ayuda: 'La caja que tapa el rollo. «No lleva» también es una respuesta.',
    pieza: 'cenefa',
    aplica: () => true,
    campos: (ctx) => {
      const campos: CampoPaso[] = [
        { etiqueta: 'cenefa', ok: !!txt(ctx.pano.cenefa) },
      ];
      const categoria = txt(ctx.ventana.categoria);
      const tipos = reglasDe(ctx).tipos;
      if (cenefaOvalada(ctx)) {
        campos.push({ etiqueta: 'color de tapa', ok: !!txt(ctx.pano.colorTapa) });
        campos.push({ etiqueta: 'tipo de bracket', ok: !!txt(ctx.pano.bracketTipo) });
        // La categoría B va SIEMPRE sin tira: no se pregunta.
        const esB =
          !!ctx.catalogo &&
          esLineaB(
            ctx.pano,
            ctx.ventana.codInt,
            ctx.catalogo,
            categoria,
            reglasDe(ctx).mecanismo,
            tipos,
          );
        if (!esB) campos.push({ etiqueta: 'tira de la cenefa', ok: !!txt(ctx.pano.cenefaTira) });
      } else if (
        esCenefaCuadrada(ctx.pano.cenefa as string) ||
        llevaCenefaCuadradaImplicita(categoria, tipos)
      ) {
        if (!cenefaCuadradaTapasFijas(categoria, ctx.pano.cenefa as string, tipos)) {
          campos.push({ etiqueta: 'tipo de tapas', ok: !!txt(ctx.pano.cenefaTapa) });
          campos.push({ etiqueta: 'color de tapa', ok: !!txt(ctx.pano.colorTapa) });
        }
      }
      return campos;
    },
  },
  {
    id: 'resumen',
    titulo: 'Resumen',
    ayuda: 'Lo que quedó armado y lo que todavía falta antes de guardar.',
    pieza: null,
    aplica: () => true,
    campos: () => [],
  },
] as const;

/** Los pasos que corresponden a esta ventana, en orden. */
export function pasosAplicables(ctx: CtxPaso): PasoWizard[] {
  return PASOS_WIZARD.filter((p) => p.aplica(ctx));
}

/** Qué tan lleno está el paso, 0..1. Sin campos que pedir = 1. */
export function avancePaso(paso: PasoWizard, ctx: CtxPaso): number {
  const campos = paso.campos(ctx);
  if (campos.length === 0) return 1;
  return campos.filter((c) => c.ok).length / campos.length;
}

export function pasoCompleto(paso: PasoWizard, ctx: CtxPaso): boolean {
  return paso.campos(ctx).every((c) => c.ok);
}

/** Lo que le falta al paso, para listarlo sin repetir la lógica. */
export function faltantesPaso(paso: PasoWizard, ctx: CtxPaso): string[] {
  return paso.campos(ctx).filter((c) => !c.ok).map((c) => c.etiqueta);
}

// Una pieza no se dibuja antes que aquello sobre lo que se monta: el peso no
// puede flotar sin tela, ni la cadena colgar de un mecanismo que no existe.
const PREREQUISITOS: Record<PiezaViz, PiezaViz[]> = {
  soportes: [],
  tubo: ['soportes'],
  mecanismo: ['tubo'],
  accionamiento: ['mecanismo'],
  tela: ['tubo'],
  peso: ['tela'],
  despliegue: ['tela', 'peso', 'accionamiento'],
  cenefa: ['tubo'],
};

/**
 * Cuánto lleva armada cada pieza del dibujo, 0..1.
 *
 * El avance de una pieza es el de su paso, pero se mantiene en 0 mientras las
 * piezas de las que cuelga no estén terminadas. La pieza `despliegue` es la
 * excepción: no tiene campos propios que la muevan (el «corte» de terreno no
 * baja la cortina), así que se calcula desde sus prerrequisitos.
 */
export function targetsProgreso(ctx: CtxPaso): Record<PiezaViz, number> {
  const propio: Partial<Record<PiezaViz, number>> = {};
  for (const paso of PASOS_WIZARD) {
    if (!paso.pieza) continue;
    // Un paso que no aplica (mecanismo en una categoría sin kit) no bloquea:
    // su pieza cuenta como lista.
    propio[paso.pieza] = paso.aplica(ctx) ? avancePaso(paso, ctx) : 1;
  }

  const out = {} as Record<PiezaViz, number>;
  const resolver = (pieza: PiezaViz): number => {
    if (out[pieza] !== undefined) return out[pieza];
    // Se deja marcado antes de recursar: los prerrequisitos son un árbol, pero
    // un ciclo por edición futura no debe colgar el render.
    out[pieza] = 0;
    const previos = PREREQUISITOS[pieza].map(resolver);
    const listos = previos.every((v) => v >= 1);
    const base = pieza === 'despliegue' ? (listos ? 1 : 0) : (propio[pieza] ?? 0);
    out[pieza] = listos ? base : 0;
    return out[pieza];
  };
  for (const pieza of PIEZAS_VIZ) resolver(pieza);
  return out;
}

/** El paso al que lleva un clic en una pieza del dibujo. */
export function pasoDePieza(pieza: PiezaViz): IdPaso | null {
  return PASOS_WIZARD.find((p) => p.pieza === pieza)?.id ?? null;
}
