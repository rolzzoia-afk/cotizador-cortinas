// Widget siempre visible que muestra el estado actual de las invariantes
// de la base. Verde = ok, ámbar = warning (no crítico), rojo = error.
// Se actualiza al montar y después de cada corrección.

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { type SaludResult, type useSaludColmena } from '@/modules/admin/correcciones';

interface SaludColmenaWidgetProps {
  salud: ReturnType<typeof useSaludColmena>;
}

export default function SaludColmenaWidget({ salud }: SaludColmenaWidgetProps) {
  const s: SaludResult | null = salud.salud;
  const estado = s?.estado;
  const cls =
    estado === 'ok'
      ? 'border-green-500/40 bg-green-500/10 text-green-300'
      : estado === 'warning'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
        : estado === 'error'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-card/40 text-muted-foreground';
  const Icon =
    estado === 'ok'
      ? CheckCircle2
      : estado === 'warning'
        ? AlertTriangle
        : estado === 'error'
          ? X
          : Loader2;
  const titulo = !s
    ? 'Verificando salud de la colmena...'
    : estado === 'ok'
      ? `Colmena sana — ${s.total_tubos} tubos`
      : estado === 'warning'
        ? `Colmena con avisos — ${s.total_tubos} tubos`
        : `Colmena descuadrada — ${s.total_tubos} tubos`;
  const ts = s?.ts ? new Date(s.ts).toLocaleTimeString('es-CL') : '';
  const checksFallando = s ? s.checks.filter((c) => c.count > 0) : [];

  return (
    <div className={cn('rounded-lg border p-3', cls)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              'h-4 w-4',
              !s && 'animate-spin',
            )}
          />
          <strong className="text-sm">{titulo}</strong>
          {ts && <span className="text-[0.7rem] opacity-70">· última: {ts}</span>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            salud.verificar().catch(() => undefined);
          }}
          disabled={salud.loading}
          className="h-8 gap-1"
        >
          {salud.loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Verificar ahora
        </Button>
      </div>
      {checksFallando.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {checksFallando.map((c) => (
            <li key={c.nombre} className="flex items-start gap-1">
              <span className="font-semibold">{c.count}</span>
              <span>· {c.descripcion}</span>
              <span className="opacity-60">({c.severity})</span>
            </li>
          ))}
        </ul>
      )}
      {s && s.estado === 'error' && (
        <div className="mt-2 text-[0.7rem] opacity-90">
          ⚠ Antes de seguir guardando planes, revisa la pestaña Reconciliación
          o avisa al administrador.
        </div>
      )}
    </div>
  );
}
