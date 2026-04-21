import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeftRight,
  Box,
  Clock,
  Eraser,
  History,
  Link2,
  Pencil,
  RotateCw,
  Ruler,
  Scissors,
  Search,
  Trash2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Evento = {
  id: string;
  cod: string;
  n_colmena: string | null;
  evento: string;
  medida_cm: number | null;
  medida_resultado_cm: number | null;
  ot: string | null;
  notas: string | null;
  fuente: string | null;
  registrado_por: string | null;
  tubo_raiz_id: string | null;
  created_at: string;
};

type EvCfg = {
  color: string;
  icon: LucideIcon;
  label: string;
  esRestauracion?: boolean;
};

const EV: Record<string, EvCfg> = {
  ingreso: { color: 'text-green-400', icon: Box, label: 'Ingreso' },
  corte: { color: 'text-blue-400', icon: Scissors, label: 'Corte' },
  sobrante: { color: 'text-violet-400', icon: ArrowLeftRight, label: 'Sobrante' },
  merma: { color: 'text-red-400', icon: Trash2, label: 'Merma' },
  error_reemplazo: { color: 'text-orange-400', icon: RotateCw, label: 'Reemplazo error' },
  sobrante_error: { color: 'text-fuchsia-400', icon: ArrowLeftRight, label: 'Sobrante error' },
  ajuste: { color: 'text-yellow-400', icon: Pencil, label: 'Ajuste admin' },
  eliminado: { color: 'text-zinc-400', icon: XCircle, label: 'Eliminado' },
  restauracion: { color: 'text-pink-400', icon: History, label: 'Restauración', esRestauracion: true },
};

const FUENTE_CFG: Record<string, { label: string }> = {
  excel: { label: 'Carga Excel' },
  optimizador_nuevo: { label: 'Tubo nuevo (opt.)' },
  retroactivo: { label: 'Registro retroactivo' },
  manual: { label: 'Ingreso manual' },
};

const PALETA = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e', '#a1a1aa'];

