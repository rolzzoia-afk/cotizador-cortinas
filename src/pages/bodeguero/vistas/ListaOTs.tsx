// Lista de OTs en estados que requiere el bodeguero (producción / lista /
// pendiente_firma) + 3 botones de acciones ad-hoc (salida / entrada /
// devolución).

import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Calendar,
  Package,
  Scissors,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { OT } from '@/modules/bodega/bomUtils';

interface ListaOTsProps {
  ots: OT[];
  onBack: () => void;
  onSelect: (ot: OT) => void;
  onSalida: () => void;
  onEntrada: () => void;
  onDevolucion: () => void;
}

export default function ListaOTs({
  ots,
  onBack,
  onSelect,
  onSalida,
  onEntrada,
  onDevolucion,
}: ListaOTsProps) {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inicio
        </button>
        <h1 className="flex-1 text-base font-bold">Bodeguero</h1>
      </div>

      <div className="mx-auto max-w-3xl p-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Button
            onClick={onSalida}
            className="h-auto flex-col gap-1 border border-destructive/30 bg-destructive/15 py-3 text-destructive hover:bg-destructive/15"
            variant="outline"
          >
            <ArrowUpCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">Salida rápida</span>
            <span className="text-[10px] opacity-80">Sin OT</span>
          </Button>
          <Button
            onClick={onEntrada}
            className="h-auto flex-col gap-1 border border-success/30 bg-success/15 py-3 text-success hover:bg-success/15"
            variant="outline"
          >
            <ArrowDownCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">Entrada rápida</span>
            <span className="text-[10px] opacity-80">Stock nuevo</span>
          </Button>
          <Button
            onClick={onDevolucion}
            className="h-auto flex-col gap-1 border border-warning/30 bg-warning/15 py-3 text-warning hover:bg-warning/15"
            variant="outline"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-semibold">Devolución</span>
            <span className="text-[10px] opacity-80">Devolver de OT</span>
          </Button>
        </div>

        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Despacho por OT
        </div>

        {ots.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No hay órdenes en producción
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ots.map((ot) => {
              const dg = (ot.datos_generales || {}) as Record<string, unknown>;
              const cliente = (dg.cliente as string) || '—';
              const bomCount = Array.isArray(dg.bom) ? (dg.bom as unknown[]).length : '?';
              const telaCount = (ot.items || []).reduce(
                (s: number, v: Record<string, unknown>) =>
                  s + (Array.isArray(v.panos) ? (v.panos as unknown[]).length : 1),
                0,
              );
              const badge =
                ot.estado === 'pendiente_firma'
                  ? { cls: 'bg-warning/15 text-warning border-warning/30', txt: 'Pendiente firma' }
                  : ot.estado === 'lista'
                    ? { cls: 'bg-success/15 text-success border-success/30', txt: 'Lista p/ entrega' }
                    : { cls: 'bg-accent/15 text-accent border-blue-500/30', txt: 'En producción' };

              return (
                <button
                  key={ot.id}
                  onClick={() => onSelect(ot)}
                  className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-accent/40 hover:bg-card/80"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-base font-bold">
                      OT {ot.numero_ot || ot.id.slice(-6)}
                    </span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                        badge.cls,
                      )}
                    >
                      {badge.txt}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">{cliente}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" /> {bomCount} insumos
                    </span>
                    {telaCount > 0 && (
                      <span className="flex items-center gap-1 text-warning">
                        <Scissors className="h-3 w-3" /> {telaCount} paño(s)
                      </span>
                    )}
                    {ot.fecha_entrega && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {ot.fecha_entrega.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
