// ─────────────────────────────────────────────────────────────────────
// EL DIBUJO DE LA CORTINA — parte pura.
//
// La vista interactiva de Fase 2 arma una cortina pieza por pieza a medida que
// el vendedor llena la ficha. Acá vive todo lo que se puede calcular sin React:
// qué variante de dibujo le toca a la categoría, con qué colores y texturas se
// pinta, y la geometría del render (la misma del boceto de referencia, para que
// las proporciones no se inventen dos veces).
//
// Módulo PURO (sin React, sin Supabase): se testea solo.
// ─────────────────────────────────────────────────────────────────────
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { categoriaEfectiva, type TipoCortina } from '@/modules/descuentos/tiposCortina';
import { esCenefaCuadrada } from '../fase2';
import { llevaCenefaCuadradaImplicita } from '../insumosCortina';
import type { CatalogoProductos, Pano, Ventana } from '../types';

/** Cada pieza que se dibuja por separado y se puede clicar para ir a su paso. */
export type PiezaViz =
  | 'soportes'
  | 'tubo'
  | 'mecanismo'
  | 'accionamiento'
  | 'tela'
  | 'peso'
  | 'perfiles'
  | 'despliegue'
  | 'cenefa';

export const PIEZAS_VIZ: readonly PiezaViz[] = [
  'soportes',
  'tubo',
  'mecanismo',
  'accionamiento',
  'tela',
  'peso',
  'perfiles',
  'despliegue',
  'cenefa',
] as const;

/** Nombre para el operador (tooltip de la pieza y título del paso). */
export const NOMBRE_PIEZA: Record<PiezaViz, string> = {
  soportes: 'Soportes',
  tubo: 'Tubo',
  mecanismo: 'Mecanismo',
  accionamiento: 'Cadena o motor',
  tela: 'Tela',
  peso: 'Peso inferior',
  perfiles: 'Perfiles y guías',
  despliegue: 'Cortina desplegada',
  cenefa: 'Cenefa',
};

/** Qué silueta se dibuja. `null` = esta categoría no tiene vista interactiva. */
export type VarianteViz = 'roller' | 'dual' | 'duo' | 'vertical' | 'oscuridad' | 'oscuranti' | 'beeblack';

/**
 * Variante de dibujo de una categoría. El roller y sus parientes directos
 * (dual = dos rollos en un bracket, dúo = tela de bandas) comparten dibujo; la
 * VERTICAL tiene el suyo (riel cabezal + lamas colgando, catálogo de diseños
 * del dueño 2026-08-19). Los sistemas de OSCURIDAD dibujan el esqueleto del
 * roller MÁS sus señas: guías laterales, zócalo y cajón — el OSCURANTI aparte
 * porque su tubo de 63 mm se nota. El BEEBLACK es un acordeón que corre de
 * lado: marco + panel plisado con manilla (pedido del dueño 2026-08-20).
 */
export function varianteViz(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): VarianteViz | null {
  const c = categoriaEfectiva(categoria ?? '', tipos).toUpperCase().trim();
  if (!c) return null;
  if (c === 'VERTICAL') return 'vertical';
  if (c.includes('BEEBLACK')) return 'beeblack';
  if (c.startsWith('OSCURANTI')) return 'oscuranti';
  if (c.startsWith('DARK_') || c.startsWith('SOFT_LIGHT_')) return 'oscuridad';
  if (c === 'ROL_DUAL') return 'dual';
  if (c.startsWith('DUO') || c === 'PLETINA_DUO_V') return 'duo';
  if (c === 'ROL' || c === 'PLETINA_ROLLER_V' || c.startsWith('ROL_')) return 'roller';
  return null;
}

/** Una tela del dibujo: con qué color y con qué textura se pinta. */
export type CapaTela = {
  hex: string;
  patron: 'screen' | 'solida' | 'bandas';
  /** false = a ese rollo todavía no le eligieron tela (se dibuja tenue). */
  definida: boolean;
};

/** Colores y texturas con que se pinta el dibujo. */
export type EstiloViz = {
  /** Herrajes (soportes, tubo, mecanismo, peso): sale del color de accesorios. */
  herrajesHex: string;
  /** Nombre canónico del color de accesorios ('NEGRO'|'BLANCO'|'GRIS'|…). */
  herrajesColor: string;
  telaHex: string;
  telaPatron: CapaTela['patron'];
  /**
   * Dual: las DOS telas, en orden de montaje — [0] la del rollo que va al
   * vidrio (paño 1, la screen) y [1] la del rollo de adelante (paño 2, el
   * blackout). El dibujo las cuelga a distinta altura para que se vean las dos.
   */
  telaDual?: readonly [CapaTela, CapaTela];
  cenefa: 'no' | 'ovalada' | 'cuadrada';
  accionamiento: 'cadena' | 'motor';
  /** Lado de la cadena o del motor, visto de frente. */
  lado: 'izquierda' | 'derecha';
  /**
   * Beeblack: el RECORRIDO del cierre — 'izq-der' = el panel parte anclado a
   * la izquierda y cierra hacia la derecha; 'arriba-abajo' baja desde el riel
   * superior. Es un recorrido, no el lado del mando (por eso no usa `lado`).
   */
  beeCierre?: 'izq-der' | 'der-izq' | 'arriba-abajo';
};

