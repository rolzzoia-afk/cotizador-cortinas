// La bandeja donde el encargado de producción lee lo que avisó el taller.
//
// Va arriba de todo y solo se despliega si hay algo pendiente: un cartel fijo
// que nadie mira deja de ser un aviso. Los atendidos quedan guardados —sirven
// para ver qué se rompe seguido— pero no ocupan la pantalla.

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAvisos } from '@/modules/produccion/avisos';
import { LABEL_AREA } from '@/modules/produccion/constants';
import type { AreaProduccion } from '@/modules/produccion/types';

const cuando = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const nombreArea = (a: string) => LABEL_AREA[a as AreaProduccion] ?? 'General';

export default function BandejaAvisos() {
  const { avisos, pendientes, atender } = useAvisos();
  const [verHistorial, setVerHistorial] = useState(false);

  const abiertos = avisos.filter((a) => !a.atendido);
  const cerrados = avisos.filter((a) => a.atendido);

  if (avisos.length === 0) return null;

  return (
    <section className="mb-4 space-y-2">
      {abiertos.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5">
          <header className="flex items-center gap-2 border-b border-red-500/20 px-3 py-2">
            <TriangleAlert className="h-4 w-4 text-red-400" />
            <strong className="text-sm text-red-300">
              {pendientes} {pendientes === 1 ? 'problema sin atender' : 'problemas sin atender'}
            </strong>
          </header>
          <ul className="divide-y divide-red-500/10">
            {abiertos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm">{a.mensaje}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {nombreArea(a.area)}
                    {a.ot ? ` · OT ${a.ot}` : ''}
                    {a.creado_por ? ` · ${a.creado_por}` : ''} · {cuando(a.creado_en)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await atender(a.id);
                    } catch (e) {
                      toast.error(
                        'No se pudo marcar: ' + (e instanceof Error ? e.message : String(e)),
                      );
                    }
                  }}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  Atendido
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cerrados.length > 0 && (
        <div className={cn('rounded-lg border', abiertos.length === 0 && 'bg-card')}>
          <button
            type="button"
            onClick={() => setVerHistorial((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {verHistorial ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {cerrados.length} {cerrados.length === 1 ? 'aviso atendido' : 'avisos atendidos'}
          </button>
          {verHistorial && (
            <ul className="divide-y divide-border/50 border-t">
              {cerrados.map((a) => (
                <li key={a.id} className="p-3 text-xs">
                  <p className="text-muted-foreground line-through">{a.mensaje}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {nombreArea(a.area)}
                    {a.ot ? ` · OT ${a.ot}` : ''} · atendido
                    {a.atendido_por ? ` por ${a.atendido_por}` : ''}
                    {a.atendido_en ? ` · ${cuando(a.atendido_en)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
