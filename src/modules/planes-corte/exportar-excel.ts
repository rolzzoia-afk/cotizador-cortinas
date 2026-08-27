// Re-genera el Excel de un plan de corte a partir de los datos guardados en
// `planes_corte` (columnas `resultados` y `ordenes`). Es un port directo de la
// función `exportarResultados()` del optimizador legacy (public/legacy/
// optimizador.html ~línea 6293) para que postventa pueda re-descargar el plan
// si el navegador se colgó durante la descarga original.
//
// El armado de las filas —acciones, sobrantes, merma y el reorden de MESA—
// vive en `construirFilasPlan.ts`, que también alimenta la pantalla del
// módulo Producción. Acá solo queda lo que es propio del Excel: estilos,
// merges y la descarga.

import * as XLSX from 'xlsx';
import {
  celdasComoArreglo,
  construirFilasPlan,
  COLORES_EXCEL,
  ENCABEZADOS_PLAN,
  estiloFilaPlan,
} from './construirFilasPlan';

export type {
  OrdenLike,
  PlanParaExportar,
  ResultadoCorte,
  ResultadoItem,
} from './construirFilasPlan';

import type { PlanParaExportar } from './construirFilasPlan';

export function exportarPlanComoExcel(plan: PlanParaExportar): void {
  const filas = construirFilasPlan(plan);
  const datosExcel: (string | number)[][] = [
    [...ENCABEZADOS_PLAN],
    ...filas.map(celdasComoArreglo),
  ];

  const ws = XLSX.utils.aoa_to_sheet(datosExcel);

  type StyledCell = XLSX.CellObject & {
    s?: { fill?: { fgColor: { rgb: string } }; font?: { color: { rgb: string }; bold: boolean } };
  };
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; ++R) {
    // R es 1-based por el encabezado: la fila 1 de la hoja es filas[0].
    const fila = filas[R - 1];
    if (!fila) continue;
    const estilo = estiloFilaPlan(fila);
    if (!estilo) continue;
    const { fill: fillColor, font: fontColor } = COLORES_EXCEL[estilo];
    for (let C = 0; C <= range.e.c; ++C) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })] as StyledCell | undefined;
      if (cell) {
        if (!cell.s) cell.s = {};
        cell.s.fill = { fgColor: { rgb: fillColor } };
        cell.s.font = { color: { rgb: fontColor }, bold: true };
      }
    }
  }

  // Footer del documento: CORRELATIVO N en una celda destacada al final.
  // Sigue el patrón del template del jefe (ver screenshot del usuario): celda
  // grande con fondo y borde para que el taller la vea de un vistazo.
  if (plan.correlativo != null) {
    const lastRow = XLSX.utils.decode_range(ws['!ref'] || 'A1').e.r;
    const corrRow = lastRow + 3; // 2 filas vacías + 1 fila para el correlativo
    const corrCellAddr = XLSX.utils.encode_cell({ r: corrRow, c: 1 });
    ws[corrCellAddr] = {
      t: 's',
      v: `CORRELATIVO ${plan.correlativo}`,
      s: {
        fill: { fgColor: { rgb: 'FF1F1F2E' } },
        font: { color: { rgb: 'FFFFFFFF' }, bold: true, sz: 14 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: 'FF000000' } },
          bottom: { style: 'medium', color: { rgb: 'FF000000' } },
          left: { style: 'medium', color: { rgb: 'FF000000' } },
          right: { style: 'medium', color: { rgb: 'FF000000' } },
        },
      },
    } as XLSX.CellObject & {
      s: {
        fill: { fgColor: { rgb: string } };
        font: { color: { rgb: string }; bold: boolean; sz: number };
        alignment: { horizontal: string; vertical: string };
        border: Record<string, { style: string; color: { rgb: string } }>;
      };
    };
    // Merge celdas B-G del correlativo para que sea ancho/visible
    const merges = (ws['!merges'] as XLSX.Range[] | undefined) || [];
    merges.push({ s: { r: corrRow, c: 1 }, e: { r: corrRow, c: 6 } });
    ws['!merges'] = merges;
    // Set alto de la fila para que se vea destacado
    const rows = (ws['!rows'] as XLSX.RowInfo[] | undefined) || [];
    rows[corrRow] = { hpt: 30 };
    ws['!rows'] = rows;
    // Extender el rango del worksheet
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: corrRow, c: range.e.c } });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plan de Corte');

  const fechaPlan = plan.fecha ? new Date(plan.fecha) : new Date();
  const yyyy = fechaPlan.getFullYear();
  const mm = String(fechaPlan.getMonth() + 1).padStart(2, '0');
  const dd = String(fechaPlan.getDate()).padStart(2, '0');
  const corrSuffix = plan.correlativo != null ? `_corr-${plan.correlativo}` : '';
  XLSX.writeFile(wb, `plan_corte${corrSuffix}_${yyyy}-${mm}-${dd}.xlsx`);
}
