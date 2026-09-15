// Las líneas de una recepción: lo que dice el papel, a qué artículo fue y,
// si ya se contó, cuánto llegó bueno, dañado y cuánto entró al stock.

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatearCantidad, type LineaOrden } from '@/modules/inventario/compras';
import { TEXTO_EXCLUSION, TEXTO_VINCULO } from '@/modules/inventario/recepcion';
import type { LineaRecepcion } from '@/modules/inventario/recepcionesLecturaStore';

export function TablaLineasRecepcion({
  lineas,
  lineasOrden,
  contada,
}: {
  lineas: LineaRecepcion[];
  lineasOrden: LineaOrden[];
  contada: boolean;
}) {
  const porId = new Map(lineasOrden.map((l) => [l.id, l]));
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-9 px-4 text-left font-medium">#</th>
              <th className="h-9 px-3 text-left font-medium">Lo que dice el papel</th>
              <th className="h-9 px-3 text-left font-medium">Artículo nuestro</th>
              <th className="h-9 px-3 text-right font-medium">Facturado</th>
              {contada && (
                <>
                  <th className="h-9 px-3 text-right font-medium">Bueno</th>
                  <th className="h-9 px-3 text-right font-medium">Dañado</th>
                  <th className="h-9 px-4 text-right font-medium">Entró</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const ol = l.orden_linea_id ? porId.get(l.orden_linea_id) : undefined;
              const excluida = l.accion === 'excluir';
              const fact = Number(l.fact_cantidad ?? 0);
              const contado = l.cantidad_buena + l.cantidad_danada;
              const noCalza = contada && !excluida && Math.abs(contado - fact) > 1e-9;
              return (
                <tr key={l.id} className={cn('border-b border-border align-top last:border-0', excluida && 'text-muted-foreground')}>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{l.posicion}</td>
                  <td className="px-3 py-2.5">
                    <div>{l.fact_descripcion || '—'}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[0.68rem] text-muted-foreground">
                      {l.fact_codigo && <span>{l.fact_codigo}</span>}
                      {l.origen === 'manual' && <Badge variant="warning">llegó sin facturar</Badge>}
                    </div>
                    {l.nota && <div className="mt-0.5 text-[0.7rem] text-muted-foreground">Nota: {l.nota}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {excluida ? (
                      <Badge variant="muted">{TEXTO_EXCLUSION[l.motivo_exclusion ?? 'otro']}</Badge>
                    ) : (
                      <>
                        <span className="font-mono font-medium">{l.item_cod}</span>
                        {l.dominio === 'tela' && (
                          <Badge variant="muted" className="ml-1.5">
                            tela
                          </Badge>
                        )}
                        <div className="text-[0.68rem] text-muted-foreground">
                          {ol ? `línea ${ol.posicion} de la orden` : 'no está en la orden'}
                          {l.vinculo ? ` · ${TEXTO_VINCULO[l.vinculo]}` : ''}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {l.origen === 'manual' ? '—' : formatearCantidad(fact)}
                    {l.fact_unidad && <div className="font-sans text-[0.66rem] text-muted-foreground">{l.fact_unidad}</div>}
                  </td>
                  {contada && (
                    <>
                      <td className={cn('px-3 py-2.5 text-right font-mono', noCalza && 'text-warning')}>
                        {excluida ? '—' : formatearCantidad(l.cantidad_buena)}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right font-mono', l.cantidad_danada > 0 && 'text-destructive')}>
                        {excluida || l.cantidad_danada === 0 ? '—' : formatearCantidad(l.cantidad_danada)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {l.unidades_ingresadas > 0 ? (
                          <>
                            +{formatearCantidad(l.unidades_ingresadas)}
                            <span className="ml-1 font-sans text-[0.66rem] text-muted-foreground">{l.dominio === 'tela' ? 'm' : 'un'}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TablaLineasRecepcion;