/** Normaliza color de accesorios (corto "NEG" / largo "NEGRO" / plural) a canónico. */
export function colorAccesorioCanonico(color: string | null | undefined): string {
  const c = (color || '').toUpperCase().trim();
  if (c.startsWith('NEG')) return 'NEGRO';
  if (c.startsWith('BCO') || c.startsWith('BLA') || c.startsWith('BLN')) return 'BLANCO';
  if (c.startsWith('GR')) return 'GRIS';
  return c;
}

/** Tono base del herraje por color de accesorios. Desconocido → el gris medio. */
const HERRAJE_HEX: Record<string, string> = {
  NEGRO: '#20242a',
  BLANCO: '#dcdad5',
  GRIS: '#8b9198',
  CAFÉ: '#4a3a2c',
  CAFE: '#4a3a2c',
  METALICO: '#a9b0b6',
  METÁLICO: '#a9b0b6',
};

/**
 * Color de la tela. El catálogo no guarda un hex: `colorGrupo` está casi
 * siempre en «vacio», así que se busca el nombre del color dentro de la
 * DESCRIPCIÓN de la tela ("CS 0303 IVORY"). Es una aproximación para que el
 * dibujo se parezca a lo que se vendió, no un dato de producción.
 */
const TELA_HEX: [RegExp, string][] = [
  [/\bNEGR|BLACK\b/, '#2b2b2b'],
  [/\bBLANC|WHITE\b/, '#e6e3dc'],
  [/\bIVOR|MARFIL|CREMA|CREAM\b/, '#ded5c2'],
  [/\bBEIG|ARENA|SAND|LINO|LINEN\b/, '#c9bda6'],
  [/\bGRIS|GREY|GRAY|PLOMO\b/, '#8d8d8a'],
  [/\bCAFE|CAFÉ|BROWN|CHOCOLA\b/, '#6b543f'],
  [/\bAZUL|BLUE|CELEST\b/, '#5c7893'],
  [/\bVERDE|GREEN|OLIV\b/, '#6f7d5c'],
  [/\bROJO|RED|BURDE|VINO\b/, '#8b4a45'],
  [/\bNARANJ|ORANGE|TERRACOT\b/, '#b06a45'],
  [/\bAMARILL|YELLOW|MOSTAZ\b/, '#c2a24d'],
  [/\bPIEL|NUDE|TAUPE\b/, '#b9a48f'],
];
const TELA_HEX_FALLBACK = '#8a857e';

export function telaHexDeProducto(
  codInt: string | null | undefined,
  catalogo?: CatalogoProductos,
): string {
  const p = codInt ? catalogo?.[String(codInt).trim()] : undefined;
  const txt = `${p?.descripcion ?? ''} ${p?.producto ?? ''}`.toUpperCase();
  for (const [re, hex] of TELA_HEX) if (re.test(txt)) return hex;
  return TELA_HEX_FALLBACK;
}

/** Textura por tipo de tela: screen se ve tejida, blackout tapa, dúo va en bandas. */
export function patronDeTipoTela(tipoTela: string | null | undefined): EstiloViz['telaPatron'] {
  const t = (tipoTela || '').toUpperCase().trim();
  if (t === 'DU') return 'bandas';
  if (t === 'BK') return 'solida';
  return 'screen';
}

/** ¿El paño se acciona con motor? Mismo criterio que el gate de Fase 2. */
export function panoLlevaMotor(p: Pano): boolean {
  return (
    !!String(p.motorModelo ?? '').trim() ||
    !!String(p.motorTipo ?? '').trim() ||
    !!String(p.ladoMotor ?? '').trim()
  );
}

