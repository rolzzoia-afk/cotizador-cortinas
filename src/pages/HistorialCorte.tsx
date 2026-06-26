// Orquestador de la pantalla Historial de Corte.
//
// 2 tabs:
// - Planes de corte (agrupados por OTs, con versión actual + anteriores)
// - Errores registrados (lista + chart por motivo)
//
// Carga 3 datasets independientes (planes, errores, tubos) y delega la
// renderización a los componentes hijos bajo ./historial-corte/.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Scissors, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { exportarPlanComoExcel } from '@/modules/planes-corte/exportar-excel';
import { Input } from '@/components/ui/input';
import { confirmar } from '@/components/ui/confirm';

import type {
  CorteCtx,
  ErrorRow,
  Orden,
  Plan,
  ResultadoItem,
  Tubo,
} from './historial-corte/HistorialCorte.types';
import { extraerOTs, getOrd, getR, tryParse } from './historial-corte/utils/parsers';
import PlanCard from './historial-corte/components/PlanCard';
import ErroresTab from './historial-corte/components/ErroresTab';
import ErrorDialog from './historial-corte/dialogs/ErrorDialog';

export function HistorialCorte() {
  const { empresaId, perfil, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'planes' | 'errores'>('planes');
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [erroresPorPlan, setErroresPorPlan] = useState<
    Record<string, { linea_idx: number; motivo: string }[]>
  >({});
  const [errores, setErrores] = useState<ErrorRow[]>([]);
  const [tubos, setTubos] = useState<Tubo[]>([]);
  const [otsFechaEntrega, setOtsFechaEntrega] = useState<Record<string, string | null>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalCtx, setModalCtx] = useState<CorteCtx | null>(null);

  const cargarPlanes = async () => {
    if (!empresaId) return;
    // Filtrar `tipo IS NULL`: solo planes reales, sin los "respaldo" que el
    // optimizador inserta como punto de restauración antes del sync. Si el
    // sync falla, ese respaldo queda huérfano — el filtro lo oculta de la UI.
    const { data } = await supabase
      .from('planes_corte')
      .select('id, fecha, fecha_correccion, resultados, ordenes')
      .eq('empresa_id', empresaId)
      .is('tipo', null)
      .order('fecha', { ascending: false })
      .limit(50);

    const raw = (data || []).map(
      (p: {
        id: string;
        fecha: string | null;
        fecha_correccion: string | null;
        resultados: unknown;
        ordenes: unknown;
      }) => ({
        id: p.id,
        fecha: p.fecha,
        fecha_correccion: p.fecha_correccion,
        resultados: (Array.isArray(p.resultados)
          ? p.resultados
          : tryParse(p.resultados, [])) as ResultadoItem[],
        ordenes: (Array.isArray(p.ordenes) ? p.ordenes : tryParse(p.ordenes, [])) as Orden[],
      }),
    );

    // Dedupe (planes idénticos del mismo minuto: keep el id mayor)
    const map = new Map<string, Plan>();
    raw.forEach((p) => {
      const ots = [
        ...new Set(
          p.resultados
            .map((item) => {
              const r = getR(item);
              const ord = getOrd(item, p.ordenes);
              return String(ord.ot || ord.numero_ot || r.orden || '-').trim();
            })
            .filter((ot) => ot && ot !== '-'),
        ),
      ]
        .sort()
        .join(',');
      const minuto = p.fecha ? p.fecha.slice(0, 16) : 'sin-fecha';
      const clave = `${ots}__${p.resultados.length}__${minuto}`;
      const prev = map.get(clave);
      if (!prev || p.id > prev.id) map.set(clave, p);
    });
    const dedup = [...map.values()].sort((a, b) =>
      (b.fecha || '').localeCompare(a.fecha || ''),
    );
    setPlanes(dedup);

    // Errores por plan
    const planIds = dedup.map((p) => p.id).filter(Boolean);
    if (planIds.length) {
      const { data: errs } = await supabase
        .from('errores_corte')
        .select('plan_id, linea_idx, motivo')
        .in('plan_id', planIds);
      const acc: Record<string, { linea_idx: number; motivo: string }[]> = {};
      (errs || []).forEach((e) => {
        if (!e.plan_id) return;
        if (!acc[e.plan_id]) acc[e.plan_id] = [];
        acc[e.plan_id].push({ linea_idx: e.linea_idx, motivo: e.motivo });
      });
      setErroresPorPlan(acc);
    }

    setLoading(false);
  };

  const cargarErrores = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from('errores_corte')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(200);
    setErrores((data as ErrorRow[]) || []);
  };

  const cargarTubos = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from('colmena_tubos')
      .select('id, n_colmena, cod, medida_cm, tubo_raiz_id')
      .eq('empresa_id', empresaId)
      .order('n_colmena');
    setTubos((data as Tubo[]) || []);
  };

  // Cargar fechas de entrega de TODAS las OTs activas para computar el
  // correlativo de cada plan según la fecha de entrega más próxima.
  const cargarFechasEntrega = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from('ots')
      .select('numero_ot, datos_generales')
      .eq('empresa_id', empresaId);
    const map: Record<string, string | null> = {};
    type OtRow = { numero_ot: string | null; datos_generales: Record<string, unknown> | null };
    for (const row of (data as OtRow[] | null) || []) {
      const num = String(row.numero_ot || '').trim();
      if (!num) continue;
      const dg = row.datos_generales || {};
      const fe =
        (dg.fecha_entrega as string | null | undefined) ??
        (dg.fechaEntrega as string | null | undefined) ??
        null;
      map[num] = fe || null;
    }
    setOtsFechaEntrega(map);
  };

  useEffect(() => {
    cargarPlanes();
    cargarTubos();
    cargarFechasEntrega();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => {
    if (tab === 'errores') cargarErrores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, empresaId]);

  const planesVisibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return planes;
    return planes.filter((p) => extraerOTs(p).some((ot) => ot.toLowerCase().includes(q)));
  }, [planes, filtro]);

  // Agrupar por OTs: cada grupo ordenado por fecha desc, el [0] es el ACTUAL.
  // El correlativo se asigna después por fecha de entrega más urgente.
  const gruposPlan = useMemo(() => {
    const map = new Map<string, Plan[]>();
    planesVisibles.forEach((p) => {
      const otsKey = extraerOTs(p).sort().join(',') || `__sin_ots__${p.id}`;
      if (!map.has(otsKey)) map.set(otsKey, []);
      map.get(otsKey)!.push(p);
    });
    for (const arr of map.values()) {
      arr.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    }

    // Helper: fecha de prioridad del plan.
    // 1) Si las OTs del plan tienen fecha_entrega en la tabla `ots`, usa la
    //    más próxima.
    // 2) Si NINGUNA OT tiene fecha_entrega (caso común con OTs legacy del
    //    cotizador viejo que no están sincronizadas en la tabla `ots`),
    //    fallback a la fecha del plan (más vieja = mayor prioridad).
    // Así TODOS los planes reciben correlativo, no solo los que coinciden
    // con OTs registradas hoy en la tabla.
    const FAR_FUTURE = '9999-12-31';
    function fechaPrioridadDelPlan(plan: Plan): string {
      const ots = extraerOTs(plan);
      let min = FAR_FUTURE;
      let foundAny = false;
      for (const ot of ots) {
        // Normalizar: a veces vienen como "#3014" y otras como "3014"
        const otNorm = ot.replace(/^#/, '');
        const fe = otsFechaEntrega[otNorm] ?? otsFechaEntrega[ot];
        if (fe && fe < min) {
          min = fe;
          foundAny = true;
        }
      }
      if (foundAny) return min;
      // Fallback: usar la fecha del plan (planes más viejos primero, FIFO)
      return plan.fecha || FAR_FUTURE;
    }

    const grupos = [...map.entries()].map(([otsKey, arr]) => ({
      otsKey,
      actual: arr[0],
      anteriores: arr.slice(1),
      fechaPrioridad: fechaPrioridadDelPlan(arr[0]),
    }));

    // Asignar correlativo: ordenar por fecha de prioridad ascendente (más
    // urgente primero). Asignamos a TODOS, sin condición previa.
    const ordenados = [...grupos].sort((a, b) =>
      a.fechaPrioridad.localeCompare(b.fechaPrioridad),
    );
    const correlativoPorOtsKey = new Map<string, number>();
    ordenados.forEach((g, i) => {
      correlativoPorOtsKey.set(g.otsKey, i + 1);
    });

    // 2. Devolver en el orden que ya usábamos (fecha del plan desc, para
    //    que el más reciente aparezca arriba en la UI), pero con el
    //    correlativo asignado por el orden de fecha de entrega.
    return grupos
      .map((g) => ({
        ...g,
        correlativo: correlativoPorOtsKey.get(g.otsKey) ?? null,
      }))
      .sort((a, b) => (b.actual.fecha || '').localeCompare(a.actual.fecha || ''));
  }, [planesVisibles, otsFechaEntrega]);

  const [showAnteriores, setShowAnteriores] = useState<Set<string>>(new Set());
  const toggleAnteriores = (otsKey: string) => {
    setShowAnteriores((prev) => {
      const next = new Set(prev);
      if (next.has(otsKey)) next.delete(otsKey);
      else next.add(otsKey);
      return next;
    });
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const abrirModal = (plan: Plan, idx: number) => {
    const item = plan.resultados[idx];
    const r = getR(item);
    const ord = getOrd(item, plan.ordenes);
    setModalCtx({ planId: plan.id, planFecha: plan.fecha, idx, r, ord });
  };

  const onSuccess = (planId: string, idx: number, motivo: string) => {
    setErroresPorPlan((prev) => ({
      ...prev,
      [planId]: [...(prev[planId] || []), { linea_idx: idx, motivo }],
    }));
    setExpanded((prev) => new Set([...prev, planId]));
    cargarTubos();
  };

  const marcarSobranteInexistente = async (
    planId: string,
    lineaIdx: number,
    descripcion: string,
  ) => {
    const responsable = (perfil?.nombre || user?.email || '').trim();
    if (!responsable) {
      toast.error('No se pudo identificar al responsable. Reiniciá sesión.');
      return;
    }
    const ok = await confirmar(
      `¿Marcar este sobrante como inexistente físicamente?\n\n${descripcion}\n\n` +
        `Esto lo elimina de la colmena y queda registrado en el historial. Reversible solo por SQL.`,
    );
    if (!ok) return;

    const { data, error } = await supabase.rpc(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'marcar_sobrante_inexistente' as any,
      {
        p_plan_id: planId,
        p_linea_idx: lineaIdx,
        p_responsable: responsable,
        p_comentario: null,
        p_fuente: 'manual_postventa_sobrante_inexistente',
      },
    );

    if (error) {
      toast.error('Error al eliminar el sobrante: ' + error.message);
      return;
    }

    const result = data as
      | { success: boolean; razon?: string; mensaje?: string; n_colmena?: string; medida_cm?: number }
      | null;

    if (!result?.success) {
      toast.info(result?.mensaje || 'No se encontró sobrante para esa línea');
      return;
    }

    toast.success(`Sobrante eliminado de colmena ${result.n_colmena} (${result.medida_cm} cm)`);
    cargarTubos();
  };

  const modalPlan = modalCtx ? planes.find((p) => p.id === modalCtx.planId) || null : null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-purple-500/30 border-t-purple-500" />
          Cargando historial…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={() => navigate('/landing')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inicio
        </button>
        <h1 className="flex-1 text-base font-bold">Historial de Corte</h1>
      </div>

      <div className="flex gap-1.5 border-b border-border bg-background px-5 pt-3.5">
        {(
          [
            { k: 'planes', l: 'Planes de corte' },
            { k: 'errores', l: 'Errores registrados' },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              'rounded-t-lg border-b-2 px-4 py-2 text-[13px] font-semibold transition',
              tab === t.k
                ? 'border-purple-500 bg-accent/[0.08] text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'planes' && (
        <div className="p-5">
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por OT…"
              className="border-border bg-card pl-8"
            />
          </div>

          {gruposPlan.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Scissors className="h-8 w-8" />
              <div className="text-sm">
                {planes.length === 0
                  ? 'No hay planes de corte guardados aún.'
                  : `No hay planes que coincidan con "${filtro}".`}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {gruposPlan.map(({ otsKey, actual, anteriores, correlativo }) => {
                const verAnteriores = showAnteriores.has(otsKey);
                return (
                  <div key={otsKey} className="flex flex-col gap-1.5">
                    <PlanCard
                      plan={actual}
                      errores={erroresPorPlan[actual.id] || []}
                      esActual={anteriores.length > 0}
                      esVersionAnterior={false}
                      expandido={expanded.has(actual.id)}
                      correlativo={correlativo}
                      onToggle={() => toggle(actual.id)}
                      onRegistrarError={(idx) => abrirModal(actual, idx)}
                      onMarcarSobranteInexistente={(idx, desc) =>
                        marcarSobranteInexistente(actual.id, idx, desc)
                      }
                      onDescargarExcel={() => exportarPlanComoExcel({ ...actual, correlativo })}
                    />
                    {anteriores.length > 0 && (
                      <>
                        <button
                          onClick={() => toggleAnteriores(otsKey)}
                          className="ml-2 flex items-center gap-1.5 self-start rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                        >
                          <ChevronDown
                            className={cn(
                              'h-3 w-3 transition-transform',
                              verAnteriores && 'rotate-180',
                            )}
                          />
                          {verAnteriores ? 'Ocultar' : 'Ver'} {anteriores.length}{' '}
                          versión{anteriores.length > 1 ? 'es' : ''} anterior
                          {anteriores.length > 1 ? 'es' : ''}
                        </button>
                        {verAnteriores &&
                          anteriores.map((prev) => (
                            <PlanCard
                              key={prev.id}
                              plan={prev}
                              errores={erroresPorPlan[prev.id] || []}
                              esActual={false}
                              esVersionAnterior={true}
                              expandido={expanded.has(prev.id)}
                              correlativo={null}
                              onToggle={() => toggle(prev.id)}
                              onRegistrarError={(idx) => abrirModal(prev, idx)}
                              onMarcarSobranteInexistente={(idx, desc) =>
                                marcarSobranteInexistente(prev.id, idx, desc)
                              }
                              onDescargarExcel={() => exportarPlanComoExcel(prev)}
                            />
                          ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'errores' && <ErroresTab errores={errores} />}

      <ErrorDialog
        open={!!modalCtx}
        onOpenChange={(v) => !v && setModalCtx(null)}
        ctx={modalCtx}
        plan={modalPlan}
        tubosDisponibles={tubos}
        existingError={
          modalCtx
            ? (erroresPorPlan[modalCtx.planId] || []).find((e) => e.linea_idx === modalCtx.idx) ||
              null
            : null
        }
        onSuccess={onSuccess}
      />
    </div>
  );
}
