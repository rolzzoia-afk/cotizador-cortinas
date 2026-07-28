// Orquestador del Panel KPI Ventas.
//
// Carga 2 datasets (config + filas del rango activo). El rango depende del
// botón Hoy/Semana/Mes: 'dia' trae solo la fecha, 'semana' desde el lunes de
// esa semana y 'mes' desde el 1°, siempre hasta la fecha seleccionada. Las
// tarjetas muestran la SUMA del rango (solo-lectura fuera de 'dia', porque
// Guardar escribe contra la fecha activa) y el gráfico, el día a día.

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
import {
  construirHistorial,
  hoyISO,
  rangoPeriodo,
  slugify,
  sumarRegistros,
  textoPeriodo,
} from './ventas/utils/helpers';
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
  const [filas, setFilas] = useState<Registro[]>([]);
  // `loading` solo cubre la primera carga (pantalla completa); los cambios de
  // fecha/período usan `refrescando`, que mantiene el panel en pantalla.
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
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

  // Rango de fechas que alimenta las tarjetas: día suelto, semana (desde el
  // lunes) o mes (desde el 1°), siempre hasta la fecha seleccionada.
  const rango = useMemo(() => rangoPeriodo(fechaActiva, periodo), [fechaActiva, periodo]);
  // Solo el día suelto es editable: Guardar upserta contra `fechaActiva`, así
  // que guardar un total de semana escribiría la suma en la fila de un día.
  const editable = periodo === 'dia';
  const txt = textoPeriodo(periodo);

  // Cargar los registros del rango activo (suma para las tarjetas).
  // Al cambiar de período NO se desmonta el panel: los datos anteriores quedan
  // a la vista, atenuados, hasta que llegan los nuevos (transición suave).
  useEffect(() => {
    if (!empresaId) return;
    let cancelado = false;
    setRefrescando(true);
    (async () => {
      const { data } = await supabase
        .from('kpi_registros')
        .select('fecha, clave, valor')
        .eq('empresa_id', empresaId)
        .gte('fecha', rango.desde)
        .lte('fecha', rango.hasta);
      // Si el usuario ya cambió de período, esta respuesta quedó obsoleta.
      if (cancelado) return;
      const rows = (data || []) as Registro[];
      setFilas(rows);
      setRegistros(sumarRegistros(rows));
      setLoading(false);
      setRefrescando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId, rango.desde, rango.hasta]);

  // Evolución día a día del mismo rango (solo en semana/mes)
  const historial = useMemo(
    () =>
      periodo === 'dia'
        ? []
        : construirHistorial(filas, rango, config.canales, config.vendedoras),
    [filas, rango, periodo, config.canales, config.vendedoras],
  );

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
    // Fuera de 'dia' los valores son totales del rango: guardarlos escribiría
    // la suma completa en la fila de `fechaActiva`.
    if (!empresaId || !editable) return;
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
            <span className="rounded-full border border-accent/30 bg-accent/20 px-2 py-0.5 text-[12px] font-semibold text-accent">
              {txt.chip}
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
          <Button
            onClick={handleGuardar}
            disabled={saving || !editable}
            size="sm"
            className="gap-1.5"
            title={
              editable
                ? undefined
                : 'Los totales de semana/mes son solo lectura — vuelve a Hoy para editar'
            }
          >
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
        {!editable && (
          <span className="animate-in fade-in slide-in-from-left-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] text-warning duration-300">
            Totales acumulados desde el {new Date(rango.desde + 'T12:00:00').toLocaleDateString('es-CL')} ({rango.dias} días) — solo lectura
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className={cn(
              'h-3.5 w-3.5 rounded-full border-2 border-accent/30 border-t-accent transition-opacity duration-200',
              refrescando ? 'animate-spin opacity-100' : 'opacity-0',
            )}
          />
          {(['dia', 'semana', 'mes'] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={cn(
                'rounded-md border px-3 py-1 text-xs transition-all duration-200',
                periodo === p
                  ? 'border-accent bg-accent/15 font-semibold text-accent'
                  : 'border-border bg-transparent text-muted-foreground hover:border-accent/50 hover:text-foreground',
              )}
            >
              {p === 'dia' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          'mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6 transition-opacity duration-300',
          refrescando && 'opacity-50',
        )}
      >
        <CanalesSection
          canales={config.canales}
          totalCanales={totalCanales}
          canalesChartData={canalesChartData}
          getVal={getVal}
          setVal={setVal}
          periodo={periodo}
          editable={editable}
        />
        <LlamadasSection
          vendedoras={config.vendedoras}
          totalCanales={totalCanales}
          totalLlamadas={totalLlamadas}
          getVal={getVal}
          setVal={setVal}
          periodo={periodo}
          editable={editable}
        />
        <MetaVisitasSection
          vendedoras={config.vendedoras}
          metaVisitas={config.meta_visitas}
          getVal={getVal}
          setVal={setVal}
          periodo={periodo}
          dias={rango.dias}
          editable={editable}
        />
        <CierreSection
          envVal={envVal}
          cerVal={cerVal}
          errorCierre={errorCierre}
          pctCierre={pctCierre}
          pendientes={pendientes}
          setVal={setVal}
          periodo={periodo}
          editable={editable}
        />
        <TerrenoSection
          terrenoData={terrenoData}
          setVal={setVal}
          periodo={periodo}
          editable={editable}
        />
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
