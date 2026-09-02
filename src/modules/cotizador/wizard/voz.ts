// ─────────────────────────────────────────────────────────────────────
// QUÉ PREGUNTA LA VOZ EN CADA PASO — parte pura del asistente.
//
// Por cada paso del wizard, la lista de campos que se pueden dictar: cómo se
// pregunta, qué se acepta como respuesta y qué parche escribe. Nada de esto
// sabe de micrófonos: el hook le pasa el contexto y despacha el `AccionVoz`
// por los mismos `onPano`/`onVentana`/`onCategoria` que usa el dedo, así que
// las cascadas (color → mecanismo, ancho → modelo, tubería → kit) corren igual.
//
// Regla: solo se preguntan los campos VACÍOS, en el mismo orden en que se ven
// en pantalla. Lo que el sistema resuelve solo (el modelo de fabricación, el
// código del peso) se ANUNCIA, no se pregunta.
// ─────────────────────────────────────────────────────────────────────
import {
  OPCIONES_BRACKET_TIPO,
  OPCIONES_CENEFA,
  OPCIONES_CENEFA_TAPA,
  OPCIONES_CENEFA_TIRA,
  OPCIONES_CIERRE_VERT,
  OPCIONES_CORTES,
  OPCIONES_LADO_MOTOR,
  OPCIONES_MATERIAL_TIPO,
  OPCIONES_MOTOR_MODELO,
  OPCIONES_SUPERFICIE,
  OPCIONES_SUPLEMENTO,
  esCenefaCuadrada,
} from '../fase2';
import {
  CIERRES_BEEBLACK,
  esCategoriaBeeblack,
} from '@/modules/descuentos/reglas-beeblack';
import {
  cenefaCuadradaTapasFijas,
  esCenefaOvalada,
  llevaCenefaCuadradaImplicita,
} from '../insumosCortina';
import { esCategoriaVertical, kitTraeCadenaIncorporada } from '@/modules/descuentos/reglas-mecanismo';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { coloresParaUso, nombreDeColor, opcionesColorConGuardado } from '@/modules/descuentos/coloresAccesorio';
import { colorAccesorioCorto } from '../fase0-sync';
import { categoriasFase1ConTipos } from '../categorias';
import {
  cadenasRoller,
  etiquetaCadena,
  pesosSeleccionables,
  type CadenaInsumo,
} from '../cadenas';
import { PESO_ROLLER_POR_COLOR } from '@/modules/descuentos/codigos-estructura';
import { colorAccesorioCanonico, panoLlevaMotor } from './cortinaViz';
import { codTelaDePaso, familiaOscuridadDePaso, type CtxPaso, type IdPaso } from './pasos';
import {
  CENEFA_OVALADA_SISTEMA,
  parcheAcciona,
  parcheCadena,
  parcheCenefaSoftLight,
  parcheCenefaTipo,
  parcheColorAccesorios,
  parcheTela,
  parcheVarianteBeeblack,
} from './parches';
import { incluyePalabra, normalizarVoz, numeroHablado, type OpcionVoz } from './vozParsers';
import { REGLAS_SELECCION_DEFAULT } from '@/modules/descuentos/reglasSeleccion';
import type { Pano, Ventana } from '../types';

export type { OpcionVoz };

/** Lo que el asistente escribe cuando entiende una respuesta. */
export type AccionVoz = {
  pano?: Partial<Pano>;
  ventana?: Partial<Ventana>;
  /** La categoría va por su propio camino: `cambiarCategoria` trae cascadas. */
  categoria?: string;
};

/** Contexto del paso más lo que el asistente necesita para armar las listas. */
export type CtxVoz = CtxPaso & {
  cadenas?: CadenaInsumo[];
  pesos?: CadenaInsumo[];
  lineaB?: boolean;
  opcionesMecanismo?: readonly string[];
  opcionesTuberia?: readonly string[];
  notaMecanismo?: string;
};

export type TipoCampoVoz = 'texto' | 'medida' | 'entero' | 'opcion' | 'tela' | 'libre';

export type CampoVoz = {
  /** Identifica el campo dentro del paso ('pano.ancho'). */
  clave: string;
  /** Nombre corto, el que se usa para «corregir ancho». */
  etiqueta: string;
  pregunta: (ctx: CtxVoz) => string;
  tipo: TipoCampoVoz;
  unidad?: 'm' | 'cm';
  /** Un campo opcional se puede dejar en blanco sin que la voz insista. */
  opcional?: boolean;
  /** Con una sola opción posible, la voz la pone y avisa (no pregunta). */
  autoUnica?: boolean;
  estaVacio: (ctx: CtxVoz) => boolean;
  opciones?: (ctx: CtxVoz) => OpcionVoz[];
  aplicar: (valor: string, ctx: CtxVoz) => AccionVoz;
  /** Cómo se lee lo anotado en la confirmación. Por defecto, el valor. */
  leerValor?: (valor: string, ctx: CtxVoz) => string;
};

