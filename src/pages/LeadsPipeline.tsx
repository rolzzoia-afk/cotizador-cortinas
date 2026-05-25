import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bot,
  CalendarClock,
  Calculator,
  KanbanSquare,
  LayoutList,
  Loader2,
  Plus,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLeads, useVendedoras } from '@/modules/leads/hooks';
import {
  ESTADOS_LABEL,
  ESTADOS_ORDEN,
  ESTADOS_TONO,
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

type Vista = 'tabla' | 'kanban' | 'metricas' | 'seguimientos' | 'coaching';
type FiltroOrigen = 'todos' | 'bot' | 'manual';

const TONO_CLS: Record<string, string> = {
  neutral: 'border-border bg-secondary text-foreground',
  progress: 'border-accent/30 bg-accent/15 text-accent',
  warn: 'border-warning/30 bg-warning/15 text-warning',
  success: 'border-success/30 bg-success/15 text-success',
  danger: 'border-destructive/30 bg-destructive/15 text-destructive',
};

function fechaRelativa(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `hace ${dias}d`;
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

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
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              onClick={() => setVista('tabla')}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1.5 text-xs transition-colors',
                vista === 'tabla'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutList className="h-3.5 w-3.5" /> Tabla
            </button>
            <button
              onClick={() => setVista('kanban')}
              className={cn(
                'inline-flex items-center gap-1 border-l border-border px-3 py-1.5 text-xs transition-colors',
                vista === 'kanban'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <KanbanSquare className="h-3.5 w-3.5" /> Kanban
            </button>
            <button
              onClick={() => setVista('seguimientos')}
              className={cn(
                'relative inline-flex items-center gap-1 border-l border-border px-3 py-1.5 text-xs transition-colors',
                vista === 'seguimientos'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" /> Seguimientos
              {segPendientes > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {segPendientes}
                </span>
              )}
            </button>
            <button
              onClick={() => setVista('metricas')}
              className={cn(
                'inline-flex items-center gap-1 border-l border-border px-3 py-1.5 text-xs transition-colors',
                vista === 'metricas'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Métricas
            </button>
            <button
              onClick={() => setVista('coaching')}
              className={cn(
                'inline-flex items-center gap-1 border-l border-border px-3 py-1.5 text-xs transition-colors',
                vista === 'coaching'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <BookOpen className="h-3.5 w-3.5" /> Coaching
            </button>
          </div>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/40 px-5 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar nombre/teléfono/email…"
            className="w-64 pl-8"
          />
        </div>
        <select
          value={filtroVendedora}
          onChange={(e) => setFiltroVendedora(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">Todas las vendedoras</option>
          <option value="__sin_asignar">Sin asignar</option>
          {vendedoras.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
        <select
          value={filtroCanal}
          onChange={(e) => setFiltroCanal(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">Todos los canales</option>
          {canales.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="Web">Web</option>
          <option value="Referido">Referido</option>
        </select>

        {hayLeadsDeBot && (
          <>
            <div className="flex overflow-hidden rounded-md border border-border">
              {(['todos', 'bot', 'manual'] as FiltroOrigen[]).map((o, idx) => (
                <button
                  key={o}
                  onClick={() => setFiltroOrigen(o)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors',
                    idx > 0 && 'border-l border-border',
                    filtroOrigen === o
                      ? 'bg-accent/15 text-accent'
                      : 'bg-transparent text-muted-foreground hover:text-foreground',
                  )}
                  title={
                    o === 'bot'
                      ? 'Solo leads derivados por el bot de WhatsApp'
                      : o === 'manual'
                        ? 'Solo leads cargados manualmente'
                        : 'Todos los leads'
                  }
                >
                  {o === 'bot' && <Bot className="h-3 w-3" />}
                  {o === 'todos' ? 'Todos' : o === 'bot' ? 'Bot' : 'Manual'}
                </button>
              ))}
            </div>

            <button
              onClick={() => setOrdenarPorScoring((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                ordenarPorScoring
                  ? 'border-warning/30 bg-warning/15 text-warning'
                  : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
              )}
              title="Priorizar leads con mayor scoring del bot"
            >
              <Star className={cn('h-3 w-3', ordenarPorScoring && 'fill-current')} />
              Por scoring
            </button>
          </>
        )}

        {/* Chips de estado */}
        <div className="ml-1 flex flex-wrap items-center gap-1">
          {ESTADOS_ORDEN.map((e) => {
            const activo = filtroEstados.has(e);
            return (
              <button
                key={e}
                onClick={() => toggleEstadoFiltro(e)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                  activo
                    ? TONO_CLS[ESTADOS_TONO[e]]
                    : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {ESTADOS_LABEL[e]}
              </button>
            );
          })}
          {filtroEstados.size > 0 && (
            <button
              onClick={() => setFiltroEstados(new Set())}
              className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" /> limpiar
            </button>
          )}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {leadsFiltrados.length} / {leads.length}
        </span>
      </div>

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
function Metrica({
  titulo,
  valor,
  tono,
}: {
  titulo: string;
  valor: number | string;
  tono?: 'progress' | 'success' | 'warn';
}) {
  const cls =
    tono === 'success'
      ? 'text-success'
      : tono === 'warn'
        ? 'text-warning'
        : tono === 'progress'
          ? 'text-accent'
          : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className={cn('mt-0.5 text-xl font-extrabold', cls)}>{valor}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Vista tabla
// ─────────────────────────────────────────────────────────────────────
function TablaVista({
  leads,
  vendedoras,
  onAbrir,
  onCambioRapido,
}: {
  leads: Lead[];
  vendedoras: { id: string; nombre: string }[];
  onAbrir: (l: Lead) => void;
  onCambioRapido: (l: Lead, e: LeadEstado) => void;
}) {
  const vendedoraNombre = (id: string | null): string => {
    if (!id) return '—';
    return vendedoras.find((v) => v.id === id)?.nombre ?? '—';
  };

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
        Sin leads que mostrar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card/40">
      <table className="w-full text-sm">
        <thead className="bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Nombre</th>
            <th className="px-3 py-2 text-left">Contacto</th>
            <th className="px-3 py-2 text-left">Canal</th>
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2 text-left">Vendedora</th>
            <th className="px-3 py-2 text-left">Última act.</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr
              key={l.id}
              onClick={() => onAbrir(l)}
              className="cursor-pointer border-t border-border transition-colors hover:bg-secondary/30"
            >
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  {esLeadDeBot(l) && (
                    <Bot
                      className="h-3.5 w-3.5 flex-shrink-0 text-accent"
                      aria-label="Lead derivado por el bot de WhatsApp"
                    />
                  )}
                  <span>
                    {l.nombre || <span className="text-muted-foreground italic">(sin nombre)</span>}
                  </span>
                  {l.scoring != null && (
                    <span
                      className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-warning/30 bg-warning/15 px-1.5 py-0 text-[10px] font-bold text-warning"
                      title="Scoring del bot (0-100)"
                    >
                      <Star className="h-2.5 w-2.5 fill-current" />
                      {l.scoring}
                    </span>
                  )}
                </div>
                {l.comuna && (
                  <div className="text-[11px] text-muted-foreground">{l.comuna}</div>
                )}
              </td>
              <td className="px-3 py-2.5 text-xs">
                {l.whatsapp_phone && <div>{l.whatsapp_phone}</div>}
                {l.email && <div className="text-muted-foreground">{l.email}</div>}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.fuente || '—'}</td>
              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                <select
                  value={l.estado}
                  onChange={(e) => onCambioRapido(l, e.target.value as LeadEstado)}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold focus:outline-none',
                    TONO_CLS[ESTADOS_TONO[l.estado]],
                  )}
                >
                  {ESTADOS_ORDEN.map((s) => (
                    <option key={s} value={s} className="bg-card text-foreground">
                      {ESTADOS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2.5 text-xs text-foreground">
                {vendedoraNombre(l.asignado_a)}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {fechaRelativa(l.ultima_actividad_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Vista kanban (drag-and-drop nativo HTML5)
// ─────────────────────────────────────────────────────────────────────
function KanbanVista({
  leads,
  vendedoras,
  onAbrir,
  onMover,
}: {
  leads: Lead[];
  vendedoras: { id: string; nombre: string }[];
  onAbrir: (l: Lead) => void;
  onMover: (l: Lead, e: LeadEstado) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadEstado | null>(null);

  const porEstado = useMemo(() => {
    const map: Record<LeadEstado, Lead[]> = {} as Record<LeadEstado, Lead[]>;
    for (const e of ESTADOS_ORDEN) map[e] = [];
    for (const l of leads) {
      if (map[l.estado]) map[l.estado].push(l);
    }
    return map;
  }, [leads]);

  const vendedoraNombre = (id: string | null): string => {
    if (!id) return '';
    return vendedoras.find((v) => v.id === id)?.nombre ?? '';
  };

  const handleDrop = (estado: LeadEstado) => {
    if (!dragId) return;
    const lead = leads.find((l) => l.id === dragId);
    if (lead && lead.estado !== estado) {
      onMover(lead, estado);
    }
    setDragId(null);
    setDragOver(null);
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
        {ESTADOS_ORDEN.map((estado) => {
          const items = porEstado[estado] || [];
          const tono = ESTADOS_TONO[estado];
          return (
            <div
              key={estado}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(estado);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(estado)}
              className={cn(
                'flex w-64 flex-shrink-0 flex-col rounded-lg border bg-card/40 transition-colors',
                dragOver === estado ? 'border-accent ring-2 ring-accent/30' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    TONO_CLS[tono],
                  )}
                >
                  {ESTADOS_LABEL[estado]}
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {items.length === 0 && (
                  <div className="rounded border border-dashed border-border/50 p-3 text-center text-[10px] text-muted-foreground">
                    Vacío
                  </div>
                )}
                {items.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOver(null);
                    }}
                    onClick={() => onAbrir(l)}
                    className={cn(
                      'cursor-pointer rounded-md border border-border bg-card p-2.5 text-xs shadow-sm transition-all hover:border-accent/50 hover:shadow',
                      dragId === l.id && 'opacity-40',
                    )}
                  >
                    <div className="flex items-center gap-1 font-semibold text-foreground">
                      {esLeadDeBot(l) && (
                        <Bot className="h-3 w-3 flex-shrink-0 text-accent" />
                      )}
                      <span className="truncate">
                        {l.nombre || <span className="text-muted-foreground italic">(sin nombre)</span>}
                      </span>
                      {l.scoring != null && (
                        <span
                          className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-1 text-[9px] font-bold text-warning"
                          title="Scoring del bot"
                        >
                          <Star className="h-2 w-2 fill-current" />
                          {l.scoring}
                        </span>
                      )}
                    </div>
                    {l.whatsapp_phone && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{l.whatsapp_phone}</div>
                    )}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {l.fuente || '—'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {fechaRelativa(l.ultima_actividad_at)}
                      </span>
                    </div>
                    {vendedoraNombre(l.asignado_a) && (
                      <div className="mt-1 truncate text-[10px] text-accent">
                        {vendedoraNombre(l.asignado_a)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
