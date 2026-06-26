// ─────────────────────────────────────────────────────────────────────
// Optimizador de Tela — selector de OT.
//
// El optimizador de tela (CotizadorTela / planCorte.ts) asigna los paños
// de una OT a los sobrantes de la colmena de telas. Necesita una OT, así
// que esta página lista las OTs activas y abre el optimizador de la
// elegida. Da una entrada propia en el menú (antes solo se llegaba
// navegando a /ots/:id/tela desde Fase 4).
// ─────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Scissors, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useOTs } from '@/modules/ots/hooks';
import { OT_ESTADO_META } from '@/modules/ots/constants';
import type { OT } from '@/modules/ots/types';

export function OptimizadorTela() {
  const { ots, loading } = useOTs();
  const navigate = useNavigate();
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
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <Scissors className="h-6 w-6 text-accent" />
        <div>
          <h1 className="text-xl font-semibold">Optimizador de Tela</h1>
          <p className="text-[13px] text-muted-foreground">
            Elige una OT para optimizar el corte de sus telas contra los sobrantes de la colmena.
          </p>
        </div>
      </header>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por N° de OT o cliente…"
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
                  onClick={() => {
                    localStorage.setItem('activeOTId', o.id);
                    navigate(`/ots/${o.id}/tela`);
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-secondary/50"
                >
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {dg.ot || '—'}
                  </span>
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
    </div>
  );
}
