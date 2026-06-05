// Panel de Inteligencia v4 — product register.
//
// Aplicado tras impeccable + emil:
// - Una sola familia (Geist). Sin Fraunces.
// - Hero ≤ 72px (bajo el ceiling de 6rem). Sin display fonts en data.
// - Sin numbered section markers 01/02/03 (scaffolding AI).
// - Sin tracked uppercase eyebrows en cada label (saturado en v3.1).
// - :active scale + ease curves específicas en botones (emil polish).
// - Specify exact transition properties, no `all`.

import { useEffect, useMemo, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

import { ESTADOS_ACTIVOS, ESTADOS_PRODUCCION } from './inteligencia/Inteligencia.config';
import type { ErrorCorte, Insumo, Mov, OT, Rack } from './inteligencia/Inteligencia.types';
import { diasDesde } from './inteligencia/utils/formato';
import Spinner from './inteligencia/components/Spinner';
import Sparkline from './inteligencia/components/Sparkline';
import GroupedBars from './inteligencia/components/GroupedBars';
import DiagDialog from './inteligencia/components/DiagDialog';
import CrossAlertsCard from './inteligencia/cards/CrossAlertsCard';
import OTRiskCard from './inteligencia/cards/OTRiskCard';
import ConsumoCard from './inteligencia/cards/ConsumoCard';
import ErroresCorteCard from './inteligencia/cards/ErroresCorteCard';
import RestockCard from './inteligencia/cards/RestockCard';
import ActivityCard from './inteligencia/cards/ActivityCard';
import InsightsCard from './inteligencia/cards/InsightsCard';
import StockGeneralCard from './inteligencia/cards/StockGeneralCard';

function serieDiaria(timestamps: (string | null | undefined)[], dias = 14): number[] {
  const ahora = Date.now();
  const dia = 24 * 60 * 60 * 1000;
  const buckets = new Array(dias).fill(0);
  for (const t of timestamps) {
    if (!t) continue;
    const ms = new Date(t).getTime();
    if (isNaN(ms)) continue;
    const dif = ahora - ms;
    const idx = dias - 1 - Math.floor(dif / dia);
    if (idx >= 0 && idx < dias) buckets[idx]++;
  }
  return buckets;
}

export function Inteligencia() {
  const { empresaId } = useAuth();
  const [ots, setOts] = useState<OT[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [movsHoy, setMovsHoy] = useState<Mov[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [errores, setErrores] = useState<ErrorCorte[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);

  const cargarTodo = async () => {
    if (!empresaId) return;
    setRefreshing(true);
    try {
      const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const hoy = new Date().toISOString().split('T')[0];

      const [rOts, rIns, rMovs, rRacks, rMovsHoy, rErrores] = await Promise.all([
        supabase.from('ots').select('id,estado,datos_generales,items,fecha_creacion,fecha_modificacion,total').eq('empresa_id', empresaId).order('fecha_modificacion', { ascending: false }),
        supabase.from('insumos').select('cod,nemotecnico,stock_mp,stock_liberado,minimo,categoria,sub_categoria,ubicacion').eq('empresa_id', empresaId).order('nemotecnico'),
        supabase.from('movimientos_insumos').select('id,tipo,cantidad,fecha,codigo,producto,ot,almacen,responsable_entrega,bitacora').eq('empresa_id', empresaId).gte('fecha', hace30dias).order('fecha', { ascending: false }),
        supabase.from('ubicaciones_rack').select('rack,fila,columna,codigo_insumo,almacen').eq('empresa_id', empresaId),
        supabase.from('movimientos_insumos').select('id,tipo,cantidad,fecha,codigo,producto,ot,almacen,responsable_entrega,bitacora').eq('empresa_id', empresaId).gte('fecha', hoy).order('fecha', { ascending: false }).limit(50),
        supabase.from('errores_corte').select('motivo,created_at,ot,cod_original,medida_cm,reemplazo_cod,reemplazo_colmena,registrado_por').eq('empresa_id', empresaId).order('created_at', { ascending: true }).limit(500),
      ]);

      setOts((rOts.data as OT[]) || []);
      setInsumos(((rIns.data as Omit<Insumo, 'stock_total'>[]) || []).map((i) => ({ ...i, stock_total: (i.stock_mp || 0) + (i.stock_liberado || 0) })));
      setMovs((rMovs.data as Mov[]) || []);
      setRacks((rRacks.data as Rack[]) || []);
      setMovsHoy((rMovsHoy.data as Mov[]) || []);
      setErrores((rErrores.data as ErrorCorte[]) || []);
      setLastUpdate(new Date());
    } catch (e) {
      toast.error('Error al cargar datos. Revisa la conexión.');
      console.error('[Inteligencia]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    const id = setInterval(cargarTodo, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const otsActivas = useMemo(() => ots.filter((o) => ESTADOS_ACTIVOS.includes(o.estado || '')), [ots]);
  const otsProduccion = useMemo(() => ots.filter((o) => ESTADOS_PRODUCCION.includes(o.estado || '')), [ots]);
  const stockBajo = useMemo(() => insumos.filter((i) => i.minimo != null && Number(i.minimo) > 0 && i.stock_total <= Number(i.minimo)), [insumos]);
  const otsSinMov = useMemo(() => ots.filter((o) => ESTADOS_PRODUCCION.includes(o.estado || '') && diasDesde(o.fecha_modificacion) >= 3), [ots]);
  const salidas = useMemo(() => movs.filter((m) => { const t = (m.tipo || '').toLowerCase(); return t.includes('salida') || t.includes('despacho'); }), [movs]);
  const consumoMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of salidas) {
      const k = (m.codigo || '').trim().toUpperCase();
      if (!k) continue;
      map[k] = (map[k] || 0) + (Number(m.cantidad) || 0);
    }
    return map;
  }, [salidas]);

  const serieMovs = useMemo(() => serieDiaria(movs.map((m) => m.fecha), 14), [movs]);
  const serieEntradas = useMemo(
    () => serieDiaria(movs.filter((m) => (m.tipo || '').toLowerCase() === 'entrada').map((m) => m.fecha), 14),
    [movs],
  );
  const serieSalidas = useMemo(
    () => serieDiaria(movs.filter((m) => (m.tipo || '').toLowerCase() === 'salida').map((m) => m.fecha), 14),
    [movs],
  );
  const serieAjustes = useMemo(
    () => serieDiaria(movs.filter((m) => (m.tipo || '').toLowerCase() === 'ajuste').map((m) => m.fecha), 14),
    [movs],
  );
  const matrizMovs = useMemo(() => {
    return serieEntradas.map((_, i) => [serieEntradas[i], serieSalidas[i], serieAjustes[i]]);
  }, [serieEntradas, serieSalidas, serieAjustes]);
  const labelsMovs = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: '2-digit' });
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000);
      const parts = fmt.formatToParts(d);
      const wk = (parts.find((p) => p.type === 'weekday')?.value || '').replace('.', '');
      const day = parts.find((p) => p.type === 'day')?.value || '';
      return `${wk.charAt(0).toUpperCase()}${wk.slice(1, 2)} ${day}`;
    });
  }, []);

  if (loading) {
    return (
      <div className="theme-dp flex min-h-full items-center justify-center bg-background text-muted-foreground">
        <Spinner label="Cargando" />
      </div>
    );
  }

  const movsEntrada = movsHoy.filter((m) => (m.tipo || '').toLowerCase() === 'entrada').length;
  const movsSalida = movsHoy.filter((m) => (m.tipo || '').toLowerCase() === 'salida').length;
  const fechaHoy = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="theme-dp min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-10 max-w-[1180px] items-center justify-between gap-4 px-8">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-foreground">Inteligencia</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-[12px] text-muted-foreground">Tiempo real</span>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="dp-num flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <span
                  className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    refreshing ? 'animate-pulse bg-accent' : 'bg-success',
                  )}
                />
                {lastUpdate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => setDiagOpen(true)}
              className="dp-press flex h-7 items-center gap-1.5 rounded-sm px-2 text-[12px] text-foreground/75 hover:text-foreground hover:bg-foreground/[0.04]"
            >
              <Bot className="h-3.5 w-3.5" />
              Diagnóstico
            </button>
            <button
              onClick={cargarTodo}
              disabled={refreshing}
              className="dp-press flex h-7 items-center gap-1.5 rounded-sm bg-foreground px-2.5 text-[12px] font-medium text-background hover:bg-foreground/90"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Actualizar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-8 pb-16 pt-8">
        <div className="mb-7 text-[12px] text-muted-foreground first-letter:capitalize">
          {fechaHoy}
        </div>

        <section className="mb-12 grid gap-10 md:grid-cols-12">
          <div className="md:col-span-8">
            <div className="text-[12px] text-muted-foreground">Estado operacional</div>
            <div className="mt-3 flex items-end gap-5">
              <div className="dp-display text-[64px] leading-[0.9] text-foreground">
                {otsActivas.length}
              </div>
              <div className="pb-2">
                <div className="text-[13px] font-medium text-foreground">OTs activas</div>
                <div className="dp-num mt-0.5 text-[11.5px] text-muted-foreground">
                  {otsProduccion.length} en producción · {otsActivas.length - otsProduccion.length} previo
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-x-10 border-t border-border pt-5">
              <SubStat
                label="Movimientos hoy"
                value={movsHoy.length}
                detail={`${movsEntrada} entradas, ${movsSalida} salidas`}
                serie={serieMovs}
              />
              <SubStat
                label="Entradas 14d"
                value={serieEntradas.reduce((a, b) => a + b, 0)}
                detail="ingresos a bodega"
                tone="success"
                serie={serieEntradas}
              />
              <SubStat
                label="Salidas 14d"
                value={serieSalidas.reduce((a, b) => a + b, 0)}
                detail="entregas a producción"
                tone="danger"
                serie={serieSalidas}
              />
            </div>
          </div>

          <div className="md:col-span-4 md:border-l md:border-border md:pl-8">
            <div className="text-[12px] text-muted-foreground">Pipeline</div>
            <div className="mt-4 space-y-2">
              <PipelineRow label="Cotización" value={ots.filter((o) => o.estado === 'cotizacion').length} />
              <PipelineRow label="Medición" value={ots.filter((o) => o.estado === 'medicion').length} />
              <PipelineRow label="Aprobado" value={ots.filter((o) => o.estado === 'aprobado').length} />
              <PipelineRow label="Producción" value={ots.filter((o) => o.estado === 'produccion').length} accent />
              <PipelineRow label="Listo" value={ots.filter((o) => o.estado === 'listo').length} />
              <PipelineRow label="Instalación" value={ots.filter((o) => o.estado === 'instalacion').length} />
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="text-[12px] text-muted-foreground">Alertas pendientes</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className={cn(
                    'dp-num text-[20px] font-medium leading-none tabular-nums',
                    (stockBajo.length + otsSinMov.length) > 0 ? 'text-warning' : 'text-foreground',
                  )}
                >
                  {stockBajo.length + otsSinMov.length}
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  {stockBajo.length} stock · {otsSinMov.length} OTs
                </span>
              </div>
            </div>
          </div>
        </section>

        <SectionHeader title="Ritmo de bodega" />
        <div className="mb-10">
          <div className="mb-7 flex items-baseline justify-between">
            <div className="text-[12px] text-muted-foreground">
              Movimientos diarios últimos 14 días
            </div>
            <div className="flex items-center gap-4 text-[11.5px] text-muted-foreground">
              <LegendDot color="success" label="Entrada" />
              <LegendDot color="destructive" label="Salida" />
              <LegendDot color="warning" label="Ajuste" />
            </div>
          </div>
          <GroupedBars
            data={matrizMovs}
            labels={labelsMovs}
            series={[
              { key: 'entrada', label: 'Entrada', colorVar: 'success' },
              { key: 'salida', label: 'Salida', colorVar: 'destructive' },
              { key: 'ajuste', label: 'Ajuste', colorVar: 'warning' },
            ]}
            ariaLabel="Movimientos de bodega por tipo, últimos 14 días"
          />
        </div>

        <SectionHeader title="Alertas críticas" count={stockBajo.length + otsSinMov.length} />
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <CrossAlertsCard insumos={insumos} stockBajo={stockBajo} racks={racks} ots={ots} movs={movs} />
          <OTRiskCard ots={ots} />
        </div>

        <SectionHeader title="Consumo y reposición" />
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
          <ConsumoCard salidas={salidas} insumos={insumos} />
          <ErroresCorteCard errores={errores} />
          <RestockCard insumos={insumos} consumoMap={consumoMap} />
        </div>

        <SectionHeader title="Actividad reciente" />
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <ActivityCard movs={movs} insumos={insumos} />
          <InsightsCard ots={ots} insumos={insumos} movs={movs} />
        </div>

        <SectionHeader title="Stock general" />
        <StockGeneralCard
          insumos={insumos}
          racks={racks}
          consumoMap={consumoMap}
          filtro={filtroCategoria}
          onFiltro={setFiltroCategoria}
        />
      </div>

      <DiagDialog open={diagOpen} onOpenChange={setDiagOpen} ots={ots} insumos={insumos} movs={movs} racks={racks} />
    </div>
  );
}

