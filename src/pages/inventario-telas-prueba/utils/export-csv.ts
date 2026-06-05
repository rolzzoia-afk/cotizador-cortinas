// Exporta el listado actual de inventario a un archivo CSV
// compatible con Excel (separador ;, BOM UTF-8). Descarga directa
// en el navegador, sin pasar por backend.

import type { InventoryItem } from '../types';

export function exportInventarioCSV(items: InventoryItem[]): void {
  const header = 'COD;Producto;COD_INT;Tipo;Descripcion;Tela Verticales;Descuento;Rollos;Metros Ind;Total Metros;Comentario';
  const lines = items.map((it) =>
    [
      it.cod,
      it.producto,
      it.cod_int,
      it.tipo,
      it.descripcion,
      it.telaVerticales,
      it.descuento,
      it.rollos,
      it.metros,
      it.totalMetros,
      it.comentario,
    ]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(';'),
  );

  // ﻿ = BOM UTF-8 para que Excel detecte la codificación.
  const csv = '﻿' + header + '\r\n' + lines.join('\r\n') + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Inventario_Rolzzo_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
