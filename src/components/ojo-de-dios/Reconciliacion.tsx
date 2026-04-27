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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-500/30 bg-zinc-900/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-400" />
          <strong className="text-sm">Reconciliación de inventario</strong>
          {generadoEn && (
            <span className="text-[0.65rem] text-zinc-500">
              · Última actualización: {generadoEn}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dias}
            onChange={(e) => setDias(parseInt(e.target.value))}
            className="h-8 rounded border border-white/10 bg-zinc-900 px-2 text-xs text-zinc-100"
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
            className="h-8 gap-1 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refrescar
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <div className="font-semibold">No se pudo cargar la reconciliación</div>
            <div className="mt-0.5 text-red-300/80">{error}</div>
          </div>
        </div>
      )}

      {!data && loading && (
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-6 text-center text-xs text-zinc-500">
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
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3">
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-zinc-400">
            Anomalías nuevas por día (últimos {dias} días)
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tendencia} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
                  }}
                />
                <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 10 }} />
                <ReTooltip
                  contentStyle={{
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
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
          <div className="mt-1 text-[0.65rem] text-zinc-500">
            Lo esperado con las defensas activas: línea plana cerca de cero. Si sube en días recientes,
            algo se rompió.
          </div>
        </div>
      )}

      {/* Top huérfanos */}
      <div className="rounded-lg border border-amber-500/30 bg-zinc-900/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-wider text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          Top huérfanos recientes ({huerfanos.length})
        </div>
        <TablaHuerfanos rows={huerfanos} />
      </div>

      {/* Top fantasmas */}
      <div className="rounded-lg border border-purple-500/30 bg-zinc-900/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-wider text-purple-400">
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
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  purple: {
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    chip: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  rose: {
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
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
    <div className={cn('rounded-lg border bg-zinc-900/40 p-3', styles.border)}>
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
      <div className="text-[0.65rem] text-zinc-500">{descripcion}</div>
    </div>
  );
}

function TablaHuerfanos({ rows }: { rows: ReconciliacionAnomaliaHuerfano[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded border border-white/10 bg-zinc-900/40 p-3 text-xs text-zinc-500">
        No hay cortes huérfanos. Todos los cortes tienen INGRESO o SOBRANTE previo.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10 text-left text-[0.65rem] uppercase tracking-wider text-zinc-500">
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
            <tr key={r.tubo_raiz_id + r.created_at} className="border-b border-white/5">
              <td className="px-2 py-1.5 text-zinc-400">{formatFecha(r.created_at)}</td>
              <td className="px-2 py-1.5 font-mono text-zinc-200">{r.n_colmena}</td>
              <td className="px-2 py-1.5 font-mono text-zinc-200">{r.cod}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-zinc-200">
                {Number(r.medida_cm).toFixed(1)} cm
              </td>
              <td className="px-2 py-1.5 text-zinc-400">{r.ot ?? '—'}</td>
              <td
                className="max-w-[280px] truncate px-2 py-1.5 text-[0.7rem] text-zinc-500"
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
      <div className="rounded border border-white/10 bg-zinc-900/40 p-3 text-xs text-zinc-500">
        No hay tubos fantasma en colmena. Todo el inventario tiene historia registrada.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10 text-left text-[0.65rem] uppercase tracking-wider text-zinc-500">
            <th className="px-2 py-1.5">Fecha ingreso BD</th>
            <th className="px-2 py-1.5">Colmena</th>
            <th className="px-2 py-1.5">Cod</th>
            <th className="px-2 py-1.5 text-right">Medida</th>
            <th className="px-2 py-1.5">tubo_raiz_id</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tubo_raiz_id} className="border-b border-white/5">
              <td className="px-2 py-1.5 text-zinc-400">{formatFecha(r.created_at)}</td>
              <td className="px-2 py-1.5 font-mono text-zinc-200">{r.n_colmena}</td>
              <td className="px-2 py-1.5 font-mono text-zinc-200">{r.cod}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-zinc-200">
                {Number(r.medida_cm).toFixed(1)} cm
              </td>
              <td
                className="px-2 py-1.5 font-mono text-[0.65rem] text-zinc-500"
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
