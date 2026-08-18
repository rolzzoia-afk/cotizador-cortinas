// «Replicar información»: copiar la ficha de esta cortina a otras de la OT.
// En una casa suelen ser todas iguales salvo la medida, y cargarlas una por una
// es el trabajo tonto del terreno.
import { useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { resumenPanos } from '@/modules/cotizador/fase2';
import type { Ventana } from '@/modules/cotizador/types';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  origen: Ventana;
  candidatas: Ventana[];
  guardando: boolean;
  onReplicar: (ids: Array<string | number>) => void;
};

export function ReplicarDialog({
  open,
  onOpenChange,
  origen,
  candidatas,
  guardando,
  onReplicar,
}: Props) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setSel(new Set());
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Replicar información</DialogTitle>
          <DialogDescription>
            Copia la ficha de «{origen.ubicacion || 'esta cortina'}» a las que elijas: tela,
            color de accesorios, mecanismo, cadena, cenefa y datos de instalación.
            <strong> Las medidas de cada ventana no se tocan.</strong>
          </DialogDescription>
        </DialogHeader>

        {candidatas.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No hay otras cortinas en esta OT todavía.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {sel.size} de {candidatas.length} seleccionadas
              </span>
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() =>
                  setSel(
                    sel.size === candidatas.length
                      ? new Set()
                      : new Set(candidatas.map((v) => String(v.id))),
                  )
                }
              >
                {sel.size === candidatas.length ? 'Ninguna' : 'Todas'}
              </button>
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {candidatas.map((v) => {
                const id = String(v.id);
                const marcada = sel.has(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => alternar(id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded border px-2.5 py-2 text-left text-xs transition-colors',
                        marcada
                          ? 'border-accent/50 bg-accent/15'
                          : 'border-border bg-card hover:bg-card',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          marcada ? 'border-accent bg-accent/30 text-accent' : 'border-border',
                        )}
                        aria-hidden
                      >
                        {marcada ? '✓' : ''}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {v.ubicacion || '(sin ubicación)'}
                        </span>
                        <span className="block truncate text-[0.68rem] text-muted-foreground">
                          {v.categoria || '—'} · {resumenPanos(v.panos)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={() => onReplicar([...sel])}
            disabled={guardando || sel.size === 0}
            className="gap-1"
          >
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
            Replicar en {sel.size || 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
