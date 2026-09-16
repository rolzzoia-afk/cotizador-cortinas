import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { esRolAdmin } from '@/lib/roles';
import type { Lead } from '@/modules/leads/types';
import {
  archivarSeguimientosVencidos,
  bandejaSeguimientos,
  resumenBandeja,
  URGENCIA_LABEL,
  type SeguimientoInfo,
  type Urgencia,
} from '@/modules/leads/seguimientos';
import type { VendedoraOpt } from '@/modules/leads/hooks';
import { EstadoCotizacionMenu } from './cotizacion/EstadoCotizacionMenu';
import { TarjetaSeguimiento, URGENCIA_CARD, URGENCIA_ICON } from './seguimientos/TarjetaSeguimiento';

type Props = {
  leads: Lead[];
  vendedoras: VendedoraOpt[];
  onRefresh: () => void | Promise<void>;
  onAbrir?: (leadId: string) => void;
};

export function SeguimientosView({ leads, vendedoras, onRefresh, onAbrir }: Props) {
  const { perfil, empresaId } = useAuth();
  const esAdmin = esRolAdmin(perfil?.rol);

  // Admin puede ver todas o filtrar por vendedora; vendedora ve solo las suyas.
  const [filtroVend, setFiltroVend] = useState<string>(esAdmin ? '' : perfil?.id ?? '');
  const [incluirProximos, setIncluirProximos] = useState(false);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  useEffect(() => {
    if (!esAdmin && perfil?.id) setFiltroVend(perfil.id);
  }, [esAdmin, perfil?.id]);

  // Archivado automático de vencidos (día +8) — una sola vez al entrar.
  const archivadoRef = useRef(false);
  useEffect(() => {
    if (!empresaId || archivadoRef.current) return;
    archivadoRef.current = true;
    (async () => {
      try {
        const n = await archivarSeguimientosVencidos(empresaId);
        if (n > 0) {
          toast.info(`${n} cliente${n === 1 ? '' : 's'} archivado${n === 1 ? '' : 's'} por falta de respuesta (día +8)`);
          await onRefresh();
        }
      } catch {
        /* silencioso: no es crítico */
      }
    })();
  }, [empresaId, onRefresh]);

  const vendedoraId = filtroVend || null;

  const resumen = useMemo(() => resumenBandeja(leads, { vendedoraId }), [leads, vendedoraId]);
  const bandeja = useMemo(
    () => bandejaSeguimientos(leads, { vendedoraId, incluirProximos }),
    [leads, vendedoraId, incluirProximos],
  );
  const porActualizar = useMemo(
    () => leads.filter((l) => l.estado_cotizacion === 'por_actualizar' && (!vendedoraId || l.asignado_a === vendedoraId)),
    [leads, vendedoraId],
  );

  const grupos = useMemo(() => {
    const g: Record<Urgencia, SeguimientoInfo[]> = { atrasado: [], hoy: [], proximo: [] };
    for (const s of bandeja) g[s.urgencia].push(s);
    return g;
  }, [bandeja]);

  const nombreVendedora = (id: string | null) => vendedoras.find((v) => v.id === id)?.nombre ?? null;

  return (
    <div className="space-y-5">
      {/* Encabezado + resumen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <CalendarClock className="h-5 w-5 text-accent" />
            Seguimientos de hoy
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cadencia del manual: Seguimiento 1 al día siguiente · Seguimiento 2 a los 2 días · Seguimiento 3 a los 4 días · se archiva en el día +8.
          </p>
        </div>
        {esAdmin && (
          <select
            value={filtroVend}
            onChange={(e) => setFiltroVend(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
          >
            <option value="">Todas las vendedoras</option>
            {vendedoras.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResumenChip urgencia="atrasado" valor={resumen.atrasados} titulo="Atrasados" />
        <ResumenChip urgencia="hoy" valor={resumen.hoy} titulo="Para hoy" />
        <ResumenChip urgencia="proximo" valor={resumen.proximos} titulo="Próximos" />
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <FileWarning className="h-3.5 w-3.5" /> Por actualizar
          </div>
          <div className="mt-1 text-2xl font-extrabold text-foreground">{porActualizar.length}</div>
        </div>
      </div>

      {resumen.atrasados > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Tienes {resumen.atrasados} seguimiento{resumen.atrasados === 1 ? '' : 's'} atrasado{resumen.atrasados === 1 ? '' : 's'}. Empieza por la prioridad alta.
        </div>
      )}

      {porActualizar.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cotizaciones por actualizar ({porActualizar.length})
          </div>
          <div className="space-y-1.5">
            {porActualizar.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
                <button onClick={() => onAbrir?.(l.id)} className="font-semibold text-foreground hover:text-accent">
                  {l.nombre || '(sin nombre)'}
                </button>
                {l.numero_cotizacion && (
                  <span className="max-w-[260px] truncate text-xs text-muted-foreground" title={l.numero_cotizacion}>
                    {l.numero_cotizacion}
                  </span>
                )}
                {l.cotizado_por && <span className="text-xs text-muted-foreground">Cotiza: {l.cotizado_por}</span>}
                <span className="ml-auto">
                  <EstadoCotizacionMenu lead={l} onCambiado={() => onRefresh()} />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {bandeja.length} seguimiento{bandeja.length === 1 ? '' : 's'} en la lista
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={incluirProximos}
            onChange={(e) => setIncluirProximos(e.target.checked)}
            className="h-3.5 w-3.5 accent-current"
          />
          Mostrar también los próximos
        </label>
      </div>

      {bandeja.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
          No hay seguimientos pendientes{incluirProximos ? '' : ' para hoy'}. ¡Buen trabajo!
        </div>
      ) : (
        <div className="space-y-5">
          {(['atrasado', 'hoy', 'proximo'] as Urgencia[]).map((u) =>
            grupos[u].length === 0 ? null : (
              <section key={u} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {URGENCIA_LABEL[u]} ({grupos[u].length})
                </div>
                <div className="space-y-2">
                  {grupos[u].map((s) => (
                    <TarjetaSeguimiento
                      key={s.lead.id}
                      info={s}
                      vendedoraNombre={nombreVendedora(s.lead.asignado_a)}
                      abierto={abiertoId === s.lead.id}
                      onToggle={() => setAbiertoId((prev) => (prev === s.lead.id ? null : s.lead.id))}
                      onAbrir={onAbrir}
                      onRegistrado={async () => {
                        setAbiertoId(null);
                        await onRefresh();
                      }}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ResumenChip({ urgencia, valor, titulo }: { urgencia: Urgencia; valor: number; titulo: string }) {
  const Icon = URGENCIA_ICON[urgencia];
  return (
    <div className={cn('rounded-lg border p-3 text-center', URGENCIA_CARD[urgencia])}>
      <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {titulo}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-foreground">{valor}</div>
    </div>
  );
}