export type PasoVoz = {
  /** Lo que la voz cuenta del paso sin preguntar nada (datos derivados). */
  anuncios?: (ctx: CtxVoz) => string[];
  campos: (ctx: CtxVoz) => CampoVoz[];
};

const txt = (v: unknown): string => String(v ?? '').trim();
const num = (v: unknown): number => parseFloat(String(v ?? 0)) || 0;
const reglasDe = (ctx: CtxVoz) => ctx.reglas ?? REGLAS_SELECCION_DEFAULT;

/** Lista de strings → opciones, con la misma etiqueta que muestran los chips. */
const desdeStrings = (
  vs: readonly string[],
  sinonimos: Record<string, string[]> = {},
): OpcionVoz[] => vs.map((v) => ({ value: v, label: v, sinonimos: sinonimos[v] }));

const desdePares = (
  vs: readonly { value: string; label: string }[],
  sinonimos: Record<string, string[]> = {},
): OpcionVoz[] => vs.map((o) => ({ ...o, sinonimos: sinonimos[o.value] }));

const opcionesColor = (
  ctx: CtxVoz,
  uso: 'accesorio' | 'manilla' | 'tapaOvalada' | 'tapaCuadrada',
  actual: string | undefined,
): OpcionVoz[] =>
  opcionesColorConGuardado(coloresParaUso(uso, reglasDe(ctx).colores), actual).map((c) => ({
    value: c,
    label: nombreDeColor(c, reglasDe(ctx).colores),
    sinonimos: [nombreDeColor(c, reglasDe(ctx).colores)],
  }));

/** El cargador que ofrece cada motor (el DOM38 usa hub de domótica). */
export function opcionesCargador(motorModelo: string | undefined): { value: string; label: string }[] {
  return (motorModelo || '').toUpperCase() === 'DOM38'
    ? [
        { value: 'NINGUNO', label: 'No lleva' },
        { value: 'DOM43', label: 'Hub domótica (DOM43)' },
        { value: 'DOM33', label: 'Adaptador (DOM33)' },
      ]
    : [
        { value: 'NINGUNO', label: 'No lleva' },
        { value: 'DOM03', label: 'HUB USB (DOM03)' },
        { value: 'DOM33', label: 'Adaptador (DOM33)' },
      ];
}

const cenefaOvaladaDe = (ctx: CtxVoz): boolean =>
  esCenefaOvalada(ctx.pano.cenefa as string, txt(ctx.ventana.categoria), reglasDe(ctx).tipos);

// ── Los campos, paso por paso ─────────────────────────────────────────

const CAMPO_UBICACION: CampoVoz = {
  clave: 'ventana.ubicacion',
  etiqueta: 'ubicación',
  tipo: 'texto',
  pregunta: () => '¿Dónde va esta cortina?',
  estaVacio: (c) => !txt(c.ventana.ubicacion),
  aplicar: (v) => ({ ventana: { ubicacion: v } }),
};

const CAMPO_CATEGORIA: CampoVoz = {
  clave: 'ventana.categoria',
  etiqueta: 'tipo de cortina',
  tipo: 'opcion',
  pregunta: () => '¿Qué tipo de cortina es?',
  estaVacio: (c) => !txt(c.ventana.categoria),
  opciones: (c) =>
    categoriasFase1ConTipos(reglasDe(c).tipos).flatMap((g) =>
      g.options.map((o) => ({ value: o.value, label: o.label })),
    ),
  aplicar: (v) => ({ categoria: v }),
};

const CAMPO_ANCHO: CampoVoz = {
  clave: 'pano.ancho',
  etiqueta: 'ancho',
  tipo: 'medida',
  unidad: 'm',
  pregunta: () => '¿Cuánto mide de ancho?',
  estaVacio: (c) => num(c.pano.ancho) <= 0,
  aplicar: (v) => ({ pano: { ancho: v } }),
  leerValor: (v) => `${numeroHablado(v)} metros`,
};

const CAMPO_ALTO: CampoVoz = {
  clave: 'pano.alto',
  etiqueta: 'alto',
  tipo: 'medida',
  unidad: 'm',
  pregunta: () => '¿Cuánto mide de alto?',
  estaVacio: (c) => num(c.pano.alto ?? c.ventana.alto) <= 0,
  aplicar: (v) => ({ pano: { alto: v } }),
  leerValor: (v) => `${numeroHablado(v)} metros`,
};

const CAMPO_CANTIDAD: CampoVoz = {
  clave: 'ventana.cantidad',
  etiqueta: 'cantidad',
  tipo: 'entero',
  opcional: true,
  pregunta: () => '¿Cuántas cortinas iguales van acá?',
  estaVacio: (c) => num(c.ventana.cantidad) <= 0,
  aplicar: (v) => ({ ventana: { cantidad: Math.max(1, parseInt(v, 10) || 1) } }),
};

