// Constantes y helpers específicos de Fase 2 (terreno).
// Portados desde public/legacy/index.html líneas 3096-4120.

import type { Pano, Ventana } from './types';
import { categoriaEsDual } from '@/modules/descuentos/tipos';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';
import {
  normalizarMontajeBase,
  normalizarPerforacion,
  type MedidasPerfilesOscuridad,
  type PerfilesOscuridad,
  type SuperficiePerfilKey,
} from '@/modules/descuentos/reglas-oscuridad';
import type { TipoPerfilAdicional } from '@/modules/descuentos/adicionales-perfil';
import {
  opcionesTuberiaResolucion,
  opcionesTuberiaUI,
} from '@/modules/descuentos/reglas-tuberia';
import {
  MECANISMOS_DUAL,
  chipsMecanismoOcultos,
  opcionesMecanismoResolucion,
  opcionesMecanismoUI,
} from '@/modules/descuentos/reglas-mecanismo';
import { coloresParaUso } from '@/modules/descuentos/coloresAccesorio';

export const TIPOS_VENTANA = [
  { value: 1, label: 'Simple', icono: '▯' },
  { value: 2, label: 'Doble', icono: '▯▯' },
  { value: 3, label: 'Triple', icono: '▯▯▯' },
  { value: 4, label: 'Cuádruple', icono: '▯▯▯▯' },
  { value: 5, label: '5 paños', icono: '▯▯▯▯▯' },
  { value: 6, label: '6 paños', icono: '▯▯▯▯▯▯' },
] as const;

// Colores por paño (línea 3096 legacy).
export const PANO_COLORS = [
  { name: 'Izquierdo', hex: '#22c55e' },
  { name: 'Derecho', hex: '#eab308' },
  { name: 'Paño 3', hex: '#3b82f6' },
  { name: 'Paño 4', hex: '#ef4444' },
  { name: 'Paño 5', hex: '#f97316' },
  { name: 'Paño 6', hex: '#a855f7' },
] as const;

// Opciones de selects/radios por campo.
export const OPCIONES_ARMADO = ['Interno', 'Externo'] as const;
export const OPCIONES_TIPO_TELA = ['SCR', 'BK', 'DU'] as const;
// Incluye '1.4mts' (la cadena corta de los altos 0,5–0,8 m): la
// auto-selección ya la elegía, pero el radio de respaldo —el que se usa cuando
// no hay catálogo de insumos cargado— no sabía mostrarla.
export const OPCIONES_LARGO_CADENA = [
  '0.75',
  '1mts',
  '1.4mts',
  '2.4mts',
  '3mts',
  '4mts',
  'ROLLO',
] as const;
// «Vertical» salió de las opciones el 2026-08-20: era un valor legacy sin
// destino en la DIRECC. CAD/CIERRE de Fase 3 (direccionDesdeCierre lo mapea a
// vacío). Si viene guardado en una OT vieja, los selectores lo conservan como
// opción extra para no esconder el dato.
export const OPCIONES_CIERRE_VERT = ['Izquierda', 'Derecha', 'Medio'] as const;
// Colores: DERIVADOS del catálogo (coloresAccesorio.ts), que dice en qué
// selector aparece cada uno. Estas cuatro listas son las de fábrica; Fase 2 usa
// las del catálogo guardado, que el admin puede ampliar con colores nuevos.
export const OPCIONES_MANILLA_COLOR = coloresParaUso('manilla');
export const OPCIONES_ACCESORIO_COLOR = coloresParaUso('accesorio');
// La cuadrada se separa por tipo de instalación (muro / techo). Las OTs
// viejas guardan 'Cuadrada' a secas: usar esCenefaCuadrada() para detectar
// cualquiera de las tres variantes.
export const OPCIONES_CENEFA = ['No', 'Ovalada', 'Cuadrada a muro', 'Cuadrada a techo'] as const;

