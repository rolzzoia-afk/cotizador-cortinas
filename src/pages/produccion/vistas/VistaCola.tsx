// La portada de Producción: qué hay en el taller AHORA y qué OTs se cortan
// juntas.
//
// Hasta acá el módulo solo dejaba ver una OT a la vez, escrita a mano en el
// buscador: no había forma de ver la carga del taller ni de decidir qué juntar.
//
// La cola muestra las OTs en producción agrupadas por sub-etapa (el orden real:
// Estructura → Paños → Dimensionado → Armado → Prueba) y, dentro de cada grupo,
// por fecha de entrega. Un LOTE es la decisión del jefe de cortar varias OTs
// juntas; su único efecto es acotar el plan de tela a esas OTs. No mueve
// estados ni toca el flujo de tubos.

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Hammer,
  Layers,
  ListChecks,
  Loader2,
  Ruler,
  Scissors,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmar } from '@/components/ui/confirm';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlanCorteSection } from '@/components/cotizador/PlanCorteSection';
import { SUB_ETAPA_META } from '@/modules/cotizador/fase4';
import { useColaProduccion } from '@/modules/produccion/hooks';
import { ordenarCola, resumenLote, type ItemCola, type LoteProduccion } from '@/modules/produccion/lotes';
import { mensajeErrorLote, useLotes } from '@/modules/produccion/lotesStore';

/** Un objeto de error crudo en un toast se lee «[object Object]». Nunca más. */
const textoError = (e: unknown): string =>
  e instanceof Error
    ? e.message
    : typeof e === 'string'
      ? e
      : mensajeErrorLote((e || {}) as { message?: string });

function TarjetaOT({
  item,
  admin,
  elegida,
  onElegir,
  onAbrir,
}: {
  item: ItemCola;
  admin: boolean;
  elegida: boolean;
  onElegir: () => void;
  onAbrir: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border bg-card p-3 transition',
        elegida ? 'border-accent/60 bg-accent/5' : 'border-border hover:border-accent/40',
      )}
    >
      {admin && (
        <input
          type="checkbox"
          checked={elegida}
          onChange={onElegir}
          aria-label={`Elegir la OT ${item.numero} para un lote`}
          className="mt-1 h-4 w-4 shrink-0 accent-current"
        />
      )}
      <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold">OT {item.numero}</span>
          {item.sinCorteTela && (
            <span className="shrink-0 rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
              Tela sin cortar
            </span>
          )}
        </div>
        <div className="truncate text-sm text-muted-foreground">{item.cliente}</div>
        {item.fechaEntrega && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" /> Entrega {item.fechaEntrega.slice(0, 10)}
          </div>
        )}
      </button>
    </div>
  );
}

