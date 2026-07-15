// Constantes y helpers específicos de Fase 2 (terreno).
// Portados desde public/legacy/index.html líneas 3096-4120.

import type { Pano, Ventana } from './types';
import { DESCRIPCION_TUBERIA } from '@/modules/descuentos/reglas-tuberia';

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
export const OPCIONES_MANILLA_COLOR = ['NEG', 'BCO', 'CAFÉ'] as const;
export const OPCIONES_ACCESORIO_COLOR = ['MET', 'NEG', 'BCO', 'GRS'] as const;
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
export const OPCIONES_COLOR_TAPA_OVALADA = ['NEG', 'BCO', 'GRS'] as const;
// Sin gris: la tapa de cenefa cuadrada no existe en ese color (solo negro,
// blanco y café → TAP32/TAP33/TAP34).
export const OPCIONES_COLOR_TAPA_CUADRADA = ['NEG', 'BCO', 'CAFÉ'] as const;
export const OPCIONES_SUPERFICIE = ['TECHO', 'PARED'] as const;
export const OPCIONES_MATERIAL_TIPO = ['VULCANITA', 'CONCRETO', 'MADERA', 'CERÁMICA'] as const;
/** Tipo de bracket de la cenefa ovalada: corto (BRA01) o largo (BRA02). */
export const OPCIONES_BRACKET_TIPO = ['CORTO', 'LARGO'] as const;
export const OPCIONES_ORDEN_DOBLE = [
  { value: 'BK_VID_SCR', label: 'BK al vidrio · SCR por delante' },
  { value: 'SCR_VID_BK', label: 'SCR al vidrio · BK por delante' },
] as const;
export const OPCIONES_MECANISMO = [
  // Inventario bodega (default por color de accesorios — ver reglas-mecanismo.ts)
  'KIT SIMPLE NEGRO 38MM [MEC 32]',
  'KIT SIMPLE BLANCO 38MM [MEC 33]',
  'KIT SIMPLE GRIS 38MM [MEC 34]',
  // Kits reforzados (mismo tubo 38 mm; inventario MEC 40/41 - ROLZZO).
  'KIT REFORZADO NEGRO 38MM [MEC 40]',
  'KIT REFORZADO BLANCO 38MM [MEC 41]',
  // Kits bodega de cenefa ovalada por color (Dúo manual 38 / Soft Light 38 /
  // Roller cenefa ovalada 38; ver reglas-mecanismo.ts). Nemotécnicos de
  // inventario: MECANISMO OVALADO GRIS/NEGRO/BLANCO - ROLZZO.
  'OVALADA GRIS [MEC 12]',
  'OVALADA NEGRO [MEC 38]',
  'OVALADA BLANCO [MEC 39]',
  // Kits 45 mm (tubo E78) — banda 2,2–3,0 m por color y elección manual
  // (2026-07-14; antes eran legacy). MEC 18 DECORELLI · MEC 23 ROLZZO.
  '0,45mm BCO [MEC 18]',
  '0,45mm NGR [MEC 23]',
  // Fijo de Oscuranti 63 mm (regla de categoría).
  '0,63mm BCO [MEC 28]',
] as const;

// Chips MEC legacy del Excel: ya NO se ofrecen en el editor (al guardar,
// reglas-mecanismo.legacyReemplazar los cambia por kits de inventario), pero
// siguen en la lista de RESOLUCIÓN para que OTs viejas con estos chips
// guardados —o modelos MEC_XX cuyo color no mapea a kit (p.ej. TRANSPARENTE)—
// sigan mostrando su mecanismo en PDFs e inventario.
// (MEC 18/23 pasaron a la lista de UI 2026-07-14, junto con el tubo E78.)
export const CHIPS_MECANISMO_LEGACY = [
  'LZ 38 MERG BCO [MEC 05]',
  'OVALADA NEG [MEC 09]',
  'OVALADA BCO [MEC 10]',
  'LZ50 MERG BCO [MEC 06]',
  'LZ50 SFLX NGR [MEC 11]',
  'LZ50 SFLX GRIS [MEC 13]',
  'LZ50 SFLX BCO [MEC 14]',
] as const;

// Mecanismos dual (producto duo día/noche con dos rollers en un bracket).
// Formato cero-padded [MEC 01] para que modeloDesdeChipMecanismo encuentre el
// modelo ROLLER_DUAL 'MEC_01_DUAL_…' en el catálogo (descuentos_modelo).
export const OPCIONES_MECANISMO_DUAL = [
  'DUAL DERECHO BLANCO [MEC 01]',
  'DUAL IZQUIERDO BLANCO [MEC 02]',
  'DUAL DERECHO NEGRO [MEC 03]',
  'DUAL IZQUIERDO NEGRO [MEC 04]',
  'DUAL MIXTO BLANCO [MEC 19]',
  'DUAL MIXTO NEGRO [MEC 20]',
  'DUAL DERECHO GRIS [MEC 24]',
  'DUAL IZQUIERDO GRIS [MEC 25]',
] as const;

/** Lista completa para RESOLVER mecanismos (UI limpia + dual + legacy guardados). */
export const OPCIONES_MECANISMO_RESOLUCION = [
  ...OPCIONES_MECANISMO,
  ...OPCIONES_MECANISMO_DUAL,
  ...CHIPS_MECANISMO_LEGACY,
] as const;
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
export const OPCIONES_SOFT_DARK = ['N/A', 'SOFT', 'DARK'] as const;
export const OPCIONES_INSTALACION = ['INT', 'SEMI', 'EXT', 'M-M', 'T-M', 'P-T'] as const;
export const OPCIONES_SEPARADOR = ['2.5cm', '3.0cm', '[U]'] as const;
export const OPCIONES_TUBERIA = [
  // Descripciones largas por código (fuente única: DESCRIPCION_TUBERIA en
  // reglas-tuberia.ts). E53 (0,40mm - 2mm) se quitó 2026-07-08.
  DESCRIPCION_TUBERIA.E02, // 'E02-TUBO 1.2 / Ø 38 mm'
  DESCRIPCION_TUBERIA.E66, // 'E66 - TUBO (.40mm) - 2.5mm'
  DESCRIPCION_TUBERIA.E78, // 'E78 - TUBO 43MM(ESP1.2)(5.8)' — default 45 mm desde 2026-07-14
  DESCRIPCION_TUBERIA.E05, // 'E05 - TUBO Ø 45 mm' — histórico (en desuso), sigue seleccionable
  DESCRIPCION_TUBERIA.E47, // 'E47 - TUBO Ø 63 mm'
  DESCRIPCION_TUBERIA.E65, // 'E65 - TUBO (.63mm)' — default para roller >3 m
  'VELCRO',
] as const;
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
    cenefaTira: 'SIN TIRA',
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
    softDark: 'N/A',
    instalacion: '',
    separador: '',
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