const CAMPO_ARMADO: CampoVoz = {
  clave: 'pano.armado',
  etiqueta: 'armado',
  tipo: 'opcion',
  pregunta: () => '¿El armado es interno o externo?',
  estaVacio: (c) => !txt(c.pano.armado),
  opciones: () =>
    desdeStrings(['Interno', 'Externo'], {
      Interno: ['interior', 'adentro', 'por dentro'],
      Externo: ['exterior', 'afuera', 'por fuera'],
    }),
  aplicar: (v) => ({ pano: { armado: v } }),
};

const CAMPO_VARIANTE_BEEBLACK: CampoVoz = {
  clave: 'pano.beeblackVariante',
  etiqueta: 'variante',
  tipo: 'opcion',
  pregunta: () => '¿La variante del beeblack es interna, semi o externa?',
  estaVacio: (c) => !txt(c.pano.beeblackVariante),
  opciones: () =>
    desdeStrings(['INTERNO', 'SEMI', 'EXTERNO'], {
      INTERNO: ['interno', 'interna', 'adentro'],
      SEMI: ['semi', 'semi externo'],
      EXTERNO: ['externo', 'externa', 'afuera'],
    }),
  aplicar: (v, c) => ({ pano: parcheVarianteBeeblack(v, c.pano.beeblackInstalacion) }),
};

const CAMPO_COLOR_ACCESORIOS: CampoVoz = {
  clave: 'pano.colorAccesorios',
  etiqueta: 'color de accesorios',
  tipo: 'opcion',
  pregunta: () => '¿De qué color van los accesorios?',
  estaVacio: (c) => !txt(colorAccesoriosDePano(c.pano, c.ventana.color)),
  opciones: (c) =>
    opcionesColor(c, 'accesorio', colorAccesorioCorto(colorAccesoriosDePano(c.pano, c.ventana.color))),
  aplicar: (v) => ({ pano: parcheColorAccesorios(v) }),
};

const CAMPO_MATERIAL: CampoVoz = {
  clave: 'pano.materialTipo',
  etiqueta: 'material',
  tipo: 'opcion',
  pregunta: () => '¿Sobre qué material se atornilla? Vulcanita, concreto, madera o cerámica.',
  estaVacio: (c) => !txt(c.pano.materialTipo),
  opciones: () =>
    desdeStrings(OPCIONES_MATERIAL_TIPO, {
      VULCANITA: ['yeso', 'volcanita', 'planchas de yeso'],
      CONCRETO: ['hormigon', 'cemento', 'muro solido'],
      MADERA: ['madera'],
      'CERÁMICA': ['ceramica', 'porcelanato', 'palmeta'],
    }),
  aplicar: (v) => ({ pano: { materialTipo: v } }),
};

const CAMPO_SUPERFICIE: CampoVoz = {
  clave: 'pano.superficie',
  etiqueta: 'superficie',
  tipo: 'opcion',
  pregunta: () => '¿Va al techo o a la pared?',
  estaVacio: (c) => !txt(c.pano.superficie),
  opciones: () =>
    desdeStrings(OPCIONES_SUPERFICIE, {
      TECHO: ['cielo', 'al cielo', 'arriba'],
      PARED: ['muro', 'al muro', 'a la pared'],
    }),
  aplicar: (v) => ({ pano: { superficie: v } }),
};

const CAMPO_MARCO: CampoVoz = {
  clave: 'pano.relacionMarco',
  etiqueta: 'marco',
  tipo: 'opcion',
  pregunta: () => '¿Va dentro del marco, fuera del marco, o no aplica?',
  estaVacio: (c) => !txt(c.pano.relacionMarco),
  opciones: () =>
    desdePares(
      [
        { value: 'Dentro', label: 'Dentro del marco' },
        { value: 'Fuera', label: 'Fuera del marco' },
        { value: 'N/A', label: 'No aplica' },
      ],
      { 'N/A': ['no aplica', 'sin marco', 'ninguno'] },
    ),
  aplicar: (v) => ({ pano: { relacionMarco: v } }),
};

const CAMPO_TUBERIA: CampoVoz = {
  clave: 'pano.tuberia',
  etiqueta: 'tubería',
  tipo: 'opcion',
  autoUnica: true,
  pregunta: () => '¿Qué tubo lleva?',
  estaVacio: (c) => !txt(c.pano.tuberia),
  opciones: (c) => desdeStrings(c.opcionesTuberia ?? []),
  aplicar: (v) => ({ pano: { tuberia: v } }),
};

const CAMPO_MECANISMO: CampoVoz = {
  clave: 'pano.mecanismo',
  etiqueta: 'mecanismo',
  tipo: 'opcion',
  autoUnica: true,
  pregunta: () => '¿Qué kit de mecanismo lleva?',
  estaVacio: (c) => !txt(c.pano.mecanismo),
  opciones: (c) => desdeStrings(c.opcionesMecanismo ?? []),
  aplicar: (v) => ({ pano: { mecanismo: v } }),
};

const CAMPO_DUAL_LADO: CampoVoz = {
  clave: 'pano.dualLado',
  etiqueta: 'lado de la dual',
  tipo: 'opcion',
  pregunta: () => '¿La dual va por el lado derecho, izquierdo o mixto?',
  estaVacio: (c) => !txt(c.pano.dualLado),
  opciones: () => desdeStrings(['DERECHO', 'IZQUIERDO', 'MIXTO']),
  aplicar: (v) => ({ pano: { dualLado: v } }),
};