export default function VistaCola({
  admin,
  onAbrirOT,
  onTrabajarLote,
  loteActivoId,
  onLoteEliminado,
}: {
  admin: boolean;
  /** Recibe el `numero_ot` CRUDO: el buscador matchea exacto contra la columna. */
  onAbrirOT: (numeroOt: string) => void;
  /** Fija el lote arriba y entra por su primera OT. */
  onTrabajarLote: (lote: LoteProduccion) => void;
  loteActivoId: string | null;
  onLoteEliminado: (id: string) => void;
}) {
  const { cola, loading } = useColaProduccion();
  const { lotes, error: errorLotes, crear, eliminar } = useLotes();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [loteAbierto, setLoteAbierto] = useState<LoteProduccion | null>(null);

  const grupos = useMemo(() => ordenarCola(cola), [cola]);

  const alternar = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const abrirDialogo = () => {
    const hoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    setNombre(`Corte ${hoy}`);
    setDialogo(true);
  };

  const crearLote = async () => {
    const elegidas = cola.filter((i) => sel.has(i.id));
    setGuardando(true);
    try {
      await crear(
        nombre,
        elegidas.map((i) => ({ id: i.id, numero: i.numero, numeroOt: i.numeroOt })),
      );
      toast.success(`Lote «${nombre.trim()}» creado con ${elegidas.length} OTs`);
      setSel(new Set());
      setDialogo(false);
    } catch (e) {
      toast.error(textoError(e));
    } finally {
      setGuardando(false);
    }
  };

  const borrarLote = async (lote: LoteProduccion) => {
    const sigue = await confirmar({
      titulo: 'Deshacer el lote',
      mensaje: `Se borra el lote «${lote.nombre}». Las OTs siguen igual: lo único que se pierde es la agrupación para el plan de tela.`,
      confirmLabel: 'Deshacer lote',
      destructivo: true,
    });
    if (!sigue) return;
    try {
      await eliminar(lote.id);
      if (loteAbierto?.id === lote.id) setLoteAbierto(null);
      onLoteEliminado(lote.id);
      toast.success('Lote deshecho');
    } catch (e) {
      toast.error('No se pudo deshacer: ' + textoError(e));
    }
  };

  // ── El plan de tela de un lote ─────────────────────────────────────
  if (loteAbierto) {
    return (
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setLoteAbierto(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver a la cola
          </Button>
          <span className="text-sm font-semibold">{loteAbierto.nombre}</span>
          <span className="text-xs text-muted-foreground">
            {loteAbierto.ots.map((o) => `OT ${o.numero}`).join(' · ')}
          </span>
        </div>
        <PlanCorteSection
          key={loteAbierto.id}
          flujo="produccion"
          lote={{ nombre: loteAbierto.nombre, otIds: loteAbierto.ots.map((o) => o.id) }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Lotes ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Lotes armados
        </div>
        {errorLotes ? (
          <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorLotes}</span>
          </div>
        ) : lotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {admin
              ? 'Todavía no hay lotes. Elige OTs de la cola y arma uno para cortar su tela junta.'
              : 'Todavía no hay lotes armados.'}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {lotes.map((lote) => {
              const res = resumenLote(lote, cola);
              return (
                <div key={lote.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{lote.nombre}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {res.total} {res.total === 1 ? 'OT' : 'OTs'}
                        {res.sinCorteTela > 0 && ` · ${res.sinCorteTela} sin cortar tela`}
                        {lote.creadoPor && ` · ${lote.creadoPor}`}
                      </div>
                    </div>
                    {admin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => borrarLote(lote)}
                        title="Deshacer el lote"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {lote.ots.map((o) => {
                      const fuera = res.fuera.some((f) => f.id === o.id);
                      return (
                        <span
                          key={o.id}
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[11px]',
                            fuera
                              ? 'border-border bg-muted/40 text-muted-foreground line-through'
                              : 'border-accent/30 bg-accent/10 text-accent',
                          )}
                          title={fuera ? 'Fuera de producción: no entra al plan' : undefined}
                        >
                          OT {o.numero}
                        </span>
                      );
                    })}
                  </div>
                  {res.fuera.length > 0 && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {res.fuera.length === 1 ? '1 OT ya no está' : `${res.fuera.length} OTs ya no están`}{' '}
                      en producción: no entran al plan.
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[0.72rem]"
                      onClick={() => setLoteAbierto(lote)}
                    >
                      <Ruler className="h-3.5 w-3.5" />
                      Plan de tela
                    </Button>
                    {/* Fija el lote arriba: sus OTs quedan a un clic en
                        Estructura, Paños, Dimensionado y el resto. */}
                    <Button
                      size="sm"
                      className="h-7 gap-1 text-[0.72rem]"
                      onClick={() => onTrabajarLote(lote)}
                      disabled={lote.ots.length === 0}
                    >
                      <Hammer className="h-3.5 w-3.5" />
                      Trabajar el lote
                    </Button>
                    {loteActivoId === lote.id && (
                      <span className="text-[11px] font-semibold text-accent">· en trabajo</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── La cola ────────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" />
            En producción
            {!loading && <span className="normal-case">· {cola.length}</span>}
          </div>
          {admin && sel.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSel(new Set())}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
              <Button size="sm" className="h-7 gap-1 text-[0.72rem]" onClick={abrirDialogo}>
                <Scissors className="h-3.5 w-3.5" />
                Crear lote ({sel.size})
              </Button>
            </div>
          )}
        </div>

        {loading && cola.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Cargando la cola…
          </div>
        )}

        {!loading && cola.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No hay órdenes en producción.
          </div>
        )}

        <div className="space-y-4">
          {grupos.map((g) => {
            const meta = g.subEtapa ? SUB_ETAPA_META[g.subEtapa] : null;
            return (
              <div key={g.subEtapa ?? '—'}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={
                      meta
                        ? { color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }
                        : undefined
                    }
                  >
                    {meta ? meta.label : 'Sin sub-etapa'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {g.items.length} {g.items.length === 1 ? 'OT' : 'OTs'}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.items.map((item) => (
                    <TarjetaOT
                      key={item.id}
                      item={item}
                      admin={admin}
                      elegida={sel.has(item.id)}
                      onElegir={() => alternar(item.id)}
                      onAbrir={() => onAbrirOT(item.numeroOt || item.numero)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Crear lote ─────────────────────────────────────────────── */}
      <Dialog open={dialogo} onOpenChange={(abierto) => !abierto && setDialogo(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nombre del lote</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Corte 01/09"
                className="mt-1"
                autoFocus
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {sel.size} {sel.size === 1 ? 'OT elegida' : 'OTs elegidas'}:{' '}
              {cola
                .filter((i) => sel.has(i.id))
                .map((i) => `OT ${i.numero}`)
                .join(' · ')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogo(false)}>
              Cancelar
            </Button>
            <Button onClick={crearLote} disabled={guardando || !nombre.trim()}>
              {guardando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Crear lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