// ─── Subcomponentes locales ─────────────────────────────────────────

function SubStat({
  label,
  value,
  detail,
  tone = 'default',
  serie,
}: {
  label: string;
  value: number;
  detail: string;
  tone?: 'default' | 'muted' | 'warning' | 'danger' | 'success';
  serie?: number[];
}) {
  const color =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'danger'
        ? 'text-destructive'
        : tone === 'success'
          ? 'text-success'
          : tone === 'muted'
            ? 'text-muted-foreground'
            : 'text-foreground';
  return (
    <div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className={cn('dp-num text-[22px] font-medium leading-none tabular-nums', color)}>
          {value}
        </span>
        {serie && (
          <Sparkline
            values={serie}
            width={64}
            height={18}
            className={cn('flex-shrink-0', color)}
          />
        )}
      </div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function PipelineRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className={cn('text-foreground/80', accent && 'font-medium text-foreground')}>
        {label}
      </span>
      <span className="flex flex-1 items-baseline gap-1.5">
        <span className="h-px flex-1 self-end border-t border-dotted border-border" />
        <span
          className={cn(
            'dp-num tabular-nums text-foreground/70',
            accent && 'text-accent font-medium',
          )}
        >
          {value}
        </span>
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2 w-2 flex-shrink-0"
        style={{ background: `hsl(var(--${color}))` }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-5 mt-12 flex items-baseline justify-between border-b border-border pb-2.5">
      <h2 className="text-[14px] font-medium tracking-tight text-foreground">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="dp-num text-[12px] tabular-nums text-muted-foreground">{count}</span>
      )}
    </div>
  );
}
