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
  secuenciaCortes,
  type GrupoRollo,
  type GrupoSobrante,
  type PanoColmena,
  type Placed,
  type Plan,
} from '@/modules/cotizador/planCorte';
import { cargarColmenaPanos } from '@/modules/cotizador/colmenaPanosStore';
import { metrosPrimerCorte, type OrigenCorte } from '@/modules/produccion/salidasCorte';
import { useDecisionesGiro } from '@/modules/produccion/girosColmena';
import ConfirmarCorteDialog from '@/pages/produccion/dialogs/ConfirmarCorteDialog';
import { otsDelPlan, resolverOtsDelPlan, type FilaOTPlan } from '@/modules/cotizador/planScope';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { useFormulasFamilias } from '@/modules/descuentos/formulasStore';
import { useReglasSeleccion } from '@/modules/descuentos/reglasSeleccionStore';
import type { OT } from '@/modules/ots/types';
import type { Database } from '@/types/database';

type ColmenaPanoInsert = Database['public']['Tables']['colmena_panos']['Insert'];

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
  if (efic >= 70) return 'text-success';
  if (efic >= 40) return 'text-warning';
  return 'text-destructive';
}

/**
 * Identidad de una tarjeta del plan: de qué paño/tela sale y qué piezas lleva.
 *
 * Con `key={índice}` React reusaba la MISMA tarjeta cuando el plan se
 * regeneraba con la misma cantidad de grupos, y `CardRollo` —que guarda su
 * layout en estado interno, inicializado una sola vez— seguía mostrando (y
 * cerrando) el corte anterior. Con la clave por contenido, un grupo distinto es
 * una tarjeta distinta y el estado no se hereda.
 */
function claveGrupo(raiz: string, placed: Placed[]): string {
  return `${raiz}:${placed.map((p) => p.id).join(',')}`;
}

