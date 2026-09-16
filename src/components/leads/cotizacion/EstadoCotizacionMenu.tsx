// El botón «Estado de la cotización»: muestra el estado actual y, al tocarlo,
// ofrece los cambios posibles (Enviada · Por actualizar · Actualizada · Sin
// enviar). «Por actualizar» deja anotar qué hay que cambiar. Cada cambio queda
// en el historial con la nota y quién lo hizo.
//
// El panel va FIJO con las coordenadas del botón (como `MenuAcciones`): dentro
// de la planilla, que tiene scroll propio, un panel absoluto se cortaría.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import {
  ESTADO_COTIZACION_LABEL,
  ESTADO_COTIZACION_TONO,
  opcionesEstadoCotizacion,
  textoEstadoCotizacion,
  type OpcionEstadoCotizacion,
} from '@/modules/leads/cotizacionEstado';
import { cambiarEstadoCotizacion } from '@/modules/leads/leadsRpc';
import type { Lead } from '@/modules/leads/types';

const TONO: Record<string, string> = {
  neutral: 'border-border bg-secondary text-muted-foreground',
  progress: 'border-accent/30 bg-accent/15 text-accent',
  // «Por actualizar» es una TAREA pendiente: relleno sólido y un halo, para que
  // salte a la vista entre las «Enviada» de la planilla.
  warn: 'border-warning bg-warning text-warning-foreground shadow-[0_0_0_3px_hsl(var(--warning)/0.3)]',
  success: 'border-success/30 bg-success/15 text-success',
};

type Props = {
  lead: Pick<Lead, 'id' | 'nombre' | 'estado_cotizacion' | 'cotizacion_version' | 'ot_id'>;
  onCambiado?: (lead: Lead) => void;
  className?: string;
};

export function EstadoCotizacionMenu({ lead, onCambiado, className }: Props) {
  const [pos, setPos] = useState<{ arriba: number; izquierda: number } | null>(null);
  const [elegida, setElegida] = useState<OpcionEstadoCotizacion | null>(null);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const cerrar = () => {
    setPos(null);
    setElegida(null);
    setNota('');
  };

  const abrir = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) return cerrar();
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ arriba: r.bottom + 4, izquierda: Math.min(r.left, window.innerWidth - 300) });
  };

  useEffect(() => {
    if (!pos) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boton.current?.contains(t) || panel.current?.contains(t)) return;
      cerrar();
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    const mover = (e: Event) => {
      if (panel.current?.contains(e.target as Node)) return;
      cerrar();
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', mover, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', mover, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [pos]);

  const aplicar = async (op: OpcionEstadoCotizacion, conNota?: string) => {
    if (op.confirma) {
      const ok = await confirmar({
        titulo: 'Volver a «Sin enviar»',
        mensaje: `La cotización de ${lead.nombre || 'este cliente'} quedará como no enviada. Úsalo solo si se marcó por error; el cambio queda en el historial.`,
        confirmLabel: 'Volver a «Sin enviar»',
      });
      if (!ok) return;
    }
    setGuardando(true);
    try {
      const actualizado = await cambiarEstadoCotizacion(lead.id, op.estado, conNota);
      toast.success(
        op.estado === 'enviada' && lead.ot_id
          ? 'Cotización enviada · la OT pasó a «Esperando confirmación»'
          : `Cotización: ${ESTADO_COTIZACION_LABEL[op.estado]}`,
      );
      cerrar();
      onCambiado?.(actualizado);
    } catch (e) {
      toast.error('No se pudo cambiar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const tono = ESTADO_COTIZACION_TONO[lead.estado_cotizacion] ?? 'neutral';

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={abrir}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        title="Cambiar el estado de la cotización"
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-semibold transition-colors hover:brightness-110',
          TONO[tono],
          className,
        )}
      >
        {lead.estado_cotizacion === 'por_actualizar' && <RefreshCw className="h-3 w-3" aria-hidden />}
        {textoEstadoCotizacion(lead)}
        <ChevronDown className="h-3 w-3" />
      </button>

      {pos && (
        <div
          ref={panel}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ top: pos.arriba, left: Math.max(8, pos.izquierda) }}
          className="fixed z-50 w-[290px] overflow-hidden rounded-lg border border-border bg-card py-1 text-left shadow-lg"
        >
          {!elegida ? (
            opcionesEstadoCotizacion(lead.estado_cotizacion).map((op) => (
              <button
                key={op.estado + op.texto}
                type="button"
                role="menuitem"
                disabled={guardando}
                onClick={() => (op.pideNota ? setElegida(op) : aplicar(op))}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-accent/[0.09] disabled:opacity-40"
              >
                <span className="text-[0.8125rem] font-medium text-foreground">{op.texto}</span>
                <span className="text-[0.6875rem] leading-snug text-muted-foreground">{op.ayuda}</span>
              </button>
            ))
          ) : (
            <div className="space-y-2 px-3 py-2">
              <div className="text-[0.8125rem] font-medium text-foreground">{elegida.texto}</div>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Qué hay que actualizar (opcional): «agregar 1 cortina», «cambiar a blackout»…"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setElegida(null)} disabled={guardando}>
                  Volver
                </Button>
                <Button size="sm" onClick={() => aplicar(elegida, nota)} disabled={guardando} className="gap-1">
                  {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
