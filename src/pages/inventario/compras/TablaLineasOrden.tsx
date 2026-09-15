// Las líneas de una orden de compra: lo que dice la orden, a qué artículo
// nuestro corresponde, cuánto se pidió, cuánto llegó y cuánto falta.

import { Badge } from '@/components/ui/badge';
import {
  ESTADOS_LINEA_ORDEN,
  formatearCantidad,
  pendienteDeLinea,
  textoConversion,
  type LineaOrden,
} from '@/modules/inventario/compras';
import VincularArticulo from './VincularArticulo';

export function TablaLineasOrden({
  lineas,
  puedeEditar,
  onVinculada,
}: {
  lineas: LineaOrden[];
  puedeEditar: boolean;
  onVinculada: () => Promise<void>;
}) {
  if (lineas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
        Esta orden no trae líneas. Puede ser que Finanzas todavía no las tenga cargadas.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-9 px-4 text-left font-medium">#</th>
              <th className="h-9 px-3 text-left font-medium">Lo que dice la orden</th>
              <th className="h-9 px-3 text-left font-medium">Artículo nuestro</th>
              <th className="h-9 px-3 text-right font-medium">Pedido</th>
              <th className="h-9 px-3 text-right font-medium">Recibido</th>
              <th className="h-9 px-3 text-right font-medium">Falta</th>
              <th className="h-9 px-4 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const e = ESTADOS_LINEA_ORDEN[l.estado_linea] ?? {
                texto: l.estado_linea,
                variante: 'muted' as const,
              };
              const falta = pendienteDeLinea(l);
              return (
                <tr key={l.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{l.posicion}</td>
                  <td className="px-3 py-2.5">
                    <div>{l.descripcion || '—'}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[0.68rem] text-muted-foreground">
                      {l.codigo_interno && <span>interno {l.codigo_interno}</span>}
                      {l.codigo_proveedor && <span>proveedor {l.codigo_proveedor}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <VincularArticulo linea={l} puedeEditar={puedeEditar} onVinculada={onVinculada} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono">{formatearCantidad(l.cantidad_pedida)}</div>
                    {l.factor > 1 && (
                      <div className="text-[0.68rem] text-muted-foreground">
                        {textoConversion(l.cantidad_pedida, l.factor, l.unidad)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatearCantidad(l.cantidad_recibida)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{falta > 0 ? formatearCantidad(falta) : '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={e.variante}>{e.texto}</Badge>
                    {l.nota && <div className="mt-1 text-[0.68rem] text-muted-foreground">{l.nota}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TablaLineasOrden;
