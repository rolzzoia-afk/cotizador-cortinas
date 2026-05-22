import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  Loader2,
  Phone,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import {
  PRIORIDAD_LABEL,
  SEG_RESULTADO_LABEL,
  type Lead,
  type Prioridad,
  type SeguimientoResultado,
} from '@/modules/leads/types';
import {
  archivarSeguimientosVencidos,
  bandejaSeguimientos,
  registrarSeguimiento,
  resumenBandeja,
  URGENCIA_LABEL,
  type SeguimientoInfo,
  type Urgencia,
} from '@/modules/leads/seguimientos';
import type { VendedoraOpt } from '@/modules/leads/hooks';

type Props = {
  leads: Lead[];
  vendedoras: VendedoraOpt[];
  onRefresh: () => void | Promise<void>;
  onAbrir?: (leadId: string) => void;
};

// Colores por urgencia (tokens del tema)
const URGENCIA_CARD: Record<Urgencia, string> = {
  atrasado: 'border-destructive/40 bg-destructive/5',
  hoy: 'border-warning/40 bg-warning/5',
  proximo: 'border-border bg-card/40',
};
const URGENCIA_CHIP: Record<Urgencia, string> = {
  atrasado: 'border-destructive/40 bg-destructive/15 text-destructive',
  hoy: 'border-warning/40 bg-warning/15 text-warning',
  proximo: 'border-success/30 bg-success/15 text-success',
};
const URGENCIA_ICON: Record<Urgencia, typeof Clock> = {
  atrasado: AlertTriangle,
  hoy: Clock,
  proximo: CalendarClock,
};

const PRIORIDAD_CHIP: Record<Prioridad, string> = {
  alta: 'border-destructive/40 bg-destructive/15 text-destructive',
  media: 'border-warning/40 bg-warning/15 text-warning',
  baja: 'border-border bg-secondary text-muted-foreground',
};

const RESULTADOS: SeguimientoResultado[] = [
  'no_respondio',
  'respondio',
  'agendo_visita',
  'cerro',
  'no_interesado',
];

function textoDias(diasDiff: number): string {
  if (diasDiff === 0) return 'Para hoy';
  if (diasDiff < 0) {
    const n = Math.abs(diasDiff);
    return `Atrasado ${n} día${n === 1 ? '' : 's'}`;
  }
  return `En ${diasDiff} día${diasDiff === 1 ? '' : 's'}`;
}