/** Cómo pintar la cortina de este paño. */
export function estiloVizDePano(
  v: Ventana,
  p: Pano,
  catalogo?: CatalogoProductos,
  variante: VarianteViz = 'roller',
  tipos?: readonly TipoCortina[],
): EstiloViz {
  const colorAcc = colorAccesorioCanonico(colorAccesoriosDePano(p, v.color));
  const cenefaTxt = String(p.cenefa ?? '').trim().toUpperCase();
  const motor = panoLlevaMotor(p);
  // El lado lo manda el motor cuando hay motor, y la posición de cadena cuando
  // no. El BEEBLACK no tiene cadena: su lado es hacia dónde corre el acordeón
  // (el cierre de la VENTANA — 'DERECHA-IZQUIERDA' parte anclado a la derecha).
  const ladoTxt =
    variante === 'beeblack'
      ? String(v.direccion ?? '')
      : motor
        ? String(p.ladoMotor ?? '')
        : String(p.cierreVert ?? '');
  // DARK y OSCURANTI llevan cenefa cuadrada POR SISTEMA (implícita): el cajón
  // se dibuja aunque la ficha no la marque — igual que el despiece la corta.
  const cajonImplicito =
    (variante === 'oscuridad' || variante === 'oscuranti') &&
    llevaCenefaCuadradaImplicita(v.categoria, tipos);
  // El SOFT LIGHT también trae la suya, pero OVALADA (primer eslabón de su
  // cadena de corte); solo si la ficha elige «Cuadrada» pasa a familia CC y
  // se dibuja el cajón. Sin elección, se dibuja la ovalada del sistema.
  const ovaladaImplicita =
    variante === 'oscuridad' && !llevaCenefaCuadradaImplicita(v.categoria, tipos);
  // La tela vive en el paño solo en dual; en el resto es de la ventana.
  const codTela = (variante === 'dual' && p.codInt) || v.codInt;
  /** Una capa de la dual. Solo el primer rollo hereda la tela de la ventana:
   *  al guardar, la ventana refleja justamente la suya. */
  const capa = (pp: Pano | undefined, heredaDeLaVentana: boolean): CapaTela => {
    const cod = String(pp?.codInt ?? '').trim() || (heredaDeLaVentana ? String(v.codInt ?? '').trim() : '');
    return {
      hex: telaHexDeProducto(cod, catalogo),
      patron: patronDeTipoTela(pp?.tipoTela),
      definida: !!cod,
    };
  };
  return {
    herrajesHex: HERRAJE_HEX[colorAcc] ?? HERRAJE_HEX.GRIS,
    herrajesColor: colorAcc,
    telaHex: telaHexDeProducto(codTela, catalogo),
    telaPatron: variante === 'duo' ? 'bandas' : patronDeTipoTela(p.tipoTela),
    telaDual:
      variante === 'dual'
        ? [capa(v.panos?.[0], true), capa(v.panos?.[1], false)]
        : undefined,
    cenefa:
      cenefaTxt === 'OVALADA'
        ? 'ovalada'
        : esCenefaCuadrada(cenefaTxt) || cajonImplicito
          ? 'cuadrada'
          : ovaladaImplicita
            ? 'ovalada'
            : 'no',
    accionamiento: motor ? 'motor' : 'cadena',
    lado: ladoTxt.toUpperCase().startsWith('IZQ') ? 'izquierda' : 'derecha',
    // El cierre del beeblack nombra el RECORRIDO: 'IZQUIERDA-DERECHA' parte
    // anclado a la izquierda y cierra hacia la derecha (no es el lado del
    // mando); 'DE ARRIBA ABAJO' baja desde el riel superior.
    beeCierre:
      variante === 'beeblack'
        ? ladoTxt.toUpperCase().includes('ARRIBA')
          ? 'arriba-abajo'
          : ladoTxt.toUpperCase().startsWith('DER')
            ? 'der-izq'
            : 'izq-der'
        : undefined,
  };
}

// ── Geometría del render ─────────────────────────────────────────────
// Las mismas medidas del boceto de referencia (viewBox 1600×900). Viven acá
// para que el componente SVG y sus tests hablen de los mismos números.
export const VIZ = {
  ancho: 1600,
  alto: 900,
  /** Extremos del tubo. */
  x0: 452,
  x1: 1152,
  /** Eje del tubo. */
  cy: 196,
  /** Radio del tubo desnudo. */
  tr: 26,
  /** Vidrio (la parte que la cortina tapa). */
  gx0: 486,
  gx1: 1118,
  gy0: 250,
  gy1: 792,
  /** Cola de tela que asoma antes de desplegar. */
  cola: 92,
  /** Caída máxima. */
  caidaMax: 600,
  /** Dual: cuánto más abajo queda el rollo de ADELANTE (el paño 2). */
  dualDy: 34,
  /**
   * Dual: hasta dónde baja la tela de adelante, como fracción de la del vidrio.
   * La de atrás (screen) va entera y esta queda a media ventana — que es como
   * se usa la cortina y, de paso, la única forma de VER las dos telas.
   */
  dualFrente: 0.5,
  /** Grosor de tela (mm de la vuelta): engorda el rollo al enrollar. */
  grosor: 4.4,
} as const;

export const VIZ_W = VIZ.x1 - VIZ.x0;

/** Radio del rollo con `enrollado` px de tela encima. Área constante. */
export function radioRollo(enrollado: number): number {
  return Math.sqrt(VIZ.tr * VIZ.tr + (Math.max(0, enrollado) * VIZ.grosor) / Math.PI);
}

// ── Easings del boceto ───────────────────────────────────────────────
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const tramo = (p: number, a: number, b: number): number => clamp01((p - a) / (b - a));
/** Cubic in-out: la caída de la tela. */
export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** Cubic out: la cadena que baja. */
export const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
/** Back-out: las piezas que entran "encajando" (soportes, tubo, cenefa). */
export const easeBack = (t: number): number => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
export const mezcla = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Redondeo a 3 decimales: los atributos SVG no necesitan más. */
export const r3 = (v: number): number => Math.round(v * 1000) / 1000;