/** ¿La cenefa del paño es cuadrada? ('Cuadrada a muro'/'a techo' o el 'Cuadrada' legacy). */
export function esCenefaCuadrada(cenefa: string | null | undefined): boolean {
  return (cenefa || '').trim().toUpperCase().startsWith('CUADRADA');
}
export const OPCIONES_CENEFA_TIRA = ['CON TIRA', 'SIN TIRA'] as const;
// El TIP. INST de la cenefa cuadrada sale de acá (alimenta el cuadro de la
// hoja de órdenes): MURO_MURO −0,5 · CON_1_TAPA +1 · CON_2_TAPAS +2.
// MURO_MURO es la opción base (reemplaza a "sin tapa": son lo mismo).
export const OPCIONES_CENEFA_TAPA = ['MURO_MURO', 'CON_1_TAPA', 'CON_2_TAPAS'] as const;
export const OPCIONES_COLOR_TAPA_OVALADA = coloresParaUso('tapaOvalada');
// Sin gris: la tapa de cenefa cuadrada no existe en ese color (solo negro,
// blanco y café → TAP32/TAP33/TAP34).
export const OPCIONES_COLOR_TAPA_CUADRADA = coloresParaUso('tapaCuadrada');
export const OPCIONES_SUPERFICIE = ['TECHO', 'PARED'] as const;

// ── Perfiles de los sistemas de oscuridad (bloque PERFILES de Fase 2) ──
export type LadoPerfilOscuridad = 'izq' | 'der' | 'inf';
export type SuperficiePerfilOscuridad = 'muro' | 'piso' | 'marco';

/**
 * Apaga el PERFIL BASE por completo: su marca, la superficie elegida, las tres
 * medidas manuales y el separador base (que hereda la medida del base y, sin
 * base, quedaría pendiente bloqueando el avance de Fase 2).
 */
export function parcheApagarPerfilBase(): Partial<Pano> {
  return {
    perfilInfActivo: false,
    perfilInfMuro: false,
    perfilInfPiso: false,
    perfilInfMarco: false,
    perfilInfMuroCm: undefined,
    perfilInfPisoCm: undefined,
    perfilInfMarcoCm: undefined,
    separadorInf: false,
    separadorInfCm: undefined,
  };
}

/**
 * Parche del paño al elegir la instalación de un perfil de oscuridad. La
 * superficie es un radio exclusivo: activa el perfil, apaga las otras dos
 * superficies y limpia sus medidas manuales.
 *
 * Regla 2026-07-30: un LATERAL a PISO baja hasta el suelo, así que el perfil
 * base deja de existir y se apaga solo (aplica a todas las familias de
 * oscuridad). Es una ayuda, no un bloqueo: se puede volver a encender a mano.
 */
export function parcheSuperficiePerfil(
  lado: LadoPerfilOscuridad,
  superficie: SuperficiePerfilOscuridad,
): Partial<Pano> {
  const L = lado === 'izq' ? 'Izq' : lado === 'der' ? 'Der' : 'Inf';
  const patch: Record<string, unknown> = {
    [`perfil${L}Activo`]: true,
    [`perfil${L}Muro`]: superficie === 'muro',
    [`perfil${L}Piso`]: superficie === 'piso',
    [`perfil${L}Marco`]: superficie === 'marco',
  };
  if (superficie !== 'muro') patch[`perfil${L}MuroCm`] = undefined;
  if (superficie !== 'piso') patch[`perfil${L}PisoCm`] = undefined;
  if (superficie !== 'marco') patch[`perfil${L}MarcoCm`] = undefined;
  if (superficie === 'piso' && lado !== 'inf') Object.assign(patch, parcheApagarPerfilBase());
  return patch as Partial<Pano>;
}

/**
 * Un perfil de oscuridad POR LADO (izq / der / base): qué campos del paño le
 * pertenecen. Es UNA tabla para la ficha (PanoEditor) y el paso «Perfiles» del
 * wizard de terreno — dos copias terminarían divergiendo campo a campo.
 */
