// Las dos tablas del conteo de tubos: el resumen por colmena y la comparación
// de lo que contó cada operario. Salieron del archivo de la Colmena.

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { TallyRow } from '@/modules/admin/colmena';


type PorColmenaRow = {
  n_colmena: string;
  snapshot: number;
  actual: number;
  modificados: number;
  nuevos: number;
  eliminados: number;
  delta: number;
};

export function PorColmenaTabla({ rows }: { rows: PorColmenaRow[] }) {
  return (
    <div className="mt-2 max-h-80 overflow-auto rounded border border-warning/30 bg-card/40">
      <table className="w-full text-[0.7rem]">
        <thead className="sticky top-0 bg-card/95 backdrop-blur">
          <tr className="border-b border-warning/30 text-warning">
            <th className="px-2 py-1.5 text-left font-semibold">Colmena</th>
            <th className="px-2 py-1.5 text-right font-semibold">Snapshot</th>
            <th className="px-2 py-1.5 text-right font-semibold">Actual</th>
            <th className="px-2 py-1.5 text-right font-semibold">Δ</th>
            <th className="px-2 py-1.5 text-center font-semibold">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tieneAnomalia = r.delta !== 0 || r.modificados > 0;
            return (
              <tr
                key={r.n_colmena}
                className={cn(
                  'border-b border-border/30',
                  tieneAnomalia ? 'bg-warning/10' : '',
                )}
              >
                <td className="px-2 py-1 font-mono font-semibold text-foreground">
                  {r.n_colmena}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                  {r.snapshot}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-foreground">
                  {r.actual}
                </td>
                <td
                  className={cn(
                    'px-2 py-1 text-right tabular-nums font-semibold',
                    r.delta > 0 && 'text-success',
                    r.delta < 0 && 'text-destructive',
                    r.delta === 0 && 'text-muted-foreground',
                  )}
                >
                  {r.delta > 0 ? `+${r.delta}` : r.delta}
                </td>
                <td className="px-2 py-1 text-center">
                  <div className="flex justify-center gap-1">
                    {r.nuevos > 0 && (
                      <span className="rounded bg-success/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-success">
                        +{r.nuevos}
                      </span>
                    )}
                    {r.eliminados > 0 && (
                      <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-destructive">
                        −{r.eliminados}
                      </span>
                    )}
                    {r.modificados > 0 && (
                      <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-accent">
                        ✎{r.modificados}
                      </span>
                    )}
                    {!tieneAnomalia && (
                      <span className="text-[0.6rem] text-muted-foreground">OK</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TalliesReconciliacionTabla({
  tallies,
  snapshotPorColmena,
}: {
  tallies: TallyRow[];
  snapshotPorColmena: Map<string, number>;
}) {
  // Determinar operarios y colmenas únicas
  const operarios = useMemo(() => {
    const set = new Set<string>();
    tallies.forEach((t) => set.add(t.operario_email));
    return Array.from(set).sort();
  }, [tallies]);

  const colmenas = useMemo(() => {
    const set = new Set<string>();
    tallies.forEach((t) => set.add(t.n_colmena));
    snapshotPorColmena.forEach((_, k) => set.add(k));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }, [tallies, snapshotPorColmena]);

  // Matrix [colmena][operario] = conteo
  const matriz = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    tallies.forEach((t) => {
      if (!m.has(t.n_colmena)) m.set(t.n_colmena, new Map());
      m.get(t.n_colmena)!.set(t.operario_email, t.conteo);
    });
    return m;
  }, [tallies]);

  // Filas con discrepancia (entre operarios entre sí, o vs snapshot)
  const filasConDiscrepancia = useMemo(() => {
    const set = new Set<string>();
    colmenas.forEach((c) => {
      const valores: number[] = [];
      const snap = snapshotPorColmena.get(c);
      if (snap != null) valores.push(snap);
      operarios.forEach((op) => {
        const v = matriz.get(c)?.get(op);
        if (v != null) valores.push(v);
      });
      const allEqual = valores.every((v) => v === valores[0]);
      if (!allEqual || valores.length < operarios.length + 1) {
        set.add(c);
      }
    });
    return set;
  }, [colmenas, operarios, matriz, snapshotPorColmena]);

  // Ordenar: discrepancias primero
  const colmenasOrdenadas = useMemo(() => {
    return [...colmenas].sort((a, b) => {
      const dA = filasConDiscrepancia.has(a) ? 0 : 1;
      const dB = filasConDiscrepancia.has(b) ? 0 : 1;
      if (dA !== dB) return dA - dB;
      return a.localeCompare(b, 'es', { numeric: true });
    });
  }, [colmenas, filasConDiscrepancia]);

  return (
    <div className="mt-2 max-h-96 overflow-auto rounded border border-warning/30 bg-card/40">
      <table className="w-full text-[0.7rem]">
        <thead className="sticky top-0 bg-card/95 backdrop-blur">
          <tr className="border-b border-warning/30 text-warning">
            <th className="px-2 py-1.5 text-left font-semibold">Colmena</th>
            <th className="px-2 py-1.5 text-right font-semibold">Snapshot</th>
            {operarios.map((op) => (
              <th key={op} className="px-2 py-1.5 text-right font-semibold" title={op}>
                {op.split('@')[0]}
              </th>
            ))}
            <th className="px-2 py-1.5 text-center font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {colmenasOrdenadas.map((c) => {
            const snap = snapshotPorColmena.get(c);
            const discrep = filasConDiscrepancia.has(c);
            const conteosOp = operarios.map((op) => matriz.get(c)?.get(op));
            const falta = conteosOp.some((v) => v == null);
            const todosIguales =
              !falta && conteosOp.every((v) => v === conteosOp[0]) && snap === conteosOp[0];
            return (
              <tr
                key={c}
                className={cn('border-b border-border/30', discrep ? 'bg-warning/10' : '')}
              >
                <td className="px-2 py-1 font-mono font-semibold text-foreground">{c}</td>
                <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                  {snap ?? '—'}
                </td>
                {operarios.map((op) => {
                  const v = matriz.get(c)?.get(op);
                  const diffVsSnap = v != null && snap != null && v !== snap;
                  return (
                    <td
                      key={op}
                      className={cn(
                        'px-2 py-1 text-right tabular-nums',
                        v == null && 'text-muted-foreground/50 italic',
                        v != null && diffVsSnap && 'font-semibold text-destructive',
                        v != null && !diffVsSnap && 'text-foreground',
                      )}
                    >
                      {v ?? '—'}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center">
                  {todosIguales ? (
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-success">
                      OK
                    </span>
                  ) : falta ? (
                    <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[0.6rem] font-semibold text-muted-foreground">
                      Falta
                    </span>
                  ) : (
                    <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-destructive">
                      Discrepancia
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StatBox({
  label,
  valor,
  color,
}: {
  label: string;
  valor: number;
  color: 'zinc' | 'indigo' | 'emerald' | 'red';
}) {
  const palette = {
    zinc: 'border-border bg-secondary/40 text-foreground',
    indigo: 'border-accent/40 bg-accent/10 text-accent',
    emerald: 'border-success/30 bg-success/15 text-success',
    red: 'border-destructive/30 bg-destructive/15 text-destructive',
  }[color];
  return (
    <div className={cn('rounded border px-2 py-1.5 text-center', palette)}>
      <div className="text-lg font-bold tabular-nums">{valor}</div>
      <div className="text-[0.6rem] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

