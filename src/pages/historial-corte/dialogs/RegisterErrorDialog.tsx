// Modal de registro de error de corte (flujo completo).
//
// Lógica clave:
// - 2 modos de reemplazo: desde colmena existente o tubo nuevo (con
//   confirmación física obligatoria para evitar tubos fantasma —
//   ver investigación 2026-04-27).
// - Identidad de tubo: (colmena · código · medida_origen) — la misma
//   colmena puede tener varios tubos del mismo código pero distintas
//   medidas; solo el tubo específico ya consumido por otro corte queda
//   excluido del reemplazo.
// - Sugerencia automática: prioriza mismo código + mínimo sobrante.
// - Llama la RPC `registrar_error_corte` que valida y aplica todo
//   atómicamente.

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Recycle, Search, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
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
import { MOTIVOS } from '../HistorialCorte.config';
import { getR } from '../utils/parsers';
import type { CorteCtx, Destino, Plan, Tubo } from '../HistorialCorte.types';

interface RegisterErrorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: CorteCtx;
  tubosDisponibles: Tubo[];
  plan: Plan | null;
  onSuccess: (planId: string, idx: number, motivo: string) => void;
}

export default function RegisterErrorDialog({
  open,
  onOpenChange,
  ctx,
  tubosDisponibles,
  plan,
  onSuccess,
}: RegisterErrorDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [comentario, setComentario] = useState('');
  const [responsable, setResponsable] = useState('');
  const [sobrante, setSobrante] = useState('');
  const [medRecuperar, setMedRecuperar] = useState('');
  const [destino, setDestino] = useState<Destino>(null);
  const [reemplazo, setReemplazo] = useState<Tubo | null>(null);
  const [buscarTubo, setBuscarTubo] = useState('');
  const [saving, setSaving] = useState(false);
  const [modoReemplazo, setModoReemplazo] = useState<'colmena' | 'nuevo'>('colmena');
  const [nuevoColmena, setNuevoColmena] = useState('');
  const [nuevoCod, setNuevoCod] = useState('');
  const [nuevoMedida, setNuevoMedida] = useState('');
  const [confirmoTuboFisico, setConfirmoTuboFisico] = useState(false);

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
    setModoReemplazo('colmena');
    setNuevoColmena('');
    setNuevoCod('');
    setNuevoMedida('');
    setConfirmoTuboFisico(false);
  }, [open]);

  const { r, ord, planId, idx } = ctx;

  const tuboKey = (colmena: unknown, cod: unknown, medida: unknown) =>
    [
      String(colmena ?? '').toUpperCase().trim(),
      String(cod ?? '').toUpperCase().trim(),
      medida != null && Number.isFinite(Number(medida)) ? Number(medida).toFixed(1) : '?',
    ].join('|');

  const tubosOcupados = useMemo(() => {
    const keys = new Set<string>();
    if (!plan) return keys;
    plan.resultados.forEach((item, i) => {
      if (i === idx) return;
      const rr = getR(item);
      if (rr.colmena && rr.colmena !== 'TUBO NUEVO' && rr.colmena !== 'LIBERADO') {
        keys.add(tuboKey(rr.colmena, rr.codigo || rr.codigo_original, rr.medida_origen));
      }
    });
    return keys;
  }, [plan, idx]);

  const tuboRaizCorteActual = r.tubo_raiz_id || null;
  const keyCorteActual =
    r.colmena && r.colmena !== 'TUBO NUEVO' && r.colmena !== 'LIBERADO'
      ? tuboKey(r.colmena, r.codigo || r.codigo_original, r.medida_origen)
      : null;
  const esTuboDelCorteActual = (t: Tubo): boolean => {
    if (tuboRaizCorteActual && t.tubo_raiz_id === tuboRaizCorteActual) return true;
    if (!tuboRaizCorteActual && keyCorteActual) {
      return tuboKey(t.n_colmena, t.cod, t.medida_cm) === keyCorteActual;
    }
    return false;
  };

  const sugerencia = useMemo(() => {
    const medidaNecesaria = Number(r.medida_cm || 0);
    if (!medidaNecesaria) return null;
    const codNecesario = (r.codigo_original || r.codigo || '').toUpperCase().trim();
    const candidatos = tubosDisponibles.filter((t) => {
      if (Number(t.medida_cm || 0) < medidaNecesaria) return false;
      if (tubosOcupados.has(tuboKey(t.n_colmena, t.cod, t.medida_cm))) return false;
      if (esTuboDelCorteActual(t)) return false;
      return true;
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
    else razones.push(`código compatible ${m.tubo.cod} (no hay stock de ${codNecesario})`);
    razones.push(`sobrante estimado: ${m.sobrante.toFixed(1)} cm`);
    return { tubo: m.tubo, razon: razones.join(' · ') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, tubosDisponibles, tubosOcupados]);

  const tubosFiltrados = useMemo(() => {
    const medidaNecesaria = Number(r.medida_cm || 0);
    const codCorte = (r.codigo_original || r.codigo || '').toUpperCase().trim();
    const baseSinOcupados = tubosDisponibles.filter(
      (t) =>
        !tubosOcupados.has(tuboKey(t.n_colmena, t.cod, t.medida_cm)) && !esTuboDelCorteActual(t),
    );
    if (buscarTubo) {
      const q = buscarTubo.toLowerCase();
      return baseSinOcupados.filter(
        (t) =>
          (t.cod || '').toLowerCase().includes(q) ||
          String(t.n_colmena || '').toLowerCase().includes(q),
      );
    }
    const baseSinSugerido = baseSinOcupados.filter((t) => !sugerencia || t.id !== sugerencia.tubo.id);
    if (codCorte) {
      return baseSinSugerido.filter(
        (t) =>
          (t.cod || '').toUpperCase().trim() === codCorte &&
          Number(t.medida_cm || 0) >= medidaNecesaria,
      );
    }
    return baseSinSugerido;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tubosDisponibles, tubosOcupados, sugerencia, buscarTubo, r]);

  const motivoListaVacia = useMemo(() => {
    if (tubosDisponibles.length === 0) return 'No hay tubos en colmena_tubos.';
    const codCorte = (r.codigo_original || r.codigo || '').toUpperCase().trim();
    const ocupadosDelCod = tubosDisponibles.filter(
      (t) =>
        (!codCorte || (t.cod || '').toUpperCase().trim() === codCorte) &&
        tubosOcupados.has(tuboKey(t.n_colmena, t.cod, t.medida_cm)),
    ).length;
    if (buscarTubo) {
      return `Ningún tubo matchea "${buscarTubo}".${ocupadosDelCod ? ` (${ocupadosDelCod} reservados por otros cortes del plan)` : ''}`;
    }
    if (ocupadosDelCod > 0) {
      return `Los ${ocupadosDelCod} tubos de ${codCorte} disponibles están reservados por otros cortes del plan. Usa la sugerencia o cambia a "Tubo nuevo".`;
    }
    return `No hay tubos de ${codCorte || 'este código'} en stock con medida suficiente.`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tubosDisponibles, tubosOcupados, buscarTubo, r]);

  const seleccionarTubo = (t: Tubo) => {
    setReemplazo(t);
    if (r.medida_cm != null) {
      const sug = Number(t.medida_cm) - Number(r.medida_cm);
      setSobrante(sug > 0 ? sug.toFixed(1) : '0');
    }
  };

  const sobranteNuevo = useMemo(() => {
    if (modoReemplazo !== 'nuevo') return null;
    const total = Number(nuevoMedida || 0);
    const nec = Number(r.medida_cm || 0);
    if (!total || !nec || total < nec) return null;
    return total - nec;
  }, [modoReemplazo, nuevoMedida, r.medida_cm]);

  const cambiarModo = (nuevoMode: 'colmena' | 'nuevo') => {
    setModoReemplazo(nuevoMode);
    setConfirmoTuboFisico(false);
    if (nuevoMode === 'colmena') {
      setNuevoColmena('');
      setNuevoCod('');
      setNuevoMedida('');
    } else {
      setReemplazo(null);
      setSobrante('');
      setBuscarTubo('');
      if (!nuevoCod) {
        const codigoCorte = (r.codigo || r.codigo_original || '').trim();
        if (codigoCorte) setNuevoCod(codigoCorte);
      }
    }
  };

  const setDestinoYMed = (d: Destino) => {
    setDestino(d);
    if (d === 'recuperar' && r.medida_origen != null && !medRecuperar) {
      setMedRecuperar(Number(r.medida_origen).toFixed(1));
    }
  };

  const confirmar = async () => {
    if (!motivo) {
      toast.warning('Selecciona un motivo');
      return;
    }
    if (!responsable.trim()) {
      toast.warning('Ingresa tu nombre');
      return;
    }
    if (modoReemplazo === 'nuevo') {
      if (!nuevoColmena.trim()) {
        toast.warning('Ingresa la colmena donde irá el sobrante');
        return;
      }
      if (!nuevoCod.trim()) {
        toast.warning('Ingresa el código del tubo nuevo');
        return;
      }
      const medTotal = Number(nuevoMedida);
      if (!Number.isFinite(medTotal) || medTotal <= 0) {
        toast.warning('Ingresa una medida total válida para el tubo nuevo');
        return;
      }
      const necesaria = Number(r.medida_cm || 0);
      if (medTotal < necesaria) {
        toast.warning(
          `El tubo nuevo (${medTotal}cm) es menor que la medida necesaria (${necesaria}cm)`,
        );
        return;
      }
      if (!confirmoTuboFisico) {
        toast.warning('Confirma que sacaste físicamente un tubo virgen del stock antes de continuar');
        return;
      }
    }
    if (destino === 'recuperar') {
      const n = Number(medRecuperar);
      if (!Number.isFinite(n) || n <= 0) {
        toast.warning('Elegiste recuperar el tubo original pero no ingresaste una medida válida');
        return;
      }
      if (
        r.colmena == null ||
        String(r.colmena).trim() === '' ||
        String(r.colmena).toUpperCase() === 'TUBO NUEVO'
      ) {
        toast.warning('No se puede recuperar a colmena: el tubo original no tiene colmena asignada');
        return;
      }
    }

    setSaving(true);
    const esNuevo = modoReemplazo === 'nuevo';
    const sobranteVal = esNuevo
      ? sobranteNuevo || 0
      : reemplazo
        ? Number(sobrante) || 0
        : 0;
    const medRecupVal = destino === 'recuperar' ? Number(medRecuperar) || 0 : 0;
    const s = r.serial && typeof r.serial === 'object' ? (r.serial as { serial?: string }) : {};

    const { data, error } = await supabase.rpc('registrar_error_corte', {
      p_plan_id: planId,
      p_plan_fecha: ctx.planFecha as string,
      p_linea_idx: idx,
      p_ot: (ord.ot || ord.numero_ot || r.orden || null) as string,
      p_ubicacion: (ord.ubic || ord.ubicacion || null) as string,
      p_colmena_original: (r.colmena != null ? String(r.colmena) : null) as string,
      p_cod_original: (r.codigo || r.codigo_original || null) as string,
      p_medida_cm: (r.medida_cm ?? null) as number,
      p_medida_origen_cm: (r.medida_origen ?? null) as number,
      p_color: (r.color || null) as string,
      p_serial: (s.serial || null) as string,
      p_motivo: motivo,
      p_comentario: (comentario.trim() || null) as string,
      p_reemplazo_id: (esNuevo ? null : reemplazo?.id || null) as string,
      p_sobrante_cm: sobranteVal,
      p_destino_original: destino as string,
      p_med_recuperar: medRecupVal,
      p_responsable: responsable.trim(),
      p_tubo_nuevo_colmena: esNuevo ? nuevoColmena.trim().toUpperCase() : null,
      p_tubo_nuevo_cod: esNuevo ? nuevoCod.trim().toUpperCase() : null,
      p_tubo_nuevo_medida_cm: esNuevo ? Number(nuevoMedida) : null,
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
      reemplazo_tipo?: 'colmena' | 'tubo_nuevo' | null;
      sobrante_reingresado?: boolean;
      destino_original?: string | null;
    } | null;

    const partes: string[] = ['Error registrado'];
    if (result?.reemplazo_consumido) {
      const etiqueta =
        result.reemplazo_tipo === 'tubo_nuevo' ? 'Tubo nuevo usado' : 'Reemplazo consumido';
      partes.push(
        result.sobrante_reingresado ? `${etiqueta} · ${sobranteVal} cm reingresados` : etiqueta,
      );
    }
    if (result?.destino_original === 'merma') partes.push('tubo original a merma');
    else if (result?.destino_original === 'recuperar')
      partes.push(`tubo original recuperado (${medRecupVal} cm)`);

    toast.success(partes.join(' · '));
    onSuccess(planId, idx, motivo);
    onOpenChange(false);
  };

  const codUsado = r.codigo || r.codigo_original || '—';
  const codOriginalOrden = r.codigo_original;
  const huboReemplazo =
    !!codOriginalOrden && codOriginalOrden !== r.codigo && r.codigo != null;
  const codOrig = huboReemplazo
    ? `${codOriginalOrden} (cortado con ${r.codigo})`
    : codUsado;
  const colOrig = r.colmena ?? '—';
  const medOrigen = r.medida_origen != null ? `${Number(r.medida_origen).toFixed(1)} cm` : '—';

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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Registrar error de corte
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            El registro quedará en el historial para análisis de errores.
          </p>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <div key={c.label} className="rounded-md border border-border bg-secondary px-2 py-1 text-[11px]">
              <strong className="mr-1 text-muted-foreground">{c.label}</strong>
              {c.val}
            </div>
          ))}
        </div>

        <div>
          <Label className="mb-1 text-xs">Motivo del error *</Label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-purple-500 focus:outline-none"
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
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <Label className="mb-1 text-xs">Tubo de reemplazo utilizado</Label>

          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => cambiarModo('colmena')}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition',
                modoReemplazo === 'colmena'
                  ? 'border-purple-500/50 bg-accent/15 text-accent'
                  : 'border-border text-muted-foreground hover:border-border',
              )}
            >
              Desde colmena existente
            </button>
            <button
              type="button"
              onClick={() => cambiarModo('nuevo')}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition',
                modoReemplazo === 'nuevo'
                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                  : 'border-border text-muted-foreground hover:border-border',
              )}
            >
              Tubo nuevo
            </button>
          </div>

          {modoReemplazo === 'colmena' && (
            <>
              {sugerencia && (
                <div className="mb-2 rounded-xl border border-success/30 bg-success/[0.07] p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-success">
                    <Sparkles className="h-3 w-3" /> Sugerencia
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold text-foreground">
                        Colmena {sugerencia.tubo.n_colmena} · {sugerencia.tubo.cod}
                      </span>
                      <span className="ml-2 text-xs text-success">
                        {Number(sugerencia.tubo.medida_cm).toFixed(1)} cm
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{sugerencia.razon}</div>
                  <Button
                    size="sm"
                    onClick={() => seleccionarTubo(sugerencia.tubo)}
                    className="mt-2 border border-success/30 bg-success/15 text-success hover:bg-success/15"
                  >
                    Usar este tubo
                  </Button>
                </div>
              )}

              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={buscarTubo}
                  onChange={(e) => setBuscarTubo(e.target.value)}
                  placeholder="Buscar otro código o colmena…"
                  className="border-border bg-secondary pl-8 text-sm"
                />
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                {tubosFiltrados.length === 0 ? (
                  <div className="p-3 text-center text-[11px] leading-snug text-muted-foreground">
                    {motivoListaVacia}
                  </div>
                ) : (
                  tubosFiltrados.slice(0, 80).map((t) => {
                    const sel = reemplazo?.id === t.id;
                    const esSugerido = sugerencia?.tubo.id === t.id;
                    const necesaria = Number(r.medida_cm || 0);
                    const sobrVal = necesaria > 0 ? Number(t.medida_cm || 0) - necesaria : null;
                    const insuficiente = sobrVal !== null && sobrVal < 0;
                    return (
                      <button
                        key={t.id}
                        disabled={insuficiente}
                        onClick={() => seleccionarTubo(t)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-xs transition last:border-0',
                          sel ? 'bg-accent/15 text-accent' : 'hover:bg-secondary/40',
                          insuficiente && 'cursor-not-allowed opacity-45',
                        )}
                      >
                        <span>
                          <strong>Colmena {t.n_colmena}</strong> · {t.cod}
                          {esSugerido && (
                            <span className="ml-1.5 rounded-full border border-success/30 bg-success/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-success">
                              Sugerido
                            </span>
                          )}
                          {sobrVal !== null && sobrVal >= 0 && (
                            <span className="ml-1 text-[11px] text-muted-foreground">
                              · sobrante: {sobrVal.toFixed(1)} cm
                            </span>
                          )}
                          {insuficiente && (
                            <span className="ml-1 text-[11px] text-destructive">· insuficiente</span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {t.medida_cm != null ? `${Number(t.medida_cm).toFixed(1)} cm` : '-'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {reemplazo && (
                <div className="mt-2 rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
                  ✅ <strong>Colmena {reemplazo.n_colmena}</strong> · {reemplazo.cod} ·{' '}
                  {Number(reemplazo.medida_cm || 0).toFixed(1)} cm
                </div>
              )}
            </>
          )}

          {modoReemplazo === 'nuevo' && (
            <div className="space-y-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3">
              <p className="text-[11px] text-muted-foreground">
                Tubo que llegó de fuera del inventario. Se corta, el sobrante se guarda en la
                colmena que elijas y queda registrado en el historial.
              </p>
              <div>
                <Label className="text-xs">Colmena destino del sobrante *</Label>
                <Input
                  value={nuevoColmena}
                  onChange={(e) => setNuevoColmena(e.target.value.toUpperCase())}
                  placeholder="Ej: E71"
                  className="border-border bg-secondary"
                />
              </div>
              <div>
                <Label className="text-xs">Código del tubo nuevo *</Label>
                <Input
                  value={nuevoCod}
                  onChange={(e) => setNuevoCod(e.target.value.toUpperCase())}
                  placeholder={(r.codigo || r.codigo_original || 'código').toString()}
                  className="border-border bg-secondary"
                />
              </div>
              <div>
                <Label className="text-xs">Medida total del tubo nuevo (cm) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={nuevoMedida}
                  onChange={(e) => setNuevoMedida(e.target.value)}
                  placeholder={
                    r.medida_cm != null ? `≥ ${Number(r.medida_cm).toFixed(1)}` : 'Medida total'
                  }
                  className="border-border bg-secondary"
                />
                {sobranteNuevo !== null && (
                  <p className="mt-1 text-[11px] text-success">
                    Sobrante calculado: <strong>{sobranteNuevo.toFixed(1)} cm</strong>
                    {nuevoColmena.trim() && (
                      <> → volverá a colmena <strong>{nuevoColmena.trim()}</strong></>
                    )}
                  </p>
                )}
                {nuevoMedida &&
                  r.medida_cm != null &&
                  Number(nuevoMedida) > 0 &&
                  Number(nuevoMedida) < Number(r.medida_cm) && (
                    <p className="mt-1 text-[11px] text-destructive">
                      ⚠ El tubo nuevo es menor que la medida necesaria
                      ({Number(r.medida_cm).toFixed(1)} cm).
                    </p>
                  )}
              </div>

              <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-warning/30 bg-warning/15 p-3 hover:bg-warning/15">
                <input
                  type="checkbox"
                  checked={confirmoTuboFisico}
                  onChange={(e) => setConfirmoTuboFisico(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-amber-500"
                />
                <span className="text-[11px] leading-snug text-warning">
                  <strong>Confirmo que saqué físicamente un tubo virgen del stock</strong>
                  {nuevoCod && nuevoMedida && Number(nuevoMedida) > 0 && (
                    <>
                      {' '}— código <strong className="font-mono">{nuevoCod}</strong> de{' '}
                      <strong>{Number(nuevoMedida).toFixed(1)} cm</strong>
                      {nuevoColmena && (
                        <> y lo dejé en colmena <strong>{nuevoColmena}</strong></>
                      )}
                    </>
                  )}
                  . Si no marcás esto el sistema no registra el error.
                </span>
              </label>
            </div>
          )}
        </div>

        {reemplazo && (
          <div className="rounded-xl border border-warning/30 bg-warning/[0.08] p-3">
            <Label className="text-xs text-warning">¿Cuánto sobró del tubo de reemplazo? (cm)</Label>
            <p className="mt-1 mb-2 text-[11px] text-muted-foreground">
              Si sobró material, se guardará de vuelta en la colmena con la nueva medida. Si no
              quedó nada, dejar en 0.
            </p>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={sobrante}
              onChange={(e) => setSobrante(e.target.value)}
              placeholder="Ej: 45.5"
              className="border-border bg-secondary"
            />
          </div>
        )}

        <div className="rounded-xl border border-accent/25 bg-accent/[0.07] p-3">
          <Label className="text-xs text-accent">¿Qué pasó con el tubo original?</Label>
          <p className="mt-1 mb-2 text-[11px] text-muted-foreground">
            Colmena {String(colOrig)} · Código {codOrig} · Medida original {medOrigen}
          </p>
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => setDestinoYMed('merma')}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition',
                destino === 'merma'
                  ? 'border-destructive/30 bg-destructive/15 text-destructive'
                  : 'border-destructive/30 text-muted-foreground hover:border-destructive/30',
              )}
            >
              <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Merma — se descarta
            </button>
            <button
              onClick={() => setDestinoYMed('recuperar')}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition',
                destino === 'recuperar'
                  ? 'border-accent/50 bg-accent/15 text-accent'
                  : 'border-accent/30 text-muted-foreground hover:border-accent/50',
              )}
            >
              <Recycle className="mr-1 inline h-3.5 w-3.5" /> Volver a colmena
            </button>
          </div>
          {destino === 'recuperar' && (
            <div>
              <Label className="text-xs">Medida real del tubo (cm)</Label>
              <p className="mt-1 mb-1.5 text-[11px] text-muted-foreground">
                Ingresa la medida real del tubo tal como quedó después del corte erróneo. Se va a
                reingresar a la misma colmena con esa medida.
              </p>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={medRecuperar}
                onChange={(e) => setMedRecuperar(e.target.value)}
                placeholder="Ej: 125"
                className="border-border bg-secondary"
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
            className="border-border bg-secondary"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={saving} className="gap-1.5 bg-success hover:bg-success/90">
            <CheckCircle2 className="h-4 w-4" /> Guardar error
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
