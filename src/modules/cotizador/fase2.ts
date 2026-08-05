// Constantes y helpers específicos de Fase 2 (terreno).
// Portados desde public/legacy/index.html líneas 3096-4120.

import type { Pano, Ventana } from './types';
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
export const OPCIONES_LARGO_CADENA = ['0.75', '1mts', '2.4mts', '3mts', '4mts', 'ROLLO'] as const;
export const OPCIONES_CIERRE_VERT = ['Izquierda', 'Derecha', 'Vertical', 'Medio'] as const;
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
