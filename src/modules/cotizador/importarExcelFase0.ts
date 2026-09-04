// ─────────────────────────────────────────────────────────────────────
// Importación de cotizaciones desde Excel hacia la grilla de Fase 0.
//
// El operario adjunta la planilla "INFORMACIÓN DEL PRODUCTO" (mismas
// columnas que la grilla: COD, COD SEC, DIRECC. CAD/CIERRE, SENT. CORT,
// CANT, PRODUCTO, COD_INT, TIPO, DESCRIPCIÓN, UBIC., COLOR ACCESORIOS,
// ANCHO, ALTO) y las filas se cargan en la tabla para seguir cotizando.
//
// Solo se leen los datos "llave": COD_INT (que dispara COD/PRODUCTO/TIPO/
// DESCRIPCIÓN vía catálogo) más los campos editables (mecanismo, dirección,
// sentido, cantidad, ubicación, color, ancho y alto). Las columnas
// derivadas del catálogo (COD, PRODUCTO, TIPO, DESCRIPCIÓN) se ignoran.
//
// El PARSEO lee todas las columnas que encuentre; lo que cambia por fase es qué
// se EXIGE (ver `validarFilaFase0` y su opción `modo`): en Fase 1 la grilla no
// muestra COD SEC / DIRECC. CAD-CIERRE / SENT. CORT —se capturan en Terreno—, así
// que una planilla mínima (COD_INT, UBIC., ANCHO, ALTO) entra sin nada en rojo.
//
// ANCHO y ALTO vienen en METROS, en formato es-CL (coma decimal: "2,720").
//
// Lógica pura (sin React/Supabase) para poder testearla.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import { esCategoriaPletina, esCategoriaVertical } from '@/modules/descuentos/reglas-mecanismo';
import { esCategoriaBeeblack, esCodigoBeeblack } from '@/modules/descuentos/reglas-beeblack';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';

export type FilaImportadaFase0 = {
  codInt: string;
  categoria: string; // COD SEC (mecanismo)
  direccion: string; // DIRECC. CAD/CIERRE — en beeblack, la columna CIERRE
  sentido: string; // SENT. CORT
  cantidad: number;
  ubicacion: string; // UBIC.
  colorAcc: string; // COLOR ACCESORIOS
  ancho: number; // metros
  alto: number; // metros
  /** BEEBLACK: columna TIPO (SIMPLE | DOBLE). DOBLE = blackout + mosquitero. */
  tipoSimpleDoble: string;
};

// Adicional importado (instalaciones, cenefas, motores, controles, traslados…).
// Solo lleva los datos llave; el ancho/alto NO aplican (se ignoran). La
// cantidad admite decimales (ej. metros de cenefa: 2,694).
export type FilaAdicionalImportada = {
  codInt: string;
  cantidad: number;
  ubicacion: string;
  colorAcc: string;
};

export type ResultadoImportFase0 = {
  cortinas: FilaImportadaFase0[];
  adicionales: FilaAdicionalImportada[];
  /** N° de OT del Excel manual ("OT CLIENTE: 3085" del encabezado); '' si no viene. */
  otCliente: string;
  /**
   * La OT DETALLADA de la banda del título («N° COTJS - 07979-5 -1 -
   * VISITA-VERTICALES Y DUAL CON CENEFA CUADRADA»): texto libre que la
   * vendedora escribe bajo el título. '' si la planilla la trae en blanco.
   */
  otDetallada: string;
};

/** Campos llave que pueden quedar "en rojo" para corregir a mano. */
export type CampoFase0 = 'codInt' | 'categoria' | 'direccion' | 'sentido' | 'ancho' | 'alto';

// Normaliza un encabezado: mayúsculas, sin acentos, solo alfanumérico.
// Así "DIRECC. CAD/CIERRE" → "DIRECCCADCIERRE" y "UBIC." → "UBIC".
// Exportado para reusar en otros importadores (ej. importarExcelJefe.ts).
export const norm = (s: unknown): string =>
  String(s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '');

