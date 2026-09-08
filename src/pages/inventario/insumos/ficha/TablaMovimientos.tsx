// La tabla de movimientos de un artículo. La usan el Resumen (los últimos) y
// el Kardex (todos).
//
// NO tiene columna de saldo a propósito: hoy el saldo después de cada
// movimiento no existe en ninguna parte, y calcularlo hacia atrás desde el
// stock actual daría un número inventado cada vez que alguien tocó el stock
// sin dejar movimiento (que pasa). Llega con el kardex, en la Entrega B.

import { Badge } from '@/components/ui/badge';
import { badgeTipoMovimiento } from '@/modules/inventario/badges';
import { descripcionMovimiento } from '@/modules/inventario/ficha';
import type { Movimiento } from '@/modules/inventario/helpers';

function fechaCorta(f: string | null): string {
  if (!f) return '—';
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia}-${mes} ${hora}`;
}

export function TablaMovimientos({ filas }: { filas: Movimiento[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.8125rem] tabular-nums">
        <thead>
          <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
            <th className="h-9 px-3 text-left font-medium">Fecha</th>
            <th className="h-9 px-3 text-left font-medium">Tipo</th>
            <th className="h-9 px-3 text-left font-medium">Movimiento</th>
            <th className="h-9 px-3 text-right font-medium">Cant.</th>
            <th className="h-9 px-3 text-left font-medium">Quién</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((m) => {
            const badge = badgeTipoMovimiento(m.tipo);
            return (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">
                  {fechaCorta(m.fecha)}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={badge.variante}>{badge.texto}</Badge>
                </td>
                <td className="px-3 py-2">
                  {descripcionMovimiento(m)}
                  {m.bitacora ? (
                    <span className="text-muted-foreground"> · {m.bitacora}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {(m.cantidad ?? 0).toLocaleString('es-CL')}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {m.responsable_entrega || m.recepcion || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default TablaMovimientos;