export type LadoPerfil = {
  side: LadoPerfilOscuridad;
  label: string;
  activo: keyof Pano;
  perf: keyof Pano;
  muro: keyof Pano;
  piso: keyof Pano;
  marco: keyof Pano;
  muroKey: SuperficiePerfilKey;
  pisoKey: SuperficiePerfilKey;
  marcoKey: SuperficiePerfilKey;
  muroCm: keyof Pano;
  pisoCm: keyof Pano;
  marcoCm: keyof Pano;
  tipoAdic: TipoPerfilAdicional;
  /** Separador (E41/E42/E43) del mismo lado. */
  sepActivo: keyof Pano;
  sepCm: keyof Pano;
  sepColumna: string;
};

export const PERFILES_LADO: readonly LadoPerfil[] = [
  { side: 'izq', label: 'Perfil izquierdo', activo: 'perfilIzqActivo', perf: 'perfilIzqPerf', muro: 'perfilIzqMuro', piso: 'perfilIzqPiso', marco: 'perfilIzqMarco', muroKey: 'izqMuro', pisoKey: 'izqPiso', marcoKey: 'izqMarco', muroCm: 'perfilIzqMuroCm', pisoCm: 'perfilIzqPisoCm', marcoCm: 'perfilIzqMarcoCm', tipoAdic: 'izq', sepActivo: 'separadorIzq', sepCm: 'separadorIzqCm', sepColumna: 'SEPARADOR (IZQ)' },
  { side: 'der', label: 'Perfil derecho', activo: 'perfilDerActivo', perf: 'perfilDerPerf', muro: 'perfilDerMuro', piso: 'perfilDerPiso', marco: 'perfilDerMarco', muroKey: 'derMuro', pisoKey: 'derPiso', marcoKey: 'derMarco', muroCm: 'perfilDerMuroCm', pisoCm: 'perfilDerPisoCm', marcoCm: 'perfilDerMarcoCm', tipoAdic: 'der', sepActivo: 'separadorDer', sepCm: 'separadorDerCm', sepColumna: 'SEPARADOR (DER)' },
  { side: 'inf', label: 'Perfil base', activo: 'perfilInfActivo', perf: 'perfilInfPerf', muro: 'perfilInfMuro', piso: 'perfilInfPiso', marco: 'perfilInfMarco', muroKey: 'infMuro', pisoKey: 'infPiso', marcoKey: 'infMarco', muroCm: 'perfilInfMuroCm', pisoCm: 'perfilInfPisoCm', marcoCm: 'perfilInfMarcoCm', tipoAdic: 'inf', sepActivo: 'separadorInf', sepCm: 'separadorInfCm', sepColumna: 'SEPARADOR BASE' },
] as const;

export const OPCIONES_PERFORACION = [
  { value: 'INTERNO', label: 'Int' },
  { value: 'EXTERNO', label: 'Ext' },
] as const;

// Superficie del perfil = MEDIDA. Muro = alto+10; piso y marco = alto real. La
// opción "Dentro del marco" solo se ofrece en sistemas INTERNOS.
export const OPCIONES_SUPERFICIE_PERFIL = [
  { value: 'muro', label: 'Muro', soloInterno: false },
  { value: 'piso', label: 'Piso', soloInterno: false },
  { value: 'marco', label: 'Dentro del marco', soloInterno: true },
] as const;

// Montaje del perfil base (solo soft light INTERNO): entre los laterales (más
// corto, ancho − 13,3) o de pared a pared (ancho completo).
export const OPCIONES_MONTAJE_BASE = [
  { value: 'DENTRO', label: 'Dentro de perfiles' },
  { value: 'PARED', label: 'Pared a pared' },
] as const;

export const OPCIONES_VARIANTE_OSCURIDAD = [
  { value: 'INTERNO', label: 'Interno' },
  { value: 'SEMI', label: 'Semi' },
  { value: 'EXTERNO', label: 'Externo' },
] as const;

