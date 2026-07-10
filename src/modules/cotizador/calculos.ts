import type { ItemFase1, Pano, Producto, Ventana } from './types';

// Formato CLP (Chile): sin decimales, punto como separador de miles.
export const formateadorCLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export function formatCLP(n: number): string {
  return formateadorCLP.format(Number.isFinite(n) ? n : 0);
}

// Tipos de producto que se cobran POR UNIDAD (no por m²).
const TIPOS_POR_UNIDAD = ['ACCESORIO', 'INSTALACION', 'SERVICIO'];

export function esPorUnidad(tipo: string): boolean {
  return TIPOS_POR_UNIDAD.includes((tipo || '').toUpperCase().trim());
}

export const MINIMO_M2 = 1.5;

// Cálculo de estimado Fase 1: ancho × alto (con mínimo 1.5 m²) × cantidad × precio.
// Si el tipo se cobra por unidad, ignora las medidas y usa 1 × cantidad × precio.
export function calcularEstimadoFase1(params: {
  tipo: string;
  ancho: number;
  alto: number;
  cantidad: number;
  precio: number;
}): { m2: number; totalM2: number; total: number } {
  const { tipo, ancho, alto, cantidad, precio } = params;
  const cant = cantidad > 0 ? cantidad : 1;
  let m2: number;
  if (esPorUnidad(tipo)) {
    m2 = 1;
  } else {
    const raw = ancho * alto;
    m2 = raw < MINIMO_M2 ? MINIMO_M2 : raw;
  }
  const totalM2 = m2 * cant;
  const total = totalM2 * (precio || 0);
  return { m2, totalM2, total };
}

// Cálculo de subtotal para una ventana en Fase 3.
// Suma el ancho de todos los paños × alto × precio (con mínimo 1.5 m²).
export function calcularSubtotalVentana(v: Ventana): {
  totalAncho: number;
  m2: number;
  subtotal: number;
} {
  const totalAncho = (v.panos || []).reduce((sum, p) => sum + (parseFloat(String(p.ancho)) || 0), 0);
  const raw = totalAncho * (v.alto || 0);
  const m2 = raw < MINIMO_M2 ? MINIMO_M2 : raw;
  const subtotal = m2 * (v.precio || 0);
  return { totalAncho, m2, subtotal };
}

// IVA Chile (hardcodeado en legacy, línea 4148).
export const IVA_RATE = 0.19;

// Total de cotización Fase 3 con IVA.
export function calcularTotalesFase3(ventanas: Ventana[]): {
  subtotal: number;
  iva: number;
  total: number;
} {
  const subtotal = ventanas.reduce((acc, v) => acc + calcularSubtotalVentana(v).subtotal, 0);
  const iva = subtotal * IVA_RATE;
  return { subtotal, iva, total: subtotal + iva };
}

// Convierte un ítem de Fase 1 a una Ventana completa (con pano por defecto).
// Portado de enviarFase1AFase2() líneas 4184-4208. Tela y colores de
// accesorios parten VACÍOS: fase0-sync los rellena con el dato real del ítem
// (los defaults duros 'SCR'/'BCO' enmascaraban el color/producto de Fase 0).
export function itemToVentana(item: ItemFase1): Ventana {
  const panoDefault: Pano = {
    ancho: item.ancho,
    alto: item.alto,
    color: item.color || 'Blanco',
    armado: 'Interno',
    tipoTela: '',
    largoCadena: '',
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
    comentarioFinal: '',
  };
  return {
    id: item.id,
    ubicacion: item.ubicacion,
    codInt: item.codInt,
    producto: item.producto,
    tipo: item.tipo,
    descripcion: '',
    color: item.color || 'Blanco',
    alto: item.alto,
    precio: item.precio,
    cantidad: 1,
    subtotal: 0,
    fase: 'cotizacion',
    categoria: item.categoria,
    grupoId: null,
    grupoOrden: 0,
    panos: [panoDefault],
  };
}

// Lookup de producto en el catálogo, aceptando espacios / case en la key.
export function buscarProducto(
  catalogo: Record<string, Producto>,
  codInt: string,
): Producto | undefined {
  if (!codInt) return undefined;
  const key = String(codInt).trim();
  return catalogo[key];
}
