// Orquestador del Panel KPI Ventas.
//
// Carga 2 datasets (config + registros del día) + opcionalmente historial
// (cuando periodo != 'dia'). Deriva memos y compone 6 secciones
// independientes. Cada sección recibe slices por props.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, CloudUpload, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import type { KpiConfig, Periodo, Registro } from './ventas/Ventas.types';
import { DEFAULT_CONFIG, CANAL_COLORS } from './ventas/Ventas.config';
import { hoyISO, slugify } from './ventas/utils/helpers';
import ConfigDialog from './ventas/components/ConfigDialog';
import CanalesSection from './ventas/secciones/CanalesSection';
import LlamadasSection from './ventas/secciones/LlamadasSection';
import MetaVisitasSection from './ventas/secciones/MetaVisitasSection';
import CierreSection from './ventas/secciones/CierreSection';
import TerrenoSection from './ventas/secciones/TerrenoSection';
import HistorialSection from './ventas/secciones/HistorialSection';

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

  // Cargar config al montar
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

  // Cargar registros del día activo
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

  // Cargar historial cuando cambia periodo
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

  // Setters de valores individuales
  const setVal = (clave: string, valor: number) =>
    setRegistros((r) => ({ ...r, [clave]: valor }));
  const getVal = (clave: string): number => registros[clave] ?? 0;

  // Memos derivados
  const totalCanales = useMemo(
    () => config.canales.reduce((s, c) => s + getVal('canal_' + slugify(c)), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.canales, registros],
  );
  const totalLlamadas = useMemo(
    () =>
      config.vendedoras.reduce((s, v) => s + getVal('ll_llamadas_' + slugify(v)), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.canales, registros],
  );

  const terrenoData = useMemo(() => {
    return config.terreno
      .map((v) => {
        const total = getVal('ter_total_' + slugify(v));
        const cerradas = getVal('ter_cerradas_' + slugify(v));
        const pct = total > 0 ? Math.round((cerradas / total) * 100) : 0;
        return { nombre: v, total, cerradas, pct };
      })
      .sort((a, b) => b.pct - a.pct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.terreno, registros]);

  // Valores derivados del cierre
  const envVal = getVal('cierre_enviadas');
  const cerVal = getVal('cierre_cerradas');
  const errorCierre = cerVal > envVal && envVal > 0;
  const cerAjustado = errorCierre ? envVal : cerVal;
  const pctCierre = envVal > 0 ? Math.round((cerAjustado / envVal) * 100) : 0;
  const pendientes = Math.max(0, envVal - cerAjustado);

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-8 text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-accent/30 border-t-indigo-500" />
          <div className="text-sm">Cargando datos…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/landing')}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-card"
          >
            <ArrowLeft className="h-4 w-4" /> Inicio
          </button>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-foreground">KPI Ventas</span>
            <span className="rounded-full border border-accent/30 bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
              DIARIO
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ultimoGuardado && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-success" />
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

      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card/60 px-5 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" /> Fecha:
        </span>
        <input
          type="date"
          value={fechaActiva}
          onChange={(e) => setFechaActiva(e.target.value)}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
        />
        <div className="ml-auto flex gap-1.5">
          {(['dia', 'semana', 'mes'] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={cn(
                'rounded-md border px-3 py-1 text-xs transition-colors',
                periodo === p
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-transparent text-muted-foreground hover:border-accent/50',
              )}
            >
              {p === 'dia' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6">
        <CanalesSection
          canales={config.canales}
          totalCanales={totalCanales}
          canalesChartData={canalesChartData}
          getVal={getVal}
          setVal={setVal}
        />
        <LlamadasSection
          vendedoras={config.vendedoras}
          totalCanales={totalCanales}
          totalLlamadas={totalLlamadas}
          getVal={getVal}
          setVal={setVal}
        />
        <MetaVisitasSection
          vendedoras={config.vendedoras}
          metaVisitas={config.meta_visitas}
          getVal={getVal}
          setVal={setVal}
        />
        <CierreSection
          envVal={envVal}
          cerVal={cerVal}
          errorCierre={errorCierre}
          pctCierre={pctCierre}
          pendientes={pendientes}
          setVal={setVal}
        />
        <TerrenoSection terrenoData={terrenoData} setVal={setVal} />
        <HistorialSection historial={historial} periodo={periodo} />
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
