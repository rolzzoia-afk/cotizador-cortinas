// ─────────────────────────────────────────────────────────────────────
// Selector de OT (búsqueda por N° de OT o cliente).
//
// Vivía dentro de OptimizadorTela.tsx con el `navigate` hardcodeado; se
// extrajo tal cual para reusarlo en el tab «Optimizador» del Panel de
// Administrador, que no navega sino que muestra los cálculos de la OT
// elegida en la misma pantalla.
// ─────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { Loader2, Scissors, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useOTs } from '@/modules/ots/hooks';
import { OT_ESTADO_META } from '@/modules/ots/constants';
import type { OT } from '@/modules/ots/types';

export function SelectorOTs({
  onSelect,
  placeholder = 'Buscar por N° de OT o cliente…',
}: {
  onSelect: (ot: OT) => void;
  placeholder?: string;
}) {
  const { ots, loading } = useOTs();
  const [q, setQ] = useState('');

  const visibles = useMemo(() => {
    const activas = ots.filter((o) => o.estado !== 'archivada');
    const t = q.trim().toLowerCase();
    const filtradas = t
      ? activas.filter((o) => {
          const dg = o.datosGenerales || {};
          return `${dg.ot ?? ''} ${dg.cliente ?? ''}`.toLowerCase().includes(t);
        })
      : activas;
    // Producción primero (es donde más se usa el corte de tela), luego por fecha
    const prioridad = (o: OT) => (o.estado === 'produccion' ? 0 : o.estado === 'aprobada' ? 1 : 2);
    return [...filtradas].sort(
      (a, b) =>
        prioridad(a) - prioridad(b) ||
        (b.fechaModificacion || '').localeCompare(a.fechaModificacion || ''),
    );
  }, [ots, q]);

  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando OTs…
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {q ? 'Ninguna OT coincide con la búsqueda.' : 'No hay OTs activas.'}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {visibles.map((o) => {
            const dg = o.datosGenerales || {};
            const meta = OT_ESTADO_META[o.estado as Exclude<OT['estado'], 'archivada'>];
            const nVent = (o.storeVentanas || []).length;
            return (
              <li key={o.id}>
                <button
                  onClick={() => onSelect(o)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-secondary/50"
                >
                  <span className="font-mono text-sm font-bold tabular-nums">{dg.ot || '—'}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {dg.cliente || '(sin cliente)'}
                    <span className="ml-2 text-[12px] text-muted-foreground">
                      {nVent} ventana{nVent !== 1 ? 's' : ''}
                    </span>
                  </span>
                  {meta && (
                    <span
                      className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ borderColor: `${meta.color}66`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  )}
                  <Scissors className="h-4 w-4 shrink-0 text-accent" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
