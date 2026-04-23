// Plan de Corte desde Colmena — UI.
// Portado desde public/legacy/index.html (líneas 7088-7686, renderPlanCorte +
// confirmarUsoSobrante + confirmarCorteRollo + guardarSobrantesRollo + guardarNuevoSobrante).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, CheckCircle2, Loader2, Plus, Ruler, Scissors, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  generarPlanCorte,
  resumenPlan,
  rowToPano,
  type GrupoRollo,
  type GrupoSobrante,
  type Placed,
  type Plan,
} from '@/modules/cotizador/planCorte';
import type { ColmenaPano } from '@/modules/admin/colmena';
import type { OT } from '@/modules/ots/types';

const PC_PALETTE = [
  '#4080ff',
  '#20d164',
  '#f5a623',
  '#14d4c0',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#fb923c',
];

// Dibuja el layout de corte en un canvas 2D (idéntico a legacy dibujarCanvas).
function dibujarCanvas(
  canvas: HTMLCanvasElement,
  piezas: Placed[],
  uw: number,
  uh: number,
  wTotal: number,
  hTotal: number,
) {
  const SCALE = Math.min(420 / wTotal, 320 / hTotal, 1.2);
  const W = Math.round(wTotal * SCALE);
  const H = Math.round(hTotal * SCALE);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#1a2236';
  ctx.fillRect(0, 0, W, H);

  const mg = Math.round(1 * SCALE);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(mg, mg, Math.round(uw * SCALE), Math.round(uh * SCALE));

  piezas.forEach((r, i) => {
    const x = Math.round(mg + r.px * SCALE);
    const y = Math.round(mg + r.py * SCALE);
    const w = Math.round(r.pw * SCALE);
    const h = Math.round(r.ph * SCALE);
    const col = r.rot ? '#f97316' : PC_PALETTE[i % PC_PALETTE.length];
    ctx.fillStyle = col + '33';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.fillStyle = col;
    ctx.save();
    ctx.rect(x + 2, y + 2, w - 4, h - 4);
    ctx.clip();
    ctx.textAlign = 'center';
    const maxW = w - 4;
    const nombreBase = r.rot ? `↺ ${r.nombre}` : r.nombre;
    const dotIdx = nombreBase.indexOf('·');
    if (dotIdx !== -1 && h > 28) {
      const linea1 = nombreBase.slice(0, dotIdx).trim();
      const linea2 = nombreBase.slice(dotIdx + 1).trim();
      const fs = Math.max(7, Math.round(8 * SCALE));
      ctx.font = `bold ${fs}px monospace`;
      ctx.textBaseline = 'middle';
      ctx.fillText(linea1, x + w / 2, y + h / 2 - fs * 0.7, maxW);
      ctx.font = `${fs}px monospace`;
      ctx.fillText(linea2, x + w / 2, y + h / 2 + fs * 0.7, maxW);
    } else {
      ctx.font = `bold ${Math.max(8, Math.round(9 * SCALE))}px monospace`;
      ctx.textBaseline = 'middle';
      ctx.fillText(nombreBase, x + w / 2, y + h / 2, maxW);
    }
    ctx.restore();
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${wTotal}×${hTotal}cm`, 3, 3);
}

function eficClass(efic: number): string {
  if (efic >= 70) return 'text-emerald-400';
  if (efic >= 40) return 'text-amber-400';
  return 'text-red-400';
}

// ═════════════════════════════════════════════════════════════════════
// Card: usar sobrante de colmena
// ═════════════════════════════════════════════════════════════════════
function CardSobrante({
  grupo,
  otNum,
  onConfirmado,
}: {
  grupo: GrupoSobrante;
  otNum: string;
  onConfirmado: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState<'inicial' | 'inputs' | 'confirmado'>('inicial');
  const [ubicAlto, setUbicAlto] = useState('');
  const [ubicAncho, setUbicAncho] = useState('');
  const [saving, setSaving] = useState(false);

  const placed = grupo.placed.filter((r) => !r.failed);
  const MARGEN = 1;
  const MIN_CM = 30;
  const maxY = placed.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
  const altoResto = Math.round(grupo.sobrante.alto - (maxY + MARGEN * 2));
  const hayAlto = altoResto >= MIN_CM;
  const sobAncho = grupo.sobranteAncho;

  const efic = Math.round(
    (placed.reduce((s, r) => s + r.pw * r.ph, 0) / (grupo.uw * grupo.uh)) * 100,
  );

  useEffect(() => {
    if (canvasRef.current) {
      dibujarCanvas(
        canvasRef.current,
        placed,
        grupo.uw,
        grupo.uh,
        grupo.sobrante.ancho,
        grupo.sobrante.alto,
      );
    }
  }, [grupo, placed]);

  const iniciar = async () => {
    if (!hayAlto && !sobAncho) {
      // Sin sobrantes útiles → marcar usado directo
      await marcarUsado();
      return;
    }
    setStep('inputs');
  };

  const marcarUsado = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('colmena_panos')
        .update({
          disponible: false,
          ot_asignada: otNum,
          fecha_uso: new Date().toISOString(),
        })
        .eq('id', grupo.sobrante._docId);
      if (error) throw error;
      toast.success(
        `Sobrante marcado como usado${altoResto > 0 ? ` (${altoResto}cm restantes, no útil)` : ''}`,
      );
      setStep('confirmado');
      onConfirmado();
    } catch (e) {
      toast.error('Error al actualizar la Colmena: ' + (e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  const confirmar = async () => {
    if (hayAlto && !ubicAlto.trim()) {
      toast.error('Ingresá la ubicación del sobrante de alto');
      return;
    }
    if (sobAncho && !ubicAncho.trim()) {
      toast.error('Ingresá la ubicación de la franja de ancho');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('colmena_panos')
        .update({ disponible: false, ot_asignada: otNum, fecha_uso: now })
        .eq('id', grupo.sobrante._docId);
      if (updErr) throw updErr;

      const inserts: Array<Record<string, unknown>> = [];
      const { empresaId } = authRef;
      const msgs: string[] = [];

      if (hayAlto) {
        inserts.push({
          empresa_id: empresaId,
          codigo: grupo.sobrante.cod,
          medida_ancho: grupo.sobrante.ancho,
          medida_alto: altoResto,
          ubicacion: ubicAlto.trim().toUpperCase(),
          tipo: 'SOBRANTE',
          disponible: true,
          ot_asignada: null,
          datos_extra: { fuente: 'GALPON_ROLZZO', ot_origen: otNum, creadoEn: now },
        });
        msgs.push(`alto ${grupo.sobrante.ancho}×${altoResto}cm → ${ubicAlto.trim().toUpperCase()}`);
      }

      if (sobAncho) {
        inserts.push({
          empresa_id: empresaId,
          codigo: sobAncho.cod,
          medida_ancho: sobAncho.ancho,
          medida_alto: sobAncho.alto,
          ubicacion: ubicAncho.trim().toUpperCase(),
          tipo: 'SOBRANTE',
          disponible: true,
          ot_asignada: null,
          datos_extra: { fuente: 'GALPON_ROLZZO', ot_origen: otNum, creadoEn: now },
        });
        msgs.push(
          `ancho ${sobAncho.ancho}×${sobAncho.alto}cm → ${ubicAncho.trim().toUpperCase()}`,
        );
      }

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from('colmena_panos').insert(inserts);
        if (insErr) throw insErr;
      }

      toast.success(`Confirmado. Sobrantes guardados: ${msgs.join(' | ') || 'ninguno'}`);
      setStep('confirmado');
      onConfirmado();
    } catch (e) {
      toast.error('Error al actualizar la Colmena: ' + (e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  // HACK: needs empresaId but can't use hook in child scope cleanly. Use ref trick.
  const { empresaId } = useAuth();
  const authRef = { empresaId };

  const faded = step === 'confirmado' ? 'pointer-events-none opacity-40' : '';

  return (
    <div
      className={`mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 ${faded}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="font-mono">{grupo.sobrante.cod}</span>
            {grupo.regla === 1 ? (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] text-emerald-400">
                ✓ Regla 1 — exacto
              </span>
            ) : (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[0.65rem] text-amber-400">
                ≈ Regla 2 — ajuste (±10cm)
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            {grupo.sobrante.ancho} × {grupo.sobrante.alto} cm
            {grupo.sobranteAncho && (
              <div className="mt-1 text-[0.7rem] text-emerald-300">
                <Scissors className="mr-1 inline h-3 w-3" />
                Franja sobrante: <strong>{grupo.sobranteAncho.ancho}×
                {grupo.sobranteAncho.alto}cm</strong> — se registra al confirmar
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.68rem] text-zinc-500">
            📍 {grupo.sobrante.ubicacion || '—'}
          </span>
          <span className={`text-[0.7rem] font-semibold ${eficClass(efic)}`}>
            {efic}% uso
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {placed.map((r, i) => (
          <span
            key={i}
            className="rounded border px-1.5 py-0.5 text-[0.65rem] font-mono"
            style={{
              borderColor: PC_PALETTE[i % PC_PALETTE.length] + '55',
              color: PC_PALETTE[i % PC_PALETTE.length],
            }}
          >
            {r.nombre} — {r.pw}×{r.ph}cm
          </span>
        ))}
      </div>

      <div className="my-2 flex justify-center">
        <canvas ref={canvasRef} className="rounded border border-white/10" />
      </div>

      {step === 'inicial' && (
        <Button
          size="sm"
          onClick={iniciar}
          disabled={saving}
          className="gap-1 bg-emerald-600 hover:bg-emerald-500"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          Confirmar uso de este sobrante
        </Button>
      )}

      {step === 'inputs' && (
        <div className="space-y-2 border-t border-emerald-500/20 pt-2">
          {hayAlto && (
            <div>
              <Label className="text-[0.7rem] text-emerald-300">
                ⬇ Sobrante alto: {grupo.sobrante.cod} {grupo.sobrante.ancho}×{altoResto}cm
              </Label>
              <Input
                value={ubicAlto}
                onChange={(e) => setUbicAlto(e.target.value.toUpperCase())}
                placeholder="A-54"
                className="mt-1 h-7 max-w-[160px] text-xs"
              />
            </div>
          )}
          {sobAncho && (
            <div>
              <Label className="text-[0.7rem] text-emerald-300">
                ✂ Franja ancho: {sobAncho.cod} {sobAncho.ancho}×{sobAncho.alto}cm
              </Label>
              <Input
                value={ubicAncho}
                onChange={(e) => setUbicAncho(e.target.value.toUpperCase())}
                placeholder="B-12"
                className="mt-1 h-7 max-w-[160px] text-xs"
              />
            </div>
          )}
          <Button
            size="sm"
            onClick={confirmar}
            disabled={saving}
            className="gap-1 bg-emerald-600 hover:bg-emerald-500"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Confirmar y guardar sobrantes
          </Button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Card: cortar desde rollo
// ═════════════════════════════════════════════════════════════════════
function CardRollo({
  grupo: grupoInicial,
  otNum,
  onConfirmado,
}: {
  grupo: GrupoRollo;
  otNum: string;
  onConfirmado: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { empresaId } = useAuth();
  // Copia local para poder mutar cuando se rechaza una rotación y se cae a vertical
  const [grupo, setGrupo] = useState<GrupoRollo>(grupoInicial);
  const [step, setStep] = useState<'inicial' | 'rotacion-pendiente' | 'inputs' | 'confirmado'>(
    grupoInicial.tieneRotaciones ? 'rotacion-pendiente' : 'inicial',
  );
  const [decisiones, setDecisiones] = useState<Record<string, boolean>>({});
  const [ubicRollo, setUbicRollo] = useState('');
  const [ubicSI, setUbicSI] = useState('');
  const [saving, setSaving] = useState(false);

  const placed = grupo.placed.filter((r) => !r.failed);
  const MARGEN = 1;
  const MIN_CM = 30;

  useEffect(() => {
    if (canvasRef.current) {
      dibujarCanvas(
        canvasRef.current,
        placed,
        grupo.anchoUtil,
        grupo.altoUtil,
        grupo.anchoCorte,
        grupo.altoCorte,
      );
    }
  }, [grupo, placed]);

  const maxY = placed.reduce((m, r) => Math.max(m, r.py + r.ph), 0);
  const altoResto = Math.round(grupo.altoCorte - (maxY + MARGEN * 2));
  const hayResto = altoResto >= MIN_CM;
  const si = grupo.sobInterno;

  const decidirRotacion = (piezaId: string, autoriza: boolean) => {
    const next = { ...decisiones, [piezaId]: autoriza };
    setDecisiones(next);
    const todasDecididas = grupo.piezasRotadas.every((r) => next[r.id] !== undefined);
    if (!todasDecididas) return;
    const algunRechazado = grupo.piezasRotadas.some((r) => !next[r.id]);
    if (algunRechazado) {
      // Aplicar Estrategia B: layout vertical (sin rotaciones)
      if (!grupo.layoutVertical || grupo.layoutVertical.some((r) => r.failed)) {
        toast.error('No es posible cortar sin inversión en este rollo');
        return;
      }
      const altoCorteVertical = grupo.altoVertical ?? grupo.altoCorte;
      setGrupo({
        ...grupo,
        placed: grupo.layoutVertical,
        altoCorte: altoCorteVertical,
        altoUtil: altoCorteVertical - MARGEN * 2,
        efic: grupo.eficVertical,
        sobInterno: grupo.sobInternoV,
        tieneRotaciones: false,
      });
      toast.success('Layout ajustado sin inversión — corte más largo pero sin girar tela');
      setStep('inicial');
    } else {
      setStep('inicial');
    }
  };

  const iniciarConfirmar = () => {
    if (!hayResto && !si) {
      guardarSinSobrantes();
      return;
    }
    setStep('inputs');
  };

  const guardarSinSobrantes = async () => {
    toast.success(`Corte de ${grupo.codInt} confirmado. Sin sobrantes útiles.`);
    setStep('confirmado');
    onConfirmado();
  };

  const guardarSobrantes = async () => {
    if (hayResto && !ubicRollo.trim()) {
      toast.error('Ingresá la ubicación del rollo restante');
      return;
    }
    if (si && !ubicSI.trim()) {
      toast.error('Ingresá la ubicación de la franja interna');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const inserts: Array<Record<string, unknown>> = [];
      const msgs: string[] = [];

      if (hayResto) {
        inserts.push({
          empresa_id: empresaId,
          codigo: grupo.codInt,
          medida_ancho: grupo.anchoCorte,
          medida_alto: altoResto,
          ubicacion: ubicRollo.trim().toUpperCase(),
          tipo: 'SOBRANTE',
          disponible: true,
          ot_asignada: null,
          datos_extra: { fuente: 'GALPON_ROLZZO', ot_origen: otNum, creadoEn: now },
        });
        msgs.push(`rollo ${grupo.anchoCorte}×${altoResto}cm`);
      }
      if (si) {
        inserts.push({
          empresa_id: empresaId,
          codigo: grupo.codInt,
          medida_ancho: si.ancho,
          medida_alto: si.alto,
          ubicacion: ubicSI.trim().toUpperCase(),
          tipo: 'SOBRANTE',
          disponible: true,
          ot_asignada: null,
          datos_extra: { fuente: 'GALPON_ROLZZO', ot_origen: otNum, creadoEn: now },
        });
        msgs.push(`franja ${si.ancho}×${si.alto}cm`);
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('colmena_panos').insert(inserts);
        if (error) throw error;
      }

      toast.success(`${grupo.codInt}: ${msgs.join(' + ')} guardados en Colmena`);
      setStep('confirmado');
      onConfirmado();
    } catch (e) {
      toast.error('Error al guardar sobrantes: ' + (e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  const faded = step === 'confirmado' ? 'pointer-events-none opacity-40' : '';

  return (
    <div className={`mb-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 ${faded}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold font-mono">{grupo.codInt}</div>
          <div className="mt-1 text-xs text-zinc-300">
            Paño a cortar:{' '}
            <strong>
              {grupo.anchoCorte} × {grupo.altoCorte} cm
            </strong>{' '}
            del rollo
            {si && (
              <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] text-emerald-300">
                <Scissors className="mr-1 inline h-3 w-3" />
                Franja interna: {si.ancho}×{si.alto}cm → Colmena
              </span>
            )}
          </div>
        </div>
        <span className={`text-[0.7rem] font-semibold ${eficClass(grupo.efic)}`}>
          {grupo.efic}% uso
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {placed.map((r, i) => (
          <span
            key={i}
            className="rounded border px-1.5 py-0.5 text-[0.65rem] font-mono"
            style={{
              borderColor: r.rot ? '#f9731655' : PC_PALETTE[i % PC_PALETTE.length] + '55',
              color: r.rot ? '#f97316' : PC_PALETTE[i % PC_PALETTE.length],
            }}
          >
            {r.rot && '↺ '}
            {r.nombre} — {r.pw}×{r.ph}cm
          </span>
        ))}
      </div>

      <div className="my-2 flex justify-center">
        <canvas ref={canvasRef} className="rounded border border-white/10" />
      </div>

      {step === 'rotacion-pendiente' && (
        <div className="mb-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2">
          <div className="mb-1 text-xs font-semibold text-orange-400">
            <TriangleAlert className="mr-1 inline h-3 w-3" />
            Inversión obligatoria — las piezas superan el ancho del rollo
          </div>
          <div className="mb-2 text-[0.7rem] text-orange-200/80">
            No es posible cortar sin invertir la tela. Consultá al cliente antes de confirmar.
            Si rechaza, se recalcula el layout sin inversión (más tela pero sin girar).
          </div>
          {grupo.piezasRotadas.map((r) => {
            const decision = decisiones[r.id];
            return (
              <div key={r.id} className="mb-1 flex flex-wrap items-center gap-2">
                <span className="min-w-[150px] text-[0.7rem] text-orange-200">
                  ↺ {r.nombre} — {r.pw}×{r.ph}cm
                </span>
                <button
                  onClick={() => decidirRotacion(r.id, true)}
                  className={`rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[0.68rem] text-emerald-400 ${
                    decision === true ? '' : 'opacity-40'
                  }`}
                >
                  ✓ Autoriza
                </button>
                <button
                  onClick={() => decidirRotacion(r.id, false)}
                  className={`rounded border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[0.68rem] text-red-400 ${
                    decision === false ? '' : 'opacity-40'
                  }`}
                >
                  ✗ Rechaza
                </button>
              </div>
            );
          })}
          <div className="text-[0.68rem] text-zinc-400">
            ⏳ Esperando decisión sobre la inversión…
          </div>
        </div>
      )}

      {step === 'inicial' && (
        <Button
          size="sm"
          onClick={iniciarConfirmar}
          disabled={saving}
          className="gap-1 bg-blue-600 hover:bg-blue-500"
        >
          <CheckCircle2 className="h-3 w-3" />
          Confirmar corte realizado
        </Button>
      )}

      {step === 'inputs' && (
        <div className="space-y-2 border-t border-blue-500/20 pt-2">
          {hayResto && (
            <div>
              <Label className="text-[0.7rem] text-emerald-300">
                ⬇ Rollo restante: {grupo.codInt} {grupo.anchoCorte}×{altoResto}cm
              </Label>
              <Input
                value={ubicRollo}
                onChange={(e) => setUbicRollo(e.target.value.toUpperCase())}
                placeholder="A-54"
                className="mt-1 h-7 max-w-[160px] text-xs"
              />
            </div>
          )}
          {si && (
            <div>
              <Label className="text-[0.7rem] text-emerald-300">
                ✂ Franja interna: {grupo.codInt} {si.ancho}×{si.alto}cm
              </Label>
              <Input
                value={ubicSI}
                onChange={(e) => setUbicSI(e.target.value.toUpperCase())}
                placeholder="B-12"
                className="mt-1 h-7 max-w-[160px] text-xs"
              />
            </div>
          )}
          <Button
            size="sm"
            onClick={guardarSobrantes}
            disabled={saving}
            className="gap-1 bg-emerald-600 hover:bg-emerald-500"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Confirmar y guardar sobrantes
          </Button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Formulario: registrar sobrante manualmente
// ═════════════════════════════════════════════════════════════════════
function FormSobranteManual({ otNum }: { otNum: string }) {
  const { empresaId } = useAuth();
  const [cod, setCod] = useState('');
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');
  const [ubic, setUbic] = useState('');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    const c = cod.trim().toUpperCase();
    const a = parseFloat(ancho);
    const al = parseFloat(alto);
    const u = ubic.trim().toUpperCase();
    if (!c) return toast.error('Ingresá el COD_INT');
    if (!a || !al) return toast.error('Ingresá las medidas');
    if (!u) return toast.error('Ingresá la ubicación (ej: A-54)');
    setSaving(true);
    try {
      const { error } = await supabase.from('colmena_panos').insert({
        empresa_id: empresaId,
        codigo: c,
        medida_ancho: a,
        medida_alto: al,
        ubicacion: u,
        tipo: 'SOBRANTE',
        disponible: true,
        ot_asignada: null,
        datos_extra: {
          fuente: 'GALPON_ROLZZO',
          ot_origen: otNum,
          creadoEn: new Date().toISOString(),
        },
      });
      if (error) throw error;
      toast.success(`Sobrante ${c} ${a}×${al}cm guardado en la Colmena`);
      setCod('');
      setAncho('');
      setAlto('');
      setUbic('');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-zinc-900/40 p-3">
      <div className="mb-2 text-xs font-semibold text-zinc-300">
        <Plus className="mr-1 inline h-3 w-3" />
        Registrar sobrante manualmente (opcional)
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div>
          <Label className="text-[0.65rem] text-zinc-400">COD_INT</Label>
          <Input
            value={cod}
            onChange={(e) => setCod(e.target.value.toUpperCase())}
            placeholder="BK 18"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[0.65rem] text-zinc-400">Ancho (cm)</Label>
          <Input
            type="number"
            value={ancho}
            onChange={(e) => setAncho(e.target.value)}
            placeholder="150"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[0.65rem] text-zinc-400">Alto (cm)</Label>
          <Input
            type="number"
            value={alto}
            onChange={(e) => setAlto(e.target.value)}
            placeholder="200"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[0.65rem] text-zinc-400">Ubicación</Label>
          <Input
            value={ubic}
            onChange={(e) => setUbic(e.target.value.toUpperCase())}
            placeholder="A-54"
            className="h-7 text-xs"
          />
        </div>
        <div className="flex items-end">
          <Button
            size="sm"
            onClick={guardar}
            disabled={saving}
            className="h-7 w-full gap-1 bg-emerald-600 hover:bg-emerald-500"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Componente principal
// ═════════════════════════════════════════════════════════════════════
export function PlanCorteSection({ ot }: { ot: OT }) {
  const { empresaId } = useAuth();
  const [colmenaPanos, setColmenaPanos] = useState<ColmenaPano[] | null>(null);
  const [ots, setOts] = useState<OT[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generado, setGenerado] = useState(false);

  const cargar = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      // Colmena paños disponibles
      const { data: panosData, error: panosErr } = await supabase
        .from('colmena_panos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('disponible', true);
      if (panosErr) throw panosErr;
      setColmenaPanos((panosData || []) as ColmenaPano[]);

      // OTs en producción (incluye la actual como fallback)
      const { data: otsData, error: otsErr } = await supabase
        .from('ots')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('estado', 'produccion');
      if (otsErr) throw otsErr;

      const otsProd = ((otsData as Array<{ id: string; items: unknown; datos_generales: unknown }>) || [])
        .map(
          (row) =>
            ({
              id: row.id,
              storeVentanas: (row.items || []) as OT['storeVentanas'],
              datosGenerales: (row.datos_generales || {}) as OT['datosGenerales'],
            }) as OT,
        )
        .filter((o) => (o.storeVentanas || []).length > 0);

      // Si la OT actual no está en producción (fallback), incluirla igual
      const yaIncluida = otsProd.some((o) => String(o.id) === String(ot.id));
      const listaOTs = otsProd.length > 0 ? otsProd : yaIncluida ? otsProd : [ot];
      setOts(listaOTs);
      setGenerado(true);
    } catch (e) {
      toast.error('Error cargando datos: ' + (e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  };

  const plan: Plan | null = useMemo(() => {
    if (!colmenaPanos || !ots) return null;
    const panos = colmenaPanos.map(rowToPano);
    return generarPlanCorte(ots, panos);
  }, [colmenaPanos, ots]);

  const resumen = plan ? resumenPlan(plan) : null;
  const otNum = ot.datosGenerales.ot || String(ot.id);

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-blue-300" />
          <strong className="text-sm">Plan de Corte desde Colmena</strong>
          {resumen && (
            <span className="text-[0.68rem] text-zinc-400">
              · {resumen.desdeSobrante} desde sobrante · {resumen.desdeRollo} desde rollo
              {resumen.sinStock > 0 && (
                <span className="text-red-400"> · {resumen.sinStock} sin stock</span>
              )}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={cargar}
          disabled={loading}
          className="h-7 gap-1 bg-blue-600 text-[0.7rem] hover:bg-blue-500"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ruler className="h-3 w-3" />}
          {generado ? 'Regenerar' : 'Generar plan'}
        </Button>
      </div>

      {!generado && !loading && (
        <div className="p-6 text-center text-xs text-zinc-500">
          Matchea los paños de esta OT (y otras en producción) contra los sobrantes disponibles en
          colmena y arma el plan de corte optimizado.
        </div>
      )}

      {loading && (
        <div className="p-6 text-center text-xs text-zinc-500">Cargando colmena y OTs…</div>
      )}

      {plan && (
        <div className="p-3">
          {plan.otsIncluidas.length > 1 && (
            <div className="mb-2 rounded-lg border border-blue-400/25 bg-blue-400/8 px-3 py-2 text-[0.72rem] text-blue-300">
              <strong>Plan combinado · {plan.otsIncluidas.length} OTs en producción:</strong>
              {plan.otsIncluidas.map((o) => (
                <span
                  key={o.id}
                  className="ml-2 rounded-full bg-blue-400/15 px-2 py-0.5 text-[0.68rem]"
                >
                  OT{o.num} — {o.cliente}
                </span>
              ))}
            </div>
          )}

          {plan.sobrantes.length > 0 && (
            <>
              <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <Archive className="h-3 w-3" />
                Usar sobrantes de la Colmena
              </div>
              {plan.sobrantes.map((g, gi) => (
                <CardSobrante key={gi} grupo={g} otNum={otNum} onConfirmado={cargar} />
              ))}
            </>
          )}

          {plan.rollo.length > 0 && (
            <>
              <div className="mb-2 mt-3 flex items-center gap-1 text-xs font-semibold text-blue-400">
                <Ruler className="h-3 w-3" />
                Cortar desde rollo nuevo
              </div>
              {plan.rollo.map((g, gi) => (
                <CardRollo key={gi} grupo={g} otNum={otNum} onConfirmado={cargar} />
              ))}
            </>
          )}

          {plan.sinStock.length > 0 && (
            <>
              <div className="mb-2 mt-3 flex items-center gap-1 text-xs font-semibold text-red-400">
                <TriangleAlert className="h-3 w-3" />
                Sin sobrantes disponibles (verificar stock de rollo)
              </div>
              {plan.sinStock.map((g, gi) => (
                <div
                  key={gi}
                  className="mb-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3"
                >
                  <div className="text-sm font-semibold text-red-400 font-mono">
                    {g.codInt}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    No hay sobrantes disponibles. Verificar stock de rollos.
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {g.piezas.map((p, i) => (
                      <span
                        key={i}
                        className="rounded border border-white/10 px-1.5 py-0.5 text-[0.65rem] font-mono"
                      >
                        {p.nombre} — {p.w}×{p.h}cm
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          <FormSobranteManual otNum={otNum} />
        </div>
      )}
    </div>
  );
}
