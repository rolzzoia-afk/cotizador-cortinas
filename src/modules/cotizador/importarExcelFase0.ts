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
// ANCHO y ALTO vienen en METROS, en formato es-CL (coma decimal: "2,720").
//
// Lógica pura (sin React/Supabase) para poder testearla.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';

export type FilaImportadaFase0 = {
  codInt: string;
  categoria: string; // COD SEC (mecanismo)
  direccion: string; // DIRECC. CAD/CIERRE
  sentido: string; // SENT. CORT
  cantidad: number;
  ubicacion: string; // UBIC.
  colorAcc: string; // COLOR ACCESORIOS
  ancho: number; // metros
  alto: number; // metros
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
};

/** Campos llave que pueden quedar "en rojo" para corregir a mano. */
export type CampoFase0 = 'codInt' | 'categoria' | 'direccion' | 'sentido' | 'ancho' | 'alto';

// Normaliza un encabezado: mayúsculas, sin acentos, solo alfanumérico.
// Así "DIRECC. CAD/CIERRE" → "DIRECCCADCIERRE" y "UBIC." → "UBIC".
const norm = (s: unknown): string =>
  String(s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '');

// Encabezado normalizado → campo de la fila.
const COLUMNAS: Record<string, keyof FilaImportadaFase0> = {
  CODSEC: 'categoria',
  DIRECCCADCIERRE: 'direccion',
  SENTCORT: 'sentido',
  CANT: 'cantidad',
  CODINT: 'codInt',
  UBIC: 'ubicacion',
  COLORACCESORIOS: 'colorAcc',
  ANCHO: 'ancho',
  ALTO: 'alto',
};

// Convierte un valor de medida es-CL a número en metros.
// La coma es SIEMPRE separador decimal; el punto (si coexiste) es de miles.
function metros(v: unknown): number {
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

/**
 * Parsea la primera hoja del workbook y separa las filas en CORTINAS y
 * ADICIONALES, usando la fila rótulo "ADICIONALES" como límite (todo lo que
 * está debajo son adicionales). Detecta automáticamente la fila de
 * encabezados (la que contiene COD_INT y ANCHO), tolerando filas de
 * título/logo arriba de la tabla.
 */
export function parsearExcelFase0(wb: XLSX.WorkBook): ResultadoImportFase0 {
  const vacio: ResultadoImportFase0 = { cortinas: [], adicionales: [] };
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return vacio;
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

  let headerIdx = -1;
  for (let i = 0; i < matriz.length; i++) {
    const claves = new Set((matriz[i] || []).map(norm));
    if (claves.has('CODINT') && claves.has('ANCHO')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return vacio;

  const colDe = new Map<number, keyof FilaImportadaFase0>();
  (matriz[headerIdx] || []).forEach((h, idx) => {
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
    };
    for (const [idx, campo] of colDe) {
      const v = r[idx];
      if (campo === 'ancho' || campo === 'alto') f[campo] = metros(v);
      else if (campo === 'cantidad') f.cantidad = entero(v);
      else f[campo] = texto(v);
    }
    // Salta filas totalmente vacías (relleno al final de la planilla).
    if (!f.codInt && !f.ubicacion && !f.ancho && !f.alto) continue;
    cortinas.push(f);
  }

  return { cortinas, adicionales };
}

export type OpcionesValidacion = {
  codIntValidos: Set<string>;
  categorias: Set<string>;
  direcciones: Set<string>;
  sentidos: Set<string>;
};

/**
 * Devuelve la lista de campos llave inválidos de una fila (vacía = fila OK).
 * Se usa para pintar en rojo las celdas a corregir a mano tras importar.
 */
export function validarFilaFase0(f: FilaImportadaFase0, opts: OpcionesValidacion): CampoFase0[] {
  const malos: CampoFase0[] = [];
  if (!f.codInt || !opts.codIntValidos.has(f.codInt)) malos.push('codInt');
  if (!f.categoria || !opts.categorias.has(f.categoria)) malos.push('categoria');
  if (!f.direccion || !opts.direcciones.has(f.direccion)) malos.push('direccion');
  if (!f.sentido || !opts.sentidos.has(f.sentido)) malos.push('sentido');
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
