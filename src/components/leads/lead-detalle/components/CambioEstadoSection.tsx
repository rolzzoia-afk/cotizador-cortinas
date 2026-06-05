// Sección "Cambiar estado": dropdown de estados, sub-motivo si es perdido,
// comentario opcional, botón de guardar.

import { ArrowRightCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ESTADOS_LABEL,
  ESTADOS_ORDEN,
  ESTADO_ES_PERDIDO,
  type Lead,
  type LeadEstado,
} from '@/modules/leads/types';
import { MOTIVOS_PERDIDA } from '../LeadDetalleDialog.config';

interface CambioEstadoSectionProps {
  lead: Lead;
  estadoDraft: LeadEstado | null;
  setEstadoDraft: (e: LeadEstado) => void;
  motivoDraft: string;
  setMotivoDraft: (m: string) => void;
  comentarioCambio: string;
  setComentarioCambio: (c: string) => void;
  cambiando: boolean;
  onGuardar: () => void;
}

export default function CambioEstadoSection({
  lead,
  estadoDraft,
  setEstadoDraft,
  motivoDraft,
  setMotivoDraft,
  comentarioCambio,
  setComentarioCambio,
  cambiando,
  onGuardar,
}: CambioEstadoSectionProps) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cambiar estado</div>
      <select
        value={estadoDraft || lead.estado}
        onChange={(e) => setEstadoDraft(e.target.value as LeadEstado)}
        className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm focus:border-accent focus:outline-none"
      >
        {ESTADOS_ORDEN.map((s) => (
          <option key={s} value={s}>
            {ESTADOS_LABEL[s]}
          </option>
        ))}
      </select>

      {estadoDraft && ESTADO_ES_PERDIDO(estadoDraft) && (
        <select
          value={motivoDraft}
          onChange={(e) => setMotivoDraft(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">— Motivo específico (opcional) —</option>
          {MOTIVOS_PERDIDA[estadoDraft]?.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}

      <Input
        value={comentarioCambio}
        onChange={(e) => setComentarioCambio(e.target.value)}
        placeholder="Comentario del cambio (opcional)"
      />
      <Button
        onClick={onGuardar}
        disabled={cambiando || !estadoDraft || estadoDraft === lead.estado}
        className="w-full gap-1.5"
        size="sm"
      >
        {cambiando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <ArrowRightCircle className="h-3.5 w-3.5" />
        Guardar cambio de estado
      </Button>
    </section>
  );
}
