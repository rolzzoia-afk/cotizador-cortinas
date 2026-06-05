// Wrapper que decide entre ExistingErrorDialog (si la línea ya tiene
// error registrado) o RegisterErrorDialog (flujo completo de registrar).

import ExistingErrorDialog from './ExistingErrorDialog';
import RegisterErrorDialog from './RegisterErrorDialog';
import type { CorteCtx, Plan, Tubo } from '../HistorialCorte.types';

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: CorteCtx | null;
  tubosDisponibles: Tubo[];
  plan: Plan | null;
  existingError: { linea_idx: number; motivo: string } | null;
  onSuccess: (planId: string, idx: number, motivo: string) => void;
}

export default function ErrorDialog({
  open,
  onOpenChange,
  ctx,
  tubosDisponibles,
  plan,
  existingError,
  onSuccess,
}: ErrorDialogProps) {
  if (!open || !ctx) return null;
  if (existingError) {
    return (
      <ExistingErrorDialog
        open={open}
        onOpenChange={onOpenChange}
        ctx={ctx}
        existingError={existingError}
      />
    );
  }
  return (
    <RegisterErrorDialog
      open={open}
      onOpenChange={onOpenChange}
      ctx={ctx}
      tubosDisponibles={tubosDisponibles}
      plan={plan}
      onSuccess={onSuccess}
    />
  );
}