const CAMPO_CIERRE_VERTICAL: CampoVoz = {
  clave: 'pano.cierreVert',
  etiqueta: 'cierre',
  tipo: 'opcion',
  pregunta: () => '¿Por qué lado queda el mando? Izquierda, derecha o al medio.',
  estaVacio: (c) => !txt(c.pano.cierreVert),
  opciones: () => desdeStrings(OPCIONES_CIERRE_VERT),
  aplicar: (v) => ({ pano: { cierreVert: v } }),
};

const CAMPO_CIERRE_BEEBLACK: CampoVoz = {
  clave: 'ventana.direccion',
  etiqueta: 'cierre',
  tipo: 'opcion',
  pregunta: () => '¿Hacia dónde corre el acordeón?',
  estaVacio: (c) => !txt(c.ventana.direccion),
  opciones: () =>
    desdeStrings(CIERRES_BEEBLACK, {
      'IZQUIERDA-DERECHA': ['de izquierda a derecha', 'izquierda derecha'],
      'DERECHA-IZQUIERDA': ['de derecha a izquierda', 'derecha izquierda'],
      'DE ARRIBA ABAJO': ['de arriba abajo', 'arriba abajo', 'vertical', 'girada'],
    }),
  aplicar: (v) => ({ ventana: { direccion: v } }),
};

const CAMPO_ACCIONA: CampoVoz = {
  clave: 'pano.acciona',
  etiqueta: 'accionamiento',
  tipo: 'opcion',
  pregunta: () => '¿Se acciona con cadena o con motor?',
  // Solo se pregunta mientras nadie decidió: con cadena elegida, motor puesto o
  // un kit que trae la cadena incorporada ya está resuelto.
  estaVacio: (c) =>
    !panoLlevaMotor(c.pano) &&
    !txt(c.pano.codCadena) &&
    !kitTraeCadenaIncorporada(c.pano.mecanismo),
  opciones: () =>
    desdePares(
      [
        { value: 'CADENA', label: 'Con cadena' },
        { value: 'MOTOR', label: 'Con motor' },
      ],
      { CADENA: ['cadena', 'manual'], MOTOR: ['motor', 'motorizada', 'eléctrica'] },
    ),
  aplicar: (v, c) => ({
    pano: parcheAcciona(v, {
      motorModelo: c.pano.motorModelo,
      cenefaOvalada: cenefaOvaladaDe(c),
    }),
  }),
};

const CAMPO_MOTOR_MODELO: CampoVoz = {
  clave: 'pano.motorModelo',
  etiqueta: 'modelo de motor',
  tipo: 'opcion',
  pregunta: () => '¿Qué modelo de motor?',
  estaVacio: (c) => !txt(c.pano.motorModelo),
  // La cenefa ovalada no admite el DOM41: no cabe en la caja.
  opciones: (c) =>
    desdePares(
      cenefaOvaladaDe(c)
        ? OPCIONES_MOTOR_MODELO.filter((o) => o.value !== 'DOM41')
        : OPCIONES_MOTOR_MODELO,
      {
        DOM41: ['inalambrico', 'inalambrica', 'dom cuarenta y uno'],
        DOM38: ['tronic', 'tronic plus', 'dom treinta y ocho'],
        CABLE: ['con cable', 'cable'],
      },
    ),
  aplicar: (v) => ({ pano: { motorModelo: v } }),
};

const CAMPO_LADO_MOTOR: CampoVoz = {
  clave: 'pano.ladoMotor',
  etiqueta: 'lado del motor',
  tipo: 'opcion',
  pregunta: () => '¿De qué lado va el motor?',
  estaVacio: (c) => !txt(c.pano.ladoMotor),
  opciones: () => desdeStrings(OPCIONES_LADO_MOTOR),
  aplicar: (v) => ({ pano: { ladoMotor: v } }),
};

const CAMPO_CARGADOR: CampoVoz = {
  clave: 'pano.motorCargador',
  etiqueta: 'cargador',
  tipo: 'opcion',
  opcional: true,
  pregunta: () => '¿Lleva cargador o hub?',
  estaVacio: (c) => !txt(c.pano.motorCargador),
  opciones: (c) => desdePares(opcionesCargador(c.pano.motorModelo), { NINGUNO: ['no lleva', 'nada'] }),
  aplicar: (v) => ({ pano: { motorCargador: v || 'NINGUNO' } }),
};

const CAMPO_CONTROLES: CampoVoz = {
  clave: 'pano.motorControlAdicCant',
  etiqueta: 'controles',
  tipo: 'entero',
  opcional: true,
  pregunta: () => '¿Cuántos controles adicionales? Si no lleva, di ninguno.',
  estaVacio: (c) => c.pano.motorControlAdicCant == null,
  aplicar: (v) => ({ pano: { motorControlAdicCant: parseInt(v, 10) || 0 } }),
};

