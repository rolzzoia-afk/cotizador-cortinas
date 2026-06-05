import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  Loader2,
  Plus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLeads, useVendedoras } from '@/modules/leads/hooks';
import {
  ESTADOS_LABEL,
  esLeadDeBot,
  type Lead,
  type LeadEstado,
  type LeadInput,
} from '@/modules/leads/types';
import { LeadDialog } from '@/components/leads/LeadDialog';
import { LeadDetalleDialog } from '@/components/leads/LeadDetalleDialog';
import { MetricasLeadsView } from '@/components/leads/MetricasLeadsView';
import { SeguimientosView } from '@/components/leads/SeguimientosView';
import { CoachingView } from '@/components/coaching/CoachingView';
import { resumenBandeja } from '@/modules/leads/seguimientos';

import type { Vista, FiltroOrigen } from './leads-pipeline/LeadsPipeline.types';
import Metrica from './leads-pipeline/components/Metrica';
import TablaVista from './leads-pipeline/components/TablaVista';
import KanbanVista from './leads-pipeline/components/KanbanVista';
import VistaTabsBar from './leads-pipeline/components/VistaTabsBar';
import FiltrosBar from './leads-pipeline/components/FiltrosBar';

export function LeadsPipeline() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { empresaId, perfil } = useAuth();
  const {
    leads,
    loading,
    error,
    refresh,
    crear,
    actualizar,
    cambiarEstado,
    eliminar,
  } = useLeads();
  const { vendedoras } = useVendedoras();

  const [vista, setVista] = useState<Vista>(() => {
    const v = params.get('vista') as Vista;
    if (v === 'kanban' || v === 'metricas' || v === 'seguimientos' || v === 'coaching') return v;
    return 'tabla';
  });
  const [busqueda, setBusqueda] = useState('');
  const [filtroVendedora, setFiltroVendedora] = useState<string>('');
  const [filtroCanal, setFiltroCanal] = useState<string>('');
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigen>('todos');
  const [filtroEstados, setFiltroEstados] = useState<Set<LeadEstado>>(new Set());
  const [ordenarPorScoring, setOrdenarPorScoring] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [leadEnEdicion, setLeadEnEdicion] = useState<Lead | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  // Abrir lead específico desde query param (?abrir=<id>)
  useEffect(() => {
    const abrir = params.get('abrir');
    if (abrir) {
      setDetalleId(abrir);
      setDetalleOpen(true);
    }
  }, [params]);

  // Lista de canales viene de kpi_config (la misma config que la página Ventas)
  const [canales, setCanales] = useState<string[]>([]);
  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      const { data } = await supabase
        .from('kpi_config')
        .select('canales')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (data?.canales && Array.isArray(data.canales)) {
        setCanales(data.canales as string[]);
      }
    })();
  }, [empresaId]);

  // Aplicar filtros + orden
  const leadsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = leads.filter((l) => {
      if (filtroEstados.size > 0 && !filtroEstados.has(l.estado)) return false;
      if (filtroVendedora === '__sin_asignar') {
        if (l.asignado_a) return false;
      } else if (filtroVendedora && l.asignado_a !== filtroVendedora) {
        return false;
      }
      if (filtroCanal && l.fuente !== filtroCanal) return false;
      if (filtroOrigen === 'bot' && !esLeadDeBot(l)) return false;
      if (filtroOrigen === 'manual' && esLeadDeBot(l)) return false;
      if (!q) return true;
      const hay = [l.nombre, l.whatsapp_phone, l.email, l.rut, l.comuna]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
      return hay;
    });

    if (ordenarPorScoring) {
      // Scoring desc, nulls al final; empate por ultima_actividad_at desc
      return [...filtrados].sort((a, b) => {
        const sa = a.scoring ?? -1;
        const sb = b.scoring ?? -1;
        if (sb !== sa) return sb - sa;
        return b.ultima_actividad_at.localeCompare(a.ultima_actividad_at);
      });
    }
    return filtrados;
  }, [leads, busqueda, filtroVendedora, filtroCanal, filtroOrigen, filtroEstados, ordenarPorScoring]);

  // ¿Hay al menos un lead del bot? (define si mostrar UI relacionada al bot)
  const hayLeadsDeBot = useMemo(() => leads.some(esLeadDeBot), [leads]);

  // Métricas top
  const metricas = useMemo(() => {
    const total = leads.length;
    const ganados = leads.filter((l) => l.estado === 'ganado').length;
    const enCurso = leads.filter(
      (l) => !['ganado', 'perdido_precio', 'perdido_competencia', 'perdido_otro'].includes(l.estado),
    ).length;
    const cerrados = leads.filter((l) =>
      ['ganado', 'perdido_precio', 'perdido_competencia', 'perdido_otro'].includes(l.estado),
    ).length;
    const tasaCierre = cerrados > 0 ? Math.round((ganados / cerrados) * 100) : 0;
    return { total, ganados, enCurso, cerrados, tasaCierre };
  }, [leads]);

  // Seguimientos pendientes (atrasados + hoy) para el badge de la pestaña.
  // Admin ve todos; vendedora solo los suyos.
  const segPendientes = useMemo(() => {
    const esAdmin = perfil?.rol === 'admin';
    const r = resumenBandeja(leads, { vendedoraId: esAdmin ? null : perfil?.id ?? null });
    return r.atrasados + r.hoy;
  }, [leads, perfil]);

  const handleCrearOEditar = async (input: LeadInput) => {
    if (leadEnEdicion) {
      await actualizar(leadEnEdicion.id, input);
    } else {
      await crear(input);
    }
  };

  const handleEliminar = async (id: string) => {
    await eliminar(id);
  };

  const toggleEstadoFiltro = (e: LeadEstado) => {
    setFiltroEstados((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  };

  const handleCambioEstadoRapido = async (lead: Lead, nuevoEstado: LeadEstado) => {
    if (nuevoEstado === lead.estado) return;
    try {
      await cambiarEstado(lead.id, nuevoEstado);
      toast.success(`${lead.nombre} → ${ESTADOS_LABEL[nuevoEstado]}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando leads…
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* HEADER */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/landing')}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-card"
          >
            <ArrowLeft className="h-4 w-4" /> Inicio
          </button>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            <span className="text-base font-bold text-foreground">Pipeline de Leads</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <VistaTabsBar vista={vista} onCambio={setVista} segPendientes={segPendientes} />
          <Button
            onClick={() => navigate('/cotizar')}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <Calculator className="h-4 w-4" /> Cotizar
          </Button>
          <Button
            onClick={() => {
              setLeadEnEdicion(null);
              setDialogOpen(true);
            }}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Nuevo lead
          </Button>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-2 gap-3 border-b border-border bg-card/60 px-5 py-3 md:grid-cols-5">
        <Metrica titulo="Total" valor={metricas.total} />
        <Metrica titulo="En curso" valor={metricas.enCurso} tono="progress" />
        <Metrica titulo="Ganados" valor={metricas.ganados} tono="success" />
        <Metrica titulo="Cerrados" valor={metricas.cerrados} />
        <Metrica titulo="Tasa cierre" valor={`${metricas.tasaCierre}%`} tono={metricas.tasaCierre >= 30 ? 'success' : 'warn'} />
      </div>

      {/* FILTROS */}
      <FiltrosBar
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        filtroVendedora={filtroVendedora}
        setFiltroVendedora={setFiltroVendedora}
        filtroCanal={filtroCanal}
        setFiltroCanal={setFiltroCanal}
        filtroOrigen={filtroOrigen}
        setFiltroOrigen={setFiltroOrigen}
        ordenarPorScoring={ordenarPorScoring}
        setOrdenarPorScoring={setOrdenarPorScoring}
        hayLeadsDeBot={hayLeadsDeBot}
        vendedoras={vendedoras}
        canales={canales}
        filtroEstados={filtroEstados}
        toggleEstadoFiltro={toggleEstadoFiltro}
        setFiltroEstados={setFiltroEstados}
        resultadoCount={leadsFiltrados.length}
        totalCount={leads.length}
      />

      {error && (
        <div className="mx-5 mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* CONTENIDO */}
      <div className="px-5 py-5">
        {vista === 'metricas' ? (
          <MetricasLeadsView vendedoras={vendedoras} />
        ) : vista === 'coaching' ? (
          <CoachingView />
        ) : vista === 'seguimientos' ? (
          <SeguimientosView
            leads={leads}
            vendedoras={vendedoras}
            onRefresh={refresh}
            onAbrir={(id) => {
              setDetalleId(id);
              setDetalleOpen(true);
            }}
          />
        ) : vista === 'tabla' ? (
          <TablaVista
            leads={leadsFiltrados}
            vendedoras={vendedoras}
            onAbrir={(l) => {
              setDetalleId(l.id);
              setDetalleOpen(true);
            }}
            onCambioRapido={handleCambioEstadoRapido}
          />
        ) : (
          <KanbanVista
            leads={leadsFiltrados}
            vendedoras={vendedoras}
            onAbrir={(l) => {
              setDetalleId(l.id);
              setDetalleOpen(true);
            }}
            onMover={handleCambioEstadoRapido}
          />
        )}
      </div>

      {/* DIALOGS */}
      <LeadDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setLeadEnEdicion(null);
        }}
        lead={leadEnEdicion}
        canales={canales}
        onSubmit={handleCrearOEditar}
      />
      <LeadDetalleDialog
        open={detalleOpen}
        onOpenChange={setDetalleOpen}
        leadId={detalleId}
        onEdit={(l) => {
          setDetalleOpen(false);
          setLeadEnEdicion(l);
          setDialogOpen(true);
        }}
        onDelete={handleEliminar}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Métrica chip
// ─────────────────────────────────────────────────────────────────────