/**
 * Los campos de perfiles de oscuridad del paño, con la forma que consume el
 * despiece (`cortesOscuridad`). Una sola traducción Pano → PerfilesOscuridad
 * para la ficha, el paso «Perfiles» del wizard y el cálculo de su avance.
 *
 * OJO: los flags viajan CRUDOS (sin `!!`): `undefined` significa «sin definir»
 * y deja que `aplicarDefaultsPerfiles` active los laterales según la variante —
 * exactamente como `contextoDespieceDesdePano` (el despiece del Excel). Un
 * `false` explícito (el vendedor lo desactivó) sí se respeta.
 */
export function perfilesOscuridadDePano(p: Pano): PerfilesOscuridad {
  return {
    izqMuro: p.perfilIzqMuro,
    izqPiso: p.perfilIzqPiso,
    izqMarco: p.perfilIzqMarco,
    derMuro: p.perfilDerMuro,
    derPiso: p.perfilDerPiso,
    derMarco: p.perfilDerMarco,
    infMuro: p.perfilInfMuro,
    infPiso: p.perfilInfPiso,
    infMarco: p.perfilInfMarco,
    izqActivo: p.perfilIzqActivo,
    derActivo: p.perfilDerActivo,
    infActivo: p.perfilInfActivo,
    izqPerf: normalizarPerforacion(p.perfilIzqPerf),
    derPerf: normalizarPerforacion(p.perfilDerPerf),
    infPerf: normalizarPerforacion(p.perfilInfPerf),
    infMontaje: normalizarMontajeBase(p.perfilInfMontaje),
    sepIzq: p.separadorIzq,
    sepDer: p.separadorDer,
    sepInf: p.separadorInf,
  };
}

/** Overrides de medida de los perfiles y separadores, tal como los guarda el paño. */
export function medidasPerfilesDePano(p: Pano): MedidasPerfilesOscuridad {
  return {
    izqMuro: p.perfilIzqMuroCm,
    izqPiso: p.perfilIzqPisoCm,
    izqMarco: p.perfilIzqMarcoCm,
    derMuro: p.perfilDerMuroCm,
    derPiso: p.perfilDerPisoCm,
    derMarco: p.perfilDerMarcoCm,
    infMuro: p.perfilInfMuroCm,
    infPiso: p.perfilInfPisoCm,
    infMarco: p.perfilInfMarcoCm,
    sepIzq: p.separadorIzqCm,
    sepDer: p.separadorDerCm,
    sepInf: p.separadorInfCm,
  };
}

export const OPCIONES_MATERIAL_TIPO = ['VULCANITA', 'CONCRETO', 'MADERA', 'CERÁMICA'] as const;
/** Tipo de bracket de la cenefa ovalada: corto (BRA01) o largo (BRA02). */
export const OPCIONES_BRACKET_TIPO = ['CORTO', 'LARGO'] as const;
export const OPCIONES_ORDEN_DOBLE = [
  { value: 'BK_VID_SCR', label: 'BK al vidrio · SCR por delante' },
  { value: 'SCR_VID_BK', label: 'SCR al vidrio · BK por delante' },
] as const;
// Las listas de chips se DERIVAN del catálogo de reglas-mecanismo.ts (valores
// de fábrica). Admin puede editarlo: en ese caso las páginas usan las listas de
// `derivarOpciones(reglas)` en vez de estas constantes.
/** Chips de mecanismo que se ofrecen en el editor de paño. */
export const OPCIONES_MECANISMO = opcionesMecanismoUI();

/** Chips MEC legacy: ya no se ofrecen, pero se siguen resolviendo. */
export const CHIPS_MECANISMO_LEGACY = chipsMecanismoOcultos();

/** Mecanismos dual (producto dúo día/noche con dos rollers en un bracket). */
export const OPCIONES_MECANISMO_DUAL = MECANISMOS_DUAL;