const CAMPO_HUBS: CampoVoz = {
  clave: 'pano.motorHubUsbCant',
  etiqueta: 'hubs',
  tipo: 'entero',
  opcional: true,
  pregunta: () => '¿Cuántos hub adicionales? Si no lleva, di ninguno.',
  estaVacio: (c) => c.pano.motorHubUsbCant == null,
  aplicar: (v) => ({ pano: { motorHubUsbCant: parseInt(v, 10) || 0 } }),
};

const CAMPO_CADENA: CampoVoz = {
  clave: 'pano.codCadena',
  etiqueta: 'cadena',
  tipo: 'opcion',
  pregunta: () => '¿Qué cadena lleva?',
  // El MEC 06 trae la cadena incorporada: no hay ninguna que elegir.
  estaVacio: (c) => !txt(c.pano.codCadena) && !kitTraeCadenaIncorporada(c.pano.mecanismo),
  opciones: (c) =>
    cadenasRoller(c.cadenas ?? [], {}, reglasDe(c).cadenas).map((x) => ({
      value: txt(x.cod),
      label: etiquetaCadena(x),
      sinonimos: [txt(x.nemotecnico)],
    })),
  aplicar: (v, c) => ({ pano: parcheCadena(v, c.cadenas ?? [], reglasDe(c).cadenas) }),
};

const CAMPO_POSICION_CADENA: CampoVoz = {
  clave: 'pano.cierreVert',
  etiqueta: 'posición de la cadena',
  tipo: 'opcion',
  pregunta: () => '¿La cadena queda a la izquierda o a la derecha?',
  estaVacio: (c) => !txt(c.pano.cierreVert),
  opciones: () => desdeStrings(['Izquierda', 'Derecha']),
  aplicar: (v) => ({ pano: { cierreVert: v } }),
};

const CAMPO_PESO_CADENA: CampoVoz = {
  clave: 'pano.codPeso',
  etiqueta: 'peso de cadena',
  tipo: 'opcion',
  autoUnica: true,
  pregunta: () => '¿Qué peso de cadena lleva?',
  estaVacio: (c) => !txt(c.pano.codPeso),
  opciones: (c) =>
    pesosSeleccionables(c.pesos ?? []).map((x) => ({
      value: txt(x.cod),
      label: etiquetaCadena(x),
      sinonimos: [txt(x.nemotecnico)],
    })),
  aplicar: (v) => ({ pano: { codPeso: v } }),
};

const CAMPO_TELA: CampoVoz = {
  clave: 'tela',
  etiqueta: 'tela',
  tipo: 'tela',
  pregunta: (c) =>
    c.variante === 'dual'
      ? `¿Qué tela lleva el paño ${c.panoIdx + 1}?`
      : '¿Qué tela lleva?',
  estaVacio: (c) => !codTelaDePaso(c),
  aplicar: (codInt, c) => {
    const p = c.catalogo?.[codInt];
    // Los mismos cuatro datos que manda el selector de la ficha.
    const parche = parcheTela(
      {
        codInt,
        producto: p?.producto || '',
        tipo: p?.tipo || '',
        descripcion: p?.descripcion || '',
      },
      c.catalogo ?? {},
      c.variante === 'dual',
    );
    return { pano: parche.pano, ventana: parche.ventana };
  },
};

const CAMPO_TIPO_TELA: CampoVoz = {
  clave: 'pano.tipoTela',
  etiqueta: 'tipo de tela',
  tipo: 'opcion',
  pregunta: () => '¿Es screen, blackout o dúo?',
  estaVacio: (c) => !txt(c.pano.tipoTela),
  opciones: () =>
    desdePares(
      [
        { value: 'SCR', label: 'Screen' },
        { value: 'BK', label: 'Blackout' },
        { value: 'DU', label: 'Dúo' },
      ],
      { SCR: ['screen', 'esquin'], BK: ['blackout', 'black out'], DU: ['duo', 'dua'] },
    ),
  aplicar: (v) => ({ pano: { tipoTela: v } }),
};

const CAMPO_ALTURA_CIERRE: CampoVoz = {
  clave: 'pano.cierreAlturaCm',
  etiqueta: 'altura de cierre',
  tipo: 'medida',
  unidad: 'cm',
  pregunta: () => '¿Cuál es la altura de cierre, en centímetros?',
  estaVacio: (c) => num(c.pano.cierreAlturaCm) <= 0,
  aplicar: (v) => ({ pano: { cierreAlturaCm: v } }),
  leerValor: (v) => `${numeroHablado(v)} centímetros`,
};

const CAMPO_MANILLA_CANT: CampoVoz = {
  clave: 'pano.manillaCant',
  etiqueta: 'manillas',
  tipo: 'entero',
  opcional: true,
  pregunta: () => '¿Cuántas manillas lleva? Si no lleva, di ninguna.',
  estaVacio: (c) => c.pano.manillaCant == null,
  aplicar: (v) => ({ pano: { manillaCant: parseInt(v, 10) || 0 } }),
};

