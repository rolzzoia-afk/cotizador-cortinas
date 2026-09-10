// La tabla de órdenes de compra (lámina «Compras»).
//
// Las columnas son las del papel, en el orden en que el bodeguero las mira
// cuando llega el camión: qué número es, de quién viene, cuándo se aprobó,
// cuándo se espera, qué guía trae y cuánto falta.

import { Link } from 'react-router-dom';
import { AlertTriangle, Link2Off } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  etiquetaOrden,
  progresoDeOrden,
  resumenContenido,
  textoEspera,
  type OrdenCompra,
} from '@/modules/inventario/compras';

export function TablaOrdenes({
  ordenes,
  total,
  rutaFicha,
}: {
  ordenes: OrdenCompra[];
  total: number;
  rutaFicha: (id: string) => string;
}) {
  if (ordenes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-10 text-center text-sm text-muted-foreground">
        {total === 0
          ? 'Todavía no hay órdenes. Las trae «Actualizar desde Finanzas» cuando Gerencia apruebe la primera.'
          : 'Ninguna orden calza con lo que buscaste.'}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-9 px-4 text-left font-medium">Número</th>
              <th className="h-9 px-3 text-left font-medium">Proveedor</th>
              <th className="h-9 px-3 text-left font-medium">Aprobada</th>
              <th className="h-9 px-3 text-left font-medium">Se espera</th>
              <th className="h-9 px-3 text-left font-medium">Guía</th>
              <th className="h-9 px-3 text-left font-medium">Contenido</th>
              <th className="h-9 px-3 text-right font-medium">Recibido</th>
              <th className="h-9 px-4 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((o) => {
              const p = progresoDeOrden(o);
              const est = etiquetaOrden(o.estado);
              return (
                <tr
                  key={o.id}
                  className={cn(
                    'border-b border-border last:border-0 hover:bg-secondary/40',
                    o.conflicto && 'bg-destructive/[0.06]',
                  )}
                >
                  <td className="px-4 py-2">
                    <Link
                      to={rutaFicha(o.id)}
                      className="font-mono font-medium text-accent hover:underline"
                    >
                      {o.numero}
                    </Link>
                    {o.solicitud_ref && (
                      <div className="text-[0.68rem] text-muted-foreground">
                        de {o.solicitud_ref}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {o.proveedor_nombre || '—'}
                    {o.proveedor_rut && (
                      <div className="font-mono text-[0.68rem] text-muted-foreground">
                        {o.proveedor_rut}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.72rem] text-muted-foreground">
                    {fechaCorta(o.aprobada_en)}
                  </td>
                  <td className="px-3 py-2 text-[0.72rem] text-muted-foreground">
                    {textoEspera(o)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.72rem] text-muted-foreground">
                    {o.guia || '—'}
                  </td>
                  <td className="px-3 py-2 text-[0.72rem] text-muted-foreground">
                    {p.lineas === 0 ? (
                      'sin líneas'
                    ) : (
                      <>
                        <span className="font-mono text-foreground">
                          {resumenContenido(o)}
                        </span>{' '}
                        <span className="whitespace-nowrap">
                          ({p.lineas} línea{p.lineas === 1 ? '' : 's'})
                        </span>
                      </>
                    )}
                    {p.sinVincular > 0 && (
                      <Badge variant="warning" className="ml-2">
                        <Link2Off className="h-3 w-3" />
                        {p.sinVincular} sin artículo
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {p.completas}/{p.lineas}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={est.variante}>{est.texto}</Badge>
                    {o.conflicto === 'anulada_con_recepcion' && (
                      <Badge variant="destructive" className="ml-1.5">
                        <AlertTriangle className="h-3 w-3" />
                        anulada con material recibido
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-4 py-2 text-[0.72rem] text-muted-foreground">
        {ordenes.length === total
          ? `${total.toLocaleString('es-CL')} órdenes`
          : `${ordenes.length.toLocaleString('es-CL')} de ${total.toLocaleString('es-CL')} órdenes`}
      </div>
    </div>
  );
}

/** «09-09». El año solo cuando no es el actual: ocupa lugar y casi nunca importa. */
function fechaCorta(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ''));
  if (Number.isNaN(t)) return '—';
  const d = new Date(t);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return anio === new Date().getFullYear() ? `${dd}-${mm}` : `${dd}-${mm}-${anio}`;
}

export default TablaOrdenes;
