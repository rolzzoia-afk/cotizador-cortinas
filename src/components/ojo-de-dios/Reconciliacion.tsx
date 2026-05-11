import { useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ghost,
  RefreshCw,
  PackageX,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useReconciliacion,
  type ReconciliacionAnomaliaFantasma,
  type ReconciliacionAnomaliaHuerfano,
} from '@/modules/admin/hooks';

const PERIODOS = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
];

export function Reconciliacion() {
  const [dias, setDias] = useState(30);
  const { data, loading, error, refrescar } = useReconciliacion({ dias, limite: 50 });

  const counters = data?.counters;
  const tendencia = data?.tendencia ?? [];
  const huerfanos = data?.top_huerfanos ?? [];
  const fantasmas = data?.top_fantasmas ?? [];

  const generadoEn = data?.generado_en
    ? new Date(data.generado_en).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-card/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" />
          <strong className="text-sm">Reconciliación de inventario</strong>
          {generadoEn && (
            <span className="text-[0.65rem] text-muted-foreground">
              · Última actualización: {generadoEn}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dias}
            onChange={(e) => setDias(parseInt(e.target.value))}
            className="h-8 rounded border border-border bg-card px-2 text-xs text-foreground"
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                Tendencia: {p.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refrescar()}
            disabled={loading}
            className="h-8 gap-1 border-accent/30 text-accent hover:bg-accent/10"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refrescar
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <div className="font-semibold">No se pudo cargar la reconciliación</div>
            <div className="mt-0.5 text-destructive/80">{error}</div>
          </div>
        </div>
      )}

      {!data && loading && (
        <div className="rounded-lg border border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
          Calculando reconciliación...
        </div>
      )}

      {/* Counters */}
      {counters && (
        <div className="grid gap-3 md:grid-cols-3">
          <CounterCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Cortes huérfanos"
            descripcion="Cortes sin INGRESO o SOBRANTE previo"
            total={counters.huerfanos}
            ultimos7d={counters.huerfanos_7d}
            color="amber"
          />
          <CounterCard
            icon={<Ghost className="h-4 w-4" />}
            label="Inventario fantasma"
            descripcion="Tubos en colmena sin historia"
            total={counters.fantasmas}
            ultimos7d={counters.fantasmas_7d}
            color="purple"
          />
          <CounterCard
            icon={<PackageX className="h-4 w-4" />}
            label="Tubos perdidos"
            descripcion="INGRESO sin destino conocido"
            total={counters.perdidos}
            ultimos7d={counters.perdidos_7d}
            color="rose"
          />
        </div>
      )}

      {/* Tendencia */}
      {tendencia.length > 0 && (
        <div className="rounded-lg border border-border bg-card/40 p-3">
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Anomalías nuevas por día (últimos {dias} días)
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tendencia} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="dia"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
                  }}
                />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <ReTooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="huerfanos"
                  name="Huérfanos"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fantasmas"
                  name="Fantasmas"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 text-[0.65rem] text-muted-foreground">
            Lo esperado con las defensas activas: línea plana cerca de cero. Si sube en días recientes,
            algo se rompió.
          </div>
        </div>
      )}

      {/* Top huérfanos */}
      <div className="rounded-lg border border-warning/30 bg-card/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-wider text-warning">
          <AlertTriangle className="h-3 w-3" />
          Top huérfanos recientes ({huerfanos.length})
        </div>
        <TablaHuerfanos rows={huerfanos} />
      </div>

      {/* Top fantasmas */}
      <div className="rounded-lg border border-purple-500/30 bg-card/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-wider text-accent">
          <Ghost className="h-3 w-3" />
          Top fantasmas recientes ({fantasmas.length})
        </div>
        <TablaFantasmas rows={fantasmas} />
      </div>
    </div>
  );
}