const CAMPO_MANILLA_COLOR: CampoVoz = {
  clave: 'pano.manillaColor',
  etiqueta: 'color de la manilla',
  tipo: 'opcion',
  pregunta: () => '¿De qué color son las manillas?',
  estaVacio: (c) => num(c.pano.manillaCant) > 0 && !txt(c.pano.manillaColor),
  opciones: (c) => opcionesColor(c, 'manilla', c.pano.manillaColor as string),
  aplicar: (v) => ({ pano: { manillaColor: v } }),
};

const CAMPO_CORTES: CampoVoz = {
  clave: 'pano.cortes',
  etiqueta: 'corte',
  tipo: 'opcion',
  pregunta: () => '¿Hay que cortar algo? Nada, plumavit, rodapié o ambos.',
  estaVacio: (c) => !txt(c.pano.cortes),
  opciones: () =>
    desdeStrings(OPCIONES_CORTES, {
      Nada: ['nada', 'ninguno', 'no'],
      'Rodapié': ['rodapie', 'guardapolvo'],
      Ambos: ['los dos', 'ambos'],
    }),
  aplicar: (v) => ({ pano: { cortes: v } }),
};

const CAMPO_SUPLEMENTO: CampoVoz = {
  clave: 'pano.suplementoTipo',
  etiqueta: 'suplemento',
  tipo: 'opcion',
  opcional: true,
  pregunta: () => '¿Lleva suplemento? Madera, acrílico, o ninguno.',
  estaVacio: (c) => !txt(c.pano.suplementoTipo),
  opciones: () =>
    desdePares(OPCIONES_SUPLEMENTO, {
      SUB01: ['madera', 'de madera', 'tres milimetros'],
      SUB02: ['acrilico', 'de acrilico'],
    }),
  aplicar: (v) => ({ pano: { suplementoTipo: v } }),
};

const CAMPO_COMENTARIO: CampoVoz = {
  clave: 'pano.comentarioFinal',
  etiqueta: 'comentario',
  tipo: 'libre',
  opcional: true,
  pregunta: () => '¿Algún comentario para el taller?',
  estaVacio: (c) => !txt(c.pano.comentarioFinal),
  aplicar: (v) => ({ pano: { comentarioFinal: v } }),
};

const CAMPO_CENEFA_SOFT_LIGHT: CampoVoz = {
  clave: 'pano.cenefa',
  etiqueta: 'cenefa',
  tipo: 'opcion',
  pregunta: () => '¿La cenefa es la ovalada del sistema o cuadrada?',
  estaVacio: (c) => !txt(c.pano.cenefa),
  opciones: () =>
    desdeStrings([CENEFA_OVALADA_SISTEMA, 'Cuadrada a muro', 'Cuadrada a techo'], {
      [CENEFA_OVALADA_SISTEMA]: ['ovalada', 'la del sistema', 'la que viene'],
    }),
  aplicar: (v) => ({ pano: parcheCenefaSoftLight(v) }),
};

const CAMPO_CENEFA: CampoVoz = {
  clave: 'pano.cenefa',
  etiqueta: 'cenefa',
  tipo: 'opcion',
  pregunta: () => '¿Qué cenefa lleva?',
  estaVacio: (c) => !txt(c.pano.cenefa),
  opciones: (c) => {
    const base = esCategoriaVertical(txt(c.ventana.categoria))
      ? OPCIONES_CENEFA.filter((o) => o.startsWith('Cuadrada'))
      : [...OPCIONES_CENEFA];
    return desdeStrings(base, { No: ['no lleva', 'sin cenefa', 'ninguna'] });
  },
  aplicar: (v, c) => ({ pano: parcheCenefaTipo(v, { lineaB: c.lineaB }) }),
};

const CAMPO_CENEFA_TIRA: CampoVoz = {
  clave: 'pano.cenefaTira',
  etiqueta: 'tira de la cenefa',
  tipo: 'opcion',
  pregunta: () => '¿La cenefa va con tira o sin tira?',
  estaVacio: (c) => !txt(c.pano.cenefaTira),
  opciones: () => desdeStrings(OPCIONES_CENEFA_TIRA),
  aplicar: (v) => ({ pano: { cenefaTira: v } }),
};

const CAMPO_COLOR_TAPA: CampoVoz = {
  clave: 'pano.colorTapa',
  etiqueta: 'color de tapa',
  tipo: 'opcion',
  pregunta: () => '¿De qué color son las tapas?',
  estaVacio: (c) => !txt(c.pano.colorTapa),
  opciones: (c) =>
    opcionesColor(
      c,
      cenefaOvaladaDe(c) ? 'tapaOvalada' : 'tapaCuadrada',
      c.pano.colorTapa as string,
    ),
  aplicar: (v) => ({ pano: { colorTapa: v } }),
};

const CAMPO_BRACKET: CampoVoz = {
  clave: 'pano.bracketTipo',
  etiqueta: 'bracket',
  tipo: 'opcion',
  pregunta: () => '¿El bracket es corto o largo?',
  estaVacio: (c) => !txt(c.pano.bracketTipo),
  opciones: () => desdeStrings(OPCIONES_BRACKET_TIPO),
  aplicar: (v) => ({ pano: { bracketTipo: v } }),
};

