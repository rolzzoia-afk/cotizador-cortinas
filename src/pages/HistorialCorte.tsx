import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Recycle,
  Scissors,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
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
type ResultadoCorte = {
  colmena?: string | number | null;
  colmena_sobrante?: string | number | null;
  codigo?: string | null;
  codigo_original?: string | null;
  color?: string | null;
  orden?: string | null;
  medida_cm?: number | null;
  medida_origen?: number | null;
  sobrante_cm?: number | null;
  es_cenefa_ovalada?: boolean;
  es_peso?: boolean;
  es_intermedio?: boolean;
  es_desecho?: boolean;
  serial?:
    | { lote?: string; paquete?: string; serial?: string; fecha?: string }
    | string
    | null;
  lote?: string | null;
  paquete?: string | null;
  serial_str?: string | null;
};

type Orden = {
  id: string;
  ot?: string | null;
  numero_ot?: string | null;
  ubic?: string | null;
  ubicacion?: string | null;
};

type ResultadoItem = {
  resultado?: ResultadoCorte;
  orden?: Orden | string | null;
} & ResultadoCorte;

type Plan = {
  id: string;
  fecha: string | null;
  resultados: ResultadoItem[];
  ordenes: Orden[];
};

type ErrorRow = {
  id?: string;
  plan_id: string | null;
  linea_idx: number | null;
  motivo: string;
  ot: string | null;
  cod_original: string | null;
  medida_cm: number | null;
  reemplazo_cod: string | null;
  reemplazo_colmena: string | null;
  reemplazo_medida_cm: number | null;
  registrado_por: string | null;
  created_at: string;
};

type Tubo = {
  id: string;
  n_colmena: string | number;
  cod: string | null;
  medida_cm: number | null;
  tubo_raiz_id?: string | null;
};

type CorteCtx = {
  planId: string;
  planFecha: string | null;
  idx: number;
  r: ResultadoCorte;
  ord: Orden;
};

const MOTIVOS = [
  'Error de corte (operario)',
  'Falla en el tubo',
  'Error del vendedor',
  'Error del instalador',
  'Medida incorrecta en plano',
  'Material defectuoso',
  'Otro',
];