// Encabezado normalizado → campo de la fila. Conviven los dos formatos de la
// planilla "Formato de Cotizacion": el estándar (COD SEC / DIRECC. CAD/CIERRE /
// SENT. CORT) y el de BEEBLACK, que renombró esas mismas columnas a TIPO DE
// INSTALACIÓN / CIERRE / TIPO. Gana la primera columna que reclama cada campo.
// TIPO DE INSTALACIÓN queda a propósito sin mapear: sus 5 valores no son los
// tipos reales de instalación (pizarra 2026-07-30), que se eligen en Fase 2.
const COLUMNAS: Record<string, keyof FilaImportadaFase0> = {
  CODSEC: 'categoria',
  DIRECCCADCIERRE: 'direccion',
  CIERRE: 'direccion',
  SENTCORT: 'sentido',
  CANT: 'cantidad',
  CODINT: 'codInt',
  UBIC: 'ubicacion',
  COLORACCESORIOS: 'colorAcc',
  ANCHO: 'ancho',
  ALTO: 'alto',
};

// La columna TIPO no se puede mapear por nombre: la planilla estándar ya usa
// TIPO para PREMIUM/DELUX y la de beeblack tiene DOS columnas TIPO (simple/doble
// y premium/delux). Se resuelve por VALOR: solo SIMPLE y DOBLE cuentan.
const VALORES_SIMPLE_DOBLE = ['SIMPLE', 'DOBLE'];
const esValorSimpleDoble = (v: unknown): boolean => VALORES_SIMPLE_DOBLE.includes(norm(v));

/**
 * Categoría deducida del COD_INT cuando la planilla no trae COD SEC: la de
 * beeblack renombró esa columna, pero sus telas tienen prefijo propio
 * (BEE-BK / BEE-SC / BEE-TRAS…). '' si no se puede deducir.
 */
export function categoriaImplicita(codInt: string | undefined): string {
  return esCodigoBeeblack(codInt) ? 'BEEBLACK' : '';
}