const CAMPO_CENEFA_TAPA: CampoVoz = {
  clave: 'pano.cenefaTapa',
  etiqueta: 'tapas',
  tipo: 'opcion',
  pregunta: () => '¿Va de muro a muro, con una tapa o con dos tapas?',
  estaVacio: (c) => !txt(c.pano.cenefaTapa),
  opciones: () =>
    desdePares(
      OPCIONES_CENEFA_TAPA.map((v) => ({
        value: v,
        label:
          v === 'MURO_MURO' ? 'Muro a muro' : v === 'CON_1_TAPA' ? 'Con una tapa' : 'Con dos tapas',
      })),
      {
        MURO_MURO: ['muro a muro', 'de muro a muro', 'sin tapas'],
        CON_1_TAPA: ['una tapa', 'con una tapa'],
        CON_2_TAPAS: ['dos tapas', 'con dos tapas'],
      },
    ),
  aplicar: (v) => ({ pano: { cenefaTapa: v } }),
};

// ── El registro por paso ──────────────────────────────────────────────

export const CAMPOS_VOZ: Record<IdPaso, PasoVoz> = {
  medidas: {
    // El modelo es un OBJETO (`ModeloDespiece`), no un texto: se lee su tipo y
    // el diámetro del tubo, que es lo que le dice algo a quien está midiendo.
    anuncios: (c) => {
      const m = c.ventana.modelo;
      if (c.variante === 'beeblack' || !m || !txt(m.tipo_rol)) return [];
      const diam = m.diametro_tubo_mm > 0 ? `, tubo de ${m.diametro_tubo_mm} milímetros` : '';
      return [`El modelo de fabricación quedó en ${txt(m.tipo_rol).replace(/_/g, ' ')}${diam}.`];
    },
    campos: (c) => {
      const campos = [CAMPO_UBICACION, CAMPO_CATEGORIA, CAMPO_ANCHO, CAMPO_ALTO, CAMPO_CANTIDAD, CAMPO_ARMADO];
      if (esCategoriaBeeblack(txt(c.ventana.categoria))) campos.push(CAMPO_VARIANTE_BEEBLACK);
      return campos;
    },
  },
  soportes: {
    campos: () => [CAMPO_COLOR_ACCESORIOS, CAMPO_MATERIAL, CAMPO_SUPERFICIE, CAMPO_MARCO],
  },
  tubo: { campos: () => [CAMPO_TUBERIA] },
  mecanismo: {
    anuncios: (c) => (c.notaMecanismo ? [c.notaMecanismo] : []),
    campos: (c) => (c.variante === 'dual' ? [CAMPO_MECANISMO, CAMPO_DUAL_LADO] : [CAMPO_MECANISMO]),
  },
  accionamiento: {
    campos: (c) => {
      if (c.variante === 'vertical') return [CAMPO_CIERRE_VERTICAL];
      if (c.variante === 'beeblack') return [CAMPO_CIERRE_BEEBLACK];
      if (panoLlevaMotor(c.pano)) {
        return [
          CAMPO_MOTOR_MODELO,
          CAMPO_LADO_MOTOR,
          CAMPO_CARGADOR,
          CAMPO_CONTROLES,
          CAMPO_HUBS,
        ];
      }
      // Lo primero es cadena o motor; con «motor» el ramo cambia entero en el
      // render siguiente, y con «cadena» la lista sigue con lo suyo. Cuando ya
      // hay cadena elegida (o el kit la trae), esa pregunta se da por hecha.
      return [CAMPO_ACCIONA, CAMPO_CADENA, CAMPO_POSICION_CADENA, CAMPO_PESO_CADENA];
    },
  },
  tela: { campos: () => [CAMPO_TELA, CAMPO_TIPO_TELA] },
  peso: {
    anuncios: (c) => {
      const color = colorAccesorioCanonico(colorAccesoriosDePano(c.pano, c.ventana.color));
      const cod = PESO_ROLLER_POR_COLOR[color];
      return cod ? [`El peso inferior es el ${cod}, por el color de accesorios.`] : [];
    },
    campos: (c) => {
      const campos: CampoVoz[] = [];
      if (c.variante === 'duo') campos.push(CAMPO_ALTURA_CIERRE);
      campos.push(CAMPO_MANILLA_CANT);
      if (num(c.pano.manillaCant) > 0) campos.push(CAMPO_MANILLA_COLOR);
      return campos;
    },
  },
  perfiles: {
    anuncios: () => [
      'Los perfiles y guías se completan a mano en la pantalla. Cuando estén listos, di siguiente.',
    ],
    campos: () => [],
  },
  terreno: { campos: () => [CAMPO_CORTES, CAMPO_SUPLEMENTO, CAMPO_COMENTARIO] },
  cenefa: {
    anuncios: (c) => {
      const categoria = txt(c.ventana.categoria);
      if (llevaCenefaCuadradaImplicita(categoria, reglasDe(c).tipos) && !txt(c.pano.cenefa)) {
        return ['La cenefa cuadrada va por sistema, con tapas fijas: no hay nada que elegir.'];
      }
      return [];
    },
    campos: (c) => {
      const categoria = txt(c.ventana.categoria);
      const tipos = reglasDe(c).tipos;
      // DARK y OSCURANTI: cenefa cuadrada implícita, sin nada que preguntar.
      if (llevaCenefaCuadradaImplicita(categoria, tipos) && !txt(c.pano.cenefa)) return [];
      const esSoftLight = !!familiaOscuridadDePaso(c) && !llevaCenefaCuadradaImplicita(categoria, tipos);
      if (esSoftLight && c.pano.cenefa !== 'Ovalada') return [CAMPO_CENEFA_SOFT_LIGHT];
      const campos: CampoVoz[] = [];
      // La ovalada por sistema (la dúo) no se pregunta: ya está decidida.
      if (!(cenefaOvaladaDe(c) && c.pano.cenefa !== 'Ovalada')) campos.push(CAMPO_CENEFA);
      if (cenefaOvaladaDe(c)) {
        if (!c.lineaB) campos.push(CAMPO_CENEFA_TIRA);
        campos.push(CAMPO_COLOR_TAPA, CAMPO_BRACKET);
      } else if (esCenefaCuadrada(c.pano.cenefa as string)) {
        if (!cenefaCuadradaTapasFijas(categoria, c.pano.cenefa as string, tipos)) {
          campos.push(CAMPO_CENEFA_TAPA, CAMPO_COLOR_TAPA);
        }
      }
      return campos;
    },
  },
  resumen: { campos: () => [] },
};

