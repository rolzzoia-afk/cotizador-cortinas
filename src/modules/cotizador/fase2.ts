// Constantes y helpers específicos de Fase 2 (terreno).
// Portados desde public/legacy/index.html líneas 3096-4120.

import type { Pano, Ventana } from './types';

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
export const OPCIONES_LARGO_CADENA = ['0.75', '1mts', '3mts', '4mts', 'ROLLO'] as const;
export const OPCIONES_CIERRE_VERT = ['Izquierda', 'Derecha', 'Vertical', 'Medio'] as const;
export const OPCIONES_MANILLA_COLOR = ['NEG', 'BCO', 'CAFÉ'] as const;
export const OPCIONES_ACCESORIO_COLOR = ['MET', 'NEG', 'BCO', 'GRS'] as const;
export const OPCIONES_CENEFA = ['No', 'Ovalada', 'Cuadrada'] as const;
export const OPCIONES_CENEFA_TIRA = ['CON TIRA', 'SIN TIRA'] as const;
// El TIP. INST de la cenefa cuadrada sale de acá (alimenta el cuadro de la
// hoja de órdenes): MURO_MURO −0,5 · CON_1_TAPA +1 · CON_2_TAPAS +2.
// MURO_MURO es la opción base (reemplaza a "sin tapa": son lo mismo).
export const OPCIONES_CENEFA_TAPA = ['MURO_MURO', 'CON_1_TAPA', 'CON_2_TAPAS'] as const;
export const OPCIONES_COLOR_TAPA_OVALADA = ['NEG', 'BCO', 'GRS'] as const;
export const OPCIONES_COLOR_TAPA_CUADRADA = ['NEG', 'BCO', 'GRS', 'CAFÉ'] as const;
export const OPCIONES_SUPERFICIE = ['TECHO', 'PARED'] as const;
export const OPCIONES_MATERIAL_TIPO = ['VULCANITA', 'CONCRETO', 'MADERA'] as const;
export const OPCIONES_ORDEN_DOBLE = [
  { value: 'BK_VID_SCR', label: 'BK al vidrio · SCR por delante' },
  { value: 'SCR_VID_BK', label: 'SCR al vidrio · BK por delante' },
] as const;
export const OPCIONES_MECANISMO = [
  // Inventario bodega (default por color de accesorios — ver reglas-mecanismo.ts)
  'KIT SIMPLE NEGRO 38MM [MEC 32]',
  'KIT SIMPLE BLANCO 38MM [MEC 33]',
  'KIT SIMPLE GRIS 38MM [MEC 34]',
  // Legacy Excel / opciones manuales
  'LZ 38 MERG BCO [MEC 05]',
  'OVALADA NEG [MEC 09]',
  'OVALADA BCO [MEC 10]',
  'OVALADA BLANCO SOFT [MEC 39]',
  'LZ50 MERG BCO [MEC 06]',
  'LZ50 SFLX NGR [MEC 11]',
  'LZ50 SFLX GRIS [MEC 13]',
  'LZ50 SFLX BCO [MEC 14]',
  '0,45mm BCO [MEC 18]',
  '0,45mm NGR [MEC 23]',
  '0,63mm BCO [MEC 28]',
] as const;
export const OPCIONES_DUAL_LADO = ['DERECHO', 'IZQUIERDO', 'MIXTO'] as const;
export const OPCIONES_DUAL_COLOR = ['NEG', 'BCO', 'GRS'] as const;
export const OPCIONES_MOTOR_TIPO = [
  'CON CABLE',
  'INALAMB. SIN DOMO',
  'CON DOMÓTICA',
] as const;
export const OPCIONES_LADO_MOTOR = ['IZQUIERDA', 'DERECHA'] as const;
export const OPCIONES_SOFT_DARK = ['N/A', 'SOFT', 'DARK'] as const;
export const OPCIONES_INSTALACION = ['INT', 'SEMI', 'EXT', 'M-M', 'T-M', 'P-T'] as const;
export const OPCIONES_SEPARADOR = ['2.5cm', '3.0cm', '[U]'] as const;
export const OPCIONES_TUBERIA = [
  // Chips deben coincidir con REGLAS_TUBERIA (reglas-tuberia.ts)
  '0,38mm [E02] 1,2mm',
  '0,38mm [E66] 2mm',
  '0,40mm - 2mm [E53]',
  '0,45mm [E05]',
  '0,63mm [E47]',
  'VELCRO',
] as const;
export const OPCIONES_CORTES = ['Nada', 'Plumavit', 'Rodapié', 'Ambos'] as const;
export const OPCIONES_RELACION_MARCO = ['N/A', 'Dentro', 'Fuera'] as const;

// Factory: paño vacío con defaults del legacy (línea 3109-3124).
export function crearPanoVacio(): Pano {
  return {
    ancho: '',
    alto: '',
    armado: 'Interno',
    tipoTela: 'SCR',
    largoCadena: '',
    codCadena: '',
    codPeso: '',
    cierreVert: 'Derecha',
    manillaCant: 0,
    manillaColor: '',
    colorPeso: 'BCO',
    colorCadena: 'BCO',
    colorMecanismo: 'BCO',
    cenefa: 'No',
    cenefaTira: 'SIN TIRA',
    colorTapa: '',
    cenefaTapa: 'MURO_MURO',
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
    motorControlAdic: false,
    motorHubUsb: false,
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
