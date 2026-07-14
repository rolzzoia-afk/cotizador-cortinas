// ─────────────────────────────────────────────────────────────────────
// Importación de proyectos hacia la grilla del Cotizador del Jefe (OLZZO).
//
// El jefe recibe planillas de edificios/proyectos con una fila por cortina
// y columnas simples: LUGAR | MODELO | COLOR ACCESORIO | COLOR CADENA |
// ANCHO | ALTO (ej. docs/referencias/RAUL LABBE.xlsx). Este módulo lee ese
// Excel y devuelve una fila por cortina; la UF (Cotizador.jsx) las mapea a
// las líneas de la grilla, canonizando modelo/colores contra sus selects.
//
// ANCHO/ALTO vienen en METROS (formato es-CL o con punto decimal). Reusa
// `norm` y `metros` de importarExcelFase0 para no duplicar lógica.
//
// Lógica pura (sin React/Supabase) para poder testearla.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import { metros, norm } from './importarExcelFase0';

export type FilaImportadaJefe = {
  lugar: string;
  modelo: string;
  colorAccesorio: string;
  colorCadena: string;
  ancho: number; // metros
  alto: number; // metros
};

// Encabezado normalizado → campo de la fila. Acepta variantes ("LUGAR / ÁREA"
// → LUGARAREA; "COLOR ACCESORIOS" plural). El primer header que mapee a un
// campo gana (no se pisa con columnas repetidas).
const COLUMNAS: Record<string, keyof FilaImportadaJefe> = {
  LUGAR: 'lugar',
  LUGARAREA: 'lugar',
  AREA: 'lugar',
  MODELO: 'modelo',
  COLORACCESORIO: 'colorAccesorio',
  COLORACCESORIOS: 'colorAccesorio',
  COLORCADENA: 'colorCadena',
  ANCHO: 'ancho',
  ANCHOM: 'ancho',
  ALTO: 'alto',
  ALTOM: 'alto',
};

const texto = (v: unknown): string => String(v ?? '').trim();

/**
 * Parsea la planilla del proyecto a una fila por cortina. Detecta la fila de
 * encabezados (la que tiene ANCHO, ALTO y LUGAR o MODELO), tolerando filas de
 * título arriba y buscando en todas las hojas del libro. Devuelve [] si no
 * encuentra una tabla reconocible (la UI muestra el error).
 */
export function parsearExcelJefe(wb: XLSX.WorkBook): FilaImportadaJefe[] {
  let matriz: unknown[][] = [];
  let headerIdx = -1;
  for (const nombre of wb.SheetNames) {
    const ws = wb.Sheets[nombre];
    if (!ws) continue;
    const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];
    for (let i = 0; i < m.length; i++) {
      const claves = new Set((m[i] || []).map(norm));
      // Header = tiene medidas (ANCHO/ALTO) y al menos LUGAR o MODELO.
      const tieneAncho = claves.has('ANCHO') || claves.has('ANCHOM');
      const tieneAlto = claves.has('ALTO') || claves.has('ALTOM');
      const tieneIdent =
        claves.has('LUGAR') || claves.has('LUGARAREA') || claves.has('AREA') || claves.has('MODELO');
      if (tieneAncho && tieneAlto && tieneIdent) {
        matriz = m;
        headerIdx = i;
        break;
      }
    }
    if (headerIdx >= 0) break;
  }
  if (headerIdx < 0) return [];

  const colDe = new Map<number, keyof FilaImportadaJefe>();
  (matriz[headerIdx] || []).forEach((h, idx) => {
    const campo = COLUMNAS[norm(h)];
    if (campo && !Array.from(colDe.values()).includes(campo)) colDe.set(idx, campo);
  });

  const filas: FilaImportadaJefe[] = [];
  for (let i = headerIdx + 1; i < matriz.length; i++) {
    const r = matriz[i] || [];
    // Salta filas totalmente vacías.
    if (!r.some((c) => texto(c) !== '')) continue;
    const fila: FilaImportadaJefe = {
      lugar: '',
      modelo: '',
      colorAccesorio: '',
      colorCadena: '',
      ancho: 0,
      alto: 0,
    };
    for (const [idx, campo] of colDe) {
      const v = r[idx];
      if (campo === 'ancho' || campo === 'alto') fila[campo] = metros(v);
      else fila[campo] = texto(v);
    }
    // Cuenta como cortina si tiene identidad o alguna medida.
    if (fila.lugar || fila.modelo || fila.ancho > 0 || fila.alto > 0) filas.push(fila);
  }
  return filas;
}
