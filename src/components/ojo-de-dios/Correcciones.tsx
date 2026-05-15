import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type CorreccionPendiente,
  type LineaPlan,
  type Plan,
  type PlanResumen,
  TIPO_ERROR_LABELS,
  type TipoError,
  useCorreccionesHistorial,
  useCorreccionRetroactiva,
  useOptimizerConfig,
  usePlanActivo,
  usePlanesHistorial,
} from '@/modules/admin/correcciones';

// Extrae el conjunto único de OTs asociadas a un plan. Mira tanto
// plan.ordenes (autoritativo) como cada línea de plan.resultados
// (fallback por si ordenes viene vacío).
function extraerOTsPlan(plan: PlanResumen): string[] {
  const set = new Set<string>();
  for (const o of plan.ordenes || []) {
    const ot = (o?.ot || '').toString().trim();
    if (ot && ot !== '-') set.add(ot);
  }
  for (const linea of plan.resultados || []) {
    const ordRef = (linea as { orden?: { ot?: string } }).orden;
    const ot = (ordRef?.ot || '').toString().trim();
    if (ot && ot !== '-') set.add(ot);
  }
  return [...set].sort();
}

export function Correcciones() {
  const cfg = useOptimizerConfig();
  const planActivo = usePlanActivo();
  const historial = useCorreccionesHistorial();
  const planes = usePlanesHistorial();

  // Auto-cargar al montar si ya hay email configurado
  useEffect(() => {
    if (cfg.email) {
      planActivo.cargar();
      historial.cargar();
      planes.cargar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.email]);

  return (
    <div className="space-y-3">
      <ConfigOptimizador cfg={cfg} />
      <PlanActivoSection ctx={planActivo} />
      <CorreccionRetroactivaSection planes={planes} onAplicado={() => historial.cargar()} />
      <HistorialCorrecciones ctx={historial} />
      <HistorialPlanes ctx={planes} email={cfg.email} />
      <HintColmenaDuplicada />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Config del optimizador (email)
// ──────────────────────────────────────────────────────────────────
function ConfigOptimizador({ cfg }: { cfg: ReturnType<typeof useOptimizerConfig> }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(cfg.email);
  }, [cfg.email]);

  const guardar = async () => {
    setSaving(true);
    try {
      await cfg.guardar(draft);
      toast.success('Email del optimizador guardado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-warning/30 bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Settings className="h-4 w-4 text-warning" />
        <strong className="text-sm">Configuración del optimizador</strong>
      </div>
      <div className="flex gap-2">
        <Input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Email del optimizador de estructura"
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          onClick={guardar}
          disabled={saving || cfg.loading}
          className="h-8 gap-1 bg-warning hover:bg-warning"
        >
          <Save className="h-3.5 w-3.5" />
          Guardar
        </Button>
      </div>
      {cfg.email && (
        <div className="mt-1 text-[0.68rem] text-muted-foreground">
          ✅ Optimizador: <span className="text-warning">{cfg.email}</span>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Plan activo + editor de líneas
// ──────────────────────────────────────────────────────────────────
function PlanActivoSection({ ctx }: { ctx: ReturnType<typeof usePlanActivo> }) {
  const { plan, loading, status, pendientes, setPendiente, removerPendiente, cargar, aplicarTodo } =
    ctx;
  const [editorIdx, setEditorIdx] = useState<number | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const onAplicarTodo = async () => {
    setAplicando(true);
    try {
      const n = await aplicarTodo();
      toast.success(`${n} corrección(es) aplicadas al plan`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al aplicar: ' + msg);
    } finally {
      setAplicando(false);
    }
  };

  const tienePendientes = Object.keys(pendientes).length > 0;

  return (
    <div className="rounded-lg border border-blue-500/30 bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-accent" />
          <strong className="text-sm">Plan de corte activo</strong>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={cargar}
          disabled={loading}
          className="h-8 gap-1 border-blue-500/30 text-blue-300"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Cargar
        </Button>
      </div>
      {status && <div className="mb-2 text-xs text-muted-foreground">{status}</div>}

      {plan && plan.resultados.length > 0 && (
        <div className="max-h-[320px] overflow-y-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">OT / Ubic.</th>
                <th className="p-2 text-left">Código tubo</th>
                <th className="p-2 text-left">Medida (cm)</th>
                <th className="p-2 text-left">Colmena</th>
                <th className="p-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {plan.resultados.map((item, i) => {
                const res = item.resultado || (item as LineaPlan['resultado']) || {};
                const ord = item.orden || {};
                const codigo = res?.codigo || res?.codigo_original || ord.cod || '—';
                const medida =
                  res?.medida_cm !== undefined ? Number(res.medida_cm).toFixed(1) + ' cm' : '—';
                const colmena = res?.colmena ? String(res.colmena) : '—';
                const otUbic = [ord.ot, ord.ubic].filter(Boolean).join(' · ') || '—';
                const tieneCorr = !!pendientes[i];
                return (
                  <tr
                    key={i}
                    className="border-t border-border hover:bg-card"
                    style={tieneCorr ? { backgroundColor: 'rgba(251,191,36,0.12)' } : undefined}
                  >
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="max-w-[100px] truncate p-2">{otUbic}</td>
                    <td className="max-w-[130px] truncate p-2 font-mono" title={String(codigo)}>
                      {codigo}
                      {tieneCorr && (
                        <span
                          className="ml-1 rounded-full bg-warning px-1.5 py-0.5 text-[0.6rem] font-bold text-foreground"
                          title="Corrección pendiente"
                        >
                          ✏
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-semibold">{medida}</td>
                    <td className="p-2">{colmena}</td>
                    <td className="p-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 border-warning/30 p-0 text-warning hover:bg-warning/15"
                        onClick={() => setEditorIdx(i)}
                        title="Editar línea"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editorIdx != null && plan && (
        <EditorLinea
          idx={editorIdx}
          plan={plan}
          pendiente={pendientes[editorIdx]}
          onCancel={() => setEditorIdx(null)}
          onSave={(c) => {
            setPendiente(editorIdx, c);
            setEditorIdx(null);
            toast.success('Corrección guardada (pendiente de aplicar)');
          }}
          onRemove={() => {
            removerPendiente(editorIdx);
            setEditorIdx(null);
            toast.info('Corrección descartada');
          }}
        />
      )}

      {tienePendientes && (
        <div className="mt-3">
          <Button
            onClick={onAplicarTodo}
            disabled={aplicando}
            className="w-full gap-1 bg-success hover:bg-success/90"
          >
            {aplicando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Aplicar {Object.keys(pendientes).length} corrección(es) al plan
          </Button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Corrección retroactiva sobre un plan antiguo (B2 v1)
// ──────────────────────────────────────────────────────────────────
// Permite marcar como defectuosa una línea de un plan que YA no es el
// más reciente. NO rebobina el inventario y NO crea un plan nuevo —
// solo registra el error (audit + evento error_reemplazo). Después el
// encargado corta el reemplazo desde el optimizador normal.
function CorreccionRetroactivaSection({
  planes,
  onAplicado,
}: {
  planes: ReturnType<typeof usePlanesHistorial>;
  onAplicado: () => void;
}) {
  const retroactiva = useCorreccionRetroactiva();
  const [planSeleccionadoId, setPlanSeleccionadoId] = useState<string>('');
  const [lineaEditando, setLineaEditando] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoError | ''>('');
  const [nota, setNota] = useState('');
  const [aplicando, setAplicando] = useState(false);

  // Excluir el plan más reciente (se corrige por la sección "Plan activo")
  // y los planes tipo 'respaldo' (no son los reales).
  const planesParaCorregir = useMemo(
    () =>
      planes.planes
        .slice(1)
        .filter((p) => !p.tipo || p.tipo !== 'respaldo'),
    [planes.planes],
  );

  const planSeleccionado = useMemo(
    () => planes.planes.find((p) => p.id === planSeleccionadoId) || null,
    [planSeleccionadoId, planes.planes],
  );

  const resetForm = () => {
    setLineaEditando(null);
    setTipo('');
    setNota('');
  };

  const aplicar = async () => {
    if (!planSeleccionadoId || lineaEditando === null || !tipo) return;
    setAplicando(true);
    try {
      const r = await retroactiva.aplicar(
        planSeleccionadoId,
        lineaEditando,
        tipo as TipoError,
        nota || undefined,
      );
      toast.success(
        `Corrección registrada${r.ot ? ` (OT ${r.ot})` : ''}. Ahora corta la línea con otro tubo desde el optimizador.`,
        { duration: 7000 },
      );
      resetForm();
      onAplicado();
    } catch (e) {
      toast.error(
        'No se pudo aplicar: ' + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div className="rounded-lg border border-purple-500/30 bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-purple-300" />
        <strong className="text-sm">Corregir un plan antiguo</strong>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Usa esto cuando descubras un problema en un plan que <strong>ya no es el más reciente</strong>{' '}
        (ejemplo: un tubo dañado detectado después de varios planes). Solo registra el error — no
        revierte el inventario ni afecta los planes posteriores. Después hay que cortar el reemplazo
        desde el optimizador normal con otro tubo del mismo código.
      </p>

      {planes.loading && (
        <div className="text-xs text-muted-foreground">Cargando planes...</div>
      )}

      {!planes.loading && planesParaCorregir.length === 0 && (
        <div className="text-xs text-muted-foreground">
          No hay planes antiguos para corregir. (El plan más reciente se corrige arriba en
          &ldquo;Plan de corte activo&rdquo;.)
        </div>
      )}

      {planesParaCorregir.length > 0 && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Plan a corregir</Label>
            <select
              value={planSeleccionadoId}
              onChange={(e) => {
                setPlanSeleccionadoId(e.target.value);
                resetForm();
              }}
              className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-xs"
            >
              <option value="">Elige un plan...</option>
              {planesParaCorregir.map((p) => {
                const fecha = p.fecha ? new Date(p.fecha).toLocaleString('es-CL') : '?';
                const ots = extraerOTsPlan(p).slice(0, 3).join(', ');
                return (
                  <option key={p.id} value={p.id}>
                    {fecha} · {p.nCortes} cortes
                    {ots ? ` · OT ${ots}` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {planSeleccionado && planSeleccionado.resultados.length > 0 && (
            <div className="max-h-[280px] overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">OT / Ubic.</th>
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Medida</th>
                    <th className="p-2 text-left">Colmena</th>
                    <th className="p-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {planSeleccionado.resultados.map((item, i) => {
                    const res =
                      item.resultado || (item as LineaPlan['resultado']) || {};
                    const ord = item.orden || {};
                    const codigo = res?.codigo || res?.codigo_original || ord.cod || '—';
                    const medida =
                      res?.medida_cm !== undefined
                        ? Number(res.medida_cm).toFixed(1) + ' cm'
                        : '—';
                    const colmena = res?.colmena ? String(res.colmena) : '—';
                    const otUbic =
                      [ord.ot, ord.ubic].filter(Boolean).join(' · ') || '—';
                    return (
                      <tr
                        key={i}
                        className={cn(
                          'border-t border-border hover:bg-card',
                          lineaEditando === i && 'bg-purple-500/10',
                        )}
                      >
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="max-w-[100px] truncate p-2">{otUbic}</td>
                        <td
                          className="max-w-[130px] truncate p-2 font-mono"
                          title={String(codigo)}
                        >
                          {codigo}
                        </td>
                        <td className="p-2 font-semibold">{medida}</td>
                        <td className="p-2">{colmena}</td>
                        <td className="p-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 border-purple-500/30 px-2 text-purple-300 hover:bg-purple-500/15"
                            onClick={() => {
                              setLineaEditando(i);
                              setTipo('');
                              setNota('');
                            }}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Marcar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {lineaEditando !== null && planSeleccionado && (
            <div className="space-y-2 rounded border border-purple-500/30 bg-purple-500/10 p-3">
              <div className="text-xs font-semibold">
                Línea #{lineaEditando + 1} —{' '}
                {planSeleccionado.resultados[lineaEditando]?.resultado?.codigo || '—'}{' '}
                ({Number(
                  planSeleccionado.resultados[lineaEditando]?.resultado?.medida_cm ?? 0,
                ).toFixed(1)}{' '}
                cm)
              </div>
              <div>
                <Label className="text-xs">Tipo de error</Label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoError)}
                  className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-xs"
                >
                  <option value="">Elige el tipo...</option>
                  {(Object.entries(TIPO_ERROR_LABELS) as Array<[TipoError, string]>).map(
                    ([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <Label className="text-xs">Nota (opcional)</Label>
                <Input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Detalle de qué pasó (qué viste, dónde, etc.)"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={aplicar}
                  disabled={!tipo || aplicando}
                  size="sm"
                  className="gap-1 bg-purple-500 hover:bg-purple-500/90"
                >
                  {aplicando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" />
                  )}
                  Aplicar corrección retroactiva
                </Button>
                <Button onClick={resetForm} size="sm" variant="outline">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditorLinea({
  idx,
  plan,
  pendiente,
  onCancel,
  onSave,
  onRemove,
}: {
  idx: number;
  plan: Plan;
  pendiente: CorreccionPendiente | undefined;
  onCancel: () => void;
  onSave: (c: CorreccionPendiente) => void;
  onRemove: () => void;
}) {
  const item = plan.resultados[idx];
  const res = item?.resultado || (item as LineaPlan['resultado']) || {};
  const ord = item?.orden || {};

  const [tipo, setTipo] = useState<TipoError | ''>(pendiente?.tipo || '');
  const [largo, setLargo] = useState(
    pendiente?.nuevaMedida != null
      ? String(pendiente.nuevaMedida)
      : res?.medida_cm != null
        ? String(res.medida_cm)
        : '',
  );
  const [serial, setSerial] = useState(
    pendiente?.nuevoCodigo != null
      ? pendiente.nuevoCodigo
      : res?.codigo || res?.codigo_original || '',
  );
  const [nota, setNota] = useState(pendiente?.nota || '');

  const submit = () => {
    if (!tipo) {
      toast.error('Selecciona el tipo de error');
      return;
    }
    onSave({
      tipo,
      nuevaMedida: parseFloat(largo) || null,
      nuevoCodigo: serial.trim() || null,
      nota: nota.trim(),
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-warning/30 bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-warning">
          <Pencil className="mr-1 inline h-3.5 w-3.5" />
          Editar línea {idx + 1} — OT {ord.ot || '?'} · {ord.ubic || '?'}
        </strong>
        <button
          onClick={onCancel}
          className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2">
        <div>
          <Label className="text-[0.65rem]">Tipo de error</Label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoError | '')}
            className="h-8 w-full rounded border border-border bg-card px-2 text-xs text-foreground"
          >
            <option value="">— Seleccionar —</option>
            {(Object.entries(TIPO_ERROR_LABELS) as Array<[TipoError, string]>).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {tipo === 'medida_erronea' && (
          <div>
            <Label className="text-[0.65rem]">Medida correcta (cm)</Label>
            <Input
              type="number"
              value={largo}
              onChange={(e) => setLargo(e.target.value)}
              step="0.1"
              className="h-8 text-xs"
            />
          </div>
        )}

        {tipo === 'tubo_equivocado' && (
          <div>
            <Label className="text-[0.65rem]">Tubo correcto (código/serial)</Label>
            <Input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Ej: T-001-A"
              className="h-8 text-xs"
            />
          </div>
        )}

        <div>
          <Label className="text-[0.65rem]">Nota (opcional)</Label>
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Descripción del problema"
            className="h-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={submit}
            className="h-8 gap-1 bg-warning hover:bg-warning"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Guardar corrección
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          {pendiente && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRemove}
              className="border-destructive/30 text-destructive hover:bg-destructive/15"
            >
              Descartar corrección
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Historial de correcciones
// ──────────────────────────────────────────────────────────────────
function HistorialCorrecciones({
  ctx,
}: {
  ctx: ReturnType<typeof useCorreccionesHistorial>;
}) {
  const { registros, loading, cargar } = ctx;

  return (
    <div className="rounded-lg border border-purple-500/30 bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <strong className="text-sm">Historial de correcciones</strong>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={cargar}
          disabled={loading}
          className="h-8 gap-1 border-purple-500/30 text-accent"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refrescar
        </Button>
      </div>
      <div className="max-h-[200px] overflow-y-auto text-xs">
        {!loading && registros.length === 0 && (
          <div className="py-3 text-center text-muted-foreground">Sin correcciones registradas.</div>
        )}
        {registros.map((r) => {
          const ts = (r.timestamp || '').slice(0, 16).replace('T', ' ');
          const tipoLabel =
            (r.tipo && TIPO_ERROR_LABELS[r.tipo as TipoError]) || r.tipo || '—';
          return (
            <div
              key={r.id}
              className="border-b border-border py-1.5 last:border-b-0"
            >
              <span className="text-warning">{tipoLabel}</span>
              <span className="text-muted-foreground"> · Línea {(r.linea_idx ?? -1) + 1}</span>
              <span className="text-muted-foreground"> · {ts}</span>
              {r.nota && (
                <div className="italic text-muted-foreground">{r.nota}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Historial de planes (con preview + restore)
// ──────────────────────────────────────────────────────────────────
function HistorialPlanes({
  ctx,
  email,
}: {
  ctx: ReturnType<typeof usePlanesHistorial>;
  email: string;
}) {
  const { planes, loading, cargar, restaurar } = ctx;
  const [preview, setPreview] = useState<PlanResumen | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [filtro, setFiltro] = useState('');

  const planesVisibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return planes;
    return planes.filter((p) =>
      extraerOTsPlan(p).some((ot) => ot.toLowerCase().includes(q)),
    );
  }, [planes, filtro]);

  const onRestaurar = async (plan: PlanResumen) => {
    if (!email) {
      toast.error('Configurá primero el email del optimizador');
      return;
    }
    const fecha = plan.fecha
      ? new Date(plan.fecha).toLocaleString('es-CL')
      : '—';
    const tieneSnap = plan.snapshot_inventario.length > 0;
    const msgInv = tieneSnap
      ? `\n🗄 Colmena: se restaurarán ${plan.snapshot_inventario.length} tubos al estado anterior a este plan.`
      : `\n⚠️ Este plan no tiene snapshot de colmena guardado. Solo se restaurará el listado de cortes.`;
    if (
      !confirm(
        `⏱ VIAJE EN EL TIEMPO\n\nVas a volver al estado del: ${fecha}${msgInv}\n\n¿Confirmas la restauración? Esta acción actualiza el inventario físico de tubos.`,
      )
    )
      return;
    setRestaurando(true);
    try {
      const res = await restaurar(plan.id, email);
      const omitidos = res.count_omitidos_tombstone ?? 0;
      const sufijoOmitidos =
        omitidos > 0
          ? ` — ${omitidos} tubo${omitidos === 1 ? '' : 's'} omitido${omitidos === 1 ? '' : 's'} por estar eliminado${omitidos === 1 ? '' : 's'} definitivamente`
          : '';
      toast.success(
        `Restauración completada. ${res.count_despues} tubos restaurados (antes había ${res.count_antes})${sufijoOmitidos}.`,
      );
      setPreview(null);
      await cargar();
    } catch (e) {
      // PostgrestError no es Error nativo — tiene .message y opcionalmente
      // .details/.hint. Sin este cast, el error venía como "[object Object]".
      const err = e as { message?: string; details?: string; hint?: string } | Error;
      const msg =
        (err as Error).message ||
        (err as { message?: string }).message ||
        String(e);
      const extra = (err as { details?: string }).details
        ? ` (${(err as { details?: string }).details})`
        : '';
      toast.error('Error al restaurar: ' + msg + extra);
    } finally {
      setRestaurando(false);
    }
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-card/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-destructive" />
          <strong className="text-sm">Historial de planes de corte</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.68rem] text-muted-foreground">
            Puedes restaurar cualquier plan anterior
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={cargar}
            disabled={loading}
            className="h-8 gap-1 border-destructive/30 text-destructive"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Cargar
          </Button>
        </div>
      </div>

      {planes.length > 0 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por OT…"
            className="h-8 border-border bg-card pl-8 text-xs"
          />
        </div>
      )}

      <div className="max-h-[340px] overflow-y-auto text-xs">
        {!loading && planes.length === 0 && (
          <div className="py-3 text-center text-muted-foreground">
            Haz clic en "Cargar" para ver todos los planes guardados.
          </div>
        )}
        {!loading && planes.length > 0 && planesVisibles.length === 0 && (
          <div className="py-3 text-center text-muted-foreground">
            No hay planes que coincidan con "{filtro}".
          </div>
        )}
        {planesVisibles.map((plan) => {
          const i = planes.findIndex((p) => p.id === plan.id);
          const fecha = plan.fecha
            ? new Date(plan.fecha).toLocaleString('es-CL')
            : '—';
          const esActivo = i === 0;
          const esRestauracion = plan.tipo === 'restauracion';
          const tieneSnap = plan.snapshot_inventario.length > 0;
          return (
            <div
              key={plan.id}
              className={cn(
                'flex flex-wrap items-center gap-2 py-2',
                esRestauracion
                  ? 'mb-1 rounded border border-purple-500/20 bg-accent/5 px-2'
                  : 'border-b border-border last:border-b-0',
              )}
            >
              <div className="min-w-[180px] flex-1">
                <span className="text-foreground">{fecha}</span>
                {plan.fecha_correccion && (
                  <span className="ml-2 text-[0.65rem] text-success">
                    (corregido por admin)
                  </span>
                )}
                {esActivo && (
                  <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[0.65rem] text-success">
                    ● Activo
                  </span>
                )}
                {esRestauracion && (
                  <span className="ml-2 rounded-full border border-purple-500/30 bg-accent/15 px-2 py-0.5 text-[0.65rem] text-accent">
                    ⏱ Restaurado
                  </span>
                )}
                {!esRestauracion && tieneSnap && (
                  <span
                    className="ml-2 text-[0.65rem] text-accent"
                    title="Tiene snapshot — puede restaurar colmena completa"
                  >
                    <Camera className="inline h-3 w-3" />
                  </span>
                )}
                {!esRestauracion && !tieneSnap && i > 0 && (
                  <span
                    className="ml-2 text-[0.65rem] text-muted-foreground"
                    title="Sin snapshot"
                  >
                    <AlertTriangle className="inline h-3 w-3" />
                  </span>
                )}
                <div className="text-[0.68rem] text-muted-foreground">
                  {plan.nCortes} corte(s)
                  {plan.optimizer_email && (
                    <span className="text-warning"> · {plan.optimizer_email}</span>
                  )}
                </div>
                {(() => {
                  const ots = extraerOTsPlan(plan);
                  if (ots.length === 0) return null;
                  return (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ots.slice(0, 6).map((ot) => (
                        <span
                          key={ot}
                          className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-mono text-accent"
                        >
                          OT {ot}
                        </span>
                      ))}
                      {ots.length > 6 && (
                        <span
                          className="text-[0.65rem] text-muted-foreground"
                          title={ots.slice(6).map((o) => `OT ${o}`).join(', ')}
                        >
                          +{ots.length - 6}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 border-blue-500/30 px-2 text-[0.65rem] text-blue-300"
                  onClick={() => setPreview(plan)}
                >
                  <Eye className="h-3 w-3" />
                  Ver
                </Button>
                {i > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestaurar(plan)}
                    disabled={restaurando || !tieneSnap}
                    title={
                      !tieneSnap
                        ? 'No se puede restaurar: este plan no tiene snapshot de colmena guardado'
                        : undefined
                    }
                    className={cn(
                      'h-6 gap-1 border-destructive/30 px-2 text-[0.65rem] text-destructive',
                      !tieneSnap && 'opacity-40',
                    )}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restaurar
                  </Button>
                ) : (
                  <span className="self-center text-[0.65rem] text-success">
                    Plan vigente
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-background/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-destructive">
              <Eye className="mr-1 inline h-3.5 w-3.5" />
              Vista previa del plan
            </strong>
            <button
              onClick={() => setPreview(null)}
              className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mb-2 text-[0.68rem] text-muted-foreground">
            Plan del{' '}
            {preview.fecha ? new Date(preview.fecha).toLocaleString('es-CL') : '—'}
          </div>
          {preview.resultados.length === 0 ? (
            <div className="text-muted-foreground">Sin cortes en este plan.</div>
          ) : (
            <div className="max-h-[220px] overflow-y-auto text-[0.7rem]">
              <table className="w-full">
                <thead className="sticky top-0 bg-card text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-1.5 text-left">#</th>
                    <th className="p-1.5 text-left">OT / Ubic.</th>
                    <th className="p-1.5 text-left">Código tubo</th>
                    <th className="p-1.5 text-left">Medida (cm)</th>
                    <th className="p-1.5 text-left">Colmena</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.resultados.map((item, i) => {
                    const res = item.resultado || {};
                    const ord = item.orden || {};
                    const codigo =
                      res.codigo || res.codigo_original || ord.cod || '—';
                    const medida =
                      res.medida_cm !== undefined
                        ? Number(res.medida_cm).toFixed(1) + ' cm'
                        : '—';
                    const colmena = res.colmena ? String(res.colmena) : '—';
                    const otUbic =
                      [ord.ot, ord.ubic].filter(Boolean).join(' · ') || '—';
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="p-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="p-1.5">{otUbic}</td>
                        <td className="p-1.5 font-mono">{codigo}</td>
                        <td className="p-1.5 font-semibold">{medida}</td>
                        <td className="p-1.5">{colmena}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-2">
            <Button
              size="sm"
              onClick={() => onRestaurar(preview)}
              disabled={restaurando}
              className="gap-1 bg-destructive hover:bg-destructive"
            >
              {restaurando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Restaurar este plan como activo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Hint: el legacy duplicaba el inventario de tubos acá; ahora vive
// en su propio sub-tab Colmena. No re-implementamos el duplicado.
// ──────────────────────────────────────────────────────────────────
function HintColmenaDuplicada() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-teal-500/20 bg-teal-500/5 p-2.5 text-[0.72rem] text-muted-foreground">
      <ClipboardList className="h-3.5 w-3.5 text-teal-400" />
      <span>
        El inventario de tubos vive en el tab{' '}
        <strong className="text-teal-300">Colmena</strong> del panel — no se
        duplica acá.
      </span>
      <FileText className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}
