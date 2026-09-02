// El lote que se está trabajando, fijo bajo el buscador.
//
// Las áreas del taller son POR OT —cada orden tiene su plan de corte, sus
// marcas y su sub-etapa—, así que un lote no las fusiona: lo que hace es dejar
// sus OTs a un clic en todas las pestañas, sin volver a escribir números. Se
// entra por «Trabajar el lote» desde la Cola y se sale con la ✕.

import { Layers, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoteOtRef } from '@/modules/produccion/lotes';

export default function BarraLote({
  nombre,
  ots,
  otActual,
  onElegir,
  onSalir,
}: {
  nombre: string;
  ots: LoteOtRef[];
  /** El `numero_ot` que está cargado ahora, para destacar su chip. */
  otActual: string;
  onElegir: (numeroOt: string) => void;
  onSalir: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
      <Layers className="h-4 w-4 shrink-0 text-accent" />
      <span className="text-sm font-semibold text-accent">{nombre}</span>
      <span className="text-[11px] text-muted-foreground">
        · {ots.length} {ots.length === 1 ? 'OT' : 'OTs'} — se trabajan de a una
      </span>

      <div className="flex flex-wrap items-center gap-1">
        {ots.map((o) => {
          const activa = o.numeroOt === otActual;
          return (
            <button
              key={o.id}
              onClick={() => onElegir(o.numeroOt)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition',
                activa
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-accent/30 bg-card text-accent hover:bg-accent/15',
              )}
            >
              OT {o.numero}
            </button>
          );
        })}
      </div>

      <button
        onClick={onSalir}
        title="Salir del lote"
        className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
        Salir del lote
      </button>
    </div>
  );
}
