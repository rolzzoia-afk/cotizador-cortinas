// ─────────────────────────────────────────────────────────────────────
// Exportación de etiquetas de telas para Brother P-touch Editor (QL-810W).
//
// P-touch Editor imprime por "combinación con base de datos": se diseña la
// plantilla UNA vez y se le vincula este archivo (.xlsx); cada FILA es una
// etiqueta y cada COLUMNA un campo insertable (texto o QR). Por eso los
// nombres de columna son estables y sin acentos: si cambian, se rompe el
// vínculo plantilla↔campo en P-touch.
//
// Contenido QR (mismo formato que QRTelaDialog, para que el escáner de la
// app lo entienda igual): QR = "TEL:<codigo>" (rollo) y
// QR_UBICACION = "TEL_LOC:<posicion>|<almacen>" (slot físico, si tiene).
//
// Lógica pura (sin React) salvo `descargarEtiquetasPtouchXlsx`, que toca
// el DOM vía XLSX.writeFile.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import { telaToQRContent } from './rackMaps';
import type { Colmena, Tela } from '@/pages/telas/Telas.types';

/** Una fila = una etiqueta. Claves = nombres de campo en P-touch Editor. */
export type FilaEtiquetaPtouch = {
  CODIGO: string;
  NEMOTECNICO: string;
  TIPO: string;
  GRUPO: string;
  PROVEEDOR: string;
  DESCRIPTOR: string;
  ANCHO: number | '';
  POSICION: string;
  ALMACEN: string;
  QR: string;
  QR_UBICACION: string;
};

/** Orden fijo de columnas del archivo (encabezados = campos P-touch). */
export const COLUMNAS_PTOUCH: (keyof FilaEtiquetaPtouch)[] = [
  'CODIGO',
  'NEMOTECNICO',
  'TIPO',
  'GRUPO',
  'PROVEEDOR',
  'DESCRIPTOR',
  'ANCHO',
  'POSICION',
  'ALMACEN',
  'QR',
  'QR_UBICACION',
];

// Igual que QRTelaDialog: el QR del rollo solo lleva ASCII imprimible.
const asciiSafe = (s: string | null | undefined) =>
  String(s ?? '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();

/** Construye las filas de etiquetas (una por tela) para el archivo P-touch. */
export function construirFilasEtiquetas(telas: Tela[], colmena: Colmena): FilaEtiquetaPtouch[] {
  // Primer slot de la colmena viva por código (igual que QRTelaDialog);
  // si la tela no está cargada en un slot se usan sus propios campos.
  const slotPorCodigo = new Map<string, { posicion: string; almacen: string | null }>();
  for (const [pos, data] of Object.entries(colmena)) {
    if (data.codigo && !slotPorCodigo.has(data.codigo)) {
      slotPorCodigo.set(data.codigo, { posicion: pos, almacen: data.almacen });
    }
  }

  return telas.map((t) => {
    const slot = slotPorCodigo.get(t.codigo);
    const posicion = slot ? slot.posicion : t.posicion;
    const almacen = slot ? slot.almacen : t.almacen;
    const codSafe = asciiSafe(t.codigo);
    return {
      CODIGO: t.codigo || '',
      NEMOTECNICO: t.nemotecnico || '',
      TIPO: t.tipo || '',
      GRUPO: t.grupo || '',
      PROVEEDOR: t.proveedor || '',
      DESCRIPTOR: t.descriptor || '',
      ANCHO: t.ancho ?? '',
      POSICION: posicion || '',
      ALMACEN: almacen || '',
      QR: codSafe ? `TEL:${codSafe}` : '',
      QR_UBICACION: posicion ? telaToQRContent(posicion, almacen) : '',
    };
  });
}

/** Workbook con la hoja "Etiquetas" (fila 1 = encabezados de campo). */
export function etiquetasToWorkbook(filas: FilaEtiquetaPtouch[]): XLSX.WorkBook {
  const aoa: (string | number)[][] = [
    [...COLUMNAS_PTOUCH],
    ...filas.map((f) => COLUMNAS_PTOUCH.map((c) => f[c])),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Etiquetas');
  return wb;
}

/** Construye y descarga el archivo de etiquetas (.xlsx) en el navegador. */
export function descargarEtiquetasPtouchXlsx(
  filas: FilaEtiquetaPtouch[],
  nombreArchivo: string,
): void {
  const wb = etiquetasToWorkbook(filas);
  XLSX.writeFile(wb, nombreArchivo);
}
