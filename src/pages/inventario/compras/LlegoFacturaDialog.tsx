// «Llegó una factura»: primero, ¿de qué orden?
//
// Toda factura se recibe contra una orden de compra: es lo que le permite a
// Gerencia comparar lo pedido con lo que llegó. Se busca por lo que dice el
// papel —proveedor, número de orden, RUT, guía—. Solo un administrador puede
// seguir SIN orden, y queda marcado así para Gerencia.

import { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { ChipBusqueda } from '@/components/inventario/ChipsFiltro';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  buscarOrdenes,
  etiquetaOrden,
  ordenarOrdenes,
  resumenContenido,
  textoEspera,
  type OrdenCompra,
} from '@/modules/inventario/compras';

export function LlegoFacturaDialog({
  ordenes,
  esAdmin,
  onCerrar,
  onElegir,
}: {
  ordenes: OrdenCompra[];
  esAdmin: boolean;
  onCerrar: () => void;
  /** `null` = sin orden de compra. */
  onElegir: (orden: OrdenCompra | null) => void;
}) {
  const [q, setQ] = useState('');
  const abiertas = useMemo(
    () => ordenes.filter((o) => o.estado === 'en_espera' || o.estado === 'recibida_parcial'),
    [ordenes],
  );
  const lista = useMemo(() => (q.trim() ? buscarOrdenes(abiertas, q) : ordenarOrdenes(abiertas)), [abiertas, q]);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Llegó una factura: ¿de qué orden?</DialogTitle>
          <DialogDescription>Busca por el proveedor, el número de orden, el RUT o la guía del papel.</DialogDescription>
        </DialogHeader>

        <ChipBusqueda
          valor={q}
          onChange={setQ}
          etiqueta="Buscar la orden"
          placeholder="Proveedor, orden, RUT o guía…"
          ancho="w-full"
        />

        <ul className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {lista.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {abiertas.length === 0
                ? 'No hay órdenes esperando. Si la mercadería llegó, falta que Gerencia emita la orden en Finanzas.'
                : 'Ninguna orden abierta calza con eso.'}
            </li>
          )}
          {lista.map((o) => {
            const e = etiquetaOrden(o.estado);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onElegir(o)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent/[0.06]"
                >
                  <span className="font-mono text-sm font-semibold">{o.numero}</span>
                  <Badge variant={e.variante}>{e.texto}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem]">{o.proveedor_nombre || 'Sin proveedor'}</span>
                  <span className="text-[0.72rem] text-muted-foreground">{textoEspera(o)}</span>
                  <span className="basis-full font-mono text-[0.7rem] text-muted-foreground">
                    {resumenContenido(o, 5) || 'sin líneas'}
                    {o.guia ? ` · guía ${o.guia}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="flex-wrap gap-2">
          {esAdmin && (
            <Button variant="outline" onClick={() => onElegir(null)} className="mr-auto">
              <ShieldAlert className="h-4 w-4" /> Sin orden de compra
            </Button>
          )}
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
        </DialogFooter>
        {esAdmin && (
          <p className="-mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
            «Sin orden» es solo para administradores: la recepción queda marcada así y Gerencia la recibe como
            error, para regularizarla.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default LlegoFacturaDialog;