function formatFechaHora(d: string | null) {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMes(d: string) {
  const x = new Date(d);
  return x.toLocaleDateString('es-CL', { month: '2-digit', year: 'numeric' });
}

export function HistorialTubos() {
  const { empresaId } = useAuth();
  const [tab, setTab] = useState<'historial' | 'merma'>('historial');

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex items-center gap-2">
        <Ruler className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-lg font-bold">Historial de tubos</h1>
          <p className="text-xs text-muted-foreground">Trazabilidad · Merma mensual</p>
        </div>
      </header>

      <div className="mb-4 flex gap-1 border-b">
        <TabButton active={tab === 'historial'} onClick={() => setTab('historial')}>
          <Clock className="h-4 w-4" />
          Historial por tubo
        </TabButton>
        <TabButton active={tab === 'merma'} onClick={() => setTab('merma')}>
          <Trash2 className="h-4 w-4" />
          Merma mensual
        </TabButton>
      </div>

      {tab === 'historial' && <VistaHistorial empresaId={empresaId} />}
      {tab === 'merma' && <VistaMerma empresaId={empresaId} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-semibold transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ── Vista: Historial ──────────────────────────────────────────────────
function VistaHistorial({ empresaId }: { empresaId: string | null }) {
  const [cod, setCod] = useState('');
  const [colmena, setColmena] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Evento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    if (!empresaId) return;
    if (!cod.trim() && !colmena.trim()) {
      setError('Ingresa un código o número de colmena para buscar.');
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);

    let q = supabase
      .from('tubos_historial')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (cod.trim()) q = q.ilike('cod', `%${cod.trim().toUpperCase()}%`);
    if (colmena.trim()) q = q.ilike('n_colmena', `%${colmena.trim().toUpperCase()}%`);

    const { data: rows, error: err } = await q;
    setLoading(false);
    if (err) {
      setError(err.message);
      setData(null);
      return;
    }
    setData((rows as Evento[]) ?? []);
  };

  const grupos = useMemo(() => {
    if (!data) return [];
    const mapa = new Map<string, Evento[]>();
    for (const e of data) {
      const k = e.tubo_raiz_id ?? 'sin_raiz';
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(e);
    }
    return [...mapa.entries()];
  }, [data]);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Código de tubo (ej: BK10, DU90…)"
          value={cod}
          onChange={(e) => setCod(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          className="max-w-xs"
        />
        <Input
          placeholder="N° Colmena"
          value={colmena}
          onChange={(e) => setColmena(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          className="max-w-[160px]"
        />
        <Button onClick={buscar} disabled={loading}>
          <Search className="h-4 w-4" />
          {loading ? 'Buscando…' : 'Buscar'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <EmptyState>
          <Ruler className="mx-auto mb-3 h-10 w-10" />
          Ingresa el código o número de colmena de un tubo para ver su historial completo.
        </EmptyState>
      )}

      {data && data.length === 0 && (
        <EmptyState>
          <Ruler className="mx-auto mb-3 h-10 w-10" />
          No se encontraron eventos para ese tubo.
          <p className="mt-2 text-xs">
            El historial solo registra eventos desde que se implementó esta función.
          </p>
        </EmptyState>
      )}

      {data && data.length > 0 && (
        <>
          <div className="mb-3 px-1 text-xs text-muted-foreground">
            <strong className="text-foreground">{data.length}</strong> eventos · Código(s):{' '}
            <strong className="text-primary">
              {[...new Set(data.map((e) => e.cod))].join(', ')}
            </strong>
          </div>
          {grupos.map(([raizId, eventos]) => {
            const primero = eventos[0];
            const tieneMerma = eventos.some((e) => e.evento === 'merma');
            const esLinaje = raizId !== 'sin_raiz';
            return (
              <div key={raizId} className="mb-3 overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h6 className="flex items-center gap-1.5 text-sm font-bold">
                    <Link2 className="h-4 w-4 text-primary" />
                    {primero.cod} · Colmena {primero.n_colmena ?? '—'}
                    {tieneMerma && (
                      <span className="ml-1 text-xs text-red-400">→ MERMA</span>
                    )}
                  </h6>
                  <span className="text-right text-xs text-muted-foreground">
                    {eventos.length} evento{eventos.length !== 1 ? 's' : ''}
                    {esLinaje && (
                      <>
                        <br />
                        <span className="font-mono text-[10px]">
                          ID:{raizId.slice(0, 8)}…
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <ul className="py-2">
                  {eventos.map((e) => (
                    <EventoItem key={e.id} e={e} />
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

function EventoItem({ e }: { e: Evento }) {
  const cfg = EV[e.evento] ?? { color: 'text-zinc-400', icon: Box, label: e.evento };
  const Icon = cfg.icon;
  const medida = e.medida_cm != null ? `${Number(e.medida_cm).toFixed(1)} cm` : '—';
  const resultado =
    e.medida_resultado_cm != null ? `→ ${Number(e.medida_resultado_cm).toFixed(1)} cm` : '';
  const esRest = cfg.esRestauracion === true;
  const fuenteLabel =
    e.evento === 'ingreso'
      ? e.fuente
        ? FUENTE_CFG[e.fuente]?.label ?? e.fuente
        : 'Origen desconocido'
      : null;

  return (
    <>
      {esRest && (
        <li className="relative mx-4 my-1 border-t border-dashed border-pink-400/35 text-center">
          <span className="bg-background px-2 text-[10px] text-pink-400">
            — PUNTO DE RESTAURACIÓN —
          </span>
        </li>
      )}
      <li
        className={cn(
          'relative flex gap-3 px-4 py-2.5',
          esRest && 'mx-2 my-1 rounded-lg border border-pink-400/25 bg-pink-500/5',
        )}
      >
        <div
          className={cn(
            'mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted',
            cfg.color,
          )}
        >
          <Icon className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
            <Badge
              variant="secondary"
              className={cn('uppercase tracking-wide', cfg.color)}
            >
              {cfg.label}
            </Badge>
            {!esRest && (
              <span className="font-normal text-muted-foreground">
                {medida} {resultado}
              </span>
            )}
            {fuenteLabel && (
              <Badge variant="outline" className="text-[10px]">
                {fuenteLabel}
              </Badge>
            )}
          </div>
          {e.ot && (
            <div className="text-xs text-muted-foreground">
              OT: <strong>{e.ot}</strong> · Colmena: {e.n_colmena ?? '—'}
            </div>
          )}
          {!e.ot && e.n_colmena && (
            <div className="text-xs text-muted-foreground">Colmena: {e.n_colmena}</div>
          )}
          {e.notas && (
            <div
              className={cn(
                'mt-1 text-xs italic text-muted-foreground',
                esRest && 'not-italic text-pink-400',
              )}
            >
              {e.notas}
            </div>
          )}
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {formatFechaHora(e.created_at)}
            {e.registrado_por ? ` · ${e.registrado_por}` : ''}
          </div>
        </div>
      </li>
    </>
  );
}

// ── Vista: Merma ─────────────────────────────────────────────────────
type MermaEvento = Pick<
  Evento,
  'cod' | 'medida_cm' | 'evento' | 'created_at' | 'n_colmena' | 'ot' | 'notas'
> & { id?: string };

function VistaMerma({ empresaId }: { empresaId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MermaEvento[]>([]);

  useEffect(() => {
    if (!empresaId) return;
    const run = async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from('tubos_historial')
        .select('cod, medida_cm, evento, created_at, n_colmena, ot, notas')
        .eq('empresa_id', empresaId)
        .eq('evento', 'merma')
        .order('created_at', { ascending: false })
        .limit(500);
      setData((rows as MermaEvento[]) ?? []);
      setLoading(false);
    };
    run();
  }, [empresaId]);

  const { totalCm, totalM, porMes, meses, cods, chartData } = useMemo(() => {
    const porMes = new Map<
      string,
      Map<string, { total_cm: number; count: number; detalles: MermaEvento[] }>
    >();
    let totalCm = 0;
    for (const e of data) {
      totalCm += e.medida_cm ?? 0;
      const mes = formatMes(e.created_at);
      if (!porMes.has(mes)) porMes.set(mes, new Map());
      const codes = porMes.get(mes)!;
      if (!codes.has(e.cod)) codes.set(e.cod, { total_cm: 0, count: 0, detalles: [] });
      const entry = codes.get(e.cod)!;
      entry.total_cm += e.medida_cm ?? 0;
      entry.count += 1;
      entry.detalles.push(e);
    }
    const meses = [...porMes.keys()].reverse();
    const cods = [...new Set(data.map((e) => e.cod))];
    const chartData = meses.map((mes) => {
      const row: Record<string, number | string> = { mes };
      for (const c of cods) {
        const cm = porMes.get(mes)?.get(c)?.total_cm ?? 0;
        row[c] = Math.round(cm * 10) / 10;
      }
      return row;
    });
    return {
      totalCm,
      totalM: (totalCm / 100).toFixed(2),
      porMes,
      meses,
      cods,
      chartData,
    };
  }, [data]);

  if (loading) {
    return <EmptyState>Cargando merma…</EmptyState>;
  }

  if (data.length === 0) {
    return (
      <EmptyState>
        <Trash2 className="mx-auto mb-3 h-10 w-10" />
        No hay merma registrada aún.
        <p className="mt-2 text-xs">
          Se registrará automáticamente al guardar planes de corte desde el optimizador.
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatBox value={Math.round(totalCm).toLocaleString('es-CL')} label="cm total merma" />
        <StatBox value={totalM} label="metros merma" />
        <StatBox value={String(data.length)} label="eventos" />
      </div>

      <div className="mb-4 rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h6 className="flex items-center gap-1.5 text-sm font-bold">
            <Eraser className="h-4 w-4 text-red-400" />
            Merma por mes y código
          </h6>
        </div>
        <div className="h-[260px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number) => [`${v} cm`]}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {cods.map((c, i) => (
                <Bar
                  key={c}
                  dataKey={c}
                  stackId="merma"
                  fill={PALETA[i % PALETA.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4 pb-10">
        {meses.map((mes) => {
          const codes = porMes.get(mes)!;
          const totalMes = [...codes.values()].reduce((s, v) => s + v.total_cm, 0);
          const maxCm = Math.max(...[...codes.values()].map((v) => v.total_cm));
          const ordenados = [...codes.entries()].sort(
            (a, b) => b[1].total_cm - a[1].total_cm,
          );
          const totalEventos = [...codes.values()].reduce((s, v) => s + v.count, 0);

          return (
            <div key={mes}>
              <div className="mb-2 border-b pb-1 text-sm font-bold text-muted-foreground">
                📅 {mes} — total:{' '}
                <strong className="text-foreground">
                  {Math.round(totalMes).toLocaleString('es-CL')} cm
                </strong>{' '}
                ({(totalMes / 100).toFixed(2)} m)
              </div>
              {ordenados.map(([codigo, info]) => (
                <div
                  key={codigo}
                  className="flex items-center gap-3 border-b border-border/40 py-1.5"
                >
                  <div className="min-w-[80px] text-sm font-bold">{codigo}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(info.total_cm / maxCm) * 100}%` }}
                    />
                  </div>
                  <div className="min-w-[120px] text-right text-xs text-muted-foreground">
                    {Math.round(info.total_cm)} cm · {info.count} corte
                    {info.count !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Ver detalle de cada merma ({totalEventos} eventos)
                </summary>
                <div className="mt-2 overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Colmena</TableHead>
                        <TableHead className="text-right">cm</TableHead>
                        <TableHead>OT</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...codes.values()]
                        .flatMap((v) => v.detalles)
                        .sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime(),
                        )
                        .map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-bold">{e.cod}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {e.n_colmena ?? '—'}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-red-400">
                              {(e.medida_cm ?? 0).toFixed(1)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {e.ot ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
