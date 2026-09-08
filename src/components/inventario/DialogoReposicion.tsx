// Pedir la reposición de un artículo.
//
// Reemplaza al `window.prompt` que había: un prompt del navegador no deja usar
// coma decimal, no muestra cuánto hay ni cuánto falta, y en el celular tapa la
// pantalla entera. Acá se ve el artículo, su saldo y la cantidad sugerida.

import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';

export type PedidoReposicion = { codigo: string; nombre: string; cantidad: number };

export function DialogoReposicion({
  abierto,
  codigo,
  nombre,
  stockActual,
  minimo,
  sugerida,
  guardando,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  codigo: string;
  nombre: string;
  stockActual: number;
  minimo: number;
  /** Lo que falta para llegar al mínimo. Se propone, no se impone. */
  sugerida: number;
  guardando?: boolean;
  onCerrar: () => void;
  onConfirmar: (pedido: PedidoReposicion) => void;
}) {
  const [cantidad, setCantidad] = useState(sugerida);

  // Al abrirlo para otro artículo, la cantidad vuelve a la sugerida de ese.
  useEffect(() => {
    if (abierto) setCantidad(sugerida > 0 ? sugerida : 1);
  }, [abierto, sugerida, codigo]);

  const valida = cantidad > 0;

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pedir reposición</DialogTitle>
          <DialogDescription>
            Queda anotado como pedido en el historial del artículo. No mueve el stock.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3">
          <div className="font-mono text-sm font-medium">{codigo}</div>
          <div className="text-xs text-muted-foreground">{nombre}</div>
          <div className="mt-2 flex gap-4 text-xs">
            <span>
              Hay ahora{' '}
              <b className="font-mono font-medium text-foreground">
                {stockActual.toLocaleString('es-CL')}
              </b>
            </span>
            {minimo > 0 ? (
              <span>
                Mínimo{' '}
                <b className="font-mono font-medium text-foreground">
                  {minimo.toLocaleString('es-CL')}
                </b>
              </span>
            ) : (
              <span className="text-muted-foreground">Sin mínimo definido</span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cantidad-reposicion">Cantidad a pedir</Label>
          <InputDecimal id="cantidad-reposicion" value={cantidad} onChange={setCantidad} />
          {!valida ? (
            <p className="text-xs text-destructive">Escribe una cantidad mayor que cero.</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirmar({ codigo, nombre, cantidad })}
            disabled={!valida || guardando}
          >
            {guardando ? 'Registrando…' : 'Registrar pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DialogoReposicion;
