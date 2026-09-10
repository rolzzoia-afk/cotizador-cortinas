// La prueba de que el libro cuadra con la bodega.
//
// Es la comprobación que decide si el kardex se puede dejar encendido: la base
// suma todos los movimientos de cada artículo y lo compara con lo que dice su
// columna de stock. Cualquier artículo que aparezca acá es un descuadre, y hay
// que mirarlo ANTES de bloquear las escrituras directas.

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSaldosVsKardex } from '@/modules/inventario/kardexStore';

export function SaldosVsKardexSection({ activo }: { activo: boolean }) {
  const { descuadres, escriturasDirectas, loading, error, refrescar } = useSaldosVsKardex(activo);

  if (!activo) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-[0.9375rem] font-medium">El libro contra la bodega</h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void refrescar()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Volver a revisar
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Suma todos los movimientos de cada artículo y lo compara con su stock. Lo sano es que no
        aparezca ninguno.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/[.09] p-3 text-xs">
          {error}
        </div>
      )}

      {!error && !loading && descuadres.length === 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>El libro cuadra con la bodega en todos los artículos.</span>
        </div>
      )}

      {!error && descuadres.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-destructive/40">
          <div className="flex items-center gap-2 bg-destructive/[.09] px-3 py-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
            <span>
              {descuadres.length} artículo{descuadres.length > 1 ? 's' : ''} no cuadra
              {descuadres.length > 1 ? 'n' : ''}. Revísalos antes de bloquear las escrituras
              directas.
            </span>
          </div>
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="h-9 px-3 text-left font-medium">Artículo</th>
                <th className="h-9 px-3 text-left font-medium">Tipo</th>
                <th className="h-9 px-3 text-right font-medium">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {descuadres.slice(0, 25).map((d) => (
                <tr key={`${d.dominio}-${d.item_cod}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono font-medium">{d.item_cod}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {d.dominio === 'tela' ? 'Tela' : 'Insumo'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {Number(d.diferencia).toLocaleString('es-CL')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {descuadres.length > 25 && (
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Mostrando 25 de {descuadres.length}.
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Escrituras de stock que no pasaron por la base:</span>
        <Badge variant={escriturasDirectas > 0 ? 'warning' : 'success'}>
          {loading ? '…' : escriturasDirectas.toLocaleString('es-CL')}
        </Badge>
        <span className="text-muted-foreground">
          {escriturasDirectas > 0
            ? 'Queda alguna pantalla por migrar: no bloquear todavía.'
            : 'Ninguna pantalla escribe el stock por fuera.'}
        </span>
      </div>
    </div>
  );
}

export default SaldosVsKardexSection;
