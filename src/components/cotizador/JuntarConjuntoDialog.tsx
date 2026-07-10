import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Ventana } from '@/modules/cotizador/types';
import type { ColorConjunto } from '@/modules/cotizador/conjuntos';
import { resumenPanos, tipoVentanaLabel } from '@/modules/cotizador/fase2';

/**
 * "¿Juntar con otra cortina?" — al juntar, la ficha de la cortina más grande
 * del conjunto se copia a las demás (cada una conserva su ubicación y
 * medidas) y todas quedan invertidas. Multi-select sobre las demás cortinas
 * de la OT.
 */
export function JuntarConjuntoDialog({
  ventanaActual,
  candidatas,
  esInvertida,
  colorDeGrupo,
  onJuntar,
  onCerrar,
}: {
  ventanaActual: Ventana;
  candidatas: Ventana[];
  esInvertida: (v: Ventana) => boolean;
  colorDeGrupo: (grupoId: string) => ColorConjunto | undefined;
  onJuntar: (ids: Array<string | number>) => void | Promise<void>;
  onCerrar: () => void;
}) {
  const [seleccion, setSeleccion] = useState<Set<string | number>>(new Set());
  const [guardando, setGuardando] = useState(false);

  const toggle = (id: string | number) =>
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const juntar = async () => {
    if (seleccion.size === 0) return;
    setGuardando(true);
    try {
      await onJuntar([...seleccion]);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onCerrar()}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCw className="h-4 w-4 text-amber-500" />
            ¿Juntar con otra cortina?
          </DialogTitle>
          <DialogDescription>
            {ventanaActual.ubicacion ? (
              <>
                <strong className="text-foreground">{ventanaActual.ubicacion}</strong> es una
                cortina invertida.{' '}
              </>
            ) : (
              'Esta cortina es invertida. '
            )}
            Al juntar, se copiará la ficha de la cortina más grande a todas las del conjunto;
            cada una conserva su ubicación y medidas, y todo queda editable.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
          {candidatas.map((v) => {
            const grupo = v.grupoId ? colorDeGrupo(v.grupoId) : undefined;
            return (
              <li key={v.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/10">
                  <input
                    type="checkbox"
                    checked={seleccion.has(v.id)}
                    onChange={() => toggle(v.id)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {v.ubicacion || '(sin ubicación)'}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        · {v.producto || v.codInt || '—'}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {tipoVentanaLabel(v.panos.length)} · {resumenPanos(v.panos)}
                    </span>
                  </span>
                  {esInvertida(v) && (
                    <span className="shrink-0 rounded border border-amber-500/60 bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase text-amber-500">
                      Invertida
                    </span>
                  )}
                  {grupo && (
                    <span
                      className="shrink-0 rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase"
                      style={{
                        backgroundColor: grupo.suave,
                        borderColor: grupo.base,
                        color: grupo.base,
                      }}
                    >
                      Conjunto
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            No juntar
          </Button>
          <Button onClick={juntar} disabled={guardando || seleccion.size === 0}>
            {guardando ? 'Guardando…' : `Juntar${seleccion.size > 0 ? ` (${seleccion.size + 1})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default JuntarConjuntoDialog;
