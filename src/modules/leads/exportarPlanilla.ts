// Descarga la planilla de Clientes como .xlsx, con los encabezados del Excel
// que ya usa el equipo. `xlsx` se carga recién al exportar: abrir Clientes no
// baja la librería.
import { aoaPlanilla, ENCABEZADOS_EXCEL, type FilaPlanilla } from './planilla';

const ANCHOS: Partial<Record<(typeof ENCABEZADOS_EXCEL)[number], number>> = {
  'NOMBRE DE CLIENTE': 22,
  TELÉFONO: 15,
  INSTAGRAM: 16,
  'ESTADO COTIZACIÓN': 16,
  'TIPO DE COTIZACIÓN': 26,
  MAIL: 26,
  MENSAJE: 40,
  'INFORMACIÓN ADICIONAL': 30,
  'QUÉ ANUNCIO VIENE': 20,
  'RESPUESTA DEL CLIENTE': 28,
  'ESTADO DEL PROCESO': 28,
  'MONTO COTIZADO': 14,
  'N° DE COTIZACIÓN': 34,
  'COTIZACIÓN FINAL': 14,
  'ÚLTIMO CAMBIO': 30,
};

export async function descargarExcelPlanilla(filas: FilaPlanilla[], sufijo = ''): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(aoaPlanilla(filas));
  ws['!cols'] = ENCABEZADOS_EXCEL.map((h) => ({ wch: ANCHOS[h] ?? Math.max(10, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CLIENTES');
  const hoy = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Clientes${sufijo ? `_${sufijo}` : ''}_${hoy}.xlsx`);
}
