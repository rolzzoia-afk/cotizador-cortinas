// Modal de detalle de un slot del rack: muestra el código, nemotécnico,
// ancho/descriptor y fallas pendientes del insumo en esa posición.

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { tipoBadgeCls } from '../utils/tipo-badge';
import type { ColmenaEntry, Falla, Tela } from '../Telas.types';

interface DetalleSlotDialogProps {
  slot: string;
  entrada: ColmenaEntry;
  tela: Tela | null;
  fallas: Falla[];
  onClose: () => void;
}

export default function DetalleSlotDialog({
  slot,
  entrada,
  tela,
  fallas,
  onClose,
}: DetalleSlotDialogProps) {
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Posición {slot}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {entrada.tipo && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                  tipoBadgeCls(entrada.tipo),
                )}
              >
                {entrada.tipo}
              </span>
            )}
            <strong>{entrada.codigo}</strong>
          </div>
          {tela?.nemotecnico && (
            <div className="text-sm text-muted-foreground">{tela.nemotecnico}</div>
          )}
          {tela?.ancho != null && (
            <div className="text-xs">
              <span className="text-muted-foreground">Ancho:</span> {tela.ancho} m
            </div>
          )}
          {tela?.descriptor && (
            <div className="text-xs text-muted-foreground">{tela.descriptor}</div>
          )}
          {entrada.almacen && (
            <div className="text-xs">
              <span className="text-muted-foreground">Almacén:</span> {entrada.almacen}
            </div>
          )}
          {fallas.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              {fallas.length} falla(s) pendiente(s)
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