// ═════════════════════════════════════════════════════════════════════
// Card: usar sobrante de colmena
// ═════════════════════════════════════════════════════════════════════
function CardSobrante({
  grupo,
  decisiones,
  onDecidir,
}: {
  grupo: GrupoSobrante;
  /**
   * Giros ya decididos por el operario (pieceId → autoriza). Viven en el PADRE:
   * rechazar uno regenera el plan, y con él estas tarjetas.
   */
  decisiones?: Record<string, boolean>;
  onDecidir?: (piezaId: string, autoriza: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Igual que en el rollo: una cortina acostada se corta solo con el visto
  // bueno del operario (la tela puede tener dirección o dibujo).
  const pendientes = onDecidir
    ? grupo.piezasRotadas.filter((r) => decisiones?.[r.id] === undefined)
    : [];

  const placed = grupo.placed.filter((r) => !r.failed);
  // Lo que deja el corte del paño: los trozos que vuelven al rack y los que se
  // pierden. Es la MISMA lista que registra el cierre del corte.
  const vuelven = grupo.libres.filter((r) => r.clase === 'sobrante');
  const perdidos = grupo.libres.filter((r) => r.clase === 'merma');
  const mermaCm2 = perdidos.reduce((s, r) => s + r.anchoCm * r.altoCm, 0);

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

  return (
    <div className="mb-3 rounded-lg border border-success/30 bg-success/15 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="font-mono">{grupo.sobrante.cod}</span>
            {grupo.regla === 1 ? (
              <span className="rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[0.65rem] text-success">
                ✓ Paño entero — no sobra nada
              </span>
            ) : (
              <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[0.65rem] text-warning">
                ≈ Se corta y sobra {(mermaCm2 / 10000).toFixed(2).replace('.', ',')} m² de merma
              </span>
            )}
            {grupo.tieneRotaciones && (
              <span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[0.65rem] text-accent">
                ↻ {grupo.piezasRotadas.length} girada(s)
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {grupo.sobrante.ancho} × {grupo.sobrante.alto} cm
            {vuelven.length > 0 && (
              <div className="mt-1 text-[0.7rem] text-success">
                <Scissors className="mr-1 inline h-3 w-3" />
                Vuelve al rack:{' '}
                <strong>{vuelven.map((r) => `${r.anchoCm}×${r.altoCm}cm`).join(' · ')}</strong>
              </div>
            )}
            {perdidos.length > 0 && (
              <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                Merma: {perdidos.map((r) => `${r.anchoCm}×${r.altoCm}cm`).join(' · ')}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.68rem] text-muted-foreground">
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
        <canvas ref={canvasRef} className="rounded border border-border" />
      </div>

      {pendientes.length > 0 && (
        <div className="mb-2 rounded-lg border border-orange-500/30 bg-warning/15 p-2">
          <div className="mb-1 text-xs font-semibold text-warning">
            <TriangleAlert className="mr-1 inline h-3 w-3" />
            Cortina acostada — así entra en este paño
          </div>
          <div className="mb-2 text-[0.7rem] text-warning/80">
            Derecha no cabe en el paño. Si la tela tiene dibujo o dirección, rechaza el giro: la
            cortina se recalcula en otro paño o baja del rollo.
          </div>
          {grupo.piezasRotadas.map((r) => {
            const decision = decisiones?.[r.id];
            return (
              <div key={r.id} className="mb-1 flex flex-wrap items-center gap-2">
                <span className="min-w-[150px] text-[0.7rem] text-warning">
                  ↺ {r.nombre} — {r.pw}×{r.ph}cm
                </span>
                <button
                  onClick={() => onDecidir?.(r.id, true)}
                  className={`rounded-md px-3 py-1 text-[0.72rem] font-bold transition-all ${
                    decision === true
                      ? 'bg-success text-success-foreground ring-2 ring-success/60 shadow'
                      : 'bg-success text-success-foreground shadow hover:brightness-110'
                  }`}
                >
                  ✓ Autoriza
                </button>
                <button
                  onClick={() => onDecidir?.(r.id, false)}
                  className="rounded-md bg-destructive px-3 py-1 text-[0.72rem] font-bold text-destructive-foreground shadow transition-all hover:brightness-110"
                >
                  ✗ Rechaza
                </button>
              </div>
            );
          })}
          <div className="text-[0.68rem] text-muted-foreground">
            ⏳ Esperando decisión sobre el giro…
          </div>
        </div>
      )}

      {/* El mismo detalle que la tarjeta de rollo: la mesa corta el paño igual. */}
      {grupo.cortes && grupo.cortes.length > 0 && (
        <div className="mb-2 rounded-md border border-border bg-muted/30 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[0.7rem] font-semibold">
            <Scissors className="h-3 w-3" />
            Cortes en orden
          </div>
          <ol className="space-y-0.5 text-[0.68rem] text-muted-foreground">
            {grupo.cortes.map((c) => (
              <li key={c.n}>
                <span className="font-mono font-semibold text-foreground">{c.n}.</span>{' '}
                {c.girar && <span className="font-semibold text-warning">↻ girar el paño — </span>}
                corte {c.eje} a <strong className="text-foreground">{c.posicionCm} cm</strong> →{' '}
                {c.deja[0]} | {c.deja[1]}
              </li>
            ))}
          </ol>
        </div>
      )}
      {grupo.cortes === null && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 p-2 text-[0.68rem] text-warning">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          Este acomodo no se puede cortar de punta a punta. Solo sale así con la cortadora
          automática configurada en Parámetros de corte.
        </div>
      )}

      <div className="mt-1 border-t border-success/30 pt-2 text-[0.68rem] text-muted-foreground">
        Al cerrar el corte, este paño sale del rack
        {vuelven.length > 0
          ? ` y lo que queda vuelve como ${vuelven.length} paño(s) nuevo(s), con etiqueta y ubicación.`
          : ' entero.'}
      </div>
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
  conConfirmacionLocal = true,
  onLayout,
}: {
  grupo: GrupoRollo;
  otNum: string;
  onConfirmado: () => void;
  /**
   * El flujo clásico cierra el corte rollo por rollo, acá mismo. El módulo
   * Producción lo cierra de una sola vez para todo el plan (un lote corta
   * varias telas en la misma sesión), así que esconde estos botones.
   */
  conConfirmacionLocal?: boolean;
  /**
   * Avisa con qué layout quedó la tarjeta. Rechazar una inversión cambia el
   * alto del paño y, con él, lo que sobra: quien cierre el corte tiene que
   * registrar lo que está EN PANTALLA, no lo que propuso el motor.
   */
  onLayout?: (g: GrupoRollo) => void;
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

  // Sube el layout vigente (el inicial y el que quede tras decidir inversiones).
  useEffect(() => {
    onLayout?.(grupo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo]);

  // El orden de los cortes se saca del layout que está EN PANTALLA: si se
  // rechaza una inversión y se cae al layout vertical, la secuencia lo sigue.
  const cortes = useMemo(
    () => secuenciaCortes(placed, grupo.anchoUtil, grupo.altoUtil),
    [placed, grupo.anchoUtil, grupo.altoUtil],
  );

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
      toast.error('Ingresa la ubicación del rollo restante');
      return;
    }
    if (si && !ubicSI.trim()) {
      toast.error('Ingresa la ubicación de la franja interna');
      return;
    }
    setSaving(true);
    try {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const now = new Date().toISOString();
      const inserts: ColmenaPanoInsert[] = [];
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
    <div className={`mb-3 rounded-lg border border-blue-500/20 bg-accent/5 p-3 ${faded}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold font-mono">{grupo.codInt}</div>
          {/* Lo primero que hace el cortador es bajar el paño: el largo va
              adelante y en metros, que es como se mide el rollo. */}
          {!conConfirmacionLocal && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[0.72rem] font-semibold text-accent">
              <Scissors className="h-3 w-3" />
              PRIMER CORTE: bajar {metrosPrimerCorte(grupo.altoCorte)}
            </div>
          )}
          <div className="mt-1 text-xs text-foreground">
            Paño a cortar:{' '}
            <strong>
              {grupo.anchoCorte} × {grupo.altoCorte} cm
            </strong>{' '}
            del rollo
            {si && (
              <span className="ml-2 rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[0.65rem] text-success">
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
        <canvas ref={canvasRef} className="rounded border border-border" />
      </div>

      {/* El orden en que la mesa parte el paño. Cada corte cruza la tela de
          punta a punta y el cambio de sentido significa girar el paño. */}
      {cortes && cortes.length > 0 && (
        <div className="mb-2 rounded-md border border-border bg-muted/30 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[0.7rem] font-semibold">
            <Scissors className="h-3 w-3" />
            Cortes en orden
          </div>
          <ol className="space-y-0.5 text-[0.68rem] text-muted-foreground">
            {cortes.map((c) => (
              <li key={c.n}>
                <span className="font-mono font-semibold text-foreground">{c.n}.</span>{' '}
                {c.girar && <span className="font-semibold text-warning">↻ girar el paño — </span>}
                corte {c.eje} a <strong className="text-foreground">{c.posicionCm} cm</strong> →{' '}
                {c.deja[0]} | {c.deja[1]}
              </li>
            ))}
          </ol>
        </div>
      )}
      {cortes === null && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 p-2 text-[0.68rem] text-warning">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          Este acomodo no se puede cortar de punta a punta: hay piezas que ninguna cuchilla separa
          de una pasada. Solo sale así con la cortadora automática configurada en Parámetros de
          corte.
        </div>
      )}

      {step === 'rotacion-pendiente' && (
        <div className="mb-2 rounded-lg border border-orange-500/30 bg-warning/15 p-2">
          <div className="mb-1 text-xs font-semibold text-warning">
            <TriangleAlert className="mr-1 inline h-3 w-3" />
            Inversión obligatoria — las piezas superan el ancho del rollo
          </div>
          <div className="mb-2 text-[0.7rem] text-warning/80">
            No es posible cortar sin invertir la tela. Consultá al cliente antes de confirmar.
            Si rechaza, se recalcula el layout sin inversión (más tela pero sin girar).
          </div>
          {grupo.piezasRotadas.map((r) => {
            const decision = decisiones[r.id];
            return (
              <div key={r.id} className="mb-1 flex flex-wrap items-center gap-2">
                <span className="min-w-[150px] text-[0.7rem] text-warning">
                  ↺ {r.nombre} — {r.pw}×{r.ph}cm
                </span>
                <button
                  onClick={() => decidirRotacion(r.id, true)}
                  className={`rounded-md px-3 py-1 text-[0.72rem] font-bold transition-all ${
                    decision === true
                      ? 'bg-success text-success-foreground ring-2 ring-success/60 shadow'
                      : decision === false
                        ? 'border border-success/40 bg-success/10 text-success opacity-50 hover:opacity-100'
                        : 'bg-success text-success-foreground shadow hover:brightness-110'
                  }`}
                >
                  ✓ Autoriza
                </button>
                <button
                  onClick={() => decidirRotacion(r.id, false)}
                  className={`rounded-md px-3 py-1 text-[0.72rem] font-bold transition-all ${
                    decision === false
                      ? 'bg-destructive text-destructive-foreground ring-2 ring-destructive/60 shadow'
                      : decision === true
                        ? 'border border-destructive/40 bg-destructive/10 text-destructive opacity-50 hover:opacity-100'
                        : 'bg-destructive text-destructive-foreground shadow hover:brightness-110'
                  }`}
                >
                  ✗ Rechaza
                </button>
              </div>
            );
          })}
          <div className="text-[0.68rem] text-muted-foreground">
            ⏳ Esperando decisión sobre la inversión…
          </div>
        </div>
      )}

      {step === 'inicial' && conConfirmacionLocal && (
        <Button
          size="sm"
          onClick={iniciarConfirmar}
          disabled={saving}
          className="gap-1 bg-accent hover:bg-accent"
        >
          <CheckCircle2 className="h-3 w-3" />
          Confirmar corte realizado
        </Button>
      )}

      {step === 'inputs' && conConfirmacionLocal && (
        <div className="space-y-2 border-t border-blue-500/20 pt-2">
          {hayResto && (
            <div>
              <Label className="text-[0.7rem] text-success">
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
              <Label className="text-[0.7rem] text-success">
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
            className="gap-1 bg-success hover:bg-success/90"
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
    if (!c) return toast.error('Ingresa el COD_INT');
    if (!a || !al) return toast.error('Ingresa las medidas');
    if (!u) return toast.error('Ingresa la ubicación (ej: A-54)');
    if (!empresaId) return toast.error('Empresa no resuelta');
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
    <div className="mt-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 text-xs font-semibold text-foreground">
        <Plus className="mr-1 inline h-3 w-3" />
        Registrar sobrante manualmente (opcional)
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div>
          <Label className="text-[0.65rem] text-muted-foreground">COD_INT</Label>
          <Input
            value={cod}
            onChange={(e) => setCod(e.target.value.toUpperCase())}
            placeholder="BK 18"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[0.65rem] text-muted-foreground">Ancho (cm)</Label>
          <Input
            type="number"
            value={ancho}
            onChange={(e) => setAncho(e.target.value)}
            placeholder="150"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[0.65rem] text-muted-foreground">Alto (cm)</Label>
          <Input
            type="number"
            value={alto}
            onChange={(e) => setAlto(e.target.value)}
            placeholder="200"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[0.65rem] text-muted-foreground">Ubicación</Label>
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
            className="h-7 w-full gap-1 bg-success hover:bg-success/90"
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
/** El lote que manda en el plan: su nombre y las OTs que el jefe juntó. */
export type LoteDelPlan = { nombre: string; otIds: string[] };

/**
 * Desde dónde se abrió el plan. En `clasico` (Optimizador de Tela → una OT)
 * todo sigue igual que siempre: cada rollo se confirma por su cuenta y los
 * sobrantes se guardan a mano. En `produccion` (la cola del taller) el corte
 * se cierra de una vez para todo el plan, registrando también las mermas y
 * sacando las etiquetas.
 */
export type FlujoPlan = 'clasico' | 'produccion';

export function PlanCorteSection({
  ot,
  lote,
  flujo = 'clasico',
}: {
  ot?: OT;
  lote?: LoteDelPlan;
  flujo?: FlujoPlan;
}) {
  const { empresaId } = useAuth();
  const { parametros, loading: loadingParams } = useParametrosCotizador();
  const { formulas, loading: loadingFormulas } = useFormulasFamilias();
  const { reglas } = useReglasSeleccion();
  const [colmenaPanos, setColmenaPanos] = useState<PanoColmena[] | null>(null);
  const [ots, setOts] = useState<OT[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generado, setGenerado] = useState(false);
  // Cuántas OTs del lote quedaron afuera del plan (salieron de producción o no
  // tienen ventanas). Se avisa: si no, el jefe cree que armó un lote de 4 y ve
  // los paños de 3 sin entender por qué.
  const [fueraDelLote, setFueraDelLote] = useState(0);

  const cargar = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      // Colmena paños disponibles (paginada: con la colmena llena un select
      // simple se corta en 1.000 filas y el plan vería media colmena).
      setColmenaPanos(await cargarColmenaPanos(empresaId));

      // OTs en producción (incluye la actual como fallback)
      const { data: otsData, error: otsErr } = await supabase
        .from('ots')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('estado', 'produccion');
      if (otsErr) throw otsErr;

      const otsProd = otsDelPlan((otsData as FilaOTPlan[]) || []);
      const listaOTs = lote
        ? resolverOtsDelPlan(otsProd, { otIds: lote.otIds })
        : ot
          ? resolverOtsDelPlan(otsProd, { otActual: ot })
          : otsProd;
      setFueraDelLote(lote ? lote.otIds.length - listaOTs.length : 0);
      setOts(listaOTs);
      setGenerado(true);
    } catch (e) {
      toast.error('Error cargando datos: ' + (e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  };

  // En modo lote el plan se arma solo: el jefe ya dijo «plan de tela de este
  // lote», pedirle otro clic para lo mismo no aporta.
  const autoCargado = useRef(false);
  useEffect(() => {
    if (!lote || !empresaId || autoCargado.current) return;
    autoCargado.current = true;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lote, empresaId]);

  // Giros de colmena que el operario ya decidió (pieceId → autoriza). Se
  // GUARDAN (`produccion_checks`, area panos / ref giro): si vivieran en el
  // estado de esta pantalla, al volver del Dimensionado el plan volvería a
  // pedir la misma autorización y el Dimensionado dibujaría la cortina girada
  // que ya se rechazó. Viven acá y no en la tarjeta porque rechazar uno
  // regenera el plan —la cortina se va a otro paño o al rollo— y con él se
  // remontan todas las tarjetas.
  const { decisiones: decisionesColmena, sinGiro, decidir, olvidar } = useDecisionesGiro(ots);

  const plan: Plan | null = useMemo(() => {
    // Espera los parámetros de corte: un plan con defaults no se recalcularía.
    if (!colmenaPanos || !ots || loadingParams || loadingFormulas) return null;
    return generarPlanCorte(ots, colmenaPanos, parametros, formulas, reglas.tipos, { sinGiro });
    // `reglas` faltaba: un tipo de cortina nuevo del catálogo técnico no
    // recalculaba el plan hasta recargar la página.
  }, [colmenaPanos, ots, loadingParams, parametros, loadingFormulas, formulas, reglas, sinGiro]);

  const resumen = plan ? resumenPlan(plan) : null;
  // De dónde vienen los sobrantes que se guarden en la colmena. En un lote es
  // el lote: un mismo rollo sirvió a varias OTs y no hay UNA a la que atribuir
  // el retazo.
  const otNum = lote
    ? `LOTE ${lote.nombre}`
    : ot
      ? ot.datosGenerales.ot || String(ot.id)
      : '';

  // ── Cierre del corte (solo módulo Producción) ──────────────────────
  // El layout con el que quedó cada tarjeta: si el operario rechazó una
  // inversión, lo que se registra es ESO y no la propuesta original.
  const [layouts, setLayouts] = useState<Record<number, GrupoRollo>>({});
  const [cerrando, setCerrando] = useState(false);

  // Al regenerar el plan las tarjetas se remontan: los layouts viejos ya no
  // corresponden y quedarían pegados si no se limpian.
  useEffect(() => {
    setLayouts((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, [plan]);

  const gruposVigentes = useMemo(
    () => (plan ? plan.rollo.map((g, i) => layouts[i] ?? g) : []),
    [plan, layouts],
  );

  const origenCorte: OrigenCorte | null = lote
    ? { tipo: 'lote', nombre: lote.nombre, ots: (plan?.otsIncluidas ?? []).map((o) => ({ id: o.id, numero: o.num })) }
    : ot
      ? { tipo: 'ot', numero: ot.datosGenerales.ot || String(ot.id) }
      : null;

  // Los giros rechazados que siguen vivos en este plan. La cortina ya se fue al
  // rollo (o a otro paño), así que su tarjeta de colmena no existe: sin esta
  // lista no habría cómo deshacer un «Rechaza» apretado por error.
  const rechazados = useMemo(() => {
    if (!plan) return [];
    const nombreDe = new Map<string, string>();
    for (const g of [...plan.sobrantes, ...plan.rollo])
      for (const p of g.placed) if (!p.failed) nombreDe.set(p.id, p.nombre);
    return Object.entries(decisionesColmena)
      .filter(([id, ok]) => !ok && nombreDe.has(id))
      .map(([id]) => ({ id, nombre: nombreDe.get(id) as string }));
  }, [plan, decisionesColmena]);

  const otIdsDelPlan = plan?.otsIncluidas.map((o) => o.id) ?? [];
  // Un giro sin decidir puede mover esa cortina a otro paño o al rollo, así que
  // el corte no se cierra hasta que estén todos resueltos: lo que se registra
  // tiene que ser lo que el operario está mirando.
  const girosPendientes = (plan?.sobrantes ?? []).flatMap((g) =>
    g.piezasRotadas.filter((r) => decisionesColmena[r.id] === undefined),
  ).length;
  const puedeCerrar =
    flujo === 'produccion' &&
    !!origenCorte &&
    !!empresaId &&
    otIdsDelPlan.length > 0 &&
    girosPendientes === 0;

  return (
    <div className="mt-4 rounded-lg border border-border bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-blue-300" />
          <strong className="text-sm">
            {lote ? `Plan de tela · ${lote.nombre}` : 'Plan de Corte desde Colmena'}
          </strong>
          {resumen && (
            <span className="text-[0.68rem] text-muted-foreground">
              · {resumen.desdeSobrante} desde sobrante · {resumen.desdeRollo} desde rollo
              {resumen.sinStock > 0 && (
                <span className="text-destructive"> · {resumen.sinStock} sin stock</span>
              )}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={cargar}
          disabled={loading}
          className="h-7 gap-1 bg-accent text-[0.7rem] hover:bg-accent"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ruler className="h-3 w-3" />}
          {generado ? 'Regenerar' : 'Generar plan'}
        </Button>
      </div>

      {!generado && !loading && (
        <div className="p-6 text-center text-xs text-muted-foreground">
          {lote
            ? 'Arma el plan de corte con los paños de las OTs de este lote.'
            : 'Matchea los paños de esta OT (y otras en producción) contra los sobrantes disponibles en colmena y arma el plan de corte optimizado.'}
        </div>
      )}

      {loading && (
        <div className="p-6 text-center text-xs text-muted-foreground">Cargando colmena y OTs…</div>
      )}

      {plan && (
        <div className="p-3">
          {/* La colmena está apagada en Parámetros de corte: el motor ya ignoró
              los paños disponibles, así que se avisa para que nadie crea que la
              colmena "no tenía nada" que calzara. */}
          {parametros.usarColmenaPanos === false && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[0.72rem] text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Colmena desactivada</strong> en Optimizador de Tela → Parámetros de corte:
                este plan corta todo de rollo nuevo, aunque haya paños disponibles.
              </span>
            </div>
          )}

          {/* Una OT del lote que salió de producción (o que quedó sin
              ventanas) no entra al plan. Se dice, no se esconde. */}
          {lote && fueraDelLote > 0 && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[0.72rem] text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {fueraDelLote === 1
                  ? '1 OT del lote no entra al plan'
                  : `${fueraDelLote} OTs del lote no entran al plan`}{' '}
                (salieron de producción o no tienen ventanas).
              </span>
            </div>
          )}

          {lote && plan.otsIncluidas.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Ninguna OT de este lote sigue en producción: no hay nada que cortar.
            </div>
          )}

          {plan.otsIncluidas.length > 1 && (
            <div className="mb-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-[0.72rem] text-accent">
              <strong>
                {lote
                  ? `Plan del lote · ${plan.otsIncluidas.length} OTs:`
                  : `Plan combinado · ${plan.otsIncluidas.length} OTs en producción:`}
              </strong>
              {plan.otsIncluidas.map((o) => (
                <span
                  key={o.id}
                  className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[0.68rem]"
                >
                  OT{o.num} — {o.cliente}
                </span>
              ))}
            </div>
          )}

          {/* Los giros rechazados quedan guardados: se listan para poder
              volver atrás y para que se vea POR QUÉ esa cortina baja rollo. */}
          {flujo === 'produccion' && rechazados.length > 0 && (
            <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-[0.72rem]">
              <div className="mb-1 font-semibold text-destructive">
                Giros rechazados: {rechazados.length}{' '}
                {rechazados.length === 1 ? 'cortina se corta' : 'cortinas se cortan'} sin acostar
              </div>
              <div className="flex flex-wrap gap-2">
                {rechazados.map((r) => (
                  <span
                    key={r.id}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5"
                  >
                    ↺ {r.nombre}
                    <button
                      onClick={() => {
                        olvidar(r.id).catch((e) =>
                          toast.error(
                            'No se pudo deshacer: ' + (e instanceof Error ? e.message : String(e)),
                          ),
                        );
                      }}
                      className="font-semibold text-accent underline-offset-2 hover:underline"
                    >
                      volver a preguntar
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {plan.sobrantes.length > 0 && (
            <>
              <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-success">
                <Archive className="h-3 w-3" />
                Usar sobrantes de la Colmena
              </div>
              {plan.sobrantes.map((g) => (
                <CardSobrante
                  key={claveGrupo(g.sobrante._docId, g.placed)}
                  grupo={g}
                  decisiones={decisionesColmena}
                  onDecidir={
                    flujo === 'produccion'
                      ? (id, ok) => {
                          decidir(id, ok).catch((e) =>
                            toast.error(
                              'No se pudo guardar la decisión del giro: ' +
                                (e instanceof Error ? e.message : String(e)),
                            ),
                          );
                        }
                      : undefined
                  }
                />
              ))}
            </>
          )}

          {plan.rollo.length > 0 && (
            <>
              <div className="mb-2 mt-3 flex items-center gap-1 text-xs font-semibold text-accent">
                <Ruler className="h-3 w-3" />
                Cortar desde rollo nuevo
              </div>
              {plan.rollo.map((g, gi) => (
                <CardRollo
                  key={claveGrupo(g.codInt, g.placed)}
                  grupo={g}
                  otNum={otNum}
                  onConfirmado={cargar}
                  conConfirmacionLocal={flujo === 'clasico'}
                  onLayout={
                    flujo === 'produccion'
                      ? (efectivo) => setLayouts((prev) => ({ ...prev, [gi]: efectivo }))
                      : undefined
                  }
                />
              ))}
            </>
          )}

          {/* Un solo cierre para todo el plan: el lote se corta en una sesión y
              el registro (paños usados, sobrantes, mermas, etiquetas y el sello
              de «tela cortada») sale de una sola pasada. Va FUERA del bloque de
              rollo: un plan que se resuelve entero con la colmena también se
              cierra, y antes se quedaba sin botón. */}
          {puedeCerrar && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
              <Button
                size="sm"
                onClick={() => setCerrando(true)}
                className="gap-1.5 bg-success hover:bg-success/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Cerrar el corte
              </Button>
              <span className="text-[0.7rem] text-muted-foreground">
                {plan.sobrantes.length > 0 &&
                  `Saca ${plan.sobrantes.length} paño(s) de la colmena, `}
                registra los sobrantes y la merma, imprime las etiquetas y marca la tela como
                cortada en {otIdsDelPlan.length} {otIdsDelPlan.length === 1 ? 'OT' : 'OTs'}.
              </span>
            </div>
          )}

          {plan.sinStock.length > 0 && (
            <>
              <div className="mb-2 mt-3 flex items-center gap-1 text-xs font-semibold text-destructive">
                <TriangleAlert className="h-3 w-3" />
                Sin sobrantes disponibles (verificar stock de rollo)
              </div>
              {plan.sinStock.map((g, gi) => (
                <div
                  key={gi}
                  className="mb-2 rounded-lg border border-destructive/30 bg-destructive/15 p-3"
                >
                  <div className="text-sm font-semibold text-destructive font-mono">
                    {g.codInt}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    No hay sobrantes disponibles. Verificar stock de rollos.
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {g.piezas.map((p, i) => (
                      <span
                        key={i}
                        className="rounded border border-border px-1.5 py-0.5 text-[0.65rem] font-mono"
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

      {cerrando && puedeCerrar && origenCorte && empresaId && (
        <ConfirmarCorteDialog
          grupos={gruposVigentes}
          sobrantes={plan?.sobrantes ?? []}
          params={parametros}
          origen={origenCorte}
          otIds={otIdsDelPlan}
          empresaId={empresaId}
          onConfirmado={cargar}
          onClose={() => setCerrando(false)}
        />
      )}
    </div>
  );
}