/** Lista completa para RESOLVER mecanismos (UI limpia + dual + legacy guardados). */
export const OPCIONES_MECANISMO_RESOLUCION = opcionesMecanismoResolucion();
export const OPCIONES_DUAL_LADO = ['DERECHO', 'IZQUIERDO', 'MIXTO'] as const;
export const OPCIONES_DUAL_COLOR = ['NEG', 'BCO', 'GRS'] as const;
// Tipo de mecanismo: simple (kits 32/33/34 por color) o dual (los 8 de arriba).
export const OPCIONES_TIPO_MECANISMO = [
  { value: 'SIMPLE', label: 'Simple' },
  { value: 'DUAL', label: 'Dual' },
] as const;
// Legacy: OTs viejas guardan motorTipo con estos textos (se leen, ya no se ofrecen).
export const OPCIONES_MOTOR_TIPO = [
  'CON CABLE',
  'INALAMB. SIN DOMO',
  'CON DOMÓTICA',
] as const;
// Modelo de motor (todos inalámbricos hoy; 'CABLE' queda para el futuro sin códigos).
export const OPCIONES_MOTOR_MODELO = [
  { value: 'DOM41', label: 'Inalámbrico [DOM41]' },
  { value: 'DOM38', label: 'Tronic Plus [DOM38]' },
  { value: 'CABLE', label: 'Con cable' },
] as const;
export const OPCIONES_LADO_MOTOR = ['IZQUIERDA', 'DERECHA'] as const;
// Descripciones largas por código, derivadas del catálogo `tubos` de
// reglas-tuberia.ts + las pseudo-tuberías VELCRO/VERTICAL al final. Un tubo
// marcado 'oculto' desaparece de acá pero se sigue resolviendo (así se retiró
// el E53 en 2026-07-08).
export const OPCIONES_TUBERIA = opcionesTuberiaUI();

/** Lista completa para RESOLVER tuberías (incluye las ocultas). */
export const OPCIONES_TUBERIA_RESOLUCION = opcionesTuberiaResolucion();
export const OPCIONES_CORTES = ['Nada', 'Plumavit', 'Rodapié', 'Ambos'] as const;
export const OPCIONES_RELACION_MARCO = ['N/A', 'Dentro', 'Fuera'] as const;
// Suplemento seleccionable (opcional). '' = sin suplemento.
export const OPCIONES_SUPLEMENTO = [
  { value: 'SUB01', label: 'Madera 3 mm [SUB01]' },
  { value: 'SUB02', label: 'Acrílico 1,5 cm [SUB02]' },
] as const;

// Factory: paño vacío. Tela y colores de accesorios parten VACÍOS para que
// fase0-sync los rellene con el producto/color REAL de la ventana (los
// defaults duros 'SCR'/'BCO' del legacy enmascaraban el dato de Fase 0).
export function crearPanoVacio(): Pano {
  return {
    ancho: '',
    alto: '',
    armado: 'Interno',
    tipoTela: '',
    largoCadena: '',
    codCadena: '',
    codPeso: '',
    cierreVert: 'Derecha',
    manillaCant: 0,
    manillaColor: '',
    colorPeso: '',
    colorCadena: '',
    colorMecanismo: '',
    cenefa: 'No',
    // Sin dato: la tira ovalada se resuelve con default CON TIRA (tiraCenefaOvalada).
    cenefaTira: '',
    colorTapa: '',
    cenefaTapa: 'MURO_MURO',
    bracketTipo: '',
    retiro: 0,
    superficie: '',
    materialTipo: '',
    ordenDoble: false,
    ordenDobleOpcion: '',
    mecanismo: '',
    tuberia: '',
    dual: false,
    dualLado: '',
    dualColor: '',
    motorTipo: '',
    motorModelo: '',
    motorDomotica: false,
    motorControlAdic: false,
    motorHubUsb: false,
    motorControlAdicCant: 0,
    motorHubUsbCant: 0,
    ladoMotor: '',
    cortes: '',
    verVideo: false,
    relacionMarco: '',
    alturaCierre: '',
    cotizarConSin: '',
    suplementos: '',
    suplementoTipo: '',
    comentarioFinal: '',
    color: '',
  };
}

