// «+ Seguimiento» desde una fila de la planilla: abre el formulario en un
// panel FIJO junto al botón (la planilla tiene scroll propio y un panel
// absoluto quedaría cortado).

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Lead } from '@/modules/leads/types';
import { RegistrarSeguimientoForm } from './RegistrarSeguimientoForm';

type Props = {
  lead: Pick<Lead, 'id' | 'estado' | 'archivado' | 'etapa_seguimiento'>;
  onRegistrado: () => void | Promise<void>;
};

const ANCHO = 320;

export function SeguimientoRapido({ lead, onRegistrado }: Props) {
  const [pos, setPos] = useState<{ arriba: number; izquierda: number } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const etapa =
    lead.estado === 'cotizado' && !lead.archivado && lead.etapa_seguimiento >= 1 && lead.etapa_seguimiento <= 3
      ? lead.etapa_seguimiento
      : null;

  const abrir = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) return setPos(null);
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const izquierda = Math.max(8, Math.min(r.right - ANCHO, window.innerWidth - ANCHO - 8));
    // Si no cabe abajo, se abre hacia arriba.
    const arriba = r.bottom + 420 > window.innerHeight ? Math.max(8, r.top - 420) : r.bottom + 4;
    setPos({ arriba, izquierda });
  };

  useEffect(() => {
    if (!pos) return;
    const cerrar = () => setPos(null);
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boton.current?.contains(t) || panel.current?.contains(t)) return;
      cerrar();
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    const mover = (e: Event) => {
      if (panel.current?.contains(e.target as Node)) return;
      cerrar();
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', mover, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', mover, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={abrir}
        title="Registrar un seguimiento"
        className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border border-border bg-card px-1.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="h-3 w-3" /> Seg.
      </button>
      {pos && (
        <div
          ref={panel}
          onClick={(e) => e.stopPropagation()}
          style={{ top: pos.arriba, left: pos.izquierda, width: ANCHO }}
          className="fixed z-50 max-h-[420px] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          <RegistrarSeguimientoForm
            leadId={lead.id}
            etapa={etapa}
            onRegistrado={async () => {
              setPos(null);
              await onRegistrado();
            }}
          />
        </div>
      )}
    </>
  );
}