export function SeguimientosView({ leads, vendedoras, onRefresh, onAbrir }: Props) {
  const { perfil, empresaId } = useAuth();
  const esAdmin = perfil?.rol === 'admin';

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
          toast.info(`${n} lead${n === 1 ? '' : 's'} archivado${n === 1 ? '' : 's'} por falta de respuesta (día +8)`);
          await onRefresh();
        }
      } catch {
        /* silencioso: no es crítico */
      }
    })();
  }, [empresaId, onRefresh]);

  const vendedoraId = filtroVend || null;

  const resumen = useMemo(
    () => resumenBandeja(leads, { vendedoraId }),
    [leads, vendedoraId],
  );

  const bandeja = useMemo(
    () => bandejaSeguimientos(leads, { vendedoraId, incluirProximos }),
    [leads, vendedoraId, incluirProximos],
  );

  const grupos = useMemo(() => {
    const g: Record<Urgencia, SeguimientoInfo[]> = { atrasado: [], hoy: [], proximo: [] };
    for (const s of bandeja) g[s.urgencia].push(s);
    return g;
  }, [bandeja]);

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

      <div className="grid grid-cols-3 gap-3">
        <ResumenChip
          urgencia="atrasado"
          valor={resumen.atrasados}
          titulo="Atrasados"
        />
        <ResumenChip urgencia="hoy" valor={resumen.hoy} titulo="Para hoy" />
        <ResumenChip urgencia="proximo" valor={resumen.proximos} titulo="Próximos" />
      </div>

      {resumen.atrasados > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Tienes {resumen.atrasados} seguimiento{resumen.atrasados === 1 ? '' : 's'} atrasado{resumen.atrasados === 1 ? '' : 's'}. Empieza por la prioridad alta.
        </div>
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
                      vendedoraNombre={
                        vendedoras.find((v) => v.id === s.lead.asignado_a)?.nombre ?? null
                      }
                      abierto={abiertoId === s.lead.id}
                      onToggle={() =>
                        setAbiertoId((prev) => (prev === s.lead.id ? null : s.lead.id))
                      }
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

function ResumenChip({
  urgencia,
  valor,
  titulo,
}: {
  urgencia: Urgencia;
  valor: number;
  titulo: string;
}) {
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

function TarjetaSeguimiento({
  info,
  vendedoraNombre,
  abierto,
  onToggle,
  onAbrir,
  onRegistrado,
}: {
  info: SeguimientoInfo;
  vendedoraNombre: string | null;
  abierto: boolean;
  onToggle: () => void;
  onAbrir?: (leadId: string) => void;
  onRegistrado: () => void | Promise<void>;
}) {
  const { lead, etapa, urgencia, diasDiff } = info;
  const [resultado, setResultado] = useState<SeguimientoResultado>('no_respondio');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await registrarSeguimiento(lead.id, resultado, nota.trim() || null);
      if (resultado === 'cerro') toast.success('¡Cierre registrado! Recuerda marcar el lead como Ganado.');
      else if (resultado === 'agendo_visita') toast.success('Visita agendada. Actualiza el estado del lead.');
      else if (resultado === 'no_interesado') toast.info('Registrado. Puedes marcarlo como Perdido.');
      else toast.success('Seguimiento registrado');
      setNota('');
      await onRegistrado();
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={cn('rounded-lg border p-3', URGENCIA_CARD[urgencia])}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onAbrir?.(lead.id)}
          className="font-semibold text-foreground hover:text-accent"
          title="Abrir ficha del lead"
        >
          {lead.nombre || '(sin nombre)'}
        </button>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            PRIORIDAD_CHIP[lead.prioridad],
          )}
        >
          {lead.prioridad === 'alta' && <Flame className="h-2.5 w-2.5" />}
          Prioridad {PRIORIDAD_LABEL[lead.prioridad]}
        </span>
        <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
          Seguimiento {etapa} de 3
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            URGENCIA_CHIP[urgencia],
          )}
        >
          {textoDias(diasDiff)}
        </span>
        {lead.scoring != null && (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-warning/30 bg-warning/15 px-1.5 py-0 text-[10px] font-bold text-warning">
            <Star className="h-2.5 w-2.5 fill-current" />
            {lead.scoring}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {lead.whatsapp_phone && (
          <a
            href={`https://wa.me/${lead.whatsapp_phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-foreground hover:text-accent"
          >
            <Phone className="h-3 w-3" /> {lead.whatsapp_phone}
          </a>
        )}
        {vendedoraNombre && <span>Vendedora: {vendedoraNombre}</span>}
        {lead.comuna && <span>{lead.comuna}</span>}
      </div>

      {/* CONECTOR / detalle personal — clave en el Seguimiento 2 */}
      {(lead.detalle_personal || etapa === 2) && (
        <div
          className={cn(
            'mt-2 rounded border px-2 py-1.5 text-xs',
            etapa === 2
              ? 'border-accent/40 bg-accent/10 text-foreground'
              : 'border-border bg-background/40 text-muted-foreground',
          )}
        >
          <span className="font-semibold text-accent">Conector: </span>
          {lead.detalle_personal || (
            <span className="italic text-muted-foreground">
              Sin detalle personal cargado — agrégalo en la ficha del lead para personalizar este seguimiento.
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant={abierto ? 'secondary' : 'default'} onClick={onToggle} className="gap-1">
          {abierto ? 'Cerrar' : 'Registrar resultado'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', abierto && 'rotate-180')} />
        </Button>
      </div>

      {abierto && (
        <div className="mt-2 space-y-2 rounded-md border border-border bg-background/40 p-2.5">
          <select
            value={resultado}
            onChange={(e) => setResultado(e.target.value as SeguimientoResultado)}
            className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm focus:border-accent focus:outline-none"
          >
            {RESULTADOS.map((r) => (
              <option key={r} value={r}>
                {SEG_RESULTADO_LABEL[r]}
              </option>
            ))}
          </select>
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota del seguimiento (opcional)"
          />
          <Button size="sm" className="w-full gap-1.5" onClick={handleGuardar} disabled={guardando}>
            {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar seguimiento
          </Button>
        </div>
      )}
    </div>
  );
}