// Convierte un valor de medida es-CL a número en metros.
// La coma es SIEMPRE separador decimal; el punto (si coexiste) es de miles.
// Exportado para reusar en otros importadores (ej. importarExcelJefe.ts).
export function metros(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').trim();
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function entero(v: unknown): number {
  const n = Math.round(metros(v));
  return n >= 1 ? n : 1;
}

// Cantidad de un adicional: admite decimales (ej. metros de cenefa 2,694).
function cantidadAdic(v: unknown): number {
  const n = metros(v);
  return n > 0 ? n : 1;
}

const texto = (v: unknown): string => String(v ?? '').trim();

// Fila separadora "ADICIONALES" (rótulo de la sección de adicionales en la
// planilla). De ahí para abajo, las filas son adicionales, no cortinas.
const esSeparadorAdicionales = (r: unknown[]): boolean =>
  (r || []).some((c) => norm(c).startsWith('ADICIONALES'));

// N° de OT del encabezado del Excel manual: celda rotulada "OT CLIENTE"
// (fila 16 del Formato de Cotización) con el número en la celda siguiente
// no vacía de la misma fila. Solo se busca ARRIBA de la tabla de productos.
function otClienteDeEncabezado(matriz: unknown[][], headerIdx: number): string {
  for (let i = 0; i < headerIdx; i++) {
    const r = matriz[i] || [];
    for (let c = 0; c < r.length; c++) {
      if (!norm(r[c]).includes('OTCLIENTE')) continue;
      for (let k = c + 1; k < r.length; k++) {
        const v = texto(r[k]);
        // La primera celda con contenido a la derecha es el número; si no
        // trae ningún dígito es otro rótulo ("FECHA COTIZACIÓN") → sin OT.
        if (v) return /\d/.test(v) ? v : '';
      }
    }
  }
  return '';
}

/**
 * La OT detallada de la banda del título: en el «Formato de Cotización» es la
 * celda que va JUSTO ARRIBA de la fila del cliente (la del rótulo "NOMBRE"),
 * debajo del título. Se busca así —y no por rótulo— porque no tiene ninguno.
 * Para no confundirla con el título («COTIZACION», «LINEA PREMIUM…») se exige
 * que traiga algún dígito y un largo de OT; si no calza, se devuelve vacío y
 * la vendedora la escribe a mano.
 */
function otDetalladaDeBanda(matriz: unknown[][], headerIdx: number): string {
  let filaNombre = -1;
  for (let i = 0; i < headerIdx; i++) {
    if ((matriz[i] || []).some((c) => norm(c) === 'NOMBRE')) {
      filaNombre = i;
      break;
    }
  }
  if (filaNombre <= 0) return '';
  for (let i = filaNombre - 1; i >= 0 && i >= filaNombre - 3; i--) {
    for (const celda of matriz[i] || []) {
      const v = texto(celda);
      if (v.length >= 8 && /\d/.test(v)) return v;
    }
  }
  return '';
}

/**
 * Parsea la hoja de la cotización y separa las filas en CORTINAS y
 * ADICIONALES, usando la fila rótulo "ADICIONALES" como límite (todo lo que
 * está debajo son adicionales). Detecta automáticamente la fila de
 * encabezados (la que contiene COD_INT y ANCHO), tolerando filas de
 * título/logo arriba de la tabla; si la primera hoja no tiene la tabla,
 * busca en las demás (así se puede adjuntar el .xlsm maestro completo).
 * También rescata el N° de OT manual del encabezado ("OT CLIENTE: 3085").
 */
export function parsearExcelFase0(wb: XLSX.WorkBook): ResultadoImportFase0 {
  const vacio: ResultadoImportFase0 = {
    cortinas: [],
    adicionales: [],
    otCliente: '',
    otDetallada: '',
  };

  let matriz: unknown[][] = [];
  let headerIdx = -1;
  for (const nombre of wb.SheetNames) {
    const ws = wb.Sheets[nombre];
    if (!ws) continue;
    const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];
    for (let i = 0; i < m.length; i++) {
      const claves = new Set((m[i] || []).map(norm));
      if (claves.has('CODINT') && claves.has('ANCHO')) {
        matriz = m;
        headerIdx = i;
        break;
      }
    }
    if (headerIdx >= 0) break;
  }
  if (headerIdx < 0) return vacio;

  const otCliente = otClienteDeEncabezado(matriz, headerIdx);
  const otDetallada = otDetalladaDeBanda(matriz, headerIdx);

  const colDe = new Map<number, keyof FilaImportadaFase0>();
  const idxTipo: number[] = [];
  (matriz[headerIdx] || []).forEach((h, idx) => {
    if (norm(h) === 'TIPO') idxTipo.push(idx);
    const campo = COLUMNAS[norm(h)];
    if (campo && !Array.from(colDe.values()).includes(campo)) colDe.set(idx, campo);
  });

  const cortinas: FilaImportadaFase0[] = [];
  const adicionales: FilaAdicionalImportada[] = [];
  let enAdicionales = false;

  for (let i = headerIdx + 1; i < matriz.length; i++) {
    const r = matriz[i];
    if (!r) continue;

    // Al toparse con el rótulo "ADICIONALES", el resto de la hoja son adicionales.
    if (!enAdicionales && esSeparadorAdicionales(r)) {
      enAdicionales = true;
      continue;
    }

    if (enAdicionales) {
      const a: FilaAdicionalImportada = { codInt: '', cantidad: 1, ubicacion: '', colorAcc: '' };
      for (const [idx, campo] of colDe) {
        const v = r[idx];
        if (campo === 'codInt') a.codInt = texto(v);
        else if (campo === 'cantidad') a.cantidad = cantidadAdic(v);
        else if (campo === 'ubicacion') a.ubicacion = texto(v);
        else if (campo === 'colorAcc') a.colorAcc = texto(v);
        // ancho/alto/categoria/direccion/sentido NO aplican a adicionales.
      }
      if (!a.codInt) continue; // salta filas vacías
      adicionales.push(a);
      continue;
    }

    const f: FilaImportadaFase0 = {
      codInt: '',
      categoria: '',
      direccion: '',
      sentido: '',
      cantidad: 1,
      ubicacion: '',
      colorAcc: '',
      ancho: 0,
      alto: 0,
      tipoSimpleDoble: '',
    };
    for (const [idx, campo] of colDe) {
      const v = r[idx];
      if (campo === 'ancho' || campo === 'alto') f[campo] = metros(v);
      else if (campo === 'cantidad') f.cantidad = entero(v);
      else f[campo] = texto(v);
    }
    // TIPO por valor: la primera columna TIPO que diga SIMPLE o DOBLE (las que
    // traen PREMIUM/DELUX se ignoran).
    for (const idx of idxTipo) {
      if (esValorSimpleDoble(r[idx])) {
        f.tipoSimpleDoble = norm(r[idx]);
        break;
      }
    }
    // En la planilla ESTÁNDAR no existe la columna TIPO simple/doble: si el
    // beeblack se cotiza ahí, el marcador se escribe en SENT. CORT (que el
    // beeblack no usa: no se enrolla).
    if (!f.tipoSimpleDoble && esValorSimpleDoble(f.sentido)) {
      f.tipoSimpleDoble = norm(f.sentido);
      f.sentido = '';
    }
    // Salta filas totalmente vacías (relleno al final de la planilla).
    if (!f.codInt && !f.ubicacion && !f.ancho && !f.alto) continue;
    cortinas.push(f);
  }

  return { cortinas, adicionales, otCliente, otDetallada };
}

