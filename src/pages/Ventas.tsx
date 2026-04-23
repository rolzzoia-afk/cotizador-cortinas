import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronUp,
  CircleAlert,
  CircleCheckBig,
  CircleDot,
  ClipboardCheck,
  CloudUpload,
  Hourglass,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Settings,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
type KpiConfig = {
  meta_visitas: number;
  meta_cierre_pct: number;
  canales: string[];
  vendedoras: string[];
  terreno: string[];
};

type Periodo = 'dia' | 'semana' | 'mes';

type Registro = {
  fecha: string;
  clave: string;
  valor: number;
};

// ─────────────────────────────────────────────────────────────
// Defaults y helpers
// ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: KpiConfig = {
  meta_visitas: 3,
  meta_cierre_pct: 50,
  canales: ['Instagram', 'WhatsApp 1', 'WhatsApp 2', 'WhatsApp 3', 'Shopify'],
  vendedoras: ['Génesis', 'María C.', 'Luisanna', 'Adriana', 'Analí'],
  terreno: ['Alan', 'Antonio', 'Lourdes'],
};

const CANAL_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#22c55e',
  '#ef4444',
  '#38bdf8',
  '#a855f7',
  '#f97316',
  '#ec4899',
];

function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

function slugify(str: string): string {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function iniciales(nombre: string): string {
  return (nombre || '?')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function colorPct(pct: number, meta: number): string {
  if (pct >= meta) return '#22c55e';
  if (pct >= meta * 0.7) return '#f59e0b';
  return '#ef4444';
}

// ─────────────────────────────────────────────────────────────
// Sub: Header de sección
// ─────────────────────────────────────────────────────────────
function SectionHeader({
  icon,
  iconBg,
  iconColor,
  title,
  sub,
  right,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-bold text-white">{title}</div>
        <div className="mt-0.5 text-xs text-slate-400">{sub}</div>
      </div>
      {right}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Gauge SVG (semicírculo)
// ─────────────────────────────────────────────────────────────
function Gauge({ pct, hasData }: { pct: number; hasData: boolean }) {
  const cx = 80;
  const cy = 80;
  const r = 64;
  const startAngle = Math.PI;
  const endAngleFull = 2 * Math.PI;
  const realAngle = startAngle + Math.min(pct / 100, 1) * Math.PI;

  const toXY = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const bgStart = toXY(startAngle);
  const bgEnd = toXY(endAngleFull);
  const fillEnd = toXY(realAngle);
  const largeArc = realAngle - startAngle > Math.PI ? 1 : 0;

  return (
    <div className="relative mx-auto h-20 w-40 overflow-hidden">
      <svg viewBox="0 0 160 160" className="absolute left-0 top-0 h-40 w-40">
        {!hasData && (
          <path
            d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="16"
            strokeDasharray="6 6"
            fill="none"
          />
        )}
        {hasData && (
          <>
            <path
              d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="16"
              fill="none"
            />
            <path
              d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`}
              stroke={colorPct(pct, 50)}
              strokeWidth="16"
              strokeLinecap="butt"
              fill="none"
            />
          </>
        )}
      </svg>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[22px] font-extrabold leading-none"
        style={{ color: hasData ? colorPct(pct, 50) : '#64748b' }}
      >
        {hasData ? `${pct}%` : '—'}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Número con input controlado (sin spinners)
// ─────────────────────────────────────────────────────────────
function NumInput({
  value,
  onChange,
  className,
  min = 0,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const raw = Number(e.target.value) || 0;
        let v = Math.max(min, raw);
        if (max != null) v = Math.min(max, v);
        onChange(v);
      }}
      className={cn(
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className,
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Chip list para modal
// ─────────────────────────────────────────────────────────────
function ChipList({
  items,
  onRemove,
}: {
  items: string[];
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <div
          key={`${item}-${i}`}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-800 px-3 py-1 text-xs text-slate-200"
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="text-red-500 hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Config Dialog
// ─────────────────────────────────────────────────────────────
function ConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: KpiConfig;
  onSave: (c: KpiConfig) => Promise<void>;
}) {
  const [draft, setDraft] = useState<KpiConfig>(config);
  const [nuevoCanal, setNuevoCanal] = useState('');
  const [nuevaVendedora, setNuevaVendedora] = useState('');
  const [nuevoTerreno, setNuevoTerreno] = useState('');

  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const addCanal = () => {
    const v = nuevoCanal.trim();
    if (!v) return;
    setDraft((d) => ({ ...d, canales: [...d.canales, v] }));
    setNuevoCanal('');
  };
  const addVendedora = () => {
    const v = nuevaVendedora.trim();
    if (!v) return;
    setDraft((d) => ({ ...d, vendedoras: [...d.vendedoras, v] }));
    setNuevaVendedora('');
  };
  const addTerreno = () => {
    const v = nuevoTerreno.trim();
    if (!v) return;
    setDraft((d) => ({ ...d, terreno: [...d.terreno, v] }));
    setNuevoTerreno('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-white/10 bg-slate-900 text-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Settings className="h-4 w-4" /> Configuración KPI Ventas
          </DialogTitle>
        </DialogHeader>

        <section className="mb-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Metas</div>
          <div className="flex items-center justify-between border-b border-white/10 py-2.5">
            <span className="text-sm">Meta de visitas por asesora (diario)</span>
            <NumInput
              value={draft.meta_visitas}
              min={1}
              onChange={(v) => setDraft((d) => ({ ...d, meta_visitas: v }))}
              className="w-20 rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-center font-bold text-white"
            />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm">Meta % cierre de cotizaciones</span>
            <NumInput
              value={draft.meta_cierre_pct}
              min={1}
              max={100}
              onChange={(v) => setDraft((d) => ({ ...d, meta_cierre_pct: v }))}
              className="w-20 rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-center font-bold text-white"
            />
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Canales de contacto</div>
          <ChipList
            items={draft.canales}
            onRemove={(i) =>
              setDraft((d) => ({ ...d, canales: d.canales.filter((_, idx) => idx !== i) }))
            }
          />
          <div className="mt-2 flex gap-2">
            <Input
              value={nuevoCanal}
              onChange={(e) => setNuevoCanal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCanal()}
              placeholder="Nuevo canal (ej: TikTok)"
              className="flex-1 border-white/10 bg-slate-800 text-slate-200"
            />
            <Button onClick={addCanal} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
            Equipo — Llamadas / cotizaciones
          </div>
          <ChipList
            items={draft.vendedoras}
            onRemove={(i) =>
              setDraft((d) => ({
                ...d,
                vendedoras: d.vendedoras.filter((_, idx) => idx !== i),
              }))
            }
          />
          <div className="mt-2 flex gap-2">
            <Input
              value={nuevaVendedora}
              onChange={(e) => setNuevaVendedora(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addVendedora()}
              placeholder="Nombre vendedora"
              className="flex-1 border-white/10 bg-slate-800 text-slate-200"
            />
            <Button onClick={addVendedora} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Equipo — Terreno</div>
          <ChipList
            items={draft.terreno}
            onRemove={(i) =>
              setDraft((d) => ({ ...d, terreno: d.terreno.filter((_, idx) => idx !== i) }))
            }
          />
          <div className="mt-2 flex gap-2">
            <Input
              value={nuevoTerreno}
              onChange={(e) => setNuevoTerreno(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTerreno()}
              placeholder="Nombre vendedor/a terreno"
              className="flex-1 border-white/10 bg-slate-800 text-slate-200"
            />
            <Button onClick={addTerreno} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              await onSave(draft);
              onOpenChange(false);
            }}
          >
            Guardar configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export function Ventas() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();

  const [config, setConfig] = useState<KpiConfig>(DEFAULT_CONFIG);
  const [fechaActiva, setFechaActiva] = useState<string>(hoyISO());
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [registros, setRegistros] = useState<Record<string, number>>({});
  const [historial, setHistorial] = useState<
    { label: string; Mensajes: number; Llamadas: number; Cierres: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  // ── Cargar config al montar
  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      const { data } = await supabase
        .from('kpi_config')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (data) {
        setConfig({
          meta_visitas: data.meta_visitas ?? DEFAULT_CONFIG.meta_visitas,
          meta_cierre_pct: data.meta_cierre_pct ?? DEFAULT_CONFIG.meta_cierre_pct,
          canales: (Array.isArray(data.canales) ? data.canales : DEFAULT_CONFIG.canales) as string[],
          vendedoras: (Array.isArray(data.vendedoras) ? data.vendedoras : DEFAULT_CONFIG.vendedoras) as string[],
          terreno: (Array.isArray(data.terreno) ? data.terreno : DEFAULT_CONFIG.terreno) as string[],
        });
      }
    })();
  }, [empresaId]);

  // ── Cargar registros del día activo
  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('kpi_registros')
        .select('clave, valor')
        .eq('empresa_id', empresaId)
        .eq('fecha', fechaActiva);
      const map: Record<string, number> = {};
      (data || []).forEach((r: { clave: string; valor: number }) => {
        map[r.clave] = Number(r.valor) || 0;
      });
      setRegistros(map);
      setLoading(false);
    })();
  }, [empresaId, fechaActiva]);

  // ── Cargar historial cuando cambia periodo
  useEffect(() => {
    if (!empresaId || periodo === 'dia') {
      setHistorial([]);
      return;
    }
    (async () => {
      const hoy = new Date(fechaActiva + 'T12:00:00');
      const dias = periodo === 'semana' ? 6 : 29;
      const fechas: string[] = [];
      for (let i = dias; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - i);
        fechas.push(d.toISOString().split('T')[0]);
      }
      const { data } = await supabase
        .from('kpi_registros')
        .select('fecha, clave, valor')
        .eq('empresa_id', empresaId)
        .gte('fecha', fechas[0])
        .lte('fecha', fechas[fechas.length - 1]);
      const porFecha: Record<string, Record<string, number>> = {};
      fechas.forEach((f) => {
        porFecha[f] = {};
      });
      (data || []).forEach((r: Registro) => {
        if (porFecha[r.fecha]) porFecha[r.fecha][r.clave] = Number(r.valor) || 0;
      });
      const hist = fechas.map((f) => {
        const d = new Date(f + 'T12:00:00');
        const label = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
        const Mensajes = config.canales.reduce(
          (s, c) => s + (porFecha[f]['canal_' + slugify(c)] || 0),
          0,
        );
        const Llamadas = config.vendedoras.reduce(
          (s, v) => s + (porFecha[f]['ll_llamadas_' + slugify(v)] || 0),
          0,
        );
        const Cierres = porFecha[f]['cierre_cerradas'] || 0;
        return { label, Mensajes, Llamadas, Cierres };
      });
      setHistorial(hist);
    })();
  }, [empresaId, periodo, fechaActiva, config.canales, config.vendedoras]);

  // ── Setters
  const setVal = (clave: string, valor: number) =>
    setRegistros((r) => ({ ...r, [clave]: valor }));

  const getVal = (clave: string): number => registros[clave] ?? 0;

  // ── Totales derivados
  const totalCanales = useMemo(
    () => config.canales.reduce((s, c) => s + getVal('canal_' + slugify(c)), 0),
    [config.canales, registros],
  );
  const totalLlamadas = useMemo(
    () =>
      config.vendedoras.reduce((s, v) => s + getVal('ll_llamadas_' + slugify(v)), 0),
    [config.vendedoras, registros],
  );

  const canalesChartData = useMemo(
    () =>
      config.canales
        .map((c, i) => ({
          name: c,
          value: getVal('canal_' + slugify(c)),
          color: CANAL_COLORS[i % CANAL_COLORS.length],
        }))
        .filter((d) => d.value > 0),
    [config.canales, registros],
  );

  // ── Terreno ordenado por pct desc
  const terrenoData = useMemo(() => {
    return config.terreno
      .map((v) => {
        const total = getVal('ter_total_' + slugify(v));
        const cerradas = getVal('ter_cerradas_' + slugify(v));
        const pct = total > 0 ? Math.round((cerradas / total) * 100) : 0;
        return { nombre: v, total, cerradas, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [config.terreno, registros]);

  // ── Cierre
  const envVal = getVal('cierre_enviadas');
  const cerVal = getVal('cierre_cerradas');
  const errorCierre = cerVal > envVal && envVal > 0;
  const cerAjustado = errorCierre ? envVal : cerVal;
  const pctCierre = envVal > 0 ? Math.round((cerAjustado / envVal) * 100) : 0;
  const pendientes = Math.max(0, envVal - cerAjustado);

  // ── Guardar todo
  const handleGuardar = async () => {
    if (!empresaId) return;
    setSaving(true);
    const ahora = new Date().toISOString();
    const rows = Object.entries(registros).map(([clave, valor]) => ({
      empresa_id: empresaId,
      fecha: fechaActiva,
      clave,
      valor,
      updated_at: ahora,
    }));
    if (rows.length === 0) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('kpi_registros')
      .upsert(rows, { onConflict: 'empresa_id,fecha,clave' });
    setSaving(false);
    if (error) {
      toast.error('Error al guardar: ' + error.message);
      return;
    }
    setUltimoGuardado(new Date());
    toast.success('Guardado en la nube');
  };

  const handleSaveConfig = async (nueva: KpiConfig) => {
    if (!empresaId) return;
    setConfig(nueva);
    const { error } = await supabase
      .from('kpi_config')
      .upsert(
        {
          empresa_id: empresaId,
          ...nueva,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'empresa_id' },
      );
    if (error) {
      toast.error('Error al guardar config: ' + error.message);
      return;
    }
    toast.success('Configuración guardada');
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 p-8 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-indigo-500/30 border-t-indigo-500" />
          <div className="text-sm">Cargando datos…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-200">
      {/* TOPBAR */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/landing')}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Inicio
          </button>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white">KPI Ventas</span>
            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
              DIARIO
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ultimoGuardado && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Guardado{' '}
              {ultimoGuardado.toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen(true)}
            className="gap-1.5"
          >
            <Settings className="h-4 w-4" /> Configurar
          </Button>
          <Button onClick={handleGuardar} disabled={saving} size="sm" className="gap-1.5">
            <CloudUpload className="h-4 w-4" /> Guardar
          </Button>
        </div>
      </div>

      {/* DATE BAR */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-slate-900/60 px-5 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="h-3.5 w-3.5" /> Fecha:
        </span>
        <input
          type="date"
          value={fechaActiva}
          onChange={(e) => setFechaActiva(e.target.value)}
          className="rounded-md border border-white/10 bg-slate-900 px-2.5 py-1 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
        />
        <div className="ml-auto flex gap-1.5">
          {(['dia', 'semana', 'mes'] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={cn(
                'rounded-md border px-3 py-1 text-xs transition-colors',
                periodo === p
                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                  : 'border-white/10 bg-transparent text-slate-400 hover:border-indigo-500/50',
              )}
            >
              {p === 'dia' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6">
        {/* BLOQUE 1: CANALES */}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <SectionHeader
            icon={<MessageCircle className="h-4 w-4" />}
            iconBg="rgba(99,102,241,0.15)"
            iconColor="#818cf8"
            title="Fuente de cotizaciones"
            sub="Cantidad de mensajes recibidos por canal hoy"
            right={
              <div className="text-right text-[22px] font-extrabold text-white">
                {totalCanales}
                <span className="block text-[11px] font-normal text-slate-400">total</span>
              </div>
            }
          />
          <div className="flex flex-wrap items-start gap-5">
            <div
              className="grid flex-1 gap-3"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                minWidth: 200,
              }}
            >
              {config.canales.map((canal, i) => {
                const color = CANAL_COLORS[i % CANAL_COLORS.length];
                const v = getVal('canal_' + slugify(canal));
                const pct = totalCanales > 0 ? Math.round((v / totalCanales) * 100) : 0;
                return (
                  <div
                    key={canal}
                    className="rounded-xl border border-white/10 bg-slate-800 p-3.5 text-center"
                  >
                    <div
                      className="mb-2.5 flex items-center justify-center gap-1.5 text-[11px]"
                      style={{ color }}
                    >
                      <CircleDot className="h-2 w-2 fill-current" /> {canal}
                    </div>
                    <NumInput
                      value={v}
                      onChange={(nv) => setVal('canal_' + slugify(canal), nv)}
                      className="w-full border-0 border-b-2 border-white/10 bg-transparent text-center text-[28px] font-extrabold text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="mt-1.5 text-[11px] text-slate-400">{pct}% del total</div>
                  </div>
                );
              })}
            </div>
            <div className="h-32 w-32 flex-shrink-0">
              {canalesChartData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={canalesChartData}
                      dataKey="value"
                      innerRadius={38}
                      outerRadius={62}
                      paddingAngle={1}
                      strokeWidth={0}
                    >
                      {canalesChartData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <ReTooltip
                      contentStyle={{
                        background: '#141726',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* BLOQUE 2: LLAMADAS */}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <SectionHeader
            icon={<Phone className="h-4 w-4" />}
            iconBg="rgba(245,158,11,0.15)"
            iconColor="#f59e0b"
            title="Llamadas diarias"
            sub="Cotizaciones atendidas por vendedora"
            right={
              <div className="text-right text-[22px] font-extrabold text-white">
                {totalLlamadas}
                <span className="block text-[11px] font-normal text-slate-400">llamadas</span>
              </div>
            }
          />
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))' }}
          >
            {config.vendedoras.map((v) => {
              const ll = getVal('ll_llamadas_' + slugify(v));
              const cot = getVal('ll_cotz_' + slugify(v));
              const pctCot =
                totalCanales > 0
                  ? Math.round((cot / totalCanales) * 100)
                  : cot > 0
                    ? 100
                    : 0;
              const badge =
                cot > 0
                  ? pctCot >= 70
                    ? {
                        cls: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-500',
                        icon: <CircleCheckBig className="h-3 w-3" />,
                        text: `${pctCot}% de cotizaciones (${cot}/${totalCanales || cot})`,
                      }
                    : pctCot >= 40
                      ? {
                          cls: 'border-amber-500/30 bg-amber-500/15 text-amber-500',
                          icon: <ChevronUp className="h-3 w-3" />,
                          text: `${pctCot}% de cotizaciones (${cot}/${totalCanales || cot})`,
                        }
                      : {
                          cls: 'border-red-500/30 bg-red-500/15 text-red-500',
                          icon: <CircleAlert className="h-3 w-3" />,
                          text: `${pctCot}% de cotizaciones (${cot}/${totalCanales || cot})`,
                        }
                  : ll > 0
                    ? {
                        cls: 'border-white/10 bg-slate-800 text-slate-400',
                        icon: <CircleDot className="h-3 w-3" />,
                        text: '0 cotizaciones asignadas',
                      }
                    : {
                        cls: 'border-white/10 bg-slate-800 text-slate-400',
                        icon: <Hourglass className="h-3 w-3" />,
                        text: 'Sin datos aún',
                      };
              return (
                <div
                  key={v}
                  className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-slate-800 p-3.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-400 text-[13px] font-bold text-white">
                      {iniciales(v)}
                    </div>
                    <div className="text-[13px] font-semibold text-white">{v}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] uppercase tracking-wide text-slate-400">
                        Llamadas del día
                      </Label>
                      <NumInput
                        value={ll}
                        onChange={(nv) => setVal('ll_llamadas_' + slugify(v), nv)}
                        className="w-full rounded-md border border-white/10 bg-slate-900 px-1.5 py-1.5 text-center text-xl font-bold text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] uppercase tracking-wide text-slate-400">
                        Cotizaciones atendidas
                      </Label>
                      <NumInput
                        value={cot}
                        onChange={(nv) => setVal('ll_cotz_' + slugify(v), nv)}
                        className="w-full rounded-md border border-white/10 bg-slate-900 px-1.5 py-1.5 text-center text-xl font-bold text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex items-center justify-center gap-1 rounded-full border px-2 py-1 text-center text-[10px] font-semibold',
                      badge.cls,
                    )}
                  >
                    {badge.icon} {badge.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BLOQUE 3: META VISITAS */}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <SectionHeader
            icon={<Target className="h-4 w-4" />}
            iconBg="rgba(34,197,94,0.15)"
            iconColor="#22c55e"
            title="Meta de visitas diarias"
            sub={
              <>
                Progreso de cada asesora vs meta de{' '}
                <strong className="text-slate-200">{config.meta_visitas}</strong> visitas
              </>
            }
          />
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
          >
            {config.vendedoras.map((v) => {
              const visitas = getVal('meta_' + slugify(v));
              const meta = config.meta_visitas;
              const pct = Math.min(Math.round((visitas / meta) * 100), 100);
              const color =
                visitas >= meta
                  ? '#22c55e'
                  : visitas >= meta * 0.6
                    ? '#f59e0b'
                    : '#ef4444';
              return (
                <div
                  key={v}
                  className="rounded-xl border border-white/10 bg-slate-800 p-3.5"
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-white">{v}</div>
                    <div className="flex items-center gap-1.5">
                      <NumInput
                        value={visitas}
                        onChange={(nv) => setVal('meta_' + slugify(v), nv)}
                        className="w-16 rounded-md border border-white/10 bg-slate-900 px-1 py-1 text-center text-[22px] font-extrabold text-white focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="text-lg text-slate-400">/</span>
                      <span className="text-base font-bold text-slate-400">{meta}</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-white/5">
                    <div
                      className="h-full transition-all"
                      style={{ width: pct + '%', background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BLOQUE 4: CIERRE */}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <SectionHeader
            icon={<ClipboardCheck className="h-4 w-4" />}
            iconBg="rgba(239,68,68,0.15)"
            iconColor="#ef4444"
            title="Cierre de ventas"
            sub="Cotizaciones enviadas vs cerradas definitivamente"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-800 p-4 text-center">
              <div className="text-xs text-slate-400">Cotizaciones enviadas</div>
              <NumInput
                value={envVal}
                onChange={(v) => setVal('cierre_enviadas', v)}
                className="w-full border-0 border-b-2 border-white/10 bg-transparent text-center text-5xl font-extrabold leading-none text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-800 p-4 text-center">
              <div className="text-xs text-slate-400">Cotizaciones cerradas</div>
              <NumInput
                value={cerVal}
                onChange={(v) => setVal('cierre_cerradas', v)}
                className={cn(
                  'w-full border-0 border-b-2 bg-transparent text-center text-5xl font-extrabold leading-none text-white focus:outline-none',
                  errorCierre
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-white/10 focus:border-indigo-500',
                )}
              />
              {errorCierre && (
                <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-red-500">
                  <CircleAlert className="h-3 w-3" /> No puede superar las enviadas
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-around gap-5 rounded-xl border border-white/10 bg-slate-800 p-4 md:col-span-2">
              <div className="text-center">
                <Gauge pct={pctCierre} hasData={envVal > 0} />
                <div className="mt-1.5 text-[11px] text-slate-400">% de cierre real</div>
              </div>
              <div className="p-3 text-center">
                <div className="mb-1.5 text-[13px] text-slate-400">Tasa de cierre</div>
                <div className="text-3xl font-extrabold text-white">
                  {envVal > 0 ? `${pctCierre}%` : '—'}
                </div>
                <div className="mt-1.5 text-[11px] text-slate-400">
                  de las cotizaciones se cerraron
                </div>
              </div>
              <div className="p-3 text-center">
                <div className="mb-1 text-[13px] text-slate-400">Cotizaciones pendientes</div>
                <div className="text-4xl font-extrabold text-indigo-400">
                  {envVal > 0 ? pendientes : '—'}
                </div>
                <div className="text-[11px] text-slate-400">sin cerrar aún</div>
              </div>
            </div>
          </div>
        </div>

        {/* BLOQUE 5: TERRENO */}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <SectionHeader
            icon={<MapPin className="h-4 w-4" />}
            iconBg="rgba(14,165,233,0.15)"
            iconColor="#38bdf8"
            title="Vendedores en terreno"
            sub="Visitas del día y tasa de cierre por vendedor"
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['#', 'Vendedor', 'Visitas totales', 'Visitas cerradas', '% Cierre', 'Estado'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={cn(
                          'border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400',
                          i === 0 ? 'w-9 text-left' : i === 1 ? 'text-left' : 'text-center',
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {terrenoData.map((d, i) => {
                  const rank = i + 1;
                  const rankCls =
                    rank === 1
                      ? 'bg-amber-500/20 text-amber-500'
                      : rank === 2
                        ? 'bg-slate-400/15 text-slate-400'
                        : rank === 3
                          ? 'bg-amber-800/20 text-amber-800'
                          : '';
                  const pctCls =
                    d.pct >= 60
                      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-500'
                      : d.pct >= 30
                        ? 'border-amber-500/30 bg-amber-500/15 text-amber-500'
                        : 'border-red-500/30 bg-red-500/15 text-red-500';
                  const estado =
                    d.total === 0 ? (
                      <span className="text-xs text-slate-400">
                        <CircleDot className="inline h-3 w-3" /> Sin datos
                      </span>
                    ) : d.pct >= 60 ? (
                      <span className="text-xs font-semibold text-emerald-500">
                        <CircleCheckBig className="inline h-3 w-3" /> Excelente
                      </span>
                    ) : d.pct >= 30 ? (
                      <span className="text-xs font-semibold text-amber-500">
                        <ChevronUp className="inline h-3 w-3" /> En progreso
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-red-500">
                        <CircleAlert className="inline h-3 w-3" /> Bajo
                      </span>
                    );
                  return (
                    <tr
                      key={d.nombre}
                      className="border-b border-white/10 transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                            rankCls,
                          )}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[13px]">
                        <strong className="text-white">{d.nombre}</strong>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <NumInput
                          value={d.total}
                          onChange={(v) => setVal('ter_total_' + slugify(d.nombre), v)}
                          className="w-16 rounded-md border border-white/10 bg-slate-900 px-1.5 py-1 text-center text-base font-bold text-white focus:border-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <NumInput
                          value={d.cerradas}
                          onChange={(v) => setVal('ter_cerradas_' + slugify(d.nombre), v)}
                          className="w-16 rounded-md border border-white/10 bg-slate-900 px-1.5 py-1 text-center text-base font-bold text-white focus:border-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={cn(
                            'inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold',
                            pctCls,
                          )}
                        >
                          {d.pct}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">{estado}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* BLOQUE HISTORIAL */}
        {periodo !== 'dia' && historial.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <SectionHeader
              icon={<TrendingUp className="h-4 w-4" />}
              iconBg="rgba(99,102,241,0.15)"
              iconColor="#818cf8"
              title={periodo === 'semana' ? 'Evolución de la semana' : 'Evolución del mes'}
              sub="Mensajes recibidos, llamadas y cierres"
            />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historial}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <ReTooltip
                    contentStyle={{
                      background: '#141726',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="line"
                    formatter={(v) => <span style={{ color: '#94a3b8' }}>{v}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="Mensajes"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Llamadas"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Cierres"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <ConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        onSave={handleSaveConfig}
      />
    </div>
  );
}

