// Un estante de la colmena de tubería (lámina «Tubos de aluminio»).
//
// La lámina muestra los TUBOS de cada estante, no solo cuántos hay: es la
// diferencia entre «A28 tiene 19» y «en A28 hay un E 39 de 248». Cada fila es
// una pieza y se puede clicar para ver su historia.
//
// El blanco (E 03) se dibuja distinto de los grises a propósito: el
// optimizador no los mezcla en una misma ubicación, y si un estante los junta
// hay que ir a mirarlo al galpón.

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EstanteTubos, TuboColmena } from '@/modules/tubos/colmenaTubos';
import { cm, esTuboBlanco, mezclaGrisYBlanco } from '@/modules/tubos/fichaTubo';

/** Cuántas piezas se ven antes del «+N más». */
export const TUBOS_VISIBLES = 6;

export function EstanteCard({
  estante,
  visible,
  resaltado,
  elegidoId,
  expandido,
  onExpandir,
  onElegir,
}: {
  estante: EstanteTubos;
  /** ¿Este tubo pasa el filtro de familia? */
  visible: (t: TuboColmena) => boolean;
  /** ¿Este tubo calza con la búsqueda? */
  resaltado: (t: TuboColmena) => boolean;
  elegidoId: string | null;
  expandido: boolean;
  onExpandir: () => void;
  onElegir: (t: TuboColmena) => void;
}) {
  const dentro = estante.tubos.filter(visible);
  const mostrados = expandido ? dentro : dentro.slice(0, TUBOS_VISIBLES);
  const ocultos = dentro.length - mostrados.length;
  const tieneElegido = dentro.some((t) => t.id === elegidoId);
  const mezclado = mezclaGrisYBlanco(estante.tubos);

  return (
    <div
      className={cn(
        'rounded-lg border border-border p-2.5',
        tieneElegido && 'border-accent',
        dentro.length === 0 && 'opacity-40',
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <b className="font-mono text-xs font-semibold">{estante.colmena}</b>
        {estante.nota && (
          <span className="text-[0.625rem] uppercase tracking-[0.06em] text-muted-foreground">
            {estante.nota}
          </span>
        )}
        {mezclado && (
          <AlertTriangle
            className="h-3 w-3 shrink-0 text-warning"
            aria-label="Este estante junta tubo blanco con gris"
          />
        )}
        <Badge variant={tieneElegido ? 'accent' : 'muted'} className="ml-auto">
          {dentro.length}
        </Badge>
      </div>

      {dentro.length === 0 ? (
        <p className="py-1 text-center text-[0.6875rem] text-muted-foreground">
          nada de lo filtrado
        </p>
      ) : (
        <div className="flex flex-col gap-[3px]">
          {mostrados.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onElegir(t)}
              title={`${t.cod} · ${cm(t.medida_cm)} cm${t.serial ? ` · ${t.serial}` : ''}`}
              className={cn(
                'flex h-[22px] items-center justify-between rounded-[3px] px-1.5 font-mono text-[0.59rem] font-medium transition-colors',
                esTuboBlanco(t.cod) ? 'bg-secondary' : 'bg-foreground/10',
                resaltado(t) && 'ring-1 ring-warning',
                t.id === elegidoId &&
                  'bg-accent/[0.22] text-accent shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.5)]',
              )}
            >
              <span>{t.cod}</span>
              <span>{cm(t.medida_cm)}</span>
            </button>
          ))}
          {ocultos > 0 && (
            <button
              type="button"
              onClick={onExpandir}
              className="pt-0.5 text-center text-[0.625rem] text-muted-foreground hover:text-accent"
            >
              +{ocultos} más
            </button>
          )}
          {expandido && dentro.length > TUBOS_VISIBLES && (
            <button
              type="button"
              onClick={onExpandir}
              className="pt-0.5 text-center text-[0.625rem] text-muted-foreground hover:text-accent"
            >
              ver menos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default EstanteCard;