export type OpcionesValidacion = {
  codIntValidos: Set<string>;
  categorias: Set<string>;
  direcciones: Set<string>;
  sentidos: Set<string>;
  /** Direcciones válidas de BEEBLACK (IZQUIERDA-DERECHA / DE ARRIBA ABAJO / …). */
  direccionesBeeblack?: Set<string>;
  /** Tipos de cortina del catálogo, para resolver las categorías propias. */
  tipos?: readonly TipoCortina[];
  /**
   * Modo de la grilla que va a mostrar los errores. Fase 1 OCULTA las columnas
   * COD SEC / DIRECC. CAD-CIERRE / SENT. CORT (se capturan en Terreno), así que
   * ahí no se exigen: marcarlas dejaba la importación trabada — la celda roja no
   * se puede corregir porque su columna no está en pantalla, y el guardado se
   * bloquea mientras queden errores. Default 'fase3' (se exige todo).
   */
  modo?: 'fase1' | 'fase3';
};

/**
 * Devuelve la lista de campos llave inválidos de una fila (vacía = fila OK).
 * Se usa para pintar en rojo las celdas a corregir a mano tras importar.
 *
 * Solo se exige lo que la grilla MUESTRA: en Fase 1 el mecanismo, la dirección
 * y la caída no están en pantalla (ver `modo`), así que la planilla mínima de
 * entrada —COD_INT, UBIC., ANCHO y ALTO— importa sin dejar nada en rojo.
 *
 * SENT. CORT no aplica a la cortina VERTICAL, al BEEBLACK ni a la PLETINA
 * (velcro): el interno/externo describe la caída del enrollado del roller, la
 * vertical corre de lado con carritos, el beeblack elige su variante de
 * instalación en Fase 2 y el paño de velcro va pegado, no se enrolla. En esas
 * filas el campo no se exige (y la grilla lo muestra como "—").
 *
 * DIRECC. CAD/CIERRE tampoco aplica a la PLETINA: sin cadena no hay lado de
 * accionamiento. El BEEBLACK sí la lleva, pero con su propia lista de cierres
 * (corre de lado o de arriba abajo), distinta de las cadenas del roller.
 */
export function validarFilaFase0(f: FilaImportadaFase0, opts: OpcionesValidacion): CampoFase0[] {
  const malos: CampoFase0[] = [];
  if (!f.codInt || !opts.codIntValidos.has(f.codInt)) malos.push('codInt');
  if (opts.modo !== 'fase1') {
    const esBeeblack = esCategoriaBeeblack(f.categoria);
    const esPletina = esCategoriaPletina(f.categoria, opts.tipos);
    const direcciones = esBeeblack
      ? (opts.direccionesBeeblack ?? opts.direcciones)
      : opts.direcciones;
    if (!f.categoria || !opts.categorias.has(f.categoria)) malos.push('categoria');
    if (!esPletina && (!f.direccion || !direcciones.has(f.direccion))) malos.push('direccion');
    if (
      !esCategoriaVertical(f.categoria) &&
      !esBeeblack &&
      !esPletina &&
      (!f.sentido || !opts.sentidos.has(f.sentido))
    ) {
      malos.push('sentido');
    }
  }
  if (!(f.ancho > 0)) malos.push('ancho');
  if (!(f.alto > 0)) malos.push('alto');
  return malos;
}

/**
 * Devuelve la opción canónica del catálogo que coincide (ignorando
 * mayúsculas/acentos) con el valor del Excel; si no coincide ninguna,
 * devuelve el valor original recortado (quedará marcado en rojo).
 */
export function canonizar(valor: string, opciones: string[]): string {
  const objetivo = norm(valor);
  if (!objetivo) return '';
  return opciones.find((o) => norm(o) === objetivo) ?? valor.trim();
}