// ═══════════════════════════════════════════════════════════
// DUAL: dos telas en UNA cortina
// ═══════════════════════════════════════════════════════════

/** Paños de una dual: un rollo por tela, los dos en el mismo bracket. */
export const PANOS_DUAL = 2;

/**
 * Lo único que NO comparten los dos rollos de una dual: su tela y el lado de su
 * cadena (el kit MIXTO lleva una por lado). Todo el resto —medidas, bracket,
 * herrajes, cenefa, instalación— es de la cortina, no del rollo, así que el
 * editor lo escribe en los dos paños a la vez.
 */
export const CAMPOS_PROPIOS_DEL_ROLLO = [
  'codInt',
  'producto',
  'descripcion',
  'tipoTela',
  'cierreVert',
] as const;

const PROPIOS_DEL_ROLLO = new Set<string>(CAMPOS_PROPIOS_DEL_ROLLO);

/** ¿Este campo es de UN rollo de la dual (y no de la cortina entera)? */
export function esCampoPropioDelRollo(campo: string): boolean {
  return PROPIOS_DEL_ROLLO.has(campo);
}

/** El otro rollo de la dual: misma ficha (comparten ventana, bracket, herrajes
 *  y medidas), tela en blanco — cada rollo lleva la suya. */
function panoHermanoDual(p: Pano | undefined): Pano {
  const base = p ? { ...p } : crearPanoVacio();
  return { ...base, dual: true, codInt: '', producto: '', descripcion: '', tipoTela: '' };
}

/**
 * Completa los paños que la dual necesita por diseño: DOS (screen al vidrio +
 * blackout). El segundo se crea con la ficha del primero y sin su tela.
 *
 * Sin esto, una dual cargada en Terreno quedaba con un solo rollo —el control
 * «cantidad de paños» se sacó del editor en 2026-07-09— y el vendedor terminaba
 * partiéndola en DOS cortinas: doble kit dual, doble juego de fijaciones y dos
 * instalaciones cobradas (2026-08-20).
 */
export function asegurarPanosDual(v: Ventana, tipos?: readonly TipoCortina[]): Ventana {
  if (!categoriaEsDual(v.categoria || '', tipos)) return v;
  const panos = v.panos || [];
  if (panos.length >= PANOS_DUAL) return v;
  const extra: Pano[] = [];
  while (panos.length + extra.length < PANOS_DUAL) extra.push(panoHermanoDual(panos[0]));
  return { ...v, panos: [...panos, ...extra] };
}

/**
 * Contraparte de `asegurarPanosDual` al cambiar a un sistema de UNA tela: saca
 * el paño que la dual había creado sola y baja el flag `dual` de los que quedan
 * (si no, el BOM seguía emitiendo el bracket dual en una cortina simple).
 *
 * El paño solo se va si NUNCA recibió tela propia: lo que el vendedor alcanzó a
 * cargar no se borra por cambiar de categoría.
 *
 * NO llamarla si el destino es BEEBLACK: ahí `dual` significa DOBLE (blackout +
 * mosquitero sobre la misma estructura) y bajarlo cambiaría su kit.
 */
export function quitarPanoDualAutomatico(v: Ventana): Ventana {
  const panos = v.panos || [];
  const sobra = panos.length === PANOS_DUAL && !String(panos[1]?.codInt ?? '').trim();
  const quedan = sobra ? panos.slice(0, 1) : panos;
  return {
    ...v,
    panos: quedan.map((p) => (p.dual ? { ...p, dual: false, dualLado: '', dualColor: '' } : p)),
  };
}

