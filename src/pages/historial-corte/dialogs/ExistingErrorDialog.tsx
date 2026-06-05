// Modal read-only: muestra el error ya registrado para una línea del plan
// y bloquea registrar otro encima.

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CorteCtx } from '../HistorialCorte.types';

interface ExistingErrorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: CorteCtx;
  existingError: { linea_idx: number; motivo: string };
}

export default function ExistingErrorDialog({
  open,
  onOpenChange,
  ctx,
  existingError,
}: ExistingErrorDialogProps) {
  const { r, ord } = ctx;
  const chips = [
    { label: 'OT', val: ord.ot || ord.numero_ot || r.orden || '-' },
    { label: 'Código', val: r.codigo || r.codigo_original || '—' },
    { label: 'Colmena', val: String(r.colmena ?? 'TUBO NUEVO') },
    {
      label: 'Medida',
      val: r.medida_cm != null ? `${Number(r.medida_cm).toFixed(1)} cm` : '-',
    },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Error ya registrado
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <div
              key={c.label}
              className="rounded-md border border-border bg-secondary px-2 py-1 text-[11px]"
            >
              <strong className="mr-1 text-muted-foreground">{c.label}</strong>
              {c.val}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/15 p-4">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
            Motivo registrado
          </div>
          <div className="text-sm font-semibold text-red-200">{existingError.motivo}</div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          No se puede registrar otro error sobre la misma línea. Si el registro original es
          incorrecto, revísalo desde la pestaña "Errores registrados".
        </p>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
