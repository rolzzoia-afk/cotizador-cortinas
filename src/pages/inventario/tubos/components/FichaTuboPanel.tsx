// El panel derecho de la colmena de tubería (lámina «Tubos de aluminio»).
//
// Un buscador arriba y, debajo, la ficha del tubo elegido con su RECORRIDO:
// de qué barra salió, en qué OT se cortó, dónde volvió a quedar y cuánto
// lleva esperando. Los tubos no tienen kardex de cantidades —cada pieza es su
// propia historia—, así que esto es lo más parecido a un saldo que tienen.

import { Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { TuboColmena } from '@/modules/tubos/colmenaTubos';
import { cm, type PasoRecorrido, type TonoEvento } from '@/modules/tubos/fichaTubo';

const PUNTO: Record<TonoEvento, string> = {
  ingreso: 'bg-success',
  corte: 'bg-accent',
  sobrante: 'bg-accent',
  merma: 'bg-destructive',
  salida: 'bg-muted-foreground',
  otro: 'bg-muted-foreground',
};

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 text-[0.78rem] last:border-0">
      <span className="shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function Paso({ paso, ultimo }: { paso: PasoRecorrido; ultimo: boolean }) {
  return (
    <div className="flex gap-2.5">
      <div className="flex w-3.5 flex-col items-center">
        <span
          className={cn(
            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
            paso.esHoy ? 'border-2 border-accent bg-card' : PUNTO[paso.tono],
          )}
        />
        {!ultimo && <span className="w-[1.5px] flex-1 bg-border" />}
      </div>
      <div className={cn('min-w-0', !ultimo && 'pb-3')}>
        <div className="flex flex-wrap items-baseline gap-x-2 text-[0.78rem] font-medium">
          {paso.titulo}
          {paso.medidas && (
            <span className="font-mono text-[0.6875rem] font-normal text-muted-foreground">
              {paso.medidas}
            </span>
          )}
        </div>
        <div className="text-[0.72rem] text-muted-foreground">{paso.detalle}</div>
        {paso.nota && (
          <div className="mt-0.5 text-[0.6875rem] leading-snug text-muted-foreground/80">
            {paso.nota}
          </div>
        )}
      </div>
    </div>
  );
}

export function FichaTuboPanel({
  busqueda,
  onBusqueda,
  coincidencias,
  tubo,
  dias,
  recorrido,
  cargandoRecorrido,
  onElegir,
  onVerHistorial,
}: {
  busqueda: string;
  onBusqueda: (v: string) => void;
  /** Los tubos que calzan con la búsqueda, para saltar directo a uno. */
  coincidencias: TuboColmena[];
  tubo: TuboColmena | null;
  dias: number | null;
  recorrido: PasoRecorrido[];
  cargandoRecorrido: boolean;
  onElegir: (t: TuboColmena) => void;
  /** Lleva a la pestaña Trazabilidad con la ficha completa (padres e hijos). */
  onVerHistorial: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="rounded-lg border border-border bg-card p-3.5">
        <div className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Buscar un tubo
        </div>
        <div
          className={cn(
            'flex h-10 items-center gap-2 rounded-lg border border-border bg-background/60 px-3',
            busqueda && 'border-accent ring-[3px] ring-accent/[0.16]',
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder="Código, estante o medida"
            aria-label="Buscar un tubo por código, estante o medida"
            className="h-full w-full bg-transparent font-mono text-[0.84rem] outline-none placeholder:font-sans placeholder:text-muted-foreground"
          />
        </div>
        {busqueda.trim() !== '' && (
          <div className="mt-2 flex max-h-[168px] flex-col gap-1 overflow-y-auto">
            {coincidencias.length === 0 ? (
              <p className="text-[0.72rem] text-muted-foreground">
                Ningún tubo en la colmena calza. Un tubo ya cortado cambia de identidad: búscalo
                por su OT en Trazabilidad.
              </p>
            ) : (
              coincidencias.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onElegir(t)}
                  className="flex items-center gap-2 rounded border border-border px-2 py-1 text-left font-mono text-[0.72rem] transition-colors hover:border-accent"
                >
                  <span className="font-semibold">{t.cod}</span>
                  <span>{cm(t.medida_cm)} cm</span>
                  <span className="ml-auto text-muted-foreground">{t.n_colmena || '—'}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-border bg-card p-3.5">
        {!tubo ? (
          <EmptyState
            titulo="Ficha del tubo"
            texto="Haz clic en una pieza del estante para ver de qué barra salió, en qué OT se cortó y cuánto lleva esperando."
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-[0.9375rem] font-medium">Ficha del tubo</h2>
              <Badge variant="success" className="ml-auto">
                Disponible
              </Badge>
            </div>

            <div className="mt-2.5">
              <Dato rotulo="Código">
                <span className="font-mono font-medium">{tubo.cod || '—'}</span>
              </Dato>
              <Dato rotulo="Largo">
                <span className="font-mono font-medium">{cm(tubo.medida_cm)} cm</span>
              </Dato>
              <Dato rotulo="Estante">
                <span className="font-mono">{tubo.n_colmena || 'sin ubicación'}</span>
              </Dato>
              <Dato rotulo="Serial">
                <span className="font-mono">{tubo.serial || '—'}</span>
              </Dato>
              <Dato rotulo="En el estante">
                {dias != null ? `${dias} día${dias === 1 ? '' : 's'}` : 'sin fecha de ingreso'}
              </Dato>
            </div>

            <div className="mb-2 mt-3.5 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              De dónde viene
            </div>
            {cargandoRecorrido ? (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando su historia…
              </div>
            ) : recorrido.length === 0 ? (
              <p className="text-[0.72rem] leading-relaxed text-muted-foreground">
                Este tubo no tiene eventos registrados. Pasa con los que entraron antes de que el
                optimizador llevara historial: está en el estante, pero nadie anotó de dónde vino.
              </p>
            ) : (
              <div className="flex flex-col">
                {recorrido.map((p, i) => (
                  <Paso key={p.id} paso={p} ultimo={i === recorrido.length - 1} />
                ))}
              </div>
            )}

            <div className="mt-auto flex gap-2 pt-3.5">
              <Button variant="outline" size="sm" className="flex-1" onClick={onVerHistorial}>
                Ver historial
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link to="/ojo-de-dios">Corregir</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FichaTuboPanel;