/** Los campos dictables del paso, en el orden en que se ven en pantalla. */
export function camposDelPaso(idPaso: IdPaso, ctx: CtxVoz): CampoVoz[] {
  return CAMPOS_VOZ[idPaso]?.campos(ctx) ?? [];
}

/** Lo que la voz cuenta del paso sin preguntar nada. */
export function anunciosDelPaso(idPaso: IdPaso, ctx: CtxVoz): string[] {
  return CAMPOS_VOZ[idPaso]?.anuncios?.(ctx) ?? [];
}

/**
 * El próximo campo que hay que preguntar: el primero VACÍO que no se haya
 * atendido ya en esta pasada. `atendidos` evita el bucle del campo que se
 * responde con un valor vacío a propósito (la ovalada del soft light) y del
 * que se saltó a mano.
 */
export function proximoCampo(
  idPaso: IdPaso,
  ctx: CtxVoz,
  atendidos: ReadonlySet<string> = new Set(),
): CampoVoz | null {
  return (
    camposDelPaso(idPaso, ctx).find((c) => !atendidos.has(c.clave) && c.estaVacio(ctx)) ?? null
  );
}

/** Con una sola opción posible no hay nada que preguntar: se pone y se avisa. */
export function opcionUnicaAutomatica(campo: CampoVoz, ctx: CtxVoz): OpcionVoz | null {
  if (!campo.autoUnica || campo.tipo !== 'opcion' || !campo.opciones) return null;
  const ops = campo.opciones(ctx);
  return ops.length === 1 ? ops[0] : null;
}

/**
 * El campo que nombra un «corregir …», buscado por su etiqueta.
 *
 * Los DOS lados se normalizan con `normalizarVoz`: lo dicho llega sin tildes
 * (así lo entrega el comando), y una etiqueta con tilde («posición de la
 * cadena») no calzaba nunca — el asistente contestaba «no encontré ese campo»
 * a un pedido perfectamente claro.
 */
export function campoPorEtiqueta(idPaso: IdPaso, ctx: CtxVoz, dicho: string): CampoVoz | null {
  const campos = camposDelPaso(idPaso, ctx);
  const t = normalizarVoz(dicho);
  if (!t) return null;
  // Cuando varias etiquetas calzan, gana la MÁS LARGA: «la posición de la
  // cadena» contiene también la etiqueta 'cadena', y sin este orden el
  // corregir caía en el campo equivocado.
  const masLarga = (cs: CampoVoz[]) =>
    cs.sort((a, b) => b.etiqueta.length - a.etiqueta.length)[0] ?? null;
  return (
    campos.find((c) => normalizarVoz(c.etiqueta) === t) ??
    masLarga(campos.filter((c) => incluyePalabra(t, normalizarVoz(c.etiqueta)))) ??
    masLarga(campos.filter((c) => incluyePalabra(normalizarVoz(c.etiqueta), t))) ??
    // Último recurso: alguna palabra con peso de la etiqueta («corregir la
    // posición» encuentra 'posición de la cadena' aunque falte el resto).
    masLarga(
      campos.filter((c) =>
        normalizarVoz(c.etiqueta)
          .split(' ')
          .some((p) => p.length > 3 && incluyePalabra(t, p)),
      ),
    ) ??
    null
  );
}