const MOTIVO_COLOR: Record<string, string> = {
  'Error de corte (operario)': '#ef4444',
  'Falla en el tubo': '#f97316',
  'Error del vendedor': '#f59e0b',
  'Error del instalador': '#3b82f6',
  'Medida incorrecta en plano': '#8b5cf6',
  'Material defectuoso': '#22c55e',
  Otro: '#a1a1aa',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function tryParse<T>(val: unknown, fallback: T): T {
  if (Array.isArray(val)) return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function getR(item: ResultadoItem): ResultadoCorte {
  return (item.resultado ?? item) as ResultadoCorte;
}

function getOrd(item: ResultadoItem, ordenes: Orden[]): Orden {
  const raw = item.orden;
  if (raw && typeof raw === 'object') return raw;
  const r = getR(item);
  const ordIdOrVal = (r.orden ?? item.orden) as string | null;
  return ordenes.find((o) => o.id === ordIdOrVal) || ({} as Orden);
}

function extraerOTs(plan: Plan): string[] {
  const set = new Set<string>();
  for (const item of plan.resultados || []) {
    const ord = getOrd(item, plan.ordenes || []);
    const r = getR(item);
    const ot = ord.ot || ord.numero_ot || r.orden;
    if (ot && ot !== '-') set.add(String(ot).trim());
  }
  return [...set];
}

function fmtFechaHora(f: string | null): string {
  if (!f) return 'Fecha desconocida';
  return new Date(f).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtFecha(f: string | null): string {
  if (!f) return '-';
  return new Date(f).toLocaleDateString('es-CL');
}

// ─────────────────────────────────────────────────────────────
// Modal: Registrar Error
// ─────────────────────────────────────────────────────────────
type Destino = 'merma' | 'recuperar' | null;

function ErrorDialog({
  open,
  onOpenChange,
  ctx,
  tubosDisponibles,
  plan,
  existingError,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: CorteCtx | null;
  tubosDisponibles: Tubo[];
  plan: Plan | null;
  existingError: { linea_idx: number; motivo: string } | null;
  onSuccess: (planId: string, idx: number, motivo: string) => void;
}) {
  if (!open || !ctx) return null;
  if (existingError) {
    return (
      <ExistingErrorDialog
        open={open}
        onOpenChange={onOpenChange}
        ctx={ctx}
        existingError={existingError}
      />
    );
  }
  return (
    <RegisterErrorDialog
      open={open}
      onOpenChange={onOpenChange}
      ctx={ctx}
      tubosDisponibles={tubosDisponibles}
      plan={plan}
      onSuccess={onSuccess}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Modal read-only (fila con error ya registrado)
// ─────────────────────────────────────────────────────────────
function ExistingErrorDialog({
  open,
  onOpenChange,
  ctx,
  existingError,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: CorteCtx;
  existingError: { linea_idx: number; motivo: string };
}) {
  const { r, ord } = ctx;
  const chips = [
    { label: 'OT', val: ord.ot || ord.numero_ot || r.orden || '-' },
    { label: 'Código', val: r.codigo || r.codigo_original || '—' },
    { label: 'Colmena', val: String(r.colmena ?? 'TUBO NUEVO') },
    {
      label: 'Medida',
      val: r.medida_cm != null ? `${Number(r.medida_cm).toFixed(1)} cm` : '-',
    },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/10 bg-zinc-900 text-zinc-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="h-5 w-5 text-red-500" /> Error ya registrado
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <div
              key={c.label}
              className="rounded-md border border-white/10 bg-zinc-800 px-2 py-1 text-[11px]"
            >
              <strong className="mr-1 text-zinc-400">{c.label}</strong>
              {c.val}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
            Motivo registrado
          </div>
          <div className="text-sm font-semibold text-red-200">{existingError.motivo}</div>
        </div>
        <p className="text-[11px] text-zinc-500">
          No se puede registrar otro error sobre la misma línea. Si el registro original es
          incorrecto, revísalo desde la pestaña "Errores registrados".
        </p>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal registrar error (flujo completo)
// ─────────────────────────────────────────────────────────────
function RegisterErrorDialog({
  open,
  onOpenChange,
  ctx,
  tubosDisponibles,
  plan,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: CorteCtx;
  tubosDisponibles: Tubo[];
  plan: Plan | null;
  onSuccess: (planId: string, idx: number, motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [comentario, setComentario] = useState('');
  const [responsable, setResponsable] = useState('');
  const [sobrante, setSobrante] = useState('');
  const [medRecuperar, setMedRecuperar] = useState('');
  const [destino, setDestino] = useState<Destino>(null);
  const [reemplazo, setReemplazo] = useState<Tubo | null>(null);
  const [buscarTubo, setBuscarTubo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMotivo('');
    setComentario('');
    setResponsable('');
    setSobrante('');
    setMedRecuperar('');
    setDestino(null);
    setReemplazo(null);
    setBuscarTubo('');
  }, [open]);

  const { r, ord, planId, idx } = ctx;

  // ── Colmenas ya ocupadas en el plan (para excluirlas)
  const colmenasOcupadas = useMemo(() => {
    const usadas = new Set<string>();
    if (!plan) return usadas;
    plan.resultados.forEach((item, i) => {
      if (i === idx) return;
      const rr = getR(item);
      if (rr.colmena && rr.colmena !== 'TUBO NUEVO' && rr.colmena !== 'LIBERADO') {
        usadas.add(String(rr.colmena).toUpperCase().trim());
      }
      if (rr.colmena_sobrante) {
        usadas.add(String(rr.colmena_sobrante).toUpperCase().trim());
      }
    });
    return usadas;
  }, [plan, idx]);

  // ── Sugerencia automática
  const sugerencia = useMemo(() => {
    const medidaNecesaria = Number(r.medida_cm || 0);
    if (!medidaNecesaria) return null;
    const codNecesario = (r.codigo || r.codigo_original || '').toUpperCase().trim();
    const candidatos = tubosDisponibles.filter((t) => {
      if (Number(t.medida_cm || 0) < medidaNecesaria) return false;
      const col = String(t.n_colmena || '').toUpperCase().trim();
      return !colmenasOcupadas.has(col);
    });
    if (!candidatos.length) return null;
    const conPuntaje = candidatos.map((t) => ({
      tubo: t,
      mismoCod: (t.cod || '').toUpperCase().trim() === codNecesario,
      sobrante: Number(t.medida_cm) - medidaNecesaria,
    }));
    conPuntaje.sort((a, b) => {
      if (a.mismoCod !== b.mismoCod) return a.mismoCod ? -1 : 1;
      return a.sobrante - b.sobrante;
    });
    const m = conPuntaje[0];
    const razones: string[] = [];
    if (m.mismoCod) razones.push(`mismo código ${m.tubo.cod}`);
    else
      razones.push(
        `código compatible ${m.tubo.cod} (no hay stock de ${codNecesario})`,
      );
    razones.push(`sobrante estimado: ${m.sobrante.toFixed(1)} cm`);
    return { tubo: m.tubo, razon: razones.join(' · ') };
  }, [r, tubosDisponibles, colmenasOcupadas]);

  // ── Lista filtrada
  const tubosFiltrados = useMemo(() => {
    const medidaNecesaria = Number(r.medida_cm || 0);
    const codCorte = (r.codigo || r.codigo_original || '').toUpperCase().trim();
    const base = tubosDisponibles.filter((t) => {
      if (sugerencia && t.id === sugerencia.tubo.id) return false;
      const col = String(t.n_colmena || '').toUpperCase().trim();
      return !colmenasOcupadas.has(col);
    });
    if (buscarTubo) {
      const q = buscarTubo.toLowerCase();
      return base.filter(
        (t) =>
          (t.cod || '').toLowerCase().includes(q) ||
          String(t.n_colmena || '').toLowerCase().includes(q),
      );
    }
    if (codCorte) {
      return base.filter(
        (t) =>
          (t.cod || '').toUpperCase().trim() === codCorte &&
          Number(t.medida_cm || 0) >= medidaNecesaria,
      );
    }
    return base;
  }, [tubosDisponibles, colmenasOcupadas, sugerencia, buscarTubo, r]);

  const seleccionarTubo = (t: Tubo) => {
    setReemplazo(t);
    if (r.medida_cm != null) {
      const sug = Number(t.medida_cm) - Number(r.medida_cm);
      setSobrante(sug > 0 ? sug.toFixed(1) : '0');
    }
  };

  const setDestinoYMed = (d: Destino) => {
    setDestino(d);
    if (d === 'recuperar' && r.medida_origen != null && !medRecuperar) {
      setMedRecuperar(Number(r.medida_origen).toFixed(1));
    }
  };

  const confirmar = async () => {
    // Validaciones cliente (la RPC también valida, pero feedback inmediato)
    if (!motivo) {
      toast.warning('Selecciona un motivo');
      return;
    }
    if (!responsable.trim()) {
      toast.warning('Ingresa tu nombre');
      return;
    }
    if (destino === 'recuperar') {
      const n = Number(medRecuperar);
      if (!Number.isFinite(n) || n <= 0) {
        toast.warning(
          'Elegiste recuperar el tubo original pero no ingresaste una medida válida',
        );
        return;
      }
      if (
        r.colmena == null ||
        String(r.colmena).trim() === '' ||
        String(r.colmena).toUpperCase() === 'TUBO NUEVO'
      ) {
        toast.warning(
          'No se puede recuperar a colmena: el tubo original no tiene colmena asignada',
        );
        return;
      }
    }

    setSaving(true);
    const sobranteVal = reemplazo ? Number(sobrante) || 0 : 0;
    const medRecupVal = destino === 'recuperar' ? Number(medRecuperar) || 0 : 0;
    const s =
      r.serial && typeof r.serial === 'object'
        ? (r.serial as { serial?: string })
        : {};

    const { data, error } = await supabase.rpc('registrar_error_corte', {
      p_plan_id: planId,
      p_plan_fecha: ctx.planFecha,
      p_linea_idx: idx,
      p_ot: ord.ot || ord.numero_ot || r.orden || null,
      p_ubicacion: ord.ubic || ord.ubicacion || null,
      p_colmena_original: r.colmena != null ? String(r.colmena) : null,
      p_cod_original: r.codigo || r.codigo_original || null,
      p_medida_cm: r.medida_cm ?? null,
      p_medida_origen_cm: r.medida_origen ?? null,
      p_color: r.color || null,
      p_serial: s.serial || null,
      p_motivo: motivo,
      p_comentario: comentario.trim() || null,
      p_reemplazo_id: reemplazo?.id || null,
      p_sobrante_cm: sobranteVal,
      p_destino_original: destino,
      p_med_recuperar: medRecupVal,
      p_responsable: responsable.trim(),
    });

    setSaving(false);

    if (error) {
      const msg = error.message || 'Error desconocido';
      if (msg.includes('Ya existe un error registrado')) {
        toast.error('Ya hay un error registrado para esta línea del plan.');
      } else if (msg.includes('Tubo de reemplazo no encontrado')) {
        toast.error('El tubo de reemplazo ya no está disponible. Actualiza la lista.');
      } else {
        toast.error(msg);
      }
      return;
    }

    const result = data as {
      reemplazo_consumido?: boolean;
      sobrante_reingresado?: boolean;
      destino_original?: string | null;
    } | null;

    // Mensaje resumen de lo que pasó
    const partes: string[] = ['Error registrado'];
    if (result?.reemplazo_consumido) {
      partes.push(
        result.sobrante_reingresado
          ? `Reemplazo consumido · ${sobranteVal} cm reingresados`
          : 'Reemplazo consumido',
      );
    }
    if (result?.destino_original === 'merma') partes.push('tubo original a merma');
    else if (result?.destino_original === 'recuperar')
      partes.push(`tubo original recuperado (${medRecupVal} cm)`);

    toast.success(partes.join(' · '));
    onSuccess(planId, idx, motivo);
    onOpenChange(false);
  };

  const codOrig = r.codigo || r.codigo_original || '—';
  const colOrig = r.colmena ?? '—';
  const medOrigen =
    r.medida_origen != null ? `${Number(r.medida_origen).toFixed(1)} cm` : '—';

  const chips = [
    { label: 'OT', val: ord.ot || ord.numero_ot || r.orden || '-' },
    { label: 'Código', val: codOrig },
    { label: 'Colmena', val: String(r.colmena ?? 'TUBO NUEVO') },
    {
      label: 'Medida',
      val: r.medida_cm != null ? `${Number(r.medida_cm).toFixed(1)} cm` : '-',
    },
    { label: 'Origen', val: medOrigen },
    { label: 'Color', val: r.color || '-' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-zinc-900 text-zinc-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="h-5 w-5 text-red-500" /> Registrar error de corte
          </DialogTitle>
          <p className="text-xs text-zinc-400">
            El registro quedará en el historial para análisis de errores.
          </p>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <div
              key={c.label}
              className="rounded-md border border-white/10 bg-zinc-800 px-2 py-1 text-[11px]"
            >
              <strong className="mr-1 text-zinc-400">{c.label}</strong>
              {c.val}
            </div>
          ))}
        </div>

        <div>
          <Label className="mb-1 text-xs">Motivo del error *</Label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
          >
            <option value="">— Selecciona un motivo —</option>
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="mb-1 text-xs">Comentario (opcional)</Label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            placeholder="Ej: el operario cortó 125cm en lugar de 120cm…"
            className="w-full resize-none rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <Label className="mb-1 text-xs">Tubo de reemplazo utilizado</Label>
          {sugerencia && (
            <div className="mb-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <Sparkles className="h-3 w-3" /> Sugerencia
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-bold text-zinc-100">
                    Colmena {sugerencia.tubo.n_colmena} · {sugerencia.tubo.cod}
                  </span>
                  <span className="ml-2 text-xs text-emerald-400">
                    {Number(sugerencia.tubo.medida_cm).toFixed(1)} cm
                  </span>
                </div>
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                {sugerencia.razon}
              </div>
              <Button
                size="sm"
                onClick={() => seleccionarTubo(sugerencia.tubo)}
                className="mt-2 border border-emerald-500/35 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
              >
                Usar este tubo
              </Button>
            </div>
          )}

          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              value={buscarTubo}
              onChange={(e) => setBuscarTubo(e.target.value)}
              placeholder="Buscar otro código o colmena…"
              className="border-white/10 bg-zinc-800 pl-8 text-sm"
            />
          </div>

          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.05]">
            {tubosFiltrados.length === 0 ? (
              <div className="p-3 text-center text-xs text-zinc-500">
                Sin tubos disponibles
              </div>
            ) : (
              tubosFiltrados.slice(0, 80).map((t) => {
                const sel = reemplazo?.id === t.id;
                const necesaria = Number(r.medida_cm || 0);
                const sobrVal =
                  necesaria > 0 ? Number(t.medida_cm || 0) - necesaria : null;
                const insuficiente = sobrVal !== null && sobrVal < 0;
                return (
                  <button
                    key={t.id}
                    disabled={insuficiente}
                    onClick={() => seleccionarTubo(t)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-2 text-left text-xs transition last:border-0',
                      sel
                        ? 'bg-purple-500/15 text-purple-300'
                        : 'hover:bg-white/[0.03]',
                      insuficiente && 'cursor-not-allowed opacity-45',
                    )}
                  >
                    <span>
                      <strong>Colmena {t.n_colmena}</strong> · {t.cod}
                      {sobrVal !== null && sobrVal >= 0 && (
                        <span className="ml-1 text-[11px] text-zinc-500">
                          · sobrante: {sobrVal.toFixed(1)} cm
                        </span>
                      )}
                      {insuficiente && (
                        <span className="ml-1 text-[11px] text-red-400">
                          · insuficiente
                        </span>
                      )}
                    </span>
                    <span className="text-zinc-500">
                      {t.medida_cm != null
                        ? `${Number(t.medida_cm).toFixed(1)} cm`
                        : '-'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {reemplazo && (
            <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              ✅ <strong>Colmena {reemplazo.n_colmena}</strong> · {reemplazo.cod} ·{' '}
              {Number(reemplazo.medida_cm || 0).toFixed(1)} cm
            </div>
          )}
        </div>

        {reemplazo && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-3">
            <Label className="text-xs text-amber-400">
              ¿Cuánto sobró del tubo de reemplazo? (cm)
            </Label>
            <p className="mt-1 mb-2 text-[11px] text-zinc-400">
              Si sobró material, se guardará de vuelta en la colmena con la nueva medida.
              Si no quedó nada, dejar en 0.
            </p>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={sobrante}
              onChange={(e) => setSobrante(e.target.value)}
              placeholder="Ej: 45.5"
              className="border-white/10 bg-zinc-800"
            />
          </div>
        )}

        <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.07] p-3">
          <Label className="text-xs text-indigo-300">
            ¿Qué pasó con el tubo original?
          </Label>
          <p className="mt-1 mb-2 text-[11px] text-zinc-400">
            Colmena {String(colOrig)} · Código {codOrig} · Medida original {medOrigen}
          </p>
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => setDestinoYMed('merma')}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition',
                destino === 'merma'
                  ? 'border-red-500/50 bg-red-500/15 text-red-400'
                  : 'border-red-500/30 text-zinc-400 hover:border-red-500/50',
              )}
            >
              <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Merma — se descarta
            </button>
            <button
              onClick={() => setDestinoYMed('recuperar')}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition',
                destino === 'recuperar'
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                  : 'border-indigo-500/30 text-zinc-400 hover:border-indigo-500/50',
              )}
            >
              <Recycle className="mr-1 inline h-3.5 w-3.5" /> Volver a colmena
            </button>
          </div>
          {destino === 'recuperar' && (
            <div>
              <Label className="text-xs">Medida real del tubo (cm)</Label>
              <p className="mt-1 mb-1.5 text-[11px] text-zinc-500">
                Ingresa la medida real del tubo tal como quedó después del corte erróneo.
                Se va a reingresar a la misma colmena con esa medida.
              </p>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={medRecuperar}
                onChange={(e) => setMedRecuperar(e.target.value)}
                placeholder="Ej: 125"
                className="border-white/10 bg-zinc-800"
              />
            </div>
          )}
        </div>

        <div>
          <Label className="mb-1 text-xs">Registrado por *</Label>
          <Input
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            placeholder="Tu nombre"
            className="border-white/10 bg-zinc-800"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={saving}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" /> Guardar error
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabla de plan (expandida)
// ─────────────────────────────────────────────────────────────
function PlanTabla({
  plan,
  errores,
  onRegistrarError,
}: {
  plan: Plan;
  errores: { linea_idx: number; motivo: string }[];
  onRegistrarError: (idx: number) => void;
}) {
  const rows: React.ReactNode[] = [];
  plan.resultados.forEach((item, idx) => {
    const r = getR(item);
    const ord = getOrd(item, plan.ordenes);
    const ot = ord.ot || ord.numero_ot || r.orden || '-';
    const ubicacion = ord.ubic || ord.ubicacion || '-';
    const colmena = r.colmena ?? 'TUBO NUEVO';
    const codigo = r.codigo || r.codigo_original || '-';
    const color = r.color || '-';
    const medidaCm = r.medida_cm != null ? Number(r.medida_cm).toFixed(1) : '-';
    const origenCm = r.medida_origen != null ? Number(r.medida_origen).toFixed(1) : '-';
    const s = (r.serial && typeof r.serial === 'object'
      ? r.serial
      : {}) as {
      lote?: string;
      paquete?: string;
      serial?: string;
      fecha?: string;
    };
    const lote = s.lote || r.lote || '-';
    const paquete = s.paquete || r.paquete || '-';
    const serial = s.serial || r.serial_str || '-';
    const fechaSer = s.fecha ? fmtFecha(s.fecha) : '-';

    const errorExistente = errores.find((e) => e.linea_idx === idx);
    let accion = 'CORTAR';
    if (r.es_cenefa_ovalada) accion = 'CORTAR CENEFA OVALADA';
    else if (r.es_peso) accion = 'CORTAR PESO';
    else if (r.codigo?.includes('TIRA')) accion = 'CORTAR CON TIRA';

    rows.push(
      <tr key={`c-${idx}`} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
        <td className="whitespace-nowrap px-2.5 py-1.5">{ot}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{ubicacion}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">
          <span className="rounded bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-400">
            {accion}
          </span>
        </td>
        <td className="whitespace-nowrap px-2.5 py-1.5">
          <strong>{String(colmena)}</strong>
        </td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{codigo}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{color}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-bold">
          {medidaCm}
        </td>
        <td className="whitespace-nowrap px-2.5 py-1.5 text-right">{origenCm}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{lote}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{paquete}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{serial}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{fechaSer}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">
          <button
            onClick={() => onRegistrarError(idx)}
            className={cn(
              'rounded-md border px-2 py-1 text-[10px] font-bold uppercase transition',
              errorExistente
                ? 'cursor-default border-red-500/50 bg-red-500/20 text-red-300'
                : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/15',
            )}
            title={
              errorExistente
                ? `Ya registrado: ${errorExistente.motivo}`
                : 'Registrar error en este corte'
            }
          >
            ⚠ {errorExistente ? errorExistente.motivo : 'Error'}
          </button>
        </td>
      </tr>,
    );

    if (r.sobrante_cm && Number(r.sobrante_cm) > 0) {
      const sobranteCm = Number(r.sobrante_cm).toFixed(1);
      const colSob = r.colmena_sobrante || colmena;
      let rowCls = 'border-b border-white/[0.04] bg-blue-500/[0.08] text-blue-200';
      let accion2 = 'GUARDAR SOBRANTE';
      let colDisp: string | number = colSob;
      if (r.es_intermedio) {
        rowCls = 'border-b border-white/[0.04] bg-orange-500/[0.08] text-orange-200';
        accion2 = 'RESERVAR EN MESA';
        colDisp = '—';
      } else if (r.es_desecho) {
        rowCls = 'border-b border-white/[0.04] bg-red-500/[0.08] text-red-200';
        accion2 = 'DESECHAR MERMA';
        colDisp = 'BASURERO';
      }
      rows.push(
        <tr key={`s-${idx}`} className={rowCls}>
          <td className="whitespace-nowrap px-2.5 py-1.5">{ot}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5">{ubicacion}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5">
            <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase">
              {accion2}
            </span>
          </td>
          <td className="whitespace-nowrap px-2.5 py-1.5">{String(colDisp)}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5">{codigo}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5">{color}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-bold">
            {sobranteCm}
          </td>
          <td colSpan={6}></td>
        </tr>,
      );
    }
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]" style={{ minWidth: 900 }}>
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {[
              'OT',
              'Ubicación',
              'Acción',
              'Colmena',
              'Código',
              'Color',
              'Cortar (cm)',
              'Origen (cm)',
              'Lote',
              'Paquete',
              'Serial',
              'Fecha serial',
              '',
            ].map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export function HistorialCorte() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'planes' | 'errores'>('planes');
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [erroresPorPlan, setErroresPorPlan] = useState<
    Record<string, { linea_idx: number; motivo: string }[]>
  >({});
  const [errores, setErrores] = useState<ErrorRow[]>([]);
  const [tubos, setTubos] = useState<Tubo[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalCtx, setModalCtx] = useState<CorteCtx | null>(null);

  const cargarPlanes = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from('planes_corte')
      .select('id, fecha, resultados, ordenes')
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false })
      .limit(50);

    const raw = (data || []).map((p: { id: string; fecha: string | null; resultados: unknown; ordenes: unknown }) => ({
      id: p.id,
      fecha: p.fecha,
      resultados: (Array.isArray(p.resultados)
        ? p.resultados
        : tryParse(p.resultados, [])) as ResultadoItem[],
      ordenes: (Array.isArray(p.ordenes)
        ? p.ordenes
        : tryParse(p.ordenes, [])) as Orden[],
    }));

    // Dedupe
    const map = new Map<string, Plan>();
    raw.forEach((p) => {
      const ots = [
        ...new Set(
          p.resultados.map((item) => {
            const r = getR(item);
            const ord = getOrd(item, p.ordenes);
            return String(ord.ot || ord.numero_ot || r.orden || '-').trim();
          }).filter((ot) => ot && ot !== '-'),
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
      (errs || []).forEach((e: { plan_id: string; linea_idx: number; motivo: string }) => {
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

  useEffect(() => {
    cargarPlanes();
    cargarTubos();
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
    // refrescar tubos si estamos reemplazando
    cargarTubos();
  };

  // Errores chart data
  const motivosData = useMemo(() => {
    const conteo: Record<string, number> = {};
    errores.forEach((e) => {
      const m = e.motivo || 'Otro';
      conteo[m] = (conteo[m] || 0) + 1;
    });
    return Object.entries(conteo).map(([name, value]) => ({
      name,
      value,
      color: MOTIVO_COLOR[name] || '#a1a1aa',
    }));
  }, [errores]);

  const modalPlan = modalCtx ? planes.find((p) => p.id === modalCtx.planId) || null : null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-2 text-xs text-zinc-500">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-purple-500/30 border-t-purple-500" />
          Cargando historial…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      {/* HEADER */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.07] bg-zinc-950/95 px-5 py-3 backdrop-blur">
        <button
          onClick={() => navigate('/landing')}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" /> Inicio
        </button>
        <h1 className="flex-1 text-base font-bold">Historial de Corte</h1>
      </div>

      {/* TABS */}
      <div className="flex gap-1.5 border-b border-white/[0.07] bg-zinc-950 px-5 pt-3.5">
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
                ? 'border-purple-500 bg-purple-500/[0.08] text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* TAB PLANES */}
      {tab === 'planes' && (
        <div className="p-5">
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por OT…"
              className="border-white/10 bg-zinc-900 pl-8"
            />
          </div>

          {planesVisibles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-zinc-500">
              <Scissors className="h-8 w-8" />
              <div className="text-sm">
                {planes.length === 0
                  ? 'No hay planes de corte guardados aún.'
                  : `No hay planes que coincidan con "${filtro}".`}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {planesVisibles.map((plan) => {
                const fechaStr = fmtFechaHora(plan.fecha);
                const nCortes = plan.resultados.length;
                const errs = erroresPorPlan[plan.id] || [];
                const hasErrors = errs.length > 0;
                const ots = extraerOTs(plan);
                const isExp = expanded.has(plan.id);

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'overflow-hidden rounded-2xl border bg-zinc-900 transition-colors',
                      hasErrors ? 'border-red-500/30' : 'border-white/[0.07]',
                    )}
                  >
                    <button
                      onClick={() => toggle(plan.id)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[15px] font-bold">
                          <Scissors className="h-4 w-4 flex-shrink-0 text-purple-500" />
                          {fechaStr}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-zinc-400">
                          <span>
                            {nCortes} corte{nCortes !== 1 ? 's' : ''}
                          </span>
                          {hasErrors && (
                            <span className="text-red-400">
                              · ⚠ {errs.length} error{errs.length > 1 ? 'es' : ''}
                            </span>
                          )}
                          {ots.map((ot) => (
                            <span
                              key={ot}
                              className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-300"
                            >
                              OT {ot}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-zinc-400 transition-transform',
                          isExp && 'rotate-180',
                        )}
                      />
                    </button>
                    {isExp && (
                      <div className="border-t border-white/[0.05]">
                        <PlanTabla
                          plan={plan}
                          errores={errs}
                          onRegistrarError={(idx) => abrirModal(plan, idx)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB ERRORES */}
      {tab === 'errores' && (
        <div className="p-5">
          {motivosData.length > 0 && (
            <div className="mb-5 rounded-2xl border border-white/[0.07] bg-zinc-900 p-4">
              <h6 className="mb-3 text-sm font-semibold text-zinc-200">
                Cantidad de errores por motivo
              </h6>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={motivosData}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="name"
                      stroke="#a1a1aa"
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis
                      stroke="#a1a1aa"
                      tick={{ fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <ReTooltip
                      contentStyle={{
                        background: '#18181b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v} error${v > 1 ? 'es' : ''}`, '']}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {motivosData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    {['Fecha', 'OT', 'Código', 'Medida', 'Motivo', 'Reemplazo', 'Por'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {errores.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-sm text-zinc-500"
                      >
                        Sin errores registrados aún.
                      </td>
                    </tr>
                  ) : (
                    errores.map((e, i) => {
                      const fecha = new Date(e.created_at).toLocaleString('es-CL', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const color = MOTIVO_COLOR[e.motivo] || '#a1a1aa';
                      const reemplazo = e.reemplazo_cod
                        ? `Colmena ${e.reemplazo_colmena} · ${e.reemplazo_cod} (${Number(e.reemplazo_medida_cm || 0).toFixed(1)} cm)`
                        : '—';
                      return (
                        <tr
                          key={e.id ?? i}
                          className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                            {fecha}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{e.ot || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {e.cod_original || '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {e.medida_cm != null
                              ? `${Number(e.medida_cm).toFixed(1)} cm`
                              : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                              style={{
                                background: `${color}20`,
                                borderColor: `${color}55`,
                                color,
                              }}
                            >
                              {e.motivo}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                            {reemplazo}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                            {e.registrado_por || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ErrorDialog
        open={!!modalCtx}
        onOpenChange={(v) => !v && setModalCtx(null)}
        ctx={modalCtx}
        plan={modalPlan}
        tubosDisponibles={tubos}
        existingError={
          modalCtx
            ? (erroresPorPlan[modalCtx.planId] || []).find(
                (e) => e.linea_idx === modalCtx.idx,
              ) || null
            : null
        }
        onSuccess={onSuccess}
      />
    </div>
  );
}
