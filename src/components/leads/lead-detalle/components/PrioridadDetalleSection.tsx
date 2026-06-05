// Sección "Prioridad y detalle personal" (CONECTOR): tres botones de
// prioridad (alta/media/baja) + textarea de detalle libre + sugerencia
// automática basada en scoring/presupuesto/urgencia.

import { Flame, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  PRIORIDAD_LABEL,
  PRIORIDAD_ORDEN,
  type Lead,
  type Prioridad,
} from '@/modules/leads/types';
import { prioridadSugerida } from '@/modules/leads/seguimientos';

interface PrioridadDetalleSectionProps {
  lead: Lead;
  prioridadDraft: Prioridad;
  setPrioridadDraft: (p: Prioridad) => void;
  detalleDraft: string;
  setDetalleDraft: (s: string) => void;
  guardando: boolean;
  onGuardar: () => void;
}

export default function PrioridadDetalleSection({
  lead,
  prioridadDraft,
  setPrioridadDraft,
  detalleDraft,
  setDetalleDraft,
  guardando,
  onGuardar,
}: PrioridadDetalleSectionProps) {
  const sugerida = prioridadSugerida(lead);
  return (
    <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Flame className="h-3 w-3" /> Prioridad y detalle personal
        </div>
        {sugerida !== prioridadDraft && (
          <button
            onClick={() => setPrioridadDraft(sugerida)}
            className="text-[10px] text-accent hover:underline"
            title="Aplicar la prioridad sugerida según scoring, presupuesto y urgencia"
          >
            Sugerida: {PRIORIDAD_LABEL[sugerida]}
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {PRIORIDAD_ORDEN.map((p) => (
          <button
            key={p}
            onClick={() => setPrioridadDraft(p)}
            className={cn(
              'flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors',
              prioridadDraft === p
                ? p === 'alta'
                  ? 'border-destructive/50 bg-destructive/15 text-destructive'
                  : p === 'media'
                    ? 'border-warning/50 bg-warning/15 text-warning'
                    : 'border-accent/40 bg-accent/15 text-accent'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {PRIORIDAD_LABEL[p]}
          </button>
        ))}
      </div>
      <textarea
        value={detalleDraft}
        onChange={(e) => setDetalleDraft(e.target.value)}
        placeholder="Conector / detalle personal: lo importante que surgió en la conversación (ej. 'se muda en marzo', 'le preocupa la luz de la mañana')…"
        rows={2}
        className="w-full rounded-md border border-border bg-card px-2 py-2 text-xs focus:border-accent focus:outline-none"
      />
      <Button
        onClick={onGuardar}
        disabled={
          guardando ||
          (prioridadDraft === (lead.prioridad ?? 'media') &&
            detalleDraft.trim() === (lead.detalle_personal ?? '').trim())
        }
        size="sm"
        className="w-full"
      >
        {guardando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        Guardar prioridad y detalle
      </Button>
    </section>
  );
}
