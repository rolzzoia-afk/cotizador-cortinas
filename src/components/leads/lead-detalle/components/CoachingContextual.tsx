// Consejo contextual: muestra las objeciones útiles según el estado del
// lead. Lee del manual de coaching (editable por admin) y filtra por
// categoría relacionada con el estado actual.

import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ESTADOS_LABEL, type LeadEstado } from '@/modules/leads/types';
import { useCoaching } from '@/modules/coaching/coaching';
import { categoriasParaEstado } from '@/modules/coaching/types';

interface CoachingContextualProps {
  estado: LeadEstado;
}

export default function CoachingContextual({ estado }: CoachingContextualProps) {
  const { objeciones, loading } = useCoaching();
  const [abierta, setAbierta] = useState<string | null>(null);

  const relevantes = useMemo(() => {
    const cats = categoriasParaEstado(estado);
    if (cats.length === 0) return [];
    const set = new Set<string>(cats);
    return objeciones.filter((o) => set.has(o.categoria));
  }, [objeciones, estado]);

  if (loading || relevantes.length === 0) return null;

  return (
    <section className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-accent">
        <BookOpen className="h-3 w-3" /> Consejos para esta etapa
      </div>
      <p className="text-[11px] text-muted-foreground">
        Objeciones típicas cuando el lead está en{' '}
        <strong className="text-foreground">{ESTADOS_LABEL[estado]}</strong>. Toca cada una para ver
        cómo responder.
      </p>
      <div className="space-y-1.5">
        {relevantes.map((o) => {
          const open = abierta === o.id;
          return (
            <div key={o.id} className="overflow-hidden rounded-md border border-border bg-card/60">
              <button
                onClick={() => setAbierta(open ? null : o.id)}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs font-semibold text-foreground"
              >
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform',
                    open && 'rotate-180',
                  )}
                />
                <span>"{o.objecion}"</span>
              </button>
              {open && (
                <div className="border-t border-border bg-secondary/30 px-2.5 py-2 pl-8 text-xs leading-relaxed text-foreground">
                  {o.respuesta}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
