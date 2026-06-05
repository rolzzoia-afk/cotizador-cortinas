// Modal con el detalle completo de un movimiento de inventario.

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type Movimiento, formatFecha } from '@/modules/inventario/helpers';

interface DetalleMovDialogProps {
  mov: Movimiento | null;
  onClose: () => void;
}

export default function DetalleMovDialog({ mov, onClose }: DetalleMovDialogProps) {
  return (
    <Dialog open={!!mov} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle del movimiento</DialogTitle>
        </DialogHeader>
        {mov && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border bg-card/60 p-3">
              <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                Tipo
              </div>
              <div className="font-semibold text-foreground">{mov.tipo}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-card/60 p-3">
                <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Código
                </div>
                <div className="text-foreground">{mov.codigo || '—'}</div>
              </div>
              <div className="rounded-md border border-border bg-card/60 p-3">
                <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Cantidad
                </div>
                <div className="text-foreground">
                  {mov.cantidad ?? 0} {mov.almacen ? `→ ${mov.almacen}` : ''}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card/60 p-3">
              <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                Producto
              </div>
              <div className="text-foreground">{mov.producto || '—'}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-card/60 p-3">
                <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  OT
                </div>
                <div className="text-foreground">{mov.ot || '—'}</div>
              </div>
              <div className="rounded-md border border-border bg-card/60 p-3">
                <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Responsable
                </div>
                <div className="text-foreground">
                  {mov.responsable_entrega || '—'}
                </div>
              </div>
            </div>

            {mov.recepcion && (
              <div className="rounded-md border border-border bg-card/60 p-3">
                <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Recepción
                </div>
                <div className="text-foreground">{mov.recepcion}</div>
              </div>
            )}

            <div className="rounded-md border border-warning/30 bg-warning/15 p-3">
              <div className="text-[0.65rem] uppercase tracking-wide text-warning/80">
                Motivo / Observaciones
              </div>
              <div className="text-foreground whitespace-pre-wrap break-words">
                {mov.bitacora || 'Sin observaciones registradas'}
              </div>
            </div>

            <div className="rounded-md border border-border bg-card/60 p-3">
              <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                Fecha
              </div>
              <div className="text-foreground">{formatFecha(mov.fecha)}</div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
