// Pedir varios artículos de una vez: la lista de lo marcado, con la cantidad
// de cada uno a la vista y editable, antes de sumarlo al pedido.
//
// Antes «Sumar lo marcado al pedido» se negaba entero si UNO de los marcados
// no tenía «dejar en», y la mayoría del catálogo todavía no lo tiene. Ahora el
// que no lo tiene aparece vacío y se escribe acá; el que queda en 0 no se pide.
//
// De paso, es la única vez que se ven las cantidades antes de mandarlas: en
// Compras las líneas se pueden quitar, pero no corregir.

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputDecimal } from '@/components/ui/input-decimal';
import { cn } from '@/lib/utils';
import {
  cantidadInicialParaPedir,
  textoCantidad,
  unidadDe,
  type ArticuloAlerta,
} from '@/modules/inventario/alertas';
import { codigoVisible } from '@/modules/inventario/codigosInsumo';

export function DialogoPedirMarcados({
  articulos,
  guardando,
  onCerrar,
  onConfirmar,
}: {
  articulos: ArticuloAlerta[];
  guardando: boolean;
  onCerrar: () => void;
  /** Cantidad por id de artículo. Los que quedaron en 0 vienen igual: se descartan después. */
  onConfirmar: (cantidades: Record<string, number>) => void;
}) {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  // Cada vez que se abre con otra selección, las casillas vuelven a la sugerida.
  useEffect(() => {
    setCantidades(Object.fromEntries(articulos.map((a) => [a.id, cantidadInicialParaPedir(a)])));
  }, [articulos]);

  const aPedir = useMemo(
    () => articulos.filter((a) => (cantidades[a.id] ?? 0) > 0).length,
    [articulos, cantidades],
  );
  const porEscribir = articulos.length - aPedir;

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sumar al pedido</DialogTitle>
          <DialogDescription>
            Lo que tiene «dejar en» viene calculado; lo que no, escribe cuánto pedir. Lo que
            quede en 0 no se pide. No mueve el stock.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-lg border border-border">
          <table className="w-full text-[0.78rem] tabular-nums">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="h-9 px-2.5 text-left font-medium">Artículo</th>
                <th className="h-9 w-[80px] px-2.5 text-right font-medium">Hay</th>
                <th className="h-9 w-[132px] px-2.5 text-center font-medium">Pedir</th>
              </tr>
            </thead>
            <tbody>
              {articulos.map((a) => {
                const cant = cantidades[a.id] ?? 0;
                const vacia = !(cant > 0);
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-2.5 py-2">
                      <div className="font-mono font-medium" title={a.codigo}>
                        {codigoVisible(a.codigo, a.color)}
                      </div>
                      <div className="text-xs text-muted-foreground">{a.nombre}</div>
                      {vacia && !(Number(a.maximo ?? 0) > 0) && (
                        <div className="text-[0.6875rem] text-warning">sin «dejar en»: escríbelo</div>
                      )}
                    </td>
                    <td
                      className={cn(
                        'whitespace-nowrap px-2.5 py-2 text-right font-mono',
                        a.ahora <= 0 && 'text-destructive',
                      )}
                    >
                      {textoCantidad(a.ahora, a.dominio)}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <InputDecimal
                          value={cant}
                          onChange={(v) =>
                            setCantidades((c) => ({ ...c, [a.id]: v > 0 ? v : 0 }))
                          }
                          placeholder="0"
                          aria-label={`Cantidad a pedir de ${a.codigo}`}
                          disabled={guardando}
                          className={cn(
                            'h-8 w-[80px] px-2 text-center font-mono text-[0.78rem]',
                            vacia && 'border-warning/60 text-muted-foreground',
                          )}
                        />
                        <span className="w-5 text-xs text-muted-foreground">{unidadDe(a.dominio)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {porEscribir > 0 && (
          <p className="text-xs text-muted-foreground">
            {porEscribir === 1
              ? '1 artículo en 0: no se va a pedir.'
              : `${porEscribir} artículos en 0: no se van a pedir.`}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirmar(cantidades)} disabled={aPedir === 0 || guardando}>
            {guardando
              ? 'Sumando…'
              : aPedir === 1
                ? 'Sumar 1 al pedido'
                : `Sumar ${aPedir} al pedido`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DialogoPedirMarcados;