// Ajusta el array de paños al nuevo tamaño N (1-6).
export function ajustarPanos(panos: Pano[], n: number): Pano[] {
  const next = [...panos];
  while (next.length < n) next.push(crearPanoVacio());
  while (next.length > n) next.pop();
  return next;
}

// Display: "Doble", "Triple", etc. según cantidad de paños.
export function tipoVentanaLabel(n: number): string {
  const t = TIPOS_VENTANA.find((x) => x.value === n);
  return t ? t.label : `${n} paños`;
}

/**
 * Rótulo de la lista de cortinas. La dual cuenta ROLLOS y no paños: decir
 * «Doble» ahí sonaba a dos cortinas —justo la confusión que la hace cargarse
 * partida en dos— y de paso deja a la vista la que quedó con un solo rollo.
 */
export function etiquetaPanos(n: number, esDual: boolean): string {
  if (!esDual) return tipoVentanaLabel(n);
  return `Dual (${n} ${n === 1 ? 'rollo' : 'rollos'})`;
}

// Resumen textual de paños: "100cm·SCR | 150cm·BK".
export function resumenPanos(panos: Pano[]): string {
  return (panos || [])
    .map((p) => {
      const ancho = parseFloat(String(p.ancho)) || 0;
      const anchoCm = (ancho * 100).toFixed(0);
      const tela = p.tipoTela || '—';
      return `${anchoCm}cm·${tela}`;
    })
    .join(' | ');
}

// Valida que una ventana esté lista para guardar (ancho+alto > 0 en cada paño).
export function validarVentana(
  ventana: Partial<Ventana>,
  opts?: { requiereMecanismo?: boolean },
): string | null {
  if (!ventana.ubicacion || !ventana.ubicacion.trim()) return 'Ingresa una ubicación';
  if (!ventana.categoria) return 'Selecciona una categoría';
  const panos = ventana.panos || [];
  if (panos.length === 0) return 'Debe haber al menos 1 paño';
  for (let i = 0; i < panos.length; i++) {
    const p = panos[i];
    const ancho = parseFloat(String(p.ancho));
    const alto = parseFloat(String(p.alto));
    if (!ancho || ancho <= 0) return `Paño ${i + 1}: ingresa el ancho`;
    if (!alto || alto <= 0) return `Paño ${i + 1}: ingresa el alto`;
    if (opts?.requiereMecanismo && !(p.mecanismo as string)?.trim()) {
      return `Paño ${i + 1}: selecciona el mecanismo`;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// POST-INSTALACIÓN
// ═══════════════════════════════════════════════════════════
export const POST_CHECKLIST_PREGUNTAS = [
  '¿El producto fue instalado correctamente?',
  '¿Las cortinas suben y bajan sin problemas?',
  '¿Los colores coinciden con lo solicitado?',
  '¿Las posiciones de cadena/cierre son correctas?',
  '¿Las cenefas están instaladas correctamente?',
  '¿Los motores funcionan correctamente?',
  '¿El soft light / dark roller funciona bien?',
  '¿Las medidas son correctas?',
  '¿No hay manchas ni defectos en las telas?',
  '¿Los mecanismos funcionan suavemente?',
  '¿El cliente quedó conforme con la instalación?',
] as const;

export const POST_ENCUESTA_PREGUNTAS = [
  '¿Cómo califica el servicio de instalación?',
  '¿Cómo califica la atención del vendedor?',
  '¿Recomendaría nuestros productos?',
  '¿Qué podemos mejorar?',
  'Comentarios adicionales',
  '¿Cómo nos conoció?',
] as const;

export type PostInstalacionData = {
  checks: boolean[];
  encuesta: string[];
  observaciones: string;
};

export function postInstalacionVacia(): PostInstalacionData {
  return {
    checks: Array(POST_CHECKLIST_PREGUNTAS.length).fill(false),
    encuesta: Array(POST_ENCUESTA_PREGUNTAS.length).fill(''),
    observaciones: '',
  };
}