const COLOR_CLASSES = {
  amber: {
    border: 'border-warning/30',
    text: 'text-warning',
    chip: 'bg-warning/15 text-warning border-warning/30',
  },
  purple: {
    border: 'border-purple-500/30',
    text: 'text-accent',
    chip: 'bg-accent/15 text-accent border-purple-500/30',
  },
  rose: {
    border: 'border-rose-500/30',
    text: 'text-destructive',
    chip: 'bg-destructive/15 text-destructive border-rose-500/30',
  },
};

type CounterColor = keyof typeof COLOR_CLASSES;

function CounterCard({
  icon,
  label,
  descripcion,
  total,
  ultimos7d,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  descripcion: string;
  total: number;
  ultimos7d: number;
  color: CounterColor;
}) {
  const styles = COLOR_CLASSES[color];
  return (
    <div className={cn('rounded-lg border bg-card/40 p-3', styles.border)}>
      <div className={cn('mb-1 flex items-center gap-2 text-xs', styles.text)}>
        {icon}
        <span className="font-semibold">{label}</span>
      </div>
      <div className="mb-1 flex items-end gap-2">
        <div className={cn('text-3xl font-extrabold', styles.text)}>{total}</div>
        <div
          className={cn(
            'mb-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold',
            styles.chip,
          )}
        >
          +{ultimos7d} en 7 días
        </div>
      </div>
      <div className="text-[0.65rem] text-muted-foreground">{descripcion}</div>
    </div>
  );
}

function TablaHuerfanos({ rows }: { rows: ReconciliacionAnomaliaHuerfano[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded border border-border bg-card/40 p-3 text-xs text-muted-foreground">
        No hay cortes huérfanos. Todos los cortes tienen INGRESO o SOBRANTE previo.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            <th className="px-2 py-1.5">Fecha</th>
            <th className="px-2 py-1.5">Colmena</th>
            <th className="px-2 py-1.5">Cod</th>
            <th className="px-2 py-1.5 text-right">Medida</th>
            <th className="px-2 py-1.5">OT</th>
            <th className="px-2 py-1.5">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tubo_raiz_id + r.created_at} className="border-b border-border">
              <td className="px-2 py-1.5 text-muted-foreground">{formatFecha(r.created_at)}</td>
              <td className="px-2 py-1.5 font-mono text-foreground">{r.n_colmena}</td>
              <td className="px-2 py-1.5 font-mono text-foreground">{r.cod}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
                {Number(r.medida_cm).toFixed(1)} cm
              </td>
              <td className="px-2 py-1.5 text-muted-foreground">{r.ot ?? '—'}</td>
              <td
                className="max-w-[280px] truncate px-2 py-1.5 text-[0.7rem] text-muted-foreground"
                title={r.detalle ?? ''}
              >
                {r.detalle ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaFantasmas({ rows }: { rows: ReconciliacionAnomaliaFantasma[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded border border-border bg-card/40 p-3 text-xs text-muted-foreground">
        No hay tubos fantasma en colmena. Todo el inventario tiene historia registrada.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            <th className="px-2 py-1.5">Fecha ingreso BD</th>
            <th className="px-2 py-1.5">Colmena</th>
            <th className="px-2 py-1.5">Cod</th>
            <th className="px-2 py-1.5 text-right">Medida</th>
            <th className="px-2 py-1.5">tubo_raiz_id</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tubo_raiz_id} className="border-b border-border">
              <td className="px-2 py-1.5 text-muted-foreground">{formatFecha(r.created_at)}</td>
              <td className="px-2 py-1.5 font-mono text-foreground">{r.n_colmena}</td>
              <td className="px-2 py-1.5 font-mono text-foreground">{r.cod}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
                {Number(r.medida_cm).toFixed(1)} cm
              </td>
              <td
                className="px-2 py-1.5 font-mono text-[0.65rem] text-muted-foreground"
                title={r.tubo_raiz_id}
              >
                {r.tubo_raiz_id.slice(0, 8)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
