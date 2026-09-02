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
import {
  esCenefaCuadrada,
  medidasPerfilesDePano,
  perfilesOscuridadDePano,
} from '../fase2';
import {
  aplicarDefaultsPerfiles,
  cortesOscuridad,
  familiaOscuridadConDiametro,
  normalizarVarianteOscuridad,
} from '@/modules/descuentos/reglas-oscuridad';
import {
  codigoTuberiaDeChip,
  diametroDeCodigoTubo,
} from '@/modules/descuentos/reglas-tuberia';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import { COLUMNAS_PERFIL } from '../fase2-completitud';
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
  | 'perfiles'
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
  /** Fórmulas de corte editadas en Admin (las usan los perfiles de oscuridad). */
  formulas?: FormulasFamilias;
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

/**
 * La tela vive en el paño solo en dual; en el resto es de la ventana.
 *
 * En la dual, el fallback a la tela de la ventana vale SOLO para el primer
 * rollo (al guardar, la ventana refleja justamente su tela). Del segundo en
 * adelante hay que elegirla: sin código propio se cortarían dos telas iguales
 * sin que nadie lo note — mismo criterio que el gate de Fase 2.
 */
export function codTelaDePaso(ctx: CtxPaso): string {
  if (ctx.variante !== 'dual') return txt(ctx.ventana.codInt);
  const propia = txt(ctx.pano.codInt);
  return ctx.panoIdx > 0 ? propia : propia || txt(ctx.ventana.codInt);
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

/**
 * Familia de oscuridad del contexto, con el diámetro del tubo YA elegido —
 * el mismo criterio que la ficha y el despiece (un soft light 38 sobre tubo
 * de 45 corta como 45).
 */
export function familiaOscuridadDePaso(ctx: CtxPaso) {
  const reglas = reglasDe(ctx);
  return familiaOscuridadConDiametro(
    txt(ctx.ventana.categoria),
    ctx.pano.cenefa as string,
    diametroDeCodigoTubo(codigoTuberiaDeChip(ctx.pano.tuberia as string), reglas.tuberia),
    reglas.tipos,
  );
}

/** Variante de instalación de la oscuridad (paño → ventana → default INTERNO). */
export function varianteOscuridadDePaso(ctx: CtxPaso) {
  return normalizarVarianteOscuridad(
    (ctx.pano.oscuridadVariante as string) ?? ctx.ventana.oscuridadVariante ?? ctx.ventana.sentido,
    'INTERNO',
  );
}

/**
 * Los datos que a los perfiles de oscuridad les faltan, con el MISMO despiece
 * que usa el gate de Fase 2 (`pendientesFase2`) y el Excel de órdenes: por cada
 * perfil, su instalación (muro/piso/marco) y su perforación (int/ext); por cada
 * separador activado, su medida. También los resueltos, para que el avance del
 * paso sea proporcional.
 */
export function camposPerfilesOscuridad(ctx: CtxPaso): CampoPaso[] {
  const fam = familiaOscuridadDePaso(ctx);
  if (!fam) return [];
  const anchoCm = num(ctx.pano.ancho) * 100;
  const altoCm = num(ctx.pano.alto ?? ctx.ventana.alto) * 100;
  // Sin medidas todavía no hay despiece que revisar (mismo criterio que el gate).
  if (anchoCm <= 0 || altoCm <= 0) return [];
  const perfiles = aplicarDefaultsPerfiles(
    perfilesOscuridadDePano(ctx.pano),
    fam,
    varianteOscuridadDePaso(ctx),
  );
  const cortes = cortesOscuridad(
    fam,
    varianteOscuridadDePaso(ctx),
    anchoCm,
    altoCm,
    perfiles,
    medidasPerfilesDePano(ctx.pano),
    colorAccesoriosDePano(ctx.pano, ctx.ventana.color),
    ctx.formulas?.oscuridad,
  );
  const out: CampoPaso[] = [];
  for (const c of cortes) {
    // Mismo criterio de «esto es un perfil» que el gate y el Excel de órdenes:
    // las 3 columnas con perforación + los separadores (medida, sin perforación).
    const esSeparador = c.columnaExcel.startsWith('SEPARADOR');
    if (esSeparador) {
      out.push({ etiqueta: `${c.componente}: medida`, ok: !c.pendienteMedida });
      continue;
    }
    if (!COLUMNAS_PERFIL.has(c.columnaExcel)) continue;
    out.push({ etiqueta: `${c.componente}: instalación`, ok: !c.pendienteMedida });
    out.push({ etiqueta: `${c.componente}: perforación (int/ext)`, ok: !!c.perforacion });
  }
  return out;
}

export const PASOS_WIZARD: readonly PasoWizard[] = [
  {
    id: 'medidas',
    titulo: 'Ventana y medidas',
    ayuda: 'Dónde va la cortina, de qué sistema es y cuánto mide.',
    pieza: null,
    aplica: () => true,
    campos: (ctx) => {
      const campos: CampoPaso[] = [
        { etiqueta: 'ubicación', ok: !!txt(ctx.ventana.ubicacion) },
        { etiqueta: 'tipo de cortina', ok: !!txt(ctx.ventana.categoria) },
      ];
      // El BEEBLACK no tiene modelo de despiece: TODAS sus medidas salen de la
      // variante (interno/semi/externo) — el gate de Fase 2 exige exactamente eso.
      if (ctx.variante === 'beeblack') {
        campos.push({ etiqueta: 'variante beeblack', ok: !!txt(ctx.pano.beeblackVariante) });
      } else {
        campos.push({ etiqueta: 'modelo de fabricación', ok: !!ctx.ventana.modelo });
      }
      campos.push(
        { etiqueta: 'ancho', ok: num(ctx.pano.ancho) > 0 },
        { etiqueta: 'alto', ok: num(ctx.pano.alto ?? ctx.ventana.alto) > 0 },
        // El ARMADO es la CAÍDA: va en la etiqueta Brother del paño y en el PDF
        // de producción, que ya la reclama por su cuenta («Falta ARMADO»). El
        // gate de Fase 3 no la mira, pero sin ella el taller no sabe armarla.
        { etiqueta: 'armado (interno/externo)', ok: !!txt(ctx.pano.armado) },
      );
      return campos;
    },
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
    // La vertical no tiene tubo (riel cabezal + carritos) y el beeblack tampoco
    // (sus 4 perfiles salen del mismo riel): el gate no les exige tubería.
    aplica: (ctx) => ctx.variante !== 'vertical' && ctx.variante !== 'beeblack',
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
    // La VERTICAL no lleva cadena de roller (la suya va por otro camino), pero
    // SÍ tiene lado de mando: el «Cierre» de la ficha. Sin preguntarlo acá, la
    // columna DIRECC. CAD/CIERRE de la cotización final quedaba en blanco para
    // toda vertical cargada por el wizard. El BEEBLACK igual: sin cadena, pero
    // su cierre (hacia dónde corre el acordeón) es la misma columna.
    aplica: (ctx) =>
      ctx.variante === 'vertical' || ctx.variante === 'beeblack' || requiereAccionamiento(ctx),
    campos: (ctx) => {
      if (ctx.variante === 'vertical') {
        return [{ etiqueta: 'cierre (lado del mando)', ok: !!txt(ctx.pano.cierreVert) }];
      }
      if (ctx.variante === 'beeblack') {
        return [
          { etiqueta: 'cierre (hacia dónde corre el acordeón)', ok: !!txt(ctx.ventana.direccion) },
        ];
      }
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
    ayuda: 'La tela que se ve. En dual cada rollo lleva la suya: el paño 1 es el que va al vidrio.',
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
    // La vertical no lleva peso inferior de roller (cada lama trae el suyo).
    // El paso vuelve solo si alguien le pidió manillas — el gate exige el color
    // cuando hay cantidad, y el wizard nunca pide menos que el gate. El BEEBLACK
    // tampoco: su manilla es estructura y el motor la emite solo.
    aplica: (ctx) =>
      ctx.variante === 'beeblack'
        ? false
        : ctx.variante !== 'vertical' || num(ctx.pano.manillaCant) > 0,
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
    id: 'perfiles',
    titulo: 'Perfiles y guías',
    ayuda: 'Los perfiles que sellan la luz por los costados y abajo: por dónde va cada uno y su perforación.',
    pieza: 'perfiles',
    // Solo los sistemas de oscuridad (DARK / SOFT LIGHT / OSCURANTI) llevan
    // guías laterales y zócalo; en el resto la pieza cuenta como lista.
    aplica: (ctx) => !!familiaOscuridadDePaso(ctx),
    campos: (ctx) => camposPerfilesOscuridad(ctx),
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
    ayuda:
      'La caja que tapa el rollo. En roller «No lleva» también es una respuesta; los sistemas de oscuridad traen la suya y la vertical la lleva siempre (cuadrada).',
    pieza: 'cenefa',
    // El beeblack no lleva cenefa: es un acordeón dentro de su marco.
    aplica: (ctx) => ctx.variante !== 'beeblack',
    campos: (ctx) => {
      const categoria = txt(ctx.ventana.categoria);
      const tipos = reglasDe(ctx).tipos;
      const campos: CampoPaso[] = [
        {
          etiqueta: 'cenefa',
          // Toda familia de oscuridad trae cenefa POR SISTEMA: DARK y OSCURANTI
          // la cuadrada implícita, y el SOFT LIGHT la OVALADA propia (primer
          // eslabón de su cadena de corte; con «Cuadrada» pasa a familia CC).
          // El despiece la corta aunque la ficha no marque nada, así que acá no
          // se exige elegirla — mismo criterio que el gate de Fase 2.
          ok: !!txt(ctx.pano.cenefa) || !!familiaOscuridadDePaso(ctx),
        },
      ];
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
  // Las guías y el zócalo se atornillan al marco: piden los soportes, no la tela.
  perfiles: ['soportes'],
  despliegue: ['tela', 'peso', 'accionamiento', 'perfiles'],
  cenefa: ['tubo'],
};

/** El avance del paso de cada pieza, sin mirar prerrequisitos. */
function avancePropio(ctx: CtxPaso): Partial<Record<PiezaViz, number>> {
  const propio: Partial<Record<PiezaViz, number>> = {};
  for (const paso of PASOS_WIZARD) {
    if (!paso.pieza) continue;
    // Un paso que no aplica (mecanismo en una categoría sin kit) no bloquea:
    // su pieza cuenta como lista.
    propio[paso.pieza] = paso.aplica(ctx) ? avancePaso(paso, ctx) : 1;
  }
  return propio;
}

/**
 * Cuánto lleva armada cada pieza del dibujo, 0..1.
 *
 * El avance de una pieza es el de su paso, pero se mantiene en 0 mientras las
 * piezas de las que cuelga no estén terminadas. La pieza `despliegue` es la
 * excepción: no tiene campos propios que la muevan (el «corte» de terreno no
 * baja la cortina), así que se calcula desde sus prerrequisitos.
 */
export function targetsProgreso(ctx: CtxPaso): Record<PiezaViz, number> {
  const propio = avancePropio(ctx);

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

/**
 * El progreso con que se dibuja una cortina en el RESUMEN de ventanas: lo que
 * tiene algún dato se dibuja ENTERO, lo que no se ha tocado va punteado, y la
 * cortina cuelga desplegada apenas su tela está elegida.
 *
 * Sin la cadena de prerrequisitos de `targetsProgreso`: esa es para armar la
 * cortina pieza a pieza DENTRO del wizard. En el resumen castigaba de más — a
 * una ficha con tela, medidas y colores elegidos pero sin el material de
 * instalación se le dibujaba la ventana pelada, que se lee como «se borró la
 * cortina» (2026-08-24). Lo que falte lo dice el aviso «N por completar», no
 * el dibujo.
 */
export function targetsProgresoResumen(ctx: CtxPaso): Record<PiezaViz, number> {
  const propio = avancePropio(ctx);
  // La única dependencia que se conserva es la tela: el peso y el despliegue
  // se dibujan SOBRE ella (un paso «peso» sin manilla cuenta como listo, y en
  // una ficha en blanco dibujaría un peso flotando en una ventana pelada).
  const telaElegida = (propio.tela ?? 0) > 0;
  const out = {} as Record<PiezaViz, number>;
  for (const pieza of PIEZAS_VIZ) out[pieza] = (propio[pieza] ?? 0) > 0 ? 1 : 0;
  if (!telaElegida) out.peso = 0;
  out.despliegue = telaElegida ? 1 : 0;
  return out;
}

/** El paso al que lleva un clic en una pieza del dibujo. */
export function pasoDePieza(pieza: PiezaViz): IdPaso | null {
  return PASOS_WIZARD.find((p) => p.pieza === pieza)?.id ?? null;
}
